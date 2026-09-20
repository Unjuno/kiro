#!/usr/bin/env python3
"""One-time, fail-closed Wikisource import. Python 3.11+, standard library only.
Network is used ONLY with --fetch. --verify works entirely from committed snapshots.
"""
import argparse
import hashlib
import json
import re
import time
from collections import deque
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlencode, unquote, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'stories/consider-the-consequences'
API = 'https://en.wikisource.org/w/api.php'
WORK = 'Consider the Consequences!'
STARTS = ['Helen', 'Jed', 'Saunders']
NODE = re.compile(r'(?:Helen|Jed|Saunders|[HJS]-[1-9][0-9]*)\Z')
REF = re.compile(r'\b([HJS])[-.](\d+)\b')
VOID = {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
DROP = {'script','style','table','figure','sup'}
DROP_CLASS = {'pagenum','mw-editsection','noprint','ws-noexport','wst-header','ws-no-print'}


def clean(text):
    return re.sub(r'\s+', ' ', re.sub(r'[\u200b-\u200d\ufeff]', '', text)).strip()


class Element:
    def __init__(self, tag='root', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Element):
                yield from child.walk()

    def text(self):
        if self.tag in DROP or set(self.attrs.get('class', '').split()) & DROP_CLASS:
            return ''
        return ''.join(c.text() if isinstance(c, Element) else c for c in self.children)


class DOM(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Element()
        self.stack = [self.root]
        self.feed(html)
        self.close()

    def handle_starttag(self, tag, attrs):
        el = Element(tag, attrs)
        self.stack[-1].children.append(el)
        if tag == 'br':
            el.children.append(' ')
        if tag not in VOID:
            self.stack.append(el)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                del self.stack[i:]
                return

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def request(params):
    url = API + '?' + urlencode({'format':'json', 'formatversion':2, 'maxlag':5, **params})
    for attempt in range(4):
        try:
            req = Request(url, headers={'User-Agent':'KIRO-story-import/1.0 (https://github.com/Unjuno/kiro; one-time archival import)'})
            with urlopen(req, timeout=45) as res:
                data = json.load(res)
            if 'error' in data:
                raise RuntimeError(str(data['error']))
            return data
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError('Unreachable')


def target_of(a):
    if a.tag != 'a':
        return None
    label = clean(a.text())
    if not re.fullmatch(r'[HJS][- .]\d+', label):
        return None
    target = re.sub(r'[- .]', '-', label)
    href = unquote(a.attrs.get('href', '')).replace('_', ' ')
    path = urlparse(href).path
    if not path.endswith('/' + WORK + '/' + target):
        raise ValueError(f'Link label/href disagreement: {label}: {href}')
    return target


def parse_scene(node, record):
    dom = DOM(record['html'])
    roots = [e for e in dom.root.walk() if 'prp-pages-output' in e.attrs.get('class','').split()]
    if not roots:
        raise ValueError(f'{node}: no proofread page container; refusing fallback parser')
    paragraphs, decision, choices, seen = [], [], [], set()
    all_links = []
    for root in roots:
        all_links += [target_of(e) for e in root.walk() if target_of(e)]
        for p in root.walk():
            if p.tag != 'p':
                continue
            text = clean(p.text())
            if not text:
                continue
            anchors = [target_of(a) for a in p.walk() if target_of(a)]
            if not anchors:
                paragraphs.append(text)
                continue
            decision.append(text)
            # Keep the complete original decision paragraph; these labels are presentation only.
            previous_end = 0
            matches = list(REF.finditer(text))
            for match in matches:
                target = f'{match[1]}-{int(match[2])}'
                if target not in anchors:
                    raise ValueError(f'{node}: unlinked target {target}')
                clause = text[previous_end:match.start()].strip(' .;:,')
                previous_end = match.end()
                label = re.sub(r'\s+(?:turns?|goes?|go)\s+to\s+(?:paragraphs?\s*)?$', '', clause, flags=re.I).strip()
                label = re.sub(r'^(?:while\s+)?(?:the\s+reader|the\s+one|he|one)\s+who\s+', '', label, flags=re.I)
                if not label:
                    raise ValueError(f'{node}: empty condition for {target}')
                if target in seen:
                    raise ValueError(f'{node}: duplicate target {target}')
                seen.add(target)
                choices.append({'id':f'choice-{len(choices)+1}', 'label':label, 'next':target})
    if set(all_links) != seen:
        raise ValueError(f'{node}: links outside parsed decision paragraphs: {set(all_links)-seen}')
    text = '\n\n'.join(paragraphs)
    if len(text) < 80:
        raise ValueError(f'{node}: implausibly short body ({len(text)})')
    # Missing links must NEVER silently turn a decision into an ending.
    if REF.search(text) or re.search(r'\bturns?\s+to\s+paragraph', text, re.I):
        raise ValueError(f'{node}: unresolved navigation in body')
    if len(choices) == 1:
        raise ValueError(f'{node}: only one extracted option; review required')
    return {'id':node, 'type':'scene' if choices else 'ending', 'text':text,
            'decision_text':'\n\n'.join(decision), 'choices':choices,
            'source':{'url':record['url'], 'revision':record['revision'],
                      'html_sha256':record['html_sha256']}}


def write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def discover():
    pages, cursor = [], {}
    while True:
        data = request({'action':'query', 'list':'allpages', 'apprefix':WORK+'/', 'aplimit':500, **cursor})
        pages += data['query']['allpages']
        if 'continue' not in data:
            break
        cursor = data['continue']
    selected = [p for p in pages if NODE.fullmatch(p['title'].split('/')[-1])]
    ignored = [p['title'] for p in pages if not NODE.fullmatch(p['title'].split('/')[-1])]
    if not set(STARTS).issubset({p['title'].split('/')[-1] for p in selected}):
        raise ValueError('Missing starting sections')
    return selected, ignored


def fetch_sources():
    pages, ignored = discover()
    stamp = datetime.now(timezone.utc).isoformat()
    print(f'Discovered {len(pages)} story nodes; other subpages: {ignored}', flush=True)
    manifest = {'retrieved_at':stamp, 'source':API, 'pages':[], 'ignored_subpages':ignored}
    for i, page in enumerate(pages):
        node = page['title'].split('/')[-1]
        data = request({'action':'parse', 'page':page['title'], 'prop':'text|revid'})['parse']
        html = data['text']
        record = {'title':page['title'], 'revision':data['revid'],
                  'url':'https://en.wikisource.org/wiki/'+page['title'].replace(' ','_'),
                  'html_sha256':hashlib.sha256(html.encode()).hexdigest(), 'html':html}
        write(DEST/'source'/f'{node}.json', record)
        manifest['pages'].append({k:v for k,v in record.items() if k != 'html'})
        print(f'{i+1}/{len(pages)} captured {node} revision {data["revid"]}', flush=True)
        time.sleep(0.25)
    write(DEST/'source-manifest.json', manifest)


def verify_and_compile():
    manifest = json.loads((DEST/'source-manifest.json').read_text())
    nodes = {}
    for page in manifest['pages']:
        node = page['title'].split('/')[-1]
        record = json.loads((DEST/'source'/f'{node}.json').read_text())
        if hashlib.sha256(record['html'].encode()).hexdigest() != page['html_sha256']:
            raise ValueError(f'{node}: source hash mismatch')
        if record['revision'] != page['revision']:
            raise ValueError(f'{node}: revision mismatch')
        nodes[node] = parse_scene(node, record)
    for node in nodes.values():
        for choice in node['choices']:
            if choice['next'] not in nodes:
                raise ValueError(f'Dangling edge: {node["id"]} -> {choice["next"]}')
    paths, per_root = {}, {}
    for start in STARTS:
        queue, reached = deque([(start, [start])]), set()
        while queue:
            here, path = queue.popleft()
            if here in reached:
                continue
            reached.add(here)
            paths.setdefault(here, path)
            queue.extend((c['next'], path+[c['next']]) for c in nodes[here]['choices'])
        per_root[start] = {'nodes':len(reached), 'endings':sorted(n for n in reached if nodes[n]['type']=='ending')}
    unreachable = sorted(set(nodes)-set(paths))
    if unreachable:
        raise ValueError(f'Unreachable nodes: {unreachable}')
    active, done = set(), set()
    def visit(here):
        if here in active:
            raise ValueError(f'Cycle through {here}')
        if here in done:
            return
        active.add(here)
        for choice in nodes[here]['choices']:
            visit(choice['next'])
        active.remove(here)
        done.add(here)
    for start in STARTS:
        visit(start)
    endings = [n for n in nodes if nodes[n]['type']=='ending']
    report = {'status':'PASS', 'source_pages':len(manifest['pages']), 'nodes':len(nodes),
              'edges':sum(len(n['choices']) for n in nodes.values()), 'endings':len(endings),
              'expected_endings':43, 'unreachable_nodes':unreachable, 'dangling_edges':[],
              'cycles':[], 'per_root':per_root,
              'ending_witness_paths':{n:paths[n] for n in sorted(endings)},
              'limitations':['Structural/source-snapshot verification, not a legal opinion.',
                             'OCR/transcription accuracy is inherited from the cited Wikisource revision.',
                             'Live voice translation quality requires separate human evaluation.']}
    if len(endings) != 43:
        report['status'] = 'FAIL'
        write(ROOT/'reports/consider-validation.json', report)
        raise ValueError(f'Ending count is {len(endings)}, not 43; do not publish without review')
    bundle = {'schema_version':1, 'id':'consider-the-consequences', 'source_language':'en',
              'entry_nodes':STARTS, 'nodes':nodes}
    write(DEST/'graph.json', bundle)
    report['graph_sha256'] = hashlib.sha256((DEST/'graph.json').read_bytes()).hexdigest()
    write(ROOT/'reports/consider-validation.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


def self_test():
    html = '<div class="prp-pages-output"><p>' + ('Original scene. '*10) + '</p><p>The reader who agrees turns to paragraphs <a href="/wiki/Consider_the_Consequences!/H-1">H-1</a>. The one who refuses turns to paragraphs <a href="/wiki/Consider_the_Consequences!/H-2">H-2</a>.</p></div>'
    rec = {'html':html, 'url':'test', 'revision':1, 'html_sha256':'test'}
    scene = parse_scene('Helen', rec)
    assert [c['next'] for c in scene['choices']] == ['H-1','H-2']
    assert scene['type'] == 'scene' and len(scene['text']) > 80
    rec['html'] = html.replace('<a href="/wiki/Consider_the_Consequences!/H-1">H-1</a>', 'H-1')
    try:
        parse_scene('Helen', rec)
        raise AssertionError('Unlinked branch accepted')
    except ValueError:
        pass
    print('Parser self-tests PASS', flush=True)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--fetch', action='store_true')
    ap.add_argument('--verify', action='store_true')
    ap.add_argument('--self-test', action='store_true')
    args = ap.parse_args()
    self_test()
    if args.fetch:
        fetch_sources()
    if args.fetch or args.verify:
        verify_and_compile()
