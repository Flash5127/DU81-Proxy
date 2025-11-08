// index.js
const express = require("express");
const fetch = require("node-fetch");
const app = express();

// ---- Helper function to fetch data from Roblox ----
async function fetchRobloxJSON(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "RobloxProxy/1.0",
      "Accept": "application/json"
    }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Roblox fetch failed: ${text}`);
  }
  return await response.json();
}

// ---- Gamepasses Route ----
app.get("/gamepasses/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    // Roblox API endpoint for user gamepasses
    const robloxUrl = `https://games.roblox.com/v1/users/${userId}/game-passes`;
    const data = await fetchRobloxJSON(robloxUrl);

    // Convert to format Lua expects
    const gamePasses = (data.data || []).map(pass => ({
      id: pass.id,
      name: pass.name,
      price: pass.price || 0
    }));

    res.json({ gamePasses });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch gamepasses" });
  }
});

// ---- Avatar Items / Clothes Route ----
app.get("/clothes/:id", async (req, res) => {
  const userId = req.params.id;
  try {
    // Roblox API endpoint for user assets
    const robloxUrl = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`;
    const data = await fetchRobloxJSON(robloxUrl);

    // Build Lua-compatible structure
    const items = { shirts: { items: [] }, pants: { items: [] }, tshirts: { items: [] } };

    (data.data || []).forEach(asset => {
      let category = "Asset";
      if (asset.assetType && asset.assetType.id === 11) category = "Shirt";
      if (asset.assetType && asset.assetType.id === 12) category = "Pants";
      if (asset.assetType && asset.assetType.id === 13) category = "T-Shirt";

      items[category.toLowerCase()]?.items.push({
        id: asset.assetId,
        name: asset.name,
        price: asset.price || 0,
        creatorTargetId: asset.creator?.id || 0
      });
    });

    res.json({ items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch avatar items" });
  }
});

// ---- Start Server ----
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
  console.log(`Available at https://du81-proxy.onrender.com`);
});
