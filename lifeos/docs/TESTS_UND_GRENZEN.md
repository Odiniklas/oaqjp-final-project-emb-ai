# Tests: lokale Validierung und realistische Grenzen

## Tatsächlich durchgeführte Tests
Automatisierte `unittest`-Suite im Ordner `03_CLAUDE_CODE_REPOSITORY/tests`. Ergebnis siehe `TESTERGEBNIS.txt` in diesem Dokumentationsordner.
- SQLite-Schreib- und Suchoperationen, Projektfilter und Status-Validierung.
- Gekennzeichnetes DEMO-Wissen, Abstention bei fehlenden Quellen.
- Evaluationsfälle für Retrieval, Suchregel-Freigabe und Rollback.
- Agentenvorschläge benötigen Freigabe; Definition ist nicht Ausführung.
- Markdown-Zerlegung, Dryrun, idempotenter Import, Warnung bei Geheimnissen.
- 12 agentenbezogene YAML-Frontmatter-Dateien mit einer einfachen Strukturprüfung.
- 32 Promptdateien vorhanden; positive/negative Rechenbeispiele für NPV, Peak-Screening und Arbitrage.

## Was damit NICHT getestet ist
- Tatsächliche Bedienbarkeit aller Funktionen in einer konkreten Claude-Code-/Claude-Projects-Version.
- Echtzeit-Webrecherche, Claude-API-Antwortqualität, Agenten-Koordination und Live-Konnektoren.
- Semantisches RAG mit Vektorsuche oder reproduzierbare Prompt-Qualität an einer menschlich annotierten Testmenge.
- Prompt-Injection-Resistenz gegen leistungsfähige aktive Gegner (nur strukturierte Grenzen, keine Red-Team-Zertifizierung).
- Rechtliche bzw. wirtschaftliche Realisierbarkeit eines tatsächlichen EnergieHub-Business-Cases.

## Wie du ehrlich Verbesserung misst
Vergleiche Baseline und Kandidat auf denselben repräsentativen Fragen mit vorab festgelegter Ground Truth und separat gehaltenem Holdout. Metriken: korrekte Quellen, Behauptungsfehler, Abstention, Kosten, Korrekturaufwand, Sicherheitsausfälle. Kleine Demos beweisen nur funktionierende Softwarebausteine, nicht, dass eine KI generell intelligenter geworden ist.
