/**
 * Steam Trophy Tracker — Backend Express
 *
 * Endpoints:
 *   GET  /auth/steam                              → redireciona para login Steam
 *   GET  /auth/steam/return                       → callback do OpenID
 *   POST /auth/logout                             → encerra sessão
 *   GET  /api/me                                  → dados do usuário logado
 *   GET  /api/games                               → jogos do usuário logado
 *   GET  /api/games/:appId/achievements           → conquistas do usuário logado
 *   GET  /api/player/:steamId/games              → jogos de outro jogador
 *   GET  /api/player/:steamId/library            → biblioteca completa de outro jogador
 *   GET  /api/player/:steamId/games/:appId/achievements → conquistas de outro jogador
 *   GET  /api/search?q=...                        → busca jogador por SteamID / URL
 */

'use strict';

require('dotenv').config();

const express   = require('express');
const session   = require('express-session');
const passport  = require('passport');
const Steam     = require('passport-steam').Strategy;
const path      = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────
const API_KEY     = process.env.STEAM_API_KEY;
const SECRET      = process.env.SESSION_SECRET || 'change-me-in-production';
const PORT        = parseInt(process.env.PORT || '3000', 10);
const BASE_URL    = process.env.BASE_URL || `http://localhost:${PORT}`;

if (!API_KEY) {
  console.error('❌  STEAM_API_KEY não encontrada no .env');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const STEAM_API = 'https://api.steampowered.com';
const STORE_API = 'https://store.steampowered.com';

async function steamGet(path, params = {}) {
  const url = new URL(`${STEAM_API}${path}`);
  url.searchParams.set('key', API_KEY);
  url.searchParams.set('format', 'json');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Steam API ${res.status}: ${path}`);
  return res.json();
}

// Converte SteamID64 ou vanity URL para SteamID64
async function resolveSteamId(query) {
  query = query.trim();

  // Já é SteamID64 (17 dígitos numéricos)
  if (/^\d{17}$/.test(query)) return query;

  // Extrai /id/NOME ou /profiles/STEAMID de URLs
  const urlMatch = query.match(/\/(?:id|profiles)\/([^/]+)\/?$/);
  if (urlMatch) {
    const part = urlMatch[1];
    if (/^\d{17}$/.test(part)) return part;
    query = part;
  }

  // Tenta resolver como vanity URL
  const data = await steamGet('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: query });
  if (data?.response?.success === 1) return data.response.steamid;

  throw new Error('Jogador não encontrado');
}

async function getPlayerSummary(steamId) {
  const data = await steamGet('/ISteamUser/GetPlayerSummaries/v2/', { steamids: steamId });
  const p    = data?.response?.players?.[0];
  if (!p) throw new Error('Jogador não encontrado');
  return {
    steamId:                   p.steamid,
    personaName:               p.personaname,
    realName:                  p.realname || null,
    avatarUrl:                 p.avatarfull,
    profileUrl:                p.profileurl,
    communityVisibilityState:  p.communityvisibilitystate,
  };
}

async function getOwnedGames(steamId) {
  const data = await steamGet('/IPlayerService/GetOwnedGames/v1/', {
    steamid:                    steamId,
    include_appinfo:            1,
    include_played_free_games:  1,
  });
  return (data?.response?.games || []).map(g => ({
    appid:                        g.appid,
    name:                         g.name || `App ${g.appid}`,
    playtime_forever:             g.playtime_forever || 0,
    has_community_visible_stats:  true, // filter later on fetch failure
  }));
}

async function getAchievements(appId, steamId) {
  // Fire all 3 Steam API calls in parallel
  const [schemaData, statsData, pctData] = await Promise.all([
    steamGet('/ISteamUserStats/GetSchemaForGame/v2/', { appid: appId }).catch(() => null),
    steamGet('/ISteamUserStats/GetPlayerAchievements/v1/', {
      steamid: steamId,
      appid:   appId,
      l:       'portuguese',
    }).catch(() => null),
    steamGet('/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/', {
      gameid: appId,
    }).catch(() => null),
  ]);

  const schema     = schemaData?.game?.availableGameStats?.achievements || [];
  const playerAchs = statsData?.playerstats?.achievements || [];

  const pctMap = {};
  for (const p of pctData?.achievementpercentages?.achievements || []) {
    pctMap[p.name] = p.percent;
  }

  const playerMap = {};
  for (const a of playerAchs) playerMap[a.apiname] = a;

  return schema.map(s => {
    const p = playerMap[s.name] || {};
    return {
      apiname:     s.name,
      name:        p.name || s.displayName || s.name,
      description: p.description || s.description || '',
      icon:        s.icon        || '',
      icongray:    s.icongray    || '',
      achieved:    p.achieved    || 0,
      unlocktime:  p.unlocktime  || 0,
      percent:     pctMap[s.name] != null ? Number(pctMap[s.name]) : null,
    };
  });
}

// ─── Passport / Steam OpenID ──────────────────────────────────────────────────
passport.serializeUser((user, done)   => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

passport.use(new Steam(
  {
    returnURL: `${BASE_URL}/auth/steam/return`,
    realm:     BASE_URL,
    apiKey:    API_KEY,
  },
  async (_identifier, profile, done) => {
    try {
      const user = await getPlayerSummary(profile.id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  }
));

// ─── App ─────────────────────────────────────────────────────────────────────
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(session({
  secret:            SECRET,
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   BASE_URL.startsWith('https'),
    maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'lax',
  },
}));

app.use(passport.initialize());
app.use(passport.session());

// ─── Auth routes ──────────────────────────────────────────────────────────────
app.get('/auth/steam',
  passport.authenticate('steam', { failureRedirect: '/' })
);

app.get('/auth/steam/return',
  passport.authenticate('steam', { failureRedirect: '/?error=auth' }),
  (req, res) => {
    // Em dev, o frontend está em :5173; em prod, servimos o build do React
    const frontendUrl = process.env.NODE_ENV === 'production'
      ? `${BASE_URL}/?loggedIn=1`
      : `http://localhost:5173/?loggedIn=1`;
    res.redirect(frontendUrl);
  }
);

