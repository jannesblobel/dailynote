import { STORAGE_PREFIX } from '../utils/constants';
import { base64ToBytes, bytesToBase64, encodeUtf8 } from './cryptoUtils';

const VAULT_META_KEY = `${STORAGE_PREFIX}vault_meta_v1`;
const DB_NAME = 'dailynotes-vault';
const STORE_NAME = 'keys';
const DEVICE_KEY_ID = 'device';
const KDF_ITERATIONS = 210000;
const WRAP_IV_BYTES = 12;

export interface VaultMeta {
  version: 1;
  kdf: {
    salt: string;
    iterations: number;
  };
  wrapped: {
    password: { iv: string; data: string };
    device?: { iv: string; data: string };
  };
}

export function hasVaultMeta(): boolean {
  return !!localStorage.getItem(VAULT_META_KEY);
}

export function loadVaultMeta(): VaultMeta | null {
  const raw = localStorage.getItem(VAULT_META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as VaultMeta;
    if (!parsed || parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveVaultMeta(meta: VaultMeta): void {
  localStorage.setItem(VAULT_META_KEY, JSON.stringify(meta));
}

function openDeviceKeyDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getDeviceKey(): Promise<CryptoKey | null> {
  const db = await openDeviceKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(DEVICE_KEY_ID);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function setDeviceKey(key: CryptoKey): Promise<void> {
  const db = await openDeviceKeyDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(key, DEVICE_KEY_ID);
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

async function getOrCreateDeviceKey(): Promise<CryptoKey> {
  const existing = await getDeviceKey();
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
  await setDeviceKey(key);
  return key;
}

async function derivePasswordKey(
  password: string,
  salt: Uint8Array,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encodeUtf8(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

async function wrapVaultKey(
  vaultKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ iv: string; data: string }> {
  const iv = randomBytes(WRAP_IV_BYTES);
  const wrapped = await crypto.subtle.wrapKey(
    'raw',
    vaultKey,
    wrappingKey,
    { name: 'AES-GCM', iv }
  );
  return {
    iv: bytesToBase64(iv),
    data: bytesToBase64(new Uint8Array(wrapped))
  };
}

async function unwrapVaultKey(
  wrapped: { iv: string; data: string },
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const iv = base64ToBytes(wrapped.iv);
  const data = base64ToBytes(wrapped.data);
  return crypto.subtle.unwrapKey(
    'raw',
    data,
    wrappingKey,
    { name: 'AES-GCM', iv },
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function createVault(password: string): Promise<CryptoKey> {
  const salt = randomBytes(16);
  const passwordKey = await derivePasswordKey(password, salt, KDF_ITERATIONS);
  const vaultKey = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const passwordWrapped = await wrapVaultKey(vaultKey, passwordKey);
  let deviceWrapped: VaultMeta['wrapped']['device'];
  try {
    const deviceKey = await getOrCreateDeviceKey();
    deviceWrapped = await wrapVaultKey(vaultKey, deviceKey);
  } catch {
    deviceWrapped = undefined;
  }

  const meta: VaultMeta = {
    version: 1,
    kdf: {
      salt: bytesToBase64(salt),
      iterations: KDF_ITERATIONS
    },
    wrapped: {
      password: passwordWrapped,
      ...(deviceWrapped ? { device: deviceWrapped } : {})
    }
  };

  saveVaultMeta(meta);
  return vaultKey;
}

export async function unlockWithPassword(password: string): Promise<CryptoKey> {
  const meta = loadVaultMeta();
  if (!meta) {
    throw new Error('Vault not initialized');
  }
  const salt = base64ToBytes(meta.kdf.salt);
  const passwordKey = await derivePasswordKey(
    password,
    salt,
    meta.kdf.iterations
  );
  return unwrapVaultKey(meta.wrapped.password, passwordKey);
}

export async function tryUnlockWithDeviceKey(): Promise<CryptoKey | null> {
  const meta = loadVaultMeta();
  if (!meta?.wrapped.device) return null;
  const deviceKey = await getDeviceKey();
  if (!deviceKey) return null;
  try {
    return await unwrapVaultKey(meta.wrapped.device, deviceKey);
  } catch {
    return null;
  }
}

export async function ensureDeviceWrappedKey(vaultKey: CryptoKey): Promise<void> {
  const meta = loadVaultMeta();
  if (!meta) return;
  try {
    const deviceKey = await getOrCreateDeviceKey();
    const deviceWrapped = await wrapVaultKey(vaultKey, deviceKey);
    const nextMeta: VaultMeta = {
      ...meta,
      wrapped: {
        ...meta.wrapped,
        device: deviceWrapped
      }
    };
    saveVaultMeta(nextMeta);
  } catch {
    // Device key not available; keep password-only unlock.
  }
}
