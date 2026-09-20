"""Offline tests. All complete graphs here are SYNTHETIC, not the actual book.

The H-2 regression fixture wraps a short observed public-domain passage in
constructed HTML; it is not represented as a downloaded raw Wikisource page.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('importer', ROOT / 'tools/import_wikisource.py')
imp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(imp)


def html(narration, targets=(), chrome=True):
    header = '<table class="header"><a href="/wiki/Consider_the_Consequences!/H-999">H-999</a></table>' if chrome else ''
    choices = ''.join(f'<p>The reader who chooses option {i} turns to paragraphs <a href="/wiki/Consider_the_Consequences!/{target}">{target}</a>.</p>' for i, target in enumerate(targets, 1))
    return f'<div class="mw-parser-output">{header}<div class="prp-pages-output"><p>{narration}</p>{choices}</div></div>'


def synthetic_capture():
    records = [('Helen', [f'H-{i}' for i in range(1, 42)]), ('Jed', ['J-1']), ('Saunders', ['S-1'])]
    records += [(f'H-{i}', []) for i in range(1, 42)] + [('J-1', []), ('S-1', [])]
    pages = []
    for index, (node_id, targets) in enumerate(records, 1):
        body = html(f'SYNTHETIC TEST FIXTURE {node_id}. This text is not from the original work and is not for publication.', targets)
        pages.append({'id': node_id, 'title': imp.BOOK + '/' + node_id, 'pageid': index,
                      'revision': index, 'html': body, 'html_sha256': hashlib.sha256(body.encode()).hexdigest()})
    return {'format': 'kiro-wikisource-capture-v1', 'work': imp.BOOK, 'test_fixture': True,
            'captured_at': 'TEST FIXTURE; NOT A LIVE CAPTURE',
            'inventory': [{k: p[k] for k in ['id', 'title', 'pageid']} for p in pages], 'pages': pages}


class ParserTests(unittest.TestCase):
    def test_branch_targets_not_header_navigation(self):
        scene = imp.parse_scene(html('This is a controlled narrative paragraph used solely for parser tests.', ['H-5', 'H-6']), 'H-2')
        self.assertEqual([c['next'] for c in scene['choices']], ['H-5', 'H-6'])
        self.assertNotIn('999', scene['text'])
        self.assertEqual(scene['type'], 'scene')

    def test_observed_h2_directive_regression(self):
        # Source: https://en.wikisource.org/wiki/Consider_the_Consequences!/H-2
        body = '''<div class="mw-parser-output"><div class="prp-pages-output"><p>Helen's head was stronger than her heart. Her passionate desire was to get away from Franklin.</p><p>The reader who thinks she should stay turns to paragraphs <a href="/wiki/Consider_the_Consequences!/H-5">H-5</a>. The one who thinks she should leave home turns to paragraphs <a href="/wiki/Consider_the_Consequences!/H-6">H-6</a>.</p></div></div>'''
        node = imp.parse_scene(body, 'H-2')
        self.assertEqual([c['next'] for c in node['choices']], ['H-5', 'H-6'])
        self.assertIn('she should leave home', node['choices'][1]['label'])

    def test_entities_and_inline_formatting(self):
        node = imp.parse_scene(html('A &amp; B waited with <i>great care</i>. They didn&#39;t leave the room.'), 'H-9')
        self.assertIn("A & B waited with great care. They didn't", node['text'])
        self.assertEqual(node['type'], 'ending')

    def test_breaks_do_not_merge_words(self):
        node = imp.parse_scene(html('They waited by the doorway.<br>Then another person arrived in the room.'), 'H-9')
        self.assertIn('doorway. Then', node['text'])

    def test_empty_body_is_not_ending(self):
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene('<div class="mw-parser-output"></div>', 'H-9')

    def test_unlinked_directive_is_not_ending(self):
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene(html('The reader who chooses the next option turns to paragraphs H-1.'), 'H-9')

    def test_reference_disagreement(self):
        body = html('A narrative paragraph long enough to satisfy this parser regression test.', ['H-1'])
        body = body.replace('>H-1</a>', '>H-2</a>')
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene(body, 'H-3')

    def test_unknown_wrapper_rejected(self):
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene('<p>This is not a recognized source document at all.</p>', 'H-9')

    def test_source_id_validation(self):
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene(html('A controlled test passage which contains no commands or directions.'), '../secret')

    def test_source_footer_leak_rejected(self):
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene(html('Retrieved from an unwanted source footer. This must not be prose.'), 'H-9')

    def test_multiple_transclusions_rejected(self):
        body = html('A controlled test passage which contains no commands or directions.')
        body = body.replace('</div></div>', '</div><div class="prp-pages-output"><p>Another page.</p></div></div>')
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene(body, 'H-9')

    def test_post_choice_text_not_silently_discarded(self):
        body = html('A controlled test passage used for a choice paragraph regression check.', ['H-1'])
        body = body.replace('</div></div>', '<p>This unexpected text is after a choice.</p></div></div>')
        with self.assertRaises(imp.ImportFailure):
            imp.parse_scene(body, 'H-2')

    def test_script_ignored(self):
        node = imp.parse_scene(html('A controlled passage with <script>dangerous()</script>some surviving words and a conclusion.'), 'H-9')
        self.assertNotIn('dangerous', node['text'])

    def test_same_target_distinct_choices_are_preserved(self):
        node = imp.parse_scene(html('A controlled narrative where two different decisions share a successor.', ['H-1', 'H-1']), 'H-2')
        self.assertEqual(len(node['choices']), 2)
        self.assertNotEqual(node['choices'][0]['id'], node['choices'][1]['id'])


class CorpusTests(unittest.TestCase):
    def nodes(self):
        capture = synthetic_capture()
        return [imp.parse_scene(p['html'], p['id']) for p in capture['pages']]

    def test_synthetic_43_endings_all_reachable(self):
        nodes = self.nodes()
        result = imp.validate_graph(nodes, [n['id'] for n in nodes])
        self.assertEqual(result['endings'], 43)
        self.assertEqual(result['nodes'], 46)
        self.assertEqual(result['reachable_nodes'], 46)
        self.assertEqual(result['finite_paths_to_endings'], 43)
        self.assertEqual(len(result['ending_witnesses']), 43)

    def test_missing_target_rejected(self):
        nodes = self.nodes()
        nodes[0]['choices'][0]['next'] = 'H-999'
        with self.assertRaises(imp.ImportFailure):
            imp.validate_graph(nodes, [n['id'] for n in nodes])

    def test_wrong_ending_count_rejected(self):
        nodes = self.nodes()
        with self.assertRaises(imp.ImportFailure):
            imp.validate_graph(nodes, [n['id'] for n in nodes], expected_endings=44)

    def test_inventory_mismatch_rejected(self):
        nodes = self.nodes()
        with self.assertRaises(imp.ImportFailure):
            imp.validate_graph(nodes, [n['id'] for n in nodes] + ['H-999'])

    def test_unreachable_ending_rejected(self):
        nodes = self.nodes()
        nodes[0]['choices'].pop()
        with self.assertRaises(imp.ImportFailure):
            imp.validate_graph(nodes, [n['id'] for n in nodes])

    def test_loop_without_exit_rejected(self):
        nodes = self.nodes()
        nodes[0]['choices'] = [{'id': 'again', 'label': 'Again', 'next': 'Helen'}]
        with self.assertRaises(imp.ImportFailure):
            imp.validate_graph(nodes, [n['id'] for n in nodes])

    def test_synthetic_cannot_be_published_as_original(self):
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(imp.ImportFailure):
                imp.materialize_capture(synthetic_capture(), Path(temporary))

    def test_source_hash_mismatch_rejected(self):
        capture = synthetic_capture()
        capture['pages'][0]['html'] += 'modified'
        with tempfile.TemporaryDirectory() as temporary:
            with self.assertRaises(imp.ImportFailure):
                imp.materialize_capture(capture, Path(temporary), allow_test_fixture=True)

    def test_failed_import_preserves_previous_files(self):
        capture = synthetic_capture()
        capture['pages'][0]['html_sha256'] = 'bad'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            story_dir = root / 'stories' / imp.STORY_ID
            story_dir.mkdir(parents=True)
            sentinel = story_dir / 'keep.txt'
            sentinel.write_text('previous release')
            with self.assertRaises(imp.ImportFailure):
                imp.materialize_capture(capture, root, allow_test_fixture=True)
            self.assertEqual(sentinel.read_text(), 'previous release')

    def test_roundtrip_python_import_node_loader_and_render(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            report = imp.materialize_capture(synthetic_capture(), root, allow_test_fixture=True)
            self.assertEqual(report['status'], 'PASS')
            check = '''import {loadLibrary} from './lib/library.mjs';
import {renderRequest} from './lib/player.mjs';
const library = loadLibrary(process.argv[1], {allowTestFixtures:true});
for (const s of library.values()) for (const node of s.nodes.values()) {
 const result=renderRequest('/?lang=ja&story='+s.id+'&node='+node.id+'&v='+s.version,library);
 if(result.status!==200)throw new Error('Rendering failed: '+node.id);
 if(!result.html.includes('data-kiro-state="'+node.id+'"'))throw new Error('Wrong state');
}
let rejected=false;try{loadLibrary(process.argv[1])}catch{rejected=true}
if(!rejected)throw new Error('Test corpus accepted for release');
console.log('SYNTHETIC ROUNDTRIP PASS');'''
            result = subprocess.run(['node', '--input-type=module', '-e', check, str(root / 'stories')],
                                    cwd=ROOT, text=True, capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn('SYNTHETIC ROUNDTRIP PASS', result.stdout)


if __name__ == '__main__':
    unittest.main()
