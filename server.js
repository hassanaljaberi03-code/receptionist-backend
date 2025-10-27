import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();
app.use(express.json());

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
    console.error(err);
    res.status(500).json({ ok: false, error: "Server error" });
  }
});

app.get("/", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Server running on port", port));
