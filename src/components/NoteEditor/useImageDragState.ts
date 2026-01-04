import { useCallback, useEffect, useRef, useState } from "react";

function hasFilePayload(event: DragEvent): boolean {
  return event.dataTransfer?.types?.includes("Files") ?? false;
}

export function useImageDragState() {
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragDepthRef = useRef(0);

  useEffect(() => {
    const handleDragEnter = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      dragDepthRef.current += 1;
      if (!isDraggingImage) {
        setIsDraggingImage(true);
      }
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFilePayload(event)) return;
      event.preventDefault();
      if (!isDraggingImage) {
        setIsDraggingImage(true);
      }
    };

    const handleDragLeave = () => {
      if (dragDepthRef.current === 0) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsDraggingImage(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      if (!isDraggingImage) return;
      event.preventDefault();
      dragDepthRef.current = 0;
      setIsDraggingImage(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [isDraggingImage]);

  const endImageDrag = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingImage(false);
  }, []);

  return {
    isDraggingImage,
    endImageDrag,
  };
}
