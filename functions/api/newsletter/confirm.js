import {configured,hashToken,json,sb,siteBase,redirect} from '../../_lib/newsletter.mjs';
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:'Newsletter unavailable'},503);
 const token=new URL(request.url).searchParams.get('token');
 if(!token||!/^[a-f0-9]{64}$/.test(token))return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
 try{const hash=await hashToken(token);const rows=await sb(env,'newsletter_subscribers?select=id,confirmation_expires_at&confirmation_hash=eq.'+hash+'&limit=1');const row=rows[0];
 if(!row||Date.parse(row.confirmation_expires_at)<Date.now())return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
 await sb(env,'newsletter_subscribers?id=eq.'+row.id,{method:'PATCH',body:JSON.stringify({confirmed_at:new Date().toISOString(),confirmation_hash:null,confirmation_expires_at:null,unsubscribed_at:null})});
 return redirect(siteBase(env)+'/newsletter-status.html?status=confirmed');
 }catch(err){console.error('Newsletter confirmation failed:',err.message);return redirect(siteBase(env)+'/newsletter-status.html?status=error');}
}
