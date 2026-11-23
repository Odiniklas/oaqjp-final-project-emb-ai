# Betrieb

## Modi
| Modus | Was passiert | Veröffentlichung |
| --- | --- | --- |
| **A – Test** | komplettes Video inkl. QA; Test-Stimme erlaubt | nie (fest gesperrt) |
| **B – Freigabe** | Produktion automatisch, dann Freigabe-Anfrage (n8n-Mail oder `cli.js approve <id> --by <Name>`) | erst nach Freigabe |
| **C – Autonom** | wie B ohne Freigabe | nur wenn **alle** gelten: `mode: "C"` und `autonomous.enabled: true` in `config/channel.json`, `AUTOPUBLISH_CONFIRM=JA_AUTONOM_VEROEFFENTLICHEN`, QA ohne Fehler und ohne Warnungen, Tageslimit nicht erreicht |

Standard ist **A**. Modus C wird nur auf ausdrückliche Anweisung des Kanal-Inhabers aktiviert.

## Befehle
```
npm install
npm test                 # Unit-Tests (Logik, Sperren, Idempotenz, Workflow-Struktur)
npm run test:e2e         # rendert ein echtes Video in Modus A (ca. 1 Minute)
node src/cli.js produce content/examples/solarspitzen.json --mode A
node src/cli.js produce --next --mode B      # nächstes Paket aus content/queue
node src/cli.js approve <id> --by <Name>
node src/cli.js publish <id> --video-url <https-URL> [--at 2026-12-01T17:15:00Z]
node src/cli.js status <id>     node src/cli.js list     node src/cli.js costs
```
Ausgabe je Video: `output/<id>/video.mp4`, `voice.*`, `meta.json` (Beschreibung, Quellen, Aussagen), `qa.json`, `render-props.json`.

## n8n
1. `n8n/workflow.json` und `n8n/error-workflow.json` importieren; im Haupt-Workflow den Fehler-Workflow unter *Settings → Error workflow* eintragen.
2. Umgebungsvariablen in n8n: `TIKTOK_DIR` (Pfad zum Repo), `NOTIFY_FROM`, `NOTIFY_TO`, `MEDIA_UPLOAD_CMD`; SMTP-Credential für die Mail-Knoten.
3. Die Knoten „Execute Command“ sind in neueren n8n-Versionen standardmäßig deaktiviert und müssen bewusst erlaubt werden; Alternative: das CLI über einen kleinen HTTP-Dienst aufrufen.
4. Der Workflow ist **nicht in n8n getestet** – zuerst manuell ausführen und jeden Knoten prüfen.

## Kostenkontrolle
- Vor jeder Produktion: geschätzte Kosten gegen `budget.perVideoLimit` und `budget.monthlyLimit` (Abbruch bei Überschreitung).
- Tatsächliche Kosten je Video und Monat im Ledger (`cli.js costs`).
- Remotion rendert lokal (keine Renderkosten); Lizenz beachten (siehe RECHTLICHES.md).

## Fehlerbehandlung
- Jeder Schritt gibt eine JSON-Zeile mit `ok`, `step`, `errors` aus; Exit-Code ≠ 0 bei Fehler.
- QA-Fehler → Status `qa_failed`, keine Freigabe möglich. Buffer-Fehler → `publish_failed`, Fehlertext im Ledger.
- n8n meldet QA-Probleme und Laufzeitfehler per Mail.
