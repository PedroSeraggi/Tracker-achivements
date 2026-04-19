// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/DuelBattle.tsx  (v4 — Board Edition)
//
//  Full redesign:
//    - Real game board with distinct zones (bot field / center divide / player field)
//    - 3 card slots per side, visually rendered at all times
//    - Drag-and-drop: click+hold card → drag to player field → drop to play
//    - Ghost card follows cursor while dragging
//    - Mana crystals with spend animation
//    - Ambient board particles (CSS)
//    - All existing game logic (HP, mana cost, fusion, ready button) preserved
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useBattleStore, getCardCost } from '../../store/useBattleStore';
import { useFanLayout } from '../../hooks/useFanLayout';
import { useDragCard } from '../../hooks/useDragCard';
import type { TrophyCard } from '../../types/duel';
import {
  playHoverSound, playCardSelectSound, playCardPlaySound,
  playReadySound, playWinRoundSound, playLoseRoundSound,
  playGameWinSound, playGameLoseSound, playTickSound, initAudio,
} from '../../utils/soundEffects';

// ─── Constants ────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common   : '#9ca3af',
  uncommon : '#4ade80',
  rare     : '#60a5fa',
  epic     : '#c084fc',
  legendary: '#fbbf24',
  mythic   : '#f472b6',
};

const MAX_SLOTS = 3;
const INITIAL_HP = 3500;

// ─── Sub: Mana Crystals ───────────────────────────────────────────────────────

const ManaCrystals: React.FC<{ total: number; spent: number; size?: 'sm' | 'md' }> = ({
  total, spent, size = 'md',
}) => {
  const available = Math.max(0, total - spent);
  const display   = Math.min(total, 10);

  return (
    <div className={`bd-mana-crystals bd-mana-crystals--${size}`}>
      {Array.from({ length: display }).map((_, i) => (
        <div
          key={i}
          className={`bd-mana-gem ${i < available ? 'bd-mana-gem--full' : 'bd-mana-gem--spent'}`}
          style={{ animationDelay: `${i * 0.06}s` }}
        />
      ))}
      {total > 10 && (
        <span className="bd-mana-overflow">+{total - 10}</span>
      )}
      <span className="bd-mana-val">{available}/{total}</span>
    </div>
  );
};

// ─── Sub: HP Bar ─────────────────────────────────────────────────────────────

