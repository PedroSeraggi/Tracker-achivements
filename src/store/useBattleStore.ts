// ─────────────────────────────────────────────────────────────────────────────
//  src/store/useBattleStore.ts  (v2)
//
//  Novidades vs versão anterior:
//    - Seleção de ATÉ 3 cartas por turno (array em vez de card único)
//    - Timer de 30 segundos
//    - Botão "Pronto" → pressReady()
//    - Sistema de compra de cartas: 4 - cartas_jogadas (0→4, 1→3, 2→2, 3→1)
//    - resolveRound() compara SOMA dos danos
//    - Bot também joga 1-3 cartas aleatórias
//    - Custo de carta por raridade (display): common=1 uncommon=2 rare=3 epic=4 legendary=mythic=5
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { TrophyCard, RarityName } from '../types/duel';
import type { Game, Achievement } from '../types';

export type BattlePhase = 'select-deck' | 'battle' | 'round-result' | 'game-over';

/** Custo de cada raridade (exibição / estratégia — sem sistema de mana por enquanto) */
export const CARD_COST: Record<string, number> = {
  common   : 1,
  uncommon : 2,
  rare     : 3,
  epic     : 4,
  legendary: 5,
  mythic   : 5,
};

export function getCardCost(rarity: string): number {
  return CARD_COST[rarity] ?? 1;
}

const MAX_CARDS_PER_TURN = 3;
const TIMER_SECONDS      = 30;

interface BattleState {
  phase              : BattlePhase;
  playerDeck         : TrophyCard[];
  botDeck            : TrophyCard[];
  playerHand         : TrophyCard[];
  botHand            : TrophyCard[];
  playerScore        : number;
  botScore           : number;
  round              : number;
  /** Cartas que o jogador escolheu para jogar neste turno (máx 3) */
  selectedPlayerCards : TrophyCard[];
  /** Cartas que o bot escolheu */
  selectedBotCards    : TrophyCard[];
  roundWinner        : 'player' | 'bot' | 'draw' | null;
  gameWinner         : 'player' | 'bot' | null;
  timeLeft           : number;
  isTimerRunning     : boolean;
  /** Jogador confirmou a seleção */
  isPlayerReady      : boolean;
  /** Guarda contra double-resolve */
  isResolving        : boolean;
  /** Quantas cartas o player jogará no próximo turno de compra */
  cardsPlayedThisRound : number;
}

interface BattleActions {
  startBattle  : (playerDeck: TrophyCard[], playerGames: Game[]) => void;
  /** Toggle uma carta na seleção (adiciona se não está, remove se está) */
  toggleCard   : (card: TrophyCard) => void;
  /** Jogador confirma a seleção e passa o turno */
  pressReady   : () => void;
  botPlay      : () => void;
  resolveRound : () => void;
  nextRound    : () => void;
  resetBattle  : () => void;
  tickTimer    : () => void;
}

