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
}

export function NoteEditor({ date, content, onChange, isClosing }: NoteEditorProps) {
  const isEditable = canEditNote(date);
  const formattedDate = formatDateDisplay(date);
  const { showSaving, scheduleSavingIndicator } = useSavingIndicator(isEditable);
  const { editorRef, handleInput, handlePaste } = useContentEditable({
    content,
    isEditable,
    onChange,
    onUserInput: scheduleSavingIndicator
  });

  return (
    <NoteEditorView
      formattedDate={formattedDate}
      isEditable={isEditable}
      isClosing={isClosing}
      showSaving={showSaving}
      editorRef={editorRef}
      onInput={handleInput}
      onPaste={handlePaste}
    />
  );
}
