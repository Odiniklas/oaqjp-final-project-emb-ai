# OpenJarvis ohne Computer – eigener Server, Bedienung per Telegram vom iPhone

OpenJarvis (Stanford, Apache 2.0) läuft nicht auf dem iPhone. Ohne Laptop geht es so: Ein kleiner gemieteter Linux-Server führt OpenJarvis und ein lokales Sprachmodell aus, und du schreibst ihm über einen eigenen Telegram-Bot.

**Getestet in dieser Umgebung:** Installation von `openjarvis[server,channel-telegram]==1.0.4`, Start von `jarvis serve` mit Telegram-Kanal und eine Antwort über die API (mit einem Test-Modell statt Ollama). **Nicht getestet:** echte Verbindung zu Telegram, echtes Modell, Ausführung auf einem neuen Server – das erste Mal auf deinem Server bitte die Logs prüfen.

## Was du brauchst (alles am iPhone)
1. **Telegram-App**
   - Chat mit **@BotFather** → `/newbot` → Name und Benutzername wählen → **Token** kopieren.
   - Chat mit **@userinfobot** → er nennt deine **Chat-ID** (Zahl).
2. **Server bei einem Anbieter** (z. B. Hetzner Cloud über die Webseite)
   - Ubuntu 24.04, mindestens 8 GB RAM; 16 GB für größere Modelle.
   - Kosten je nach Größe einige Euro bis rund 20 € im Monat – aktuellen Preis vor der Bestellung prüfen.

## Einrichtung (ca. 15 Minuten)
1. In `cloud-init.yaml` die zwei Platzhalter durch Token und Chat-ID ersetzen (z. B. in der Notizen-App vorbereiten).
2. Beim Erstellen des Servers den kompletten Text in das Feld **„Cloud config“ / „User data“** einfügen und Server erstellen.
3. 10–15 Minuten warten: Ollama, Modell (`qwen3:4b`, einige GB) und OpenJarvis werden installiert.
4. In Telegram deinem Bot „Hallo“ schreiben.

**Ohne Cloud-Config-Feld:** über die Web-Konsole des Anbieters als root:
`curl -fsSL -o setup.sh https://raw.githubusercontent.com/odiniklas/oaqjp-final-project-emb-ai/claude/laughing-davinci-nplchy/openjarvis-server/setup.sh && TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=… bash setup.sh`

## Wenn der Bot nicht antwortet
- Web-Konsole: `cat /root/setup.log` (Installation) und `journalctl -u openjarvis -n 50` (Dienst).
- `systemctl restart openjarvis` startet neu, `ollama list` zeigt das Modell.

## Wichtig zu wissen
- **Privatsphäre:** Modell und Daten liegen auf *deinem* Server, aber Telegram-Bot-Nachrichten laufen über Telegrams Server und sind nicht Ende-zu-Ende-verschlüsselt. Keine Gesundheits-, Konto- oder Arbeitgeberdaten schicken.
- **Leistung:** Ohne Grafikkarte sind nur kleine Modelle flott; Antworten sind deutlich schwächer als Claude/Odi. Größeres Modell: `MODEL=qwen3:8b` (mehr RAM nötig).
- **Sicherheit:** Nur SSH ist offen (Firewall), der Bot antwortet nur deiner Chat-ID. Token nie teilen; bei Verlust bei @BotFather `/revoke`.
- **Kündigen:** Server beim Anbieter löschen – sonst laufen die Kosten weiter.
