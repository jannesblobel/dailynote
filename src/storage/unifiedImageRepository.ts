import type { NoteImage } from '../types';
import type { ImageRepository } from './imageRepository';
import { deriveImageKey, decryptImageBuffer, encryptImageBuffer } from './unifiedImageCrypto';
import type { ImageMetaRecord, ImageRecord } from './unifiedDb';
import type { KeyringProvider } from './unifiedNoteRepository';
import {
  deleteImageRecord,
  deleteImageRecords,
  deleteImagesByDate,
  getImageMeta,
  getImageRecord,
  getMetaByDate,
  setImageMeta,
  storeImageAndMeta
} from './unifiedImageStore';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function computeSha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(buffer));
  return bytesToHex(new Uint8Array(digest));
}

async function encryptImageBlob(
  imageKey: CryptoKey,
  blob: Blob
): Promise<{ record: ImageRecord; sha256: string; size: number }> {
  const buffer = await (blob.arrayBuffer ? blob.arrayBuffer() : blobToArrayBuffer(blob));
  const bytes = new Uint8Array(buffer);
  const sha256 = await computeSha256Hex(buffer);
  const { ciphertext, nonce } = await encryptImageBuffer(imageKey, bytes);
  return {
    record: {
      version: 1,
      id: '',
      keyId: '',
      ciphertext,
      nonce
    },
    sha256,
    size: buffer.byteLength
  };
}

async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error('Unexpected FileReader result'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

async function decryptImagePayload(
  imageKey: CryptoKey,
  record: ImageRecord,
  mimeType: string
): Promise<Blob> {
  const decrypted = await decryptImageBuffer(
    imageKey,
    record.ciphertext,
    record.nonce
  );
  return new Blob([decrypted], { type: mimeType });
}

function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}


export function createUnifiedImageRepository(
  keyring: KeyringProvider
): ImageRepository {
  const imageKeyCache = new Map<string, Promise<CryptoKey>>();

  const getImageKey = async (keyId: string) => {
    const baseKey = keyring.getKey(keyId);
    if (!baseKey) return null;
    if (!imageKeyCache.has(keyId)) {
      imageKeyCache.set(keyId, deriveImageKey(baseKey));
    }
    return imageKeyCache.get(keyId)!;
  };

  return {
    async upload(
      noteDate: string,
      file: Blob,
      type: 'background' | 'inline',
      filename: string,
      options?: { width?: number; height?: number }
    ): Promise<NoteImage> {
      const imageId = generateUuid();
      const imageKey = await getImageKey(keyring.activeKeyId);
      if (!imageKey) {
        throw new Error('Image key unavailable');
      }
      const { record, sha256, size } = await encryptImageBlob(imageKey, file);

      const meta: ImageMetaRecord = {
        id: imageId,
        noteDate,
        type,
        filename,
        mimeType: file.type || 'application/octet-stream',
        width: options?.width ?? 0,
        height: options?.height ?? 0,
        size,
        createdAt: new Date().toISOString(),
        sha256,
        keyId: keyring.activeKeyId,
        pendingOp: 'upload'
      };

      await storeImageAndMeta(
        {
          ...record,
          id: imageId,
          keyId: keyring.activeKeyId
        },
        meta
      );

      return {
        id: imageId,
        noteDate: meta.noteDate,
        type: meta.type,
        filename: meta.filename,
        mimeType: meta.mimeType,
        width: meta.width,
        height: meta.height,
        size: meta.size,
        createdAt: meta.createdAt
      };
    },

    async get(imageId: string): Promise<Blob | null> {
      try {
        const record = await getImageRecord(imageId);
        const meta = await getImageMeta(imageId);
        if (!record || !meta || record.version !== 1) {
          return null;
        }
        const imageKey = await getImageKey(meta.keyId ?? keyring.activeKeyId);
        if (!imageKey) return null;
        return await decryptImagePayload(imageKey, record, meta.mimeType);
      } catch {
        return null;
      }
    },

    async getUrl(_imageId: string): Promise<string | null> {
      void _imageId;
      return null;
    },

    async delete(imageId: string): Promise<void> {
      const meta = await getImageMeta(imageId);
      if (meta) {
        await setImageMeta({
          ...meta,
          pendingOp: 'delete'
        });
        await deleteImageRecord(imageId);
        return;
      }

      await deleteImageRecords(imageId);
    },

    async getByNoteDate(noteDate: string): Promise<NoteImage[]> {
      const metas = await getMetaByDate(noteDate);
      return metas
        .filter((meta) => meta.pendingOp !== 'delete')
        .map((meta) => ({
          id: meta.id,
          noteDate: meta.noteDate,
          type: meta.type,
          filename: meta.filename,
          mimeType: meta.mimeType,
          width: meta.width,
          height: meta.height,
          size: meta.size,
          createdAt: meta.createdAt
        }));
    },

    async deleteByNoteDate(noteDate: string): Promise<void> {
      const metas = await getMetaByDate(noteDate);

      if (!metas.length) {
        await deleteImagesByDate(noteDate);
        return;
      }

      await Promise.all(
        metas.map(async (meta) => {
          await setImageMeta({
            ...meta,
            pendingOp: 'delete'
          });
          await deleteImageRecord(meta.id);
        })
      );
    }
  };
}
