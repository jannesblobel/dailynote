import type { SupabaseClient } from "@supabase/supabase-js";
import { SyncStatus, type Note, type SyncedNote } from "../types";
import type { NoteRepository } from "./noteRepository";
import { sanitizeHtml } from "../utils/sanitize";
import {
  bytesToBase64,
  base64ToBytes,
  encodeUtf8,
  decodeUtf8,
  randomBytes,
} from "./cryptoUtils";
import {
  fetchNoteIndex,
  fetchRemoteNoteByDate,
  pushNote,
  decryptNote,
  deleteRemoteNote,
  resolveConflict,
  RevisionConflictError,
  type EncryptedRemoteNote,
} from "./syncService";

const NOTE_IV_BYTES = 12;
const LOCAL_DB_NAME = "dailynotes-synced";
const LOCAL_STORE = "notes";
const META_STORE = "meta";

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
    const tx = db.transaction(LOCAL_STORE, "readonly");
    const store = tx.objectStore(LOCAL_STORE);
    const request = store.get(date);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function setLocalNote(
  date: string,
  payload: LocalNotePayload,
): Promise<void> {
  const db = await openLocalDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LOCAL_STORE, "readwrite");
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
    const tx = db.transaction(LOCAL_STORE, "readwrite");
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
    const tx = db.transaction(LOCAL_STORE, "readonly");
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

async function encryptForLocal(
  vaultKey: CryptoKey,
  note: SyncedNote,
): Promise<LocalNotePayload> {
  const iv = randomBytes(NOTE_IV_BYTES);
  const plaintext = encodeUtf8(JSON.stringify({ content: note.content }));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    vaultKey,
    plaintext,
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
    dirty: false,
  };
}

async function decryptFromLocal(
  vaultKey: CryptoKey,
  payload: LocalNotePayload,
): Promise<SyncedNote> {
  const iv = base64ToBytes(payload.iv);
  const ciphertext = base64ToBytes(payload.data);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    vaultKey,
    ciphertext,
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
    deleted: payload.deleted,
  };
}

export interface SyncedNoteRepository extends NoteRepository {
  sync(): Promise<void>;
  getSyncStatus(): SyncStatus;
  onSyncStatusChange(callback: (status: SyncStatus) => void): () => void;
  saveWithMetadata(note: SyncedNote): Promise<void>;
  getAllDatesForYear(year: number): Promise<string[]>;
}

