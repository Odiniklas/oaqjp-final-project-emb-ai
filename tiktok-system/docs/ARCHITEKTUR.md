# Architektur

```
 Claude (Abo oder API)           Repo (GitHub)                       Ausgabe
 ─────────────────────           ─────────────                       ───────
 Themen + Recherche  ──JSON──▶  content/queue/<id>.json
 Skript + Szenen                     │ validate (Schema, Quellen, KI-Kennzeichnung)
                                     ▼
                                Voiceover   ElevenLabs (produktiv) │ espeak-ng (nur Modus A)
                                     │      → Audio + Wort-Zeitstempel
                                     ▼
                                Remotion    1080×1920, H.264, Untertitel aus Zeitstempeln
                                     ▼
                                QA          Technik (ffprobe), Ton, Untertitel, Dubletten,
                                            Belege, Lizenzen, KI-Hinweis, Kostenlimit
                                     ▼
                                Ledger      data/ledger.json: Status, Kosten, Upload-Schlüssel
                                     ▼
            Modus A: Ende │ Modus B: Freigabe (CLI oder n8n-Mail) │ Modus C: nur wenn voll aktiviert
                                     ▼
                                Buffer      geplanter Post, danach Statusprüfung
```

## Module
| Ordner | Aufgabe | Status |
| --- | --- | --- |
| `src/lib/schema.js` | Content-Paket prüfen | getestet |
| `src/lib/ledger.js` | Statusautomat, Kosten, Dubletten, Upload-Schlüssel | getestet |
| `src/voice/` | ElevenLabs mit Zeitstempeln, espeak-ng als Teststimme | espeak getestet; ElevenLabs **nicht getestet** (kein Schlüssel) |
| `src/render/` | Remotion-Komposition, Szenenzeiten, Untertitel | getestet (E2E) |
| `src/qa/` | automatische Prüfung | getestet |
| `src/caption/` | Beschreibung, Hashtags, Quellen-Kommentar | getestet |
| `src/publish/` | Modus-Sperren, Idempotenz, Buffer-GraphQL | Logik getestet (Mock); Buffer-API **nicht getestet** |
| `n8n/` | Zeitplan, Freigabe per Mail, Statusprüfung, Fehlermeldung | JSON geprüft; in n8n **nicht getestet** |

## Statusautomat
`planned → rendered → qa_passed → (awaiting_approval →) approved → scheduled → published`
Abzweige: `qa_failed`, `rejected`, `publish_failed`. Unerlaubte Sprünge werfen einen Fehler.

## Schutz vor doppelten Uploads
Schlüssel = SHA-256 aus Kanal + Videodatei-Hash. Vor dem API-Aufruf wird `sending` gespeichert;
existiert für den Schlüssel `sending`, `scheduled` oder `published`, wird kein zweiter Upload gestartet.
Ein abgebrochener Lauf mit `sending` muss von Hand im Buffer-Konto geprüft werden.

## Weitere Kanäle
`config/channel.json → channels` enthält Instagram Reels und YouTube Shorts (deaktiviert). Das Format
1080×1920 passt für alle drei; der Buffer-Adapter nimmt die Kanal-ID aus `BUFFER_<KANAL>_CHANNEL_ID`.
Der Upload-Schlüssel ist je Kanal getrennt.
