// ─────────────────────────────────────────────────────────────────────────────
//  src/hooks/useDragCard.ts
//
//  Manages all drag-and-drop state for card playing.
//  Completely decoupled from battle logic — only knows about drag geometry.
//
//  Usage:
//    const drag = useDragCard();
//    <div onMouseDown={drag.startDrag(card)} ... />
//    <DropZone isOver={drag.isOverDropZone} onDrop={drag.endDrag} />
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback, useEffect } from 'react';
import type { TrophyCard } from '../types/duel';

export interface DragState {
  /** Card currently being dragged (null = no drag in progress) */
  card     : TrophyCard | null;
  /** Current cursor position */
  x        : number;
  y        : number;
  /** Original element position — used for snap-back animation */
  originX  : number;
  originY  : number;
  /** True when the card is hovering over the drop zone */
  isOverDropZone: boolean;
  /** True during the snap-back animation (invalid drop) */
  isSnapBack: boolean;
}

interface UseDragCardReturn {
  drag         : DragState;
  /** Call onMouseDown of the card element */
  startDrag    : (card: TrophyCard, e: React.MouseEvent<HTMLElement>) => void;
  /** Register the drop zone element ref */
  dropZoneRef  : React.RefObject<HTMLDivElement>;
  /** Call this to programmatically cancel a drag */
  cancelDrag   : () => void;
}

const SNAP_DURATION_MS = 280;

export function useDragCard(
  onDrop  : (card: TrophyCard) => void,
  canDrop : (card: TrophyCard) => boolean,
): UseDragCardReturn {
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const [drag, setDrag] = useState<DragState>({
    card: null, x: 0, y: 0, originX: 0, originY: 0,
    isOverDropZone: false, isSnapBack: false,
  });

  // Track whether we're currently dragging (avoids stale closures)
  const dragging = useRef(false);
  const activeCard = useRef<TrophyCard | null>(null);
  const originRef = useRef({ x: 0, y: 0 });

  // ── Start drag on mouse down ─────────────────────────────────────────────
  const startDrag = useCallback(
    (card: TrophyCard, e: React.MouseEvent<HTMLElement>) => {
      if (!canDrop(card)) return;
      e.preventDefault();

      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const ox = rect.left + rect.width  / 2;
      const oy = rect.top  + rect.height / 2;

      dragging.current   = true;
      activeCard.current = card;
      originRef.current  = { x: ox, y: oy };

      setDrag({
        card,
        x: e.clientX, y: e.clientY,
        originX: ox,  originY: oy,
        isOverDropZone: false,
        isSnapBack: false,
      });
    },
    [canDrop],
  );

  // ── Mouse move ───────────────────────────────────────────────────────────
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!dragging.current || !activeCard.current) return;

      // Check if over drop zone
      let isOver = false;
      if (dropZoneRef.current) {
        const r = dropZoneRef.current.getBoundingClientRect();
        isOver = (
          e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom
        );
      }

      setDrag(prev => ({
        ...prev,
        x: e.clientX, y: e.clientY,
        isOverDropZone: isOver,
      }));
    }

    function onMouseUp(e: MouseEvent) {
      if (!dragging.current || !activeCard.current) return;

      const card = activeCard.current;
      let dropped = false;

      if (dropZoneRef.current) {
        const r = dropZoneRef.current.getBoundingClientRect();
        const isOver = (
          e.clientX >= r.left && e.clientX <= r.right &&
          e.clientY >= r.top  && e.clientY <= r.bottom
        );
        if (isOver && canDrop(card)) {
          // Valid drop
          dragging.current   = false;
          activeCard.current = null;
          setDrag({ card: null, x: 0, y: 0, originX: 0, originY: 0, isOverDropZone: false, isSnapBack: false });
          onDrop(card);
          dropped = true;
        }
      }

      if (!dropped) {
        // Invalid drop — snap back animation
        setDrag(prev => ({ ...prev, isSnapBack: true }));
        setTimeout(() => {
          dragging.current   = false;
          activeCard.current = null;
          setDrag({ card: null, x: 0, y: 0, originX: 0, originY: 0, isOverDropZone: false, isSnapBack: false });
        }, SNAP_DURATION_MS);
      }
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
    };
  }, [onDrop, canDrop]);

  const cancelDrag = useCallback(() => {
    dragging.current   = false;
    activeCard.current = null;
    setDrag({ card: null, x: 0, y: 0, originX: 0, originY: 0, isOverDropZone: false, isSnapBack: false });
  }, []);

  return { drag, startDrag, dropZoneRef, cancelDrag };
}
