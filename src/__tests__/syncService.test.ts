import {
  decryptNote,
  encryptNote,
  resolveConflict,
} from "../storage/syncService";
import type { SyncedNote } from "../types";

async function createVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

describe("syncService encryption", () => {
  it("round-trips encrypted notes and sanitizes content", async () => {
    const vaultKey = await createVaultKey();
    const note: SyncedNote = {
      id: "note-1",
      date: "2024-01-01",
      content: "<img src=x onerror=alert(1)>Hello",
      updatedAt: "2024-01-01T12:00:00.000Z",
      revision: 2,
      deleted: false,
    };

    const encrypted = await encryptNote(vaultKey, note);
    const decrypted = await decryptNote(vaultKey, {
      ...encrypted,
      id: note.id,
      date: note.date,
      revision: note.revision,
      updatedAt: note.updatedAt,
      deleted: note.deleted ?? false,
    });

    expect(decrypted).toEqual({
      id: note.id,
      date: note.date,
      content: "<img>Hello", // img tag allowed but dangerous attributes stripped
      updatedAt: note.updatedAt,
      revision: note.revision,
      deleted: note.deleted,
      serverUpdatedAt: undefined,
    });
  });
});

describe("resolveConflict", () => {
  it("prefers newer timestamps", () => {
    const base: SyncedNote = {
      date: "2024-01-01",
      content: "local",
      updatedAt: "2024-01-01T10:00:00.000Z",
      revision: 1,
      deleted: false,
    };

    const remote = {
      ...base,
      content: "remote",
      updatedAt: "2024-01-01T11:00:00.000Z",
    };

    expect(resolveConflict(base, remote)).toBe("remote");
  });

  it("breaks ties with revision", () => {
    const local: SyncedNote = {
      date: "2024-01-01",
      content: "local",
      updatedAt: "2024-01-01T10:00:00.000Z",
      revision: 2,
      deleted: false,
    };

    const remote: SyncedNote = {
      ...local,
      content: "remote",
      revision: 3,
    };

    expect(resolveConflict(local, remote)).toBe("remote");
  });
});
