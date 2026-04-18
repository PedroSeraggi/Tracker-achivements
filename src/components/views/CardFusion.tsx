// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/CardFusion.tsx
//
//  Overlay de animação de fusão entre duas cartas do tabuleiro.
//
//  Uso:
//    <CardFusion
//      cardA={slotCardA}          // objeto da carta (com .icon, .name, etc.)
//      cardB={slotCardB}          // objeto da carta B
//      resultCard={fusedCard}     // carta resultado da fusão
//      onComplete={() => ...}     // callback ao fim da animação
//    />
//
//  Dispare a fusão montando o componente. Ele se auto-desmonta
//  chamando onComplete após a animação.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface FusionCard {
  name     : string;
  icon     : string;       // emoji ou URL de imagem
  rarity   : string;       // common | rare | epic | legendary
  damage   : number;
  rarityColor?: string;
}

interface CardFusionProps {
  cardA      : FusionCard;
  cardB      : FusionCard;
  resultCard : FusionCard;
  onComplete : () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const RARITY_COLORS: Record<string, string> = {
  common   : '#9ca3af',
  rare     : '#3b82f6',
  epic     : '#a855f7',
  legendary: '#f59e0b',
};

const rarityColor = (r: string) => RARITY_COLORS[r] ?? '#9ca3af';

// Sparks: array de 16 partículas com posições/cores aleatórias pré-calculadas
const SPARKS = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * 360;
  const rad   = (angle * Math.PI) / 180;
  const dist  = 60 + Math.random() * 80;
  return {
    tx   : Math.cos(rad) * dist,
    ty   : Math.sin(rad) * dist,
    size : 4 + Math.random() * 6,
    dur  : 0.5 + Math.random() * 0.4,
    delay: Math.random() * 0.15,
    clr  : i % 3 === 0 ? '#fbbf24' : i % 3 === 1 ? '#60a5fa' : '#a855f7',
  };
});

// ── Componente mini-carta ─────────────────────────────────────────────────────

