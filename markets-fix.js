/* Standalone News · TradingView accessible watchlist, 2026-10.
   Some CME/CBOT/COMEX contracts cannot be shown in third-party widgets.
   ETF shares are NOT equivalent to futures, Treasury yields, or spot commodity prices.
   Existing newsroom.js manages which tab is active before this script loads. */
(()=>{'use strict';
const URL='https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js';
const base={locale:'en',colorTheme:'light',width:'100%',height:'405',showSymbolLogo:true};
const groups={
 'Indexes':[{name:'Popular index ETFs · share prices (not index values)',symbols:[
   {name:'AMEX:SPY',displayName:'SPY · S&P 500 ETF'},
   {name:'NASDAQ:QQQ',displayName:'QQQ · Nasdaq 100 ETF'},
   {name:'AMEX:DIA',displayName:'DIA · Dow 30 ETF'},
   {name:'AMEX:IWM',displayName:'IWM · Russell 2000 ETF'}]}],
 'Stocks':[{name:'Major stock ETFs · SPY and QQQ',symbols:[
   {name:'AMEX:SPY',displayName:'SPY · S&P 500 ETF'},
   {name:'NASDAQ:QQQ',displayName:'QQQ · Nasdaq 100 ETF'}]},
   {name:'Popular stocks',symbols:[
   {name:'NASDAQ:NVDA',displayName:'Nvidia'},
   {name:'NASDAQ:AAPL',displayName:'Apple'},
   {name:'NASDAQ:MSFT',displayName:'Microsoft'},
   {name:'NASDAQ:GOOGL',displayName:'Alphabet'},
   {name:'NASDAQ:AMZN',displayName:'Amazon'},
   {name:'NASDAQ:META',displayName:'Meta'},
   {name:'NASDAQ:TSLA',displayName:'Tesla'},
   {name:'NASDAQ:AMD',displayName:'AMD'},
   {name:'NASDAQ:PLTR',displayName:'Palantir'}]}],
 'Futures':[{name:'ETF market proxies · NOT futures contracts',symbols:[
   {name:'AMEX:SPY',displayName:'SPY · S&P 500 ETF'},
   {name:'NASDAQ:QQQ',displayName:'QQQ · Nasdaq 100 ETF'},
   {name:'AMEX:DIA',displayName:'DIA · Dow 30 ETF'},
   {name:'AMEX:IWM',displayName:'IWM · Russell 2000 ETF'}]}],
 'Oil & metals':[{name:'Commodity ETFs · share prices (NOT spot prices)',symbols:[
   {name:'AMEX:GLD',displayName:'GLD · Gold ETF'},
   {name:'AMEX:SLV',displayName:'SLV · Silver ETF'},
   {name:'AMEX:USO',displayName:'USO · U.S. Oil Fund'}]}],
 'Bond ETFs':[{name:'Bond ETF share prices · NOT yields',symbols:[
   {name:'NASDAQ:TLT',displayName:'TLT · 20+ year Treasuries'},
   {name:'NASDAQ:IEF',displayName:'IEF · 7–10 year Treasuries'},
   {name:'NASDAQ:SHY',displayName:'SHY · 1–3 year Treasuries'},
   {name:'NASDAQ:BND',displayName:'BND · total bond market'}]}]
};
const links={'Indexes':'https://www.tradingview.com/markets/indices/','Stocks':'https://www.tradingview.com/markets/stocks-usa/','Futures':'https://www.tradingview.com/markets/futures/','Oil & metals':'https://www.tradingview.com/markets/commodities/','Bond ETFs':'https://www.tradingview.com/markets/etfs/'};
function mount(tab,force=false){
 const panel=Array.from(document.querySelectorAll('[data-market-panel]')).find(e=>e.dataset.marketPanel===tab);
 if(!panel||!groups[tab]||!panel.classList.contains('active'))return;
 const host=panel.querySelector('.tv-lazy');if(!host)return;
 if(host.dataset.loaded==='1'&&!force)return;
 host.dataset.loaded='1';host.replaceChildren();
 const widget=document.createElement('div');widget.className='tradingview-widget-container';widget.style.height='405px';widget.style.width='100%';
 const inner=document.createElement('div');inner.className='tradingview-widget-container__widget';widget.appendChild(inner);host.appendChild(widget);
 const footer=document.createElement('div');footer.className='tv-market-fallback';
 const label=document.createElement('span');label.textContent='TradingView quotes · may be delayed · exchange restrictions apply';
 const link=document.createElement('a');link.href=links[tab];link.target='_blank';link.rel='noopener noreferrer';link.textContent='See market data on TradingView ↗';
 const retry=document.createElement('button');retry.type='button';retry.className='tv-retry';retry.textContent='Retry quotes';retry.addEventListener('click',()=>mount(tab,true));
 footer.append(label,link,retry);host.appendChild(footer);
 const script=document.createElement('script');script.type='text/javascript';script.async=true;script.src=URL;
 script.textContent=JSON.stringify({...base,symbolsGroups:groups[tab]});
 script.onerror=()=>{if(host.isConnected)label.textContent='TradingView script blocked. Use the market link or retry.'};
 widget.appendChild(script);
 window.setTimeout(()=>{if(!host.isConnected||host.dataset.loaded!=='1')return;
 if(!widget.querySelector('iframe'))label.textContent='Quotes have not loaded. Try disabling blockers or opening the direct market link.';
 },14000);
}
function init(){
 document.querySelectorAll('[data-market]').forEach(button=>button.addEventListener('click',()=>mount(button.dataset.market)));
 requestAnimationFrame(()=>mount('Indexes'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
