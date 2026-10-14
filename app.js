/* Standalone News — accessible public feed UI. No private bot endpoints. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const state={items:[],category:'All',term:'',visible:10,demo:new URLSearchParams(location.search).get('demo')==='1'};
  const categories={'Fed':'Markets','SEC':'Markets','Treasury':'Government','Washington':'Government','DOJ':'Government','FDA':'Government','DEA':'DEA','CFTC':'Markets','Economy':'Economy','Markets':'Markets','Government':'Government','World':'World','US News':'US News'};
  const safeUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?u.href:null;}catch{return null;}};
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const normalizedCategory=c=>categories[c]||c||'US News';
  const categoryName=c=>({'US News':'U.S. news','DEA':'DEA & regulation','Fed':'Federal Reserve','DOJ':'Justice','FDA':'FDA','SEC':'SEC','Treasury':'Treasury','Washington':'Washington'}[c]||c||'Latest');
  const formatDate=value=>{const d=new Date(value);if(!value||isNaN(+d))return 'Date unavailable';return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'}).format(d);};
  const formatTime=value=>{const d=new Date(value);if(!value||isNaN(+d))return 'Time unavailable';return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d);};
  const addStoryLink=(item,txt,cls)=>{const a=node('a',cls,txt);a.href=safeUrl(item.url)||'#latest';a.setAttribute('aria-label',`${txt==='Read source'?'Read original source for':txt==='Source ↗'?'Read original source for':''} ${item.title}`.trim());return a;};
  const matches=(item,cat)=>cat==='All'||(cat==='Government' ? ['Government','DEA','Washington','Treasury','DOJ','FDA','SEC'].includes(item.category)||normalizedCategory(item.category)==='Government' : item.category===cat||normalizedCategory(item.category)===cat);
  const results=()=>state.items.filter(s=>matches(s,state.category)&&(!state.term||[s.title,s.source,s.category,s.summary||''].join(' ').toLowerCase().includes(state.term)));
  const setStatus=msg=>{byId('feed-status').textContent=msg;};
  function setFeature(){const lead=state.items[0];const link=byId('feature-link');if(!lead){byId('feature-title').textContent='Independent news, clearly sourced.';byId('feature-summary').textContent='The next headline will appear here after the public news feed updates.';byId('feature-category').textContent='LATEST COVERAGE';byId('feature-meta').textContent='STANDALONE NEWS';link.href='#latest';link.textContent='Browse the latest ↗';return;}
    byId('feature-category').textContent=categoryName(lead.category).toUpperCase();byId('feature-title').textContent=lead.title;
    byId('feature-summary').textContent=lead.summary&&String(lead.source_type||'').startsWith('Official')?lead.summary.slice(0,220):'Reporting from the source linked below. Read the original publication for details and updates.';
    byId('feature-meta').textContent=`Via ${lead.source} · ${formatTime(lead.published_at)}`;link.href=safeUrl(lead.url);link.textContent='Read original source ↗';
  }
  function setWire(){const w=byId('wire-items');w.replaceChildren();if(!state.items.length){w.textContent='No headlines available yet. The next feed update will appear here.';return;}
    const lead=state.items[0];w.append(node('span','',categoryName(lead.category)+'  /  '),addStoryLink(lead,lead.title,''));
  }
  function storyCard(item){const el=node('article','article-card');const top=node('div','card-meta');top.append(node('span','source-kicker',categoryName(item.category).toUpperCase()));const d=node('time','date-kicker',formatDate(item.published_at));if(item.published_at)d.dateTime=item.published_at;top.append(d);el.append(top);
    const h=node('h3');h.append(addStoryLink(item,item.title,''));el.append(h);
    if(item.summary&&String(item.source_type||'').startsWith('Official'))el.append(node('p','',String(item.summary).slice(0,190)));
    const footer=node('div','card-footer');footer.append(node('span','',`Via ${item.source}`),addStoryLink(item,'Read source',''));el.append(footer);return el;
  }
  function storyRow(item){const el=node('article','story-row');const t=node('time','story-time',formatTime(item.published_at));if(item.published_at)t.dateTime=item.published_at;const body=node('div');body.append(node('p','story-cat',categoryName(item.category).toUpperCase()));const h=node('h4');h.append(addStoryLink(item,item.title,''));body.append(h,node('div','story-source',`Via ${item.source}`),addStoryLink(item,'Read source','read-original'));el.append(t,body);return el;}
  function render(){const all=results(),cards=all.slice(0,2),rows=all.slice(2);byId('article-grid').replaceChildren(...cards.map(storyCard));byId('latest-list').replaceChildren(...rows.slice(0,state.visible).map(storyRow));byId('article-count').textContent=all.length+' '+(all.length===1?'story':'stories');byId('load-more').hidden=rows.length<=state.visible;byId('empty-state').hidden=all.length>0;
    if(!all.length){byId('empty-message').textContent=state.items.length?'Try another filter or search term.':'No stories are available from the public feed right now. Please check back later.';}
    document.querySelectorAll('#category-filters [data-category]').forEach(button=>{const selected=button.dataset.category===state.category;button.setAttribute('aria-pressed',String(selected));button.classList.toggle('selected',selected);});
    setStatus(all.length===0?byId('empty-message').textContent:`Showing ${all.length} ${all.length===1?'headline':'headlines'} in ${state.category==='All'?'all topics':state.category}.`);
  }
  function setCategory(cat){state.category=cat;state.visible=10;render();closeMenu();}
  function closeMenu(){const nav=byId('site-nav'),b=byId('menu-toggle');nav.classList.remove('nav-open');b.setAttribute('aria-expanded','false');b.setAttribute('aria-label','Open navigation');}
  async function load(){const path=state.demo?'./data/demo.json':'./data/news.json';setStatus('Loading latest headlines…');byId('reload-feed').disabled=true;
    try{const res=await fetch(path+'?v='+Date.now(),{cache:'no-store'});if(!res.ok)throw new Error('Feed request failed');const data=await res.json();if(!Array.isArray(data.items))throw new Error('Feed has invalid format');let published=[];
      if(!state.demo){try{const editorial=await fetch('./data/editorial.json?v='+Date.now(),{cache:'no-store'});if(editorial.ok){const json=await editorial.json();if(Array.isArray(json.items))published=json.items;}}catch{ /* editorial updates are optional */ }}
      const seen=new Set();state.items=[...published,...data.items].filter(s=>{if(!s?.title||!s?.source||!safeUrl(s.url))return false;const key=s.url;if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>new Date(b.published_at||0)-new Date(a.published_at||0));
      byId('last-updated').textContent=data.updated_at?'Feed updated '+formatTime(data.updated_at):'Feed update time unavailable';
      byId('preview-label').hidden=!state.demo;setFeature();setWire();render();
    }catch(err){state.items=[];setFeature();setWire();render();byId('last-updated').textContent='Feed temporarily unavailable';setStatus('The public news feed could not be loaded. Please try Refresh later.');}
    finally{byId('reload-feed').disabled=false;}
  }
  function init(){const date=new Date();byId('current-date').textContent=new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'long',day:'numeric',year:'numeric'}).format(date);byId('year').textContent=String(date.getUTCFullYear());
    const toggle=byId('type-toggle');try{if(localStorage.getItem('standaloneLargeType')==='1'){document.documentElement.classList.add('large-type');toggle.setAttribute('aria-pressed','true');}}catch{}
    toggle.addEventListener('click',()=>{const on=document.documentElement.classList.toggle('large-type');toggle.setAttribute('aria-pressed',String(on));try{localStorage.setItem('standaloneLargeType',on?'1':'0');}catch{}});
    byId('menu-toggle').addEventListener('click',()=>{const nav=byId('site-nav'),open=nav.classList.toggle('nav-open');byId('menu-toggle').setAttribute('aria-expanded',String(open));byId('menu-toggle').setAttribute('aria-label',open?'Close navigation':'Open navigation');});
    document.querySelectorAll('[data-category]').forEach(el=>el.addEventListener('click',()=>setCategory(el.dataset.category)));
    document.querySelectorAll('[data-nav-category]').forEach(el=>el.addEventListener('click',()=>setCategory(el.dataset.navCategory)));
    document.querySelectorAll('#site-nav a').forEach(a=>a.addEventListener('click',closeMenu));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&byId('site-nav').classList.contains('nav-open')){closeMenu();byId('menu-toggle').focus();}});
    byId('news-search').addEventListener('input',e=>{state.term=e.target.value.trim().toLowerCase();state.visible=10;render();});
    byId('load-more').addEventListener('click',()=>{state.visible+=10;render();});
    byId('reset-filters').addEventListener('click',()=>{byId('news-search').value='';state.term='';setCategory('All');byId('news-search').focus();});
    byId('reload-feed').addEventListener('click',load);load();
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',init):init();
})();
