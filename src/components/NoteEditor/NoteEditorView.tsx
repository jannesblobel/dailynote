import type { ClipboardEvent, FormEvent, RefObject } from 'react';

interface NoteEditorViewProps {
  formattedDate: string;
  isEditable: boolean;
  isClosing: boolean;
  showReadonlyBadge: boolean;
  statusText: string | null;
  editorRef: RefObject<HTMLDivElement | null>;
  onInput: (e: FormEvent<HTMLDivElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
}

export function NoteEditorView({
  formattedDate,
  isEditable,
  isClosing,
  showReadonlyBadge,
  statusText,
  editorRef,
  onInput,
  onPaste
}: NoteEditorViewProps) {
  return (
    <div className="note-editor">
      <div className="note-editor__header">
        <div>
          <span className="note-editor__date">{formattedDate}</span>
          {showReadonlyBadge && (
            <span className="note-editor__readonly-badge">Read only</span>
          )}
        </div>
        {statusText && (
          <span className="note-editor__saving">{statusText}</span>
        )}
      </div>
      <div className="note-editor__body">
        <div
          ref={editorRef}
          className="note-editor__content"
          contentEditable={isEditable}
          onInput={onInput}
          onPaste={onPaste}
          data-placeholder={isEditable ? 'Write your note for today...' : 'No note for this day'}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
