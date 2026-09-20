"""Checks on the actual captured original, not synthetic story fixtures."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('source_importer',ROOT/'tools/import_wikisource.py')
imp=importlib.util.module_from_spec(spec);spec.loader.exec_module(imp)
FOLDER=ROOT/'stories/consider-the-consequences'
class OriginalCorpusTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.capture=json.loads((FOLDER/'source.capture.json').read_text())
        cls.bundle=json.loads((FOLDER/'nodes.json').read_text())
        cls.nodes={n['id']:n for n in cls.bundle['nodes']}
    def test_complete_independent_inventory(self):
        expected=set(['Helen','Jed','Saunders']+[f'H-{n}' for n in range(1,36)]+[f'J-{n}' for n in range(1,19)]+[f'S-{n}' for n in range(1,31)])
        self.assertEqual(set(self.nodes),expected)
        self.assertEqual(set(self.nodes),{p['id'] for p in self.capture['inventory']})
        self.assertFalse(self.capture.get('test_fixture',False))
    def test_every_page_hash_and_reparse(self):
        for page in self.capture['pages']:
            with self.subTest(page=page['id']):
                self.assertEqual(hashlib.sha256(page['html'].encode()).hexdigest(),page['html_sha256'])
                parsed=imp.parse_scene(page['html'],page['id'])
                for key in ('text','decision_text','choices','type'):
                    self.assertEqual(parsed[key],self.nodes[page['id']][key])
    def test_reviewed_author_notes_not_discarded(self):
        for node,tail in imp.AUTHOR_TAIL_NOTES.items():
            with self.subTest(node=node):
                self.assertTrue(self.nodes[node]['decision_text'].endswith(tail))
                self.assertEqual(len(self.nodes[node]['choices']),2)
    def test_all_endings_and_full_paths(self):
        report=imp.validate_graph(list(self.nodes.values()),list(self.nodes))
        self.assertEqual((report['nodes'],report['edges'],report['endings']),(86,87,43))
        self.assertEqual(report['finite_paths_to_endings'],61)
        self.assertTrue(report['acyclic'])
        self.assertEqual(len(report['ending_witnesses']),43)
    def test_branch_text_is_not_generated_or_summarized(self):
        # Every label is a literal substring of the current original direction.
        for node in self.nodes.values():
            for choice in node['choices']:
                with self.subTest(node=node['id'],choice=choice['id']):
                    self.assertIn(choice['label'],node['decision_text'])
if __name__=='__main__':
    unittest.main()
