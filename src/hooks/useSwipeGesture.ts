import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

interface UseSwipeGestureProps {
  enabled: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  elementRef: RefObject<HTMLElement | null>;
  threshold?: number;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipeGesture({
  enabled,
  onSwipeLeft,
  onSwipeRight,
  elementRef,
  threshold = 50
}: UseSwipeGestureProps): void {
  const touchStateRef = useRef<TouchState | null>(null);

  useEffect(() => {
    if (!enabled || !elementRef.current) return;

    const element = elementRef.current;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];

      // Don't start swipe if touch is inside contentEditable
      const target = e.target as HTMLElement;
      if (target.matches('.note-editor__content') || target.closest('.note-editor__content')) {
        return;
      }

      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now()
      };
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchState = touchStateRef.current;
      if (!touchState) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchState.startX;
      const deltaY = touch.clientY - touchState.startY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Only trigger swipe if:
      // 1. Horizontal movement exceeds threshold
      // 2. Horizontal movement is greater than vertical (not a scroll)
      if (absDeltaX > threshold && absDeltaX > absDeltaY) {
        if (deltaX > 0) {
          // Swipe right → previous note
          onSwipeRight();
        } else {
          // Swipe left → next note
          onSwipeLeft();
        }
      }

      touchStateRef.current = null;
    };

    const handleTouchCancel = () => {
      touchStateRef.current = null;
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchCancel, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchCancel);
    };
  }, [enabled, elementRef, onSwipeLeft, onSwipeRight, threshold]);
}
