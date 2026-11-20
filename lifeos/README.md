# Claude LifeOS – lokales Python- und Claude-Code-Repository

> Teil dieses Repositorys neben der App `lebenshub/`. **Persönliche Wissensakten liegen nicht hier**, sondern privat im Lebenshub (Bereich Wissen, Tag „LifeOS“). Der Ordner `wissen/` ist per `.gitignore` ausgeschlossen und nur für eine lokale Kopie gedacht. Beispielzeilen in `prompts/` sind neutralisiert.

## Voraussetzungen
- Python 3.10 oder neuer.
- Für Claude Code zusätzlich die Claude-Code-Installation und ein passender Claude-Zugang; **nicht** für lokale Python-Tests erforderlich.
- Externer Anthropic API-Key nur bei expliziter Nutzung von `--llm`. Wähle eine gültige Modellkennung gemäß aktueller Dokumentation und setze `ANTHROPIC_MODEL`.

## Vollständig offline testen
```bash
python3 -m unittest discover -s tests -v
python3 agentic_ai.py init
python3 agentic_ai.py seed-demo
python3 agentic_ai.py evaluate
python3 agentic_ai.py status
python3 lifeos_tools.py agents
python3 lifeos_tools.py prompts
```
Unter Windows `python` statt `python3`.

## Lokalen Wissenseintrag speichern
```bash
python3 agentic_ai.py remember --project flexgrid --text "HYPOTHESE: Netzrestriktionen könnten Cluster-EMS wirtschaftlich interessant machen." --source "eigene-idee-2026-11-20" --status hypothesis --confidence 0.3
python3 agentic_ai.py ask "Cluster EMS Netzrestriktionen" --project flexgrid
```

## Lokalen Markdown-Import bewusst durchführen
```bash
python3 lifeos_tools.py import-md import_vorlagen/BEISPIEL_ANONYMISIERTE_NOTIZ.md --project flexgrid
python3 lifeos_tools.py import-md import_vorlagen/BEISPIEL_ANONYMISIERTE_NOTIZ.md --project flexgrid --apply --confirm-data-rights --status demo
```
Wenn der Beispieldateipfad nicht mehr stimmt, verwende den tatsächlichen Pfad der Datei. Bei Warnungen über sensible Daten wird der Import gesperrt; reduziere die Datei auf die erforderlichen nicht vertraulichen Informationen.

## Brücke zum Lebenshub (`lebenshub_bridge.py`)
```bash
python3 lebenshub_bridge.py validate-claim import_vorlagen/CLAIM_TEMPLATE.json   # Claim gegen das Schema prüfen
python3 lebenshub_bridge.py to-inbox --out inbox.json --project flexgrid         # Gedächtnis -> Inbox-Datei für die App
python3 lebenshub_bridge.py from-know know.json                                  # Vorschau: Lebenshub-Wissen -> Gedächtnis
python3 lebenshub_bridge.py from-know know.json --apply --confirm-data-rights    # tatsächlich lokal übernehmen
```
Die Brücke schreibt nie selbst in den Lebenshub. Die erzeugte Inbox-Datei prüfst du und legst sie bewusst in die Artefakt-Datenbank (collection `inbox`); die App übernimmt sie beim Öffnen. Sensible Inhalte (Prüfwörter, Schlüsselmuster) werden übersprungen.

## Agenten-Vorschlag und Freigabe (nur Definition)
```bash
python3 agentic_ai.py propose-agent --name b2b-research --role research --purpose "Liest freigegebene B2B EnergieHub-Quellen und dokumentiert Unsicherheiten"
python3 agentic_ai.py proposals
# Nach expliziter Entscheidung:
python3 agentic_ai.py approve 1
```
Diese Freigabe speichert **nur** eine Agentenspezifikation in SQLite. Sie erzeugt und startet keinen neuen ausführbaren Agenten.

## In Claude Code
Starte im Repository `claude`. `CLAUDE.md` wird als Projektanweisung eingelesen; `.claude/agents/` enthält 12 Subagenten-Konfigurationen und `.claude/skills/` 12 Skills. Prüfe in deiner Claude-Code-Version, ob die Komponenten geladen werden. Die Agenten sind vorsichtig mit Toolallowlists, aber kein vollständiges Betriebssystem-Sandboxing.

## API-Modus (optional, separat kostenpflichtig)
```bash
python3 -m pip install anthropic
export ANTHROPIC_API_KEY='DEIN_PRIVATER_API_KEY'
export ANTHROPIC_MODEL='AKTUELL_GUELTIGE_MODELL_ID'
python3 agentic_ai.py ask "Netzrestriktionen und Batteriespeicher" --project flexgrid --llm
```
Nicht `AKTUELL_GUELTIGE_MODELL_ID` als echte ID verwenden. Schlage die exakte aktuelle Modellkennung bei Anthropic nach. `--llm` sendet Frage, relevante gespeicherte Ausschnitte und einige gekürzte frühere Dialogrunden an Anthropic; vorher Datenfreigabe prüfen.

## Modellbeispiel
Das Modul `energyhub_model.py` berechnet einfache NPV-, Arbitrage- und Lastspitzen-Screenings. **Es simuliert keinen stundenscharfen Speicherbetrieb, keine Batteriealterung und keine verbindlichen Netzentgelte.** Alle Ergebnisse nur als didaktische Beispielrechnung verwenden.

## Tests und Grenzen
Die Tests prüfen deterministische Codefunktionen und Schemas. Die laufende Claude-Agenten-Koordination, externe APIs, tatsächliche Sicherheitsisolation und eine reale Verbesserung der Modellintelligenz werden nicht durch die Tests nachgewiesen.
