// =============================================================================
//  src/components/search/SearchView.tsx  (atualizado)
//
//  Roteador de views da aba de Busca. Responsabilidades:
//    · SearchHome  — input + resultado da busca
//    · PlayerProfilePage — perfil completo do jogador encontrado (NOVO)
//    · SearchGameDetail  — detalhe de um jogo + botão de comparação
//    · CompareView       — comparação lado a lado de conquistas
//
//  Nenhuma mudança de store necessária.
// =============================================================================

import React, { useRef, useEffect } from 'react';
import {
  useAppStore,
  selectFilteredSearchGames,
  selectSearchActiveGame,
} from '../../store/useAppStore';
import { Avatar, FilterBar, Empty } from '../ui';
import GameCard from '../dashboard/GameCard';
import AchievementItem from '../dashboard/AchievementItem';
import CompareView from './CompareView';
import PlayerProfilePage from './PlayerProfilePage';
import { usePlayerSearch } from '../../hooks';
import type { GameFilter, AchFilter } from '../../types';

// ══════════════════════════════════════════════════════════════════════════════
//  SEARCH HOME — input + found player card
// ══════════════════════════════════════════════════════════════════════════════

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

  const { search, loadPlayerGames, loadingProgress } = usePlayerSearch();
  const filteredGames = useAppStore(selectFilteredSearchGames);
  const inputRef = useRef<HTMLInputElement>(null);

  const SEARCH_FILTERS: { value: GameFilter; label: string }[] = [
    { value: 'all',      label: 'Todos'        },
    { value: 'started',  label: 'Em Progresso' },
    { value: 'platinum', label: 'Platinados'   },
  ];

  const handleSearch = () => {
    const q = query.trim();
    if (q && !searchLoading) search(q);
  };

  // Listen for custom search event from friend clicks
  useEffect(() => {
    const handleSearchPlayer = (e: CustomEvent<{ steamId: string; personaName: string }>) => {
      const { steamId } = e.detail;
      // Search by steamId directly
      setQuery(steamId);
      setTimeout(() => search(steamId), 50);
    };
    window.addEventListener('searchPlayer', handleSearchPlayer as EventListener);
    return () => window.removeEventListener('searchPlayer', handleSearchPlayer as EventListener);
  }, [search, setQuery]);

  return (
    <div id="search-home-view">

      {/* ── Hero search input ────────────────────────────────────────── */}
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
            placeholder="ex: 76561198012345678  •  meuNomeSteam  •  steamcommunity.com/id/nome"
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            className="btn-search-player"
            onClick={handleSearch}
            disabled={searchLoading}
          >
            {searchLoading ? '⏳' : 'Buscar'}
          </button>
        </div>

        {searchError && (
          <div className="search-error">⚠ {searchError}</div>
        )}
      </div>

      {/* ── Found player card ────────────────────────────────────────── */}
      {searchedPlayer && (
        <div id="search-result" style={{ padding: '0 20px' }}>
          <div className="found-player-card" id="found-player-card">
            <Avatar src={searchedPlayer.user.avatarUrl} size={64} />

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
                  Ver no Steam ↗
                </a>
                {searchedPlayer.user.communityVisibilityState < 3 && (
                  <span className="found-private-badge">🔒 Perfil Privado</span>
                )}
              </div>
            </div>

            {/* CTA: load or open profile */}
            {!searchedPlayer.gamesLoaded ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 180 }}>
                <button
                  className="btn-load-games"
                  onClick={() => loadPlayerGames(searchedPlayer.user.steamId)}
                  disabled={searchLoading}
                >
                  {searchLoading ? '⏳ Carregando...' : '🎮 Carregar Perfil'}
                </button>
                {searchLoading && loadingProgress.progress > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                      {loadingProgress.status}
                    </div>
                    <div style={{
                      height: 4,
                      background: 'rgba(255,255,255,0.1)',
                      borderRadius: 2,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${loadingProgress.progress}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                        borderRadius: 2,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--txt3)', textAlign: 'right' }}>
                      {loadingProgress.loaded}/{loadingProgress.total}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-load-games"
                onClick={() => setSearchView('profile')}
              >
                Ver Perfil →
              </button>
            )}
          </div>

          {/* ── Inline games grid (fallback when profile not opened) ─── */}
          {searchedPlayer.gamesLoaded && (
            <div id="search-games-section">
              <div className="search-games-header">
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--txt2)',
                    letterSpacing: '0.5px',
                  }}
                >
                  {filteredGames.length} jogos — clique em "Ver Perfil" para a visão completa
                </span>
                <FilterBar
                  options={SEARCH_FILTERS}
                  active={searchGameFilter}
                  onChange={setSearchGameFilter}
                />
              </div>
              <div className="games-grid" id="search-games-grid">
                {filteredGames.map((g) => (
                  <GameCard
                    key={g.appId}
                    game={g}
                    readonly
                    onClick={() => {
                      openSearchGameDetail(g.appId);
                      setSearchView('game');
                    }}
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

// ══════════════════════════════════════════════════════════════════════════════
//  SEARCH GAME DETAIL — achievement list for a specific searched game
// ══════════════════════════════════════════════════════════════════════════════

const SearchGameDetail: React.FC = () => {
  const game              = useAppStore(selectSearchActiveGame);
  const achFilter         = useAppStore((s) => s.searchAchFilter);
  const setAchFilter      = useAppStore((s) => s.setSearchAchFilter);
  const closeDetail       = useAppStore((s) => s.closeSearchGameDetail);
  const setSearchView     = useAppStore((s) => s.setSearchView);
  const searchedPlayer    = useAppStore((s) => s.searchedPlayer);

  // Whether I have this game too (enables compare)
  const myGame = useAppStore((s) =>
    s.games.find((g) => g.appId === s.searchActiveGameAppId)
  );

  const ACH_FILTERS: { value: AchFilter; label: string }[] = [
    { value: 'all',      label: 'Todos'         },
    { value: 'unlocked', label: 'Desbloqueados' },
    { value: 'locked',   label: 'Bloqueados'    },
  ];

  if (!game) return null;

  const achievements = (() => {
    switch (achFilter) {
      case 'unlocked': return game.achievements.filter((a) => a.achieved);
      case 'locked':   return game.achievements.filter((a) => !a.achieved);
      default:         return game.achievements;
    }
  })();

  // Back destination: if we came from the full profile, go back there
  const handleBack = () => {
    if (searchedPlayer?.gamesLoaded) {
      setSearchView('profile');
    } else {
      closeDetail();
      setSearchView('home');
    }
  };

  return (
    <div id="search-game-detail">
      <button className="detail-back" onClick={handleBack}>
        ← Voltar ao Perfil
      </button>

      {/* ── Banner ──────────────────────────────────────────────────── */}
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
              <div className="detail-achcount">
                {game.unlockedCount} / {game.totalCount}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters + compare CTA ───────────────────────────────────── */}
      <div
        className="ach-filters"
        style={{
          display        : 'flex',
          alignItems     : 'center',
          justifyContent : 'space-between',
          flexWrap       : 'wrap',
          gap            : 8,
        }}
      >
        <FilterBar
          options={ACH_FILTERS}
          active={achFilter}
          onChange={setAchFilter}
        />
        {myGame && (
          <button
            className="btn-compare"
            onClick={() => setSearchView('compare')}
          >
            ⚔️ Comparar Comigo
          </button>
        )}
      </div>

      {/* ── Achievement list ─────────────────────────────────────────── */}
      {achievements.length === 0 ? (
        <Empty icon="🏅" title="Nenhuma conquista nesta categoria" />
      ) : (
        <div className="ach-list">
          {achievements.map((ach) => (
            <AchievementItem key={ach.apiName} achievement={ach} readonly />
          ))}
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  SEARCH VIEW ROUTER
// ══════════════════════════════════════════════════════════════════════════════

const SearchView: React.FC = () => {
  const searchView = useAppStore((s) => s.searchView);

  return (
    <div id="view-search">
      {searchView === 'home'    && <SearchHome />}
      {searchView === 'profile' && <PlayerProfilePage />}
      {searchView === 'game'    && <SearchGameDetail />}
      {searchView === 'compare' && <CompareView />}
    </div>
  );
};

export default SearchView;