app.post('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.json({ ok: true }));
  });
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Não autenticado' });
}

// ─── API routes ───────────────────────────────────────────────────────────────

// Dados do usuário logado
app.get('/api/me', (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json(null);
  res.json(req.user);
});

// Jogos do usuário logado
app.get('/api/games', requireAuth, async (req, res) => {
  try {
    const games = await getOwnedGames(req.user.steamId);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conquistas do usuário logado para um jogo
app.get('/api/games/:appId/achievements', requireAuth, async (req, res) => {
  try {
    const achs = await getAchievements(Number(req.params.appId), req.user.steamId);
    res.json(achs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Buscar jogador por SteamID64, vanity URL ou link do perfil
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const steamId = await resolveSteamId(req.query.q || '');
    const summary = await getPlayerSummary(steamId);
    res.json(summary);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Dados de outro jogador
app.get('/api/player/:steamId/summary', requireAuth, async (req, res) => {
  try {
    const summary = await getPlayerSummary(req.params.steamId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Biblioteca completa de outro jogador (para LibraryModal)
app.get('/api/player/:steamId/library', requireAuth, async (req, res) => {
  try {
    const games = await getOwnedGames(req.params.steamId);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Jogos de outro jogador (com has_community_visible_stats)
app.get('/api/player/:steamId/games', requireAuth, async (req, res) => {
  try {
    const games = await getOwnedGames(req.params.steamId);
    res.json(games);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conquistas de outro jogador para um jogo
app.get('/api/player/:steamId/games/:appId/achievements', requireAuth, async (req, res) => {
  try {
    const achs = await getAchievements(Number(req.params.appId), req.params.steamId);
    res.json(achs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Servir build do React em produção ───────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n🏆  Steam Trophy Tracker backend rodando!');
  console.log(`   API:    http://localhost:${PORT}`);
  console.log(`   Login:  http://localhost:${PORT}/auth/steam`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`   React:  http://localhost:5173  (npm run dev em outra aba)\n`);
  }
});
