import { useState, useCallback } from 'react';
import type { NoteRepository } from '../storage/noteRepository';
import { localStorageNoteRepository } from '../storage/noteStorage';
import { isContentEmpty } from '../utils/sanitize';

interface UseNotesReturn {
  content: string;
  setContent: (content: string) => void;
  hasNote: (date: string) => boolean;
  noteDates: Set<string>;
  refreshNoteDates: () => void;
}

export function useNotes(
  date: string | null,
  repository: NoteRepository = localStorageNoteRepository
): UseNotesReturn {
  const [, forceRefresh] = useState(0);

  const content = date ? repository.get(date)?.content ?? '' : '';
  const noteDates = new Set(repository.getAllDates());

  const refreshNoteDates = useCallback(() => {
    forceRefresh(prev => prev + 1);
  }, []);

  const setContent = useCallback((newContent: string) => {
    if (date) {
      // Use isContentEmpty to properly check HTML content
      if (!isContentEmpty(newContent)) {
        repository.save(date, newContent);
      } else {
        repository.delete(date);
      }
      forceRefresh(prev => prev + 1);
    }
  }, [date, repository]);

  const hasNote = (checkDate: string): boolean => {
    return noteDates.has(checkDate);
  };

  return {
    content,
    setContent,
    hasNote,
    noteDates,
    refreshNoteDates
  };
}
