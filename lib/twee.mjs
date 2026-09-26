import { createHash } from 'node:crypto';
import { sha256, validateGraph } from './graph.mjs';
import { STORY_ID, isHTTPSURL, normalizeLanguage, validateStoryMetadata } from './story-metadata.mjs';

const MAX_BYTES = 2_000_000;
const MAX_PASSAGES = 500;
const MAX_COMPLETE_PATHS = 10_000n;
const RESERVED_SPECIAL = /^(?:Story[A-Z]|PassageHeader|PassageFooter|PassageReady|PassageDone)$/;
const DYNAMIC_SYNTAX = /<<|>>|\(\s*[A-Za-z][\w-]*\s*:|(?:\$|_)[A-Za-z][\w]*|<\/?[A-Za-z][^>]*>|\{\{|\}\}|\[\[[^\]]*\]\][^\s]*\{/u;

const bytesHash = value => createHash('sha256').update(value, 'utf8').digest('hex');
const nonempty = value => typeof value === 'string' && Boolean(value.trim());

export class TweeImportError extends Error {
  constructor(message, line = 0) {
    super(`${line ? `Line ${line}: ` : ''}${message}`);
    this.name = 'TweeImportError';
    this.line = line;
  }
}

const fail = (message,line = 0) => { throw new TweeImportError(message,line); };

function parseHeader(lineText,lineNumber) {
  const match = /^::\s*((?:\\.|[^\[\]{}\\])+?)(?:\s*\[([^\]]*)\])?\s*(\{.*\})?\s*$/.exec(lineText);
  if (!match) fail('Malformed or unsupported passage header',lineNumber);

  const name = match[1].trim().replace(/\\(.)/g,'$1');
  if (!name || name.length > 200 || /[\x00-\x1f]/.test(name)) fail('Invalid passage name',lineNumber);

  const tags = (match[2] ?? '').trim().split(/\s+/).filter(Boolean);
  if (tags.some(tag => tag !== 'ending')) {
    fail('Only the [ending] tag is supported in the static profile',lineNumber);
  }

  if (match[3]) {
    let layout;
    try { layout = JSON.parse(match[3]); } catch { fail('Invalid passage-header JSON',lineNumber); }
    if (!layout || Array.isArray(layout) ||
        Object.entries(layout).some(([key,value]) => !['position','size'].includes(key) || typeof value !== 'string')) {
      fail('Only position/size passage metadata is supported',lineNumber);
    }
  }
  return {name,tags,line:lineNumber,body:[]};
}

function rejectDynamic(text,line) {
  if (DYNAMIC_SYNTAX.test(text)) {
    fail('Macros, variables, HTML, hooks, setters, and embedded code are not supported',line);
  }
}

function parseLink(lineText,lineNumber) {
  const match = /^\[\[([^\[\]\n]+)\]\]$/.exec(lineText);
  if (!match) fail('Choice links must occupy a complete line at the end of a passage',lineNumber);

  const raw = match[1];
  const separators = [...raw.matchAll(/->|<-|\|/g)];
  if (separators.length > 1) fail('Ambiguous link syntax or link setter',lineNumber);

  let label = raw.trim();
  let target = label;
  if (separators.length === 1) {
    const separator = separators[0];
    const left = raw.slice(0,separator.index).trim();
    const right = raw.slice(separator.index + separator[0].length).trim();
    if (separator[0] === '<-') [label,target] = [right,left];
    else [label,target] = [left,right];
  }

  if (!label || !target) fail('Empty choice label or destination',lineNumber);
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target)) fail('External URLs are not story choices',lineNumber);
  rejectDynamic(label,lineNumber);
  rejectDynamic(target,lineNumber);
  return {label,next:target};
}

function parsePassages(source) {
  const lines = source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  const passages = [];
  let current = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (line.startsWith('::')) {
      if (passages.length >= MAX_PASSAGES) fail(`At most ${MAX_PASSAGES} passages are supported`,index + 1);
      current = parseHeader(line,index + 1);
      passages.push(current);
    } else if (current) {
      current.body.push(line);
    } else if (line.trim()) {
      fail('Text before the first passage is unsupported',index + 1);
    }
  }

  const names = new Set();
  for (const passage of passages) {
    if (names.has(passage.name)) fail(`Duplicate passage: ${passage.name}`,passage.line);
    names.add(passage.name);
    passage.rawText = passage.body.join('\n').trimEnd();
  }
  return passages;
}

