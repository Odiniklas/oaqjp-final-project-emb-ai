# Apple-Kalender ↔ Lebenshub

**Apple → Hub (automatisch):** Ein iPhone-Kurzbefehl schreibt deine Termine der nächsten 60 Tage täglich in die Datei `lebenshub-kalender.txt` in Google Drive. Der Hub liest sie beim Öffnen (spätestens alle 3 Stunden) und zeigt sie im Kalender (pink).
**Hub → Apple:** Neue Termine im Hub (auch aus Fotos) landen per Kalenderdatei im Apple-Kalender. „An Apple senden“ schickt nur Neues oder Geändertes – nichts doppelt.

Voraussetzung (wie bei Apple Health): Google-Drive-App installiert, in der Dateien-App eingeschaltet, Ordner **Lebenshub** vorhanden, Google Drive in Claude verbunden.

## Kurzbefehl „Lebenshub Kalender“ (App Kurzbefehle → +)
1. **Kalenderereignisse suchen**
   - Filter: *Startdatum* **liegt in den nächsten 60 Tagen** (zweiter Filter: *Startdatum* **ist nach** *Beginn von heute* – optional)
   - Sortieren nach: Startdatum, älteste zuerst · Limit aus
   - Optional: Filter *Kalender* **ist nicht** „Lebenshub“, falls du Hub-Termine in einen eigenen Kalender importierst
2. **Wiederholen mit jedem** (Kalenderereignisse). Im Block:
   1. **Datum formatieren**: *Wiederholungsobjekt → Startdatum*, Format **Eigenes** `yyyy-MM-dd HH:mm` → umbenennen in **Start**
   2. **Datum formatieren**: *Wiederholungsobjekt → Enddatum*, Format **Eigenes** `yyyy-MM-dd HH:mm` → umbenennen in **Ende**
   3. **Text**: `[Wiederholungsobjekt → Titel] | [Start] | [Ende] | [Wiederholungsobjekt → Ort] | [Wiederholungsobjekt → Kalender] | [Wiederholungsobjekt → Ist ganztägig]`
3. Nach dem Block: **Text kombinieren** – *Wiederholungsergebnisse* mit **Neue Zeilen**
4. **Name festlegen**: `lebenshub-kalender.txt`
5. **Datei sichern**: *Fragen, wo gesichert werden soll* **aus**, Ziel **Google Drive → Lebenshub**, *Überschreiben* **an**
6. Einmal von Hand starten und den Kalenderzugriff **erlauben**.

## Automatisch
Kurzbefehle → **Automation** → **+** → **Tageszeit** (z. B. 06:30, täglich) → *Sofort ausführen* → „Lebenshub Kalender“. Wer es öfter will, legt eine zweite Automation (z. B. 13:00) an oder „Beim Öffnen der App Kalender“.

## Im Hub
Tab **Kalender** → „Abgleichen“ (beim ersten Mal den Zugriff auf Google Drive erlauben). Danach automatisch.
- Monatsansicht mit Punkten (grün Termin, pink Apple, blau Frist, orange Routine), darunter der gewählte Tag mit Uhrzeiten und Wetter
- „Liste“: die nächsten 30 Tage
- „+ Termin“: anlegen – mit Häkchen „gleich in den Apple-Kalender übernehmen“ öffnet sich die Kalenderdatei → **Hinzufügen**
- „An Apple senden“: alle neuen/geänderten Hub-Termine auf einmal → **Alle hinzufügen**
- Odi kennt alle Termine („Was steht morgen an?“)
