---
trigger: always_on
---

1. Typsicherheits-Validierung:
* Vor jedem finalen Git-Commit oder nach Abschluss eines größeren Logik-Blocks MUSS die Typsicherheit validiert werden mit:
  `docker exec gtd-frontend-dev npm run type-check` oder `docker exec gtd-backend-dev npm run type-check`
* Fehlerbehandlung: Falls der Type-Check Fehler ausgibt, korrigiere den Code schrittweise im Einklang mit der tsconfig.json und teste erneut, bis der Befehl fehlerfrei (Exit-Code 0) durchläuft.

2. Dokumentationspflicht:
* Jede funktionale Änderung muss zwingend in /frontend/public/assets/changelog.json eingepflegt werden.

3. Container-Laufzeit im Backend:
* Da im DEV-Container Tsx mit Watch-Mode aktiv ist, werden Code-Änderungen sofort live übernommen. Ein manueller Container-Neustart ist NUR erforderlich, wenn neue Abhängigkeiten in der package.json hinzugefügt oder .env-Variablen geändert wurden.