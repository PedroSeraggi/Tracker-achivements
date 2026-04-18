import type {
  SteamUser,
  Game,
  Achievement,
  TrophyTier,
  ApiAchievement,
  ApiGame,
} from '../types';
import type { ProfileBackground } from '../hooks/useProfileData';

const BASE = ''; // same-origin — proxied by Vite → Express

// ─── Session cache (survives ErrorBoundary resets within the tab) ─────────────
const CACHE_KEY = 'st_games_v1';

function saveCache(steamId: string, games: Game[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ steamId, games, ts: Date.now() }));
  } catch { /* storage full — ignore */ }
}

function loadCache(steamId: string): Game[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { steamId: string; games: Game[]; ts: number };
    const THIRTY_MIN = 30 * 60 * 1000;
    if (parsed.steamId !== steamId || Date.now() - parsed.ts > THIRTY_MIN) return null;
    return parsed.games;
  } catch {
    return null;
  }
}

export function clearGamesCache(): void {
  sessionStorage.removeItem(CACHE_KEY);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function trophyTier(pct: number, total: number): TrophyTier {
  if (total === 0) return 'none';
  if (pct === 100) return 'platinum';
  if (pct >= 75) return 'gold';
  if (pct >= 40) return 'silver';
  if (pct > 0) return 'bronze';
  return 'none';
}

function achievementTier(globalPercent?: number): TrophyTier {
  if (globalPercent == null) return 'bronze';
  if (globalPercent <= 5) return 'platinum';   // Very rare
  if (globalPercent <= 15) return 'gold';      // Rare
  if (globalPercent <= 30) return 'silver';   // Uncommon
  return 'bronze';                            // Common
}

function mapAchievement(a: ApiAchievement): Achievement {
  const globalPercent = a.percent != null ? Number(a.percent) : undefined;
  return {
    apiName:      a.apiname,
    displayName:  a.name,
    description:  a.description,
    iconUrl:      a.icon,
    iconGrayUrl:  a.icongray,
    achieved:     a.achieved === 1,
    unlockTime:   a.unlocktime || undefined,
    // Steam API may return string "12.5" — always coerce to number
    globalPercent: globalPercent,
    tier:         achievementTier(globalPercent),
  };
}

function mapGame(raw: ApiGame, achievements: Achievement[]): Game {
  const total    = achievements.length;
  const unlocked = achievements.filter((a) => a.achieved).length;
  const pct      = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  return {
    appId:           raw.appid,
    name:            raw.name,
    headerImage:     `https://cdn.akamai.steamstatic.com/steam/apps/${raw.appid}/header.jpg`,
    heroImage:       `https://cdn.akamai.steamstatic.com/steam/apps/${raw.appid}/library_hero.jpg`,
    playtimeForever: raw.playtime_forever,
    achievements,
    unlockedCount:   unlocked,
    totalCount:      total,
    percentage:      pct,
    trophyTier:      trophyTier(pct, total),
  };
}

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Concurrency pool ─────────────────────────────────────────────────────────
/** Runs `tasks` with at most `limit` in-flight at the same time. */
async function pool<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<(T | null)[]> {
  const results: (T | null)[] = new Array(tasks.length).fill(null);
  let nextIdx = 0;

  async function worker() {
    while (nextIdx < tasks.length) {
      const i = nextIdx++;
      try { results[i] = await tasks[i](); }
      catch { results[i] = null; }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, worker)
  );
  return results;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export async function fetchMe(): Promise<SteamUser | null> {
  try { return await apiFetch<SteamUser>('/api/me'); }
  catch { return null; }
}

export function getLoginUrl(): string { return '/auth/steam'; }

export async function logoutRequest(): Promise<void> {
  await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
}

// ─── Games ────────────────────────────────────────────────────────────────────
export async function fetchGames(
  steamId?: string,
  onProgress?: (name: string, pct: number) => void,
  forceRefresh = false
): Promise<Game[]> {
  // Return cached data instantly if available and not a forced refresh
  if (!forceRefresh && steamId) {
    const cached = loadCache(steamId);
    if (cached) {
      onProgress?.('(cache)', 100);
      return cached;
    }
  }

  // Use /library endpoint for other players to get complete game list
  const url      = steamId ? `/api/player/${steamId}/library` : '/api/games';
  const rawGames = await apiFetch<ApiGame[]>(url);
  const eligible = rawGames.filter((g) => g.has_community_visible_stats);
  const total    = eligible.length;
  let   done     = 0;

  const tasks = eligible.map((raw) => async (): Promise<Game> => {
    const achievements = await fetchAchievements(raw.appid, steamId);
    const game         = mapGame(raw, achievements);
    done++;
    onProgress?.(raw.name, Math.round(5 + (done / total) * 90));
    return game;
  });

  // 5 parallel workers — ~5× faster than serial, safe for Steam rate limits
  const settled = await pool<Game>(tasks, 5);
  const games   = settled.filter((g): g is Game => g !== null);

  if (steamId) saveCache(steamId, games);
  return games;
}

export async function fetchAchievements(
  appId: number,
  steamId?: string
): Promise<Achievement[]> {
  const url = steamId
    ? `/api/player/${steamId}/games/${appId}/achievements`
    : `/api/games/${appId}/achievements`;
  const raw = await apiFetch<ApiAchievement[]>(url);
  return raw.map(mapAchievement);
}

// ─── Player search ────────────────────────────────────────────────────────────
export async function searchPlayer(query: string): Promise<SteamUser> {
  return apiFetch<SteamUser>(`/api/search?q=${encodeURIComponent(query)}`);
}

// ─── Player profile background ───────────────────────────────────────────────
export async function fetchPlayerBackground(steamId: string): Promise<ProfileBackground> {
  return apiFetch<ProfileBackground>(`/api/player/${steamId}/background`);
}

// ─── Guides ───────────────────────────────────────────────────────────────────
export function generateGuideId(): string {
  return `guide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────
import type { LeaderboardEntry } from '../types';

export async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  const res = await fetch('/api/leaderboard', { credentials: 'include' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function invalidateLeaderboardCache(): Promise<void> {
  await fetch('/api/leaderboard/cache', {
    method     : 'DELETE',
    credentials: 'include',
  });
}

export async function registerLeaderboardStats(stats: {
  totalAch : number;
  platCount: number;
  rareCount: number;
  gameCount: number;
}): Promise<void> {
  await fetch('/api/leaderboard/register', {
    method     : 'POST',
    credentials: 'include',
    headers    : { 'Content-Type': 'application/json' },
    body       : JSON.stringify(stats),
  });
}
