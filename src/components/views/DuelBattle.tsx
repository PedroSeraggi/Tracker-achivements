// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/DuelBattle.tsx  (v2)
//
//  Novidades:
//    - Seleção de até 3 cartas com badge de ordem (①②③)
//    - Botão "Pronto" sempre visível, mostra quantas cartas selecionadas
//    - Badge de custo em cada carta (base na raridade)
//    - Arena mostra até 3 cartas de cada lado com total de dano
//    - Layout corrigido: hand fica na base, arena cresce no meio
//    - Bot hand: cartas viradas com arco espelhado
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useCallback } from 'react';
import { useBattleStore, getCardCost } from '../../store/useBattleStore';
import { useFanLayout } from '../../hooks/useFanLayout';
import type { TrophyCard } from '../../types/duel';

// ─── Cores de raridade ────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common   : '#9ca3af',
  uncommon : '#4ade80',
  rare     : '#60a5fa',
  epic     : '#c084fc',
  legendary: '#fbbf24',
  mythic   : '#f472b6',
};

// ─── Sub: carta na mão do jogador ────────────────────────────────────────────

interface HandCardProps {
  card       : TrophyCard;
  index      : number;
  total      : number;
  fanStyle   : Record<string, string | number>;
  selOrder   : number;  // 0 = não selecionada, 1/2/3 = ordem de seleção
  canSelect  : boolean;
  canDeselect: boolean;
  onToggle   : () => void;
}

const HandCard: React.FC<HandCardProps> = ({
  card, fanStyle, selOrder, canSelect, canDeselect, onToggle,
}) => {
  const isSelected  = selOrder > 0;
  const cost        = getCardCost(card.rarity);
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const pctDisplay  = card.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : '??%';
  const clickable   = (canSelect && !isSelected) || (canDeselect && isSelected);

  return (
    <div
      className={[
        'hs-hand-card',
        isSelected ? 'hs-hand-card--selected' : '',
        !clickable  ? 'hs-hand-card--dimmed' : '',
      ].filter(Boolean).join(' ')}
      style={{
        ...fanStyle,
        '--rarity-color': rarityColor,
        cursor: clickable ? 'pointer' : 'default',
        marginLeft: `calc(-1 * var(--card-width, 140px) / 2)`,
      } as React.CSSProperties}
      onClick={() => clickable && onToggle()}
      title={card.description || card.name}
    >
      <div className="hs-card-inner" data-rarity={card.rarity}>

        {/* Badge de custo — canto superior esquerdo */}
        <div className="hs-card-cost" style={{ background: rarityColor }}>
          {cost}
        </div>

        {/* Badge de ordem de seleção — canto superior direito */}
        {isSelected && (
          <div className="hs-card-sel-order">
            {selOrder === 1 ? '①' : selOrder === 2 ? '②' : '③'}
          </div>
        )}

        {/* Arte */}
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
            <div className="hs-card-art-emoji" style={{ borderColor: rarityColor }}>
              {card.rarityEmoji}
            </div>
          )}
          <div className="hs-card-rarity-badge" style={{ color: rarityColor, borderColor: rarityColor }}>
            {card.rarityLabel}
          </div>
          <div className="hs-card-game-thumb">
            <img
              src={card.gameHeaderUrl} alt={card.gameName} loading="lazy"
              onError={(e) => { const p = (e.target as HTMLImageElement).parentElement; if (p) p.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Corpo */}
        <div className="hs-card-body">
          <div className="hs-card-name">{card.name}</div>
          <div className="hs-card-game">{card.gameName}</div>
          {card.description && (
            <div className="hs-card-desc">{card.description}</div>
          )}
        </div>

        {/* Rodapé */}
        <div className="hs-card-footer">
          <span className="hs-card-pct">{pctDisplay}</span>
          <div className="hs-card-damage" style={{ color: rarityColor }}>
            <span>⚔</span>
            <strong>{card.damage}</strong>
          </div>
        </div>

        {/* Overlay de seleção — dentro da carta para evitar desalinhamento */}
        {isSelected && <div className="hs-card-selected-overlay" />}
      </div>
    </div>
  );
};

