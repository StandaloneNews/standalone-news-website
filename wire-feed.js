/* Normalize provider-escaped titles once so rendering, copying and sharing agree.
   Isolated malformed escape sequences are preserved rather than destroying headlines. */
export function cleanHeadline(value) {
  let headline = String(value || '').trim();
  if (/%[0-9a-fA-F]{2}/.test(headline)) {
    headline = headline.replace(/(?:%[0-9a-fA-F]{2})+/g, sequence => {
      try { return decodeURIComponent(sequence); } catch { return sequence; }
    });
  }
  if (/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/i.test(headline)) {
    const decoder = document.createElement('textarea');
    decoder.innerHTML = headline;
    headline = decoder.value;
  }
  return headline.replace(/\s+/g, ' ').trim();
}

const topics = {
  Fed: 'Markets', SEC: 'Markets', CFTC: 'Markets', Business: 'Markets',
  Treasury: 'Government', DOJ: 'Government', FDA: 'Government', Washington: 'Government',
  Politics: 'Government', DEA: 'Regulation', 'US News': 'U.S. news',
};
const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatTime(timestamp) {
  return timeFormat.format(timestamp) + ' UTC';
}

export function itemFrom(row, now) {
  if (!row || typeof row.title !== 'string' || !row.title.trim()
      || typeof row.source !== 'string' || !row.source.trim()) return null;
  const time = Date.parse(row.published_at);
  if (!Number.isFinite(time) || time > now) return null;
  let url;
  try { url = new URL(row.url); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;

  const href = url.href;
  url.hash = '';
  for (const name of [...url.searchParams.keys()]) {
    if (/^(?:utm_.*|at_campaign|at_medium|CMP|ocid)$/i.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  return {
    key: url.origin + url.pathname.replace(/\/$/, '') + url.search,
    title: cleanHeadline(row.title), href, time, source: row.source.trim(),
    topic: Object.hasOwn(topics, row.category) ? topics[row.category]
      : (typeof row.category === 'string' && row.category) || 'Other',
    viaGoogleNews: row.source_type === 'Google News discovery',
    official: /^Official(?:\s|$)/i.test(row.source_type || ''),
  };
}

export async function fetchHeadlines(path) {
  const response = await fetch(path, { cache: 'no-cache', signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error('Feed returned HTTP ' + response.status);
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('Missing headline entries');
  return data;
}

