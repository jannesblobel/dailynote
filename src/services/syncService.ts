import type { UnifiedSyncedNoteRepository } from '../storage/unifiedSyncedNoteRepository';
import { getAllNoteMeta } from '../storage/unifiedNoteStore';
import { getAllImageMeta } from '../storage/unifiedImageStore';

export interface PendingOpsSummary {
  notes: number;
  images: number;
  total: number;
}

export async function getPendingOpsSummary(): Promise<PendingOpsSummary> {
  const [noteMeta, imageMeta] = await Promise.all([
    getAllNoteMeta(),
    getAllImageMeta()
  ]);
  const notes = noteMeta.filter(meta => meta.pendingOp).length;
  const images = imageMeta.filter(meta => meta.pendingOp).length;
  return {
    notes,
    images,
    total: notes + images
  };
}

export async function hasPendingOps(): Promise<boolean> {
  const summary = await getPendingOpsSummary();
  return summary.total > 0;
}

export interface SyncService {
  queueSync: (options?: { immediate?: boolean }) => void;
  syncNow: () => Promise<void>;
  queueIdleSync: (options?: { delayMs?: number }) => void;
  dispose: () => void;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_IDLE_DELAY_MS = 4000;

export function createSyncService(
  repository: UnifiedSyncedNoteRepository
): SyncService {
  let debounceTimer: number | null = null;
  let idleTimer: number | null = null;
  let syncQueued = false;
  let currentSyncPromise: Promise<void> | null = null;

  const clearTimer = (timer: number | null) => {
    if (timer !== null) {
      window.clearTimeout(timer);
    }
  };

  const runSyncLoop = async (): Promise<void> => {
    if (currentSyncPromise) {
      syncQueued = true;
      return currentSyncPromise;
    }

    currentSyncPromise = (async () => {
      try {
        while (true) {
          syncQueued = false;
          await repository.sync();
          if (!syncQueued) {
            break;
          }
        }
      } finally {
        currentSyncPromise = null;
      }
    })();

    return currentSyncPromise;
  };

  const queueSync = (options?: { immediate?: boolean }) => {
    clearTimer(debounceTimer);
    debounceTimer = null;

    if (options?.immediate) {
      void runSyncLoop();
      return;
    }

    debounceTimer = window.setTimeout(() => {
      debounceTimer = null;
      void runSyncLoop();
    }, DEFAULT_DEBOUNCE_MS);
  };

  const queueIdleSync = (options?: { delayMs?: number }) => {
    if (idleTimer !== null) {
      return;
    }
    idleTimer = window.setTimeout(async () => {
      idleTimer = null;
      if (await hasPendingOps()) {
        queueSync({ immediate: true });
      }
    }, options?.delayMs ?? DEFAULT_IDLE_DELAY_MS);
  };

  const dispose = () => {
    clearTimer(debounceTimer);
    clearTimer(idleTimer);
    debounceTimer = null;
    idleTimer = null;
    syncQueued = false;
  };

  return {
    queueSync,
    syncNow: runSyncLoop,
    queueIdleSync,
    dispose
  };
}
