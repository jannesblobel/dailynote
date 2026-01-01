import { useCallback, useEffect, useRef, useState } from 'react';

export function useSavingIndicator(isEditable: boolean) {
  const [showSaving, setShowSaving] = useState(false);
  const idleTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const scheduleSavingIndicator = useCallback(() => {
    if (!isEditable) {
      return;
    }

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    setShowSaving(false);
    idleTimerRef.current = window.setTimeout(() => {
      setShowSaving(true);
      hideTimerRef.current = window.setTimeout(() => {
        setShowSaving(false);
      }, 1200);
    }, 2000);
  }, [isEditable]);

  useEffect(() => {
    if (!isEditable) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    }

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [isEditable]);

  const effectiveShowSaving = isEditable ? showSaving : false;

  return { showSaving: effectiveShowSaving, scheduleSavingIndicator };
}
