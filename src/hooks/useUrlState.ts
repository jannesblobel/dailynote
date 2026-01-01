import { useState, useEffect, useCallback } from 'react';
import { isFuture, parseDate } from '../utils/date';
import { resolveUrlState, serializeUrlState } from '../utils/urlState';

export function useUrlState() {
  const [state, setState] = useState(() => resolveUrlState(window.location.search).state);

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setState(resolveUrlState(window.location.search).state);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle initial redirect if needed
  useEffect(() => {
    const resolved = resolveUrlState(window.location.search);
    if (resolved.needsRedirect) {
      window.history.replaceState({}, '', resolved.canonicalSearch);
    }
  }, []);

  const navigateToDate = useCallback((date: string) => {
    if (!isFuture(date)) {
      const parsed = parseDate(date);
      const year = parsed?.getFullYear() ?? new Date().getFullYear();
      const nextState = { view: 'note', date, year };
      window.history.pushState({}, '', serializeUrlState(nextState));
      setState(nextState);
    }
  }, []);

  const navigateToCalendar = useCallback((year?: number) => {
    const targetYear = year ?? state.year ?? new Date().getFullYear();
    const nextState = { view: 'calendar', date: null, year: targetYear };
    window.history.pushState({}, '', serializeUrlState(nextState));
    setState(nextState);
  }, [state.year]);

  const navigateToYear = useCallback((year: number) => {
    const nextState = { view: 'calendar', date: null, year };
    window.history.pushState({}, '', serializeUrlState(nextState));
    setState(nextState);
  }, []);

  return {
    ...state,
    navigateToDate,
    navigateToCalendar,
    navigateToYear
  };
}
