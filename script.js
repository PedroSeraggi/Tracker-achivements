// ══════════════════════════════════════════════════════════
//  CONFIG & STATE
// ══════════════════════════════════════════════════════════
const PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
];

let currentProxyIndex = 0;
function getProxy() { return PROXIES[currentProxyIndex]; }

const COLOR_PALETTE = [
  { accent: '#3a7acc', dot: '#60a5fa', bg: 'linear-gradient(160deg,#0a1520,#1a2a40)' },
  { accent: '#7c3aed', dot: '#a78bfa', bg: 'linear-gradient(160deg,#150a20,#2a1a40)' },
  { accent: '#059669', dot: '#34d399', bg: 'linear-gradient(160deg,#0a2015,#1a4030)' },
  { accent: '#dc2626', dot: '#f87171', bg: 'linear-gradient(160deg,#200a0a,#401a1a)' },
  { accent: '#d97706', dot: '#fbbf24', bg: 'linear-gradient(160deg,#20180a,#40301a)' },
  { accent: '#0891b2', dot: '#22d3ee', bg: 'linear-gradient(160deg,#0a1a20,#1a3040)' },
  { accent: '#be185d', dot: '#f472b6', bg: 'linear-gradient(160deg,#200a15,#401a30)' },
  { accent: '#4338ca', dot: '#818cf8', bg: 'linear-gradient(160deg,#0a0a20,#1a1a40)' },
  { accent: '#047857', dot: '#6ee7b7', bg: 'linear-gradient(160deg,#0a2018,#1a4030)' },
  { accent: '#c2410c', dot: '#fb923c', bg: 'linear-gradient(160deg,#20120a,#40281a)' },
];

function getGameMetadata(appid, gameName) {
  const hash = appid.toString().split('').reduce((a,b)=>a+parseInt(b),0);
  const colors = COLOR_PALETTE[hash % COLOR_PALETTE.length];
  return { title: gameName, subtitle: '', year: '', bg: colors.bg, accent: colors.accent, dot: colors.dot };
}

let state = {
  apiKey: '',
  steamId: '',
  games: [],
  library: [],
  trackedAppIds: new Set(),
  currentFilter: 'all',
  currentAchFilter: 'all',
  currentGameId: null,
  userInfo: {
    personaname: '',
    avatar: '',
    profileurl: '',
    realname: '',
    loccountrycode: '',
  },
  profile: {
    xp: 0,
    equippedTitle: 'novice',
    featuredGames: [],
    stats: {
      totalGames: 0,
      totalAchievements: 0,
      platinums: 0,
      golds: 0,
      silvers: 0,
      bronzes: 0,
      perfectGames: 0,
      rareAchievements: 0,
    }
  }
};

// ── PERSISTENCE ──
function save() {
  try {
    // Only save API key to localStorage if it didn't come from config.js
    const hasConfigKey = (typeof CONFIG !== 'undefined' && CONFIG.STEAM_API_KEY && CONFIG.STEAM_API_KEY !== 'SUA_API_KEY_AQUI');
    if (!hasConfigKey) {
      localStorage.setItem('steam-tracker-key', state.apiKey);
    }
    localStorage.setItem('steam-tracker-sid', state.steamId);
    localStorage.setItem('steam-tracker-games', JSON.stringify(state.games));
    localStorage.setItem('steam-tracker-tracked', JSON.stringify([...state.trackedAppIds]));
    localStorage.setItem('steam-tracker-profile', JSON.stringify(state.profile));
    localStorage.setItem('steam-tracker-user', JSON.stringify(state.userInfo));
  } catch(e) {}
}

function load() {
  try {
    // Check for API key in config.js first (private config file)
    const configKey = (typeof CONFIG !== 'undefined' && CONFIG.STEAM_API_KEY && CONFIG.STEAM_API_KEY !== 'SUA_API_KEY_AQUI')
      ? CONFIG.STEAM_API_KEY
      : '';
    state.apiKey  = configKey || localStorage.getItem('steam-tracker-key') || '';
    state.steamId = localStorage.getItem('steam-tracker-sid') || '';
    const g = localStorage.getItem('steam-tracker-games');
    if (g) state.games = JSON.parse(g);
    const t = localStorage.getItem('steam-tracker-tracked');
    if (t) state.trackedAppIds = new Set(JSON.parse(t));
    const p = localStorage.getItem('steam-tracker-profile');
    if (p) {
      const loadedProfile = JSON.parse(p);
      state.profile = { ...state.profile, ...loadedProfile };
      if (!state.profile.featuredGames) state.profile.featuredGames = [];
    }
    const u = localStorage.getItem('steam-tracker-user');
    if (u) state.userInfo = JSON.parse(u);
  } catch(e) {
    console.error('Error loading state:', e);
  }
}

// ── FETCH STEAM USER INFO ──
async function fetchUserInfo() {
  try {
    const data = await steamFetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${state.apiKey}&steamids=${state.steamId}`
    );
    const player = data?.response?.players?.[0];
    if (player) {
      state.userInfo = {
        personaname: player.personaname || 'Gamer',
        avatar: player.avatarfull || player.avatarmedium || player.avatar || '',
        profileurl: player.profileurl || `https://steamcommunity.com/profiles/${state.steamId}`,
        realname: player.realname || '',
        loccountrycode: player.loccountrycode || '',
      };
      save();
      return state.userInfo;
    }
  } catch (e) {
    console.error('Error fetching user info:', e);
  }
  return null;
}

// ── XP CALCULATION ──
function calculateTotalXP() {
  let xp = 0;
  let stats = { platinums: 0, golds: 0, silvers: 0, bronzes: 0, rare: 0, perfect: 0 };
  state.games.forEach(game => {
    let gameHasPlat = false;
    game.achievements.forEach(ach => {
      if (ach.unlocked) {
        const meta = TROPHY_META[ach.type];
        xp += meta.xp;
        if (ach.type === 'P') { stats.platinums++; gameHasPlat = true; }
        if (ach.type === 'G') stats.golds++;
        if (ach.type === 'S') stats.silvers++;
        if (ach.type === 'B') stats.bronzes++;
        if (ach.globalPct !== undefined && ach.globalPct < 5) stats.rare++;
      }
    });
    if (gameHasPlat || (game.pct === 100 && game.totalAch > 0)) stats.perfect++;
  });
  return { xp, stats };
}

function updateProfile() {
  const { xp, stats } = calculateTotalXP();
  state.profile.xp = xp;
  state.profile.stats = {
    totalGames: state.games.length,
    totalAchievements: state.games.reduce((s,g) => s + g.doneAch, 0),
    platinums: stats.platinums,
    golds: stats.golds,
    silvers: stats.silvers,
    bronzes: stats.bronzes,
    perfectGames: stats.perfect,
    rareAchievements: stats.rare,
  };
  save();
}

function equipTitle(titleId) {
  const unlocked = getUnlockedTitles(state.profile.xp);
  if (unlocked.some(t => t.id === titleId)) {
    state.profile.equippedTitle = titleId;
    save();
    renderProfile();
  }
}

// ── FEATURED GAMES ──
function toggleFeaturedGame(appid) {
  if (!state.profile.featuredGames) state.profile.featuredGames = [];
  const index = state.profile.featuredGames.indexOf(appid);
  if (index > -1) {
    state.profile.featuredGames.splice(index, 1);
  } else {
    if (state.profile.featuredGames.length >= 6) {
      alert('Você pode destacar até 6 jogos no máximo!');
      return false;
    }
    state.profile.featuredGames.push(appid);
  }
  save();
  return true;
}

function isGameFeatured(appid) {
  return (state.profile.featuredGames || []).includes(appid);
}

function openFeaturedGamesModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'featured-modal';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:800px">
      <div class="modal-header">
        <div>
          <div class="modal-title">⭐ Jogos em Destaque</div>
          <div class="modal-subtitle">Selecione até 6 jogos para destacar no seu perfil</div>
        </div>
      </div>
      <div class="modal-body">
        <div class="lib-grid" id="featured-grid">${renderFeaturedGamesGrid()}</div>
      </div>
      <div class="modal-footer">
        <div class="selection-count">${(state.profile.featuredGames || []).length}/6 jogos destacados</div>
        <div style="display:flex;gap:10px">
          <button class="btn-modal secondary" onclick="closeFeaturedModal()">Fechar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderFeaturedGamesGrid() {
  const games = state.games.filter(g => g.totalAch > 0).sort((a, b) => b.pct - a.pct);
  if (games.length === 0) {
    return '<div style="text-align:center;padding:40px;color:var(--txt2)">Nenhum jogo com conquistas para destacar</div>';
  }
  return games.map(g => {
    const isFeatured = isGameFeatured(g.appid);
    const isPl = g.pct === 100 && g.totalAch > 0;
    return `
      <div class="lib-item ${isFeatured ? 'selected' : ''}" onclick="toggleFeaturedAndRefresh(${g.appid})">
        <div class="lib-cover" style="background:${g.bg}">
          <div style="font-size:24px">${isPl ? '✦' : (g.pct >= 50 ? '🏆' : '🎮')}</div>
        </div>
        <div class="lib-info">
          <div class="lib-name">${g.name}</div>
          <div class="lib-meta">${g.doneAch}/${g.totalAch} troféus • ${g.pct}%</div>
        </div>
        ${isFeatured ? '<div class="lib-check">✓</div>' : ''}
      </div>
    `;
  }).join('');
}

function toggleFeaturedAndRefresh(appid) {
  if (toggleFeaturedGame(appid)) {
    document.getElementById('featured-grid').innerHTML = renderFeaturedGamesGrid();
    document.querySelector('.selection-count').textContent = `${(state.profile.featuredGames || []).length}/6 jogos destacados`;
    if (!document.getElementById('view-profile').classList.contains('hide')) renderProfile();
  }
}

function closeFeaturedModal() {
  const modal = document.getElementById('featured-modal');
  if (modal) modal.remove();
}

