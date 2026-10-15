/* Standalone News community. Uses the EXISTING public Supabase URL and publishable key.
   All writes are guarded by server-side Supabase RLS and database triggers. */
const $ = id => document.getElementById(id);
const ROOMS = {general:['General conversation',"Open conversation about today's news"],politics:['Politics & policy','Discuss the decisions that shape public life'],markets:['Markets & economy','Share analysis, context, and investing perspectives'],world:['World affairs','Discuss global news and international developments'],technology:['Technology & AI','Talk about science, technology, and business']};
const state={db:null,user:null,profile:null,moderator:false,room:'general',view:'chat',messages:[],threads:[],replies:[],activeThread:null,channel:null,waiting:false,refreshTimer:null,reportTarget:null,profileMap:new Map(),sessionReady:false,restriction:null};
const dateText=iso=>{try{return new Intl.DateTimeFormat('en-US',{timeZone:'UTC',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(iso))+' UTC';}catch{return 'UTC';}};
const dom=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const label=(userId)=>state.profileMap.get(userId)||'Reader';
const initial=(name)=>String(name||'R').slice(0,1).toUpperCase();
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));
let toastTimer;
function toast(msg){const node=$('toast');node.textContent=String(msg);node.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.hidden=true,4200);}
function errorInfo(error){if(!error)return 'Something went wrong.';const s=String(error.message||error);if(/row.level.security|permission.denied|42501/i.test(s))return 'Posting is not permitted for this account. Please check your sign-in or posting status.';if(/rate|wait|posting limit/i.test(s))return 'Posting too quickly. Wait a moment before trying again.';if(/duplicate|unique/i.test(s))return 'That username or report has already been used.';return s.slice(0,170);}
function showIssue(msg){const n=$('service-message');n.textContent=msg;n.hidden=false;}
function clearIssue(){$('service-message').hidden=true;}
function canPost(){return !!(state.user&&state.profile&&!state.restriction?.banned&&!(state.restriction?.muted_until&&new Date(state.restriction.muted_until)>new Date()));}
function requirePosting(){if(!state.db){toast('Discussion service unavailable. Please refresh later.');return false;}if(!state.user){$('auth-dialog').showModal();return false;}if(!state.profile){$('username-dialog').showModal();return false;}if(!canPost()){toast('This account is temporarily restricted from posting.');return false;}return true;}
function setConnection(mode){const n=$('connection-status');n.classList.toggle('is-offline',mode!=='live');n.textContent='';n.append(dom('span','dot'),document.createTextNode(mode==='live'?'Live updates':mode==='polling'?'Updating periodically':'Connecting…'));}
function updateAccount(){const labelNode=$('account-label'),action=$('account-action'),identity=$('identity-note'),identityAction=$('identity-action'),chatForm=$('chat-form');
 labelNode.hidden=!state.profile;labelNode.textContent=state.profile?'@'+state.profile.username:'';
 action.textContent=state.user?'Sign out':'Sign in to participate';
 identity.textContent=state.profile?'Posting as @'+state.profile.username+'. Your email is not shown to other readers.':state.user?'You are signed in. Choose a public username before you post.':'You can read without an account. Sign in using your existing Standalone News account and choose a public username to post.';
 identityAction.textContent=state.profile?'You are signed in ✓':state.user?'Choose username →':'Sign in →';
 $('chat-requires-login').hidden=canPost();chatForm.hidden=!canPost();
 $('reply-form').hidden=!canPost()||!state.activeThread||state.activeThread.locked;
 $('reply-requires-login').hidden=canPost()||!state.activeThread||state.activeThread.locked;
 $('moderator-tab').hidden=!state.moderator;
 if(!state.moderator&&state.view==='moderation')switchView('chat');
}
function openIdentity(){if(!state.user)$('auth-dialog').showModal();else if(!state.profile)$('username-dialog').showModal();else toast('You are signed in as @'+state.profile.username);}
async function refreshAccount(){if(!state.db)return;const {data:{session},error}=await state.db.auth.getSession();if(error)console.warn('Session error',error.message);state.user=session?.user||null;state.profile=null;state.moderator=false;state.restriction=null;
 if(state.user){const [prof,mod,restr]=await Promise.all([
 state.db.from('community_profiles').select('id,username').eq('id',state.user.id).maybeSingle(),
 state.db.from('community_moderators').select('user_id').eq('user_id',state.user.id).maybeSingle(),
 state.db.from('community_restrictions').select('banned,muted_until').eq('user_id',state.user.id).maybeSingle()
 ]);
 if(prof.error)console.warn('Profile',prof.error.message);if(mod.error)console.warn('Moderator lookup',mod.error.message);
 state.profile=prof.data||null;state.moderator=!!mod.data;state.restriction=restr.data||null;
 if(state.profile)state.profileMap.set(state.user.id,state.profile.username);
 }
 state.sessionReady=true;updateAccount();if(state.user&&!state.profile&&!sessionStorage.getItem('sn-community-username-later'))$('username-dialog').showModal();
}
async function getProfiles(rows){const ids=[...new Set(rows.map(r=>r.author_id).filter(Boolean))];if(!ids.length)return;const {data,error}=await state.db.from('community_profiles').select('id,username').in('id',ids);if(error)return;for(const r of data||[])state.profileMap.set(r.id,r.username);}
function itemHeader(row){const top=dom('div','message-top');top.append(dom('span','avatar',initial(label(row.author_id))),dom('span','author-name','@'+label(row.author_id)),dom('span','message-time',dateText(row.created_at)));return top;}
function appendSmallButton(target,text,fn){const b=dom('button','tiny-btn',text);b.type='button';b.addEventListener('click',fn);target.append(b);return b;}
function reportButton(target,kind,row){if(state.user&&state.user.id!==row.author_id)appendSmallButton(target,'⚑ Report',()=>openReport(kind,row.id));if(state.moderator&&row.removed_at===null)appendSmallButton(target,'Remove',()=>moderateRemove(kind,row.id));}
function renderMessages(){const viewport=$('chat-messages'),nearBottom=viewport.scrollHeight-viewport.scrollTop-viewport.clientHeight<130;viewport.replaceChildren();
 if(!state.messages.length){viewport.append(dom('div','empty-message','No messages yet. Start the conversation in this room.'));return;}
 for(const row of state.messages){const article=dom('article','message');article.append(itemHeader(row));article.append(dom('p','message-body',row.body));const actions=dom('div','message-actions');reportButton(actions,'message',row);article.append(actions);viewport.append(article);}
 if(nearBottom)viewport.scrollTop=viewport.scrollHeight;
}
async function loadMessages(){if(!state.db)return;const room=state.room;const {data,error}=await state.db.from('community_messages').select('id,room_slug,author_id,body,created_at,removed_at').eq('room_slug',room).is('removed_at',null).order('id',{ascending:false}).limit(60);
 if(room!==state.room)return;if(error){showIssue('Community messages are unavailable. Run the included community.sql in your Supabase SQL Editor and verify access: '+errorInfo(error));return;}clearIssue();state.messages=(data||[]).reverse();await getProfiles(state.messages);renderMessages();}
