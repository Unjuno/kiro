import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadLibrary} from '../lib/library.mjs';
import {renderRequest} from '../lib/player.mjs';
const library=loadLibrary(),story=library.get('consider-the-consequences');
const render=node=>renderRequest('/?lang=ja&story=consider-the-consequences'+(node?'&node='+node:''),library);
test('redesign preserves the pinned complete original corpus',()=>{
 assert.equal(story.version,'75b24d5c40c640bb');assert.equal(story.nodes.size,86);assert.equal(story.report.endings,43);
});
test('language gate has no book selection, source prose or artwork of future events',()=>{
 const html=renderRequest('/',library).html;assert.ok(!html.includes(story.title));assert.ok(!html.includes('character-card'));assert.match(html,/data-kiro-stage="language"/);
});
test('attribution explicitly distinguishes new illustration from original cover',()=>{
 const html=render().html;assert.match(html,/原著の表紙ではありません/);assert.match(html,/data-kiro-spoken-attribution/);assert.match(html,/creativecommons.org\/licenses\/by-sa\/4.0/);
});
test('self-hosted decorative art has intrinsic dimensions and empty alternatives',()=>{
 for(const path of ['/', '/?lang=ja','/?lang=ja&story=consider-the-consequences']){
  const html=renderRequest(path,library).html;
  for(const m of html.matchAll(/<img\b([^>]+)>/g)){
   assert.match(m[1],/src="\/art\//);assert.match(m[1],/width="\d+"/);assert.match(m[1],/height="\d+"/);assert.match(m[1],/alt=""/);
  }
 }
});
test('reader retains all original paragraphs and literal current choices',()=>{
 const r=render('Helen');const node=story.nodes.get('Helen');
 assert.ok(!r.html.includes('class="portrait'));assert.ok(!r.html.includes('<script'));
 for(const c of node.choices)assert.ok(r.html.includes('data-kiro-choice-id="'+c.id+'"'));
 assert.match(r.html,/class="prose" lang="en"/);
});
test('an ending does not fabricate a traversal history or an ordinal ending number',()=>{
 const r=render('H-13');assert.match(r.html,/data-kiro-ending/);assert.ok(!r.html.includes('data-kiro-choice-id'));assert.ok(!r.html.includes('ENDING XVII'));assert.ok(!r.html.includes('The path you chose'));
});
test('core voice instruction and credits remain discoverable in normal HTML',()=>{
 const r=render('Helen');assert.match(r.html,/class="agent-summary"/);assert.match(r.html,/Read attribution before narrating/);assert.ok(!r.html.includes(' hidden'));assert.match(r.html,/id="voice-guide"/);
});
test('CSP permits only same-origin images and still forbids client scripts',()=>{
 const r=render('Helen');assert.match(r.headers['content-security-policy'],/img-src 'self'/);assert.match(r.headers['content-security-policy'],/default-src 'none'/);assert.ok(!r.headers['content-security-policy'].includes('unsafe-inline'));
});
test('design has keyboard focus and reduced-motion treatments without font downloads',()=>{
 const css=readFileSync('public/kiro.css','utf8');assert.match(css,/:focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.ok(!css.includes('@font-face'));assert.ok(!css.includes('@import'));assert.match(css,/min-height:48px/);
});
test('generated production artwork matches the reviewed source bytes',()=>{
 const bytes=readFileSync('public/art/living-book.webp');
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(createHash('sha256').update(bytes).digest('hex'),'1ffbcecb7a1dedb727a9066b1292390786cd4077ec62d8a0727fee28be731978');
});
