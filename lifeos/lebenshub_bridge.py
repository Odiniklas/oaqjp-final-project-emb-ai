"""Brücke zwischen dem lokalen LifeOS-Gedächtnis (SQLite) und der App „Lebenshub“.

Nur lokale Dateien, kein Netzwerk, keine Modellaufrufe. Die Brücke schreibt nie
direkt in den Lebenshub: Sie erzeugt eine Inbox-Datei, die du (oder ein
Claude-Job) prüfst und dann bewusst in die Artefakt-Datenbank (collection
"inbox") legst. Die App übernimmt die Aktionen beim nächsten Öffnen.

Befehle:
  validate-claim <claim.json>              Claim gegen das LifeOS-Schema prüfen
  to-inbox  --out inbox.json [--project p] Gedächtnis -> Lebenshub-Inbox (add_knowledge)
  from-know <know.json> [--apply --confirm-data-rights]
                                           Lebenshub-Wissen -> lokales Gedächtnis
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

from agentic_ai import DEFAULT_DB, add_memory, open_db
from lifeos_tools import scan_text

CLAIM_STATUSES = {"user_reported", "externally_verified", "assumption", "hypothesis", "open", "superseded", "demo"}
SENSITIVITIES = {"public", "personal", "confidential", "restricted"}
CONFIDENCE = {"low", "medium", "high"}
RECORD_TYPES = {"claim", "fact", "hypothesis", "decision", "task", "contact", "source", "learning"}
REQUIRED = ("id", "project_id", "record_type", "statement", "status", "source_id", "observed_at", "sensitivity", "confidence_level", "version")
DATE_RE = re.compile(r"\d{4}-\d{2}-\d{2}\Z")
# Gedächtnis-Status (agentic_ai) -> Kennzeichnung im Lebenshub
STATUS_LABEL = {"reported": "Nutzerbericht", "verified": "extern belegt", "hypothesis": "Hypothese", "stale": "veraltet", "demo": "Demo"}
MAX_ACTIONS = 60  # Obergrenze der App je Inbox-Dokument


def _is_date(v: Any) -> bool:
    if not isinstance(v, str) or not DATE_RE.match(v):
        return False
    try:
        date.fromisoformat(v)
        return True
    except ValueError:
        return False


def validate_claim(claim: dict[str, Any]) -> list[str]:
    """Prüft einen Claim nach CLAIM_TEMPLATE.json. Leere Liste = gültig."""
    if not isinstance(claim, dict):
        return ["Claim muss ein JSON-Objekt sein"]
    errors = [f"Feld fehlt: {f}" for f in REQUIRED if claim.get(f) in (None, "")]
    if claim.get("record_type") and claim["record_type"] not in RECORD_TYPES:
        errors.append("record_type ungültig")
    if claim.get("status") and claim["status"] not in CLAIM_STATUSES:
        errors.append("status ungültig")
    if claim.get("sensitivity") and claim["sensitivity"] not in SENSITIVITIES:
        errors.append("sensitivity ungültig")
    if claim.get("confidence_level") and claim["confidence_level"] not in CONFIDENCE:
        errors.append("confidence_level ungültig")
    for f in ("source_date", "observed_at", "valid_until"):
        v = claim.get(f)
        if v not in (None, "", "unbekannt") and not _is_date(v):
            errors.append(f"{f} kein gültiges Datum JJJJ-MM-TT")
    stmt = claim.get("statement")
    if isinstance(stmt, str) and not 10 <= len(stmt.strip()) <= 1000:
        errors.append("statement: 10 bis 1000 Zeichen")
    if not isinstance(claim.get("version"), int) or claim.get("version", 0) < 1:
        errors.append("version muss eine ganze Zahl >= 1 sein")
    if claim.get("status") == "externally_verified" and not str(claim.get("source_id", "")).strip().lower().startswith(("http", "doi:", "dokument")):
        errors.append("externally_verified braucht eine prüfbare Quelle (Link, DOI oder Dokument)")
    if claim.get("sensitivity") == "restricted":
        errors.append("restricted-Claims gehören nicht in Cloud-Dienste oder den Lebenshub")
    if isinstance(stmt, str) and scan_text(stmt):
        errors.append("statement enthält mögliche sensible Inhalte")
    return errors


def memories_to_inbox(db, *, project: str | None = None, include_demo: bool = False, today: str | None = None) -> dict[str, Any]:
    """Erzeugt ein Lebenshub-Inbox-Dokument mit add_knowledge-Aktionen."""
    sql = "SELECT * FROM memories WHERE status != 'stale'"
    params: list[Any] = []
    if not include_demo:
        sql += " AND status != 'demo'"
    if project:
        sql += " AND project = ?"
        params.append(project.lower())
    rows = [dict(r) for r in db.execute(sql + " ORDER BY id", params)]
    actions, skipped = [], []
    for r in rows:
        if scan_text(r["content"]):
            skipped.append(r["id"])
            continue
        first = r["content"].strip().splitlines()[0]
        title = (first[:90] + "…") if len(first) > 90 else first
        actions.append({
            "tool": "add_knowledge", "title": f"[{r['project']}] {title}", "kind": "Notiz",
            "source": f"LifeOS-Gedächtnis M{r['id']} · {r['source']}",
            "summary": r["content"][:4000],
            "points": [f"Status: {STATUS_LABEL.get(r['status'], r['status'])}", f"Vertrauen (Heuristik): {r['confidence']:.2f}", f"Erfasst: {r['created_at'][:10]}"],
            "tags": ["LifeOS", r["project"], STATUS_LABEL.get(r["status"], r["status"])],
            "status": "Zu lesen",
        })
        if len(actions) >= MAX_ACTIONS:
            break
    stamp = today or datetime.now(timezone.utc).date().isoformat()
    return {"source": "LifeOS-Gedächtnis", "at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "summary": f"{len(actions)} Einträge aus dem lokalen LifeOS-Gedächtnis" + (f" (Projekt {project})" if project else "") + f", Stand {stamp}.",
            "actions": actions, "_skipped_sensitive_ids": skipped}


def know_to_memories(db, know: Any, *, confirmed: bool = False) -> dict[str, Any]:
    """Übernimmt Lebenshub-Wissenseinträge (parts/know) ins lokale Gedächtnis – idempotent."""
    items = know.get("data") if isinstance(know, dict) else know
    if not isinstance(items, list):
        raise ValueError("Erwartet eine Liste von Wissenseinträgen oder {\"data\": [...]}")
    plan, skipped = [], []
    for k in items:
        if not isinstance(k, dict) or not k.get("id") or not k.get("title"):
            continue
        text = k["title"] + "\n" + (k.get("summary") or "") + "".join("\n- " + str(p) for p in (k.get("points") or []))
        if scan_text(text):
            skipped.append(k["id"])
            continue
        tags = [str(t).lower() for t in (k.get("tags") or [])]
        project = re.sub(r"[^a-z0-9_-]+", "-", tags[0]).strip("-")[:40] if tags else "allgemein"
        plan.append((project or "allgemein", text[:7900], f"lebenshub:know/{k['id']}"))
    if not confirmed:
        return {"result": "DRY RUN – nichts gespeichert", "would_add": len(plan), "skipped_sensitive": skipped}
    added = unchanged = 0
    for project, text, source in plan:
        if db.execute("SELECT 1 FROM memories WHERE source=?", (source,)).fetchone():
            unchanged += 1
            continue
        add_memory(db, project=project, content=text, source=source, status="reported", confidence=0.5)
        added += 1
    return {"added": added, "unchanged": unchanged, "skipped_sensitive": skipped,
            "note": "Status 'reported': Lebenshub-Inhalte gelten nicht als extern verifiziert."}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="LifeOS <-> Lebenshub (nur lokale Dateien)")
    p.add_argument("--db", default=str(DEFAULT_DB))
    sub = p.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate-claim"); v.add_argument("file", type=Path)
    t = sub.add_parser("to-inbox"); t.add_argument("--out", type=Path, required=True); t.add_argument("--project"); t.add_argument("--include-demo", action="store_true")
    f = sub.add_parser("from-know"); f.add_argument("file", type=Path); f.add_argument("--apply", action="store_true"); f.add_argument("--confirm-data-rights", action="store_true")
    a = p.parse_args(argv)
    try:
        if a.cmd == "validate-claim":
            errs = validate_claim(json.loads(a.file.read_text(encoding="utf-8")))
            print(json.dumps({"valid": not errs, "errors": errs}, ensure_ascii=False, indent=2))
            return 0 if not errs else 1
        with open_db(a.db) as db:
            if a.cmd == "to-inbox":
                doc = memories_to_inbox(db, project=a.project, include_demo=a.include_demo)
                a.out.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
                print(f"{len(doc['actions'])} Aktionen nach {a.out} geschrieben – vor dem Einspielen prüfen.")
            else:
                if a.apply and not a.confirm_data_rights:
                    p.error("Schreiben erfordert zusätzlich --confirm-data-rights")
                res = know_to_memories(db, json.loads(a.file.read_text(encoding="utf-8")), confirmed=a.apply)
                print(json.dumps(res, ensure_ascii=False, indent=2))
    except (ValueError, json.JSONDecodeError, OSError) as exc:
        print(f"Fehler: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
