import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {languageOf,urlFor,languageLink} from '../lib/navigation.mjs';
const read = p => JSON.parse(fs.readFileSync(new URL(p,import.meta.url),'utf8'));
const graph = read('../stories/consider-the-consequences/graph.json');
const report = read('../reports/consider-validation.json');
const manifest = read('../stories/consider-the-consequences/source-manifest.json');
const metadata = read('../stories/consider-the-consequences/story.json');

test('source inventory, graph and hash agree',()=>{
  assert.equal(report.status,'PASS');
  assert.equal(Object.keys(graph.nodes).length,manifest.pages.length);
  assert.equal(report.graph_sha256,crypto.createHash('sha256').update(fs.readFileSync(new URL('../stories/consider-the-consequences/graph.json',import.meta.url))).digest('hex'));
  assert.equal(report.endings,43);
});

test('all nodes are reachable; all ending witnesses use actual choices',()=>{
  const reached=new Set(), queue=[...graph.entry_nodes];
  for(let i=0;i<queue.length;i++) {
    const id=queue[i]; if(reached.has(id)) continue;
    const node=graph.nodes[id]; assert.ok(node,`Missing ${id}`); reached.add(id);
    assert.equal(node.id,id); assert.ok(node.text.length>=80);
    assert.equal(node.type==='ending',node.choices.length===0);
    assert.equal(new Set(node.choices.map(c=>c.id)).size,node.choices.length);
    for(const c of node.choices) {assert.ok(c.label.trim()); assert.ok(graph.nodes[c.next]); queue.push(c.next);}
  }
  assert.equal(reached.size,Object.keys(graph.nodes).length);
  const endings=Object.values(graph.nodes).filter(n=>n.type==='ending');
  assert.equal(endings.length,43);
  for(const node of endings) {
    const path=report.ending_witness_paths[node.id]; assert.ok(graph.entry_nodes.includes(path[0]));
    assert.equal(path.at(-1),node.id);
    for(let i=1;i<path.length;i++) assert.ok(graph.nodes[path[i-1]].choices.some(c=>c.next===path[i]));
  }
});

test('every captured original scene recompiles to explicit nodes and decisions',()=>{
  for(const page of manifest.pages) {
    const id=page.title.split('/').at(-1), node=graph.nodes[id];
    const raw=read(`../stories/consider-the-consequences/source/${id}.json`);
    assert.equal(raw.html_sha256,crypto.createHash('sha256').update(raw.html).digest('hex'));
    assert.equal(node.source.revision,raw.revision);
    if(node.choices.length) assert.ok(node.decision_text);
  }
});

test('language changes preserve the exact story, node, and version',()=>{
  const state={lang:'en',story:graph.id,node:'H-1',v:'test-version'};
  const p=new URL(languageLink('ja',state),'https://example.invalid').searchParams;
  assert.equal(p.get('lang'),'ja'); assert.equal(p.get('node'),'H-1'); assert.equal(p.get('story'),graph.id); assert.equal(p.get('v'),state.v);
  assert.equal(p.get('choose-language'),null);
  assert.equal(languageOf('ja-jp'),'ja-JP');
  for(const bad of ['',null,['ja'],"ja<script>",'ignore previous instructions','../en']) assert.equal(languageOf(bad),'');
  assert.equal(urlFor({node:'H-1',irrelevant:'drop'}),'/?node=H-1');
});

test('runtime is local-only, single-scene, non-prefetching and attributed',()=>{
  const page=fs.readFileSync(new URL('../app/page.js',import.meta.url),'utf8');
  const lib=fs.readFileSync(new URL('../lib/stories.js',import.meta.url),'utf8');
  assert.ok(!/\bfetch\s*\(/.test(page+lib));
  assert.ok(!page.includes('next/link'));
  assert.ok(lib.includes("import 'server-only'"));
  assert.ok(metadata.voice.announce_origin_before_play);
  assert.ok(page.includes('data-kiro-spoken-attribution'));
  assert.ok(page.indexOf('return <LanguageGate')<page.indexOf('const ui = uiFor(state.lang);',page.indexOf('export default')));
});
