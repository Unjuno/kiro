import test from 'node:test';
import assert from 'node:assert/strict';
import { loadLibrary } from '../lib/library.mjs';
import { renderAgentRequest } from '../lib/agent.mjs';
import { GET } from '../app/route.js';

const library = loadLibrary();
const story = library.get('consider-the-consequences');
const json = url => {
  const result = renderAgentRequest(url, library);
  return { result, body: JSON.parse(result.body) };
};
const sceneURL = node =>
  `/?lang=ja&story=${story.id}&node=${encodeURIComponent(node)}&v=${story.version}&format=json`;

test('JSON entry asks for language before exposing story metadata', () => {
  for (const url of [
    '/?format=json',
    `/?story=${story.id}&node=Helen&v=${story.version}&format=json`,
  ]) {
    const {result,body} = json(url);
    assert.equal(result.status, 200);
    assert.equal(body.stage, 'language');
    assert.equal(body.player_language, null);
    assert.ok(!body.story && !body.stories && !body.scene && !body.attribution);
    assert.equal(body.links.length, 8);
  }
});

test('selected language opens catalog and preserves agent representation', () => {
  const {body} = json('/?lang=ja&format=json');
  assert.equal(body.stage, 'catalog');
  assert.equal(body.stories.length, library.size);
  assert.equal(body.stories[0].source_language, 'en');
  assert.match(body.stories[0].url, /format=json/);
});

test('story introduction contains attribution and entry links but no future prose', () => {
  const {body} = json(`/?lang=ja&story=${story.id}&v=${story.version}&format=json`);
  assert.equal(body.stage, 'story');
  assert.match(body.attribution.text, /Doris Webster/);
  assert.deepEqual(body.links.map(link => link.id), story.entries.map(entry => entry.id));
  assert.ok(!body.scene);
});

test('scene exposes exactly the current scene and immediate choices', () => {
  const node = story.nodes.get('Helen');
  const {body} = json(sceneURL('Helen'));
  assert.equal(body.stage, 'scene');
  assert.equal(body.scene.id, node.id);
  assert.equal(body.scene.narration, node.text);
  assert.equal(body.scene.decision_text, node.decision_text);
  assert.deepEqual(body.links.map(link => link.id), node.choices.map(choice => choice.id));
  assert.ok(!('nodes' in body) && !('endings' in body));
  for (const link of body.links) {
    const parsed = new URL(link.url, 'https://kiro.invalid');
    assert.equal(parsed.searchParams.get('format'), 'json');
    assert.equal(parsed.searchParams.get('lang'), 'ja');
    assert.equal(parsed.searchParams.get('v'), story.version);
  }
});

test('all real scenes return only their own prose and immediate edges', () => {
  for (const node of story.nodes.values()) {
    const {body} = json(sceneURL(node.id));
    assert.equal(body.scene.narration, node.text);
    assert.equal(body.links.length, node.choices.length);
    if (node.type === 'ending') {
      assert.equal(body.stage, 'ending');
      assert.deepEqual(body.links, []);
    }
  }
});

test('language change preserves story position and version', () => {
  const {body} = json(sceneURL('H-13'));
  const change = body.navigation.find(link => link.id === 'language');
  const gate = json(change.url).body;
  assert.equal(gate.stage, 'language');
  const english = json(gate.links.find(link => link.id === 'en').url).body;
  assert.equal(english.scene.id, 'H-13');
  assert.equal(english.story.version, story.version);
});

test('bad node is 404 and stale version is 409 without fabricated scene', () => {
  const missing = json(sceneURL('does-not-exist'));
  assert.equal(missing.result.status, 404);
  assert.equal(missing.body.stage, 'error');
  assert.ok(!missing.body.scene);

  const stale = json(sceneURL('Helen').replace(story.version, '0000000000000000'));
  assert.equal(stale.result.status, 409);
  assert.equal(stale.body.error.code, 'STORY_VERSION_MISMATCH');
  assert.ok(!stale.body.scene);
});

test('actual Next.js route returns JSON only when format=json', async () => {
  const jsonResponse = GET(new Request('https://kiro.invalid' + sceneURL('Helen')));
  assert.equal(jsonResponse.status, 200);
  assert.match(jsonResponse.headers.get('content-type'), /application\/json/);
  assert.equal((await jsonResponse.json()).scene.id, 'Helen');

  const htmlResponse = GET(new Request('https://kiro.invalid/?lang=ja'));
  assert.equal(htmlResponse.status, 200);
  assert.match(htmlResponse.headers.get('content-type'), /text\/html/);
});
