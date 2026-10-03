import worker from '../dist/server/index.js';

// This host has no Sites identity gateway. Never accept identity headers.
export default {
  async fetch(request, env, ctx) {
    const response = await worker.fetch(request, {...env, AUTH_MODE: 'email'}, ctx);
    const url = new URL(request.url);
    if (url.pathname === '/Ember-Widget.js' && request.method === 'GET' && response.ok) {
      const source = (await response.text()).replace(
        /const APP_URL = '[^']*';/,
        `const APP_URL = ${JSON.stringify(url.origin)};`
      );
      return new Response(source, {status: response.status, headers: response.headers});
    }
    return response;
  }
};
