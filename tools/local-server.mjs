import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadLibrary } from '../lib/library.mjs';
import { renderRequest } from '../lib/player.mjs';

export function makeServer(library, css = '') {
  return createServer((request, response) => {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405, { allow: 'GET, HEAD' }); response.end(); return;
    }
    if (request.url === '/kiro.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      response.end(request.method === 'HEAD' ? '' : css); return;
    }
    const result = renderRequest(request.url, library);
    response.writeHead(result.status, result.headers);
    response.end(request.method === 'HEAD' ? '' : result.html);
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const server = makeServer(loadLibrary(), readFileSync(join(process.cwd(), 'public/kiro.css'), 'utf8'));
  server.listen(port, '127.0.0.1', () => console.log(`KIRO listening on http://127.0.0.1:${port}`));
}
