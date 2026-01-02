import type { ClipboardEvent, DragEvent, FormEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { sanitizeHtml } from '../../utils/sanitize';

interface ContentEditableOptions {
  content: string;
  isEditable: boolean;
  onChange: (content: string) => void;
  onUserInput?: () => void;
  onImageDrop?: (file: File) => Promise<string>; // Returns image ID
}

export function useContentEditable({
  content,
  isEditable,
  onChange,
  onUserInput,
  onImageDrop
}: ContentEditableOptions) {
  const editorRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((e: FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    const sanitized = sanitizeHtml(html);
    onChange(sanitized);
    onUserInput?.();
  }, [onChange, onUserInput]);

  const handlePaste = useCallback(async (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Check for image in clipboard first
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));

    if (imageItem && onImageDrop) {
      const file = imageItem.getAsFile();
      if (file) {
        try {
          // Insert placeholder
          const placeholder = '<img data-image-id="uploading" alt="Uploading..." />';
          document.execCommand('insertHTML', false, placeholder);
          onUserInput?.();

          // Upload image
          const imageId = await onImageDrop(file);

          // Replace placeholder with actual image
          if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            const updated = html.replace(
              '<img data-image-id="uploading" alt="Uploading...">',
              `<img data-image-id="${imageId}" alt="${file.name}" />`
            );
            editorRef.current.innerHTML = updated;
            const sanitized = sanitizeHtml(editorRef.current.innerHTML);
            onChange(sanitized);
          }
        } catch (error) {
          console.error('Failed to upload pasted image:', error);
          // Remove placeholder on error
          if (editorRef.current) {
            const html = editorRef.current.innerHTML;
            const updated = html.replace(
              '<img data-image-id="uploading" alt="Uploading...">',
              ''
            );
            editorRef.current.innerHTML = updated;
            onChange(sanitizeHtml(editorRef.current.innerHTML));
          }
        }
        return;
      }
    }

    // Fall back to text/HTML paste
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      const sanitized = sanitizeHtml(html);
      document.execCommand('insertHTML', false, sanitized);
    } else {
      document.execCommand('insertText', false, text);
    }
    onUserInput?.();
  }, [onUserInput, onImageDrop, onChange]);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    if (!isEditable || !onImageDrop) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Check if first file is an image
    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      // Insert placeholder at drop position
      const placeholder = '<img data-image-id="uploading" alt="Uploading..." />';
      document.execCommand('insertHTML', false, placeholder);
      onUserInput?.();

      // Upload image
      const imageId = await onImageDrop(file);

      // Replace placeholder with actual image
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        const updated = html.replace(
          '<img data-image-id="uploading" alt="Uploading...">',
          `<img data-image-id="${imageId}" alt="${file.name}" />`
        );
        editorRef.current.innerHTML = updated;
        const sanitized = sanitizeHtml(editorRef.current.innerHTML);
        onChange(sanitized);
      }
    } catch (error) {
      console.error('Failed to upload dropped image:', error);
      // Remove placeholder on error
      if (editorRef.current) {
        const html = editorRef.current.innerHTML;
        const updated = html.replace(
          '<img data-image-id="uploading" alt="Uploading...">',
          ''
        );
        editorRef.current.innerHTML = updated;
        onChange(sanitizeHtml(editorRef.current.innerHTML));
      }
    }
  }, [isEditable, onImageDrop, onUserInput, onChange]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isEditable || !onImageDrop) return;

    // Check if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, [isEditable, onImageDrop]);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  useEffect(() => {
    if (isEditable && editorRef.current) {
      editorRef.current.focus();

      const range = document.createRange();
      const selection = window.getSelection();

      if (editorRef.current.childNodes.length > 0) {
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isEditable]);

  return { editorRef, handleInput, handlePaste, handleDrop, handleDragOver };
}
