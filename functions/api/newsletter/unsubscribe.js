import {configured,json,verifyUnsub,sb,siteBase,redirect,escapeHtml,sameOrigin} from '../../_lib/newsletter.mjs';
export async function onRequestGet({request,env}){
 if(!configured(env))return json({error:'Unavailable'},503);
 const token=new URL(request.url).searchParams.get('token')||'';const id=await verifyUnsub(env,token);
 if(!id)return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
 const safe=escapeHtml(token);
 return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe — Standalone News</title></head><body style="max-width:540px;margin:14vh auto;padding:24px;font-family:Arial,sans-serif;color:#163049"><h1>Unsubscribe from Standalone News?</h1><p>Click the button below to stop all Standalone News email messages.</p><form method="post" action="/api/newsletter/unsubscribe"><input type="hidden" name="token" value="${safe}"><button style="padding:13px 20px;background:#a72c47;color:white;border:0;border-radius:5px">Unsubscribe</button></form><p><a href="/">Return to news</a></p></body></html>`,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
export async function onRequestPost({request,env}){
 if(!configured(env))return json({error:'Unavailable'},503);
 if(!sameOrigin(request))return json({error:'Invalid origin'},403);
 const data=await request.formData();const id=await verifyUnsub(env,data.get('token'));
 if(!id)return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
 try{await sb(env,'newsletter_subscribers?id=eq.'+id,{method:'PATCH',body:JSON.stringify({unsubscribed_at:new Date().toISOString(),alerts:false})});return redirect(siteBase(env)+'/newsletter-status.html?status=unsubscribed');}
 catch(err){console.error('Unsubscribe failed:',err.message);return redirect(siteBase(env)+'/newsletter-status.html?status=error');}
}
