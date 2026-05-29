---
trigger: always_on
---

1. Zwingende Analyse-Schritte
* Infrastruktur-Prüfung: Analysiere vor jeglicher Code-Änderung die docker-compose.yaml im Projektstamm. Identifiziere die Service-Architektur, Port-Mappings und internen Containernamen.
* Routing-Prüfung: Analysiere die vite.config.js im Frontend-Verzeichnis, um das Proxy-Routing zu verstehen.

2. Strikt einzuhaltender Umgebungs-Fokus (DEV)
* Zielumgebung: Alle aktuellen Code-Arbeiten betreffen ausschließlich die Entwicklungs-Umgebung (DEV).