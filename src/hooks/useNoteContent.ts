import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteRepository } from '../storage/noteRepository';
import { isContentEmpty } from '../utils/sanitize';

const MIN_DECRYPT_MS = 0;

interface UseNoteContentReturn {
  content: string;
  setContent: (content: string) => void;
  isDecrypting: boolean;
  hasEdits: boolean;
  isContentReady: boolean;
}

export function useNoteContent(
  date: string | null,
  repository: NoteRepository | null,
  onAfterSave?: () => void
): UseNoteContentReturn {
  const [content, setContentState] = useState('');
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [hasEdits, setHasEdits] = useState(false);
  const [isContentReady, setIsContentReady] = useState(false);
  const saveTimeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<Promise<void> | null>(null);
  const latestContentRef = useRef('');
  const shouldDelayDecryptRef = useRef(true);
  const hasEditsRef = useRef(false);
  const isContentReadyRef = useRef(false);
  const contentCacheRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    setHasEdits(false);
    hasEditsRef.current = false;
    if (!date || !repository) {
      setContentState('');
      setIsDecrypting(false);
      latestContentRef.current = '';
      setIsContentReady(false);
      isContentReadyRef.current = false;
      return;
    }
    let cancelled = false;
    setIsDecrypting(true);
    setIsContentReady(false);
    isContentReadyRef.current = false;
    const start = performance.now();

    const load = async () => {
      let loaded = false;
      try {
        const note = await repository.get(date);
        let nextContent = note?.content ?? '';
        if (!note) {
          await new Promise(resolve => setTimeout(resolve, 250));
          if (!cancelled) {
            const retryNote = await repository.get(date);
            nextContent = retryNote?.content ?? '';
          }
        }
        if (!cancelled) {
          setContentState(nextContent);
          latestContentRef.current = nextContent;
          contentCacheRef.current.set(date, nextContent);
        }
        loaded = true;
      } catch (error) {
        if (!cancelled) {
          const cached = contentCacheRef.current.get(date);
          if (typeof cached === 'string') {
            setContentState(cached);
            latestContentRef.current = cached;
            loaded = true;
          } else {
            console.warn('Failed to load note content:', error);
          }
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
          setIsContentReady(loaded);
          isContentReadyRef.current = loaded;
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
    if (!isContentReadyRef.current || !hasEditsRef.current) return;
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
    if (!date || !repository || !isContentReady) return;
    if (newContent !== latestContentRef.current) {
      setHasEdits(true);
      hasEditsRef.current = true;
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
  }, [date, repository, flushSave, isContentReady]);

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
    hasEdits,
    isContentReady
  };
}
