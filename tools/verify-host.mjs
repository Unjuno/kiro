/** Verify a running KIRO host through anonymous GETs against the pinned corpus. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLibrary } from '../lib/library.mjs';
import { renderRequest, href } from '../lib/player.mjs';
const base = new URL(process.env.BASE_URL || 'http://127.0.0.1:3001');
if (base.username || base.password || base.search || base.hash || base.pathname !== '/') throw new Error('Use a bare deployment origin');
const library = loadLibrary();
const story = library.get('consider-the-consequences');
let requests = 0;
async function check(path) {
  const expected = renderRequest(path, library);
  const response = await fetch(new URL(path, base), { redirect: 'error', signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, expected.status, `HTTP status: ${path}`);
  const html = await response.text();
  assert.equal(html, expected.html, `Unexpected or stale HTML: ${path}`);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  requests++;
  return html;
}
await check('/');
for (const lang of ['ja', 'en', 'fr']) {
  await check(href({lang}));
  await check(href({lang,story:story.id,v:story.version}));
}
for (const node of story.nodes.values()) {
  const html = await check(href({lang:'ja',story:story.id,node:node.id,v:story.version}));
  const change = html.match(/href="([^"]+)" data-kiro-change-language/)[1].replaceAll('&amp;', '&');
  const gate = await check(change);
  const english = gate.match(/href="([^"]*lang=en[^"]*)"/)[1].replaceAll('&amp;', '&');
  await check(english);
  if (base.protocol === 'https:') await new Promise(resolve => setTimeout(resolve, 80));
}
await check(href({lang:'ja',story:story.id,node:'H-999'}));
await check(href({lang:'ja',story:story.id,node:'Helen',v:'old'}));
const report = {status:'PASS', base_url:base.origin, checked_at:new Date().toISOString(), version:story.version, anonymous_http_requests:requests, source_nodes:story.nodes.size, endings:story.report.endings, exact_html_matches:true, language_first:true, language_change_preserves_position:true};
const path = process.env.REPORT_PATH || 'validation-artifacts/host-validation.json';
mkdirSync(dirname(path),{recursive:true});writeFileSync(path,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
