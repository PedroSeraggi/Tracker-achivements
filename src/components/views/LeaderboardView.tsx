// =============================================================================
//  src/components/leaderboard/LeaderboardView.tsx
//
//  Leaderboard completo com:
//    · Pódio top-3 (gold / silver / bronze) com animações
//    · Lista ranked para posições 4+
//    · Busca inline por nome
//    · Highlight do usuário logado
//    · Clique → abre PlayerProfilePage via setSearchView
//    · Auto-registra stats do usuário ao montar
//    · Skeleton loading
// =============================================================================

import React, {
  useEffect,
  useMemo,
  useCallback,
  useState,
  useRef,
} from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Avatar, Empty } from '../ui';
import {
  fetchLeaderboard,
  registerLeaderboardStats,
} from '../../api/steamApi';
import type { LeaderboardEntry } from '../../types/leaderboard';

// ─── Medal config ─────────────────────────────────────────────────────────────

const MEDAL = {
  1: { emoji: '🥇', label: 'Ouro',   color: '#f59e0b', glow: 'rgba(245,158,11,0.45)', shadow: 'rgba(245,158,11,0.25)' },
  2: { emoji: '🥈', label: 'Prata',  color: '#94a3b8', glow: 'rgba(148,163,184,0.35)', shadow: 'rgba(148,163,184,0.2)'  },
  3: { emoji: '🥉', label: 'Bronze', color: '#cd7f32', glow: 'rgba(205,127,50,0.35)',  shadow: 'rgba(205,127,50,0.2)'   },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null): string {
  if (n == null) return '—';
  return n.toLocaleString('pt-BR');
}

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60_000);
  if (min <  1) return 'agora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h  < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Skeleton row for loading state */
const SkeletonRow: React.FC<{ wide?: boolean }> = ({ wide = false }) => (
  <div className={`lb-row lb-skeleton-row${wide ? ' lb-row--wide' : ''}`}>
    <div className="lb-skeleton lb-skeleton-rank" />
    <div className="lb-skeleton lb-skeleton-avatar" />
    <div className="lb-skeleton-info">
      <div className="lb-skeleton lb-skeleton-name" />
      <div className="lb-skeleton lb-skeleton-sub" />
    </div>
    <div className="lb-skeleton lb-skeleton-stat" />
    <div className="lb-skeleton lb-skeleton-stat" />
  </div>
);

/** Podium card for rank 1–3 */
const PodiumCard: React.FC<{
  entry   : LeaderboardEntry;
  onOpen  : (entry: LeaderboardEntry) => void;
}> = ({ entry, onOpen }) => {
  const medal    = MEDAL[entry.rank as 1 | 2 | 3];
  const isFirst  = entry.rank === 1;

  return (
    <div
      className={`lb-podium-card lb-podium-card--${entry.rank}${entry.isMe ? ' lb-podium-card--me' : ''}`}
      style={{ '--medal-color': medal.color, '--medal-glow': medal.glow, '--medal-shadow': medal.shadow } as React.CSSProperties}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(entry)}
      title={`Ver perfil de ${entry.personaName}`}
    >
      {/* Glow ring (animated for #1) */}
      <div className="lb-podium-glow-ring" />

      {/* Medal badge */}
      <div className="lb-podium-medal">{medal.emoji}</div>

      {/* Rank number */}
      <div className="lb-podium-rank">#{entry.rank}</div>

      {/* Avatar */}
      <div className={`lb-podium-avatar-wrap${isFirst ? ' lb-podium-avatar-wrap--first' : ''}`}>
        <Avatar src={entry.avatarUrl} size={isFirst ? 80 : 64} />
        {entry.isMe && <div className="lb-me-badge" title="Você">EU</div>}
        {entry.isPrivate && <div className="lb-private-badge" title="Perfil privado">🔒</div>}
      </div>

      {/* Name */}
      <div className="lb-podium-name">{entry.personaName}</div>

      {/* Primary stat */}
      {entry.totalAch != null ? (
        <div className="lb-podium-stat-main">
          <span className="lb-podium-stat-val">{fmt(entry.totalAch)}</span>
          <span className="lb-podium-stat-label">conquistas</span>
        </div>
      ) : (
        <div className="lb-podium-stat-main lb-podium-stat-main--unregistered">
          <span className="lb-podium-stat-val">{fmt(entry.gameCount)}</span>
          <span className="lb-podium-stat-label">jogos</span>
        </div>
      )}

      {/* Secondary stats */}
      <div className="lb-podium-secondary">
        {entry.platCount != null && (
          <div className="lb-podium-badge lb-podium-badge--plat" title="Platinas">
            🏆 {entry.platCount}
          </div>
        )}
        {entry.rareCount != null && entry.rareCount > 0 && (
          <div className="lb-podium-badge lb-podium-badge--rare" title="Conquistas raras (≤5%)">
            💎 {entry.rareCount}
          </div>
        )}
      </div>

      {/* Sync indicator */}
      {entry.registeredAt && (
        <div className="lb-podium-sync" title={`Dados sincronizados há ${timeAgo(entry.registeredAt)}`}>
          ↻ {timeAgo(entry.registeredAt)}
        </div>
      )}
    </div>
  );
};

