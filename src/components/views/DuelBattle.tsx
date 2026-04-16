// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/DuelBattle.tsx  (v3)
//
//  Preserva TODAS as mudanças de UI do v2 (hs-card-mini, sons, etc.)
//  e adiciona:
//    - Barras de HP no HUD (substituem placar de pontos)
//    - Gemas de mana no HUD
//    - Bloqueio de seleção por mana insuficiente (dimm diferente)
//    - Botão "✨ Fundir" quando 2 cartas de mesma raridade selecionadas
//    - Tela de round-result mostra o dano causado e HP restante
//    - Tela de game-over mostra HP final
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { useBattleStore, getCardCost } from '../../store/useBattleStore';
import { useFanLayout } from '../../hooks/useFanLayout';
import type { TrophyCard } from '../../types/duel';
import {
  playHoverSound,
  playCardSelectSound,
  playCardPlaySound,
  playReadySound,
  playWinRoundSound,
  playLoseRoundSound,
  playGameWinSound,
  playGameLoseSound,
  playTickSound,
  playFuseSound,
  initAudio,
} from '../../utils/soundEffects';

// ─── Cores ────────────────────────────────────────────────────────────────────

const RARITY_COLOR: Record<string, string> = {
  common   : '#9ca3af',
  uncommon : '#4ade80',
  rare     : '#60a5fa',
  epic     : '#c084fc',
  legendary: '#fbbf24',
  mythic   : '#f472b6',
};

const INITIAL_HP = 3500;

// ─── Sub: barra de HP ─────────────────────────────────────────────────────────

const HpBar: React.FC<{ hp: number; maxHp?: number; label: string; damaged?: boolean }> = ({
  hp, maxHp = INITIAL_HP, label, damaged,
}) => {
  const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const barColor =
    pct > 50 ? '#4ade80' :
    pct > 25 ? '#fbbf24' : '#f87171';

  return (
    <div className="hs-hp-block">
      <div className="hs-hp-label">{label}</div>
      <div className="hs-hp-bar-wrap">
        <div
          className={`hs-hp-bar${damaged ? ' hs-hp-bar--damaged' : ''}`}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <div className="hs-hp-val" style={{ color: barColor }}>{hp.toLocaleString()}</div>
    </div>
  );
};

// ─── Sub: gemas de mana ───────────────────────────────────────────────────────

const ManaGems: React.FC<{ total: number; spent: number }> = ({ total, spent }) => {
  const available = total - spent;
  // Exibe no máximo 10 gemas; para valores maiores mostra o número
  const displayCount = Math.min(total, 10);

  return (
    <div className="hs-mana-row">
      <span className="hs-mana-label">💧</span>
      <div className="hs-mana-gems">
        {Array.from({ length: displayCount }).map((_, i) => (
          <div
            key={i}
            className={`hs-mana-gem ${i < available ? 'hs-mana-gem--full' : 'hs-mana-gem--spent'}`}
          />
        ))}
      </div>
      <span className="hs-mana-val">
        {available}/{total}
      </span>
    </div>
  );
};

// ─── Sub: carta na mão ────────────────────────────────────────────────────────

interface HandCardProps {
  card        : TrophyCard;
  index       : number;
  total       : number;
  fanStyle    : Record<string, string | number>;
  selOrder    : number;
  canSelect   : boolean;
  canDeselect : boolean;
  noMana      : boolean;   // ← TRUE quando não tem mana (dimm vermelho)
  onToggle    : () => void;
  isFusingCard?: boolean;  // ← TRUE quando está sendo fundida
}

