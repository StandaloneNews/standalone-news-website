/* Optional reader accounts; runs only after a Supabase project is configured. */
const cfg=window.SN_ACCOUNT_CONFIG||{};
const $=id=>document.getElementById(id);
const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(cfg.url||'') && typeof cfg.publishableKey==='string' && cfg.publishableKey.length>20;
const setMessage=(msg,error=false)=>{const n=$('account-message');if(n){n.textContent=msg;n.classList.toggle('error',error);}};
if(configured){
  const uiReady=async()=>{
    const desk=window.SNDesk;
    if(!desk){return;}
    const btn=$('account-button'), savedLink=$('saved-account-link'), intro=$('saved-context');
    btn.hidden=false;savedLink.hidden=false;
    btn.addEventListener('click',()=>desk.openModal('account-overlay'));
    savedLink.addEventListener('click',()=>{desk.closeModal('saved-overlay');desk.openModal('account-overlay');});
    let db=null,user=null,operation=Promise.resolve();
    const show=()=>{
      $('account-wait').hidden=true;
      $('account-email-form').hidden=!!user;
      $('account-signed').hidden=!user;
      btn.textContent=user?'My account':'Sign in';
      intro.textContent=user?'Your saved articles are linked to your private reader account.':'Your saved articles are stored on this browser. Sign in to sync them across devices.';
      savedLink.textContent=user?'Manage my account →':'Sign in to sync bookmarks →';
      if(user){$('account-identity').textContent=user.email||'Reader';$('account-count').textContent=`${desk.getSaved().length} saved stories in your account.`;
      const local=desk.getGuestSaved();$('account-import').hidden=!local.length;$('account-import').textContent=`Import ${local.length} saved browser ${local.length===1?'story':'stories'}`;}
    };
    try{
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      db=createClient(cfg.url.replace(/\/$/,''),cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    }catch(e){$('account-wait').textContent='Sign-in service could not be loaded. Your browser bookmarks still work.';btn.hidden=true;savedLink.hidden=true;return;}
    const rowOf=(item)=>({user_id:user.id,story_key:item.key,story_type:item.type,story_url:item.url,title:String(item.title||'').slice(0,500),source:String(item.source||'').slice(0,160),category:String(item.category||'').slice(0,80),published_at:item.published_at||null,summary:String(item.summary||'').slice(0,500)});
    const clean=(r)=>({key:r.story_key,type:r.story_type,url:r.story_url,title:r.title,source:r.source,category:r.category,published_at:r.published_at,summary:r.summary});
    const readCloud=async()=>{const {data,error}=await db.from('saved_articles').select('story_key,story_type,story_url,title,source,category,published_at,summary').eq('user_id',user.id).order('saved_at',{ascending:false}).limit(100);if(error)throw error;desk.setCloudSaved((data||[]).map(clean));show();};
    let authBusy=false;
    const handleUser=async(u)=>{
      if(authBusy)return;
      authBusy=true;
      try{user=u||null;
        if(user){setMessage('');await readCloud();}
        else{desk.setGuestMode();setMessage('');show();}
      }catch(e){desk.setCloudSaved([]);show();setMessage('Could not load your saved articles. Please try again later. '+e.message,true);}
      finally{authBusy=false;}
    };
    const {data:{session},error:sessionErr}=await db.auth.getSession();
    if(sessionErr)setMessage('Account session could not be restored.',true);
    await handleUser(session?.user||null);
    db.auth.onAuthStateChange((event,session)=>{if(['SIGNED_IN','SIGNED_OUT','USER_UPDATED'].includes(event)){setTimeout(()=>handleUser(session?.user||null),0);}});
    $('account-email-form').addEventListener('submit',async(e)=>{
      e.preventDefault();const email=$('account-email').value.trim();if(!email)return;
      const submit=$('account-email-form').querySelector('[type=submit]');submit.disabled=true;setMessage('Sending your sign-in link…');
      try{const {error}=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});if(error)throw error;setMessage('Check your inbox for the sign-in link. You can use it to create your account or sign in.');}
      catch(err){setMessage('Could not send a sign-in link: '+err.message,true);}
      finally{submit.disabled=false;}
    });
    $('account-signout').addEventListener('click',async()=>{setMessage('Signing out…');const {error}=await db.auth.signOut();if(error)setMessage('Sign-out failed: '+error.message,true);else{await handleUser(null);setMessage('Signed out. Browser-only bookmarks are available again.');}});
    $('account-import').addEventListener('click',async()=>{
      if(!user)return;const local=desk.getGuestSaved().filter(s=>s&&s.key&&s.title);if(!local.length)return;
      const importButton=$('account-import');importButton.disabled=true;setMessage('Importing bookmarks…');
      try{const {error}=await db.from('saved_articles').upsert(local.map(rowOf),{onConflict:'user_id,story_key'});if(error)throw error;await readCloud();setMessage(`Imported ${local.length} browser bookmarks.`);}
      catch(err){setMessage('Import failed: '+err.message,true);}finally{importButton.disabled=false;}
    });
    window.addEventListener('sn:bookmark-change',e=>{
      if(!user)return;
      const {key,added,item,clear}=e.detail||{};
      operation=operation.then(async()=>{
        if(!user)return;
        let error;
        if(clear)({error}=await db.from('saved_articles').delete().eq('user_id',user.id));
        else if(added && item)({error}=await db.from('saved_articles').upsert(rowOf(item),{onConflict:'user_id,story_key'}));
        else if(key)({error}=await db.from('saved_articles').delete().eq('user_id',user.id).eq('story_key',key));
        if(error)throw error;
        show();
      }).catch(async err=>{setMessage('Bookmark sync failed: '+err.message+' Try again when connected.',true);try{await readCloud();}catch{}});
    });
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',uiReady);else uiReady();
}
