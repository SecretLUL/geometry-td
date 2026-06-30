# Geometry TD - Multiplayer Co-op Tower Defense

[![Vite](https://img.shields.io/badge/Vite-5.x-blueviolet.svg)](https://vitejs.dev/)
[![PixiJS](https://img.shields.io/badge/PixiJS-v8-ff007f.svg)](https://pixijs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black.svg)](https://socket.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-blue.svg)](https://www.docker.com/)

**Geometry TD** is a high-performance, co-op capable tower defense game played directly in the web browser for up to 4 players. It combines intense real-time battles, state-of-the-art web graphics (WebGL), and a robust multiplayer architecture featuring a server-side authoritative game simulation.

The visual design is built around a neon-cybernetic cyber-glassmorphism theme, accompanied by smooth particle effects and a reactive soundtrack in the main menu.

---

## 🚀 Key Features

*   **GPU-Accelerated Rendering (PixiJS v8):** Pure WebGL rendering engine. Utilizes advanced techniques such as sprite pooling (for projectiles and particles) and isolated `RenderGroups` to prevent stuttering and CPU overhead.
*   **Network Synchronization & Co-op (Up to 4 Players):** Real-time multiplayer combining **WebSockets (Socket.io)** for lobby and state coordination, and **WebRTC Peer-to-Peer** for low-latency transmission of position and projectile data between clients.
*   **Authoritative Headless Host System:** To prevent cheating, the core game physics and state calculations run on a server-side headless browser (**Puppeteer/Chromium**). Clients receive validated delta updates and interpolate them smoothly.
*   **Headless Health-Check & Clean-up System:** The backend runs a health check every 30 seconds to clean up orphaned browser instances (e.g., when all human players leave the lobby), abort browsers stuck in the launching state (> 45s), and restart crashed instances.
*   **Persistent Progress System:** Secure registration and login via JWT-based authentication (stored in secure HttpOnly cookies). Progress, unlocked skins, achievements (with confetti animations), and high scores are saved in a PostgreSQL database.
*   **Reactive Music Visualization:** Background music frequencies are analyzed in real time via the Web Audio API (`AnalyserNode`) to render an animated equalizer in the main menu.
*   **In-Game Encyclopedia (Lexicon):** Integrated overview of all tower classes and enemy types, including detailed attribute progress bars and lore descriptions.

---

## 🛠️ Technology Stack

*   **Frontend:** HTML5, CSS3 (Modular Vanilla CSS with glassmorphism effects), TypeScript, PixiJS (v8), Vite
*   **Backend:** Node.js, Express, Socket.io, Puppeteer-Core, tsx (TypeScript Execute), JWT auth, cookie-parser, bcrypt
*   **Database:** PostgreSQL (via `pg-promise`)
*   **Infrastructure & Deployment:** Docker, Docker Compose, Nginx (for static web serving and reverse proxying)

---

## 📂 Project Structure

```text
geometry-td/
├── backend/                  # Server application (Express, WebSockets, Headless Puppeteer)
│   ├── src/
│   │   ├── routes/           # REST endpoints (Auth, Game Stats)
│   │   ├── db.ts             # Database connection & schema initialization
│   │   ├── headless.ts       # Puppeteer control (headless Chromium host instances)
│   │   ├── performance-test.ts # Automated multiplayer benchmark
│   │   ├── socket.ts         # Socket handler with Zod schema validation
│   │   ├── state.ts          # Global in-memory server state
│   │   └── server.ts         # Main server entry point
│   ├── Dockerfile.dev        # Development Dockerfile with Chromium pre-installed
│   ├── Dockerfile.prod       # Production Dockerfile (Multi-stage build)
│   └── tsconfig.json
├── frontend/                 # Client application (Game & Main Menu)
│   ├── public/               # Static assets (Audio tracks, Changelog, Web fonts)
│   ├── src/
│   │   ├── css/              # Modular stylesheets (Portal, Menu, Mobile, Game)
│   │   └── js/               # Game engine, WebRTC P2P, entities (towers/enemies), UI
│   ├── default.conf          # Nginx configuration for production (Proxying & Gzip)
│   ├── Dockerfile.dev        # Development Dockerfile
│   ├── Dockerfile.prod       # Production Dockerfile with Nginx server
│   ├── index.html            # Main entry page
│   ├── game.html             # Game board page (also loaded by the headless host)
│   └── vite.config.js
├── docker-compose.yaml       # Local container configuration (development services only)
├── docker-compose.example.yaml # Template for Dev & Prod services (including volumes/networks)
├── deploy.sh                 # Automatic production deployment shell script
└── package.json              # Global npm scripts for code validation
```

---

## ⚙️ Setup & Installation

The project is fully orchestrated using Docker Compose.

### 1. Prerequisites

*   Docker and Docker Compose installed on the host system.
*   A `.env` file in the **root directory** of the project with the following configuration:
    ```env
    # PostgreSQL database password
    DB_PASSWORD=your_secure_password_here
    
    # Secret key for signing JWT tokens
    JWT_SECRET=your_secure_jwt_secret_here
    
    # Host filesystem path to the project root directory (crucial for Docker volumes)
    PROJECT_ROOT=C:\path\to\geometry-td  # On Windows
    # PROJECT_ROOT=/home/user/geometry-td # On Linux/macOS
    ```

---

### 2. Development Environment (Local Dev)

Starts the development containers with live-reloading enabled for the frontend (Vite) and the backend (tsx watch).

Start the development services:
```bash
docker compose up -d db-dev backend-dev frontend-dev
```

*   **Frontend:** Available at `http://localhost:7777` (proxied internally to Vite dev server on port `5173`).
*   **Backend API:** Port `7676` (internal Express server on port `3000` with tsx).
*   **Database:** PostgreSQL runs on port `5432` (data is persisted locally in the `db_data_dev` Docker volume or directory).

---

### 3. Production Deployment

> [!IMPORTANT]
> **Important note on docker-compose.yaml:**
> By default, `docker-compose.yaml` in this repository only defines the development services (`*-dev`). 
> The template file `docker-compose.example.yaml` contains the full configuration for both development and production.
> 
> To deploy in production, copy the production services (`frontend-prod`, `backend-prod`, `db-prod`) along with their corresponding networks and volumes from `docker-compose.example.yaml` into your active `docker-compose.yaml`.

Once the configuration has been merged, you can deploy using the shell script:
```bash
# Run the deployment script
./deploy.sh
```
Or manually via Docker Compose:
```bash
docker compose up -d --build frontend-prod backend-prod db-prod
```

#### Production Architecture:
*   **Frontend Nginx (`frontend-prod`):** Accessible externally on port `8181`. Nginx serves the compiled static web assets, applies Gzip compression, and acts as a reverse proxy forwarding API requests (`/api/`) and WebSocket traffic (`/socket.io/`) to the backend container.
*   **Backend API (`backend-prod`):** Runs internally on port `3000` as the unprivileged `node` user and is exposed on host port `7171`.
*   **Database (`db-prod`):** Isolated within the internal bridge network (`gtd-prod-network`) and accessible only to the backend container. Data is persisted in the `db_data_prod` volume.

---

## 🎮 Gameplay & Balancing

The game uses a **SSOT balancing system** (Single Source of Truth) defined in [config.ts](./frontend/src/js/core/config.ts). All upgrade costs, damage stats, and enemy HP scaling curves are calculated dynamically from this file.

### Tower Classes and Specializations
1.  **Base (Standard):** Low-cost all-rounder. Specializations at level 10:
    *   *Homing Missiles:* Fires target-seeking missiles.
    *   *Heavy Ammo:* Increases direct damage at the cost of fire rate.
2.  **Sniper:** Infinite range. Specializations at level 10:
    *   *Ricochet:* Projectiles bounce to neighboring enemies.
    *   *Bounty Hunter:* Generates bonus gold on enemy kills.
3.  **Bomb:** Massive area-of-effect (AoE) damage. Specializations at level 10:
    *   *Nuke:* Leaves a radioactive ground aura that damages and slows passing enemies.
    *   *Cluster:* Projectiles explode into multiple sub-bombs.
4.  **Tesla:** Chain lightning. Specializations at level 10:
    *   *High Voltage:* Increases direct chain lightning damage.
    *   *Shock Stun:* Brief stun effect on hit.
5.  **Prisma:** Continuous laser beam with damage scaling over time. Specializations at level 10:
    *   *Meltdown Overdrive:* Triggers a massive explosion once maximum laser charge is reached.
    *   *Refraction Split:* Splits the laser beam across multiple nearby targets.

---

## 🛡️ Code Quality & Validation

Automated checks should be executed before committing code to ensure type safety and code quality.

### Running commands from the project root:
*   **Validate Entire Project (Frontend & Backend):**
    ```bash
    npm run check-all
    ```
    *Runs type checks in the backend, and lints, Prettier checks, and production builds in the frontend.*
*   **Validate Frontend Only:**
    ```bash
    npm run check-all:frontend
    ```
*   **Validate Backend Only:**
    ```bash
    npm run check:backend
    ```

### Code Formatting (Prettier) in the frontend directory:
If the validation check fails on code formatting, format all frontend files automatically with:
```bash
cd frontend
npm run format
```

---

## 🤖 Headless Host System & Health Check

The backend manages Puppeteer browser instances to serve as authoritative game hosts.
*   **Source Code:** Managed in [headless.ts](./backend/src/headless.ts).
*   **Launch Arguments:** Puppeteer launches Chromium inside the container (executable path `/usr/bin/chromium`) with arguments like `--disable-gpu` and `--disable-dev-shm-usage` to minimize resource consumption.
*   **Health Checks:**
    A background check runs every **30 seconds**:
    *   **Stuck Preventer:** Any instance stuck in the `launching` state for longer than 45 seconds is forcefully terminated and deleted.
    *   **Orphan Clean-up:** If a room has no human players remaining (`playerCount === 0`), the headless host is stopped.
    *   **Crash Recovery:** If a running browser becomes unresponsive (i.e. `browser.version()` times out), the instance is closed, marked as `failed`, and a new host is spawned for the room.

---

## 📈 Performance Testing & Benchmarking

The project includes an automated script to simulate and measure performance in a full 4-player co-op match.
*   **Test Script:** [performance-test.ts](./backend/src/performance-test.ts)
*   **How it works:**
    1. Launches a Chromium browser and creates **4 isolated browser contexts** (Host, Client 1, Client 2, Client 3) to simulate separate user sessions.
    2. Navigates all 4 pages to the map lobby, initiates the match, and simulates active gameplay.
    3. Collects rendering and latency metrics during the simulation.
    4. Prints a summary table in the console showing:
       *   Average FPS and Minimum FPS
       *   Frame jitter in milliseconds (deviation between frame delivery times)
       *   Number of micro-stutters and severe lags
       *   Gameplay experience rating (🟢 EXCELLENT, 🟡 ACCEPTABLE, 🔴 POOR)

### Running the benchmark:
Ensure Chromium is installed locally or run this test inside the backend Docker container:
```bash
cd backend
npx tsx src/performance-test.ts
```

---

## 📄 License

Copyright © 2026. All rights reserved.  
The source code is provided solely for demonstration and portfolio purposes. Reproduction, modification, or commercial use of the code (specifically hosting the game on your own platforms) is not permitted without explicit permission.