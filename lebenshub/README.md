# Lebenshub – App

Installierbare Web-App (PWA). Läuft offline, alle Daten bleiben lokal auf dem Gerät. Der Code enthält keine persönlichen Daten – Inhalte kommen per Import einer Startdatei/eines Backups (.json) oder werden in der App angelegt.

## Funktionen
- **Heute**: fällige Routinen zum Abhaken mit Fortschritt, „Demnächst“ (14 Tage), Termine, nächste Schritte
- **Geplante Claude-Aufgaben**: Routinen können als Claude-Aufgabe markiert sein (Laufzeit, Ergebnis, nächster Lauf); die App erinnert danach ans Auswerten
- **Routinen**: täglich / wöchentlich / monatlich, auch „alle N Tage/Wochen/Monate“, mit Uhrzeit; nach dem Abhaken kommen sie zum nächsten Termin automatisch wieder, verpasste bleiben als „überfällig“ stehen
- **Arbeit, Finanzen, Gesundheit**: alle Listen aus dem Artefakt; Einträge antippen zum Bearbeiten (Titel, Notiz/Wert, Datum, Status)
- **Dokumente** (Arbeit, Finanzen, Gesundheit): PDFs, Fotos, Screenshots oder Textdateien hinzufügen (mehrere auf einmal, auch direkt mit der Kamera). Gespeichert nur lokal auf dem Gerät (IndexedDB), nicht im JSON-Backup
- **KI-Analyse mit Claude** (optional): mit eigenem API-Schlüssel von console.anthropic.com. Claude fasst das Dokument zusammen, nennt die wichtigsten Fakten und schlägt Einträge vor (z. B. Kontostand → „Konten & Depots“, Frist → Termin), die du auswählst und übernimmst. Das Dokument wird nur beim Tippen auf „Analysieren“ an Anthropic gesendet. Das SDK liegt lokal unter `vendor/` (MIT-Lizenz)
- **Assistent** (Tab „Assistent“, mit API-Schlüssel): Chat per Text oder Sprache (🎤, sonst Tastatur-Diktat), Antworten optional vorlesen. Claude kennt die Hub-Daten und trägt Erzähltes und angehängte Dokumente/Fotos selbst in die passenden Listen, Routinen und Dokumentablagen ein; jede Änderung ist mit „Rückgängig“ zurücknehmbar
- **Zwei Assistenten-Modi**: *API* (direkt, Sprache inkl. Gesprächsmodus, Kostenanzeige, Modellwahl Opus/Sonnet/Haiku, sparsam durch Prompt-Caching, niedrige Denktiefe und kompakte Hub-Daten) oder *Claude-Abo* (Nachricht + Hub-Daten werden kopiert und in der Claude-App eingefügt; die Antwort mit ```lebenshub-Block wird zurück eingefügt – ohne API-Kosten, ideal für Recherchen). Unter ⚙︎ gibt es eine Projekt-Anweisung für ein Claude-Projekt „Lebenshub“
- **Finanzen wie im Broker**: Gesamtvermögen mit Verlaufskurve, Konten/Depots (z. B. Trade Republic, comdirect) mit Positionen, Stückzahl, Einstand, Kurs, Gewinn/Verlust; Assistent und Claude-Jobs pflegen sie über `set_account`, `set_position`, `set_prices`, `remove_position`; jeder Kursstand landet im Verlauf
- **Gesundheits-Cockpit**: Erholung, Schlaf und Aktivität als Ringe (eigene Orientierungs-Scores), Ernährung mit kcal/Eiweiß-Zielen und Mahlzeiten, 14-Tage-Verlauf, Tipps, Check-in, Analyse mit Claude; Daten per Check-in, Essensfotos und Uhr-Screenshots über den Assistenten (`add_meal`, `set_health_day`) oder automatisch per Claude-Job
- **Apple Health ohne Zusatz-App**: iPhone-Kurzbefehl legt täglich eine Textdatei in Google Drive ab, der Hub liest sie beim Öffnen über den Google-Drive-Connector (siehe ANLEITUNG-APPLE-HEALTH.md)
- **Wissen**: Paper, Studien, Artikel, Videos, Notizen mit Zusammenfassung, Kernaussagen, Themen und Lesestatus; Dokumente lassen sich übernehmen, der Assistent speichert (`add_knowledge`) und liest (`get_knowledge`) Wissen; Ablage-Listen im selben Bereich
- **Suche** über alle Listen, Routinen, Dokumente und Positionen; farbige Status (fehlt/prüfen/erledigt)
- **Neue Listen**: Konten & Depots, Fixkosten & Abos, Verletzungen & Beschwerden
- **Import**: Zusammenführen (neue Einträge dazu, Häkchen bleiben) oder Ersetzen
- **Erinnerungen**: Push-Benachrichtigungen für fällige Routinen und Termine (heute/morgen), App-Badge mit Anzahl offener Routinen
- **Kalender-Export (.ics)**: Routinen als wiederkehrende Termine mit Alarm, damit das Handy auch bei geschlossener App erinnert
- **Backup**: Export/Import als JSON (auch für den Umzug auf ein anderes Gerät)

## Betrieb als Claude-Artefakt (empfohlen)
Dieselbe App läuft auch als Claude-Artefakt (`python3 tools/build_artifact.py out.html` baut die einzelne Seite). Dort:
- Daten privat in der Artefakt-Datenbank (`hub/state`, Dokumente unter `docs/*` mit Dateien als Assets) – auf allen Geräten gleich
- Assistent und Dokument-Analyse über das Claude-Abo (Capability `sample`), ohne API-Schlüssel
- Geplante Claude-Jobs schreiben Ergebnisse in die Sammelbox `inbox/<id>` als `{source, at, summary, actions:[{tool, …}]}` (Werkzeuge wie beim Assistenten: add_entry, update_entry, delete_entry, add_routine, complete_routine, delete_routine); die App übernimmt sie beim Öffnen automatisch und zeigt sie unter „Von deinen Claude-Jobs“
- Bereich „Ablage“ für die Übersicht der Unterlagen

## Starten / Installieren (eigene Web-App)
Die App muss über HTTPS ausgeliefert werden (für Offline-Betrieb und Benachrichtigungen), z. B.:
- **Netlify Drop** (https://app.netlify.com/drop): den Ordner `lebenshub` hineinziehen, fertig
- **GitHub Pages**: Repository-Einstellungen → Pages → Branch wählen, dann `…/lebenshub/` öffnen

Lokal testen: `cd lebenshub && python3 -m http.server 8000` → http://localhost:8000

Dann auf dem Handy:
- **iPhone**: in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach in der App ⚙︎ → „Aktivieren“ (Benachrichtigungen ab iOS 16.4).
- **Android**: in Chrome öffnen → „App installieren“.

## Dateien
`index.html`, `styles.css`, `app.js` (Oberfläche), `sched.js` (Terminlogik), `sw.js` (Offline + Hintergrund-Erinnerungen), `manifest.webmanifest`, Icons.
