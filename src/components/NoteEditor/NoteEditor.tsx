import { useCallback, useEffect, useRef, useState } from 'react';
import { formatDateDisplay, isToday } from '../../utils/date';
import { sanitizeHtml } from '../../utils/sanitize';

interface NoteEditorProps {
  date: string;
  content: string;
  onChange: (content: string) => void;
}

export function NoteEditor({ date, content, onChange }: NoteEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const idleTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const isEditable = isToday(date);
  const formattedDate = formatDateDisplay(date);
  const [showSaving, setShowSaving] = useState(false);

  const scheduleSavingIndicator = useCallback(() => {
    if (!isEditable) {
      return;
    }

    if (idleTimerRef.current !== null) {
      window.clearTimeout(idleTimerRef.current);
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }

    setShowSaving(false);
    idleTimerRef.current = window.setTimeout(() => {
      setShowSaving(true);
      hideTimerRef.current = window.setTimeout(() => {
        setShowSaving(false);
      }, 1200);
    }, 2000);
  }, [isEditable]);

  // Handle content changes from contentEditable
  const handleInput = useCallback((e: React.FormEvent<HTMLDivElement>) => {
    const html = e.currentTarget.innerHTML;
    // Sanitize immediately on input
    const sanitized = sanitizeHtml(html);
    onChange(sanitized);
    scheduleSavingIndicator();
  }, [onChange, scheduleSavingIndicator]);

  // Update contentEditable when content prop changes
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content;
    }
  }, [content]);

  // Focus editor on mount if editable
  useEffect(() => {
    if (isEditable && editorRef.current) {
      editorRef.current.focus();

      // Move cursor to end of content
      const range = document.createRange();
      const selection = window.getSelection();

      // Only move cursor if there's content
      if (editorRef.current.childNodes.length > 0) {
        range.selectNodeContents(editorRef.current);
        range.collapse(false); // false = collapse to end
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }, [isEditable]);

  useEffect(() => {
    if (!isEditable) {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      setShowSaving(false);
    }

    return () => {
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [isEditable]);

  // Handle paste - sanitize pasted content
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Get HTML from clipboard if available, otherwise plain text
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');

    // Prefer HTML (preserves formatting) but sanitize it
    const contentToPaste = html ? sanitizeHtml(html) : text;

    // Insert at cursor position
    document.execCommand('insertHTML', false, contentToPaste);
    scheduleSavingIndicator();
  }, [scheduleSavingIndicator]);

  return (
    <div className="note-editor">
      <div className="note-editor__header">
        <div>
          <span className="note-editor__date">{formattedDate}</span>
          {!isEditable && (
            <span className="note-editor__readonly-badge">Read only</span>
          )}
        </div>
        {isEditable && showSaving && (
          <span className="note-editor__saving">Saving...</span>
        )}
      </div>
      <div className="note-editor__body">
        <div
          ref={editorRef}
          className="note-editor__content"
          contentEditable={isEditable}
          onInput={handleInput}
          onPaste={handlePaste}
          data-placeholder={isEditable ? "Write your note for today..." : "No note for this day"}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