// ─── Sub: carta do bot (virada) ───────────────────────────────────────────────

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

// ─── Sub: carta na arena (formato completo miniatura) ─────────────────────────

const ArenaCard: React.FC<{
  card     : TrophyCard;
  isWinner?: boolean;
  delay    ?: number;
}> = ({ card, isWinner, delay = 0 }) => {
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const cost = getCardCost(card.rarity);
  const pctDisplay = card.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : '??%';

  return (
    <div
      className={`hs-arena-card${isWinner ? ' hs-arena-card--winner' : ''}`}
      data-rarity={card.rarity}
      style={{
        '--rarity-color': rarityColor,
        animationDelay: `${delay}s`,
      } as React.CSSProperties}
      title={card.description || card.name}
    >
      {/* Card miniatura - mesmo formato da mão */}
      <div className="hs-card-mini" data-rarity={card.rarity}>
        {/* Badge de custo */}
        <div className="hs-card-mini-cost" style={{ background: rarityColor }}>
          {cost}
        </div>

        {/* Arte */}
        <div className="hs-card-mini-art">
          <div
            className="hs-card-mini-art-bg"
            style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }}
          />
          {card.iconUrl ? (
            <img
              className="hs-card-mini-art-icon"
              src={card.iconUrl}
              alt={card.name}
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="hs-card-mini-art-emoji" style={{ borderColor: rarityColor }}>
              {card.rarityEmoji}
            </div>
          )}
          <div className="hs-card-mini-rarity" style={{ color: rarityColor, borderColor: rarityColor }}>
            {card.rarityLabel}
          </div>
          <div className="hs-card-mini-thumb">
            <img
              src={card.gameHeaderUrl}
              alt={card.gameName}
              loading="lazy"
              onError={(e) => { const p = (e.target as HTMLImageElement).parentElement; if (p) p.style.display = 'none'; }}
            />
          </div>
        </div>

        {/* Corpo */}
        <div className="hs-card-mini-body">
          <div className="hs-card-mini-name">{card.name}</div>
          <div className="hs-card-mini-game">{card.gameName}</div>
          {card.description && (
            <div className="hs-card-mini-desc">{card.description}</div>
          )}
        </div>

        {/* Footer */}
        <div className="hs-card-mini-footer">
          <span className="hs-card-mini-pct">{pctDisplay}</span>
          <div className="hs-card-mini-damage">
            <span>⚔</span>
            <strong>{card.damage}</strong>
          </div>
        </div>
      </div>

      {isWinner && <div className="hs-arena-winner-glow" />}
    </div>
  );
};

// ─── Sub: coluna de arena (até 3 cartas) ──────────────────────────────────────

