import { useCallback, useEffect, useState } from 'react';
import {
  createVault,
  ensureDeviceWrappedKey,
  hasVaultMeta,
  tryUnlockWithDeviceKey,
  unlockWithPassword
} from '../storage/vault';

interface UseVaultReturn {
  vaultKey: CryptoKey | null;
  isReady: boolean;
  isLocked: boolean;
  showPrepare: boolean;
  hasVault: boolean;
  isBusy: boolean;
  error: string | null;
  unlock: (password: string) => Promise<boolean>;
}

export function useVault(): UseVaultReturn {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasVault, setHasVault] = useState(hasVaultMeta());
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrepare, setShowPrepare] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const prepareTimer = window.setTimeout(() => {
        if (!cancelled) {
          setShowPrepare(true);
        }
      }, 100);
      const existing = hasVaultMeta();
      if (!cancelled) {
        setHasVault(existing);
      }
      if (!existing) {
        if (!cancelled) {
          setVaultKey(null);
          setIsReady(true);
        }
        window.clearTimeout(prepareTimer);
        return;
      }

      const unlocked = await tryUnlockWithDeviceKey();
      if (!cancelled) {
        if (unlocked) {
          setVaultKey(unlocked);
        }
        setIsReady(true);
      }
      window.clearTimeout(prepareTimer);
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
    showPrepare,
    hasVault,
    isBusy,
    error,
    unlock
  };
}