const MiniCard: React.FC<{ card: FusionCard; className?: string }> = ({ card, className = '' }) => (
  <div
    className={`bd-fusion-card ${className}`}
    style={{ '--rarity-color': rarityColor(card.rarity) } as React.CSSProperties}
  >
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(180deg, #1a2634 0%, #0d1b26 100%)',
      border: `2px solid ${rarityColor(card.rarity)}`,
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Art area */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.4)', fontSize: 40 }}>
        {card.icon}
      </div>
      {/* Name */}
      <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700,
                    color: '#fff', background: 'rgba(0,0,0,0.6)', lineHeight: 1.2 }}>
        {card.name}
      </div>
      {/* Damage */}
      <div style={{ padding: '4px 8px', fontSize: 13, fontWeight: 900,
                    color: '#f87171', background: 'rgba(0,0,0,0.8)',
                    borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        ⚔ {card.damage}%
      </div>
    </div>
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────

const CardFusion: React.FC<CardFusionProps> = ({ cardA, cardB, resultCard, onComplete }) => {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Frame seguinte para acionar transição CSS
    const t0 = requestAnimationFrame(() => setActive(true));

    // Duração total: 2.8s (animação 1.8s + badge 0.6s + botão 0.4s)
    const t1 = setTimeout(() => {
      // onComplete é chamado quando o usuário clicar em "Continuar"
      // Se quiser auto-dismiss, descomente a linha abaixo:
      // onComplete();
    }, 2800);

    return () => {
      cancelAnimationFrame(t0);
      clearTimeout(t1);
    };
  }, []);

  return (
    <div
      className="bd-fusion-stage"
      data-active={active ? 'true' : 'false'}
      onClick={(e) => {
        // Clicar fora do centro dispensa (opcional)
        if ((e.target as HTMLElement).classList.contains('bd-fusion-stage')) {
          onComplete();
        }
      }}
    >
      {/* ── Linhas de energia convergindo ─── */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bd-fusion-energy-line" style={{ animationDelay: `${0.4 + i * 0.05}s` }} />
      ))}

      {/* ── Carta A (esquerda) ─── */}
      <MiniCard card={cardA} className="bd-fusion-card--left" />

      {/* ── Carta B (direita) ─── */}
      <MiniCard card={cardB} className="bd-fusion-card--right" />

      {/* ── Ondas de choque ─── */}
      <div className="bd-fusion-shockwave" />
      <div className="bd-fusion-shockwave" />

      {/* ── Flash central ─── */}
      <div className="bd-fusion-flash" />

      {/* ── Partículas ─── */}
      <div className="bd-fusion-particles">
        {SPARKS.map((s, i) => (
          <div
            key={i}
            className="bd-fusion-spark"
            style={{
              '--tx'   : `${s.tx}px`,
              '--ty'   : `${s.ty}px`,
              '--w'    : `${s.size}px`,
              '--clr'  : s.clr,
              '--dur'  : `${s.dur}s`,
              '--delay': `${s.delay + 0.7}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* ── Carta resultado ─── */}
      <div
        className="bd-fusion-result"
        style={{ '--rarity-color': rarityColor(resultCard.rarity) } as React.CSSProperties}
      >
        {/* Badge FUSÃO! */}
        <div className="bd-fusion-badge">✨ Fusão!</div>

        {/* Carta em si */}
        <div style={{
          width: '100%', height: '100%',
          background: `linear-gradient(180deg, #1a2634 0%, #0d1b26 100%)`,
          border: `2px solid ${rarityColor(resultCard.rarity)}`,
          borderRadius: 12,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Brilho extra no resultado */}
          <div style={{
            position: 'absolute', inset: 0,
            background: `radial-gradient(ellipse at 50% 30%, ${rarityColor(resultCard.rarity)}22 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          {/* Art area com brilho dourado */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)', fontSize: 44,
            position: 'relative',
          }}>
            {resultCard.icon}
            {/* Anel de energia ao redor do ícone */}
            <div style={{
              position: 'absolute', inset: '20%',
              borderRadius: '50%',
              border: `2px solid ${rarityColor(resultCard.rarity)}55`,
              animation: 'bd-fusion-result-aura 0.6s ease-in-out infinite alternate',
              animationDelay: '1.5s',
            }} />
          </div>

          <div style={{ padding: '6px 8px', fontSize: 11, fontWeight: 700,
                        color: '#fff', background: 'rgba(0,0,0,0.6)', lineHeight: 1.2 }}>
            {resultCard.name}
          </div>

          <div style={{
            padding: '4px 8px', fontSize: 14, fontWeight: 900,
            color: '#fbbf24',
            background: 'rgba(0,0,0,0.8)',
            borderTop: `1px solid ${rarityColor(resultCard.rarity)}44`,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            ⚔ {resultCard.damage}%
            <span style={{ fontSize: 9, color: '#4ade80', fontWeight: 700 }}>
              +{resultCard.damage - Math.max(cardA.damage, cardB.damage)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Botão continuar ─── */}
      <button className="bd-fusion-continue-btn" onClick={onComplete}>
        Continuar →
      </button>
    </div>
  );
};

export default CardFusion;

// ─────────────────────────────────────────────────────────────────────────────
//  Como disparar a fusão em DuelBattle.tsx:
//
//  1. Estado:
//     const [fusionData, setFusionData] = useState<{
//       cardA: FusionCard; cardB: FusionCard; result: FusionCard
//     } | null>(null);
//
//  2. Lógica de fusão (ex: quando dois slots têm cartas do mesmo jogo):
//     if (canFuse(slotA, slotB)) {
//       setFusionData({
//         cardA:  toFusionCard(slotA),
//         cardB:  toFusionCard(slotB),
//         result: buildFusedCard(slotA, slotB),
//       });
//     }
//
//  3. JSX:
//     {fusionData && (
//       <CardFusion
//         cardA={fusionData.cardA}
//         cardB={fusionData.cardB}
//         resultCard={fusionData.result}
//         onComplete={() => {
//           applyFusedCard(fusionData.result);  // aplica ao tabuleiro
//           setFusionData(null);
//         }}
//       />
//     )}
// ─────────────────────────────────────────────────────────────────────────────
