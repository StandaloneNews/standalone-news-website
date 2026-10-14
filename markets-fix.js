/* Standalone News · robust TradingView market widget loader.
   Uses TradingView's documented legacy iframe widgets. Tabs load ONLY once visible. */
(()=>{'use strict';
const URL='https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js';
const defaults={locale:'en',colorTheme:'light',width:'100%',height:'405',showSymbolLogo:true};
const groups={
 'Indexes':[{name:'Major U.S. indexes (CFD references)',symbols:[
   {name:'FOREXCOM:SPXUSD',displayName:'S&P 500'},{name:'FOREXCOM:NSXUSD',displayName:'Nasdaq 100'},{name:'FOREXCOM:DJI',displayName:'Dow Jones'}, {name:'TVC:RUT',displayName:'Russell 2000'}, {name:'TVC:VIX',displayName:'VIX'}]}],
 'Stocks':[{name:'Popular stocks',symbols:[
   {name:'NASDAQ:NVDA',displayName:'Nvidia'},{name:'NASDAQ:AAPL',displayName:'Apple'},{name:'NASDAQ:MSFT',displayName:'Microsoft'},{name:'NASDAQ:GOOGL',displayName:'Alphabet'},{name:'NASDAQ:AMZN',displayName:'Amazon'}, {name:'NASDAQ:META',displayName:'Meta'},{name:'NASDAQ:TSLA',displayName:'Tesla'},{name:'NASDAQ:AMD',displayName:'AMD'},{name:'NASDAQ:PLTR',displayName:'Palantir'}]}],
 'Futures':[{name:'Index futures',symbols:[
   {name:'CME_MINI:ES1!',displayName:'S&P 500 E-mini'},{name:'CME_MINI:NQ1!',displayName:'Nasdaq 100 E-mini'},{name:'CBOT_MINI:YM1!',displayName:'Dow E-mini'},{name:'CME_MINI:RTY1!',displayName:'Russell 2000 E-mini'}]}],
 'Oil & metals':[{name:'Energy and metals',symbols:[
   {name:'TVC:USOIL',displayName:'WTI crude reference'},{name:'TVC:UKOIL',displayName:'Brent crude reference'},{name:'COMEX:GC1!',displayName:'Gold futures'},{name:'COMEX:SI1!',displayName:'Silver futures'}]}],
 'Treasuries':[{name:'Treasury yields (%)',symbols:[
   {name:'TVC:US02Y',displayName:'U.S. 2Y yield'},{name:'TVC:US05Y',displayName:'U.S. 5Y yield'},{name:'TVC:US10Y',displayName:'U.S. 10Y yield'},{name:'TVC:US30Y',displayName:'U.S. 30Y yield'}]},
  {name:'Treasury futures (prices)',symbols:[
   {name:'CBOT:ZT1!',displayName:'2Y note futures'},{name:'CBOT:ZF1!',displayName:'5Y note futures'},{name:'CBOT:ZN1!',displayName:'10Y note futures'},{name:'CBOT:ZB1!',displayName:'30Y bond futures'}]}],
 'Bond ETFs':[{name:'U.S. Treasury and bond ETFs',symbols:[
   {name:'NASDAQ:TLT',displayName:'TLT · long Treasuries'},{name:'NASDAQ:IEF',displayName:'IEF · 7–10Y Treasuries'},{name:'NASDAQ:SHY',displayName:'SHY · 1–3Y Treasuries'},{name:'NASDAQ:BND',displayName:'BND · U.S. bonds'}]}]
};
const links={'Indexes':'https://www.tradingview.com/markets/indices/','Stocks':'https://www.tradingview.com/markets/stocks-usa/','Futures':'https://www.tradingview.com/markets/futures/','Oil & metals':'https://www.tradingview.com/markets/futures/','Treasuries':'https://www.tradingview.com/markets/bonds/','Bond ETFs':'https://www.tradingview.com/markets/etfs/'};
function mount(tab,force=false){
  const panel=Array.from(document.querySelectorAll('[data-market-panel]')).find(e=>e.dataset.marketPanel===tab);
  if(!panel || !groups[tab] || !panel.classList.contains('active'))return;
  const host=panel.querySelector('.tv-lazy');if(!host)return;
  if(host.dataset.loaded==='1' && !force)return;
  host.dataset.loaded='1';
  host.replaceChildren();
  const widget=document.createElement('div');widget.className='tradingview-widget-container';widget.style.height='405px';widget.style.width='100%';
  const inner=document.createElement('div');inner.className='tradingview-widget-container__widget';widget.appendChild(inner);host.appendChild(widget);
  const footer=document.createElement('div');footer.className='tv-market-fallback';
  const label=document.createElement('span');label.textContent='Embedded TradingView quotes · May be delayed';
  const a=document.createElement('a');a.href=links[tab];a.target='_blank';a.rel='noopener noreferrer';a.textContent='See prices on TradingView ↗';
  const retry=document.createElement('button');retry.type='button';retry.className='tv-retry';retry.textContent='Retry widget';retry.addEventListener('click',()=>mount(tab,true));
  footer.append(label,a,retry);host.appendChild(footer);
  const script=document.createElement('script');script.type='text/javascript';script.async=true;script.src=URL;
  script.textContent=JSON.stringify({...defaults,symbolsGroups:groups[tab]});
  script.onerror=()=>{if(!host.isConnected)return;label.textContent='TradingView blocked or unavailable. Use the direct link or retry.';};
  widget.appendChild(script);
  window.setTimeout(()=>{
    if(!host.isConnected||host.dataset.loaded!=='1')return;
    if(!widget.querySelector('iframe'))label.textContent='Quotes have not loaded. Check browser blockers or use the direct market link.';
  },14000);
}
function init(){
  const tabs=document.querySelectorAll('[data-market]');
  tabs.forEach(btn=>btn.addEventListener('click',()=>{
    // The newsroom.js handler shows the selected panel before this handler runs.
    mount(btn.dataset.market);
  }));
  // Defer one frame to ensure CSS/layout resolved prior to embedding.
  requestAnimationFrame(()=>mount('Indexes'));
  // Keep the page useful even if a privacy extension blocks TradingView entirely.
  window.setTimeout(()=>{
    document.querySelectorAll('.tv-embed-shell').forEach(shell=>{
      if(!shell.querySelector('iframe'))shell.classList.add('tv-failed');
    });
  },14000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
