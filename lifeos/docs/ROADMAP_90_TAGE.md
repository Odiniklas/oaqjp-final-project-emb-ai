# Entwicklungsroadmap: 90 Tage – Vorschlag, kein bereits gestarteter Zeitplan

## Woche 1–2: Setup, Datenschutz, erster echter Use Case
- Claude-Projekt mit kurzen Regeln und ausgewählten Wissensakten einrichten.
- Die vorhandenen Statusangaben auf Widersprüche/Überalterung prüfen.
- Erste reale, zur Verarbeitung freigegebene Gesprächsnotiz im Knowledge-Curator-Prompt durchgehen.
- Lokal Python-Tests laufen lassen; bewusst nur anonymisierte Dokumente importieren.
**Erfolg:** 1 belastbarer Wissens-Patch, 1 realer Research-Output, unveränderte sichere Testbilanz.

## Woche 3–4: Quellenqualität und Forschungsbasis
- Forschungs-/EnergieHub-Fragen in 10–20 konkrete Claims zerlegen.
- Für wesentliche Netz-/CAPEX-/H2-/Partnerannahmen offizielle Originalquellen ergänzen.
- Simple Retrieval-Benchmark erweitern: 15 Fragen, klare Ground Truth und Unbekannt-Fälle.
- Forschungsdesign + Datenkatalog als getrennte Outputs standardisieren.
**Erfolg:** nachvollziehbare Quellenmatrix, keine als bestätigt dargestellte nicht verifizierte Kooperation.

## Woche 5–6: Wirtschaftlichkeit und Datenmodell
- Ein nicht vertrauliches synthetisches Beispiel-Lastprofil aufbauen.
- Baseline ohne Koordination gegenüber einer BESS-/EMS-Hypothese vergleichen.
- Modellrechnung validieren und Einschränkungen zum Dispatch offenlegen.
- Erst danach ggf. echtes Lastprofil von Partnern mit Berechtigung erfragen.
**Erfolg:** nachvollziehbare Modellannahmen und robuste Tests statt ROI-Behauptung.

## Woche 7–8: Spezialisierte Agenten und Marketing
- Nur 1–2 zusätzlich benötigte Agenten aktivieren.
- Research vs. Single-Agent an identischem Testset vergleichen.
- B2B-Marketingstrategie mit Zielsegment, Pilotgespräch und zwei Botschaftentests erstellen.
- Datenschutz-/IP-Hürden für Kontakte prüfen.
**Erfolg:** messbarer Qualitätsgewinn oder dokumentierte Entscheidung gegen zusätzliche Agenten.

## Woche 9–10: Automations-Prototyp
- Ein passendes wöchentliches Review als reproduzierbaren manuellen Workflow umsetzen.
- Inputaktualität, Fehlerpfade, Zeit-/Kostenbudget und Benachrichtigungslogik definieren.
- Nur falls benötigte Werkzeuge/Erlaubnis bestehen, Scheduler integrieren.
**Erfolg:** 2 reproduzierbare Wochenreviews mit nachvollziehbarem Aufwand und Korrekturbedarf.

## Woche 11–13: Evaluierung, Sicherheit, Skalierung
- 30–50 realitätsnahe Fragen/Tasks, getrennte Holdout-Beispiele, Red-Team-Szenarien.
- Agent-Builder darf zunächst Agentenspezifikationen und Testfälle, nicht automatisch aktive Programme liefern.
- Rollback-Prozess pro Prompt-/Agentenänderung testen.
- Entscheidung über Vektorsuche, LangGraph und API-Budget auf Grundlage gemessener Engpässe.
**Erfolg:** nachvollziehbares System mit belastbaren Grenzen – keine unbewiesene Behauptung über Selbsttraining.

**Zeitbedarf:** abhängig von Python-Vorkenntnissen und Datenzugang. Einsteiger können für diese Phasen länger benötigen; dieser Plan ist kein Terminversprechen.
