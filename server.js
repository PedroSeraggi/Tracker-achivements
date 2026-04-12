// ══════════════════════════════════════════════════════════
//  Steam Trophy Tracker — Servidor Node.js
//  Autenticação via Steam OpenID + Proxy da API Steam
// ══════════════════════════════════════════════════════════

require('dotenv').config();

const express    = require('express');
const session    = require('express-session');
const passport   = require('passport');
const Steam      = require('passport-steam').Strategy;
const fetch      = require('node-fetch');
const path       = require('path');

const app     = express();
const PORT    = process.env.PORT    || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// ── Validação de variáveis obrigatórias ──
if (!process.env.STEAM_API_KEY || process.env.STEAM_API_KEY === 'SUA_CHAVE_AQUI') {
  console.error('\n❌ ERRO: STEAM_API_KEY não configurada!');
  console.error('   Copie o arquivo .env.example para .env e preencha sua chave.\n');
  process.exit(1);
}

// ══════════════════════════════════════════════════════════
//  PASSPORT — Steam OpenID
// ══════════════════════════════════════════════════════════

passport.use(new Steam(
  {
    returnURL : `${BASE_URL}/auth/steam/callback`,
    realm     : `${BASE_URL}/`,
    apiKey    : process.env.STEAM_API_KEY,
  },
  // Callback chamado após autenticação bem-sucedida
  (identifier, profile, done) => {
    // profile._json contém todos os dados do perfil Steam
    const user = {
      steamId      : profile.id,
      personaname  : profile.displayName,
      avatar       : profile._json.avatarfull || profile._json.avatar || '',
      profileurl   : profile._json.profileurl || '',
      realname     : profile._json.realname   || '',
      loccountrycode: profile._json.loccountrycode || '',
    };
    return done(null, user);
  }
));

// Serializa o usuário para a sessão (salva apenas o steamId)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// ══════════════════════════════════════════════════════════
//  MIDDLEWARES
// ══════════════════════════════════════════════════════════

app.use(express.json());

// Sessão com cookie seguro
app.use(session({
  secret           : process.env.SESSION_SECRET || 'steam-tracker-dev-secret',
  resave           : false,
  saveUninitialized: false,
  cookie           : {
    maxAge  : 7 * 24 * 60 * 60 * 1000, // 7 dias
    secure  : BASE_URL.startsWith('https'),
    httpOnly: true,
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// ── Proxy para How Long To Beat ──────────────────────────────
app.post('/api/hltb', requireAuth, async (req, res) => {
  const { gameName } = req.body;
  if (!gameName) return res.status(400).json({ error: 'Nome do jogo obrigatório' });

  const searchUrl = 'https://howlongtobeat.com/api/search';
  const payload = {
    searchType: 'games',
    searchTerms: gameName.split(' '),
    searchPage: 1,
    size: 10,
    searchOptions: {
      games: {
        userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main',
        rangeTime: { min: 0, max: 0 },
        gameplay: { perspective: '', flow: '', genre: '' }, modifier: ''
      },
      users: { sortCategory: 'postcount' },
      filter: '', sort: 0, randomizer: 0
    }
  };

  try {
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify(payload),
      timeout: 10000
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `HLTB API retornou ${response.status}` });
    }

    const data = await response.json();

    if (data?.data && data.data.length > 0) {
      const matches = data.data.map(game => {
        const hltbName = game.game_name?.toLowerCase() || '';
        const searchName = gameName.toLowerCase();
        let score = 0;
        if (hltbName === searchName) score = 100;
        else if (hltbName.includes(searchName)) score = 80;
        else if (searchName.includes(hltbName)) score = 60;
        else {
          const hltbWords = hltbName.split(/\s+/);
          const searchWords = searchName.split(/\s+/);
          const common = hltbWords.filter(w => searchWords.includes(w));
          score = (common.length / Math.max(hltbWords.length, searchWords.length)) * 50;
        }
        return { game, score };
      });

      matches.sort((a, b) => b.score - a.score);
      const bestMatch = matches[0].game;

      return res.json({
        main: Math.round(bestMatch.gameplayMain || 0),
        mainExtra: Math.round(bestMatch.gameplayMainExtra || 0),
        completionist: Math.round(bestMatch.gameplayCompletionist || 0),
        name: bestMatch.game_name
      });
    }

    res.json(null);
  } catch (err) {
    console.error('[HLTB] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dados do HLTB' });
  }
});

