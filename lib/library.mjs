import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256, validateGraph } from './graph.mjs';
import { isHTTPSURL, validateStoryMetadata } from './story-metadata.mjs';

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const read = path => JSON.parse(readFileSync(path, 'utf8'));

/** Server-only file loading: no network, arbitrary file names, or client bundle. */
export function loadLibrary(storyRoot = join(process.cwd(), 'stories'), { allowTestFixtures = false } = {}) {
  const catalog = read(join(storyRoot, 'catalog.json'));
  if (catalog.version !== 1 || !Array.isArray(catalog.stories) || !catalog.stories.length) {
    throw new Error('No complete imported stories. Run an approved importer before building.');
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

    validateStoryMetadata(story, item.id);

    if ((story.test_fixture || manifest.test_fixture) && !allowTestFixtures) {
      throw new Error('Synthetic fixtures cannot be served as an imported work');
    }
    if (bundle.schema_version !== 2 || bundle.story_id !== item.id) {
      throw new Error(`Story identity/schema mismatch: ${item.id}`);
    }
    if (!/^[0-9a-f]{16}$/.test(story.version ?? '') ||
        story.version !== item.version ||
        story.version !== bundle.version ||
        story.version !== manifest.version ||
        story.version !== sha256(bundle.nodes).slice(0, 16)) {
      throw new Error(`Story version mismatch: ${item.id}`);
    }
    if (manifest.bundle_sha256 !== sha256(bundle)) {
      throw new Error(`Story hash mismatch: ${item.id}`);
    }

    for (const url of [story.source_url, ...bundle.nodes.map(node => node.source?.url)]) {
      if (!isHTTPSURL(url)) throw new Error(`Invalid provenance URL: ${item.id}`);
    }

    const report = validateGraph(bundle, {
      entries: story.entries.map(entry => entry.id),
      inventoryIds: manifest.inventory_ids,
      expectedEndings: story.statistics.endings,
      endingIds: manifest.endings,
    });
    if (report.status !== 'PASS') throw new Error(report.errors.join('\n'));

    for (const key of ['nodes','edges','endings']) {
      if (story.statistics[key] !== report[key]) {
        throw new Error(`Story statistics mismatch for ${item.id}: ${key}`);
      }
    }

    const nodes = new Map(bundle.nodes.map(node => [node.id, node]));
    library.set(item.id, { ...story, nodes, report });
  }
  return library;
}
