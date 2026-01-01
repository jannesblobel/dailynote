import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';

interface UseModalTransitionOptions {
  isOpen: boolean;
  onCloseComplete?: () => void;
  openDelayMs?: number;
  resetDelayMs?: number;
  closeDelayMs?: number;
}

interface UseModalTransitionReturn {
  showContent: boolean;
  isClosing: boolean;
  requestClose: () => void;
}

function clearTimer(ref: MutableRefObject<number | null>) {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

export function useModalTransition({
  isOpen,
  onCloseComplete,
  openDelayMs = 100,
  resetDelayMs = 0,
  closeDelayMs = 200
}: UseModalTransitionOptions): UseModalTransitionReturn {
  const [showContent, setShowContent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const requestClose = useCallback(() => {
    clearTimer(openTimerRef);
    clearTimer(resetTimerRef);
    clearTimer(closeTimerRef);
    setShowContent(false);
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      onCloseComplete?.();
    }, closeDelayMs);
  }, [closeDelayMs, onCloseComplete]);

  useEffect(() => {
    clearTimer(openTimerRef);
    clearTimer(resetTimerRef);
    resetTimerRef.current = window.setTimeout(() => {
      setShowContent(false);
    }, resetDelayMs);
    if (isOpen) {
      openTimerRef.current = window.setTimeout(() => {
        setShowContent(true);
      }, openDelayMs);
    }
    return () => {
      clearTimer(openTimerRef);
      clearTimer(resetTimerRef);
    };
  }, [isOpen, openDelayMs, resetDelayMs]);

  useEffect(() => {
    return () => {
      clearTimer(closeTimerRef);
    };
  }, []);

  return {
    showContent,
    isClosing,
    requestClose
  };
}
