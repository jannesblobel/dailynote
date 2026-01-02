import { useMemo, useCallback } from 'react';
import { getTodayString } from '../utils/date';
import {
  getNavigableDates,
  getPreviousDate,
  getNextDate,
  getNavigationBoundaries
} from '../utils/noteNavigation';

interface UseNoteNavigationProps {
  currentDate: string | null;
  noteDates: Set<string>;
  onNavigate: (date: string) => void;
}

interface UseNoteNavigationReturn {
  canNavigatePrev: boolean;
  canNavigateNext: boolean;
  navigateToPrevious: () => void;
  navigateToNext: () => void;
  navigableDates: string[];
}

export function useNoteNavigation({
  currentDate,
  noteDates,
  onNavigate
}: UseNoteNavigationProps): UseNoteNavigationReturn {
  const todayStr = getTodayString();

  // Compute navigable dates (expensive sort operation)
  const navigableDates = useMemo(
    () => getNavigableDates(noteDates, todayStr),
    [noteDates, todayStr]
  );

  // Compute boundary flags
  const { canNavigatePrev, canNavigateNext } = useMemo(() => {
    if (!currentDate) {
      return { canNavigatePrev: false, canNavigateNext: false };
    }

    const boundaries = getNavigationBoundaries(currentDate, navigableDates);

    return {
      canNavigatePrev: !boundaries.isAtStart,
      canNavigateNext: !boundaries.isAtEnd
    };
  }, [currentDate, navigableDates]);

  // Navigation handlers
  const navigateToPrevious = useCallback(() => {
    if (!currentDate || !canNavigatePrev) return;

    const prevDate = getPreviousDate(currentDate, navigableDates);
    if (prevDate) {
      onNavigate(prevDate);
    }
  }, [currentDate, canNavigatePrev, navigableDates, onNavigate]);

  const navigateToNext = useCallback(() => {
    if (!currentDate || !canNavigateNext) return;

    const nextDate = getNextDate(currentDate, navigableDates);
    if (nextDate) {
      onNavigate(nextDate);
    }
  }, [currentDate, canNavigateNext, navigableDates, onNavigate]);

  return {
    canNavigatePrev,
    canNavigateNext,
    navigateToPrevious,
    navigateToNext,
    navigableDates
  };
}