const HandCard: React.FC<HandCardProps> = ({
  card, fanStyle, selOrder, canSelect, canDeselect, noMana, onToggle, isFusingCard,
}) => {
  const isSelected  = selOrder > 0;
  const cost        = getCardCost(card.rarity);
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const pctDisplay  = card.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : '??%';
  const clickable   = (canSelect && !isSelected) || (canDeselect && isSelected);

  // Determina classe visual
  let extraClass = '';
  if (isSelected) extraClass = ' hs-hand-card--selected';
  else if (noMana) extraClass = ' hs-hand-card--nomana';
  else if (!canSelect) extraClass = ' hs-hand-card--disabled';
  if (isFusingCard) extraClass += ' hs-hand-card--fusing';

  return (
    <div
      className={`hs-hand-card${extraClass}`}
      data-rarity={card.rarity}
      style={{
        ...fanStyle,
        '--rarity-color': rarityColor,
        marginLeft      : `calc(-1 * var(--card-width, 140px) / 2)`,
        pointerEvents   : clickable ? 'auto' : 'none',
      } as React.CSSProperties}
      onClick={() => clickable && onToggle()}
      onMouseEnter={() => clickable && playHoverSound()}
      title={noMana ? `⚡ Sem mana (custo: ${cost})` : (card.description || card.name)}
    >
      <div className="hs-card-inner" data-rarity={card.rarity}>

        {/* Badge de custo */}
        <div className="hs-card-cost" style={{ background: rarityColor }}>
          {cost}
        </div>

        {/* Ordem de seleção */}
        {isSelected && (
          <div className="hs-card-sel-order">
            {selOrder === 1 ? '①' : selOrder === 2 ? '②' : '③'}
          </div>
        )}

        {/* Indicador de mana insuficiente */}
        {noMana && (
          <div className="hs-card-nomana-overlay">
            <span>⚡{cost}</span>
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

        {/* Overlay de seleção */}
        {isSelected && <div className="hs-card-selected-overlay" />}
      </div>
    </div>
  );
};

// ─── Sub: carta do bot ────────────────────────────────────────────────────────

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

// ─── Sub: carta na arena (formato completo) ───────────────────────────────────
// Mantido EXATAMENTE como o usuário personalizou (hs-card-mini)

const ArenaCard: React.FC<{
  card       : TrophyCard;
  isWinner?  : boolean;
  delay?     : number;
  isAttacking?: boolean;  // Animação de ataque (vencedor)
  isDestroyed?: boolean;  // Animação de destruição (perdedor)
}> = ({ card, isWinner, delay = 0, isAttacking, isDestroyed }) => {
  const rarityColor = RARITY_COLOR[card.rarity] ?? '#9ca3af';
  const cost        = getCardCost(card.rarity);
  const pctDisplay  = card.globalPercent != null ? `${card.globalPercent.toFixed(1)}%` : '??%';

  let extraClass = '';
  if (isWinner) extraClass += ' hs-arena-card--winner';
  if (isAttacking) extraClass += ' hs-arena-card--attacking';
  if (isDestroyed) extraClass += ' hs-arena-card--destroyed';

  return (
    <div
      className={`hs-arena-card${extraClass}`}
      data-rarity={card.rarity}
      style={{ '--rarity-color': rarityColor, animationDelay: `${delay}s` } as React.CSSProperties}
      title={card.description || card.name}
    >
      {isAttacking && <div className="hs-arena-impact" />}
      <div className="hs-card-mini" data-rarity={card.rarity}>
        <div className="hs-card-mini-cost" style={{ background: rarityColor }}>
          {cost}
        </div>
        <div className="hs-card-mini-art">
          <div className="hs-card-mini-art-bg" style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }} />
          {card.iconUrl ? (
            <img className="hs-card-mini-art-icon" src={card.iconUrl} alt={card.name} loading="lazy"
                 onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="hs-card-mini-art-emoji" style={{ borderColor: rarityColor }}>
              {card.rarityEmoji}
            </div>
          )}
          <div className="hs-card-mini-rarity" style={{ color: rarityColor, borderColor: rarityColor }}>
            {card.rarityLabel}
          </div>
          <div className="hs-card-mini-thumb">
            <img src={card.gameHeaderUrl} alt={card.gameName} loading="lazy"
                 onError={(e) => { const p = (e.target as HTMLImageElement).parentElement; if (p) p.style.display = 'none'; }} />
          </div>
        </div>
        <div className="hs-card-mini-body">
          <div className="hs-card-mini-name">{card.name}</div>
          <div className="hs-card-mini-game">{card.gameName}</div>
          {card.description && (
            <div className="hs-card-mini-desc">{card.description}</div>
          )}
        </div>
        <div className="hs-card-mini-footer">
          <span className="hs-card-mini-pct">{pctDisplay}</span>
          <div className="hs-card-mini-damage" style={{ color: rarityColor }}>
            <span>⚔</span>
            <strong>{card.damage}</strong>
          </div>
        </div>
      </div>
      {isWinner && <div className="hs-arena-winner-glow" />}
    </div>
  );
};

// ─── Sub: coluna de arena ─────────────────────────────────────────────────────

