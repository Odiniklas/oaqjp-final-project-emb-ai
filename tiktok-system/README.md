# TikTok-Content-System

Modulares System: **Claude** plant, recherchiert und schreibt → **ElevenLabs** spricht → **Remotion** rendert 1080×1920 → automatische **QA** → **Freigabe** → **Buffer** plant den Post. Gesteuert per CLI oder **n8n**.

**Stand (ehrlich):**
| Baustein | Status |
| --- | --- |
| Content-Paket, Schema, Belegpflicht | ✅ getestet |
| Remotion-Rendering 1080×1920 H.264 mit Untertiteln | ✅ getestet (E2E, Beispielvideo 39,7 s) |
| QA (Technik, Ton, Untertitel, Dubletten, Belege, Lizenzen, KI-Hinweis) | ✅ getestet – fand im ersten Lauf einen echten Fehler (Pixelformat) |
| Modus-Sperren A/B/C, Schutz vor doppelten Uploads, Kostenlimits | ✅ getestet (Unit-Tests mit Mock) |
| Test-Stimme espeak-ng (nur Modus A) | ✅ getestet |
| ElevenLabs-Voiceover | ⏳ implementiert, **nicht getestet** – Schlüssel fehlt |
| Buffer-Veröffentlichung | ⏳ implementiert, **nicht getestet** – Token fehlt, GraphQL-Schema per `check` bestätigen |
| n8n-Workflow | ⏳ JSON geprüft, **in n8n nicht getestet** |
| Medien-Hosting für Buffer | ❌ offen |

Start: [docs/BETRIEB.md](docs/BETRIEB.md) · Aufbau: [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md) · Zugänge: [docs/API-ZUGAENGE.md](docs/API-ZUGAENGE.md) · Regeln: [docs/RECHTLICHES.md](docs/RECHTLICHES.md) · Agent-Prompt: [prompts/content-paket.md](prompts/content-paket.md)

```
npm install && npm test && npm run test:e2e
```
Standardmodus ist **A (Test)** – ohne ausdrückliche Freigabe wird nichts veröffentlicht.
