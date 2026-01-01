import { useCallback, useEffect, useState } from 'react';
import type { UseAuthReturn } from './useAuth';
import { useLocalVault } from './useLocalVault';
import { useVault } from './useVault';
import { AppMode } from './useAppMode';
import { tryUnlockWithDeviceDEK } from '../storage/vault';
import { cacheCloudDek, restoreCloudDek } from '../storage/cloudCache';

interface UseActiveVaultProps {
  auth: UseAuthReturn;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

export interface UseActiveVaultReturn {
  auth: UseAuthReturn;
  localVault: ReturnType<typeof useLocalVault>;
  cloudVault: ReturnType<typeof useVault>;
  authPassword: string | null;
  localPassword: string | null;
  cachedCloudVaultKey: CryptoKey | null;
  vaultKey: CryptoKey | null;
  isVaultReady: boolean;
  isVaultLocked: boolean;
  isVaultUnlocked: boolean;
  vaultError: string | null;
  handleLocalUnlock: (password: string) => Promise<boolean>;
  handleSignIn: (email: string, password: string) => Promise<void>;
  handleSignUp: (email: string, password: string) => Promise<void>;
  handleSignOut: () => Promise<void>;
  setLocalPassword: (password: string | null) => void;
}

export function useActiveVault({ auth, mode, setMode }: UseActiveVaultProps): UseActiveVaultReturn {
  const localVault = useLocalVault();
  const [authPassword, setAuthPassword] = useState<string | null>(null);
  const [localPassword, setLocalPassword] = useState<string | null>(null);
  const [restoredCloudVaultKey, setRestoredCloudVaultKey] = useState<CryptoKey | null>(null);

  const handlePasswordConsumed = useCallback(() => {
    setAuthPassword(null);
  }, []);

  const cloudVault = useVault({
    user: mode === AppMode.Cloud ? auth.user : null,
    password: authPassword,
    localDek: localVault.vaultKey,
    onPasswordConsumed: handlePasswordConsumed
  });

  const cachedCloudVaultKey = cloudVault.vaultKey ?? restoredCloudVaultKey;

  useEffect(() => {
    if (cloudVault.vaultKey || restoredCloudVaultKey) return;
    let cancelled = false;

    const restoreCloudKey = async () => {
      const dek = await tryUnlockWithDeviceDEK();
      if (!cancelled && dek) {
        setRestoredCloudVaultKey(dek);
        return;
      }
      if (cancelled || !localVault.vaultKey) return;
      const restored = await restoreCloudDek(localVault.vaultKey);
      if (!cancelled && restored) {
        setRestoredCloudVaultKey(restored);
      }
    };

    void restoreCloudKey();

    return () => {
      cancelled = true;
    };
  }, [cloudVault.vaultKey, localVault.vaultKey, restoredCloudVaultKey]);

  useEffect(() => {
    if (!cloudVault.vaultKey || !localVault.vaultKey) return;
    void cacheCloudDek(localVault.vaultKey, cloudVault.vaultKey);
  }, [cloudVault.vaultKey, localVault.vaultKey]);

  const vaultKey = mode === AppMode.Cloud ? cloudVault.vaultKey : localVault.vaultKey;
  const isVaultReady = mode === AppMode.Cloud ? cloudVault.isReady : localVault.isReady;
  const isVaultLocked = mode === AppMode.Cloud ? cloudVault.isLocked : localVault.isLocked;
  const vaultError = mode === AppMode.Cloud ? cloudVault.error : localVault.error;
  const isVaultUnlocked = !isVaultLocked && isVaultReady;

  const handleLocalUnlock = useCallback(async (password: string) => {
    const success = await localVault.unlock(password);
    if (success) {
      setLocalPassword(password);
    }
    return success;
  }, [localVault]);

  const handleSignIn = useCallback(async (email: string, password: string) => {
    const result = await auth.signIn(email, password);
    if (result.success && result.password) {
      setAuthPassword(result.password);
      setMode(AppMode.Cloud);
    }
  }, [auth, setMode]);

  const handleSignUp = useCallback(async (email: string, password: string) => {
    const result = await auth.signUp(email, password);
    if (result.success && result.password) {
      setAuthPassword(result.password);
      setMode(AppMode.Cloud);
    }
  }, [auth, setMode]);

  const handleSignOut = useCallback(async () => {
    await auth.signOut();
    setMode(AppMode.Local);
    setAuthPassword(null);
  }, [auth, setMode]);

  return {
    auth,
    localVault,
    cloudVault,
    authPassword,
    localPassword,
    cachedCloudVaultKey,
    vaultKey,
    isVaultReady,
    isVaultLocked,
    isVaultUnlocked,
    vaultError,
    handleLocalUnlock,
    handleSignIn,
    handleSignUp,
    handleSignOut,
    setLocalPassword
  };
}
