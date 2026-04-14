/**
 * trophy-duel.js  (v2 — reescrito)
 * =================================
 * Usa os dados já carregados em localStorage['steam-tracker-games']
 * pelo script.js principal. Não faz chamadas de API adicionais —
 * achievements, globalPct e nomes já estão cacheados localmente.
 *
 * Estrutura dos dados (definida pelo script.js):
 *
 *   state.games[] = [{
 *     appid        : number,
 *     name         : string,
 *     totalAch     : number,
 *     doneAch      : number,
 *     pct          : number,
 *     achievements : [{
 *       id         : string,   ← apiname
 *       name       : string,   ← displayName
 *       desc       : string,
 *       icon       : string,   ← URL do ícone colorido
 *       iconGray   : string,
 *       unlocked   : boolean,
 *       globalPct  : number | undefined,
 *       type       : 'P'|'G'|'S'|'B',
 *     }]
 *   }]
 */

/* ─────────────────────────────────────────────────────────────
   MODULE: DuelConstants
───────────────────────────────────────────────────────────── */
const DuelConstants = Object.freeze({
  MAX_GAME_SELECTION: 5,

  RARITY_TIERS: [
    { name: 'mythic',    label: '✦ Mythic',    minDamage: 970, emoji: '🌟' },
    { name: 'legendary', label: '★ Legendary', minDamage: 850, emoji: '🏆' },
    { name: 'epic',      label: '◆ Epic',       minDamage: 700, emoji: '💎' },
    { name: 'rare',      label: '◇ Rare',       minDamage: 500, emoji: '🔷' },
    { name: 'uncommon',  label: '○ Uncommon',  minDamage: 300, emoji: '🟢' },
    { name: 'common',    label: '● Common',    minDamage: 0,   emoji: '⚪' },
  ],

  SORT_OPTIONS: [
    { key: 'damage-desc', label: '⚔ Dano ↓' },
    { key: 'damage-asc',  label: '⚔ Dano ↑' },
    { key: 'game',        label: '🎮 Jogo' },
  ],

  FILTER_OPTIONS: [
    { key: 'all',       label: 'Todas' },
    { key: 'mythic',    label: '✦ Mythic' },
    { key: 'legendary', label: '★ Legendary' },
    { key: 'epic',      label: '◆ Epic' },
    { key: 'rare',      label: '◇ Rare' },
    { key: 'uncommon',  label: '○ Uncommon' },
    { key: 'common',    label: '● Common' },
  ],

  STEAM_CDN: 'https://cdn.akamai.steamstatic.com/steam/apps',
});

/* ─────────────────────────────────────────────────────────────
   MODULE: DuelData
   Lê e normaliza dados do localStorage — sem chamadas de rede.
───────────────────────────────────────────────────────────── */
const DuelData = (() => {

  function getTrackedGames() {
    try {
      // Tenta primeiro o cache de sessão (mais recente)
      const sessionRaw = localStorage.getItem('steamTracker_sessionCache');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (Array.isArray(session.games) && session.games.length > 0) {
          return _normalize(session.games);
        }
      }
      // Fallback: chave principal
      const raw = localStorage.getItem('steam-tracker-games');
      if (!raw) return [];
      return _normalize(JSON.parse(raw));
    } catch (e) {
      console.warn('[TrophyDuel] Erro ao ler jogos do localStorage:', e);
      return [];
    }
  }

  function _normalize(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(g => {
        // Só jogos que têm pelo menos 1 conquista desbloqueada
        if (!g || !g.appid) return false;
        if (g.doneAch > 0) return true;
        if (Array.isArray(g.achievements)) return g.achievements.some(a => a.unlocked === true);
        return false;
      })
      .map(g => ({
        appid      : String(g.appid),
        name       : g.name || `App ${g.appid}`,
        doneAch    : g.doneAch  || 0,
        totalAch   : g.totalAch || 0,
        pct        : g.pct      || 0,
        headerUrl  : `${DuelConstants.STEAM_CDN}/${g.appid}/header.jpg`,
        achievements: Array.isArray(g.achievements) ? g.achievements : [],
      }));
  }

  return { getTrackedGames };
})();

