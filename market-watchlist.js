let widgetModule;

export function showQuoteWatchlist(host, symbols) {
  let ticker = host.querySelector('tv-tickers');
  if (!ticker) {
    ticker = document.createElement('tv-tickers');
    ticker.setAttribute('direction', 'vertical');
    ticker.setAttribute('item-size', 'compact');
    ticker.setAttribute('theme', 'dark');
    ticker.setAttribute('transparent', '');
    ticker.setAttribute('hide-chart', '');
    ticker.setAttribute('hide-logo', '');

    const fallback = document.createElement('p');
    fallback.className = 'watchlist-fallback';
    const link = document.createElement('a');
    link.href = 'https://www.tradingview.com/markets/';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'View quotes on TradingView';
    fallback.append(link);
    ticker.append(fallback);
  }
  ticker.setAttribute('symbols', symbols.join(','));

  if (!host.contains(ticker)) host.replaceChildren(ticker);
  host.hidden = false;

  if (!widgetModule) {
    widgetModule = import('https://widgets.tradingview-widget.com/w/en/tv-tickers.js').catch(() => {
      widgetModule = undefined;
    });
  }
}
