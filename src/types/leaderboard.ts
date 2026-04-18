export interface LeaderboardEntry {
  steamId      : string;
  personaName  : string;
  avatarUrl    : string;
  profileUrl   : string;
  rank         : number;
  isMe         : boolean;
  isPrivate    : boolean;
  totalAch     : number | null;
  platCount    : number | null;
  rareCount    : number | null;
  gameCount    : number;
  registeredAt : number | null;
}

export type LeaderboardStatus = 'idle' | 'loading' | 'ok' | 'error';
