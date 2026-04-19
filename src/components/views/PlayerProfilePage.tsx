

import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { useAppStore, selectFilteredSearchGames } from '../../store/useAppStore';
import { Avatar, FilterBar, Empty, ProgressBar } from '../ui';
import GameCard from '../dashboard/GameCard';
import { fetchPlayerBackground, syncPlayerToLeaderboard, fetchPlayerFriends, type PlayerFriend } from '../../api/steamApi';
import { bgImageUrl, bgVideoUrl, type ProfileBackground } from '../../hooks/useProfileData';
import type { Game, GameFilter, Achievement } from '../../types';

// ─── Types ────────────────────────────────────────────────────────────────────

type AchWithGame = Achievement & { gameName: string; appId: number };

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatPlaytime(minutes: number): string {
  const hours = Math.round(minutes / 60);
  return `${hours.toLocaleString('pt-BR')}h`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Row de conquista recente */
const RecentAchRow: React.FC<{ ach: AchWithGame }> = ({ ach }) => {
  const isRare = ach.globalPercent != null && ach.globalPercent <= 10;
  return (
    <div className="pp-recent-row">
      <img
        className="pp-recent-icon"
        src={ach.iconUrl}
        alt={ach.displayName}
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
      />
      <div className="pp-recent-info">
        <div className="pp-recent-name">{ach.displayName}</div>
        <div className="pp-recent-game">{ach.gameName}</div>
      </div>
      {isRare && (
        <div className="pp-rare-badge" title={`${ach.globalPercent!.toFixed(1)}% dos jogadores`}>
          💎 {ach.globalPercent!.toFixed(1)}%
        </div>
      )}
    </div>
  );
};

/** Row de conquista rara */
const RareAchRow: React.FC<{ ach: AchWithGame }> = ({ ach }) => (
  <div className="pp-rare-row">
    <img
      className="pp-rare-icon"
      src={ach.iconUrl}
      alt={ach.displayName}
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = 'hidden')}
    />
    <div className="pp-rare-info">
      <div className="pp-rare-name">{ach.displayName}</div>
      <div className="pp-rare-game">{ach.gameName}</div>
    </div>
    <div className="pp-rare-pct">{ach.globalPercent!.toFixed(2)}%</div>
  </div>
);

