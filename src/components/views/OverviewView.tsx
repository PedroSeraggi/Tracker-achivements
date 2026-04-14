import React, { useMemo } from 'react';
import { useAppStore, selectGlobalStats } from '../../store/useAppStore';
import { ProgressBar, TrophyBadge, Empty } from '../ui';
import GameCard from '../dashboard/GameCard';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color = 'var(--accent)', sub }) => (
  <div className="overview-stat-card">
    <div style={{ fontSize: 28, fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: 12, color: 'var(--txt2)', fontWeight: 600, marginTop: 4 }}>
      {label}
    </div>
    {sub && <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>{sub}</div>}
  </div>
);

const OverviewView: React.FC = () => {
  const games = useAppStore((s) => s.games);
  const { totalUnlocked, totalAch, platCount, pct } = useAppStore(selectGlobalStats);
  const openGameDetail = useAppStore((s) => s.openGameDetail);

  const goldCount   = useMemo(() => games.filter((g) => g.trophyTier === 'gold').length,   [games]);
  const silverCount = useMemo(() => games.filter((g) => g.trophyTier === 'silver').length, [games]);
  const bronzeCount = useMemo(() => games.filter((g) => g.trophyTier === 'bronze').length, [games]);

  const platGames = useMemo(
    () => games.filter((g) => g.trophyTier === 'platinum'),
    [games]
  );

  const mostPlayed = useMemo(
    () => [...games].sort((a, b) => b.playtimeForever - a.playtimeForever).slice(0, 5),
    [games]
  );

  if (games.length === 0) {
    return <Empty icon="📊" title="Nenhum dado disponível" sub="Carregue seus jogos primeiro." />;
  }

  return (
    <div id="view-overview">
      <div className="overview-grid" id="overview-cards">
        {/* Summary cards */}
        <StatCard label="TOTAL DE CONQUISTAS" value={`${totalUnlocked}/${totalAch}`} />
        <StatCard label="CONCLUSÃO GERAL" value={`${pct}%`} color="var(--accent)" />
        <StatCard label="✦ PLATINAS" value={platCount} color="var(--plat, #e5e4e2)" />
        <StatCard label="🥇 OUROS" value={goldCount} color="#ffd700" />
        <StatCard label="🥈 PRATAS" value={silverCount} color="#c0c0c0" />
        <StatCard label="🥉 BRONZES" value={bronzeCount} color="#cd7f32" />
        <StatCard label="JOGOS TOTAIS" value={games.length} />
        <StatCard
          label="JOGOS INICIADOS"
          value={games.filter((g) => g.unlockedCount > 0).length}
          sub={`${games.filter((g) => g.unlockedCount === 0).length} não iniciados`}
        />
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--txt2)' }}>Progresso Global</span>
          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>{pct}%</span>
        </div>
        <ProgressBar percent={pct} height={8} />
      </div>

      {/* Platinum showcase */}
      {platGames.length > 0 && (
        <section id="platinum-showcase" style={{ padding: '0 20px 32px' }}>
          <h3 style={{ fontSize: 13, color: 'var(--txt2)', letterSpacing: 2, marginBottom: 16 }}>
            ✦ JOGOS PLATINADOS
          </h3>
          <div className="games-grid">
            {platGames.map((g) => (
              <GameCard key={g.appId} game={g} onClick={() => openGameDetail(g.appId)} />
            ))}
          </div>
        </section>
      )}

      {/* Most played */}
      <section id="most-played-showcase" style={{ padding: '0 20px 40px' }}>
        <h3 style={{ fontSize: 13, color: 'var(--txt2)', letterSpacing: 2, marginBottom: 16 }}>
          🕹 MAIS JOGADOS
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mostPlayed.map((g, i) => (
            <div
              key={g.appId}
              onClick={() => openGameDetail(g.appId)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                background: 'var(--bg2)',
                border: '1px solid var(--b2)',
                borderRadius: 10,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--txt3)', width: 20 }}>
                #{i + 1}
              </span>
              <img
                src={g.headerImage}
                alt={g.name}
                style={{ width: 60, height: 28, objectFit: 'cover', borderRadius: 4 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                  {Math.round(g.playtimeForever / 60)}h · {g.unlockedCount}/{g.totalCount} conquistas
                </div>
              </div>
              <TrophyBadge tier={g.trophyTier} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default OverviewView;
