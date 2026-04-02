/**
 * Feed Source Registry
 * Each source: { id, name, url, category, bias }
 * bias: editorial leaning — "neutral" for trade press, noted where relevant
 */

export const CATEGORIES = [
  'Industry',
  'Technology',
  'Business & Finance',
  'Policy & Legal'
];

export const CATEGORY_COLORS = {
  'Industry':          { bg: 'var(--cat-industry)',  text: 'var(--cat-industry-text)' },
  'Technology':        { bg: 'var(--cat-tech)',      text: 'var(--cat-tech-text)' },
  'Business & Finance':{ bg: 'var(--cat-business)',  text: 'var(--cat-business-text)' },
  'Policy & Legal':    { bg: 'var(--cat-policy)',    text: 'var(--cat-policy-text)' },
};

export const FEEDS = [
  // ── Industry ──
  {
    id: 'mbw',
    name: 'Music Business Worldwide',
    url: 'https://www.musicbusinessworldwide.com/feed/',
    category: 'Industry',
    bias: 'neutral'
  },
  {
    id: 'hypebot',
    name: 'Hypebot',
    url: 'https://www.hypebot.com/feed/',
    category: 'Industry',
    bias: 'neutral'
  },
  {
    id: 'dmn',
    name: 'Digital Music News',
    url: 'https://www.digitalmusicnews.com/feed/',
    category: 'Industry',
    bias: 'neutral'
  },
  {
    id: 'cmu',
    name: 'Complete Music Update',
    url: 'https://completemusicupdate.com/feed/',
    category: 'Industry',
    bias: 'neutral'
  },
  {
    id: 'rain',
    name: 'RAIN News',
    url: 'https://rainnews.com/feed/',
    category: 'Industry',
    bias: 'neutral'
  },

  // ── Technology ──
  {
    id: 'techcrunch-music',
    name: 'TechCrunch',
    url: 'https://techcrunch.com/tag/music/feed/',
    category: 'Technology',
    bias: 'neutral'
  },
  {
    id: 'verge-music',
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/music/index.xml',
    category: 'Technology',
    bias: 'neutral'
  },
  {
    id: 'musically',
    name: 'Music Ally',
    url: 'https://musically.com/feed/',
    category: 'Technology',
    bias: 'neutral'
  },

  // ── Business & Finance ──
  {
    id: 'variety-music',
    name: 'Variety',
    url: 'https://variety.com/v/music/feed/',
    category: 'Business & Finance',
    bias: 'neutral'
  },
  {
    id: 'billboard',
    name: 'Billboard',
    url: 'https://www.billboard.com/feed/',
    category: 'Business & Finance',
    bias: 'neutral'
  },
  {
    id: 'pollstar',
    name: 'Pollstar',
    url: 'https://www.pollstar.com/rss',
    category: 'Business & Finance',
    bias: 'neutral'
  },

  // ── Policy & Legal ──
  {
    id: 'riaa',
    name: 'RIAA Newsroom',
    url: 'https://www.riaa.com/feed/',
    category: 'Policy & Legal',
    bias: 'industry-aligned'
  },
  {
    id: 'fmc',
    name: 'Future of Music Coalition',
    url: 'https://futureofmusic.org/feed',
    category: 'Policy & Legal',
    bias: 'artist-advocacy'
  }
];
