import os
from pathlib import Path
import tempfile
import unittest

from agentic_ai import (open_db, add_memory, search_memory, ask, evaluate_retrieval,
                        seed_demo, propose_policy, propose_agent, approve, rollback,
                        active_policy, status)


class AgenticMVPTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = open_db(Path(self.tmp.name) / "test.sqlite3")

    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()

    def test_empty_knowledge_abstains(self):
        self.assertIn("Keine passenden", ask(self.db, "Unbekannte Batterie Netze", project="energiehub"))

    def test_demo_and_retrieval(self):
        self.assertEqual(seed_demo(self.db), 3)
        self.assertEqual(seed_demo(self.db), 0)
        hit = search_memory(self.db, "Batteriespeicher Netzrestriktionen", "energiehub")
        self.assertEqual(hit[0]["source"], "demo:energie")

    def test_scope_filter(self):
        seed_demo(self.db)
        self.assertEqual([], search_memory(self.db, "Zahlungsbereitschaft", "energiehub"))

    def test_provenance_and_uncertainty(self):
        seed_demo(self.db)
        text = ask(self.db, "Wie relevant sind Netzrestriktionen für Batteriespeicher?", project="energiehub")
        self.assertIn("Status: hypothesis", text)
        self.assertIn("[M", text)
        self.assertIn("DEMO", text)

    def test_memory_validation(self):
        with self.assertRaises(ValueError):
            add_memory(self.db, project="p", content="x", source="s", confidence=1.2)
        with self.assertRaises(ValueError):
            add_memory(self.db, project="p", content="x", source="s", status="verified_by_ai")

    def test_stale_excluded(self):
        add_memory(self.db, project="p", content="Batteriespeicher alte Planung", source="datei", status="stale")
        self.assertFalse(search_memory(self.db, "Batteriespeicher", "p"))

    def test_evaluation_suite(self):
        seed_demo(self.db)
        score = evaluate_retrieval(self.db, 2)
        self.assertEqual(score["passed"], 4)
        self.assertEqual(score["total"], 4)

    def test_no_gain_no_approval(self):
        seed_demo(self.db)
        pid = propose_policy(self.db, 3)
        with self.assertRaisesRegex(ValueError, "Keine messbare Verbesserung"):
            approve(self.db, pid)
        self.assertEqual(active_policy(self.db)["version"], 1)

    def test_benchmark_improvement_version_and_rollback(self):
        seed_demo(self.db)
        # Eigener Testdatensatz: erstes Resultat landet bei Limit 1 hinter dem Ziel.
        cases = [dict(question="Batteriespeicher Netzrestriktionen", project="energiehub", expected_source="demo:energie")]
        self.assertEqual(evaluate_retrieval(self.db, 2, cases)["passed"], 1)
        current = active_policy(self.db)
        self.assertEqual(current["max_results"], 2)
        version = rollback(self.db, 1)
        self.assertEqual(active_policy(self.db)["version"], version)
        self.assertEqual(active_policy(self.db)["max_results"], 2)

    def test_agent_registration_requires_approval(self):
        pid = propose_agent(self.db, name="grid-research", role="research", purpose="Liest Quellen zu Netzanschlüssen und bewertet Unsicherheiten")
        self.assertEqual(len(status(self.db)["approved_agent_definitions"]), 0)
        self.assertIn("noch keine ausführbare", approve(self.db, pid))
        self.assertEqual(status(self.db)["approved_agent_definitions"][0]["status"], "approved_definition")

    def test_invalid_agent_name_blocked(self):
        with self.assertRaises(ValueError):
            propose_agent(self.db, name="../unsafe", role="research", purpose="Research battery storage projects")

    def test_llm_off_by_default(self):
        seed_demo(self.db)
        result = ask(self.db, "Batteriespeicher Netzrestriktionen", project="energiehub")
        self.assertIn("keine KI-generierte", result)
        self.assertEqual(self.db.execute("SELECT mode FROM turns ORDER BY id DESC LIMIT 1").fetchone()[0], "local_retrieval")

    def test_no_api_key_no_remote_call(self):
        seed_demo(self.db)
        old = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            with self.assertRaisesRegex(RuntimeError, "ANTHROPIC_API_KEY"):
                ask(self.db, "Batteriespeicher Netzrestriktionen", project="energiehub", llm=True)
        finally:
            if old is not None:
                os.environ["ANTHROPIC_API_KEY"] = old


if __name__ == "__main__":
    unittest.main()
