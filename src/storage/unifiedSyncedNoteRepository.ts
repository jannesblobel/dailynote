import type { SupabaseClient } from '@supabase/supabase-js';
import { SyncStatus } from '../types';
import type { NoteRepository } from './noteRepository';
import {
  createUnifiedNoteRepository,
  type KeyringProvider,
  type UnifiedNoteRepository
} from './unifiedNoteRepository';
import { getAllNoteMeta, getAllNoteRecords, setNoteAndMeta } from './unifiedNoteStore';
import type { NoteMetaRecord, NoteRecord } from './unifiedDb';
import {
  fetchRemoteNoteByDate,
  fetchRemoteNotesSince,
  pushRemoteNote,
  RevisionConflictError,
  type RemoteNote
} from './unifiedSyncService';
import { getSyncState, setSyncState } from './unifiedSyncStateStore';
import { syncEncryptedImages } from './unifiedImageSyncService';

export interface UnifiedSyncedNoteRepository extends NoteRepository {
  sync(): Promise<void>;
  getSyncStatus(): SyncStatus;
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void;
  getAllDatesForYear(year: number): Promise<string[]>;
}

function resolveConflict(
  local: { updatedAt: string; revision: number },
  remote: { updatedAt: string; revision: number }
): 'local' | 'remote' {
  const localTime = new Date(local.updatedAt).getTime();
  const remoteTime = new Date(remote.updatedAt).getTime();
  if (localTime > remoteTime) return 'local';
  if (remoteTime > localTime) return 'remote';
  return local.revision >= remote.revision ? 'local' : 'remote';
}

function toLocalRecord(remote: RemoteNote): NoteRecord {
  return {
    version: 1,
    date: remote.date,
    keyId: remote.keyId,
    ciphertext: remote.ciphertext,
    nonce: remote.nonce,
    updatedAt: remote.updatedAt,
    deleted: remote.deleted
  };
}

function toLocalMeta(remote: RemoteNote): NoteMetaRecord {
  return {
    date: remote.date,
    revision: remote.revision,
    remoteId: remote.id,
    serverUpdatedAt: remote.serverUpdatedAt,
    lastSyncedAt: new Date().toISOString(),
    pendingOp: null
  };
}

