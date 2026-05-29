---
trigger: always_on
---

1. Nach jeder Code-Änderung im Frontend- UND Backend-Verzeichnis MUSS die Typsicherheit validiert werden mit:
`docker exec gtd-frontend-dev npm run type-check`
oder
`docker exec gtd-backend-dev npm run type-check`

2. Fehlerbehandlung:
Falls der Type-Check Fehler ausgibt, korrigiere den Code schrittweise im Einklang mit der `tsconfig.json` und teste erneut, bis der Befehl fehlerfrei (Exit-Code 0) durchläuft.

3. Dokumentationspflicht:
Jede Änderung muss zwingend in /frontend/public/assets/changelog.json eingepflegt werden.

4. Backend-Änderungen:
Starte nach jeder Änderung im Backend die dev-Container neu, da die Änderungen sonst nicht wirksam werden.