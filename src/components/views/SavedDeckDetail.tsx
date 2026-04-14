// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/SavedDeckDetail.tsx
//  Displays cards from a saved deck
// ─────────────────────────────────────────────────────────────────────────────

import React, { useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import TrophyCard from './TrophyCard';
import { RARITY_TIERS } from '../../utils/duelUtils';

const DUEL_SORTS: { value: 'damage-desc' | 'damage-asc' | 'rarity-desc' | 'rarity-asc' | 'name'; label: string }[] = [
  { value: 'damage-desc', label: '🔥 Dano (maior)' },
  { value: 'damage-asc', label: '🔥 Dano (menor)' },
  { value: 'rarity-desc', label: '✨ Raridade (maior)' },
  { value: 'rarity-asc', label: '✨ Raridade (menor)' },
  { value: 'name', label: '🔤 Nome' },
];

const RARITY_FILTERS: { value: 'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'common', label: 'Comum' },
  { value: 'uncommon', label: 'Incomum' },
  { value: 'rare', label: 'Rara' },
  { value: 'epic', label: 'Épica' },
  { value: 'legendary', label: 'Lendária' },
  { value: 'mythic', label: 'Mítica' },
];

const SavedDeckDetail: React.FC = () => {
  const savedDecks = useAppStore((s) => s.savedDecks);
  const viewingSavedDeckId = useAppStore((s) => s.viewingSavedDeckId);
  const games = useAppStore((s) => s.games);
  const viewSavedDeck = useAppStore((s) => s.viewSavedDeck);

  const [sortKey, setSortKey] = useState<'damage-desc' | 'damage-asc' | 'rarity-desc' | 'rarity-asc' | 'name'>('damage-desc');
  const [rarityFilter, setRarityFilter] = useState<'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const deck = useMemo(
    () => savedDecks.find((d) => d.id === viewingSavedDeckId),
    [savedDecks, viewingSavedDeckId]
  );

  if (!deck) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: 'var(--txt2)' }}>Deck não encontrado</div>
        <button onClick={() => viewSavedDeck(null)} style={{ marginTop: 16 }}>
          ← Voltar
        </button>
      </div>
    );
  }

  // Get games info
  const deckGames = deck.gameIds
    .map((id) => games.find((g) => g.appId === id))
    .filter((g): g is NonNullable<typeof g> => g !== undefined);

  // Filter and sort cards
  const filteredCards = useMemo(() => {
    let cards = deck.cards;

    if (rarityFilter !== 'all') {
      cards = cards.filter((c) => c.rarity === rarityFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      cards = cards.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.gameName.toLowerCase().includes(q)
      );
    }

    // Sort by selected key
    cards = [...cards];
    switch (sortKey) {
      case 'damage-desc':
        cards.sort((a, b) => b.damage - a.damage);
        break;
      case 'damage-asc':
        cards.sort((a, b) => a.damage - b.damage);
        break;
      case 'rarity-desc':
        cards.sort((a, b) => b.damage - a.damage);
        break;
      case 'rarity-asc':
        cards.sort((a, b) => a.damage - b.damage);
        break;
      case 'name':
        cards.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    return cards;
  }, [deck.cards, rarityFilter, searchQuery, sortKey]);

  // Calculate total damage
  const totalDamage = deck.cards.reduce((sum, c) => sum + c.damage, 0);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => viewSavedDeck(null)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--accent)',
            cursor: 'pointer',
            fontSize: 14,
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Voltar aos decks
        </button>

        <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px 0' }}>
          {deck.name}
        </h2>

        <div style={{ fontSize: 13, color: 'var(--txt2)', marginBottom: 12 }}>
          {deck.cards.length} cartas · {deckGames.length} jogos · Dano total: {totalDamage}
        </div>

        {/* Games in this deck */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {deckGames.map((game) => (
            <div
              key={game.appId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'var(--bg3)',
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <img
                src={game.headerImage}
                alt={game.name}
                style={{ width: 40, height: 18, borderRadius: 2, objectFit: 'cover' }}
              />
              <span>{game.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <input
          type="text"
          placeholder="🔍 Buscar carta..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--txt)',
            outline: 'none',
            flex: 1,
            minWidth: 150,
          }}
        />

        <select
          value={rarityFilter}
          onChange={(e) => setRarityFilter(e.target.value as typeof rarityFilter)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--txt)',
            cursor: 'pointer',
          }}
        >
          {RARITY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
          style={{
            background: 'var(--bg3)',
            border: '1px solid var(--b2)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--txt)',
            cursor: 'pointer',
          }}
        >
          {DUEL_SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Cards Grid - Same style as deck creation */}
      <div className="duel-card-grid">
        {filteredCards.map((card, index) => (
          <TrophyCard key={card.id} card={card} index={index} />
        ))}
      </div>

      {filteredCards.length === 0 && (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--txt2)' }}>
          Nenhuma carta encontrada com estes filtros.
        </div>
      )}
    </div>
  );
};

export default SavedDeckDetail;
