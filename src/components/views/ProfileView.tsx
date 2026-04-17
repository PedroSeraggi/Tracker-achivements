import React, { useMemo } from 'react';
import { useAppStore, selectGlobalStats } from '../../store/useAppStore';
import { Avatar, ProgressBar, Empty } from '../ui';
import { useProfileData, bgImageUrl, bgVideoUrl, gameIconUrl, formatPlaytime } from '../../hooks/useProfileData';
import type { Game, Achievement, FeaturedType, FeaturedCard, FeaturedSection } from '../../types';

// ─── Card Utils (mesmo cálculo do duelo) ────────────────────────────────────

type RarityName = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

function calcCardDamage(globalPercent: number): number {
  return Math.round((100 - Math.min(100, Math.max(0, globalPercent))) * 10);
}

function getCardRarity(damage: number): { name: RarityName; label: string; emoji: string } {
  if (damage >= 970) return { name: 'mythic',    label: '✦ Mythic',    emoji: '🌟' };
  if (damage >= 850) return { name: 'legendary', label: '★ Legendary', emoji: '🏆' };
  if (damage >= 700) return { name: 'epic',      label: '◆ Epic',      emoji: '💎' };
  if (damage >= 500) return { name: 'rare',      label: '◇ Rare',      emoji: '🔷' };
  if (damage >= 300) return { name: 'uncommon',  label: '○ Uncommon',  emoji: '🟢' };
  return { name: 'common', label: '● Common', emoji: '⚪' };
}

// ─── XP / Level ──────────────────────────────────────────────────────────────

function calcXP(games: Game[]): number {
  return games.reduce((total, g) => {
    const base  = g.unlockedCount * 10;
    const bonus =
      g.trophyTier === 'platinum' ? 500 :
      g.trophyTier === 'gold'     ? 150 :
      g.trophyTier === 'silver'   ? 50  :
      g.trophyTier === 'bronze'   ? 15  : 0;
    return total + base + bonus;
  }, 0);
}

const LEVELS = [
  { min: 0,       title: '🎮 Iniciante',           label: 'Nível 1'  },
  { min: 500,     title: '🕹 Jogador',              label: 'Nível 2'  },
  { min: 1500,    title: '⚔️ Aventureiro',          label: 'Nível 3'  },
  { min: 3500,    title: '🏅 Veterano',             label: 'Nível 4'  },
  { min: 7000,    title: '🥇 Caçador',              label: 'Nível 5'  },
  { min: 12000,   title: '💎 Elite',                label: 'Nível 6'  },
  { min: 20000,   title: '👑 Mestre',               label: 'Nível 7'  },
  { min: 30000,   title: '🌟 Lendário',             label: 'Nível 8'  },
  { min: 50000,   title: '✦ Platina Supremo',       label: 'Nível 9'  },
  { min: 75000,   title: '🔥 Imortal',              label: 'Nível 10' },
  { min: 100000,  title: '⚡ Titã',                 label: 'Nível 11' },
  { min: 150000,  title: '👁️ Celestial',            label: 'Nível 12' },
  { min: 250000,  title: '🌌 Cósmico',              label: 'Nível 13' },
  { min: 500000,  title: '💫 Conquistador Divino!', label: 'Nível 14' },
];

function getLevel(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.min) current = lvl;
  }
  const idx  = LEVELS.indexOf(current);
  const next = LEVELS[idx + 1];
  const pct  = next
    ? Math.min(100, Math.round(((xp - current.min) / (next.min - current.min)) * 100))
    : 100;
  return { ...current, nextMin: next?.min, pct };
}

// ─── Featured Section Component (para múltiplas seções) ────────────────────────

