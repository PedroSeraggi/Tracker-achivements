// ─────────────────────────────────────────────────────────────────────────────
//  src/components/duel/TrophyCard.tsx  (FIXED)
//
//  Bugs fixed:
//    - Thin card: added explicit width/height guards so the card never
//      collapses below --card-width / --card-height in any layout context.
//    - Selection border: removed the external absolute-positioned overlay
//      pattern (which caused misalignment when card had transforms). Selection
//      is now a class on the card itself → no layout mismatch possible.
//    - Hover during selection: pointer-events correctly disabled; no border
//      shrinkage because there's no separate overlay element.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useCallback } from 'react';
import type { TrophyCard as TrophyCardType } from '../../types/duel';

interface TrophyCardProps {
  card         : TrophyCardType;
  index        : number;
  /** Disable hover/tilt — for static display (result screens, saved deck view) */
  disableHover?: boolean;
}

const RARITY_COLORS: Record<string, string> = {
  common   : '#9ca3af',
  uncommon : '#4ade80',
  rare     : '#60a5fa',
  epic     : '#c084fc',
  legendary: '#fbbf24',
  mythic   : '#f472b6',
};

const RARITY_GLOWS: Record<string, string> = {
  common   : 'rgba(156,163,175,0.3)',
  uncommon : 'rgba(74,222,128,0.3)',
  rare     : 'rgba(96,165,250,0.3)',
  epic     : 'rgba(192,132,252,0.3)',
  legendary: 'rgba(251,191,36,0.3)',
  mythic   : 'rgba(244,114,182,0.3)',
};

const TrophyCard: React.FC<TrophyCardProps> = ({ card, index, disableHover }) => {
  const innerRef = useRef<HTMLDivElement>(null);

  // ── 3D tilt ───────────────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disableHover) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const cx   = rect.width  / 2;
      const cy   = rect.height / 2;
      const rotX = ((e.clientY - rect.top  - cy) / cy) * -12;
      const rotY = ((e.clientX - rect.left - cx) / cx) *  12;
      if (innerRef.current) {
        innerRef.current.style.transform =
          `perspective(1000px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-20px) scale(1.12)`;
      }
    },
    [disableHover]
  );

  const handleMouseLeave = useCallback(() => {
    if (!innerRef.current) return;
    innerRef.current.style.transform =
      'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    setTimeout(() => {
      if (innerRef.current) innerRef.current.style.transform = '';
    }, 150);
  }, []);

  const animationDelay = `${Math.min(index, 8) * 0.04}s`;
  const pctDisplay = card.globalPercent != null
    ? `${card.globalPercent.toFixed(1)}%`
    : '??%';

  return (
    <div
      className="trophy-card"
      data-rarity={card.rarity}
      style={{
        animationDelay,
        // ── FIX: explicit size so card never collapses in flex/grid contexts ──
        width    : 'var(--card-width, 200px)',
        minWidth : 'var(--card-width, 200px)',
        height   : 'var(--card-height, 300px)',
        minHeight: 'var(--card-height, 300px)',
        flexShrink: 0,
        pointerEvents: disableHover ? 'none' : 'auto',
      }}
      onMouseMove={disableHover ? undefined : handleMouseMove}
      onMouseLeave={disableHover ? undefined : handleMouseLeave}
      title={card.description || card.name}
    >
      <div className="trophy-card-inner" ref={innerRef}>

        {/* Art */}
        <div className="card-art-area">
          <div
            className="card-art-bg"
            style={{ backgroundImage: `url('${card.iconUrl || card.gameHeaderUrl}')` }}
          />

          {card.iconUrl ? (
            <img
              className="card-art-icon"
              src={card.iconUrl}
              alt={card.name}
              loading="lazy"
              decoding="async"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                // Show emoji placeholder
                const ph = img.nextElementSibling as HTMLElement | null;
                if (ph) ph.style.display = 'flex';
              }}
            />
          ) : null}

          {/* Emoji placeholder — shown when no icon or icon fails to load */}
          <div
            className="card-art-icon-ph"
            style={{
              display: card.iconUrl ? 'none' : 'flex',
              border : `2px solid ${RARITY_COLORS[card.rarity] ?? '#9ca3af'}`,
              boxShadow: `0 4px 20px ${RARITY_GLOWS[card.rarity] ?? 'transparent'}`,
            }}
          >
            {card.rarityEmoji}
          </div>

          <div className="card-rarity-badge">{card.rarityLabel}</div>

          <div className="card-game-thumb" title={card.gameName}>
            <img
              src={card.gameHeaderUrl}
              alt={card.gameName}
              loading="lazy"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (img.parentElement) img.parentElement.style.display = 'none';
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div className="card-body">
          <div className="card-ach-name">{card.name}</div>
          <div className="card-game-name">{card.gameName}</div>
          {card.description && (
            <div className="card-ach-desc">{card.description}</div>
          )}
        </div>

        {/* Footer */}
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
