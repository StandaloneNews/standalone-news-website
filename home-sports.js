/* Standalone News Sports Today: source-linked, never fabricated. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const el=(tag,cls,value)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(value!==undefined)x.textContent=value;return x};
const dt=v=>{const x=new Date(v);return Number.isFinite(+x)?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(x):'Time unavailable'};
const valid=u=>{try{const x=new URL(u);return x.protocol==='https:'?x.href:''}catch{return''}};
function line(row){const item=el('div','st-item');item.append(el('p','st-game-name',row.name));const names=(row.participants||[]).slice(0,2).filter(x=>x.name);
if(names.length>1 && row.state==='final')item.append(el('p','st-detail',names.map(x=>x.name+(x.score!==''?' '+x.score:'')).join(' · ')));
item.append(el('p','st-detail',(row.league||'').toUpperCase()+' · '+(row.state==='final'?'Final · ':'')+(row.date_only?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(row.date))+' · Time TBD':dt(row.date))));
return item}
function clear(id){const root=$(id);if(root)root.replaceChildren();return root;}
function empty(root,text){root.append(el('p','st-detail',text))}
function hasVerifiedFinalScore(row){const parts=Array.isArray(row.participants)?row.participants:[];return row.league!=='ufc'&&row.state==='final'&&parts.length>=2&&parts.slice(0,2).every(p=>p&&p.score!==null&&p.score!==undefined&&String(p.score).trim()!==''&&Number.isFinite(Number(p.score)));}
const SOCCER=new Set(["epl","laliga","bundesliga","seriea","ligue1","ucl","brasileirao","argentina","ligamx","j1","aleague","mls","primeira"]);
const LABELS={epl:'Premier League',laliga:'La Liga',bundesliga:'Bundesliga',seriea:'Serie A',ligue1:'Ligue 1',ucl:'Champions League',brasileirao:'Brazil Série A',argentina:'Argentina Primera',ligamx:'Liga MX',j1:'Japan J1',aleague:'Australia A-League',mls:'MLS',primeira:'Portugal Primeira'};
function hasDetailedUfcEvent(row){return row?.league==='ufc'&&Array.isArray(row.fights)&&row.fights.some(f=>Array.isArray(f.fighters)&&f.fighters.filter(p=>p&&p.name).length>=2);}
function populate(data){if(!Array.isArray(data.events))throw Error('No sports events');
const now=Date.now();const next=data.events.filter(x=>x.league!=='ufc'&&x.state!=='final'&&Number.isFinite(Date.parse(x.date))&&Date.parse(x.date)>=now-45*60*1000).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
const results=data.events.filter(hasVerifiedFinalScore).sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
const resultPanel=$('st-results-panel');if(resultPanel)resultPanel.hidden=results.length===0;
const a=clear('st-upcoming'),b=clear('st-results'),soccer=clear('st-soccer'),c=clear('st-ufc');
if(next.length)next.slice(0,2).forEach(x=>a.append(line(x)));else empty(a,'No scheduled games available from the current provider check.');
if(results.length)results.slice(0,2).forEach(x=>b.append(line(x)));
const matches=data.events.filter(x=>SOCCER.has(x.league));
const forthcoming=matches.filter(x=>x.state!=='final'&&Date.parse(x.date)>=now-45*60*1000).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
const finished=matches.filter(x=>x.state==='final').sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
const selected=[...forthcoming.slice(0,2),...finished.slice(0,forthcoming.length?0:2)];
if(selected.length)for(const match of selected){const item=line(match);const label=item.querySelector('.st-detail');if(label)label.textContent=(LABELS[match.league]||match.league)+' · '+dt(match.date)+(match.state==='final'?' · Final':'');soccer.append(item)}
else empty(soccer,'International fixtures are not available in the latest provider response.');
const hasUfc=data.events.some(hasDetailedUfcEvent)||(data.stories||[]).some(x=>x.league==='ufc'&&x.title&&valid(x.url));
const ufcPanel=$('st-ufc-panel');if(ufcPanel)ufcPanel.hidden=!hasUfc;
const grid=$('st-sports-grid');if(grid)grid.style.setProperty('--st-columns',String(2+Number(results.length>0)+Number(hasUfc)));
const ufc=data.events.filter(hasDetailedUfcEvent).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
if(ufc.length)ufc.slice(0,2).forEach(x=>c.append(line(x)));
else empty(c,'UFC cards are currently unavailable from the free scores provider.');
const schedule=el('a','', 'UFC fight-card schedule ↗');schedule.href='https://www.mmafighting.com/schedule';schedule.rel='noopener noreferrer';schedule.target='_blank';c.append(schedule);
const official=el('a','', 'Official UFC events ↗');official.href='https://www.ufc.com/events';official.rel='noopener noreferrer';official.target='_blank';c.append(official);
const news=(data.stories||[]).filter(x=>x.league==='ufc'&&valid(x.url)).slice(0,1);
for(const story of news){const wrap=el('div','st-item'),link=el('a','',story.title);link.href=valid(story.url);link.target='_blank';link.rel='noopener noreferrer';wrap.append(link);c.append(wrap)}
const stamp=new Date(data.updated_at);$('st-status').textContent='Sports data checked '+(Number.isFinite(+stamp)?dt(data.updated_at):'recently')+' · Times shown locally · Some results may be delayed.';
}
async function load(){try{const r=await fetch('./data/sports.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw Error(String(r.status));populate(await r.json())}catch{const resultPanel=$('st-results-panel');if(resultPanel)resultPanel.hidden=true;const ufcPanel=$('st-ufc-panel');if(ufcPanel)ufcPanel.hidden=true;const grid=$('st-sports-grid');if(grid)grid.style.setProperty('--st-columns','2');$('st-status').textContent='Sports provider unavailable. Open Sports Desk for the latest provider status.';for(const id of ['st-upcoming','st-results','st-soccer','st-ufc']){let root=clear(id);empty(root,'No verified data to display.')}}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)load()});
})();