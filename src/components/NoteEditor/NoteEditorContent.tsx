import type {
  ClipboardEvent,
  DragEvent,
  FormEvent,
  MouseEvent,
  RefObject,
} from "react";
import styles from "./NoteEditor.module.css";

interface NoteEditorContentProps {
  editorRef: RefObject<HTMLDivElement | null>;
  isEditable: boolean;
  placeholderText: string;
  onInput?: (event: FormEvent<HTMLDivElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}

export function NoteEditorContent({
  editorRef,
  isEditable,
  placeholderText,
  onInput,
  onPaste,
  onDrop,
  onDragOver,
  onClick,
}: NoteEditorContentProps) {
  return (
    <div
      ref={editorRef}
      className={[styles.content, !isEditable ? styles.contentReadonly : ""]
        .filter(Boolean)
        .join(" ")}
      data-placeholder={placeholderText}
      data-note-editor="content"
      contentEditable={isEditable}
      tabIndex={isEditable ? 0 : -1}
      autoFocus={isEditable}
      suppressContentEditableWarning={true}
      role="textbox"
      aria-multiline="true"
      aria-readonly={!isEditable}
      onInput={onInput}
      onPaste={onPaste}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onClick={onClick}
    />
  );
}
