// ─────────────────────────────────────────────────────────────────────────────
//  src/store/useBattleStore.ts  (FIXED)
//
//  Bugs fixed:
//    1. resolveRound() was computing gameWinner locally but NOT passing it to
//       set() → gameWinner stayed null → bot always appeared to win. Fixed by
//       adding gameWinner to the set() call.
//    2. tickTimer() auto-selected from botHand instead of playerHand when time
//       ran out. Fixed to use the correct playerHand.
//    3. resolveRound() could be called twice (tickTimer + useEffect) causing
//       a double-resolve. Added an early-return guard.
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { TrophyCard, RarityName } from '../types/duel';
import type { Game, Achievement } from '../types';

export type BattlePhase = 'select-deck' | 'battle' | 'round-result' | 'game-over';

interface BattleState {
  phase            : BattlePhase;
  playerDeck       : TrophyCard[];
  botDeck          : TrophyCard[];
  playerHand       : TrophyCard[];
  botHand          : TrophyCard[];
  playerScore      : number;
  botScore         : number;
  round            : number;
  selectedPlayerCard : TrophyCard | null;
  selectedBotCard    : TrophyCard | null;
  roundWinner      : 'player' | 'bot' | 'draw' | null;
  gameWinner       : 'player' | 'bot' | null;
  timeLeft         : number;
  isTimerRunning   : boolean;
  /** Prevents resolveRound() from running twice in the same round */
  isResolving      : boolean;
  /** Card currently being "played" (animating to center) */
  playingCard      : TrophyCard | null;
}

interface BattleActions {
  startBattle   : (playerDeck: TrophyCard[], playerGames: Game[]) => void;
  selectCard    : (card: TrophyCard) => void;
  botPlay       : () => void;
  resolveRound  : () => void;
  nextRound     : () => void;
  resetBattle   : () => void;
  tickTimer     : () => void;
}