// ── SCREENS ──
function show(id) {
  ['screen-login','screen-loading','screen-dash'].forEach(s => {
    document.getElementById(s).classList.toggle('hide', s !== id);
  });
}

// ── STEAM FETCH ──
async function steamFetch(url, attempt = 0) {
  if (attempt >= PROXIES.length) {
    throw new Error('Todos os proxies CORS falharam. Tente novamente mais tarde ou use uma extensão de navegador para desabilitar CORS temporariamente.');
  }
  currentProxyIndex = attempt;
  const proxy = getProxy();
  const proxied = proxy + encodeURIComponent(url);
  try {
    const res = await fetch(proxied);
    if (!res.ok) {
      if (res.status === 403 || res.status === 429 || res.status === 401 || res.status === 502 || res.status === 503) {
        return steamFetch(url, attempt + 1);
      }
      throw new Error(`HTTP ${res.status}`);
    }
    if (proxy.includes('allorigins')) {
      const text = await res.text();
      return JSON.parse(text);
    }
    return res.json();
  } catch (err) {
    if (attempt < PROXIES.length - 1) return steamFetch(url, attempt + 1);
    throw err;
  }
}

// ── HOW LONG TO BEAT API ──
async function fetchHLTBTime(gameName) {
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
    const res = await fetch(searchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
      return {
        main: Math.round(bestMatch.gameplayMain || 0),
        mainExtra: Math.round(bestMatch.gameplayMainExtra || 0),
        completionist: Math.round(bestMatch.gameplayCompletionist || 0),
        name: bestMatch.game_name
      };
    }
    return null;
  } catch (err) {
    return null;
  }
}

// ── TROPHY CLASSIFICATION ──
function classifyTrophy(globalPct, name, desc = '') {
  const n = (name || '').toLowerCase();
  if (n.includes('platina') || n.includes('platinum') || n.includes('platinum trophy') ||
      n.includes('complete all') || n.includes('all achievements') || n.includes('100%') ||
      n.includes('master of') || n.includes('unlock all')) return 'P';
  if (globalPct === undefined || globalPct === null) {
    if (n.includes('complete') && (n.includes('hard') || n.includes('extreme') || n.includes('insane'))) return 'G';
    if (n.includes('no damage') || n.includes('flawless') || n.includes('perfect') ||
        n.includes('speed run') || n.includes('speedrun') || n.includes('without') ||
        n.includes('no heal') || n.includes('knife only')) return 'G';
    if (n.includes('complete') || n.includes('finish') || n.includes('clear') ||
        n.includes('collect') || n.includes('find all') || n.includes('upgrade')) return 'S';
    return 'B';
  }
  const pct = parseFloat(globalPct);
  if (pct < 3)  return 'G';
  if (pct < 15) return 'S';
  return 'B';
}

async function fetchGlobalAchPercentages(appid) {
  try {
    const data = await steamFetch(
      `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${appid}`
    );
    const percentages = {};
    const list = data?.achievementpercentages?.achievements || [];
    list.forEach(a => { percentages[a.name] = parseFloat(a.percent); });
    return percentages;
  } catch (e) {
    return {};
  }
}

const TROPHY_META = {
  P: { label:'Platina', color:'#d8a0f8', bg:'#1a0828', icon:'💎', xp: 250 },
  G: { label:'Ouro',    color:'#ffd700', bg:'#1e1800', icon:'🥇', xp: 25 },
  S: { label:'Prata',   color:'#b0b8cc', bg:'#0e1018', icon:'🥈', xp: 10 },
  B: { label:'Bronze',  color:'#cd7f32', bg:'#2a1a08', icon:'🥉', xp: 5 },
};

// ── GAMER TITLES ──
const GAMER_TITLES = [
  { id: 'novice',        name: '🎮 Novato',                xp: 0,      color: '#888' },
  { id: 'beginner',      name: '⭐ Iniciante',              xp: 100,    color: '#4ade80' },
  { id: 'hunter',        name: '🏆 Caçador de Conquistas',  xp: 500,    color: '#60a5fa' },
  { id: 'collector',     name: '💎 Colecionador',          xp: 1000,   color: '#a78bfa' },
  { id: 'completionist', name: '🎯 Completista',           xp: 2500,   color: '#f472b6' },
  { id: 'master',        name: '👑 Mestre Gamer',          xp: 5000,   color: '#ffd700' },
  { id: 'legend',        name: '🔥 Lenda dos Games',       xp: 10000,  color: '#f97316' },
  { id: 'platinum_king', name: '✨ Rei das Platinas',     xp: 25000,  color: '#d8a0f8' },
  { id: 'immortal',      name: '☠️ Imortal do Gaming',     xp: 50000,  color: '#cc0000' },
  { id: 'deity',         name: '🌌 Divindade Gamer',      xp: 100000, color: '#3b82f6' },
];

function getTitleByXp(xp) {
  let current = GAMER_TITLES[0];
  let next = GAMER_TITLES[1];
  for (let i = GAMER_TITLES.length - 1; i >= 0; i--) {
    if (xp >= GAMER_TITLES[i].xp) {
      current = GAMER_TITLES[i];
      next = GAMER_TITLES[i + 1] || null;
      break;
    }
  }
  return { current, next };
}

function getUnlockedTitles(xp) {
  return GAMER_TITLES.filter(t => xp >= t.xp);
}

// ── MAIN FETCH FLOW ──
async function startFetch() {
  // Check if API key is from config.js (read-only)
  const hasConfigKey = (typeof CONFIG !== 'undefined' && CONFIG.STEAM_API_KEY && CONFIG.STEAM_API_KEY !== 'SUA_API_KEY_AQUI');
  const key = hasConfigKey ? CONFIG.STEAM_API_KEY : document.getElementById('inp-key').value.trim();
  const sid = document.getElementById('inp-steamid').value.trim();
  if (!key || !sid) { alert('Preencha a API Key e o Steam ID!'); return; }
  state.apiKey  = key;
  state.steamId = sid;
  doFetch();
}

async function refreshData() {
  show('screen-loading');
  await fetchTrackedGames();
}

