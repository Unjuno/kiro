#!/usr/bin/env node
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  renameSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { compileTwee, TweeImportError } from '../lib/twee.mjs';

function usage(message = '') {
  if (message) console.error(message);
  console.error('Usage: node tools/import-twee.mjs --source work.twee --metadata rights.json [--story-root stories] [--check]');
  process.exit(message ? 2 : 0);
}
function args(argv) {
  const out = {storyRoot:'stories',check:false};
  for (let i=0;i<argv.length;i++) {
    const value=argv[i];
    if (value==='--check') out.check=true;
    else if (['--source','--metadata','--story-root'].includes(value)) {
      if (!argv[i+1] || argv[i+1].startsWith('--')) usage(`Missing value for ${value}`);
      out[value.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=argv[++i];
    } else if (value==='--help' || value==='-h') usage();
    else usage(`Unknown argument: ${value}`);
  }
  if (!out.source || !out.metadata) usage('Both --source and --metadata are required');
  return out;
}
const json = value => JSON.stringify(value,null,2)+'\n';
function readJSON(path) {
  try { return JSON.parse(readFileSync(path,'utf8')); }
  catch (error) { throw new Error(`Cannot read JSON ${path}: ${error.message}`); }
}
function summary(compiled) {
  return {
    status:'PASS',
    story_id:compiled.story.id,
    title:compiled.story.title,
    version:compiled.story.version,
    nodes:compiled.report.nodes,
    edges:compiled.report.edges,
    endings:compiled.report.endings,
    complete_paths:compiled.report.complete_paths,
    write:false,
  };
}
function attributionMarkdown(story) {
  return `# Attribution — ${story.title}\n\n${story.attribution}\n\n- Source: ${story.source_url}\n- Source language: ${story.language}\n- Rights basis: ${story.rights.original_work}\n- Rights evidence: ${story.rights.evidence_url}\n- Reviewed territories: ${story.rights.verified_territories.join(', ')}\n- Worldwide clearance: ${story.rights.worldwide_clearance}\n- Review: ${story.rights.reviewed_by} — ${story.rights.reviewed_at}\n\n${story.rights.note}\n`;
}

const options=args(process.argv.slice(2));
const sourcePath=resolve(options.source);
const metadataPath=resolve(options.metadata);
const storyRoot=resolve(options.storyRoot);
const source=readFileSync(sourcePath,'utf8');
const metadata=readJSON(metadataPath);
let compiled;
try {
  compiled=compileTwee(source,metadata,{testFixture:Boolean(metadata.test_fixture)});
} catch (error) {
  if (error instanceof TweeImportError) {
    console.error(`Twee import rejected: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
if (options.check) {
  console.log(json(summary(compiled)).trimEnd());
  process.exit(0);
}

mkdirSync(storyRoot,{recursive:true});
const lockPath=join(storyRoot,'.catalog.lock');
let lockFd;
try {
  lockFd=openSync(lockPath,'wx',0o600);
  writeFileSync(lockFd,`${JSON.stringify({pid:process.pid,created_at:new Date().toISOString()})}\n`);
} catch (error) {
  throw new Error(`Story catalog is locked. Inspect ${lockPath} before retrying: ${error.message}`);
}

let staging=null;
let finalFolder=null;
let committedFolder=false;
try {
  const catalogPath=join(storyRoot,'catalog.json');
  const catalog=existsSync(catalogPath)?readJSON(catalogPath):{version:1,stories:[]};
  if (catalog.version!==1 || !Array.isArray(catalog.stories)) throw new Error('Unsupported or invalid story catalog');
  if (catalog.stories.some(item=>item?.id===compiled.story.id)) {
    throw new Error(`Catalog already contains ${compiled.story.id}; importer is append-only`);
  }
  finalFolder=join(storyRoot,compiled.story.id);
  if (existsSync(finalFolder)) throw new Error(`Story directory already exists: ${finalFolder}`);

  staging=mkdtempSync(join(storyRoot,`.${compiled.story.id}.staging-`));
  writeFileSync(join(staging,'story.json'),json(compiled.story),'utf8');
  writeFileSync(join(staging,'nodes.json'),json(compiled.bundle),'utf8');
  writeFileSync(join(staging,'source.manifest.json'),json(compiled.manifest),'utf8');
  writeFileSync(join(staging,'validation.json'),json(compiled.report),'utf8');
  writeFileSync(join(staging,'source.twee'),source.endsWith('\n')?source:source+'\n','utf8');
  writeFileSync(join(staging,'import.metadata.json'),json(metadata),'utf8');
  writeFileSync(join(staging,'ATTRIBUTION.md'),attributionMarkdown(compiled.story),'utf8');

  renameSync(staging,finalFolder);
  staging=null;
  committedFolder=true;

  const nextCatalog={
    ...catalog,
    stories:[...catalog.stories,{id:compiled.story.id,version:compiled.story.version}],
  };
  const tempCatalog=join(storyRoot,`.catalog.next-${process.pid}`);
  writeFileSync(tempCatalog,json(nextCatalog),{encoding:'utf8',flag:'wx'});
  renameSync(tempCatalog,catalogPath);

  console.log(json({...summary(compiled),write:true,story_root:storyRoot}).trimEnd());
} catch (error) {
  if (staging && existsSync(staging)) rmSync(staging,{recursive:true,force:true});
  if (committedFolder && finalFolder && existsSync(finalFolder)) rmSync(finalFolder,{recursive:true,force:true});
  throw error;
} finally {
  if (lockFd!==undefined) closeSync(lockFd);
  try { unlinkSync(lockPath); } catch {}
}
