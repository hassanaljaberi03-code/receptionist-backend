import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());
// CORS - giv frontend lov til at kalde API'et fra browseren
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); 
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204); // svar hurtigt på preflight
  }
  next();
});

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

app.get("/", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
