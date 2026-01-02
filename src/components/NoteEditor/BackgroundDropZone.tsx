import { useState, type ReactNode, type DragEvent } from 'react';

export interface BackgroundDropZoneProps {
  onDrop: (file: File) => void;
  children: ReactNode;
  disabled?: boolean;
}

/**
 * Drop zone for the modal backdrop area
 * Detects drops outside the editor content area to set background images
 */
export function BackgroundDropZone({
  onDrop,
  children,
  disabled = false
}: BackgroundDropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Only activate if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDragActive(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;

    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (disabled) return;

    // Only reset if leaving the backdrop entirely
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    // Get first file
    const file = files[0];

    // Only accept images
    if (file.type.startsWith('image/')) {
      onDrop(file);
    }
  };

  return (
    <div
      className={`background-drop-zone ${isDragActive ? 'background-drop-zone--active' : ''}`.trim()}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragActive && (
        <div className="background-drop-zone__overlay">
          <div className="drop-zone__message">Set as background image</div>
        </div>
      )}
    </div>
  );
}
