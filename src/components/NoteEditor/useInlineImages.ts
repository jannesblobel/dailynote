import { useCallback, useEffect } from 'react';
import type { RefObject } from 'react';
import { useNoteRepositoryContext } from '../../contexts/noteRepositoryContext';
import { resolveImageUrls } from '../../utils/imageResolver';
import { compressImage } from '../../utils/imageCompression';

interface UseInlineImageUploadOptions {
  date: string;
  isEditable: boolean;
}

interface UseInlineImageUrlsOptions {
  content: string;
  editorRef: RefObject<HTMLDivElement | null>;
}

export function useInlineImageUpload({
  date,
  isEditable
}: UseInlineImageUploadOptions) {
  const { imageRepository } = useNoteRepositoryContext();

  const uploadInlineImage = useCallback(async (file: File): Promise<string> => {
    if (!imageRepository) {
      throw new Error('Image repository not available');
    }

    const compressed = await compressImage(file);

    const meta = await imageRepository.upload(
      date,
      compressed.blob,
      'inline',
      file.name
    );

    return meta.id;
  }, [imageRepository, date]);

  return {
    onImageDrop: isEditable && imageRepository ? uploadInlineImage : undefined
  };
}

export function useInlineImageUrls({
  content,
  editorRef
}: UseInlineImageUrlsOptions) {
  const { imageRepository } = useNoteRepositoryContext();

  useEffect(() => {
    if (editorRef.current && imageRepository) {
      resolveImageUrls(editorRef.current, imageRepository);
    }
  }, [content, imageRepository, editorRef]);
}
