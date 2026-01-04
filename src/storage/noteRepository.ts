import type { Note } from "../types";

export interface NoteRepository {
  get(date: string): Promise<Note | null>;
  save(date: string, content: string): Promise<void>;
  delete(date: string): Promise<void>;
  getAllDates(): Promise<string[]>;
}
