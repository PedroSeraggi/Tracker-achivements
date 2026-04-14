import React, { useMemo } from 'react';
import {
  useAppStore,
  selectActiveGame,
  selectSearchActiveGame,
} from '../../store/useAppStore';
import { Avatar, FilterBar } from '../ui';
import type { CompareFilter, Achievement } from '../../types';

const COMPARE_FILTERS: { value: CompareFilter; label: string }[] = [
  { value: 'all',        label: 'Todos' },
  { value: 'only_me',   label: 'Só eu tenho' },
  { value: 'only_them', label: 'Só ele(a) tem' },
  { value: 'both',      label: 'Ambos temos' },
  { value: 'neither',   label: 'Nenhum tem' },
];

interface CompareRow {
  ach: Achievement;
  meHas: boolean;
  themHas: boolean;
  category: 'both' | 'only_me' | 'only_them' | 'neither';
}

const CompareView: React.FC = () => {
  const myGame       = useAppStore(selectActiveGame);
  const theirGame    = useAppStore(selectSearchActiveGame);
  const compareFilter  = useAppStore((s) => s.compareFilter);
  const setCompareFilter = useAppStore((s) => s.setCompareFilter);
  const setSearchView  = useAppStore((s) => s.setSearchView);
  const currentUser    = useAppStore((s) => s.currentUser);
  const searchedPlayer = useAppStore((s) => s.searchedPlayer);

  // Build compare rows using myGame as the master list
  const rows = useMemo<CompareRow[]>(() => {
    if (!myGame) return [];
    return myGame.achievements.map((ach) => {
      const meHas   = ach.achieved;
      const theirAch = theirGame?.achievements.find((a) => a.apiName === ach.apiName);
      const themHas  = theirAch?.achieved ?? false;
      const category: CompareRow['category'] =
        meHas && themHas ? 'both' :
        meHas            ? 'only_me' :
        themHas          ? 'only_them' :
                           'neither';
      return { ach, meHas, themHas, category };
    });
  }, [myGame, theirGame]);

  const filtered = useMemo(
    () => (compareFilter === 'all' ? rows : rows.filter((r) => r.category === compareFilter)),
    [rows, compareFilter]
  );

  if (!myGame) return null;

  const myPct   = myGame.percentage;
  const theirPct = theirGame?.percentage ?? 0;

  return (
    <div id="search-compare-view">
      {/* Topbar */}
      <div className="compare-topbar">
        <button className="detail-back" onClick={() => setSearchView('game')}>
          ← Voltar ao Jogo
        </button>
        <div className="compare-title">{myGame.name} — Comparação</div>
      </div>

      {/* Player header cards */}
      <div className="compare-header-cards" id="compare-header-cards">
        {/* Me */}
        <div className="compare-player-card me">
          <Avatar src={currentUser?.avatarUrl} size={48} />
          <div className="compare-player-info">
            <div className="compare-player-name">{currentUser?.personaName ?? 'Você'}</div>
            <div
              className="compare-player-pct"
              style={{ color: '#3a7acc', fontSize: 28, fontWeight: 900 }}
            >
              {myPct}%
            </div>
            <div className="compare-player-sub">
              {myGame.unlockedCount}/{myGame.totalCount} conquistas
            </div>
          </div>
        </div>

        <span className="compare-vs">VS</span>

        {/* Them */}
        <div className="compare-player-card them">
          <Avatar src={searchedPlayer?.user.avatarUrl} size={48} />
          <div className="compare-player-info">
            <div className="compare-player-name">
              {searchedPlayer?.user.personaName ?? 'Jogador'}
            </div>
            <div
              className="compare-player-pct"
              style={{ color: '#7c3aed', fontSize: 28, fontWeight: 900 }}
            >
              {theirPct}%
            </div>
            <div className="compare-player-sub">
              {theirGame?.unlockedCount ?? 0}/{theirGame?.totalCount ?? myGame.totalCount} conquistas
            </div>
          </div>
        </div>
      </div>

      {/* Progress bars side-by-side */}
      <div className="compare-pbar-wrap">
        <div className="compare-pbar-side" style={{ textAlign: 'right' }}>
          <div className="compare-pbar-label">{currentUser?.personaName ?? 'Eu'}</div>
          <div className="compare-pbar-track" style={{ direction: 'rtl' }}>
            <div
              className="compare-pbar-fill-me"
              style={{ width: `${myPct}%` }}
            />
          </div>
        </div>
        <div className="compare-pbar-center">
          <span style={{ fontSize: 10, color: 'var(--txt3)' }}>VS</span>
        </div>
        <div className="compare-pbar-side">
          <div className="compare-pbar-label">{searchedPlayer?.user.personaName ?? 'Eles'}</div>
          <div className="compare-pbar-track">
            <div
              className="compare-pbar-fill-them"
              style={{ width: `${theirPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="compare-filters">
        <FilterBar options={COMPARE_FILTERS} active={compareFilter} onChange={setCompareFilter} />
      </div>

      {/* Achievement rows */}
      <div id="compare-list" className="compare-list">
        {filtered.map(({ ach, meHas, themHas, category }) => (
          <div key={ach.apiName} className={`compare-item ${category}`}>
            {/* My check */}
            <div className={`compare-check${meHas ? ' me-yes' : ''}`}>
              {meHas ? '✓' : ''}
            </div>

            {/* Center info */}
            <div className="compare-item-center">
              <img
                className="compare-item-icon"
                src={ach.achieved ? ach.iconUrl : ach.iconGrayUrl}
                alt={ach.displayName}
                onError={(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')}
              />
              <div className="compare-item-text">
                <div className="compare-item-name">{ach.displayName}</div>
                <div className="compare-item-desc">{ach.description}</div>
                {ach.globalPercent !== undefined && (
                  <div className="compare-item-pct">
                    {ach.globalPercent.toFixed(1)}% dos jogadores
                  </div>
                )}
              </div>
            </div>

            {/* Their check */}
            <div className={`compare-check${themHas ? ' them-yes' : ''}`}>
              {themHas ? '✓' : ''}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--txt3)' }}>
            Nenhuma conquista nesta categoria.
          </div>
        )}
      </div>
    </div>
  );
};

export default CompareView;
