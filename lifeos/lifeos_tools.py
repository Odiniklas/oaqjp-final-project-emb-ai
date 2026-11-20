"""Offline tools for Claude LifeOS.

Only local files, no network, no model calls, no automated agent creation.
Python 3.10+. Imported document text is untrusted content.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from agentic_ai import add_memory, open_db, search_memory

ROOT = Path(__file__).resolve().parent
PROJECT_PATTERN = re.compile(r"[a-z][a-z0-9_-]{1,49}\Z")
SENSITIVE_HINTS = ("vertraulich", "confidential", "restricted", "personal data",
                   "passwort", "password", "personalnummer", "private key")
SECRET_PATTERNS = [
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----", flags=re.I),
    re.compile(r"\bsk-ant-[A-Za-z0-9_-]{10,}\b"),
    re.compile(r"\bsk-[A-Za-z0-9_-]{24,}\b"),
]


@dataclass(frozen=True)
class Section:
    title: str
    text: str
    source: str
    sha256: str


def parse_markdown(text: str, source_name: str, chunk_limit: int = 6000) -> list[Section]:
    """Extract small chunks with attributable local origin.

    Heading boundaries are respected when practical; long sections are chunked
    deterministically. This is NOT semantic chunking or document verification.
    """
    if not 200 <= chunk_limit <= 7000:
        raise ValueError("chunk_limit must be between 200 and 7000")
    chunks: list[Section] = []
    head = "Einleitung"
    buffer: list[str] = []
    def flush() -> None:
        nonlocal buffer
        body = "\n".join(buffer).strip()
        if not body:
            buffer = []
            return
        for start in range(0, len(body), chunk_limit):
            fragment = body[start:start + chunk_limit]
            digest = hashlib.sha256(fragment.encode('utf-8')).hexdigest()
            suffix = f"chunk-{start // chunk_limit + 1}"
            source = f"local:{source_name}#{re.sub(r'[^a-z0-9-]+', '-', head.lower()).strip('-')}/{suffix}:{digest[:12]}"
            chunks.append(Section(title=head, text=fragment, source=source, sha256=digest))
        buffer = []
    for ln in text.splitlines():
        if ln.startswith("# ") or ln.startswith("## "):
            flush()
            head = ln.lstrip("#").strip()[:120] or "Abschnitt"
        else:
            buffer.append(ln)
    flush()
    return chunks


def scan_text(text: str) -> list[str]:
    """Conservative warning scan; NOT a complete DLP or legal classification."""
    found: list[str] = []
    for hint in SENSITIVE_HINTS:
        if hint in text.lower():
            found.append(f"Prüfwörter enthalten: {hint}")
    for p in SECRET_PATTERNS:
        if p.search(text):
            found.append("Mögliches API-Key-/Private-Key-Muster erkannt")
    return sorted(set(found))


def preview_import(path: Path, project: str, chunk_limit: int = 6000) -> dict:
    if not PROJECT_PATTERN.fullmatch(project):
        raise ValueError("Projekt-ID: nur a-z, 0-9, Unterstriche und Bindestriche")
    path = path.expanduser().resolve(strict=True)
    if not path.is_file() or path.suffix.lower() not in {'.md', '.txt'}:
        raise ValueError("Nur vorhandene .md/.txt-Dateien")
    size = path.stat().st_size
    if size > 1_000_000:
        raise ValueError("Datei über 1 MB: vorab aufteilen")
    content = path.read_text(encoding='utf-8')
    sections = parse_markdown(content, path.name, chunk_limit=chunk_limit)
    if len(sections) > 200:
        raise ValueError("Zu viele Abschnitte")
    return {
        'project': project, 'path': str(path), 'size_bytes': size,
        'sections': sections, 'warnings': scan_text(content),
        'is_demonstration': bool(re.search(r'(?im)^\s*status:\s*demo\b', content)),
        'note': 'Die Quelle ist Nutzerdatei; keine externe Faktenverifikation.'
    }


def apply_import(db, preview: dict, *, confirmed: bool = False, status: str = 'reported') -> dict:
    if not confirmed:
        raise PermissionError("Explizite Freigabe fehlt (--apply --confirm-data-rights)")
    if status not in {'reported', 'hypothesis', 'stale', 'demo'}:
        raise ValueError("Import darf keine extern verifizierte Quelle automatisch behaupten")
    if preview.get('is_demonstration') and status != 'demo':
        raise ValueError('Demo-Dateien dürfen ausschließlich mit --status demo importiert werden')
    if preview['warnings']:
        raise PermissionError("Import gesperrt: mögliche sensible Inhalte. Redigiere Quelle und starte neu.")
    added, existing = 0, 0
    for section in preview['sections']:
        if db.execute("SELECT 1 FROM memories WHERE source=?", (section.source,)).fetchone():
            existing += 1
            continue
        add_memory(db, project=preview['project'], content=section.text[:7000],
                   source=section.source, scope='project', status=status, confidence=0.55)
        added += 1
    return {'added': added, 'unchanged': existing, 'status': status,
            'note': 'Lokaler Import; keine Übermittlung an Claude/Anthropic.'}


def list_prompts(path: Path) -> list[dict]:
    if not path.exists():
        return []
    records = []
    for file in sorted(path.glob('[0-9][0-9]_*.md')):
        if file.name.startswith('00_'):
            continue
        text = file.read_text(encoding='utf-8')
        header = next((ln.lstrip('#').strip() for ln in text.splitlines() if ln.startswith('# ')), file.stem)
        records.append({'file': file.name, 'title': header})
    return records


def verify_agents(path: Path) -> list[dict]:
    result=[]
    for file in sorted(path.glob('*.md')):
        data=file.read_text(encoding='utf-8')
        errors=[]
        if not data.startswith('---\n') or data.count('\n---\n') < 1:
            errors.append('YAML frontmatter fehlt/ungültig')
        lines=data.split('---',2)[1] if data.startswith('---') else ''
        for field in ('name:','description:','tools:'):
            if field not in lines:
                errors.append(f'{field} fehlt')
        if 'maxTurns:' not in lines:
            errors.append('maxTurns fehlt')
        result.append({'file':file.name, 'valid_basic_structure':not errors, 'errors':errors})
    return result


def main(argv: list[str] | None = None) -> int:
    parser=argparse.ArgumentParser(description='Claude LifeOS lokale Zusatzwerkzeuge')
    sub=parser.add_subparsers(dest='cmd',required=True)
    x=sub.add_parser('import-md', help='Voransicht; schreibt nur mit --apply --confirm-data-rights')
    x.add_argument('file',type=Path)
    x.add_argument('--project',required=True)
    x.add_argument('--db',default=str(Path.home()/'.claude_agentic_ai_mvp'/'brain.sqlite3'))
    x.add_argument('--apply',action='store_true')
    x.add_argument('--confirm-data-rights',action='store_true')
    x.add_argument('--status',choices=['reported','hypothesis','stale','demo'],default='reported')
    x.add_argument('--chunk-limit',type=int,default=6000)
    y=sub.add_parser('prompts')
    y.add_argument('--path',type=Path,default=ROOT/'prompts')
    z=sub.add_parser('agents')
    z.add_argument('--path',type=Path,default=ROOT/'.claude'/'agents')
    q=sub.add_parser('search')
    q.add_argument('question')
    q.add_argument('--project')
    q.add_argument('--db',default=str(Path.home()/'.claude_agentic_ai_mvp'/'brain.sqlite3'))
    args=parser.parse_args(argv)
    if args.cmd=='import-md':
        preview=preview_import(args.file,args.project,args.chunk_limit)
        summary={k:v for k,v in preview.items() if k!='sections'}
        summary['section_count']=len(preview['sections'])
        summary['sources']=[s.source for s in preview['sections'][:10]]
        if args.apply:
            if not args.confirm_data_rights:
                parser.error('Schreiben erfordert zusätzlich --confirm-data-rights')
            with open_db(args.db) as db:
                summary['result']=apply_import(db,preview,confirmed=True,status=args.status)
        else:
            summary['result']='DRY RUN – nichts gespeichert'
        print(json.dumps(summary,ensure_ascii=False,indent=2))
    elif args.cmd=='prompts':
        print(json.dumps(list_prompts(args.path),ensure_ascii=False,indent=2))
    elif args.cmd=='agents':
        print(json.dumps(verify_agents(args.path),ensure_ascii=False,indent=2))
    elif args.cmd=='search':
        with open_db(args.db) as db:
            print(json.dumps(search_memory(db,args.question,args.project),ensure_ascii=False,indent=2))
    return 0

if __name__=='__main__':
    raise SystemExit(main())
