#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { canonical, sha256 } from '../lib/graph.mjs';
import { loadLibrary } from '../lib/library.mjs';
import { compileTwee } from '../lib/twee.mjs';

function parseArgs(argv) {
  const out={storyRoot:'stories',allowTestFixtures:false};
  for(let i=0;i<argv.length;i++) {
    if(argv[i]==='--story-root') out.storyRoot=argv[++i];
    else if(argv[i]==='--allow-test-fixtures') out.allowTestFixtures=true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return out;
}
const read = path => JSON.parse(readFileSync(path,'utf8'));
function finitePaths(story,cap=10000n) {
  const memo=new Map(),visiting=new Set();
  function count(id) {
    if(memo.has(id)) return memo.get(id);
    if(visiting.has(id)) throw new Error(`Cycle detected while enumerating ${story.id}: ${id}`);
    const node=story.nodes.get(id);
    if(!node) throw new Error(`Missing node while enumerating ${story.id}: ${id}`);
    if(node.type==='ending') return 1n;
    visiting.add(id);
    let total=0n;
    for(const choice of node.choices) {
      total+=count(choice.next);
      if(total>cap) throw new Error(`${story.id} exceeds exhaustive-path cap ${cap}`);
    }
    visiting.delete(id);
    memo.set(id,total);
    return total;
  }
  let total=0n;
  for(const entry of story.entries) {
    total+=count(entry.id);
    if(total>cap) throw new Error(`${story.id} exceeds exhaustive-path cap ${cap}`);
  }
  return total;
}

const options=parseArgs(process.argv.slice(2));
const root=resolve(options.storyRoot);
const catalog=read(join(root,'catalog.json'));
const library=loadLibrary(root,{allowTestFixtures:options.allowTestFixtures});
const reports=[];

for(const item of catalog.stories) {
  const folder=join(root,item.id);
  const story=library.get(item.id);
  if(!story) throw new Error(`Catalog story was not loaded: ${item.id}`);
  const bundle=read(join(folder,'nodes.json'));
  const manifest=read(join(folder,'source.manifest.json'));
  const completePaths=finitePaths(story);

  if(manifest.import_profile==='kiro-twee3-static-v1') {
    const source=readFileSync(join(folder,'source.twee'),'utf8');
    const metadata=read(join(folder,'import.metadata.json'));
    const compiled=compileTwee(source,metadata,{testFixture:Boolean(manifest.test_fixture)});
    if(canonical(compiled.story)!==canonical(read(join(folder,'story.json')))) throw new Error(`Twee story metadata drift: ${item.id}`);
    if(canonical(compiled.bundle)!==canonical(bundle)) throw new Error(`Twee node bundle drift: ${item.id}`);
    if(canonical(compiled.manifest)!==canonical(manifest)) throw new Error(`Twee manifest drift: ${item.id}`);
  }

  reports.push({
    id:story.id,
    version:story.version,
    nodes:story.report.nodes,
    edges:story.report.edges,
    endings:story.report.endings,
    complete_paths:completePaths.toString(),
    test_fixture:Boolean(story.test_fixture),
    import_profile:manifest.import_profile ?? manifest.format,
    status:'PASS',
  });
}

console.log(JSON.stringify({
  status:'PASS',
  stories:reports,
  totals:{
    stories:reports.length,
    nodes:reports.reduce((n,r)=>n+r.nodes,0),
    edges:reports.reduce((n,r)=>n+r.edges,0),
    endings:reports.reduce((n,r)=>n+r.endings,0),
  },
},null,2));
