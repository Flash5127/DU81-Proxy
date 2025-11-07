const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------
// Fetch games for a user
// -------------------------------
app.get("/v2/users/:userId/games", async (req, res) => {
  try {
    const { userId } = req.params;
    const { accessFilter = "Public", sortOrder = "Asc", limit = 10, cursor } = req.query;

    let url = `https://games.roblox.com/v2/users/${userId}/games?accessFilter=${accessFilter}&sortOrder=${sortOrder}&limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = await fetch(url);
    const data = await response.json();

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------
// Fetch gamepasses for a user
// -------------------------------
app.get("/gamepasses/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const apiUrl = `https://apis.roblox.com/game-passes/v1/users/${userId}/game-passes`;

    const data = await fetch(apiUrl).then(r => r.json());

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

// -------------------------------
// Fetch avatar assets / clothes
// -------------------------------
app.get("/clothes/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const apiUrl = `https://avatar.roblox.com/v1/users/${userId}/currently-wearing`;

    const data = await fetch(apiUrl).then(r => r.json());

    // Transform to your Lua expected format
    const items = { tshirts: { items: [] }, shirts: { items: [] }, pants: { items: [] } };

    for (const asset of data.data || []) {
      if (!asset.assetType) continue;
      if (asset.assetType.name === "TShirt") items.tshirts.items.push(asset);
      else if (asset.assetType.name === "Shirt") items.shirts.items.push(asset);
      else if (asset.assetType.name === "Pants") items.pants.items.push(asset);
    }

    res.json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------
// Start server
// -------------------------------
app.listen(PORT, () => console.log(`DU81-Proxy running on port ${PORT}`));
