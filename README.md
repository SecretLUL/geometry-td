# Geometry TD - Multiplayer Co-op Tower Defense

[![Vite](https://img.shields.io/badge/Vite-5.x-blueviolet.svg)](https://vitejs.dev/)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-ff007f.svg)](https://pixijs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://www.docker.com/)

**Geometry TD** ist ein hochperformantes, Co-op-fähiges Tower-Defense-Spiel im Webbrowser. Es kombiniert intensive Echtzeit-Schlachten, modernste Web-Grafiktechnologien (WebGL) und eine robuste Multiplayer-Architektur mit einer server-seitig autoritativen Spielsimulation.

Das visuelle Design setzt auf ein neon-cybernetisches Cyber-Glassmorphismus-Thema, begleitet von flüssigen Partikeleffekten und reaktivem Sound-Design.

---

## 🚀 Key Features

*   **GPU-beschleunigtes Rendering (PixiJS v8):** Komplette Migration von klassischem Canvas 2D auf reines WebGL-Rendering. Nutzt fortgeschrittene Techniken wie Sprite-Pooling (für Projektile und Partikel) und isolierte `RenderGroups`, um Stottern und CPU-Überlastungen zu verhindern.
*   **Netzwerk-Synchronisation & Co-op (bis zu 4 Spieler):** Echtzeit-Multiplayer über eine Kombination aus WebSockets (Socket.io) für Zustandsübersichten und **WebRTC Peer-to-Peer** für die schnelle Übertragung von Positionsdaten und Projektilen mit minimaler Latenz.
*   **Autoritatives Headless-Host System:** Um Cheaten vorzubeugen, wird die eigentliche Spielphysik und State-Berechnung bei Co-op-Partien auf einem server-seitigen, kopflosen Browser (**Puppeteer/Chromium**) ausgeführt. Die Clients empfangen die validierten Delta-Updates und interpolieren diese flüssig.
*   **Persistentes Fortschrittssystem:** Sicheres Registrierungs- und Login-System über JWT-basierte Authentifizierung (HttpOnly-Cookies). Fortschritte, freigeschaltete Skins, Achievements (mit Konfetti-Animationen) und Highscores werden in einer PostgreSQL-Datenbank gespeichert.
*   **In-Game Enzyklopädie (Lexikon):** Integrierte Übersicht über alle Turmklassen und Gegnertypen inklusive detaillierter Attribut-Fortschrittsbalken und Hintergrundgeschichten.
*   **Reaktive Musikvisualisierung:** Die Frequenzen der Hintergrundmusik werden zur Laufzeit über die Web Audio API (`AnalyserNode`) ausgelesen, um einen animierten Equalizer im Hauptmenü anzuzeigen.

---

## 🛠️ Technologie-Stack

*   **Frontend:** HTML5, CSS3 (Modular Vanilla CSS), TypeScript, PixiJS (v8), Vite
*   **Backend:** Node.js, Express, Socket.io, Puppeteer-Core, tsx
*   **Datenbank:** PostgreSQL (via `pg-promise`)
*   **Infrastruktur:** Docker, Docker Compose, Nginx (für statische Web-Auslieferung)

---

## 📂 Projektstruktur

```text
geometry-td/
├── backend/                  # Server-Anwendung (Express, WebSockets, Headless Puppeteer)
│   ├── src/
│   │   ├── routes/           # Rest-Endpunkte (Auth, Game-Stats)
│   │   ├── db.ts             # Datenbankanbindung & Tabellenschemata
│   │   ├── headless.ts       # Puppeteer-Steuerung (kopfloser Chromium-Host)
│   │   ├── socket.ts         # Socket-Handler mit Zod-Validierung
│   │   └── server.ts         # Server-Haupteinstiegspunkt
│   └── tsconfig.json
├── frontend/                 # Client-Anwendung (Spiel & Hauptmenü)
│   ├── public/               # Statische Ressourcen (Audio, Changelog, Web-Fonts)
│   ├── src/
│   │   ├── css/              # Modulare Stylesheets (Portal, Mobile, Variables)
│   │   └── js/               # Game-Engine, WebRTC-P2P, Entities, UI-Controller
│   └── vite.config.js
├── docker-compose.yaml       # Container-Konfiguration für Entwicklung & Produktion
└── deploy.sh                 # Automatisches Shell-Deploy-Skript
```

---

## ⚙️ Setup & Installation

Das Projekt wird vollständig über Docker Compose orchestriert.

### 1. Voraussetzungen
*   Docker & Docker Compose installiert
*   Eine `.env`-Datei im Stammverzeichnis mit folgendem Inhalt:
    ```env
    DB_PASSWORD=dein_sicheres_db_passwort
    JWT_SECRET=dein_sicheres_jwt_geheimnis
    ```

### 2. Entwicklungsumgebung (Local Dev)
Startet die Entwicklungs-Container mit Live-Reloading für Frontend (Vite) und Backend (tsx watch).

```bash
docker compose up -d db-dev backend-dev frontend-dev
```

*   **Frontend:** Erreichbar unter `http://localhost:7777`
*   **Backend API:** Port `7676`
*   **Datenbank:** PostgreSQL läuft auf Port `5432` (Daten verbleiben lokal in `./postgres_data_dev/`)

---

## 🛡️ Code-Qualität & Validierung

Vor Commits sollten die automatischen Prüfungen ausgeführt werden, um sicherzustellen, dass keine TypeScript-, HTML- oder CSS-Fehler vorliegen:

*   **Frontend-Validierung (TypeScript, HTML & CSS Lints):**
    ```bash
    cd frontend
    npm run check-all
    ```
*   **Backend-Validierung (TypeScript):**
    ```bash
    cd backend
    npm run type-check
    ```

---

## 🎮 Gameplay & Balancierung

Das Spiel verwendet ein **SSOT-Balancing-System** (Single Source of Truth) in `frontend/src/js/core/config.ts`. Turmwerte und Kosten werden dynamisch berechnet.

### Die Türme
1.  **Base (Standard):** Günstiger Allrounder. Kann in *Homing Missiles* (Raketen) oder *Heavy Ammo* (höherer Schaden) spezialisiert werden.
2.  **Sniper:** Unbegrenzte Reichweite. Spezialisiert sich in *Ricochet* (Abpraller) oder *Bounty Hunter* (Extra Gold pro Abschuss).
3.  **Bomb:** Massiver Flächenschaden. Spezialisiert sich in *Nuke* (radioaktive Bodenaura) oder *Cluster* (Mini-Bomben).
4.  **Tesla:** Kettenblitze. Spezialisiert sich in *High Voltage* (hoher Direktschaden) oder *Shock Stun* (Betäubungseffekt).
5.  **Prisma:** Kontinuierlicher Laserstrahl. Spezialisiert sich in *Meltdown Overdrive* (Explosion bei max. Strahlungsaufladung) oder *Refraction Split* (multiplizierter Laser).
