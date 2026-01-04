import { useEffect, useState } from "react";
import { createEncryptedNoteRepository } from "../storage/noteStorage";
import type { SyncedNoteRepository } from "../storage/syncedNoteRepository";
import { STORAGE_PREFIX } from "../utils/constants";
import { AppMode } from "../utils/appMode";

const LOCAL_MIGRATION_KEY = `${STORAGE_PREFIX}local_migrated_v1`;

const getMigrationFlag = () =>
  typeof window !== "undefined" &&
  localStorage.getItem(LOCAL_MIGRATION_KEY) === "1";

const setMigrationFlag = () => {
  if (typeof window !== "undefined") {
    localStorage.setItem(LOCAL_MIGRATION_KEY, "1");
  }
};

interface UseLocalMigrationOptions {
  mode: AppMode;
  cloudRepo: SyncedNoteRepository | null;
  cloudKey: CryptoKey | null;
  localKey: CryptoKey | null;
  hasMigrated: boolean;
  onMigrated: () => void;
  triggerSync: (options?: { immediate?: boolean }) => void;
}

interface UseLocalMigrationReturn {
  isMigrating: boolean;
  error: Error | null;
}

export function useLocalMigration({
  mode,
  cloudRepo,
  cloudKey,
  localKey,
  hasMigrated,
  onMigrated,
  triggerSync,
}: UseLocalMigrationOptions): UseLocalMigrationReturn {
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!hasMigrated && getMigrationFlag()) {
      onMigrated();
    }
  }, [hasMigrated, onMigrated]);

  useEffect(() => {
    if (
      mode !== AppMode.Cloud ||
      !cloudRepo ||
      !cloudKey ||
      !localKey ||
      hasMigrated ||
      getMigrationFlag()
    ) {
      return;
    }

    let cancelled = false;

    const migrateLocalNotes = async () => {
      setIsMigrating(true);
      setError(null);

      try {
        const localRepository = createEncryptedNoteRepository(localKey);
        const localDates = await localRepository.getAllDates();
        if (!localDates.length) {
          if (!cancelled) {
            setMigrationFlag();
            onMigrated();
          }
          return;
        }

        for (const localDate of localDates) {
          const note = await localRepository.get(localDate);
          if (note?.content) {
            await cloudRepo.saveWithMetadata({
              date: note.date,
              content: note.content,
              updatedAt: note.updatedAt,
              revision: 1,
              deleted: false,
            });
          }
        }

        if (!cancelled) {
          setMigrationFlag();
          onMigrated();
          triggerSync();
        }
      } catch (caught) {
        if (!cancelled) {
          const error =
            caught instanceof Error
              ? caught
              : new Error("Failed to migrate local notes.");
          setError(error);
        }
        console.error("Local migration error:", caught);
      } finally {
        if (!cancelled) {
          setIsMigrating(false);
        }
      }
    };

    void migrateLocalNotes();

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    cloudRepo,
    cloudKey,
    localKey,
    hasMigrated,
    onMigrated,
    triggerSync,
  ]);

  return { isMigrating, error };
}
