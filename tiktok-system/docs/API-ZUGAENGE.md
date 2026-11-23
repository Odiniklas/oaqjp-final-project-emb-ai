# API-Zugänge und Geheimnisse

Alle Schlüssel nur in `.env` (lokal, in `.gitignore`) oder als Credentials in n8n bzw. GitHub Actions Secrets – **nie im Repository**.

| Dienst | Variable | Wofür | Status |
| --- | --- | --- | --- |
| ElevenLabs | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID` | deutscher Voiceover mit Zeitstempeln (`POST /v1/text-to-speech/{voice}/with-timestamps`) | nicht getestet |
| Buffer | `BUFFER_ACCESS_TOKEN`, `BUFFER_TIKTOK_CHANNEL_ID`, optional `BUFFER_API_URL` | geplante Veröffentlichung (GraphQL, Bearer-Token) | nicht getestet |
| Medien-Hosting | `MEDIA_UPLOAD_CMD` (n8n) | Buffer braucht eine öffentlich erreichbare Video-URL | offen – Anbieter wählen |
| Anthropic (optional) | `ANTHROPIC_API_KEY` | Content-Pakete ohne Claude Code erzeugen | optional |
| Remotion | `REMOTION_BROWSER` | Pfad zu Chrome Headless Shell | getestet |

## Erste Prüfung
```
cp .env.example .env    # Werte eintragen
node src/cli.js check   # testet jede Integration einzeln
```
`check` fragt bei Buffer das Live-Schema ab (Introspection). Fehlt dort `createPost`, die Operationen in
`config/buffer.graphql` an die aktuelle Doku (https://developers.buffer.com) anpassen und erneut prüfen.

## Bekannte offene Punkte
- **Buffer und TikTok:** Laut Buffer-Hilfe werden manche TikTok-Funktionen wegen API-Grenzen nicht unterstützt (u. a. Benachrichtigungs-Veröffentlichung). Vor dem Betrieb einen Testpost in Modus B machen.
- **Video-URL:** Ein Speicherort mit öffentlichen Links fehlt noch (z. B. S3-kompatibler Bucket mit zeitlich begrenzten Links). Der n8n-Knoten „Video-URL bereitstellen“ ruft dafür `MEDIA_UPLOAD_CMD <datei>` auf, das die URL ausgeben muss.
- **ElevenLabs-Preis:** Abrechnung je Zeichen; in `config/channel.json → budget.prices` den Wert aus dem eigenen Tarif eintragen.