/** Standard leaderboard row for ranks 4+ */
const LeaderboardRow: React.FC<{
  entry   : LeaderboardEntry;
  onOpen  : (entry: LeaderboardEntry) => void;
}> = ({ entry, onOpen }) => (
  <div
    className={`lb-row${entry.isMe ? ' lb-row--me' : ''}`}
    role="button"
    tabIndex={0}
    onClick={() => onOpen(entry)}
    onKeyDown={(e) => e.key === 'Enter' && onOpen(entry)}
    title={`Ver perfil de ${entry.personaName}`}
  >
    {/* Rank */}
    <div className="lb-row-rank">
      <span className="lb-row-rank-num">{entry.rank}</span>
    </div>

    {/* Avatar */}
    <div className="lb-row-avatar-wrap">
      <Avatar src={entry.avatarUrl} size={40} />
      {entry.isMe && <div className="lb-me-badge lb-me-badge--sm">EU</div>}
    </div>

    {/* Name + sub */}
    <div className="lb-row-info">
      <div className="lb-row-name">
        {entry.personaName}
        {entry.isPrivate && (
          <span className="lb-private-tag" title="Perfil privado">🔒</span>
        )}
      </div>
      <div className="lb-row-sub">
        {entry.totalAch == null
          ? `${fmt(entry.gameCount)} jogos`
          : `${fmt(entry.gameCount)} jogos`}
        {entry.registeredAt && (
          <span className="lb-row-sync"> · ↻ {timeAgo(entry.registeredAt)}</span>
        )}
      </div>
    </div>

    {/* Plat count */}
    <div className="lb-row-stat lb-row-stat--plat">
      {entry.platCount != null ? (
        <>
          <span className="lb-row-stat-icon">🏆</span>
          <span className="lb-row-stat-val">{fmt(entry.platCount)}</span>
        </>
      ) : (
        <span className="lb-row-stat-empty">—</span>
      )}
    </div>

    {/* Rare count */}
    <div className="lb-row-stat lb-row-stat--rare">
      {entry.rareCount != null ? (
        <>
          <span className="lb-row-stat-icon">💎</span>
          <span className="lb-row-stat-val">{fmt(entry.rareCount)}</span>
        </>
      ) : (
        <span className="lb-row-stat-empty">—</span>
      )}
    </div>

    {/* Total ach (primary) */}
    <div className="lb-row-stat lb-row-stat--total">
      {entry.totalAch != null ? (
        <span className="lb-row-total-val">{fmt(entry.totalAch)}</span>
      ) : (
        <span className="lb-row-unregistered" title="Este jogador ainda não sincronizou os dados">
          Não sincronizado
        </span>
      )}
    </div>

    {/* Chevron */}
    <div className="lb-row-chevron">›</div>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────

const LeaderboardView: React.FC = () => {
  const leaderboard       = useAppStore((s) => s.leaderboard);
  const leaderboardStatus = useAppStore((s) => s.leaderboardStatus);
  const leaderboardSearch = useAppStore((s) => s.leaderboardSearch);
  const leaderboardError  = useAppStore((s) => s.leaderboardError);
  const setLeaderboard    = useAppStore((s) => s.setLeaderboard);
  const setStatus         = useAppStore((s) => s.setLeaderboardStatus);
  const setSearch         = useAppStore((s) => s.setLeaderboardSearch);
  const setError          = useAppStore((s) => s.setLeaderboardError);
  const currentUser       = useAppStore((s) => s.currentUser);
  const games             = useAppStore((s) => s.games);

  // Store actions needed to open another player's profile
  const setSearchedPlayer  = useAppStore((s) => s.setSearchedPlayer);
  const setSearchView      = useAppStore((s) => s.setSearchView);
  const setDashView        = useAppStore((s) => s.setDashView);
  const setSearchLoading   = useAppStore((s) => s.setSearchLoading);

  const hasFetched = useRef(false);

  // ── Auto-register current user's stats once games are loaded ──────────────
  useEffect(() => {
    if (!currentUser || games.length === 0) return;

    const totalAch = games.reduce((s, g) => s + g.unlockedCount, 0);
    const platCount = games.filter((g) => g.trophyTier === 'platinum').length;
    const rareCount = games.reduce((sum, g) => {
      return sum + g.achievements.filter(
        (a) => a.achieved && a.globalPercent != null && a.globalPercent <= 5
      ).length;
    }, 0);

    registerLeaderboardStats({
      totalAch,
      platCount,
      rareCount,
      gameCount: games.length,
    }).catch(() => {/* silent — non-critical */});
  }, [currentUser, games]);

  // ── Fetch leaderboard on mount ─────────────────────────────────────────────
  const load = useCallback(async () => {
    if (leaderboardStatus === 'loading') return;
    setStatus('loading');
    setError(null);
    try {
      const data = await fetchLeaderboard();
      setLeaderboard(data);
      setStatus('ok');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(msg);
      setStatus('error');
    }
  }, [leaderboardStatus, setLeaderboard, setStatus, setError]);

  useEffect(() => {
    if (!hasFetched.current && leaderboardStatus === 'idle') {
      hasFetched.current = true;
      load();
    }
  }, [load, leaderboardStatus]);

  // ── Click handler: open player profile ────────────────────────────────────
  const handleOpen = useCallback(
    async (entry: LeaderboardEntry) => {
      if (entry.isMe) {
        // Just navigate to our own profile
        setDashView('profile');
        return;
      }

      // Navigate to Search view and set the searched player
      setDashView('search');
      setSearchLoading(true);

      try {
        // Fetch their full game data (uses existing searchPlayer flow)
        const { searchPlayer } = await import('../../api/steamApi');
        const user = await searchPlayer(entry.steamId);

        setSearchedPlayer({
          user,
          games    : [],
          gamesLoaded: false,
        });

        setSearchView('profile');
      } catch {
        // If profile load fails, still navigate with basic info
        setSearchedPlayer({
          user: {
            steamId                 : entry.steamId,
            personaName             : entry.personaName,
            avatarUrl               : entry.avatarUrl,
            profileUrl              : entry.profileUrl,
            communityVisibilityState: entry.isPrivate ? 1 : 3,
            realName                : undefined,
          },
          games      : [],
          gamesLoaded: false,
        });
        setSearchView('home');
      } finally {
        setSearchLoading(false);
      }
    },
    [setDashView, setSearchedPlayer, setSearchView, setSearchLoading]
  );

  // ── Filter by search ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = leaderboardSearch.trim().toLowerCase();
    if (!q) return leaderboard;
    return leaderboard.filter((e) =>
      e.personaName.toLowerCase().includes(q)
    );
  }, [leaderboard, leaderboardSearch]);

  const podium  = filtered.filter((e) => e.rank <= 3);
  const rest    = filtered.filter((e) => e.rank >  3);
  const isLoading = leaderboardStatus === 'loading';

  // ── Find current user's position in filtered list ─────────────────────────
  const myEntry = leaderboard.find((e) => e.isMe);

  // ────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="lb-root">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="lb-header">
        <div className="lb-header-left">
          <h2 className="lb-title">🏆 Leaderboard</h2>
          <p className="lb-subtitle">
            Seus amigos do Steam rankeados por conquistas desbloqueadas.
            {myEntry && (
              <span className="lb-my-rank">
                {' '}Você está em <strong>#{myEntry.rank}</strong> com{' '}
                <strong>{fmt(myEntry.totalAch)}</strong> conquistas.
              </span>
            )}
          </p>
        </div>
        <button
          className="lb-refresh-btn"
          onClick={load}
          disabled={isLoading}
          title="Atualizar leaderboard"
        >
          <span className={isLoading ? 'lb-spin' : ''}>↻</span>
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* ── Sync hint ────────────────────────────────────────────────── */}
      <div className="lb-sync-hint">
        <span>💡</span>
        <span>
          Somente jogadores que já acessaram o Trophy Tracker aparecem com dados completos.
          Amigos sem dados são listados por número de jogos.
        </span>
      </div>

      {/* ── Search bar ───────────────────────────────────────────────── */}
      <div className="lb-search-wrap">
        <span className="lb-search-icon">🔍</span>
        <input
          type="text"
          className="lb-search-input"
          placeholder="Filtrar por nome..."
          value={leaderboardSearch}
          onChange={(e) => setSearch(e.target.value)}
        />
        {leaderboardSearch && (
          <button className="lb-search-clear" onClick={() => setSearch('')}>✕</button>
        )}
      </div>

      {/* ── Error state ──────────────────────────────────────────────── */}
      {leaderboardStatus === 'error' && (
        <div className="lb-error">
          <span>⚠</span>
          <span>{leaderboardError ?? 'Erro ao carregar o leaderboard.'}</span>
          <button className="lb-error-retry" onClick={load}>Tentar novamente</button>
        </div>
      )}

      {/* ── Loading skeletons ─────────────────────────────────────────── */}
      {isLoading && (
        <>
          <div className="lb-podium">
            {[2, 1, 3].map((i) => (
              <div key={i} className={`lb-podium-card lb-podium-card--${i} lb-skeleton-card`}>
                <div className="lb-skeleton lb-skeleton-avatar-lg" />
                <div className="lb-skeleton lb-skeleton-name-lg" style={{ marginTop: 12 }} />
                <div className="lb-skeleton lb-skeleton-name-lg" style={{ width: '60%', marginTop: 6 }} />
              </div>
            ))}
          </div>
          <div className="lb-list">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </>
      )}

      {/* ── Empty state (no friends / all filtered out) ───────────────── */}
      {!isLoading && leaderboardStatus === 'ok' && filtered.length === 0 && (
        <Empty
          icon="👥"
          title={
            leaderboardSearch
              ? 'Nenhum jogador encontrado com esse nome'
              : 'Nenhum amigo encontrado'
          }
          sub={
            leaderboardSearch
              ? 'Tente outro termo de busca'
              : 'Adicione amigos no Steam para ver o leaderboard'
          }
        />
      )}

      {/* ── Podium (top 3) ────────────────────────────────────────────── */}
      {!isLoading && podium.length > 0 && (
        <div className="lb-podium">
          {/* Render order: 2nd, 1st, 3rd (classic podium layout) */}
          {(
            [
              podium.find((e) => e.rank === 2),
              podium.find((e) => e.rank === 1),
              podium.find((e) => e.rank === 3),
            ].filter(Boolean) as LeaderboardEntry[]
          ).map((entry) => (
            <PodiumCard key={entry.steamId} entry={entry} onOpen={handleOpen} />
          ))}
        </div>
      )}

      {/* ── List header ───────────────────────────────────────────────── */}
      {!isLoading && rest.length > 0 && (
        <>
          <div className="lb-list-header">
            <div className="lb-lh-rank">#</div>
            <div className="lb-lh-player">Jogador</div>
            <div className="lb-lh-stat">Platinas</div>
            <div className="lb-lh-stat">Raras</div>
            <div className="lb-lh-total">Total</div>
          </div>

          <div className="lb-list">
            {rest.map((entry) => (
              <LeaderboardRow
                key={entry.steamId}
                entry={entry}
                onOpen={handleOpen}
              />
            ))}
          </div>
        </>
      )}

      {/* ── Footer note ──────────────────────────────────────────────── */}
      {!isLoading && leaderboardStatus === 'ok' && (
        <div className="lb-footer">
          {leaderboard.length} jogadores no leaderboard · Atualizado a cada 5 minutos
        </div>
      )}
    </div>
  );
};

export default LeaderboardView;
