/* Reader V6: keep third-party market scripts inside sandboxed iframe documents. */
(()=>{'use strict';
const safe=new URLSearchParams(location.search).get('safe')==='1';
const makeFrame=(mode,tab)=>{
  const f=document.createElement('iframe');
  f.className='sn-market-frame';
  f.title=mode==='ticker'?'Market ticker: exchange quotes may be delayed':'Market quotes for '+tab+'; data may be delayed';
  f.sandbox='allow-scripts allow-popups allow-popups-to-escape-sandbox';
  f.referrerPolicy='no-referrer';f.loading=mode==='ticker'?'eager':'lazy';
  f.src='./market-embed.html?kind='+encodeURIComponent(mode)+(tab?'&tab='+encodeURIComponent(tab):'');
  f.setAttribute('scrolling','no');return f;
};
const marketLinks={Indexes:'https://www.tradingview.com/markets/indices/',Stocks:'https://www.tradingview.com/markets/stocks-usa/',Futures:'https://www.tradingview.com/markets/futures/','Oil & metals':'https://www.tradingview.com/markets/commodities/','Bond ETFs':'https://www.tradingview.com/markets/etfs/'};
function putFallback(host,label,url){host.replaceChildren();const p=document.createElement('p');p.className='market-safe-fallback';p.textContent=label+' ';const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='View live markets ↗';p.append(a);host.append(p);}
function init(){
  const tape=document.getElementById('market-tape-frame-host');
  if(tape){if(safe){putFallback(tape,'Market embeds paused for troubleshooting.','https://www.tradingview.com/markets/');document.getElementById('market-tape-fallback')?.remove();}else{tape.replaceChildren(makeFrame('ticker'));const old=document.getElementById('market-tape-fallback');if(old)old.style.display='none';}}
  const panels=[...document.querySelectorAll('[data-market-panel]')];
  const loadPanel=(tab)=>{const panel=panels.find(p=>p.dataset.marketPanel===tab);if(!panel||!panel.classList.contains('active'))return;const host=panel.querySelector('.tv-lazy');if(!host||host.dataset.snV6==='1')return;host.dataset.snV6='1';if(safe){putFallback(host,'Quotes are disabled in safe mode.',marketLinks[tab]||'https://www.tradingview.com/markets/');return;}host.replaceChildren();host.append(makeFrame('quotes',tab));const note=document.createElement('p');note.className='market-iframe-note';note.textContent='Quotes from TradingView · may be delayed · ETFs are not futures or official yields';host.append(note);};
  document.querySelectorAll('[data-market]').forEach(btn=>btn.addEventListener('click',()=>{requestAnimationFrame(()=>loadPanel(btn.dataset.market));}));
  const marketSection=document.getElementById('markets');
  if(marketSection && 'IntersectionObserver' in window){const obs=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){loadPanel('Indexes');obs.disconnect();}},{rootMargin:'250px'});obs.observe(marketSection);}
  else{loadPanel('Indexes');}
  if(safe){document.documentElement.dataset.snMarketSafe='1';}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
