/**
 * Server-side feed fetcher for GitHub Actions.
 * Fetches all RSS feeds and writes results to public/feeds-cache.json.
 *
 * Runs in Node.js 20+ (no dependencies — uses native fetch and DOMParser alternative).
 */

const fs = require('fs');
const path = require('path');

const FEEDS = [
  { id: 'mbw', name: 'Music Business Worldwide', url: 'https://www.musicbusinessworldwide.com/feed/', category: 'Industry' },
  { id: 'hypebot', name: 'Hypebot', url: 'https://www.hypebot.com/feed/', category: 'Industry' },
  { id: 'dmn', name: 'Digital Music News', url: 'https://www.digitalmusicnews.com/feed/', category: 'Industry' },
  { id: 'cmu', name: 'Complete Music Update', url: 'https://completemusicupdate.com/feed/', category: 'Industry' },
  { id: 'rain', name: 'RAIN News', url: 'https://rainnews.com/feed/', category: 'Industry' },
  { id: 'techcrunch-music', name: 'TechCrunch', url: 'https://techcrunch.com/tag/music/feed/', category: 'Technology' },
  { id: 'verge-music', name: 'The Verge', url: 'https://www.theverge.com/rss/music/index.xml', category: 'Technology' },
  { id: 'musically', name: 'Music Ally', url: 'https://musically.com/feed/', category: 'Technology' },
  { id: 'variety-music', name: 'Variety', url: 'https://variety.com/v/music/feed/', category: 'Business & Finance' },
  { id: 'billboard', name: 'Billboard', url: 'https://www.billboard.com/feed/', category: 'Business & Finance' },
  { id: 'pollstar', name: 'Pollstar', url: 'https://www.pollstar.com/rss', category: 'Business & Finance' },
  { id: 'riaa', name: 'RIAA Newsroom', url: 'https://www.riaa.com/feed/', category: 'Policy & Legal' },
  { id: 'fmc', name: 'Future of Music Coalition', url: 'https://futureofmusic.org/feed', category: 'Policy & Legal' },
];

function stripHTML(str) {
  return str.replace(/<[^>]*>/g, '').trim();
}

function truncate(text, max) {
  if (!text || text.length <= max) return text || '';
  return text.slice(0, max).trimEnd() + '…';
}

/**
 * Minimal XML tag text extractor (no DOMParser in Node without extra deps).
 * Extracts the text content of the first occurrence of <tagName>...</tagName>.
 */
function getTagContent(xml, tagName) {
  // Handle CDATA sections
  const regex = new RegExp(`<${tagName}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  return (match[1] || match[2] || '').trim();
}

/**
 * Extract href from Atom <link> element.
 */
function getAtomLink(xml) {
  const altMatch = xml.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (altMatch) return altMatch[1];
  const linkMatch = xml.match(/<link[^>]*href=["']([^"']+)["']/i);
  return linkMatch ? linkMatch[1] : '';
}

function parseItems(xml, feed) {
  const isAtom = xml.includes('<entry');
  const itemTag = isAtom ? 'entry' : 'item';
  const regex = new RegExp(`<${itemTag}[\\s>][\\s\\S]*?</${itemTag}>`, 'gi');
  const items = xml.match(regex) || [];

  return items.map(itemXml => {
    const title = stripHTML(getTagContent(itemXml, 'title'));
    const link = isAtom ? getAtomLink(itemXml) : stripHTML(getTagContent(itemXml, 'link'));
    const dateStr = isAtom
      ? (getTagContent(itemXml, 'published') || getTagContent(itemXml, 'updated'))
      : getTagContent(itemXml, 'pubDate');
    const description = truncate(
      stripHTML(getTagContent(itemXml, 'description') || getTagContent(itemXml, 'summary') || getTagContent(itemXml, 'content')),
      200
    );

    if (!title || !link) return null;

    const date = dateStr ? new Date(dateStr) : new Date(0);

    return {
      id: link,
      title,
      link,
      description,
      date: isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString(),
      source: feed.name,
      sourceId: feed.id,
      category: feed.category,
    };
  }).filter(Boolean);
}

async function fetchFeed(feed) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(feed.url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'MusicNewsFeed/1.0 (GitHub Actions)' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const xml = await response.text();
    const articles = parseItems(xml, feed);
    console.log(`✓ ${feed.name}: ${articles.length} articles`);
    return articles;
  } catch (err) {
    console.warn(`✗ ${feed.name}: ${err.message}`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log('Fetching feeds...\n');

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));
  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);

  // Deduplicate by URL
  const seen = new Set();
  const unique = allArticles.filter(a => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });

  // Sort by date descending
  unique.sort((a, b) => new Date(b.date) - new Date(a.date));

  const output = {
    generated: new Date().toISOString(),
    articles: unique,
  };

  const outPath = path.join(__dirname, '..', '..', 'public', 'feeds-cache.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nDone. ${unique.length} unique articles written to public/feeds-cache.json`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
