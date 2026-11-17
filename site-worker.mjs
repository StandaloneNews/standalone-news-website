import { onRequestGet } from './functions/api/wire.js';

export default {
  fetch(request, env, context) {
    if (new URL(request.url).pathname !== '/api/wire') {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== 'GET') {
      return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    }
    return onRequestGet({
      request,
      waitUntil: promise => context.waitUntil(promise),
    });
  },
};