const INITIAL_STATE: BattleState = {
  phase            : 'select-deck',
  playerDeck       : [],
  botDeck          : [],
  playerHand       : [],
  botHand          : [],
  playerScore      : 0,
  botScore         : 0,
  round            : 1,
  selectedPlayerCard : null,
  selectedBotCard    : null,
  roundWinner      : null,
  gameWinner       : null,
  timeLeft         : 10,
  isTimerRunning   : false,
  isResolving      : false,
  playingCard      : null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function drawRandomCards(
  deck  : TrophyCard[],
  count : number
): { drawn: TrophyCard[]; remaining: TrophyCard[] } {
  if (deck.length === 0) return { drawn: [], remaining: [] };
  if (count >= deck.length) return { drawn: [...deck], remaining: [] };
  const shuffled  = shuffleArray(deck);
  return { drawn: shuffled.slice(0, count), remaining: shuffled.slice(count) };
}

function calcBotDamage(globalPercent: number): number {
  return Math.round((100 - Math.min(100, Math.max(0, globalPercent))) * 10);
}

function getBotRarity(damage: number): { name: RarityName; label: string; emoji: string } {
  if (damage >= 970) return { name: 'mythic',    label: '✦ Mythic',    emoji: '🌟' };
  if (damage >= 850) return { name: 'legendary', label: '★ Legendary', emoji: '🏆' };
  if (damage >= 700) return { name: 'epic',       label: '◆ Epic',       emoji: '💎' };
  if (damage >= 500) return { name: 'rare',       label: '◇ Rare',       emoji: '🔷' };
  if (damage >= 300) return { name: 'uncommon',   label: '○ Uncommon',   emoji: '🟢' };
  return               { name: 'common',    label: '● Common',    emoji: '⚪' };
}

const RARITY_PCT_RANGE: Record<string, [number, number]> = {
  common   : [60, 95],
  uncommon : [30, 60],
  rare     : [10, 30],
  epic     : [3,  10],
  legendary: [0.5, 3],
  mythic   : [0.01, 0.5],
};

const SYNTHETIC_ACHIEVEMENTS = [
  { name: 'First Blood',          description: 'Complete the tutorial',       gameName: 'Counter-Strike 2',      gameAppId: 730,      rarity: 'common'    },
  { name: 'Welcome',              description: 'Complete the first mission',  gameName: 'Dota 2',                gameAppId: 570,      rarity: 'common'    },
  { name: 'Newbie',               description: 'Reach level 5',              gameName: 'Team Fortress 2',       gameAppId: 440,      rarity: 'common'    },
  { name: 'First Steps',          description: 'Complete your first match',  gameName: 'Apex Legends',          gameAppId: 1172470,  rarity: 'common'    },
  { name: 'Rookie',               description: 'Win your first game',        gameName: 'Rocket League',         gameAppId: 252950,   rarity: 'common'    },
  { name: 'Veteran',              description: 'Reach level 25',             gameName: 'Counter-Strike 2',      gameAppId: 730,      rarity: 'uncommon'  },
  { name: 'Champion',             description: 'Win 10 matches',             gameName: 'Team Fortress 2',       gameAppId: 440,      rarity: 'uncommon'  },
  { name: 'Elite',                description: 'Reach level 50',             gameName: 'Counter-Strike 2',      gameAppId: 730,      rarity: 'rare'      },
  { name: 'Grand Champion',       description: 'Reach Grand Champion rank',  gameName: 'Rocket League',         gameAppId: 252950,   rarity: 'rare'      },
  { name: 'Godlike',              description: 'Reach level 100',            gameName: 'Counter-Strike 2',      gameAppId: 730,      rarity: 'epic'      },
  { name: 'Global Elite',         description: 'Reach Global Elite rank',    gameName: 'Counter-Strike 2',      gameAppId: 730,      rarity: 'legendary' },
  { name: 'Rocket God',           description: 'Win 5000 matches',           gameName: 'Rocket League',         gameAppId: 252950,   rarity: 'legendary' },
  { name: 'The One',              description: 'Complete the impossible',    gameName: 'Half-Life 2',           gameAppId: 220,      rarity: 'mythic'    },
  { name: 'Steam God',            description: 'Collect all rare items',     gameName: 'Portal 2',             gameAppId: 620,      rarity: 'mythic'    },
] as const;

const GAME_HEADERS: Record<number, string> = {
  730: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
  570: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
  440: 'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg',
  1172470: 'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg',
  252950: 'https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg',
  252490: 'https://cdn.akamai.steamstatic.com/steam/apps/252490/header.jpg',
  230410: 'https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg',
  346110: 'https://cdn.akamai.steamstatic.com/steam/apps/346110/header.jpg',
  105600: 'https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg',
  220: 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg',
  620: 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',
};

function generateBotDeck(playerGames: Game[]): TrophyCard[] {
  const pool: Array<{ achievement: Achievement; game: Game }> = [];
  for (const game of playerGames) {
    for (const ach of game.achievements) {
      pool.push({ achievement: ach, game });
    }
  }

  if (pool.length === 0) return generateSyntheticBotDeck();

  const shuffled = shuffleArray(pool);
  const selected = shuffled.slice(0, Math.min(20, shuffled.length));

  return selected.map(({ achievement, game }, i) => {
    const globalPercent = achievement.globalPercent
      ?? Math.random() * 60 + 5;
    const damage = calcBotDamage(globalPercent);
    const rarity = getBotRarity(damage);
    return {
      id           : `bot-${i}`,
      apiName      : achievement.apiName,
      name         : achievement.displayName,
      description  : achievement.description,
      iconUrl      : achievement.iconUrl,
      gameAppId    : game.appId,
      gameName     : game.name,
      gameHeaderUrl: game.headerImage,
      damage,
      rarity       : rarity.name,
      rarityLabel  : rarity.label,
      rarityEmoji  : rarity.emoji,
      globalPercent,
    } satisfies TrophyCard;
  });
}

function generateSyntheticBotDeck(): TrophyCard[] {
  const list = shuffleArray([...SYNTHETIC_ACHIEVEMENTS]).slice(0, 20);
  return list.map((ach, i) => {
    const [min, max] = RARITY_PCT_RANGE[ach.rarity];
    const globalPercent = Math.random() * (max - min) + min;
    const damage        = calcBotDamage(globalPercent);
    const rarity        = getBotRarity(damage);
    return {
      id           : `bot-synth-${i}`,
      apiName      : ach.name.toLowerCase().replace(/\s+/g, '_'),
      name         : ach.name,
      description  : ach.description,
      iconUrl      : '',
      gameAppId    : ach.gameAppId,
      gameName     : ach.gameName,
      gameHeaderUrl: GAME_HEADERS[ach.gameAppId] ?? '',
      damage,
      rarity       : rarity.name,
      rarityLabel  : rarity.label,
      rarityEmoji  : rarity.emoji,
      globalPercent,
    } satisfies TrophyCard;
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBattleStore = create<BattleState & BattleActions>((set, get) => ({
  ...INITIAL_STATE,

  startBattle: (playerDeck, playerGames) => {
    const botDeck    = generateBotDeck(playerGames);
    const playerDraw = drawRandomCards(playerDeck, 5);
    const botDraw    = drawRandomCards(botDeck,   5);

    set({
      ...INITIAL_STATE,
      phase          : 'battle',
      playerDeck     : playerDraw.remaining,
      botDeck        : botDraw.remaining,
      playerHand     : playerDraw.drawn,
      botHand        : botDraw.drawn,
      timeLeft       : 10,
      isTimerRunning : true,
    });
  },

  selectCard: (card) => {
    // Only allow selection when in battle phase and no card already chosen
    const { phase, selectedPlayerCard } = get();
    if (phase !== 'battle' || selectedPlayerCard) return;
    set({ selectedPlayerCard: card, playingCard: card });
  },

  botPlay: () => {
    const { botHand, selectedBotCard } = get();
    if (selectedBotCard || botHand.length === 0) return;
    const idx = Math.floor(Math.random() * botHand.length);
    set({ selectedBotCard: botHand[idx] });
  },

  resolveRound: () => {
    const {
      selectedPlayerCard,
      selectedBotCard,
      playerScore,
      botScore,
      round,
      isResolving,
    } = get();

    // ── GUARD: prevent double-resolve ──────────────────────
    if (isResolving) return;
    if (!selectedPlayerCard || !selectedBotCard) return;

    set({ isResolving: true });

    const roundWinner: 'player' | 'bot' | 'draw' =
      selectedPlayerCard.damage > selectedBotCard.damage ? 'player'
      : selectedBotCard.damage > selectedPlayerCard.damage ? 'bot'
      : 'draw';

    const newPlayerScore = roundWinner === 'player' ? playerScore + 1 : playerScore;
    const newBotScore    = roundWinner === 'bot'    ? botScore    + 1 : botScore;

    // ── Determine if game is over ──────────────────────────
    // FIX: gameWinner WAS computed here but never passed to set()
    let gameWinner: 'player' | 'bot' | null = null;
    let phase: BattlePhase = 'round-result';

    if (newPlayerScore >= 5) {
      gameWinner = 'player';
      phase      = 'game-over';
    } else if (newBotScore >= 5) {
      gameWinner = 'bot';
      phase      = 'game-over';
    }

    set({
      phase,
      roundWinner,
      playerScore    : newPlayerScore,
      botScore       : newBotScore,
      gameWinner,           // ← THE FIX: was missing before
      isTimerRunning : false,
      isResolving    : false,
      playingCard    : null,
    });
  },

  nextRound: () => {
    const {
      playerDeck, botDeck,
      playerHand, botHand,
      selectedPlayerCard, selectedBotCard,
      round,
    } = get();

    const newPlayerHand = playerHand.filter((c) => c.id !== selectedPlayerCard?.id);
    const newBotHand    = botHand.filter((c) => c.id !== selectedBotCard?.id);

    const playerDraw = drawRandomCards(playerDeck, 1);
    const botDraw    = drawRandomCards(botDeck,    1);

    set({
      phase          : 'battle',
      playerHand     : playerDraw.drawn.length > 0 ? [...newPlayerHand, playerDraw.drawn[0]] : newPlayerHand,
      botHand        : botDraw.drawn.length    > 0 ? [...newBotHand,    botDraw.drawn[0]]    : newBotHand,
      playerDeck     : playerDraw.remaining,
      botDeck        : botDraw.remaining,
      selectedPlayerCard : null,
      selectedBotCard    : null,
      roundWinner    : null,
      round          : round + 1,
      timeLeft       : 10,
      isTimerRunning : true,
      isResolving    : false,
      playingCard    : null,
    });
  },

  tickTimer: () => {
    const { timeLeft, isTimerRunning, phase, playerHand } = get();

    if (!isTimerRunning || phase !== 'battle') return;

    if (timeLeft <= 1) {
      const { selectedPlayerCard } = get();

      // FIX: was incorrectly using botHand[0] — now uses playerHand[0]
      if (!selectedPlayerCard && playerHand.length > 0) {
        set({ selectedPlayerCard: playerHand[0], playingCard: playerHand[0] });
      }

      // Force bot to play too
      const { botHand, selectedBotCard } = get();
      if (!selectedBotCard && botHand.length > 0) {
        const idx = Math.floor(Math.random() * botHand.length);
        set({ selectedBotCard: botHand[idx] });
      }

      set({ timeLeft: 0, isTimerRunning: false });

      setTimeout(() => { get().resolveRound(); }, 600);
    } else {
      set({ timeLeft: timeLeft - 1 });
    }
  },

  resetBattle: () => set({ ...INITIAL_STATE }),
}));
