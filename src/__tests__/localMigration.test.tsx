import { render } from "@testing-library/react";
import { waitFor } from "@testing-library/dom";
import { useLocalMigration } from "../hooks/useLocalMigration";
import { createEncryptedNoteRepository } from "../storage/noteStorage";
import type { SyncedNoteRepository } from "../storage/syncedNoteRepository";

async function clearNotesDb(): Promise<void> {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase("dailynotes-notes");
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function createVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

type MigrationOptions = Parameters<typeof useLocalMigration>[0];

function MigrationHarness(props: MigrationOptions) {
  useLocalMigration(props);
  return null;
}

describe("useLocalMigration", () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearNotesDb();
  });

  it("migrates local notes into the cloud repo and sets the migration flag", async () => {
    const localKey = await createVaultKey();
    const cloudKey = await createVaultKey();

    const localRepo = createEncryptedNoteRepository(localKey);
    await localRepo.save("2024-05-10", "<b>Local</b>");

    const cloudRepo = {
      saveWithMetadata: jest.fn(),
    } as unknown as SyncedNoteRepository;

    const onMigrated = jest.fn();
    const triggerSync = jest.fn();

    const props: MigrationOptions = {
      mode: "cloud",
      cloudRepo,
      cloudKey,
      localKey,
      hasMigrated: false,
      onMigrated,
      triggerSync,
    };

    render(<MigrationHarness {...props} />);

    await waitFor(() => {
      expect(cloudRepo.saveWithMetadata).toHaveBeenCalledTimes(1);
    });

    expect(cloudRepo.saveWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2024-05-10",
        content: "<b>Local</b>",
        revision: 1,
        deleted: false,
      }),
    );
    expect(onMigrated).toHaveBeenCalledTimes(1);
    expect(triggerSync).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("dailynote_local_migrated_v1")).toBe("1");
  });
});