// Servir os arquivos estáticos do projeto (HTML, CSS, JS)
app.use(express.static(path.join(__dirname)));

// ══════════════════════════════════════════════════════════
//  ROTAS DE AUTENTICAÇÃO
// ══════════════════════════════════════════════════════════

// Inicia o fluxo OpenID — redireciona para a Steam
app.get('/auth/steam', passport.authenticate('steam', { failureRedirect: '/' }));

// Callback após login na Steam
app.get(
  '/auth/steam/callback',
  passport.authenticate('steam', { failureRedirect: '/?login_error=1' }),
  (req, res) => {
    // Login bem-sucedido — volta para a página principal
    res.redirect('/');
  }
);

// Logout
app.post('/api/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy();
    res.json({ ok: true });
  });
});

// ══════════════════════════════════════════════════════════
//  ROTAS DA API
// ══════════════════════════════════════════════════════════

// Middleware: garante que o usuário está autenticado
function requireAuth(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Não autenticado', redirect: '/auth/steam' });
}

// Retorna os dados do usuário logado
app.get('/api/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      steamId      : req.user.steamId,
      personaname  : req.user.personaname,
      avatar       : req.user.avatar,
      profileurl   : req.user.profileurl,
      realname     : req.user.realname,
      loccountrycode: req.user.loccountrycode,
    });
  } else {
    res.json({ steamId: null });
  }
});

