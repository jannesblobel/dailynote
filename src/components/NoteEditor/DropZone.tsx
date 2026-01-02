import { useState, type ReactNode, type DragEvent } from 'react';

export interface DropZoneProps {
  onDrop: (files: FileList) => void;
  accept?: string; // MIME types (e.g., 'image/*')
  children: ReactNode;
  className?: string;
  activeClassName?: string;
  disabled?: boolean;
}

/**
 * Generic drop zone wrapper with visual feedback
 * Shows active state when dragging files over
 */
export function DropZone({
  onDrop,
  accept = 'image/*',
  children,
  className = '',
  activeClassName = 'drop-zone--active',
  disabled = false
}: DropZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Check if dragging files
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragActive(true);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Set dropEffect to show copy cursor
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    // Only reset if leaving the drop zone entirely
    // (not just moving between child elements)
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

    if (files.length > 0) {
      // Filter by accepted MIME types if specified
      const acceptedFiles = Array.from(files).filter(file => {
        if (!accept) return true;

        const acceptedTypes = accept.split(',').map(t => t.trim());

        return acceptedTypes.some(type => {
          if (type.endsWith('/*')) {
            const prefix = type.slice(0, -2);
            return file.type.startsWith(prefix);
          }
          return file.type === type;
        });
      });

      if (acceptedFiles.length > 0) {
        // Create new FileList-like object with filtered files
        const dataTransfer = new DataTransfer();
        acceptedFiles.forEach(file => dataTransfer.items.add(file));
        onDrop(dataTransfer.files);
      }
    }
  };

  const combinedClassName = `${className} ${isDragActive ? activeClassName : ''}`.trim();

  return (
    <div
      className={combinedClassName}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}
      {isDragActive && (
        <div className="drop-zone__overlay">
          <div className="drop-zone__message">Drop image here</div>
        </div>
      )}
    </div>
  );
}
