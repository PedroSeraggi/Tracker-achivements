import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchAchievements } from '../../api/steamApi';
import type { Game, ApiGame, Achievement } from '../../types';

type TrophyTier = Game['trophyTier'];

function trophyTier(pct: number, total: number): TrophyTier {
  if (total === 0) return 'none';
  if (pct === 100) return 'platinum';
  if (pct >= 75) return 'gold';
  if (pct >= 40) return 'silver';
  if (pct > 0) return 'bronze';
  return 'none';
}

function buildGame(raw: ApiGame, achievements: Achievement[]): Game {
  const total    = achievements.length;
  const unlocked = achievements.filter((a) => a.achieved).length;
  const pct      = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return {
    appId: raw.appid,
    name: raw.name,
    headerImage: `https://cdn.akamai.steamstatic.com/steam/apps/${raw.appid}/header.jpg`,
    heroImage: `https://cdn.akamai.steamstatic.com/steam/apps/${raw.appid}/library_hero.jpg`,
    playtimeForever: raw.playtime_forever,
    achievements,
    unlockedCount: unlocked,
    totalCount: total,
    percentage: pct,
    trophyTier: trophyTier(pct, total),
  };
}

const LibraryModal: React.FC = () => {
  const isOpen        = useAppStore((s) => s.libraryOpen);
  const setOpen       = useAppStore((s) => s.setLibraryOpen);
  const existingGames = useAppStore((s) => s.games);
  const setGames      = useAppStore((s) => s.setGames);
  const currentUser   = useAppStore((s) => s.currentUser);
  const addToast      = useAppStore((s) => s.addToast);

  const [allLibrary, setAllLibrary] = useState<ApiGame[]>([]);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [loading, setLoading]       = useState(false);
  const [adding, setAdding]         = useState(false);
  const [addStatus, setAddStatus]   = useState('');
  const [search, setSearch]         = useState('');

  // Already-tracked appIds
  const trackedIds = useMemo(
    () => new Set(existingGames.map((g) => g.appId)),
    [existingGames]
  );

  // Fetch full library on open
  useEffect(() => {
    if (!isOpen || !currentUser) return;
    setLoading(true);
    fetch(`/api/player/${currentUser.steamId}/library`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: ApiGame[]) => {
        // Show only games NOT already tracked and that have achievements
        setAllLibrary(data.filter((g) => g.has_community_visible_stats && !trackedIds.has(g.appid)));
      })
      .catch(() => setAllLibrary([]))
      .finally(() => setLoading(false));
  }, [isOpen, currentUser]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    if (!search.trim()) return allLibrary;
    const q = search.toLowerCase();
    return allLibrary.filter((g) => g.name.toLowerCase().includes(q));
  }, [allLibrary, search]);

  const toggle = (appId: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(appId) ? next.delete(appId) : next.add(appId);
      return next;
    });

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    const toAdd = allLibrary.filter((g) => selected.has(g.appid));
    const newGames: Game[] = [];

    for (let i = 0; i < toAdd.length; i++) {
      const raw = toAdd[i];
      setAddStatus(`Carregando ${raw.name}… (${i + 1}/${toAdd.length})`);
      try {
        const achievements = await fetchAchievements(raw.appid, currentUser?.steamId);
        newGames.push(buildGame(raw, achievements));
      } catch {
        // skip games that can't load achievements
      }
    }

    setGames([...existingGames, ...newGames]);
    setAdding(false);
    setAddStatus('');
    setSelected(new Set());
    setOpen(false);
    if (newGames.length > 0) {
      addToast('success', `${newGames.length} jogo${newGames.length > 1 ? 's adicionados' : ' adicionado'} com sucesso!`);
    } else {
      addToast('error', 'Nenhum jogo pôde ser adicionado. Verifique as conquistas dos jogos selecionados.');
    }
  };

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      onClick={() => !adding && setOpen(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#00000080',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Modal */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg2)',
          border: '1px solid var(--b2)',
          borderRadius: 16,
          width: '100%',
          maxWidth: 640,
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 80px #00000080',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px', borderBottom: '1px solid var(--b2)',
          }}
        >
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>
              + Adicionar Jogos
            </div>
            <div style={{ fontSize: 12, color: 'var(--txt2)', marginTop: 2 }}>
              Selecione jogos da sua biblioteca para monitorar
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            disabled={adding}
            style={{ fontSize: 20, color: 'var(--txt3)', padding: 4 }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--b2)' }}>
          <input
            type="text"
            placeholder="🔍 Buscar na biblioteca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg3)',
              border: '1px solid var(--b2)',
              borderRadius: 8,
              padding: '9px 14px',
              fontSize: 13,
              color: 'var(--txt)',
              outline: 'none',
            }}
          />
        </div>

        {/* Game list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>
              Carregando biblioteca…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--txt3)' }}>
              {search ? `Nenhum jogo encontrado para "${search}"` : 'Nenhum jogo disponível para adicionar.'}
            </div>
          ) : (
            filtered.map((g) => {
              const isSel = selected.has(g.appid);
              return (
                <div
                  key={g.appid}
                  onClick={() => toggle(g.appid)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '10px 22px', cursor: 'pointer',
                    borderBottom: '1px solid var(--b2)',
                    background: isSel ? 'var(--accent)14' : 'transparent',
                    transition: 'background .15s',
                  }}
                >
                  <img
                    src={`https://cdn.akamai.steamstatic.com/steam/apps/${g.appid}/header.jpg`}
                    alt={g.name}
                    style={{ width: 64, height: 30, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }}
                    onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 13,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {g.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--txt3)', marginTop: 2 }}>
                      {Math.round(g.playtime_forever / 60)}h jogadas
                    </div>
                  </div>
                  <div
                    style={{
                      width: 22, height: 22, borderRadius: 6,
                      border: `2px solid ${isSel ? 'var(--accent)' : 'var(--b3)'}`,
                      background: isSel ? 'var(--accent)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 13, color: '#fff',
                      transition: 'all .15s',
                    }}
                  >
                    {isSel && '✓'}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 22px', borderTop: '1px solid var(--b2)', gap: 12,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--txt2)' }}>
            {adding ? addStatus : selected.size > 0
              ? `${selected.size} jogo${selected.size > 1 ? 's' : ''} selecionado${selected.size > 1 ? 's' : ''}`
              : 'Clique nos jogos para selecionar'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-modal" onClick={() => setOpen(false)} disabled={adding}>
              Cancelar
            </button>
            <button
              className="btn-save-guide"
              onClick={handleAdd}
              disabled={adding || selected.size === 0}
              style={{ opacity: selected.size === 0 || adding ? 0.5 : 1 }}
            >
              {adding ? '⏳ Carregando...' : `+ Adicionar ${selected.size > 0 ? selected.size : ''} Jogo${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LibraryModal;
