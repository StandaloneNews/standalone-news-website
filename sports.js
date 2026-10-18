/* Standalone News sports: authenticated data comes from public provider snapshot. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const state={data:null,league:'all',busy:false,lastFetch:0};
const LEAGUES={ufc:'UFC',nfl:'NFL',nba:'NBA',mlb:'MLB',nhl:'NHL',ncaaf:'College Football',ncaab:'College Basketball',epl:'Premier League',laliga:'La Liga',bundesliga:'Bundesliga',seriea:'Serie A',ligue1:'Ligue 1',ucl:'Champions League',brasileirao:'Brazil Série A',argentina:'Argentina Primera',ligamx:'Liga MX',j1:'Japan J1',aleague:'Australian A-League',primeira:'Portugal Primeira Liga',mls:'MLS'};
const SOCCER=new Set(["epl","laliga","bundesliga","seriea","ligue1","ucl","brasileirao","argentina","ligamx","j1","aleague","mls","primeira"]);
const allowed=url=>{try{const u=new URL(url);return u.protocol==='https:'?u.href:null;}catch{return null;}};
const formatDate=value=>{const d=new Date(value);return Number.isNaN(+d)?'Date unavailable':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d)};
const formatTime=value=>{const d=new Date(value);return Number.isNaN(+d)?'—':new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(d)};
const e=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
function link(url,label){const a=e('a','sports-original',label);if(allowed(url)){a.href=url;a.target='_blank';a.rel='noopener noreferrer';}else a.hidden=true;return a;}
function filtered(event){if(state.league==='all')return true;if(state.league==='college')return ['ncaaf','ncaab'].includes(event.league);if(state.league==='soccer')return SOCCER.has(event.league);return event.league===state.league;}
function hasDetailedUfcEvent(row){return row?.league==='ufc'&&Array.isArray(row.fights)&&row.fights.some(f=>Array.isArray(f.fighters)&&f.fighters.filter(p=>p&&p.name).length>=2);}
function hasVerifiedFinalScore(row){const parts=Array.isArray(row.participants)?row.participants:[];return row.league!=='ufc'&&row.state==='final'&&parts.length>=2&&parts.slice(0,2).every(p=>p&&p.score!==null&&p.score!==undefined&&String(p.score).trim()!==''&&Number.isFinite(Number(p.score)));}
function listItems(type){if(!state.data)return [];const rows=(state.data.events||[]).filter(x=>x.league!=='ufc' && filtered(x) && (type==='upcoming'?x.state!=='final':hasVerifiedFinalScore(x)));
 rows.sort((a,b)=>type==='upcoming'?Date.parse(a.date)-Date.parse(b.date):Date.parse(b.date)-Date.parse(a.date));return rows.slice(0,type==='upcoming'?24:18);}
function gameCard(item){const card=e('article','sports-game');const head=e('div','sports-game-header');head.append(e('span','',LEAGUES[item.league]||item.league));const status=e('span','sports-game-state'+(item.state==='live'?' live':''),item.state==='live'?'In progress':item.state==='final'?'Final':'Upcoming');head.append(status);card.append(head);
 const title=e('h3','',item.name);card.append(title);
 const players=Array.isArray(item.participants)?item.participants:[];
 for(const p of players.slice(0,2)){const line=e('div','sports-matchup');line.append(e('span',p.winner?'winner':'',p.name||'Competitor'));if(p.score!==''&&p.score!==undefined)line.append(e('span','score',String(p.score)));card.append(line);}
 card.append(e('div','sports-game-time',formatTime(item.date)+(item.status?' · '+item.status:'')));
 card.append(link(item.url,'Game details ↗'));return card;}
function fill(id,rows,renderer,none){const box=$(id);box.replaceChildren();if(!rows.length){box.append(e('p','sports-empty',none));return}const fragment=document.createDocumentFragment();rows.forEach(row=>fragment.append(renderer(row)));box.append(fragment);}
function ufcCard(item){const card=e('article','sports-ufc-card');card.append(e('span','sports-eyebrow',item.state==='final'?'RECENT CARD · FINAL':'UPCOMING UFC EVENT'));card.append(e('h3','',item.name));card.append(e('p','',(item.date_only?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(item.date)):formatTime(item.date))+(item.status?' · '+item.status:'')));
 const bouts=Array.isArray(item.fights)?item.fights.slice(0,6):[];
 if(bouts.length){const ul=e('ul','sports-fight-card');for(const fight of bouts){const li=e('li');const names=(fight.fighters||[]).map(p=>p.name||'').filter(Boolean).join(' vs ');li.append(e('span','',names));let detail=fight.detail||((fight.state==='final')?'Final':'Scheduled');const win=(fight.fighters||[]).find(p=>p.winner);if(win&&fight.state==='final')detail='Winner: '+win.name;li.append(e('small','',detail));ul.append(li);}card.append(ul)}else card.append(e('p','',"Fight matchups aren't available from the current provider snapshot."));
 card.append(link(item.url,'Event details ↗'));return card;}
function storyCard(story){const a=e('article','sports-news-card');const label=story.league==='ufc'?'UFC / MMA':story.league==='soccer'?'WORLD FOOTBALL':'SPORTS';a.append(e('div','sports-story-meta',label+' · '+(story.source||'Publisher')));const h=e('h3');const l=link(story.url,story.title||'Read article');l.className='';h.append(l);a.append(h);const time=e('time','',formatDate(story.date));time.dateTime=story.date;a.append(time);return a;}
function render(){
 if(!state.data)return;
 const data=state.data;
 const hasUfcEvents=data.events.some(hasDetailedUfcEvent);
 const hasUfcNews=data.stories.some(x=>x.league==='ufc'&&x.title&&allowed(x.url));
 const ufcFilter=$('sports-filters').querySelector('[data-league="ufc"]');
 if(ufcFilter)ufcFilter.hidden=!(hasUfcEvents||hasUfcNews);
 if(!hasUfcEvents&&!hasUfcNews&&state.league==='ufc'){
   state.league='all';
   $('sports-filters').querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.league==='all')));
 }
 const items=listItems('upcoming'),scores=listItems('final');
 $('upcoming-count').textContent=items.length+' scheduled';
 fill('upcoming-list',items,gameCard,'No upcoming games found for this sport in the current date window.');
 $('results').hidden=scores.length===0;
 $('results-count').textContent=scores.length+' recent';
 if(scores.length)fill('results-list',scores,gameCard,'');
 else $('results-list').replaceChildren();
 $('upcoming-summary').textContent=items.length?items.length+' upcoming fixtures currently listed for '+(state.league==='all'?'the covered leagues':state.league.toUpperCase())+'.':'No upcoming fixtures are available in this feed.';
 // UFC is its own sub-section. Do not show it for NBA, NFL, soccer, etc.
 const showUfc=hasUfcEvents&&(state.league==='all'||state.league==='ufc');
 $('ufc-cards').hidden=!showUfc;
 if(showUfc){
   const ufc=data.events.filter(hasDetailedUfcEvent).sort((a,b)=>{
     const f=a.state==='final'?1:0,g=b.state==='final'?1:0;
     return f-g||(f===1?Date.parse(b.date)-Date.parse(a.date):Date.parse(a.date)-Date.parse(b.date));
   }).slice(0,4);
   fill('ufc-list',ufc,ufcCard,'No UFC fight cards are currently available from the provider.');
 } else $('ufc-list').replaceChildren();
 // Show only related article categories under a chosen filter.
 const relevant=data.stories.filter(x=>{
   if(state.league==='all')return true;
   if(state.league==='soccer'||SOCCER.has(state.league))return x.league==='soccer';
   if(state.league==='college')return ['ncaaf','ncaab','college'].includes(x.league);
   return x.league===state.league;
 }).slice(0,20);
 $('sports-news').hidden=state.league!=='all'&&relevant.length===0;
 $('sports-news-count').textContent=relevant.length+' headlines';
 if(relevant.length||state.league==='all')fill('sports-news-list',relevant,storyCard,'No verified, recent sports headlines are available in this update.');
 else $('sports-news-list').replaceChildren();
}
async function reload(){if(state.busy)return;state.busy=true;state.lastFetch=Date.now();try{const response=await fetch('./data/sports.json?t='+Date.now(),{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.events)||!Array.isArray(data.stories)||!data.updated_at)throw Error('Missing sports data');state.data=data;
 const date=new Date(data.updated_at);const elapsed=Date.now()-Date.parse(data.updated_at);const old=Number.isFinite(elapsed)&&elapsed>3*3600*1000;
 $('sports-updated').textContent='Last provider check · '+formatDate(data.updated_at);$('sports-status').dataset.error=String(old);$('sports-status').textContent=old?'Sports data has not refreshed recently; scores and fixtures may be stale.':'Sports desk updated · '+(data.leagues||[]).length+' leagues tracked · Source: '+(data.source||'sport provider')+'.';
 render();}catch(err){$('sports-status').dataset.error='true';$('sports-status').textContent=state.data?'Could not check for updates. Showing the previous sports snapshot.':'Sports data is temporarily unavailable. Try refreshing, or check back shortly.';
 if(!state.data){for(const id of ['upcoming-list','results-list','ufc-list','sports-news-list'])$(id).textContent='Live provider data is unavailable right now. No results have been invented.';}}
 finally{state.busy=false;}}
function init(){const filter=$('sports-filters');const detail=document.querySelector('.sports-league-detail');
if(detail)detail.addEventListener('click',event=>{const target=event.target.closest('button[data-soccer]');if(!target)return;state.league=target.dataset.soccer;filter.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));detail.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b===target)));render();});
filter.addEventListener('click',evt=>{const button=evt.target.closest('button[data-league]');if(!button)return;state.league=button.dataset.league;if(detail)detail.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));filter.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));render();});reload();window.setInterval(()=>{if(!document.hidden&&Date.now()-state.lastFetch>=5*60*1000)reload();},60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-state.lastFetch>=5*60*1000)reload();});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
