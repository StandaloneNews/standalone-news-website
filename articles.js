/* Public, read-only display of automatically published articles. */
(()=>{'use strict';
  const grid=document.getElementById('homepage-explainers');if(!grid)return;
  const elt=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;};
  fetch('./data/articles.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('Missing index');return r.json()}).then(data=>{
    const items=Array.isArray(data.items)?data.items:[];if(!items.length)return;
    grid.replaceChildren();
    for(const item of items.slice(-3).reverse()){
      if(!item.path||!/^articles\/[a-z0-9_.-]+\.html$/.test(item.path)||typeof item.headline!=='string')continue;
      const card=elt('article','editorial-tile');const meta=elt('p','overline',`${item.category||'News'} · ${(item.published_at||'').slice(0,10)}`);
      const h=elt('h3');const a=elt('a','',item.headline);a.href='/'+item.path;h.append(a);
      const desc=elt('p','',item.summary||'');const src=elt('p','editorial-source-label','Source: '+(item.source||'official announcement'));
      card.append(meta,h,desc,src);grid.append(card);
    }
  }).catch(()=>{grid.firstElementChild.textContent='Explainers will appear here when available.'});
})();
