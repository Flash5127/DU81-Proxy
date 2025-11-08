/**
 * DU81 Gamepass Proxy (robust)
 *
 * - Fetches all gamepasses owned by a user (handles pagination)
 * - Uses headers (User-Agent / Accept) to avoid simple blocks
 * - Retries on transient errors, honors Retry-After if provided
 * - Has a short in-memory cache and request de-duplication to avoid duplicate Roblox API calls
 * - Provides fallback endpoints if primary endpoint doesn't return expected data
 *
 * Deploy to Render (or similar). Use `GET /gamepasses/:userId`
 *
 * NOTE: This attempts to be robust but can't control Roblox-side changes or rate limits.
 */

const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Configurable options ---
const CACHE_TTL_MS = 60 * 1000; // cache per-user results for 60s (reduce API calls). Increase if desired.
const REQUEST_TIMEOUT_MS = 10 * 1000; // timeout for fetch requests
const MAX_RETRIES = 3; // number of retries for transient errors
const RETRY_BASE_DELAY_MS = 400; // exponential backoff base
const MAX_PAGE_LIMIT = 100; // Roblox page size we request

// --- Simple in-memory cache and in-flight map for dedupe ---
const cache = new Map(); // userId -> { expiresAt: number, data: object }
const inFlight = new Map(); // userId -> Promise

