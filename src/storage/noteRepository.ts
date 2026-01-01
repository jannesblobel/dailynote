import type { Note } from '../types';

export interface NoteRepository {
  get(date: string): Note | null;
  save(date: string, content: string): void;
  delete(date: string): void;
  getAllDates(): string[];
}
