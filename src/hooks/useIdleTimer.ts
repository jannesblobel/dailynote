import { useEffect, useRef } from 'react';

interface UseIdleTimerOptions {
  onIdle: () => void;
  delay: number; // milliseconds
  enabled?: boolean;
}

export function useIdleTimer({ onIdle, delay, enabled = true }: UseIdleTimerOptions) {
  const timeoutRef = useRef<number | null>(null);
  const onIdleRef = useRef(onIdle);

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  const reset = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    if (enabled) {
      timeoutRef.current = window.setTimeout(() => {
        onIdleRef.current();
      }, delay);
    }
  };

  const cancel = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      cancel();
    };
  }, []);

  return { reset, cancel };
}
