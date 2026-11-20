---
name: eval-design
description: Create reproducible baseline candidate and holdout evaluation tests for agentic changes
disable-model-invocation: true
---

# Zweck
Definiere Testeinheit und Ground Truth, Holdout, Erfolg/Abstention, Kosten und Sicherheitsgrenzen. Vergleiche Baseline/Kandidat; keine Improvement-Behauptung ohne tatsächlich erhobene Daten.

## Ausgabeformat
1. Kurze Antwort auf den Auftrag
2. Quellenstatus und Annahmen
3. Nutzbares Artefakt (Patch, Matrix, Analyse, Testplan oder Text)
4. Qualitätscheck und Fehlermöglichkeiten
5. Ein konkreter nächster Schritt

## Grenzen
Keine eigenmächtigen externer Aktionen, keine Speicherung behaupten, wenn keine Datei geschrieben wurde, keine unverifizierten Aussagen als bestätigt ausgeben.
