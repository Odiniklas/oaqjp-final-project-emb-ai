# Architektur- und Technologieentscheidung

## 1. Warum nicht sofort 50 Agenten?
Mehragentensysteme kosten zusätzliche Token, erhöhen Fehlermodi (Informationsverlust, falsche Delegation, Konflikt zwischen Subagenten) und benötigen unabhängige Evaluation. Mit einem Router, einer Wissensquelle, 2–3 spezialisierten Rollen und einer kontrollierten Evaluierung sind die meisten persönlichen Use Cases günstiger und nachvollziehbarer abbildbar.

## 2. Funktionsarchitektur

```
NUTZER / CLAUDE PROJECTS / CLAUDE CODE
      |
      v
MASTER ROUTER -- Risiko/Autonomie-Check -- Freigabe
      |
      +----> Quellen + persönliches Wissensschema
      |         |-- Chat-Protokolle / Projektakten / Wissensclaims
      |         |-- Datums-/Quellenstatus / Sensitivität
      |         `-- SQLite-FTS5-Suche (MVP) / später Embeddings
      |
      +----> Research / Economics / Marketing / Venture / Career
      |
      +----> Evaluator (read-only)
      |
      `----> Agent-/Skill-Designer (DRAFT-Only)
                |
           Tests / Review / Benutzerfreigabe
                |
           versionierte Aktivierung / Rollback
```

## 3. Ist das 'KI-Gehirn' wirklich lernend?
- **Kontext:** hochgeladene Dateien geben Claude zusätzliche Informationen.
- **Persistenz:** SQLite und Projektdateien speichern Wissen über einzelne Sessions hinaus.
- **Retrieval:** Suchwerkzeuge holen zu einer Frage passende Claims zurück.
- **Arbeitsablauf-Lernen:** bewertete Beispiele können zu besseren Prompts, Skills und Workflowentscheidungen führen.
- **Modelltraining:** ändert die eigentlichen Modellgewichte; wird hier NICHT umgesetzt.

## 4. Stand des Python-Codes
**Implementiert:** SQLite-Basis, FTS5/LIKE-Lexikalsuche, Quellennachweise, Status, Audits, Demo-Benchmark, versionierte Suchregelentwürfe, Freigaben, Rollback, Agenten-Specs, CLI, Markdown/TXT-Dryrun-Import, Sensitivitätswarnungen, einfacher CAPEX/Arbitrage/NPV-Illustrator und Unit-Tests.
**Teilweise:** optionaler Anthropic-SDK-API-Aufruf bei gesetztem Key/Modell; kein echter API-Test in dieser Entwicklungsumgebung.
**Nicht implementiert:** externe Live-Recherche im Python-MVP, echte Embeddings/Reranker, autonome Agentenschleifen, Netzwerkisolation/Container-Sandbox für generierten Code, OAuth-Konnektoren, bedingte 24/7-Automationen, automatische Aktualisierung von Claude Projects.

## 5. Vergleich technische Wege
| Baustein | MVP | Ausbau | Warum |
|---|---|---|---|
| LLM Chat | Claude Projects | Claude Code/Anthropic SDK | Komplexität graduell steigern |
| Orchestrierung | Regelbasierte Router-Aufgaben | Claude Code Subagents/ggf. LangGraph | Erst nachdem Delegation Nutzen bringt |
| Speicherung | Markdown + SQLite | PostgreSQL und Suchindex | Lokale Kontrolle zuerst |
| Suche | SQLite FTS5 | Hybride Vektor-/Lexikalsuche | Embeddings nur bei echten Retrievallücken |
| Automationen | Manuelles Triggern | Scheduler + API + Freigabeschicht | Keine falsche Behauptung über Hintergrundläufe |
| Evaluation | deterministische Unit-Tests | Holdout/Red-Team/Task-Benchmark | Testen, was tatsächlich versprochen wird |
| Codeausführung | feste, lokal geprüfte Tests | containerisierte Sandbox | Agentenprompt ist keine Sicherheitsgrenze |

## 6. Grenze der Berechtigungsverwaltung
Claude-Code-Agenten haben dokumentierte Toolallowlist und Permission-Mode; diese begrenzen Agentfähigkeiten im jeweiligen Programmkontext. Für ernsthafte Sicherheitsgarantien sind Tool-Policies, Secret-Management, Rechtegrenzen auf Betriebssystemebene, getrennte Projekte, API-Quoten und Review erforderlich. Externe Quelltexte können Prompt-Injection enthalten; niemals als höhere Instruktion behandeln.

## 7. Kostenkontrolle
Messe Tokens pro Aufruf, Toolkosten, Erfolgsquote, Latenz, Korrekturquote, Datenabrufe und Ausfälle. Definiere ein tägliches/monatliches Budget nur für aktive API-Agenten. Ein Claude-Abonnement ist nicht dasselbe wie frei nutzbares API-Kontingent. Preise können sich ändern; vor Budgetentscheidung die aktuelle Anbieterpreisseite prüfen.

## 8. Evaluationsstrategie
- Unit-Tests für Validierung, Trennung von Projekten, Idempotenz, Freigaben, formale Rechenfehler.
- Retrieval-Benchmark mit nie beim Optimieren gesehenen Fragen; für jede Frage belastbare erwartete Quelle.
- Benchmark für faktische Richtigkeit und Quellenbelege mit menschlich validierter Ground Truth.
- Agententests mit harmlosen und adversarialen Eingaben, inkl. Prompt Injection, frei erfundenen Quellen und falscher Autonomiebehauptung.
- Entscheidung: nur wenn candidate bei echter Qualität besser ist, keine Sicherheitsverschlechterung und ausreichende Replizierbarkeit; anschließend Nutzerfreigabe.
