from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from agentic_ai import open_db, search_memory
from lifeos_tools import parse_markdown, scan_text, preview_import, apply_import, list_prompts, verify_agents, ROOT

class LifeOSTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.root=Path(self.temp.name)
        self.db=open_db(self.root/'lifeos.sqlite3')
        self.file=self.root/'bericht.md'
        self.file.write_text('# Stand\nEine kurze Notiz über Batteriespeicher.\n## Wirtschaftlichkeit\nEin neuer Forschungsstand über Netzrestriktionen.',encoding='utf-8')
    def tearDown(self):
        self.db.close()
        self.temp.cleanup()

    def test_parse_markdown_sources(self):
        sections=parse_markdown(self.file.read_text(encoding='utf-8'), self.file.name)
        self.assertEqual(len(sections),2)
        self.assertTrue(sections[0].source.startswith('local:bericht.md#'))
        self.assertEqual(sections[0].sha256,parse_markdown(self.file.read_text(encoding='utf-8'), self.file.name)[0].sha256)

    def test_chunk_limit(self):
        with self.assertRaises(ValueError): parse_markdown('x','source',chunk_limit=50)
        txt='# Hallo\n'+('word '*500)
        self.assertGreater(len(parse_markdown(txt,'big',chunk_limit=220)),5)

    def test_safe_preview_no_db_write(self):
        preview=preview_import(self.file,'energiehub')
        self.assertEqual(len(preview['sections']),2)
        self.assertEqual(self.db.execute('SELECT COUNT(*) FROM memories').fetchone()[0],0)

    def test_import_requires_confirmation(self):
        preview=preview_import(self.file,'energiehub')
        with self.assertRaises(PermissionError): apply_import(self.db,preview)

    def test_import_idempotent(self):
        preview=preview_import(self.file,'energiehub')
        self.assertEqual(apply_import(self.db,preview,confirmed=True)['added'],2)
        self.assertEqual(apply_import(self.db,preview,confirmed=True)['unchanged'],2)
        self.assertTrue(search_memory(self.db,'Netzrestriktionen','energiehub'))
        self.assertFalse(search_memory(self.db,'Netzrestriktionen','startup'))

    def test_no_automatic_verification(self):
        preview=preview_import(self.file,'energiehub')
        with self.assertRaises(ValueError): apply_import(self.db,preview,confirmed=True,status='verified')

    def test_secret_pattern_detected_and_blocked(self):
        self.file.write_text('# Test\n-----BEGIN PRIVATE KEY-----\nexposed\n',encoding='utf-8')
        preview=preview_import(self.file,'myproject')
        self.assertTrue(preview['warnings'])
        with self.assertRaises(PermissionError): apply_import(self.db,preview,confirmed=True)

    def test_project_name_validation(self):
        with self.assertRaises(ValueError): preview_import(self.file,'../bad')

    def test_missing_file(self):
        with self.assertRaises(FileNotFoundError): preview_import(self.root/'none.md','energiehub')

    def test_prompt_catalog_has_32(self):
        prompts=list_prompts(ROOT/'prompts')
        self.assertEqual(len(prompts),32)
        self.assertTrue(any('marketing' in x['file'] for x in prompts))

    def test_agents_have_frontmatter(self):
        checks=verify_agents(ROOT/'.claude/agents')
        self.assertEqual(len(checks),12)
        self.assertTrue(all(x['valid_basic_structure'] for x in checks))

    def test_no_false_secret_in_normal_text(self):
        self.assertFalse(scan_text('Öffentliche Informationen zu BESS und PV'))

    def test_demo_requires_correct_status(self):
        note=self.root/'fiktiv.md'
        note.write_text('# Beispiel\nStatus: DEMO\nEine erfundene Zahl zur Illustration.',encoding='utf-8')
        preview=preview_import(note,'flexgrid')
        self.assertTrue(preview['is_demonstration'])
        with self.assertRaisesRegex(ValueError,'Demo-Dateien'):
            apply_import(self.db,preview,confirmed=True,status='reported')
        self.assertEqual(apply_import(self.db,preview,confirmed=True,status='demo')['added'],1)

    def test_local_cli(self):
        result=subprocess.run([sys.executable,str(ROOT/'lifeos_tools.py'),'prompts'],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('wirtschaftlichkeit',result.stdout)

if __name__=='__main__':
    unittest.main()
