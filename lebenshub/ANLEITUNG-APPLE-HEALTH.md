# Apple Health → Lebenshub (kostenlos, ohne Zusatz-App)

So kommen Schlaf, Ruhepuls, HRV, Schritte, Aktivenergie und Gewicht jeden Morgen automatisch ins Gesundheits-Cockpit:
**Uhr → Apple Health → iPhone-Kurzbefehl → Google Drive → Lebenshub** (liest beim Öffnen einmal täglich).

Dauer: einmalig ca. 10–15 Minuten. Bezeichnungen können je nach iOS-Version leicht abweichen.

## 1. Uhr mit Apple Health verbinden
- **Xiaomi (Mi Fitness):** Mi-Fitness-App → Profil → *Drittanbieter-Dienste* bzw. *Daten teilen* → **Apple Health** einschalten und alle Kategorien erlauben.
- **Garmin (später):** Garmin-Connect-App → Mehr → Einstellungen → *Verbundene Apps* → **Apple Health** → alle Datentypen erlauben.
- Prüfen: In der **Health**-App unter *Durchsuchen* sollten Schritte, Schlaf und Herz erscheinen. Welche Werte ankommen, hängt von der Uhr ab (HRV liefern nicht alle Uhren).

## 2. Google Drive vorbereiten
1. **Google-Drive-App** installieren und anmelden.
2. In der **Dateien**-App → *Durchsuchen* → *…* → *Bearbeiten* → **Google Drive einschalten**.
3. In Google Drive einen Ordner **Lebenshub** anlegen.
4. In Claude: *Einstellungen → Connectors* → **Google Drive** (neu) verbinden.

## 3. Kurzbefehl bauen (App „Kurzbefehle“ → „+“ → Name: *Lebenshub Gesundheit*)
Für jeden Wert die Aktion **„Health-Samples suchen“** hinzufügen (Suchfeld unten: „Health“):

| Wert | Typ | Filter / Einstellungen | danach |
|---|---|---|---|
| Schritte | Schritte | Startdatum *liegt in den letzten* **1 Tagen** | „Statistik berechnen“ → **Summe** |
| Schlaf | Schlafanalyse | Startdatum *in den letzten 1 Tagen*; Filter **Wert ist nicht „Im Bett“** und **Wert ist nicht „Wach“** | „Details von Health-Samples abrufen“ → **Dauer**, dann „Statistik berechnen“ → **Summe** |
| Ruhepuls | Ruheherzfrequenz | letzte 1 Tage, Sortieren nach *Startdatum, neueste zuerst*, **Limit 1** | – |
| HRV | Herzfrequenzvariabilität | letzte 1 Tage | „Statistik berechnen“ → **Durchschnitt** |
| Aktivenergie | Aktive Energie | letzte 1 Tage | „Statistik berechnen“ → **Summe** |
| Gewicht | Gewicht | letzte **7** Tage, neueste zuerst, **Limit 1** | – |

Tipp: Nach jeder Aktion das Ergebnis über das Variablen-Menü umbenennen (z. B. „Schritte“, „Schlaf“ …).

Dann:
1. **„Datum formatieren“**: *Aktuelles Datum*, Format **Eigenes** → `yyyy-MM-dd` (Variable „Tag“).
2. **„Text“** mit genau diesem Inhalt (die Werte als Variablen einsetzen):
   ```
   Lebenshub Gesundheit
   Datum: [Tag]
   Schlaf: [Schlaf]
   Ruhepuls: [Ruhepuls]
   HRV: [HRV]
   Schritte: [Schritte]
   Aktivenergie: [Aktivenergie]
   Gewicht: [Gewicht]
   ```
3. **„Name festlegen“**: `lebenshub-gesundheit-[Tag].txt`
4. **„Datei sichern“**: *Fragen, wo gesichert werden soll* **aus**, Ziel **Google Drive → Lebenshub**, *Überschreiben* **an**.
5. Kurzbefehl **einmal von Hand starten** und alle Health-Zugriffe **erlauben**. In Google Drive sollte die Datei erscheinen.

Fehlt ein Wert (z. B. HRV), bleibt die Zeile leer – das ist in Ordnung. Schlaf darf in Sekunden, Minuten oder Stunden ankommen; der Hub rechnet um.

## 4. Jeden Morgen automatisch
Kurzbefehle → **Automation** → **+** → **Tageszeit** → z. B. **08:00**, täglich → **Sofort ausführen** → Kurzbefehl *Lebenshub Gesundheit* auswählen.

## 5. Im Lebenshub einschalten
Lebenshub → **Gesundheit** → **„Apple Health verbinden“** antippen und den Zugriff auf Google Drive **erlauben**. Ab dann holt der Hub die Werte beim Öffnen einmal täglich selbst; „Apple Health abrufen“ holt sie sofort.
