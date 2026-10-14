/* Standalone News frontpage. The public website reads the existing two JSON feeds;
   it never calls Gemini or private admin endpoints. All untrusted strings use textContent. */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const CATS={Fed:'Markets',SEC:'Markets',Treasury:'Government',Washington:'Government',DOJ:'Government',FDA:'Government',DEA:'DEA',CFTC:'Markets',Economy:'Economy',Markets:'Markets',Government:'Government',World:'World','US News':'US News'};
  const CATEGORY_LABELS={Fed:'Federal Reserve',SEC:'Markets',Treasury:'Treasury',DEA:'Regulation',DOJ:'Justice',FDA:'Health & safety','US News':'U.S. News'};
  const STORAGE_PREFS='standalone-news-topics-v1',STORAGE_SAVED='standalone-news-saved-v1';
  function localRead(key,fallback){try{const raw=JSON.parse(localStorage.getItem(key));return raw??fallback;}catch{return fallback;}}
  function localWrite(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{/* Private browsing can disable persistent storage. */}}
  const loadedPrefs=localRead(STORAGE_PREFS,[]),loadedSaved=localRead(STORAGE_SAVED,[]);
  const state={news:[],articles:[],filter:'All',search:'',visible:8,demo:new URLSearchParams(location.search).get('demo')==='1',prefs:Array.isArray(loadedPrefs)?loadedPrefs.filter(x=>['US News','World','Markets','Economy','Government','DEA'].includes(x)):[],saved:Array.isArray(loadedSaved)?loadedSaved.filter(x=>x&&typeof x.title==='string'&&typeof x.source==='string'&&typeof x.url==='string').slice(0,35):[]};
  function dom(tag,className,content){const el=document.createElement(tag);if(className)el.className=className;if(content!==undefined)el.textContent=content;return el;}
  function url(value){try{const u=new URL(value,location.href);if(!/^https?:$/.test(u.protocol))return null;return u.href;}catch{return null;}}
  function articlePath(path){return typeof path==='string'&&/^articles\/[a-z0-9_.-]+\.html$/.test(path)?'./'+path:null;}
  function date(value,kind='day'){const d=new Date(value);if(!value||Number.isNaN(d.getTime()))return 'Date unavailable';return new Intl.DateTimeFormat('en-US',kind==='day'?{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}:{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'UTC'}).format(d);}
  function category(item){return CATS[item.category]||item.category||'US News';}
  function catLabel(item){return CATEGORY_LABELS[item.category]||category(item);}
  function aLink(href,txt,cls='',external=false){const a=dom('a',cls,txt);a.href=href;if(external){a.target='_blank';a.rel='noopener noreferrer';a.title='Opens original source in a new tab';}return a;}
  function cleanNews(items){const seen=new Set();return items.filter(s=>{if(!s||typeof s.title!=='string'||!s.title.trim()||!s.source||!url(s.url))return false;const key=url(s.url);if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0));}
  function cleanArticles(items){const seen=new Set();return items.filter(s=>{const path=articlePath(s?.path);if(!path||typeof s.headline!=='string'||!s.headline.trim()||seen.has(path))return false;seen.add(path);return true;}).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0));}
  const formatSource=(s)=>s.source||'Original publisher';

  const BRIEF_TOPIC_ORDER=['US News','World','Markets','Economy','Government','DEA'];
  function chosenBrief(){
    const ordered=[...state.prefs,...BRIEF_TOPIC_ORDER.filter(c=>!state.prefs.includes(c))];
    const chosen=[],usedUrls=new Set(),usedSources=new Set();
    // First, give each preferred topic an opportunity to appear, then balance topics.
    for(const c of ordered){
      const choices=state.news.filter(s=>category(s)===c&&!usedUrls.has(url(s.url)));
      if(!choices.length)continue;
      const pick=choices.find(s=>!usedSources.has(formatSource(s)))||choices[0];
      chosen.push(pick);usedUrls.add(url(pick.url));usedSources.add(formatSource(pick));
      if(chosen.length===5)return chosen;
    }
    for(const item of state.news){if(chosen.length>=5)break;if(usedUrls.has(url(item.url)))continue;chosen.push(item);usedUrls.add(url(item.url));}
    return chosen;
  }
  function renderBrief(){
    const list=$('brief-list'),stories=chosenBrief();list.replaceChildren();
    const publishers=new Set(state.news.map(s=>formatSource(s).toLowerCase()));
    $('brief-source-mix').textContent=state.news.length?`${publishers.size} named sources in the feed · ${state.news.length} headlines`:'No headlines in the feed yet';
    $('brief-date').textContent=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();
    if(!stories.length){list.append(dom('li','fp-empty-text','No live stories available for your briefing yet. Check back when the headline feed updates.'));}
    for(const [i,s] of stories.entries()){
      const li=dom('li','fp-brief-item'),num=dom('span','fp-brief-number',String(i+1).padStart(2,'0'));
      const content=dom('div');content.append(dom('p','fp-brief-category',catLabel(s).toUpperCase()));
      const title=dom('h3','fp-brief-headline');title.append(aLink(url(s.url),s.title,'',true));content.append(title);
      content.append(dom('p','fp-brief-source',`Via ${formatSource(s)} · ${date(s.published_at,'time')} UTC`));
      li.append(num,content,aLink(url(s.url),'↗','fp-brief-go',true));list.append(li);
    }
    document.querySelectorAll('#brief-preferences [data-preference]').forEach(b=>b.setAttribute('aria-pressed',String(state.prefs.includes(b.dataset.preference))));
  }
  function saveKey(s){return url(s.url)||'';}
  function isSaved(s){return state.saved.some(x=>x.url===saveKey(s));}
  function saveStory(s){
    const key=saveKey(s);if(!key)return;
    if(isSaved(s)){state.saved=state.saved.filter(x=>x.url!==key);}else{
      state.saved=[{url:key,title:String(s.title).slice(0,300),source:String(s.source).slice(0,120),category:String(s.category||'News').slice(0,70),published_at:String(s.published_at||'').slice(0,50)},...state.saved].slice(0,35);
    }
    localWrite(STORAGE_SAVED,state.saved);renderSaved();renderNews();
  }
  function renderSaved(){
    const section=$('saved'),grid=$('saved-grid');section.hidden=state.saved.length===0;
    $('saved-count').textContent=String(state.saved.length);$('header-saved-link').hidden=state.saved.length===0;grid.replaceChildren();
    for(const [i,item] of state.saved.entries()){
      const link=url(item.url);if(!link)continue;
      const card=dom('article','fp-saved-card');card.append(dom('p','',`Via ${item.source} · ${item.category}`));
      const h=dom('h3');h.append(aLink(link,item.title,'',true));card.append(h);
      const button=dom('button','fp-unsave','Remove from saved');button.type='button';button.addEventListener('click',()=>saveStory(item));card.append(button);grid.append(card);
    }
  }

  function renderTicker(){const container=$('ticker-story');container.replaceChildren();const item=state.news[0];if(!item){container.textContent='The next source-linked headline will appear when the feed updates.';return;}const link=aLink(url(item.url),item.title+'  ↗','',true);container.append(dom('span','fp-ticker-source',formatSource(item)+'  /  '),link);}
  function renderLead(){const article=state.articles[0],wire=state.news[0];const own=Boolean(article),item=article||wire;
    $('lead-type').textContent=own?'STANDALONE EXPLAINER':wire?'TOP SOURCE STORY':'STANDALONE NEWS';$('lead-type').classList.toggle('fp-pill-blue',!own);
    $('lead-category').textContent=item?catLabel(item).toUpperCase():'THE DESK';
    $('lead-headline').textContent=item?(own?item.headline:item.title):'The stories behind the headlines.';
    $('lead-summary').textContent=item?(own?(item.summary||'Source-linked context from an official agency announcement.'):'A major headline from an attributed original source. Follow the link to read the full report.'):'Our latest sourced explainer will appear here as soon as it is published.';
    $('lead-credit').textContent=item?(own?'AI-ASSISTED · NOT HUMAN-REVIEWED · VIA '+formatSource(item):'ORIGINAL REPORTING · VIA '+formatSource(item)):'STANDALONE NEWS · THE EXPLAINER DESK';
    const link=$('lead-link');link.href=item?(own?articlePath(item.path):url(item.url)):'./articles/';link.textContent=own?'Read Standalone explainer ↗':wire?'Read original report ↗':'Browse explainers ↗';link.target=own||!wire?'':'_blank';if(!own&&wire){link.rel='noopener noreferrer';}else{link.removeAttribute('rel');}
  }
  function renderWire(){const list=$('top-wire-list');list.replaceChildren();if(!state.news.length){list.append(dom('p','fp-loading','No public headlines are available yet. The feed updates regularly.'));return;}for(const [i,item] of state.news.slice(0,5).entries()){
    const row=dom('article','fp-wire-row');const idx=dom('span','fp-wire-index',String(i+1).padStart(2,'0'));
    const body=dom('div','fp-wire-content');const info=dom('p','fp-wire-meta',catLabel(item).toUpperCase()+'  ·  '+date(item.published_at,'time'));const h=dom('h3');h.append(aLink(url(item.url),item.title,'',true));const credit=dom('p','fp-wire-credit','Via '+formatSource(item)+'  ↗');body.append(info,h,credit);row.append(idx,body);list.append(row);
  }}
  function renderArticles(){const grid=$('explainer-grid');grid.replaceChildren();const items=state.articles.slice(0,3);if(!items.length){const empty=dom('div','fp-explain-empty');empty.append(dom('span','fp-article-tag','STANDALONE EXPLAINERS'),dom('h3','', 'New explainers are on the way.'),dom('p','', 'When a verified official-source article passes our automated publication checks, it will appear here.'));empty.append(aLink('./articles/','Visit the explainer desk ↗','fp-explainer-link'));grid.append(empty);return;}
    for(const [i,item] of items.entries()){
      const card=dom('article','fp-explainer-card'+(i===0?' fp-explainer-highlight':''));const top=dom('div','fp-article-top');top.append(dom('span','fp-article-tag','AI-ASSISTED EXPLAINER'),dom('span','fp-article-date',date(item.published_at)));
      const content=dom('div','fp-article-content');content.append(dom('p','fp-article-category',catLabel(item).toUpperCase()));const h=dom('h3');h.append(aLink(articlePath(item.path),item.headline));content.append(h);if(item.summary)content.append(dom('p','fp-article-summary',String(item.summary).slice(0,240)));
      const foot=dom('div','fp-article-bottom');foot.append(dom('span','', 'Via '+formatSource(item)),aLink(articlePath(item.path),'Read explainer ↗','fp-explainer-link'));card.append(top,content,foot);grid.append(card);
    }
  }
  function matches(s){const c=category(s),f=state.filter;const topic=f==='All'||c===f||(f==='Government'&&['Government','DEA','FDA','DOJ','SEC','Treasury'].includes(s.category));const text=[s.title,s.source,s.category,s.summary||''].join(' ').toLowerCase();return topic&&(!state.search||text.includes(state.search));}
  function newsCard(item,i){const card=dom('article','fp-news-card');const top=dom('div','fp-news-meta');top.append(dom('span','fp-news-category',catLabel(item).toUpperCase()),dom('time','fp-news-date',date(item.published_at,'time')));const h=dom('h3');h.append(aLink(url(item.url),item.title,'',true));const type=dom('span','fp-news-source','SOURCE · '+formatSource(item));const footer=dom('div','fp-news-footer');const bookmark=dom('button','fp-save-btn',isSaved(item)?'★ Saved':'☆ Save');bookmark.type='button';bookmark.setAttribute('aria-pressed',String(isSaved(item)));bookmark.setAttribute('aria-label',(isSaved(item)?'Remove saved story: ':'Save story: ')+item.title);bookmark.addEventListener('click',()=>saveStory(item));footer.append(type,bookmark,aLink(url(item.url),'Original ↗','fp-news-visit',true));card.append(top,h,footer);if(item.summary&&String(item.source_type||'').startsWith('Official')){const excerpt=dom('p','fp-news-excerpt',String(item.summary).slice(0,135));h.after(excerpt);}return card;}
  function renderNews(){const results=state.news.filter(matches),grid=$('news-grid');grid.replaceChildren(...results.slice(0,state.visible).map(newsCard));$('article-count').textContent=state.news.length+' source-linked '+(state.news.length===1?'headline':'headlines');$('load-more').hidden=results.length<=state.visible;$('empty-news').hidden=results.length>0;
    $('feed-status').textContent=state.news.length?`Showing ${results.length} of ${state.news.length} source headlines${state.filter==='All'?'':' · '+state.filter}`: 'No public headlines are available in the feed yet.';
    for(const button of document.querySelectorAll('#category-filters [data-filter]')){const chosen=button.dataset.filter===state.filter;button.classList.toggle('is-active',chosen);button.setAttribute('aria-pressed',String(chosen));}
  }
  function renderAll(){renderTicker();renderLead();renderWire();renderBrief();renderArticles();renderNews();renderSaved();}
  async function load(){const button=$('reload-feed');button.disabled=true;let newsError=false,articleError=false;
    const stamp='?v='+Date.now();const newsPath=state.demo?'./data/demo.json':'./data/news.json';const articleFile=state.demo?'./data/demo-articles.json':'./data/articles.json';
    const [news,articles]=await Promise.allSettled([fetch(newsPath+stamp,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('News feed unavailable: HTTP '+r.status);return r.json();}),fetch(articleFile+stamp,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Explainer index unavailable: HTTP '+r.status);return r.json();})]);
    if(news.status==='fulfilled'&&Array.isArray(news.value.items)){state.news=cleanNews(news.value.items);$('feed-updated').textContent=news.value.updated_at?'Feed updated '+date(news.value.updated_at,'time'):'Updated by automated feed';}else{newsError=true;state.news=[];$('feed-updated').textContent='Headline feed temporarily unavailable';}
    if(articles.status==='fulfilled'&&Array.isArray(articles.value.items)){state.articles=cleanArticles(articles.value.items);}else{articleError=true;state.articles=[];}
    $('design-preview').hidden=!state.demo;renderAll();if(newsError)$('feed-status').textContent='The public news feed could not be loaded. Please try refreshing.';
    if(articleError && !newsError){$('explainer-grid').firstElementChild?.append(dom('p','fp-feed-note','Explainer index temporarily unavailable.'));}
    button.disabled=false;
  }
  function init(){const now=new Date();const format=new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(now);$('current-date').textContent=format.toUpperCase();$('edition-date').textContent=format;$('copyright-year').textContent=String(now.getFullYear());
    const menu=$('menu-toggle'),nav=$('primary-navigation');menu.addEventListener('click',()=>{const opened=nav.classList.toggle('fp-nav-open');menu.setAttribute('aria-expanded',String(opened));menu.setAttribute('aria-label',opened?'Close navigation':'Open navigation');});
    document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter;state.visible=8;renderNews();}));
    document.querySelectorAll('#brief-preferences [data-preference]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.preference;state.prefs=state.prefs.includes(c)?state.prefs.filter(x=>x!==c):[...state.prefs,c];localWrite(STORAGE_PREFS,state.prefs);renderBrief();}));
    $('reset-preferences').addEventListener('click',()=>{state.prefs=[];localWrite(STORAGE_PREFS,[]);renderBrief();});
    $('clear-saved').addEventListener('click',()=>{state.saved=[];localWrite(STORAGE_SAVED,[]);renderSaved();renderNews();});
    document.querySelectorAll('.fp-nav [data-category]').forEach(a=>a.addEventListener('click',()=>{state.filter=a.dataset.category;state.visible=8;renderNews();nav.classList.remove('fp-nav-open');menu.setAttribute('aria-expanded','false');}));
    document.querySelectorAll('.fp-nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('fp-nav-open');menu.setAttribute('aria-expanded','false');}));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&nav.classList.contains('fp-nav-open')){nav.classList.remove('fp-nav-open');menu.setAttribute('aria-expanded','false');menu.focus();}});
    $('news-search').addEventListener('input',e=>{state.search=e.target.value.toLowerCase().trim();state.visible=8;renderNews();});
    $('reset-filters').addEventListener('click',()=>{state.filter='All';state.search='';state.visible=8;$('news-search').value='';renderNews();});
    $('load-more').addEventListener('click',()=>{state.visible+=8;renderNews();});$('reload-feed').addEventListener('click',load);
    load();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
