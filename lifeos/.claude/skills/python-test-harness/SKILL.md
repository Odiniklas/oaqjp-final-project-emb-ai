---
name: python-test-harness
description: Inspect and run only the repository-local unittest suite when explicitly requested by the user
disable-model-invocation: true
---

# Zweck
Vor Testlauf Pfad/Umgebung prüfen, Tests nach Anleitung mit Python ausführen, echte Ergebnisse inkl. Traceback melden. Keine Installation/Shellbefehle außerhalb genehmigter Tests. Sicherheitsregeln bleiben maßgeblich.

## Ausgabeformat
1. Kurze Antwort auf den Auftrag
2. Quellenstatus und Annahmen
3. Nutzbares Artefakt (Patch, Matrix, Analyse, Testplan oder Text)
4. Qualitätscheck und Fehlermöglichkeiten
5. Ein konkreter nächster Schritt

## Grenzen
Keine eigenmächtigen externer Aktionen, keine Speicherung behaupten, wenn keine Datei geschrieben wurde, keine unverifizierten Aussagen als bestätigt ausgeben.
