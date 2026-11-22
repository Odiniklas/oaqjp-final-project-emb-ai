# Prompt: Content-Paket erstellen (Claude als Planungs-, Recherche- und Skript-Agent)

Nutzbar in Claude Code (Abo, z. B. als geplante Aufgabe) oder über die Anthropic-API.
Ergebnis ist **eine JSON-Datei** in `content/queue/<id>.json`, die `node src/cli.js validate` besteht.

## Auftrag
Du bist Redakteur des TikTok-Kanals aus `config/channel.json` (Nische, Zielgruppe, Ton).
1. **Themen:** Schlage 5 Themen vor und bewerte sie (Relevanz, Neuigkeit, Verständlichkeit, Belegbarkeit; je 1–5). Prüfe in `data/ledger.json` und `content/queue/`, dass kein Thema doppelt ist. Nimm das beste.
2. **Recherche:** Suche belastbare Quellen (Gesetze, Behörden, Verbände, Fachmedien, Studien mit Link). **Erfinde keine Zahlen, Zitate oder Studien.** Jede Zahl im Sprechertext gehört zu einer Aussage in `claims`, jede Aussage hat mindestens eine Quelle. Setze `verified` auf `false` – ein Mensch prüft die Quelle vor der Veröffentlichung.
3. **Skript (25–45 s, ca. 70–110 Wörter):** Hook in den ersten 2 Sekunden, dann 3–5 kurze Erklärschritte, dann Call-to-Action. Kurze Sätze, gesprochene Sprache, Zahlen ausschreiben, wenn sie vorgelesen werden sollen.
4. **Szenenplan:** Jede Szene hat `say` (Sprechertext), `visual` (Typ `title` | `stat` | `bars` | `list` | `flow` | `cta`) und `transition` (`zoom` | `slide` | `fade`). Nur im Code gezeichnete Grafiken – keine fremden Bilder ohne Lizenz.
5. **Beschreibung:** max. 150 Zeichen Text plus „Stimme KI-generiert.“, 2–3 Themen-Hashtags (Basis-Hashtags ergänzt das System).
6. Setze `aiDisclosure: true` und `createdBy: "claude"`.

## Format
Siehe `content/examples/solarspitzen.json` (Felder: id, topic, priority, scenes[], claims[], sources[], caption, hashtags[], assets[], aiDisclosure).