const HpBar: React.FC<{
  hp: number; maxHp?: number; label: string;
  side: 'player' | 'bot'; showDamage?: number;
}> = ({ hp, maxHp = INITIAL_HP, label, side, showDamage }) => {
  const pct   = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const color = pct > 60 ? '#4ade80' : pct > 30 ? '#fbbf24' : '#f87171';

  return (
    <div className={`bd-hp-block bd-hp-block--${side}`}>
      <div className="bd-hp-avatar">
        {side === 'player' ? '⚔️' : '🤖'}
      </div>
      <div className="bd-hp-info">
        <div className="bd-hp-label">{label}</div>
        <div className="bd-hp-track">
          <div
            className="bd-hp-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <div className="bd-hp-val" style={{ color }}>
          {hp.toLocaleString()}
          {showDamage != null && showDamage > 0 && (
            <span className="bd-hp-damage-float">-{showDamage.toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sub: Card Slot (empty slot on the board) ─────────────────────────────────

const BoardSlot: React.FC<{
  card     : TrophyCard | null;
  side     : 'player' | 'bot';
  isTarget?: boolean;
  isWinner?: boolean;
}> = ({ card, side, isTarget, isWinner }) => {
  const rarityColor = card ? (RARITY_COLOR[card.rarity] ?? '#9ca3af') : 'transparent';
  const cost = card ? getCardCost(card.rarity) : null;
  const pct  = card?.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : null;

  if (!card) {
    return (
      <div
        className={[
          'bd-board-slot bd-board-slot--empty',
          isTarget ? 'bd-board-slot--target' : '',
          side === 'player' ? 'bd-board-slot--player' : 'bd-board-slot--bot',
        ].filter(Boolean).join(' ')}
      >
        {isTarget && <div className="bd-slot-target-ring" />}
        <div className="bd-slot-hint">
          {side === 'player' ? '↓ Solte aqui' : ''}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        'bd-board-slot bd-board-slot--filled',
        isWinner ? 'bd-board-slot--winner' : '',
      ].filter(Boolean).join(' ')}
      data-rarity={card.rarity}
      style={{ '--rarity-color': rarityColor } as React.CSSProperties}
    >
      {/* Cost bubble */}
      {cost != null && (
        <div className="bd-slot-cost" style={{ background: rarityColor }}>
          {cost}
        </div>
      )}

      {/* Art */}
      <div className="bd-slot-art">
        <div
          className="bd-slot-art-bg"
          style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }}
        />
        {card.iconUrl ? (
          <img
            className="bd-slot-art-icon"
            src={card.iconUrl}
            alt={card.name}
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="bd-slot-art-emoji">{card.rarityEmoji}</div>
        )}
        <div className="bd-slot-rarity-badge" style={{ color: rarityColor }}>
          {card.rarityLabel}
        </div>
      </div>

      {/* Info */}
      <div className="bd-slot-info">
        <div className="bd-slot-name">{card.name}</div>
        <div className="bd-slot-game">{card.gameName}</div>
      </div>

      {/* Damage */}
      <div className="bd-slot-damage" style={{ color: rarityColor }}>
        ⚔ {card.damage}
        {pct && <span className="bd-slot-pct"> · {pct}</span>}
      </div>

      {/* Winner glow */}
      {isWinner && <div className="bd-slot-winner-glow" />}
    </div>
  );
};

// ─── Sub: Board Center Divider ────────────────────────────────────────────────

const BoardCenter: React.FC<{
  playerTotal: number;
  botTotal   : number;
  isReady    : boolean;
  botReady   : boolean;
}> = ({ playerTotal, botTotal, isReady, botReady }) => {
  const diff = playerTotal - botTotal;

  return (
    <div className="bd-center">
      <div className="bd-center-line">
        <div className="bd-center-gem" />
      </div>

      {(playerTotal > 0 || botTotal > 0) && (
        <div className="bd-center-totals">
          <div
            className="bd-center-total bd-center-total--player"
            style={{ color: diff > 0 ? '#4ade80' : diff < 0 ? '#f87171' : '#fff' }}
          >
            {playerTotal}
          </div>
          <div className="bd-center-vs">⚔</div>
          <div
            className="bd-center-total bd-center-total--bot"
            style={{ color: diff < 0 ? '#4ade80' : diff > 0 ? '#f87171' : '#fff' }}
          >
            {botTotal}
          </div>
        </div>
      )}

      {/* Ready indicators */}
      <div className="bd-center-status">
        {isReady  && <div className="bd-ready-indicator bd-ready-indicator--player">✓ Pronto</div>}
        {botReady && <div className="bd-ready-indicator bd-ready-indicator--bot">🤖 Pronto</div>}
      </div>
    </div>
  );
};

// ─── Sub: Ghost Card (follows cursor during drag) ─────────────────────────────

const GhostCard: React.FC<{
  card      : TrophyCard;
  x         : number;
  y         : number;
  isOverZone: boolean;
  isSnapBack: boolean;
  originX   : number;
  originY   : number;
}> = ({ card, x, y, isOverZone, isSnapBack, originX, originY }) => {
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const cost = getCardCost(card.rarity);

  const style: React.CSSProperties = {
    '--rarity-color': rarityColor,
    position        : 'fixed',
    left            : isSnapBack ? originX : x,
    top             : isSnapBack ? originY : y,
    transform       : isSnapBack
      ? 'translate(-50%, -50%) scale(0.85)'
      : isOverZone
        ? 'translate(-50%, -50%) scale(1.08) rotate(-2deg)'
        : 'translate(-50%, -50%) scale(1.0) rotate(-4deg)',
    transition      : isSnapBack
      ? 'left 0.28s ease, top 0.28s ease, transform 0.28s ease, opacity 0.28s ease'
      : 'transform 0.15s ease',
    zIndex          : 9999,
    pointerEvents   : 'none',
    width           : 'var(--card-width, 140px)',
    height          : 'var(--card-height, 210px)',
    opacity         : isSnapBack ? 0.5 : 1,
  } as React.CSSProperties;

  return (
    <div className="bd-ghost-card" style={style} data-rarity={card.rarity}>
      <div className="bd-ghost-inner">
        {/* Intense glow when over drop zone */}
        {isOverZone && (
          <div
            className="bd-ghost-dropzone-glow"
            style={{ boxShadow: `0 0 40px 12px ${rarityColor}` }}
          />
        )}

        <div className="bd-slot-cost" style={{ background: rarityColor }}>{cost}</div>

        <div className="bd-slot-art">
          <div className="bd-slot-art-bg"
               style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }} />
          {card.iconUrl ? (
            <img className="bd-slot-art-icon" src={card.iconUrl} alt={card.name} loading="lazy"
                 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="bd-slot-art-emoji">{card.rarityEmoji}</div>
          )}
          <div className="bd-slot-rarity-badge" style={{ color: rarityColor }}>{card.rarityLabel}</div>
        </div>

        <div className="bd-slot-info">
          <div className="bd-slot-name">{card.name}</div>
          <div className="bd-slot-game">{card.gameName}</div>
        </div>
        <div className="bd-slot-damage" style={{ color: rarityColor }}>⚔ {card.damage}</div>
      </div>
    </div>
  );
};

