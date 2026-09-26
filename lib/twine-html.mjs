import { createHash } from 'node:crypto';

const MAX_BYTES = 8_000_000;
const BASIC_ENTITIES = {
  amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:'\u00a0',
};

export class TwineHTMLExtractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TwineHTMLExtractError';
  }
}

const fail = message => { throw new TwineHTMLExtractError(message); };
const sha256Text = value => createHash('sha256').update(value,'utf8').digest('hex');

function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi,(_,hex)=>String.fromCodePoint(parseInt(hex,16)))
    .replace(/&#([0-9]+);/g,(_,num)=>String.fromCodePoint(parseInt(num,10)))
    .replace(/&([a-z]+);/gi,(all,name)=>BASIC_ENTITIES[name.toLowerCase()] ?? all);
}

function parseAttributes(raw) {
  const attrs = new Map();
  const attrRe = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
  for (const match of raw.matchAll(attrRe)) {
    const key = match[1].toLowerCase();
    if (attrs.has(key)) fail(`Duplicate attribute: ${key}`);
    attrs.set(key,decodeEntities(match[2] ?? match[3] ?? match[4] ?? ''));
  }
  return attrs;
}

function oneTag(html,tag) {
  const re = new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)<\\/${tag}>`,'gi');
  const matches=[...html.matchAll(re)];
  if (matches.length !== 1) fail(`Expected exactly one <${tag}> element; found ${matches.length}`);
  return {attrs:parseAttributes(matches[0][1]),inner:matches[0][2]};
}

function escapeHeaderName(name) {
  return name.replace(/[\\\[\]{}]/g,character=>`\\${character}`);
}

function passageHeader(name,tags,position,size) {
  const tagPart = tags.length ? ` [${tags.join(' ')}]` : '';
  const meta = {};
  if (position) meta.position=position;
  if (size) meta.size=size;
  const metaPart = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `:: ${escapeHeaderName(name)}${tagPart}${metaPart}`;
}

function storyDataJSON(storyAttrs,startName) {
  const data={};
  if (storyAttrs.get('ifid')) data.ifid=storyAttrs.get('ifid');
  if (storyAttrs.get('format')) data.format=storyAttrs.get('format');
  if (storyAttrs.get('format-version')) data['format-version']=storyAttrs.get('format-version');
  data.start=startName;
  return data;
}

/**
 * Extract source passages from a published Twine HTML file without executing it.
 * The result remains source text and must still pass KIRO's static Twee compiler.
 */
export function extractTwineHTML(html) {
  if (typeof html !== 'string' || !html.trim()) fail('Twine HTML must be non-empty UTF-8 text');
  if (Buffer.byteLength(html,'utf8') > MAX_BYTES) fail(`Twine HTML exceeds ${MAX_BYTES} bytes`);

  const storyElement=oneTag(html,'tw-storydata');
  const storyAttrs=storyElement.attrs;
  const title=storyAttrs.get('name');
  if (!title?.trim()) fail('tw-storydata is missing a story name');
  const startPid=storyAttrs.get('startnode');
  if (!startPid || !/^\d+$/.test(startPid)) fail('tw-storydata.startnode must be a numeric passage id');

  const passageRe=/<tw-passagedata\b([^>]*)>([\s\S]*?)<\/tw-passagedata>/gi;
  const passages=[];
  const pids=new Map();
  const names=new Set();

  for (const match of storyElement.inner.matchAll(passageRe)) {
    const attrs=parseAttributes(match[1]);
    const pid=attrs.get('pid');
    const name=attrs.get('name');
    if (!pid || !/^\d+$/.test(pid)) fail('Every tw-passagedata requires a numeric pid');
    if (!name?.trim()) fail(`Passage ${pid} is missing a name`);
    if (pids.has(pid)) fail(`Duplicate passage pid: ${pid}`);
    if (names.has(name)) fail(`Duplicate passage name: ${name}`);

    const tags=(attrs.get('tags') ?? '').trim().split(/\s+/).filter(Boolean);
    const text=decodeEntities(match[2]).replace(/\r\n?/g,'\n');

    const passage={
      pid,
      name,
      tags,
      position:attrs.get('position') ?? '',
      size:attrs.get('size') ?? '',
      text,
    };
    passages.push(passage);
    pids.set(pid,passage);
    names.add(name);
  }

  if (!passages.length) fail('No tw-passagedata passages were found');
  const start=pids.get(startPid);
  if (!start) fail(`startnode references missing pid ${startPid}`);

  const sections=[
    ':: StoryTitle',
    title.trim(),
    '',
    ':: StoryData',
    JSON.stringify(storyDataJSON(storyAttrs,start.name)),
  ];

  for (const passage of passages) {
    sections.push(
      '',
      passageHeader(passage.name,passage.tags,passage.position,passage.size),
      passage.text,
    );
  }

  const twee=sections.join('\n').replace(/\n+$/,'')+'\n';
  const manifest={
    format:'kiro-twine-html-extract-v1',
    source_sha256:sha256Text(html),
    extracted_twee_sha256:sha256Text(twee),
    story_title:title.trim(),
    ifid:storyAttrs.get('ifid') ?? null,
    story_format:storyAttrs.get('format') ?? null,
    story_format_version:storyAttrs.get('format-version') ?? null,
    start_pid:startPid,
    start_passage:start.name,
    passages:passages.length,
  };

  return {twee,manifest};
}
