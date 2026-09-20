import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, validateGraph } from './graph.mjs';

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const read = path => JSON.parse(readFileSync(path, 'utf8'));

/** Server-only file loading: no network, arbitrary file names, or client bundle. */
export function loadLibrary(storyRoot = join(process.cwd(), 'stories'), { allowTestFixtures = false } = {}) {
  const catalog = read(join(storyRoot, 'catalog.json'));
  if (!Array.isArray(catalog.stories) || !catalog.stories.length) {
    throw new Error('No complete imported stories. Run the importer before building.');
  }
  const library = new Map();
  for (const item of catalog.stories) {
    if (!item || typeof item.id !== 'string' || !ID.test(item.id) || library.has(item.id)) {
      throw new Error('Invalid or duplicate catalog entry');
    }
    const folder = join(storyRoot, item.id);
    const story = read(join(folder, 'story.json'));
    const bundle = read(join(folder, 'nodes.json'));
    const manifest = read(join(folder, 'source.manifest.json'));
    if ((story.test_fixture || manifest.test_fixture) && !allowTestFixtures) {
      throw new Error('Synthetic fixtures cannot be served as an imported work');
    }
    if (story.schema_version !== 2 || bundle.schema_version !== 2 || story.id !== item.id || bundle.story_id !== item.id) {
      throw new Error(`Story identity/schema mismatch: ${item.id}`);
    }
    if (!/^[0-9a-f]{16}$/.test(story.version ?? '') || story.version !== item.version ||
        story.version !== bundle.version || story.version !== manifest.version ||
        story.version !== sha256(bundle.nodes).slice(0, 16)) {
      throw new Error(`Story version mismatch: ${item.id}`);
    }
    if (manifest.bundle_sha256 !== sha256(bundle)) throw new Error(`Story hash mismatch: ${item.id}`);
    if (!Array.isArray(story.entries) || !story.entries.length || !story.attribution || !story.source_url || !story.language) {
      throw new Error(`Missing source/entry metadata: ${item.id}`);
    }
    for (const url of [story.source_url, ...bundle.nodes.map(n => n.source?.url)]) {
      let valid = false;
      try { const parsed = new URL(url); valid = typeof url === 'string' && parsed.protocol === 'https:' && !parsed.username && !parsed.password; } catch {}
      if (!valid) {
        throw new Error(`Invalid provenance URL: ${item.id}`);
      }
    }
    const report = validateGraph(bundle, {
      entries: story.entries.map(entry => entry.id),
      inventoryIds: manifest.inventory_ids,
      expectedEndings: story.statistics.endings,
      endingIds: manifest.endings,
    });
    if (report.status !== 'PASS') throw new Error(report.errors.join('\n'));
    const nodes = new Map(bundle.nodes.map(node => [node.id, node]));
    library.set(item.id, { ...story, nodes, report });
  }
  return library;
}
