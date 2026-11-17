const element = id => document.getElementById(id);

const account = element('x-account');
const xLink = element('x-profile-link');
const xButton = element('load-x');
const xStatus = element('x-status');
const xHost = element('x-timeline');
let xScript;
let xRequest = 0;

function xWidgets() {
  if (window.twttr?.widgets?.createTimeline) return Promise.resolve(window.twttr.widgets);
  if (xScript) return xScript;
  xScript = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      xScript = undefined;
      reject(new Error('X widgets unavailable'));
    };
    const timer = window.setTimeout(fail, 12_000);
    script.async = true;
    script.src = 'https://platform.twitter.com/widgets.js';
    script.addEventListener('error', fail, { once: true });
    script.addEventListener('load', () => {
      const finish = api => {
        if (!api?.widgets?.createTimeline) return fail();
        window.clearTimeout(timer);
        resolve(api.widgets);
      };
      if (window.twttr?.widgets?.createTimeline) finish(window.twttr);
      else if (window.twttr?.ready) window.twttr.ready(finish);
      else fail();
    }, { once: true });
    document.head.append(script);
  });
  return xScript;
}

function resetX() {
  xRequest++;
  xHost.replaceChildren();
  xLink.href = 'https://x.com/' + account.value;
  xStatus.textContent = 'Load @' + account.value + ' or open the profile on X.';
  xButton.removeAttribute('aria-disabled');
}
async function loadTimeline() {
  if (xButton.getAttribute('aria-disabled') === 'true') return;
  const request = ++xRequest;
  const handle = account.value;
  xButton.setAttribute('aria-disabled', 'true');
  xStatus.textContent = 'Loading @' + handle + '…';
  const container = document.createElement('div');
  xHost.replaceChildren(container);
  let timer;
  try {
    const widgets = await xWidgets();
    if (request !== xRequest) return;
    const frame = await Promise.race([
      widgets.createTimeline({ sourceType: 'profile', screenName: handle }, container, {
        theme: 'dark', height: 560, dnt: true,
      }),
      new Promise((_, reject) => { timer = window.setTimeout(() => reject(new Error('Timeline timed out')), 12_000); }),
    ]);
    if (!frame) throw new Error('No timeline returned');
    if (request !== xRequest) return;
    if (frame instanceof HTMLIFrameElement && !frame.title) frame.title = 'Public posts by @' + handle;
    xStatus.textContent = 'Timeline for @' + handle + '.';
  } catch {
    if (request === xRequest) {
      xHost.replaceChildren();
      xStatus.textContent = 'The timeline is unavailable here. Open the account on X to see its posts.';
    }
  } finally {
    window.clearTimeout(timer);
    if (request === xRequest) xButton.removeAttribute('aria-disabled');
  }
}

xButton.addEventListener('click', loadTimeline);
account.addEventListener('change', () => {
  resetX();
  loadTimeline();
});

const symbol = element('market-symbol');
const chartLink = element('market-chart-link');
const chart = element('market-chart');
const quotes = element('market-quotes');

function mountMarket(host, type, settings, name) {
  host.hidden = false;
  const wrap = document.createElement('div');
  wrap.className = 'tradingview-widget-container';
  const slot = document.createElement('div');
  slot.className = 'tradingview-widget-container__widget';
  wrap.append(slot);
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-' + type + '.js';
  script.textContent = JSON.stringify(settings);
  const unavailable = () => {
    if (!host.contains(wrap)) return;
    host.hidden = true;
    host.replaceChildren();
    const notice = document.createElement('p');
    notice.className = 'panel-note';
    notice.textContent = name + ' is unavailable here. Use the TradingView link.';
    host.after(notice);
    notice.dataset.marketFallback = host.id;
  };
  const observer = new MutationObserver(() => {
    const frame = wrap.querySelector('iframe');
    if (!frame) return;
    if (!frame.title) frame.title = name + ' by TradingView';
    observer.disconnect();
    window.clearTimeout(timer);
  });
  observer.observe(wrap, { childList: true, subtree: true });
  const timer = window.setTimeout(() => { observer.disconnect(); unavailable(); }, 16_000);
  script.addEventListener('error', () => {
    observer.disconnect();
    window.clearTimeout(timer);
    unavailable();
  }, { once: true });
  document.querySelector('[data-market-fallback="' + host.id + '"]')?.remove();
  wrap.append(script);
  host.replaceChildren(wrap);
}

function drawChart() {
  const value = symbol.value;
  chartLink.href = 'https://www.tradingview.com/symbols/' + value.replace(':', '-') + '/';
  mountMarket(chart, 'advanced-chart', {
    autosize: true, symbol: value, interval: 'D', timezone: 'exchange', theme: 'dark',
    style: '1', allow_symbol_change: true, hide_side_toolbar: true, locale: 'en',
    backgroundColor: '#121a25', gridColor: 'rgba(170, 187, 208, .15)',
    support_host: 'https://www.tradingview.com',
  }, 'Market chart');
}

function loadMarkets() {
  drawChart();
  const instruments = [...symbol.options].map(option => ({name: option.value, displayName: option.textContent}));
  mountMarket(quotes, 'market-quotes', {
    width: '100%', height: '100%', colorTheme: 'dark', locale: 'en', showSymbolLogo: true,
    symbolsGroups: [{ name: 'Watchlist', symbols: instruments }],
  }, 'Market watchlist');
  symbol.addEventListener('change', drawChart);
}

function whenVisible(id, load) {
  if (!('IntersectionObserver' in window)) {
    load();
    return;
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  });
  observer.observe(element(id));
}

whenVisible('x-posts', loadTimeline);
whenVisible('markets', loadMarkets);

const editionAnchors = new Set(['#top-stories', '#sports-today', '#explainers', '#brief', '#newsletter', '#economy', '#government', '#wire-discuss-cta']);
if (editionAnchors.has(location.hash)) location.replace('./edition.html' + location.search + location.hash);
