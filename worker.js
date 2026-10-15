/**
 * Standalone News — Newsletter API for a dedicated Cloudflare Worker.
 * Intended custom domain: https://api.standalonenews.com
 *
 * All credentials must be Worker secrets. This script is not for the public
 * website's index.html, newsroom.js, or account-config.js.
 *
 * Adapted from V12 Cloudflare Pages Functions to a single Workers module.
 */
const SITE_ORIGIN = 'https://standalonenews.com';
const API_ORIGIN = 'https://api.standalonenews.com';
const decoder = new TextDecoder();
const encoder = new TextEncoder();

const configured = env => Boolean(
  env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY && env.RESEND_API_KEY &&
  env.NEWSLETTER_FROM_EMAIL && env.NEWSLETTER_SIGNING_SECRET &&
  env.NEWSLETTER_POSTAL_ADDRESS
);

function cors(request) {
  const origin = request.headers.get('Origin');
  return origin === SITE_ORIGIN ? {
    'Access-Control-Allow-Origin': SITE_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  } : { Vary: 'Origin' };
}

function json(data, status=200, request=null) {
  return new Response(JSON.stringify(data), {status, headers: {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'x-content-type-options':'nosniff',
    ...(request ? cors(request) : {})
  }});
}

function siteBase(env) {
  try {
    const url = new URL(env.NEWSLETTER_BASE_URL || SITE_ORIGIN);
    return url.protocol === 'https:' ? url.origin : SITE_ORIGIN;
  } catch { return SITE_ORIGIN; }
}

function emailFrom(data) {
  if (typeof data !== 'string') return null;
  const s = data.trim().toLowerCase();
  return s.length <= 254 && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(s) ? s : null;
}

function hex(bytes) { return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''); }
function randomToken() { const b = crypto.getRandomValues(new Uint8Array(32));return hex(b); }
async function hashToken(token) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token)))); }
async function signature(env,id) {
  const key = await crypto.subtle.importKey('raw',encoder.encode(env.NEWSLETTER_SIGNING_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(id))));
}
async function verifyUnsub(env,token) {
  if(typeof token!=='string'||token.length>150||!token.includes('.'))return null;
  const [id,sig,extra] = token.split('.');
  if(extra||!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/i.test(sig))return null;
  const good=await signature(env,id);
  let mismatch=0;
  for(let i=0;i<good.length;i++)mismatch|=good.charCodeAt(i)^sig.charCodeAt(i);
  return mismatch===0?id:null;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function redirect(url) {
  return new Response(null,{status:303,headers:{location:url,'cache-control':'no-store'}});
}
async function supabase(env,path,options={}) {
  const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) throw Error('Invalid Supabase project URL');
  const key=String(env.SUPABASE_SERVICE_ROLE_KEY);
  const auth=/^eyJ[^.]+\.eyJ[^.]+\./.test(key)?{'Authorization':'Bearer '+key}:{};
  const resp=await fetch(base+'/rest/v1/'+path,{...options,headers:{
    apikey:key,...auth,'content-type':'application/json','prefer':'return=representation',...(options.headers||{})
  }});
  if(!resp.ok)throw Error('Database request failed: '+resp.status);
  const t=await resp.text();return t?JSON.parse(t):[];
}
async function sendEmail(env,to,subject,html) {
  const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{
    Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'
  },body:JSON.stringify({from:env.NEWSLETTER_FROM_EMAIL,to:[to],subject,html})});
  if(!res.ok)throw Error('Email provider failed: '+res.status);
}

async function subscribe(request,env) {
  if(!configured(env))return json({error:'Newsletter signup is not configured yet.'},503,request);
  // Cross-origin requests are accepted only from the official website.
  if(request.headers.get('Origin')!==SITE_ORIGIN)return json({error:'Invalid request origin.'},403,request);
  if(Number(request.headers.get('content-length')||0)>3000)return json({error:'Request too large.'},413,request);
  let data;
  try {
    const txt=await request.text();
    if(txt.length>3000) return json({error:'Request too large.'},413,request);
    data=JSON.parse(txt);
  }catch{return json({error:'Invalid request.'},400,request);}
  if(data?.website) return json({message:'Please check your email for a confirmation link.'},200,request);
  const email=emailFrom(data?.email);
  if(!email||data?.consent!==true||typeof data?.alerts!=='boolean')
    return json({error:'Valid email and consent are required.'},400,request);
  const generic=json({message:'If this address is eligible, a confirmation link will arrive shortly.'},200,request);
  try {
    const rows=await supabase(env,'newsletter_subscribers?select=id,confirmed_at,unsubscribed_at,confirmation_sent_at&email=eq.'+encodeURIComponent(email)+'&limit=1');
    const current=rows[0];
    if(current?.confirmed_at&&!current?.unsubscribed_at)return generic;
    const last=current?.confirmation_sent_at?Date.parse(current.confirmation_sent_at):0;
    if(last&&Date.now()-last<24*3600*1000)return generic;
    const token=randomToken();
    const values={email,alerts:Boolean(data.alerts),confirmed_at:null,unsubscribed_at:null,
      confirmation_hash:await hashToken(token),confirmation_expires_at:new Date(Date.now()+24*3600*1000).toISOString(),
      confirmation_sent_at:new Date().toISOString(),consent_requested_at:new Date().toISOString()};
    const row=current
      ?(await supabase(env,'newsletter_subscribers?id=eq.'+encodeURIComponent(current.id),{method:'PATCH',body:JSON.stringify(values)}))[0]
      :(await supabase(env,'newsletter_subscribers',{method:'POST',body:JSON.stringify(values)}))[0];
    if(!row)return json({error:'Could not save signup request.'},503,request);
    const confirmUrl=API_ORIGIN+'/api/newsletter/confirm?token='+encodeURIComponent(token);
    await sendEmail(env,email,'Confirm your Standalone News subscription',
      `<div style="max-width:600px;margin:auto;font-family:Arial,sans-serif;color:#13283f"><h1>Standalone News</h1><p>Confirm that you want our source-linked daily briefing${data.alerts?' and optional important-story alerts':''}.</p><p><a href="${confirmUrl}" style="background:#b4324a;color:#fff;padding:12px 18px;display:inline-block">Confirm subscription</a></p><p>This link expires in 24 hours. Ignore this message if you did not request it.</p></div>`);
    return generic;
  }catch(err){console.error('Newsletter subscribe error:',err.message);return json({error:'Email signup is temporarily unavailable. Please try later.'},503,request);}
}

