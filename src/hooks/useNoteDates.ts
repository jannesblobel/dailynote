import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteRepository } from '../storage/noteRepository';

interface UseNoteDatesReturn {
  hasNote: (date: string) => boolean;
  noteDates: Set<string>;
  refreshNoteDates: (options?: { immediate?: boolean }) => void;
}

interface YearDateRepository {
  getAllDatesForYear: (year: number) => Promise<string[]>;
}

function supportsYearDates(repository: NoteRepository | null): repository is NoteRepository & YearDateRepository {
  return !!repository && 'getAllDatesForYear' in repository;
}

export function useNoteDates(
  repository: NoteRepository | null,
  year: number
): UseNoteDatesReturn {
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set());
  const refreshInFlightRef = useRef<Promise<void> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshPendingRef = useRef(false);
  const runRefreshRef = useRef<() => void>(() => {});

  const runRefresh = useCallback(() => {
    if (refreshInFlightRef.current) {
      refreshPendingRef.current = true;
      return;
    }
    const refreshPromise = Promise.resolve()
      .then(() => {
        if (!repository) {
          return [];
        }
        return supportsYearDates(repository)
          ? repository.getAllDatesForYear(year)
          : repository.getAllDates();
      })
      .then(dates => setNoteDates(new Set(dates)))
      .catch(() => setNoteDates(new Set()))
      .finally(() => {
        refreshInFlightRef.current = null;
        if (refreshPendingRef.current) {
          refreshPendingRef.current = false;
          runRefreshRef.current();
        }
      });
    refreshInFlightRef.current = refreshPromise;
  }, [repository, year]);

  const refreshNoteDates = useCallback((options?: { immediate?: boolean }) => {
    if (options?.immediate) {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      runRefresh();
      return;
    }

    if (refreshTimeoutRef.current) {
      return;
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      runRefresh();
    }, 400);
  }, [runRefresh]);

  useEffect(() => {
    runRefreshRef.current = runRefresh;
  }, [runRefresh]);

  useEffect(() => {
    refreshNoteDates({ immediate: true });
  }, [refreshNoteDates]);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    refreshPendingRef.current = false;
  }, [repository, year]);

  const hasNote = (checkDate: string): boolean => {
    return noteDates.has(checkDate);
  };

  return {
    hasNote,
    noteDates,
    refreshNoteDates
  };
}
