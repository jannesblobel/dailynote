import { useState, useEffect } from 'react';
import type { ImageRepository } from '../storage/imageRepository';
import { compressImage } from '../utils/imageCompression';

export interface UseNoteImagesResult {
  backgroundImage: string | null;
  uploadBackground: (file: File) => Promise<void>;
  removeBackground: () => Promise<void>;
  uploadInline: (file: File) => Promise<string>;
  isUploading: boolean;
  error: string | null;
}

/**
 * Hook for managing images associated with a note
 * Handles background image state and provides methods for uploading inline images
 *
 * @param date - The note date (DD-MM-YYYY) or null if no note selected
 * @param repository - The image repository to use (local or cloud)
 * @param backgroundImageId - The current background image ID from the note
 * @param onBackgroundChange - Callback when background image changes
 * @returns Image management state and methods
 */
export function useNoteImages(
  date: string | null,
  repository: ImageRepository | null,
  backgroundImageId: string | undefined,
  onBackgroundChange: (imageId: string | undefined) => void
): UseNoteImagesResult {
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load background image URL when backgroundImageId changes
  useEffect(() => {
    if (!backgroundImageId || !repository) {
      setBackgroundImage(null);
      return;
    }

    let mounted = true;

    repository.getUrl(backgroundImageId)
      .then(url => {
        if (mounted) {
          setBackgroundImage(url);
        }
      })
      .catch(err => {
        console.error('Failed to load background image:', err);
        if (mounted) {
          setBackgroundImage(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, [backgroundImageId, repository]);

  /**
   * Upload a background image
   */
  const uploadBackground = async (file: File): Promise<void> => {
    if (!date || !repository) {
      throw new Error('Cannot upload image: no date or repository');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    setIsUploading(true);
    setError(null);

    try {
      // Compress image if needed
      const compressed = await compressImage(file);

      // Upload to repository
      const meta = await repository.upload(
        date,
        compressed.blob,
        'background',
        file.name
      );

      // Update metadata with dimensions
      meta.width = compressed.width;
      meta.height = compressed.height;

      // Notify parent of new background image ID
      onBackgroundChange(meta.id);

      // Get URL for display
      const url = await repository.getUrl(meta.id);
      setBackgroundImage(url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Remove the background image
   */
  const removeBackground = async (): Promise<void> => {
    if (!backgroundImageId || !repository) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Delete from repository
      await repository.delete(backgroundImageId);

      // Clear state
      setBackgroundImage(null);
      onBackgroundChange(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove image';
      setError(message);
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  /**
   * Upload an inline image and return its ID
   */
  const uploadInline = async (file: File): Promise<string> => {
    if (!date || !repository) {
      throw new Error('Cannot upload image: no date or repository');
    }

    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    setError(null);

    try {
      // Compress image if needed
      const compressed = await compressImage(file);

      // Upload to repository
      const meta = await repository.upload(
        date,
        compressed.blob,
        'inline',
        file.name
      );

      // Update metadata with dimensions
      meta.width = compressed.width;
      meta.height = compressed.height;

      return meta.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload image';
      setError(message);
      throw err;
    }
  };

  return {
    backgroundImage,
    uploadBackground,
    removeBackground,
    uploadInline,
    isUploading,
    error
  };
}