const ArenaColumn: React.FC<{
  cards    : TrophyCard[];
  total    : number;
  isWinner?: boolean;
  label    : string;
  isEmpty  ?: boolean;
  waiting  ?: boolean;
}> = ({ cards, total, isWinner, label, isEmpty, waiting }) => (
  <div className="hs-arena-column">
    <div className="hs-arena-column-label">{label}</div>
    {isEmpty || cards.length === 0 ? (
      <div className="hs-arena-slot-empty">
        {waiting ? <span className="hs-bot-thinking">⏳ escolhendo…</span> : 'aguardando'}
      </div>
    ) : (
      <>
        <div className="hs-arena-cards-row">
          {cards.map((c, i) => (
            <ArenaCard key={c.id} card={c} isWinner={isWinner} delay={i * 0.08} />
          ))}
        </div>
        <div className="hs-arena-total" style={{ color: isWinner ? '#4ade80' : 'var(--txt2)' }}>
          Total: <strong>{total}</strong>
          {isWinner && ' 🏆'}
        </div>
      </>
    )}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

const DuelBattle: React.FC = () => {
  const {
    phase, playerHand, botHand,
    playerScore, botScore, round,
    selectedPlayerCards, selectedBotCards,
    roundWinner, gameWinner,
    timeLeft, isTimerRunning, isPlayerReady,
    toggleCard, pressReady, botPlay, resolveRound, nextRound, resetBattle, tickTimer,
  } = useBattleStore();

  // ── Fan layouts ──────────────────────────────────────────────────────────
  const playerFan = useFanLayout(playerHand.length, 140, 18);
  const botFan    = useFanLayout(botHand.length,    56,  8);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(tickTimer, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, tickTimer]);

  // ── Bot joga após player confirmar ───────────────────────────────────────
  useEffect(() => {
    if (phase === 'battle' && isPlayerReady && selectedBotCards.length === 0) {
      const t = setTimeout(() => { botPlay(); }, 500);
      return () => clearTimeout(t);
    }
  }, [phase, isPlayerReady, selectedBotCards.length, botPlay]);

  // ── Resolve quando ambos têm cartas ou player passou sem cartas ──────────
  useEffect(() => {
    if (
      phase === 'battle' &&
      isPlayerReady &&
      selectedBotCards.length > 0
    ) {
      const t = setTimeout(() => { resolveRound(); }, 900);
      return () => clearTimeout(t);
    }
  }, [phase, isPlayerReady, selectedBotCards.length, resolveRound]);

  const handleToggle = useCallback((card: TrophyCard) => {
    toggleCard(card);
  }, [toggleCard]);

  // ── Somas de dano ────────────────────────────────────────────────────────
  const playerTotal = selectedPlayerCards.reduce((s, c) => s + c.damage, 0);
  const botTotal    = selectedBotCards.reduce((s, c) => s + c.damage, 0);

  // ── Timer visual ─────────────────────────────────────────────────────────
  const timerPct   = (timeLeft / 30) * 100;
  const timerColor = timeLeft <= 5 ? '#f87171' : timeLeft <= 10 ? '#fbbf24' : '#4ade80';

  // ── Quantas cartas comprar no próximo turno ──────────────────────────────
  const nextDraw = 4 - selectedPlayerCards.length;

  // ──────────────────────────────────────────────────────────────────────────
  // GAME OVER
  // ──────────────────────────────────────────────────────────────────────────
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
            <span className="hs-gameover-score-label">Você</span>
            <span className="hs-gameover-score-num" style={{ color: won ? '#4ade80' : 'var(--txt)' }}>{playerScore}</span>
          </div>
          <span className="hs-gameover-score-vs">VS</span>
          <div className="hs-gameover-score-side">
            <span className="hs-gameover-score-label">Bot</span>
            <span className="hs-gameover-score-num" style={{ color: !won ? '#f87171' : 'var(--txt)' }}>{botScore}</span>
          </div>
        </div>
        <button className="hs-btn-primary" onClick={resetBattle}>🔄 Jogar Novamente</button>
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
        {/* Título */}
        <div className="hs-round-result-title">
          {isDraw
            ? '🤝 Empate! Dano igual — nenhum ponto!'
            : playerWon
            ? `✅ Você venceu o round! (+${playerTotal} vs ${botTotal})`
            : `❌ Bot venceu o round (${playerTotal} vs +${botTotal})`}
        </div>

        {/* Placar */}
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

        {/* Cartas lado a lado */}
        <div className="hs-result-arena">
          <ArenaColumn
            cards={selectedPlayerCards}
            total={playerTotal}
            isWinner={playerWon}
            label="Suas cartas"
          />
          <div className="hs-arena-vs">VS</div>
          <ArenaColumn
            cards={selectedBotCards}
            total={botTotal}
            isWinner={botWon}
            label="Bot"
          />
        </div>

        <button className="hs-btn-primary" onClick={nextRound}>
          Próximo Round →
        </button>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BATTLE PHASE
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="hs-battle">

      {/* ── HUD ── */}
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

        {/* Timer ring */}
        <div className="hs-hud-block">
          <div className="hs-hud-label">Tempo</div>
          <div className="hs-hud-timer">
            <span style={{ color: timerColor, fontWeight: 900, fontSize: 15, position: 'relative', zIndex: 1 }}>
              {timeLeft}s
            </span>
            <svg className="hs-timer-ring" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="var(--b2, #223344)" strokeWidth="3" />
              <circle
                cx="22" cy="22" r="18"
                fill="none"
                stroke={timerColor}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPct / 100)}`}
                strokeLinecap="round"
                transform="rotate(-90 22 22)"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* ── Bot zone ── */}
      <div className="hs-bot-zone">
        <div className="hs-bot-zone-label">
          🤖 Bot — {botHand.length} carta{botHand.length !== 1 ? 's' : ''}
          {isPlayerReady && selectedBotCards.length === 0 && (
            <span className="hs-bot-thinking"> escolhendo…</span>
          )}
        </div>
        <div className="hs-bot-hand">
          {botHand.map((_, i) => (
            <BotFaceDown key={i} fanStyle={botFan.getCardStyle(i)} />
          ))}
        </div>
      </div>

      {/* ── Arena ── */}
      <div className="hs-arena">
        {selectedPlayerCards.length > 0 || isPlayerReady ? (
          <div className="hs-arena-live">
            <div className="hs-arena-live-side">
              <div className="hs-arena-live-label">Você · {playerTotal} ⚔</div>
              <div className="hs-arena-live-cards">
                {selectedPlayerCards.map((c) => (
                  <ArenaCard key={c.id} card={c} />
                ))}
              </div>
            </div>
            <div className="hs-arena-vs">VS</div>
            <div className="hs-arena-live-side">
              <div className="hs-arena-live-label">Bot</div>
              <div className="hs-arena-live-cards">
                {isPlayerReady && selectedBotCards.length === 0 ? (
                  <div className="hs-arena-slot-empty">
                    <span className="hs-bot-thinking">⏳</span>
                  </div>
                ) : (
                  selectedBotCards.map((c) => <ArenaCard key={c.id} card={c} />)
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hs-arena-hint">
            Selecione cartas da sua mão e clique em <strong>Pronto</strong>
          </div>
        )}
      </div>

      {/* ── Player hand ── */}
      <div className="hs-player-zone">

        {/* Barra de ação: info + botão Pronto */}
        <div className="hs-ready-bar">
          <div className="hs-ready-info">
            {isPlayerReady ? (
              <span style={{ color: '#4ade80' }}>✅ Aguardando bot…</span>
            ) : (
              <>
                <span>
                  {selectedPlayerCards.length}/{3} cartas
                </span>
                <span className="hs-draw-preview">
                  → próx. turno: +{nextDraw} carta{nextDraw !== 1 ? 's' : ''}
                </span>
              </>
            )}
          </div>

          {!isPlayerReady && (
            <button
              className={`hs-btn-ready ${selectedPlayerCards.length > 0 ? 'hs-btn-ready--active' : ''}`}
              onClick={pressReady}
            >
              {selectedPlayerCards.length === 0
                ? 'Passar turno'
                : `Pronto (${selectedPlayerCards.length} carta${selectedPlayerCards.length > 1 ? 's' : ''})`}
            </button>
          )}
        </div>

        {/* Mão de cartas em leque */}
        <div className="hs-player-hand">
          {playerHand.map((card, i) => {
            const selIdx = selectedPlayerCards.findIndex((c) => c.id === card.id);
            const selOrder = selIdx >= 0 ? selIdx + 1 : 0;
            const alreadySelected = selOrder > 0;
            const maxReached = selectedPlayerCards.length >= 3;

            return (
              <HandCard
                key={card.id}
                card={card}
                index={i}
                total={playerHand.length}
                fanStyle={playerFan.getCardStyle(i)}
                selOrder={selOrder}
                canSelect={!isPlayerReady && !alreadySelected && !maxReached}
                canDeselect={!isPlayerReady && alreadySelected}
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