function validateRights(metadata) {
  const rights = metadata?.rights;
  if (!rights ||
      rights.review_status !== 'reviewed' ||
      rights.translation_permitted !== true ||
      rights.distribution_permitted !== true ||
      !nonempty(rights.reviewed_by) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(rights.reviewed_at ?? '') ||
      !isHTTPSURL(rights.evidence_url)) {
    fail('Reviewed rights record with evidence, reviewer/date, and explicit translation/distribution permission is required');
  }
  if (!Array.isArray(rights.verified_territories) || !rights.verified_territories.length) {
    fail('At least one reviewed territory is required');
  }
}

function countFinitePaths(nodes,start,endings) {
  const index = new Map(nodes.map(node => [node.id,node]));
  const indegree = new Map(nodes.map(node => [node.id,0]));
  for (const node of nodes) {
    for (const choice of node.choices) indegree.set(choice.next,indegree.get(choice.next) + 1);
  }
  const queue = [...indegree].filter(([,degree]) => degree === 0).map(([id]) => id);
  for (let position = 0; position < queue.length; position++) {
    for (const choice of index.get(queue[position]).choices) {
      const next = indegree.get(choice.next) - 1;
      indegree.set(choice.next,next);
      if (next === 0) queue.push(choice.next);
    }
  }
  if (queue.length !== nodes.length) fail('Cyclic works are outside the static DAG import profile');

  const paths = new Map(nodes.map(node => [node.id,0n]));
  paths.set(start,1n);
  for (const id of queue) {
    for (const choice of index.get(id).choices) {
      const value = paths.get(choice.next) + paths.get(id);
      if (value > MAX_COMPLETE_PATHS) fail(`More than ${MAX_COMPLETE_PATHS} complete paths; exhaustive validation would be too large`);
      paths.set(choice.next,value);
    }
  }
  return endings.reduce((sum,id) => sum + paths.get(id),0n);
}

