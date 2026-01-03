import { useCallback, useEffect, useId, useRef } from 'react';
import type { ClipboardEvent, DragEvent, MouseEvent } from 'react';
import { linkifyElement } from '../../utils/linkify';

const TIMESTAMP_ATTR = 'data-timestamp';
const ADDITION_WINDOW_MS = 10 * 60 * 1000;

interface ContentEditableOptions {
  content: string;
  noteDate: string;
  isEditable: boolean;
  placeholderText: string;
  onChange: (content: string) => void;
  onUserInput?: () => void;
  onImageDrop?: (file: File) => Promise<{
    id: string;
    width: number;
    height: number;
    filename: string;
  }>;
  onDropComplete?: () => void;
}

function setCaretFromPoint(x: number, y: number) {
  const selection = window.getSelection();
  if (!selection) return;

  let range: Range | null = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else {
    const caretPositionFromPoint = (document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
    }).caretPositionFromPoint;
    const position = caretPositionFromPoint?.(x, y);
    if (position) {
      range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
    }
  }

  if (range) {
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function insertNodeAtCursor(node: Node) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function saveCursorPosition(element: HTMLElement): { node: Node; offset: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer)) return null;
  return { node: range.startContainer, offset: range.startOffset };
}

function restoreCursorPosition(
  element: HTMLElement,
  saved: { node: Node; offset: number } | null
) {
  if (!saved) return;
  const selection = window.getSelection();
  if (!selection) return;

  // If the saved node is still in the document, use it
  if (element.contains(saved.node)) {
    try {
      const range = document.createRange();
      range.setStart(saved.node, Math.min(saved.offset, saved.node.textContent?.length ?? 0));
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } catch {
      // If restoration fails, place cursor at end
      const range = document.createRange();
      range.selectNodeContents(element);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }
}

function getBlockElements(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>('p, div'));
}

function isEmptyBlock(element: HTMLElement): boolean {
  if (element.tagName !== 'P' && element.tagName !== 'DIV') return false;
  const text = (element.textContent ?? '').trim();
  if (text.length > 0) return false;
  return element.querySelector('img') === null;
}

function buildSelectorPath(element: Element, root: Element): string | null {
  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) return null;
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(current);
    if (index < 0) return null;
    segments.push(`${current.tagName.toLowerCase()}:nth-child(${index + 1})`);
    current = parent;
  }
  if (current !== root) return null;
  return `.note-editor__content > ${segments.reverse().join(' > ')}`;
}

function formatAdditionLabel(timestamp: string): string | null {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return null;
  const time = parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  });
  return time;
}

function escapeCssContent(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ');
}