interface FeaturedSectionComponentProps {
  section: FeaturedSection;
  games: Game[];
  updateFeaturedSectionTitle: (id: string, title: string) => void;
  removeFeaturedSection: (id: string) => void;
  addFeaturedGameToSection: (sectionId: string, appId: number) => void;
  removeFeaturedGameFromSection: (sectionId: string, appId: number) => void;
  addFeaturedAchievementToSection: (sectionId: string, gameAppId: number, apiName: string) => void;
  removeFeaturedAchievementFromSection: (sectionId: string, gameAppId: number, apiName: string) => void;
  addFeaturedCardToSection: (sectionId: string, card: FeaturedCard) => void;
  removeFeaturedCardFromSection: (sectionId: string, gameAppId: number, apiName: string) => void;
  openGameDetail: (appId: number) => void;
  availableGames: Game[];
  gamesWithAchievements: Game[];
  calcCardDamage: (globalPercent: number) => number;
  getCardRarity: (damage: number) => { name: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'; label: string; emoji: string };
}

const FeaturedSectionComponent: React.FC<FeaturedSectionComponentProps> = ({
  section,
  games,
  updateFeaturedSectionTitle,
  removeFeaturedSection,
  addFeaturedGameToSection,
  removeFeaturedGameFromSection,
  addFeaturedAchievementToSection,
  removeFeaturedAchievementFromSection,
  addFeaturedCardToSection,
  removeFeaturedCardFromSection,
  openGameDetail,
  availableGames,
  gamesWithAchievements,
  calcCardDamage,
  getCardRarity,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [selectedGameId, setSelectedGameId] = React.useState<number | null>(null);
  const [newTitle, setNewTitle] = React.useState(section.title);

  const icon = section.type === 'games' ? '🎮' : section.type === 'achievements' ? '🏆' : '⚔️';

  // Derived data
  const featuredGames = React.useMemo(() => {
    if (section.type !== 'games') return [];
    return (section.gameIds || [])
      .map((id: number) => games.find((g: Game) => g.appId === id))
      .filter((g): g is Game => g !== undefined);
  }, [games, section]);

  const featuredAchievements = React.useMemo(() => {
    if (section.type !== 'achievements') return [];
    return (section.achievements || [])
      .map((ref: { gameAppId: number; apiName: string }) => {
        const game = games.find((g: Game) => g.appId === ref.gameAppId);
        const achievement = game?.achievements.find((a: Achievement) => a.apiName === ref.apiName);
        if (!game || !achievement) return null;
        return { game, achievement };
      })
      .filter((item): item is { game: Game; achievement: Achievement } => item !== null);
  }, [games, section]);

  const featuredCards = React.useMemo(() => {
    if (section.type !== 'cards') return [];
    return section.cards || [];
  }, [section]);

  return (
    <section className="profile-section">
      <div className="profile-section-header">
        {isEditing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
            <span>{icon}</span>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateFeaturedSectionTitle(section.id, newTitle);
                  setIsEditing(false);
                }
                if (e.key === 'Escape') {
                  setNewTitle(section.title);
                  setIsEditing(false);
                }
              }}
              autoFocus
              style={{
                background: 'transparent',
                border: '1px solid var(--accent)',
                borderRadius: 4,
                padding: '4px 8px',
                color: '#fff',
                fontSize: 16,
                fontWeight: 700,
                flex: 1,
                maxWidth: 300,
              }}
            />
          </div>
        ) : (
          <h3
            className="profile-section-title"
            onClick={() => setIsEditing(true)}
            style={{ cursor: 'pointer' }}
            title="Clique para editar título"
          >
            {icon} {section.title}
          </h3>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className={`profile-edit-btn${isEditing ? ' active' : ''}`}
            onClick={() => setIsEditing(v => !v)}
          >
            {isEditing ? '✓ Concluir' : '⚙️ Editar'}
          </button>
          <button
            className="profile-edit-btn"
            onClick={() => removeFeaturedSection(section.id)}
            style={{ color: '#ff6b6b' }}
            title="Remover seção"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Conteúdo baseado no tipo */}
      {section.type === 'games' && (
        <>
          {featuredGames.length === 0 && !isEditing ? (
            <div className="profile-featured-empty">
              Nenhum jogo nesta seção. Clique em "Editar" para adicionar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {featuredGames.map((g: Game) => (
                <div
                  key={g.appId}
                  className="profile-featured-row"
                  onClick={() => !isEditing && openGameDetail(g.appId)}
                  style={{ cursor: isEditing ? 'default' : 'pointer' }}
                >
                  <img src={g.headerImage} alt={g.name}
                       style={{ width: 80, height: 37, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                      {g.unlockedCount}/{g.totalCount} conquistas · {Math.round(g.playtimeForever / 60)}h
                    </div>
                    <ProgressBar percent={g.percentage} height={4} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 900, color: 'var(--accent)', fontSize: 18 }}>
                      {g.percentage}%
                    </div>
                    {isEditing && (
                      <button
                        className="profile-star-btn"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          removeFeaturedGameFromSection(section.id, g.appId);
                        }}
                        style={{ color: 'var(--gold)' }}
                      >
                        ★
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {isEditing && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>
                Clique para adicionar ({featuredGames.length}/6)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                {availableGames.map((g: Game) => (
                  <div
                    key={g.appId}
                    className="profile-pick-row"
                    onClick={() => {
                      const gameIds = section.gameIds || [];
                      gameIds.includes(g.appId)
                        ? removeFeaturedGameFromSection(section.id, g.appId)
                        : gameIds.length < 6 && addFeaturedGameToSection(section.id, g.appId);
                    }}
                    style={{ borderColor: (section.gameIds || []).includes(g.appId) ? 'var(--gold)' : 'transparent' }}
                  >
                    <img src={g.headerImage} alt={g.name}
                         style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                    <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{g.percentage}%</div>
                    <div style={{ color: (section.gameIds || []).includes(g.appId) ? 'var(--gold)' : 'var(--txt3)' }}>
                      {(section.gameIds || []).includes(g.appId) ? '★' : '☆'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {section.type === 'achievements' && (
        <>
          {featuredAchievements.length === 0 && !isEditing ? (
            <div className="profile-featured-empty">
              Nenhuma conquista nesta seção. Clique em "Editar" para adicionar.
            </div>
          ) : (
            <div className="profile-featured-achievements">
              {featuredAchievements.map(({ game, achievement }: { game: Game; achievement: Achievement }) => (
                <div
                  key={`${game.appId}-${achievement.apiName}`}
                  className="profile-featured-achievement"
                  onClick={() => !isEditing && openGameDetail(game.appId)}
                >
                  <img src={achievement.iconUrl} alt={achievement.displayName} className="profile-featured-ach-icon" />
                  <div className="profile-featured-ach-info">
                    <div className="profile-featured-ach-name">{achievement.displayName}</div>
                    <div className="profile-featured-ach-game">{game.name}</div>
                    {achievement.globalPercent && (
                      <div className="profile-featured-ach-rarity">
                        {achievement.globalPercent.toFixed(1)}% dos jogadores
                      </div>
                    )}
                  </div>
                  {isEditing && (
                    <button
                      className="profile-star-btn"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        removeFeaturedAchievementFromSection(section.id, game.appId, achievement.apiName);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {isEditing && (
            <div style={{ marginTop: 20 }}>
              {!selectedGameId ? (
                <>
                  <h4 style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>
                    Escolha um jogo ({featuredAchievements.length}/6 conquistas)
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {gamesWithAchievements.map((g: Game) => (
                      <div
                        key={g.appId}
                        className="profile-pick-row"
                        onClick={() => setSelectedGameId(g.appId)}
                      >
                        <img src={g.headerImage} alt={g.name}
                             style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                        <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                          {g.achievements.filter((a: Achievement) => a.achieved).length} conquistas
                        </div>
                        <div style={{ color: 'var(--txt3)' }}>→</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer' }}
                    >
                      ← Voltar
                    </button>
                    <h4 style={{ fontSize: 12, color: 'var(--txt3)', margin: 0 }}>
                      Escolha conquistas desbloqueadas
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {(() => {
                      const game = games.find((g: Game) => g.appId === selectedGameId);
                      if (!game) return null;
                      return game.achievements
                        .filter((a: Achievement) => a.achieved)
                        .sort((a: Achievement, b: Achievement) => (a.globalPercent || 100) - (b.globalPercent || 100))
                        .map((a: Achievement) => {
                          const isSelected = (section.achievements || []).some(
                            (fa: { gameAppId: number; apiName: string }) => fa.gameAppId === game.appId && fa.apiName === a.apiName
                          );
                          return (
                            <div
                              key={a.apiName}
                              className="profile-pick-row"
                              onClick={() => {
                                isSelected
                                  ? removeFeaturedAchievementFromSection(section.id, game.appId, a.apiName)
                                  : (section.achievements || []).length < 6 && addFeaturedAchievementToSection(section.id, game.appId, a.apiName);
                              }}
                              style={{ borderColor: isSelected ? 'var(--gold)' : 'transparent' }}
                            >
                              <img src={a.iconUrl} alt={a.displayName}
                                   style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{a.displayName}</div>
                              {a.globalPercent && (
                                <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                                  {a.globalPercent.toFixed(1)}%
                                </div>
                              )}
                              <div style={{ color: isSelected ? 'var(--gold)' : 'var(--txt3)' }}>
                                {isSelected ? '★' : '☆'}
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {section.type === 'cards' && (
        <>
          {featuredCards.length === 0 && !isEditing ? (
            <div className="profile-featured-empty">
              Nenhuma carta nesta seção. Clique em "Editar" para adicionar.
            </div>
          ) : (
            <div className="profile-featured-cards">
              {featuredCards.map((card: FeaturedCard) => {
                const damage = card.damage || 0;
                const rarity = getCardRarity(damage);
                const game = games.find((g: Game) => g.appId === card.gameAppId);
                return (
                  <div
                    key={`${card.gameAppId}-${card.apiName}`}
                    className="profile-featured-card"
                    data-rarity={rarity.name}
                  >
                    <div className="profile-featured-card-inner">
                      <div className="profile-featured-card-art">
                        <div
                          className="profile-featured-card-art-bg"
                          style={{ backgroundImage: `url(${game?.headerImage || ''})` }}
                        />
                        <img src={card.iconUrl || ''} alt={card.name || 'Carta'} className="profile-featured-card-icon" />
                        <div className="profile-featured-card-rarity-badge">{rarity.label}</div>
                      </div>
                      <div className="profile-featured-card-body">
                        <div className="profile-featured-card-name">{card.name || 'Carta'}</div>
                        <div className="profile-featured-card-game">{game?.name || 'Desconhecido'}</div>
                      </div>
                      <div className="profile-featured-card-footer">
                        <div className="profile-featured-card-damage-block">
                          <span className="profile-featured-card-damage-icon">⚔️</span>
                          <span className="profile-featured-card-damage-value">{damage}</span>
                        </div>
                      </div>
                    </div>
                    {isEditing && (
                      <button
                        className="profile-star-btn"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation();
                          removeFeaturedCardFromSection(section.id, card.gameAppId, card.apiName);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {isEditing && (
            <div style={{ marginTop: 20 }}>
              <h4 style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>
                Selecione conquistas para virar cartas ({featuredCards.length}/6)
              </h4>
              {!selectedGameId ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {gamesWithAchievements.map((g: Game) => (
                    <div
                      key={g.appId}
                      className="profile-pick-row"
                      onClick={() => setSelectedGameId(g.appId)}
                    >
                      <img src={g.headerImage} alt={g.name}
                           style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
                        {g.achievements.filter((a: Achievement) => a.achieved).length} conquistas
                      </div>
                      <div style={{ color: 'var(--txt3)' }}>→</div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <button
                      onClick={() => setSelectedGameId(null)}
                      style={{ background: 'none', border: 'none', color: 'var(--txt2)', cursor: 'pointer' }}
                    >
                      ← Voltar
                    </button>
                    <h4 style={{ fontSize: 12, color: 'var(--txt3)', margin: 0 }}>
                      Clique para adicionar como carta
                    </h4>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                    {(() => {
                      const game = games.find((g: Game) => g.appId === selectedGameId);
                      if (!game) return null;
                      return game.achievements
                        .filter((a: Achievement) => a.achieved)
                        .sort((a: Achievement, b: Achievement) => (a.globalPercent || 100) - (b.globalPercent || 100))
                        .map((a: Achievement) => {
                          const isSelected = (section.cards || []).some(
                            (fc: FeaturedCard) => fc.gameAppId === game.appId && fc.apiName === a.apiName
                          );
                          const damage = calcCardDamage(a.globalPercent || 50);
                          const rarity = getCardRarity(damage);
                          return (
                            <div
                              key={a.apiName}
                              className="profile-pick-row"
                              onClick={() => {
                                if (isSelected) {
                                  removeFeaturedCardFromSection(section.id, game.appId, a.apiName);
                                } else if ((section.cards || []).length < 6) {
                                  const newCard: FeaturedCard = {
                                    gameAppId: game.appId,
                                    apiName: a.apiName,
                                    name: a.displayName,
                                    iconUrl: a.iconUrl,
                                    damage,
                                    rarity: rarity.name,
                                  };
                                  addFeaturedCardToSection(section.id, newCard);
                                }
                              }}
                              style={{ borderColor: isSelected ? 'var(--accent)' : 'transparent' }}
                            >
                              <img src={a.iconUrl} alt={a.displayName}
                                   style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.displayName}</div>
                                <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                                  ⚔️ {damage} · {rarity.label}
                                </div>
                              </div>
                              {a.globalPercent && (
                                <div style={{ fontSize: 11, color: 'var(--txt2)' }}>
                                  {a.globalPercent.toFixed(1)}%
                                </div>
                              )}
                              <div style={{ color: isSelected ? 'var(--accent)' : 'var(--txt3)' }}>
                                {isSelected ? '✓' : '+'}
                              </div>
                            </div>
                          );
                        });
                    })()}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};

// ─── Main Profile View Component ─────────────────────────────────────────────

const ProfileView: React.FC = () => {
  const games           = useAppStore((s) => s.games);
  const currentUser     = useAppStore((s) => s.currentUser);
  const openGameDetail  = useAppStore((s) => s.openGameDetail);
  const { totalUnlocked, totalAch, platCount, pct } = useAppStore(selectGlobalStats);

  const featuredSections = useAppStore((s) => s.featuredSections);
  const addFeaturedSection = useAppStore((s) => s.addFeaturedSection);
  const removeFeaturedSection = useAppStore((s) => s.removeFeaturedSection);
  const updateFeaturedSectionTitle = useAppStore((s) => s.updateFeaturedSectionTitle);
  const addFeaturedGameToSection = useAppStore((s) => s.addFeaturedGameToSection);
  const removeFeaturedGameFromSection = useAppStore((s) => s.removeFeaturedGameFromSection);
  const addFeaturedAchievementToSection = useAppStore((s) => s.addFeaturedAchievementToSection);
  const removeFeaturedAchievementFromSection = useAppStore((s) => s.removeFeaturedAchievementFromSection);
  const addFeaturedCardToSection = useAppStore((s) => s.addFeaturedCardToSection);
  const removeFeaturedCardFromSection = useAppStore((s) => s.removeFeaturedCardFromSection);
  const clearFeaturedSections = useAppStore((s) => s.clearFeaturedSections);
  const perfectGameIds = useAppStore((s) => s.perfectGameIds);
  const addPerfectGame = useAppStore((s) => s.addPerfectGame);
  const removePerfectGame = useAppStore((s) => s.removePerfectGame);
  const profileBannerGameId = useAppStore((s) => s.profileBannerGameId);
  const setProfileBannerGame = useAppStore((s) => s.setProfileBannerGame);

  const [showTypeSelector, setShowTypeSelector] = React.useState(false);
  const [selectingPerfect, setSelectingPerfect] = React.useState(false);
  const [selectingBanner, setSelectingBanner] = React.useState(false);
  const [showLevelsModal,   setShowLevelsModal]   = React.useState(false);
  const [videoFailed, setVideoFailed] = React.useState(false);

  // Contadores para limite de 3 de cada tipo
  const gamesSectionCount = featuredSections.filter((s) => s.type === 'games').length;
  const achievementsSectionCount = featuredSections.filter((s) => s.type === 'achievements').length;
  const cardsSectionCount = featuredSections.filter((s) => s.type === 'cards').length;

  // ── New Steam profile data ──────────────────────────────────────────────
  const { background, recentGames, loadingBg, loadingRecent } = useProfileData();

  // Reset video failed state when background changes
  React.useEffect(() => {
    setVideoFailed(false);
  }, [background?.communityitemid]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const xp    = useMemo(() => calcXP(games), [games]);
  const level = useMemo(() => getLevel(xp), [xp]);

  const availableGames = useMemo(
    () => games.filter((g: Game) => g.unlockedCount > 0).sort((a, b) => b.percentage - a.percentage),
    [games],
  );

  const gamesWithAchievements = useMemo(
    () => games.filter((g: Game) => g.achievements.some((a: Achievement) => a.achieved)),
    [games],
  );

  if (!currentUser) return <Empty icon="👤" title="Usuário não carregado" />;

  // ── Background URLs ───────────────────────────────────────────────────────
  const hasVideo = !!(background?.movie_webm || background?.movie_mp4);
  const hasImage = !!background?.image_large;

  // Debug: log URLs
  const bgUrl = hasImage ? bgImageUrl(background!.image_large!) : null;
  const videoWebm = background?.movie_webm ? bgVideoUrl(background.movie_webm) : null;
  const videoMp4 = background?.movie_mp4 ? bgVideoUrl(background.movie_mp4) : null;
  console.log('[Profile] Background URL:', bgUrl, 'hasVideo:', hasVideo, 'hasImage:', hasImage);
  console.log('[Profile] Video URLs:', { webm: videoWebm, mp4: videoMp4 });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div id="view-profile" style={{ position: 'relative', minHeight: '100vh' }}>

      {/* ═══════════════════════════════════════════════════════════════════
          STEAM PROFILE BACKGROUND
          Video se disponível (animado), imagem estática como fallback.
          Fica fixo atrás do conteúdo, com gradiente escuro por cima.
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="profile-bg-container">
        {/* Gradient overlay — garante legibilidade do conteúdo */}
        <div className="profile-bg-overlay" />

        {hasVideo && !videoFailed ? (
          // Vídeo animado — loop, sem som, sem controles
          <video
            className="profile-bg-video"
            autoPlay
            loop
            muted
            playsInline
            poster={hasImage ? bgImageUrl(background!.image_large!) : undefined}
            onError={(e) => {
              console.error('[Profile] Video failed, falling back to image:', e);
              setVideoFailed(true);
            }}
            onLoadedData={() => console.log('[Profile] Video loaded successfully')}
          >
            {background?.movie_webm  && <source src={bgVideoUrl(background.movie_webm)}  type="video/webm" />}
            {background?.movie_mp4   && <source src={bgVideoUrl(background.movie_mp4)}   type="video/mp4"  />}
          </video>
        ) : hasImage ? (
          // Imagem estática
          (console.log('[Profile] Rendering image fallback:', bgImageUrl(background!.image_large!)),
          <img
            className="profile-bg-image"
            src={bgImageUrl(background!.image_large!)}
            alt=""
            onError={(e) => console.error('[Profile] Image failed to load:', e)}
          />)
        ) : (
          // Fallback: gradiente escuro padrão
          (console.log('[Profile] Rendering gradient fallback'),
          <div className="profile-bg-fallback" />)
        )}

        {/* Nome do background — exibido discretamente */}
        {background?.item_title && (
          <div className="profile-bg-label">
            🎨 {background.item_title}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTEÚDO DO PERFIL (sobre o background)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="profile-container profile-content" id="profile-container">

        {/* ── User banner com background de jogo ── */}
        <div
          className={`profile-user-banner${selectingBanner ? ' selecting' : ''}`}
          onClick={() => !selectingBanner && setSelectingBanner(true)}
        >
          {/* Background image do jogo (igual ao perfect-game-banner) */}
          {profileBannerGameId && !selectingBanner && (
            <div
              className="profile-user-banner-bg"
              style={{
                backgroundImage: `url(${games.find(g => g.appId === profileBannerGameId)?.heroImage || ''})`,
              }}
            />
          )}

          {/* Botão de fechar seleção */}
          {selectingBanner && (
            <button
              className="profile-banner-close"
              onClick={(e) => {
                e.stopPropagation();
                setSelectingBanner(false);
              }}
            >
              ✕ Fechar
            </button>
          )}

          {/* Overlay para melhorar legibilidade */}
          <div className="profile-user-banner-overlay" />

          {/* Avatar + nomes */}
          <div className="profile-user-identity">
            <div className="profile-avatar-wrap">
              <Avatar src={currentUser.avatarUrl} size={88} />
              {/* Halo animado ao redor do avatar */}
              <div className="profile-avatar-halo" />
            </div>
            <div>
              <h1 className="profile-username">{currentUser.personaName}</h1>
              {currentUser.realName && (
                <div className="profile-realname">{currentUser.realName}</div>
              )}
              <div className="profile-steamid">{currentUser.steamId}</div>
              <a
                href={currentUser.profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-steam-link"
              >
                Ver no Steam ↗
              </a>
              {/* Indicador de banner */}
              <div
                className="profile-banner-indicator"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectingBanner(true);
                }}
              >
                {profileBannerGameId
                  ? `🎮 ${games.find((g) => g.appId === profileBannerGameId)?.name || 'Jogo selecionado'}`
                  : '🎨 Clique para escolher um banner'}
              </div>
            </div>
          </div>

          {/* Level badge */}
          <div
            className="profile-level-badge"
            onClick={() => setShowLevelsModal(true)}
            title="Ver todos os níveis"
          >
            <div className="profile-level-num">{level.label}</div>
            <div className="profile-level-title">{level.title}</div>
            <div className="profile-level-xp">{xp.toLocaleString('pt-BR')} XP</div>
            <div className="profile-level-bar-wrap">
              <div
                className="profile-level-bar-fill"
                style={{ width: `${level.pct}%` }}
              />
            </div>
            {level.nextMin && (
              <div className="profile-level-next">
                Próximo: {level.nextMin.toLocaleString('pt-BR')} XP
              </div>
            )}
          </div>
        </div>

        {/* ── Banner Game Selector ── */}
        {selectingBanner && (
          <div className="profile-banner-selector">
            <h4 className="profile-banner-selector-title">Escolha um banner</h4>
            <div className="profile-banner-grid">
              {games
                .filter((g) => g.unlockedCount > 0)
                .sort((a, b) => b.percentage - a.percentage)
                .map((game: Game) => (
                  <div
                    key={game.appId}
                    className={`profile-banner-option${
                      profileBannerGameId === game.appId ? ' selected' : ''
                    }`}
                    onClick={() => {
                      setProfileBannerGame(game.appId);
                      setSelectingBanner(false);
                    }}
                  >
                    <img
                      src={game.heroImage}
                      alt={game.name}
                      className="profile-banner-option-img"
                    />
                    <div className="profile-banner-option-name">{game.name}</div>
                    {profileBannerGameId === game.appId && (
                      <div className="profile-banner-option-check">✓</div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Stats row ── */}
        <div className="profile-stats-row">
          {[
            { icon: '🏆', label: 'Conquistas', value: `${totalUnlocked}/${totalAch}`, color: 'var(--accent)' },
            { icon: '📊', label: '% Global',   value: `${pct}%`,                      color: 'var(--accent)' },
            { icon: '✦',  label: 'Platinas',   value: String(platCount),              color: 'var(--plat, #e5e4e2)' },
            { icon: '🎮', label: 'Jogos',      value: String(games.length),           color: '#fff' },
            { icon: '⭐', label: 'XP Total',   value: xp.toLocaleString('pt-BR'),     color: '#fbbf24' },
          ].map(s => (
            <div key={s.label} className="profile-stat-card">
              <div className="profile-stat-icon">{s.icon}</div>
              <div className="profile-stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="profile-stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════
            SEÇÃO NOVA: JOGOS RECENTEMENTE JOGADOS
        ══════════════════════════════════════════════════════════ */}
        {(loadingRecent || recentGames.length > 0) && (
          <section className="profile-section">
            <h3 className="profile-section-title">🕐 Jogados Recentemente</h3>

            {loadingRecent ? (
              <div className="profile-loading-row">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="profile-recent-skeleton" />
                ))}
              </div>
            ) : (
              <div className="profile-recent-carousel">
                <div className="profile-recent-track">
                  {/* Primeiro conjunto */}
                  {recentGames.map(game => {
                    const iconUrl = gameIconUrl(game.appid, game.img_icon_url);
                    const headerUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
                    const h2w = Math.round(game.playtime_2weeks);
                    const total = formatPlaytime(game.playtime_forever);
                    const recent = formatPlaytime(h2w);

                    return (
                      <div key={`a-${game.appid}`} className="profile-recent-card">
                        <div className="profile-recent-art">
                          <img
                            src={headerUrl}
                            alt={game.name}
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              if (iconUrl) img.src = iconUrl;
                              else img.style.display = 'none';
                            }}
                          />
                          <div className="profile-recent-art-overlay" />
                        </div>
                        <div className="profile-recent-info">
                          <div className="profile-recent-name">{game.name}</div>
                          <div className="profile-recent-times">
                            <span className="profile-recent-this-week" title="Últimas 2 semanas">
                              🕐 {recent}
                            </span>
                            <span className="profile-recent-total" title="Tempo total">
                              {total} total
                            </span>
                          </div>
                          <div className="profile-recent-bar-wrap">
                            <div
                              className="profile-recent-bar-fill"
                              style={{
                                width: `${Math.min(100, (h2w / (recentGames[0]?.playtime_2weeks ?? 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {/* Duplicado para loop infinito */}
                  {recentGames.map(game => {
                    const iconUrl = gameIconUrl(game.appid, game.img_icon_url);
                    const headerUrl = `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`;
                    const h2w = Math.round(game.playtime_2weeks);
                    const total = formatPlaytime(game.playtime_forever);
                    const recent = formatPlaytime(h2w);

                    return (
                      <div key={`b-${game.appid}`} className="profile-recent-card">
                        <div className="profile-recent-art">
                          <img
                            src={headerUrl}
                            alt={game.name}
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              if (iconUrl) img.src = iconUrl;
                              else img.style.display = 'none';
                            }}
                          />
                          <div className="profile-recent-art-overlay" />
                        </div>
                        <div className="profile-recent-info">
                          <div className="profile-recent-name">{game.name}</div>
                          <div className="profile-recent-times">
                            <span className="profile-recent-this-week" title="Últimas 2 semanas">
                              🕐 {recent}
                            </span>
                            <span className="profile-recent-total" title="Tempo total">
                              {total} total
                            </span>
                          </div>
                          <div className="profile-recent-bar-wrap">
                            <div
                              className="profile-recent-bar-fill"
                              style={{
                                width: `${Math.min(100, (h2w / (recentGames[0]?.playtime_2weeks ?? 1)) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Featured Sections (Múltiplos destaques) ── */}
        {featuredSections.map((section) => (
          <FeaturedSectionComponent
            key={section.id}
            section={section}
            games={games}
            updateFeaturedSectionTitle={updateFeaturedSectionTitle}
            removeFeaturedSection={removeFeaturedSection}
            addFeaturedGameToSection={addFeaturedGameToSection}
            removeFeaturedGameFromSection={removeFeaturedGameFromSection}
            addFeaturedAchievementToSection={addFeaturedAchievementToSection}
            removeFeaturedAchievementFromSection={removeFeaturedAchievementFromSection}
            addFeaturedCardToSection={addFeaturedCardToSection}
            removeFeaturedCardFromSection={removeFeaturedCardFromSection}
            openGameDetail={openGameDetail}
            availableGames={availableGames}
            gamesWithAchievements={gamesWithAchievements}
            calcCardDamage={calcCardDamage}
            getCardRarity={getCardRarity}
          />
        ))}

        {/* ── Add New Section ── */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h3 className="profile-section-title">➕ Adicionar Destaque</h3>
          </div>

          {showTypeSelector ? (
            <div className="profile-featured-type-selector">
              <div className="profile-featured-type-grid">
                <button
                  className="profile-featured-type-btn"
                  disabled={gamesSectionCount >= 3}
                  onClick={() => {
                    addFeaturedSection('games', `Jogos em Destaque ${gamesSectionCount + 1}`);
                    setShowTypeSelector(false);
                  }}
                >
                  <div className="profile-featured-type-icon">🎮</div>
                  <div className="profile-featured-type-label">Jogos</div>
                  <div className="profile-featured-type-desc">
                    {gamesSectionCount >= 3 ? 'Limite atingido (3)' : 'Destaque seus jogos favoritos'}
                  </div>
                </button>
                <button
                  className="profile-featured-type-btn"
                  disabled={achievementsSectionCount >= 3}
                  onClick={() => {
                    addFeaturedSection('achievements', `Conquistas ${achievementsSectionCount + 1}`);
                    setShowTypeSelector(false);
                  }}
                >
                  <div className="profile-featured-type-icon">🏆</div>
                  <div className="profile-featured-type-label">Conquistas</div>
                  <div className="profile-featured-type-desc">
                    {achievementsSectionCount >= 3 ? 'Limite atingido (3)' : 'Mostre suas conquistas raras'}
                  </div>
                </button>
                <button
                  className="profile-featured-type-btn"
                  disabled={cardsSectionCount >= 3}
                  onClick={() => {
                    addFeaturedSection('cards', `Cartas ${cardsSectionCount + 1}`);
                    setShowTypeSelector(false);
                  }}
                >
                  <div className="profile-featured-type-icon">⚔️</div>
                  <div className="profile-featured-type-label">Cartas</div>
                  <div className="profile-featured-type-desc">Exiba suas cartas de duelo</div>
                </button>
              </div>
              <button
                className="profile-featured-cancel"
                onClick={() => setShowTypeSelector(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              className="profile-featured-add"
              onClick={() => setShowTypeSelector(true)}
            >
              <span className="profile-featured-add-icon">+</span>
              <span>Adicionar destaque</span>
            </button>
          )}
        </section>

        {/* ── Perfect games (lógica existente, visual idêntico ao original) ── */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h3 className="profile-section-title" style={{ color: '#00ffff', textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>
              💎 Jogos Perfeitos
            </h3>
            <button
              className={`profile-edit-btn${selectingPerfect ? ' active' : ''}`}
              style={{
                borderColor: '#00ffff',
                color: selectingPerfect ? '#000' : '#00ffff',
                background: selectingPerfect ? '#00ffff' : 'transparent',
              }}
              onClick={() => setSelectingPerfect(v => !v)}
            >
              {selectingPerfect ? '✓ Concluir' : '⚙️ Editar'}
            </button>
          </div>

          {(() => {
            const perfectGames = perfectGameIds
              .map(id => games.find(g => g.appId === id))
              .filter((g): g is Game => g !== undefined);
            const platinumGames = games.filter(g => g.trophyTier === 'platinum');
            const displayGames  = perfectGames.length > 0 ? perfectGames : platinumGames.slice(0, 3);

            if (displayGames.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--txt3)', fontSize: 13 }}>
                  Nenhum jogo platinado ainda
                </div>
              );
            }

            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {displayGames.map(g => (
                    <div
                      key={g.appId}
                      onClick={() => !selectingPerfect && openGameDetail(g.appId)}
                      className="perfect-game-banner"
                      style={{
                        position: 'relative',
                        borderRadius: 16,
                        overflow: 'hidden',
                        cursor: selectingPerfect ? 'default' : 'pointer',
                        opacity: selectingPerfect && !perfectGameIds.includes(g.appId) ? 0.5 : 1,
                        minHeight: 180,
                      }}
                    >
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: `url(${g.heroImage})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        filter: 'brightness(0.4)',
                      }} />
                      <div className="perfect-game-glow" />
                      <div style={{
                        position: 'relative', zIndex: 1,
                        padding: '20px 24px',
                        display: 'flex', gap: 16, alignItems: 'center',
                        minHeight: 200,
                      }}>
                        <img src={g.headerImage} alt={g.name}
                             style={{ width: 120, height: 56, objectFit: 'cover', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}>
                            {g.name}
                          </div>
                          <div style={{ fontSize: 13, color: '#00ffff', marginTop: 6, display: 'flex', alignItems: 'center', gap: 8, textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>
                            <span style={{ fontSize: 16 }}>💎</span>
                            <span>Perfeito · {g.unlockedCount}/{g.totalCount} conquistas · {Math.round(g.playtimeForever / 60)}h jogadas</span>
                          </div>
                          <div style={{ marginTop: 10, maxWidth: 300 }}>
                            <ProgressBar percent={g.percentage} height={6} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          {/* Top 5 hardest achievements */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {g.achievements
                              ?.filter(a => a.globalPercent)
                              ?.sort((a, b) => (a.globalPercent || 100) - (b.globalPercent || 100))
                              ?.slice(0, 5)
                              ?.map(ach => (
                                <div
                                  key={ach.apiName}
                                  title={`${ach.displayName} — ${ach.globalPercent?.toFixed(1)}%`}
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
                                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: ach.achieved ? 1 : 0.5 }}
                                  />
                                </div>
                              ))}
                          </div>
                          <div style={{ fontWeight: 900, color: '#00ffff', fontSize: 28, textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5)' }}>
                            100%
                          </div>
                          {selectingPerfect && (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                perfectGameIds.includes(g.appId)
                                  ? removePerfectGame(g.appId)
                                  : addPerfectGame(g.appId);
                              }}
                              style={{
                                width: 32, height: 32, borderRadius: 16,
                                border: `2px solid ${perfectGameIds.includes(g.appId) ? '#00ffff' : 'var(--txt3)'}`,
                                background: perfectGameIds.includes(g.appId) ? '#00ffff' : 'transparent',
                                color: perfectGameIds.includes(g.appId) ? '#000' : 'var(--txt2)',
                                fontSize: 16, fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: perfectGameIds.includes(g.appId) ? '0 0 10px rgba(0,255,255,0.5)' : 'none',
                              }}
                            >
                              {perfectGameIds.includes(g.appId) ? '★' : '☆'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {selectingPerfect && (
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>
                      Clique na estrela para adicionar/remover ({perfectGameIds.length}/6)
                    </h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                      {platinumGames.map(g => (
                        <div
                          key={g.appId}
                          className="profile-pick-row"
                          onClick={() => {
                            perfectGameIds.includes(g.appId)
                              ? removePerfectGame(g.appId)
                              : perfectGameIds.length < 6 && addPerfectGame(g.appId);
                          }}
                          style={{ borderColor: perfectGameIds.includes(g.appId) ? '#00ffff' : 'transparent' }}
                        >
                          <img src={g.headerImage} alt={g.name}
                               style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                          <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                          <div style={{ fontSize: 12, color: '#00ffff' }}>💎 100%</div>
                          <div style={{ color: perfectGameIds.includes(g.appId) ? '#00ffff' : 'var(--txt3)' }}>
                            {perfectGameIds.includes(g.appId) ? '★' : '☆'}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </section>

      </div>{/* /profile-content */}

      {/* ═══════════════════════════════════════════════════════════════════
          LEVELS MODAL (idêntico ao original)
      ═══════════════════════════════════════════════════════════════════ */}
      {showLevelsModal && (
        <div
          onClick={() => setShowLevelsModal(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.8)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg1)', border: '1px solid var(--b2)',
              borderRadius: 16, padding: '24px 32px',
              maxWidth: 500, width: '100%',
              maxHeight: '80vh', overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>🏆 Todos os Níveis</h2>
              <button
                onClick={() => setShowLevelsModal(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 24, color: 'var(--txt2)', cursor: 'pointer', padding: '0 8px' }}
              >
                ✕
              </button>
            </div>

            {/* XP guide */}
            <div style={{ marginBottom: 20, padding: 16, background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--b2)' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px 0', color: 'var(--accent)' }}>💡 Como ganhar XP</h3>
              <div style={{ fontSize: 12, color: 'var(--txt2)', lineHeight: 1.6 }}>
                {[
                  ['🏆', 'Conquista desbloqueada: +10 XP'],
                  ['🥉', 'Jogo Bronze (1–25%): +15 XP'],
                  ['🥈', 'Jogo Prata (26–50%): +50 XP'],
                  ['🥇', 'Jogo Ouro (51–75%): +150 XP'],
                  ['💎', 'Conquista Platinado (100%): +500 XP'],
                ].map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                    <span>{icon}</span><span>{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {LEVELS.map((lvl, idx) => {
                const isCurrent  = level.label === lvl.label;
                const isUnlocked = xp >= lvl.min;
                return (
                  <div
                    key={lvl.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16,
                      padding: '14px 16px', borderRadius: 10,
                      background: isCurrent ? 'var(--accent)' : isUnlocked ? 'var(--bg3)' : 'transparent',
                      border: '1px solid',
                      borderColor: isCurrent ? 'var(--accent)' : isUnlocked ? 'var(--b3)' : 'var(--b1)',
                      opacity: isUnlocked ? 1 : 0.5,
                    }}
                  >
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: isCurrent ? '#fff' : isUnlocked ? 'var(--accent)' : 'var(--bg2)',
                      color: isCurrent ? 'var(--accent)' : '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 16,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 16, color: isCurrent ? '#fff' : 'var(--txt1)' }}>
                        {lvl.title}
                      </div>
                      <div style={{ fontSize: 12, color: isCurrent ? 'rgba(255,255,255,0.8)' : 'var(--txt2)', marginTop: 2 }}>
                        Mínimo: {lvl.min.toLocaleString('pt-BR')} XP
                      </div>
                    </div>
                    {isCurrent  && <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>ATUAL</div>}
                    {!isUnlocked && <div style={{ fontSize: 12, color: 'var(--txt3)' }}>🔒</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20, padding: '12px 16px', background: 'var(--bg2)', borderRadius: 8, fontSize: 12, color: 'var(--txt2)', textAlign: 'center' }}>
              Você tem {xp.toLocaleString('pt-BR')} XP
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileView;
