import { useCallback, useEffect, useRef, useState } from 'react';
import { SyncStatus } from '../types';
import type { UnifiedSyncedNoteRepository } from '../storage/unifiedSyncedNoteRepository';

interface UseSyncReturn {
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  triggerSync: (options?: { immediate?: boolean }) => void;
}

export function useSync(repository: UnifiedSyncedNoteRepository | null): UseSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(SyncStatus.Idle);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  // Subscribe to repository sync status changes
  useEffect(() => {
    if (!repository) {
      setSyncStatus(SyncStatus.Idle);
      return;
    }

    setSyncStatus(repository.getSyncStatus());
    return repository.onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (status === SyncStatus.Synced) {
        setLastSynced(new Date());
      }
    });
  }, [repository]);

  // Sync function with debounce
  const triggerSync = useCallback((options?: { immediate?: boolean }) => {
    if (!repository || isSyncingRef.current) return;

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
    }

    if (options?.immediate) {
      isSyncingRef.current = true;
      void (async () => {
        try {
          await repository.sync();
        } finally {
          isSyncingRef.current = false;
        }
      })();
      return;
    }

    // Debounce sync by 2 seconds
    syncTimeoutRef.current = window.setTimeout(async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await repository.sync();
      } finally {
        isSyncingRef.current = false;
      }
    }, 2000);
  }, [repository]);

  useEffect(() => {
    if (!repository) return;
    triggerSync({ immediate: true });
  }, [repository, triggerSync]);

  // Update offline status
  useEffect(() => {
    const handleOffline = () => {
      setSyncStatus(SyncStatus.Offline);
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  return {
    syncStatus,
    lastSynced,
    triggerSync
  };
}
