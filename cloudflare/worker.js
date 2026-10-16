// goalagents.run front for agents: the MCP server at /mcp and its sign-in under the same domain,
// so an agent only ever sees goalagents.run. The site itself stays on GitHub Pages; this Worker
// runs only on the routes below and passes the rest of the requests through.
//   goalagents.run/mcp*          → the MCP server (Supabase Edge Function)
//   goalagents.run/auth/*        → Supabase Auth (OAuth 2.1: register, authorize, token, keys)
//   goalagents.run/.well-known/* → discovery documents that name goalagents.run everywhere

const SITE = 'https://goalagents.run';
const SUPABASE = 'https://wbnmtecgahwzwvcqenlk.supabase.co';
const MCP = `${SUPABASE}/functions/v1/mcp`;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'max-age=300' },
});

// The resource the agent asks access for, and who signs people in for it.
const resourceMetadata = () => json({
  resource: `${SITE}/mcp`,
  authorization_servers: [SITE],
  bearer_methods_supported: ['header'],
  resource_name: 'GoalAgents',
});

// Supabase's own Auth metadata with every address moved to goalagents.run.
async function authMetadata() {
  const res = await fetch(`${SUPABASE}/.well-known/oauth-authorization-server/auth/v1`);
  if (!res.ok) return json({ error: 'auth_metadata_unavailable' }, 502);
  const meta = await res.json();
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value === 'string' && value.startsWith(SUPABASE)) meta[key] = SITE + value.slice(SUPABASE.length);
  }
  meta.issuer = SITE;
  return json(meta);
}

// Pass a request on to Supabase as it is; redirects go back to the agent's browser untouched.
async function forward(request, target) {
  const headers = new Headers(request.headers);
  headers.delete('host');
  const res = await fetch(target, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual',
  });
  const out = new Response(res.body, res);
  // Sign-in challenges point at our discovery document, not Supabase's.
  if (out.headers.has('www-authenticate')) {
    out.headers.set('www-authenticate', `Bearer resource_metadata="${SITE}/.well-known/oauth-protected-resource/mcp"`);
  }
  return out;
}

export default {
  async fetch(request) {
    const url = new URL(request.url), path = url.pathname;
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
        'access-control-allow-headers': '*',
        'access-control-expose-headers': 'mcp-session-id, www-authenticate',
      } });
    }
    if (path.startsWith('/.well-known/oauth-protected-resource')) return resourceMetadata();
    if (path.startsWith('/.well-known/oauth-authorization-server') || path.startsWith('/.well-known/openid-configuration')) return authMetadata();
    // Someone opening /mcp in a browser gets the page on connecting an agent, not the server's
    // "no credentials" error; agents never ask for HTML.
    if (path === '/mcp' && request.method === 'GET' && !request.headers.has('authorization') &&
        (request.headers.get('accept') || '').includes('text/html')) {
      return Response.redirect(`${SITE}/connect/`, 302);
    }
    if (path === '/mcp' || path.startsWith('/mcp/')) return forward(request, MCP + path.slice(4) + url.search);
    if (path.startsWith('/auth/')) return forward(request, SUPABASE + path + url.search);
    return fetch(request); // anything else: the site on GitHub Pages
  },
};
