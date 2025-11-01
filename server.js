import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- vigtigt for Twilio (x-www-form-urlencoded)

//
// CORS - så din frontend må kalde backend fra browseren
//
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

//
// 1) WEB-FORM route: /ai/lead
//    (det her har du allerede, men jeg inkluderer det her så du ser helheden)
//
app.post("/ai/lead", async (req, res) => {
  const data = req.body;
  const makeUrl = process.env.MAKE_WEBHOOK_URL;

  if (!data.name || !data.phone || !data.message) {
    return res.status(400).json({ ok: false, error: "Missing fields" });
  }

  try {
    const payload = {
      Dato: new Date().toISOString().slice(0, 10),
      Navn: data.name,
      Telefonnummer: data.phone,
      Besked: data.message,
    };

    const r = await fetch(makeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!r.ok) throw new Error(`Make responded ${r.status}`);

    res.json({ ok: true });
  } catch (err) {
    console.error("FEJL I BACKEND:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

//
// 2) TWILIO ANSWER ROUTE: /voice
//    Twilio kalder denne lige NÅR nogen ringer.
//    Vi svarer med lidt tale (Thomas præsenterer sig) og beder dem forklare problemet.
//    Så beder vi Twilio optage beskeden og sende den bagefter til /voice-recording
//
app.post("/voice", (req, res) => {
  // Vi sender TwiML (XML) direkte tilbage.
  // Bemærk: voice="alice" + language="da-DK" giver dansk stemme.
  const twiml = `
    <Response>
      <Say voice="alice" language="da-DK">
        Hej, du har ringet til Thomas fra vagt V V S.
        Vi er optaget lige nu, men jeg kan tage dine oplysninger.
        Sig dit navn, telefonnummer, og hvad problemet er.
        Når du er færdig, så stop bare med at tale.
      </Say>
      <Record
        maxLength="60"
        playBeep="true"
        action="/voice-recording"
        method="POST"
        finishOnKey="#"
      />
      <Say voice="alice" language="da-DK">
        Tak for din besked. Vi ringer dig op så snart vi kan. Farvel.
      </Say>
      <Hangup/>
    </Response>
  `.trim();

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

//
// 3) TWILIO AFTER-RECORD ROUTE: /voice-recording
//    Twilio kalder denne EFTER kunden har talt færdig.
//    Her får vi: RecordingUrl, Caller, Timestamp osv.
//    Her kan vi sende det ind i det samme Google Sheet via Make.
//
//    Plan:
//    - Vi laver et payload objekt
//    - Vi sender det til Make webhook (SAMME som web formularen, så alt lander ét sted)
//
app.post("/voice-recording", async (req, res) => {
  try {
    const makeUrl = process.env.MAKE_WEBHOOK_URL;

    // Twilio sender data som form-data, fx:
    // From="+13082706268"
    // RecordingUrl="https://api.twilio.com/...."
    // RecordingDuration="12"
    const {
      From,
      RecordingUrl,
      RecordingDuration,
      Timestamp,
      CallSid,
    } = req.body;

    // Laver et payload der passer til dit sheet
    const payload = {
      Dato: new Date().toISOString().slice(0, 10),
      Navn: "(Telefonopkald)",
      Telefonnummer: From || "",
      Besked:
        `Opkald lagt på telefonsvarer.\n` +
        `Varighed: ${RecordingDuration || "ukendt"} sek.\n` +
        `Lyd: ${RecordingUrl}\n` +
        `CallSid: ${CallSid || ""}\n` +
        `Timestamp: ${Timestamp || ""}`,
    };

    // Send til Make (som så smider det i Google Sheet)
    await fetch(makeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // Twilio forventer et TwiML svar her, selvom vi allerede har sagt tak
    const doneTwiml = `
      <Response>
        <Say voice="alice" language="da-DK">
          Tak. Vi har gemt din besked.
        </Say>
        <Hangup/>
      </Response>
    `.trim();

    res.set("Content-Type", "text/xml");
    res.send(doneTwiml);
  } catch (err) {
    console.error("FEJL voice-recording:", err);

    // selv ved fejl svarer vi Twilio med noget gyldigt TwiML
    const errorTwiml = `
      <Response>
        <Say voice="alice" language="da-DK">
          Beklager, der skete en teknisk fejl. Farvel.
        </Say>
        <Hangup/>
      </Response>
    `.trim();

    res.set("Content-Type", "text/xml");
    res.send(errorTwiml);
  }
});

//
// 4) healthcheck (har du allerede / kan beholdes)
//
app.get("/", (req, res) => res.json({ ok: true }));

// start server
const port = process.env.PORT || 10000;
app.listen(port, () => console.log("Server running on port", port));