async function doFetch() {
  show('screen-loading');
  setLoadingProgress(0, 'Buscando jogos da biblioteca...');
  document.getElementById('loading-games').innerHTML = '';
  try {
    const owned = await steamFetch(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${state.apiKey}&steamid=${state.steamId}&format=json&include_appinfo=true&include_played_free_games=true`
    );
    if (!owned.response || !owned.response.games) throw new Error('Perfil privado ou Steam ID inválido. Verifique se seu perfil de jogo é público nas configurações de privacidade da Steam.');

    const allGames = owned.response.games || [];
    state.library = allGames
      .filter(g => g.name)
      .map(g => ({ appid: g.appid, name: g.name, playtime: g.playtime_forever || 0, hasAchievements: true }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (state.library.length === 0) throw new Error('Nenhum jogo encontrado na sua biblioteca Steam.');

    setLoadingProgress(15, `${state.library.length} jogo(s) na biblioteca`);
    setLoadingProgress(18, 'Buscando informações do perfil...');
    await fetchUserInfo();

    if (state.trackedAppIds.size === 0) {
      setLoadingProgress(20, 'Procurando jogos com conquistas desbloqueadas...');
      const gamesWithAch = [];
      const BATCH_SIZE = 5;
      for (let i = 0; i < state.library.length; i += BATCH_SIZE) {
        const batch = state.library.slice(i, i + BATCH_SIZE);
        setLoadingProgress(20 + Math.round((i / state.library.length) * 70),
          `Verificando ${Math.min(i + BATCH_SIZE, state.library.length)}/${state.library.length} jogos...`);
        const promises = batch.map(async (game) => {
          try {
            const data = await steamFetch(
              `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${game.appid}&key=${state.apiKey}&steamid=${state.steamId}`
            );
            const achievements = data?.playerstats?.achievements || [];
            const unlockedCount = achievements.filter(a => a.achieved === 1).length;
            if (unlockedCount > 0) return { appid: game.appid, name: game.name, unlockedCount };
          } catch (e) {}
          return null;
        });
        const results = await Promise.all(promises);
        results.filter(r => r !== null).forEach(r => {
          gamesWithAch.push(r.appid);
          state.trackedAppIds.add(r.appid);
        });
        if (i + BATCH_SIZE < state.library.length) await new Promise(r => setTimeout(r, 300));
      }
    }

    setLoadingProgress(90, 'Carregando conquistas...');
    await fetchTrackedGames();
  } catch(err) {
    setLoadingProgress(0, `Erro: ${err.message}`);
    document.getElementById('loading-status').style.color = '#cc4444';
  }
}

async function fetchTrackedGames() {
  const appids = [...state.trackedAppIds];
  if (appids.length === 0) {
    show('screen-dash');
    renderDash();
    return;
  }

  show('screen-loading');
  setLoadingProgress(5, `Carregando ${appids.length} jogo(s)...`);
  document.getElementById('loading-games').innerHTML = '';

  const results = [];
  for (let i = 0; i < appids.length; i++) {
    const appid = appids[i];
    const libGame = state.library.find(g => g.appid === appid);
    const name = libGame?.name || `App ${appid}`;

    setLoadingProgress(5 + Math.round((i / appids.length) * 90), `Carregando: ${name}`);
    addLoadingItem(appid, name, 'active');

    const meta = getGameMetadata(appid, name);
    const gameData = {
      appid, name, ...meta,
      playtime: libGame?.playtime || 0,
      hltb: null,
      achievements: [],
      totalAch: 0,
      doneAch: 0,
      pct: 0,
      error: null,
    };

    try {
      const [schema, player, globalPctData] = await Promise.all([
        steamFetch(`https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v0002/?key=${state.apiKey}&appid=${appid}&l=portuguese`),
        steamFetch(`https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${appid}&key=${state.apiKey}&steamid=${state.steamId}&l=portuguese`),
        fetchGlobalAchPercentages(appid),
      ]);

      const schemaAchs = schema?.game?.availableGameStats?.achievements || [];
      const playerAchs = player?.playerstats?.achievements || [];
      const playerMap = {};
      playerAchs.forEach(a => { playerMap[a.apiname] = a; });

      const combined = schemaAchs.map(sa => {
        const pa = playerMap[sa.name] || {};
        const globalPct = globalPctData[sa.name] ?? (sa.percent !== undefined ? parseFloat(sa.percent) : undefined);
        const type = classifyTrophy(globalPct, sa.displayName || sa.name, sa.description);
        return {
          id: sa.name, name: sa.displayName || sa.name, desc: sa.description || '(Descrição oculta)',
          icon: sa.icon || '', iconGray: sa.icongray || '', unlocked: pa.achieved === 1,
          unlockTime: pa.unlocktime || 0, globalPct, type,
        };
      });

      const typeOrder = { P:0, G:1, S:2, B:3 };
      combined.sort((a,b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
        return typeOrder[a.type] - typeOrder[b.type];
      });

      gameData.achievements = combined;
      gameData.totalAch = combined.length;
      gameData.doneAch  = combined.filter(a => a.unlocked).length;
      gameData.pct      = gameData.totalAch ? Math.round((gameData.doneAch / gameData.totalAch) * 100) : 0;
    } catch(err) {
      gameData.error = 'Conquistas não disponíveis (perfil privado ou sem conquistas)';
    }

    results.push(gameData);
    markLoadingItem(appid, 'done');
  }

  state.games = results;
  save();
  setLoadingProgress(100, 'Concluído!');
  setTimeout(() => { show('screen-dash'); renderDash(); }, 600);
}

function setLoadingProgress(pct, msg) {
  document.getElementById('loading-bar').style.width = pct + '%';
  if (msg) document.getElementById('loading-status').textContent = msg;
}

function addLoadingItem(id, name, st) {
  const el = document.createElement('div');
  el.className = `lg-item ${st}`;
  el.id = `lg-${id}`;
  const shortName2 = name.length > 30 ? name.substring(0, 28) + '...' : name;
  el.innerHTML = `<div class="lg-dot"></div><span>${shortName2}</span>`;
  document.getElementById('loading-games').appendChild(el);
}

function markLoadingItem(id, st) {
  const el = document.getElementById(`lg-${id}`);
  if (el) el.className = `lg-item ${st}`;
}

// ── GAME LIBRARY MODAL ──
let tempSelectedIds = new Set();

function openGameLibrary() { showGameLibraryModal(); }

function showGameLibraryModal() {
  if (state.library.length === 0) { alert('Conecte-se primeiro para carregar sua biblioteca'); return; }
  tempSelectedIds = new Set(state.trackedAppIds);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'game-library-modal';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <div class="modal-title">📚 Sua Biblioteca Steam</div>
          <div class="modal-subtitle">Selecione os jogos que deseja acompanhar</div>
        </div>
        <div class="modal-search">
          <input type="text" id="lib-search" placeholder="🔍 Buscar jogos..." oninput="filterLibrary()">
        </div>
      </div>
      <div class="modal-body">
        <div class="lib-grid" id="lib-grid">${renderLibraryGrid()}</div>
      </div>
      <div class="modal-footer">
        <div>
          <div class="selection-count"><span id="selection-count">${tempSelectedIds.size}</span> jogos selecionados</div>
          <button class="btn-modal secondary" style="margin-top:8px;font-size:11px;padding:6px 12px" onclick="autoSelectGamesWithAchievements()">
            ✨ Auto-selecionar jogos com conquistas
          </button>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn-modal secondary" onclick="closeLibraryModal()">Cancelar</button>
          <button class="btn-modal" onclick="saveLibrarySelection()">✓ Confirmar</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function renderLibraryGrid() {
  const search = (document.getElementById('lib-search')?.value || '').toLowerCase();
  const filtered = state.library.filter(g => g.name.toLowerCase().includes(search));
  if (filtered.length === 0) return '<div class="empty-state">Nenhum jogo encontrado</div>';
  return filtered.map(g => {
    const isSelected = tempSelectedIds.has(g.appid);
    const meta = getGameMetadata(g.appid, g.name);
    return `
      <div class="lib-item ${isSelected ? 'selected' : ''}" onclick="toggleGameSelection(${g.appid})" title="${g.name}">
        <div class="lib-check"></div>
        <div class="lib-name" style="color:${meta.dot}">${g.name}</div>
      </div>
    `;
  }).join('');
}

function toggleGameSelection(appid) {
  if (tempSelectedIds.has(appid)) tempSelectedIds.delete(appid);
  else tempSelectedIds.add(appid);
  document.getElementById('lib-grid').innerHTML = renderLibraryGrid();
  document.getElementById('selection-count').textContent = tempSelectedIds.size;
}

function filterLibrary() { document.getElementById('lib-grid').innerHTML = renderLibraryGrid(); }
function closeLibraryModal() { const m = document.getElementById('game-library-modal'); if (m) m.remove(); }

async function saveLibrarySelection() {
  state.trackedAppIds = new Set(tempSelectedIds);
  closeLibraryModal();
  if (state.trackedAppIds.size === 0) { alert('Selecione pelo menos um jogo para acompanhar'); return; }
  await fetchTrackedGames();
}

async function autoSelectGamesWithAchievements() {
  const btn = document.querySelector('button[onclick="autoSelectGamesWithAchievements()"]');
  const originalText = btn.textContent;
  btn.textContent = '⏳ Verificando...';
  btn.disabled = true;
  const gamesToCheck = state.library.filter(g => !tempSelectedIds.has(g.appid));
  const BATCH_SIZE = 5;
  for (let i = 0; i < gamesToCheck.length; i += BATCH_SIZE) {
    const batch = gamesToCheck.slice(i, i + BATCH_SIZE);
    btn.textContent = `⏳ Verificando ${Math.min(i + BATCH_SIZE, gamesToCheck.length)}/${gamesToCheck.length}...`;
    const promises = batch.map(async (game) => {
      try {
        const data = await steamFetch(
          `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v0001/?appid=${game.appid}&key=${state.apiKey}&steamid=${state.steamId}`
        );
        const achievements = data?.playerstats?.achievements || [];
        const hasUnlocked = achievements.some(a => a.achieved === 1);
        if (hasUnlocked) { tempSelectedIds.add(game.appid); return true; }
      } catch (e) {}
      return null;
    });
    await Promise.all(promises);
    document.getElementById('lib-grid').innerHTML = renderLibraryGrid();
    document.getElementById('selection-count').textContent = tempSelectedIds.size;
    if (i + BATCH_SIZE < gamesToCheck.length) await new Promise(r => setTimeout(r, 500));
  }
  btn.textContent = `✅ ${tempSelectedIds.size} jogos selecionados`;
  setTimeout(() => { btn.textContent = originalText; btn.disabled = false; }, 2000);
}

// ── DASHBOARD RENDER ──
function renderDash() {
  updateProfile();
  const totalAch = state.games.reduce((s,g) => s + g.totalAch, 0);
  const doneAch  = state.games.reduce((s,g) => s + g.doneAch,  0);
  const plats    = state.games.filter(g => g.pct === 100 && g.totalAch > 0).length;
  const pct      = totalAch ? Math.round((doneAch / totalAch) * 100) : 0;

  document.getElementById('hstat-total').textContent = `${doneAch}/${totalAch}`;
  document.getElementById('hstat-plat').textContent  = `${plats}/${state.games.length}`;
  document.getElementById('hstat-pct').textContent   = `${pct}%`;
  document.getElementById('hstat-pct').style.color   = pct === 100 ? 'var(--plat)' : 'var(--accent)';
  document.getElementById('header-pbar').style.width = pct + '%';
  document.getElementById('header-pbar').style.background = pct === 100 ? 'var(--plat)' : 'var(--accent)';
  const displayName = state.userInfo.personaname || `Gamer ${state.steamId.substring(state.steamId.length - 4)}`;
  document.getElementById('header-steamid').textContent = `${displayName} · ${state.games.length} jogo(s) · ${state.library.length} na biblioteca`;

  renderGrid();
  renderOverview(totalAch, doneAch, plats, pct);
}

// ── GRID ──
function renderGrid() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';
  const games = filterGames();
  document.getElementById('game-count').textContent = `${games.length} jogo(s)`;
  if (games.length === 0) {
    if (state.trackedAppIds.size === 0) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px 20px;">
          <div style="font-size:48px;margin-bottom:20px;">🎮</div>
          <div style="color:var(--txt2);font-family:monospace;font-size:14px;margin-bottom:20px;">Nenhum jogo selecionado</div>
          <button class="btn-modal" onclick="openGameLibrary()">+ Selecionar Jogos da Biblioteca</button>
        </div>`;
    } else {
      grid.innerHTML = '<div class="empty-state">NENHUM JOGO COM ESSE FILTRO</div>';
    }
    return;
  }
  games.forEach(g => {
    const isPl = g.pct === 100 && g.totalAch > 0;
    const card = document.createElement('div');
    card.className = `game-card${isPl ? ' platinum' : ''}`;
    card.onclick = () => openGame(g.appid);
    card.innerHTML = `
      <div class="game-cover" id="cover-${g.appid}" style="background:${g.bg};">
        <div class="game-cover-content">
          <div class="game-cover-title">
            <div class="game-cover-sub" style="color:${g.dot}">${g.subtitle || 'Steam'}</div>
            <div class="game-cover-name">${shortName(g.title)}</div>
            ${g.year ? `<div class="game-cover-year">${g.year}</div>` : ''}
          </div>
          ${isPl ? '<div class="plat-badge">✦</div>' : ''}
        </div>
      </div>
      <div class="game-info">
        ${g.error
          ? `<div style="font-size:10px;color:#444;font-family:monospace;text-align:center;padding:4px 0">Conquistas não disponíveis</div>`
          : `<div class="game-stats-row">
               <span class="game-ach-count">${g.doneAch}/${g.totalAch} troféus</span>
               <span class="game-pct" style="color:${isPl ? 'var(--plat)' : g.pct > 0 ? g.dot : '#444'}">${g.pct}%</span>
             </div>
             <div class="pbar"><div class="pbar-fill" style="width:${g.pct}%;background:${isPl ? 'var(--plat)' : g.accent};${isPl?'box-shadow:0 0 8px var(--plat)44':''}"></div></div>
             ${g.playtime > 0 ? `<div class="game-playtime">⏱️ ${Math.round(g.playtime/60)}h jogadas</div>` : ''}
             ${isPl ? '<div class="plat-label">PLATINADO ✦</div>' : ''}`
        }
      </div>`;
    grid.appendChild(card);
    loadCoverImage(g.appid, g.bg);
  });
}

