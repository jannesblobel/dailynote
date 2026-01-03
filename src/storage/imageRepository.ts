import type { NoteImage } from '../types';

/**
 * Repository interface for managing note images
 * Supports both local (encrypted IndexedDB) and cloud (Supabase Storage) implementations
 */
export interface ImageRepository {
  /**
   * Upload an image and return metadata
   * @param noteDate - The date of the note this image belongs to (DD-MM-YYYY)
   * @param file - The image blob to upload
   * @param type - Whether this is a background or inline image
   * @param filename - Original filename
   * @param options - Optional metadata hints (dimensions are used for layout placeholders)
   * @returns Metadata for the uploaded image
   */
  upload(
    noteDate: string,
    file: Blob,
    type: 'background' | 'inline',
    filename: string,
    options?: { width?: number; height?: number }
  ): Promise<NoteImage>;

  /**
   * Get image blob by ID
   * @param imageId - UUID of the image
   * @returns Image blob or null if not found
   */
  get(imageId: string): Promise<Blob | null>;

  /**
   * Get a remote URL for rendering the image if supported
   * Returns signed URL for cloud-backed repositories, otherwise null
   * @param imageId - UUID of the image
   * @returns URL string or null if not found
   */
  getUrl(imageId: string): Promise<string | null>;

  /**
   * Delete an image by ID
   * @param imageId - UUID of the image
   */
  delete(imageId: string): Promise<void>;

  /**
   * Get all images for a specific note
   * @param noteDate - The date of the note (DD-MM-YYYY)
   * @returns Array of image metadata
   */
  getByNoteDate(noteDate: string): Promise<NoteImage[]>;

  /**
   * Delete all images associated with a note
   * Used for cleanup when a note is deleted
   * @param noteDate - The date of the note (DD-MM-YYYY)
   */
  deleteByNoteDate(noteDate: string): Promise<void>;
}