/* ─────────────────────────────────────────────────────────────
   MODULE: DuelCards
───────────────────────────────────────────────────────────── */
const DuelCards = (() => {

  function getRarityFromDamage(damage) {
    for (const tier of DuelConstants.RARITY_TIERS) {
      if (damage >= tier.minDamage) return tier;
    }
    return DuelConstants.RARITY_TIERS[DuelConstants.RARITY_TIERS.length - 1];
  }

  function calcDamage(globalPct) {
    if (globalPct === undefined || globalPct === null || isNaN(globalPct)) return 500;
    return Math.round((100 - Math.min(100, Math.max(0, globalPct))) * 10);
  }

  function buildCard(ach, game) {
    const damage = calcDamage(ach.globalPct);
    const rarity = getRarityFromDamage(damage);
    return Object.freeze({
      id           : `${game.appid}::${ach.id}`,
      apiname      : ach.id,
      displayName  : ach.name || ach.id,
      description  : ach.desc || '',
      iconUrl      : ach.icon || ach.iconGray || '',
      gameAppId    : game.appid,
      gameName     : game.name,
      gameHeaderUrl: game.headerUrl,
      damage,
      rarity       : rarity.name,
      rarityLabel  : rarity.label,
      rarityEmoji  : rarity.emoji,
      globalPct    : ach.globalPct ?? null,
      trophyType   : ach.type || 'B',
    });
  }

  function generateCardsForGame(game) {
    return game.achievements
      .filter(a => a.unlocked === true)
      .map(a => buildCard(a, game));
  }

  function sortCards(cards, sortKey) {
    const copy = [...cards];
    switch (sortKey) {
      case 'damage-desc': return copy.sort((a, b) => b.damage - a.damage);
      case 'damage-asc':  return copy.sort((a, b) => a.damage - b.damage);
      case 'game':        return copy.sort((a, b) => a.gameName.localeCompare(b.gameName) || b.damage - a.damage);
      default:            return copy;
    }
  }

  function filterCards(cards, rarityFilter) {
    if (rarityFilter === 'all') return cards;
    return cards.filter(c => c.rarity === rarityFilter);
  }

  function buildRarityStats(cards) {
    const stats = {};
    DuelConstants.RARITY_TIERS.forEach(t => { stats[t.name] = 0; });
    cards.forEach(c => { stats[c.rarity] = (stats[c.rarity] || 0) + 1; });
    return stats;
  }

  return { calcDamage, getRarityFromDamage, buildCard, generateCardsForGame, sortCards, filterCards, buildRarityStats };
})();

/* ─────────────────────────────────────────────────────────────
   MODULE: DuelState
───────────────────────────────────────────────────────────── */
const DuelState = (() => {
  let _state = {
    phase          : 'select',
    selectedGameIds: new Set(),
    cards          : [],
    sortKey        : 'damage-desc',
    rarityFilter   : 'all',
    error          : null,
  };

  const _listeners = [];
  function _notify() { _listeners.forEach(fn => fn(_state)); }

  return {
    subscribe(fn) {
      _listeners.push(fn);
      return () => { const i = _listeners.indexOf(fn); if (i !== -1) _listeners.splice(i, 1); };
    },
    get() { return { ..._state, selectedGameIds: new Set(_state.selectedGameIds) }; },
    toggleGame(appid) {
      const ids = new Set(_state.selectedGameIds);
      if (ids.has(appid)) { ids.delete(appid); }
      else if (ids.size < DuelConstants.MAX_GAME_SELECTION) { ids.add(appid); }
      _state = { ..._state, selectedGameIds: ids };
      _notify();
    },
    setPhase(p)   { _state = { ..._state, phase: p };             _notify(); },
    setCards(c)   { _state = { ..._state, cards: c, phase: 'deck', error: null }; _notify(); },
    setError(e)   { _state = { ..._state, error: e, phase: 'select' }; _notify(); },
    setSortKey(k) { _state = { ..._state, sortKey: k };           _notify(); },
    setFilter(f)  { _state = { ..._state, rarityFilter: f };      _notify(); },
    reset()       { _state = { ..._state, phase: 'select', cards: [], error: null, selectedGameIds: new Set() }; _notify(); },
  };
})();

