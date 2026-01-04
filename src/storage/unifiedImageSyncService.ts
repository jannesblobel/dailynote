import type { SupabaseClient } from "@supabase/supabase-js";
import { base64ToBytes } from "./cryptoUtils";
import {
  deleteImageRecords,
  getAllImageMeta,
  getImageRecord,
  storeImageAndMeta,
} from "./unifiedImageStore";
import type { ImageMetaRecord, ImageRecord } from "./unifiedDb";

const IMAGE_BUCKET = "note-images";

function buildStoragePath(
  userId: string,
  noteDate: string,
  imageId: string,
  suffix: string,
): string {
  return `${userId}/${noteDate}/${imageId}${suffix}`;
}

function cipherRecordToBlob(record: ImageRecord): Blob {
  const bytes = base64ToBytes(record.ciphertext);
  return new Blob([bytes], { type: "application/octet-stream" });
}

async function upsertImageMetadata(
  supabase: SupabaseClient,
  userId: string,
  meta: ImageMetaRecord,
  record: ImageRecord,
  ciphertextPath: string,
): Promise<{ serverUpdatedAt: string }> {
  const payload = {
    id: meta.id,
    user_id: userId,
    note_date: meta.noteDate,
    type: meta.type,
    filename: meta.filename,
    mime_type: meta.mimeType,
    width: meta.width,
    height: meta.height,
    size: meta.size,
    ciphertext_path: ciphertextPath,
    storage_path: ciphertextPath,
    sha256: meta.sha256,
    nonce: record.nonce,
    key_id: meta.keyId ?? "legacy",
    deleted: false,
  };

  const { data, error } = await supabase
    .from("note_images")
    .upsert(payload)
    .select("server_updated_at")
    .single();

  if (error) throw error;
  return {
    serverUpdatedAt: String(
      (data as { server_updated_at: string }).server_updated_at,
    ),
  };
}

async function markImageDeleted(
  supabase: SupabaseClient,
  imageId: string,
): Promise<void> {
  const { error } = await supabase
    .from("note_images")
    .update({ deleted: true })
    .eq("id", imageId);

  if (error) throw error;
}

export async function syncEncryptedImages(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const metas = await getAllImageMeta();

  for (const meta of metas) {
    if (!meta.pendingOp) continue;

    if (meta.pendingOp === "delete") {
      if (meta.remotePath) {
        await supabase.storage.from(IMAGE_BUCKET).remove([meta.remotePath]);
      }
      await markImageDeleted(supabase, meta.id);
      await deleteImageRecords(meta.id);
      continue;
    }

    const record = await getImageRecord(meta.id);
    if (!record) continue;

    const ciphertextPath = buildStoragePath(
      userId,
      meta.noteDate,
      meta.id,
      ".enc",
    );
    const blob = cipherRecordToBlob(record);

    const { error: uploadError } = await supabase.storage
      .from(IMAGE_BUCKET)
      .upload(ciphertextPath, blob, {
        upsert: true,
        contentType: "application/octet-stream",
      });

    if (uploadError) throw uploadError;

    const { serverUpdatedAt } = await upsertImageMetadata(
      supabase,
      userId,
      meta,
      record,
      ciphertextPath,
    );

    await storeImageAndMeta(record, {
      ...meta,
      remotePath: ciphertextPath,
      serverUpdatedAt,
      pendingOp: null,
    });
  }
}
