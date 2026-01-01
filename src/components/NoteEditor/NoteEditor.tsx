import { formatDateDisplay } from '../../utils/date';
import { canEditNote } from '../../utils/noteRules';
import { NoteEditorView } from './NoteEditorView';
import { useContentEditable } from './useContentEditable';
import { useSavingIndicator } from './useSavingIndicator';

interface NoteEditorProps {
  date: string;
  content: string;
  onChange: (content: string) => void;
  isClosing: boolean;
  isDecrypting?: boolean;
}

export function NoteEditor({
  date,
  content,
  onChange,
  isClosing,
  isDecrypting = false
}: NoteEditorProps) {
  const canEdit = canEditNote(date);
  const isEditable = canEdit && !isDecrypting;
  const formattedDate = formatDateDisplay(date);
  const { showSaving, scheduleSavingIndicator } = useSavingIndicator(isEditable);
  const displayContent = content;

  const statusText = isDecrypting
    ? 'Decrypting...'
    : isEditable && (showSaving || isClosing)
      ? 'Saving...'
      : null;
  const { editorRef, handleInput, handlePaste } = useContentEditable({
    content: displayContent,
    isEditable,
    onChange,
    onUserInput: scheduleSavingIndicator
  });

  return (
    <NoteEditorView
      formattedDate={formattedDate}
      isEditable={isEditable}
      showReadonlyBadge={!canEdit}
      statusText={statusText}
      editorRef={editorRef}
      onInput={handleInput}
      onPaste={handlePaste}
    />
  );
}
