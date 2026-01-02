import type { ImageRepository } from '../storage/imageRepository';

/**
 * Resolves image IDs to actual URLs and sets src attributes
 * Finds all <img data-image-id="..."> elements and resolves their URLs
 * based on the current storage mode (local blob URLs or Supabase signed URLs)
 *
 * @param contentEl - The HTML element containing images to resolve
 * @param repository - The image repository to fetch URLs from
 */
export async function resolveImageUrls(
  contentEl: HTMLElement,
  repository: ImageRepository | null
): Promise<void> {
  if (!repository) {
    return;
  }

  // Find all images with data-image-id attribute
  const images = contentEl.querySelectorAll('img[data-image-id]');

  // Resolve URLs in parallel
  await Promise.all(
    Array.from(images).map(async (img) => {
      const imageId = img.getAttribute('data-image-id');

      if (!imageId) {
        return;
      }
      if (imageId === 'uploading') {
        return;
      }

      try {
        const url = await repository.getUrl(imageId);

        if (url) {
          img.setAttribute('src', url);
        } else {
          // Image not found - show placeholder or remove
          console.warn(`Image not found: ${imageId}`);
          img.setAttribute('alt', 'Image not found');
        }
      } catch (error) {
        console.error(`Failed to resolve image ${imageId}:`, error);
        img.setAttribute('alt', 'Failed to load image');
      }
    })
  );
}

/**
 * Cleanup blob URLs to prevent memory leaks
 * Should be called when unmounting components or switching notes
 *
 * @param contentEl - The HTML element containing images to cleanup
 */
export function revokeImageUrls(contentEl: HTMLElement): void {
  const images = contentEl.querySelectorAll('img[src^="blob:"]');

  images.forEach((img) => {
    const src = img.getAttribute('src');
    if (src && src.startsWith('blob:')) {
      URL.revokeObjectURL(src);
      img.removeAttribute('src');
    }
  });
}
