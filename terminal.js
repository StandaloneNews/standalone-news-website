import { fetchHeadlines, formatTime, itemFrom } from './wire-feed.js?v=2';

(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const refreshInterval = 60_000;
  const pageSize = 40;
  const maxItems = 1_200;
  const headlines = $('headlines');
  const showNew = $('show-new');
  const checkNow = $('check-now');
  const autoRefresh = $('auto-refresh');
  const keyword = $('keyword');
  const topic = $('topic');
  const source = $('source');
  const official = $('official');
  const exclude = $('exclude');
  const params = new URLSearchParams(location.search);
  const topics = ['World', 'U.S. news', 'Markets', 'Economy', 'Government', 'Technology', 'Regulation', 'Science', 'Sports'];
  const initialTopic = topics.includes(params.get('topic')) ? params.get('topic') : '';
  keyword.value = (params.get('q') || '').slice(0, 160);
  official.checked = params.get('official') === '1';
  if (initialTopic) topic.add(new Option(initialTopic, initialTopic, true, true));

  let known = new Map();
  let displayed = [];
  let displayedKeys = new Set();
  let pending = [];
  let limit = pageSize;
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
    known = new Map([...known].sort((a, b) => b[1].time - a[1].time).slice(0, maxItems));
  }

  function options(select, values, allLabel) {
    const selected = select.value;
    select.replaceChildren(new Option(allLabel, ''));
    for (const value of [...new Set(values)].sort((a, b) => a.localeCompare(b))) {
      select.add(new Option(value, value));
    }
    select.value = values.includes(selected) ? selected : '';
  }

  function matches() {
    const terms = keyword.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const omitted = exclude.value.trim().toLowerCase().split(',').map(term => term.trim()).filter(Boolean);
    return displayed.filter(item => {
      const searchable = (item.title + ' ' + item.source + ' ' + item.topic).toLowerCase();
      return (!topic.value || item.topic === topic.value)
        && (!source.value || item.source === source.value)
        && (!official.checked || item.official)
        && terms.every(term => searchable.includes(term))
        && !omitted.some(term => searchable.includes(term));
    });
  }

  function renderItems() {
    const filtered = matches();
    const rows = filtered.slice(0, limit);
    const fragment = document.createDocumentFragment();
    for (const item of rows) {
      const li = node('li', undefined, 'row');
      const time = node('time', formatTime(item.time));
      time.dateTime = new Date(item.time).toISOString();
      const detail = node('div');
      const link = node('a', item.title, 'row-title');
      link.href = item.href;
      const meta = node('p', undefined, 'row-meta');
      meta.append(node('span', item.source), node('span', item.topic));
      if (item.viaGoogleNews) {
        meta.append(node('span', 'via Google News'));
        time.title = 'Timestamp supplied by Google News';
      }
      if (item.official) meta.append(node('span', 'Official source', 'official'));
      detail.append(link, meta);
      li.append(time, detail);
      fragment.append(li);
    }
    headlines.replaceChildren(fragment);
    $('paging').hidden = rows.length >= filtered.length;
    const count = $('result-count');
    count.hidden = false;
    count.textContent = filtered.length
      ? 'Showing ' + rows.length + ' of ' + filtered.length + ' headlines'
      : displayed.length ? 'No headlines match these filters.' : 'No headlines are available yet.';
  }

  function showCurrent() {
    displayed = [...known.values()];
    displayedKeys = new Set(known.keys());
    pending = [];
    options(topic, [...topics, ...displayed.map(item => item.topic)], 'All topics');
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
    setText($('feed-status'), status);
    const connection = [directStatus, available, Boolean(snapshotAt)].join(':');
    if (announce || connection !== lastConnection) setText($('connection-status'), status);
    lastConnection = connection;
    if (directSources.length) {
      $('feed-details').hidden = false;
      $('feed-sources').replaceChildren(...directSources.map(feed =>
        node('li', feed.source + (feed.via === 'Google News' ? ' via Google News' : '')
          + (feed.available ? ' · Responding' : ' · Unavailable'))));
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

  for (const filter of [keyword, exclude, topic, source, official]) {
    filter.addEventListener(filter instanceof HTMLInputElement && filter.type !== 'checkbox' ? 'input' : 'change', () => {
      limit = pageSize;
      renderItems();
    });
  }
  $('clear-filters').addEventListener('click', () => {
    keyword.value = '';
    exclude.value = '';
    topic.value = '';
    source.value = '';
    official.checked = false;
    limit = pageSize;
    renderItems();
  });
  $('show-more').addEventListener('click', () => {
    const firstNew = limit;
    limit += pageSize;
    renderItems();
    headlines.querySelectorAll('a')[firstNew]?.focus();
  });
  showNew.addEventListener('click', () => {
    if (!pending.length) return;
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
  filterPanel.open = Boolean(initialTopic || official.checked);
  filterPanel.hidden = false;
  $('wire-actions').hidden = false;
  $('headline-search').hidden = false;
  setInterval(() => {
    if (autoRefresh.checked && !document.hidden) check();
  }, refreshInterval);
  document.addEventListener('visibilitychange', refreshIfDue);
  check();
})();
