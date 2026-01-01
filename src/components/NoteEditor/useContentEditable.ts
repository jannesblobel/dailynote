import type { ClipboardEvent, FormEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { sanitizeHtml } from '../../utils/sanitize';

interface ContentEditableOptions {
  content: string;
  isEditable: boolean;
  onChange: (content: string) => void;
  onUserInput?: () => void;
}

export function useContentEditable({
  content,
  isEditable,
  onChange,
  onUserInput
}: ContentEditableOptions) {
  const editorRef = useRef<HTMLDivElement>(null);

  const handleInput = useCallback((e: FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    const sanitized = sanitizeHtml(html);
    onChange(sanitized);
    onUserInput?.();
  }, [onChange, onUserInput]);

  const handlePaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    if (html) {
      const sanitized = sanitizeHtml(html);
      document.execCommand('insertHTML', false, sanitized);
    } else {
      document.execCommand('insertText', false, text);
    }
    onUserInput?.();
  }, [onUserInput]);

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

  return { editorRef, handleInput, handlePaste };
}
