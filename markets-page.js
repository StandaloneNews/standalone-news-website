/* Standalone News Markets desk. TradingView owns all embedded quote/chart data.
   Public newsroom JSON supplies source-linked headlines; no market prices are fabricated. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const TV='https://s3.tradingview.com/external-embedding/';
const DEFAULT='NASDAQ:AAPL';
const POPULAR=['NASDAQ:AAPL','NASDAQ:MSFT','NASDAQ:NVDA','NASDAQ:TSLA','NASDAQ:AMZN','NASDAQ:GOOGL','NYSE:JPM','NYSE:BRK.B','AMEX:SPY','NASDAQ:QQQ','AMEX:GLD','NASDAQ:TLT'];
const GROUPS={
  stocks:[{name:'Popular U.S. stocks',symbols:[
    {name:'NASDAQ:AAPL',displayName:'Apple · AAPL'},{name:'NASDAQ:NVDA',displayName:'Nvidia · NVDA'},
    {name:'NASDAQ:MSFT',displayName:'Microsoft · MSFT'},{name:'NASDAQ:TSLA',displayName:'Tesla · TSLA'},
    {name:'NASDAQ:AMZN',displayName:'Amazon · AMZN'},{name:'NASDAQ:GOOGL',displayName:'Alphabet · GOOGL'},
    {name:'NASDAQ:META',displayName:'Meta · META'},{name:'NASDAQ:AMD',displayName:'AMD · AMD'},
    {name:'NYSE:JPM',displayName:'JPMorgan · JPM'}]}],
  indexes:[{name:'Index-tracking ETFs · not index values',symbols:[
    {name:'AMEX:SPY',displayName:'SPY · S&P 500 ETF'},{name:'NASDAQ:QQQ',displayName:'QQQ · Nasdaq 100 ETF'},
    {name:'AMEX:DIA',displayName:'DIA · Dow 30 ETF'},{name:'AMEX:IWM',displayName:'IWM · Russell 2000 ETF'}]}],
  commodities:[{name:'Commodity-linked fund shares · not spot or futures',symbols:[
    {name:'AMEX:GLD',displayName:'GLD · Gold ETF'},{name:'AMEX:SLV',displayName:'SLV · Silver ETF'},
    {name:'AMEX:USO',displayName:'USO · U.S. Oil Fund'}]}],
  bonds:[{name:'Bond ETF share prices · not Treasury yields',symbols:[
    {name:'NASDAQ:TLT',displayName:'TLT · Long-term Treasuries'},{name:'NASDAQ:IEF',displayName:'IEF · Intermediate Treasuries'},
    {name:'NASDAQ:SHY',displayName:'SHY · Short Treasuries'},{name:'NASDAQ:BND',displayName:'BND · Bond market ETF'}]}]
};
const tickerTape={symbols:[
 {proName:'AMEX:SPY',title:'SPY · S&P 500 ETF'},{proName:'NASDAQ:QQQ',title:'QQQ · Nasdaq 100 ETF'},
 {proName:'NASDAQ:NVDA',title:'Nvidia'},{proName:'NASDAQ:AAPL',title:'Apple'},
 {proName:'NASDAQ:TSLA',title:'Tesla'},{proName:'NASDAQ:MSFT',title:'Microsoft'},
 {proName:'AMEX:GLD',title:'Gold ETF'},{proName:'NASDAQ:TLT',title:'Treasury Bond ETF'}
],showSymbolLogo:false,colorTheme:'light',isTransparent:true,displayMode:'adaptive',locale:'en'};
function fallback(host,message){
  if(!host||!host.isConnected)return;
  const el=document.createElement('div');el.className='widget-loading';el.style.flexDirection='column';el.style.gap='12px';
  const note=document.createElement('span');note.textContent=message;
  const link=document.createElement('a');link.href='https://www.tradingview.com/markets/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open TradingView ↗';
  el.append(note,link);host.replaceChildren(el);
}
function mountTradingView(host,type,config,description){
  host.replaceChildren();
  const wrap=document.createElement('div');wrap.className='tradingview-widget-container';
  const inner=document.createElement('div');inner.className='tradingview-widget-container__widget';
  wrap.append(inner);
  if(type!=='ticker-tape'){
    const credit=document.createElement('div');credit.className='tradingview-widget-copyright';
    const a=document.createElement('a');a.href='https://www.tradingview.com/';a.target='_blank';a.rel='noopener noreferrer nofollow';a.textContent=description+' by TradingView ↗';
    credit.append(a);wrap.append(credit);
  }
  host.append(wrap);
  const script=document.createElement('script');script.type='text/javascript';script.async=true;
  script.src=TV+'embed-widget-'+type+'.js';
  script.textContent=JSON.stringify(config);
  script.onerror=()=>{if(host.contains(wrap))fallback(host,'TradingView is unavailable or blocked in this browser.')};
  wrap.append(script);
  // Show a useful link when third-party scripts are blocked, without waiting forever.
  window.setTimeout(()=>{if(host.contains(wrap)&&!wrap.querySelector('iframe'))fallback(host,'Market data has not loaded. Please try TradingView directly.');},22000);
}
function cleanSymbol(raw){
  const value=String(raw||'').trim().toUpperCase();
  if(!value||value.length>35||!/^[A-Z0-9._^!:]+$/.test(value))return null;
  if((value.match(/:/g)||[]).length>1||value.startsWith(':')||value.endsWith(':'))return null;
  if(/^[0-9.]+$/.test(value))return null;
  return value;
}
function drawChart(symbol){
  $('ticker-input').value=symbol;
  $('ticker-feedback').textContent='';
  document.querySelectorAll('[data-symbol]').forEach(btn=>btn.classList.toggle('active',btn.dataset.symbol===symbol));
  mountTradingView($('advanced-chart'),'advanced-chart',{
    autosize:true,symbol,interval:'D',timezone:'exchange',theme:'light',
    backgroundColor:'#ffffff',gridColor:'rgba(46, 72, 97, 0.06)',style:'1',
    withdateranges:true,hide_side_toolbar:false,hide_top_toolbar:false,
    allow_symbol_change:true,save_image:false,locale:'en',
    watchlist:POPULAR,calendar:false,details:false,hotlist:false,
    support_host:'https://www.tradingview.com'
  },'Interactive chart');
}
function initCharts(){
  const url=new URL(location.href);
  const requested=url.searchParams.get('symbol');
  const initial=cleanSymbol(requested)||DEFAULT;
  drawChart(initial);
  $('ticker-form').addEventListener('submit',e=>{
    e.preventDefault();const input=$('ticker-input');
    const symbol=cleanSymbol(input.value);
    if(!symbol){$('ticker-feedback').textContent='Enter a stock symbol such as AAPL, TSLA, or NASDAQ:NVDA.';input.focus();return;}
    const next=new URL(location.href);next.searchParams.set('symbol',symbol);
    history.replaceState(null,'',next.pathname+next.search+next.hash);
    drawChart(symbol);
  });
  document.querySelectorAll('[data-symbol]').forEach(button=>button.addEventListener('click',()=>{
    const symbol=cleanSymbol(button.dataset.symbol);
    if(!symbol)return;
    const next=new URL(location.href);next.searchParams.set('symbol',symbol);
    history.replaceState(null,'',next.pathname+next.search+next.hash);
    drawChart(symbol);
  }));
  mountTradingView($('market-tape'),'ticker-tape',tickerTape,'Market ticker');
  let current='stocks';
  const drawWatch=key=>{
    if(!GROUPS[key])return;current=key;
    document.querySelectorAll('[data-watch]').forEach(button=>{
      const active=button.dataset.watch===key;
      button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
    });
    mountTradingView($('watch-widget'),'market-quotes',{
      locale:'en',colorTheme:'light',width:'100%',height:'430',showSymbolLogo:true,symbolsGroups:GROUPS[key]
    },'Market watchlist');
  };
  document.querySelectorAll('[data-watch]').forEach(button=>button.addEventListener('click',()=>drawWatch(button.dataset.watch)));
  // Keep the above-the-fold chart fast; load a second large widget only as it becomes visible.
  const section=document.querySelector('.overview-section');
  if('IntersectionObserver' in window){
    const obs=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){obs.disconnect();drawWatch(current);}
    },{rootMargin:'250px'});
    obs.observe(section);
  }else drawWatch(current);
}
function safeURL(value){
  try{const u=new URL(value,location.origin);return u.protocol==='https:'||u.protocol==='http:'?u.href:null}catch{return null}
}
function category(item){
  const c=String(item.category||'').toLowerCase(),title=String(item.title||item.headline||'').toLowerCase();
  if(c==='markets'||c==='sec'||c==='fed')return c==='markets'?'markets':'policy';
  if(c==='economy')return 'economy';
  if(c==='treasury'||c==='cftc')return 'policy';
  if(/\b(federal reserve|fomc|sec |securities and exchange commission|treasury yields?|interest rates?|rate cuts?|rate hikes?|bond yields?|monetary policy|tariffs?)\b/i.test(title))return 'policy';
  if(/\b(stocks?|shares?|earnings|wall street|nasdaq|dow jones|s&p 500|equities|investors?|bitcoin|oil prices?|gold prices?|market rally|selloff|etfs?)\b/i.test(title))return 'markets';
  if(/\b(inflation|cpi|pce|gdp|unemployment|jobs report|payrolls|consumer spending|economic growth|recession)\b/i.test(title))return 'economy';
  return null;
}
function dateText(value){
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return 'Time unavailable';
  return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(date)+' UTC';
}
const state={stories:[],kind:'all',visible:8,updated:null};
function createStory(item){
  const article=document.createElement('article');article.className='news-card';
  const top=document.createElement('div');top.className='news-card-top';
  const tag=document.createElement('span');tag.className='news-tag';
  tag.textContent=({markets:'STOCKS & MARKETS',economy:'ECONOMY',policy:'FED & POLICY'})[item.kind]||'MARKETS';
  const time=document.createElement('time');time.className='news-time';time.dateTime=item.published_at||'';time.textContent=dateText(item.published_at);
  top.append(tag,time);
  const h=document.createElement('h3');const title=document.createElement('a');
  title.href=item.url;title.textContent=item.title;
  if(item.external){title.target='_blank';title.rel='noopener noreferrer';}
  h.append(title);article.append(top,h);
  if(item.summary && item.summary.length>=55 && item.summary.toLowerCase()!==item.title.toLowerCase()){
    const p=document.createElement('p');p.className='summary';p.textContent=item.summary.slice(0,230);article.append(p);
  }
  const meta=document.createElement('div');meta.className='news-card-meta';
  const source=document.createElement('span');source.textContent='SOURCE · '+item.source;
  const link=document.createElement('a');link.href=item.url;link.textContent=item.external?'Read original ↗':'Read explainer ↗';
  if(item.external){link.target='_blank';link.rel='noopener noreferrer';}
  meta.append(source,link);article.append(meta);return article;
}
function renderNews(){
  const filtered=state.kind==='all'?state.stories:state.stories.filter(s=>s.kind===state.kind);
  const list=$('market-news-list');list.replaceChildren();
  const visible=filtered.slice(0,state.visible);
  if(!visible.length){const p=document.createElement('p');p.className='news-empty';p.textContent='No headlines match this category right now. Browse the complete news wire for more coverage.';list.append(p);}
  else visible.forEach(item=>list.append(createStory(item)));
  $('news-count').textContent=filtered.length+' attributed market-related headlines · Newest first';
  $('news-more').hidden=state.visible>=filtered.length;
  $('news-updated').textContent=state.updated?'Updated '+dateText(state.updated):'Latest available feeds';
}
async function getFeed(path){
  const resp=await fetch(path+'?v='+Date.now(),{cache:'no-store'});
  if(!resp.ok)throw new Error('News feed '+resp.status);
  const data=await resp.json();
  if(!Array.isArray(data.items))throw new Error('Unexpected feed format');
  return data;
}
async function loadNews(){
  const outcomes=await Promise.allSettled([
    getFeed('./data/news.json'),getFeed('./data/desk.json'),getFeed('./data/articles.json')
  ]);
  const rows=[],stamps=[];
  for(let i=0;i<outcomes.length;i++){
    const response=outcomes[i];
    if(response.status!=='fulfilled')continue;
    const data=response.value;if(data.updated_at)stamps.push(data.updated_at);
    for(const row of data.items){
      const title=String(row.title||row.headline||'').trim(),source=String(row.source||'').trim();
      const path=i===2?String(row.path||''):'';
      const url=i===2&&/^articles\/[a-z0-9_.-]+\.html$/.test(path)?new URL('./'+path,location.href).href:safeURL(row.url);
      if(!url||!title||!source)continue;
      const kind=category({...row,title});if(!kind)continue;
      rows.push({title,url,source,kind,summary:String(row.summary||'').replace(/<[^>]+>/g,' ').trim(),
        published_at:String(row.published_at||''),external:i!==2});
    }
  }
  const ids=new Set(),titles=new Set(),distinct=[];
  rows.sort((a,b)=>(new Date(b.published_at).getTime()||0)-(new Date(a.published_at).getTime()||0));
  for(const row of rows){
    const normalized=row.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    if(ids.has(row.url)||titles.has(normalized))continue;
    ids.add(row.url);titles.add(normalized);distinct.push(row);
  }
  state.stories=distinct;
  state.updated=stamps.sort((a,b)=>(new Date(b).getTime()||0)-(new Date(a).getTime()||0))[0]||null;
  if(outcomes.every(x=>x.status==='rejected')){
    $('news-updated').textContent='Headline feeds unavailable';
    $('news-count').textContent='Visit the full news wire for more headlines';
  }
  renderNews();
}
function initEconomicCalendar(){
  const host=$('economic-calendar');
  if(!host)return;
  const render=()=>{
    mountTradingView(host,'events',{
      colorTheme:'light',
      isTransparent:false,
      locale:'en',
      countryFilter:'us',
      importanceFilter:'0,1',
      width:'100%',
      height:590
    },'U.S. economic calendar');
  };
  // Keep external embeds from delaying the stock chart or headline updates.
  if('IntersectionObserver' in window){
    const observer=new IntersectionObserver(entries=>{
      if(entries.some(entry=>entry.isIntersecting)){
        observer.disconnect();
        render();
      }
    },{rootMargin:'350px'});
    observer.observe(host);
  }else render();
}
function init(){
  const d=new Date();$('market-clock').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(d)+' · DATA VIA TRADINGVIEW';
  initCharts();
  initEconomicCalendar();
  document.querySelectorAll('[data-news]').forEach(button=>button.addEventListener('click',()=>{
    state.kind=button.dataset.news;state.visible=8;
    document.querySelectorAll('[data-news]').forEach(other=>{
      const active=other===button;other.classList.toggle('selected',active);other.setAttribute('aria-pressed',String(active));
    });
    renderNews();
  }));
  $('news-more').addEventListener('click',()=>{state.visible+=8;renderNews();});
  loadNews().catch(()=>{state.stories=[];renderNews();$('news-updated').textContent='Headline feeds unavailable';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
