---
trigger: always_on
---

1. Typsicherheits-Validierung:
* Vor jedem finalen Git-Commit oder nach Abschluss eines größeren Logik-Blocks MUSS die Typsicherheit validiert werden mit: "npm run type-check"
* Fehlerbehandlung: Falls der Type-Check Fehler ausgibt, korrigiere den Code schrittweise im Einklang mit der tsconfig.json und teste erneut, bis der Befehl fehlerfrei durchläuft.

2. Dokumentationspflicht:
* Jede funktionale Änderung muss zwingend in /frontend/public/assets/changelog.json eingepflegt werden.