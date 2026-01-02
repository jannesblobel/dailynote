import type { ClipboardEvent, DragEvent, FormEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { sanitizeHtml } from '../../utils/sanitize';

interface ContentEditableOptions {
  content: string;
  isEditable: boolean;
  onChange: (content: string) => void;
  onUserInput?: () => void;
  onImageDrop?: (file: File) => Promise<string>; // Returns image ID
  isDraggingImage?: boolean;
  onDropComplete?: () => void;
}

function getCaretRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => {
      offsetNode: Node;
      offset: number;
    } | null;
  };

  if (doc.caretRangeFromPoint) {
    return doc.caretRangeFromPoint(x, y);
  }

  if (doc.caretPositionFromPoint) {
    const position = doc.caretPositionFromPoint(x, y);
    if (!position) return null;
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  return null;
}

export function useContentEditable({
  content,
  isEditable,
  onChange,
  onUserInput,
  onImageDrop,
  isDraggingImage = false,
  onDropComplete
}: ContentEditableOptions) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef(content);
  const dropRangeRef = useRef<Range | null>(null);

  const handleInput = useCallback((e: FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    const sanitized = sanitizeHtml(html);
    lastContentRef.current = sanitized;
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
            lastContentRef.current = sanitized;
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
            const sanitized = sanitizeHtml(editorRef.current.innerHTML);
            lastContentRef.current = sanitized;
            onChange(sanitized);
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

  const updateDropIndicator = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!editorRef.current) return;

    const range = getCaretRangeFromPoint(e.clientX, e.clientY);
    const editor = editorRef.current;

    if (!range || !editor.contains(range.startContainer)) {
      dropRangeRef.current = null;
      return;
    }

    dropRangeRef.current = range;
  }, []);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isEditable || !onImageDrop) return;

    if (e.dataTransfer.types.includes('Files')) {
      if (!isDraggingImage) return;
      updateDropIndicator(e);
    }
  }, [isDraggingImage, isEditable, onImageDrop, updateDropIndicator]);

  const handleDragLeave = useCallback(() => {
    if (!isEditable || !onImageDrop) return;

    dropRangeRef.current = null;
  }, [isEditable, onImageDrop]);

  const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    if (!isEditable || !onImageDrop) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) {
      onDropComplete?.();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    // Check if first file is an image
    const file = files[0];
    if (!file.type.startsWith('image/')) {
      onDropComplete?.();
      return;
    }

    const range = dropRangeRef.current;
    const selection = window.getSelection();
    if (range) {
      selection?.removeAllRanges();
      selection?.addRange(range);
    }

    try {
      // Insert placeholder at drop position
      const uploadingImg = document.createElement('img');
      uploadingImg.setAttribute('data-image-id', 'uploading');
      uploadingImg.setAttribute('alt', 'Uploading...');
      if (range) {
        range.insertNode(uploadingImg);
      } else if (editorRef.current) {
        editorRef.current.appendChild(uploadingImg);
      }
      onUserInput?.();

      // Upload image
      const imageId = await onImageDrop(file);

      // Replace placeholder with actual image
      const finalImg = document.createElement('img');
      finalImg.setAttribute('data-image-id', imageId);
      finalImg.setAttribute('alt', file.name);
      if (uploadingImg.isConnected) {
        uploadingImg.replaceWith(finalImg);
      } else if (editorRef.current) {
        editorRef.current.appendChild(finalImg);
      }
      const sanitized = sanitizeHtml(editorRef.current?.innerHTML ?? '');
      lastContentRef.current = sanitized;
      onChange(sanitized);
    } catch (error) {
      console.error('Failed to upload dropped image:', error);
      // Remove placeholder on error
      const uploadingImg = editorRef.current?.querySelector('img[data-image-id="uploading"]');
      if (uploadingImg) {
        uploadingImg.remove();
      }
      const sanitized = sanitizeHtml(editorRef.current?.innerHTML ?? '');
      lastContentRef.current = sanitized;
      onChange(sanitized);
    } finally {
      dropRangeRef.current = null;
      onDropComplete?.();
    }
  }, [isEditable, onImageDrop, onUserInput, onChange, onDropComplete]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (!isEditable || !onImageDrop) return;

    // Check if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingImage) return;
      updateDropIndicator(e);
    }
  }, [isDraggingImage, isEditable, onImageDrop, updateDropIndicator]);

  useEffect(() => {
    if (
      editorRef.current &&
      content !== lastContentRef.current &&
      editorRef.current.innerHTML !== content
    ) {
      editorRef.current.innerHTML = content;
      lastContentRef.current = content;
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

  useEffect(() => {
    if (!isDraggingImage) {
      dropRangeRef.current = null;
    }
  }, [isDraggingImage]);

  return {
    editorRef,
    handleInput,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave
  };
}