// ─── Sub: Hand Card (for fan hand) ───────────────────────────────────────────

interface HandCardProps {
  card       : TrophyCard;
  fanStyle   : Record<string, string | number>;
  selOrder   : number;
  canSelect  : boolean;
  canDeselect: boolean;
  noMana     : boolean;
  isDragging : boolean;
  isFusing   : boolean;
  onStartDrag: (e: React.MouseEvent<HTMLElement>) => void;
  onToggle   : () => void;
}

const HandCard: React.FC<HandCardProps> = ({
  card, fanStyle, selOrder, canSelect, canDeselect,
  noMana, isDragging, isFusing, onStartDrag, onToggle,
}) => {
  const isSelected  = selOrder > 0;
  const cost        = getCardCost(card.rarity);
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const pctDisplay  = card.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : '??%';
  const clickable   = (canSelect && !isSelected) || (canDeselect && isSelected);

  let extraClass = '';
  if (isSelected)  extraClass = ' hs-hand-card--selected';
  else if (noMana) extraClass = ' hs-hand-card--nomana';
  else if (!canSelect) extraClass = ' hs-hand-card--disabled';
  if (isDragging)  extraClass += ' hs-hand-card--dragging';
  if (isFusing)    extraClass += ' hs-hand-card--fusing';

  return (
    <div
      className={`hs-hand-card${extraClass}`}
      data-rarity={card.rarity}
      style={{
        ...fanStyle,
        '--rarity-color': rarityColor,
        marginLeft      : `calc(-1 * var(--card-width, 140px) / 2)`,
        pointerEvents   : isDragging ? 'none' : 'auto',
        // Hint cursor when draggable
        cursor          : canSelect && !noMana && !isDragging ? 'grab' : 'default',
      } as React.CSSProperties}
      onMouseDown={e => {
        if (canSelect && !noMana) {
          onStartDrag(e);
        }
      }}
      onClick={() => {
        if (clickable) onToggle();
      }}
      onMouseEnter={() => clickable && playHoverSound()}
      title={noMana ? `Sem mana (custo: ${cost})` : (card.description || card.name)}
    >
      <div className="hs-card-inner" data-rarity={card.rarity}>
        <div className="hs-card-cost" style={{ background: rarityColor }}>{cost}</div>

        {isSelected && (
          <div className="hs-card-sel-order">
            {selOrder === 1 ? '①' : selOrder === 2 ? '②' : '③'}
          </div>
        )}

        {noMana && (
          <div className="hs-card-nomana-overlay">
            <span>💧{cost}</span>
          </div>
        )}

        <div className="hs-card-art">
          <div className="hs-card-art-bg"
               style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }} />
          {card.iconUrl ? (
            <img className="hs-card-art-icon" src={card.iconUrl} alt={card.name} loading="lazy"
                 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="hs-card-art-emoji" style={{ borderColor: rarityColor }}>
              {card.rarityEmoji}
            </div>
          )}
          <div className="hs-card-rarity-badge" style={{ color: rarityColor, borderColor: rarityColor }}>
            {card.rarityLabel}
          </div>
          <div className="hs-card-game-thumb">
            <img src={card.gameHeaderUrl} alt={card.gameName} loading="lazy"
                 onError={e => { const p = (e.target as HTMLImageElement).parentElement; if (p) p.style.display = 'none'; }} />
          </div>
        </div>

        <div className="hs-card-body">
          <div className="hs-card-name">{card.name}</div>
          <div className="hs-card-game">{card.gameName}</div>
          {card.description && <div className="hs-card-desc">{card.description}</div>}
        </div>

        <div className="hs-card-footer">
          <span className="hs-card-pct">{pctDisplay}</span>
          <div className="hs-card-damage" style={{ color: rarityColor }}>
            <span>⚔</span><strong>{card.damage}</strong>
          </div>
        </div>

        {isSelected && <div className="hs-card-selected-overlay" />}
      </div>
    </div>
  );
};

