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

  const featured = useMemo(
    () =>
      [...games]
        .sort((a, b) => b.percentage - a.percentage)
        .filter((g) => g.unlockedCount > 0)
        .slice(0, 3),
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
            <h3 style={{ fontSize: 13, color: 'var(--txt2)', letterSpacing: 2, marginBottom: 14 }}>
              🎯 JOGOS EM DESTAQUE
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {featured.map((g) => (
                <div
                  key={g.appId}
                  onClick={() => openGameDetail(g.appId)}
                  style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    background: 'var(--bg2)',
                    border: '1px solid var(--b2)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    cursor: 'pointer',
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
                      {g.unlockedCount}/{g.totalCount} conquistas
                    </div>
                    <ProgressBar percent={g.percentage} height={4} />
                  </div>
                  <div style={{ fontWeight: 900, color: 'var(--accent)', fontSize: 18 }}>
                    {g.percentage}%
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ProfileView;