async function confirm(request,env) {
  if(!configured(env))return json({error:'Newsletter unavailable'},503,request);
  const token=new URL(request.url).searchParams.get('token');
  if(!token||!/^[a-f0-9]{64}$/.test(token))return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
  try{
    const hash=await hashToken(token);
    const rows=await supabase(env,'newsletter_subscribers?select=id,confirmation_expires_at&confirmation_hash=eq.'+hash+'&limit=1');
    const row=rows[0];
    if(!row||Date.parse(row.confirmation_expires_at)<Date.now())return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
    await supabase(env,'newsletter_subscribers?id=eq.'+row.id,{method:'PATCH',body:JSON.stringify({
      confirmed_at:new Date().toISOString(),confirmation_hash:null,confirmation_expires_at:null,unsubscribed_at:null
    })});
    return redirect(siteBase(env)+'/newsletter-status.html?status=confirmed');
  }catch(err){console.error('Newsletter confirmation error:',err.message);return redirect(siteBase(env)+'/newsletter-status.html?status=error');}
}

async function unsubscribeGet(request,env) {
  if(!configured(env))return json({error:'Unavailable'},503,request);
  const token=new URL(request.url).searchParams.get('token')||'';
  const id=await verifyUnsub(env,token);
  if(!id)return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
  const safe=escapeHtml(token);
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe — Standalone News</title></head><body style="max-width:540px;margin:14vh auto;padding:24px;font-family:Arial,sans-serif;color:#163049"><h1>Unsubscribe from Standalone News?</h1><p>Click the button below to stop all Standalone News email messages.</p><form method="post" action="/api/newsletter/unsubscribe"><input type="hidden" name="token" value="${safe}"><button style="padding:13px 20px;background:#a72c47;color:white;border:0;border-radius:5px">Unsubscribe</button></form><p><a href="${siteBase(env)}">Return to news</a></p></body></html>`,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
async function unsubscribePost(request,env) {
  if(!configured(env))return json({error:'Unavailable'},503,request);
  const origin=request.headers.get('Origin');
  if(origin!==API_ORIGIN)return json({error:'Invalid origin'},403,request);
  const data=await request.formData();
  const id=await verifyUnsub(env,data.get('token'));
  if(!id)return redirect(siteBase(env)+'/newsletter-status.html?status=invalid');
  try{
    await supabase(env,'newsletter_subscribers?id=eq.'+id,{method:'PATCH',body:JSON.stringify({unsubscribed_at:new Date().toISOString(),alerts:false})});
    return redirect(siteBase(env)+'/newsletter-status.html?status=unsubscribed');
  }catch(err){console.error('Unsubscribe error:',err.message);return redirect(siteBase(env)+'/newsletter-status.html?status=error');}
}

export default {
  async fetch(request,env) {
    const {pathname}=new URL(request.url);
    if(request.method==='OPTIONS'&&pathname.startsWith('/api/newsletter/')) {
      if(request.headers.get('Origin')!==SITE_ORIGIN)return json({error:'Invalid origin'},403,request);
      return new Response(null,{status:204,headers:cors(request)});
    }
    if(pathname==='/api/newsletter/status'&&request.method==='GET')return json({enabled:configured(env)},200,request);
    if(pathname==='/api/newsletter/subscribe'&&request.method==='POST')return subscribe(request,env);
    if(pathname==='/api/newsletter/confirm'&&request.method==='GET')return confirm(request,env);
    if(pathname==='/api/newsletter/unsubscribe'&&request.method==='GET')return unsubscribeGet(request,env);
    if(pathname==='/api/newsletter/unsubscribe'&&request.method==='POST')return unsubscribePost(request,env);
    return json({error:'Not found'},404,request);
  }
};
