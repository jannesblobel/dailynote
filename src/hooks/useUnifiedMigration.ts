import { useEffect, useState } from "react";
import { AppMode } from "./useAppMode";
import { migrateLegacyData } from "../storage/unifiedMigration";

interface UseUnifiedMigrationOptions {
  mode: AppMode;
  targetKey: CryptoKey | null;
  localKey: CryptoKey | null;
  cloudKey: CryptoKey | null;
  triggerSync: (options?: { immediate?: boolean }) => void;
}

interface UseUnifiedMigrationReturn {
  isMigrating: boolean;
  error: Error | null;
}

export function useUnifiedMigration({
  mode,
  targetKey,
  localKey,
  cloudKey,
  triggerSync,
}: UseUnifiedMigrationOptions): UseUnifiedMigrationReturn {
  const [isMigrating, setIsMigrating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!targetKey || isMigrating) return;
    let cancelled = false;

    const runMigration = async () => {
      setIsMigrating(true);
      setError(null);

      try {
        const migrated = await migrateLegacyData({
          targetKey,
          localKey,
          cloudKey,
        });

        if (!cancelled && migrated && mode === AppMode.Cloud) {
          triggerSync();
        }
      } catch (caught) {
        if (!cancelled) {
          const error =
            caught instanceof Error
              ? caught
              : new Error("Failed to migrate legacy data.");
          setError(error);
        }
        console.error("Unified migration error:", caught);
      } finally {
        if (!cancelled) {
          setIsMigrating(false);
        }
      }
    };

    void runMigration();

    return () => {
      cancelled = true;
    };
  }, [targetKey, localKey, cloudKey, mode, triggerSync, isMigrating]);

  return { isMigrating, error };
}
