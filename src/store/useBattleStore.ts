// ─────────────────────────────────────────────────────────────────────────────
//  src/store/useBattleStore.ts  (v3)
//
//  Novas mecânicas:
//    - Sistema de HP: ambos começam com 3500. O vencedor do round causa o
//      dano EXCEDENTE no adversário (ex: 1230 vs 1500 → player toma 270).
//    - Sistema de Mana: começa com 3 no turno 1, +1 a cada turno.
//      Não é possível selecionar cartas se o custo total ultrapassar a mana.
//    - Fusão: fuseCards(id1, id2) — une duas cartas de mesma raridade em
//      uma carta de raridade superior. Conta como 1 carta jogada no cálculo
//      de compra.
//    - Bot respeita a mana ao escolher cartas.
//    - Cálculo de compra: 1 + espaços_vazios = 4 - cartas_jogadas (sem mudança
//      na fórmula, mas a semântica agora é explícita via cardsPlayedThisRound).
// ─────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';
import type { TrophyCard, RarityName } from '../types/duel';
import type { Game, Achievement } from '../types';

export type BattlePhase = 'select-deck' | 'battle' | 'round-result' | 'game-over';
export type BotDifficulty = 'easy' | 'normal' | 'hard' | 'king';

// ─── Custo por raridade ───────────────────────────────────────────────────────

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

// ─── Progressão de raridade para fusão ────────────────────────────────────────

const RARITY_ORDER: RarityName[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic',
];

const RARITY_INFO: Record<string, { label: string; emoji: string }> = {
  common   : { label: '● Common',    emoji: '⚪' },
  uncommon : { label: '○ Uncommon',  emoji: '🟢' },
  rare     : { label: '◇ Rare',      emoji: '🔷' },
  epic     : { label: '◆ Epic',      emoji: '💎' },
  legendary: { label: '★ Legendary', emoji: '🏆' },
  mythic   : { label: '✦ Mythic',    emoji: '🌟' },
};

