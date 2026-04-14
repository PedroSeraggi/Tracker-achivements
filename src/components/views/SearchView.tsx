import React, { useRef } from 'react';
import { useAppStore, selectFilteredSearchGames, selectSearchActiveGame } from '../../store/useAppStore';
import { Avatar, FilterBar, ProgressBar, Empty } from '../ui';
import GameCard from '../dashboard/GameCard';
import AchievementItem from '../dashboard/AchievementItem';
import CompareView from './CompareView';
import { usePlayerSearch } from '../../hooks';
import type { GameFilter, AchFilter } from '../../types';

// ── Search home (input + results) ──────────────────────────────────────────────
const SearchHome: React.FC = () => {
  const query               = useAppStore((s) => s.searchQuery);
  const setQuery            = useAppStore((s) => s.setSearchQuery);
  const searchError         = useAppStore((s) => s.searchError);
  const searchLoading       = useAppStore((s) => s.searchLoading);
  const searchedPlayer      = useAppStore((s) => s.searchedPlayer);
  const searchGameFilter    = useAppStore((s) => s.searchGameFilter);
  const setSearchGameFilter = useAppStore((s) => s.setSearchGameFilter);
  const openSearchGameDetail = useAppStore((s) => s.openSearchGameDetail);
  const setSearchView        = useAppStore((s) => s.setSearchView);

  const { search, loadPlayerGames } = usePlayerSearch();
  const filteredGames = useAppStore(selectFilteredSearchGames);
  const inputRef = useRef<HTMLInputElement>(null);

  const SEARCH_FILTERS: { value: GameFilter; label: string }[] = [
    { value: 'all',     label: 'Todos' },
    { value: 'started', label: 'Em Progresso' },
    { value: 'platinum', label: 'Platinados' },
  ];

  const handleSearch = () => {
    if (query.trim()) search(query.trim());
  };

  return (
    <div id="search-home-view">
      {/* Hero */}
      <div className="search-hero">
        <div className="search-hero-icon">🔍</div>
        <h2 className="search-hero-title">Buscar Jogadores</h2>
        <p className="search-hero-sub">
          Pesquise por SteamID64, URL personalizada ou link do perfil Steam
        </p>

        <div className="search-bar-wrap">
          <input
            ref={inputRef}
            type="text"
            className="search-player-input"
            placeholder="ex: 76561198012345678 ou meuNomeSteam ou steamcommunity.com/id/nome"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !searchLoading && handleSearch()}
          />
          <button
            className="btn-search-player"
            onClick={handleSearch}
            disabled={searchLoading}
            style={{ opacity: searchLoading ? 0.6 : 1 }}
          >
            {searchLoading ? '⏳' : 'Buscar'}
          </button>
        </div>

        {searchError && (
          <div className="search-error">{searchError}</div>
        )}
      </div>

      {/* Found player */}
      {searchedPlayer && (
        <div id="search-result">
          <div className="found-player-card" id="found-player-card">
            <Avatar src={searchedPlayer.user.avatarUrl} size={72} />
            <div className="found-info">
              <div className="found-name">{searchedPlayer.user.personaName}</div>
              {searchedPlayer.user.realName && (
                <div className="found-realname">{searchedPlayer.user.realName}</div>
              )}
              <div className="found-steamid">{searchedPlayer.user.steamId}</div>
              <div className="found-links">
                <a
                  href={searchedPlayer.user.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="found-link"
                >
                  Ver no Steam
                </a>
                {searchedPlayer.user.communityVisibilityState < 3 && (
                  <span className="found-private-badge">🔒 Perfil Privado</span>
                )}
              </div>
            </div>
            {!searchedPlayer.gamesLoaded && (
              <button
                className="btn-load-games"
                onClick={() => loadPlayerGames(searchedPlayer.user.steamId)}
                disabled={searchLoading}
                style={{ opacity: searchLoading ? 0.6 : 1 }}
              >
                {searchLoading ? '⏳ Carregando...' : 'Carregar Jogos'}
              </button>
            )}
            {searchedPlayer.gamesLoaded && (
              <button
                className="btn-load-games"
                onClick={() => setSearchView('profile')}
              >
                Ver Perfil
              </button>
            )}
          </div>

          {/* Games grid for searched player */}
          {searchedPlayer.gamesLoaded && (
            <div id="search-games-section">
              <div className="search-games-header">
                <span id="search-games-title" style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt2)', letterSpacing: 1 }}>
                  {filteredGames.length} Jogos
                </span>
                <div className="search-games-filters">
                  <FilterBar
                    options={SEARCH_FILTERS}
                    active={searchGameFilter}
                    onChange={setSearchGameFilter}
                  />
                </div>
              </div>
              <div className="games-grid" id="search-games-grid">
                {filteredGames.map((g) => (
                  <GameCard
                    key={g.appId}
                    game={g}
                    readonly
                    onClick={() => openSearchGameDetail(g.appId)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Searched player profile ────────────────────────────────────────────────────
const SearchProfileView: React.FC = () => {
  const searchedPlayer = useAppStore((s) => s.searchedPlayer);
  const setSearchView  = useAppStore((s) => s.setSearchView);
  const openSearchGameDetail = useAppStore((s) => s.openSearchGameDetail);
  const filteredGames  = useAppStore(selectFilteredSearchGames);
  const searchGameFilter = useAppStore((s) => s.searchGameFilter);
  const setSearchGameFilter = useAppStore((s) => s.setSearchGameFilter);

  const SEARCH_FILTERS: { value: GameFilter; label: string }[] = [
    { value: 'all',      label: 'Todos' },
    { value: 'started',  label: 'Em Progresso' },
    { value: 'platinum', label: 'Platinados' },
  ];

  if (!searchedPlayer) return null;
  const { user, games } = searchedPlayer;
  const totalUnlocked = games.reduce((s, g) => s + g.unlockedCount, 0);
  const totalAch      = games.reduce((s, g) => s + g.totalCount, 0);
  const pct           = totalAch > 0 ? Math.round((totalUnlocked / totalAch) * 100) : 0;

  return (
    <div id="search-profile-detail">
      <button className="detail-back" onClick={() => setSearchView('home')}>
        ← Voltar à Busca
      </button>

      <div id="search-profile-container" className="profile-container" style={{ padding: '0 20px' }}>
        {/* Player card */}
        <div
          style={{
            display: 'flex',
            gap: 16,
            alignItems: 'center',
            background: 'var(--bg2)',
            border: '1px solid var(--b2)',
            borderRadius: 14,
            padding: '20px 22px',
            marginBottom: 20,
          }}
        >
          <Avatar src={user.avatarUrl} size={64} />
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{user.personaName}</div>
            <div style={{ fontSize: 12, color: 'var(--txt3)', fontFamily: 'monospace' }}>
              {user.steamId}
            </div>
            <a href={user.profileUrl} target="_blank" rel="noopener noreferrer" className="found-link" style={{ marginTop: 8, display: 'inline-block' }}>
              Ver no Steam
            </a>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--accent)' }}>{pct}%</div>
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{totalUnlocked}/{totalAch}</div>
            <ProgressBar percent={pct} height={4} />
          </div>
        </div>

        {/* Games */}
        <div style={{ marginBottom: 12 }}>
          <FilterBar options={SEARCH_FILTERS} active={searchGameFilter} onChange={setSearchGameFilter} />
        </div>
        {filteredGames.length === 0 ? (
          <Empty icon="🎮" title="Nenhum jogo encontrado" />
        ) : (
          <div className="games-grid">
            {filteredGames.map((g) => (
              <GameCard
                key={g.appId}
                game={g}
                readonly
                onClick={() => openSearchGameDetail(g.appId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── Searched game detail ───────────────────────────────────────────────────────
const SearchGameDetail: React.FC = () => {
  const game            = useAppStore(selectSearchActiveGame);
  const achFilter       = useAppStore((s) => s.searchAchFilter);
  const setAchFilter    = useAppStore((s) => s.setSearchAchFilter);
  const closeDetail     = useAppStore((s) => s.closeSearchGameDetail);
  const setSearchView   = useAppStore((s) => s.setSearchView);
  const myGame          = useAppStore((s) =>
    s.games.find((g) => g.appId === s.searchActiveGameAppId)
  );

  const ACH_FILTERS: { value: AchFilter; label: string }[] = [
    { value: 'all',      label: 'Todos' },
    { value: 'unlocked', label: 'Desbloqueados' },
    { value: 'locked',   label: 'Bloqueados' },
  ];

  if (!game) return null;

  const achievements = (() => {
    switch (achFilter) {
      case 'unlocked': return game.achievements.filter((a) => a.achieved);
      case 'locked':   return game.achievements.filter((a) => !a.achieved);
      default:         return game.achievements;
    }
  })();

  return (
    <div id="search-game-detail">
      <button className="detail-back" onClick={closeDetail}>
        ← Voltar ao Perfil
      </button>

      {/* Banner */}
      <div className="detail-banner">
        <div
          className="detail-banner-bg"
          style={{ backgroundImage: `url(${game.heroImage})` }}
        />
        <div className="detail-banner-overlay" />
        <div className="detail-banner-content">
          <div className="detail-banner-top">
            <div className="detail-banner-info">
              <div className="detail-banner-title">{game.name}</div>
              <div className="detail-banner-stats">
                {game.unlockedCount}/{game.totalCount} conquistas
              </div>
            </div>
            <div className="detail-banner-pct">
              <div className="detail-pct">{game.percentage}%</div>
              <div className="detail-achcount">{game.unlockedCount} / {game.totalCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters + Compare button */}
      <div className="ach-filters" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <FilterBar options={ACH_FILTERS} active={achFilter} onChange={setAchFilter} />
        {myGame && (
          <button
            className="btn-compare"
            onClick={() => setSearchView('compare')}
          >
            ⚔️ Comparar Comigo
          </button>
        )}
      </div>

      <div className="ach-list">
        {achievements.map((ach) => (
          <AchievementItem key={ach.apiName} achievement={ach} readonly />
        ))}
      </div>
    </div>
  );
};

// ── SearchView router ──────────────────────────────────────────────────────────
const SearchView: React.FC = () => {
  const searchView = useAppStore((s) => s.searchView);

  return (
    <div id="view-search">
      {searchView === 'home'    && <SearchHome />}
      {searchView === 'profile' && <SearchProfileView />}
      {searchView === 'game'    && <SearchGameDetail />}
      {searchView === 'compare' && <CompareView />}
    </div>
  );
};

export default SearchView;