export function useContentEditableEditor({
  content,
  isEditable,
  placeholderText,
  onChange,
  onUserInput,
  onImageDrop,
  onDropComplete
}: ContentEditableOptions) {
  const editorRef = useRef<HTMLDivElement>(null);
  const lastContentRef = useRef('');
  const isLocalEditRef = useRef(false);
  const isEditableRef = useRef(isEditable);
  const onChangeRef = useRef(onChange);
  const onUserInputRef = useRef(onUserInput);
  const onImageDropRef = useRef(onImageDrop);
  const onDropCompleteRef = useRef(onDropComplete);
  const knownBlocksRef = useRef<WeakSet<Element>>(new WeakSet());
  const styleId = `note-editor-additions-${useId()}`;

  const ensureTimestampsForNewBlocks = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const now = new Date().toISOString();
    for (const block of getBlockElements(el)) {
      const existing = block.getAttribute(TIMESTAMP_ATTR);
      if (existing) {
        if (!knownBlocksRef.current.has(block)) {
          block.setAttribute(TIMESTAMP_ATTR, now);
        }
        knownBlocksRef.current.add(block);
        continue;
      }
      if (knownBlocksRef.current.has(block)) {
        continue;
      }
      block.setAttribute(TIMESTAMP_ATTR, now);
      knownBlocksRef.current.add(block);
    }
  }, []);

  const updateAdditionStyles = useCallback((element?: HTMLElement) => {
    const el = element ?? editorRef.current;
    if (!el) return;
    const blocks = getBlockElements(el);
    const entries: Array<{
      element: HTMLElement;
      timestamp: number;
      raw: string;
      order: number;
    }> = [];
    blocks.forEach((block, index) => {
      if (isEmptyBlock(block)) return;
      const raw = block.getAttribute(TIMESTAMP_ATTR);
      if (!raw) return;
      const timestamp = Date.parse(raw);
      if (Number.isNaN(timestamp)) return;
      entries.push({
        element: block,
        timestamp,
        raw,
        order: index
      });
    });
    entries.sort((a, b) => (a.timestamp - b.timestamp) || (a.order - b.order));
    let lastTimestamp: number | null = null;
    const markers: Array<{ selector: string; label: string }> = [];
    for (const entry of entries) {
      if (lastTimestamp === null || entry.timestamp - lastTimestamp > ADDITION_WINDOW_MS) {
        const selector = buildSelectorPath(entry.element, el);
        const label = formatAdditionLabel(entry.raw);
        if (selector && label) {
          markers.push({ selector, label });
        }
      }
      lastTimestamp = entry.timestamp;
    }
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    if (markers.length === 0) {
      styleEl.textContent = '';
      return;
    }
    const beforeSelectors = markers.map((marker) => `${marker.selector}::before`).join(', ');
    const afterSelectors = markers.map((marker) => `${marker.selector}::after`).join(', ');
    const tooltipRules = markers.map((marker) => (
      `${marker.selector}::after { content: "${escapeCssContent(marker.label)}"; }`
    ));
    styleEl.textContent = `${beforeSelectors}, ${afterSelectors} { display: block; }` +
      tooltipRules.join('');
  }, [styleId]);

  const updateEmptyState = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const hasText = (el.textContent ?? '').trim().length > 0;
    const hasImages = el.querySelector('img') !== null;
    el.classList.toggle('is-empty', !hasText && !hasImages);
  }, []);

  useEffect(() => {
    isEditableRef.current = isEditable;
  }, [isEditable]);

  useEffect(() => {
    onChangeRef.current = onChange;
    onUserInputRef.current = onUserInput;
    onImageDropRef.current = onImageDrop;
    onDropCompleteRef.current = onDropComplete;
  }, [onChange, onUserInput, onImageDrop, onDropComplete]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.setAttribute('data-placeholder', placeholderText);
  }, [placeholderText]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    // Skip innerHTML update if this content change came from local user input
    // This prevents scroll jumps on mobile caused by re-setting innerHTML
    if (isLocalEditRef.current) {
      isLocalEditRef.current = false;
      lastContentRef.current = content || '';
      updateEmptyState();
      return;
    }
    if (content === lastContentRef.current) {
      updateAdditionStyles(el);
      updateEmptyState();
      return;
    }
    const nextContent = content || '';
    if (nextContent === el.innerHTML) {
      lastContentRef.current = nextContent;
      updateAdditionStyles(el);
      updateEmptyState();
      return;
    }
    el.innerHTML = nextContent;
    lastContentRef.current = nextContent;
    knownBlocksRef.current = new WeakSet();
    for (const block of getBlockElements(el)) {
      knownBlocksRef.current.add(block);
    }
    updateAdditionStyles(el);
    updateEmptyState();
  }, [content, updateAdditionStyles, updateEmptyState]);

  const handleInput = useCallback(() => {
    if (!isEditableRef.current) return;
    const el = editorRef.current;
    if (!el) return;
    ensureTimestampsForNewBlocks();
    updateEmptyState();

    // Convert --- to <hr>
    const hrPattern = /^---$/;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const textNodesToReplace: Text[] = [];
    let node;
    while ((node = walker.nextNode())) {
      const text = (node.textContent ?? '').trim();
      if (hrPattern.test(text)) {
        textNodesToReplace.push(node as Text);
      }
    }
    for (const textNode of textNodesToReplace) {
      const hr = document.createElement('hr');
      const br = document.createElement('br');
      const parent = textNode.parentNode;
      if (parent) {
        parent.replaceChild(hr, textNode);
        hr.after(br);
      }
    }

    // Linkify any URLs in text nodes
    const cursorPos = saveCursorPosition(el);
    const didLinkify = linkifyElement(el);
    const didInsertHr = textNodesToReplace.length > 0;
    if (didLinkify || didInsertHr) {
      // After transformation, cursor may be lost - place it after the new element
      const selection = window.getSelection();
      if (selection) {
        if (didInsertHr) {
          // Place cursor after the <br> following the last <hr>
          const hrs = el.querySelectorAll('hr');
          if (hrs.length > 0) {
            const lastHr = hrs[hrs.length - 1];
            const nextSibling = lastHr.nextSibling;
            const range = document.createRange();
            if (nextSibling) {
              range.setStartAfter(nextSibling);
            } else {
              range.setStartAfter(lastHr);
            }
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } else if (didLinkify) {
          // Find the last anchor and place cursor after it
          const anchors = el.querySelectorAll('a');
          if (anchors.length > 0) {
            const lastAnchor = anchors[anchors.length - 1];
            const range = document.createRange();
            range.setStartAfter(lastAnchor);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          } else {
            restoreCursorPosition(el, cursorPos);
          }
        }
      }
    }

    const hasText = (el.textContent ?? '').trim().length > 0;
    const hasImages = el.querySelector('img') !== null;
    const html = hasText || hasImages ? el.innerHTML : '';
    if (html === lastContentRef.current) {
      return;
    }
    lastContentRef.current = html;
    isLocalEditRef.current = true;
    onChangeRef.current(html);
    onUserInputRef.current?.();
  }, [ensureTimestampsForNewBlocks, updateEmptyState]);

  useEffect(() => {
    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, [styleId]);

  const handlePaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    if (!isEditableRef.current) return;
    const dropHandler = onImageDropRef.current;
    if (!dropHandler || !event.clipboardData) return;

    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();

    const placeholder = document.createElement('img');
    placeholder.setAttribute('data-image-id', 'uploading');
    placeholder.setAttribute('alt', 'Uploading...');
    insertNodeAtCursor(placeholder);
    handleInput();

    dropHandler(file)
      .then(({ id, width, height, filename }) => {
        placeholder.setAttribute('data-image-id', id);
        placeholder.setAttribute('alt', filename);
        placeholder.setAttribute('width', String(width));
        placeholder.setAttribute('height', String(height));
      })
      .catch((error) => {
        console.error('Failed to upload pasted image:', error);
        placeholder.remove();
      })
      .finally(() => {
        onDropCompleteRef.current?.();
        updateEmptyState();
        handleInput();
      });
  }, [handleInput, updateEmptyState]);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!isEditableRef.current) return;
    const dropHandler = onImageDropRef.current;
    const files = event.dataTransfer?.files;
    if (!dropHandler || !files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) return;

    event.preventDefault();
    setCaretFromPoint(event.clientX, event.clientY);

    const placeholder = document.createElement('img');
    placeholder.setAttribute('data-image-id', 'uploading');
    placeholder.setAttribute('alt', 'Uploading...');
    insertNodeAtCursor(placeholder);
    handleInput();

    dropHandler(file)
      .then(({ id, width, height, filename }) => {
        placeholder.setAttribute('data-image-id', id);
        placeholder.setAttribute('alt', filename);
        placeholder.setAttribute('width', String(width));
        placeholder.setAttribute('height', String(height));
      })
      .catch((error) => {
        console.error('Failed to upload dropped image:', error);
        placeholder.remove();
      })
      .finally(() => {
        onDropCompleteRef.current?.();
        updateEmptyState();
        handleInput();
      });
  }, [handleInput, updateEmptyState]);

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!isEditableRef.current) return;
    if (!onImageDropRef.current) return;
    if (event.dataTransfer?.types?.includes('Files')) {
      event.preventDefault();
    }
  }, []);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const anchor = target.closest('a');
    if (anchor && anchor.href) {
      event.preventDefault();
      window.open(anchor.href, '_blank', 'noopener,noreferrer');
    }
  }, []);

  return {
    editorRef,
    handleInput,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleClick
  };
}
