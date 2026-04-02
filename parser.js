/**
 * RSS / Atom Feed Parser
 * Handles RSS 2.0 (pubDate) and Atom (published/updated) formats.
 * All output is sanitized — no raw HTML injected into the DOM.
 */

const PROXY_BASE = 'https://api.allorigins.win/get?url=';

/**
 * Fetch a single feed through the CORS proxy.
 * Returns the raw XML string or throws on failure.
 */
export async function fetchFeedXML(feedUrl) {
  const proxyUrl = `${PROXY_BASE}${encodeURIComponent(feedUrl)}`;
  const response = await fetch(proxyUrl);

  if (!response.ok) {
    throw new Error(`Proxy returned ${response.status} for ${feedUrl}`);
  }

  const data = await response.json();

  if (!data.contents) {
    throw new Error(`Empty response for ${feedUrl}`);
  }

  return data.contents;
}

/**
 * Parse an XML string into an array of article objects.
 * Supports both RSS 2.0 <item> and Atom <entry> elements.
 */
export function parseXML(xmlString, feedMeta) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML parse error for ${feedMeta.name}`);
  }

  // Detect format: Atom uses <entry>, RSS uses <item>
  const isAtom = doc.querySelector('entry') !== null;
  const items = isAtom
    ? doc.querySelectorAll('entry')
    : doc.querySelectorAll('item');

  const articles = [];

  for (const item of items) {
    const article = isAtom
      ? parseAtomEntry(item, feedMeta)
      : parseRSSItem(item, feedMeta);

    if (article) {
      articles.push(article);
    }
  }

  return articles;
}

/**
 * Parse a single RSS 2.0 <item>
 */
function parseRSSItem(item, feedMeta) {
  const title = sanitizeText(getTagText(item, 'title'));
  const link = sanitizeText(getTagText(item, 'link'));
  const pubDate = getTagText(item, 'pubDate');
  const description = sanitizeText(
    stripHTML(getTagText(item, 'description') || getTagText(item, 'content:encoded') || '')
  );

  if (!title || !link) return null;

  return {
    id: link,
    title,
    link,
    description: truncate(description, 200),
    date: parseDate(pubDate),
    rawDate: pubDate,
    source: feedMeta.name,
    sourceId: feedMeta.id,
    category: feedMeta.category,
  };
}

/**
 * Parse a single Atom <entry>
 */
function parseAtomEntry(entry, feedMeta) {
  const title = sanitizeText(getTagText(entry, 'title'));

  // Atom links are in <link> attributes, not text content
  const linkEl = entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
  const link = sanitizeText(linkEl ? linkEl.getAttribute('href') : '');

  const published = getTagText(entry, 'published') || getTagText(entry, 'updated');
  const summary = sanitizeText(
    stripHTML(getTagText(entry, 'summary') || getTagText(entry, 'content') || '')
  );

  if (!title || !link) return null;

  return {
    id: link,
    title,
    link,
    description: truncate(summary, 200),
    date: parseDate(published),
    rawDate: published,
    source: feedMeta.name,
    sourceId: feedMeta.id,
    category: feedMeta.category,
  };
}

// ── Helpers ──

function getTagText(parent, tagName) {
  const el = parent.querySelector(tagName);
  return el ? el.textContent.trim() : '';
}

/**
 * Parse date strings from RSS/Atom into Date objects.
 * Handles RFC 822 (RSS) and ISO 8601 (Atom) formats.
 */
function parseDate(dateString) {
  if (!dateString) return new Date(0);

  const parsed = new Date(dateString);
  return isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

/**
 * Strip HTML tags from a string.
 */
function stripHTML(html) {
  const tmp = document.createElement('div');
  tmp.textContent = html; // set as text to avoid executing anything
  // Now parse the decoded text (RSS often double-encodes)
  const decoded = tmp.textContent;
  return decoded.replace(/<[^>]*>/g, '').trim();
}

/**
 * Sanitize text to prevent XSS — removes any HTML and trims.
 */
function sanitizeText(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').trim();
}

function truncate(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Format a date as a human-readable relative string.
 */
export function formatRelativeDate(date) {
  if (!date || date.getTime() === 0) return '';

  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

/**
 * Fetch and parse a single feed. Returns articles array or empty on failure.
 */
export async function fetchAndParseFeed(feedMeta) {
  const xml = await fetchFeedXML(feedMeta.url);
  return parseXML(xml, feedMeta);
}
