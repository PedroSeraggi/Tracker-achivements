/**
 * server-duel-patch.js
 * ====================
 * Routes to ADD to your existing server.js for the Trophy Duel feature.
 *
 * HOW TO INTEGRATE:
 *   1. Copy the routes below into server.js BEFORE the app.listen() call.
 *   2. The existing `requireAuth` middleware and `STEAM_API_KEY` env var
 *      are already defined in your server.js – these routes use them.
 *
 * No new npm packages are required.
 */

// ─────────────────────────────────────────────────────────────
// Requires (already present in server.js – do NOT duplicate)
// ─────────────────────────────────────────────────────────────
// const express = require('express');
// const fetch   = require('node-fetch'); // or built-in fetch (Node 18+)
// const STEAM_KEY = process.env.STEAM_API_KEY;
// function requireAuth(req, res, next) { ... }  // already in server.js

// ─────────────────────────────────────────────────────────────
// Simple in-memory TTL cache to avoid hammering the Steam API.
// Caches per-appid for 10 minutes (rarity data changes rarely).
// ─────────────────────────────────────────────────────────────
const _duelCache = new Map(); // key → { data, expiresAt }
const DUEL_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Returns cached value if still valid, otherwise null.
 */
function _getCached(key) {
  const entry = _duelCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _duelCache.delete(key);
    return null;
  }
  return entry.data;
}

/**
 * Store value in cache with TTL.
 */
function _setCached(key, data) {
  _duelCache.set(key, { data, expiresAt: Date.now() + DUEL_CACHE_TTL_MS });
}

// ─────────────────────────────────────────────────────────────
// ROUTE 1: GET /api/achievement-rarity/:appid
//
// Returns global achievement unlock percentages for a game.
// Steam API: ISteamUserStats/GetGlobalAchievementPercentagesForApp
//
// Response shape:
// {
//   achievementpercentages: {
//     achievements: [ { name: "ACH_1", percent: 12.5 }, ... ]
//   }
// }
// ─────────────────────────────────────────────────────────────
app.get('/api/achievement-rarity/:appid', requireAuth, async (req, res) => {
  const { appid } = req.params;

  // Validate appid – only digits allowed
  if (!/^\d+$/.test(appid)) {
    return res.status(400).json({ error: 'Invalid appid' });
  }

  // Check cache
  const cacheKey = `rarity:${appid}`;
  const cached = _getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const url = new URL('https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/');
    url.searchParams.set('gameid', appid);
    url.searchParams.set('format', 'json');
    // Note: this endpoint does NOT require an API key, but including it
    // avoids rate-limit issues on some Steam CDN nodes.
    url.searchParams.set('key', process.env.STEAM_API_KEY);

    const steamRes = await fetch(url.toString());

    // Steam returns 403/500 for games with no achievements – handle gracefully
    if (steamRes.status === 403 || steamRes.status === 500) {
      const empty = { achievementpercentages: { achievements: [] } };
      _setCached(cacheKey, empty);
      return res.json(empty);
    }

    if (!steamRes.ok) {
      throw new Error(`Steam API responded with ${steamRes.status}`);
    }

    const data = await steamRes.json();
    _setCached(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);

  } catch (err) {
    console.error('[Duel] achievement-rarity error:', err.message);
    // Return empty result rather than a hard 500 so the client can degrade gracefully
    return res.json({ achievementpercentages: { achievements: [] } });
  }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 2: GET /api/game-schema/:appid
//
// Returns the schema (achievement display names, descriptions, icons)
// for a game. Used by the frontend to map apiname → displayName.
//
// Steam API: ISteamUserStats/GetSchemaForGame
//
// Response shape (proxied as-is from Steam):
// {
//   game: {
//     availableGameStats: {
//       achievements: [
//         { name, displayName, description, icon, iconGray, hidden }
//       ]
//     }
//   }
// }
// ─────────────────────────────────────────────────────────────
app.get('/api/game-schema/:appid', requireAuth, async (req, res) => {
  const { appid } = req.params;

  if (!/^\d+$/.test(appid)) {
    return res.status(400).json({ error: 'Invalid appid' });
  }

  const cacheKey = `schema:${appid}`;
  const cached = _getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const url = new URL('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/');
    url.searchParams.set('appid', appid);
    url.searchParams.set('key', process.env.STEAM_API_KEY);
    url.searchParams.set('format', 'json');

    const steamRes = await fetch(url.toString());

    if (!steamRes.ok) {
      // Return empty schema for games without stats
      const empty = { game: { availableGameStats: { achievements: [] } } };
      return res.json(empty);
    }

    const data = await steamRes.json();
    _setCached(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);

  } catch (err) {
    console.error('[Duel] game-schema error:', err.message);
    return res.json({ game: { availableGameStats: { achievements: [] } } });
  }
});

// ─────────────────────────────────────────────────────────────
// ROUTE 3: GET /api/achievements/:appid
//
// Returns the authenticated user's achievement list for a game.
// If this route ALREADY EXISTS in your server.js, skip this block.
//
// Steam API: ISteamUserStats/GetPlayerAchievements
// ─────────────────────────────────────────────────────────────
app.get('/api/achievements/:appid', requireAuth, async (req, res) => {
  const { appid } = req.params;
  const steamId = req.user?.id ?? req.session?.steamId;

  if (!steamId) return res.status(401).json({ error: 'Not authenticated' });
  if (!/^\d+$/.test(appid)) return res.status(400).json({ error: 'Invalid appid' });

  const cacheKey = `achievements:${steamId}:${appid}`;
  const cached = _getCached(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }

  try {
    const url = new URL('https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/');
    url.searchParams.set('appid', appid);
    url.searchParams.set('steamid', steamId);
    url.searchParams.set('key', process.env.STEAM_API_KEY);
    url.searchParams.set('format', 'json');

    const steamRes = await fetch(url.toString());
    if (!steamRes.ok) {
      return res.json({ playerstats: { achievements: [] } });
    }

    const data = await steamRes.json();
    _setCached(cacheKey, data);
    res.setHeader('X-Cache', 'MISS');
    return res.json(data);

  } catch (err) {
    console.error('[Duel] player achievements error:', err.message);
    return res.json({ playerstats: { achievements: [] } });
  }
});
