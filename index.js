import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

// === Gamepasses endpoint ===
app.get("/gamepasses/:userId", async (req, res) => {
  const { userId } = req.params;

  const endpoints = [
    `https://games.roblox.com/v1/users/${userId}/game-passes?limit=100`,
    `https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes?count=100`
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.text();
        res.set("Access-Control-Allow-Origin", "*");
        res.type("application/json");
        return res.status(r.status).send(data);
      }
    } catch (err) {
      console.error("Gamepass fetch failed:", err);
    }
  }

  res.status(502).json({ error: "Failed to fetch gamepasses" });
});

// === Clothes endpoint ===
app.get("/clothes/:userId", async (req, res) => {
  const { userId } = req.params;

  const endpoints = [
    `https://catalog.roblox.com/v1/users/${userId}/assets`,
    `https://avatar.roblox.com/v1/users/${userId}/currently-wearing`
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const data = await r.text();
        res.set("Access-Control-Allow-Origin", "*");
        res.type("application/json");
        return res.status(r.status).send(data);
      }
    } catch (err) {
      console.error("Clothes fetch failed:", err);
    }
  }

  res.status(502).json({ error: "Failed to fetch clothes" });
});

// === Root ===
app.get("/", (req, res) => {
  res.send("✅ Roblox proxy is online!");
});

// === Start ===
const port = process.env.PORT || 10000;
app.listen(port, () => {
  console.log(`Proxy running on port ${port}`);
});
