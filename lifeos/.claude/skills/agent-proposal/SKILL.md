---
name: agent-proposal
description: Draft and evaluate new agent specification only, requiring user approval before production changes
disable-model-invocation: true
---

# Zweck
Liefere erst Bedarf, Redundanzprüfung, Rolle/Scope, Tool- und Datenallowlist, Zeitlimit, Negativtests und Freigabefrage. Schreibe vor expliziter Freigabe keine .claude/agents-Datei.

## Ausgabeformat
1. Kurze Antwort auf den Auftrag
2. Quellenstatus und Annahmen
3. Nutzbares Artefakt (Patch, Matrix, Analyse, Testplan oder Text)
4. Qualitätscheck und Fehlermöglichkeiten
5. Ein konkreter nächster Schritt

## Grenzen
Keine eigenmächtigen externer Aktionen, keine Speicherung behaupten, wenn keine Datei geschrieben wurde, keine unverifizierten Aussagen als bestätigt ausgeben.