function roomText(room){return ({general:'General',politics:'Politics',markets:'Markets',world:'World',technology:'Technology'})[room]||room;}
function renderThreads(){const n=$('thread-list');n.replaceChildren();if(!state.threads.length){n.append(dom('div','empty-message','No discussions in this topic yet. Start one with a question worth exploring.'));return;}
 for(const thread of state.threads){const c=dom('article','thread-card');const head=dom('div','thread-head');head.append(dom('span','thread-category',roomText(thread.room_slug)),dom('span','thread-author','@'+label(thread.author_id)+' · '+dateText(thread.created_at)));if(thread.locked)head.append(dom('span','thread-category','Locked'));c.append(head);
 const title=dom('button','thread-title',thread.title);title.type='button';title.addEventListener('click',()=>openThread(thread));c.append(title,dom('p','thread-excerpt',thread.body));const meta=dom('div','thread-meta');appendSmallButton(meta,'Read discussion →',()=>openThread(thread));reportButton(meta,'thread',thread);c.append(meta);n.append(c);}
}
async function loadThreads(){if(!state.db)return;const room=state.room;const {data,error}=await state.db.from('community_threads').select('id,room_slug,author_id,title,body,created_at,locked,removed_at').eq('room_slug',room).is('removed_at',null).order('id',{ascending:false}).limit(40);
 if(room!==state.room)return;if(error){showIssue('Discussions are unavailable: '+errorInfo(error));return;}state.threads=data||[];await getProfiles(state.threads);renderThreads();}
