import type { SupabaseClient } from '@supabase/supabase-js';
import type { Note, SyncedNote, SyncStatus } from '../types';
import type { NoteRepository } from './noteRepository';
import { sanitizeHtml } from '../utils/sanitize';
import { bytesToBase64, base64ToBytes, encodeUtf8, decodeUtf8, randomBytes } from './cryptoUtils';
import {
  fetchRemoteNotes,
  pushNote,
  decryptNote,
  resolveConflict
} from './syncService';

const NOTE_IV_BYTES = 12;
const LOCAL_DB_NAME = 'dailynotes-synced';
const LOCAL_STORE = 'notes';
const META_STORE = 'meta';

interface LocalNotePayload {
  id?: string;
  date: string;
  iv: string;
  data: string;
  revision: number;
  updatedAt: string;
  serverUpdatedAt?: string;
  deleted?: boolean;
  dirty?: boolean; // Needs to be synced
}

function openLocalDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(LOCAL_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_STORE)) {
        db.createObjectStore(LOCAL_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getLocalNote(date: string): Promise<LocalNotePayload | null> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, 'readonly');
    const store = tx.objectStore(LOCAL_STORE);
    const request = store.get(date);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function setLocalNote(date: string, payload: LocalNotePayload): Promise<void> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, 'readwrite');
    const store = tx.objectStore(LOCAL_STORE);
    store.put(payload, date);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function deleteLocalNote(date: string): Promise<void> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, 'readwrite');
    const store = tx.objectStore(LOCAL_STORE);
    store.delete(date);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getAllLocalNotes(): Promise<Map<string, LocalNotePayload>> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, 'readonly');
    const store = tx.objectStore(LOCAL_STORE);
    const request = store.getAll();
    const keysRequest = store.getAllKeys();

    let values: LocalNotePayload[] = [];
    let keys: IDBValidKey[] = [];

    request.onsuccess = () => {
      values = request.result;
    };
    keysRequest.onsuccess = () => {
      keys = keysRequest.result;
    };

    tx.oncomplete = () => {
      db.close();
      const map = new Map<string, LocalNotePayload>();
      keys.forEach((key, i) => {
        map.set(String(key), values[i]);
      });
      resolve(map);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getLastSyncTime(): Promise<string | null> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const request = store.get('lastSync');
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function setLastSyncTime(time: string): Promise<void> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    store.put(time, 'lastSync');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function encryptForLocal(
  vaultKey: CryptoKey,
  note: SyncedNote
): Promise<LocalNotePayload> {
  const iv = randomBytes(NOTE_IV_BYTES);
  const plaintext = encodeUtf8(JSON.stringify({ content: note.content }));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    vaultKey,
    plaintext
  );
  return {
    id: note.id,
    date: note.date,
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(encrypted)),
    revision: note.revision,
    updatedAt: note.updatedAt,
    serverUpdatedAt: note.serverUpdatedAt,
    deleted: note.deleted,
    dirty: false
  };
}

async function decryptFromLocal(
  vaultKey: CryptoKey,
  payload: LocalNotePayload
): Promise<SyncedNote> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.data);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    vaultKey,
    ciphertext
  );
  const parsed = JSON.parse(decodeUtf8(new Uint8Array(decrypted))) as {
    content: string;
  };
  return {
    id: payload.id,
    date: payload.date,
    content: sanitizeHtml(parsed.content),
    updatedAt: payload.updatedAt,
    revision: payload.revision,
    serverUpdatedAt: payload.serverUpdatedAt,
    deleted: payload.deleted
  };
}

export interface SyncedNoteRepository extends NoteRepository {
  sync(): Promise<void>;
  getSyncStatus(): SyncStatus;
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void;
  saveWithMetadata(note: SyncedNote): Promise<void>;
}

