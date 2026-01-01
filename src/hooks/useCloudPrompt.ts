import { useCallback, useRef, useState } from 'react';

export type CloudPromptState = 'idle' | 'pending' | 'open' | 'dismissed';

interface UseCloudPromptReturn {
  state: CloudPromptState;
  isOpen: boolean;
  isPending: boolean;
  request: () => void;
  open: () => void;
  close: () => void;
}

function getInitialState(storageKey: string): { state: CloudPromptState; hasShown: boolean } {
  if (typeof window === 'undefined') {
    return { state: 'idle', hasShown: false };
  }
  const hasShown = localStorage.getItem(storageKey) === '1';
  return { state: hasShown ? 'dismissed' : 'idle', hasShown };
}

export function useCloudPrompt(storageKey: string): UseCloudPromptReturn {
  const { state: initialState, hasShown } = getInitialState(storageKey);
  const [state, setState] = useState<CloudPromptState>(initialState);
  const hasShownRef = useRef(hasShown);

  const request = useCallback(() => {
    if (hasShownRef.current) return;
    setState((prev) => (prev === 'idle' ? 'pending' : prev));
  }, []);

  const open = useCallback(() => {
    if (hasShownRef.current) return;
    hasShownRef.current = true;
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, '1');
    }
    setState('open');
  }, [storageKey]);

  const close = useCallback(() => {
    setState((prev) => {
      if (prev === 'open' || prev === 'pending') {
        return hasShownRef.current ? 'dismissed' : 'idle';
      }
      return prev;
    });
  }, []);

  return {
    state,
    isOpen: state === 'open',
    isPending: state === 'pending',
    request,
    open,
    close
  };
}
