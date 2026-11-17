import terminalSources from '../../data/terminal-sources.json' with { type: 'json' };

const SOURCES = [
  { name: 'Federal Reserve', topic: 'Markets', official: true, url: 'https://www.federalreserve.gov/feeds/press_all.xml' },
  { name: 'Bureau of Labor Statistics', topic: 'Economy', official: true, url: 'https://www.bls.gov/feed/bls_latest.rss' },
  { name: 'Department of Justice', topic: 'Government', official: true, url: 'https://www.justice.gov/news/rss?type=press_release&m=1' },
  { name: 'Food and Drug Administration', topic: 'Government', official: true, url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml' },
  { name: 'BBC News', topic: 'World', official: false, url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { name: 'CNBC', topic: 'Markets', official: false, url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { name: 'The Guardian', topic: 'US News', official: false, url: 'https://www.theguardian.com/us/rss' },
  { name: 'PBS News', topic: 'US News', official: false, url: 'https://www.pbs.org/newshour/feeds/rss/headlines' },
  { name: 'NPR', topic: 'US News', official: false, url: 'https://feeds.npr.org/1001/rss.xml' },
  { name: 'TechCrunch', topic: 'Technology', official: false, url: 'https://techcrunch.com/feed/' },
  { name: 'Al Jazeera English', topic: 'World', official: false, url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  ...terminalSources.filter(source => source.direct),
];

const FEED_LIMIT = 512 * 1024;
const MAX_AGE = 72 * 60 * 60 * 1000;
const ENTITIES = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>' };

function decodeXml(value) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>|&(#x[\da-f]+|#\d+|amp|apos|quot|lt|gt);/gi,
    (raw, cdata, entity) => {
      if (cdata !== undefined) return cdata;
      const name = entity.toLowerCase();
      if (name[0] !== '#') return ENTITIES[name];
      const code = name.startsWith('#x') ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
        ? String.fromCodePoint(code) : raw;
    });
}

function field(item, tag) {
  const pattern = new RegExp('<' + tag + '(?:\\s[^>]*)?>((?:<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|[^<]|<(?!/' + tag + '\\s*>))*)</' + tag + '\\s*>', 'i');
  return decodeXml(item.match(pattern)?.[1] || '').trim();
}

function atomLink(entry) {
  for (const [, link] of entry.matchAll(/<link(\s+[^>]+)>/gi)) {
    const attributes = Object.fromEntries(
      Array.from(link.matchAll(/\s(href|rel)\s*=\s*(["'])(.*?)\2/gi),
        ([, name, , value]) => [name.toLowerCase(), decodeXml(value)]),
    );
    if (attributes.href && (!attributes.rel || attributes.rel === 'alternate')) return attributes.href;
  }
  return '';
}

export function parseFeed(xml, source, now) {
  const format = xml.match(/<(rss|rdf:RDF|feed|urlset)(?:\s|>)/i)?.[1].toLowerCase();
  const sitemap = source.format === 'news-sitemap';
  if (!format || sitemap !== (format === 'urlset')) throw new Error('Unexpected publisher XML format');
  const atom = format === 'feed';
  const rows = sitemap ? /<url(?:\s[^>]*)?>([\s\S]*?)<\/url\s*>/gi
    : atom ? /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry\s*>/gi
      : /<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi;
  const publisherHost = sitemap ? new URL(source.url).hostname : '';
  const entries = [];
  let count = 0;
  for (const [, item] of xml.matchAll(rows)) {
    if (!sitemap && count++ === 25) break;
    const title = field(item, sitemap ? 'news:title' : 'title').replace(/\s+/g, ' ').slice(0, 350);
    const dateText = sitemap ? field(item, 'news:publication_date')
      : atom ? field(item, 'published') || field(item, 'updated')
        : field(item, 'pubDate') || field(item, 'dc:date');
    // An ambiguous local time cannot be compared reliably to entries from other feeds.
    const time = /(?:[zZ]|[+-]\d{2}:?\d{2}|UT|UTC|GMT|[ECMP][SD]T)(?:\s*\([^)]*\))?$/i.test(dateText)
      ? Date.parse(dateText) : NaN;
    const link = atom ? atomLink(item) : field(item, sitemap ? 'loc' : 'link');
    let url;
    try { url = new URL(link, source.url); } catch { continue; }
    if (!title || !link || url.protocol !== 'https:' || url.username || url.password
        || (sitemap && url.hostname !== publisherHost)
        || !Number.isFinite(time) || time > now || time < now - MAX_AGE) continue;
    entries.push({
      title, url: url.href, published_at: new Date(time).toISOString(),
      source: source.name, category: source.topic,
      source_type: source.official ? 'Official direct' : sitemap ? 'Publisher sitemap' : 'Publisher RSS',
    });
  }
  // News sitemaps need not be ordered by publication time.
  return sitemap ? entries.sort((a, b) => b.published_at.localeCompare(a.published_at)).slice(0, 25) : entries;
}

async function readFeed(response) {
  if (!response.body) throw new Error('Missing feed body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let xml = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return xml + decoder.decode();
      bytes += value.byteLength;
      if (bytes > FEED_LIMIT) throw new Error('Feed exceeds size limit');
      xml += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

async function fetchFeed(source, deadline) {
  const response = await fetch(source.url, {
    headers: {
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      'User-Agent': 'StandaloneNewsRSS/1.0 (+https://standalonenews.com/)',
    },
    signal: AbortSignal.any([deadline, AbortSignal.timeout(4300)]),
    cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': 60, '400-599': 60 } },
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new Error('Source returned HTTP ' + response.status);
  }
  return parseFeed(await readFeed(response), source, Date.now());
}

export async function onRequestGet({ request, waitUntil }) {
  const cacheKey = new URL('/api/wire', request.url).href;
  const cache = caches.default;
  const headers = { 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' };
  try {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  } catch { /* Respond even if the edge cache is unavailable. */ }

  // Keep simultaneous outbound connections bounded and leave time to respond
  // before the terminal's 12-second request timeout.
  const deadline = AbortSignal.timeout(8_800);
  const results = Array(SOURCES.length).fill(null);
  let nextSource = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (!deadline.aborted && nextSource < SOURCES.length) {
      const index = nextSource++;
      try {
        results[index] = await fetchFeed(SOURCES[index], deadline);
      } catch { /* Return the remaining sources if this feed is unavailable. */ }
    }
  }));
  const feeds = results.map((entries, index) => ({
    source: SOURCES[index].name, available: entries !== null,
  }));
  const items = results.flatMap(entries => entries ?? []);
  const response = Response.json({ checked_at: new Date().toISOString(), feeds, items }, { headers });
  waitUntil(cache.put(cacheKey, response.clone()).catch(() => {}));
  return response;
}