/** Seção de Jogos com subabas para organização */
const PlayerGamesSection: React.FC<{ 
  games: Game[]; 
  onOpenGame: (appId: number) => void;
  isLoading?: boolean;
}> = ({ games, onOpenGame, isLoading }) => {
  type GameTab = 'recent' | 'playing' | 'platinum' | 'all';
  const [activeTab, setActiveTab] = useState<GameTab>('recent');
  const [isMinimized, setIsMinimized] = useState(false);

  // Jogos ordenados por tempo de jogo (mais jogados primeiro) - limitado a 10
  const recentGames = useMemo(() => 
    [...games].sort((a, b) => b.playtimeForever - a.playtimeForever).slice(0, 10),
    [games]
  );

  // Jogos em progresso (com conquistas mas não platinado)
  const playingGames = useMemo(() => 
    games.filter(g => g.unlockedCount > 0 && g.percentage < 100)
         .sort((a, b) => b.percentage - a.percentage),
    [games]
  );

  // Jogos platinados
  const platinumGames = useMemo(() => 
    games.filter(g => g.trophyTier === 'platinum')
         .sort((a, b) => b.playtimeForever - a.playtimeForever),
    [games]
  );

  // Todos os jogos (sem limite)
  const allGames = useMemo(() => 
    [...games].sort((a, b) => b.playtimeForever - a.playtimeForever),
    [games]
  );

  const tabs: { id: GameTab; label: string; icon: string; count: number }[] = [
    { id: 'recent', label: 'Mais Jogados', icon: '⏱️', count: recentGames.length },
    { id: 'playing', label: 'Em Progresso', icon: '🎯', count: playingGames.length },
    { id: 'platinum', label: 'Platinados', icon: '🏆', count: platinumGames.length },
    { id: 'all', label: 'Todos', icon: '🎮', count: games.length },
  ];

  const displayGames = activeTab === 'recent' ? recentGames 
    : activeTab === 'playing' ? playingGames 
    : activeTab === 'platinum' ? platinumGames 
    : allGames;

  return (
    <section className="profile-section">
      <div className="profile-section-header" style={{ flexWrap: 'wrap', gap: 12 }}>
        <h3 className="profile-section-title">🎮 Jogos</h3>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Botão Minimizar/Expandir */}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--txt2)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 0.2s',
            }}
            title={isMinimized ? 'Expandir' : 'Minimizar'}
          >
            <span>{isMinimized ? '▶️' : '🔽'}</span>
            <span>{isMinimized ? `${games.length}` : 'Minimizar'}</span>
          </button>
        
          {/* Subabas - só aparecem quando não minimizado */}
          {!isMinimized && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: 'none',
                background: activeTab === tab.id ? 'rgba(58,122,204,0.25)' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab.id ? '#60a5fa' : 'var(--txt2)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              <span style={{ 
                fontSize: 10, 
                padding: '2px 6px', 
                background: 'rgba(0,0,0,0.3)',
                borderRadius: 99 
              }}>
                {tab.count}
              </span>
            </button>
          ))}
          </div>
          )}
        </div>
      </div>

      {/* Conteúdo - só aparece quando não minimizado */}
      {!isMinimized && (<>
      {isLoading ? (
        <div style={{ 
          padding: '40px 20px', 
          textAlign: 'center',
          color: 'var(--txt2)',
        }}>
          <div style={{ 
            fontSize: 32, 
            marginBottom: 16,
            animation: 'spin 1s linear infinite',
          }}>⏳</div>
          <div style={{ fontSize: 14 }}>Carregando jogos...</div>
        </div>
      ) : displayGames.length === 0 ? (
        <Empty icon="🎮" title="Nenhum jogo nesta categoria" />
      ) : (
        <div className="games-grid" style={{ maxHeight: 400, overflowY: 'auto', paddingRight: 8 }}>
          {displayGames.map((g) => (
            <GameCard key={g.appId} game={g} readonly onClick={() => onOpenGame(g.appId)} />
          ))}
        </div>
      )}

      {activeTab !== 'all' && games.length > displayGames.length && (
        <button
          onClick={() => setActiveTab('all')}
          style={{
            marginTop: 12,
            padding: '8px 16px',
            width: '100%',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: 'var(--txt2)',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Ver todos os {games.length} jogos →
        </button>
      )}
      </>)}
      
      {/* Preview quando minimizado */}
      {isMinimized && (
        <div style={{ 
          padding: '12px 16px', 
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
        }} onClick={() => setIsMinimized(false)}>
          <span style={{ fontSize: 20 }}>🎮</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: 'var(--txt1)', fontWeight: 600 }}>
              {games.length} jogos na biblioteca
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt3)' }}>
              Clique para expandir e ver todos os jogos
            </div>
          </div>
          <span style={{ fontSize: 16 }}>▶️</span>
        </div>
      )}
    </section>
  );
};

