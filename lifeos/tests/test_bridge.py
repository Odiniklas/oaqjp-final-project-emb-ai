import json
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from agentic_ai import add_memory, open_db
from lebenshub_bridge import know_to_memories, memories_to_inbox, validate_claim, MAX_ACTIONS
from lifeos_tools import ROOT


def good_claim(**kw):
    c = {"id": "CLAIM-2026-0001", "project_id": "FLEXGRID", "record_type": "claim",
         "statement": "Ein Gewerbegebiet mit mehreren Betrieben ist als Pilotfall im Gespräch.",
         "status": "user_reported", "source_id": "Gesprächsnotiz 2026-11-18", "source_date": "2026-11-18",
         "observed_at": "2026-11-20", "sensitivity": "personal", "confidence_level": "medium",
         "valid_until": None, "version": 1}
    c.update(kw)
    return c


class ClaimTests(unittest.TestCase):
    def test_valid_claim(self):
        self.assertEqual(validate_claim(good_claim()), [])

    def test_template_file_is_structurally_valid_except_placeholders(self):
        tpl = json.loads((ROOT / "import_vorlagen" / "CLAIM_TEMPLATE.json").read_text(encoding="utf-8"))
        errs = validate_claim(tpl)
        # Die Vorlage enthält Platzhalter-Daten (YYYY-MM-DD); nur diese dürfen bemängelt werden.
        self.assertTrue(errs and all("Datum" in e for e in errs), errs)

    def test_missing_fields_and_bad_values(self):
        errs = validate_claim(good_claim(statement="", status="sicher", sensitivity="geheim", version=0))
        self.assertTrue(any("statement" in e for e in errs))
        self.assertTrue(any("status" in e for e in errs))
        self.assertTrue(any("sensitivity" in e for e in errs))
        self.assertTrue(any("version" in e for e in errs))

    def test_verified_needs_checkable_source(self):
        self.assertTrue(validate_claim(good_claim(status="externally_verified", source_id="Erinnerung")))
        self.assertEqual(validate_claim(good_claim(status="externally_verified", source_id="https://example.org/bericht")), [])

    def test_restricted_and_secrets_rejected(self):
        self.assertTrue(validate_claim(good_claim(sensitivity="restricted")))
        self.assertTrue(validate_claim(good_claim(statement="Das Passwort lautet geheim1234 für das Portal")))

    def test_invalid_date(self):
        self.assertTrue(any("observed_at" in e for e in validate_claim(good_claim(observed_at="2026-13-40"))))


class BridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = open_db(Path(self.tmp.name) / "b.sqlite3")

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_to_inbox_shape_and_filters(self):
        add_memory(self.db, project="flexgrid", content="Hypothese: Cluster-EMS senkt Lastspitzen.", source="notiz:1", status="hypothesis", confidence=0.3)
        add_memory(self.db, project="flexgrid", content="DEMO-Eintrag", source="demo:x", status="demo", confidence=0.3)
        add_memory(self.db, project="karriere", content="Andere Akte", source="notiz:2")
        doc = memories_to_inbox(self.db, project="flexgrid")
        self.assertEqual(len(doc["actions"]), 1)
        a = doc["actions"][0]
        self.assertEqual(a["tool"], "add_knowledge")
        self.assertIn("Hypothese", a["points"][0])
        self.assertTrue(a["title"].startswith("[flexgrid]"))
        self.assertEqual(len(memories_to_inbox(self.db, project="flexgrid", include_demo=True)["actions"]), 2)

    def test_to_inbox_skips_sensitive_and_caps(self):
        add_memory(self.db, project="p", content="vertraulich: interne Zahlen", source="s:0")
        for i in range(MAX_ACTIONS + 5):
            add_memory(self.db, project="p", content=f"Eintrag {i}", source=f"s:{i+1}")
        doc = memories_to_inbox(self.db)
        self.assertEqual(len(doc["actions"]), MAX_ACTIONS)
        self.assertEqual(len(doc["_skipped_sensitive_ids"]), 1)

    def test_from_know_dry_run_then_idempotent_apply(self):
        know = {"data": [{"id": "k1", "title": "Second Life", "summary": "Amortisation hängt an Dimensionierung.", "points": ["8,4 vs. 17,6 Jahre"], "tags": ["Batterie"]},
                         {"id": "k2", "title": "Geheim", "summary": "confidential Inhalt", "tags": []}]}
        dry = know_to_memories(self.db, know)
        self.assertEqual(dry["would_add"], 1)
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM memories").fetchone()[0], 0)
        r1 = know_to_memories(self.db, know, confirmed=True)
        r2 = know_to_memories(self.db, know, confirmed=True)
        self.assertEqual((r1["added"], r2["added"], r2["unchanged"]), (1, 0, 1))
        row = self.db.execute("SELECT project,status,source FROM memories").fetchone()
        self.assertEqual((row[0], row[1], row[2]), ("batterie", "reported", "lebenshub:know/k1"))

    def test_cli_validate(self):
        f = Path(self.tmp.name) / "c.json"
        f.write_text(json.dumps(good_claim()), encoding="utf-8")
        r = subprocess.run([sys.executable, str(ROOT / "lebenshub_bridge.py"), "validate-claim", str(f)], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertTrue(json.loads(r.stdout)["valid"])


class PublicRepoSafetyTests(unittest.TestCase):
    """Das Repository ist öffentlich: keine Schlüssel, E-Mail-Adressen oder IBANs in versionierten Textdateien."""
    PATTERNS = [re.compile(r"\bsk-ant-[A-Za-z0-9_-]{10,}"), re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
                re.compile(r"\b[A-Za-z0-9._%+-]+@(?!example\.)[A-Za-z0-9.-]+\.[a-z]{2,}\b"), re.compile(r"\bDE\d{2}(?: ?\d{4}){4} ?\d{2}\b")]

    def test_no_secrets_or_personal_identifiers(self):
        hits = []
        for f in ROOT.rglob("*"):
            if f.is_file() and f.suffix in {".md", ".py", ".txt", ".json", ".example"} and "wissen" not in f.parts and "tests" not in f.parts:  # Tests enthalten absichtliche Muster
                text = f.read_text(encoding="utf-8", errors="ignore")
                hits += [f"{f.name}: {p.pattern}" for p in self.PATTERNS if p.search(text)]
        self.assertEqual(hits, [])

    def test_private_folders_ignored(self):
        ignore = (ROOT / ".gitignore").read_text(encoding="utf-8")
        for entry in ("wissen/", ".env", "*.sqlite3", "private/"):
            self.assertIn(entry, ignore)


if __name__ == "__main__":
    unittest.main()
