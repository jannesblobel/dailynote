import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNoteContent } from './useNoteContent';
import { useNoteDates } from './useNoteDates';
import { useSync } from './useSync';
import { supabase } from '../lib/supabase';
import { createLocalSyncedNoteRepository, createSyncedNoteRepository } from '../storage/syncedNoteRepository';
import { createEncryptedNoteRepository } from '../storage/noteStorage';
import { createEncryptedImageRepository } from '../storage/localImageStorage';
import { createCloudImageRepository } from '../storage/cloudImageStorage';
import type { SyncedNoteRepository } from '../storage/syncedNoteRepository';
import type { NoteRepository } from '../storage/noteRepository';
import type { ImageRepository } from '../storage/imageRepository';
import { AppMode } from './useAppMode';
import { SyncStatus } from '../types';

interface UseNoteRepositoryProps {
  mode: AppMode;
  authUser: User | null;
  vaultKey: CryptoKey | null;
  cloudCacheKey: CryptoKey | null;
  date: string | null;
  year: number;
}

export interface UseNoteRepositoryReturn {
  repository: NoteRepository | SyncedNoteRepository | null;
  imageRepository: ImageRepository | null;
  syncedRepo: SyncedNoteRepository | null;
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
  cloudCacheKey,
  date,
  year
}: UseNoteRepositoryProps): UseNoteRepositoryReturn {
  const repository = useMemo<NoteRepository | SyncedNoteRepository | null>(() => {
    if (mode === AppMode.Cloud && authUser) {
      if (!vaultKey) return null;
      return createSyncedNoteRepository(supabase, authUser.id, vaultKey);
    }

    if (cloudCacheKey && (!authUser || mode === AppMode.Local)) {
      return createLocalSyncedNoteRepository(cloudCacheKey);
    }

    if (!vaultKey) return null;

    return createEncryptedNoteRepository(vaultKey);
  }, [mode, authUser, vaultKey, cloudCacheKey]);

  const imageRepository = useMemo<ImageRepository | null>(() => {
    if (mode === AppMode.Cloud && authUser) {
      return createCloudImageRepository(supabase, authUser.id);
    }

    // For local mode (both encrypted and local synced)
    if (vaultKey) {
      return createEncryptedImageRepository(vaultKey);
    }

    if (cloudCacheKey) {
      return createEncryptedImageRepository(cloudCacheKey);
    }

    return null;
  }, [mode, authUser, vaultKey, cloudCacheKey]);

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
