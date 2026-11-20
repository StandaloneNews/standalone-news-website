import { fetchHeadlines, formatTime, itemFrom } from './wire-feed.js?v=2';

(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const refreshInterval = 60_000;
  const headlines = $('headlines');
  const pageSize = $('headline-page-size');
  const previousPage = $('headlines-previous');
  const nextPage = $('headlines-next');
  const pageSizePreference = 'standalone-headlines-per-page';
  const countFormat = new Intl.NumberFormat('en-US');
  const showNew = $('show-new');
  const checkNow = $('check-now');
  const autoRefresh = $('auto-refresh');
  const keyword = $('keyword');
  const quickTopics = $('quick-topics');
  const topicButtons = new Map();
  const source = $('source');
  const official = $('official');
  const exclude = $('exclude');
  const params = new URLSearchParams(location.search);
  const topics = ['Markets', 'World', 'Sports', 'U.S. news', 'Economy', 'Government', 'Technology', 'Science', 'Regulation'];
  let activeTopic = params.get('topic') || '';
  keyword.value = (params.get('q') || '').slice(0, 160);
  official.checked = params.get('official') === '1';

  try {
    const savedSize = localStorage.getItem(pageSizePreference);
    if ([...pageSize.options].some(option => option.value === savedSize)) pageSize.value = savedSize;
  } catch { /* The browser can block storage. Use the current selection. */ }

  let page = 1;
  let known = new Map();
  let displayed = [];
  let displayedKeys = new Set();
  let pending = [];
  let checking = false;
  let lastCheck = 0;
  let snapshotAt = 0;
  let directAt = 0;
  let directStatus = 'unavailable';
  let directSources = [];
  let lastConnection = '';

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function addItems(items) {
    const now = Date.now();
    for (const row of items) {
      const item = itemFrom(row, now);
      if (!item) continue;
      const previous = known.get(item.key);
      if (!previous || (item.official && !previous.official)) known.set(item.key, item);
    }
    known = new Map([...known].sort((a, b) => b[1].time - a[1].time));
  }

  function options(select, values, allLabel) {
    const selected = select.value;
    select.replaceChildren(new Option(allLabel, ''));
    for (const value of [...new Set(values)].sort((a, b) => a.localeCompare(b))) {
      select.add(new Option(value, value));
    }
    select.value = values.includes(selected) ? selected : '';
  }

  function addTopicButtons(values) {
    for (const value of values) {
      if (topicButtons.has(value)) continue;
      const button = node('button', value || 'All');
      button.type = 'button';
      button.setAttribute('aria-pressed', String(value === activeTopic));
      button.addEventListener('click', () => {
        activeTopic = value;
        firstPage();
      });
      topicButtons.set(value, button);
      quickTopics.append(button);
    }
  }

  function matches() {
    const terms = keyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const omitted = exclude.value.trim().toLowerCase().split(',').map(term => term.trim()).filter(Boolean);
    return displayed.filter(item => {
      const searchable = (item.title + ' ' + item.source + ' ' + item.topic).toLowerCase();
      return (!activeTopic || item.topic === activeTopic)
        && (!source.value || item.source === source.value)
        && (!official.checked || item.official)
        && terms.every(term => searchable.includes(term))
        && !omitted.some(term => searchable.includes(term));
    });
  }

  function renderItems() {
    for (const [value, button] of topicButtons) {
      button.setAttribute('aria-pressed', String(value === activeTopic));
    }
    const filtered = matches();
    const size = Number(pageSize.value);
    const pageCount = Math.max(1, Math.ceil(filtered.length / size));
    page = Math.min(pageCount, Math.max(1, page));
    const offset = (page - 1) * size;
    const rows = filtered.slice(offset, offset + size);
    const fragment = document.createDocumentFragment();
    for (const item of rows) {
      const li = node('li', undefined, 'row');
      const time = node('time', formatTime(item.time));
      time.dateTime = new Date(item.time).toISOString();
      const detail = node('div');
      const link = node('button', item.title, 'row-title');
      link.type = 'button';
      link.setAttribute('aria-haspopup', 'dialog');
      link.addEventListener('click', () => document.dispatchEvent(
        new CustomEvent('standalone-open-story', { detail: item })
      ));
      const meta = node('p', undefined, 'row-meta');
      meta.append(node('span', item.source), node('span', item.topic));
      if (item.viaGoogleNews) {
        meta.append(node('span', 'via Google News'));
        time.title = 'Timestamp supplied by Google News';
      }
      if (item.official) meta.append(node('span', 'Official source', 'official'));
      meta.append(time);
      const quickShare = node('button', 'Share', 'row-share');
      quickShare.type = 'button';
      quickShare.setAttribute('aria-label', 'Share: ' + item.title);
      quickShare.addEventListener('click', () => document.dispatchEvent(
        new CustomEvent('standalone-open-story', { detail: item })
      ));
      detail.append(link, meta);
      li.append(detail, quickShare);
      fragment.append(li);
    }
    headlines.start = offset + 1;
    headlines.replaceChildren(fragment);
    $('headline-display').hidden = false;
    const count = $('result-count');
    const first = countFormat.format(offset + 1);
    const last = countFormat.format(offset + rows.length);
    const range = rows.length === 1 ? first : first + '–' + last;
    count.textContent = rows.length
      ? 'Showing ' + range + ' of ' + countFormat.format(filtered.length)
        + (filtered.length === 1 ? ' headline' : ' headlines')
      : displayed.length ? 'No headlines match these filters.' : 'No headlines are available yet.';
    $('headline-pagination').hidden = pageCount <= 1;
    previousPage.disabled = page <= 1;
    nextPage.disabled = page >= pageCount;
    $('headline-page-number').textContent = 'Page ' + countFormat.format(page) + ' of ' + countFormat.format(pageCount);
  }

  function showCurrent() {
    displayed = [...known.values()];
    displayedKeys = new Set(known.keys());
    pending = [];
    const availableTopics = new Set(displayed.map(item => item.topic));
    addTopicButtons([...availableTopics].sort((a, b) => a.localeCompare(b)));
    if (!topicButtons.has(activeTopic)) activeTopic = '';
    options(source, displayed.map(item => item.source), 'All sources');
    renderItems();
  }

  function renderPending() {
    const label = pending.length === 1 ? 'Show 1 new headline' : 'Show ' + pending.length + ' new headlines';
    if (pending.length || document.activeElement === showNew) showNew.hidden = false;
    else showNew.hidden = true;
    showNew.textContent = pending.length ? label : 'Headlines up to date';
    showNew.setAttribute('aria-disabled', String(!pending.length));
    const available = pending.length + (pending.length === 1 ? ' new headline' : ' new headlines');
    setText($('new-status'), pending.length ? available + ' available.' : '');
  }

  function setText(element, value) {
    if (element.textContent !== value) element.textContent = value;
  }

  function renderStatus(announce = false) {
    const available = directSources.filter(feed => feed.available).length;
    let status;
    if (directStatus === 'available') {
      status = 'Live feeds checked ' + formatTime(directAt) + ' · '
        + available + ' of ' + directSources.length + ' sources responding';
    } else if (snapshotAt) {
      status = 'News wire snapshot from ' + formatTime(snapshotAt) + ' · Live feeds unavailable';
    } else if (displayed.length) {
      status = 'Showing the last loaded headlines · Refresh unavailable';
    } else {
      status = 'Headline feeds are unavailable. Use Refresh to try again.';
    }
    if (!autoRefresh.checked) status += ' · Auto-refresh paused';
    const compactStatus = directStatus === 'available' ? 'Checked ' + formatTime(directAt)
      : snapshotAt ? 'Snapshot from ' + formatTime(snapshotAt) : status;
    setText($('feed-status'), compactStatus + (autoRefresh.checked || compactStatus === status ? '' : ' · Paused'));
    setText($('source-status'), status);
    const connection = [directStatus, available, Boolean(snapshotAt)].join(':');
    if (announce || connection !== lastConnection) setText($('connection-status'), status);
    lastConnection = connection;
    if (directSources.length) {
      $('feed-details').hidden = false;
      $('feed-sources').replaceChildren(...directSources.map(feed =>
        node('li', feed.source + (feed.available ? ' · Responding' : ' · Unavailable'))));
    }
  }

  async function check(manual = false) {
    if (checking) return;
    checking = true;
    lastCheck = Date.now();
    checkNow.setAttribute('aria-disabled', 'true');

    try {
      const [direct, snapshot] = await Promise.allSettled([fetchHeadlines('./api/wire'), fetchHeadlines('./data/news.json')]);
      if (direct.status === 'fulfilled' && Array.isArray(direct.value.feeds)
          && Number.isFinite(Date.parse(direct.value.checked_at))) {
        directAt = Date.parse(direct.value.checked_at);
        directSources = direct.value.feeds.filter(feed => feed && typeof feed.source === 'string');
        directStatus = directSources.some(feed => feed.available) ? 'available' : 'unavailable';
        if (directStatus === 'available') addItems(direct.value.items);
      } else {
        directStatus = 'unavailable';
        directSources = [];
        $('feed-details').hidden = true;
      }
      if (snapshot.status === 'fulfilled') {
        snapshotAt = Date.parse(snapshot.value.updated_at) || 0;
        addItems(snapshot.value.items);
      }

      if ((!displayed.length || manual) && known.size) showCurrent();
      else if (displayed.length) pending = [...known.keys()].filter(key => !displayedKeys.has(key));
      else renderItems();

      document.dispatchEvent(new CustomEvent('terminal-headlines', { detail: [...known.values()] }));
      renderStatus(manual);
      renderPending();
    } finally {
      checking = false;
      checkNow.setAttribute('aria-disabled', 'false');
    }
  }

  function firstPage() {
    page = 1;
    renderItems();
  }

  function changePage(direction) {
    page += direction;
    renderItems();
    $('feed-list').scrollIntoView({ block: 'start', behavior: 'instant' });
    headlines.querySelector('button.row-title')?.focus({ preventScroll: true });
  }

  previousPage.addEventListener('click', () => changePage(-1));
  nextPage.addEventListener('click', () => changePage(1));
  pageSize.addEventListener('change', () => {
    try { localStorage.setItem(pageSizePreference, pageSize.value); }
    catch { /* Pagination still works without stored preferences. */ }
    firstPage();
  });

  for (const filter of [keyword, exclude, source, official]) {
    filter.addEventListener(filter instanceof HTMLInputElement && filter.type !== 'checkbox' ? 'input' : 'change', firstPage);
  }
  $('clear-filters').addEventListener('click', () => {
    keyword.value = '';
    exclude.value = '';
    activeTopic = '';
    source.value = '';
    official.checked = false;
    firstPage();
  });
  showNew.addEventListener('click', () => {
    if (!pending.length) return;
    page = 1;
    showCurrent();
    renderPending();
  });
  showNew.addEventListener('blur', () => {
    if (!pending.length) showNew.hidden = true;
  });
  checkNow.addEventListener('click', () => check(true));
  autoRefresh.addEventListener('change', () => {
    renderStatus(true);
    if (autoRefresh.checked) check();
  });

  function refreshIfDue() {
    if (autoRefresh.checked && !document.hidden && Date.now() - lastCheck >= refreshInterval) check();
  }

  const filterPanel = $('filter-panel');
  filterPanel.open = official.checked;
  filterPanel.hidden = false;
  addTopicButtons(['', ...topics]);
  quickTopics.hidden = false;
  $('wire-actions').hidden = false;
  $('headline-search').hidden = false;
  setInterval(() => {
    if (autoRefresh.checked && !document.hidden) check();
  }, refreshInterval);
  document.addEventListener('visibilitychange', refreshIfDue);
  check();
})();
