// ─────────────────────────────────────────────────────────────────────────────
//  Types for Trophy Duel feature
// ─────────────────────────────────────────────────────────────────────────────

export type CardRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface TrophyCard {
  id           : string;
  apiName      : string;
  name  : string;   
  description  : string;
  iconUrl      : string;
  gameAppId    : number;
  gameName     : string;
  gameHeaderUrl: string;   // ← novo (URL header.jpg da CDN)
  damage       : number;   // ← não opcional
  rarity       : RarityName;
  rarityLabel  : string;   // ← novo ('★ Legendary', etc)
  rarityEmoji  : string;   // ← novo ('🏆', etc)
  globalPercent: number | null;
}
export interface DuelPlayer {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  deck: TrophyCard[];
  score: number;
}

export type DuelPhase = 'select' | 'loading' | 'deck';
export type DuelSortKey = 'damage-desc' | 'damage-asc' | 'game';

export interface DuelState {
  phase: DuelPhase;
  opponent: DuelPlayer | null;
  playerDeck: TrophyCard[];
  battleCards: {
    player: TrophyCard | null;
    opponent: TrophyCard | null;
  };
}

// Filter & Sort types

export type DuelRarityFilter = 'all' | CardRarity;

// Rarity system types
export interface RarityTier {
  name: RarityName;
  label: string;
  minDamage: number;
  emoji: string;
  color: string;
  glow?: string;
}

export type RarityName = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type RarityStats = Record<RarityName, number>;

// Saved deck type
export interface SavedDeck {
  id: string;
  name: string;
  cards: TrophyCard[];
  gameIds: number[];
  createdAt: string;
  updatedAt: string;
}