// ── Proxy para a API da Steam ──────────────────────────────
app.get('/api/steam', requireAuth, async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Parâmetro url obrigatório' });

  try {
    const targetUrl = new URL(decodeURIComponent(url));
    targetUrl.searchParams.set('key', process.env.STEAM_API_KEY);

    const response = await fetch(targetUrl.toString(), {
      headers: { 'Accept': 'application/json' },
      timeout: 15000,
    });

    // Para endpoints de conquistas, 400/403 significa "jogo sem conquistas ou perfil privado"
    // Retornamos 200 com estrutura vazia para não poluir o console do cliente
    if (!response.ok) {
      const path = targetUrl.pathname;
      if (path.includes('GetPlayerAchievements') || path.includes('GetSchemaForGame')) {
        return res.json({ playerstats: { achievements: [] }, game: { availableGameStats: { achievements: [] } } });
      }
      return res.status(response.status).json({ error: `Steam API retornou ${response.status}` });
    }

    res.json(await response.json());
  } catch (err) {
    console.error('[API/Steam] Erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════
//  ROTAS DE BUSCA DE JOGADORES
// ══════════════════════════════════════════════════════════

// Helper: faz chamada à Steam API com a chave do servidor
async function steamAPI(url) {
  const u = new URL(url);
  u.searchParams.set('key', process.env.STEAM_API_KEY);
  const res = await fetch(u.toString(), { headers: { Accept: 'application/json' }, timeout: 12000 });
  if (!res.ok) throw new Error(`Steam API ${res.status}`);
  return res.json();
}

// GET /api/player/search?query=...
// Recebe um SteamID64 ou vanity URL e devolve o perfil público do jogador.
app.get('/api/player/search', requireAuth, async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Parâmetro query obrigatório' });

  try {
    let steamId = query.trim();

    // Se não for um SteamID64 numérico, tenta resolver como vanity URL
    if (!/^\d{17}$/.test(steamId)) {
      // Remove prefixos comuns que o usuário pode colar
      steamId = steamId
        .replace(/https?:\/\/steamcommunity\.com\/id\//i, '')
        .replace(/https?:\/\/steamcommunity\.com\/profiles\//i, '')
        .replace(/\/$/, '')
        .trim();

      // Se ainda não for numérico, resolve como vanity URL
      if (!/^\d{17}$/.test(steamId)) {
        const vanity = await steamAPI(
          `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v0001/?vanityurl=${encodeURIComponent(steamId)}`
        );
        if (vanity?.response?.success !== 1) {
          return res.status(404).json({ error: 'Jogador não encontrado. Tente com o SteamID64 (17 dígitos).' });
        }
        steamId = vanity.response.steamid;
      }
    }

    // Busca o perfil público
    const summary = await steamAPI(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?steamids=${steamId}`
    );
    const player = summary?.response?.players?.[0];
    if (!player) return res.status(404).json({ error: 'Perfil não encontrado.' });

    const result = {
      steamId      : player.steamid,
      personaname  : player.personaname  || '',
      avatar       : player.avatarfull   || player.avatar || '',
      profileurl   : player.profileurl   || '',
      realname     : player.realname     || '',
      loccountrycode: player.loccountrycode || '',
      communityvisibilitystate: player.communityvisibilitystate, // 3 = público
    };

    res.json(result);
  } catch (err) {
    console.error('Erro ao buscar jogador:', err.message);
    res.status(500).json({ error: 'Erro ao buscar jogador na Steam.' });
  }
});

// GET /api/player/:steamid/games
// Retorna os jogos públicos com contagem de conquistas de outro jogador.
// Só funciona se o perfil do jogador for público.
app.get('/api/player/:steamid/games', requireAuth, async (req, res) => {
  const { steamid } = req.params;
  if (!/^\d{17}$/.test(steamid)) return res.status(400).json({ error: 'SteamID inválido' });

  try {
    const owned = await steamAPI(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?steamid=${steamid}&include_appinfo=true&include_played_free_games=true`
    );

    if (!owned?.response?.games) {
      return res.status(403).json({ error: 'Perfil privado ou sem jogos públicos.' });
    }

    const games = owned.response.games
      .filter(g => g.name)
      .map(g => ({
        appid   : g.appid,
        name    : g.name,
        playtime: g.playtime_forever || 0,
      }))
      .sort((a, b) => b.playtime - a.playtime);

    res.json({ games });
  } catch (err) {
    console.error('Erro ao buscar jogos:', err.message);
    res.status(500).json({ error: 'Erro ao buscar jogos na Steam.' });
  }
});

// GET /api/player/:steamid/achievements/:appid
// Retorna as conquistas de um jogo específico de outro jogador.
app.get('/api/player/:steamid/achievements/:appid', requireAuth, async (req, res) => {
  const { steamid, appid } = req.params;
  console.log('[API/Achievements] Buscando conquistas:', steamid, appid);

  if (!/^\d{17}$/.test(steamid)) return res.status(400).json({ error: 'SteamID inválido' });

  try {
    const [schema, player, global_] = await Promise.all([
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?appid=${appid}&l=portuguese`),
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&steamid=${steamid}&l=portuguese`),
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`),
    ]);

    const schemaAchs  = schema?.game?.availableGameStats?.achievements || [];
    const playerAchs  = player?.playerstats?.achievements || [];
    const globalList  = global_?.achievementpercentages?.achievements || [];

    console.log('[API/Achievements] Schema:', schemaAchs.length, '| Player:', playerAchs.length, '| Global:', globalList.length);

    const playerMap = {};
    playerAchs.forEach(a => { playerMap[a.apiname] = a; });

    const globalMap = {};
    globalList.forEach(a => { globalMap[a.name] = parseFloat(a.percent); });

    const achievements = schemaAchs.map(sa => {
      const pa = playerMap[sa.name] || {};
      const globalPct = globalMap[sa.name] ?? undefined;
      return {
        id        : sa.name,
        name      : sa.displayName || sa.name,
        desc      : sa.description || '',
        icon      : sa.icon     || '',
        iconGray  : sa.icongray || '',
        unlocked  : pa.achieved === 1,
        unlockTime: pa.unlocktime || 0,
        globalPct,
      };
    });

    const done  = achievements.filter(a => a.unlocked).length;
    const total = achievements.length;
    const pct   = total ? Math.round((done / total) * 100) : 0;

    console.log('[API/Achievements] Total conquistas:', total, '| Desbloqueadas:', done);
    res.json({ achievements, done, total, pct });
  } catch (err) {
    console.error('[API/Achievements] Erro:', err.message);
    // Conquistas privadas ou jogo sem conquistas
    res.status(403).json({ error: 'Conquistas não disponíveis para este perfil/jogo.' });
  }
});

// GET /api/compare/:targetSteamId/:appid
// Busca conquistas do usuário logado E do jogador alvo para o mesmo jogo,
// retornando tudo em uma única chamada para o cliente montar a comparação.
app.get('/api/compare/:targetSteamId/:appid', requireAuth, async (req, res) => {
  const { targetSteamId, appid } = req.params;
  const mySteamId = req.user.steamId;

  if (!/^\d{17}$/.test(targetSteamId)) return res.status(400).json({ error: 'SteamID inválido' });

  try {
    // Busca schema, conquistas de ambos os jogadores e percentuais globais em paralelo
    const [schema, myAchs, theirAchs, globalData] = await Promise.all([
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?appid=${appid}&l=portuguese`),
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&steamid=${mySteamId}&l=portuguese`)
        .catch(() => ({ playerstats: { achievements: [] } })),
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&steamid=${targetSteamId}&l=portuguese`)
        .catch(() => ({ playerstats: { achievements: [] } })),
      steamAPI(`https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`)
        .catch(() => ({ achievementpercentages: { achievements: [] } })),
    ]);

    const schemaAchs = schema?.game?.availableGameStats?.achievements || [];
    const myMap     = {};
    const theirMap  = {};
    const globalMap = {};

    (myAchs?.playerstats?.achievements    || []).forEach(a => { myMap[a.apiname]    = a; });
    (theirAchs?.playerstats?.achievements || []).forEach(a => { theirMap[a.apiname] = a; });
    (globalData?.achievementpercentages?.achievements || []).forEach(a => { globalMap[a.name] = parseFloat(a.percent); });

    const achievements = schemaAchs.map(sa => ({
      id        : sa.name,
      name      : sa.displayName || sa.name,
      desc      : sa.description || '',
      icon      : sa.icon     || '',
      iconGray  : sa.icongray || '',
      globalPct : globalMap[sa.name] ?? undefined,
      // Status de cada jogador
      myUnlocked    : (myMap[sa.name]?.achieved    === 1),
      myUnlockTime  : myMap[sa.name]?.unlocktime    || 0,
      theirUnlocked : (theirMap[sa.name]?.achieved  === 1),
      theirUnlockTime: theirMap[sa.name]?.unlocktime || 0,
    }));

    const myDone    = achievements.filter(a => a.myUnlocked).length;
    const theirDone = achievements.filter(a => a.theirUnlocked).length;
    const total     = achievements.length;

    res.json({
      achievements,
      total,
      me    : { done: myDone,    pct: total ? Math.round((myDone    / total) * 100) : 0 },
      them  : { done: theirDone, pct: total ? Math.round((theirDone / total) * 100) : 0 },
    });
  } catch (err) {
    console.error('[API/Compare] Erro:', err.message);
    res.status(500).json({ error: 'Erro ao buscar dados para comparação.' });
  }
});

// ══════════════════════════════════════════════════════════
//  INICIAR SERVIDOR
// ══════════════════════════════════════════════════════════

app.listen(PORT, () => {
  console.log('\n🏆 Steam Trophy Tracker rodando!');
  console.log(`   Acesse: ${BASE_URL}`);
  console.log(`   Para logar com a Steam: ${BASE_URL}/auth/steam\n`);
});
