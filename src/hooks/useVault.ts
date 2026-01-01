import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { fetchUserKeys, saveUserKeys } from '../storage/userKeys';
import type { UserKeys } from '../storage/userKeys';
import {
  deriveKEK,
  generateDEK,
  wrapDEK,
  unwrapDEK,
  generateSalt,
  DEFAULT_KDF_ITERATIONS,
  storeDeviceWrappedDEK,
  tryUnlockWithDeviceDEK,
  clearDeviceWrappedDEK,
  updatePasswordWrappedKey
} from '../storage/vault';

interface UseVaultReturn {
  vaultKey: CryptoKey | null;
  isReady: boolean;
  isLocked: boolean;
  isBusy: boolean;
  error: string | null;
}

interface UseVaultProps {
  user: User | null;
  password: string | null;
  localDek: CryptoKey | null;
  onPasswordConsumed: () => void;
}

export function useVault({
  user,
  password,
  localDek,
  onPasswordConsumed
}: UseVaultProps): UseVaultReturn {
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unlockingRef = useRef(false);

  // Try device unlock when user signs in
  useEffect(() => {
    if (!user) {
      setVaultKey(null);
      setIsReady(true);
      return;
    }

    let cancelled = false;

    const tryDeviceUnlock = async () => {
      const dek = await tryUnlockWithDeviceDEK();
      if (!cancelled && dek) {
        setVaultKey(dek);
      }
      if (!cancelled) {
        setIsReady(true);
      }
    };

    void tryDeviceUnlock();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Unlock with password when provided
  useEffect(() => {
    if (!user || !password || vaultKey || unlockingRef.current) {
      return;
    }

    unlockingRef.current = true;
    setIsBusy(true);
    setError(null);

    const unlock = async () => {
      try {
        // Fetch existing keys from Supabase
        const existingKeys = await fetchUserKeys(supabase, user.id);

        let dek: CryptoKey;

        if (existingKeys) {
          // Derive KEK from password and unwrap existing DEK
          const kek = await deriveKEK(
            password,
            existingKeys.kdfSalt,
            existingKeys.kdfIterations
          );
          dek = await unwrapDEK(existingKeys.wrappedDek, existingKeys.dekIv, kek);
        } else {
          // New user: generate DEK, wrap with password-derived KEK, save to Supabase
          const salt = generateSalt();
          const kek = await deriveKEK(password, salt, DEFAULT_KDF_ITERATIONS);
          dek = localDek ?? await generateDEK();
          const wrapped = await wrapDEK(dek, kek);

          const newKeys: UserKeys = {
            wrappedDek: wrapped.data,
            dekIv: wrapped.iv,
            kdfSalt: salt,
            kdfIterations: DEFAULT_KDF_ITERATIONS,
            version: 1
          };

          await saveUserKeys(supabase, user.id, newKeys);
          if (localDek) {
            await updatePasswordWrappedKey(localDek, password);
          }
        }

        // Store device-wrapped DEK for future auto-unlock
        await storeDeviceWrappedDEK(dek);

        setVaultKey(dek);
        setError(null);
      } catch (err) {
        console.error('Vault unlock error:', err);
        setError('Unable to unlock. Check your password and try again.');
      } finally {
        setIsBusy(false);
        setIsReady(true);
        unlockingRef.current = false;
        onPasswordConsumed();
      }
    };

    void unlock();
  }, [user, password, vaultKey, localDek, onPasswordConsumed]);

  // Clear vault on sign out
  const clearVault = useCallback(async () => {
    setVaultKey(null);
    await clearDeviceWrappedDEK();
  }, []);

  // Listen for sign out
  useEffect(() => {
    if (!user && vaultKey) {
      void clearVault();
    }
  }, [user, vaultKey, clearVault]);

  return {
    vaultKey,
    isReady,
    isLocked: !vaultKey,
    isBusy,
    error
  };
}
