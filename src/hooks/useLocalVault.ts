import { useCallback, useEffect, useState } from 'react';
import {
  hasVaultMeta,
  createVault,
  createRandomVault,
  unlockWithPassword,
  tryUnlockWithDeviceKey,
  ensureDeviceWrappedKey
} from '../storage/vault';

interface UseLocalVaultReturn {
  vaultKey: CryptoKey | null;
  isReady: boolean;
  isLocked: boolean;
  hasVault: boolean;
  requiresPassword: boolean;
  isBusy: boolean;
  error: string | null;
  unlock: (password: string) => Promise<boolean>;
}

export function useLocalVault(): UseLocalVaultReturn {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasVault, setHasVault] = useState(hasVaultMeta());
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const existing = hasVaultMeta();
      if (!cancelled) {
        setHasVault(existing);
      }

      if (!existing) {
        try {
          const key = await createRandomVault();
          if (!cancelled) {
            setVaultKey(key);
            setHasVault(true);
            setRequiresPassword(false);
          }
        } catch {
          if (!cancelled) {
            setError('Unable to initialize local vault.');
          }
        }
        if (!cancelled) {
          setIsReady(true);
        }
        return;
      }

      // Try device key unlock
      const unlocked = await tryUnlockWithDeviceKey();
      if (!cancelled) {
        if (unlocked) {
          setVaultKey(unlocked);
          setRequiresPassword(false);
        } else {
          setRequiresPassword(true);
        }
        setIsReady(true);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (!password.trim()) {
      setError('Please enter a password.');
      return false;
    }

    setIsBusy(true);
    setError(null);

    try {
      let key: CryptoKey;
      if (hasVault) {
        key = await unlockWithPassword(password);
      } else {
        key = await createVault(password);
        setHasVault(true);
      }
      await ensureDeviceWrappedKey(key);
      setVaultKey(key);
      setRequiresPassword(false);
      return true;
    } catch {
      setError('Unable to unlock. Check your password and try again.');
      return false;
    } finally {
      setIsBusy(false);
      setIsReady(true);
    }
  }, [hasVault]);

  return {
    vaultKey,
    isReady,
    isLocked: !vaultKey,
    hasVault,
    requiresPassword,
    isBusy,
    error,
    unlock
  };
}
