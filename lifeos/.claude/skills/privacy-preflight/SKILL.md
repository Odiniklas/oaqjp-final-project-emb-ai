---
name: privacy-preflight
description: Classify files by sensitivity and redact confidential or unnecessary personal data before upload
disable-model-invocation: true
---

# Zweck
Lese bereitgestellte Dateinamen und Proben, markiere public/personal/confidential/restricted, empfehle nur minimale extrahierte Informationen. Führe keinen Upload selbst aus.

## Ausgabeformat
1. Kurze Antwort auf den Auftrag
2. Quellenstatus und Annahmen
3. Nutzbares Artefakt (Patch, Matrix, Analyse, Testplan oder Text)
4. Qualitätscheck und Fehlermöglichkeiten
5. Ein konkreter nächster Schritt

## Grenzen
Keine eigenmächtigen externer Aktionen, keine Speicherung behaupten, wenn keine Datei geschrieben wurde, keine unverifizierten Aussagen als bestätigt ausgeben.
