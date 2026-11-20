# „Hey Odi“ – freihändig sprechen (iPhone-Kurzbefehl)

Odi läuft als Kurzbefehl direkt auf dem iPhone: „Hey Odi“ sagen → Odi antwortet sofort mit deiner Stimme (z. B. Markus) → du fragst → Odi antwortet → du fragst weiter. Ohne Tippen.
Voraussetzung für freie Fragen: iOS 26 und ein iPhone mit Apple Intelligence (iPhone 15 Pro oder neuer), Sprache Deutsch.

## Vorbereitung (einmalig)
1. **Stimme laden:** Einstellungen → Bedienungshilfen → Gesprochene Inhalte → Stimmen → Deutsch → **Markus (Erweitert)** laden.
2. **Lebenshub in den iPhone-Kalender:** Lebenshub → ⚙︎ → „Kalenderdatei (.ics) speichern“ → öffnen → „Alle hinzufügen“. Damit kennt Odi Routinen und Termine. Fotos-Termine landen ohnehin dort. Nach größeren Änderungen wiederholen.
3. **Apple Intelligence** einschalten (Einstellungen → Apple Intelligence & Siri).

## Kurzbefehl „Odi“ bauen (App Kurzbefehle → +)
Aktionen in dieser Reihenfolge hinzufügen:
1. **Text sprechen** – Text: `Ja, Sir?` · auf „Mehr“ tippen: Stimme **Markus**, Tonhöhe etwas tiefer, Geschwindigkeit normal, „Auf Abschluss warten“ an.
2. **Wiederholen** – 10 Mal. Alles Folgende bis „Ende Wiederholen“ kommt in diesen Block:
   1. **Text diktieren** – Sprache Deutsch, Zuhören beenden: „Nach Pause“.
   2. **Wenn** – Diktierter Text *enthält* `danke` → darin **Text sprechen** `Stets zu Diensten, Sir.` und **Kurzbefehl stoppen** → Ende Wenn.
   3. **Wettervorhersage abrufen** – täglich, Ort: Aktueller Standort.
   4. **Kalenderereignisse suchen** – Filter: Startdatum *liegt in den nächsten* 2 Tagen, sortiert nach Startdatum.
   5. **Text** – Inhalt (die blauen Variablen über „Variable auswählen“ einsetzen):
      ```
      Du bist Odi, ein souveräner KI-Butler mit trockenem Humor. Sprich mich mit „Sir“ an.
      Heute ist [Aktuelles Datum].
      Wetter: [Wettervorhersage]
      Termine und Routinen: [Kalenderereignisse]
      Frage: [Diktierter Text]
      Antworte auf Deutsch in höchstens drei kurzen, gesprochenen Sätzen, ohne Aufzählungszeichen.
      ```
   6. **Modell verwenden** – Modell: **Private Cloud Compute**, Eingabe: der Text aus Schritt 5.
   7. **Text sprechen** – Antwort des Modells, Stimme **Markus** wie oben, „Auf Abschluss warten“ an.
3. Kurzbefehl **Odi** nennen.

## „Hey Odi“ einrichten
Einstellungen → Bedienungshilfen → **Sprachkurzbefehle** → Aktion: Kurzbefehl „Odi“ → „Hey Odi“ dreimal einsprechen. Alternativ „Hey Siri, Odi“.

## Benutzen
„Hey Odi“ → „Ja, Sir?“ → z. B. „Wie wird das Wetter heute?“, „Was steht heute an?“, „Habe ich morgen Termine?“ → Odi antwortet und hört wieder zu. Mit „Danke“ beenden.

## Grenzen
- Gesundheit, Depot, Mails und Einträge anlegen kann der Kurzbefehl nicht – dafür den Lebenshub öffnen (Odi im Hub, Link mit `#odi`).
- Ohne Apple Intelligence: Schritt 6 weglassen und in Schritt 7 den Text aus Schritt 5 ohne „Frage“ sprechen lassen – dann liest Odi auf „Hey Odi“ Wetter und Termine vor (Tagesüberblick), freie Fragen gehen dann nicht.
- Die Filmstimme selbst lässt sich nicht nachbilden; Markus mit tieferer Tonhöhe kommt dem Butler-Klang am nächsten.
