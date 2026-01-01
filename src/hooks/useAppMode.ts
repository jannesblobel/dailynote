import { useCallback, useRef, useState } from 'react';
import { AuthState } from './useAuth';
import { STORAGE_PREFIX } from '../utils/constants';

export enum AppMode {
  Local = 'local',
  Cloud = 'cloud'
}

const CLOUD_PROMPT_KEY = `${STORAGE_PREFIX}cloud_prompted_v1`;

interface UseAppModeProps {
  authState: AuthState;
}

export interface UseAppModeReturn {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  isModeChoiceOpen: boolean;
  pendingModeChoice: boolean;
  requestModeChoice: () => void;
  openModeChoice: () => void;
  closeModeChoice: () => void;
  switchToCloud: () => void;
}

export function useAppMode({ authState }: UseAppModeProps): UseAppModeReturn {
  const [modePreference, setModePreference] = useState<AppMode | null>(null);
  const [isModeChoiceOpenState, setIsModeChoiceOpenState] = useState(false);
  const [pendingModeChoice, setPendingModeChoice] = useState(false);
  const hasShownModeChoiceRef = useRef(
    typeof window !== 'undefined' && localStorage.getItem(CLOUD_PROMPT_KEY) === '1'
  );
  const mode: AppMode = authState === AuthState.SignedIn ? AppMode.Cloud : (modePreference ?? AppMode.Local);

  const setMode = useCallback((nextMode: AppMode) => {
    setModePreference(nextMode);
    if (nextMode === AppMode.Cloud) {
      setIsModeChoiceOpenState(false);
    }
  }, []);

  const requestModeChoice = useCallback(() => {
    if (hasShownModeChoiceRef.current) return;
    setPendingModeChoice(true);
  }, []);

  const openModeChoice = useCallback(() => {
    setIsModeChoiceOpenState(true);
    setPendingModeChoice(false);
    hasShownModeChoiceRef.current = true;
    localStorage.setItem(CLOUD_PROMPT_KEY, '1');
  }, []);

  const closeModeChoice = useCallback(() => {
    setIsModeChoiceOpenState(false);
  }, []);

  const switchToCloud = useCallback(() => {
    setMode(AppMode.Cloud);
  }, [setMode]);

  const isModeChoiceOpen = mode === AppMode.Cloud ? false : isModeChoiceOpenState;

  return {
    mode,
    setMode,
    isModeChoiceOpen,
    pendingModeChoice,
    requestModeChoice,
    openModeChoice,
    closeModeChoice,
    switchToCloud
  };
}
