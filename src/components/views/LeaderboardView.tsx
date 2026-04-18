// =============================================================================
//  src/components/leaderboard/LeaderboardView.tsx  (v2 — SQLite + Global)
//
//  Tabs: Global (SQLite paginado) | Amigos (Steam friends + SQLite)
//  Busca global por nome (debounced 300ms)
//  Podium top-3 + lista rank 4+ + paginação
//  Highlight do usuário logado + posição global no header
// =============================================================================

import React, {
  useEffect, useMemo, useCallback,
  useState, useRef,
} from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Avatar, Empty } from '../ui';
import { registerLeaderboardStats } from '../../api/steamApi';
import type { LeaderboardEntry } from '../../types/leaderboard';

// ─── API helpers ──────────────────────────────────────────────────────────────

type LbMode = 'global' | 'friends';

interface GlobalResult {
  entries : LeaderboardEntry[];
  total   : number;
  page    : number;
  pages   : number;
}

async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const lbApi = {
  global : (page: number, limit = 50) =>
    apiFetch<GlobalResult>(`/api/leaderboard/global?page=${page}&limit=${limit}`),
  friends: () =>
    apiFetch<LeaderboardEntry[]>('/api/leaderboard/friends'),
  search : (q: string) =>
    apiFetch<LeaderboardEntry[]>(`/api/leaderboard/search?q=${encodeURIComponent(q)}`),
  myRank : () =>
    apiFetch<{ rank: number | null }>('/api/leaderboard/me/rank'),
};

// ─── Medal config ─────────────────────────────────────────────────────────────

const MEDAL = {
  1: { emoji: '🥇', color: '#f59e0b', glow: 'rgba(245,158,11,0.45)', shadow: 'rgba(245,158,11,0.25)' },
  2: { emoji: '🥈', color: '#94a3b8', glow: 'rgba(148,163,184,0.35)', shadow: 'rgba(148,163,184,0.18)' },
  3: { emoji: '🥉', color: '#cd7f32', glow: 'rgba(205,127,50,0.35)',  shadow: 'rgba(205,127,50,0.18)' },
} as const;

const PAGE_SIZE = 50;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('pt-BR');