/** Pure conversion. Imported text is never executed and no files are written here. */
export function compileTwee(source,metadata,{testFixture = false} = {}) {
  if (typeof source !== 'string' || Buffer.byteLength(source,'utf8') > MAX_BYTES) {
    fail(`Source must be UTF-8 text no larger than ${MAX_BYTES} bytes`);
  }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(source)) fail('Unsupported control characters');
  if (!metadata || !STORY_ID.test(metadata.id ?? '')) fail('Valid metadata.id is required');
  if (metadata.import_profile !== 'kiro-twee3-static-v1') {
    fail('Declare import_profile: kiro-twee3-static-v1 explicitly');
  }
  if (!isHTTPSURL(metadata.source_url)) fail('HTTPS source_url is required');
  if (!normalizeLanguage(metadata.language)) fail('Canonical source language is required');
  validateRights(metadata);

  const passages = parsePassages(source);
  const titlePassage = passages.find(passage => passage.name === 'StoryTitle');
  if (!titlePassage || titlePassage.tags.length || !nonempty(titlePassage.rawText) || titlePassage.rawText.includes('\n')) {
    fail('One plain single-line StoryTitle passage is required');
  }
  const title = titlePassage.rawText.trim();
  if (metadata.title !== undefined && metadata.title !== title) fail('Metadata title does not match StoryTitle');

  const dataPassage = passages.find(passage => passage.name === 'StoryData');
  let storyData = {};
  if (dataPassage) {
    if (dataPassage.tags.length) fail('StoryData may not carry tags',dataPassage.line);
    try { storyData = JSON.parse(dataPassage.rawText); } catch { fail('Invalid StoryData JSON',dataPassage.line); }
    const allowed = new Set(['ifid','format','format-version','start','tag-colors','zoom']);
    if (!storyData || Array.isArray(storyData) || Object.keys(storyData).some(key => !allowed.has(key))) {
      fail('Unsupported StoryData field',dataPassage.line);
    }
    if (storyData.ifid !== undefined &&
        (!nonempty(storyData.ifid) || !/^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/.test(storyData.ifid))) {
      fail('StoryData.ifid must be an uppercase v4 UUID',dataPassage.line);
    }
    if (storyData.start !== undefined && !nonempty(storyData.start)) fail('Invalid StoryData.start',dataPassage.line);
  }

  if (metadata.start && storyData.start && metadata.start !== storyData.start) fail('Conflicting start declarations');
  const start = metadata.start ?? storyData.start ?? 'Start';
  if (!nonempty(start)) fail('Invalid start passage');

  const playable = passages.filter(passage => !['StoryTitle','StoryData'].includes(passage.name));
  if (!playable.length) fail('No playable passages');
  for (const passage of playable) {
    if (RESERVED_SPECIAL.test(passage.name)) fail(`Unsupported special passage: ${passage.name}`,passage.line);
  }

  const declaredEndings = new Set(metadata.ending_passages ?? []);
  if (metadata.ending_passages !== undefined &&
      (!Array.isArray(metadata.ending_passages) || !metadata.ending_passages.every(nonempty))) {
    fail('ending_passages must be an array of passage names');
  }
  for (const ending of declaredEndings) {
    if (!playable.some(passage => passage.name === ending)) fail(`Unknown declared ending: ${ending}`);
  }

  const sourceHash = bytesHash(source);
  const nodes = [];
  for (const passage of playable) {
    const prose = [];
    const choices = [];
    let choicesStarted = false;

    for (let offset = 0; offset < passage.body.length; offset++) {
      const raw = passage.body[offset];
      const trimmed = raw.trim();
      const lineNumber = passage.line + offset + 1;
      if (trimmed.startsWith('[[')) {
        choicesStarted = true;
        const parsed = parseLink(trimmed,lineNumber);
        choices.push({id:`choice-${choices.length + 1}`,...parsed});
      } else if (trimmed) {
        if (choicesStarted) fail('Prose after the choice block is unsupported',lineNumber);
        rejectDynamic(raw,lineNumber);
        prose.push(raw);
      } else if (!choicesStarted) {
        prose.push('');
      }
    }

    const ending = passage.tags.includes('ending') || declaredEndings.has(passage.name);
    if (ending && choices.length) fail(`Ending ${passage.name} has outgoing choices`,passage.line);
    if (!ending && !choices.length) fail(`Dead-end ${passage.name} must be explicitly declared as an ending`,passage.line);

    const narration = prose.join('\n').trim();
    if (!narration) fail(`Empty narration: ${passage.name}`,passage.line);

    nodes.push({
      id:passage.name,
      type:ending ? 'ending' : 'scene',
      text:narration,
      decision_text:'',
      choices,
      source:{
        kind:'twee3-static-v1',
        title:passage.name,
        url:metadata.source_url,
        permalink:metadata.source_url,
        file_sha256:sourceHash,
        passage_sha256:bytesHash(passage.rawText),
        line:passage.line,
      },
    });
  }

  const endings = nodes.filter(node => node.type === 'ending').map(node => node.id).sort();
  if (endings.length < 2) fail('A branching work requires at least two explicit endings');

  const report = validateGraph({nodes},{
    entries:[start],
    inventoryIds:playable.map(passage => passage.name),
    endingIds:endings,
    expectedEndings:endings.length,
  });
  if (report.status !== 'PASS') fail(report.errors.join('; '));

  const completePaths = countFinitePaths(nodes,start,endings);
  const version = sha256(nodes).slice(0,16);
  const bundle = {schema_version:2,story_id:metadata.id,version,nodes};
  const story = {
    schema_version:2,
    id:metadata.id,
    version,
    test_fixture:Boolean(testFixture || metadata.test_fixture),
    title,
    language:normalizeLanguage(metadata.language),
    authors:metadata.authors,
    description:metadata.description,
    entries:[{id:start,label:metadata.entry_label ?? start}],
    source_url:metadata.source_url,
    source_label:metadata.source_label ?? new URL(metadata.source_url).hostname,
    attribution:metadata.attribution,
    attribution_language:metadata.attribution_language ?? metadata.language,
    rights:metadata.rights,
    localization:{mode:'agent-runtime',use_session_language:true,preserve_original_names:true},
    content_notice:metadata.content_notice ?? '',
    statistics:{nodes:nodes.length,edges:report.edges,endings:endings.length},
  };
  if (metadata.year !== undefined) story.year = metadata.year;
  validateStoryMetadata(story);

  const manifest = {
    format:'kiro-twee3-static-manifest-v1',
    version,
    test_fixture:Boolean(testFixture || metadata.test_fixture),
    capture_sha256:sourceHash,
    bundle_sha256:sha256(bundle),
    inventory_ids:playable.map(passage => passage.name).sort(),
    endings,
    import_profile:'kiro-twee3-static-v1',
    metadata_sha256:sha256(metadata),
  };

  return {
    story,
    bundle,
    manifest,
    report:{...report,acyclic:true,complete_paths:completePaths.toString()},
    source,
  };
}
