/** Dependency-free local server for runtime tests and local play. */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { renderRequest } from '../lib/player.mjs';
import { loadLibrary } from '../lib/library.mjs';

export function makeServer(library, css = '') {
  return createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    const assets = { '/art/living-book.webp':'image/webp', '/art/branch-mark.svg':'image/svg+xml', '/art/favicon.svg':'image/svg+xml' };
    if (Object.hasOwn(assets, request.url)) {
      const content=readFileSync(join(process.cwd(), 'public', request.url));
      response.writeHead(200, { 'content-type':assets[request.url], 'cache-control':'public, max-age=3600' });
      response.end(request.method==='HEAD' ? undefined : content); return;
    }
    if (request.url === '/kiro.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8', 'cache-control':'no-store' });
      response.end(request.method === 'HEAD' ? undefined : css); return;
    }
    const result = renderRequest(request.url, library);
    response.writeHead(result.status, result.headers);
    response.end(request.method === 'HEAD' ? undefined : result.html);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const library = loadLibrary();
  const port = Number(process.env.PORT || 3000);
  const css = readFileSync(join(process.cwd(),'public/kiro.css'),'utf8');
  makeServer(library, css).listen(port, '127.0.0.1', () => console.log(`KIRO http://127.0.0.1:${port}`));
}
