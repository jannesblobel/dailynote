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
  backgroundImageUrl?: string | null;
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
  onDragOver,
  backgroundImageUrl
}: NoteEditorViewProps) {
  const hasBackground = !!backgroundImageUrl;
  const bodyClassName = `note-editor__body ${hasBackground ? 'note-editor__body--has-background' : ''}`.trim();
  const contentClassName = `note-editor__content ${hasBackground ? 'note-editor__content--with-background' : ''}`.trim();

  const bodyStyle = hasBackground && backgroundImageUrl
    ? { backgroundImage: `url(${backgroundImageUrl})` }
    : undefined;

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
      <div className={bodyClassName} style={bodyStyle}>
        <div
          ref={editorRef}
          className={contentClassName}
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
