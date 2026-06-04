---
trigger: always_on
---

1. Erlaubter Deployment-Befehl:
* Führe das bereitgestellte Deployment-Skript im Projektstamm aus, um die Produktions-Container sicher neu zu bauen und im Hintergrund zu starten:
  `./deploy.sh`
* Alternativ kann der entsprechende Docker-Compose-Befehl direkt verwendet werden:
  `docker compose up -d --build frontend-prod backend-prod`

2. Validierung der Live-Umgebung:
* Nach jedem Deployment MUSS der erfolgreiche Start und die Fehlerfreiheit der Produktions-Container über die Logs validiert werden:
  `docker logs gtd-frontend-prod`
  `docker logs gtd-backend-prod`

WICHTIG: FÜHRE EIN DEPLOYMENT NUR AUS, WENN ICH DICH EXPLIZIT DAZU AUFFORDERE!!!