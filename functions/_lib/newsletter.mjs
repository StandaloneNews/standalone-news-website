/** Cloudflare Pages Functions helpers. Secrets live in Pages environment variables. */
const encoder=new TextEncoder();
export const defaultBase='https://standalonenews.com';
export const configured=env=>Boolean(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY&&env.RESEND_API_KEY&&env.NEWSLETTER_FROM_EMAIL&&env.NEWSLETTER_SIGNING_SECRET&&env.NEWSLETTER_POSTAL_ADDRESS);
export const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
export const siteBase=env=>{try{const url=new URL(env.NEWSLETTER_BASE_URL||defaultBase);if(url.protocol!=='https:')return defaultBase;return url.origin;}catch{return defaultBase;}};
export function sameOrigin(request){const origin=request.headers.get('origin');if(!origin)return true;try{return new URL(origin).origin===new URL(request.url).origin;}catch{return false;}}
export const normalizeEmail=email=>{if(typeof email!=='string')return null;const t=email.trim().toLowerCase();return t.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(t)?t:null;};
export const randomToken=()=>{const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return [...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');};
export async function hashToken(token){const digest=await crypto.subtle.digest('SHA-256',encoder.encode(token));return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function hmacFor(env,id){const key=await crypto.subtle.importKey('raw',encoder.encode(env.NEWSLETTER_SIGNING_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);const signed=await crypto.subtle.sign('HMAC',key,encoder.encode(id));return [...new Uint8Array(signed)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export async function verifyUnsub(env,raw){if(typeof raw!=='string'||raw.length>150||!raw.includes('.'))return null;const [id,signature]=raw.split('.');if(!/^[a-f0-9-]{36}$/i.test(id)||!/^[a-f0-9]{64}$/i.test(signature))return null;const expected=await hmacFor(env,id);if(expected.length!==signature.length)return null;let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.charCodeAt(i);return diff===0?id:null;}
export async function sb(env,path,options={}){
 const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base))throw Error('Invalid Supabase environment configuration');
 const key=String(env.SUPABASE_SERVICE_ROLE_KEY);const auth=/^eyJ[^.]+\.eyJ[^.]+\./.test(key)?{Authorization:'Bearer '+key}:{};
 const res=await fetch(base+'/rest/v1/'+path,{...options,headers:{apikey:key,...auth,'content-type':'application/json','prefer':'return=representation',...(options.headers||{})}});
 if(!res.ok)throw Error('Database request failed: '+res.status);
 const t=await res.text();return t?JSON.parse(t):[];
}
export const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sendEmail(env,to,subject,html){const res=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'content-type':'application/json'},body:JSON.stringify({from:env.NEWSLETTER_FROM_EMAIL,to:[to],subject,html})});if(!res.ok)throw Error('Email provider failed: '+res.status);return res.json();}
export const redirect=(url)=>new Response(null,{status:303,headers:{location:url,'cache-control':'no-store'}});
