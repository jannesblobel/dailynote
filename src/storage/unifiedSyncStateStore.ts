import {
  SYNC_STATE_STORE,
  openUnifiedDb,
  type SyncStateRecord,
} from "./unifiedDb";

const STATE_ID: SyncStateRecord["id"] = "state";

export async function getSyncState(): Promise<SyncStateRecord> {
  const db = await openUnifiedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STATE_STORE, "readonly");
    const store = tx.objectStore(SYNC_STATE_STORE);
    const request = store.get(STATE_ID);
    request.onsuccess = () => {
      resolve(
        (request.result as SyncStateRecord) ?? { id: STATE_ID, cursor: null },
      );
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function setSyncState(state: SyncStateRecord): Promise<void> {
  const db = await openUnifiedDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STATE_STORE, "readwrite");
    tx.objectStore(SYNC_STATE_STORE).put(state);
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