// --- Common headers to send with Roblox API requests ---
const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Accept": "application/json, text/plain, */*"
};

// --- Helper: sleep ---
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Helper: perform fetch with retries and honor Retry-After ---
async function fetchJsonWithRetries(url, opts = {}, retries = MAX_RETRIES) {
  let attempt = 0;
  let lastErr = null;

  while (attempt <= retries) {
    try {
      const controller = new (require("abort-controller")).AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const response = await fetch(url, {
        ...opts,
        signal: controller.signal
      });
      clearTimeout(timeout);

      // If Roblox returns 429 or 503, try to honor Retry-After
      if (response.status === 429 || response.status === 503) {
        const retryAfter = response.headers.get("retry-after");
        const wait = retryAfter ? parseInt(retryAfter, 10) * 1000 : (RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        await sleep(wait);
        attempt++;
        continue;
      }

      // For 4xx non-404 errors treat as fatal (except 429 handled above).
      if (response.status >= 400 && response.status < 500) {
        // If 404, return raw JSON if any or empty structure
        try {
          const txt = await response.text();
          // Try to parse JSON if possible
          try {
            const j = JSON.parse(txt);
            return j;
          } catch (e) {
            return { error: `HTTP ${response.status}`, body: txt };
          }
        } catch (e) {
          throw new Error(`HTTP ${response.status}`);
        }
      }

      // 5xx -> transient, retry
      if (response.status >= 500) {
        lastErr = new Error(`HTTP ${response.status}`);
        attempt++;
        await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      // OK 2xx
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json") || contentType.includes("text/plain")) {
        return await response.json();
      } else {
        // try text -> parse
        const txt = await response.text();
        try {
          return JSON.parse(txt);
        } catch (e) {
          return { raw: txt };
        }
      }
    } catch (err) {
      lastErr = err;
      // if aborted due to timeout, treat as transient
      attempt++;
      await sleep(RETRY_BASE_DELAY_MS * Math.pow(2, attempt));
      continue;
    }
  }

  throw lastErr || new Error("Failed to fetch after retries");
}

// --- Function: Fetch all gamepasses owned by a user (handles pagination) ---
async function fetchAllGamepassesForUser(userId) {
  // Primary authoritative endpoint to fetch owned GamePass assets
  // Use inventory.roblox.com/v1/users/{userId}/assets/GamePass with pagination (cursor)
  const primaryBase = `https://inventory.roblox.com/v1/users/${encodeURIComponent(userId)}/assets/GamePass?limit=${MAX_PAGE_LIMIT}`;

  let cursor = null;
  const collected = [];

  // loop pages
  do {
    let url = primaryBase;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    const data = await fetchJsonWithRetries(url, { headers: DEFAULT_HEADERS });

    // Defensive: structure might vary; check expected shapes
    if (!data) break;

    // If object contains data array (common)
    if (Array.isArray(data.data) && data.data.length > 0) {
      for (const gp of data.data) {
        // gp typically includes assetId, name, price (sometimes missing), etc.
        const id = gp.assetId || gp.assetId === 0 ? gp.assetId : (gp.id || gp.assetId);
        const name = gp.name || gp.title || ("Gamepass " + id);
        const price = (typeof gp.price === "number") ? gp.price : (gp.price ? Number(gp.price) : 0);

        if (id !== undefined && id !== null) {
          collected.push({ id, name, price });
        }
      }
    }

    // If returned differently (some older endpoints), attempt to normalize
    else if (Array.isArray(data) && data.length > 0) {
      // fallback normalization
      for (const gp of data) {
        const id = gp.assetId || gp.id || gp.assetId;
        const name = gp.name || gp.title || ("Gamepass " + id);
        const price = (typeof gp.price === "number") ? gp.price : (gp.price ? Number(gp.price) : 0);
        if (id !== undefined && id !== null) collected.push({ id, name, price });
      }
    }

    // Set next cursor if present
    cursor = (data.nextPageCursor && data.nextPageCursor.length > 0) ? data.nextPageCursor : null;

    // Safety guard: if API returns no cursor and no data, break to avoid infinite loop
    if (!cursor && (!data || !data.data || data.data.length === 0)) break;
  } while (cursor);

  // If nothing found using primary, try fallback endpoints (best-effort)
  if (collected.length === 0) {
    // Fallback A: older inventory route (asset-type 9)
    try {
      const fallbackUrl = `https://games.roblox.com/v1/users/${encodeURIComponent(userId)}/inventory/asset-type/9?sortOrder=Asc&limit=${MAX_PAGE_LIMIT}`;
      const fb = await fetchJsonWithRetries(fallbackUrl, { headers: DEFAULT_HEADERS });
      if (fb && Array.isArray(fb.data) && fb.data.length > 0) {
        for (const p of fb.data) {
          const id = p.assetId || p.id || p.assetId;
          const name = p.name || p.title || ("Gamepass " + id);
          const price = (typeof p.price === "number") ? p.price : (p.price ? Number(p.price) : 0);
          if (id !== undefined && id !== null) collected.push({ id, name, price });
        }
      }
    } catch (e) {
      // ignore fallback errors but log
      console.warn("Fallback A failed:", e && e.message ? e.message : e);
    }
  }

  return collected;
}

// --- Public endpoint ---
app.get("/gamepasses/:userId", async (req, res) => {
  const userId = String(req.params.userId || "").trim();

  if (!userId || userId.length === 0) {
    return res.status(400).json({ error: "missing userId" });
  }

  try {
    // Check cache
    const cached = cache.get(userId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return res.json({ gamePasses: cached.data });
    }

    // Dedupe in-flight calls per user
    if (inFlight.has(userId)) {
      // wait for the running promise
      const existing = await inFlight.get(userId);
      return res.json({ gamePasses: existing });
    }

    // Create a promise and store in inFlight
    const promise = (async () => {
      try {
        const passes = await fetchAllGamepassesForUser(userId);

        // normalize to expected shape: array of { id, name, price }
        const normalized = (passes || []).map(p => ({
          id: Number(p.id),
          name: String(p.name || ("Gamepass " + p.id)),
          price: (typeof p.price === "number") ? p.price : (p.price ? Number(p.price) : 0)
        }));

        // Cache the result
        cache.set(userId, { expiresAt: Date.now() + CACHE_TTL_MS, data: normalized });

        return normalized;
      } finally {
        // remove inFlight after done
        inFlight.delete(userId);
      }
    })();

    // store promise to dedupe other callers
    inFlight.set(userId, promise);

    const resultArray = await promise;
    return res.json({ gamePasses: resultArray });
  } catch (err) {
    console.error("Error fetching gamepasses for user", userId, err && err.message ? err.message : err);
    return res.status(500).json({ error: "Failed to fetch gamepasses" });
  }
});

// --- Basic health endpoint ---
app.get("/", (req, res) => {
  res.json({ status: "du81 gamepass proxy", timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`DU81 gamepass proxy listening on port ${PORT}`);
});
