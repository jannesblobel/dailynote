import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNoteContent } from './useNoteContent';
import { useNoteDates } from './useNoteDates';
import { useSync } from './useSync';
import { supabase } from '../lib/supabase';
import { createSyncedNoteRepository } from '../storage/syncedNoteRepository';
import { createEncryptedNoteRepository } from '../storage/noteStorage';
import type { SyncedNoteRepository } from '../storage/syncedNoteRepository';
import type { NoteRepository } from '../storage/noteRepository';
import { AppMode } from './useAppMode';
import { SyncStatus } from '../types';

interface UseNoteRepositoryProps {
  mode: AppMode;
  authUser: User | null;
  vaultKey: CryptoKey | null;
  date: string | null;
  year: number;
}

export interface UseNoteRepositoryReturn {
  repository: NoteRepository | SyncedNoteRepository | null;
  syncedRepo: SyncedNoteRepository | null;
  syncStatus: ReturnType<typeof useSync>['syncStatus'];
  triggerSync: ReturnType<typeof useSync>['triggerSync'];
  content: string;
  setContent: (content: string) => void;
  hasNote: (date: string) => boolean;
  noteDates: Set<string>;
  refreshNoteDates: (options?: { immediate?: boolean }) => void;
  isDecrypting: boolean;
}

export function useNoteRepository({
  mode,
  authUser,
  vaultKey,
  date,
  year
}: UseNoteRepositoryProps): UseNoteRepositoryReturn {
  const repository = useMemo<NoteRepository | SyncedNoteRepository | null>(() => {
    if (!vaultKey) return null;

    if (mode === AppMode.Cloud && authUser) {
      return createSyncedNoteRepository(supabase, authUser.id, vaultKey);
    }

    return createEncryptedNoteRepository(vaultKey);
  }, [mode, authUser, vaultKey]);

  const syncedRepo = mode === AppMode.Cloud ? repository as SyncedNoteRepository : null;
  const { syncStatus, triggerSync } = useSync(syncedRepo);

  const { hasNote, noteDates, refreshNoteDates } = useNoteDates(repository, year);
  const refreshTimerRef = useRef<number | null>(null);
  const handleAfterSave = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      window.clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      refreshNoteDates();
    }, 500);
  }, [refreshNoteDates]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  const {
    content,
    setContent,
    isDecrypting
  } = useNoteContent(date, repository, handleAfterSave);

  useEffect(() => {
    if (syncStatus === SyncStatus.Synced) {
      refreshNoteDates({ immediate: true });
    }
  }, [syncStatus, refreshNoteDates]);

  return {
    repository,
    syncedRepo,
    syncStatus,
    triggerSync,
    content,
    setContent,
    hasNote,
    noteDates,
    refreshNoteDates,
    isDecrypting
  };
}
