// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/TrophyCard.tsx
//  Collectible card component with 3D tilt effect on hover.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useCallback } from 'react';
import type { TrophyCard as TrophyCardType } from '../../types/duel';

interface TrophyCardProps {
  card            : TrophyCardType;
  /** Index in the rendered grid — used to calculate stagger animation delay */
  index           : number;
}

const TrophyCard: React.FC<TrophyCardProps> = ({ card, index }) => {
  const innerRef = useRef<HTMLDivElement>(null);

  // ── 3D Tilt on mouse move ─────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el   = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const y    = e.clientY - rect.top;
    const cx   = rect.width  / 2;
    const cy   = rect.height / 2;

    const rotateX =  ((y - cy) / cy) * -12;
    const rotateY =  ((x - cx) / cx) *  12;

    if (innerRef.current) {
      innerRef.current.style.transform =
        `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-20px) scale(1.15)`;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (innerRef.current) {
      innerRef.current.style.transform =
        'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
      // Small delay then clear inline style so CSS animation can take over
      setTimeout(() => {
        if (innerRef.current) innerRef.current.style.transform = '';
      }, 150);
    }
  }, []);

  // Stagger delay capped at index 8 (matching the CSS nth-child rules)
  const animationDelay = `${Math.min(index, 8) * 0.04}s`;

  const pctDisplay = card.globalPercent !== null
    ? `${card.globalPercent.toFixed(1)}%`
    : '??%';

  return (
    <div
      className="trophy-card"
      data-rarity={card.rarity}
      style={{ animationDelay }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      title={card.description || card.name}
    >
      <div className="trophy-card-inner" ref={innerRef}>

        {/* ── Art area ── */}
        <div className="card-art-area">
          {/* Blurred background */}
          <div
            className="card-art-bg"
            style={{
              backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')`,
            }}
          />

          {/* Main icon */}
          {card.iconUrl ? (
            <img
              className="card-art-icon"
              src={card.iconUrl}
              alt={card.name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                // Fallback: hide broken icon → emoji placeholder becomes visible
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="card-art-icon-ph">{card.rarityEmoji}</div>
          )}

          {/* Rarity badge */}
          <div className="card-rarity-badge">{card.rarityLabel}</div>

          {/* Game thumbnail (bottom-left of art) */}
          <div className="card-game-thumb" title={card.gameName}>
            <img
              src={card.gameHeaderUrl}
              alt={card.gameName}
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* ── Card body ── */}
        <div className="card-body">
          <div className="card-ach-name">{card.name}</div>
          <div className="card-game-name">{card.gameName}</div>
          {card.description && (
            <div className="card-ach-desc">{card.description}</div>
          )}
        </div>

        {/* ── Footer: unlock % + damage ── */}
        <div className="card-footer">
          <span className="card-unlock-pct">{pctDisplay}</span>
          <div className="card-damage-block">
            <span className="card-damage-icon">⚔</span>
            <span className="card-damage-value">{card.damage}</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default React.memo(TrophyCard);
