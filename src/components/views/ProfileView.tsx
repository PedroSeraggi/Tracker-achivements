import React, { useMemo } from 'react';
import { useAppStore, selectGlobalStats } from '../../store/useAppStore';
import { Avatar, ProgressBar, Empty } from '../ui';
import type { Game } from '../../types';

// ── XP / Level calculations ────────────────────────────────────────────────────
function calcXP(games: Game[]): number {
  return games.reduce((total, g) => {
    const base = g.unlockedCount * 10;
    const bonus =
      g.trophyTier === 'platinum' ? 500 :
      g.trophyTier === 'gold'     ? 150 :
      g.trophyTier === 'silver'   ? 50  :
      g.trophyTier === 'bronze'   ? 15  : 0;
    return total + base + bonus;
  }, 0);
}

const LEVELS = [
  { min: 0,     title: '🎮 Iniciante',       label: 'Nível 1' },
  { min: 500,   title: '🕹 Jogador',          label: 'Nível 2' },
  { min: 1500,  title: '⚔️ Aventureiro',      label: 'Nível 3' },
  { min: 3500,  title: '🏅 Veterano',         label: 'Nível 4' },
  { min: 7000,  title: '🥇 Caçador',          label: 'Nível 5' },
  { min: 12000, title: '💎 Elite',            label: 'Nível 6' },
  { min: 20000, title: '👑 Mestre',           label: 'Nível 7' },
  { min: 30000, title: '🌟 Lendário',         label: 'Nível 8' },
  { min: 50000, title: '✦ Platina Supremo',   label: 'Nível 9' },
];

function getLevel(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.min) current = lvl;
  }
  const idx    = LEVELS.indexOf(current);
  const next   = LEVELS[idx + 1];
  const pct    = next
    ? Math.min(100, Math.round(((xp - current.min) / (next.min - current.min)) * 100))
    : 100;
  return { ...current, nextMin: next?.min, pct };
}