function loadFeaturedCoverImage(appid, fallbackBg) {
  const coverEl = document.getElementById(`featured-cover-${appid}`);
  if (!coverEl) return;
  const imageUrls = [
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
  ];
  let urlIndex = 0;
  function tryNext() {
    if (urlIndex >= imageUrls.length) return;
    const img = new Image();
    img.onload = () => coverEl.style.setProperty('background-image', `url('${imageUrls[urlIndex]}')`, 'important');
    img.onerror = () => { urlIndex++; tryNext(); };
    img.src = imageUrls[urlIndex];
  }
  setTimeout(tryNext, 10);
}

function loadCoverImage(appid, fallbackBg) {
  const coverEl = document.getElementById(`cover-${appid}`);
  if (!coverEl) return;
  const imageUrls = [
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_600x900.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/capsule_231x87.jpg`,
  ];
  let urlIndex = 0;
  function tryNextImage() {
    if (urlIndex >= imageUrls.length) return;
    const img = new Image();
    img.onload = () => {
      coverEl.style.setProperty('background-image', `url('${imageUrls[urlIndex]}')`, 'important');
      coverEl.style.backgroundSize = 'cover';
      coverEl.style.backgroundPosition = 'center';
    };
    img.onerror = () => { urlIndex++; tryNextImage(); };
    img.src = imageUrls[urlIndex];
  }
  setTimeout(tryNextImage, 10);
}

function shortName(title) {
  if (!title) return '';
  if (title.length > 20) {
    return title
      .replace(/^(The|A|An)\s+/i, '')
      .replace(/^(Resident Evil\s*:?\s*)/i, 'RE:')
      .replace(/^(Call of Duty\s*:?\s*)/i, 'CoD:')
      .replace(/^(Counter-Strike\s*:?\s*)/i, 'CS:')
      .replace(/^(Tom Clancy['']?s?\s*:?\s*)/i, '')
      .replace(/^(Assassin['']?s?\s*Creed\s*:?\s*)/i, 'AC:')
      .substring(0, 18) + (title.length > 18 ? '...' : '');
  }
  return title;
}

function filterGames() {
  return state.games.filter(g => {
    if (state.currentFilter === 'platinum')   return g.pct === 100 && g.totalAch > 0;
    if (state.currentFilter === 'started')    return g.doneAch > 0 && g.pct < 100;
    if (state.currentFilter === 'notstarted') return g.doneAch === 0;
    return true;
  });
}

function setFilter(f, btn) {
  state.currentFilter = f;
  document.querySelectorAll('.btn-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderGrid();
}

// ── OVERVIEW ──
function renderOverview(totalAch, doneAch, plats, pct) {
  const byType = { P:0, G:0, S:0, B:0 };
  let rareCount = 0;
  let totalHours = 0;
  state.games.forEach(g => {
    g.achievements.forEach(a => {
      if (a.unlocked) {
        byType[a.type]++;
        if (a.globalPct !== undefined && a.globalPct < 5) rareCount++;
      }
    });
    totalHours += g.playtime || 0;
  });
  const gamesWithProgress = state.games.filter(g => g.pct > 0 && g.totalAch > 0).length;
  const avgCompletion = gamesWithProgress > 0 ? Math.round(state.games.reduce((s,g) => s + g.pct, 0) / gamesWithProgress) : 0;
  const gamesStarted = state.games.filter(g => g.doneAch > 0).length;
  const gamesNotStarted = state.games.filter(g => g.doneAch === 0 && g.totalAch > 0).length;
  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const gamesCompletedThisMonth = state.games.filter(g => {
    if (g.pct !== 100 || !g.achievements) return false;
    const lastAch = g.achievements.filter(a => a.unlocked && a.unlockTime).sort((a,b) => b.unlockTime - a.unlockTime)[0];
    if (!lastAch) return false;
    const unlockDate = new Date(lastAch.unlockTime * 1000);
    return unlockDate.getMonth() === thisMonth && unlockDate.getFullYear() === thisYear;
  }).length;

  document.getElementById('overview-cards').innerHTML = [
    { label:'Troféus Desbloqueados', val:`${doneAch}/${totalAch}`, sub:`${totalAch > 0 ? Math.round((doneAch/totalAch)*100) : 0}% geral`, color:'var(--accent)' },
    { label:'💎 Platinas',           val:byType.P, sub:`${plats} jogos completos`, color:'var(--plat)' },
    { label:'🥇 Ouros',              val:byType.G, color:'var(--gold)' },
    { label:'🥈 Pratas',             val:byType.S, color:'var(--silv)' },
    { label:'🥉 Bronzes',            val:byType.B, color:'var(--bron)' },
    { label:'🔥 Conquistas Raras',   val:rareCount, sub:'<5% dos jogadores', color:'#ff6b6b' },
    { label:'Jogos na Biblioteca',   val:state.games.length, sub:`${gamesStarted} iniciados`, color:'var(--txt)' },
    { label:'Média de Conclusão',    val:`${avgCompletion}%`, sub:`${gamesWithProgress} com progresso`, color:'var(--green)' },
    { label:'Concluídos (100%)',     val:`${state.games.filter(g=>g.pct===100&&g.totalAch>0).length}`, sub:`${gamesCompletedThisMonth} este mês`, color:'#22cc66' },
    { label:'Não Iniciados',         val:gamesNotStarted, color:'var(--txt3)' },
    { label:'⏱️ Horas Jogadas',      val:totalHours > 0 ? `${Math.round(totalHours/60)}h` : '0h', sub:'Tempo total na Steam', color:'#60a5fa' },
  ].map(c => `
    <div class="ov-card">
      <div class="ov-card-label">${c.label}</div>
      <div class="ov-card-val" style="color:${c.color}">${c.val}</div>
      ${c.sub ? `<div class="ov-card-sub">${c.sub}</div>` : ''}
    </div>
  `).join('');

  renderPlatinumShowcase();
  renderMostPlayedShowcase();
}

function renderPlatinumShowcase() {
  const showcase = document.getElementById('platinum-showcase');
  if (!showcase) return;
  const platGames = state.games.filter(g => g.pct === 100 && g.totalAch > 0).sort((a, b) => b.totalAch - a.totalAch).slice(0, 5);
  if (platGames.length === 0) { showcase.innerHTML = ''; return; }
  showcase.innerHTML = `
    <div class="plat-showcase-header">
      <span>💎 JOGOS PLATINADOS</span>
      <span class="plat-count">${state.games.filter(g => g.pct === 100 && g.totalAch > 0).length} total</span>
    </div>
    <div class="plat-banners">
      ${platGames.map((g, index) => {
        const rarestAchs = g.achievements.filter(a => a.unlocked && a.globalPct !== undefined).sort((a, b) => (a.globalPct || 100) - (b.globalPct || 100)).slice(0, 5);
        return `
          <div class="plat-banner" onclick="openGame(${g.appid})" id="plat-banner-${g.appid}">
            <div class="plat-banner-bg" id="plat-bg-${g.appid}" style="background:${g.bg}"></div>
            <div class="plat-banner-overlay"></div>
            <div class="plat-banner-content">
              <div class="plat-banner-main">
                <div class="plat-banner-rank">#${index + 1}</div>
                <div class="plat-banner-info">
                  <div class="plat-banner-title">${g.title}</div>
                  <div class="plat-banner-stats">${g.totalAch} conquistas • ${g.year || 'Steam'}</div>
                </div>
                <div class="plat-badge-large">✦ PLATINA</div>
              </div>
              ${rarestAchs.length > 0 ? `
                <div class="plat-rare-achs">
                  <div class="plat-rare-label">🏆 Conquistas Mais Raras:</div>
                  <div class="plat-rare-list">
                    ${rarestAchs.map(a => `
                      <div class="plat-rare-item" title="${a.name} - ${a.globalPct.toFixed(1)}% dos jogadores">
                        <div class="plat-rare-glow"></div>
                        <div class="plat-rare-icon">${TROPHY_META[a.type].icon}</div>
                        <div class="plat-rare-pct">${a.globalPct.toFixed(1)}%</div>
                      </div>`).join('')}
                  </div>
                </div>` : ''}
            </div>
          </div>`;
      }).join('')}
    </div>`;
  setTimeout(() => platGames.forEach(g => loadBannerImage(g.appid, g.bg)), 50);
}

function renderMostPlayedShowcase() {
  const showcase = document.getElementById('most-played-showcase');
  if (!showcase) return;
  const mostPlayedGames = state.games.filter(g => g.playtime > 0).sort((a, b) => b.playtime - a.playtime).slice(0, 3);
  if (mostPlayedGames.length === 0) { showcase.innerHTML = ''; return; }
  const totalHours = mostPlayedGames.reduce((sum, g) => sum + (g.playtime || 0), 0);
  showcase.innerHTML = `
    <div class="mp-showcase-header">
      <span>⏱️ JOGOS MAIS JOGADOS</span>
      <span class="mp-count">${Math.round(totalHours/60)}h total</span>
    </div>
    <div class="mp-banners">
      ${mostPlayedGames.map((g, index) => {
        const hours = Math.round(g.playtime / 60);
        return `
          <div class="mp-banner" onclick="openGame(${g.appid})" id="mp-banner-${g.appid}">
            <div class="mp-banner-bg" id="mp-bg-${g.appid}" style="background:${g.bg}"></div>
            <div class="mp-banner-overlay"></div>
            <div class="mp-banner-content">
              <div class="mp-banner-main">
                <div class="mp-banner-rank">#${index + 1}</div>
                <div class="mp-banner-info">
                  <div class="mp-banner-title">${g.title}</div>
                  <div class="mp-banner-stats">${g.totalAch} conquistas • ${g.pct}% completo</div>
                </div>
                <div class="mp-hours-badge">${hours}h</div>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
  setTimeout(() => mostPlayedGames.forEach(g => loadMostPlayedBannerImage(g.appid, g.bg)), 50);
}

function loadMostPlayedBannerImage(appid, fallbackBg) {
  const bgEl = document.getElementById(`mp-bg-${appid}`);
  if (!bgEl) return;
  const imageUrls = [
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_hero.jpg`,
  ];
  let urlIndex = 0;
  function tryNext() {
    if (urlIndex >= imageUrls.length) return;
    const img = new Image();
    img.onload = () => { bgEl.style.backgroundImage = `url('${imageUrls[urlIndex]}')`; bgEl.style.backgroundSize = 'cover'; bgEl.style.backgroundPosition = 'center'; };
    img.onerror = () => { urlIndex++; tryNext(); };
    img.src = imageUrls[urlIndex];
  }
  tryNext();
}

function loadBannerImage(appid, fallbackBg) {
  const bgEl = document.getElementById(`plat-bg-${appid}`);
  if (!bgEl) return;
  const imageUrls = [
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_hero.jpg`,
  ];
  let urlIndex = 0;
  function tryNext() {
    if (urlIndex >= imageUrls.length) return;
    const img = new Image();
    img.onload = () => { bgEl.style.setProperty('background-image', `url('${imageUrls[urlIndex]}')`, 'important'); bgEl.style.backgroundSize = 'cover'; bgEl.style.backgroundPosition = 'center'; };
    img.onerror = () => { urlIndex++; tryNext(); };
    img.src = imageUrls[urlIndex];
  }
  setTimeout(tryNext, 10);
}

// ── VIEWS ──
function showView(v) {
  const views = ['grid','overview','profile','guides'];
  views.forEach(name => {
    const el = document.getElementById(`view-${name}`);
    if (el) el.classList.toggle('hide', v !== name);
    const tab = document.getElementById(`tab-${name}`);
    if (tab) tab.classList.toggle('active', v === name);
  });
  document.getElementById('view-detail').style.display = v === 'detail' ? 'block' : 'none';
  if (v === 'profile') renderProfile();
  if (v === 'guides')  { populateGuideFilters(); renderGuidesList(); }
}

// ══════════════════════════════════════════════════════════
//  PROFILE RENDER
// ══════════════════════════════════════════════════════════
function renderProfile() {
  const container = document.getElementById('profile-container');
  if (!container) return;
  if (!state.profile) state.profile = { xp: 0, equippedTitle: 'novice', featuredGames: [], stats: {} };
  if (!state.profile.stats) state.profile.stats = {};

  const { current: title, next } = getTitleByXp(state.profile.xp || 0);
  const unlockedTitles = getUnlockedTitles(state.profile.xp || 0);
  const progressToNext = next ? Math.min(100, (((state.profile.xp || 0) - title.xp) / (next.xp - title.xp)) * 100) : 100;

  const rareAchs = [];
  state.games.forEach(g => {
    g.achievements.forEach(a => {
      if (a.unlocked && a.globalPct !== undefined && a.globalPct < 5)
        rareAchs.push({ ...a, game: g.title, gameBg: g.bg });
    });
  });
  rareAchs.sort((a, b) => (a.globalPct || 100) - (b.globalPct || 100));
  const topRare = rareAchs.slice(0, 5);
  const platGames = state.games.filter(g => g.pct === 100 && g.totalAch > 0).slice(0, 5);
  const displayName = state.userInfo.personaname || `Gamer ${state.steamId.substring(state.steamId.length - 4)}`;
  const realName = state.userInfo.realname ? ` (${state.userInfo.realname})` : '';
  const avatar = state.userInfo.avatar;

  container.innerHTML = `
    <div class="profile-hero">
      <div class="profile-avatar" style="${avatar ? `background:url('${avatar}') center/cover no-repeat;` : ''}">
        ${!avatar ? '🎮' : ''}
      </div>
      <div class="profile-info">
        <div class="profile-name">${displayName}${realName}</div>
        <div class="profile-title" style="color:${title.color}">${title.name}</div>
        <div class="profile-xp">
          💎 ${state.profile.xp.toLocaleString()} XP
          ${next ? `<span style="color:var(--txt3)"> → próximo: ${next.name} (${next.xp.toLocaleString()} XP)</span>` : '<span style="color:var(--plat)"> ⭐ Máximo!</span>'}
        </div>
        ${next ? `<div class="profile-xp-bar"><div class="profile-xp-fill" style="width:${progressToNext}%"></div></div>` : ''}
        ${state.userInfo.profileurl ? `<div style="margin-top:12px;"><a href="${state.userInfo.profileurl}" target="_blank" style="color:var(--accent);font-size:12px;text-decoration:none;">🔗 Ver perfil na Steam →</a></div>` : ''}
      </div>
    </div>
    <div class="profile-stats-grid">
      ${[
        ['🎮', state.profile.stats.totalGames || 0, 'Jogos', ''],
        ['🏆', state.profile.stats.totalAchievements || 0, 'Conquistas', ''],
        ['💎', state.profile.stats.platinums || 0, 'Platinas', 'color:var(--plat)'],
        ['🥇', state.profile.stats.golds || 0, 'Ouros', 'color:var(--gold)'],
        ['🥈', state.profile.stats.silvers || 0, 'Pratas', 'color:var(--silv)'],
        ['🥉', state.profile.stats.bronzes || 0, 'Bronzes', 'color:var(--bron)'],
        ['⭐', state.profile.stats.perfectGames || 0, '100% Completos', ''],
        ['🔥', state.profile.stats.rareAchievements || 0, 'Raras (<5%)', ''],
      ].map(([icon, val, lbl, style]) => `
        <div class="profile-stat-card">
          <div class="profile-stat-icon" style="${style}">${icon}</div>
          <div class="profile-stat-value" style="${style}">${val}</div>
          <div class="profile-stat-label">${lbl}</div>
        </div>`).join('')}
    </div>
    <div class="profile-section">
      <div class="profile-section-title">🏅 Títulos Desbloqueados</div>
      <div class="titles-grid">
        ${GAMER_TITLES.map(t => {
          const isUnlocked = unlockedTitles.some(u => u.id === t.id);
          const isEquipped = state.profile.equippedTitle === t.id;
          return `
            <div class="title-item ${isUnlocked ? 'unlocked' : ''} ${isEquipped ? 'equipped' : ''}"
                 ${isUnlocked ? `onclick="equipTitle('${t.id}')"` : ''}>
              <div class="title-icon">${t.name.split(' ')[0]}</div>
              <div class="title-info">
                <div class="title-name" style="color:${isUnlocked ? t.color : 'var(--txt2)'}">${t.name.split(' ').slice(1).join(' ')}</div>
                <div class="title-req">${t.xp.toLocaleString()} XP</div>
              </div>
              ${isEquipped ? '<div class="title-check">✓</div>' : ''}
            </div>`;
        }).join('')}
      </div>
    </div>
    <div class="profile-section">
      <div class="profile-section-title" style="display:flex;justify-content:space-between;align-items:center;">
        <span>⭐ Jogos em Destaque</span>
        <button class="btn-modal" style="font-size:11px;padding:6px 12px;" onclick="openFeaturedGamesModal()">Editar Destaques</button>
      </div>
      ${(state.profile.featuredGames || []).length === 0
        ? '<div style="text-align:center;padding:30px;color:var(--txt3);font-size:12px;">Nenhum jogo em destaque. Clique em "Editar Destaques" para adicionar!</div>'
        : `<div class="featured-grid">
            ${(state.profile.featuredGames || []).map(appid => {
              const g = state.games.find(game => game.appid === appid);
              if (!g) return '';
              const isPl = g.pct === 100 && g.totalAch > 0;
              return `
                <div class="featured-card" onclick="openGame(${g.appid})" style="cursor:pointer;">
                  <div class="featured-cover" id="featured-cover-${g.appid}" style="background:${g.bg};">
                    <div class="featured-overlay">
                      <div class="featured-icon">${isPl ? '✦' : (g.pct >= 50 ? '🏆' : '🎮')}</div>
                      <div class="featured-pct">${g.pct}%</div>
                    </div>
                  </div>
                  <div class="featured-info">
                    <div class="featured-name">${shortName(g.title)}</div>
                    <div class="featured-achs">${g.doneAch}/${g.totalAch} troféus</div>
                  </div>
                </div>`;
            }).join('')}
          </div>`
      }
    </div>
    <div class="cv-section">
      <div class="cv-header">
        <div class="cv-name">Currículo</div>
        <div class="cv-title" style="color:${title.color}">${title.name}</div>
        <div class="cv-stats-row">
          <span>🎮 ${state.profile.stats.totalGames || 0} jogos</span>
          <span>🏆 ${state.profile.stats.totalAchievements || 0} conquistas</span>
          <span>💎 ${(state.profile.xp || 0).toLocaleString()} XP</span>
          <span>⭐ ${state.profile.stats.perfectGames || 0} platinas</span>
        </div>
      </div>
      <div class="cv-body">
        <div class="cv-column">
          <h3>🏆 Conquistas Raras</h3>
          ${topRare.length > 0 ? topRare.map(a => `
            <div class="cv-achievement">
              <div class="cv-ach-icon">${TROPHY_META[a.type].icon}</div>
              <div class="cv-ach-content">
                <div class="cv-ach-name">${a.name}</div>
                <div class="cv-ach-desc">${a.game} • ${a.globalPct.toFixed(1)}% globais</div>
              </div>
            </div>`).join('')
            : '<div style="color:var(--txt3);font-size:12px;">Nenhuma conquista rara ainda. Continue jogando!</div>'}
        </div>
        <div class="cv-column">
          <h3>💎 Jogos Platinados</h3>
          ${platGames.length > 0 ? platGames.map(g => `
            <div class="cv-achievement">
              <div class="cv-ach-icon" style="color:var(--plat)">✦</div>
              <div class="cv-ach-content">
                <div class="cv-ach-name">${g.title}</div>
                <div class="cv-ach-desc">${g.doneAch}/${g.totalAch} conquistas • ${g.year || 'Steam'}</div>
              </div>
            </div>`).join('')
            : '<div style="color:var(--txt3);font-size:12px;">Nenhum jogo platinado ainda. Você consegue!</div>'}
        </div>
      </div>
    </div>
  `;

  setTimeout(() => {
    (state.profile.featuredGames || []).forEach(appid => {
      const g = state.games.find(game => game.appid === appid);
      if (g) loadFeaturedCoverImage(appid, g.bg);
    });
  }, 100);
}

// ── GAME DETAIL ──
function openGame(appid) {
  const g = state.games.find(g => g.appid === appid);
  if (!g) return;
  state.currentGameId = appid;
  state.currentAchFilter = 'all';
  document.querySelectorAll('.btn-ach-filter').forEach(b => b.classList.remove('active'));
  document.querySelector('.btn-ach-filter').classList.add('active');
  const isPl = g.pct === 100 && g.totalAch > 0;
  const bannerBg = document.getElementById('detail-banner-bg');
  bannerBg.style.backgroundImage = '';
  bannerBg.style.background = g.bg;
  loadDetailBannerImage(g.appid, bannerBg);
  const banner = document.getElementById('detail-banner');
  banner.style.borderColor = isPl ? 'var(--plat)' : g.accent;
  banner.style.boxShadow = isPl ? '0 0 30px rgba(216, 160, 248, 0.15)' : 'none';
  const yearText = g.year && g.year !== 'N/A' ? ` · ${g.year}` : '';
  document.getElementById('detail-tag').textContent = `${g.subtitle || 'Steam'}${yearText}`;
  document.getElementById('detail-title').textContent = g.title;
  let playtimeText = '';
  if (g.playtime && g.playtime > 0) {
    const hours = Math.round(g.playtime / 60);
    playtimeText = ` · ${hours}h jogadas`;
  }
  document.getElementById('detail-banner-stats').textContent = `${g.totalAch} conquistas${playtimeText}`;
  document.getElementById('detail-pct').textContent = `${g.pct}%`;
  document.getElementById('detail-pct').style.color = isPl ? 'var(--plat)' : g.dot;
  document.getElementById('detail-achcount').textContent = `${g.doneAch}/${g.totalAch} troféus`;
  const hltbRow = document.getElementById('detail-hltb-row');
  if (g.hltb) {
    renderHLTBTimes(hltbRow, g.hltb);
  } else {
    hltbRow.innerHTML = '<div class="hltb-loading">⏳ Buscando tempos HLTB...</div>';
    hltbRow.style.display = 'flex';
    fetchHLTBTime(g.name).then(hltbData => {
      if (hltbData) { g.hltb = hltbData; save(); renderHLTBTimes(hltbRow, hltbData); }
      else hltbRow.innerHTML = '<div class="hltb-unavailable">ℹ️ Tempos HLTB indisponíveis (instale extensão CORS Unblock para ativar)</div>';
    }).catch(() => {
      hltbRow.innerHTML = '<div class="hltb-unavailable">ℹ️ Tempos HLTB indisponíveis (instale extensão CORS Unblock para ativar)</div>';
    });
  }
  const byType = { P:0,G:0,S:0,B:0 };
  const totalType = { P:0,G:0,S:0,B:0 };
  g.achievements.forEach(a => { totalType[a.type]++; if(a.unlocked) byType[a.type]++; });
  document.getElementById('detail-trophies').innerHTML = ['P','G','S','B'].map(t => {
    const tm = TROPHY_META[t];
    return `<div class="dtrophy" style="border:1px solid ${tm.color}22">
      <span class="dtrophy-icon">${tm.icon}</span>
      <span class="dtrophy-count mono" style="color:${tm.color}">${byType[t]}/${totalType[t]}</span>
    </div>`;
  }).join('');
  renderAchievements(g);
  showView('detail');
}

function renderHLTBTimes(container, hltbData) {
  container.innerHTML = `
    <div class="hltb-time-card">
      <div class="hltb-time-label">⏱️ História Principal</div>
      <div class="hltb-time-value">${hltbData.main}h</div>
    </div>
    <div class="hltb-time-card">
      <div class="hltb-time-label">⏱️ História + Extras</div>
      <div class="hltb-time-value">${hltbData.mainExtra}h</div>
    </div>
    <div class="hltb-time-card plat">
      <div class="hltb-time-label">✦ Completo (Platina)</div>
      <div class="hltb-time-value">${hltbData.completionist}h</div>
    </div>`;
  container.style.display = 'flex';
}

function loadDetailBannerImage(appid, bgEl) {
  const imageUrls = [
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_hero.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/library_hero.jpg`,
    `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`,
  ];
  let urlIndex = 0;
  function tryNext() {
    if (urlIndex >= imageUrls.length) return;
    const img = new Image();
    img.onload = () => { bgEl.style.backgroundImage = `url('${imageUrls[urlIndex]}')`; bgEl.style.backgroundSize = 'cover'; bgEl.style.backgroundPosition = 'center'; };
    img.onerror = () => { urlIndex++; tryNext(); };
    img.src = imageUrls[urlIndex];
  }
  setTimeout(tryNext, 10);
}

function findGuideForAchievement(appid, achievementId) {
  return guides.find(g => g.gameId === appid && g.achievementId === achievementId);
}

function openGuideReaderFromAchievement(guideId) {
  showView('guides');
  openGuideReader(guideId, 'detail');
}

function openGuideForAchievement(appid, achievementId) {
  const guide = findGuideForAchievement(appid, achievementId);
  if (guide) {
    // Navigate to guides view and open the guide, returning to detail when closing
    showView('guides');
    openGuideReader(guide.id, 'detail');
  } else {
    // No guide exists, offer to create one
    if (confirm('Nenhum guia encontrado para esta conquista. Deseja criar um guia agora?')) {
      const game = state.games.find(g => g.appid === appid);
      const achievement = game?.achievements.find(a => a.id === achievementId);
      // First switch to guides view, then open creator
      showView('guides');
      openGuideCreator();
      // Pre-configure guide creator after a small delay to ensure DOM is ready
      setTimeout(() => {
        if (game) {
          const gameSelect = document.getElementById('gf-game');
          gameSelect.value = String(appid);
          onGuideGameChange();
          if (achievement) {
            const achSelect = document.getElementById('gf-achievement');
            achSelect.value = achievementId;
          }
        }
      }, 50);
    }
  }
}

function renderAchievements(g) {
  const list = document.getElementById('ach-list');
  const achs = g.achievements.filter(a => {
    if (state.currentAchFilter === 'unlocked') return a.unlocked;
    if (state.currentAchFilter === 'locked')   return !a.unlocked;
    return true;
  });
  if (g.error) { list.innerHTML = `<div class="error-box">⚠ ${g.error}</div>`; return; }
  if (achs.length === 0) { list.innerHTML = '<div class="empty-state">NENHUMA CONQUISTA COM ESSE FILTRO</div>'; return; }
  list.innerHTML = achs.map(a => {
    const tm = TROPHY_META[a.type];
    const iconUrl = a.unlocked && a.icon ? a.icon : (a.iconGray || a.icon);
    const unlockDate = a.unlockTime > 0 ? new Date(a.unlockTime * 1000).toLocaleDateString('pt-BR') : '';
    const guide = findGuideForAchievement(g.appid, a.id);
    // Escape achievement ID for use in HTML onclick attribute
    const escapedAchId = a.id.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const guideBtn = (!a.unlocked && guide)
      ? `<button class="btn-guide-ach" onclick="event.stopPropagation();openGuideReaderFromAchievement('${guide.id}')" title="Ver guia para esta conquista">📖 Guia</button>`
      : (!a.unlocked
        ? `<button class="btn-guide-ach btn-guide-create" onclick="event.stopPropagation();openGuideForAchievement(${g.appid}, '${escapedAchId}')" title="Criar guia para esta conquista">+ Guia</button>`
        : '');
    return `
      <div class="ach-item ${a.unlocked ? 'unlocked' : 'locked'}" style="${a.unlocked ? `border-color:${tm.color}33;` : ''}">
        <div class="ach-checkbox ${a.unlocked ? 'checked' : ''}" style="${a.unlocked ? `background:${tm.color};border-color:${tm.color};box-shadow:0 0 8px ${tm.color}44` : ''}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <polyline points="2,7 5.5,11 12,3" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="ach-icon-wrap">
          ${iconUrl ? `<img src="${iconUrl}" alt="" onerror="this.parentNode.innerHTML='<span class=ach-icon-placeholder>${tm.icon}</span>'">` : `<span class="ach-icon-placeholder">${tm.icon}</span>`}
        </div>
        <div class="ach-body">
          <div class="ach-name" style="color:${a.unlocked ? tm.color : 'var(--txt)'}">${a.name}</div>
          <div class="ach-desc">${a.desc}</div>
          ${unlockDate ? `<div class="ach-unlock-time">✓ Desbloqueado em ${unlockDate}</div>` : ''}
        </div>
        <div class="ach-meta">
          <div class="trophy-badge" style="color:${tm.color};background:${tm.bg};border-color:${tm.color}33">
            ${tm.icon} ${tm.label}
          </div>
          ${a.globalPct !== undefined ? `<div class="ach-pct">${a.globalPct.toFixed(1)}% globais</div>` : ''}
          ${guideBtn}
        </div>
      </div>`;
  }).join('');
}

function setAchFilter(f, btn) {
  state.currentAchFilter = f;
  document.querySelectorAll('.btn-ach-filter').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const g = state.games.find(g => g.appid === state.currentGameId);
  if (g) renderAchievements(g);
}

function backToGrid() {
  state.currentGameId = null;
  showView('grid');
}

function logout() {
  if (!confirm('Deseja sair? As credenciais serão removidas do navegador.')) return;
  localStorage.removeItem('steam-tracker-key');
  localStorage.removeItem('steam-tracker-sid');
  localStorage.removeItem('steam-tracker-games');
  localStorage.removeItem('steam-tracker-tracked');
  localStorage.removeItem('steam-tracker-profile');
  localStorage.removeItem('steam-tracker-user');
  state = {
    apiKey:'', steamId:'', games:[], library:[], trackedAppIds: new Set(),
    currentFilter:'all', currentAchFilter:'all', currentGameId:null,
    profile: { xp: 0, equippedTitle: 'novice', featuredGames: [], stats: {} },
    userInfo: { personaname: '', avatar: '', profileurl: '', realname: '', loccountrycode: '' }
  };
  show('screen-login');
}

// ══════════════════════════════════════════════════════════
//  GUIDES SYSTEM
// ══════════════════════════════════════════════════════════

let guides = []; // Array of guide objects
let editingGuideId = null; // null = creating new, string = editing existing
let guideStepCounter = 0; // Used for unique step IDs
let guideReaderReturnTo = 'guides'; // 'guides' or 'detail' - where to return when closing reader

// ── PERSISTENCE ──
function saveGuides() {
  try {
    localStorage.setItem('steam-tracker-guides', JSON.stringify(guides));
  } catch(e) {}
}

function loadGuides() {
  try {
    const g = localStorage.getItem('steam-tracker-guides');
    if (g) guides = JSON.parse(g);
  } catch(e) {
    guides = [];
  }
}

// ── POPULATE FILTERS & SELECTS ──
function populateGuideFilters() {
  // Game filter dropdown in list view
  const filterSelect = document.getElementById('guide-game-filter');
  if (!filterSelect) return;
  const allGames = [...new Set(guides.filter(g => g.gameName).map(g => g.gameName))].sort();
  filterSelect.innerHTML = '<option value="">Todos os jogos</option>' +
    allGames.map(name => `<option value="${name}">${name}</option>`).join('');

  // Game select in creator (populated on open)
}

function populateCreatorGameSelect() {
  const sel = document.getElementById('gf-game');
  if (!sel) return;
  const trackedGames = state.games.map(g => ({ appid: g.appid, name: g.name }))
    .sort((a,b) => a.name.localeCompare(b.name));
  sel.innerHTML = '<option value="">— Selecione um jogo —</option>' +
    trackedGames.map(g => `<option value="${g.appid}" data-name="${g.name}">${g.name}</option>`).join('');
}

function onGuideGameChange() {
  const gameSelect = document.getElementById('gf-game');
  const achRow = document.getElementById('gf-achievement-row');
  const achSelect = document.getElementById('gf-achievement');
  const gameId = gameSelect.value ? parseInt(gameSelect.value) : null;

  if (!gameId) {
    achRow.style.display = 'none';
    achSelect.innerHTML = '<option value="">— Guia geral do jogo —</option>';
    return;
  }

  const game = state.games.find(g => g.appid === gameId);
  if (!game || !game.achievements || game.achievements.length === 0) {
    achRow.style.display = 'none';
    return;
  }

  achRow.style.display = 'flex';
  achSelect.innerHTML = '<option value="">— Guia geral do jogo —</option>' +
    game.achievements.map(a => `<option value="${a.id}" data-name="${a.name}">${a.name}</option>`).join('');
}

// ── GUIDES LIST ──
function renderGuidesList() {
  const grid = document.getElementById('guides-grid');
  if (!grid) return;

  const searchTerm = (document.getElementById('guide-search')?.value || '').toLowerCase();
  const gameFilter = document.getElementById('guide-game-filter')?.value || '';

  const filtered = guides.filter(guide => {
    const matchSearch = !searchTerm ||
      guide.title.toLowerCase().includes(searchTerm) ||
      (guide.gameName || '').toLowerCase().includes(searchTerm);
    const matchGame = !gameFilter || guide.gameName === gameFilter;
    return matchSearch && matchGame;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="guides-empty" style="grid-column:1/-1">
        <div class="guides-empty-icon">📖</div>
        <div class="guides-empty-text">${guides.length === 0 ? 'NENHUM GUIA AINDA' : 'NENHUM GUIA ENCONTRADO'}</div>
        <div class="guides-empty-sub">${guides.length === 0 ? 'Seja o primeiro a criar um guia!' : 'Tente outra busca.'}</div>
        ${guides.length === 0 ? `<button class="btn-create-guide" onclick="openGuideCreator()">+ Criar Primeiro Guia</button>` : ''}
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(guide => {
    const stepCount = guide.steps.length;
    const previewSteps = guide.steps.slice(0, 3);
    const dateStr = guide.createdAt ? new Date(guide.createdAt).toLocaleDateString('pt-BR') : '';
    const achTag = guide.achievementName ? `<div class="guide-card-achievement">🏆 ${escapeHtml(guide.achievementName)}</div>` : '';
    return `
      <div class="guide-card" onclick="openGuideReader('${guide.id}')">
        <div class="guide-card-header">
          ${guide.gameName ? `<div class="guide-card-game">🎮 ${guide.gameName}</div>` : ''}
          ${achTag}
          <div class="guide-card-title">${escapeHtml(guide.title)}</div>
          <div class="guide-card-meta">${stepCount} passo${stepCount !== 1 ? 's' : ''} · ${dateStr}</div>
        </div>
        <div class="guide-card-steps-preview">
          ${previewSteps.map((step, i) => `
            <div class="guide-step-chip">
              <span style="color:var(--accent);margin-right:4px">PASSO ${i+1}</span>
              ${escapeHtml(step.title || '(sem título)')}
            </div>`).join('')}
          ${stepCount > 3 ? `<div class="guide-step-chip" style="color:var(--txt3)">+ ${stepCount - 3} mais passos...</div>` : ''}
        </div>
        <div class="guide-card-footer">
          <div class="guide-card-count">
            ${step => {
              const withPhoto = guide.steps.filter(s => s.photo).length;
              return withPhoto > 0 ? `📷 ${withPhoto} foto${withPhoto !== 1 ? 's' : ''}` : '';
            }}
          </div>
          <div class="guide-card-actions" onclick="event.stopPropagation()">
            <button class="btn-guide-action" onclick="openGuideCreator('${guide.id}')">✏️ Editar</button>
            <button class="btn-guide-action danger" onclick="deleteGuide('${guide.id}')">🗑️ Apagar</button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Fix the photo count display (the IIFE inside template literal trick doesn't work, patch it)
  filtered.forEach(guide => {
    const withPhoto = guide.steps.filter(s => s.photo).length;
    const cards = grid.querySelectorAll('.guide-card');
    const matchCard = [...cards].find(c => c.querySelector('.guide-card-title')?.textContent === guide.title);
    if (matchCard) {
      const countEl = matchCard.querySelector('.guide-card-count');
      if (countEl) countEl.textContent = withPhoto > 0 ? `📷 ${withPhoto} foto${withPhoto !== 1 ? 's' : ''}` : '';
    }
  });
}

// ── GUIDE CREATOR ──
function openGuideCreator(guideId) {
  editingGuideId = guideId || null;
  guideStepCounter = 0;

  // Switch views
  document.getElementById('guides-list-view').classList.add('hide');
  document.getElementById('guides-read-view').classList.add('hide');
  document.getElementById('guides-create-view').classList.remove('hide');

  // Update title
  document.getElementById('guide-creator-title').textContent = editingGuideId ? 'Editar Guia' : 'Criar Novo Guia';

  // Populate game select
  populateCreatorGameSelect();

  // Clear or fill form
  const container = document.getElementById('guide-steps-container');
  container.innerHTML = '';

  if (editingGuideId) {
    const guide = guides.find(g => g.id === editingGuideId);
    if (guide) {
      document.getElementById('gf-title').value = guide.title;
      const sel = document.getElementById('gf-game');
      if (guide.gameId) {
        // Set selected option
        for (const opt of sel.options) {
          if (opt.value === String(guide.gameId)) { opt.selected = true; break; }
        }
        // Load achievements for the game
        onGuideGameChange();
        // Select achievement if exists
        if (guide.achievementId) {
          const achSelect = document.getElementById('gf-achievement');
          for (const opt of achSelect.options) {
            if (opt.value === guide.achievementId) { opt.selected = true; break; }
          }
        }
      }
      // Render existing steps
      guide.steps.forEach(step => addGuideStep(step));
    }
  } else {
    document.getElementById('gf-title').value = '';
    document.getElementById('gf-game').value = '';
    document.getElementById('gf-achievement-row').style.display = 'none';
    document.getElementById('gf-achievement').innerHTML = '<option value="">— Guia geral do jogo —</option>';
    addGuideStep(); // Start with one empty step
  }
}

function closeGuideCreator() {
  document.getElementById('guides-create-view').classList.add('hide');
  document.getElementById('guides-list-view').classList.remove('hide');
  editingGuideId = null;
}

function addGuideStep(existingStep) {
  guideStepCounter++;
  const stepIndex = guideStepCounter;
  const container = document.getElementById('guide-steps-container');
  const totalSteps = container.children.length + 1;

  const stepEl = document.createElement('div');
  stepEl.className = 'guide-step-card';
  stepEl.dataset.stepId = stepIndex;

  const photoPreviewHtml = existingStep?.photo
    ? `<div class="guide-photo-preview" id="preview-wrap-${stepIndex}">
         <img src="${existingStep.photo}" alt="Foto do passo" id="preview-img-${stepIndex}">
         <button class="btn-remove-photo" onclick="removeStepPhoto(${stepIndex})" title="Remover foto">×</button>
       </div>`
    : `<div class="guide-photo-preview" id="preview-wrap-${stepIndex}" style="display:none">
         <img src="" alt="Foto do passo" id="preview-img-${stepIndex}">
         <button class="btn-remove-photo" onclick="removeStepPhoto(${stepIndex})" title="Remover foto">×</button>
       </div>`;

  stepEl.innerHTML = `
    <div class="guide-step-header">
      <div class="guide-step-number">PASSO ${totalSteps}</div>
      <input type="text" class="guide-step-title-input" id="step-title-${stepIndex}"
             placeholder="Título do passo (ex: PEGAR O ITEM NA TORRE)"
             value="${escapeHtml(existingStep?.title || '')}">
      <button class="btn-remove-step" onclick="removeGuideStep(this)" title="Remover passo">✕</button>
    </div>
    <div class="guide-step-body">
      <textarea class="guide-step-desc" id="step-desc-${stepIndex}"
                placeholder="Descreva o que o jogador deve fazer neste passo...">${escapeHtml(existingStep?.description || '')}</textarea>
      <div class="guide-step-photo-area">
        <label class="guide-photo-upload" title="Clique para anexar uma foto">
          <input type="file" accept="image/*" onchange="handleStepPhoto(${stepIndex}, this)">
          <div class="guide-photo-icon">📷</div>
          <div class="guide-photo-label">ANEXAR FOTO<br>(opcional)</div>
        </label>
        ${photoPreviewHtml}
      </div>
    </div>`;

  container.appendChild(stepEl);
  renumberSteps();
}

function removeGuideStep(btn) {
  const card = btn.closest('.guide-step-card');
  if (card) {
    card.remove();
    renumberSteps();
  }
}

function renumberSteps() {
  const cards = document.querySelectorAll('#guide-steps-container .guide-step-card');
  cards.forEach((card, i) => {
    const numEl = card.querySelector('.guide-step-number');
    if (numEl) numEl.textContent = `PASSO ${i + 1}`;
  });
}

function handleStepPhoto(stepIndex, input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    alert('A imagem deve ter no máximo 3MB.');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewWrap = document.getElementById(`preview-wrap-${stepIndex}`);
    const previewImg  = document.getElementById(`preview-img-${stepIndex}`);
    if (previewImg) previewImg.src = e.target.result;
    if (previewWrap) previewWrap.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeStepPhoto(stepIndex) {
  const previewWrap = document.getElementById(`preview-wrap-${stepIndex}`);
  const previewImg  = document.getElementById(`preview-img-${stepIndex}`);
  if (previewImg) previewImg.src = '';
  if (previewWrap) previewWrap.style.display = 'none';
  // Also clear the file input
  const card = previewWrap?.closest('.guide-step-card');
  if (card) {
    const input = card.querySelector('input[type="file"]');
    if (input) input.value = '';
  }
}

function saveGuide() {
  const title = document.getElementById('gf-title').value.trim();
  if (!title) { alert('Dê um título ao guia!'); document.getElementById('gf-title').focus(); return; }

  const gameSelect = document.getElementById('gf-game');
  const gameId = gameSelect.value ? parseInt(gameSelect.value) : null;
  const gameName = gameSelect.options[gameSelect.selectedIndex]?.dataset?.name || '';

  const achSelect = document.getElementById('gf-achievement');
  const achievementId = achSelect?.value || null;
  const achievementName = achievementId ? (achSelect.options[achSelect.selectedIndex]?.dataset?.name || '') : '';

  // Collect steps
  const stepCards = document.querySelectorAll('#guide-steps-container .guide-step-card');
  if (stepCards.length === 0) { alert('Adicione pelo menos 1 passo ao guia!'); return; }

  const steps = [];
  for (const card of stepCards) {
    const stepId = card.dataset.stepId;
    const stepTitle = card.querySelector(`#step-title-${stepId}`)?.value?.trim() || '';
    const stepDesc  = card.querySelector(`#step-desc-${stepId}`)?.value?.trim() || '';
    const imgEl = card.querySelector(`#preview-img-${stepId}`);
    const photo = imgEl && imgEl.src && imgEl.src.startsWith('data:') ? imgEl.src : null;
    steps.push({ id: stepId, title: stepTitle, description: stepDesc, photo });
  }

  if (editingGuideId) {
    const idx = guides.findIndex(g => g.id === editingGuideId);
    if (idx > -1) {
      guides[idx] = { ...guides[idx], title, gameId, gameName, achievementId, achievementName, steps, updatedAt: Date.now() };
    }
  } else {
    const newGuide = {
      id: `guide-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      title, gameId, gameName, achievementId, achievementName, steps,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    guides.unshift(newGuide);
  }

  saveGuides();
  closeGuideCreator();
  populateGuideFilters();
  renderGuidesList();
}

// ── GUIDE READER ──
function openGuideReader(guideId, returnTo = 'guides') {
  const guide = guides.find(g => g.id === guideId);
  if (!guide) return;

  guideReaderReturnTo = returnTo;
  const backBtn = document.getElementById('guide-reader-back-btn');
  if (backBtn) {
    backBtn.textContent = returnTo === 'detail' ? '← Voltar às Conquistas' : '← Voltar aos Guias';
  }

  document.getElementById('guides-list-view').classList.add('hide');
  document.getElementById('guides-create-view').classList.add('hide');
  document.getElementById('guides-read-view').classList.remove('hide');

  const dateStr = guide.createdAt ? new Date(guide.createdAt).toLocaleDateString('pt-BR') : '';
  const content = document.getElementById('guide-reader-content');

  content.innerHTML = `
    <div class="guide-reader-header">
      ${guide.gameName ? `<div class="guide-reader-game">🎮 ${escapeHtml(guide.gameName)}</div>` : ''}
      ${guide.achievementName ? `<div class="guide-reader-achievement">🏆 ${escapeHtml(guide.achievementName)}</div>` : ''}
      <div class="guide-reader-title">${escapeHtml(guide.title)}</div>
      <div class="guide-reader-meta">${guide.steps.length} passo${guide.steps.length !== 1 ? 's' : ''} · Criado em ${dateStr}</div>
    </div>
    <div class="guide-reader-actions">
      <button class="btn-guide-action" onclick="openGuideCreator('${guide.id}')">✏️ Editar Guia</button>
    </div>
    <div class="guide-reader-steps">
      ${guide.steps.map((step, i) => `
        <div class="guide-reader-step">
          <div class="guide-reader-step-header">
            <div class="guide-reader-step-num">PASSO ${i + 1}</div>
            <div class="guide-reader-step-title">${escapeHtml(step.title || '(sem título)')}</div>
          </div>
          <div class="guide-reader-step-body">
            ${step.photo ? `<img src="${step.photo}" alt="Foto do passo ${i+1}" class="guide-reader-step-img">` : ''}
            ${step.description ? `<div class="guide-reader-step-desc">${escapeHtml(step.description)}</div>` : ''}
            ${!step.photo && !step.description ? `<div style="color:var(--txt3);font-family:monospace;font-size:12px;">(Sem descrição)</div>` : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

function closeGuideReader() {
  document.getElementById('guides-read-view').classList.add('hide');
  if (guideReaderReturnTo === 'detail' && state.currentGameId) {
    // Return to game detail view (achievements)
    showView('detail');
    const g = state.games.find(g => g.appid === state.currentGameId);
    if (g) renderAchievements(g);
  } else {
    document.getElementById('guides-list-view').classList.remove('hide');
  }
  guideReaderReturnTo = 'guides';
}

// ── DELETE GUIDE ──
function deleteGuide(guideId) {
  const guide = guides.find(g => g.id === guideId);
  if (!guide) return;
  if (!confirm(`Apagar o guia "${guide.title}"? Esta ação não pode ser desfeita.`)) return;
  guides = guides.filter(g => g.id !== guideId);
  saveGuides();
  populateGuideFilters();
  renderGuidesList();
}

// ── UTILS ──
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ══════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════
load();
loadGuides();

// Backwards compat
if (!state.profile) state.profile = { xp: 0, equippedTitle: 'novice', featuredGames: [], stats: {} };
if (!state.profile.featuredGames) state.profile.featuredGames = [];
if (!state.profile.equippedTitle) state.profile.equippedTitle = 'novice';
if (!state.profile.stats) state.profile.stats = {};
if (!state.userInfo) state.userInfo = { personaname: '', avatar: '', profileurl: '', realname: '', loccountrycode: '' };

// Check if API key came from config.js
const hasConfigKey = (typeof CONFIG !== 'undefined' && CONFIG.STEAM_API_KEY && CONFIG.STEAM_API_KEY !== 'SUA_API_KEY_AQUI');

// Hide API key input if using config.js
const keyInputGroup = document.getElementById('key-input-group');
if (hasConfigKey && keyInputGroup) {
  keyInputGroup.style.display = 'none';
}

if (state.apiKey && state.steamId) {
  document.getElementById('inp-key').value = state.apiKey;
  document.getElementById('inp-steamid').value = state.steamId;
  if (state.games.length > 0) {
    show('screen-dash');
    renderDash();
  } else if (state.trackedAppIds.size > 0) {
    fetchTrackedGames();
  } else {
    show('screen-loading');
    doFetch();
  }
} else {
  show('screen-login');
}

document.getElementById('inp-steamid').addEventListener('keydown', e => {
  if (e.key === 'Enter') startFetch();
});
