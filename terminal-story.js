(()=>{'use strict';
const $=id=>document.getElementById(id);
const dialog=$('story-dialog'); if(!dialog)return;
const el={title:$('story-title'),meta:$('story-meta'),source:$('story-source-link'),related:$('story-related'),empty:$('story-related-empty'),status:$('story-action-status'),options:$('story-share-options')};
let selected=null,allNews=[],trigger=null;
const tokenize=s=>new Set((s||'').toLowerCase().match(/[a-z0-9]{4,}/g)||[]);
const ignore=new Set(['from','with','after','that','this','have','will','about','news','says','over','amid','into','more','their','could','should','which','today']);
function related(item){
 const terms=tokenize(item.title);for(const word of ignore)terms.delete(word);
 return allNews.filter(x=>x.href!==item.href).map(x=>({item:x,rank:[...tokenize(x.title)].filter(k=>terms.has(k)).length}))
 .filter(x=>x.rank>=2).sort((a,b)=>b.rank-a.rank||b.item.time-a.item.time).slice(0,4).map(x=>x.item);
}
const intent=(id,url)=>{$(id).href=url;};
function show(item){
 if(!item||!/^https?:\/\//i.test(item.href))return;
 selected=item; trigger=document.activeElement;
 el.title.textContent=item.title;
 el.meta.textContent=item.source+' · '+item.topic+' · '+new Date(item.time).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
 el.source.href=item.href;el.source.textContent='Read the original report on '+item.source+' ↗';
 el.status.textContent='';el.options.hidden=true;$('story-share').setAttribute('aria-expanded','false');
 const entries=related(item);el.related.replaceChildren();
 for(const next of entries){const li=document.createElement('li'),a=document.createElement('a');a.href=next.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=next.source+' — '+next.title;li.append(a);el.related.append(li);}
 el.empty.hidden=!!entries.length;
 const link=encodeURIComponent(item.href),title=encodeURIComponent(item.title);
 intent('story-share-x','https://twitter.com/intent/tweet?text='+title+'&url='+link);
 intent('story-share-email','mailto:?subject='+title+'&body='+encodeURIComponent(item.title+'\n'+item.href));
 intent('story-share-reddit','https://www.reddit.com/submit?url='+link+'&title='+title);
 intent('story-share-linkedin','https://www.linkedin.com/sharing/share-offsite/?url='+link);
 $('story-native-share').hidden=!navigator.share;
 if(!dialog.open)dialog.showModal();
 $('story-close').focus();
}
document.addEventListener('terminal-headlines',event=>{allNews=Array.isArray(event.detail)?event.detail:[];});
document.addEventListener('standalone-open-story',event=>show(event.detail));
$('story-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
dialog.addEventListener('close',()=>{selected=null; if(trigger?.isConnected)trigger.focus({preventScroll:true});});
async function copy(value,label){
 if(!selected)return;
 try {
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(value);
   else {const field=document.createElement('textarea');field.value=value;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.append(field);field.select();if(!document.execCommand('copy'))throw Error('Clipboard unavailable');field.remove();}
   el.status.textContent=label+' copied.';
 } catch {el.status.textContent='Copy unavailable. Use your browser to copy from the original source link.';}
}
$('story-copy-link').addEventListener('click',()=>copy(selected?.href||'','Link'));
$('story-copy-headline').addEventListener('click',()=>copy(selected?.title||'','Headline'));
$('story-share').addEventListener('click',()=>{el.options.hidden=!el.options.hidden;$('story-share').setAttribute('aria-expanded',String(!el.options.hidden));if(!el.options.hidden)el.options.querySelector('a')?.focus();});
$('story-native-share').addEventListener('click',async()=>{if(!selected||!navigator.share)return;try{await navigator.share({title:selected.title,text:selected.title,url:selected.href});el.status.textContent='Shared.';}catch(e){if(e.name!=='AbortError')el.status.textContent='Device sharing unavailable; choose another option.';}});
})();