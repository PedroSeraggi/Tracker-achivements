

import React, { useEffect, useCallback, useState } from 'react';
import { useBattleStore } from '../../store/useBattleStore';
import type { TrophyCard } from '../../types/duel';
import { useFanLayout } from '../../hooks/useFanLayout';

// ─── Sub-component: card in fan hand ─────────────────────────────────────────

interface HandCardProps {
  card        : TrophyCard;
  index       : number;
  total       : number;
  fanStyle    : Record<string, string | number>;
  isSelected  : boolean;
  canSelect   : boolean;
  isPlaying   : boolean;  
  onSelect    : () => void;
}

const HandCard: React.FC<HandCardProps> = ({
  card, index, total, fanStyle, isSelected, canSelect, isPlaying, onSelect,
}) => {
  const [hovered, setHovered] = useState(false);

  const pctDisplay = card.globalPercent != null
    ? `${card.globalPercent.toFixed(1)}%`
    : '??%';

  const RARITY_COLORS: Record<string, string> = {
    common   : '#9ca3af',
    uncommon : '#4ade80',
    rare     : '#60a5fa',
    epic     : '#c084fc',
    legendary: '#fbbf24',
    mythic   : '#f472b6',
  };
  const rarityColor = RARITY_COLORS[card.rarity] ?? '#9ca3af';

  return (
    <div
      className={[
        'hs-hand-card',
        hovered && canSelect ? 'hs-hand-card--hovered' : '',
        isSelected ? 'hs-hand-card--selected' : '',
        isPlaying  ? 'hs-hand-card--playing'  : '',
        !canSelect && !isSelected ? 'hs-hand-card--dimmed' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ...fanStyle,
        '--rarity-color': rarityColor,
        cursor: canSelect ? 'pointer' : 'default',
        marginLeft: `calc(-1 * var(--card-width, 140px) / 2)`,
      } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => canSelect && onSelect()}
      title={card.description || card.name}
    >
      {/* Card inner */}
      <div className="hs-card-inner" data-rarity={card.rarity}>

        {/* Art area */}
        <div className="hs-card-art">
          <div
            className="hs-card-art-bg"
            style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }}
          />
          {card.iconUrl ? (
            <img
              className="hs-card-art-icon"
              src={card.iconUrl}
              alt={card.name}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="hs-card-art-emoji">{card.rarityEmoji}</div>
          )}
          <div className="hs-card-rarity-badge">{card.rarityLabel}</div>
          <div className="hs-card-game-thumb">
            <img
              src={card.gameHeaderUrl}
              alt={card.gameName}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="hs-card-body">
          <div className="hs-card-name">{card.name}</div>
          <div className="hs-card-game">{card.gameName}</div>
        </div>

        {/* Footer */}
        <div className="hs-card-footer">
          <span className="hs-card-pct">{pctDisplay}</span>
          <div className="hs-card-damage">
            <span>⚔</span>
            <strong>{card.damage}</strong>
          </div>
        </div>

        {/* Selection indicator — inside the card, no border mismatch */}
        {isSelected && (
          <div className="hs-card-selected-overlay" />
        )}
      </div>
    </div>
  );
};

// ─── Sub-component: arena slot ───────────────────────────────────────────────

const ArenaCard: React.FC<{ card: TrophyCard | null; label: string; isWinner?: boolean }> = ({
  card, label, isWinner,
}) => {
  const RARITY_COLORS: Record<string, string> = {
    common   : '#9ca3af',
    uncommon : '#4ade80',
    rare     : '#60a5fa',
    epic     : '#c084fc',
    legendary: '#fbbf24',
    mythic   : '#f472b6',
  };

  if (!card) {
    return (
      <div className="hs-arena-slot hs-arena-slot--empty">
        <div className="hs-arena-slot-label">{label}</div>
        <div className="hs-arena-slot-hint">aguardando…</div>
      </div>
    );
  }

  return (
    <div className={`hs-arena-card ${isWinner ? 'hs-arena-card--winner' : ''}`}
         data-rarity={card.rarity}
         style={{ '--rarity-color': RARITY_COLORS[card.rarity] } as React.CSSProperties}>
      <div className="hs-arena-card-inner">
        <div className="hs-card-art" style={{ flex: '0 0 90px' }}>
          <div className="hs-card-art-bg"
               style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }} />
          {card.iconUrl ? (
            <img className="hs-card-art-icon" src={card.iconUrl} alt={card.name} loading="lazy"
                 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="hs-card-art-emoji">{card.rarityEmoji}</div>
          )}
        </div>
        <div className="hs-arena-card-info">
          <div className="hs-arena-card-label">{label}</div>
          <div className="hs-card-name" style={{ fontSize: 12 }}>{card.name}</div>
          <div className="hs-arena-card-damage">⚔ {card.damage}</div>
        </div>
      </div>
      {isWinner && <div className="hs-arena-winner-glow" />}
    </div>
  );
};

