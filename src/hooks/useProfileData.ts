// ─────────────────────────────────────────────────────────────────────────────
//  src/hooks/useProfileData.ts
//  Fetches Steam profile background and recently played games.
//  Both endpoints are provided by server-profile-patch.js.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileBackground {
  communityitemid  ?: string;
  /** Path relative to Steam CDN, e.g. "items/1239690/abc...jpg" */
  image_large      ?: string;
  name             ?: string;
  item_title       ?: string;
  item_description ?: string;
  appid            ?: number;
  /** Path to .webm video (may be absent for static backgrounds) */
  movie_webm       ?: string;
  movie_mp4        ?: string;
  movie_webm_small ?: string;
  movie_mp4_small  ?: string;
}

export interface RecentGame {
  appid               : number;
  name                : string;
  /** Minutes played in the last two weeks */
  playtime_2weeks     : number;
  /** Total minutes played */
  playtime_forever    : number;
  /** Used to build icon URL */
  img_icon_url        : string;
}

/** Base URL for all Steam community media assets */
const STEAM_CDN = 'https://cdn.akamai.steamstatic.com/steamcommunity/public/images';

/** Build the full URL for a profile background image */
export function bgImageUrl(path: string): string {
  return `${STEAM_CDN}/${path}`;
}

/** Build the full URL for a profile background video */
export function bgVideoUrl(path: string): string {
  return `${STEAM_CDN}/${path}`;
}

/** Build the icon URL for a recently played game */
export function gameIconUrl(appid: number, iconHash: string): string {
  if (!iconHash) return '';
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${iconHash}.jpg`;
}

/** Format minutes as "Xh Ym" or just "Xh" if no remainder */
export function formatPlaytime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface ProfileData {
  background    : ProfileBackground | null;
  recentGames   : RecentGame[];
  loadingBg     : boolean;
  loadingRecent : boolean;
  errorBg       : string | null;
  errorRecent   : string | null;
}

export function useProfileData(): ProfileData {
  const [background,    setBackground]    = useState<ProfileBackground | null>(null);
  const [recentGames,   setRecentGames]   = useState<RecentGame[]>([]);
  const [loadingBg,     setLoadingBg]     = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [errorBg,       setErrorBg]       = useState<string | null>(null);
  const [errorRecent,   setErrorRecent]   = useState<string | null>(null);

  // Fetch profile background
  useEffect(() => {
    let cancelled = false;
    setLoadingBg(true);

    fetch('/api/profile/background', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        console.log('[Profile] Background API response:', data);
        if (!cancelled) {
          setBackground(data?.profile_background ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorBg('Não foi possível carregar o background');
      })
      .finally(() => {
        if (!cancelled) setLoadingBg(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Fetch recently played games
  useEffect(() => {
    let cancelled = false;
    setLoadingRecent(true);

    fetch('/api/profile/recent-games', { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => {
        if (!cancelled) {
          setRecentGames(data?.games ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) setErrorRecent('Não foi possível carregar jogos recentes');
      })
      .finally(() => {
        if (!cancelled) setLoadingRecent(false);
      });

    return () => { cancelled = true; };
  }, []);

  return { background, recentGames, loadingBg, loadingRecent, errorBg, errorRecent };
}
