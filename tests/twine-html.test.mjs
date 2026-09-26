import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { extractTwineHTML, TwineHTMLExtractError } from '../lib/twine-html.mjs';
import { compileTwee } from '../lib/twee.mjs';

const html = `<!doctype html>
<html><head><title>Fixture</title></head><body>
<tw-storydata name="HTML Glass Path" startnode="1" creator="Twine" creator-version="2.8.1"
  ifid="123E4567-E89B-42D3-A456-426614174001" format="Harlowe" format-version="3.3.9">
  <style role="stylesheet" id="twine-user-stylesheet"></style>
  <script role="script" id="twine-user-script"></script>
  <tw-passagedata pid="1" name="Start" tags="" position="100,100" size="100,100">At dusk, a corridor divides around a glass wall.

[[Red-&gt;Red Ending]]
[[Blue-&gt;Blue Ending]]</tw-passagedata>
  <tw-passagedata pid="2" name="Red Ending" tags="ending" position="300,100" size="100,100">The red room is warm &amp; bright.</tw-passagedata>
  <tw-passagedata pid="3" name="Blue Ending" tags="ending" position="500,100" size="100,100">The blue door opens onto cool air.</tw-passagedata>
</tw-storydata>
</body></html>`;

const metadata = {
  id:'html-fixture',
  title:'HTML Glass Path',
  import_profile:'kiro-twee3-static-v1',
  test_fixture:true,
  language:'en',
  authors:['KIRO synthetic fixture'],
  description:{en:'Synthetic Twine HTML extraction fixture.'},
  entry_label:'Begin',
  source_url:'https://example.invalid/html-fixture',
  source_label:'Synthetic fixture',
  attribution:'Synthetic test data only.',
  attribution_language:'en',
  rights:{
    original_work:'TEST-FIXTURE-ONLY',
    evidence_url:'https://example.invalid/html-fixture-rights',
    verified_territories:['TEST'],
    worldwide_clearance:'test-only',
    note:'Synthetic data for automated tests.',
    review_status:'reviewed',
    translation_permitted:true,
    distribution_permitted:true,
    reviewed_by:'KIRO test suite',
    reviewed_at:'2026-09-26',
  },
};

test('published Twine HTML extracts deterministically without executing script/style', () => {
  const a=extractTwineHTML(html);
  const b=extractTwineHTML(html);
  assert.deepEqual(a,b);
  assert.equal(a.manifest.story_title,'HTML Glass Path');
  assert.equal(a.manifest.story_format,'Harlowe');
  assert.equal(a.manifest.start_passage,'Start');
  assert.equal(a.manifest.passages,3);
  assert.match(a.twee,/:: StoryTitle\nHTML Glass Path/);
  assert.match(a.twee,/\[\[Red->Red Ending\]\]/);
  assert.doesNotMatch(a.twee,/twine-user-script|stylesheet/);

  const compiled=compileTwee(a.twee,metadata,{testFixture:true});
  assert.equal(compiled.report.status,'PASS');
  assert.equal(compiled.report.endings,2);
  assert.equal(compiled.report.complete_paths,'2');
});

test('HTML entities decode one serialization layer and passage layout is preserved', () => {
  const {twee}=extractTwineHTML(html);
  assert.match(twee,/The red room is warm & bright\./);
  assert.match(twee,/:: Start \{"position":"100,100","size":"100,100"\}/);
});

test('missing or duplicate storydata, duplicate passage ids, and bad startnode fail closed', () => {
  assert.throws(()=>extractTwineHTML('<html></html>'),TwineHTMLExtractError);
  assert.throws(()=>extractTwineHTML(html+html),/exactly one/);
  assert.throws(()=>extractTwineHTML(html.replace('pid="2"','pid="1"')),/Duplicate passage pid/);
  assert.throws(()=>extractTwineHTML(html.replace('startnode="1"','startnode="99"')),/missing pid 99/);
});

test('dynamic source is preserved so the downstream static compiler can reject it', () => {
  const dynamic=html.replace('At dusk,', '&lt;&lt;set $door to "red"&gt;&gt; At dusk,');
  const extracted=extractTwineHTML(dynamic);
  assert.match(extracted.twee,/<<set \$door/);
  assert.throws(()=>compileTwee(extracted.twee,metadata),/Macros, variables/);
});

test('CLI --check writes nothing, normal extraction refuses overwrite and writes manifest', () => {
  const dir=mkdtempSync(join(tmpdir(),'kiro-twine-html-'));
  const source=join(dir,'game.html');
  const output=join(dir,'game.twee');
  const manifest=join(dir,'extract.json');
  require('node:fs').writeFileSync(source,html,'utf8');

  const check=spawnSync(process.execPath,[
    'tools/extract-twine-html.mjs','--source',source,'--check'
  ],{cwd:process.cwd(),encoding:'utf8'});
  assert.equal(check.status,0,check.stderr);
  assert.match(check.stdout,/"status": "PASS"/);
  assert.throws(()=>readFileSync(output));

  const write=spawnSync(process.execPath,[
    'tools/extract-twine-html.mjs','--source',source,'--output',output,'--manifest-output',manifest
  ],{cwd:process.cwd(),encoding:'utf8'});
  assert.equal(write.status,0,write.stderr);
  assert.match(readFileSync(output,'utf8'),/:: Start/);
  assert.equal(JSON.parse(readFileSync(manifest,'utf8')).story_format,'Harlowe');

  const repeat=spawnSync(process.execPath,[
    'tools/extract-twine-html.mjs','--source',source,'--output',output,'--manifest-output',manifest
  ],{cwd:process.cwd(),encoding:'utf8'});
  assert.notEqual(repeat.status,0);
  assert.match(repeat.stderr,/Refusing to overwrite/);
});