export function createSyncedNoteRepository(
  supabase: SupabaseClient,
  userId: string,
  vaultKey: CryptoKey
): SyncedNoteRepository {
  let syncStatus: SyncStatus = 'idle';
  const statusListeners = new Set<(status: SyncStatus) => void>();

  const setSyncStatus = (status: SyncStatus) => {
    syncStatus = status;
    statusListeners.forEach((cb) => cb(status));
  };

  const sync = async (): Promise<void> => {
    if (!navigator.onLine) {
      setSyncStatus('offline');
      return;
    }

    setSyncStatus('syncing');

    try {
      const lastSync = await getLastSyncTime();
      const localNotes = await getAllLocalNotes();

      // Pull remote changes
      const remoteNotes = await fetchRemoteNotes(supabase, userId, lastSync ?? undefined);

      let latestServerTime = lastSync;

      for (const remote of remoteNotes) {
        const local = localNotes.get(remote.date);

        if (!local || !local.dirty) {
          // No local changes or local is clean - accept remote
          const decrypted = await decryptNote(vaultKey, remote);
          if (remote.deleted) {
            await deleteLocalNote(remote.date);
          } else {
            const localPayload = await encryptForLocal(vaultKey, decrypted);
            await setLocalNote(remote.date, localPayload);
          }
        } else {
          // Local has dirty changes - resolve conflict
          const localNote = await decryptFromLocal(vaultKey, local);
          const remoteNote = await decryptNote(vaultKey, remote);

          const winner = resolveConflict(localNote, remoteNote);

          if (winner === 'remote') {
            if (remote.deleted) {
              await deleteLocalNote(remote.date);
            } else {
              const localPayload = await encryptForLocal(vaultKey, remoteNote);
              await setLocalNote(remote.date, localPayload);
            }
          }
          // If local wins, it stays dirty and will be pushed
        }

        if (
          remote.serverUpdatedAt &&
          (!latestServerTime || remote.serverUpdatedAt > latestServerTime)
        ) {
          latestServerTime = remote.serverUpdatedAt;
        }
      }

      // Push dirty local notes
      const updatedLocalNotes = await getAllLocalNotes();
      for (const [date, local] of updatedLocalNotes) {
        if (local.dirty && !local.deleted) {
          const note = await decryptFromLocal(vaultKey, local);
          const pushed = await pushNote(supabase, userId, note, vaultKey);
          const decrypted = await decryptNote(vaultKey, pushed);
          const updated = await encryptForLocal(vaultKey, decrypted);
          await setLocalNote(date, updated);

          if (
            pushed.serverUpdatedAt &&
            (!latestServerTime || pushed.serverUpdatedAt > latestServerTime)
          ) {
            latestServerTime = pushed.serverUpdatedAt;
          }
        }
      }

      if (latestServerTime) {
        await setLastSyncTime(latestServerTime);
      }

      setSyncStatus('synced');
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
    }
  };

  return {
    async get(date: string): Promise<Note | null> {
      const local = await getLocalNote(date);
      if (!local || local.deleted) return null;
      const note = await decryptFromLocal(vaultKey, local);
      return {
        date: note.date,
        content: note.content,
        updatedAt: note.updatedAt
      };
    },

    async save(date: string, content: string): Promise<void> {
      const sanitizedContent = sanitizeHtml(content);
      const existing = await getLocalNote(date);

      const note: SyncedNote = {
        id: existing?.id,
        date,
        content: sanitizedContent,
        updatedAt: new Date().toISOString(),
        revision: (existing?.revision ?? 0) + 1,
        serverUpdatedAt: existing?.serverUpdatedAt,
        deleted: false
      };

      const payload = await encryptForLocal(vaultKey, note);
      payload.dirty = true;
      await setLocalNote(date, payload);
    },

    async saveWithMetadata(note: SyncedNote): Promise<void> {
      const sanitizedContent = sanitizeHtml(note.content);
      const payload = await encryptForLocal(vaultKey, {
        ...note,
        content: sanitizedContent
      });
      payload.dirty = true;
      await setLocalNote(note.date, payload);
    },

    async delete(date: string): Promise<void> {
      const existing = await getLocalNote(date);
      if (!existing) return;

      if (existing.id) {
        // Mark as deleted for sync
        existing.deleted = true;
        existing.dirty = true;
        existing.updatedAt = new Date().toISOString();
        existing.revision += 1;
        await setLocalNote(date, existing);
      } else {
        // Never synced - just delete locally
        await deleteLocalNote(date);
      }
    },

    async getAllDates(): Promise<string[]> {
      const notes = await getAllLocalNotes();
      return Array.from(notes.entries())
        .filter(([, note]) => !note.deleted)
        .map(([date]) => date);
    },

    sync,

    getSyncStatus(): SyncStatus {
      return syncStatus;
    },

    onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    }
  };
}
