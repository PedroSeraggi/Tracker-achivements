// ─────────────────────────────────────────────────────────────────────────────
//  src/utils/duelUtils.ts
//  Pure functions for the Trophy Duel feature.
//  No side-effects, no React imports — fully unit-testable.
// ─────────────────────────────────────────────────────────────────────────────

import type { Game } from '../types';
import type {
  TrophyCard,
  RarityTier,
  RarityName,
  RarityStats,
  DuelSortKey,
  DuelRarityFilter,
} from '../types/duel';

// ─── Constants ───────────────────────────────────────────────────────────────

export const MAX_GAME_SELECTION = 5;

/**
 * Rarity tiers ordered from highest to lowest.
 * A card's rarity is the first tier whose minDamage ≤ card.damage.
 *
 * damage = round((100 − globalPercent) × 10)
 *   globalPercent ≈ 1%   → damage ≈ 990  → Mythic
 *   globalPercent ≈ 10%  → damage ≈ 900  → Legendary
 *   globalPercent ≈ 25%  → damage ≈ 750  → Epic
 *   globalPercent ≈ 45%  → damage ≈ 550  → Rare
 *   globalPercent ≈ 65%  → damage ≈ 350  → Uncommon
 *   globalPercent ≈ 85%  → damage ≈ 150  → Common
 */
export const RARITY_TIERS: Readonly<RarityTier[]> = [
  { name: 'mythic',    label: '✦ Mythic',    minDamage: 970, emoji: '🌟', color: 'var(--rarity-mythic)'    },
  { name: 'legendary', label: '★ Legendary', minDamage: 850, emoji: '🏆', color: 'var(--rarity-legendary)' },
  { name: 'epic',      label: '◆ Epic',       minDamage: 700, emoji: '💎', color: 'var(--rarity-epic)'      },
  { name: 'rare',      label: '◇ Rare',       minDamage: 500, emoji: '🔷', color: 'var(--rarity-rare)'      },
  { name: 'uncommon',  label: '○ Uncommon',   minDamage: 300, emoji: '🟢', color: 'var(--rarity-uncommon)'  },
  { name: 'common',    label: '● Common',     minDamage: 0,   emoji: '⚪', color: 'var(--rarity-common)'    },
];

export const SORT_OPTIONS: { key: DuelSortKey; label: string }[] = [
  { key: 'damage-desc', label: '⚔ Dano ↓' },
  { key: 'damage-asc',  label: '⚔ Dano ↑' },
  { key: 'game',        label: '🎮 Jogo'   },
];

export const FILTER_OPTIONS: { key: DuelRarityFilter; label: string }[] = [
  { key: 'all',       label: 'Todas'        },
  { key: 'mythic',    label: '✦ Mythic'     },
  { key: 'legendary', label: '★ Legendary'  },
  { key: 'epic',      label: '◆ Epic'       },
  { key: 'rare',      label: '◇ Rare'       },
  { key: 'uncommon',  label: '○ Uncommon'   },
  { key: 'common',    label: '● Common'     },
];

// ─── Core Calculations ───────────────────────────────────────────────────────

/**
 * Calculate the card's damage value from a global unlock percentage.
 *
 * Formula: damage = round((100 − globalPercent) × 10)
 *
 * Range: 0 (everyone unlocked it) → 1000 (nobody unlocked it)
 * When globalPercent is unknown → 500 (neutral mid-tier)
 */
export function calcDamage(globalPercent: number | undefined | null): number {
  if (globalPercent == null || isNaN(globalPercent)) return 500;
  return Math.round((100 - Math.min(100, Math.max(0, globalPercent))) * 10);
}

/** Find the rarity tier for a given damage value */
export function getRarityFromDamage(damage: number): RarityTier {
  for (const tier of RARITY_TIERS) {
    if (damage >= tier.minDamage) return tier;
  }
  return RARITY_TIERS[RARITY_TIERS.length - 1];
}

// ─── Card Generation ─────────────────────────────────────────────────────────

/**
 * Build a single TrophyCard from an Achievement + its parent Game.
 * This is a pure function — same inputs always produce the same card.
 */
export function buildCard(
  achievement: Game['achievements'][number],
  game: Game,
): TrophyCard {
  const damage = calcDamage(achievement.globalPercent);
  const rarity = getRarityFromDamage(damage);

  return {
    id            : `${game.appId}::${achievement.apiName}`,
    apiName       : achievement.apiName,
    name   : achievement.displayName,
    description   : achievement.description,
    iconUrl       : achievement.iconUrl ?? '',
    gameAppId     : game.appId,
    gameName      : game.name,
    gameHeaderUrl : game.headerImage,
    damage,
    rarity        : rarity.name,
    rarityLabel   : rarity.label,
    rarityEmoji   : rarity.emoji,
    globalPercent : achievement.globalPercent ?? null,
  };
}

/**
 * Generate all TrophyCards for a single game.
 * Only creates cards for achievements the player has unlocked.
 */
export function generateCardsForGame(game: Game): TrophyCard[] {
  return game.achievements
    .filter((a) => a.achieved)
    .map((a)    => buildCard(a, game));
}

/**
 * Generate cards for multiple selected games at once.
 * Returns a flat array of all cards combined.
 */
export function generateDeck(games: Game[]): TrophyCard[] {
  return games.flatMap(generateCardsForGame);
}

// ─── Sort & Filter ───────────────────────────────────────────────────────────

/** Sort a card array by the given key (non-mutating). */
export function sortCards(cards: TrophyCard[], sortKey: DuelSortKey): TrophyCard[] {
  const copy = [...cards];
  switch (sortKey) {
    case 'damage-desc': return copy.sort((a, b) => b.damage - a.damage);
    case 'damage-asc':  return copy.sort((a, b) => a.damage - b.damage);
    case 'game':        return copy.sort((a, b) =>
      a.gameName.localeCompare(b.gameName) || b.damage - a.damage
    );
  }
}

/** Filter a card array by rarity (non-mutating). */
export function filterCards(cards: TrophyCard[], rarityFilter: DuelRarityFilter): TrophyCard[] {
  if (rarityFilter === 'all') return cards;
  return cards.filter((c) => c.rarity === rarityFilter);
}

/**
 * Count how many cards of each rarity tier are in the deck.
 * Used to render the stats pills and to hide filter buttons with 0 cards.
 */
export function buildRarityStats(cards: TrophyCard[]): RarityStats {
  const stats = Object.fromEntries(
    RARITY_TIERS.map((t) => [t.name, 0])
  ) as RarityStats;

  for (const card of cards) {
    stats[card.rarity]++;
  }
  return stats;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filter the full games list down to games eligible for the Duel:
 * only games that have at least one unlocked achievement.
 */
export function getEligibleGames(games: Game[]): Game[] {
  return games.filter((g) => g.unlockedCount > 0);
}
