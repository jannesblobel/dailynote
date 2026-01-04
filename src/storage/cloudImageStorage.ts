import type { SupabaseClient } from "@supabase/supabase-js";
import type { NoteImage } from "../types";
import type { ImageRepository } from "./imageRepository";

const BUCKET_NAME = "note-images";
const SIGNED_URL_EXPIRY = 60 * 60; // 1 hour in seconds

/**
 * Generate a UUID v4
 */
function generateUuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Get file extension from MIME type
 */
function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };

  return map[mimeType] || "jpg";
}

/**
 * Create cloud image repository using Supabase Storage
 * Images are stored unencrypted with RLS policies protecting access
 *
 * @param supabase - Supabase client
 * @param userId - The authenticated user ID
 * @returns ImageRepository implementation
 */
export function createCloudImageRepository(
  supabase: SupabaseClient,
  userId: string,
): ImageRepository {
  return {
    async upload(
      noteDate: string,
      file: Blob,
      type: "background" | "inline",
      filename: string,
      options?: { width?: number; height?: number },
    ): Promise<NoteImage> {
      const imageId = generateUuid();
      const ext = getExtension(file.type);
      const storagePath = `${userId}/${imageId}.${ext}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload image: ${uploadError.message}`);
      }

      // Create metadata entry
      const meta: NoteImage = {
        id: imageId,
        noteDate,
        type,
        filename,
        mimeType: file.type,
        width: options?.width ?? 0,
        height: options?.height ?? 0,
        size: file.size,
        createdAt: new Date().toISOString(),
      };

      const { error: metaError } = await supabase.from("note_images").insert({
        id: meta.id,
        user_id: userId,
        note_date: meta.noteDate,
        type: meta.type,
        filename: meta.filename,
        mime_type: meta.mimeType,
        width: meta.width,
        height: meta.height,
        size: meta.size,
        storage_path: storagePath,
      });

      if (metaError) {
        // Clean up uploaded file on metadata insert failure
        await supabase.storage.from(BUCKET_NAME).remove([storagePath]);
        throw new Error(`Failed to save image metadata: ${metaError.message}`);
      }

      return meta;
    },

    async get(imageId: string): Promise<Blob | null> {
      try {
        // Get metadata to find storage path
        const { data: meta, error: metaError } = await supabase
          .from("note_images")
          .select("storage_path, mime_type")
          .eq("id", imageId)
          .eq("user_id", userId)
          .single();

        if (metaError || !meta) {
          return null;
        }

        // Download from storage
        const { data, error: downloadError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(meta.storage_path);

        if (downloadError || !data) {
          return null;
        }

        return data;
      } catch {
        return null;
      }
    },

    async getUrl(imageId: string): Promise<string | null> {
      try {
        // Get metadata to find storage path
        const { data: meta, error: metaError } = await supabase
          .from("note_images")
          .select("storage_path")
          .eq("id", imageId)
          .eq("user_id", userId)
          .single();

        if (metaError || !meta) {
          return null;
        }

        // Create signed URL
        const { data, error: urlError } = await supabase.storage
          .from(BUCKET_NAME)
          .createSignedUrl(meta.storage_path, SIGNED_URL_EXPIRY);

        if (urlError || !data) {
          return null;
        }

        return data.signedUrl;
      } catch {
        return null;
      }
    },

    async delete(imageId: string): Promise<void> {
      // Get metadata to find storage path
      const { data: meta, error: metaError } = await supabase
        .from("note_images")
        .select("storage_path")
        .eq("id", imageId)
        .eq("user_id", userId)
        .single();

      if (metaError || !meta) {
        return; // Already deleted or doesn't exist
      }

      // Delete from storage
      await supabase.storage.from(BUCKET_NAME).remove([meta.storage_path]);

      // Delete metadata
      await supabase
        .from("note_images")
        .delete()
        .eq("id", imageId)
        .eq("user_id", userId);
    },

    async getByNoteDate(noteDate: string): Promise<NoteImage[]> {
      const { data, error } = await supabase
        .from("note_images")
        .select("*")
        .eq("user_id", userId)
        .eq("note_date", noteDate);

      if (error || !data) {
        return [];
      }

      return data.map((row) => ({
        id: row.id,
        noteDate: row.note_date,
        type: row.type,
        filename: row.filename,
        mimeType: row.mime_type,
        width: row.width || 0,
        height: row.height || 0,
        size: row.size || 0,
        createdAt: row.created_at,
      }));
    },

    async deleteByNoteDate(noteDate: string): Promise<void> {
      // Get all images for this note
      const images = await this.getByNoteDate(noteDate);

      // Delete each image
      await Promise.all(images.map((img) => this.delete(img.id)));
    },
  };
}
