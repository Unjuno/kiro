import { loadLibrary } from '../lib/library.mjs';
import { renderRequest } from '../lib/player.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
let library;

// This replaces app/page.js. A route handler returns the complete current HTML
// in one response: no RSC payload, client state, prefetch, or runtime source fetch.
export function GET(request) {
  try {
    library ??= loadLibrary();
    const result = renderRequest(request.url, library);
    return new Response(result.html, { status: result.status, headers: result.headers });
  } catch (error) {
    console.error('KIRO local corpus unavailable:', error.message);
    return new Response('KIRO: no validated local story corpus is available.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
}
