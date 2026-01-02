import { parseDate } from './date';

/**
 * Get sorted array of navigable dates (notes + today)
 * Always includes today even if no note exists
 */
export function getNavigableDates(
  noteDates: Set<string>,
  todayStr: string
): string[] {
  // Create array from note dates and ensure today is included
  const datesArray = Array.from(noteDates);
  if (!datesArray.includes(todayStr)) {
    datesArray.push(todayStr);
  }

  // Sort chronologically (oldest first)
  return datesArray.sort((a, b) => {
    const dateA = parseDate(a);
    const dateB = parseDate(b);

    if (!dateA || !dateB) return 0;

    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Find the previous navigable date
 * Returns null if at the start (earliest note)
 */
export function getPreviousDate(
  currentDate: string,
  navigableDates: string[]
): string | null {
  const currentIndex = navigableDates.indexOf(currentDate);

  if (currentIndex === -1 || currentIndex === 0) {
    return null;
  }

  return navigableDates[currentIndex - 1];
}

/**
 * Find the next navigable date
 * Returns null if at the end (today)
 */
export function getNextDate(
  currentDate: string,
  navigableDates: string[]
): string | null {
  const currentIndex = navigableDates.indexOf(currentDate);

  if (currentIndex === -1 || currentIndex === navigableDates.length - 1) {
    return null;
  }

  return navigableDates[currentIndex + 1];
}

/**
 * Check if date is at navigation boundary
 */
export function getNavigationBoundaries(
  currentDate: string,
  navigableDates: string[]
): { isAtStart: boolean; isAtEnd: boolean } {
  const currentIndex = navigableDates.indexOf(currentDate);

  return {
    isAtStart: currentIndex === 0,
    isAtEnd: currentIndex === navigableDates.length - 1
  };
}
