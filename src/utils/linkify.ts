/**
 * URL pattern that matches common URLs followed by whitespace or end of string.
 * Only linkifies "complete" URLs (when user has finished typing by pressing space/enter).
 * Matches http://, https://, and www. prefixed URLs.
 */
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<>"']+(?=\s|$)/gi;

/**
 * Checks if a string looks like a URL
 */
export function isUrl(text: string): boolean {
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  return pattern.test(text);
}

/**
 * Finds URL matches in text and returns their positions.
 * Only matches URLs that are followed by whitespace or end of string.
 */
export function findUrls(text: string): Array<{ url: string; start: number; end: number }> {
  const matches: Array<{ url: string; start: number; end: number }> = [];
  const pattern = new RegExp(URL_PATTERN.source, 'gi');
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      url: match[0],
      start: match.index,
      end: match.index + match[0].length
    });
  }

  return matches;
}

/**
 * Normalizes a URL by adding https:// if it starts with www.
 */
export function normalizeUrl(url: string): string {
  if (url.startsWith('www.')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Creates an anchor element for a URL
 */
export function createLinkElement(url: string): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = normalizeUrl(url);
  anchor.textContent = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  return anchor;
}

/**
 * Linkifies URLs in a text node, returning an array of nodes to replace it with.
 * If no URLs found, returns null (no replacement needed).
 */
export function linkifyTextNode(textNode: Text): Node[] | null {
  const text = textNode.textContent ?? '';
  const urls = findUrls(text);

  if (urls.length === 0) {
    return null;
  }

  const nodes: Node[] = [];
  let lastIndex = 0;

  for (const { url, start, end } of urls) {
    // Add text before the URL
    if (start > lastIndex) {
      nodes.push(document.createTextNode(text.slice(lastIndex, start)));
    }

    // Add the link
    nodes.push(createLinkElement(url));
    lastIndex = end;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    nodes.push(document.createTextNode(text.slice(lastIndex)));
  }

  return nodes;
}

/**
 * Checks if a node is inside an anchor element
 */
function isInsideAnchor(node: Node): boolean {
  let current: Node | null = node;
  while (current) {
    if (current.nodeName === 'A') {
      return true;
    }
    current = current.parentNode;
  }
  return false;
}

/**
 * Linkifies all URLs in text nodes within an element.
 * Skips text already inside anchor tags.
 * Returns true if any changes were made.
 */
export function linkifyElement(element: HTMLElement): boolean {
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        // Skip if inside an anchor
        if (isInsideAnchor(node)) {
          return NodeFilter.FILTER_REJECT;
        }
        // Skip if no URLs in text
        const text = node.textContent ?? '';
        const pattern = new RegExp(URL_PATTERN.source, 'gi');
        if (!pattern.test(text)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const textNodes: Text[] = [];
  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text);
  }

  if (textNodes.length === 0) {
    return false;
  }

  for (const textNode of textNodes) {
    const replacements = linkifyTextNode(textNode);
    if (replacements && textNode.parentNode) {
      const fragment = document.createDocumentFragment();
      replacements.forEach((n) => fragment.appendChild(n));
      textNode.parentNode.replaceChild(fragment, textNode);
    }
  }

  return true;
}
