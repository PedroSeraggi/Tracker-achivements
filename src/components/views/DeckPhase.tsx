// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/DeckPhase.tsx
//  Phase 3 of Trophy Duel: display the generated deck with controls.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo } from 'react';
import TrophyCard from './TrophyCard';
import type { TrophyCard as TrophyCardType } from '../../types/duel';
import type { DuelSortKey, DuelRarityFilter } from '../../types/duel';
import {
  RARITY_TIERS,
  SORT_OPTIONS,
  FILTER_OPTIONS,
  buildRarityStats,
  sortCards,
  filterCards,
} from '../../utils/duelUtils';

interface DeckPhaseProps {
  allCards      : TrophyCardType[];
  sortKey       : DuelSortKey;
  rarityFilter  : DuelRarityFilter;
  searchQuery   : string;
  onSort        : (key: DuelSortKey) => void;
  onFilter      : (filter: DuelRarityFilter) => void;
  onSearch      : (query: string) => void;
  onReset       : () => void;
}

const DeckPhase: React.FC<DeckPhaseProps> = ({
  allCards,
  sortKey,
  rarityFilter,
  searchQuery,
  onSort,
  onFilter,
  onSearch,
  onReset,
}) => {
  // Memoized so sort/filter don't re-run on unrelated parent renders
  const stats = useMemo(() => buildRarityStats(allCards), [allCards]);

  const visibleCards = useMemo(() => {
    let cards = allCards;
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.gameName.toLowerCase().includes(q) ||
          (c.description?.toLowerCase() || '').includes(q)
      );
    }
    cards = filterCards(cards, rarityFilter);
    cards = sortCards(cards, sortKey);
    return cards;
  }, [allCards, sortKey, rarityFilter, searchQuery]);

  return (
    <div id="view-duel">
      {/* Top bar */}
      <div className="duel-topbar">
        <div>
          <div className="duel-topbar-title">⚔️ Trophy Duel — Seu Deck</div>
          <div className="duel-topbar-sub">{allCards.length} cartas geradas</div>
        </div>
        <button className="btn-duel-reset" onClick={onReset}>
          ↺ Novo Deck
        </button>
      </div>

      {/* Stats bar */}
      <div className="duel-deck-stats">
        {RARITY_TIERS.filter((t) => stats[t.name] > 0).map((tier) => (
          <div key={tier.name} className="duel-stat-pill">
            <span className={`pill-dot dot-${tier.name}`} />
            <span>{tier.label}</span>
            <span className="pill-count">{stats[tier.name]}</span>
          </div>
        ))}
        <span className="duel-total-cards">{visibleCards.length} cartas exibidas</span>
      </div>

      {/* Sort + Filter controls */}
      <div className="duel-controls">
        <span className="duel-sort-label">ORDENAR:</span>
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            className={`duel-sort-btn${sortKey === opt.key ? ' active' : ''}`}
            onClick={() => onSort(opt.key)}
          >
            {opt.label}
          </button>
        ))}

        <div className="duel-filter-sep" />

        <span className="duel-sort-label">FILTRAR:</span>
        {FILTER_OPTIONS.filter(
          (opt) => opt.key === 'all' || (stats[opt.key as keyof typeof stats] ?? 0) > 0
        ).map((opt) => (
          <button
            key={opt.key}
            className={`duel-sort-btn${rarityFilter === opt.key ? ' active' : ''}`}
            onClick={() => onFilter(opt.key as DuelRarityFilter)}
          >
            {opt.label}
          </button>
        ))}

        <div className="duel-filter-sep" />

        {/* Search input */}
        <span className="duel-sort-label">BUSCAR:</span>
        <input
          type="text"
          placeholder="🔍 Nome do jogo, conquista..."
          value={searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '6px 12px',
            fontSize: 13,
            color: 'var(--txt)',
            outline: 'none',
            width: 220,
            transition: 'border-color .2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--b2)')}
        />
      </div>

      {/* Card grid */}
      <div className="duel-card-grid">
        {visibleCards.length === 0 ? (
          <div className="duel-empty-state" style={{ gridColumn: '1 / -1' }}>
            <div className="duel-empty-icon">🃏</div>
            <div className="duel-empty-title">Nenhuma carta com esse filtro</div>
            <div className="duel-empty-sub">
              Remova o filtro de raridade para ver todas as cartas.
            </div>
          </div>
        ) : (
          visibleCards.map((card, index) => (
            <TrophyCard key={card.id} card={card} index={index} />
          ))
        )}
      </div>
    </div>
  );
};

export default DeckPhase;
