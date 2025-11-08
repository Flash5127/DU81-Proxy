const express = require("express");
const fetch = require("node-fetch");
const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to fetch JSON
async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error ${res.status}`);
  return await res.json();
}

// Fetch gamepasses for a user
app.get("/gamepasses/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    let gamepasses = [];
    let cursor = null;

    do {
      // Roblox new inventory API for gamepasses
      let url = `https://inventory.roblox.com/v1/users/${userId}/assets/GamePass?limit=100`;
      if (cursor) url += `&cursor=${cursor}`;

      const data = await fetchJson(url);

      if (data.data && data.data.length > 0) {
        for (const gp of data.data) {
          gamepasses.push({
            id: gp.assetId,
            name: gp.name,
            price: gp.price || 0
          });
        }
      }

      cursor = data.nextPageCursor || null;
    } while (cursor);

    // Return in Lua script compatible format
    res.json({ gamePasses: gamepasses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch gamepasses" });
  }
});

// Start server
app.listen(PORT, () => console.log(`Gamepass proxy running on port ${PORT}`));
