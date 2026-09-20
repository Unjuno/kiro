import { createHash } from 'node:crypto';

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
export const sha256 = value => createHash('sha256').update(canonical(value), 'utf8').digest('hex');

/** Independent graph validator; source parsing is deliberately not shared. */
export function validateGraph(bundle, options = {}) {
  const errors = [];
  const entries = options.entries ?? ['Helen', 'Jed', 'Saunders'];
  const nodes = bundle?.nodes;
  if (!Array.isArray(nodes) || !nodes.length) {
    return { status: 'FAIL', errors: ['No imported nodes'], nodes: 0, endings: 0 };
  }
  const index = new Map();
  for (const node of nodes) {
    if (!node || typeof node.id !== 'string' || !node.id) { errors.push('Invalid node id'); continue; }
    if (index.has(node.id)) errors.push(`Duplicate id: ${node.id}`);
    index.set(node.id, node);
    if (!['scene', 'ending'].includes(node.type)) errors.push(`Invalid node type: ${node.id}`);
    if (typeof node.text !== 'string' || !node.text.trim()) errors.push(`Missing prose: ${node.id}`);
    if (typeof node.decision_text !== 'string') errors.push(`Missing decision text: ${node.id}`);
    if (!Array.isArray(node.choices)) { errors.push(`Missing choices: ${node.id}`); continue; }
    if (node.type === 'ending' && node.choices.length) errors.push(`Ending with successors: ${node.id}`);
    if (node.type === 'scene' && !node.choices.length) errors.push(`Dead-end scene: ${node.id}`);
    const choiceIds = new Set();
    for (const choice of node.choices) {
      if (!choice || typeof choice.id !== 'string' || !choice.id || choiceIds.has(choice.id)) {
        errors.push(`Invalid/duplicate choice id: ${node.id}`);
      }
      choiceIds.add(choice?.id);
      if (typeof choice?.label !== 'string' || !choice.label.trim()) errors.push(`Empty choice: ${node.id}`);
      if (typeof choice?.next !== 'string' || !choice.next) errors.push(`Invalid target: ${node.id}`);
    }
  }
  if (errors.length) return { status: 'FAIL', errors, nodes: nodes.length, endings: 0 };
  if (options.inventoryIds) {
    const expected = [...options.inventoryIds].sort();
    if (JSON.stringify(expected) !== JSON.stringify([...index.keys()].sort())) {
      errors.push('Node set differs from independent source inventory');
    }
  }
  for (const entry of entries) if (!index.has(entry)) errors.push(`Missing entry: ${entry}`);
  const endings = nodes.filter(n => n.type === 'ending').map(n => n.id).sort();
  if (options.expectedEndings !== undefined && endings.length !== options.expectedEndings) {
    errors.push(`Expected ${options.expectedEndings} endings, found ${endings.length}`);
  }
  if (options.endingIds && JSON.stringify([...options.endingIds].sort()) !== JSON.stringify(endings)) {
    errors.push('Ending ids differ from source manifest');
  }
  const predecessors = new Map(nodes.map(n => [n.id, []]));
  let edgeCount = 0;
  for (const node of nodes) for (const choice of node.choices) {
    edgeCount++;
    if (!index.has(choice.next)) errors.push(`Missing target: ${node.id} -> ${choice.next}`);
    else predecessors.get(choice.next).push(node.id);
  }
  if (errors.length) return { status: 'FAIL', errors, nodes: nodes.length, edges: edgeCount, endings: endings.length };
  const witness = new Map(entries.map(id => [id, [id]]));
  const queue = [...entries];
  for (let pos = 0; pos < queue.length; pos++) {
    const id = queue[pos];
    for (const choice of index.get(id).choices) if (!witness.has(choice.next)) {
      witness.set(choice.next, [...witness.get(id), choice.next]);
      queue.push(choice.next);
    }
  }
  const unreachable = nodes.filter(n => !witness.has(n.id)).map(n => n.id);
  if (unreachable.length) errors.push(`Unreachable: ${unreachable.join(', ')}`);
  const canFinish = new Set(endings);
  const reverseQueue = [...endings];
  for (let pos = 0; pos < reverseQueue.length; pos++) {
    for (const id of predecessors.get(reverseQueue[pos])) if (!canFinish.has(id)) {
      canFinish.add(id); reverseQueue.push(id);
    }
  }
  const trapped = nodes.filter(n => !canFinish.has(n.id)).map(n => n.id);
  if (trapped.length) errors.push(`No route to an ending: ${trapped.join(', ')}`);
  return {
    status: errors.length ? 'FAIL' : 'PASS', errors,
    nodes: nodes.length, edges: edgeCount, endings: endings.length,
    reachable_nodes: witness.size, unreachable, trapped_nodes: trapped,
    ending_ids: endings,
    ending_witnesses: Object.fromEntries(endings.map(id => [id, witness.get(id) ?? []])),
  };
}
