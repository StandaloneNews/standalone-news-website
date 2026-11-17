import { fetchHeadlines, formatTime, itemFrom } from './wire-feed.js?v=2';

const section = document.getElementById('news-terminal');
const status = document.getElementById('terminal-preview-status');
const list = document.getElementById('terminal-preview-list');

async function latest(path) {
  const { items } = await fetchHeadlines(path);
  const now = Date.now();
  const rows = items.map(item => itemFrom(item, now)).filter(Boolean).sort((a, b) => b.time - a.time);
  const headlines = new Map();
  for (const row of rows) {
    if (!headlines.has(row.key)) headlines.set(row.key, row);
    if (headlines.size === 8) break;
  }
  return [...headlines.values()];
}

async function loadPreview() {
  status.textContent = 'Loading headlines…';
  let rows = await latest('./api/wire').catch(() => []);
  let snapshot = false;
  if (!rows.length) {
    rows = await latest('./data/news.json').catch(() => []);
    snapshot = true;
  }
  if (!rows.length) {
    status.textContent = 'Headlines are temporarily unavailable here.';
    return;
  }

  for (const row of rows) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = row.href;
    link.textContent = row.title;
    const meta = document.createElement('p');
    meta.className = 'terminal-preview-meta';
    const time = document.createElement('time');
    time.dateTime = new Date(row.time).toISOString();
    time.textContent = formatTime(row.time);
    meta.append(row.source, row.topic ? ' · ' + row.topic : '');
    if (row.viaGoogleNews) meta.append(' · via Google News');
    if (row.official) {
      const badge = document.createElement('span');
      badge.className = 'terminal-preview-official';
      badge.textContent = 'Official source';
      meta.append(badge);
    }
    const story = document.createElement('div');
    story.append(link, meta);
    item.append(time, story);
    list.append(item);
  }
  list.hidden = false;
  status.textContent = snapshot ? 'Headlines from the latest news wire snapshot.' : 'Latest headlines from direct feeds.';
}

if (new URLSearchParams(location.search).get('demo') === '1') {
  status.textContent = 'Live terminal headlines are hidden in this preview.';
} else if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting)) {
      observer.disconnect();
      loadPreview();
    }
  });
  observer.observe(section);
} else {
  loadPreview();
}
