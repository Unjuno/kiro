import { loadLibrary } from '../lib/library.mjs';
import { renderRequest } from '../lib/player.mjs';
import { isAgentJSONRequest, renderAgentRequest } from '../lib/agent.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let library;

// One route, two read-only representations:
// ordinary current-scene HTML or format=json for compatible live agents.
export function GET(request) {
  try {
    library ??= loadLibrary();
    if (isAgentJSONRequest(request.url)) {
      const result = renderAgentRequest(request.url, library);
      return new Response(result.body, { status: result.status, headers: result.headers });
    }
    const result = renderRequest(request.url, library);
    return new Response(result.html, { status: result.status, headers: result.headers });
  } catch (error) {
    console.error('KIRO local corpus unavailable:', error.message);
    return new Response('KIRO: no validated local story corpus is available.', {
      status: 503,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  }
}
