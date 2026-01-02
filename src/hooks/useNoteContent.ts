import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note } from '../types';
import type { NoteRepository } from '../storage/noteRepository';
import { isContentEmpty } from '../utils/sanitize';

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
  const contentRef = useRef('');
  const hasEditsRef = useRef(false);
  const dateRef = useRef<string | null>(null);
  const repoRef = useRef<NoteRepository | null>(null);

  // Save function that uses refs (can be called from cleanup)
  const flushSave = useCallback(() => {
    const currentContent = contentRef.current;
    const currentDate = dateRef.current;
    const currentRepo = repoRef.current;

    if (!currentDate || !currentRepo) return;

    // Queue the save
    pendingSaveRef.current = (pendingSaveRef.current ?? Promise.resolve()).then(async () => {
      try {
        if (!isContentEmpty(currentContent)) {
          await currentRepo.save(currentDate, currentContent);
        } else {
          await currentRepo.delete(currentDate);
        }
        onAfterSave?.();
      } catch (error) {
        console.error('Failed to save note:', error);
      }
    });
  }, [onAfterSave]);

  // Load content when date/repository changes
  useEffect(() => {
    // Save before switching dates
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
      flushSave();
    }

    dateRef.current = date;
    repoRef.current = repository;
    queueMicrotask(() => {
      hasEditsRef.current = false;
      setHasEdits(false);
    });

    if (!date || !repository) {
      contentRef.current = '';
      queueMicrotask(() => {
        setContentState('');
        setIsDecrypting(false);
        setIsContentReady(false);
      });
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      setIsDecrypting(true);
      setIsContentReady(false);
    });

    const load = async () => {
      try {
        if ('getWithRefresh' in repository && typeof repository.getWithRefresh === 'function') {
          const note = await repository.getWithRefresh(date, (remoteNote: Note | null) => {
            if (cancelled || dateRef.current !== date) return;
            if (hasEditsRef.current) return;
            const updatedContent = remoteNote?.content ?? '';
            setContentState(updatedContent);
            contentRef.current = updatedContent;
            setIsDecrypting(false);
            setIsContentReady(true);
            hasEditsRef.current = false;
            setHasEdits(false);
          });
          const loadedContent = note?.content ?? '';
          if (!cancelled) {
            setContentState(loadedContent);
            contentRef.current = loadedContent;
            setIsDecrypting(false);
            setIsContentReady(true);
          }
          return;
        }

        const note = await repository.get(date);
        const loadedContent = note?.content ?? '';

        if (!cancelled) {
          setContentState(loadedContent);
          contentRef.current = loadedContent;
          setIsDecrypting(false);
          setIsContentReady(true);
        }
      } catch (error) {
        console.error('Failed to load note:', error);
        if (!cancelled) {
          setContentState('');
          contentRef.current = '';
          setIsDecrypting(false);
          setIsContentReady(true);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [date, repository, flushSave]);

  // Update content
  const setContent = useCallback((newContent: string) => {
    if (!isContentReady) return;

    setContentState(newContent);
    contentRef.current = newContent;
    hasEditsRef.current = true;
    setHasEdits(true);

    // Clear existing timeout
    if (saveTimeoutRef.current !== null) {
      window.clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save
    saveTimeoutRef.current = window.setTimeout(() => {
      saveTimeoutRef.current = null;
      flushSave();
      hasEditsRef.current = false;
      setHasEdits(false);
    }, 400);
  }, [isContentReady, flushSave]);

  // Save on unmount
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
