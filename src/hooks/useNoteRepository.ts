import { useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { useNotes } from './useNotes';
import { useSync } from './useSync';
import { supabase } from '../lib/supabase';
import { createSyncedNoteRepository } from '../storage/syncedNoteRepository';
import { createEncryptedNoteRepository } from '../storage/noteStorage';
import { STORAGE_PREFIX } from '../utils/constants';
import type { SyncedNoteRepository } from '../storage/syncedNoteRepository';
import type { NoteRepository } from '../storage/noteRepository';
import { AppMode } from './useAppMode';
import { SyncStatus } from '../types';

const LOCAL_MIGRATION_KEY = `${STORAGE_PREFIX}local_migrated_v1`;

interface UseNoteRepositoryProps {
  mode: AppMode;
  authUser: User | null;
  vaultKey: CryptoKey | null;
  localVaultKey: CryptoKey | null;
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
  refreshNoteDates: () => void;
  isDecrypting: boolean;
}

export function useNoteRepository({
  mode,
  authUser,
  vaultKey,
  localVaultKey,
  date,
  year
}: UseNoteRepositoryProps): UseNoteRepositoryReturn {
  const [hasMigratedLocal, setHasMigratedLocal] = useState(
    typeof window !== 'undefined' && localStorage.getItem(LOCAL_MIGRATION_KEY) === '1'
  );

  const repository = useMemo<NoteRepository | SyncedNoteRepository | null>(() => {
    if (!vaultKey) return null;

    if (mode === AppMode.Cloud && authUser) {
      return createSyncedNoteRepository(supabase, authUser.id, vaultKey);
    }

    return createEncryptedNoteRepository(vaultKey);
  }, [mode, authUser, vaultKey]);

  const syncedRepo = mode === AppMode.Cloud ? repository as SyncedNoteRepository : null;
  const { syncStatus, triggerSync } = useSync(syncedRepo);

  const {
    content,
    setContent,
    hasNote,
    noteDates,
    refreshNoteDates,
    isDecrypting
  } = useNotes(
    date,
    repository,
    year,
    mode === AppMode.Cloud ? triggerSync : undefined
  );

  useEffect(() => {
    if (syncStatus === SyncStatus.Synced) {
      refreshNoteDates();
    }
  }, [syncStatus, refreshNoteDates]);

  useEffect(() => {
    if (mode !== AppMode.Cloud || !repository || !vaultKey || !localVaultKey || hasMigratedLocal) {
      return;
    }

    let cancelled = false;

    const migrateLocalNotes = async () => {
      try {
        const localRepository = createEncryptedNoteRepository(localVaultKey);
        const localDates = await localRepository.getAllDates();
        if (!localDates.length) {
          if (!cancelled) {
            setHasMigratedLocal(true);
            localStorage.setItem(LOCAL_MIGRATION_KEY, '1');
          }
          return;
        }

        for (const localDate of localDates) {
          const note = await localRepository.get(localDate);
          if (note?.content) {
            await (repository as SyncedNoteRepository).saveWithMetadata({
              date: note.date,
              content: note.content,
              updatedAt: note.updatedAt,
              revision: 1,
              deleted: false
            });
          }
        }

        if (!cancelled) {
          setHasMigratedLocal(true);
          localStorage.setItem(LOCAL_MIGRATION_KEY, '1');
          triggerSync();
        }
      } catch (error) {
        console.error('Local migration error:', error);
      }
    };

    void migrateLocalNotes();

    return () => {
      cancelled = true;
    };
  }, [mode, repository, vaultKey, localVaultKey, hasMigratedLocal, triggerSync]);

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
