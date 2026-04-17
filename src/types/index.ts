// ── Auth ──────────────────────────────────────────────────────────────────────
export interface SteamUser {
  steamId: string;
  personaName: string;
  realName?: string;
  avatarUrl: string;
  profileUrl: string;
  communityVisibilityState: number; // 3 = public
}

// ── Games ─────────────────────────────────────────────────────────────────────
export interface Game {
  appId: number;
  name: string;
  headerImage: string;
  heroImage: string;
  playtimeForever: number; // minutes
  achievements: Achievement[];
  // computed
  unlockedCount: number;
  totalCount: number;
  percentage: number;
  trophyTier: TrophyTier;
}

export type TrophyTier = 'none' | 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Achievement {
  apiName: string;
  displayName: string;
  description: string;
  iconUrl: string;
  iconGrayUrl: string;
  achieved: boolean;
  unlockTime?: number; // unix timestamp
  globalPercent?: number; // how many % of players have it
  tier?: TrophyTier; // bronze, silver, gold, platinum
}

// ── Filters & Sort ────────────────────────────────────────────────────────────
export type GameFilter = 'all' | 'started' | 'notstarted' | 'platinum';
export type AchFilter = 'all' | 'unlocked' | 'locked';
export type CompareFilter = 'all' | 'only_me' | 'only_them' | 'both' | 'neither';
export type GameSort =
  | 'name_asc'
  | 'name_desc'
  | 'pct_desc'
  | 'pct_asc'
  | 'playtime_desc'
  | 'recent';

// ── Views ─────────────────────────────────────────────────────────────────────
export type DashView = 'grid' | 'overview' | 'profile' | 'guides' | 'search' | 'duel';
export type Screen = 'login' | 'loading' | 'dashboard';

// ── Guides ────────────────────────────────────────────────────────────────────
export interface GuideStep {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
}

export interface Guide {
  id: string;
  title: string;
  gameAppId?: number;
  gameName?: string;
  achievementApiName?: string;
  achievementName?: string;
  steps: GuideStep[];
  authorSteamId: string;
  authorName: string;
  createdAt: number; // unix timestamp
  updatedAt: number;
}

// ── Player search ──────────────────────────────────────────────────────────────
export interface SearchedPlayer {
  user: SteamUser;
  games: Game[];
  gamesLoaded: boolean;
}

// ── Loading state ──────────────────────────────────────────────────────────────
export interface LoadingState {
  status: string;
  progress: number; // 0-100
  loadedGames: string[];
}

// ── Toast ──────────────────────────────────────────────────────────────────────
export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}
export interface ApiAchievement {
  apiname: string;
  name: string;
  description: string;
  icon: string;
  icongray: string;
  achieved: number;
  unlocktime: number;
  percent?: number;
}

export interface ApiGame {
  appid: number;
  name: string;
  img_icon_url?: string;
  playtime_forever: number;
  has_community_visible_stats: boolean;
}

export interface ProfileStats {
  totalGames: number;
  gamesWithAchievements: number;
  totalAchievements: number;
  unlockedAchievements: number;
  platinumGames: number;
  goldGames: number;
  silverGames: number;
  bronzeGames: number;
  totalXP: number;
  level: string;
  title: string;
  featuredGames: Game[];
}

// ── Featured Items (Profile Showcase) ─────────────────────────────────────────
export type FeaturedType = 'games' | 'achievements' | 'cards';

export interface FeaturedAchievement {
  gameAppId: number;
  apiName: string;
}

export interface FeaturedCard {
  // TrophyCard reference - stored as achievement reference
  gameAppId: number;
  apiName: string;
  // cached display data
  name?: string;
  iconUrl?: string;
  damage?: number;
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
}

export interface FeaturedSection {
  id: string;
  type: FeaturedType;
  title: string;
  // For games: array of appIds
  gameIds?: number[];
  // For achievements: array of achievement references
  achievements?: FeaturedAchievement[];
  // For cards: array of card data
  cards?: FeaturedCard[];
}