const ArenaColumn: React.FC<{
  cards       : TrophyCard[];
  total       : number;
  isWinner?   : boolean;
  label       : string;
  waiting?    : boolean;
  isAttacking?: boolean;  // Animação de ataque (vencedor)
  isDestroyed?: boolean;  // Animação de destruição (perdedor)
}> = ({ cards, total, isWinner, label, waiting, isAttacking, isDestroyed }) => (
  <div className="hs-arena-column">
    <div className="hs-arena-column-label">{label}</div>
    {cards.length === 0 ? (
      <div className="hs-arena-slot-empty">
        {waiting ? <span className="hs-bot-thinking">⏳ escolhendo…</span> : 'aguardando'}
      </div>
    ) : (
      <>
        <div className="hs-arena-cards-row">
          {cards.map((c, i) => (
            <ArenaCard 
              key={c.id} 
              card={c} 
              isWinner={isWinner} 
              delay={i * 0.08}
              isAttacking={isAttacking}
              isDestroyed={isDestroyed}
            />
          ))}
        </div>
        <div className="hs-arena-total" style={{ color: isWinner ? '#4ade80' : 'var(--txt2)' }}>
          Total: <strong>{total}</strong>
          {isWinner && ' ⚔'}
        </div>
      </>
    )}
  </div>
);

// ─── Componente principal ─────────────────────────────────────────────────────