// ── Component ─────────────────────────────────────────────────────────────────
const ProfileView: React.FC = () => {
  const games       = useAppStore((s) => s.games);
  const currentUser = useAppStore((s) => s.currentUser);
  const openGameDetail = useAppStore((s) => s.openGameDetail);
  const { totalUnlocked, totalAch, platCount, pct } = useAppStore(selectGlobalStats);

  const xp    = useMemo(() => calcXP(games), [games]);
  const level = useMemo(() => getLevel(xp), [xp]);

  const featuredGameIds = useAppStore((s) => s.featuredGameIds);
  const addFeaturedGame = useAppStore((s) => s.addFeaturedGame);
  const removeFeaturedGame = useAppStore((s) => s.removeFeaturedGame);
  const perfectGameIds = useAppStore((s) => s.perfectGameIds);
  const addPerfectGame = useAppStore((s) => s.addPerfectGame);
  const removePerfectGame = useAppStore((s) => s.removePerfectGame);
  const [selectingFeatured, setSelectingFeatured] = React.useState(false);
  const [selectingPerfect, setSelectingPerfect] = React.useState(false);

  const featured = useMemo(
    () => {
      const featuredGames = featuredGameIds
        .map((id) => games.find((g) => g.appId === id))
        .filter((g): g is Game => g !== undefined);
      return featuredGames.length > 0 ? featuredGames : games
        .filter((g) => g.unlockedCount > 0)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 3);
    },
    [games, featuredGameIds]
  );

  const availableGames = useMemo(
    () => games.filter((g) => g.unlockedCount > 0).sort((a, b) => b.percentage - a.percentage),
    [games]
  );

  if (!currentUser) return <Empty icon="👤" title="Usuário não carregado" />;

  return (
    <div id="view-profile">
      <div className="profile-container" id="profile-container">

        {/* ── User banner ── */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--bg2) 0%, var(--bg3) 100%)',
            border: '1px solid var(--b2)',
            borderRadius: 16,
            padding: '28px 28px 20px',
            margin: '0 20px 20px',
            display: 'flex',
            gap: 20,
            alignItems: 'flex-start',
            flexWrap: 'wrap',
          }}
        >
          <Avatar src={currentUser.avatarUrl} size={80} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
              {currentUser.personaName}
            </div>
            {currentUser.realName && (
              <div style={{ fontSize: 13, color: 'var(--txt2)', marginTop: 2 }}>
                {currentUser.realName}
              </div>
            )}
            <div
              style={{ fontSize: 11, color: 'var(--txt3)', fontFamily: 'monospace', marginTop: 4 }}
            >
              {currentUser.steamId}
            </div>
            <a
              href={currentUser.profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="found-link"
              style={{ marginTop: 10, display: 'inline-block' }}
            >
              Ver no Steam
            </a>
          </div>

          {/* Level badge */}
          <div
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--b3)',
              borderRadius: 12,
              padding: '12px 18px',
              textAlign: 'center',
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--txt3)', letterSpacing: 2 }}>
              {level.label}
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)', margin: '4px 0' }}>
              {level.title}
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
              {xp.toLocaleString('pt-BR')} XP
            </div>
            <ProgressBar percent={level.pct} height={4} />
            {level.nextMin && (
              <div style={{ fontSize: 10, color: 'var(--txt3)', marginTop: 3 }}>
                Próximo nível: {level.nextMin.toLocaleString('pt-BR')} XP
              </div>
            )}
          </div>
        </div>

        {/* ── Stats row ── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 12,
            padding: '0 20px 20px',
          }}
        >
          {[
            { label: 'Conquistas', value: `${totalUnlocked}/${totalAch}`, color: 'var(--accent)' },
            { label: '% Global',   value: `${pct}%`,                       color: 'var(--accent)' },
            { label: '✦ Platinas', value: platCount,                        color: 'var(--plat, #e5e4e2)' },
            { label: 'Jogos',      value: games.length,                     color: '#fff' },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: 'var(--bg2)',
                border: '1px solid var(--b2)',
                borderRadius: 10,
                padding: '14px 16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 24, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--txt2)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── Featured games ── */}
        {featured.length > 0 && (
          <section style={{ padding: '0 20px 40px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 13, color: 'var(--txt2)', letterSpacing: 2, margin: 0 }}>
                🎯 JOGOS EM DESTAQUE
              </h3>
              <button
                onClick={() => setSelectingFeatured(!selectingFeatured)}
                style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  background: selectingFeatured ? 'var(--accent)' : 'transparent',
                  border: '1px solid var(--accent)',
                  borderRadius: 6,
                  color: selectingFeatured ? '#fff' : 'var(--accent)',
                  cursor: 'pointer',
                }}
              >
                {selectingFeatured ? '✓ Concluir' : '⚙️ Editar'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {featured.map((g) => (
                <div
                  key={g.appId}
                  onClick={() => !selectingFeatured && openGameDetail(g.appId)}
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    background: 'var(--bg2)',
                    border: '1px solid var(--b2)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    cursor: selectingFeatured ? 'default' : 'pointer',
                    opacity: selectingFeatured && !featuredGameIds.includes(g.appId) ? 0.5 : 1,
                  }}
                >
                  <img
                    src={g.headerImage}
                    alt={g.name}
                    style={{ width: 80, height: 37, objectFit: 'cover', borderRadius: 6 }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                      {g.unlockedCount}/{g.totalCount} conquistas · {Math.round(g.playtimeForever / 60)}h jogadas
                    </div>
                    <ProgressBar percent={g.percentage} height={4} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ fontWeight: 900, color: 'var(--accent)', fontSize: 18 }}>
                      {g.percentage}%
                    </div>
                    {selectingFeatured && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (featuredGameIds.includes(g.appId)) {
                            removeFeaturedGame(g.appId);
                          } else {
                            addFeaturedGame(g.appId);
                          }
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          border: '2px solid',
                          borderColor: featuredGameIds.includes(g.appId) ? 'var(--gold)' : 'var(--txt3)',
                          background: featuredGameIds.includes(g.appId) ? 'var(--gold)' : 'transparent',
                          color: featuredGameIds.includes(g.appId) ? '#000' : 'var(--txt2)',
                          fontSize: 14,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {featuredGameIds.includes(g.appId) ? '★' : '☆'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {selectingFeatured && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontSize: 12, color: 'var(--txt3)', marginBottom: 10 }}>
                  Clique na estrela para adicionar/remover ({featuredGameIds.length}/6)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
                  {availableGames.map((g) => (
                    <div
                      key={g.appId}
                      onClick={() => {
                        if (featuredGameIds.includes(g.appId)) {
                          removeFeaturedGame(g.appId);
                        } else if (featuredGameIds.length < 6) {
                          addFeaturedGame(g.appId);
                        }
                      }}
                      style={{
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: featuredGameIds.includes(g.appId) ? 'var(--bg3)' : 'transparent',
                        border: '1px solid',
                        borderColor: featuredGameIds.includes(g.appId) ? 'var(--gold)' : 'transparent',
                      }}
                    >
                      <img
                        src={g.headerImage}
                        alt={g.name}
                        style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }}
                      />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--txt2)' }}>{g.percentage}%</div>
                      <div style={{ color: featuredGameIds.includes(g.appId) ? 'var(--gold)' : 'var(--txt3)' }}>
                        {featuredGameIds.includes(g.appId) ? '★' : '☆'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Perfect games (Platinum) ── */}
        <section style={{ padding: '0 20px 40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 13, color: '#00ffff', letterSpacing: 2, margin: 0, textShadow: '0 0 10px rgba(0,255,255,0.5)' }}>
              💎 JOGOS PERFEITOS
            </h3>
            <button
              onClick={() => setSelectingPerfect(!selectingPerfect)}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 600,
                background: selectingPerfect ? '#00ffff' : 'transparent',
                border: '1px solid #00ffff',
                borderRadius: 6,
                color: selectingPerfect ? '#000' : '#00ffff',
                cursor: 'pointer',
                boxShadow: selectingPerfect ? '0 0 15px rgba(0,255,255,0.5)' : 'none',
              }}
            >
              {selectingPerfect ? '✓ Concluir' : '⚙️ Editar'}
            </button>
          </div>
          {(() => {
            const perfectGames = perfectGameIds
              .map((id) => games.find((g) => g.appId === id))
              .filter((g): g is Game => g !== undefined);
            const platinumGames = games.filter((g) => g.trophyTier === 'platinum');
            const displayGames = perfectGames.length > 0 ? perfectGames : platinumGames.slice(0, 3);
            
            if (displayGames.length === 0) {
              return (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--txt3)', fontSize: 13 }}>
                  Nenhum jogo platinado ainda
                </div>
              );
            }
            
            return (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {displayGames.map((g) => (
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
                      {/* Banner background */}
                      <div
                        style={{
                          position: 'absolute',
                          inset: 0,
                          backgroundImage: `url(${g.heroImage})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          filter: 'brightness(0.4)',
                        }}
                      />
                      {/* Animated border glow */}
                      <div className="perfect-game-glow" />
                      {/* Content overlay */}
                      <div
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          padding: '20px 24px',
                          display: 'flex',
                          gap: 16,
                          alignItems: 'center',
                          height: '100%',
                          minHeight: 180,
                        }}
                      >
                        <img
                          src={g.headerImage}
                          alt={g.name}
                          style={{ width: 120, height: 56, objectFit: 'cover', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                        />
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
                              ?.filter((a) => a.globalPercent)
                              ?.sort((a, b) => (a.globalPercent || 100) - (b.globalPercent || 100))
                              ?.slice(0, 5)
                              ?.map((ach) => (
                                <div
                                  key={ach.apiName}
                                  title={`${ach.displayName} — ${ach.globalPercent?.toFixed(1)}% dos jogadores`}
                                  style={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 4,
                                    border: ach.achieved ? '1px solid #00ffff' : '1px solid var(--txt3)',
                                    boxShadow: ach.achieved ? '0 0 6px rgba(0,255,255,0.4)' : 'none',
                                    overflow: 'hidden',
                                    cursor: 'help',
                                  }}
                                >
                                  <img
                                    src={ach.achieved ? ach.iconUrl : ach.iconGrayUrl}
                                    alt={ach.displayName}
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      opacity: ach.achieved ? 1 : 0.5,
                                    }}
                                  />
                                </div>
                              ))}
                          </div>
                          <div style={{ fontWeight: 900, color: '#00ffff', fontSize: 28, textShadow: '0 0 20px #00ffff, 0 0 40px rgba(0,255,255,0.5)' }}>
                            100%
                          </div>
                          {selectingPerfect && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (perfectGameIds.includes(g.appId)) {
                                  removePerfectGame(g.appId);
                                } else {
                                  addPerfectGame(g.appId);
                                }
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                border: '2px solid',
                                borderColor: perfectGameIds.includes(g.appId) ? '#00ffff' : 'var(--txt3)',
                                background: perfectGameIds.includes(g.appId) ? '#00ffff' : 'transparent',
                                color: perfectGameIds.includes(g.appId) ? '#000' : 'var(--txt2)',
                                fontSize: 16,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                      {platinumGames.map((g) => (
                        <div
                          key={g.appId}
                          onClick={() => {
                            if (perfectGameIds.includes(g.appId)) {
                              removePerfectGame(g.appId);
                            } else if (perfectGameIds.length < 6) {
                              addPerfectGame(g.appId);
                            }
                          }}
                          style={{
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 8,
                            cursor: 'pointer',
                            background: perfectGameIds.includes(g.appId) ? 'var(--bg3)' : 'transparent',
                            border: '1px solid',
                            borderColor: perfectGameIds.includes(g.appId) ? '#00ffff' : 'transparent',
                          }}
                        >
                          <img
                            src={g.headerImage}
                            alt={g.name}
                            style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }}
                          />
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
      </div>
    </div>
  );
};

export default ProfileView;