// ─── Sub-component: face-down bot card ───────────────────────────────────────

const BotFaceDown: React.FC<{ index: number; total: number; fanStyle: Record<string, string | number> }> = ({ fanStyle }) => {
  return (
    <div
      className="hs-bot-card"
      style={fanStyle as React.CSSProperties}
    >
      <div className="hs-bot-card-inner">
        <div className="hs-bot-card-back">🤖</div>
      </div>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const DuelBattle: React.FC = () => {
  const {
    phase, playerHand, botHand,
    playerScore, botScore, round,
    selectedPlayerCard, selectedBotCard,
    roundWinner, gameWinner, timeLeft, isTimerRunning,
    playingCard,
    selectCard, botPlay, resolveRound, nextRound, resetBattle, tickTimer,
  } = useBattleStore();

  // ── Timer ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(tickTimer, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, tickTimer]);

  // ── Bot plays when player has chosen ──────────────────────────────────
  useEffect(() => {
    if (phase === 'battle' && selectedPlayerCard && !selectedBotCard) {
      const t = setTimeout(botPlay, 600);
      return () => clearTimeout(t);
    }
  }, [phase, selectedPlayerCard, selectedBotCard, botPlay]);

  // ── Resolve when both cards chosen ────────────────────────────────────
  useEffect(() => {
    if (phase === 'battle' && selectedPlayerCard && selectedBotCard) {
      const t = setTimeout(resolveRound, 900);
      return () => clearTimeout(t);
    }
  }, [phase, selectedPlayerCard, selectedBotCard, resolveRound]);

  const handleSelect = useCallback((card: TrophyCard) => {
    selectCard(card);
  }, [selectCard]);

  // ── Fan layouts (must be before early returns) ───────────────────────────
  const playerFan = useFanLayout(playerHand.length, 140, 18);
  const botFan    = useFanLayout(botHand.length,    56,  8);

  // ── Game Over ──────────────────────────────────────────────────────────
  if (phase === 'game-over') {
    const won = gameWinner === 'player';
    return (
      <div className="hs-gameover">
        <div className="hs-gameover-icon">{won ? '🏆' : '💀'}</div>
        <h2 className="hs-gameover-title" style={{ color: won ? '#4ade80' : '#f87171' }}>
          {won ? 'Vitória!' : 'Derrota!'}
        </h2>
        <p className="hs-gameover-sub">
          {won
            ? 'Suas conquistas dominaram o campo de batalha!'
            : 'O bot foi mais forte desta vez. Tente novamente!'}
        </p>
        <div className="hs-gameover-score">
          <div className="hs-gameover-score-side">
            <div className="hs-gameover-score-label">Você</div>
            <div className="hs-gameover-score-num" style={{ color: won ? '#4ade80' : 'var(--txt)' }}>
              {playerScore}
            </div>
          </div>
          <div className="hs-gameover-score-vs">VS</div>
          <div className="hs-gameover-score-side">
            <div className="hs-gameover-score-label">Bot</div>
            <div className="hs-gameover-score-num" style={{ color: !won ? '#f87171' : 'var(--txt)' }}>
              {botScore}
            </div>
          </div>
        </div>
        <button className="hs-btn-primary" onClick={resetBattle}>
          🔄 Jogar Novamente
        </button>
      </div>
    );
  }

  // ── Round Result ───────────────────────────────────────────────────────
  if (phase === 'round-result') {
    const playerWon = roundWinner === 'player';
    const botWon    = roundWinner === 'bot';
    const isDraw    = roundWinner === 'draw';

    return (
      <div className="hs-round-result">
        <div className="hs-round-result-header">
          <div className="hs-round-result-title">
            {isDraw ? '🤝 Empate!' : playerWon ? '✅ Você venceu o round!' : '❌ Bot venceu o round'}
          </div>
          <div className="hs-scoreboard">
            <div className="hs-scoreboard-side">
              <span className="hs-scoreboard-label">Você</span>
              <span className="hs-scoreboard-num" style={{ color: '#4ade80' }}>{playerScore}</span>
            </div>
            <span className="hs-scoreboard-vs">vs</span>
            <div className="hs-scoreboard-side">
              <span className="hs-scoreboard-label">Bot</span>
              <span className="hs-scoreboard-num" style={{ color: '#f87171' }}>{botScore}</span>
            </div>
          </div>
        </div>

        <div className="hs-arena-row">
          <ArenaCard card={selectedPlayerCard} label="Sua carta" isWinner={playerWon} />
          <div className="hs-arena-vs">VS</div>
          <ArenaCard card={selectedBotCard} label="Bot" isWinner={botWon} />
        </div>

        {isDraw && (
          <div className="hs-draw-badge">Dano igual — nenhum ponto!</div>
        )}

        <button className="hs-btn-primary" onClick={nextRound}>
          Próximo Round →
        </button>
      </div>
    );
  }

  // ── Battle Phase ───────────────────────────────────────────────────────
  const timerColor =
    timeLeft <= 3 ? '#f87171' :
    timeLeft <= 5 ? '#fbbf24' : '#4ade80';

  return (
    <div className="hs-battle">

      {/* ── Header: score + round + timer ── */}
      <div className="hs-battle-header">
        <div className="hs-hud-block">
          <div className="hs-hud-label">Round</div>
          <div className="hs-hud-val">{round}</div>
        </div>
        <div className="hs-hud-score">
          <div className="hs-hud-score-side">
            <div className="hs-hud-label">Você</div>
            <div className="hs-hud-val" style={{ color: '#4ade80', fontSize: 28 }}>{playerScore}</div>
          </div>
          <div className="hs-hud-score-div">–</div>
          <div className="hs-hud-score-side">
            <div className="hs-hud-label">Bot</div>
            <div className="hs-hud-val" style={{ color: '#f87171', fontSize: 28 }}>{botScore}</div>
          </div>
        </div>
        <div className="hs-hud-block">
          <div className="hs-hud-label">Tempo</div>
          <div className="hs-hud-val hs-hud-timer" style={{ color: timerColor }}>
            {timeLeft}s
            <svg className="hs-timer-ring" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="var(--b2)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke={timerColor}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - timeLeft / 10)}`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Bot zone (top) ── */}
      <div className="hs-bot-zone">
        <div className="hs-bot-zone-label">
          🤖 Bot — {botHand.length} carta{botHand.length !== 1 ? 's' : ''}
          {selectedPlayerCard && !selectedBotCard && (
            <span className="hs-bot-thinking"> escolhendo…</span>
          )}
        </div>
        <div className="hs-bot-hand">
          {botHand.map((_, i) => (
            <BotFaceDown key={i} index={i} total={botHand.length} fanStyle={botFan.getCardStyle(i)} />
          ))}
        </div>
      </div>

      {/* ── Arena (center) ── */}
      <div className="hs-arena">
        {selectedPlayerCard || selectedBotCard ? (
          <div className="hs-arena-row">
            <ArenaCard card={selectedPlayerCard} label="Sua carta" />
            <div className="hs-arena-vs">VS</div>
            <ArenaCard card={selectedBotCard} label="Bot" />
          </div>
        ) : (
          <div className="hs-arena-empty">
            {selectedPlayerCard
              ? '✅ Carta jogada! Aguardando bot…'
              : 'Escolha uma carta da sua mão'}
          </div>
        )}
      </div>

      {/* ── Player hand (bottom) ── */}
      <div className="hs-player-zone">
        <div className="hs-player-zone-label">
          🎴 Sua mão — {playerHand.length} carta{playerHand.length !== 1 ? 's' : ''}
          {!selectedPlayerCard && (
            <span style={{ fontSize: 11, color: 'var(--txt3)', marginLeft: 8 }}>
              clique para jogar
            </span>
          )}
        </div>
        <div className="hs-player-hand">
          {playerHand.map((card, i) => (
            <HandCard
              key={card.id}
              card={card}
              index={i}
              total={playerHand.length}
              fanStyle={playerFan.getCardStyle(i)}
              isSelected={selectedPlayerCard?.id === card.id}
              isPlaying={playingCard?.id === card.id}
              canSelect={!selectedPlayerCard && phase === 'battle'}
              onSelect={() => handleSelect(card)}
            />
          ))}
        </div>
      </div>

      {/* ── Played card toast ── */}
      {selectedPlayerCard && !selectedBotCard && (
        <div className="hs-played-toast">
          ✅ Carta jogada! Aguardando bot…
        </div>
      )}
    </div>
  );
};

export default DuelBattle;
