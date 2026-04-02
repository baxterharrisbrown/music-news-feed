/**
 * Music News Feed — Main Application
 *
 * Architecture:
 * 1. On load, show skeleton cards and check localStorage cache
 * 2. If cache is fresh (< 2 hours), render immediately, then refresh in background
 * 3. Fetch all feeds concurrently via Promise.allSettled()
 * 4. Render articles progressively as each feed resolves
 * 5. On total failure, fall back to localStorage → feeds-cache.json → error state
 */

import { FEEDS, CATEGORIES } from './feeds.js';
import { fetchAndParseFeed, formatRelativeDate } from './parser.js';

// ── Constants ──
const CACHE_KEY = 'mnf_articles';
const CACHE_TS_KEY = 'mnf_cache_ts';
const CACHE_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

// ── State ──
let allArticles = [];
let activeCategory = 'all';
let activeSources = new Set(); // empty = all selected
let searchQuery = '';
let loadStartTime = null;

// ── DOM References ──
const articleGrid = document.getElementById('articleGrid');
const statusMessage = document.getElementById('statusMessage');
const articleCount = document.getElementById('articleCount');
const lastUpdated = document.getElementById('lastUpdated');
const refreshBtn = document.getElementById('refreshBtn');
const categoryFilters = document.getElementById('categoryFilters');
const searchInput = document.getElementById('searchInput');
const sourceDropdownBtn = document.getElementById('sourceDropdownBtn');
const sourceDropdown = document.getElementById('sourceDropdown');
const cacheNotice = document.getElementById('cacheNotice');

// ═══════════════════════════════════════════
// Initialization
// ═══════════════════════════════════════════

init();

async function init() {
  renderSkeletons();
  bindEvents();
  populateSourceDropdown();

  const cached = loadCache();

  if (cached) {
    allArticles = cached;
    renderArticles();
    updateTimestamp();
    // Refresh in background
    fetchAllFeeds(true);
  } else {
    await fetchAllFeeds(false);
  }
}

// ═══════════════════════════════════════════
// Feed Fetching
// ═══════════════════════════════════════════

/**
 * Fetch all feeds concurrently. Renders articles progressively as each resolves.
 * @param {boolean} isBackground — if true, don't show skeletons
 */
async function fetchAllFeeds(isBackground) {
  if (!isBackground) {
    renderSkeletons();
  }

  setRefreshLoading(true);
  loadStartTime = Date.now();

  const seen = new Set(allArticles.map(a => a.id));
  let newArticles = isBackground ? [...allArticles] : [];
  let anySuccess = false;

  // Launch all fetches concurrently, render progressively
  const promises = FEEDS.map(async (feed) => {
    try {
      const articles = await fetchAndParseFeed(feed);
      anySuccess = true;

      // Deduplicate and merge
      for (const article of articles) {
        if (!seen.has(article.id)) {
          seen.add(article.id);
          newArticles.push(article);
        }
      }

      // Sort and render after each feed completes (progressive rendering)
      allArticles = sortByDate(newArticles);
      renderArticles();
    } catch (err) {
      console.warn(`Feed failed: ${feed.name} (${feed.url})`, err.message);
    }
  });

  await Promise.allSettled(promises);

  if (anySuccess) {
    allArticles = sortByDate(newArticles);
    saveCache(allArticles);
    renderArticles();
    updateTimestamp();
  } else if (!isBackground) {
    // All feeds failed — try fallbacks
    await handleTotalFailure();
  }

  setRefreshLoading(false);
}

/**
 * When all live feeds fail: try localStorage, then feeds-cache.json, then show error.
 */
async function handleTotalFailure() {
  const cached = loadCache();
  if (cached && cached.length > 0) {
    allArticles = cached;
    renderArticles();
    showCacheNotice(true);
    return;
  }

  // Last resort: static cache from GitHub Actions
  try {
    const response = await fetch('public/feeds-cache.json');
    if (response.ok) {
      const data = await response.json();
      if (data.articles && data.articles.length > 0) {
        // Rehydrate dates
        allArticles = data.articles.map(a => ({
          ...a,
          date: new Date(a.date)
        }));
        renderArticles();
        showCacheNotice(true);
        return;
      }
    }
  } catch (e) {
    // Static cache also unavailable
  }

  showErrorState();
}

// ═══════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════

function renderArticles() {
  const filtered = getFilteredArticles();

  articleCount.textContent = filtered.length === allArticles.length
    ? `${filtered.length} articles`
    : `Showing ${filtered.length} of ${allArticles.length} articles`;

  if (filtered.length === 0 && allArticles.length > 0) {
    articleGrid.innerHTML = '';
    showNoResults();
    return;
  }

  statusMessage.innerHTML = '';

  // Build DOM fragment for performance
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < filtered.length; i++) {
    const article = filtered[i];
    const card = createArticleCard(article, i);
    fragment.appendChild(card);
  }

  articleGrid.innerHTML = '';
  articleGrid.appendChild(fragment);
}

function createArticleCard(article, index) {
  const card = document.createElement('article');
  card.className = 'article-card';
  card.style.animationDelay = `${Math.min(index * 30, 300)}ms`;

  const badgeClass = getCategoryBadgeClass(article.category);
  const relativeDate = formatRelativeDate(article.date);

  // Build card with safe text content (no innerHTML with feed data)
  const meta = document.createElement('div');
  meta.className = 'card-meta';

  const sourceName = document.createElement('span');
  sourceName.className = 'source-name';
  sourceName.textContent = article.source;

  const badge = document.createElement('span');
  badge.className = `category-badge ${badgeClass}`;
  badge.textContent = article.category;

  meta.appendChild(sourceName);
  meta.appendChild(badge);

  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  const titleLink = document.createElement('a');
  titleLink.href = article.link;
  titleLink.target = '_blank';
  titleLink.rel = 'noopener noreferrer';
  titleLink.textContent = article.title;
  titleEl.appendChild(titleLink);

  const dateEl = document.createElement('time');
  dateEl.className = 'card-date';
  dateEl.textContent = relativeDate;
  if (article.date && article.date.getTime() > 0) {
    dateEl.setAttribute('datetime', article.date.toISOString());
  }

  card.appendChild(meta);
  card.appendChild(titleEl);
  card.appendChild(dateEl);

  if (article.description) {
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = article.description;
    card.appendChild(desc);
  }

  return card;
}