// ─── Sub: Bot Face-Down Card ──────────────────────────────────────────────────

const BotFaceDown: React.FC<{ fanStyle: Record<string, string | number> }> = ({ fanStyle }) => (
  <div
    className="hs-bot-card"
    style={{ ...fanStyle, marginLeft: 'calc(-1 * 28px)' } as React.CSSProperties}
  >
    <div className="hs-bot-card-inner">
      <div className="hs-bot-card-back">🤖</div>
    </div>
  </div>
);

// ─── Sub: Arena Mini Card (result screens) ────────────────────────────────────

const ArenaCard: React.FC<{
  card        : TrophyCard;
  isWinner   ?: boolean;
  isAttacking?: boolean;
  isDestroyed?: boolean;
  delay      ?: number;
}> = ({ card, isWinner, isAttacking, isDestroyed, delay = 0 }) => {
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const cost = getCardCost(card.rarity);
  const pctDisplay = card.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : '??%';
  
  const cardClass = [
    'hs-arena-card',
    isWinner ? 'hs-arena-card--winner' : '',
    isAttacking ? 'hs-arena-card--attacking' : '',
    isDestroyed ? 'hs-arena-card--destroyed' : ''
  ].filter(Boolean).join(' ');
  
  return (
    <div
      className={cardClass}
      data-rarity={card.rarity}
      style={{ '--rarity-color': rarityColor, animationDelay: `${delay}s` } as React.CSSProperties}
      title={card.description || card.name}
    >
      <div className="hs-card-mini" data-rarity={card.rarity}>
        <div className="hs-card-mini-cost" style={{ background: rarityColor }}>{cost}</div>
        <div className="hs-card-mini-art">
          <div className="hs-card-mini-art-bg" style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }} />
          {card.iconUrl ? (
            <img className="hs-card-mini-art-icon" src={card.iconUrl} alt={card.name} loading="lazy"
                 onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="hs-card-mini-art-emoji" style={{ borderColor: rarityColor }}>{card.rarityEmoji}</div>
          )}
          <div className="hs-card-mini-rarity" style={{ color: rarityColor, borderColor: rarityColor }}>
            {card.rarityLabel}
          </div>
        </div>
        <div className="hs-card-mini-body">
          <div className="hs-card-mini-name">{card.name}</div>
          <div className="hs-card-mini-game">{card.gameName}</div>
        </div>
        <div className="hs-card-mini-footer">
          <span className="hs-card-mini-pct">{pctDisplay}</span>
          <div className="hs-card-mini-damage" style={{ color: rarityColor }}>⚔ <strong>{card.damage}</strong></div>
        </div>
      </div>
      {isWinner && <div className="hs-arena-winner-glow" />}
    </div>
  );
};

