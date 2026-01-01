import { useCallback, useEffect, useRef, useState } from 'react';
import type { SyncStatus } from '../types';
import type { SyncedNoteRepository } from '../storage/syncedNoteRepository';

interface UseSyncReturn {
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  triggerSync: () => void;
}

export function useSync(repository: SyncedNoteRepository | null): UseSyncReturn {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncTimeoutRef = useRef<number | null>(null);
  const isSyncingRef = useRef(false);

  // Subscribe to repository sync status changes
  useEffect(() => {
    if (!repository) {
      setSyncStatus('idle');
      return;
    }

    setSyncStatus(repository.getSyncStatus());
    return repository.onSyncStatusChange((status) => {
      setSyncStatus(status);
      if (status === 'synced') {
        setLastSynced(new Date());
      }
    });
  }, [repository]);

  // Sync function with debounce
  const triggerSync = useCallback(() => {
    if (!repository || isSyncingRef.current) return;

    // Clear existing timeout
    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current);
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

  // Initial sync on mount
  useEffect(() => {
    if (!repository) return;

    const initialSync = async () => {
      isSyncingRef.current = true;
      try {
        await repository.sync();
      } finally {
        isSyncingRef.current = false;
      }
    };

    void initialSync();

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [repository]);

  // Sync on reconnect
  useEffect(() => {
    if (!repository) return;

    const handleOnline = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await repository.sync();
      } finally {
        isSyncingRef.current = false;
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [repository]);

  // Update offline status
  useEffect(() => {
    const handleOffline = () => {
      setSyncStatus('offline');
    };

    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, []);

  return {
    syncStatus,
    lastSynced,
    triggerSync
  };
}