/** Carousel de Top Games (mais jogados) - similar ao jogados recentemente */
const TopGamesCarousel: React.FC<{
  games: Game[];
  onOpenGame: (appId: number) => void;
}> = ({ games, onOpenGame }) => {
  const topGames = useMemo(() => 
    [...games]
      .sort((a, b) => b.playtimeForever - a.playtimeForever)
      .slice(0, 10),
    [games]
  );

  const formatTime = (minutes: number): string => {
    const hours = Math.round(minutes / 60);
    return hours >= 1000 ? `${(hours / 1000).toFixed(1)}k` : `${hours}h`;
  };

  if (topGames.length === 0) return null;

  return (
    <section className="profile-section">
      <h3 className="profile-section-title">🕐 Mais Jogados</h3>
      <div className="profile-recent-carousel">
        <div className="profile-recent-track">
          {/* Primeiro conjunto */}
          {topGames.map(game => {
            const total = formatTime(game.playtimeForever);
            const pct = Math.round((game.unlockedCount / Math.max(1, game.totalCount)) * 100);
            
            return (
              <div 
                key={`a-${game.appId}`} 
                className="profile-recent-card"
                onClick={() => onOpenGame(game.appId)}
                style={{ cursor: 'pointer' }}
              >
                <div className="profile-recent-art">
                  <img
                    src={game.headerImage}
                    alt={game.name}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                  <div className="profile-recent-art-overlay" />
                </div>
                <div className="profile-recent-info">
                  <div className="profile-recent-name">{game.name}</div>
                  <div className="profile-recent-times">
                    <span className="profile-recent-this-week">
                      {game.trophyTier === 'platinum' ? '🏆 Platina!' : `🔓 ${pct}%`}
                    </span>
                    <span className="profile-recent-total">
                      {total} total
                    </span>
                  </div>
                  <div className="profile-recent-bar-wrap">
                    <div
                      className="profile-recent-bar-fill"
                      style={{
                        width: `${Math.min(100, (game.playtimeForever / (topGames[0]?.playtimeForever ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          {/* Duplicado para loop infinito */}
          {topGames.map(game => {
            const total = formatTime(game.playtimeForever);
            const pct = Math.round((game.unlockedCount / Math.max(1, game.totalCount)) * 100);
            
            return (
              <div 
                key={`b-${game.appId}`} 
                className="profile-recent-card"
                onClick={() => onOpenGame(game.appId)}
                style={{ cursor: 'pointer' }}
              >
                <div className="profile-recent-art">
                  <img
                    src={game.headerImage}
                    alt={game.name}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      img.style.display = 'none';
                    }}
                  />
                  <div className="profile-recent-art-overlay" />
                </div>
                <div className="profile-recent-info">
                  <div className="profile-recent-name">{game.name}</div>
                  <div className="profile-recent-times">
                    <span className="profile-recent-this-week">
                      {game.trophyTier === 'platinum' ? '🏆 Platina!' : `🔓 ${pct}%`}
                    </span>
                    <span className="profile-recent-total">
                      {total} total
                    </span>
                  </div>
                  <div className="profile-recent-bar-wrap">
                    <div
                      className="profile-recent-bar-fill"
                      style={{
                        width: `${Math.min(100, (game.playtimeForever / (topGames[0]?.playtimeForever ?? 1)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

/** Seção de Jogos Platinados com Top 5 Conquistas mais Difíceis */
const PlatinumGamesSection: React.FC<{
  games: Game[];
  onOpenGame: (appId: number) => void;
}> = ({ games, onOpenGame }) => {
  // Jogos platinados (100% completos)
  const platinumGames = useMemo(() => 
    games
      .filter(g => g.trophyTier === 'platinum' || g.percentage === 100)
      .sort((a, b) => b.playtimeForever - a.playtimeForever)
      .slice(0, 3),
    [games]
  );

  const allPlatinumGames = useMemo(() => 
    games
      .filter(g => g.trophyTier === 'platinum' || g.percentage === 100)
      .sort((a, b) => b.playtimeForever - a.playtimeForever),
    [games]
  );

  const [showAllPlatinum, setShowAllPlatinum] = useState(false);

  if (platinumGames.length === 0) return null;

  return (
    <section className="profile-section">
      <div className="profile-section-header">
        <h3 className="profile-section-title" style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>
          💎 Jogos Perfeitos
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {platinumGames.map(g => {
          // Top 5 conquistas mais difíceis (menor % global)
          const topAchievements = g.achievements
            ?.filter(a => a.globalPercent != null)
            ?.sort((a, b) => (a.globalPercent || 100) - (b.globalPercent || 100))
            ?.slice(0, 5) || [];

          return (
            <div
              key={g.appId}
              onClick={() => onOpenGame(g.appId)}
              className="perfect-game-banner"
              style={{
                position: 'relative',
                borderRadius: 16,
                overflow: 'hidden',
                cursor: 'pointer',
                minHeight: 180,
              }}
            >
              {/* Background */}
              <div style={{
                position: 'absolute', inset: 0,
                backgroundImage: `url(${g.heroImage})`,
                backgroundSize: 'cover', backgroundPosition: 'center',
                filter: 'brightness(0.4)',
              }} />
              <div className="perfect-game-glow" />

              {/* Conteúdo */}
              <div style={{
                position: 'relative', zIndex: 1,
                padding: '20px 24px',
                display: 'flex', gap: 16, alignItems: 'center',
                minHeight: 200,
              }}>
                <img
                  src={g.headerImage}
                  alt={g.name}
                  style={{
                    width: 120, height: 56,
                    objectFit: 'cover', borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 800, fontSize: 18,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                  }}>
                    {g.name}
                  </div>
                  <div style={{
                    fontSize: 13, color: '#00ffff', marginTop: 6,
                    display: 'flex', alignItems: 'center', gap: 8,
                    textShadow: '0 0 10px rgba(0,255,255,0.5)'
                  }}>
                    <span style={{ fontSize: 16 }}>💎</span>
                    <span>Perfeito · {g.unlockedCount}/{g.totalCount} conquistas · {Math.round(g.playtimeForever / 60)}h jogadas</span>
                  </div>
                  <div style={{ marginTop: 10, maxWidth: 300 }}>
                    <ProgressBar percent={g.percentage} height={6} />
                  </div>
                </div>

                {/* Top 5 conquistas mais difíceis */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {topAchievements.map(ach => (
                      <div
                        key={ach.apiName}
                        title={`${ach.displayName} — ${ach.globalPercent?.toFixed(1)}% dos jogadores`}
                        style={{
                          width: 34, height: 34, borderRadius: 4,
                          border: ach.achieved ? '1px solid #00ffff' : '1px solid var(--txt3)',
                          boxShadow: ach.achieved ? '0 0 6px rgba(0,255,255,0.4)' : 'none',
                          overflow: 'hidden', cursor: 'help',
                        }}
                      >
                        <img
                          src={ach.achieved ? ach.iconUrl : ach.iconGrayUrl}
                          alt={ach.displayName}
                          style={{
                            width: '100%', height: '100%',
                            objectFit: 'cover',
                            opacity: ach.achieved ? 1 : 0.5
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{
                    fontWeight: 900, color: '#00ffff', fontSize: 28,
                    textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5)'
                  }}>
                    100%
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Botão Ver Todos */}
        {allPlatinumGames.length > 3 && (
          <button
            onClick={() => setShowAllPlatinum(true)}
            style={{
              marginTop: 8,
              padding: '12px 24px',
              background: 'rgba(0, 255, 255, 0.1)',
              border: '1px solid rgba(0, 255, 255, 0.3)',
              borderRadius: 8,
              color: '#00ffff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.1)';
            }}
          >
            <span>💎</span>
            Ver todos os {allPlatinumGames.length} jogos perfeitos
            <span>→</span>
          </button>
        )}

        {/* Modal com todos os jogos platinados */}
        {showAllPlatinum && (
          <div
            onClick={() => setShowAllPlatinum(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg1)',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                borderRadius: 16,
                padding: '24px',
                maxWidth: 900,
                width: '100%',
                maxHeight: '85vh',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>
                  💎 Todos os Jogos Perfeitos ({allPlatinumGames.length})
                </h2>
                <button
                  onClick={() => setShowAllPlatinum(false)}
                  style={{ background: 'transparent', border: 'none', fontSize: 24, color: 'var(--txt2)', cursor: 'pointer', padding: '0 8px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {allPlatinumGames.map(g => {
                  const topAchievements = g.achievements
                    ?.filter(a => a.globalPercent != null)
                    ?.sort((a, b) => (a.globalPercent || 100) - (b.globalPercent || 100))
                    ?.slice(0, 5) || [];

                  return (
                    <div
                      key={g.appId}
                      onClick={() => {
                        onOpenGame(g.appId);
                        setShowAllPlatinum(false);
                      }}
                      className="perfect-game-banner"
                      style={{
                        position: 'relative',
                        borderRadius: 16,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        minHeight: 160,
                      }}
                    >
                      {/* Background */}
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${g.heroImage})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: 'brightness(0.4)',
                      }} />
                      <div className="perfect-game-glow" />

                      {/* Conteúdo */}
                      <div style={{
                        position: 'relative', zIndex: 1,
                        padding: '16px 20px',
                        display: 'flex', gap: 16, alignItems: 'center',
                        minHeight: 160,
                      }}>
                        <img
                          src={g.headerImage}
                          alt={g.name}
                          style={{
                            width: 100, height: 48,
                            objectFit: 'cover', borderRadius: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontWeight: 700, fontSize: 16,
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                          }}>
                            {g.name}
                          </div>
                          <div style={{
                            fontSize: 12, color: '#00ffff', marginTop: 4,
                            display: 'flex', alignItems: 'center', gap: 8,
                            textShadow: '0 0 10px rgba(0,255,255,0.5)'
                          }}>
                            <span style={{ fontSize: 14 }}>💎</span>
                            <span>Perfeito · {g.unlockedCount}/{g.totalCount} conquistas · {Math.round(g.playtimeForever / 60)}h jogadas</span>
                          </div>
                          <div style={{ marginTop: 8, maxWidth: 250 }}>
                            <ProgressBar percent={g.percentage} height={4} />
                          </div>
                        </div>

                        {/* Top conquistas */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {topAchievements.slice(0, 4).map(ach => (
                              <div
                                key={ach.apiName}
                                title={`${ach.displayName} — ${ach.globalPercent?.toFixed(1)}% dos jogadores`}
                                style={{
                                  width: 28, height: 28, borderRadius: 4,
                                  border: ach.achieved ? '1px solid #00ffff' : '1px solid var(--txt3)',
                                  boxShadow: ach.achieved ? '0 0 6px rgba(0,255,255,0.4)' : 'none',
                                  overflow: 'hidden', cursor: 'help',
                                }}
                              >
                                <img
                                  src={ach.achieved ? ach.iconUrl : ach.iconGrayUrl}
                                  alt={ach.displayName}
                                  style={{
                                    width: '100%', height: '100%',
                                    objectFit: 'cover',
                                    opacity: ach.achieved ? 1 : 0.5
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <div style={{
                            fontWeight: 900, color: '#00ffff', fontSize: 24,
                            textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5)'
                          }}>
                            100%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const PlayerProfilePage: React.FC = () => {
  // ── Store ─────────────────────────────────────────────────────────────────
  const searchedPlayer = useAppStore((s) => s.searchedPlayer);
  const openSearchGameDetail = useAppStore((s) => s.openSearchGameDetail);
  const setSearchView = useAppStore((s) => s.setSearchView);
  const searchGameFilter = useAppStore((s) => s.searchGameFilter);
  const setSearchGameFilter = useAppStore((s) => s.setSearchGameFilter);
  const filteredGames = useAppStore(selectFilteredSearchGames);

  // ── Background state ─────────────────────────────────────────────────────
  const [background, setBackground] = useState<ProfileBackground | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);


  // ── Fetch background ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!searchedPlayer?.user?.steamId) return;
    
    console.log('[PlayerProfile] Fetching background for:', searchedPlayer.user.steamId);
    
    fetchPlayerBackground(searchedPlayer.user.steamId)
      .then((data) => {
        console.log('[PlayerProfile] Background API response:', data);
        // A API pode retornar os dados em data.profile_background ou diretamente
        const rawData = data as any;
        const profileBg = rawData.profile_background || rawData;
        const bg: ProfileBackground = {
          image_large: profileBg.image_large,
          movie_webm: profileBg.movie_webm,
          movie_mp4: profileBg.movie_mp4,
          movie_webm_small: profileBg.movie_webm_small,
          movie_mp4_small: profileBg.movie_mp4_small,
          name: profileBg.name,
          item_title: profileBg.item_title,
          item_description: profileBg.item_description,
          appid: profileBg.appid,
          communityitemid: profileBg.communityitemid,
        };
        console.log('[PlayerProfile] Parsed background:', bg);
        const hasBg = !!(bg.image_large || bg.movie_webm || bg.movie_mp4);
        console.log('[PlayerProfile] Has background?', hasBg);
        setBackground(hasBg ? bg : null);
        setVideoFailed(false);
      })
      .catch((err) => {
        console.error('[PlayerProfile] Background fetch error:', err);
        setBackground(null);
      });
  }, [searchedPlayer?.user?.steamId]);

  // ── Friends state ──────────────────────────────────────────────────────────
  const [friends, setFriends] = useState<PlayerFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);

  // Fetch friends when profile loads
  useEffect(() => {
    if (!searchedPlayer?.user?.steamId) return;
    setFriendsLoading(true);
    fetchPlayerFriends(searchedPlayer.user.steamId)
      .then((data) => {
        setFriends(data);
        console.log('[PlayerProfile] Friends loaded:', data.length);
      })
      .catch((err) => {
        console.error('[PlayerProfile] Failed to load friends:', err);
        setFriends([]);
      })
      .finally(() => setFriendsLoading(false));
  }, [searchedPlayer?.user?.steamId]);

  // ── Early-exit guards ─────────────────────────────────────────────────────
  if (!searchedPlayer) return null;
  const { user, games } = searchedPlayer;
  console.log('[PlayerProfile] Total games:', games?.length, 'gamesLoaded:', searchedPlayer.gamesLoaded);

  // ── Sync state ─────────────────────────────────────────────────────────────
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);

  // ── Handle friend click (search on site) ───────────────────────────────────
  const handleFriendClick = useCallback((friend: PlayerFriend) => {
    // Navigate to search view with this friend
    setSearchView('home');
    // Store the friend data temporarily and trigger search
    setTimeout(() => {
      const event = new CustomEvent('searchPlayer', { detail: { steamId: friend.steamId, personaName: friend.personaName } });
      window.dispatchEvent(event);
    }, 100);
  }, [setSearchView]);

  const handleSyncToLeaderboard = useCallback(async () => {
    if (!user || games.length === 0 || syncing) return;
    setSyncing(true);
    try {
      const totalAch = games.reduce((s, g) => s + g.unlockedCount, 0);
      const platCount = games.filter(g => g.trophyTier === 'platinum').length;
      const rareCount = games.reduce((sum, g) =>
        sum + g.achievements.filter(a => a.achieved && (a.globalPercent ?? 101) <= 5).length, 0);
      await syncPlayerToLeaderboard(user.steamId, {
        totalAch,
        platCount,
        rareCount,
        gameCount: games.length,
        personaName: user.personaName,
        avatarUrl: user.avatarUrl,
        profileUrl: user.profileUrl,
      });
      setSynced(true);
    } catch {
      // Silently fail
    } finally {
      setSyncing(false);
    }
  }, [user, games, syncing]);

  // ── Computed stats ────────────────────────────────────────────────────────
  const totalUnlocked = games.reduce((s, g) => s + g.unlockedCount, 0);
  const totalAch = games.reduce((s, g) => s + g.totalCount, 0);
  const pct = totalAch > 0 ? Math.round((totalUnlocked / totalAch) * 100) : 0;
  const platCount = games.filter((g) => g.trophyTier === 'platinum').length;

  // ── Hero banner: jogo mais jogado ─────────────────────────────────────────
  const heroGame = useMemo(() => {
    const sorted = [...games].sort((a, b) => b.playtimeForever - a.playtimeForever);
    console.log('[PlayerProfile] Top game:', sorted[0]?.name, 'heroImage:', sorted[0]?.heroImage, 'headerImage:', sorted[0]?.headerImage);
    return sorted[0];
  }, [games]);
  const bannerUrl = heroGame?.heroImage || heroGame?.headerImage;
  console.log('[PlayerProfile] Banner URL:', bannerUrl);

  // ── Conquistas recentes ───────────────────────────────────────────────────
  const recentAchs = useMemo<AchWithGame[]>(() => {
    const all: AchWithGame[] = [];
    for (const g of games) {
      for (const a of g.achievements) {
        if (a.achieved && a.unlockTime && a.unlockTime > 0) {
          all.push({ ...a, gameName: g.name, appId: g.appId });
        }
      }
    }
    return all.sort((a, b) => (b.unlockTime ?? 0) - (a.unlockTime ?? 0)).slice(0, 9);
  }, [games]);

  // ── Conquistas raras ──────────────────────────────────────────────────────
  const rarestAchs = useMemo<AchWithGame[]>(() => {
    const all: AchWithGame[] = [];
    for (const g of games) {
      for (const a of g.achievements) {
        if (a.achieved && a.globalPercent != null && a.globalPercent <= 5) {
          all.push({ ...a, gameName: g.name, appId: g.appId });
        }
      }
    }
    return all.sort((a, b) => (a.globalPercent ?? 0) - (b.globalPercent ?? 0)).slice(0, 6);
  }, [games]);

  // ── Top jogos ─────────────────────────────────────────────────────────────
  const topGames = useMemo(
    () => [...games].filter((g) => g.totalCount > 0).sort((a, b) => b.percentage - a.percentage).slice(0, 5),
    [games]
  );

  // ── Handlers ─────────────────────────────────────────────────────────────
  const openGame = useCallback(
    (appId: number) => {
      openSearchGameDetail(appId);
      setSearchView('game');
    },
    [openSearchGameDetail, setSearchView]
  );

  // ── Filtros ───────────────────────────────────────────────────────────────
  const GAME_FILTERS: { value: GameFilter; label: string }[] = [
    { value: 'all', label: 'Todos' },
    { value: 'started', label: 'Em Progresso' },
    { value: 'platinum', label: 'Platinados' },
  ];

  // ── Background URLs ───────────────────────────────────────────────────────
  const hasVideo = !!(background?.movie_webm || background?.movie_mp4) && !videoFailed;
  const hasImage = !!background?.image_large;
  const bgUrl = hasImage ? bgImageUrl(background!.image_large!) : null;
  const videoWebm = background?.movie_webm ? bgVideoUrl(background.movie_webm) : null;
  const videoMp4 = background?.movie_mp4 ? bgVideoUrl(background.movie_mp4) : null;

  // ═══════════════════════════════════════════════════════════════════════════
  //  RENDER — Mesmo padrão visual do ProfileView.tsx
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div id="view-profile" style={{ position: 'relative', minHeight: '100vh' }}>
      {/* ═══════════════════════════════════════════════════════════════════
          STEAM PROFILE BACKGROUND (igual ao ProfileView)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="profile-bg-container">
        {hasVideo ? (
          <video
            className="profile-bg-video"
            autoPlay
            loop
            muted
            playsInline
            poster={hasImage && bgUrl ? bgUrl : undefined}
            onError={() => setVideoFailed(true)}
          >
            {videoWebm && <source src={videoWebm} type="video/webm" />}
            {videoMp4 && <source src={videoMp4} type="video/mp4" />}
          </video>
        ) : hasImage ? (
          <img className="profile-bg-image" src={bgUrl!} alt="" />
        ) : bannerUrl ? (
          <img className="profile-bg-image" src={bannerUrl} alt="" style={{ filter: 'brightness(0.5)' }} />
        ) : (
          <div className="profile-bg-fallback" />
        )}
        {background?.item_title && (
          <div className="profile-bg-label">🎨 {background.item_title}</div>
        )}
      </div>

      <div className="profile-container profile-content">
        {/* ── Botão Voltar ─────────────────────────────────────────────────── */}
        <button className="detail-back pp-back" onClick={() => setSearchView('home')}>
          ← Voltar à Busca
        </button>

        {/* ═══════════════════════════════════════════════════════════════════
            USER BANNER (mesma estrutura do ProfileView)
            ═══════════════════════════════════════════════════════════════ */}
        <div className="profile-user-banner" style={{ marginTop: -44 }}>
          {/* Background do jogo mais jogado */}
          {bannerUrl && (
            <div
              className="profile-user-banner-bg"
              style={{ backgroundImage: `url(${bannerUrl})`, filter: 'brightness(1)' }}
            />
          )}
          <div className="profile-user-banner-overlay" style={{ background: 'linear-gradient(135deg, rgba(10,18,30,0.6) 0%, rgba(10,18,30,0.4) 50%, rgba(10,18,30,0.5) 100%)' }} />

          {/* Avatar + identidade */}
          <div className="profile-user-identity">
            <div className="profile-avatar-wrap">
              <Avatar src={user.avatarUrl} size={88} />
              <div className="profile-avatar-halo" />
            </div>
            <div>
              <h1 className="profile-username">{user.personaName}</h1>
              {user.realName && <div className="profile-realname">{user.realName}</div>}
              <div className="profile-steamid">{user.steamId}</div>
              <a
                href={user.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-steam-link"
              >
                Ver no Steam ↗
              </a>
              <button
                onClick={handleSyncToLeaderboard}
                disabled={syncing || synced || games.length === 0}
                style={{
                  marginTop: 8,
                  padding: '6px 14px',
                  background: synced ? 'rgba(34,197,94,0.15)' : 'rgba(58,122,204,0.15)',
                  border: `1px solid ${synced ? 'rgba(34,197,94,0.3)' : 'rgba(58,122,204,0.3)'}`,
                  borderRadius: 6,
                  color: synced ? '#22c55e' : '#60a5fa',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: syncing || synced ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: syncing || synced ? 0.8 : 1,
                }}
              >
                {syncing ? '⏳' : synced ? '✓' : '🏆'} {' '}
                {syncing ? 'Sincronizando...' : synced ? 'Sincronizado!' : 'Sincronizar no Leaderboard'}
              </button>
            </div>
          </div>

          {/* Stats rápidos (igual ao ProfileView) */}
          <div className="profile-level-badge">
            <div className="profile-level-num">{games.length}</div>
            <div className="profile-level-title">🎮 Jogos</div>
            <div className="profile-level-xp">{totalUnlocked.toLocaleString('pt-BR')} Conquistas</div>
            <div className="profile-level-bar-wrap">
              <div className="profile-level-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="profile-level-next">{pct}% Conclusão</div>
          </div>
        </div>

      {/* ── Stats Row (igual ao ProfileView) ─────────────────────────────── */}
      <div className="profile-stats-row">
        {[
          { icon: '🏆', label: 'Conquistas', value: `${totalUnlocked}/${totalAch}`, color: 'var(--accent)' },
          { icon: '📊', label: '% Global', value: `${pct}%`, color: 'var(--accent)' },
          { icon: '✦', label: 'Platinas', value: String(platCount), color: 'var(--plat, #e5e4e2)' },
          { icon: '🎮', label: 'Jogos', value: String(games.length), color: '#fff' },
          { icon: '⭐', label: 'Horas Totais', value: formatPlaytime(games.reduce((sum, g) => sum + (g.playtimeForever || 0), 0)), color: '#fbbf24' },
        ].map((s) => (
          <div key={s.label} className="profile-stat-card">
            <div className="profile-stat-icon">{s.icon}</div>
            <div className="profile-stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="profile-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CAROUSEL: TOP GAMES (mais jogados - similar a recentes)
          ═══════════════════════════════════════════════════════════════ */}
      <TopGamesCarousel games={games} onOpenGame={openGame} />

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO: JOGOS PLATINADOS COM 5 CONQUISTAS MAIS DIFÍCEIS
          ═══════════════════════════════════════════════════════════════ */}
      <PlatinumGamesSection games={games} onOpenGame={openGame} />

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO: JOGOS COM SUBABAS
          ═══════════════════════════════════════════════════════════════ */}
      <PlayerGamesSection 
        games={games} 
        onOpenGame={openGame}
        isLoading={!searchedPlayer.gamesLoaded}
      />

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO: ESTATÍSTICAS (Duas colunas: Recentes + Raras/Melhores)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="profile-section">
        <h3 className="profile-section-title">📊 Estatísticas</h3>

        <div className="pp-two-col" style={{ marginTop: 16 }}>
          {/* LEFT — Conquistas Recentes */}
          <div className="pp-section">
            <h4 className="pp-section-title">⏱ Conquistas Recentes</h4>
            {recentAchs.length === 0 ? (
              <Empty icon="🏅" title="Nenhuma conquista recente" />
            ) : (
              <div className="pp-recent-list">
                {recentAchs.map((a) => <RecentAchRow key={`${a.appId}-${a.apiName}`} ach={a} />)}
              </div>
            )}
          </div>

          {/* RIGHT — Raras + Melhores */}
          <div className="pp-right-col">
            {rarestAchs.length > 0 && (
              <div className="pp-section">
                <h4 className="pp-section-title">💎 Conquistas Raras</h4>
                <div className="pp-rare-list">
                  {rarestAchs.map((a) => <RareAchRow key={`${a.appId}-${a.apiName}`} ach={a} />)}
                </div>
              </div>
            )}

            <div className="pp-section">
              <h4 className="pp-section-title">🏅 Melhores Jogos</h4>
              {topGames.length === 0 ? (
                <Empty icon="🎮" title="Nenhum jogo com conquistas" />
              ) : (
                <div className="pp-top-games">
                  {topGames.map((g) => (
                    <div
                      key={g.appId}
                      className="pp-top-game-row"
                      role="button"
                      tabIndex={0}
                      onClick={() => openGame(g.appId)}
                      title={`${g.name} — ${g.percentage}%`}
                    >
                      <img className="pp-top-game-img" src={g.headerImage} alt={g.name} />
                      <div className="pp-top-game-info">
                        <div className="pp-top-game-name">{g.name}</div>
                        <ProgressBar percent={g.percentage} height={4} />
                      </div>
                      <span className="pp-top-game-pct">{g.percentage}%</span>
                      {g.trophyTier === 'platinum' && <div className="pp-top-game-trophy">🏆</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO: AMIGOS (scrollable list)
          ═══════════════════════════════════════════════════════════════ */}
      <section className="profile-section">
        <h3 className="profile-section-title">👥 Amigos Steam</h3>
        
        {friendsLoading ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--txt2)' }}>
            ⏳ Carregando amigos...
          </div>
        ) : friends.length === 0 ? (
          <Empty icon="👥" title="Nenhum amigo encontrado" />
        ) : (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 12 }}>
              {friends.length} amigo{friends.length !== 1 ? 's' : ''} encontrado{friends.length !== 1 ? 's' : ''}
              {friends.some(f => f.totalAch != null) && ' · Alguns sincronizados no leaderboard'}
            </div>
            <div 
              className="pp-friends-list"
              style={{
                maxHeight: 320,
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: 12,
                padding: 4,
              }}
            >
              {friends.map((friend) => (
                <div
                  key={friend.steamId}
                  className="pp-friend-card"
                  onClick={() => handleFriendClick(friend)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 12,
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  title={`Clique para ver o perfil de ${friend.personaName}`}
                >
                  <Avatar src={friend.avatarUrl} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--txt1)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {friend.personaName}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                      {friend.isPrivate ? (
                        <span style={{ color: '#f87171' }}>🔒 Privado</span>
                      ) : friend.totalAch != null ? (
                        <span style={{ color: '#60a5fa' }}>
                          🏆 {friend.totalAch?.toLocaleString('pt-BR')} conquistas
                          {friend.platCount ? ` · ${friend.platCount}⭐` : ''}
                        </span>
                      ) : (
                        <span>Não sincronizado</span>
                      )}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--txt3)' }}>→</span>
                </div>
              ))}
            </div>
            {friends.length > 6 && (
              <div style={{ fontSize: 11, color: 'var(--txt3)', textAlign: 'center', marginTop: 8 }}>
                Role para ver mais amigos ↓
              </div>
            )}
          </div>
        )}
      </section>
    </div>
    </div>
  );
};

export default PlayerProfilePage;
