// ─────────────────────────────────────────────────────────────────────────────
//  src/store/useDuelStore.ts
//  Zustand store for Trophy Duel state.
//  Kept separate from useAppStore to maintain clean feature isolation.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { TrophyCard, DuelPhase, DuelSortKey, DuelRarityFilter } from '../types/duel';
import { MAX_GAME_SELECTION } from '../utils/duelUtils';

interface DuelStore {
  // ── State ────────────────────────────────────────────────
  phase          : DuelPhase;
  selectedGameIds: Set<number>;
  cards          : TrophyCard[];
  sortKey        : DuelSortKey;
  rarityFilter   : DuelRarityFilter;
  searchQuery    : string;
  error          : string | null;

  // ── Actions ──────────────────────────────────────────────

  /** Toggle a game in/out of the selection (max 5) */
  toggleGame: (appId: number) => void;

  /** Set the phase directly (e.g. to 'loading') */
  setPhase: (phase: DuelPhase) => void;

  /** Store generated cards and transition to 'deck' phase */
  setCards: (cards: TrophyCard[]) => void;

  /** Store an error message and go back to 'select' phase */
  setError: (error: string) => void;

  /** Change sort key */
  setSortKey: (key: DuelSortKey) => void;

  /** Change rarity filter */
  setRarityFilter: (filter: DuelRarityFilter) => void;

  /** Change search query */
  setSearchQuery: (query: string) => void;

  /** Reset to initial state (clear deck + selection) */
  reset: () => void;
}

const INITIAL_STATE = {
  phase          : 'select' as DuelPhase,
  selectedGameIds: new Set<number>(),
  cards          : [] as TrophyCard[],
  sortKey        : 'damage-desc' as DuelSortKey,
  rarityFilter   : 'all' as DuelRarityFilter,
  searchQuery    : '' as string,
  error          : null as string | null,
};

export const useDuelStore = create<DuelStore>((set) => ({
  ...INITIAL_STATE,

  toggleGame: (appId) =>
    set((state) => {
      const ids = new Set(state.selectedGameIds);
      if (ids.has(appId)) {
        ids.delete(appId);
      } else if (ids.size < MAX_GAME_SELECTION) {
        ids.add(appId);
      }
      return { selectedGameIds: ids };
    }),

  setPhase: (phase) => set({ phase }),

  setCards: (cards) => set({ cards, phase: 'deck', error: null }),

  setError: (error) => set({ error, phase: 'select' }),

  setSortKey: (sortKey) => set({ sortKey }),

  setRarityFilter: (rarityFilter) => set({ rarityFilter }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  reset: () =>
    set({
      ...INITIAL_STATE,
      // Create a fresh Set so reference equality triggers re-render
      selectedGameIds: new Set<number>(),
      searchQuery: '',
    }),
}));
