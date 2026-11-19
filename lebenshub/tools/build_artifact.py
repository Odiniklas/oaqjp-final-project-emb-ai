"""Baut die Lebenshub-Seite für den Betrieb als Claude-Artefakt (eine Datei, alles eingebettet).
Aufruf: python3 tools/build_artifact.py <ausgabe.html>"""
import pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
body = html[html.index('<body>') + 6:html.index('</body>')]
# Skripte einbetten (Reihenfolge wie in index.html)
def inline(m):
    src = (root / m.group(1)).read_text(encoding='utf-8')
    assert '</script' not in src, m.group(1)
    return '<script>\n' + src + '\n</script>'
body = re.sub(r'<script src="([^"]+)"></script>', inline, body)
css = (root / 'styles.css').read_text(encoding='utf-8')
out = ('<title>Lebenshub</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
       '<style>\n' + css + '\n</style>\n' + body.strip() + '\n')
pathlib.Path(sys.argv[1]).write_text(out, encoding='utf-8')
print(len(out), 'Zeichen')
