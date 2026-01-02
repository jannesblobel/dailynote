import { useCallback, useEffect } from 'react';
import { formatDateDisplay } from '../../utils/date';
import { canEditNote } from '../../utils/noteRules';
import { NoteEditorView } from './NoteEditorView';
import { useContentEditable } from './useContentEditable';
import { useSavingIndicator } from './useSavingIndicator';
import { useNoteRepositoryContext } from '../../contexts/noteRepositoryContext';
import { resolveImageUrls } from '../../utils/imageResolver';
import { compressImage } from '../../utils/imageCompression';

interface NoteEditorProps {
  date: string;
  content: string;
  onChange: (content: string) => void;
  isClosing: boolean;
  hasEdits: boolean;
  isDecrypting?: boolean;
}

export function NoteEditor({
  date,
  content,
  onChange,
  isClosing,
  hasEdits,
  isDecrypting = false
}: NoteEditorProps) {
  const canEdit = canEditNote(date);
  const isEditable = canEdit && !isDecrypting;
  const formattedDate = formatDateDisplay(date);
  const { showSaving, scheduleSavingIndicator } = useSavingIndicator(isEditable);
  const displayContent = content;

  const { imageRepository } = useNoteRepositoryContext();

  // Handle inline image upload
  const uploadInlineImage = useCallback(async (file: File): Promise<string> => {
    if (!imageRepository) {
      throw new Error('Image repository not available');
    }

    // Compress image
    const compressed = await compressImage(file);

    // Upload to repository
    const meta = await imageRepository.upload(
      date,
      compressed.blob,
      'inline',
      file.name
    );

    return meta.id;
  }, [imageRepository, date]);

  const statusText = isDecrypting
    ? 'Decrypting...'
    : isEditable && (showSaving || (isClosing && hasEdits))
      ? 'Saving...'
      : null;

  const { editorRef, handleInput, handlePaste, handleDrop, handleDragOver } = useContentEditable({
    content: displayContent,
    isEditable,
    onChange,
    onUserInput: scheduleSavingIndicator,
    onImageDrop: isEditable ? uploadInlineImage : undefined
  });

  // Resolve image URLs when content changes
  useEffect(() => {
    if (editorRef.current && imageRepository) {
      resolveImageUrls(editorRef.current, imageRepository);
    }
  }, [content, imageRepository, editorRef]);

  return (
    <NoteEditorView
      formattedDate={formattedDate}
      isEditable={isEditable}
      showReadonlyBadge={!canEdit}
      statusText={statusText}
      editorRef={editorRef}
      onInput={handleInput}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    />
  );
}
