import {configured,json,normalizeEmail,sameOrigin,randomToken,hashToken,sb,sendEmail,siteBase} from '../../_lib/newsletter.mjs';
export async function onRequestPost({request,env}){
 if(!configured(env))return json({error:'Newsletter signup is not configured yet.'},503);
 if(!sameOrigin(request))return json({error:'Invalid request origin.'},403);
 if(Number(request.headers.get('content-length')||0)>3000)return json({error:'Request too large.'},413);
 let data;try{data=await request.json();}catch{return json({error:'Invalid request.'},400);}
 if(data?.website)return json({message:'Please check your email for a confirmation link.'});
 const email=normalizeEmail(data?.email);
 if(!email||data?.consent!==true||typeof data?.alerts!=='boolean')return json({error:'Valid email and consent are required.'},400);
 const reply=json({message:'If this address is eligible, a confirmation link will arrive shortly.'});
 try{
   const rows=await sb(env,'newsletter_subscribers?select=id,confirmed_at,unsubscribed_at,confirmation_sent_at&email=eq.'+encodeURIComponent(email)+'&limit=1');
   const current=rows[0];
   // Never allow a stranger to change a confirmed subscriber's alert preferences.
   if(current?.confirmed_at&&!current?.unsubscribed_at)return reply;
   const last=current?.confirmation_sent_at?Date.parse(current.confirmation_sent_at):0;
   if(last&&Date.now()-last<24*3600*1000)return reply;
   const token=randomToken(),hash=await hashToken(token);
   const values={email,alerts:Boolean(data.alerts),confirmed_at:null,unsubscribed_at:null,confirmation_hash:hash,confirmation_expires_at:new Date(Date.now()+24*3600*1000).toISOString(),confirmation_sent_at:new Date().toISOString(),consent_requested_at:new Date().toISOString()};
   const row=current?(await sb(env,'newsletter_subscribers?id=eq.'+encodeURIComponent(current.id),{method:'PATCH',body:JSON.stringify(values)}))[0]:(await sb(env,'newsletter_subscribers',{method:'POST',body:JSON.stringify(values)}))[0];
   if(!row)return json({error:'Could not save the signup request.'},503);
   const confirmUrl=siteBase(env)+'/api/newsletter/confirm?token='+encodeURIComponent(token);
   await sendEmail(env,email,'Confirm your Standalone News subscription',`<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#13283f"><h1>Standalone News</h1><p>Confirm that you want our source-linked daily briefing${data.alerts?' and optional important-story alerts':''}.</p><p><a href="${confirmUrl}" style="background:#b4324a;color:#fff;padding:12px 18px;display:inline-block">Confirm subscription</a></p><p>This link expires in 24 hours. Ignore this message if you did not request it.</p></div>`);
   return reply;
 }catch(err){console.error('Newsletter subscribe failed:',err.message);return json({error:'Email signup is temporarily unavailable. Please try later.'},503);}
}
