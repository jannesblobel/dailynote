import { useEffect, useCallback } from 'react';

interface UseNoteKeyboardNavProps {
  enabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
  contentEditableSelector: string;
}

export function useNoteKeyboardNav({
  enabled,
  onPrevious,
  onNext,
  contentEditableSelector
}: UseNoteKeyboardNavProps): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle arrow keys
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') {
        return;
      }

      // Check if contentEditable is focused
      const activeElement = document.activeElement;
      const isEditingContent = activeElement?.matches(contentEditableSelector);

      // Don't navigate if user is editing
      if (isEditingContent) {
        return;
      }

      // Prevent default arrow key behavior
      e.preventDefault();

      // Navigate
      if (e.key === 'ArrowLeft') {
        onPrevious();
      } else if (e.key === 'ArrowRight') {
        onNext();
      }
    },
    [onPrevious, onNext, contentEditableSelector]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}
