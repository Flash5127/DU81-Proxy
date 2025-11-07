import express from "express";
import fetch from "node-fetch";

const app = express();
const PORT = process.env.PORT || 3000;

// ---------------------
// Helper: safe JSON fetch
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// ---------------------
// 1️⃣ Fetch user games
app.get("/v2/users/:userId/games", async (req, res) => {
  try {
    const { userId } = req.params;
    const { accessFilter = "Public", sortOrder = "Asc", limit = 10, cursor } = req.query;

    let url = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=${accessFilter}&sortOrder=${sortOrder}&limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;

    const data = await fetchJson(url);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------
// 2️⃣ Fetch gamepasses
app.get("/gamepasses/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const apiUrl = `https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes`;
    const data = await fetchJson(apiUrl);

    // Transform to Lua-friendly format
    const gamePasses = (data.data || []).map(pass => ({
      id: pass.id,
      name: pass.name,
      price: pass.price || 0,
      creatorTargetId: pass.creator.id
    }));

    res.json({ gamePasses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------
// 3️⃣ Fetch avatar assets / clothes
app.get("/clothes/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const categories = ["tshirts", "shirts", "pants"];
    let items = {};

    for (const category of categories) {
      const data = await fetchJson(
        `https://avatar.roblox.com/v1/users/${userId}/currently-wearing`
      );

      // Transform to Lua-friendly format
      items[category] = {
        items: (data.data || []).map(asset => ({
          id: asset.assetId,
          name: asset.name,
          price: asset.price || 0,
          creatorTargetId: asset.creator.id
        }))
      };
    }

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------
app.listen(PORT, () => {
  console.log(`DU81-Proxy running on port ${PORT}`);
});
