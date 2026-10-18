/* Standalone News company research; quotes from TradingView, filings from SEC snapshots. */
(()=>{'use strict';
const $=id=>document.getElementById(id), SEC='https://www.sec.gov/edgar/browse/?CIK=';
const POP=[['AAPL','Apple Inc.','NASDAQ'],['NVDA','NVIDIA Corporation','NASDAQ'],['MSFT','Microsoft Corporation','NASDAQ'],['TSLA','Tesla, Inc.','NASDAQ'],['AMZN','Amazon.com, Inc.','NASDAQ'],['GOOGL','Alphabet Inc.','NASDAQ'],['META','Meta Platforms, Inc.','NASDAQ'],['JPM','JPMorgan Chase & Co.','NYSE']].map(x=>({ticker:x[0],name:x[1],exchange:x[2]}));
const state={directory:[],snapshots:{},symbol:'AAPL',filter:'all',news:[],newsCount:6};
function tkr(v){v=String(v||'').trim().toUpperCase();return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(v)?v:null;}
function find(q){q=String(q||'').trim();const m=q.match(/^([A-Z][A-Z0-9.\-]{0,9})\s+[—-]\s+/i);const t=tkr(m?m[1]:q);if(t)return state.directory.find(x=>x.ticker===t)||POP.find(x=>x.ticker===t)||{ticker:t,name:t,exchange:''};return state.directory.find(x=>x.name.toLowerCase()===q.toLowerCase())||null;}
function elt(tag,text,cls){let x=document.createElement(tag);if(text!==undefined)x.textContent=text;if(cls)x.className=cls;return x;}
function urlLink(url,title){const a=elt('a',title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';return a;}
function linkId(id,url){$(id).href=url;}
function date(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||'').slice(0,10)))return 'Date unavailable';return new Date(d.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});}
function message(id,msg){$(id).replaceChildren(elt('p',msg,'state-note'));}
function chart(symbol,exchange){
 const box=$('research-tv-chart');box.replaceChildren();const outer=elt('div',undefined,'tradingview-widget-container'),inner=elt('div',undefined,'tradingview-widget-container__widget'),credit=elt('div',undefined,'tradingview-widget-copyright');
 credit.append(urlLink('https://www.tradingview.com/','Chart by TradingView ↗'));outer.append(inner,credit);box.append(outer);
 const script=document.createElement('script');script.async=true;script.type='text/javascript';script.src='https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
 script.textContent=JSON.stringify({autosize:true,symbol:(exchange?exchange+':':'')+symbol,interval:'D',timezone:'exchange',theme:'light',backgroundColor:'#ffffff',style:'1',locale:'en',hide_top_toolbar:false,hide_side_toolbar:false,allow_symbol_change:true,withdateranges:true,save_image:false,calendar:false});
 script.onerror=()=>{if(box.contains(outer))message('research-tv-chart','TradingView chart unavailable. Try again later or open the Markets page.')};
 outer.append(script);
}
function item(row,container){const box=elt('div',undefined,'data-item'),body=elt('div');body.append(elt('strong',row.label),elt('small',row.meta));box.append(body,urlLink(row.url,row.link||'Open source ↗'));container.append(box);}
function renderFilings(snap){
 const rows=Array.isArray(snap?.filings)?snap.filings:[];
 const chosen=state.filter==='all'?rows:rows.filter(r=>r.form===state.filter||(state.filter==='4'&&r.form==='4/A'));
 $('filings-list').replaceChildren();
 for(const f of chosen.slice(0,12)){if(!/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//.test(f.url||''))continue;item({label:(f.form||'Filing')+' · '+date(f.filed),meta:(f.description||'Official SEC document').slice(0,125),url:f.url,link:'Original filing ↗'},$('filings-list'));}
 if(!$('filings-list').children.length)message('filings-list','No cached filings matching this filter. Use the official EDGAR search for full records.');
 $('insider-list').replaceChildren();
 for(const f of rows.filter(f=>f.form==='4'||f.form==='4/A').slice(0,8))item({label:'Form '+f.form+' · '+date(f.filed),meta:'Ownership filing — transaction type not classified',url:f.url,link:'Inspect form ↗'},$('insider-list'));
 if(!$('insider-list').children.length)message('insider-list','No recent Form 4 in the cached snapshot. This does not imply no insider activity.');
 $('institution-list').replaceChildren();
 for(const f of rows.filter(f=>f.form==='13F-HR'||f.form==='13F-HR/A').slice(0,3))item({label:f.form+' · '+date(f.filed),meta:'Filed by this reporting entity; not proof of other investors holding its shares',url:f.url},$('institution-list'));
 if(!$('institution-list').children.length)message('institution-list','No 13F filed by this reporting entity in this snapshot. Browse SEC records for other institutional filers.');
 const k=rows.find(r=>r.form==='10-K'),q=rows.find(r=>r.form==='10-Q');
 linkId('latest-10k-link',k?.url||$('sec-filings-link').href);linkId('latest-10q-link',q?.url||$('sec-filings-link').href);
}
function terms(ticker,name){
 const names={AAPL:['apple','iphone'],NVDA:['nvidia'],MSFT:['microsoft'],TSLA:['tesla'],AMZN:['amazon'],GOOGL:['alphabet','google'],META:['meta platforms','facebook'],JPM:['jpmorgan']};
 const cleaned=String(name||'').toLowerCase().replace(/\b(inc|incorporated|corporation|company|co|ltd|plc|holdings)\b/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
 return [...new Set([...(names[ticker]||[]),...(cleaned.length>=5?[cleaned]:[])])];
}
function renderNews(name){
 const n=terms(state.symbol,name),list=$('company-news-list');list.replaceChildren();
 const selected=state.news.filter(story=>n.some(k=>(story.title+' '+story.summary).toLowerCase().includes(k)));
 for(const row of selected.slice(0,state.newsCount))item({label:row.title,meta:row.source+' · '+date(row.published_at),url:row.url,link:'Read source ↗'},list);
 if(!list.children.length)message('company-news-list','No company-matched news in the current feed. Browse the full news wire for more.');
 $('more-company-news').hidden=selected.length<=state.newsCount;
}
function choose(raw){
 const company=find(raw);if(!company){$('search-status').textContent='Choose a company name from the suggestions or enter a valid stock ticker.';return;}
 state.symbol=company.ticker;state.newsCount=6;$('search-status').textContent='';$('company-input').value=company.ticker;
 $('company-name').textContent=company.name;$('company-symbol').textContent=company.ticker;
 const snap=state.snapshots[company.ticker];const cik=Number(company.cik||snap?.cik)||null;
 $('company-cik').textContent=cik?'SEC CIK '+String(cik).padStart(10,'0'):'SEC CIK not resolved';
 const exchange=company.exchange||snap?.exchange||'';
 $('company-description').textContent=(exchange?exchange+':':'')+company.ticker+' · Official filings, not investment recommendations';
 const sec=SEC+encodeURIComponent(cik||company.ticker)+'&owner=include';
 for(const id of ['sec-all-link','sec-filings-link','sec-insider-link','sec-institution-link'])linkId(id,sec);
 linkId('companyfacts-link',cik?'https://data.sec.gov/api/xbrl/companyfacts/CIK'+String(cik).padStart(10,'0')+'.json':sec);
 linkId('latest-10k-link',sec);linkId('latest-10q-link',sec);
 $('research-updated').textContent=snap?.updated_at?'SEC snapshot updated '+date(snap.updated_at):'No refreshed SEC snapshot for this symbol — see original EDGAR links';
 renderFilings(snap);renderNews(company.name);chart(company.ticker,exchange);
 document.querySelectorAll('[data-company]').forEach(b=>b.classList.toggle('active',b.dataset.company===company.ticker));
 const u=new URL(location.href);u.searchParams.set('ticker',company.ticker);history.replaceState(null,'',u.pathname+u.search+u.hash);
}
async function load(path){let resp=await fetch(path+'?t='+Date.now(),{cache:'no-store'});if(!resp.ok)throw Error(path+' unavailable');return resp.json();}
async function news(){
 const results=await Promise.allSettled([load('./data/news.json'),load('./data/desk.json')]);const used=new Set(),out=[];
 for(const r of results){if(r.status!=='fulfilled')continue;for(const x of r.value.items||[]){const title=String(x.title||''),url=String(x.url||'');if(!title||!/^https?:\/\//.test(url)||used.has(url))continue;used.add(url);out.push({title,url,summary:String(x.summary||''),source:String(x.source||'Source'),published_at:String(x.published_at||'')});}}
 out.sort((a,b)=>String(b.published_at).localeCompare(String(a.published_at)));state.news=out;renderNews(find(state.symbol)?.name||state.symbol);
}
async function init(){
 $('company-search').addEventListener('submit',e=>{e.preventDefault();choose($('company-input').value)});
 document.querySelectorAll('[data-company]').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.company)));
 document.querySelectorAll('[data-filings]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filings;document.querySelectorAll('[data-filings]').forEach(x=>{const chosen=b===x;x.classList.toggle('selected',chosen);x.setAttribute('aria-pressed',String(chosen));});renderFilings(state.snapshots[state.symbol])}));
 $('more-company-news').addEventListener('click',()=>{state.newsCount+=6;renderNews(find(state.symbol)?.name||state.symbol)});
 const results=await Promise.allSettled([load('./data/research-companies.json'),load('./data/research-snapshots.json')]);
 if(results[0].status==='fulfilled'&&Array.isArray(results[0].value.companies))state.directory=results[0].value.companies.filter(x=>tkr(x.ticker)&&Number.isInteger(x.cik)&&x.cik>0&&typeof x.name==='string').map(x=>({ticker:tkr(x.ticker),name:x.name.slice(0,140),cik:x.cik,exchange:String(x.exchange||'').replace(/[^A-Za-z0-9]/g,'').slice(0,18)})).slice(0,8500);
 if(results[1].status==='fulfilled'&&results[1].value.companies)state.snapshots=results[1].value.companies;
 const suggestions=$('company-suggestions');
 for(const entry of (state.directory.length?state.directory:POP)){const opt=document.createElement('option');opt.value=entry.ticker+' — '+entry.name;suggestions.append(opt);}
 $('directory-status').textContent=state.directory.length?state.directory.length.toLocaleString()+' SEC ticker associations':'Popular tickers · Full SEC directory pending';
 choose(new URL(location.href).searchParams.get('ticker')||'AAPL');
 news().catch(()=>message('company-news-list','News feed temporarily unavailable. Try the latest news wire.'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();