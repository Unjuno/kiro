/** Exhaustive actual-corpus HTML/HTTP check, with no live source fetches. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { writeFileSync } from 'node:fs';
import { loadLibrary } from '../lib/library.mjs';
import { renderRequest, href } from '../lib/player.mjs';
import { makeServer } from './local-server.mjs';
const library=loadLibrary();
const story=library.get('consider-the-consequences');
const state=(node,lang='ja')=>({lang,story:story.id,node,v:story.version});
const server=makeServer(library,'body{font-family:serif}');
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`;
const links=html=>[...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*data-kiro-choice-id="([^"]+)"/g)].map(m=>({url:m[1].replaceAll('&amp;','&'),id:m[2]}));
let scenes=0,edges=0,paths=0,transitions=0;
try {
  const gate=await fetch(base+'/');assert.equal(gate.status,200);
  const gateHTML=await gate.text();assert.match(gateHTML,/data-kiro-stage="language"/);assert.ok(!gateHTML.includes(story.title));
  for(const node of story.nodes.values()) {
    for(const lang of ['ja','en','fr']) {
      const path=href(state(node.id,lang));
      const response=await fetch(base+path);assert.equal(response.status,200);
      const html=await response.text();assert.equal(html,renderRequest(path,library).html);
      assert.match(html,new RegExp(`data-kiro-state="${node.id}"`));
      assert.ok(!html.includes('<script'));assert.ok(!/rel=["'](?:prefetch|preload)/.test(html));
      const choices=links(html);assert.equal(choices.length,node.choices.length);
      assert.equal(html.includes('data-kiro-ending'),node.type==='ending');
      for(let i=0;i<choices.length;i++) {
        const u=new URL(choices[i].url,base);
        assert.equal(u.searchParams.get('node'),node.choices[i].next);
        assert.equal(u.searchParams.get('lang'),lang);
        assert.equal(u.searchParams.get('v'),story.version);
      }
      // Changing language is navigation, not a restart.
      const change=html.match(/href="([^"]+)" data-kiro-change-language/)[1].replaceAll('&amp;','&');
      const g=renderRequest(change,library).html;
      const en=g.match(/href="([^\"]*lang=en[^\"]*)"/)[1].replaceAll('&amp;','&');
      assert.ok(renderRequest(en,library).html.includes(`data-kiro-state="${node.id}"`));
      scenes++;
    }
    edges+=node.choices.length;
  }
  async function walk(nodeId, ancestors=[]) {
    assert.ok(!ancestors.includes(nodeId),'Unexpected source loop');
    const response=await fetch(base+href(state(nodeId)));
    assert.equal(response.status,200);
    const html=await response.text();transitions++;
    const choices=links(html);
    if(!choices.length) {assert.ok(html.includes('data-kiro-ending'));paths++;return;}
    for(const choice of choices) await walk(new URL(choice.url,base).searchParams.get('node'),[...ancestors,nodeId]);
  }
  for(const entry of story.entries) await walk(entry.id);
  assert.equal(paths,61);assert.equal(edges,87);
  const report={status:'PASS',version:story.version,actual_source_nodes:story.nodes.size,locale_scene_checks:scenes,verified_edges:edges,unique_endings:story.report.endings,complete_playthroughs:paths,http_scene_visits:transitions,languages:['ja','en','fr'],no_javascript:true,language_change_preserves_position:true};
  writeFileSync('stories/consider-the-consequences/playthrough-validation.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {await new Promise(resolve=>server.close(resolve));}