function renderReplies(){const list=$('reply-list');list.replaceChildren();if(!state.replies.length){list.append(dom('p','empty-message','No replies yet.'));return;}
 for(const row of state.replies){const c=dom('article','thread-reply');c.append(itemHeader(row),dom('p','',row.body));const a=dom('div','message-actions');reportButton(a,'reply',row);c.append(a);list.append(c);}
}
async function loadReplies(){if(!state.activeThread||!state.db)return;const id=state.activeThread.id;const {data,error}=await state.db.from('community_replies').select('id,thread_id,author_id,body,created_at,removed_at').eq('thread_id',id).is('removed_at',null).order('id',{ascending:true}).limit(100);if(!state.activeThread||state.activeThread.id!==id)return;if(error){toast('Could not load replies: '+errorInfo(error));return;}state.replies=data||[];await getProfiles(state.replies);renderReplies();}
async function openThread(thread){state.activeThread=thread;$('thread-detail').hidden=false;$('thread-list').hidden=true;$('thread-toolbar').hidden=true;
 const body=$('thread-detail-content');body.replaceChildren();const h=dom('h2','',thread.title),by=dom('p','thread-author','@'+label(thread.author_id)+' · '+dateText(thread.created_at)+' · #'+roomText(thread.room_slug));body.append(h,by,dom('p','detail-text',thread.body));
 if(thread.locked){body.append(dom('p','signin-prompt','This discussion has been locked by a moderator.'));}
 const actions=dom('div','message-actions');reportButton(actions,'thread',thread);body.append(actions);$('reply-form').hidden=!canPost()||thread.locked;$('reply-requires-login').hidden=canPost()||thread.locked;await loadReplies();setTimeout(()=>$('thread-detail').scrollIntoView({behavior:'smooth',block:'start'}),30);
}
function closeThread(){state.activeThread=null;state.replies=[];$('thread-detail').hidden=true;$('thread-list').hidden=false;$('thread-toolbar').hidden=false;}
function switchRoom(room){if(!ROOMS[room]||room===state.room)return;state.room=room;for(const b of document.querySelectorAll('[data-room]')){const active=b.dataset.room===room;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));}const [name,desc]=ROOMS[room];$('active-room-kicker').textContent='# '+room.toUpperCase();$('room-heading').textContent=name;$('room-description').textContent=desc;closeThread();const url=new URL(location.href);url.searchParams.set('room',room);history.replaceState(null,'',url);loadMessages();loadThreads();subscribeLive();}
function switchView(view){if(!['chat','threads','moderation'].includes(view)||view==='moderation'&&!state.moderator)return;state.view=view;for(const b of document.querySelectorAll('[data-view]')){const active=b.dataset.view===view;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));}for(const [v,id] of [['chat','chat-view'],['threads','threads-view'],['moderation','moderation-view']])$(id).hidden=v!==view;if(view==='moderation')loadReports();}
function scheduleRefresh(){if(state.refreshTimer)return;state.refreshTimer=setTimeout(async()=>{state.refreshTimer=null;await Promise.all([loadMessages(),loadThreads(),state.activeThread?loadReplies():Promise.resolve()]);if(state.view==='moderation')await loadReports();},650);}
function subscribeLive(){if(!state.db)return;if(state.channel)state.db.removeChannel(state.channel);setConnection('connecting');const name='sn-community-'+state.room;
 const channel=state.db.channel(name)
 .on('postgres_changes',{event:'*',schema:'public',table:'community_messages',filter:'room_slug=eq.'+state.room},scheduleRefresh)
 .on('postgres_changes',{event:'*',schema:'public',table:'community_threads',filter:'room_slug=eq.'+state.room},scheduleRefresh)
 .on('postgres_changes',{event:'*',schema:'public',table:'community_replies'},()=>{if(state.activeThread)scheduleRefresh();})
 .subscribe(status=>{if(channel!==state.channel)return;setConnection(status==='SUBSCRIBED'?'live':'polling');});state.channel=channel;
}
function openReport(kind,id){if(!requirePosting())return;state.reportTarget={kind,id};$('report-feedback').textContent='';$('report-form').reset();$('report-dialog').showModal();}
async function moderateRemove(kind,id){if(!state.moderator)return;if(!confirm('Remove this content from public view?'))return;const table={message:'community_messages',thread:'community_threads',reply:'community_replies'}[kind];if(!table)return;const {error}=await state.db.from(table).update({removed_at:new Date().toISOString()}).eq('id',id);if(error){toast(errorInfo(error));return;}toast('Content removed from public view.');if(kind==='thread'&&state.activeThread?.id===id)closeThread();scheduleRefresh();}
async function loadReports(){if(!state.moderator)return;const n=$('moderator-list');n.replaceChildren(dom('div','empty-message','Loading reports…'));
 const {data,error}=await state.db.from('community_reports').select('id,reporter_id,target_type,target_id,reason,details,status,created_at').eq('status','open').order('created_at',{ascending:false}).limit(70);
 if(error){n.replaceChildren(dom('p','empty-message','Could not load reports: '+errorInfo(error)));return;}n.replaceChildren();if(!data?.length){n.append(dom('p','empty-message','No open reports.'));return;}
 for(const report of data){const card=dom('article','moderation-item');card.append(dom('strong','',`${report.target_type} #${report.target_id} · ${report.reason}`));card.append(dom('p','',report.details||'No additional context supplied.'));card.append(dom('p','',dateText(report.created_at)));
 const actions=dom('div','mod-buttons');const resolve=dom('button','','Mark reviewed');resolve.addEventListener('click',async()=>{const {error}=await state.db.from('community_reports').update({status:'resolved'}).eq('id',report.id);if(error)toast(errorInfo(error));else loadReports();});actions.append(resolve);
 const remove=dom('button','danger','Remove content');remove.addEventListener('click',async()=>{await moderateRemove(report.target_type,report.target_id);});actions.append(remove);
 if(report.target_type==='thread'){const lock=dom('button','','Lock thread');lock.addEventListener('click',async()=>{const {error}=await state.db.from('community_threads').update({locked:true}).eq('id',report.target_id);if(error)toast(errorInfo(error));else{toast('Thread locked.');loadReports();}});actions.append(lock);}
 const mute=dom('button','','Mute author 24h');mute.addEventListener('click',async()=>{if(!confirm('Temporarily prevent the author of this content from posting for 24 hours?'))return;const table={message:'community_messages',thread:'community_threads',reply:'community_replies'}[report.target_type];const {data:target,error:lookupError}=await state.db.from(table).select('author_id').eq('id',report.target_id).maybeSingle();if(lookupError||!target){toast('Could not identify the author.');return;}const {error}=await state.db.from('community_restrictions').upsert({user_id:target.author_id,muted_until:new Date(Date.now()+24*3600*1000).toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)toast(errorInfo(error));else toast('Posting muted for 24 hours.');});actions.append(mute);
 card.append(actions);n.append(card);
 }
}
async function boot(){const time=()=>{$('utc-now').textContent=new Date().toISOString().slice(11,16)+' UTC';};time();setInterval(time,60000);
 const cfg=window.SN_ACCOUNT_CONFIG||{};if(!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'')||!cfg.publishableKey){showIssue('The reader account connection is not configured. Keep the existing account-config.js from your live website.');setConnection('polling');return;}
 try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');state.db=createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}catch(err){showIssue('The sign-in service could not load. Check your connection or browser security settings.');setConnection('polling');return;}
 const initialRoom=new URLSearchParams(location.search).get('room');if(initialRoom&&ROOMS[initialRoom]){state.room='general';switchRoom(initialRoom);}else{loadMessages();loadThreads();subscribeLive();}
 await refreshAccount();state.db.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED','TOKEN_REFRESHED'].includes(event))setTimeout(async()=>{await refreshAccount();scheduleRefresh();},0);});
 // Periodic refresh if Realtime is unavailable; also catches moderation changes.
 setInterval(()=>{if(document.visibilityState==='visible')scheduleRefresh();},30000);
}
function wireControls(){for(const b of document.querySelectorAll('[data-room]'))b.addEventListener('click',()=>switchRoom(b.dataset.room));for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>switchView(b.dataset.view));for(const b of document.querySelectorAll('[data-open-auth]'))b.addEventListener('click',openIdentity);
 $('account-action').addEventListener('click',async()=>{if(!state.user){$('auth-dialog').showModal();return;}if(!confirm('Sign out of your reader account on this device?'))return;const {error}=await state.db.auth.signOut();if(error)toast(errorInfo(error));else{state.user=null;state.profile=null;state.moderator=false;updateAccount();toast('Signed out.');}});
 $('identity-action').addEventListener('click',openIdentity);
 $('username-later').addEventListener('click',()=>{sessionStorage.setItem('sn-community-username-later','1');$('username-dialog').close();});
 $('auth-form').addEventListener('submit',async e=>{e.preventDefault();if(!state.db)return;const email=$('auth-email').value.trim();const submit=e.target.querySelector('[type=submit]');submit.disabled=true;$('auth-feedback').textContent='Sending sign-in link…';try{const {error}=await state.db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/discuss.html',shouldCreateUser:true}});if(error)throw error;$('auth-feedback').textContent='Check your inbox. Open the link to return to Discussions.';}catch(err){$('auth-feedback').textContent=errorInfo(err);$('auth-feedback').classList.add('error');}finally{submit.disabled=false;}});
 $('username-form').addEventListener('submit',async e=>{e.preventDefault();if(!state.user||!state.db)return;const username=$('username-input').value.trim().toLowerCase();if(!/^[a-z][a-z0-9_]{2,19}$/.test(username)){ $('username-feedback').textContent='Use 3–20 lowercase letters, numbers, or underscores; start with a letter.';return;}
 const submit=e.target.querySelector('[type=submit]');submit.disabled=true;const {data,error}=await state.db.from('community_profiles').insert({id:state.user.id,username}).select('id,username').single();submit.disabled=false;if(error){$('username-feedback').textContent=errorInfo(error);$('username-feedback').classList.add('error');return;}state.profile=data;state.profileMap.set(data.id,data.username);$('username-dialog').close();sessionStorage.removeItem('sn-community-username-later');updateAccount();toast('Your public username is ready.');});
 $('chat-form').addEventListener('submit',async e=>{e.preventDefault();if(!requirePosting())return;const value=$('chat-body').value.trim();if(!value)return;const btn=e.target.querySelector('[type=submit]');btn.disabled=true;const {error}=await state.db.from('community_messages').insert({room_slug:state.room,author_id:state.user.id,body:value});btn.disabled=false;if(error){toast(errorInfo(error));return;}$('chat-body').value='';await loadMessages();});
 $('create-thread').addEventListener('click',()=>{if(requirePosting()){$('new-thread-form').reset();$('thread-feedback').textContent='';$('new-thread-dialog').showModal();}});
 $('new-thread-form').addEventListener('submit',async e=>{e.preventDefault();if(!requirePosting())return;const title=$('new-thread-title').value.trim(),body=$('new-thread-body').value.trim();const btn=e.target.querySelector('[type=submit]');btn.disabled=true;const {error}=await state.db.from('community_threads').insert({room_slug:state.room,author_id:state.user.id,title,body});btn.disabled=false;if(error){$('thread-feedback').textContent=errorInfo(error);$('thread-feedback').classList.add('error');return;}$('new-thread-dialog').close();toast('Discussion published.');await loadThreads();});
 $('thread-back').addEventListener('click',closeThread);
 $('reply-form').addEventListener('submit',async e=>{e.preventDefault();if(!requirePosting()||!state.activeThread||state.activeThread.locked)return;const body=$('reply-body').value.trim();if(!body)return;const btn=e.target.querySelector('[type=submit]');btn.disabled=true;const {error}=await state.db.from('community_replies').insert({thread_id:state.activeThread.id,author_id:state.user.id,body});btn.disabled=false;if(error){toast(errorInfo(error));return;}$('reply-body').value='';await loadReplies();toast('Reply posted.');});
 $('report-form').addEventListener('submit',async e=>{e.preventDefault();if(!requirePosting()||!state.reportTarget)return;const btn=e.target.querySelector('[type=submit]');btn.disabled=true;const {error}=await state.db.from('community_reports').insert({reporter_id:state.user.id,target_type:state.reportTarget.kind,target_id:state.reportTarget.id,reason:$('report-reason').value,details:$('report-details').value.trim()});btn.disabled=false;if(error){$('report-feedback').textContent=errorInfo(error);$('report-feedback').classList.add('error');return;}$('report-dialog').close();toast('Report submitted privately for review.');});
}
wireControls();boot();
