// ─────────────────────────────────────────────────────────────────────────────
//  src/hooks/useFanLayout.ts
//  Calculates the horizontal offset for each card in a fan/arc hand layout.
//
//  Usage:
//    const { getCardStyle } = useFanLayout(hand.length);
//    <div style={getCardStyle(index)}>...</div>
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react';

interface CardFanStyle {
  /** Horizontal offset from center in px */
  left      : string;
  /** CSS rotate (degrees) */
  '--rotate' : string;
  /** CSS Y drop (px) for arc droop */
  '--drop'   : string;
  zIndex     : number;
  /** Allow additional CSS properties for Record compatibility */
  [key: string]: string | number;
}

/**
 * Computes fan layout styles for a hand of `total` cards.
 *
 * Card i is positioned so the full hand is centered, with cards spreading
 * outward from the middle. The middle card is vertical; edge cards tilt and
 * droop like a held hand of playing cards.
 *
 * @param total    Number of cards in hand
 * @param cardW    Card width in px (default: 140)
 * @param overlap  How much adjacent cards overlap in px (default: 20)
 */
export function useFanLayout(total: number, cardW = 140, overlap = 20) {
  return useMemo(() => {
    const spread      = Math.min(7, 12 / Math.max(total, 1)); // degrees per step
    const step        = cardW - overlap;
    const totalWidth  = step * (total - 1);

    function getCardStyle(index: number): CardFanStyle {
      const mid    = (total - 1) / 2;
      const offset = index - mid;
      const rotate = offset * spread;
      const dropY  = Math.abs(offset) * 10;
      // Center the hand: leftmost card starts at -(totalWidth/2)
      const xPx    = offset * step;

      return {
        left       : `calc(50% + ${xPx}px)`,
        '--rotate' : `${rotate}deg`,
        '--drop'   : `${dropY}px`,
        zIndex     : 10 + index,
      };
    }

    return { getCardStyle };
  }, [total, cardW, overlap]);
}
