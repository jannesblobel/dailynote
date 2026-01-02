import type { ClipboardEvent, DragEvent, FormEvent, RefObject } from 'react';

interface NoteEditorViewProps {
  formattedDate: string;
  isEditable: boolean;
  showReadonlyBadge: boolean;
  statusText: string | null;
  editorRef: RefObject<HTMLDivElement | null>;
  onInput: (e: FormEvent<HTMLDivElement>) => void;
  onPaste: (e: ClipboardEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
}

export function NoteEditorView({
  formattedDate,
  isEditable,
  showReadonlyBadge,
  statusText,
  editorRef,
  onInput,
  onPaste,
  onDrop,
  onDragOver
}: NoteEditorViewProps) {
  return (
    <div className="note-editor">
      <div className="note-editor__header">
        <div className="note-editor__header-title">
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
          onDrop={onDrop}
          onDragOver={onDragOver}
          data-placeholder={isEditable ? 'Write your note for today...' : 'No note for this day'}
          suppressContentEditableWarning
        />
      </div>
    </div>
  );
}
