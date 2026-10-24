/* Standalone News newsroom · static site frontend; source-linked headlines and original explainers. */
(()=>{'use strict';
 const $=id=>document.getElementById(id);
 const TOPICS=['US News','World','Markets','Economy','Government','Regulation','Technology'];
 const NAMES={'US News':'U.S. news',World:'World',Markets:'Markets',Economy:'Economy',Government:'Government',Regulation:'Regulation',Technology:'Technology'};
 const CATMAP={Fed:'Markets',SEC:'Markets',CFTC:'Markets',Markets:'Markets',Economy:'Economy',Treasury:'Government',DOJ:'Government',FDA:'Government',DEA:'Regulation',Washington:'Government',Government:'Government',World:'World','US News':'US News',Politics:'Government',Business:'Markets',Technology:'Technology'};
 const SKEY='standaloneNewsAppSavedV1',PKEY='standaloneNewsAppPrefsV1',FKEY='snFollowedPublishersV12';
 const demo=new URLSearchParams(location.search).get('demo')==='1';
 let lastAutomaticCheck=Date.now();
 const safeURL=x=>{try{const u=new URL(x);return /^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
 const articlePath=x=>typeof x==='string'&&/^articles\/[a-z0-9_.-]+\.html$/.test(x)?'./'+x:null;
 const cat=x=>CATMAP[String(x||'')]||'US News';
 const text=x=>x===null||x===undefined?'':String(x);
 const utc=(str,short=false)=>{const d=new Date(str);if(!str||Number.isNaN(d.getTime()))return 'Time unavailable';return new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',...(short?{}:{year:'numeric'})}).format(d)+' UTC';};
 const el=(tag,cls,content)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n;};
 const store=(k,value)=>{try{localStorage.setItem(k,JSON.stringify(value));return true;}catch{return false;}};
 const get=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v===null?d:v;}catch{return d;}};
 const normNews=s=>{if(!s||s.source_type==='Google News'||s.source_type==='Discovery')return null;
 // Scheduled agency publications may have a future date; do not label them breaking news.
 const published=Date.parse(s.published_at);if(!Number.isFinite(published)||published>Date.now()+5*60*1000)return null;
 const url=safeURL(s.url),title=text(s.title).trim(),source=text(s.source).trim();if(!url||!title||!source)return null;const img=s&&s.image&&safeURL(s.image.thumb_url)?{thumb_url:safeURL(s.image.thumb_url),page_url:safeURL(s.image.page_url),source:text(s.image.source||'Wikimedia Commons'),creator:text(s.image.creator||''),license:text(s.image.license||''),description:text(s.image.description||''),label:text(s.image.label||'Illustrative photo')}:null;return{type:'news',key:url,url,title,source,category:cat(s.category),summary:text(s.summary).trim().slice(0,240),published_at:text(s.published_at),source_type:text(s.source_type),desk_priority:Number(s.desk_priority)||0,bot_selected:Boolean(s.bot_selected),desk_featured:Boolean(s.desk_featured),image:img};};
 const normArticle=s=>{if(!s)return null;const url=articlePath(s.path),title=text(s.headline).trim();if(!url||!title)return null;return{type:'article',key:url,url,title,source:text(s.source||'Official agency'),category:cat(s.category),summary:text(s.summary),published_at:text(s.published_at)};};
 const prevSaved=get(SKEY,[]),prevPrefs=get(PKEY,[]),prevSources=get(FKEY,[]);
 const state={news:[],articles:[],saved:Array.isArray(prevSaved)?prevSaved.filter(x=>x&&x.key&&x.title&&((x.type==='article'&&articlePath(x.url))||(x.type==='news'&&safeURL(x.url)))).slice(0,100):[],prefs:Array.isArray(prevPrefs)?prevPrefs.filter(x=>TOPICS.includes(x)):[],followed:Array.isArray(prevSources)?prevSources.filter(x=>typeof x==='string').slice(0,30):[],filter:'All',outlet:'',search:'',searchScope:'all',searchPeriod:'all',visible:6,feedUpdated:null,error:false};
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
   // Rank impact only *within fresh news*, otherwise yesterday's top-scoring
   // headline can remain the lead story while today's stories keep arriving.
   const now=Date.now();
   const recent=hours=>items.filter(x=>{
     const stamp=Date.parse(x.published_at);
     return Number.isFinite(stamp)&&stamp<=now+5*60*1000&&stamp>=now-hours*3600000;
   });
   const today=recent(12),yesterday=recent(24);
   const pool=today.length>=3?today:yesterday.length>=3?yesterday:items;
   const ranked=[...pool].sort((a,b)=>newsRank(b)-newsRank(a)||new Date(b.published_at)-new Date(a.published_at));
   const chosen=[],sources=new Map(),categories=new Map();
   for(const s of ranked){
     if(chosen.length>=24)break;
     if(sources.get(s.source)>=2 || categories.get(s.category)>=7)continue;
     chosen.push(s);sources.set(s.source,(sources.get(s.source)||0)+1);categories.set(s.category,(categories.get(s.category)||0)+1);
   }
   return chosen.length?chosen:ranked;
 }
 function sourceExcerpt(item){
   if(item.type==='article')return item.summary||'';
   const summary=(item.summary||'').replace(/\s+/g,' ').trim();
   if(summary.length<55)return '';
   const normalized=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
   const a=normalized(summary),b=normalized(item.title),source=normalized(item.source);
   if(a===b||a===b+' '+source||a===source+' '+b)return '';
   if(b.length>25&&(a.startsWith(b)||b.startsWith(a))&&Math.abs(a.length-b.length)<60)return '';
   if(/^(headline from|read more at|click here|open the linked|see full article|advertisement|copyright|the latest news)/i.test(summary))return '';
   // RSS feeds sometimes contain scraped titles, legal boilerplate and publisher widgets.
   if(/(all rights reserved|sign up for our newsletter|cookies policy|click to share|subscribe to)/i.test(summary))return '';
   return summary;
 }
 function shortMeta(item){return item.source+' · '+utc(item.published_at,true);}
 function sourceLinkText(item){return item.type==='news'&&item.url.includes('news.google.com/')?'Read coverage ↗':'Original source ↗';}
 function creditLine(item){if(!item.image)return '';const bits=['Illustrative photo'];if(item.image.creator)bits.push('Photo: '+item.image.creator);bits.push(item.image.source||'Wikimedia Commons');if(item.image.license)bits.push(item.image.license);bits.push('cropped to fit');return bits.join(' · ');}

 function link(item,label){const a=el('a','',label||item.title);a.href=item.url;if(item.type==='news'){a.target='_blank';a.rel='noopener noreferrer';a.title='Open the original source in a new tab';}return a;}
 function iconCategory(item){return ({Markets:'↗',Economy:'%',World:'◎',Government:'§',Regulation:'⚖','US News':'◇',Technology:'⌘'})[item.category]||'◇';}
 function visualClass(item){return({Markets:'visual-markets',Economy:'visual-economy',World:'visual-world',Government:'visual-government',Regulation:'visual-regulation',Technology:'visual-world','US News':'visual-us'})[item.category]||'visual-us';}
 function visual(item,small=false){
   const wrap=el('div',(small?'list-thumb ':'story-visual ')+visualClass(item));
   const catArt={'US News':'us','World':'world','Markets':'markets','Economy':'economy','Government':'government','Regulation':'regulation','Technology':'technology'};
   const art='./assets/desk-'+(catArt[item.category]||'us')+'.svg';
   const illustration=()=>{wrap.classList.remove('has-photo');wrap.classList.add('has-illustration');const img=el('img','news-illustration');img.src=art;img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>{wrap.classList.remove('has-illustration');wrap.replaceChildren(el('span','visual-icon',iconCategory(item)));};wrap.replaceChildren(img);};
   if(item.image&&item.image.thumb_url){wrap.classList.add('has-photo');const img=el('img','news-photo');img.src=item.image.thumb_url;img.alt=(item.image.description||'Illustrative photograph related to this news topic');img.loading='lazy';img.decoding='async';img.onerror=illustration;wrap.append(img);return wrap;}
   illustration();return wrap;
 }
 function photoCredit(item){if(!item.image?.page_url)return null;const a=el('a','photo-credit',creditLine(item));a.href=item.image.page_url;a.target='_blank';a.rel='noopener noreferrer license';a.title='Illustrative image attribution and original license';return a;}
 function followButton(source){const name=text(source);const followed=state.followed.includes(name);const b=el('button','follow-source'+(followed?' on':''),followed?'Following ✓':'+ Follow source');b.type='button';b.dataset.follow=name;b.setAttribute('aria-pressed',String(followed));b.setAttribute('aria-label',(followed?'Following ':'Follow source ') + name);return b;}
 function renderFollowing(){const n=$('following-list'),box=$('following-section'),notes=$('following-description');if(!n||!box)return;
   const relevant=state.news.filter(x=>state.prefs.includes(x.category)||state.followed.includes(x.source));
   box.hidden=false;
   const picked=deskPicks(relevant).slice(0,4);n.replaceChildren();
   if(!state.prefs.length&&!state.followed.length){
     const panel=el('div','follow-empty');
     panel.append(el('div','follow-empty-mark','FOR YOU'));
     panel.append(el('h3','', 'Make this desk your own.'));
     panel.append(el('p','', 'Follow topics or news publishers to see a personalized selection here. Your choices stay on this device.'));
     const btn=el('button','follow-empty-action','Choose interests →');btn.type='button';btn.addEventListener('click',()=>showModal('brief-overlay'));panel.append(btn);n.append(panel);
   }else if(!picked.length){empty(n,'No new stories match your followed topics and publishers yet.');}
   else picked.forEach(x=>n.append(storyCard(x)));
   if(notes)notes.textContent=(state.prefs.length||state.followed.length)?state.prefs.length+' followed topics · '+state.followed.length+' followed publishers · Preferences saved on this device':'Your followed topics and publishers will appear here after you choose them';
 }
 function actionSave(item,cls='save-small'){const saved=state.saved.some(x=>x.key===item.key);const b=el('button',cls+(saved?' on':''),saved?'♥ Saved':'♡ Save');b.type='button';b.dataset.save=item.key;b.setAttribute('aria-pressed',String(saved));b.setAttribute('aria-label',(saved?'Saved ':'Save ')+item.title);return b;}
 function toast(msg){const t=$('toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,2600);}
 function flipSave(key){let item=[...state.news,...state.articles,...state.saved].find(x=>x.key===key);if(!item)return;const had=state.saved.some(x=>x.key===key);state.saved=had?state.saved.filter(x=>x.key!==key):[{type:item.type,key:item.key,url:item.url,title:item.title,source:item.source,category:item.category,published_at:item.published_at,summary:item.summary||''},...state.saved].slice(0,100);if(!cloudMode&&!store(SKEY,state.saved))toast('Your browser could not save this story');else toast(had?'Removed from Saved':'Added to Saved');render();window.dispatchEvent(new CustomEvent('sn:bookmark-change',{detail:{key,added:!had,item:state.saved.find(x=>x.key===key)||item}}));}
 function empty(node,msg){node.replaceChildren(el('div','empty-panel',msg));}
 function renderHeroContext(item){const box=$('lead-context'),blurb=$('lead-context-summary'),linkEl=$('lead-context-link');if(!box||!blurb||!linkEl)return;box.hidden=true;if(!item||item.type==='article')return;
   const meaningful=t=>new Set(String(t).toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!['today','this','that','with','from','will','after','amid','their','report','reports','says','news','update','state','states','market','markets','official','source','latest','rate','rates','year','years'].includes(w))||[]);
   const words=meaningful(item.title);
   const related=state.articles.map(a=>({article:a,shared:[...words].filter(w=>meaningful(a.title).has(w)).length})).filter(x=>x.article.category===item.category&&x.shared>=2&&x.article.summary&&x.article.summary.length>=50).sort((a,b)=>b.shared-a.shared)[0];
   if(!related)return;
   box.hidden=false;box.open=window.innerWidth>760;blurb.textContent=related.article.summary.slice(0,215);linkEl.href=related.article.url;
 }
 function renderHero(){const item=deskPicks(state.news)[0]||state.articles[0],leadSave=$('lead-save'),cta=$('lead-link'),hero=$('hero-art'),credit=$('lead-photo-credit');if(!item){$('lead-type').textContent='THE DAILY DESK';$('lead-title').textContent=state.error?'Unable to load recent headlines.':'What’s happening in your world, without the noise.';$('lead-summary').textContent='The latest source-linked headlines and AI-assisted explainers will appear here.';$('lead-summary').hidden=false;$('lead-source').textContent='Standalone News';$('lead-time').textContent='—';$('lead-category').textContent='YOUR NEWS';leadSave.hidden=true;cta.href='#wire';cta.textContent='Explore the news wire →';cta.removeAttribute('target');cta.removeAttribute('rel');hero.className='hero-art art-world';hero.style.removeProperty('--hero-image');const caption=hero.querySelector('.hero-image-caption');if(caption){caption.textContent='A BIGGER PICTURE';caption.hidden=true;}if(credit)credit.hidden=true;renderHeroContext(null);return;}
 $('lead-type').textContent=item.type==='article'?'AI-ASSISTED EXPLAINER':(item.bot_selected?'DESK PICK · AUTOMATED':'TOP STORY');$('lead-category').textContent=item.category.toUpperCase();$('lead-title').textContent=item.title;
 const excerpt=sourceExcerpt(item);$('lead-summary').textContent=excerpt;$('lead-summary').hidden=!excerpt;renderHeroContext(item);
 $('lead-source').textContent=item.type==='article'?'Standalone News · AI-assisted':'Via '+item.source;$('lead-time').textContent=utc(item.published_at,true);
 hero.className='hero-art '+(({Markets:'art-economy',Economy:'art-economy',Government:'art-government',Regulation:'art-regulation',World:'art-world'})[item.category]||'art-world');const caption=hero.querySelector('.hero-image-caption');if(item.image&&item.image.thumb_url){hero.classList.add('has-photo');hero.style.setProperty('--hero-image',`url("${item.image.thumb_url}")`);if(caption)caption.hidden=true;if(credit){if(item.image.page_url){credit.hidden=false;credit.href=item.image.page_url;credit.textContent=creditLine(item);credit.title='Image attribution and license';}else credit.hidden=true;}const probe=new Image();probe.onerror=()=>{if(hero.style.getPropertyValue('--hero-image').includes(item.image.thumb_url)){hero.classList.remove('has-photo');hero.style.removeProperty('--hero-image');if(caption){caption.textContent='A BIGGER PICTURE';caption.hidden=true;}if(credit)credit.hidden=true;}};probe.src=item.image.thumb_url;}else{hero.style.removeProperty('--hero-image');if(caption){caption.textContent='A BIGGER PICTURE';caption.hidden=true;}if(credit)credit.hidden=true;}
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
 function storyCard(item){const art=el('article','story-card');art.append(visual(item));const body=el('div','story-card-body'),h=el('h3');h.append(link(item));body.append(el('div','story-card-label',item.category.toUpperCase()),h);if(sourceExcerpt(item))body.append(el('p','desk-excerpt',sourceExcerpt(item)));body.append(el('div','card-meta',shortMeta(item)));const photo=photoCredit(item);if(photo)body.append(photo);body.append(followButton(item.source));const actions=el('div','card-actions');actions.append(link(item,item.type==='article'?'Read explainer →':sourceLinkText(item)),actionSave(item));actions.firstChild.className='story-link';body.append(actions);art.append(body);return art;}
 function renderTop(){const n=$('top-grid');n.replaceChildren();const lead=(deskPicks(state.news)[0]||{}).key;const pool=deskPicks(state.news).filter(x=>x.key!==lead);const chosen=[],sources=new Set(),cats=new Set();for(const item of pool){if(chosen.length>=4)break;if(!sources.has(item.source)&&(!cats.has(item.category)||chosen.length>=3)){chosen.push(item);sources.add(item.source);cats.add(item.category);}}for(const item of pool){if(chosen.length>=4)break;if(!chosen.some(x=>x.key===item.key))chosen.push(item);}if(!chosen.length){empty(n,'Top stories appear when the headline feed updates.');return;}const usedImages=new Set();const leadItem=deskPicks(state.news)[0];if(leadItem?.image?.thumb_url)usedImages.add(leadItem.image.thumb_url);chosen.forEach(x=>{if(x.image?.thumb_url&&usedImages.has(x.image.thumb_url)){x={...x,image:null};}else if(x.image?.thumb_url){usedImages.add(x.image.thumb_url);}n.append(storyCard(x));});}

 function chooseBrief(){const ranked=deskPicks(state.news),chosen=[],keys=new Set(),sources=new Set();const prioritized=[...ranked.filter(x=>state.followed.includes(x.source)),...ranked.filter(x=>!state.followed.includes(x.source))];const order=[...state.prefs,...TOPICS.filter(x=>!state.prefs.includes(x))];for(const category of order){const item=prioritized.find(x=>x.category===category&&!keys.has(x.key)&&!sources.has(x.source))||prioritized.find(x=>x.category===category&&!keys.has(x.key));if(item){chosen.push(item);keys.add(item.key);sources.add(item.source);}if(chosen.length===5)break;}for(const item of ranked){if(chosen.length===5)break;if(!keys.has(item.key)){chosen.push(item);keys.add(item.key);}}return chosen;}

 function renderBrief(){const n=$('brief-list');n.replaceChildren();const items=chooseBrief();if(!items.length){n.append(el('div','brief-wait','Your briefing will populate as source-linked headlines arrive.'));return;}items.forEach((item,i)=>{const row=el('article','brief-row');row.append(el('span','brief-number',String(i+1).padStart(2,'0')),el('span','brief-topic',item.category.toUpperCase()),link(item),el('span','brief-source',item.source+' · '+utc(item.published_at,true)));n.append(row);});$('brief-note').textContent=items.length+' stories · '+new Set(items.map(x=>x.source)).size+' original sources · Personalized selection';}
 function listItem(item){const row=el('article','list-article');row.append(visual(item,true));const info=el('div','details'),h=el('h3');h.append(link(item));info.append(el('div','story-card-label',item.category.toUpperCase()),h,el('div','card-meta',item.source+' · '+utc(item.published_at,true)));const photo=photoCredit(item);if(photo)info.append(photo);row.append(info,actionSave(item,'list-mini-save'));return row;}
 function renderCategories(){const eco=$('economy-stories'),policy=$('policy-stories');eco.replaceChildren();policy.replaceChildren();const e=deskPicks(state.news).filter(x=>['Markets','Economy'].includes(x.category)).slice(0,4),p=deskPicks(state.news).filter(x=>['US News','Government','Regulation','World','Technology'].includes(x.category)).slice(0,4);if(!e.length)eco.append(el('p','placeholder','No market and economy headlines are available yet.'));else e.forEach(x=>eco.append(listItem(x)));if(!p.length)policy.append(el('p','placeholder','No government or policy headlines are available yet.'));else p.forEach(x=>policy.append(listItem(x)));}
 function renderExplainers(){const n=$('explainer-grid'),rail=$('rail-explainer');n.replaceChildren();rail.replaceChildren();if(!state.articles.length){empty(n,'No explainer published yet. The AI publisher only publishes when official-source evidence passes its safeguards.');rail.append(el('p','placeholder','No AI-assisted explainers published yet.'));return;}state.articles.slice(0,3).forEach(item=>{const card=el('article','explainer-card'),h=el('h3');h.append(link(item));card.append(el('div','ai-label','AI-ASSISTED · NOT HUMAN-REVIEWED'),h,el('p','',item.summary||'An official-source explainer from the Standalone News desk.'),el('div','card-meta',item.source+' · '+utc(item.published_at,true)));const actions=el('div','card-actions');const read=link(item,'Read explainer →');read.className='story-link';actions.append(read,actionSave(item));card.append(actions);n.append(card);});const latest=state.articles[0],h=el('h3','rail-explainer-title');h.append(link(latest));rail.append(el('span','ai-label','AI-ASSISTED'),h,el('div','rail-explainer-more',latest.source+' · '+utc(latest.published_at,true)));}
 function searchResults(){const term=state.search;const cutoff=state.searchPeriod==='all'?null:Date.now()-({day:1,week:7,month:30}[state.searchPeriod]||3650)*86400000;
   const pool=[...(state.searchScope==='explainers'?[]:state.news),...(state.searchScope==='news'?[]:state.articles)];
   const items=state.searchScope==='saved'?state.saved:pool;
   return items.filter(x=>(state.filter==='All'||x.category===state.filter||state.filter==='Markets'&&x.category==='Economy')&&(!state.outlet||x.source===state.outlet)&&(!cutoff||new Date(x.published_at).getTime()>=cutoff)&&(!term||(x.title+' '+x.source+' '+x.category+' '+(x.summary||'')).toLowerCase().includes(term)));
 }
 function renderWire(){
   const n=$('wire-list');n.replaceChildren();const match=searchResults();
   $('wire-count').textContent=match.length+' matching '+(state.searchScope==='saved'?'saved stories':'stories')+' · Source-linked coverage · Titles and summaries only';
   const shown=match.slice(0,state.visible);
   if(!shown.length){empty(n,state.error?'Unable to retrieve recent headlines. Check the feed updater.':'No items match these filters.');}
   else shown.forEach(item=>{
     const row=el('article','wire-story'),media=el('div','wire-media'),main=el('div','wire-content');
     media.append(visual(item,true));row.append(media);
     const meta=el('div','wire-entry-top');
     meta.append(el('span','topic-pill',item.type==='article'?'EXPLAINER':item.category.toUpperCase()));
     if(item.type==='news'&&item.bot_selected)meta.append(el('span','wire-curation','AUTO-RANKED'));
     main.append(meta);
     const h=el('h3','wire-headline');h.append(link(item));main.append(h);
     const excerpt=sourceExcerpt(item);if(excerpt)main.append(el('p','wire-excerpt',excerpt));
     main.append(el('div','card-meta wire-byline',shortMeta(item)));
     const photo=photoCredit(item);if(photo)main.append(photo);
     const actions=el('div','wire-actions');
     if(item.type==='news')actions.append(followButton(item.source));
     actions.append(actionSave(item));
     const read=link(item,item.type==='article'?'Read explainer →':sourceLinkText(item));read.className='wire-read';actions.append(read);
     main.append(actions);row.append(main);n.append(row);
   });
   $('load-more').hidden=match.length<=state.visible;
 }
 function renderOutletOptions(){const n=$('wire-source'),outlets=[...new Set([...state.news,...state.articles,...state.saved].map(x=>x.source))].sort((a,b)=>a.localeCompare(b));if(state.outlet&&!outlets.includes(state.outlet))state.outlet='';n.replaceChildren();const all=el('option','',`All outlets (${outlets.length})`);all.value='';n.append(all);outlets.forEach(name=>{const opt=el('option','',name);opt.value=name;n.append(opt);});n.value=state.outlet;}
 function renderSaved(){const n=$('saved-list');n.replaceChildren();$('saved-total').textContent=String(state.saved.length);if(!state.saved.length){n.append(el('p','placeholder','No stories saved yet. Tap ♡ Save beside any article.'));$('clear-saved').hidden=true;return;}$('clear-saved').hidden=false;state.saved.forEach(item=>{const row=el('div','saved-item'),body=el('div');body.append(link(item),el('div','card-meta',item.source+' · '+utc(item.published_at,true)));row.append(body);const b=el('button','', 'Remove');b.dataset.save=item.key;b.type='button';row.append(b);n.append(row);});}
 function render(){renderHero();renderLatest();renderTop();renderBrief();renderFollowing();renderCategories();renderExplainers();renderWire();renderSaved();}
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
 const byUrl=new Map();for(const entry of raw){const item=normNews(entry);if(!item)continue;const prior=byUrl.get(item.key);if(!prior){byUrl.set(item.key,item);}else if(item.desk_priority>prior.desk_priority){if(!item.image)item.image=prior.image;byUrl.set(item.key,item);}else if(!prior.image&&item.image){prior.image=item.image;}}
 state.news=sort([...byUrl.values()]);const feedTimes=[desk?.updated_at,payload?.updated_at].filter(Boolean).map(t=>Date.parse(t)).filter(Number.isFinite);
 state.feedUpdated=feedTimes.length?new Date(Math.max(...feedTimes)).toISOString():null;state.error=!state.news.length;
 if(state.error){$('feed-error').textContent='The news feed could not be loaded. Please try refreshing or check GitHub Actions.';$('feed-error').hidden=false;}
 try{const res=await fetchJSON(demo?'./data/demo-articles.json':'./data/articles.json');const seen=new Set();state.articles=sort((Array.isArray(res.items)?res.items:[]).map(normArticle).filter(x=>{if(!x||seen.has(x.key))return false;seen.add(x.key);return true;}));}catch{state.articles=[];}
 $('feed-status').textContent=state.error?'FEED UNAVAILABLE':(state.news.length+' HEADLINES · '+new Set(state.news.map(x=>x.source)).size+' OUTLETS & AGENCIES · '+(state.feedUpdated?'UPDATED '+utc(state.feedUpdated,true):'LATEST AVAILABLE'));
 btn.disabled=false;renderOutletOptions();render();renderPrefs();const live=$('latest-status');if(live)live.textContent=state.feedUpdated?'Updated '+utc(state.feedUpdated,true):'Latest available';}
 function showModal(id){prevFocus=document.activeElement;const node=$(id);node.hidden=false;document.body.style.overflow='hidden';if(id==='saved-overlay')renderSaved();else if(id==='brief-overlay')renderPrefs();node.querySelector('.modal-close').focus();}
 function closeModal(id){const node=$(id);node.hidden=true;document.body.style.overflow='';if(prevFocus&&prevFocus.focus)prevFocus.focus();}
 function renderPrefs(){const n=$('preference-grid');n.replaceChildren();TOPICS.forEach(c=>{const b=el('button','pref-option'+(state.prefs.includes(c)?' on':''),NAMES[c]);b.type='button';b.dataset.pref=c;b.setAttribute('aria-pressed',String(state.prefs.includes(c)));n.append(b);});const sources=$('publisher-preference-grid');if(sources){sources.replaceChildren();const outlets=[...new Set(state.news.map(x=>x.source))].sort().slice(0,85);for(const name of [...new Set([...state.followed,...outlets])]){const b=el('button','publisher-option'+(state.followed.includes(name)?' on':''),name);b.type='button';b.dataset.follow=name;b.setAttribute('aria-pressed',String(state.followed.includes(name)));sources.append(b);}}}
 function setMarket(tab){document.querySelectorAll('[data-market]').forEach(b=>{const active=b.dataset.market===tab;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});document.querySelectorAll('[data-market-panel]').forEach(n=>n.classList.toggle('active',n.dataset.marketPanel===tab));}
 function syncNav(){const h=location.hash.slice(1)||'home';document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===h));document.querySelectorAll('[data-mobile-nav]').forEach(n=>n.classList.toggle('active',n.dataset.mobileNav===h));}
 // A deep link from Markets, Company Research, or Community can be positioned
 // before the asynchronous news feed expands the sections above its target.
 // Correct that one initial jump after the feed renders, unless the reader
 // has already started navigating or scrolling manually.
 function restoreDeepLinkAfterFeed(entryHash,wasInterrupted,finish){
   if(!entryHash||wasInterrupted()||location.hash!==entryHash){finish();return;}
   let id;
   try{id=decodeURIComponent(entryHash.slice(1));}catch{finish();return;}
   const target=document.getElementById(id);
   if(!target){finish();return;}
   requestAnimationFrame(()=>requestAnimationFrame(()=>{
     if(!wasInterrupted()&&location.hash===entryHash){
       target.scrollIntoView({block:'start',behavior:'instant'});
     }
     finish();
   }));
 }
 // Mobile-only TradingView tape. It displays the vendor's actual price changes,
 // not static directional arrows; desktop continues using the existing working widget.
 function initMobileMarkets(){
   const host=$('mobile-market-inner');if(!host)return;
   const media=window.matchMedia('(max-width: 760px)');
   let requested=false;
   function mount(){
     if(!media.matches||requested)return;
     requested=true;
     const wrap=document.createElement('div');wrap.className='tradingview-widget-container mobile-tv-widget';
     wrap.style.width='1040px';wrap.style.height='82px';
     const slot=document.createElement('div');slot.className='tradingview-widget-container__widget';
     slot.style.width='100%';slot.style.height='100%';wrap.appendChild(slot);
     const message=$('mobile-market-fallback');
     const observer=new MutationObserver(()=>{
       if(wrap.querySelector('iframe')){
         if(message)message.hidden=true;
         observer.disconnect();
       }
     });
     observer.observe(wrap,{childList:true,subtree:true});
     const script=document.createElement('script');
     script.src='https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js';
     script.type='text/javascript';script.async=true;
     script.textContent=JSON.stringify({
       symbols:[
         {proName:'AMEX:SPY',title:'SPY'},
         {proName:'NASDAQ:QQQ',title:'QQQ'},
         {proName:'NASDAQ:NVDA',title:'NVDA'},
         {proName:'NASDAQ:TSLA',title:'TSLA'},
         {proName:'NASDAQ:AAPL',title:'AAPL'},
         {proName:'NASDAQ:MSFT',title:'MSFT'}
       ],
       showSymbolLogo:false,colorTheme:'light',isTransparent:true,
       displayMode:'regular',locale:'en'
     });
     script.onerror=()=>{if(message)message.textContent='TradingView quotes unavailable. Open Full markets →';};
     host.appendChild(wrap);
     wrap.appendChild(script);
     window.setTimeout(()=>{
       if(!wrap.querySelector('iframe')){
         if(message)message.textContent='Prices unavailable. Open Full markets →';
         observer.disconnect();
       }
     },14000);
   }
   mount();
   if(media.addEventListener)media.addEventListener('change',mount);
 }

 function init(){initMobileMarkets();const now=new Date();$('today-date').textContent=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(now);$('year').textContent=now.getUTCFullYear();const clock=()=>{$('utc-clock').textContent='UTC · '+new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hourCycle:'h23',timeZone:'UTC'}).format(new Date());};clock();setInterval(clock,30000);$('demo-warning').hidden=!demo;
 document.body.addEventListener('click',e=>{const b=e.target.closest('[data-save]');if(b){e.preventDefault();flipSave(b.dataset.save);}const f=e.target.closest('[data-follow]');if(f){e.preventDefault();const name=f.dataset.follow;state.followed=state.followed.includes(name)?state.followed.filter(x=>x!==name):[...state.followed,name].slice(0,30);store(FKEY,state.followed);render();renderPrefs();toast(state.followed.includes(name)?'Publisher followed':'Publisher unfollowed');}});
 for(const id of ['open-saved','mobile-saved'])$(id).addEventListener('click',()=>showModal('saved-overlay'));
 // Open the same Saved dialog when a reader follows the mobile shortcut from another page.
 if(new URLSearchParams(location.search).get('saved')==='1')showModal('saved-overlay');
 for(const id of ['open-brief','open-brief-side','brief-personalize'])$(id).addEventListener('click',()=>showModal('brief-overlay'));
 $('search-toggle').addEventListener('click',()=>{location.hash='#wire';$('wire-search').focus();});
 document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(b.dataset.close)));
 document.querySelectorAll('.modal-overlay').forEach(n=>n.addEventListener('click',e=>{if(e.target===n)closeModal(n.id);}));
 window.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay:not([hidden])').forEach(n=>closeModal(n.id));});
 $('preference-grid').addEventListener('click',e=>{const b=e.target.closest('[data-pref]');if(!b)return;const c=b.dataset.pref;state.prefs=state.prefs.includes(c)?state.prefs.filter(x=>x!==c):[...state.prefs,c];store(PKEY,state.prefs);renderPrefs();renderBrief();renderFollowing();});
 $('save-prefs').addEventListener('click',()=>{store(PKEY,state.prefs);store(FKEY,state.followed);closeModal('brief-overlay');render();toast('Reading preferences saved on this device');});
 $('reset-prefs').addEventListener('click',()=>{state.prefs=[];store(PKEY,[]);renderPrefs();renderBrief();renderFollowing();});
 $('clear-saved').addEventListener('click',()=>{if(!confirm('Remove all saved stories?'))return;state.saved=[];if(!cloudMode)store(SKEY,[]);render();toast('Saved list cleared');window.dispatchEvent(new CustomEvent('sn:bookmark-change',{detail:{clear:true}}));});
 document.querySelectorAll('[data-market]').forEach(b=>b.addEventListener('click',()=>setMarket(b.dataset.market)));
 const moreFilters=$('wire-more-toggle');
 if(moreFilters){moreFilters.addEventListener('click',()=>{
   const panel=document.querySelector('.wire-section .wire-tools');
   const expanded=!!panel&&!panel.classList.contains('filters-expanded');
   panel?.classList.toggle('filters-expanded',expanded);
   moreFilters.setAttribute('aria-expanded',String(expanded));
   moreFilters.querySelector('.wire-chevron').textContent=expanded?'⌃':'⌄';
 });}
 $('search-scope')?.addEventListener('change',e=>{state.searchScope=e.target.value;state.visible=6;renderWire();});$('search-period')?.addEventListener('change',e=>{state.searchPeriod=e.target.value;state.visible=6;renderWire();});
 $('wire-search').addEventListener('input',e=>{state.search=e.target.value.trim().toLowerCase();state.visible=6;renderWire();});$('wire-source').addEventListener('change',e=>{state.outlet=e.target.value;state.visible=6;renderWire();});
 document.querySelectorAll('[data-topic]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.topic;state.visible=6;document.querySelectorAll('[data-topic]').forEach(c=>c.classList.toggle('active',b===c));renderWire();}));
 $('load-more').addEventListener('click',()=>{state.visible+=6;renderWire();});$('reload-news').addEventListener('click',()=>{lastAutomaticCheck=Date.now();load().then(()=>toast(state.error?'Could not refresh':'News feed refreshed'));});
 window.addEventListener('hashchange',syncNav);syncNav();
 const entryHash=location.hash;
 let navigationInterrupted=false;
 const interactionEvents=['wheel','touchstart','pointerdown','keydown'];
 const stopTracking=()=>interactionEvents.forEach(name=>window.removeEventListener(name,interruptNavigation));
 const interruptNavigation=()=>{navigationInterrupted=true;stopTracking();};
 if(entryHash)interactionEvents.forEach(name=>window.addEventListener(name,interruptNavigation,{passive:true}));
 load().then(()=>restoreDeepLinkAfterFeed(entryHash,()=>navigationInterrupted,stopTracking),stopTracking);
 // Check again without a manual reload: scheduled GitHub Actions can run late,
 // and long-lived browser tabs otherwise continue to show their first snapshot.
 const refreshIfVisible=()=>{
   if(demo||document.hidden||Date.now()-lastAutomaticCheck<5*60*1000)return;
   if(document.querySelector('.modal-overlay:not([hidden])'))return;
   lastAutomaticCheck=Date.now();
   load().catch(()=>{});
 };
 window.setInterval(refreshIfVisible,60*1000);
 document.addEventListener('visibilitychange',refreshIfVisible);
}

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
