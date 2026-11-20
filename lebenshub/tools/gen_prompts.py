"""Erzeugt lebenshub/prompts_data.js aus den (neutralisierten) LifeOS-Fachprompts in ../lifeos/prompts.
Aufruf: python3 tools/gen_prompts.py   – danach Artefakt neu bauen."""
import json, pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
src = root.parent / 'lifeos' / 'prompts'
AREAS = [((1, 2), 'Wissen & Gespräche'), ((3, 8), 'Forschung & EnergieHub'), ((9, 15), 'Startup & Marketing'),
         ((16, 18), 'Karriere & Gespräche'), ((19, 20), 'Finanzen & Immobilien'), ((21, 24), 'KI, Agenten & Python'),
         ((25, 32), 'Planung & Prüfung')]

def area(n):
    return next(a for (lo, hi), a in AREAS if lo <= n <= hi)

def section(text, name):
    m = re.search(r'^## ' + re.escape(name) + r'\s*\n(.*?)(?=^## |\Z)', text, flags=re.S | re.M)
    return m.group(1).strip() if m else ''

out = []
for f in sorted(src.glob('[0-9][0-9]_*.md')):
    n = int(f.name[:2])
    if n == 0:
        continue
    t = f.read_text(encoding='utf-8')
    title = re.search(r'^# PROMPT \d+ — (.+)$', t, flags=re.M).group(1).strip()
    body = re.split(r'^## Wiederverwendbare Folgeanweisung', t, flags=re.M)[0].strip()
    goal = re.search(r'Deine konkrete Aufgabe ist es, \*\*(.+?)\*\*', t)
    out.append({'n': n, 'title': title, 'area': area(n), 'goal': goal.group(1) if goal else '',
                'ex': section(t, 'Beispielauftrag'), 'body': body})
assert len(out) == 32, len(out)
js = ('/* Automatisch erzeugt von tools/gen_prompts.py aus lifeos/prompts – nicht von Hand ändern. */\n'
      "'use strict';\nconst PROMPTS = " + json.dumps(out, ensure_ascii=False) + ';\n')
assert '</script' not in js
(root / 'prompts_data.js').write_text(js, encoding='utf-8')
print(len(out), 'Prompts,', len(js), 'Zeichen')
