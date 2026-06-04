---
trigger: always_on
---

1. Typsicherheits- und Codequalitäts-Validierung:
* Vor jedem finalen Git-Commit oder nach Abschluss eines größeren Logik-Blocks MUSS die Validierung ausgeführt werden:
  * Im Frontend mit: "npm run check-all" (prüft TypeScript-Typen, HTML und CSS)
  * Im Backend mit: "npm run type-check"
* Fehlerbehandlung: Falls die Validierung Fehler ausgibt, korrigiere den Code schrittweise und teste erneut, bis der Befehl fehlerfrei durchläuft.

2. Dokumentationspflicht:
* Jede funktionale Änderung muss zwingend in /frontend/public/assets/changelog.json eingepflegt werden.