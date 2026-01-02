import DOMPurify from 'dompurify';

/**
 * Configuration for DOMPurify
 * Allows basic formatting tags and images with data-image-id
 */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'u', 's', 'strike', 'del',
    'br', 'p', 'div', 'span', 'img'
  ],
  ALLOWED_ATTR: ['data-image-id', 'alt', 'width', 'height'], // Image attributes (src set dynamically)
  KEEP_CONTENT: true, // Keep text content even if tags are stripped
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
};

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Allows only basic text formatting tags
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  const result = DOMPurify.sanitize(html, SANITIZE_CONFIG);
  return typeof result === 'string' ? result : '';
}

/**
 * Checks if content is empty (no text content)
 * Strips all HTML and checks if anything remains
 */
export function isContentEmpty(html: string): boolean {
  if (!html) return true;

  // Create a temporary div to extract text content
  const temp = document.createElement('div');
  temp.innerHTML = sanitizeHtml(html);

  return temp.textContent?.trim().length === 0;
}