const DuelBattle: React.FC = () => {
  const {
    phase, playerHand, botHand,
    playerHp, botHp, currentMana,
    round,
    selectedPlayerCards, selectedBotCards,
    roundWinner, gameWinner,
    damageDealt, damageTarget,
    timeLeft, isTimerRunning, isPlayerReady,
    toggleCard, fuseCards, pressReady,
    botPlay, resolveRound, nextRound, resetBattle, tickTimer,
  } = useBattleStore();

  // ── Animação de fusão ────────────────────────────────────────────────────
  const [isFusing, setIsFusing] = useState(false);
  const [fusingIds, setFusingIds] = useState<string[]>([]);

  // ── Animação de ataque/destruição no round result ────────────────────────
  const [isAttacking, setIsAttacking] = useState(false);

  // ── Audio init ───────────────────────────────────────────────────────────
  useEffect(() => { initAudio(); }, []);

  // ── Fan layouts ──────────────────────────────────────────────────────────
  const playerFan = useFanLayout(playerHand.length, 140, 18);
  const botFan    = useFanLayout(botHand.length,    56,  8);

  // ── Timer ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTimerRunning) return;
    const id = setInterval(() => {
      tickTimer();
      if (timeLeft <= 6 && timeLeft > 1) playTickSound();
    }, 1000);
    return () => clearInterval(id);
  }, [isTimerRunning, tickTimer, timeLeft]);

  // ── Bot joga após player confirmar ───────────────────────────────────────
  useEffect(() => {
    if (phase === 'battle' && isPlayerReady && selectedBotCards.length === 0) {
      playReadySound();
      const t = setTimeout(() => { botPlay(); }, 500);
      return () => clearTimeout(t);
    }
  }, [phase, isPlayerReady, selectedBotCards.length, botPlay]);

  // ── Resolve quando ambos confirmaram ────────────────────────────────────
  useEffect(() => {
    if (phase === 'battle' && isPlayerReady && selectedBotCards.length >= 0) {
      // Resolve mesmo se bot jogou 0 cartas (passou turno)
      if (!isPlayerReady) return;
      // Aguarda um frame para garantir que selectedBotCards foi atualizado
      const t = setTimeout(() => { resolveRound(); }, 900);
      return () => clearTimeout(t);
    }
  }, [phase, isPlayerReady, selectedBotCards, resolveRound]); // eslint-disable-line

  // ── Sons e animação de ataque ────────────────────────────────────────────
  useEffect(() => {
    if (phase === 'round-result' && roundWinner) {
      if (roundWinner === 'player') playWinRoundSound();
      else if (roundWinner === 'bot') playLoseRoundSound();
      // Ativa animação de ataque após um pequeno delay
      const t = setTimeout(() => setIsAttacking(true), 100);
      return () => clearTimeout(t);
    } else if (phase !== 'round-result') {
      setIsAttacking(false);
    }
  }, [phase, roundWinner]);

  useEffect(() => {
    if (phase === 'game-over' && gameWinner) {
      if (gameWinner === 'player') playGameWinSound();
      else playGameLoseSound();
    }
  }, [phase, gameWinner]);

  const handleToggle = useCallback((card: TrophyCard) => {
    playCardSelectSound();
    toggleCard(card);
  }, [toggleCard]);

  const handlePressReady = useCallback(() => {
    if (selectedPlayerCards.length > 0) playReadySound();
    else playCardPlaySound();
    pressReady();
  }, [pressReady, selectedPlayerCards.length]);

  // ── Mana: mana gasta e disponível ────────────────────────────────────────
  const spentMana = useMemo(
    () => selectedPlayerCards.reduce((s, c) => s + getCardCost(c.rarity), 0),
    [selectedPlayerCards],
  );
  const availableMana = currentMana - spentMana;

  // ── Detecção de par fusível (2 cartas selecionadas de mesma raridade) ────
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

  // ── Totais de dano ────────────────────────────────────────────────────────
  const playerTotal = useMemo(
    () => selectedPlayerCards.reduce((s, c) => s + c.damage, 0),
    [selectedPlayerCards],
  );
  const botTotal = useMemo(
    () => selectedBotCards.reduce((s, c) => s + c.damage, 0),
    [selectedBotCards],
  );

  // ── Timer visual ──────────────────────────────────────────────────────────
  const timerPct   = (timeLeft / 30) * 100;
  const timerColor = timeLeft <= 5 ? '#f87171' : timeLeft <= 10 ? '#fbbf24' : '#4ade80';

  // ── Compra do próximo turno ───────────────────────────────────────────────
  const nextDraw = 4 - selectedPlayerCards.length;

  // ─────────────────────────────────────────────────────────────────────────
  // GAME OVER
  // ─────────────────────────────────────────────────────────────────────────
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

        {/* HP final */}
        <div className="hs-gameover-hp">
          <div className="hs-gameover-hp-side">
            <div className="hs-gameover-hp-label">💙 Você</div>
            <div className="hs-gameover-hp-val" style={{ color: won ? '#4ade80' : '#f87171' }}>
              {playerHp > 0 ? playerHp.toLocaleString() : '💀 0'}
            </div>
          </div>
          <div className="hs-gameover-hp-div">❤️</div>
          <div className="hs-gameover-hp-side">
            <div className="hs-gameover-hp-label">🤖 Bot</div>
            <div className="hs-gameover-hp-val" style={{ color: !won ? '#4ade80' : '#f87171' }}>
              {botHp > 0 ? botHp.toLocaleString() : '💀 0'}
            </div>
          </div>
        </div>

        <button
          className="hs-btn-primary"
          onClick={resetBattle}
          onMouseEnter={playHoverSound}
        >
          🔄 Jogar Novamente
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ROUND RESULT
  // ─────────────────────────────────────────────────────────────────────────
  if (phase === 'round-result') {
    const playerWon = roundWinner === 'player';
    const botWon    = roundWinner === 'bot';
    const isDraw    = roundWinner === 'draw';

    return (
      <div className="hs-round-result">

        {/* Título com dano */}
        <div className="hs-round-result-title">
          {isDraw
            ? '🤝 Empate! Nenhum dano causado.'
            : playerWon
            ? `✅ Você venceu! Bot tomou ${damageDealt.toLocaleString()} de dano.`
            : `❌ Bot venceu! Você tomou ${damageDealt.toLocaleString()} de dano.`}
        </div>

        {/* Barras de HP atualizadas */}
        <div className="hs-round-result-hp">
          <HpBar hp={playerHp} label="💙 Você" damaged={damageTarget === 'player'} />
          <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.2)', padding: '0 12px', alignSelf: 'center' }}>
            ⚔
          </div>
          <HpBar hp={botHp} label="🤖 Bot" damaged={damageTarget === 'bot'} />
        </div>

        {/* Cartas jogadas lado a lado */}
        <div className="hs-result-arena">
          <ArenaColumn
            cards={selectedPlayerCards}
            total={playerTotal}
            isWinner={playerWon}
            label="Suas cartas"
            isAttacking={isAttacking && playerWon}
            isDestroyed={isAttacking && botWon}
          />
          <div className="hs-arena-vs">VS</div>
          <ArenaColumn
            cards={selectedBotCards}
            total={botTotal}
            isWinner={botWon}
            label="Bot"
            isAttacking={isAttacking && botWon}
            isDestroyed={isAttacking && playerWon}
          />
        </div>

        <button
          className="hs-btn-primary"
          onClick={nextRound}
          onMouseEnter={playHoverSound}
        >
          Próximo Round →
        </button>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // BATTLE PHASE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="hs-battle">

      {/* ── HUD: HP + Round + Mana + Timer ── */}
      <div className="hs-battle-header">

        {/* HP do jogador */}
        <HpBar hp={playerHp} label="💙 Você" />

        {/* Centro: Round + Mana */}
        <div className="hs-hud-center">
          <div className="hs-hud-round">
            <span className="hs-hud-label">Round</span>
            <span className="hs-hud-val">{round}</span>
          </div>
          <ManaGems total={currentMana} spent={spentMana} />
        </div>

        {/* HP do bot */}
        <HpBar hp={botHp} label="🤖 Bot" />

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
              <div className="hs-arena-live-label">
                Você · <strong style={{ color: '#4ade80' }}>{playerTotal}</strong> ⚔
              </div>
              <div className="hs-arena-live-cards">
                {selectedPlayerCards.map(c => <ArenaCard key={c.id} card={c} />)}
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
                  selectedBotCards.map(c => <ArenaCard key={c.id} card={c} />)
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="hs-arena-hint">
            Selecione cartas da sua mão e clique em <strong>Pronto</strong>
            <br />
            <span style={{ fontSize: 12, opacity: 0.7 }}>
              Você tem <strong style={{ color: '#60a5fa' }}>{currentMana}</strong> de mana
            </span>
          </div>
        )}
      </div>

      {/* ── Player zone ── */}
      <div className="hs-player-zone">

        {/* Barra de ação */}
        <div className="hs-ready-bar">
          <div className="hs-ready-info">
            {isPlayerReady ? (
              <span style={{ color: '#4ade80' }}>✅ Aguardando bot…</span>
            ) : (
              <>
                <span>{selectedPlayerCards.length}/3 cartas</span>
                <span className="hs-draw-preview">
                  → próx. turno: +{nextDraw} carta{nextDraw !== 1 ? 's' : ''}
                </span>
                <span className="hs-mana-spent-badge">
                  💧 {spentMana}/{currentMana}
                </span>
              </>
            )}
          </div>

          {/* Botão de fusão — aparece quando há par fusível */}
          {!isPlayerReady && fusablePair && !isFusing && (
            <button
              className="hs-btn-fuse"
              onClick={() => {
                playFuseSound();
                setIsFusing(true);
                setFusingIds([fusablePair[0].id, fusablePair[1].id]);
                // Aguarda animação antes de fundir
                setTimeout(() => {
                  fuseCards(fusablePair[0].id, fusablePair[1].id);
                  setIsFusing(false);
                  setFusingIds([]);
                }, 600);
              }}
              onMouseEnter={playHoverSound}
              title={`Fundir 2 cartas ${fusablePair[0].rarity} → ${fusablePair[0].rarity} superior`}
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
                : `Pronto (${selectedPlayerCards.length} carta${selectedPlayerCards.length > 1 ? 's' : ''})`}
            </button>
          )}
        </div>

        {/* Mão em leque */}
        <div className="hs-player-hand">
          {playerHand.map((card, i) => {
            const selIdx        = selectedPlayerCards.findIndex(c => c.id === card.id);
            const selOrder      = selIdx >= 0 ? selIdx + 1 : 0;
            const alreadySelected = selOrder > 0;
            const maxReached    = selectedPlayerCards.length >= 3;
            const cardCost      = getCardCost(card.rarity);
            const canAfford     = spentMana + cardCost <= currentMana;
            // noMana: quando não é selecionada e não cabe na mana
            const noMana        = !alreadySelected && !canAfford;
            const canSelect     = !isPlayerReady && !alreadySelected && !maxReached && canAfford;
            const canDeselect   = !isPlayerReady && alreadySelected;

            return (
              <HandCard
                key={card.id}
                card={card}
                index={i}
                total={playerHand.length}
                fanStyle={playerFan.getCardStyle(i)}
                selOrder={selOrder}
                canSelect={canSelect}
                canDeselect={canDeselect}
                noMana={noMana}
                onToggle={() => handleToggle(card)}
                isFusingCard={fusingIds.includes(card.id)}
              />
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default DuelBattle;
