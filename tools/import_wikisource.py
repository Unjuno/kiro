#!/usr/bin/env python3
"""Import a complete, pinned Wikisource work; never fetch story text at runtime.

Python 3.10+ standard library only. The default command reads the pinned source.capture.json,
validates the entire corpus, then replaces the local story atomically. A failed
capture or validation never turns into an ending and never replaces a good port.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import time
from collections import deque
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urlencode, urlsplit
from urllib.request import Request, urlopen

BOOK = 'Consider the Consequences!'
STORY_ID = 'consider-the-consequences'
API = 'https://en.wikisource.org/w/api.php'
ROOTS = ['Helen', 'Jed', 'Saunders']
VALID_ID = re.compile(r'^(?:Helen|Jed|Saunders|[HJS]-[1-9][0-9]{0,2})$')
TARGET_TEXT = re.compile(r'\b[HJS][.\-][1-9][0-9]{0,2}\b')
DIRECTION = re.compile(r'\b(?:turn(?:s)?|go(?:es)?|proceed(?:s)?|continue(?:s)?|refer(?:s)?)\s+(?:on\s+)?to\s+(?:the\s+)?(?:paragraphs?\s+)?[HJS][.\-\s][0-9]+', re.I)
SOURCE_URL = 'https://en.wikisource.org/wiki/Consider_the_Consequences!'
MAX_BYTES = 8 * 1024 * 1024
MAX_NODES = 400

# Reviewed original author notes after the final choice, preserved verbatim in
# decision_text. These describe converging routes, not additional choices.
AUTHOR_TAIL_NOTES = {
    'H-6': '. (Note: H-12 is the same situation resulting from one of her other possible decisions, for fate occasionally leads by different routes to the same point.)',
    'H-10': '. These are both situations in which she finds herself in other potential lives; for one may occasionally reach the same point by different paths.',
}


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(value):
    return hashlib.sha256(canonical(value).encode('utf-8')).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def tidy(text):
    text = re.sub(r'[\u200b\u200c\u200d\ufeff]', '', text)
    return re.sub(r'\s+', ' ', text).strip()


class ImportFailure(Exception):
    pass


class Element:
    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = dict(attrs or [])
        self.parent = parent
        self.children = []


class DOM(HTMLParser):
    VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Element('root')
        self.current = self.root

    def handle_starttag(self, tag, attrs):
        # HTML permits an omitted </p>. Close it before another paragraph.
        if tag == 'p' and self.current.tag == 'p':
            self.current = self.current.parent
        node = Element(tag, attrs, self.current)
        self.current.children.append(node)
        if tag not in self.VOID:
            self.current = node

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in self.VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        cursor = self.current
        while cursor is not self.root and cursor.tag != tag:
            cursor = cursor.parent
        if cursor is not self.root:
            self.current = cursor.parent

    def handle_data(self, text):
        self.current.children.append(text)


def walk(node):
    if isinstance(node, Element):
        yield node
        for child in node.children:
            yield from walk(child)


BLOCKED_CLASSES = {
    'header', 'headerContainer', 'headerTemplate', 'wst-header', 'wst-header-main',
    'ws-noexport', 'noprint', 'pagenum', 'mw-editsection', 'printfooter', 'catlinks',
    'navbox', 'mw-jump-link', 'sistersitebox', 'ws-footer', 'licenseContainer',
}
BLOCKED_TAGS = {'script', 'style', 'table', 'figure', 'nav', 'footer', 'sup'}


def blocked(node):
    return (node.tag in BLOCKED_TAGS or
            bool(set(node.attrs.get('class', '').split()) & BLOCKED_CLASSES) or
            node.attrs.get('id', '') in {'header', 'footer', 'catlinks', 'ws-data'})


def story_target(href):
    parsed = urlsplit(href)
    if parsed.netloc and parsed.netloc != 'en.wikisource.org':
        return None
    path = unquote(parsed.path).replace('_', ' ')
    prefix = '/wiki/' + BOOK + '/'
    if not path.startswith(prefix):
        return None
    target = path[len(prefix):]
    if VALID_ID.fullmatch(target):
        return target
    return None


def extract_blocks(root):
    """Render body prose without site chrome. Retain target positions in text."""
    blocks = []
    pieces = []
    links = []

    def flush():
        nonlocal pieces, links
        text = tidy(''.join(pieces))
        if text:
            blocks.append({'text': text, 'links': links})
        pieces, links = [], []

    def visit(node):
        if isinstance(node, str):
            pieces.append(node)
            return
        if blocked(node):
            return
        is_block = node.tag in {'p', 'div', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'li', 'section'}
        if is_block:
            flush()
        if node.tag == 'br':
            pieces.append(' ')
        if node.tag == 'a':
            target = story_target(node.attrs.get('href', ''))
            if target:
                # Match the original anchor label, not any previous/next header.
                label = tidy(''.join(text_content(node)))
                links.append({'target': target, 'label': label})
        for child in node.children:
            visit(child)
        if is_block:
            flush()

    def text_content(node):
        for child in node.children:
            if isinstance(child, str):
                yield child
            elif not blocked(child):
                yield from text_content(child)

    visit(root)
    flush()
    return blocks


def parse_scene(html, node_id):
    if not VALID_ID.fullmatch(node_id):
        raise ImportFailure(f'Invalid scene id: {node_id!r}')
    parser = DOM()
    parser.feed(html)
    parser.close()
    transclusions = [n for n in walk(parser.root)
                     if 'prp-pages-output' in n.attrs.get('class', '').split()]
    if len(transclusions) > 1:
        raise ImportFailure(f'{node_id}: multiple transclusion containers need explicit review')
    body = transclusions[0] if transclusions else None
    if body is None:
        body = next((n for n in walk(parser.root)
                     if 'mw-parser-output' in n.attrs.get('class', '').split()), None)
    if body is None:
        raise ImportFailure(f'{node_id}: no recognized Wikisource body container')
    blocks = extract_blocks(body)
    heading = re.compile(r'^(?:Section\s+[IVXLC]+(?:\s+(?:Helen|Jed|Saunders))?|Helen|Jed|Saunders|H-I|[HJS]-[0-9]+)$', re.I)
    while blocks and heading.fullmatch(blocks[0]['text']):
        blocks.pop(0)
    if not blocks:
        raise ImportFailure(f'{node_id}: empty source text')
    if any('Retrieved from' in b['text'] or 'Jump to content' in b['text'] or
           'Creative Commons Attribution-ShareAlike License' in b['text'] for b in blocks):
        raise ImportFailure(f'{node_id}: source chrome leaked into prose')

    first_choice = next((i for i, b in enumerate(blocks) if b['links']), len(blocks))
    narrative = blocks[:first_choice]
    decisions = blocks[first_choice:]
    if not narrative or len(' '.join(b['text'] for b in narrative)) < 30:
        raise ImportFailure(f'{node_id}: missing narrative; refusing to mark as ending')
    # A directive without a recognized hyperlink is a broken import, not an ending.
    if any(DIRECTION.search(b['text']) for b in narrative):
        raise ImportFailure(f'{node_id}: unlinked or misplaced branch directive')
    if any(not b['links'] for b in decisions):
        raise ImportFailure(f'{node_id}: text after choices needs explicit review')

    choices = []
    for block in decisions:
        cursor = 0
        for ref in block['links']:
            target = ref['target']
            label = ref['label']
            if not re.fullmatch(r'[HJS][.\-][1-9][0-9]{0,2}', label):
                raise ImportFailure(f'{node_id}: unexpected story-link label {label!r}')
            found = block['text'].find(label, cursor)
            if found < 0:
                raise ImportFailure(f'{node_id}: cannot locate branch anchor')
            clause = block['text'][cursor:found + len(label)].lstrip(' ;,.\u00a0')
            cursor = found + len(label)
            if not clause:
                raise ImportFailure(f'{node_id}: empty choice label')
            choices.append({'id': f'choice-{len(choices)+1}', 'label': clause, 'next': target})
        tail = block['text'][cursor:]
        if tail.strip(' ;,.\u00a0') and tail != AUTHOR_TAIL_NOTES.get(node_id):
            raise ImportFailure(f'{node_id}: text after last choice needs review: {tail!r}')
        textual_targets = [m.group(0).replace('.', '-') for m in TARGET_TEXT.finditer(block['text'][:cursor])]
        if textual_targets != [ref['target'] for ref in block['links']]:
            raise ImportFailure(f'{node_id}: reference text and hyperlink targets disagree')

    return {
        'id': node_id,
        'type': 'scene' if choices else 'ending',
        'text': '\n\n'.join(b['text'] for b in narrative),
        'decision_text': '\n\n'.join(b['text'] for b in decisions),
        'choices': choices,
    }


def validate_graph(nodes, expected_ids, expected_endings=43):
    errors = []
    by_id = {n['id']: n for n in nodes}
    if len(by_id) != len(nodes):
        errors.append('Duplicate node ids')
    if set(by_id) != set(expected_ids):
        errors.append('Captured nodes do not match the independently enumerated source inventory')
    for root in ROOTS:
        if root not in by_id:
            errors.append(f'Missing entry: {root}')
    edges = []
    endings = []
    for node in nodes:
        if not node['text'].strip():
            errors.append(f"Empty prose: {node['id']}")
        if node['type'] == 'ending':
            endings.append(node['id'])
            if node['choices']:
                errors.append(f"Ending has successors: {node['id']}")
        elif not node['choices']:
            errors.append(f"Non-ending has no successor: {node['id']}")
        for choice in node['choices']:
            edge = (node['id'], choice['next'])
            edges.append(edge)
            if choice['next'] not in by_id:
                errors.append(f'Dangling target: {edge[0]} -> {edge[1]}')
    if len(endings) != expected_endings:
        errors.append(f'Expected {expected_endings} endings; captured {len(endings)}')
    witnesses = {root: [root] for root in ROOTS if root in by_id}
    queue = deque(witnesses)
    while queue:
        node_id = queue.popleft()
        for choice in by_id[node_id]['choices']:
            target = choice['next']
            if target in by_id and target not in witnesses:
                witnesses[target] = witnesses[node_id] + [target]
                queue.append(target)
    unreachable = sorted(set(by_id) - set(witnesses))
    if unreachable:
        errors.append('Unreachable nodes: ' + ', '.join(unreachable))
    reverse = {node_id: [] for node_id in by_id}
    for src, dst in edges:
        if dst in reverse:
            reverse[dst].append(src)
    can_end = set(endings)
    queue = deque(endings)
    while queue:
        for previous in reverse[queue.popleft()]:
            if previous not in can_end:
                can_end.add(previous)
                queue.append(previous)
    trapped = sorted(set(by_id) - can_end)
    if trapped:
        errors.append('Nodes with no route to an ending: ' + ', '.join(trapped))
    # Topological ordering distinguishes an acyclic story from cycles with exits.
    indegree = {node_id: 0 for node_id in by_id}
    for _, dst in edges:
        if dst in indegree:
            indegree[dst] += 1
    topo_queue = deque(node_id for node_id, count in indegree.items() if count == 0)
    ordered = []
    while topo_queue:
        src = topo_queue.popleft()
        ordered.append(src)
        for choice in by_id[src]['choices']:
            dst = choice['next']
            if dst in indegree:
                indegree[dst] -= 1
                if indegree[dst] == 0:
                    topo_queue.append(dst)
    acyclic = len(ordered) == len(by_id)
    path_count = None
    if acyclic and not errors:
        ways = {node_id: int(node_id in ROOTS) for node_id in by_id}
        for src in ordered:
            for choice in by_id[src]['choices']:
                ways[choice['next']] += ways[src]
        path_count = sum(ways[ending] for ending in endings)
    report = {
        'status': 'PASS' if not errors else 'FAIL',
        'nodes': len(nodes), 'edges': len(edges),
        'decision_nodes': sum(len(n['choices']) >= 2 for n in nodes),
        'single_successor_nodes': sum(len(n['choices']) == 1 for n in nodes),
        'endings': len(endings), 'expected_endings': expected_endings,
        'reachable_nodes': len(witnesses), 'unreachable': unreachable,
        'trapped_nodes': trapped, 'acyclic': acyclic,
        'finite_paths_to_endings': path_count,
        'ending_ids': sorted(endings),
        'ending_witnesses': {key: witnesses.get(key, []) for key in sorted(endings)},
        'errors': errors,
    }
    if errors:
        raise ImportFailure(json.dumps(report, ensure_ascii=False, indent=2))
    return report


def materialize_capture(capture, root, expected_endings=43, *, allow_test_fixture=False):
    if capture.get('format') != 'kiro-wikisource-capture-v1' or capture.get('work') != BOOK:
        raise ImportFailure('Not a supported source snapshot')
    if capture.get('test_fixture') and not allow_test_fixture:
        raise ImportFailure('Synthetic fixtures cannot be imported as a real work')
    inventory = capture.get('inventory', [])
    pages = capture.get('pages', [])
    inventory_ids = [p['id'] for p in inventory]
    if len(set(inventory_ids)) != len(inventory_ids) or len(pages) > MAX_NODES:
        raise ImportFailure('Duplicate or excessive source inventory')
    nodes = []
    for page in pages:
        html = page['html']
        if hashlib.sha256(html.encode()).hexdigest() != page['html_sha256']:
            raise ImportFailure(f"Source hash mismatch: {page['id']}")
        node = parse_scene(html, page['id'])
        node['source'] = {
            'title': page['title'], 'revision': page['revision'],
            'url': SOURCE_URL + '/' + page['id'],
            'permalink': 'https://en.wikisource.org/w/index.php?' + urlencode({
                'title': page['title'], 'oldid': page['revision']}),
            'html_sha256': page['html_sha256'],
        }
        nodes.append(node)
    report = validate_graph(nodes, inventory_ids, expected_endings)
    nodes.sort(key=lambda n: n['id'])
    version = digest(nodes)[:16]
    bundle = {'schema_version': 2, 'story_id': STORY_ID, 'version': version, 'nodes': nodes}
    metadata = {
        'schema_version': 2, 'id': STORY_ID, 'version': version,
        'test_fixture': bool(capture.get('test_fixture', False)),
        'title': BOOK, 'language': 'en', 'year': 1930,
        'authors': ['Doris Webster', 'Mary Alden Hopkins'],
        'description': {
            'en': 'Three intertwined lives. Choices about love, work and family lead to different consequences.',
            'ja': '恋愛、仕事、家族についての選択が、交差する3人の人生を異なる結末へ導く分岐物語。',
        },
        'entries': [{'id': 'Helen', 'label': 'Helen Rogers'},
                    {'id': 'Jed', 'label': 'Jed Harringdale'},
                    {'id': 'Saunders', 'label': 'Saunders Mead'}],
        'source_url': SOURCE_URL,
        'rights': {
            'original_work': 'PD-US',
            'evidence_url': SOURCE_URL,
            'verified_territories': ['US'],
            'worldwide_clearance': 'unverified',
            'note': 'Wikisource identifies the original 1930 work as public domain in the United States. This is not a worldwide rights clearance. Retain source contributors, revision links and applicable license notices.',
            'wiki_contributions_license_url': 'https://creativecommons.org/licenses/by-sa/4.0/',
        },
        'attribution': f'This interactive adaptation is based on {BOOK} (1930) by Doris Webster and Mary Alden Hopkins. Transcription source: English Wikisource and its contributors. The narration is translated at play time by the selected voice agent; it is not an official published translation.',
        'localization': {'mode': 'agent-runtime', 'use_session_language': True,
                         'preserve_original_names': True},
        'content_notice': 'The original contains dated social attitudes and may include death, violence and suicide. These belong to the fictional work, not to advice for the player.',
        'statistics': {key: report[key] for key in ('nodes', 'edges', 'endings')},
    }
    manifest = {
        'format': 'kiro-source-manifest-v1', 'version': version,
        'test_fixture': bool(capture.get('test_fixture', False)),
        'capture_sha256': digest(capture), 'bundle_sha256': digest(bundle),
        'inventory_ids': inventory_ids,
        'endings': report['ending_ids'],
        'source_captured_at': capture['captured_at'],
        'transclusion_warning': 'Page revision IDs alone do not freeze transcluded Page: revisions. Included source HTML and its hashes freeze the actual imported rendering.',
    }
    stories = root / 'stories'
    stories.mkdir(parents=True, exist_ok=True)
    destination = stories / STORY_ID
    backup = stories / ('.' + STORY_ID + '.backup')
    if backup.exists():
        raise ImportFailure(f'Unresolved previous import backup: {backup}')
    catalog_path = stories / 'catalog.json'
    old_catalog = catalog_path.read_bytes() if catalog_path.exists() else None
    catalog = json.loads(old_catalog) if old_catalog else {'version': 1, 'stories': []}
    if not isinstance(catalog.get('stories'), list):
        raise ImportFailure('Invalid existing catalog')
    with tempfile.TemporaryDirectory(prefix='.kiro-import-', dir=stories) as temporary:
        stage = Path(temporary) / STORY_ID
        stage.mkdir()
        write_json(stage / 'story.json', metadata)
        write_json(stage / 'nodes.json', bundle)
        write_json(stage / 'source.capture.json', capture)
        write_json(stage / 'source.manifest.json', manifest)
        write_json(stage / 'validation.json', report)
        (stage / 'ATTRIBUTION.md').write_text(
            '# Source and attribution\n\n' + metadata['attribution'] + '\n\n' +
            metadata['rights']['note'] + '\n\nSource: ' + SOURCE_URL + '\n\n' +
            'Wiki contribution license: https://creativecommons.org/licenses/by-sa/4.0/\n\n' +
            'Changes: navigation/chrome removed, whitespace normalized, original choice references converted to explicit links. Story prose is not abridged or regenerated.\n', encoding='utf-8')
        report_lines = ['# Import validation', '', 'Generated from the captured source; counts are measured, not placeholders.', '',
                        f"Nodes: {report['nodes']}; edges: {report['edges']}; endings: {report['endings']}.", '',
                        '| Ending | Witness path |', '|---|---|']
        for ending, witness in report['ending_witnesses'].items():
            report_lines.append(f"| {ending} | {' → '.join(witness)} |")
        (stage / 'VALIDATION.md').write_text('\n'.join(report_lines) + '\n', encoding='utf-8')
        new_catalog = {**catalog, 'stories': [entry for entry in catalog['stories']
                           if not ((isinstance(entry, dict) and entry.get('id') == STORY_ID) or entry == STORY_ID)]}
        new_catalog['stories'].append({'id': STORY_ID, 'version': version})
        replaced = False
        try:
            if destination.exists():
                destination.rename(backup)
            stage.rename(destination)
            replaced = True
            catalog_tmp = stories / '.catalog.json.tmp'
            write_json(catalog_tmp, new_catalog)
            os.replace(catalog_tmp, catalog_path)
        except Exception:
            if replaced and destination.exists():
                shutil.rmtree(destination)
            if backup.exists():
                backup.rename(destination)
            if old_catalog is not None:
                catalog_path.write_bytes(old_catalog)
            elif catalog_path.exists():
                catalog_path.unlink()
            raise
        else:
            if backup.exists():
                shutil.rmtree(backup)
    return report


def main(argv=None):
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    cli.add_argument('--from-snapshot', type=Path, help='Rebuild offline from a previously captured full source')
    cli.add_argument('--expected-endings', type=int, default=43,
                     help='Release assertion, not a claimed measurement; default: 43')
    cli.add_argument('--delay', type=float, default=0.25)
    args = cli.parse_args(argv)
    if args.expected_endings < 1 or not 0.1 <= args.delay <= 60:
        cli.error('Invalid ending count or request delay')
    root = args.root.resolve()
    root.mkdir(parents=True, exist_ok=True)
    lock = root / '.kiro-import.lock'
    try:
        descriptor = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        print('FAIL: another import is active (or a stale .kiro-import.lock needs review).', file=sys.stderr)
        return 1
    try:
        os.close(descriptor)
        snapshot = args.from_snapshot or root / 'stories' / STORY_ID / 'source.capture.json'
        capture = json.loads(snapshot.read_text(encoding='utf-8'))
        report = materialize_capture(capture, root, args.expected_endings)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (ImportFailure, OSError, ValueError, KeyError, TypeError) as exc:
        print(f'FAIL: {exc}', file=sys.stderr)
        return 1
    finally:
        lock.unlink(missing_ok=True)


if __name__ == '__main__':
    raise SystemExit(main())
