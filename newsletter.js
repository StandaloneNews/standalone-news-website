/* Newsletter only activates when the Cloudflare Pages Functions and mail provider are configured. */
(()=>{'use strict';
async function init(){const form=document.getElementById('newsletter-form'),wait=document.getElementById('newsletter-wait'),note=document.getElementById('newsletter-message');if(!form)return;
 try{const r=await fetch('https://api.standalonenews.com/api/newsletter/status',{cache:'no-store'});if(!r.ok)return;const data=await r.json();if(!data.enabled)return;form.hidden=false;wait.hidden=true;}catch{return;}
 form.addEventListener('submit',async e=>{e.preventDefault();if(!form.reportValidity())return;const btn=form.querySelector('[type=submit]');btn.disabled=true;note.textContent='Submitting…';
  try{const response=await fetch('https://api.standalonenews.com/api/newsletter/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:form.elements.namedItem('email').value.trim(),consent:form.elements.namedItem('consent').checked,alerts:form.elements.namedItem('alerts').checked,website:form.elements.namedItem('website').value})});const data=await response.json();if(!response.ok)throw Error(data.error||'Signup unavailable');note.textContent=data.message||'Check your email to confirm your subscription.';form.reset();}catch(err){note.textContent=err.message||'Please try again later.';}finally{btn.disabled=false;}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
