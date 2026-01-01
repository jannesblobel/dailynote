import { type ReactNode } from 'react';
import { UrlStateContext } from './urlStateContext';
import type { UrlState } from '../hooks/useUrlState';

interface UrlStateProviderProps {
  value: UrlState;
  children: ReactNode;
}

export function UrlStateProvider({ value, children }: UrlStateProviderProps) {
  return (
    <UrlStateContext.Provider value={value}>
      {children}
    </UrlStateContext.Provider>
  );
}