const ArenaColumn: React.FC<{
  cards      : TrophyCard[];
  total      : number;
  isWinner  ?: boolean;
  isLoser   ?: boolean;
  label      : string;
}> = ({ cards, total, isWinner, isLoser, label }) => (
  <div className="hs-arena-column">
    <div className="hs-arena-column-label">{label}</div>
    {cards.length === 0 ? (
      <div className="hs-arena-slot-empty">—</div>
    ) : (
      <>
        <div className="hs-arena-cards-row">
          {cards.map((c, i) => (
            <ArenaCard 
              key={c.id} 
              card={c} 
              isWinner={isWinner}
              isAttacking={isWinner}
              isDestroyed={isLoser}
              delay={i * 0.08} 
            />
          ))}
        </div>
        <div className="hs-arena-total" style={{ color: isWinner ? '#4ade80' : 'var(--txt2)' }}>
          Total: <strong>{total}</strong>{isWinner && ' ⚔'}
        </div>
      </>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const DuelBattle: React.FC = () => {
  const {
    phase, playerHand, botHand,
    playerHp, botHp, currentMana, maxMana,
    round,
    selectedPlayerCards, selectedBotCards,
    roundWinner, gameWinner,
    damageDealt, damageTarget,
    timeLeft, isTimerRunning, isPlayerReady,
    toggleCard, fuseCards, pressReady,
    botPlay, resolveRound, nextRound, resetBattle, tickTimer,
  } = useBattleStore();

  const [showDamage, setShowDamage] = useState(false);
  const [fusingCardIds, setFusingCardIds] = useState<string[]>([]);

  // Audio
  useEffect(() => { initAudio(); }, []);

  // Fan layouts
  const playerFan = useFanLayout(playerHand.length, 140, 18);
  const botFan    = useFanLayout(botHand.length,    56,  8);

  // Mana calculations
  const spentMana = useMemo(
    () => selectedPlayerCards.reduce((s, c) => s + getCardCost(c.rarity), 0),
    [selectedPlayerCards],
  );

  // canDrop guard for drag system
  const canDrop = useCallback((card: TrophyCard) => {
    if (phase !== 'battle' || isPlayerReady) return false;
    if (selectedPlayerCards.length >= 3) return false;
    const alreadySel = selectedPlayerCards.some(c => c.id === card.id);
    if (alreadySel) return false;
    const cost = getCardCost(card.rarity);
    return spentMana + cost <= currentMana;
  }, [phase, isPlayerReady, selectedPlayerCards, spentMana, currentMana]);

  const handleDrop = useCallback((card: TrophyCard) => {
    playCardPlaySound();
    toggleCard(card);
  }, [toggleCard]);

  const { drag, startDrag, dropZoneRef } = useDragCard(handleDrop, canDrop);

  // Timer
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => {
      tickTimer();
      if (timeLeft <= 6 && timeLeft > 1) playTickSound();
    }, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, tickTimer, timeLeft]);

  // Bot plays
  useEffect(() => {
    if (phase === 'battle' && isPlayerReady && selectedBotCards.length === 0) {
      playReadySound();
      const t = setTimeout(() => botPlay(), 500);
      return () => clearTimeout(t);
    }
  }, [phase, isPlayerReady, selectedBotCards.length, botPlay]);

  // Resolve
  useEffect(() => {
    if (phase === 'battle' && isPlayerReady && selectedBotCards.length >= 0 && isPlayerReady) {
      const t = setTimeout(() => resolveRound(), 900);
      return () => clearTimeout(t);
    }
  }, [phase, isPlayerReady, selectedBotCards, resolveRound]); // eslint-disable-line

  // Sound on result
  useEffect(() => {
    if (phase === 'round-result' && roundWinner) {
      roundWinner === 'player' ? playWinRoundSound() : roundWinner === 'bot' ? playLoseRoundSound() : null;
      setShowDamage(true);
      const t = setTimeout(() => setShowDamage(false), 2000);
      return () => clearTimeout(t);
    }
  }, [phase, roundWinner]);

  useEffect(() => {
    if (phase === 'game-over' && gameWinner) {
      gameWinner === 'player' ? playGameWinSound() : playGameLoseSound();
    }
  }, [phase, gameWinner]);

  const handleToggle = useCallback((card: TrophyCard) => {
    playCardSelectSound();
    toggleCard(card);
  }, [toggleCard]);

  const handlePressReady = useCallback(() => {
    if (selectedPlayerCards.length > 0) playReadySound();
    pressReady();
  }, [pressReady, selectedPlayerCards.length]);

  // Fusion detection
  const fusablePair = useMemo<[TrophyCard, TrophyCard] | null>(() => {
    for (let i = 0; i < selectedPlayerCards.length; i++) {
      for (let j = i + 1; j < selectedPlayerCards.length; j++) {
        if (selectedPlayerCards[i].rarity === selectedPlayerCards[j].rarity) {
          return [selectedPlayerCards[i], selectedPlayerCards[j]];
        }
      }
    }
    return null;
  }, [selectedPlayerCards]);

  const playerTotal = useMemo(() => selectedPlayerCards.reduce((s, c) => s + c.damage, 0), [selectedPlayerCards]);
  const botTotal    = useMemo(() => selectedBotCards.reduce((s, c) => s + c.damage, 0),    [selectedBotCards]);

  const timerPct   = (timeLeft / 30) * 100;
  const timerColor = timeLeft <= 5 ? '#f87171' : timeLeft <= 10 ? '#fbbf24' : '#4ade80';
  const nextDraw   = 4 - selectedPlayerCards.length;

  // ──────────────────────────────────────────────────────────────────────────
  // GAME OVER
  // ──────────────────────────────────────────────────────────────────────────
  if (phase === 'game-over') {
    const won = gameWinner === 'player';
    return (
      <div className="hs-gameover bd-gameover">
        <div className="bd-gameover-particles" aria-hidden="true">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="bd-particle" style={{ '--i': i } as React.CSSProperties} />
          ))}
        </div>
        <div className="hs-gameover-icon">{won ? '🏆' : '💀'}</div>
        <h2 className="hs-gameover-title" style={{ color: won ? '#4ade80' : '#f87171' }}>
          {won ? 'Vitória!' : 'Derrota!'}
        </h2>
        <p className="hs-gameover-sub">
          {won ? 'Suas conquistas dominaram o campo de batalha!' : 'O bot foi mais forte desta vez!'}
        </p>
        <div className="hs-gameover-hp">
          <div className="hs-gameover-hp-side">
            <span className="hs-gameover-hp-label">💙 Você</span>
            <span className="hs-gameover-hp-val" style={{ color: won ? '#4ade80' : '#f87171' }}>
              {playerHp > 0 ? playerHp.toLocaleString() : '💀 0'}
            </span>
          </div>
          <div className="hs-gameover-hp-div">⚔️</div>
          <div className="hs-gameover-hp-side">
            <span className="hs-gameover-hp-label">🤖 Bot</span>
            <span className="hs-gameover-hp-val" style={{ color: !won ? '#4ade80' : '#f87171' }}>
              {botHp > 0 ? botHp.toLocaleString() : '💀 0'}
            </span>
          </div>
        </div>
        <button className="hs-btn-primary" onClick={resetBattle} onMouseEnter={playHoverSound}>
          🔄 Jogar Novamente
        </button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ROUND RESULT
  // ──────────────────────────────────────────────────────────────────────────
  if (phase === 'round-result') {
    const playerWon = roundWinner === 'player';
    const botWon    = roundWinner === 'bot';
    const isDraw    = roundWinner === 'draw';
    return (
      <div className="hs-round-result">
        <div className="hs-round-result-title">
          {isDraw ? '🤝 Empate! Nenhum dano.' :
           playerWon ? `✅ Você venceu! Bot tomou ${damageDealt.toLocaleString()} de dano.` :
           `❌ Bot venceu! Você tomou ${damageDealt.toLocaleString()} de dano.`}
        </div>
        <div className="hs-round-result-hp">
          <HpBar hp={playerHp} label="💙 Você"  side="player" showDamage={damageTarget === 'player' ? damageDealt : undefined} />
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.2)', padding: '0 12px', alignSelf: 'center' }}>⚔</div>
          <HpBar hp={botHp}    label="🤖 Bot"   side="bot"    showDamage={damageTarget === 'bot'    ? damageDealt : undefined} />
        </div>
        <div className="hs-result-arena">
          <ArenaColumn cards={selectedPlayerCards} total={playerTotal} isWinner={playerWon} isLoser={botWon} label="Suas cartas" />
          <div className="hs-arena-vs">VS</div>
          <ArenaColumn cards={selectedBotCards}    total={botTotal}    isWinner={botWon}    isLoser={playerWon} label="Bot" />
        </div>
        <button className="hs-btn-primary" onClick={nextRound} onMouseEnter={playHoverSound}>
          Próximo Round →
        </button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BATTLE PHASE — The Board
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="bd-root">

      {/* ── Ambient board background ── */}
      <div className="bd-board-bg" aria-hidden="true">
        <div className="bd-board-texture" />
        <div className="bd-board-vignette" />
        {/* Floating particles */}
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="bd-ambient-particle" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>

      {/* ── Ghost card following cursor ── */}
      {drag.card && (
        <GhostCard
          card={drag.card}
          x={drag.x} y={drag.y}
          isOverZone={drag.isOverDropZone}
          isSnapBack={drag.isSnapBack}
          originX={drag.originX}
          originY={drag.originY}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TOP HUD
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bd-hud">
        <HpBar hp={playerHp} label="Você" side="player" />

        <div className="bd-hud-center">
          <div className="bd-hud-round">
            <span className="hs-hud-label">Round</span>
            <span className="hs-hud-val">{round}</span>
          </div>
          <ManaCrystals total={currentMana} spent={spentMana} />
          {/* Timer */}
          <div className="hs-hud-timer">
            <span style={{ color: timerColor, fontWeight: 900, fontSize: 15, position: 'relative', zIndex: 1 }}>
              {timeLeft}s
            </span>
            <svg className="hs-timer-ring" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18"
                fill="none" stroke={timerColor} strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPct / 100)}`}
                strokeLinecap="round" transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
          </div>
        </div>

        <HpBar hp={botHp} label="Bot" side="bot" />
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          BOT SECTION (top)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bd-bot-section">
        {/* Bot hand */}
        <div className="bd-bot-hand-row">
          <div className="hs-bot-hand">
            {botHand.map((_, i) => (
              <BotFaceDown key={i} fanStyle={botFan.getCardStyle(i)} />
            ))}
          </div>
          {isPlayerReady && selectedBotCards.length === 0 && (
            <div className="bd-bot-thinking">🤖 <span className="hs-bot-thinking">escolhendo…</span></div>
          )}
        </div>

        {/* Bot board slots */}
        <div className="bd-board-row bd-board-row--bot">
          {Array.from({ length: MAX_SLOTS }).map((_, i) => (
            <BoardSlot
              key={i}
              card={selectedBotCards[i] ?? null}
              side="bot"
            />
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CENTER DIVIDER
      ═══════════════════════════════════════════════════════════════ */}
      <BoardCenter
        playerTotal={playerTotal}
        botTotal={botTotal}
        isReady={isPlayerReady}
        botReady={selectedBotCards.length > 0}
      />

      {/* ═══════════════════════════════════════════════════════════════
          PLAYER SECTION (bottom)
      ═══════════════════════════════════════════════════════════════ */}
      <div className="bd-player-section">

        {/* Player board slots + drop zone */}
        <div
          ref={dropZoneRef}
          className={[
            'bd-board-row bd-board-row--player',
            drag.card ? 'bd-board-row--drag-active' : '',
            drag.isOverDropZone ? 'bd-board-row--drop-ready' : '',
          ].filter(Boolean).join(' ')}
        >
          {Array.from({ length: MAX_SLOTS }).map((_, i) => (
            <BoardSlot
              key={i}
              card={selectedPlayerCards[i] ?? null}
              side="player"
              isTarget={!!(drag.card && !selectedPlayerCards[i])}
              isWinner={false}
            />
          ))}
          {/* Drop zone hint label */}
          {drag.card && selectedPlayerCards.length < MAX_SLOTS && (
            <div className="bd-drop-hint">Solte a carta aqui</div>
          )}
        </div>

        {/* Ready bar */}
        <div className="bd-action-bar">
          <div className="bd-action-left">
            {isPlayerReady ? (
              <span style={{ color: '#4ade80', fontSize: 13 }}>✅ Aguardando bot…</span>
            ) : (
              <>
                <span style={{ fontSize: 12, color: 'var(--txt2)' }}>
                  {selectedPlayerCards.length}/3 no campo
                </span>
                <span className="hs-draw-preview">+{nextDraw} cartas</span>
                <span className="bd-mana-cost-label">💧 {spentMana}/{currentMana}</span>
              </>
            )}
          </div>

          <div className="bd-action-right">
            {/* Fusion button */}
            {!isPlayerReady && fusablePair && (
              <button
                className="hs-btn-fuse"
                onClick={() => { 
                  playCardSelectSound(); 
                  // Ativa animação de fusão nas cartas
                  setFusingCardIds([fusablePair[0].id, fusablePair[1].id]);
                  // Aguarda animação antes de fundir
                  setTimeout(() => {
                    fuseCards(fusablePair[0].id, fusablePair[1].id);
                    setFusingCardIds([]);
                  }, 600);
                }}
                onMouseEnter={playHoverSound}
              >
                ✨ Fundir {fusablePair[0].rarityEmoji}{fusablePair[1].rarityEmoji}
              </button>
            )}

            {!isPlayerReady && (
              <button
                className={`hs-btn-ready${selectedPlayerCards.length > 0 ? ' hs-btn-ready--active' : ''}`}
                onClick={handlePressReady}
                onMouseEnter={playHoverSound}
              >
                {selectedPlayerCards.length === 0
                  ? 'Passar turno'
                  : `Pronto (${selectedPlayerCards.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Player hand */}
        <div className="hs-player-hand">
          {playerHand.map((card, i) => {
            const selIdx       = selectedPlayerCards.findIndex(c => c.id === card.id);
            const selOrder     = selIdx >= 0 ? selIdx + 1 : 0;
            const alreadySel   = selOrder > 0;
            const maxReached   = selectedPlayerCards.length >= 3;
            const cost         = getCardCost(card.rarity);
            const canAfford    = spentMana + cost <= currentMana;
            const noMana       = !alreadySel && !canAfford;
            const canSelect    = !isPlayerReady && !alreadySel && !maxReached && canAfford;
            const canDeselect  = !isPlayerReady && alreadySel;
            const isDragging   = drag.card?.id === card.id;

            const isFusing = fusingCardIds.includes(card.id);

            return (
              <HandCard
                key={card.id}
                card={card}
                fanStyle={playerFan.getCardStyle(i)}
                selOrder={selOrder}
                canSelect={canSelect}
                canDeselect={canDeselect}
                noMana={noMana}
                isDragging={isDragging}
                isFusing={isFusing}
                onStartDrag={e => startDrag(card, e)}
                onToggle={() => handleToggle(card)}
              />
            );
          })}
        </div>

      </div>
    </div>
  );
};

export default DuelBattle;