function getNextRarity(rarity: string): RarityName {
  const idx = RARITY_ORDER.indexOf(rarity as RarityName);
  if (idx === -1) return 'uncommon';
  return RARITY_ORDER[Math.min(idx + 1, RARITY_ORDER.length - 1)];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const MAX_CARDS_PER_TURN = 3;
const TIMER_SECONDS      = 30;
const INITIAL_HP         = 3500;
const INITIAL_MANA       = 3;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BattleState {
  phase               : BattlePhase;
  playerDeck          : TrophyCard[];
  botDeck             : TrophyCard[];
  playerHand          : TrophyCard[];
  botHand             : TrophyCard[];
  /** HP do jogador (começa em 3500) */
  playerHp            : number;
  /** HP do bot (começa em 3500) */
  botHp               : number;
  /** Mana atual (começa em 3, +1 por turno) */
  currentMana         : number;
  round               : number;
  selectedPlayerCards  : TrophyCard[];
  selectedBotCards     : TrophyCard[];
  roundWinner          : 'player' | 'bot' | 'draw' | null;
  gameWinner           : 'player' | 'bot' | null;
  /** Dano excedente causado neste round (para exibição) */
  damageDealt          : number;
  /** Quem recebeu o dano */
  damageTarget         : 'player' | 'bot' | null;
  timeLeft             : number;
  isTimerRunning       : boolean;
  isPlayerReady        : boolean;
  isResolving          : boolean;
  cardsPlayedThisRound : number;
  botDifficulty        : BotDifficulty;
}

interface BattleActions {
  startBattle   : (playerDeck: TrophyCard[], playerGames: Game[], difficulty?: BotDifficulty) => void;
  toggleCard    : (card: TrophyCard) => void;
  pressReady    : () => void;
  botPlay       : () => void;
  resolveRound  : () => void;
  nextRound     : () => void;
  resetBattle   : () => void;
  tickTimer     : () => void;
  setBotDifficulty: (d: BotDifficulty) => void;
  /** Funde duas cartas de mesma raridade em uma de raridade superior */
  fuseCards     : (card1Id: string, card2Id: string) => void;
}

const INITIAL_STATE: BattleState = {
  phase               : 'select-deck',
  playerDeck          : [],
  botDeck             : [],
  playerHand          : [],
  botHand             : [],
  playerHp            : INITIAL_HP,
  botHp               : INITIAL_HP,
  currentMana         : INITIAL_MANA,
  round               : 1,
  selectedPlayerCards  : [],
  selectedBotCards     : [],
  roundWinner          : null,
  gameWinner           : null,
  damageDealt          : 0,
  damageTarget         : null,
  timeLeft             : TIMER_SECONDS,
  isTimerRunning       : false,
  isPlayerReady        : false,
  isResolving          : false,
  cardsPlayedThisRound : 0,
  botDifficulty        : 'normal',
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
  deck : TrophyCard[],
  count: number,
): { drawn: TrophyCard[]; remaining: TrophyCard[] } {
  if (deck.length === 0 || count <= 0) return { drawn: [], remaining: [...deck] };
  const s = shuffleArray(deck);
  const n = Math.min(count, s.length);
  return { drawn: s.slice(0, n), remaining: s.slice(n) };
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

const SYNTHETIC: Array<{
  name: string; description: string; gameName: string; gameAppId: number; rarity: string;
}> = [
  { name: 'First Blood',    description: 'Complete o tutorial',         gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'common'    },
  { name: 'Rookie',         description: 'Vença sua primeira partida',  gameName: 'Rocket League',    gameAppId: 252950,  rarity: 'common'    },
  { name: 'Explorer',       description: 'Visite todos os mapas',       gameName: 'Rust',             gameAppId: 252490,  rarity: 'common'    },
  { name: 'Craftsman',      description: 'Fabrique seu primeiro item',  gameName: 'Terraria',         gameAppId: 105600,  rarity: 'common'    },
  { name: 'Veteran',        description: 'Alcance nível 25',            gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'uncommon'  },
  { name: 'Champion',       description: 'Vença 10 partidas',           gameName: 'Team Fortress 2',  gameAppId: 440,     rarity: 'uncommon'  },
  { name: 'Ace',            description: 'Marque 50 gols',              gameName: 'Rocket League',    gameAppId: 252950,  rarity: 'uncommon'  },
  { name: 'Elite',          description: 'Alcance nível 50',            gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'rare'      },
  { name: 'Grand Champion', description: 'Alcance rank Grand Champion', gameName: 'Rocket League',    gameAppId: 252950,  rarity: 'rare'      },
  { name: 'Legend',         description: 'Vença 100 partidas',          gameName: 'Team Fortress 2',  gameAppId: 440,     rarity: 'rare'      },
  { name: 'Godlike',        description: 'Alcance nível 100',           gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'epic'      },
  { name: 'Immortal',       description: 'Vença 500 partidas',          gameName: 'Dota 2',           gameAppId: 570,     rarity: 'epic'      },
  { name: 'Global Elite',   description: 'Alcance rank Global Elite',   gameName: 'Counter-Strike 2', gameAppId: 730,     rarity: 'legendary' },
  { name: 'Rocket God',     description: 'Vença 5000 partidas',         gameName: 'Rocket League',    gameAppId: 252950,  rarity: 'legendary' },
  { name: 'The One',        description: 'Complete o impossível',       gameName: 'Half-Life 2',      gameAppId: 220,     rarity: 'mythic'    },
  { name: 'Steam God',      description: 'Colete todos os itens raros', gameName: 'Portal 2',         gameAppId: 620,     rarity: 'mythic'    },
];

function filterCardsByDifficulty(cards: TrophyCard[], difficulty: BotDifficulty): TrophyCard[] {
  switch (difficulty) {
    case 'easy':   return cards.filter(c => ['common', 'uncommon', 'rare', 'epic'].includes(c.rarity));
    case 'hard':   return cards.filter(c => ['rare', 'epic', 'legendary', 'mythic'].includes(c.rarity));
    case 'king':   return cards.filter(c => ['legendary', 'mythic'].includes(c.rarity));
    default:       return cards;
  }
}

function buildBotDeck(playerGames: Game[], difficulty: BotDifficulty = 'normal'): TrophyCard[] {
  const pool: Array<{ achievement: Achievement; game: Game }> = [];
  for (const game of playerGames) {
    for (const ach of game.achievements) {
      pool.push({ achievement: ach, game });
    }
  }

  let cards: TrophyCard[];

  if (pool.length >= 10) {
    const shuffled = shuffleArray(pool);
    cards = shuffled.slice(0, Math.min(20, shuffled.length)).map(({ achievement, game }, i) => {
      const pct    = achievement.globalPercent ?? (Math.random() * 60 + 5);
      const damage = calcDamage(pct);
      const r      = getRarity(damage);
      return {
        id: `bot-${i}`, apiName: achievement.apiName,
        name: achievement.displayName, description: achievement.description,
        iconUrl: achievement.iconUrl, gameAppId: game.appId, gameName: game.name,
        gameHeaderUrl: game.headerImage,
        damage, globalPercent: pct, rarity: r.name, rarityLabel: r.label, rarityEmoji: r.emoji,
      } satisfies TrophyCard;
    });
  } else {
    let pool2 = [...SYNTHETIC];
    if (difficulty === 'easy')   pool2 = pool2.filter(a => ['common', 'uncommon', 'rare', 'epic'].includes(a.rarity));
    else if (difficulty === 'hard') pool2 = pool2.filter(a => ['rare', 'epic', 'legendary', 'mythic'].includes(a.rarity));
    else if (difficulty === 'king') pool2 = pool2.filter(a => ['legendary', 'mythic'].includes(a.rarity));
    if (pool2.length === 0) pool2 = [...SYNTHETIC];

    cards = shuffleArray(pool2).slice(0, 16).map((ach, i) => {
      const [min, max] = RARITY_PCT[ach.rarity];
      const pct    = Math.random() * (max - min) + min;
      const damage = calcDamage(pct);
      const r      = getRarity(damage);
      return {
        id: `bot-synth-${i}`, apiName: ach.name.toLowerCase().replace(/\s+/g, '_'),
        name: ach.name, description: ach.description, iconUrl: '',
        gameAppId: ach.gameAppId, gameName: ach.gameName,
        gameHeaderUrl: GAME_HEADERS[ach.gameAppId] ?? '',
        damage, globalPercent: pct, rarity: r.name, rarityLabel: r.label, rarityEmoji: r.emoji,
      } satisfies TrophyCard;
    });
  }

  const filtered = filterCardsByDifficulty(cards, difficulty);
  return shuffleArray(filtered.length > 0 ? filtered : cards);
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBattleStore = create<BattleState & BattleActions>((set, get) => ({
  ...INITIAL_STATE,

  resetBattle    : () => set({ ...INITIAL_STATE }),
  setBotDifficulty: (d) => set({ botDifficulty: d }),

  // ── Start ──────────────────────────────────────────────────────────────────
  startBattle: (playerDeck, playerGames, difficulty = 'normal') => {
    const botDeck    = buildBotDeck(playerGames, difficulty);
    const playerDraw = drawCards(playerDeck, 5);
    const botDraw    = drawCards(botDeck,    5);

    set({
      ...INITIAL_STATE,
      phase              : 'battle',
      botDifficulty      : difficulty,
      playerDeck         : playerDraw.remaining,
      botDeck            : botDraw.remaining,
      playerHand         : playerDraw.drawn,
      botHand            : botDraw.drawn,
      playerHp           : INITIAL_HP,
      botHp              : INITIAL_HP,
      currentMana        : INITIAL_MANA,
      timeLeft           : TIMER_SECONDS,
      isTimerRunning     : true,
    });
  },

  // ── Toggle carta — bloqueia se custo ultrapassa mana ─────────────────────
  toggleCard: (card) => {
    const { selectedPlayerCards, isPlayerReady, phase, currentMana } = get();
    if (phase !== 'battle' || isPlayerReady) return;

    const isSelected = selectedPlayerCards.some(c => c.id === card.id);

    if (isSelected) {
      // Deseleção sempre permitida
      set({ selectedPlayerCards: selectedPlayerCards.filter(c => c.id !== card.id) });
    } else if (selectedPlayerCards.length < MAX_CARDS_PER_TURN) {
      // Verifica se há mana suficiente
      const spentMana = selectedPlayerCards.reduce((s, c) => s + getCardCost(c.rarity), 0);
      const cardCost  = getCardCost(card.rarity);
      if (spentMana + cardCost <= currentMana) {
        set({ selectedPlayerCards: [...selectedPlayerCards, card] });
      }
      // Se não tem mana, ignora silenciosamente (UI já dimma a carta)
    }
  },

  // ── Fundir duas cartas de mesma raridade ─────────────────────────────────
  fuseCards: (card1Id, card2Id) => {
    const { selectedPlayerCards, playerHand, phase, isPlayerReady } = get();
    if (phase !== 'battle' || isPlayerReady) return;

    const card1 = selectedPlayerCards.find(c => c.id === card1Id);
    const card2 = selectedPlayerCards.find(c => c.id === card2Id);
    if (!card1 || !card2 || card1.rarity !== card2.rarity) return;

    // Determina a raridade resultante
    const nextRarity = getNextRarity(card1.rarity);
    const rarityInfo = RARITY_INFO[nextRarity];

    // Carta base: a mais forte das duas
    const base = card1.damage >= card2.damage ? card1 : card2;

    // Dano da carta fundida: soma das duas com 85% de eficiência
    // (ligeiramente abaixo da soma para não dominar demais)
    const fusedDamage = Math.round((card1.damage + card2.damage) * 0.85);

    const fusedCard: TrophyCard = {
      id           : `fused-${Date.now()}`,
      apiName      : `fused_${base.apiName}`,
      name         : `✨ ${base.name}`,
      description  : `Fusão: ${card1.name} + ${card2.name}`,
      iconUrl      : base.iconUrl,
      gameAppId    : base.gameAppId,
      gameName     : base.gameName,
      gameHeaderUrl: base.gameHeaderUrl,
      damage       : fusedDamage,
      rarity       : nextRarity,
      rarityLabel  : rarityInfo.label,
      rarityEmoji  : rarityInfo.emoji,
      globalPercent: null,
    };

    // Remove as duas cartas originais da mão e da seleção
    const newHand     = playerHand.filter(c => c.id !== card1Id && c.id !== card2Id);
    const newSelected = selectedPlayerCards
      .filter(c => c.id !== card1Id && c.id !== card2Id)
      .concat(fusedCard);

    set({
      playerHand          : [...newHand, fusedCard],
      selectedPlayerCards : newSelected,
    });
  },

  // ── Pronto ────────────────────────────────────────────────────────────────
  pressReady: () => {
    const { phase, isPlayerReady } = get();
    if (phase !== 'battle' || isPlayerReady) return;

    set({
      isPlayerReady        : true,
      isTimerRunning       : false,
      cardsPlayedThisRound : get().selectedPlayerCards.length,
    });

    setTimeout(() => { get().botPlay(); }, 400);
  },

  // ── Bot escolhe cartas respeitando mana ──────────────────────────────────
  botPlay: () => {
    const { botHand, selectedBotCards, botDifficulty, currentMana } = get();
    if (selectedBotCards.length > 0 || botHand.length === 0) return;

    const maxCards = botDifficulty === 'easy' ? 2 : MAX_CARDS_PER_TURN;
    let chosen: TrophyCard[];

    if (botDifficulty === 'hard' || botDifficulty === 'king') {
      // Bot inteligente: escolhe as cartas mais fortes dentro do orçamento de mana
      const sorted = [...botHand].sort((a, b) => b.damage - a.damage);
      chosen = [];
      let spent = 0;
      for (const c of sorted) {
        if (chosen.length >= maxCards) break;
        const cost = getCardCost(c.rarity);
        if (spent + cost <= currentMana) {
          chosen.push(c);
          spent += cost;
        }
      }
    } else {
      // Normal/Easy: escolha aleatória com limite de mana
      const shuffled = shuffleArray(botHand);
      chosen = [];
      let spent = 0;
      for (const c of shuffled) {
        if (chosen.length >= maxCards) break;
        const cost = getCardCost(c.rarity);
        if (spent + cost <= currentMana) {
          chosen.push(c);
          spent += cost;
        }
      }
    }

    // Fallback: se não cabe nada, passa o turno (0 cartas)
    set({ selectedBotCards: chosen });
    setTimeout(() => { get().resolveRound(); }, 700);
  },

  // ── Resolver round — dano excedente ──────────────────────────────────────
  resolveRound: () => {
    const {
      selectedPlayerCards, selectedBotCards,
      playerHp, botHp,
      isResolving,
    } = get();

    if (isResolving) return;
    set({ isResolving: true });

    const playerTotal = selectedPlayerCards.reduce((s, c) => s + c.damage, 0);
    const botTotal    = selectedBotCards.reduce((s, c) => s + c.damage, 0);

    let roundWinner  : 'player' | 'bot' | 'draw';
    let newPlayerHp   = playerHp;
    let newBotHp      = botHp;
    let damageDealt   = 0;
    let damageTarget  : 'player' | 'bot' | null = null;

    if (playerTotal > botTotal) {
      roundWinner  = 'player';
      damageDealt  = playerTotal - botTotal;
      newBotHp     = Math.max(0, botHp - damageDealt);
      damageTarget = 'bot';
    } else if (botTotal > playerTotal) {
      roundWinner  = 'bot';
      damageDealt  = botTotal - playerTotal;
      newPlayerHp  = Math.max(0, playerHp - damageDealt);
      damageTarget = 'player';
    } else {
      roundWinner = 'draw';
    }

    // Verifica fim de jogo
    let gameWinner : 'player' | 'bot' | null = null;
    let phase      : BattlePhase = 'round-result';

    if (newBotHp <= 0)    { gameWinner = 'player'; phase = 'game-over'; }
    if (newPlayerHp <= 0) { gameWinner = 'bot';    phase = 'game-over'; }

    set({
      phase,
      roundWinner,
      playerHp     : newPlayerHp,
      botHp        : newBotHp,
      damageDealt,
      damageTarget,
      gameWinner,
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
      cardsPlayedThisRound, round, currentMana,
    } = get();

    // Remove cartas jogadas das mãos
    const playedIds    = new Set(selectedPlayerCards.map(c => c.id));
    const botPlayedIds = new Set(selectedBotCards.map(c => c.id));
    const newPlayerHand = playerHand.filter(c => !playedIds.has(c.id));
    const newBotHand    = botHand.filter(c => !botPlayedIds.has(c.id));

    // Compra: 1 carta base + espaços vazios no tabuleiro
    // espaços_vazios = MAX_CARDS_PER_TURN - cartas_jogadas
    // total = 1 + (3 - N) = 4 - N  (fusão conta como 1)
    const playerDrawCount = Math.max(1, 4 - cardsPlayedThisRound);
    const botDrawCount    = Math.max(1, 4 - selectedBotCards.length);

    const playerDraw = drawCards(playerDeck, playerDrawCount);
    const botDraw    = drawCards(botDeck,    botDrawCount);

    set({
      phase               : 'battle',
      playerHand          : [...newPlayerHand, ...playerDraw.drawn],
      botHand             : [...newBotHand,    ...botDraw.drawn],
      playerDeck          : playerDraw.remaining,
      botDeck             : botDraw.remaining,
      selectedPlayerCards : [],
      selectedBotCards    : [],
      roundWinner         : null,
      damageDealt         : 0,
      damageTarget        : null,
      round               : round + 1,
      currentMana         : currentMana + 1,   // +1 mana por turno
      timeLeft            : TIMER_SECONDS,
      isTimerRunning      : true,
      isPlayerReady       : false,
      isResolving         : false,
      cardsPlayedThisRound: 0,
    });
  },

  // ── Timer ─────────────────────────────────────────────────────────────────
  tickTimer: () => {
    const { timeLeft, isTimerRunning, phase } = get();
    if (!isTimerRunning || phase !== 'battle') return;
    if (timeLeft <= 1) {
      set({ timeLeft: 0, isTimerRunning: false });
      get().pressReady();
    } else {
      set({ timeLeft: timeLeft - 1 });
    }
  },
}));
