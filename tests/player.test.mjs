import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { normalizeLanguage, href, renderRequest } from '../lib/player.mjs';
import { validateGraph, sha256 } from '../lib/graph.mjs';
import { makeServer } from '../tools/local-server.mjs';

// Fictional fixture, deliberately not the real book and never shipped as content.
function fixture() {
  const nodes = [
    { id:'Helen',type:'scene',text:'VISIBLE_HELEN_ONLY. A controlled fixture narrative.',decision_text:'Choose the first or second option.',choices:[{id:'a',label:'First choice',next:'H-1'},{id:'b',label:'Second choice',next:'H-2'}]},
    { id:'Jed',type:'scene',text:'VISIBLE_JED_ONLY. A controlled fixture narrative.',decision_text:'Continue to the ending.',choices:[{id:'a',label:'Continue',next:'J-1'}]},
    { id:'Saunders',type:'scene',text:'VISIBLE_SAUNDERS_ONLY. A controlled fixture narrative.',decision_text:'Continue to the ending.',choices:[{id:'a',label:'Continue',next:'S-1'}]},
    ...['H-1','H-2','J-1','S-1'].map(id=>({id,type:'ending',text:`FUTURE_SECRET_${id}. This is a fictional test conclusion.`,decision_text:'',choices:[]})),
  ].map(node=>({...node,source:{url:`https://en.wikisource.org/wiki/Consider_the_Consequences!/${node.id}`}}));
  const story={id:'fixture',title:'Fixture only',version:'0123456789abcdef',language:'en',
    description:{en:'A test fixture.',ja:'検証用データ。'},
    entries:['Helen','Jed','Saunders'].map(id=>({id,label:id})),
    attribution:'This is a synthetic test fixture, not a real port.',
    source_url:'https://en.wikisource.org/wiki/Consider_the_Consequences!',
    rights:{note:'TEST FIXTURE ONLY'},nodes:new Map(nodes.map(n=>[n.id,n]))};
  return {library:new Map([[story.id,story]]),story,nodes};
}
const parseLinks = html => [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(m=>m[1].replaceAll('&amp;','&'));
const urlFor = (node,lang='ja')=>href({lang,story:'fixture',node,v:'0123456789abcdef'});

test('language must be selected before catalog or story content',()=>{
  const {library}=fixture();
  for(const path of ['/', '/?story=fixture', '/?story=fixture&node=Helen']){
    const r=renderRequest(path,library);
    assert.equal(r.status,200);assert.match(r.html,/data-kiro-stage="language"/);
    assert.ok(!r.html.includes('VISIBLE_HELEN_ONLY'));
    assert.ok(!r.html.includes('Fixture only'));
  }
});
test('initial explicit language goes directly to catalog',()=>{
  const r=renderRequest('/?lang=ja',fixture().library);
  assert.match(r.html,/data-kiro-stage="catalog"/);assert.match(r.html,/物語を選ぶ/);
});
test('explicit language is canonicalized, never guessed',()=>{
  assert.equal(normalizeLanguage('JA'),'ja');assert.equal(normalizeLanguage('pt-br'),'pt-BR');
  assert.equal(normalizeLanguage(''),null);
  assert.equal(normalizeLanguage('日本語'),null);assert.equal(normalizeLanguage('<script>'),null);
});
test('language choice retains a pending deep link and version',()=>{
  const r=renderRequest('/?story=fixture&node=H-1&v=0123456789abcdef',fixture().library);
  const link=parseLinks(r.html).find(link=>link.startsWith('/?lang=ja'));
  assert.equal(new URL(link,'https://test.invalid').searchParams.get('node'),'H-1');
  assert.equal(new URL(link,'https://test.invalid').searchParams.get('v'),'0123456789abcdef');
});
test('changing language does not reset story position',()=>{
  const {library}=fixture();
  const first=renderRequest(urlFor('H-1'),library);
  const change=first.html.match(/href="([^"]+)" data-kiro-change-language/)[1].replaceAll('&amp;','&');
  const gate=renderRequest(change,library);
  const english=parseLinks(gate.html).find(link=>link.startsWith('/?lang=en'));
  const resumed=renderRequest(english,library);
  assert.match(resumed.html,/data-kiro-state="H-1"/);assert.match(resumed.html,/data-kiro-language="en"/);
});
test('current response contains no unchosen branch prose or future ending text',()=>{
  const r=renderRequest(urlFor('Helen'),fixture().library);
  assert.match(r.html,/VISIBLE_HELEN_ONLY/);
  assert.ok(!r.html.includes('VISIBLE_JED_ONLY'));assert.ok(!r.html.includes('FUTURE_SECRET_'));
  assert.ok(!r.html.includes('<script'));assert.ok(!/<link\b[^>]*rel=["']prefetch/i.test(r.html));
});
test('each choice preserves language and version',()=>{
  const r=renderRequest(urlFor('Helen','fr'),fixture().library);
  const links=parseLinks(r.html).filter(link=>link.includes('node=H-'));
  assert.equal(links.length,2);
  for(const link of links){const p=new URL(link,'https://t.invalid').searchParams;assert.equal(p.get('lang'),'fr');assert.equal(p.get('v'),'0123456789abcdef');}
});
test('reload of same state produces identical output',()=>{
  const {library}=fixture();assert.deepEqual(renderRequest(urlFor('Helen'),library),renderRequest(urlFor('Helen'),library));
});
test('unknown nodes are errors, never endings',()=>{
  const r=renderRequest(urlFor('H-999'),fixture().library);assert.equal(r.status,404);assert.ok(!r.html.includes('data-kiro-ending'));
});
test('unknown story ids do not read prototypes',()=>{
  for(const id of ['__proto__','constructor','../../secrets'])assert.equal(renderRequest(`/?lang=ja&story=${encodeURIComponent(id)}`,fixture().library).status,404);
});
test('unsupported saved version is a conflict, not a reset',()=>{
  const r=renderRequest('/?lang=ja&story=fixture&node=H-1&v=old',fixture().library);assert.equal(r.status,409);assert.match(r.html,/勝手にリセットしていません/);
});
test('legacy valid links without a version still work and emit a pinned version',()=>{
  const r=renderRequest('/?lang=ja&story=fixture&node=Helen',fixture().library);assert.equal(r.status,200);assert.match(r.html,/v=0123456789abcdef/);
});
test('endings are explicit and have no story choices',()=>{
  const r=renderRequest(urlFor('H-1'),fixture().library);assert.match(r.html,/data-kiro-ending/);assert.ok(!r.html.includes('data-kiro-choice-id'));
});
test('attribution is visible on introduction and direct scene entry',()=>{
  const {library}=fixture();for(const path of ['/?lang=ja&story=fixture',urlFor('Helen')]){
    const r=renderRequest(path,library);assert.match(r.html,/data-kiro-spoken-attribution/);assert.match(r.html,/Read attribution before narrating/);
  }
});
test('all content and labels are escaped',()=>{
  const {library,story}=fixture();story.nodes.get('Helen').text='<script>alert(1)</script><img onerror="bad">';
  const r=renderRequest(urlFor('Helen'),library);assert.ok(!r.html.includes('<script'));assert.match(r.html,/&lt;script&gt;/);
});
test('invalid language input is rejected without executable HTML',()=>{
  const r=renderRequest('/?lang=%22%3E%3Cscript%3E',fixture().library);assert.equal(r.status,400);assert.ok(!r.html.includes('<script'));
});
test('duplicate state parameters are rejected',()=>{
  assert.equal(renderRequest('/?lang=ja&lang=en',fixture().library).status,400);
});
test('unrecognized query parameters are not propagated',()=>{
  const r=renderRequest('/?lang=ja&private_token=DO_NOT_PROPAGATE',fixture().library);assert.ok(!r.html.includes('DO_NOT_PROPAGATE'));
});
test('language gate escapes pending state input',()=>{
  const r=renderRequest('/?story=%22%3E%3Cscript%3E&node=Helen',fixture().library);assert.ok(!r.html.includes('<script'));assert.match(r.html,/&lt;script&gt;/);
});
test('response prevents cross-state caching and URL referrer leakage',()=>{
  const r=renderRequest(urlFor('Helen'),fixture().library);assert.equal(r.headers['cache-control'],'private, no-store');assert.equal(r.headers['referrer-policy'],'no-referrer');
});
test('all node responses can be walked by visible links',()=>{
  const {library,nodes}=fixture();const seen=new Set();const queue=['Helen','Jed','Saunders'];
  while(queue.length){const id=queue.shift();if(seen.has(id))continue;seen.add(id);
    const r=renderRequest(urlFor(id),library);assert.equal(r.status,200);
    for(const link of parseLinks(r.html).filter(l=>l.startsWith('/?lang=ja&story=fixture&node='))){
      const target=new URL(link,'https://x.invalid').searchParams.get('node');queue.push(target);
    }
  }assert.equal(seen.size,nodes.length);
});
test('independent graph validation produces all ending witnesses',()=>{
  const {nodes}=fixture();const r=validateGraph({nodes},{expectedEndings:4});assert.equal(r.status,'PASS');assert.equal(Object.keys(r.ending_witnesses).length,4);
});
test('graph validator catches unreachable nodes and broken targets',()=>{
  const {nodes}=fixture();nodes[0].choices[0].next='MISSING';assert.equal(validateGraph({nodes}).status,'FAIL');
});
test('non-ending with zero choices never passes validation',()=>{
  const {nodes}=fixture();nodes[0].choices=[];assert.equal(validateGraph({nodes}).status,'FAIL');
});
test('source inventory mismatch never passes validation',()=>{
  const {nodes}=fixture();assert.equal(validateGraph({nodes},{inventoryIds:['Helen']}).status,'FAIL');
});
test('duplicate node ids never pass validation',()=>{
  const {nodes}=fixture();nodes.push(nodes[0]);assert.equal(validateGraph({nodes}).status,'FAIL');
});
test('canonical hash is independent of object key insertion order',()=>{
  assert.equal(sha256({b:2,a:'文'}),sha256({a:'文',b:2}));
});
test('HTML contains selected language and an explicit source-text language',()=>{
  const r=renderRequest(urlFor('Helen'),fixture().library);assert.match(r.html,/<html lang="ja">/);assert.match(r.html,/class="prose" lang="en"/);
});
test('native HTTP route is playable without JavaScript',async()=>{
  const server=makeServer(fixture().library,'body{margin:0}');server.listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const base=`http://127.0.0.1:${server.address().port}`;
    const start=await fetch(base+'/');assert.equal(start.status,200);assert.match(await start.text(),/Choose your language/);
    const scene=await fetch(base+urlFor('Helen'));assert.equal(scene.status,200);assert.match(await scene.text(),/VISIBLE_HELEN_ONLY/);
    const missing=await fetch(base+urlFor('H-999'));assert.equal(missing.status,404);
    const post=await fetch(base+'/',{method:'POST'});assert.equal(post.status,405);
    const head=await fetch(base+urlFor('Helen'),{method:'HEAD'});assert.equal(await head.text(),'');
    const css=await fetch(base+'/kiro.css');assert.equal(css.status,200);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('rendering does not make any network request',()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=()=>{throw new Error('Network forbidden in the runtime test')};
  try {
    const {library,nodes}=fixture();
    for(const node of nodes)assert.equal(renderRequest(urlFor(node.id),library).status,200);
  } finally { globalThis.fetch=previous; }
});
