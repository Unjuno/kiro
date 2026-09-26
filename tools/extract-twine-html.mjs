#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractTwineHTML, TwineHTMLExtractError } from '../lib/twine-html.mjs';

function usage(message='') {
  if (message) console.error(message);
  console.error('Usage: node tools/extract-twine-html.mjs --source game.html [--output extracted.twee] [--manifest-output extract.json] [--check]');
  process.exit(message ? 2 : 0);
}

function parse(argv) {
  const out={check:false};
  for(let i=0;i<argv.length;i++) {
    const arg=argv[i];
    if(arg==='--check') out.check=true;
    else if(['--source','--output','--manifest-output'].includes(arg)) {
      if(!argv[i+1] || argv[i+1].startsWith('--')) usage(`Missing value for ${arg}`);
      out[arg.slice(2).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=argv[++i];
    } else if(arg==='--help' || arg==='-h') usage();
    else usage(`Unknown argument: ${arg}`);
  }
  if(!out.source) usage('--source is required');
  if(!out.check && !out.output) usage('--output is required unless --check is used');
  return out;
}

const options=parse(process.argv.slice(2));
const sourcePath=resolve(options.source);
let html;
try { html=readFileSync(sourcePath,'utf8'); }
catch(error) { console.error(`Cannot read ${sourcePath}: ${error.message}`); process.exit(1); }

let result;
try { result=extractTwineHTML(html); }
catch(error) {
  if(error instanceof TwineHTMLExtractError) {
    console.error(`Twine HTML extraction rejected: ${error.message}`);
    process.exit(1);
  }
  throw error;
}

if(options.check) {
  console.log(JSON.stringify({...result.manifest,status:'PASS',write:false},null,2));
  process.exit(0);
}

const outputPath=resolve(options.output);
if(existsSync(outputPath)) {
  console.error(`Refusing to overwrite existing output: ${outputPath}`);
  process.exit(1);
}
const manifestPath=resolve(options.manifestOutput ?? `${options.output}.extract.json`);
if(existsSync(manifestPath)) {
  console.error(`Refusing to overwrite existing manifest: ${manifestPath}`);
  process.exit(1);
}

writeFileSync(outputPath,result.twee,{encoding:'utf8',flag:'wx'});
writeFileSync(manifestPath,JSON.stringify({...result.manifest,status:'PASS'},null,2)+'\n',{encoding:'utf8',flag:'wx'});
console.log(JSON.stringify({...result.manifest,status:'PASS',write:true,output:outputPath,manifest:manifestPath},null,2));
