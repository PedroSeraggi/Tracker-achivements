import React, { useMemo, useState } from 'react';
import { useAppStore, selectActiveGame } from '../../store/useAppStore';
import { FilterBar, ProgressBar, TrophyBadge } from '../ui';
import AchievementItem from '../dashboard/AchievementItem';
import type { AchFilter, Achievement } from '../../types';

type AchSort = 'default' | 'unlocked_first' | 'locked_first' | 'rarity_asc' | 'rarity_desc' | 'recent';

const ACH_FILTERS: { value: AchFilter; label: string }[] = [
  { value: 'all',      label: 'Todos' },
  { value: 'unlocked', label: 'Desbloqueados' },
  { value: 'locked',   label: 'Bloqueados' },
];

const SORT_OPTIONS: { value: AchSort; label: string }[] = [
  { value: 'default',       label: 'Padrão' },
  { value: 'unlocked_first', label: 'Desbloqueados primeiro' },
  { value: 'locked_first',   label: 'Bloqueados primeiro' },
  { value: 'rarity_asc',    label: 'Mais raro primeiro' },
  { value: 'rarity_desc',   label: 'Mais comum primeiro' },
  { value: 'recent',        label: 'Mais recente' },
];

function sortAchievements(list: Achievement[], sort: AchSort): Achievement[] {
  const copy = [...list];
  switch (sort) {
    case 'unlocked_first': return copy.sort((a, b) => Number(b.achieved) - Number(a.achieved));
    case 'locked_first':   return copy.sort((a, b) => Number(a.achieved) - Number(b.achieved));
    case 'rarity_asc':     return copy.sort((a, b) => (a.globalPercent ?? 100) - (b.globalPercent ?? 100));
    case 'rarity_desc':    return copy.sort((a, b) => (b.globalPercent ?? 0) - (a.globalPercent ?? 0));
    case 'recent':
      return copy.sort((a, b) => (b.unlockTime ?? 0) - (a.unlockTime ?? 0));
    default: return copy;
  }
}

const GameDetailView: React.FC = () => {
  const closeGameDetail = useAppStore((s) => s.closeGameDetail);
  const achFilter       = useAppStore((s) => s.achFilter);
  const setAchFilter    = useAppStore((s) => s.setAchFilter);
  const game            = useAppStore(selectActiveGame);

  const [achSort, setAchSort]     = useState<AchSort>('default');
  const [achSearch, setAchSearch] = useState('');

  const achievements = useMemo(() => {
    if (!game) return [];
    let list = game.achievements;
    // filter
    if (achFilter === 'unlocked') list = list.filter((a) => a.achieved);
    if (achFilter === 'locked')   list = list.filter((a) => !a.achieved);
    // search
    if (achSearch.trim()) {
      const q = achSearch.toLowerCase();
      list = list.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }
    return sortAchievements(list, achSort);
  }, [game, achFilter, achSort, achSearch]);

  if (!game) return null;

  const tierColor: Record<string, string> = {
    platinum: 'var(--plat, #e5e4e2)',
    gold:     '#ffd700',
    silver:   '#c0c0c0',
    bronze:   '#cd7f32',
    none:     'var(--accent)',
  };

  const barColor = game.trophyTier !== 'none' ? tierColor[game.trophyTier] : 'var(--accent)';

  return (
    <div id="view-detail">
      <button className="detail-back" onClick={closeGameDetail}>
        ← Voltar aos Jogos
      </button>

      {/* Banner */}
      <div className="detail-banner">
        <div
          className="detail-banner-bg"
          style={{ backgroundImage: `url(${game.headerImage})` }}
        />
        <div className="detail-banner-overlay" />
        <div className="detail-banner-content">
          <div className="detail-banner-top">
            <div className="detail-banner-info">
              <div className="detail-banner-tag">
                <TrophyBadge tier={game.trophyTier} />
              </div>
              <div className="detail-banner-title">{game.name}</div>
              <div className="detail-banner-stats">
                {Math.round(game.playtimeForever / 60)}h jogadas ·{' '}
                {game.unlockedCount}/{game.totalCount} conquistas
              </div>
            </div>
            <div className="detail-banner-pct">
              <div className="detail-pct" style={{ color: barColor }}>
                {game.percentage}%
              </div>
              <div className="detail-achcount">{game.unlockedCount} / {game.totalCount}</div>
            </div>
          </div>
          <div className="detail-banner-bottom">
            <ProgressBar percent={game.percentage} color={barColor} height={6} />
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div
        className="detail-controls"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 20px',
          flexWrap: 'wrap',
          borderBottom: '1px solid var(--b2)',
          maxWidth: 1400,
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Status filter */}
        <FilterBar options={ACH_FILTERS} active={achFilter} onChange={setAchFilter} />

        <div style={{ flex: 1 }} />

        {/* Achievement search */}
        <input
          type="text"
          placeholder="🔍 Buscar conquista..."
          value={achSearch}
          onChange={(e) => setAchSearch(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '7px 12px',
            fontSize: 13,
            color: 'var(--txt)',
            outline: 'none',
            width: 200,
            transition: 'border-color .2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e)  => (e.target.style.borderColor = 'var(--b2)')}
        />

        {/* Sort */}
        <select
          value={achSort}
          onChange={(e) => setAchSort(e.target.value as AchSort)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '7px 10px',
            fontSize: 13,
            color: 'var(--txt)',
            outline: 'none',
          }}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <span style={{ fontSize: 11, color: 'var(--txt3)', whiteSpace: 'nowrap' }}>
          {achievements.length} / {game.achievements.length}
        </span>
      </div>

      {/* Achievement list */}
      <div className="ach-list" id="ach-list">
        {achievements.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--txt3)' }}>
            {achSearch
              ? `Nenhuma conquista encontrada para "${achSearch}"`
              : 'Nenhuma conquista nesta categoria.'}
          </div>
        ) : (
          achievements.map((ach) => (
            <AchievementItem key={ach.apiName} achievement={ach} />
          ))
        )}
      </div>
    </div>
  );
};

export default GameDetailView;
