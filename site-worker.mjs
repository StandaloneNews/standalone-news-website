import { onRequestGet } from './functions/api/wire.js';

export default {
  fetch(request, env, context) {
    const url = new URL(request.url);
    if (url.pathname === '/terminal' || url.pathname === '/terminal.html') {
      url.pathname = '/';
      return Response.redirect(url.href, 302);
    }
    if (url.pathname !== '/api/wire') {
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
