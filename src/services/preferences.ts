import { WEEK_START_KEY } from "../utils/constants";

export function getWeekStartPreference(): number | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(WEEK_START_KEY);
  if (!stored) return null;
  const value = Number(stored);
  if (Number.isInteger(value) && value >= 0 && value <= 6) {
    return value;
  }
  return null;
}

export function setWeekStartPreference(dayIndex: number): void {
  if (typeof window === "undefined") return;
  const normalized = ((dayIndex % 7) + 7) % 7;
  localStorage.setItem(WEEK_START_KEY, String(normalized));
}
