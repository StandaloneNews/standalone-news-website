/* Standalone News newsroom · static site frontend; source-linked headlines and original explainers. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const TOPICS=['US News','World','Markets','Economy','Government','Regulation','Technology'];
 const NAMES={'US News':'U.S. news',World:'World',Markets:'Markets',Economy:'Economy',Government:'Government',Regulation:'Regulation',Technology:'Technology'};
 const CATMAP={Fed:'Markets',SEC:'Markets',CFTC:'Markets',Markets:'Markets',Economy:'Economy',Treasury:'Government',DOJ:'Government',FDA:'Government',DEA:'Regulation',Washington:'Government',Government:'Government',World:'World','US News':'US News',Politics:'Government',Business:'Markets',Technology:'Technology'};
 const SKEY='standaloneNewsAppSavedV1',PKEY='standaloneNewsAppPrefsV1';
 const demo=new URLSearchParams(location.search).get('demo')==='1';
 const safeURL=x=>{try{const u=new URL(x);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
 const articlePath=x=>typeof x==='string'&&/^articles\/[a-z0-9_.-]+\.html$/.test(x)?'./'+x:null;
 const cat=x=>CATMAP[String(x||'')]||'US News';
 const text=x=>x===null||x===undefined?'':String(x);
 const utc=(str,short=false)=>{const d=new Date(str);if(!str||Number.isNaN(d.getTime()))return 'Time unavailable';return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(short?{}:{year:'numeric'})}).format(d)+' UTC';};
 const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
 const store=(k,value)=>{try{localStorage.setItem(k,JSON.stringify(value));return true;}catch{return false;}};
 const get=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v===null?d:v;}catch{return d;}};
 const normNews=s=>{if(!s)return null;const url=safeURL(s.url),title=text(s.title).trim(),source=text(s.source).trim();if(!url||!title||!source)return null;const img=s&&s.image&&safeURL(s.image.thumb_url)?{thumb_url:safeURL(s.image.thumb_url),page_url:safeURL(s.image.page_url),source:text(s.image.source||'Wikimedia Commons'),creator:text(s.image.creator||''),license:text(s.image.license||''),description:text(s.image.description||''),label:text(s.image.label||'Illustrative photo')}:null;return{type:'news',key:url,url,title,source,category:cat(s.category),summary:text(s.summary).trim().slice(0,240),published_at:text(s.published_at),source_type:text(s.source_type),desk_priority:Number(s.desk_priority)||0,bot_selected:Boolean(s.bot_selected),desk_featured:Boolean(s.desk_featured),image:img};};
 const normArticle=s=>{if(!s)return null;const url=articlePath(s.path),title=text(s.headline).trim();if(!url||!title)return null;return{type:'article',key:url,url,title,source:text(s.source||'Official agency'),category:cat(s.category),summary:text(s.summary),published_at:text(s.published_at)};};
 const prevSaved=get(SKEY,[]),prevPrefs=get(PKEY,[]);
 const state={news:[],articles:[],saved:Array.isArray(prevSaved)?prevSaved.filter(x=>x&&x.key&&x.title&&((x.type==='article'&&articlePath(x.url))||(x.type==='news'&&safeURL(x.url)))).slice(0,100):[],prefs:Array.isArray(prevPrefs)?prevPrefs.filter(x=>TOPICS.includes(x)):[],filter:'All',outlet:'',search:'',visible:12,feedUpdated:null,error:false};
 let toastTimer,prevFocus,cloudMode=false;
 const sort=arr=>arr.sort((a,b)=>(new Date(b.published_at).getTime()||0)-(new Date(a.published_at).getTime()||0));

 // Use the desktop bot's impact categories for the featured news desk, while
 // leaving the news wire in publication-time order. This is an automated ranking.
 const newsRank=item=>{
   const title=item.title.toLowerCase();
   let score=item.desk_priority || ({Markets:34,Economy:35,World:34,'US News':32,Government:29,Technology:30,Regulation:28}[item.category]||28);
   const terms=[[/\b(fomc|interest rates?|rate cuts?|rate hikes?|fed chair)\b/i,23],
     [/\b(inflation|cpi|pce|gdp|jobs report|unemployment|payrolls)\b/i,19],
     [/\b(war|ceasefire|invasion|election|supreme court|sanctions|tariffs?)\b/i,16],
     [/\b(earnings|merger|acquisition|bankruptcy|profit warning|guidance)\b/i,13]];
   if(!item.desk_priority)for(const [pattern,pts] of terms)if(pattern.test(title))score+=pts;
   if(/minutes of the board.s discount rate meetings|approval of application by|decision and order|information collection|request for comments|correction to/i.test(title) && !item.desk_priority)score-=34;
   const time=new Date(item.published_at).getTime();
   const ageH=Number.isFinite(time)?Math.max(0,(Date.now()-time)/3600000):240;
   score += Math.max(-35, 19 - ageH*.50);
   if(item.source_type==='Publisher RSS')score+=4;
   if(item.desk_featured)score+=12;
   return score;
 };
 function deskPicks(items){
   const ranked=[...items].sort((a,b)=>newsRank(b)-newsRank(a)||new Date(b.published_at)-new Date(a.published_at));
   const chosen=[],sources=new Map(),categories=new Map();
   for(const s of ranked){
     if(chosen.length>=24)break;
     if(sources.get(s.source)>=2 || categories.get(s.category)>=7)continue;
     chosen.push(s);sources.set(s.source,(sources.get(s.source)||0)+1);categories.set(s.category,(categories.get(s.category)||0)+1);
   }
   return chosen.length?chosen:ranked;
 }
 function sourceExcerpt(item){
   if(item.type==='article')return item.summary||'Official-source explainer, AI-assisted and not human-reviewed.';
   if(item.summary && item.summary.length>=35 && item.summary.toLowerCase()!==item.title.toLowerCase())return item.summary;
   return '';
 }
 function shortMeta(item){return item.source+' · '+utc(item.published_at,true);}
 function sourceLinkText(item){return item.type==='news'&&item.url.includes('news.google.com/')?'Read coverage ↗':'Original source ↗';}
 function creditLine(item){if(!item.image)return '';const bits=[item.image.label||'Illustrative photo'];if(item.image.creator)bits.push('Photo: '+item.image.creator);bits.push(item.image.source||'Wikimedia Commons');if(item.image.license)bits.push(item.image.license);return bits.join(' · ');}

 function link(item,label){const a=el('a','',label||item.title);a.href=item.url;if(item.type==='news'){a.target='_blank';a.rel='noopener noreferrer';a.title='Open the original source in a new tab';}return a;}
 function iconCategory(item){return ({Markets:'↗',Economy:'%',World:'◎',Government:'§',Regulation:'⚖','US News':'◇',Technology:'⌘'})[item.category]||'◇';}
 function visualClass(item){return({Markets:'visual-markets',Economy:'visual-economy',World:'visual-world',Government:'visual-government',Regulation:'visual-regulation',Technology:'visual-world','US News':'visual-us'})[item.category]||'visual-us';}
 function visual(item,small=false){const wrap=el('div',(small?'list-thumb ':'story-visual ')+visualClass(item));if(item.image&&item.image.thumb_url){wrap.classList.add('has-photo');const img=el('img','news-photo');img.src=item.image.thumb_url;img.alt='Illustrative image: '+(item.image.description||item.category||'news subject');img.loading='lazy';img.decoding='async';img.onerror=()=>{wrap.classList.remove('has-photo');wrap.replaceChildren(el('span','visual-icon',iconCategory(item)));};wrap.append(img);const badge=el('span','image-badge',item.image.label||'Illustrative photo');wrap.append(badge);if(!small&&item.image.page_url){const cap=el('a','image-credit',creditLine(item));cap.href=item.image.page_url;cap.target='_blank';cap.rel='noopener noreferrer';wrap.append(cap);}return wrap;}wrap.append(el('span','visual-icon',iconCategory(item)));if(!small)wrap.append(el('span','visual-mini','STANDALONE / NEWS'));return wrap;}
 function actionSave(item,cls='save-small'){const saved=state.saved.some(x=>x.key===item.key);const b=el('button',cls+(saved?' on':''),saved?'♥ Saved':'♡ Save');b.type='button';b.dataset.save=item.key;b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',(saved?'Remove saved story: ':'Save story: ')+item.title);return b;}
 function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,2600);}
 function flipSave(key){let item=[...state.news,...state.articles,...state.saved].find(x=>x.key===key);if(!item)return;const had=state.saved.some(x=>x.key===key);state.saved=had?state.saved.filter(x=>x.key!==key):[{type:item.type,key:item.key,url:item.url,title:item.title,source:item.source,category:item.category,published_at:item.published_at,summary:item.summary||''},...state.saved].slice(0,100);if(!cloudMode&&!store(SKEY,state.saved))toast('Your browser could not save this story');else toast(had?'Removed from Saved':'Added to Saved');render();window.dispatchEvent(new CustomEvent('sn:bookmark-change',{detail:{key,added:!had,item:state.saved.find(x=>x.key===key)||item}}));}
 function empty(node,msg){node.replaceChildren(el('div','empty-panel',msg));}
 function renderHero(){const item=deskPicks(state.news)[0]||state.articles[0],leadSave=$('lead-save'),cta=$('lead-link'),hero=$('hero-art');if(!item){$('lead-type').textContent='THE DAILY DESK';$('lead-title').textContent=state.error?'Unable to load recent headlines.':'What’s happening in your world, without the noise.';$('lead-summary').textContent='The latest source-linked headlines and AI-assisted explainers will appear here.';$('lead-source').textContent='Standalone News';$('lead-time').textContent='—';$('lead-category').textContent='YOUR NEWS';leadSave.hidden=true;cta.href='#wire';cta.textContent='Explore the news wire →';cta.removeAttribute('target');cta.removeAttribute('rel');hero.className='hero-art art-world';hero.style.removeProperty('--hero-image');const caption=hero.querySelector('.hero-image-caption');if(caption){caption.textContent='A BIGGER PICTURE';caption.hidden=true;}return;}
 $('lead-type').textContent=item.type==='article'?'AI-ASSISTED EXPLAINER':(item.bot_selected?'DESK PICK · AUTOMATED':'TOP STORY');$('lead-category').textContent=item.category.toUpperCase();$('lead-title').textContent=item.title;
 $('lead-summary').textContent=sourceExcerpt(item)||('Headline from '+item.source+'. Open the linked reporting for the full details.');
 $('lead-source').textContent=item.type==='article'?'Standalone News · AI-assisted':'Via '+item.source;$('lead-time').textContent=utc(item.published_at,true);
 hero.className='hero-art '+(({Markets:'art-economy',Economy:'art-economy',Government:'art-government',Regulation:'art-regulation',World:'art-world'})[item.category]||'art-world');const caption=hero.querySelector('.hero-image-caption');if(item.image&&item.image.thumb_url){hero.classList.add('has-photo');hero.style.setProperty('--hero-image',`url("${item.image.thumb_url}")`);if(caption){caption.textContent=creditLine(item);caption.href=item.image.page_url||'#top-stories';caption.target='_blank';caption.rel='noopener noreferrer';caption.title='Illustrative photo; not the actual event';caption.hidden=false;}const probe=new Image();probe.onerror=()=>{if(hero.style.getPropertyValue('--hero-image').includes(item.image.thumb_url)){hero.classList.remove('has-photo');hero.style.removeProperty('--hero-image');if(caption){caption.textContent='A BIGGER PICTURE';caption.hidden=true;}}};probe.src=item.image.thumb_url;}else{hero.style.removeProperty('--hero-image');if(caption){caption.textContent='A BIGGER PICTURE';caption.hidden=true;}}
 leadSave.hidden=false;leadSave.dataset.save=item.key;const saved=state.saved.some(x=>x.key===item.key);leadSave.className='bookmark-btn'+(saved?' on':'');leadSave.textContent=saved?'♥ Saved':'♡ Save';leadSave.setAttribute('aria-pressed',String(saved));cta.href=item.url;cta.textContent=item.type==='article'?'Read explainer →':sourceLinkText(item);if(item.type==='news'){cta.target='_blank';cta.rel='noopener noreferrer';}else{cta.removeAttribute('target');cta.removeAttribute('rel');}}
 function renderLatest(){const n=$('latest-items');n.replaceChildren();if(!state.news.length){n.append(el('p','placeholder',state.error?'Headlines could not be loaded.':'New source-linked headlines will appear here.'));return;}
 // The wire remains purely chronological; this compact homepage module mixes outlets
 // so an agency publishing a burst of notices cannot occupy every visible row.
 const lead=(deskPicks(state.news)[0]||{}).key, latest=[], count=new Map();let officialCount=0;
 for(const item of state.news){
  if(item.key===lead||latest.length>=4)continue;
  if((count.get(item.source)||0)>=2)continue;
  if(item.source_type.startsWith('Official')&&officialCount>=2)continue;
  latest.push(item);count.set(item.source,(count.get(item.source)||0)+1);
  if(item.source_type.startsWith('Official'))officialCount++;
 }
 for(const item of state.news){if(latest.length>=4)break;if(item.key!==lead&&!latest.some(s=>s.key===item.key))latest.push(item);}
 latest.forEach((item,i)=>{const row=el('div','latest-row');row.append(el('span','latest-index',String(i+1).padStart(2,'0')));const cont=el('div');const h=el('h3');h.append(link(item));cont.append(h,el('div','small-meta',item.source+' · '+utc(item.published_at,true)));row.append(cont);n.append(row);});}
 function storyCard(item){const art=el('article','story-card');art.append(visual(item));const body=el('div','story-card-body'),h=el('h3');h.append(link(item));body.append(el('div','story-card-label',item.category.toUpperCase()),h);if(sourceExcerpt(item))body.append(el('p','desk-excerpt',sourceExcerpt(item)));body.append(el('div','card-meta',shortMeta(item)));const actions=el('div','card-actions');actions.append(link(item,item.type==='article'?'Read explainer →':sourceLinkText(item)),actionSave(item));actions.firstChild.className='story-link';body.append(actions);art.append(body);return art;}
 function renderTop(){const n=$('top-grid');n.replaceChildren();const lead=(deskPicks(state.news)[0]||{}).key;const pool=deskPicks(state.news).filter(x=>x.key!==lead);const chosen=[],sources=new Set(),cats=new Set();for(const item of pool){if(chosen.length>=4)break;if(!sources.has(item.source)&&(!cats.has(item.category)||chosen.length>=3)){chosen.push(item);sources.add(item.source);cats.add(item.category);}}for(const item of pool){if(chosen.length>=4)break;if(!chosen.some(x=>x.key===item.key))chosen.push(item);}if(!chosen.length){empty(n,'Top stories appear when the headline feed updates.');return;}chosen.forEach(x=>n.append(storyCard(x)));}

 function chooseBrief(){const ranked=deskPicks(state.news),chosen=[],keys=new Set(),sources=new Set();const order=[...state.prefs,...TOPICS.filter(x=>!state.prefs.includes(x))];for(const category of order){const item=ranked.find(x=>x.category===category&&!keys.has(x.key)&&!sources.has(x.source))||ranked.find(x=>x.category===category&&!keys.has(x.key));if(item){chosen.push(item);keys.add(item.key);sources.add(item.source);}if(chosen.length===5)break;}for(const item of ranked){if(chosen.length===5)break;if(!keys.has(item.key)){chosen.push(item);keys.add(item.key);}}return chosen;}

 function renderBrief(){const n=$('brief-list');n.replaceChildren();const items=chooseBrief();if(!items.length){n.append(el('div','brief-wait','Your briefing will populate as source-linked headlines arrive.'));return;}items.forEach((item,i)=>{const row=el('article','brief-row');row.append(el('span','brief-number',String(i+1).padStart(2,'0')),el('span','brief-topic',item.category.toUpperCase()),link(item),el('span','brief-source',item.source+' · '+utc(item.published_at,true)));n.append(row);});$('brief-note').textContent=items.length+' stories · '+new Set(items.map(x=>x.source)).size+' original sources · Personalized selection';}
 function listItem(item){const row=el('article','list-article');row.append(visual(item,true));const info=el('div','details'),h=el('h3');h.append(link(item));info.append(el('div','story-card-label',item.category.toUpperCase()),h,el('div','card-meta',item.source+' · '+utc(item.published_at,true)));row.append(info,actionSave(item,'list-mini-save'));return row;}
 function renderCategories(){const eco=$('economy-stories'),policy=$('policy-stories');eco.replaceChildren();policy.replaceChildren();const e=deskPicks(state.news).filter(x=>['Markets','Economy'].includes(x.category)).slice(0,4),p=deskPicks(state.news).filter(x=>['US News','Government','Regulation','World','Technology'].includes(x.category)).slice(0,4);if(!e.length)eco.append(el('p','placeholder','No market and economy headlines are available yet.'));else e.forEach(x=>eco.append(listItem(x)));if(!p.length)policy.append(el('p','placeholder','No government or policy headlines are available yet.'));else p.forEach(x=>policy.append(listItem(x)));}
 function renderExplainers(){const n=$('explainer-grid'),rail=$('rail-explainer');n.replaceChildren();rail.replaceChildren();if(!state.articles.length){empty(n,'No explainer published yet. The AI publisher only publishes when official-source evidence passes its safeguards.');rail.append(el('p','placeholder','No AI-assisted explainers published yet.'));return;}state.articles.slice(0,3).forEach(item=>{const card=el('article','explainer-card'),h=el('h3');h.append(link(item));card.append(el('div','ai-label','AI-ASSISTED · NOT HUMAN-REVIEWED'),h,el('p','',item.summary||'An official-source explainer from the Standalone News desk.'),el('div','card-meta',item.source+' · '+utc(item.published_at,true)));const actions=el('div','card-actions');const read=link(item,'Read explainer →');read.className='story-link';actions.append(read,actionSave(item));card.append(actions);n.append(card);});const latest=state.articles[0],h=el('h3','rail-explainer-title');h.append(link(latest));rail.append(el('span','ai-label','AI-ASSISTED'),h,el('div','rail-explainer-more',latest.source+' · '+utc(latest.published_at,true)));}
 function renderWire(){const n=$('wire-list');n.replaceChildren();const term=state.search;const match=state.news.filter(x=>(state.filter==='All'||x.category===state.filter||state.filter==='Markets'&&x.category==='Economy')&&(!state.outlet||x.source===state.outlet)&&(!term||(x.title+' '+x.source+' '+x.category).toLowerCase().includes(term)));$('wire-count').textContent=match.length+' matching headlines · '+new Set(state.news.map(x=>x.source)).size+' news outlets and official sources · Original publisher links';const shown=match.slice(0,state.visible);if(!shown.length){empty(n,state.error?'Unable to retrieve original headlines. Check the GitHub Actions feed updater.':'No headlines match your search or filter.');}
 else shown.forEach(item=>{const row=el('article','wire-story');row.append(el('span','topic-pill',item.category.toUpperCase()));const main=el('div');if(item.image&&item.image.thumb_url){main.append(visual(item,true));}const h=el('h3');h.append(link(item));main.append(h);if(sourceExcerpt(item))main.append(el('p','wire-excerpt',sourceExcerpt(item)));main.append(el('div','card-meta',shortMeta(item)));if(item.image&&item.image.page_url){const cap=el('a','wire-credit',creditLine(item));cap.href=item.image.page_url;cap.target='_blank';cap.rel='noopener noreferrer';main.append(cap);}row.append(main);const actions=el('div','wire-actions');actions.append(actionSave(item));actions.append(link(item,'↗'));row.append(actions);n.append(row);});$('load-more').hidden=match.length<=state.visible;}
 function renderOutletOptions(){const n=$('wire-source'),outlets=[...new Set(state.news.map(x=>x.source))].sort((a,b)=>a.localeCompare(b));if(state.outlet&&!outlets.includes(state.outlet))state.outlet='';n.replaceChildren();const all=el('option','',`All news outlets (${outlets.length})`);all.value='';n.append(all);outlets.forEach(name=>{const opt=el('option','',name);opt.value=name;n.append(opt);});n.value=state.outlet;}
 function renderSaved(){const n=$('saved-list');n.replaceChildren();$('saved-total').textContent=String(state.saved.length);if(!state.saved.length){n.append(el('p','placeholder','No stories saved yet. Tap ♡ Save beside any article.'));$('clear-saved').hidden=true;return;}$('clear-saved').hidden=false;state.saved.forEach(item=>{const row=el('div','saved-item'),body=el('div');body.append(link(item),el('div','card-meta',item.source+' · '+utc(item.published_at,true)));row.append(body);const b=el('button','', 'Remove');b.dataset.save=item.key;b.type='button';row.append(b);n.append(row);});}
 function render(){renderHero();renderLatest();renderTop();renderBrief();renderCategories();renderExplainers();renderWire();renderSaved();}
 async function fetchJSON(path){const r=await fetch(path+'?v='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status+' '+path);return r.json();}
 async function load(){const btn=$('reload-news');btn.disabled=true;$('feed-status').textContent='REFRESHING…';$('feed-error').hidden=true;
 // Keep the existing public headline and editorial feeds, and layer the independent bot-ranked feed on top.
 // The bot feed is fully optional: first deployment and temporary outages use the existing website feed.
 let payload=null,desk=null,editorial=[];
 try{payload=await fetchJSON(demo?'./data/demo-news.json':'./data/news.json');if(!Array.isArray(payload.items))payload=null;}catch{}
 if(!demo){
   try{const d=await fetchJSON('./data/desk.json');if(Array.isArray(d.items))desk=d;}catch{}
   try{const d=await fetchJSON('./data/editorial.json');if(Array.isArray(d.items))editorial=d.items;}catch{}
 }
 const featuredIds=new Set(desk?.featured_ids||[]),raw=[...editorial,...(desk?.items||[]).map(x=>({...x,bot_selected:true,desk_featured:featuredIds.has(x.id)})),...(payload?.items||[])];
 const byUrl=new Map();for(const entry of raw){const item=normNews(entry);if(!item)continue;const prior=byUrl.get(item.key);if(!prior||item.desk_priority>prior.desk_priority)byUrl.set(item.key,item);}
 state.news=sort([...byUrl.values()]);state.feedUpdated=desk?.updated_at||payload?.updated_at||null;state.error=!state.news.length;
 if(state.error){$('feed-error').textContent='The news feed could not be loaded. Please try refreshing or check GitHub Actions.';$('feed-error').hidden=false;}
 try{const res=await fetchJSON(demo?'./data/demo-articles.json':'./data/articles.json');const seen=new Set();state.articles=sort((Array.isArray(res.items)?res.items:[]).map(normArticle).filter(x=>{if(!x||seen.has(x.key))return false;seen.add(x.key);return true;}));}catch{state.articles=[];}
 $('feed-status').textContent=state.error?'FEED UNAVAILABLE':(state.news.length+' HEADLINES · '+new Set(state.news.map(x=>x.source)).size+' OUTLETS & AGENCIES · '+(state.feedUpdated?'UPDATED '+utc(state.feedUpdated,true):'LATEST AVAILABLE'));
 btn.disabled=false;renderOutletOptions();render();}
 function showModal(id){prevFocus=document.activeElement;const node=$(id);node.hidden=false;document.body.style.overflow='hidden';if(id==='saved-overlay')renderSaved();else if(id==='brief-overlay')renderPrefs();node.querySelector('.modal-close').focus();}
 function closeModal(id){const node=$(id);node.hidden=true;document.body.style.overflow='';if(prevFocus&&prevFocus.focus)prevFocus.focus();}
 function renderPrefs(){const n=$('preference-grid');n.replaceChildren();TOPICS.forEach(c=>{const b=el('button','pref-option'+(state.prefs.includes(c)?' on':''),NAMES[c]);b.type='button';b.dataset.pref=c;b.setAttribute('aria-pressed',String(state.prefs.includes(c)));n.append(b);});}
 function setMarket(tab){document.querySelectorAll('[data-market]').forEach(b=>{const active=b.dataset.market===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-market-panel]').forEach(n=>n.classList.toggle('active',n.dataset.marketPanel===tab));}
 function syncNav(){const h=location.hash.slice(1)||'home';document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===h));document.querySelectorAll('[data-mobile-nav]').forEach(n=>n.classList.toggle('active',n.dataset.mobileNav===h));}
 function init(){const now=new Date();$('today-date').textContent=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(now);$('year').textContent=now.getUTCFullYear();const clock=()=>{$('utc-clock').textContent='UTC · '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date());};clock();setInterval(clock,30000);$('demo-warning').hidden=!demo;
 document.body.addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(b){e.preventDefault();flipSave(b.dataset.save);}});
 for(const id of ['open-saved','mobile-saved'])$(id).addEventListener('click',()=>showModal('saved-overlay'));
 for(const id of ['open-brief','open-brief-side','brief-personalize'])$(id).addEventListener('click',()=>showModal('brief-overlay'));
 $('search-toggle').addEventListener('click',()=>{location.hash='#wire';$('wire-search').focus();});
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
 document.querySelectorAll('.modal-overlay').forEach(n=>n.addEventListener('click',e=>{if(e.target===n)closeModal(n.id);}));
 window.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay:not([hidden])').forEach(n=>closeModal(n.id));});
 $('preference-grid').addEventListener('click',e=>{const b=e.target.closest('[data-pref]');if(!b)return;const c=b.dataset.pref;state.prefs=state.prefs.includes(c)?state.prefs.filter(x=>x!==c):[...state.prefs,c];renderPrefs();renderBrief();});
 $('save-prefs').addEventListener('click',()=>{store(PKEY,state.prefs);closeModal('brief-overlay');toast('Briefing preferences saved');});
 $('reset-prefs').addEventListener('click',()=>{state.prefs=[];store(PKEY,[]);renderPrefs();renderBrief();});
 $('clear-saved').addEventListener('click',()=>{if(!confirm('Remove all saved stories?'))return;state.saved=[];if(!cloudMode)store(SKEY,[]);render();toast('Saved list cleared');window.dispatchEvent(new CustomEvent('sn:bookmark-change',{detail:{clear:true}}));});
 document.querySelectorAll('[data-market]').forEach(b=>b.addEventListener('click',()=>setMarket(b.dataset.market)));
 $('wire-search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();state.visible=12;renderWire();});$('wire-source').addEventListener('change',e=>{state.outlet=e.target.value;state.visible=12;renderWire();});
 document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.topic;state.visible=12;document.querySelectorAll('[data-topic]').forEach(c=>c.classList.toggle('active',b===c));renderWire();}));
 $('load-more').addEventListener('click',()=>{state.visible+=12;renderWire();});$('reload-news').addEventListener('click',()=>load().then(()=>toast(state.error?'Could not refresh':'News feed refreshed')));
 window.addEventListener('hashchange',syncNav);syncNav();load();}

 // Separate guest browser bookmarks from signed-in cloud bookmarks.
 // The external account module never receives a service-role credential.
 window.SNDesk={
   getSaved:()=>state.saved.map(x=>({...x})),
   getGuestSaved:()=>{const v=get(SKEY,[]);return Array.isArray(v)?v.slice(0,100):[];},
   setCloudSaved:(rows)=>{
     cloudMode=true;
     const clean=Array.isArray(rows)?rows.map(x=>({type:x.type,key:x.key,url:x.url,title:x.title,source:x.source,category:x.category,published_at:x.published_at,summary:x.summary||''})).filter(x=>x&&x.key&&x.title&&((x.type==='article'&&articlePath(x.url))||(x.type==='news'&&safeURL(x.url)))).slice(0,100):[];
     state.saved=clean;render();
   },
   setGuestMode:()=>{cloudMode=false;state.saved=get(SKEY,[]);if(!Array.isArray(state.saved))state.saved=[];render();},
   openModal:showModal,
   closeModal:closeModal
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
