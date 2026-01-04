import { isToday } from "./date";

export function canEditNote(dateStr: string): boolean {
  return isToday(dateStr);
}
