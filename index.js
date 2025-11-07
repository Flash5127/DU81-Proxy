const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = process.env.PORT || 3000;

// Fetch games for a user
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
    res.status(500).json({ error: "Failed to fetch Roblox API" });
  }
});

// Fetch gamepasses for a user
app.get("/gamepasses/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const url = `https://games.roblox.com/v1/users/${userId}/inventory/asset-type/9?sortOrder=Asc&limit=100`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Roblox API" });
  }
});

// Fetch avatar assets (clothes)
app.get("/clothes/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const url = `https://avatar.roblox.com/v1/users/${userId}/currently-wearing`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Roblox API" });
  }
});

app.listen(PORT, () => console.log(`Roblox proxy running on port ${PORT}`));
