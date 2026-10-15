import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {configured,normalizeEmail,hashToken,hmacFor,verifyUnsub,randomToken}=await import('../functions/_lib/newsletter.mjs');
const env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'never-a-real-key',RESEND_API_KEY:'test',NEWSLETTER_FROM_EMAIL:'news@example.com',NEWSLETTER_SIGNING_SECRET:'test-signing-secret-not-production',NEWSLETTER_POSTAL_ADDRESS:'Testing address'};
test('Newsletter disabled unless all environment secrets are configured',()=>{
 assert.equal(configured(env),true);assert.equal(configured({...env,RESEND_API_KEY:''}),false);assert.equal(configured({...env,NEWSLETTER_POSTAL_ADDRESS:''}),false);
});
test('Normalizes email addresses and rejects invalid inputs',()=>{
 assert.equal(normalizeEmail('  News@Example.com '),'news@example.com');assert.equal(normalizeEmail('<script>'),null);assert.equal(normalizeEmail('not-an-email'),null);
});
test('Random token hashing and signed unsubscribe token validation',async()=>{
 const token=randomToken();assert.match(token,/^[0-9a-f]{64}$/);
 assert.equal((await hashToken(token)).length,64);
 const id='123e4567-e89b-12d3-a456-426614174000';const mac=await hmacFor(env,id);
 assert.equal(await verifyUnsub(env,id+'.'+mac),id);
 assert.equal(await verifyUnsub(env,id+'.'+('0'.repeat(64))),null);
 assert.equal(await verifyUnsub(env,'not-valid'),null);
});