export function createSyncedNoteRepository(
  supabase: SupabaseClient,
  userId: string,
  vaultKey: CryptoKey,
): SyncedNoteRepository {
  let syncStatus: SyncStatus = SyncStatus.Idle;
  const statusListeners = new Set<(status: SyncStatus) => void>();

  const setSyncStatus = (status: SyncStatus) => {
    syncStatus = status;
    statusListeners.forEach((cb) => cb(status));
  };

  const sync = async (): Promise<void> => {
    if (!navigator.onLine) {
      setSyncStatus(SyncStatus.Offline);
      return;
    }

    setSyncStatus(SyncStatus.Syncing);

    try {
      const updatedLocalNotes = await getAllLocalNotes();
      const processedDates = new Set<string>();

      const pushLocalNote = async (
        localNote: SyncedNote,
        date: string,
      ): Promise<void> => {
        if (localNote.deleted) {
          if (localNote.id) {
            await deleteRemoteNote(supabase, userId, localNote.id);
          }
          const updated = await encryptForLocal(vaultKey, {
            ...localNote,
            deleted: true,
          });
          await setLocalNote(date, updated);
          return;
        }

        try {
          const pushed = await pushNote(supabase, userId, localNote, vaultKey);
          const decrypted = await decryptNote(vaultKey, pushed);
          const updated = await encryptForLocal(vaultKey, decrypted);
          await setLocalNote(date, updated);
        } catch (error) {
          if (!(error instanceof RevisionConflictError)) {
            throw error;
          }

          const latestEncrypted = await fetchRemoteNoteByDate(
            supabase,
            userId,
            date,
          );
          if (!latestEncrypted) {
            throw error;
          }
          const latestRemote = await decryptNote(vaultKey, latestEncrypted);
          const winner = resolveConflict(localNote, latestRemote);
          if (winner === "local") {
            const rebasedLocal: SyncedNote = {
              ...localNote,
              serverUpdatedAt: latestRemote.serverUpdatedAt,
              revision: Math.max(localNote.revision, latestRemote.revision + 1),
            };
            const pushed = await pushNote(
              supabase,
              userId,
              rebasedLocal,
              vaultKey,
            );
            const decrypted = await decryptNote(vaultKey, pushed);
            const updated = await encryptForLocal(vaultKey, decrypted);
            await setLocalNote(date, updated);
          } else {
            const updated = await encryptForLocal(vaultKey, latestRemote);
            await setLocalNote(date, updated);
          }
        }
      };

      // Reconcile dirty local notes with any remote updates.
      for (const [date, local] of updatedLocalNotes) {
        if (!local.dirty) continue;

        const localNote = await decryptFromLocal(vaultKey, local);
        const remoteEncrypted = await fetchRemoteNoteByDate(
          supabase,
          userId,
          date,
        );
        if (remoteEncrypted) {
          const remoteNote = await decryptNote(vaultKey, remoteEncrypted);
          const winner = resolveConflict(localNote, remoteNote);
          if (winner === "local") {
            await pushLocalNote(localNote, date);
          } else {
            const updated = await encryptForLocal(vaultKey, remoteNote);
            await setLocalNote(date, {
              ...updated,
              dirty: false,
            });
          }
        } else {
          await pushLocalNote(localNote, date);
        }

        processedDates.add(date);
      }

      // Pull remote updates for notes that weren't processed above.
      const remoteDates = await fetchNoteIndex(supabase, userId);
      const remoteDateSet = new Set(remoteDates);
      for (const date of remoteDates) {
        if (processedDates.has(date)) continue;

        const remoteEncrypted = await fetchRemoteNoteByDate(
          supabase,
          userId,
          date,
        );
        if (!remoteEncrypted) continue;
        const remoteNote = await decryptNote(vaultKey, remoteEncrypted);

        const local = updatedLocalNotes.get(date);
        if (!local) {
          if (!remoteNote.deleted) {
            const updated = await encryptForLocal(vaultKey, remoteNote);
            await setLocalNote(date, updated);
          }
          continue;
        }

        if (local.dirty) continue;

        const localNote = await decryptFromLocal(vaultKey, local);
        const winner = resolveConflict(localNote, remoteNote);
        if (winner === "remote") {
          const updated = await encryptForLocal(vaultKey, remoteNote);
          await setLocalNote(date, {
            ...updated,
            dirty: false,
          });
        } else {
          await pushLocalNote(localNote, date);
        }
      }

      // Treat missing remote dates as deletions when the note isn't dirty locally.
      // Guard against empty remote index to avoid accidental wipes during auth/load glitches.
      if (remoteDates.length > 0) {
        for (const [date, local] of updatedLocalNotes) {
          if (local.dirty || local.deleted) continue;
          if (!remoteDateSet.has(date)) {
            await setLocalNote(date, {
              ...local,
              deleted: true,
              dirty: false,
            });
          }
        }
      }

      setSyncStatus(SyncStatus.Synced);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus(SyncStatus.Error);
    }
  };

  return {
    async get(date: string): Promise<Note | null> {
      const local = await getLocalNote(date);
      if (local?.deleted) return null;
      if (local && (local.dirty || !navigator.onLine)) {
        const note = await decryptFromLocal(vaultKey, local);
        return {
          date: note.date,
          content: note.content,
          updatedAt: note.updatedAt,
        };
      }

      if (!navigator.onLine) {
        return null;
      }

      let remote: EncryptedRemoteNote | null = null;
      try {
        remote = await fetchRemoteNoteByDate(supabase, userId, date);
      } catch (error) {
        if (local) {
          const note = await decryptFromLocal(vaultKey, local);
          return {
            date: note.date,
            content: note.content,
            updatedAt: note.updatedAt,
          };
        }
        throw error;
      }
      if (!remote || remote.deleted) {
        if (local) {
          if (remote?.deleted && !local.deleted) {
            await setLocalNote(date, {
              ...local,
              deleted: true,
              dirty: false,
            });
            return null;
          }
          const note = await decryptFromLocal(vaultKey, local);
          return {
            date: note.date,
            content: note.content,
            updatedAt: note.updatedAt,
          };
        }
        return null;
      }

      const decrypted = await decryptNote(vaultKey, remote);
      const payload = await encryptForLocal(vaultKey, decrypted);
      await setLocalNote(date, payload);

      return {
        date: decrypted.date,
        content: decrypted.content,
        updatedAt: decrypted.updatedAt,
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
        deleted: false,
      };

      const payload = await encryptForLocal(vaultKey, note);
      payload.dirty = true;
      await setLocalNote(date, payload);
    },

    async saveWithMetadata(note: SyncedNote): Promise<void> {
      const sanitizedContent = sanitizeHtml(note.content);
      const payload = await encryptForLocal(vaultKey, {
        ...note,
        content: sanitizedContent,
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
      const localNotes = await getAllLocalNotes();
      const localDates = Array.from(localNotes.entries())
        .filter(([, note]) => !note.deleted)
        .map(([date]) => date);
      const localDeletedDates = new Set(
        Array.from(localNotes.entries())
          .filter(([, note]) => note.deleted)
          .map(([date]) => date),
      );

      if (!navigator.onLine) {
        return localDates;
      }

      try {
        const remoteDates = await fetchNoteIndex(supabase, userId);
        const merged = new Set<string>([...remoteDates, ...localDates]);
        localDeletedDates.forEach((date) => merged.delete(date));
        return Array.from(merged);
      } catch {
        return localDates;
      }
    },

    async getAllDatesForYear(year: number): Promise<string[]> {
      const localNotes = await getAllLocalNotes();
      const localDates = Array.from(localNotes.entries())
        .filter(([, note]) => !note.deleted)
        .map(([date]) => date)
        .filter((date) => date.slice(-4) === String(year));
      const localDeletedDates = new Set(
        Array.from(localNotes.entries())
          .filter(([, note]) => note.deleted)
          .map(([date]) => date)
          .filter((date) => date.slice(-4) === String(year)),
      );

      if (!navigator.onLine) {
        return localDates;
      }

      try {
        const remoteDates = await fetchNoteIndex(supabase, userId, year);
        const merged = new Set<string>([...remoteDates, ...localDates]);
        localDeletedDates.forEach((date) => merged.delete(date));
        return Array.from(merged);
      } catch {
        return localDates;
      }
    },

    sync,

    getSyncStatus(): SyncStatus {
      return syncStatus;
    },

    onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
  };
}

export function createLocalSyncedNoteRepository(
  vaultKey: CryptoKey,
): SyncedNoteRepository {
  let syncStatus: SyncStatus = SyncStatus.Idle;
  const statusListeners = new Set<(status: SyncStatus) => void>();

  const setSyncStatus = (status: SyncStatus) => {
    syncStatus = status;
    statusListeners.forEach((cb) => cb(status));
  };

  const sync = async (): Promise<void> => {
    setSyncStatus(SyncStatus.Idle);
  };

  return {
    async get(date: string): Promise<Note | null> {
      const local = await getLocalNote(date);
      if (!local || local.deleted) return null;
      const note = await decryptFromLocal(vaultKey, local);
      return {
        date: note.date,
        content: note.content,
        updatedAt: note.updatedAt,
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
        deleted: false,
      };

      const payload = await encryptForLocal(vaultKey, note);
      payload.dirty = true;
      await setLocalNote(date, payload);
    },

    async saveWithMetadata(note: SyncedNote): Promise<void> {
      const sanitizedContent = sanitizeHtml(note.content);
      const payload = await encryptForLocal(vaultKey, {
        ...note,
        content: sanitizedContent,
      });
      payload.dirty = true;
      await setLocalNote(note.date, payload);
    },

    async delete(date: string): Promise<void> {
      const existing = await getLocalNote(date);
      if (!existing) return;

      if (existing.id) {
        existing.deleted = true;
        existing.dirty = true;
        existing.updatedAt = new Date().toISOString();
        existing.revision += 1;
        await setLocalNote(date, existing);
      } else {
        await deleteLocalNote(date);
      }
    },

    async getAllDates(): Promise<string[]> {
      const localNotes = await getAllLocalNotes();
      return Array.from(localNotes.entries())
        .filter(([, note]) => !note.deleted)
        .map(([date]) => date);
    },

    async getAllDatesForYear(year: number): Promise<string[]> {
      const localNotes = await getAllLocalNotes();
      return Array.from(localNotes.entries())
        .filter(([, note]) => !note.deleted)
        .map(([date]) => date)
        .filter((date) => date.slice(-4) === String(year));
    },

    sync,

    getSyncStatus(): SyncStatus {
      return syncStatus;
    },

    onSyncStatusChange(callback: (status: SyncStatus) => void): () => void {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
  };
}