function getCategoryBadgeClass(category) {
  const map = {
    'Industry': 'badge-industry',
    'Technology': 'badge-technology',
    'Business & Finance': 'badge-business',
    'Policy & Legal': 'badge-policy',
  };
  return map[category] || '';
}

function renderSkeletons() {
  const fragment = document.createDocumentFragment();

  for (let i = 0; i < FEEDS.length; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-card';
    skeleton.innerHTML = `
      <div class="skeleton-line skeleton-sm"></div>
      <div class="skeleton-line skeleton-lg"></div>
      <div class="skeleton-line skeleton-md"></div>
      <div class="skeleton-line skeleton-xl"></div>
    `;
    fragment.appendChild(skeleton);
  }

  articleGrid.innerHTML = '';
  articleGrid.appendChild(fragment);
  statusMessage.innerHTML = '';
}

function showNoResults() {
  statusMessage.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'status-message';
  const p = document.createElement('p');
  p.textContent = 'No articles match your filter. Try broadening your search.';
  msg.appendChild(p);
  statusMessage.appendChild(msg);
}

function showErrorState() {
  articleGrid.innerHTML = '';
  statusMessage.innerHTML = '';
  const msg = document.createElement('div');
  msg.className = 'status-message';

  const p = document.createElement('p');
  p.textContent = 'Unable to load feeds. Please check your connection and try again.';

  const btn = document.createElement('button');
  btn.className = 'retry-btn';
  btn.textContent = 'Retry';
  btn.type = 'button';
  btn.addEventListener('click', () => fetchAllFeeds(false));

  msg.appendChild(p);
  msg.appendChild(btn);
  statusMessage.appendChild(msg);
}

function showCacheNotice(visible) {
  cacheNotice.hidden = !visible;
}

// ═══════════════════════════════════════════
// Filtering
// ═══════════════════════════════════════════

function getFilteredArticles() {
  let filtered = allArticles;

  // Category filter
  if (activeCategory !== 'all') {
    filtered = filtered.filter(a => a.category === activeCategory);
  }

  // Source filter
  if (activeSources.size > 0) {
    filtered = filtered.filter(a => activeSources.has(a.sourceId));
  }

  // Search filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.description && a.description.toLowerCase().includes(q))
    );
  }

  return filtered;
}

// ═══════════════════════════════════════════
// Event Binding
// ═══════════════════════════════════════════

function bindEvents() {
  // Refresh button
  refreshBtn.addEventListener('click', () => {
    showCacheNotice(false);
    allArticles = [];
    fetchAllFeeds(false);
  });

  // Category pills
  categoryFilters.addEventListener('click', (e) => {
    const pill = e.target.closest('.pill');
    if (!pill) return;

    categoryFilters.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeCategory = pill.dataset.category;
    renderArticles();
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderArticles();
  });

  // Source dropdown toggle
  sourceDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    sourceDropdown.classList.toggle('open');
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.source-filter')) {
      sourceDropdown.classList.remove('open');
    }
  });
}

function populateSourceDropdown() {
  const fragment = document.createDocumentFragment();

  for (const feed of FEEDS) {
    const label = document.createElement('label');
    label.className = 'source-option';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = feed.id;
    checkbox.checked = true;

    checkbox.addEventListener('change', () => {
      handleSourceChange();
    });

    const text = document.createTextNode(feed.name);

    label.appendChild(checkbox);
    label.appendChild(text);
    fragment.appendChild(label);
  }

  sourceDropdown.appendChild(fragment);
}

function handleSourceChange() {
  const checkboxes = sourceDropdown.querySelectorAll('input[type="checkbox"]');
  const checked = [];

  checkboxes.forEach(cb => {
    if (cb.checked) checked.push(cb.value);
  });

  // If all are checked, treat as "no filter"
  if (checked.length === FEEDS.length) {
    activeSources = new Set();
    sourceDropdownBtn.textContent = 'All Sources';
  } else {
    activeSources = new Set(checked);
    sourceDropdownBtn.textContent = `${checked.length} source${checked.length === 1 ? '' : 's'}`;
  }

  renderArticles();
}

// ═══════════════════════════════════════════
// Cache (localStorage)
// ═══════════════════════════════════════════

function saveCache(articles) {
  try {
    const serialized = articles.map(a => ({
      ...a,
      date: a.date.toISOString()
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify(serialized));
    localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
  } catch (e) {
    console.warn('Failed to save cache:', e.message);
  }
}

function loadCache() {
  try {
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (!ts) return null;

    const age = Date.now() - parseInt(ts, 10);
    if (age > CACHE_MAX_AGE_MS) return null;

    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed.map(a => ({
      ...a,
      date: new Date(a.date)
    }));
  } catch (e) {
    return null;
  }
}

// ═══════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════

function sortByDate(articles) {
  return [...articles].sort((a, b) => b.date - a.date);
}

function updateTimestamp() {
  const now = new Date();
  lastUpdated.textContent = `Updated ${formatRelativeDate(now)}`;
}

function setRefreshLoading(loading) {
  refreshBtn.classList.toggle('loading', loading);
}
