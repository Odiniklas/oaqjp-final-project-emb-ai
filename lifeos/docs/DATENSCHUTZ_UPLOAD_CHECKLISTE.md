# Vor dem Claude-Upload: Sicherheits- und Datenschutzcheck

1. **Vertraulichkeit:** Enthält die Datei nicht öffentliche Arbeitgeberdaten, Vertragstexte, interne SAP-/Kundendaten oder fremde Projekte? Dann NICHT ohne Freigabe hochladen.
2. **Personenbezug:** Enthält sie private Adressen, Telefonnummern, E-Mails, medizinische Details, Familienangaben oder Daten Dritter? Minimieren/redigieren.
3. **Finanzen:** Exakte Vermögensbeträge, Kreditverträge, Konten, Transaktionen und persönliche Versicherungsdaten nur bei echtem Bedarf und bewusster Auswahl; nicht für allgemeine Agentenausbildung verwenden.
4. **Zugangsdaten:** Keine Keys, Tokens, SSH-Keys, Passwörter oder API-Secrets in Prompts, Projektwissen, Quellcode, Screenshots oder Git.
5. **Projektzusagen:** Vermerke, welche Aussagen aus Gesprächsnotizen stammen. Kommerzielle Informationen zu Projektpartnern ohne Nutzungsrecht nicht weitergeben.
6. **Korrektur:** Veraltete oder falsche persönliche Erinnerungen vor Import ausbessern. Nicht benötigte Themen weglassen.
7. **Speicherung:** Claude Projects, Claude Code und Anthropic API können verschiedene Datenflüsse haben. Prüfe die aktuellen Produkt- und Datenschutzbedingungen je Oberfläche und Organisation.
8. **GitHub:** Persönliche Akten niemals in öffentliches Repository committen. Das `.gitignore` des Pakets schließt `wissen/`, `.env` und Datenbanken aus; kontrolliere vor jedem Push trotzdem die tatsächlichen Dateien.
9. **Lokal bleibt lokal?** Nur die Python-CLI ohne `--llm` arbeitet lokal. Sobald Claude Code/Cloud-Projekte diese Dateien lesen, können Inhalte über den Claude-Dienst verarbeitet werden. Die lokale CLI und Claude Code nicht gleichsetzen.
10. **Änderungskontrolle:** Vor aktivem Import eine Vorschau prüfen. `--apply --confirm-data-rights` bestätigt einen rein lokalen Import, nicht pauschal die Zulässigkeit eines Cloud-Uploads.

## Upload-Empfehlung nach Datei
- `01_PROFIL_LEBEN_ZIELE.txt`: normalerweise gut redigierbar und sinnvoll.
- `02_ENERGIEHUB_FORSCHUNG.txt`: nur selbst berichtete und freigegebene Informationen, keine internen Originalmails.
- `03_KARRIERE_PROMOTION.txt`: persönliche Daten, ggf. Bedarf beschränken.
- `04_STARTUPS_MARKETING_BUSINESS.txt`: Ideenstand, kein Geschäftsgeheimnis externer Partner hineinmischen.
- `05_FINANZEN_IMMOBILIEN.txt`: **optional**, enthält persönliche Planungskorridore.
- `06_LERNEN_LEBENSPLANUNG.txt`: nur soweit benötigt; keine intimen Daten.
- `07`–`10` (Struktur, Rollen, Startprompts): überwiegend generisch, leichter hochzuladen.
