import type { RefObject } from 'react';

interface NoteEditorViewProps {
  formattedDate: string;
  isEditable: boolean;
  showReadonlyBadge: boolean;
  statusText: string | null;
  placeholderText: string;
  editorRef: RefObject<HTMLDivElement | null>;
  isDraggingImage?: boolean;
  contentHtml: string;
  showReadonlyPlaceholder: boolean;
}

export function NoteEditorView({
  formattedDate,
  isEditable,
  showReadonlyBadge,
  statusText,
  placeholderText,
  editorRef,
  isDraggingImage = false,
  contentHtml,
  showReadonlyPlaceholder
}: NoteEditorViewProps) {
  return (
    <div className="note-editor">
      {isDraggingImage && (
        <div className="note-editor__drag-overlay" aria-hidden="true">
        </div>
      )}
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
        {isEditable ? (
          <div
            ref={editorRef}
            className="note-editor__content"
            data-placeholder={placeholderText}
            aria-readonly={!isEditable}
          />
        ) : (
          <div
            ref={editorRef}
            className="note-editor__content note-editor__content--readonly"
            aria-readonly="true"
          >
            {showReadonlyPlaceholder ? (
              <p className="note-editor__placeholder">{placeholderText}</p>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
