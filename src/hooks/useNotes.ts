import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteRepository } from '../storage/noteRepository';
import { isContentEmpty } from '../utils/sanitize';

const MIN_DECRYPT_MS = 0;

interface UseNotesReturn {
  content: string;
  setContent: (content: string) => void;
  hasNote: (date: string) => boolean;
  noteDates: Set<string>;
  refreshNoteDates: () => void;
  isDecrypting: boolean;
}

export function useNotes(
  date: string | null,
  repository: NoteRepository | null,
  onContentChange?: () => void
): UseNotesReturn {
  const [content, setContentState] = useState('');
  const [noteDates, setNoteDates] = useState<Set<string>>(new Set());
  const [isDecrypting, setIsDecrypting] = useState(false);
  const saveQueueRef = useRef(Promise.resolve());
  const latestContentRef = useRef('');
  const shouldDelayDecryptRef = useRef(true);

  const refreshNoteDates = useCallback(() => {
    if (!repository) {
      setNoteDates(new Set());
      return;
    }
    repository.getAllDates()
      .then(dates => setNoteDates(new Set(dates)))
      .catch(() => setNoteDates(new Set()));
  }, [repository]);

  useEffect(() => {
    refreshNoteDates();
  }, [refreshNoteDates]);

  useEffect(() => {
    if (!date || !repository) {
      setContentState('');
      setIsDecrypting(false);
      return;
    }
    let cancelled = false;
    setIsDecrypting(true);
    const start = performance.now();

    const load = async () => {
      try {
        const note = await repository.get(date);
        if (!cancelled) {
          setContentState(note?.content ?? '');
        }
      } finally {
        if (shouldDelayDecryptRef.current) {
          const elapsed = performance.now() - start;
          const remaining = MIN_DECRYPT_MS - elapsed;
          if (remaining > 0) {
            await new Promise(resolve => setTimeout(resolve, remaining));
          }
          shouldDelayDecryptRef.current = false;
        }
        if (!cancelled) {
          setIsDecrypting(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [date, repository]);

  const setContent = useCallback((newContent: string) => {
    if (!date || !repository) return;
    latestContentRef.current = newContent;
    setContentState(newContent);

    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const contentToSave = latestContentRef.current;
      if (!isContentEmpty(contentToSave)) {
        await repository.save(date, contentToSave);
      } else {
        await repository.delete(date);
      }
      refreshNoteDates();
      onContentChange?.();
    });
  }, [date, repository, refreshNoteDates, onContentChange]);

  const hasNote = (checkDate: string): boolean => {
    return noteDates.has(checkDate);
  };

  return {
    content,
    setContent,
    hasNote,
    noteDates,
    refreshNoteDates,
    isDecrypting
  };
}
