import 'server-only';
import metadata from '../stories/consider-the-consequences/story.json';
import graph from '../stories/consider-the-consequences/graph.json';
import report from '../reports/consider-validation.json';

if (report.status !== 'PASS' || report.endings !== 43) throw new Error('Unverified story artifact');

const work = {
  ...metadata,
  version: report.graph_sha256.slice(0, 16),
  endingCount: report.endings,
  nodeCount: report.nodes,
  description: {
    en: 'Three connected lives. Decisions about love, family, work, and money lead to 43 different endings.',
    ja: '恋愛、家族、仕事、お金。3人の人生をたどり、選択によって43の結末へ分岐する物語です。'
  }
};
export const STORIES = { [metadata.id]: work };
export function getStory(id) { return Object.hasOwn(STORIES, id) ? STORIES[id] : null; }
export function getScene(storyId, node) {
  if (storyId !== graph.id || !Object.hasOwn(graph.nodes, node)) return null;
  return graph.nodes[node];
}
export function storyDescription(story, lang) {
  return /^ja(?:-|$)/i.test(lang) ? story.description.ja : story.description.en;
}