/* ─────────────────────────────────────────────────────────────
   MODULE: DuelUI
───────────────────────────────────────────────────────────── */
const DuelUI = (() => {

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = String(str ?? '');
    return d.innerHTML;
  }

  function cardHTML(card) {
    const bgUrl = card.iconUrl || card.gameHeaderUrl;
    const artBg = bgUrl
      ? `<div class="card-art-bg" style="background-image:url('${esc(bgUrl)}')"></div>`
      : `<div class="card-art-bg" style="background:linear-gradient(135deg,#0a1628,#1a2a3a)"></div>`;

    const artIcon = card.iconUrl
      ? `<img class="card-art-icon" src="${esc(card.iconUrl)}" alt="" loading="lazy" decoding="async">`
      : `<div class="card-art-icon-ph">${esc(card.rarityEmoji)}</div>`;

    // Miniatura do jogo no canto inferior esquerdo da arte
    const gameThumb = `
      <div class="card-game-thumb" title="${esc(card.gameName)}">
        <img src="${esc(card.gameHeaderUrl)}" alt="" loading="lazy"
             onerror="this.parentElement.style.display='none'">
      </div>`;

    const pctDisplay = card.globalPct !== null ? `${card.globalPct.toFixed(1)}%` : '??%';

    return `
      <div class="trophy-card" data-rarity="${esc(card.rarity)}" data-id="${esc(card.id)}">
        <div class="trophy-card-inner">
          <div class="card-art-area">
            ${artBg}
            ${artIcon}
            <div class="card-rarity-badge">${esc(card.rarityLabel)}</div>
            ${gameThumb}
          </div>
          <div class="card-body">
            <div class="card-ach-name">${esc(card.displayName)}</div>
            <div class="card-game-name">${esc(card.gameName)}</div>
            <div class="card-ach-desc">${esc(card.description || '')}</div>
          </div>
          <div class="card-footer">
            <span class="card-unlock-pct">${esc(pctDisplay)}</span>
            <div class="card-damage-block">
              <span class="card-damage-icon">⚔</span>
              <span class="card-damage-value">${esc(String(card.damage))}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function gameTileHTML(game, isSelected, isDisabled) {
    const selCls = isSelected  ? ' selected' : '';
    const disCls = isDisabled  ? ' disabled' : '';
    return `
      <div class="duel-game-tile${selCls}${disCls}"
           data-appid="${esc(game.appid)}"
           role="checkbox" aria-checked="${isSelected}"
           tabindex="${isDisabled ? '-1' : '0'}">
        <div class="duel-tile-check">✓</div>
        <img class="duel-tile-img"
             src="${esc(game.headerUrl)}" alt="" loading="lazy"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div class="duel-tile-img-ph" style="display:none">🎮</div>
        <div class="duel-tile-name">${esc(game.name)}</div>
        <div class="duel-tile-meta">${esc(String(game.doneAch))} conquistas desbloqueadas</div>
      </div>`;
  }

  function renderSelect(container, games, selectedIds, onToggle, onGenerate) {
    const atMax = selectedIds.size >= DuelConstants.MAX_GAME_SELECTION;
    const tilesHtml = games.length
      ? games.map(g => gameTileHTML(g, selectedIds.has(g.appid), atMax && !selectedIds.has(g.appid))).join('')
      : `<div style="grid-column:1/-1;color:var(--txt2);font-size:13px;padding:24px 0;text-align:center">
           <div style="font-size:36px;margin-bottom:12px">🎮</div>
           Nenhum jogo com conquistas encontrado.<br>
           <span style="color:var(--txt3)">Adicione jogos na aba principal e clique em ↺ Atualizar.</span>
         </div>`;

    container.innerHTML = `
      <div class="duel-topbar">
        <div>
          <div class="duel-topbar-title">⚔️ Trophy Duel</div>
          <div class="duel-topbar-sub">Selecione até ${DuelConstants.MAX_GAME_SELECTION} jogos para gerar seu deck</div>
        </div>
      </div>
      <div class="duel-phase">
        <div class="duel-phase-label">
          Jogos com conquistas desbloqueadas — ${esc(String(selectedIds.size))}/${DuelConstants.MAX_GAME_SELECTION} selecionados
        </div>
        <div class="duel-game-selection-grid">${tilesHtml}</div>
        <div style="margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <button class="btn-duel-generate" id="btn-duel-generate" ${selectedIds.size > 0 ? '' : 'disabled'}>
            ⚔️ Gerar Deck de Cartas
          </button>
          <span style="font-size:12px;color:var(--txt3)">
            ${selectedIds.size > 0
              ? `${selectedIds.size} jogo${selectedIds.size > 1 ? 's' : ''} selecionado${selectedIds.size > 1 ? 's' : ''}`
              : 'Selecione pelo menos 1 jogo'}
          </span>
        </div>
      </div>`;

    container.querySelectorAll('.duel-game-tile').forEach(tile => {
      const h = () => { if (!tile.classList.contains('disabled')) onToggle(tile.dataset.appid); };
      tile.addEventListener('click', h);
      tile.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h(); } });
    });
    const btn = container.querySelector('#btn-duel-generate');
    if (btn) btn.addEventListener('click', onGenerate);
  }

  function renderLoading(container, count) {
    container.innerHTML = `
      <div class="duel-topbar">
        <div>
          <div class="duel-topbar-title">⚔️ Trophy Duel</div>
          <div class="duel-topbar-sub">Gerando deck de ${count} jogo${count !== 1 ? 's' : ''}…</div>
        </div>
      </div>
      <div class="duel-loading">
        <div class="duel-loading-spinner"></div>
        <div class="duel-loading-text">Calculando raridade das conquistas…</div>
      </div>`;
  }

  function renderDeck(container, cards, allCards, sortKey, rarityFilter, { onSort, onFilter, onReset }) {
    const stats = DuelCards.buildRarityStats(allCards);

    const statPills = DuelConstants.RARITY_TIERS
      .filter(t => stats[t.name] > 0)
      .map(t => `
        <div class="duel-stat-pill">
          <span class="pill-dot dot-${esc(t.name)}"></span>
          <span>${esc(t.label)}</span>
          <span class="pill-count">${stats[t.name]}</span>
        </div>`).join('');

    const sortBtns = DuelConstants.SORT_OPTIONS
      .map(o => `<button class="duel-sort-btn${sortKey === o.key ? ' active' : ''}" data-sort="${esc(o.key)}">${esc(o.label)}</button>`)
      .join('');

    const filterBtns = DuelConstants.FILTER_OPTIONS
      .filter(o => o.key === 'all' || (stats[o.key] ?? 0) > 0)
      .map(o => `<button class="duel-sort-btn${rarityFilter === o.key ? ' active' : ''}" data-filter="${esc(o.key)}">${esc(o.label)}</button>`)
      .join('');

    const cardsHtml = cards.length
      ? cards.map(cardHTML).join('')
      : `<div class="duel-empty-state" style="grid-column:1/-1">
           <div class="duel-empty-icon">🃏</div>
           <div class="duel-empty-title">Nenhuma carta com esse filtro</div>
           <div class="duel-empty-sub">Remova o filtro para ver todas as cartas.</div>
         </div>`;

    container.innerHTML = `
      <div class="duel-topbar">
        <div>
          <div class="duel-topbar-title">⚔️ Trophy Duel — Seu Deck</div>
          <div class="duel-topbar-sub">${allCards.length} cartas geradas</div>
        </div>
        <button class="btn-duel-reset" id="btn-duel-reset">↺ Novo Deck</button>
      </div>
      <div class="duel-deck-stats">
        ${statPills}
        <span class="duel-total-cards">${cards.length} cartas exibidas</span>
      </div>
      <div class="duel-controls">
        <span class="duel-sort-label">ORDENAR:</span>${sortBtns}
        <div class="duel-filter-sep"></div>
        <span class="duel-sort-label">FILTRAR:</span>${filterBtns}
      </div>
      <div class="duel-card-grid">${cardsHtml}</div>`;

    container.querySelectorAll('[data-sort]').forEach(b   => b.addEventListener('click', () => onSort(b.dataset.sort)));
    container.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => onFilter(b.dataset.filter)));
    const resetBtn = container.querySelector('#btn-duel-reset');
    if (resetBtn) resetBtn.addEventListener('click', onReset);
  }

  function renderError(container, message) {
    const old = container.querySelector('.duel-error-banner');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'duel-error-banner';
    el.textContent = `Erro: ${message}`;
    container.prepend(el);
  }

  return { renderSelect, renderLoading, renderDeck, renderError };
})();

/* ─────────────────────────────────────────────────────────────
   MODULE: TrophyDuel — Orquestrador público
───────────────────────────────────────────────────────────── */
const TrophyDuel = (() => {
  let _container = null;

  function _generate() {
    const state = DuelState.get();
    if (state.selectedGameIds.size === 0) return;

    DuelState.setPhase('loading');

    // setTimeout 50ms deixa o browser renderizar o loading antes de processar
    setTimeout(() => {
      try {
        const allGames = DuelData.getTrackedGames();
        const selected = allGames.filter(g => state.selectedGameIds.has(g.appid));

        const allCards = [];
        for (const game of selected) {
          allCards.push(...DuelCards.generateCardsForGame(game));
        }

        if (allCards.length === 0) {
          DuelState.setError(
            'Nenhuma conquista desbloqueada nos jogos selecionados. ' +
            'Verifique se o perfil Steam está público e clique em ↺ Atualizar na tela principal.'
          );
          return;
        }

        DuelState.setCards(allCards);
      } catch (err) {
        console.error('[TrophyDuel] Erro ao gerar deck:', err);
        DuelState.setError(err.message || 'Erro desconhecido.');
      }
    }, 50);
  }

  function _render(state) {
    if (!_container) return;
    switch (state.phase) {
      case 'select': {
        const games = DuelData.getTrackedGames();
        DuelUI.renderSelect(_container, games, state.selectedGameIds,
          appid => DuelState.toggleGame(appid),
          ()    => _generate()
        );
        if (state.error) DuelUI.renderError(_container, state.error);
        break;
      }
      case 'loading':
        DuelUI.renderLoading(_container, state.selectedGameIds.size);
        break;
      case 'deck': {
        const filtered = DuelCards.filterCards(state.cards, state.rarityFilter);
        const sorted   = DuelCards.sortCards(filtered, state.sortKey);
        DuelUI.renderDeck(_container, sorted, state.cards, state.sortKey, state.rarityFilter, {
          onSort  : k => DuelState.setSortKey(k),
          onFilter: f => DuelState.setFilter(f),
          onReset : () => DuelState.reset(),
        });
        break;
      }
    }
  }

  function init(containerId = 'view-duel') {
    _container = document.getElementById(containerId);
    if (!_container) { console.warn('[TrophyDuel] Container não encontrado:', containerId); return; }
    DuelState.subscribe(_render);
    _render(DuelState.get());
  }

  function onShow() {
    if (DuelState.get().phase === 'select') _render(DuelState.get());
  }

  return { init, onShow };
})();

window.TrophyDuel = TrophyDuel;
