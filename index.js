const express = require("express");
const fetch = require("node-fetch"); // make sure node-fetch is installed
const app = express();
const PORT = process.env.PORT || 3000;

// Fetch gamepasses for a user
app.get("/gamepasses/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        const url = `https://inventory.roblox.com/v1/users/${userId}/inventory/asset-type/9?sortOrder=Asc&limit=100`;

        const response = await fetch(url);
        const data = await response.json();

        // Format JSON for your Lua script
        const gamePasses = (data.data || []).map(pass => ({
            id: pass.assetId,
            name: pass.name,
            price: pass.price || 0
        }));

        res.json({ gamePasses });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch gamepasses" });
    }
});

app.listen(PORT, () => console.log(`Gamepass proxy running on port ${PORT}`));
