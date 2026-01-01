import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteRepository } from '../storage/noteRepository';
import { isContentEmpty } from '../utils/sanitize';

const MIN_DECRYPT_MS = 0;

interface UseNoteContentReturn {
  content: string;
  setContent: (content: string) => void;
  isDecrypting: boolean;
  hasEdits: boolean;
}

export function useNoteContent(
  date: string | null,
  repository: NoteRepository | null,
  onAfterSave?: () => void
): UseNoteContentReturn {
  const [content, setContentState] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const latestContentRef = useRef('');
  const shouldDelayDecryptRef = useRef(true);

  useEffect(() => {
    setHasEdits(false);
    if (!date || !repository) {
      setContentState('');
      setIsDecrypting(false);
      latestContentRef.current = '';
      return;
    }
    let cancelled = false;
    setIsDecrypting(true);
    const start = performance.now();

    const load = async () => {
      try {
        const note = await repository.get(date);
        if (!cancelled) {
          const nextContent = note?.content ?? '';
          setContentState(nextContent);
          latestContentRef.current = nextContent;
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

  const flushSave = useCallback(() => {
    if (!date || !repository) return;
    const contentToSave = latestContentRef.current;
    pendingSaveRef.current = (pendingSaveRef.current ?? Promise.resolve()).then(async () => {
      if (!isContentEmpty(contentToSave)) {
        await repository.save(date, contentToSave);
      } else {
        await repository.delete(date);
      }
      onAfterSave?.();
    });
  }, [date, repository, onAfterSave]);

  const setContent = useCallback((newContent: string) => {
    if (!date || !repository) return;
    if (newContent !== latestContentRef.current) {
      setHasEdits(true);
    }
    latestContentRef.current = newContent;
    setContentState(newContent);

    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      flushSave();
    }, 400);
  }, [date, repository, flushSave]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
        flushSave();
      }
    };
  }, [flushSave]);

  return {
    content,
    setContent,
    isDecrypting,
    hasEdits
  };
}
