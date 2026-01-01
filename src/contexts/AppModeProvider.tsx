import { type ReactNode } from 'react';
import { AppModeContext } from './appModeContext';
import type { UseAppModeReturn } from '../hooks/useAppMode';

interface AppModeProviderProps {
  value: UseAppModeReturn;
  children: ReactNode;
}

export function AppModeProvider({ value, children }: AppModeProviderProps) {
  return (
    <AppModeContext.Provider value={value}>
      {children}
    </AppModeContext.Provider>
  );
}