export function createUnifiedSyncedNoteRepository(
  supabase: SupabaseClient,
  userId: string,
  keyring: KeyringProvider
): UnifiedSyncedNoteRepository {
  const localRepo: UnifiedNoteRepository = createUnifiedNoteRepository(keyring);
  let syncStatus: SyncStatus = SyncStatus.Idle;
  const listeners = new Set<(status: SyncStatus) => void>();

  const setSyncStatus = (status: SyncStatus) => {
    syncStatus = status;
    listeners.forEach((cb) => cb(status));
  };

  const sync = async (): Promise<void> => {
    if (!navigator.onLine) {
      setSyncStatus(SyncStatus.Offline);
      return;
    }

    setSyncStatus(SyncStatus.Syncing);

    try {
      const [records, metas, syncState] = await Promise.all([
        getAllNoteRecords(),
        getAllNoteMeta(),
        getSyncState()
      ]);

      const recordMap = new Map(records.map((record) => [record.date, record]));
      const metaMap = new Map(metas.map((meta) => [meta.date, meta]));

      // Push pending local changes.
      for (const meta of metas) {
        if (!meta.pendingOp) continue;
        const record = recordMap.get(meta.date);
        if (!record) continue;

        const isDeleted = meta.pendingOp === 'delete' || record.deleted;
        const now = new Date().toISOString();

        if (isDeleted) {
          if (meta.remoteId) {
            const remote = await pushRemoteNote(supabase, userId, {
              id: meta.remoteId,
              date: record.date,
              ciphertext: record.ciphertext,
              nonce: record.nonce,
              keyId: record.keyId ?? keyring.activeKeyId,
              revision: meta.revision,
              updatedAt: record.updatedAt,
              serverUpdatedAt: meta.serverUpdatedAt ?? null,
              deleted: true
            });
            await setNoteAndMeta(
              {
                ...record,
                deleted: true,
                updatedAt: remote.updatedAt
              },
              {
                ...meta,
                remoteId: remote.id,
                serverUpdatedAt: remote.serverUpdatedAt,
                lastSyncedAt: now,
                pendingOp: null
              }
            );
          } else {
            await setNoteAndMeta(
              {
                ...record,
                deleted: true
              },
              {
                ...meta,
                lastSyncedAt: now,
                pendingOp: null
              }
            );
          }
          continue;
        }

        try {
          const remote = await pushRemoteNote(supabase, userId, {
            id: meta.remoteId,
            date: record.date,
            ciphertext: record.ciphertext,
            nonce: record.nonce,
            keyId: record.keyId ?? keyring.activeKeyId,
            revision: meta.revision,
            updatedAt: record.updatedAt,
            serverUpdatedAt: meta.serverUpdatedAt ?? null,
            deleted: false
          });
          await setNoteAndMeta(toLocalRecord(remote), {
            ...toLocalMeta(remote),
            lastSyncedAt: now
          });
        } catch (error) {
          if (!(error instanceof RevisionConflictError)) {
            throw error;
          }

          const remote = await fetchRemoteNoteByDate(supabase, userId, record.date);
          if (!remote) {
            throw error;
          }

          const winner = resolveConflict(
            { updatedAt: record.updatedAt, revision: meta.revision },
            { updatedAt: remote.updatedAt, revision: remote.revision }
          );

          if (winner === 'local') {
            try {
              const rebasedRevision = Math.max(meta.revision, remote.revision + 1);
              const rebased = await pushRemoteNote(supabase, userId, {
                id: meta.remoteId ?? remote.id,
                date: record.date,
                ciphertext: record.ciphertext,
                nonce: record.nonce,
                keyId: record.keyId ?? keyring.activeKeyId,
                revision: rebasedRevision,
                updatedAt: record.updatedAt,
                serverUpdatedAt: remote.serverUpdatedAt,
                deleted: false
              });
              await setNoteAndMeta(toLocalRecord(rebased), {
                ...toLocalMeta(rebased),
                lastSyncedAt: now
              });
            } catch (rebaseError) {
              // If rebased push fails, accept remote to avoid infinite conflict
              console.warn('Rebased push failed, accepting remote version:', rebaseError);
              await setNoteAndMeta(toLocalRecord(remote), {
                ...toLocalMeta(remote),
                lastSyncedAt: now
              });
            }
          } else {
            await setNoteAndMeta(toLocalRecord(remote), {
              ...toLocalMeta(remote),
              lastSyncedAt: now
            });
          }
        }
      }

      // Pull remote updates since cursor.
      const remoteNotes = await fetchRemoteNotesSince(
        supabase,
        userId,
        syncState.cursor ?? null
      );

      let nextCursor = syncState.cursor ?? null;

      for (const remote of remoteNotes) {
        const localMeta = metaMap.get(remote.date);
        const localRecord = recordMap.get(remote.date);

        if (localMeta?.pendingOp) {
          nextCursor = remote.serverUpdatedAt;
          continue;
        }

        if (!localMeta || !localRecord) {
          await setNoteAndMeta(toLocalRecord(remote), toLocalMeta(remote));
          nextCursor = remote.serverUpdatedAt;
          continue;
        }

        const winner = resolveConflict(
          { updatedAt: localRecord.updatedAt, revision: localMeta.revision },
          { updatedAt: remote.updatedAt, revision: remote.revision }
        );
        if (winner === 'remote') {
          await setNoteAndMeta(toLocalRecord(remote), toLocalMeta(remote));
        }
        nextCursor = remote.serverUpdatedAt;
      }

      if (remoteNotes.length > 0) {
        await setSyncState({ id: 'state', cursor: nextCursor });
      }

      await syncEncryptedImages(supabase, userId);

      setSyncStatus(SyncStatus.Synced);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus(SyncStatus.Error);
    }
  };

  return {
    ...localRepo,
    sync,
    getSyncStatus(): SyncStatus {
      return syncStatus;
    },
    onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }
  };
}
