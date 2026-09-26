import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileTwee, TweeImportError } from '../lib/twee.mjs';
import { loadLibrary } from '../lib/library.mjs';

const sourcePath = new URL('./fixtures/static-twee/guide.twee', import.meta.url);
const metadataPath = new URL('./fixtures/static-twee/guide.metadata.json', import.meta.url);
const source = readFileSync(sourcePath,'utf8');
const metadata = JSON.parse(readFileSync(metadataPath,'utf8'));

test('static Twee fixture compiles deterministically into two explicit endings', () => {
  const first=compileTwee(source,metadata,{testFixture:true});
  const second=compileTwee(source,metadata,{testFixture:true});
  assert.deepEqual(first,second);
  assert.equal(first.report.status,'PASS');
  assert.equal(first.report.nodes,3);
  assert.equal(first.report.edges,2);
  assert.equal(first.report.endings,2);
  assert.equal(first.report.complete_paths,'2');
  assert.equal(first.story.test_fixture,true);
  assert.equal(first.bundle.nodes.find(node=>node.id==='Start').choices[0].next,'Red Ending');
});

test('rights review is mandatory and not inferred from attribution', () => {
  const bad=structuredClone(metadata);
  bad.rights.review_status='unreviewed';
  bad.rights.translation_permitted=false;
  assert.throws(()=>compileTwee(source,bad),TweeImportError);
});

test('dead ends are never silently converted into endings', () => {
  const bad=source.replace(':: Blue Ending [ending]',':: Blue Ending');
  assert.throws(()=>compileTwee(bad,metadata),/explicitly declared as an ending/);
});

test('macros, variables, HTML and inline choice links fail closed', () => {
  for (const injected of [
    source.replace('At dusk,', '<<set $door to "red">> At dusk,'),
    source.replace('At dusk,', '<script>alert(1)</script> At dusk,'),
    source.replace('At dusk,', 'At dusk, choose [[Blue Ending]] before'),
  ]) assert.throws(()=>compileTwee(injected,metadata),TweeImportError);
});

test('broken targets and cycles are rejected', () => {
  const broken=source.replace('[[Open the blue door->Blue Ending]]','[[Open the blue door->Missing]]');
  assert.throws(()=>compileTwee(broken,metadata),/Missing target/);

  const cyclic=source.replace(
    ':: Red Ending [ending]\nThe red room is warm and bright. You decide that certainty was the thing you wanted tonight.',
    ':: Red Ending\nThe red room is warm and bright.\n\n[[Return->Start]]'
  );
  assert.throws(()=>compileTwee(cyclic,metadata),/Cyclic works/);
});

test('--check validates without creating a story root', () => {
  const root=join(mkdtempSync(join(tmpdir(),'kiro-check-')),'library-does-not-exist');
  const run=spawnSync(process.execPath,[
    'tools/import-twee.mjs','--source',sourcePath.pathname,'--metadata',metadataPath.pathname,
    '--story-root',root,'--check',
  ],{cwd:process.cwd(),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr);
  assert.match(run.stdout,/"status": "PASS"/);
  assert.throws(()=>readFileSync(join(root,'catalog.json')));
});

test('append-only importer writes a reproducible test library and refuses overwrite', () => {
  const root=mkdtempSync(join(tmpdir(),'kiro-twee-library-'));
  writeFileSync(join(root,'catalog.json'),JSON.stringify({version:1,stories:[]},null,2)+'\n');

  const command=[
    'tools/import-twee.mjs','--source',sourcePath.pathname,'--metadata',metadataPath.pathname,
    '--story-root',root,
  ];
  const first=spawnSync(process.execPath,command,{cwd:process.cwd(),encoding:'utf8'});
  assert.equal(first.status,0,first.stderr);
  const catalog=JSON.parse(readFileSync(join(root,'catalog.json'),'utf8'));
  assert.equal(catalog.stories.length,1);
  assert.equal(catalog.stories[0].id,'protocol-fixture');

  assert.throws(()=>loadLibrary(root),/Synthetic fixtures/);
  const library=loadLibrary(root,{allowTestFixtures:true});
  assert.equal(library.get('protocol-fixture').report.endings,2);

  const verify=spawnSync(process.execPath,[
    'tools/verify-library.mjs','--story-root',root,'--allow-test-fixtures',
  ],{cwd:process.cwd(),encoding:'utf8'});
  assert.equal(verify.status,0,verify.stderr);
  assert.match(verify.stdout,/"complete_paths": "2"/);

  const second=spawnSync(process.execPath,command,{cwd:process.cwd(),encoding:'utf8'});
  assert.notEqual(second.status,0);
  assert.match(second.stderr,/append-only|already contains|already exists/i);
});
