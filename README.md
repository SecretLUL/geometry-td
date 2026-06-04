# Geometry TD - Multiplayer Co-op Tower Defense

[![Vite](https://img.shields.io/badge/Vite-5.x-blueviolet.svg)](https://vitejs.dev/)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-ff007f.svg)](https://pixijs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://www.docker.com/)

**Geometry TD** is a high-performance, co-op capable tower defense game played directly in the web browser. It combines intense real-time battles, state-of-the-art web graphics (WebGL), and a robust multiplayer architecture featuring a server-side authoritative game simulation.

The visual design is built around a neon-cybernetic cyber-glassmorphism theme, accompanied by smooth particle effects and a reactive soundtrack.

---

## 🚀 Key Features

*   **GPU-Accelerated Rendering (PixiJS v8):** Complete migration from classical Canvas 2D to pure WebGL rendering. Utilizes advanced techniques such as sprite pooling (for projectiles and particles) and isolated `RenderGroups` to prevent stuttering and CPU overhead.
*   **Network Synchronization & Co-op (Up to 4 Players):** Real-time multiplayer combining WebSockets (Socket.io) for state coordination and **WebRTC Peer-to-Peer** for low-latency transmission of position data and projectiles.
*   **Authoritative Headless Host System:** To prevent cheating, the core game physics and state calculations in co-op matches run on a server-side headless browser (**Puppeteer/Chromium**). Clients receive the validated delta updates and interpolate them smoothly.
*   **Persistent Progress System:** Secure registration and login via JWT-based authentication (HttpOnly cookies). Progress, unlocked skins, achievements (with confetti animations), and high scores are saved in a PostgreSQL database.
*   **In-Game Encyclopedia (Lexicon):** Integrated overview of all tower classes and enemy types, including detailed attribute progress bars and lore descriptions.
*   **Reactive Music Visualization:** Background music frequencies are analyzed in real time via the Web Audio API (`AnalyserNode`) to render an animated equalizer in the main menu.

---

## 🛠️ Technology Stack

*   **Frontend:** HTML5, CSS3 (Modular Vanilla CSS), TypeScript, PixiJS (v8), Vite
*   **Backend:** Node.js, Express, Socket.io, Puppeteer-Core, tsx
*   **Database:** PostgreSQL (via `pg-promise`)
*   **Infrastructure:** Docker, Docker Compose, Nginx (for static web serving)

---

## 📂 Project Structure

```text
geometry-td/
├── backend/                  # Server application (Express, WebSockets, Headless Puppeteer)
│   ├── src/
│   │   ├── routes/           # REST endpoints (Auth, Game Stats)
│   │   ├── db.ts             # Database connection & table schemas
│   │   ├── headless.ts       # Puppeteer control (headless Chromium host)
│   │   ├── socket.ts         # Socket handler with Zod validation
│   │   └── server.ts         # Main server entry point
│   └── tsconfig.json
├── frontend/                 # Client application (Game & Main Menu)
│   ├── public/               # Static assets (Audio, Changelog, Web Fonts)
│   ├── src/
│   │   ├── css/              # Modular stylesheets (Portal, Mobile, Variables)
│   │   └── js/               # Game engine, WebRTC P2P, Entities, UI controller
│   └── vite.config.js
├── docker-compose.yaml       # Container configuration for Dev & Production
└── deploy.sh                 # Automatic shell deployment script
```

---

## ⚙️ Setup & Installation

The project is fully orchestrated using Docker Compose.

### 1. Prerequisites
*   Docker & Docker Compose installed
*   A `.env` file in the root directory with the following contents:
    ```env
    DB_PASSWORD=your_secure_db_password
    JWT_SECRET=your_secure_jwt_secret
    ```

### 2. Development Environment (Local Dev)
Starts the development containers with live-reloading for the frontend (Vite) and backend (tsx watch).

```bash
docker compose up -d db-dev backend-dev frontend-dev
```

*   **Frontend:** Available at `http://localhost:7777`
*   **Backend API:** Port `7676`
*   **Database:** PostgreSQL runs on port `5432` (data persists locally in `./postgres_data_dev/`)

---

## 🛡️ Code Quality & Validation

Before committing, automated checks should be executed to ensure there are no TypeScript, HTML, or CSS errors:

*   **Frontend Validation (TypeScript, HTML & CSS Lints):**
    ```bash
    cd frontend
    npm run check-all
    ```
*   **Backend Validation (TypeScript):**
    ```bash
    cd backend
    npm run type-check
    ```

---

## 🎮 Gameplay & Balancing

The game uses a **SSOT balancing system** (Single Source of Truth) in `frontend/src/js/core/config.ts`. Tower values and costs are calculated dynamically.

### The Towers
1.  **Base (Standard):** Low-cost all-rounder. Can be specialized into *Homing Missiles* (missiles) or *Heavy Ammo* (higher damage).
2.  **Sniper:** Unlimited range. Specializes in *Ricochet* (ricochets) or *Bounty Hunter* (extra gold per kill).
3.  **Bomb:** Massive area-of-effect (AoE) damage. Specializes in *Nuke* (radioaktive ground aura) or *Cluster* (mini-bombs).
4.  **Tesla:** Chain lightning. Specializes in *High Voltage* (high direct damage) or *Shock Stun* (stun effect).
5.  **Prisma:** Continuous laser beam. Specializes in *Meltdown Overdrive* (explosion at max beam charge) or *Refraction Split* (split laser beam).

---

## 📄 License

Copyright © 2026. All rights reserved.  
The source code is provided solely for demonstration and portfolio purposes. Reproduction, modification, or commercial use of the code (in particular hosting the game on your own platforms) is not permitted without explicit permission.