const INITIAL_STATE: BattleState = {
  phase              : 'select-deck',
  playerDeck         : [],
  botDeck            : [],
  playerHand         : [],
  botHand            : [],
  playerScore        : 0,
  botScore           : 0,
  round              : 1,
  selectedPlayerCards : [],
  selectedBotCards    : [],
  roundWinner        : null,
  gameWinner         : null,
  timeLeft           : TIMER_SECONDS,
  isTimerRunning     : false,
  isPlayerReady      : false,
  isResolving        : false,
  cardsPlayedThisRound: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function drawCards(
  deck  : TrophyCard[],
  count : number,
): { drawn: TrophyCard[]; remaining: TrophyCard[] } {
  if (deck.length === 0 || count <= 0) return { drawn: [], remaining: [...deck] };
  const shuffled = shuffleArray(deck);
  const n = Math.min(count, shuffled.length);
  return { drawn: shuffled.slice(0, n), remaining: shuffled.slice(n) };
}

function calcDamage(globalPercent: number): number {
  return Math.round((100 - Math.min(100, Math.max(0, globalPercent))) * 10);
}

function getRarity(damage: number): { name: RarityName; label: string; emoji: string } {
  if (damage >= 970) return { name: 'mythic',    label: '✦ Mythic',    emoji: '🌟' };
  if (damage >= 850) return { name: 'legendary', label: '★ Legendary', emoji: '🏆' };
  if (damage >= 700) return { name: 'epic',       label: '◆ Epic',       emoji: '💎' };
  if (damage >= 500) return { name: 'rare',       label: '◇ Rare',       emoji: '🔷' };
  if (damage >= 300) return { name: 'uncommon',   label: '○ Uncommon',   emoji: '🟢' };
  return               { name: 'common',    label: '● Common',    emoji: '⚪' };
}

const RARITY_PCT: Record<string, [number, number]> = {
  common   : [60, 95],
  uncommon : [30, 60],
  rare     : [10, 30],
  epic     : [3,  10],
  legendary: [0.5, 3],
  mythic   : [0.01, 0.5],
};

const GAME_HEADERS: Record<number, string> = {
  730    : 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
  570    : 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
  440    : 'https://cdn.akamai.steamstatic.com/steam/apps/440/header.jpg',
  1172470: 'https://cdn.akamai.steamstatic.com/steam/apps/1172470/header.jpg',
  252950 : 'https://cdn.akamai.steamstatic.com/steam/apps/252950/header.jpg',
  252490 : 'https://cdn.akamai.steamstatic.com/steam/apps/252490/header.jpg',
  230410 : 'https://cdn.akamai.steamstatic.com/steam/apps/230410/header.jpg',
  346110 : 'https://cdn.akamai.steamstatic.com/steam/apps/346110/header.jpg',
  105600 : 'https://cdn.akamai.steamstatic.com/steam/apps/105600/header.jpg',
  220    : 'https://cdn.akamai.steamstatic.com/steam/apps/220/header.jpg',
  620    : 'https://cdn.akamai.steamstatic.com/steam/apps/620/header.jpg',
};

const SYNTHETIC: Array<{ name: string; description: string; gameName: string; gameAppId: number; rarity: string }> = [
  { name: 'First Blood',    description: 'Complete o tutorial',      gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'common'    },
  { name: 'Rookie',         description: 'Vença sua primeira partida', gameName: 'Rocket League',   gameAppId: 252950,  rarity: 'common'    },
  { name: 'Explorer',       description: 'Visite todos os mapas',    gameName: 'Rust',              gameAppId: 252490,  rarity: 'common'    },
  { name: 'Craftsman',      description: 'Fabrique seu primeiro item', gameName: 'Terraria',         gameAppId: 105600,  rarity: 'common'    },
  { name: 'Veteran',        description: 'Alcance nível 25',         gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'uncommon'  },
  { name: 'Champion',       description: 'Vença 10 partidas',        gameName: 'Team Fortress 2',  gameAppId: 440,     rarity: 'uncommon'  },
  { name: 'Ace',            description: 'Marque 50 gols',           gameName: 'Rocket League',    gameAppId: 252950,  rarity: 'uncommon'  },
  { name: 'Elite',          description: 'Alcance nível 50',         gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'rare'      },
  { name: 'Grand Champion', description: 'Alcance rank Grand Champion', gameName: 'Rocket League', gameAppId: 252950,  rarity: 'rare'      },
  { name: 'Legend',         description: 'Vença 100 partidas',       gameName: 'Team Fortress 2',  gameAppId: 440,     rarity: 'rare'      },
  { name: 'Godlike',        description: 'Alcance nível 100',        gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'epic'      },
  { name: 'Immortal',       description: 'Vença 500 partidas',       gameName: 'Dota 2',            gameAppId: 570,     rarity: 'epic'      },
  { name: 'Global Elite',   description: 'Alcance rank Global Elite', gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'legendary' },
  { name: 'Rocket God',     description: 'Vença 5000 partidas',      gameName: 'Rocket League',    gameAppId: 252950,  rarity: 'legendary' },
  { name: 'The One',        description: 'Complete o impossível',    gameName: 'Half-Life 2',      gameAppId: 220,     rarity: 'mythic'    },
  { name: 'Steam God',      description: 'Colete todos os itens raros', gameName: 'Portal 2',       gameAppId: 620,     rarity: 'mythic'    },
];

function buildBotDeck(playerGames: Game[]): TrophyCard[] {
  // Preferência: usar conquistas reais do jogador como deck do bot
  const pool: Array<{ achievement: Achievement; game: Game }> = [];
  for (const game of playerGames) {
    for (const ach of game.achievements) {
      pool.push({ achievement: ach, game });
    }
  }

  if (pool.length >= 10) {
    const shuffled = shuffleArray(pool);
    const count    = Math.min(20, shuffled.length);
    return shuffled.slice(0, count).map(({ achievement, game }, i) => {
      const pct    = achievement.globalPercent ?? (Math.random() * 60 + 5);
      const damage = calcDamage(pct);
      const r      = getRarity(damage);
      return {
        id           : `bot-${i}`,
        apiName      : achievement.apiName,
        name         : achievement.displayName,
        description  : achievement.description,
        iconUrl      : achievement.iconUrl,
        gameAppId    : game.appId,
        gameName     : game.name,
        gameHeaderUrl: game.headerImage,
        damage, globalPercent: pct,
        rarity: r.name, rarityLabel: r.label, rarityEmoji: r.emoji,
      } satisfies TrophyCard;
    });
  }

  // Fallback sintético
  const shuffled = shuffleArray(SYNTHETIC).slice(0, 16);
  return shuffled.map((ach, i) => {
    const [min, max] = RARITY_PCT[ach.rarity];
    const pct    = Math.random() * (max - min) + min;
    const damage = calcDamage(pct);
    const r      = getRarity(damage);
    return {
      id           : `bot-synth-${i}`,
      apiName      : ach.name.toLowerCase().replace(/\s+/g, '_'),
      name         : ach.name,
      description  : ach.description,
      iconUrl      : '',
      gameAppId    : ach.gameAppId,
      gameName     : ach.gameName,
      gameHeaderUrl: GAME_HEADERS[ach.gameAppId] ?? '',
      damage, globalPercent: pct,
      rarity: r.name, rarityLabel: r.label, rarityEmoji: r.emoji,
    } satisfies TrophyCard;
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBattleStore = create<BattleState & BattleActions>((set, get) => ({
  ...INITIAL_STATE,

  // ── Start ────────────────────────────────────────────────────────────────
  startBattle: (playerDeck, playerGames) => {
    const botDeck    = buildBotDeck(playerGames);
    const playerDraw = drawCards(playerDeck, 5);
    const botDraw    = drawCards(botDeck,    5);

    set({
      ...INITIAL_STATE,
      phase              : 'battle',
      playerDeck         : playerDraw.remaining,
      botDeck            : botDraw.remaining,
      playerHand         : playerDraw.drawn,
      botHand            : botDraw.drawn,
      timeLeft           : TIMER_SECONDS,
      isTimerRunning     : true,
    });
  },

  // ── Toggle card in/out of selection ──────────────────────────────────────
  toggleCard: (card) => {
    const { selectedPlayerCards, isPlayerReady, phase } = get();

    // Só permite seleção durante a fase de batalha e antes de confirmar
    if (phase !== 'battle' || isPlayerReady) return;

    const isSelected = selectedPlayerCards.some((c) => c.id === card.id);

    if (isSelected) {
      // Remove da seleção
      set({ selectedPlayerCards: selectedPlayerCards.filter((c) => c.id !== card.id) });
    } else if (selectedPlayerCards.length < MAX_CARDS_PER_TURN) {
      // Adiciona à seleção (máx 3)
      set({ selectedPlayerCards: [...selectedPlayerCards, card] });
    }
  },

  // ── Pronto: jogador confirma seleção ─────────────────────────────────────
  pressReady: () => {
    const { phase, isPlayerReady } = get();
    if (phase !== 'battle' || isPlayerReady) return;

    set({
      isPlayerReady  : true,
      isTimerRunning : false,
      cardsPlayedThisRound: get().selectedPlayerCards.length,
    });

    // Bot joga após pequeno delay
    setTimeout(() => { get().botPlay(); }, 400);
  },

  // ── Bot escolhe cartas ────────────────────────────────────────────────────
  botPlay: () => {
    const { botHand, selectedBotCards } = get();
    if (selectedBotCards.length > 0 || botHand.length === 0) return;

    // Bot escolhe entre 1 e min(3, mão) cartas aleatoriamente
    const maxBot = Math.min(MAX_CARDS_PER_TURN, botHand.length);
    const count  = Math.floor(Math.random() * maxBot) + 1;
    const chosen = shuffleArray(botHand).slice(0, count);

    set({ selectedBotCards: chosen });

    // Resolve após pequeno delay para animação
    setTimeout(() => { get().resolveRound(); }, 700);
  },

  // ── Resolve round ─────────────────────────────────────────────────────────
  resolveRound: () => {
    const {
      selectedPlayerCards, selectedBotCards,
      playerScore, botScore,
      isResolving,
    } = get();

    if (isResolving) return;
    if (selectedPlayerCards.length === 0 && selectedBotCards.length === 0) return;

    set({ isResolving: true });

    // Soma total de dano
    const playerTotal = selectedPlayerCards.reduce((s, c) => s + c.damage, 0);
    const botTotal    = selectedBotCards.reduce((s, c) => s + c.damage, 0);

    const roundWinner: 'player' | 'bot' | 'draw' =
      playerTotal > botTotal ? 'player' :
      botTotal > playerTotal ? 'bot'    : 'draw';

    const newPlayerScore = roundWinner === 'player' ? playerScore + 1 : playerScore;
    const newBotScore    = roundWinner === 'bot'    ? botScore    + 1 : botScore;

    // Verifica fim de jogo (primeiro a 5 pontos)
    let gameWinner: 'player' | 'bot' | null = null;
    let phase: BattlePhase = 'round-result';

    if (newPlayerScore >= 5) { gameWinner = 'player'; phase = 'game-over'; }
    else if (newBotScore >= 5) { gameWinner = 'bot';  phase = 'game-over'; }

    set({
      phase,
      roundWinner,
      playerScore : newPlayerScore,
      botScore    : newBotScore,
      gameWinner,                 // ← FIX: era o bug da v1 (estava ausente)
      isTimerRunning: false,
      isResolving   : false,
    });
  },

  // ── Próximo turno ─────────────────────────────────────────────────────────
  nextRound: () => {
    const {
      playerDeck, botDeck,
      playerHand, botHand,
      selectedPlayerCards, selectedBotCards,
      cardsPlayedThisRound, round,
    } = get();

    // Remove cartas jogadas das mãos
    const playedIds = new Set(selectedPlayerCards.map((c) => c.id));
    const botPlayedIds = new Set(selectedBotCards.map((c) => c.id));
    const newPlayerHand = playerHand.filter((c) => !playedIds.has(c.id));
    const newBotHand    = botHand.filter((c) => !botPlayedIds.has(c.id));

    // Sistema de compra: quanto menos cartas jogou, mais compra
    // 0 jogadas → +4 | 1 → +3 | 2 → +2 | 3 → +1
    const playerDrawCount = Math.max(1, 4 - cardsPlayedThisRound);
    const botDrawCount    = 2; // bot sempre compra 2 por simplicidade

    const playerDraw = drawCards(playerDeck, playerDrawCount);
    const botDraw    = drawCards(botDeck,    botDrawCount);

    set({
      phase              : 'battle',
      playerHand         : [...newPlayerHand, ...playerDraw.drawn],
      botHand            : [...newBotHand,    ...botDraw.drawn],
      playerDeck         : playerDraw.remaining,
      botDeck            : botDraw.remaining,
      selectedPlayerCards : [],
      selectedBotCards    : [],
      roundWinner        : null,
      round              : round + 1,
      timeLeft           : TIMER_SECONDS,
      isTimerRunning     : true,
      isPlayerReady      : false,
      isResolving        : false,
      cardsPlayedThisRound: 0,
    });
  },

  // ── Timer tick ────────────────────────────────────────────────────────────
  tickTimer: () => {
    const { timeLeft, isTimerRunning, phase } = get();
    if (!isTimerRunning || phase !== 'battle') return;

    if (timeLeft <= 1) {
      // Tempo esgotado → força "Pronto" automático
      set({ timeLeft: 0, isTimerRunning: false });
      get().pressReady();
    } else {
      set({ timeLeft: timeLeft - 1 });
    }
  },

  resetBattle: () => set({ ...INITIAL_STATE }),
}));
