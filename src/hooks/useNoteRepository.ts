import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNoteContent } from './useNoteContent';
import { useNoteDates } from './useNoteDates';
import { useSync } from './useSync';
import { supabase } from '../lib/supabase';
import { createUnifiedNoteRepository } from '../storage/unifiedNoteRepository';
import { createUnifiedSyncedNoteRepository } from '../storage/unifiedSyncedNoteRepository';
import { createUnifiedImageRepository } from '../storage/unifiedImageRepository';
import type { UnifiedSyncedNoteRepository } from '../storage/unifiedSyncedNoteRepository';
import type { NoteRepository } from '../storage/noteRepository';
import type { ImageRepository } from '../storage/imageRepository';
import { AppMode } from './useAppMode';
import { SyncStatus } from '../types';

interface UseNoteRepositoryProps {
  mode: AppMode;
  authUser: User | null;
  vaultKey: CryptoKey | null;
  keyring: Map<string, CryptoKey>;
  activeKeyId: string | null;
  date: string | null;
  year: number;
}

export interface UseNoteRepositoryReturn {
  repository: NoteRepository | UnifiedSyncedNoteRepository | null;
  imageRepository: ImageRepository | null;
  syncedRepo: UnifiedSyncedNoteRepository | null;
  syncStatus: ReturnType<typeof useSync>['syncStatus'];
  triggerSync: ReturnType<typeof useSync>['triggerSync'];
  content: string;
  setContent: (content: string) => void;
  hasEdits: boolean;
  hasNote: (date: string) => boolean;
  noteDates: Set<string>;
  refreshNoteDates: (options?: { immediate?: boolean }) => void;
  isDecrypting: boolean;
  isContentReady: boolean;
}

export function useNoteRepository({
  mode,
  authUser,
  vaultKey,
  keyring,
  activeKeyId,
  date,
  year
}: UseNoteRepositoryProps): UseNoteRepositoryReturn {
  const repository = useMemo<NoteRepository | UnifiedSyncedNoteRepository | null>(() => {
    if (!vaultKey || !activeKeyId) return null;
    const keyProvider = {
      activeKeyId,
      getKey: (keyId: string) => keyring.get(keyId) ?? null
    };

    if (mode === AppMode.Cloud && authUser) {
      return createUnifiedSyncedNoteRepository(supabase, authUser.id, keyProvider);
    }

    return createUnifiedNoteRepository(keyProvider);
  }, [mode, authUser, vaultKey, keyring, activeKeyId]);

  const imageRepository = useMemo<ImageRepository | null>(() => {
    if (!vaultKey || !activeKeyId) return null;
    const keyProvider = {
      activeKeyId,
      getKey: (keyId: string) => keyring.get(keyId) ?? null
    };
    return createUnifiedImageRepository(keyProvider);
  }, [vaultKey, keyring, activeKeyId]);

  const syncedRepo =
    mode === AppMode.Cloud && authUser ? (repository as UnifiedSyncedNoteRepository) : null;
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
    isDecrypting,
    hasEdits,
    isContentReady
  } = useNoteContent(date, repository, handleAfterSave);

  useEffect(() => {
    if (syncStatus === SyncStatus.Synced) {
      refreshNoteDates({ immediate: true });
    }
  }, [syncStatus, refreshNoteDates]);

  return {
    repository,
    imageRepository,
    syncedRepo,
    syncStatus,
    triggerSync,
    content,
    setContent,
    hasEdits,
    hasNote,
    noteDates,
    refreshNoteDates,
    isDecrypting,
    isContentReady
  };
}
