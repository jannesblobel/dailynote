import { base64ToBytes, bytesToBase64, randomBytes } from './cryptoUtils';

const IMAGE_IV_BYTES = 12;
const IMAGE_KEY_INFO = 'dailynotes:image-key:v1';

export async function deriveImageKey(vaultKey: CryptoKey): Promise<CryptoKey> {
  const raw = await crypto.subtle.exportKey('raw', vaultKey);
  const baseKey = await crypto.subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
  const salt = new Uint8Array(16);
  const info = new TextEncoder().encode(IMAGE_KEY_INFO);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptImageBuffer(
  imageKey: CryptoKey,
  buffer: ArrayBuffer | Uint8Array
): Promise<{ ciphertext: string; nonce: string }> {
  const iv = randomBytes(IMAGE_IV_BYTES);
  const source = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    imageKey,
    source as unknown as BufferSource
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    nonce: bytesToBase64(iv)
  };
}

export async function decryptImageBuffer(
  imageKey: CryptoKey,
  ciphertext: string,
  nonce: string
): Promise<ArrayBuffer> {
  const iv = base64ToBytes(nonce);
  const data = base64ToBytes(ciphertext);
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    imageKey,
    data
  );
}
