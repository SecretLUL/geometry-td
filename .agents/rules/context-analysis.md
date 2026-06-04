---
trigger: manual
---

1. Zwingende Analyse-Schritte
* Infrastruktur-Prüfung: Analysiere vor jeglicher Code-Änderung alle Dateien im Projektstamm. Identifiziere die Service-Architektur, Port-Mappings und internen Containernamen.
* Routing-Prüfung: Analysiere die vite.config.js im Frontend-Verzeichnis, um das Proxy-Routing zu verstehen.
* Package-Prüfung: Analysiere die package.json im Front- und Backend-Verzeichnis, um die verwendeten Packete zu verstehen.

2. Strikt einzuhaltender Umgebungs-Fokus (DEV)
* Zielumgebung: Alle aktuellen Code-Arbeiten betreffen ausschließlich die Entwicklungs-Umgebung (DEV).