function timeAgo(ts: number | null): string {
  if (!ts) return '';
  const d = Date.now() - ts;
  const m = Math.floor(d / 60_000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="lb-row lb-skeleton-row">
    <div className="lb-skeleton lb-skeleton-rank" />
    <div className="lb-skeleton lb-skeleton-avatar" />
    <div className="lb-skeleton-info">
      <div className="lb-skeleton lb-skeleton-name" />
      <div className="lb-skeleton lb-skeleton-sub" />
    </div>
    <div className="lb-skeleton lb-skeleton-stat" />
    <div className="lb-skeleton lb-skeleton-stat" />
    <div className="lb-skeleton lb-skeleton-stat" />
  </div>
);

// ─── Podium card ──────────────────────────────────────────────────────────────

const PodiumCard: React.FC<{
  entry: LeaderboardEntry;
  onOpen: (e: LeaderboardEntry) => void;
}> = ({ entry, onOpen }) => {
  const medal   = MEDAL[entry.rank as 1 | 2 | 3];
  const isFirst = entry.rank === 1;

  return (
    <div
      className={`lb-podium-card lb-podium-card--${entry.rank}${entry.isMe ? ' lb-podium-card--me' : ''}`}
      style={{
        '--medal-color'  : medal.color,
        '--medal-glow'   : medal.glow,
        '--medal-shadow' : medal.shadow,
      } as React.CSSProperties}
      role="button" tabIndex={0}
      onClick={() => onOpen(entry)}
      onKeyDown={e => e.key === 'Enter' && onOpen(entry)}
      title={`Ver perfil de ${entry.personaName}`}
    >
      <div className="lb-podium-glow-ring" />
      <div className="lb-podium-medal">{medal.emoji}</div>
      <div className="lb-podium-rank">#{entry.rank}</div>

      <div className={`lb-podium-avatar-wrap${isFirst ? ' lb-podium-avatar-wrap--first' : ''}`}>
        <Avatar src={entry.avatarUrl} size={isFirst ? 80 : 64} />
        {entry.isMe      && <div className="lb-me-badge">EU</div>}
        {entry.isPrivate && <div className="lb-private-badge">🔒</div>}
      </div>

      <div className="lb-podium-name">{entry.personaName}</div>

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

      <div className="lb-podium-secondary">
        {entry.platCount != null && (
          <div className="lb-podium-badge lb-podium-badge--plat">🏆 {entry.platCount}</div>
        )}
        {entry.rareCount != null && entry.rareCount > 0 && (
          <div className="lb-podium-badge lb-podium-badge--rare">💎 {entry.rareCount}</div>
        )}
      </div>

      {entry.registeredAt && (
        <div className="lb-podium-sync">↻ {timeAgo(entry.registeredAt)}</div>
      )}
    </div>
  );
};

// ─── Leaderboard row ──────────────────────────────────────────────────────────

const LbRow: React.FC<{
  entry: LeaderboardEntry;
  onOpen: (e: LeaderboardEntry) => void;
}> = ({ entry, onOpen }) => (
  <div
    className={`lb-row${entry.isMe ? ' lb-row--me' : ''}`}
    role="button" tabIndex={0}
    onClick={() => onOpen(entry)}
    onKeyDown={e => e.key === 'Enter' && onOpen(entry)}
    title={`Ver perfil de ${entry.personaName}`}
  >
    <div className="lb-row-rank">
      <span className="lb-row-rank-num">{entry.rank}</span>
    </div>

    <div className="lb-row-avatar-wrap">
      <Avatar src={entry.avatarUrl} size={40} />
      {entry.isMe && <div className="lb-me-badge lb-me-badge--sm">EU</div>}
    </div>

    <div className="lb-row-info">
      <div className="lb-row-name">
        {entry.personaName}
        {entry.isPrivate && <span className="lb-private-tag">🔒</span>}
      </div>
      <div className="lb-row-sub">
        {fmt(entry.gameCount)} jogos
        {entry.registeredAt && (
          <span className="lb-row-sync"> · ↻ {timeAgo(entry.registeredAt)}</span>
        )}
      </div>
    </div>

    <div className="lb-row-stat lb-row-stat--plat">
      {entry.platCount != null
        ? <><span className="lb-row-stat-icon">🏆</span><span className="lb-row-stat-val">{fmt(entry.platCount)}</span></>
        : <span className="lb-row-stat-empty">—</span>}
    </div>

    <div className="lb-row-stat lb-row-stat--rare">
      {entry.rareCount != null
        ? <><span className="lb-row-stat-icon">💎</span><span className="lb-row-stat-val">{fmt(entry.rareCount)}</span></>
        : <span className="lb-row-stat-empty">—</span>}
    </div>

    <div className="lb-row-stat lb-row-stat--total">
      {entry.totalAch != null
        ? <span className="lb-row-total-val">{fmt(entry.totalAch)}</span>
        : <span className="lb-row-unregistered">Não sincronizado</span>}
    </div>

    <div className="lb-row-chevron">›</div>
  </div>
);

// ─── Pagination ───────────────────────────────────────────────────────────────

const Pagination: React.FC<{
  page: number; pages: number; total: number;
  onPage: (p: number) => void;
}> = ({ page, pages, total, onPage }) => {
  if (pages <= 1) return null;

  const nums: (number | '…')[] = [];
  if (pages <= 7) {
    for (let i = 1; i <= pages; i++) nums.push(i);
  } else {
    nums.push(1);
    if (page > 3)           nums.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) nums.push(i);
    if (page < pages - 2)   nums.push('…');
    nums.push(pages);
  }

  return (
    <div className="lb-pagination">
      <button className="lb-page-btn" disabled={page === 1} onClick={() => onPage(page - 1)}>‹</button>
      {nums.map((n, i) =>
        n === '…'
          ? <span key={`e${i}`} className="lb-page-ellipsis">…</span>
          : <button
              key={n}
              className={`lb-page-btn${n === page ? ' lb-page-btn--active' : ''}`}
              onClick={() => onPage(n)}
            >{n}</button>
      )}
      <button className="lb-page-btn" disabled={page === pages} onClick={() => onPage(page + 1)}>›</button>
      <span className="lb-page-total">{total.toLocaleString('pt-BR')} jogadores</span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const LeaderboardView: React.FC = () => {
  const currentUser       = useAppStore(s => s.currentUser);
  const games             = useAppStore(s => s.games);
  const setDashView       = useAppStore(s => s.setDashView);
  const setSearchedPlayer  = useAppStore(s => s.setSearchedPlayer);
  const setSearchView     = useAppStore(s => s.setSearchView);
  const setSearchLoading  = useAppStore(s => s.setSearchLoading);

  const [mode,          setMode]          = useState<LbMode>('global');
  const [entries,       setEntries]       = useState<LeaderboardEntry[]>([]);
  const [status,        setStatus]        = useState<'idle'|'loading'|'ok'|'error'>('idle');
  const [error,         setError]         = useState<string | null>(null);
  const [searchInput,   setSearchInput]   = useState('');
  const [page,          setPage]          = useState(1);
  const [pages,         setPages]         = useState(1);
  const [total,         setTotal]         = useState(0);
  const [myGlobalRank,  setMyGlobalRank]  = useState<number | null>(null);
  const [searchResults, setSearchResults] = useState<LeaderboardEntry[] | null>(null);
  const [searchBusy,    setSearchBusy]    = useState(false);

  const debouncedQ  = useDebounce(searchInput, 300);
  const registered  = useRef(false);

  // ── Friends filter (client-side)
  const friendsFiltered = useMemo(() => {
    if (mode !== 'friends' || !searchInput.trim()) return entries;
    const q = searchInput.toLowerCase();
    return entries.filter(e => e.personaName.toLowerCase().includes(q));
  }, [entries, searchInput, mode]);

  // ── Register stats once
  useEffect(() => {
    if (!currentUser || games.length === 0 || registered.current) return;
    registered.current = true;
    const totalAch  = games.reduce((s, g) => s + g.unlockedCount, 0);
    const platCount = games.filter(g => g.trophyTier === 'platinum').length;
    const rareCount = games.reduce((sum, g) =>
      sum + g.achievements.filter(a => a.achieved && (a.globalPercent ?? 101) <= 5).length, 0);
    registerLeaderboardStats({ totalAch, platCount, rareCount, gameCount: games.length })
      .catch(() => {});
  }, [currentUser, games]);

  // ── Fetch my global rank
  useEffect(() => {
    if (!currentUser) return;
    lbApi.myRank().then(r => setMyGlobalRank(r.rank)).catch(() => {});
  }, [currentUser]);

  // ── Load leaderboard
  const load = useCallback(async (m: LbMode, p = 1) => {
    setStatus('loading');
    setError(null);
    try {
      if (m === 'global') {
        const res = await lbApi.global(p, PAGE_SIZE);
        setEntries(res.entries);
        setPages(res.pages);
        setTotal(res.total);
        setPage(p);
      } else {
        const res = await lbApi.friends();
        setEntries(res);
        setPages(1);
        setTotal(res.length);
        setPage(1);
      }
      setStatus('ok');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setStatus('error');
    }
  }, []);

  useEffect(() => { load(mode, 1); }, [mode]); // eslint-disable-line

  // ── Global search (debounced)
  useEffect(() => {
    if (mode !== 'global') return;
    if (!debouncedQ.trim()) { setSearchResults(null); return; }
    setSearchBusy(true);
    lbApi.search(debouncedQ)
      .then(res => setSearchResults(res.map((e, i) => ({
        ...e, rank: i + 1, isMe: e.steamId === currentUser?.steamId,
      }))))
      .catch(() => setSearchResults([]))
      .finally(() => setSearchBusy(false));
  }, [debouncedQ, mode, currentUser]);

  // ── Open profile
  const handleOpen = useCallback(async (entry: LeaderboardEntry) => {
    if (entry.isMe) { setDashView('profile'); return; }
    setDashView('search');
    setSearchLoading(true);
    try {
      const { searchPlayer } = await import('../../api/steamApi');
      const user = await searchPlayer(entry.steamId);
      setSearchedPlayer({ user, games: [], gamesLoaded: false });
      setSearchView('profile');
    } catch {
      setSearchedPlayer({
        user: {
          steamId: entry.steamId, personaName: entry.personaName,
          avatarUrl: entry.avatarUrl, profileUrl: entry.profileUrl,
          communityVisibilityState: entry.isPrivate ? 1 : 3,
        },
        games: [], gamesLoaded: false,
      });
      setSearchView('home');
    } finally {
      setSearchLoading(false);
    }
  }, [setDashView, setSearchedPlayer, setSearchView, setSearchLoading]);

  // ── Page change
  const handlePage = (p: number) => {
    load(mode, p);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ── Display list
  const displayList = mode === 'global'
    ? (searchResults ?? entries)
    : friendsFiltered;

  const podium     = displayList.filter(e => e.rank <= 3);
  const rest       = displayList.filter(e => e.rank >  3);
  const isLoading  = status === 'loading';
  const myEntry    = displayList.find(e => e.isMe);

  // ────────────────────────────────────────────────────────────────────────
  return (
    <div className="lb-root">

      {/* Header */}
      <div className="lb-header">
        <div className="lb-header-left">
          <h2 className="lb-title">🏆 Leaderboard</h2>
          <p className="lb-subtitle">
            {mode === 'global'
              ? 'Ranking global de todos os usuários do Trophy Tracker.'
              : 'Seus amigos do Steam rankeados por conquistas.'}
            {myGlobalRank != null && (
              <span className="lb-my-rank">
                {' '}Sua posição global: <strong>#{myGlobalRank}</strong>
                {myEntry && <> ({fmt(myEntry.totalAch)} conquistas)</>}.
              </span>
            )}
          </p>
        </div>
        <button
          className="lb-refresh-btn"
          onClick={() => load(mode, page)}
          disabled={isLoading}
          title="Atualizar"
        >
          <span className={isLoading ? 'lb-spin' : ''}>↻</span>
          {isLoading ? 'Carregando...' : 'Atualizar'}
        </button>
      </div>

      {/* Mode tabs */}
      <div className="lb-tabs">
        <button
          className={`lb-tab${mode === 'global' ? ' lb-tab--active' : ''}`}
          onClick={() => { setMode('global'); setSearchInput(''); setSearchResults(null); }}
        >
          🌐 Global
          {mode === 'global' && total > 0 && (
            <span className="lb-tab-count">{total.toLocaleString('pt-BR')}</span>
          )}
        </button>
        <button
          className={`lb-tab${mode === 'friends' ? ' lb-tab--active' : ''}`}
          onClick={() => { setMode('friends'); setSearchInput(''); setSearchResults(null); }}
        >
          👥 Amigos
          {mode === 'friends' && total > 0 && (
            <span className="lb-tab-count">{total}</span>
          )}
        </button>
      </div>

      {/* Hint — friends */}
      {mode === 'friends' && (
        <div className="lb-sync-hint">
          <span>💡</span>
          <span>
            Amigos sem conta no Trophy Tracker aparecem apenas com contagem de jogos.
            Para dados reais de conquistas, eles precisam acessar o site ao menos uma vez.
          </span>
        </div>
      )}

      {/* Search / filter bar */}
      <div className="lb-search-wrap">
        <span className="lb-search-icon">
          {searchBusy ? '⏳' : '🔍'}
        </span>
        <input
          type="text"
          className="lb-search-input"
          placeholder={
            mode === 'global'
              ? 'Buscar jogador no ranking global...'
              : 'Filtrar amigos por nome...'
          }
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
        />
        {searchInput && (
          <button
            className="lb-search-clear"
            onClick={() => { setSearchInput(''); setSearchResults(null); }}
          >✕</button>
        )}
      </div>

      {/* Error */}
      {status === 'error' && (
        <div className="lb-error">
          <span>⚠</span>
          <span>{error ?? 'Erro ao carregar.'}</span>
          <button className="lb-error-retry" onClick={() => load(mode, page)}>
            Tentar novamente
          </button>
        </div>
      )}

      {/* Skeletons */}
      {isLoading && (
        <>
          <div className="lb-podium">
            {[2, 1, 3].map(i => (
              <div key={i} className={`lb-podium-card lb-podium-card--${i} lb-skeleton-card`}>
                <div className="lb-skeleton lb-skeleton-avatar-lg" />
                <div className="lb-skeleton lb-skeleton-name-lg" style={{ marginTop: 12 }} />
                <div className="lb-skeleton lb-skeleton-name-lg" style={{ width: '55%', marginTop: 6 }} />
              </div>
            ))}
          </div>
          <div className="lb-list">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        </>
      )}

      {/* Empty */}
      {!isLoading && status === 'ok' && displayList.length === 0 && (
        <Empty
          icon={mode === 'global' ? '🌐' : '👥'}
          title={
            searchInput
              ? 'Nenhum jogador encontrado'
              : mode === 'global'
              ? 'Ainda ninguém no ranking'
              : 'Nenhum amigo encontrado'
          }
          sub={
            searchInput
              ? 'Tente outro nome'
              : mode === 'friends'
              ? 'Adicione amigos no Steam ou convide alguém para usar o Trophy Tracker'
              : 'Seja o primeiro a sincronizar!'
          }
        />
      )}

      {/* Podium */}
      {!isLoading && podium.length > 0 && (
        <div className="lb-podium">
          {([
            podium.find(e => e.rank === 2),
            podium.find(e => e.rank === 1),
            podium.find(e => e.rank === 3),
          ].filter(Boolean) as LeaderboardEntry[]).map(entry => (
            <PodiumCard key={entry.steamId} entry={entry} onOpen={handleOpen} />
          ))}
        </div>
      )}

      {/* List */}
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
            {rest.map(entry => (
              <LbRow key={entry.steamId} entry={entry} onOpen={handleOpen} />
            ))}
          </div>
        </>
      )}

      {/* Pagination — global only, no active search */}
      {!isLoading && mode === 'global' && !searchResults && status === 'ok' && (
        <Pagination page={page} pages={pages} total={total} onPage={handlePage} />
      )}

      {/* Footer */}
      {!isLoading && status === 'ok' && (
        <div className="lb-footer">
          {mode === 'global'
            ? `${total.toLocaleString('pt-BR')} jogadores registrados · Persistido em SQLite`
            : `${total} jogadores · Cache de 5 minutos`}
        </div>
      )}
    </div>
  );
};

export default LeaderboardView;
