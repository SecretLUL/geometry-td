/*
 * @file: backend\src\server.ts
 * @purpose: Authoritative Headless-Host coordinating Express & Socket.io server using Puppeteer to run secure, background-safe Coop game simulations.
 * @dependencies: express, http, socket.io, path, puppeteer-core, zod
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Änderung der Funktionalität MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
 * @last_update: 2026-05-29 / v1.7.1 - Registered host_ended_wave relay for co-op notifications.
 */
import express, { Request, Response } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import puppeteer, { Browser, Page, ConsoleMessage } from 'puppeteer-core';
import {
  JoinMissionSchema,
  RequestPlaceTowerSchema,
  RequestUpgradeTowerSchema,
  RequestSellTowerSchema,
  ConfirmPlaceTowerSchema,
  RejectPlaceTowerSchema,
  ConfirmUpgradeTowerSchema,
  ConfirmSellTowerSchema,
  SyncTowersSchema,
  RequestWaveStartSchema,
  TogglePauseSchema,
  ChangeSpeedSchema,
  ToggleAutoSchema,
  ToggleModSchema,
  SyncLivesSchema,
  SyncGoldSchema,
  SyncGameStateSchema,
  WebRTCSignalSchema
} from './schemas';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

console.log("Geometry TD Coop-Server läuft auf Port 3000...");

// Headless host connection settings
const FRONTEND_URL = process.env.FRONTEND_URL || "http://gtd-frontend-dev:5173";

// Dynamic ICE/STUN server configuration parsed from environment variables (or fallbacks)
const ICE_SERVERS = process.env.ICE_SERVERS
  ? JSON.parse(process.env.ICE_SERVERS)
  : [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      // Optional: TURN-Server Fallback für striktes symmetrisches NAT
      // { urls: 'turn:turn.example.com:3478', username: 'guest', credential: 'password' }
    ];

interface ActiveBrowserInstance {
  browser: Browser | null;
  page: Page | null;
  status: 'launching' | 'running' | 'failed';
  instanceId: string;
  launchStartedAt: number;
}
const activeBrowsers: Record<string, ActiveBrowserInstance> = {};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

// Rate Limiting helper
const rateLimits = new Map<string, number>();
function checkRateLimit(socketId: string, event: string, limitMs: number = 100): boolean {
  const key = `${socketId}_${event}`;
  const now = Date.now();
  const lastTime = rateLimits.get(key) || 0;
  if (now - lastTime < limitMs) return false;
  rateLimits.set(key, now);
  return true;
}

async function spawnHeadlessHost(mapName: string) {
  if (activeBrowsers[mapName] && activeBrowsers[mapName].status !== 'failed') return;

  const instanceId = Math.random().toString(36).substring(2, 15);
  console.log(`[HEADLESS] Starte Headless-Host für Mission: ${mapName} (ID: ${instanceId})`);
  activeBrowsers[mapName] = {
    browser: null,
    page: null,
    status: 'launching',
    instanceId,
    launchStartedAt: Date.now()
  };

  let browser: Browser | null = null;
  try {
    // Start browser with 30s timeout
    browser = await withTimeout(
      puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        args: [
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--disable-renderer-backgrounding',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--mute-audio'
        ]
      }) as unknown as Promise<Browser>,
      30000,
      "Timeout beim Starten des Puppeteer-Browsers"
    );

    // Abort if stopped or replaced while launching
    if (!activeBrowsers[mapName] || activeBrowsers[mapName].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn für ${mapName} abgebrochen (Race-Condition erkannt nach Launch).`);
      if (browser) await browser.close();
      return;
    }

    // Open new tab with 15s timeout
    const page: Page = await withTimeout(
      browser.newPage(),
      15000,
      "Timeout beim Öffnen eines neuen Tabs"
    );

    if (!activeBrowsers[mapName] || activeBrowsers[mapName].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn für ${mapName} abgebrochen (Race-Condition erkannt nach newPage).`);
      if (browser) await browser.close();
      return;
    }

    await page.setViewport({ width: 1024, height: 1024 });

    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type() as string;
      const text = msg.text();
      const isProd = process.env.NODE_ENV === 'production';
      const isBenchmark = roomStates[mapName]?.benchmarkActive;

      // Suppress logs completely in benchmark mode to prevent event loop bottlenecks
      if (isBenchmark) return;

      // In production, only log warnings and errors
      if (isProd) {
        if (type === 'warning') {
          console.warn(`[BROWSER WARN][${mapName}]:`, text);
        } else if (type === 'error') {
          console.error(`[BROWSER ERROR][${mapName}]:`, text);
        }
      } else {
        // In development, log everything
        console.log(`[BROWSER LOG][${mapName}]:`, text);
      }
    });
    page.on('error', (err: Error) => console.error(`[BROWSER ERROR][${mapName}]:`, err));
    page.on('pageerror', (err: Error) => console.error(`[BROWSER PAGE-ERROR][${mapName}]:`, err));

    const url = `${FRONTEND_URL}/game.html?map=${encodeURIComponent(mapName)}&headless=true`;
    console.log(`[HEADLESS] Lade URL: ${url}`);

    // Navigate with 30s timeout
    await withTimeout(
      page.goto(url, { waitUntil: 'networkidle2' }),
      30000,
      "Timeout beim Laden der Frontend-URL"
    );

    if (!activeBrowsers[mapName] || activeBrowsers[mapName].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn für ${mapName} abgebrochen (Race-Condition erkannt nach goto).`);
      if (browser) await browser.close();
      return;
    }

    activeBrowsers[mapName] = {
      browser,
      page,
      status: 'running',
      instanceId,
      launchStartedAt: activeBrowsers[mapName].launchStartedAt
    };
    console.log(`[HEADLESS] Headless-Host für ${mapName} erfolgreich gestartet.`);
  } catch (err) {
    console.error(`[HEADLESS] Fehler beim Starten des Headless-Hosts für ${mapName}:`, err);
    if (activeBrowsers[mapName] && activeBrowsers[mapName].instanceId === instanceId) {
      delete activeBrowsers[mapName];
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error(`[HEADLESS] Fehler beim Schließen des Browsers im Catch-Block für ${mapName}:`, closeErr);
      }
    }
  }
}

async function stopHeadlessHost(mapName: string) {
  const instance = activeBrowsers[mapName];
  if (!instance) return;

  console.log(`[HEADLESS] Beende Headless-Host für Mission: ${mapName}`);
  delete activeBrowsers[mapName];

  try {
    if (instance.browser) {
      await instance.browser.close();
    }
  } catch (err) {
    console.error(`[HEADLESS] Fehler beim Beenden des Headless-Hosts für ${mapName}:`, err);
  }
}

async function runHeadlessHealthCheck() {
  const now = Date.now();
  for (const mapName of Object.keys(activeBrowsers)) {
    const instance = activeBrowsers[mapName];
    if (!instance) continue;

    // 1. Stuck in launching state check (> 45 seconds)
    if (instance.status === 'launching') {
      const duration = now - instance.launchStartedAt;
      if (duration > 45000) {
        console.warn(`[HEALTH-CHECK] Headless-Host für ${mapName} hängt im 'launching' Status seit ${Math.round(duration / 1000)}s. Bereinige...`);
        delete activeBrowsers[mapName];
        if (instance.browser) {
          try {
            await instance.browser.close();
          } catch (err) {
            console.error(`[HEALTH-CHECK] Fehler beim Schließen des hängenden Browsers für ${mapName}:`, err);
          }
        }
      }
      continue;
    }

    // 2. Orphan check (no active human players in room)
    const room = roomStates[mapName];
    const hasHumanPlayers = room && room.playerCount > 0;
    if (!hasHumanPlayers) {
      console.log(`[HEALTH-CHECK] Keine aktiven menschlichen Spieler mehr für ${mapName}. Beende verwaisten Headless-Browser.`);
      await stopHeadlessHost(mapName);
      continue;
    }

    // 3. Responsiveness check (version call with 5s timeout)
    if (instance.status === 'running' && instance.browser) {
      try {
        await withTimeout(
          instance.browser.version(),
          5000,
          "Browser reagiert nicht auf Anfragen"
        );
      } catch (err) {
        console.error(`[HEALTH-CHECK] Headless-Host für ${mapName} reagiert nicht oder ist abgestürzt:`, err);
        await stopHeadlessHost(mapName);
        activeBrowsers[mapName] = {
          browser: null,
          page: null,
          status: 'failed',
          instanceId: instance.instanceId,
          launchStartedAt: instance.launchStartedAt
        };
      }
    }
  }
}

// --- Refactored: Room-Specific State ---
interface SyncEnemyState {
  id: number;
  typeName: string;
  hp: number;
  distanceTravelled: number;
  targetWaypointIndex: number;
  x: number;
  y: number;
  wave?: number;
  speed: number;
  shieldActive: boolean;
  maxHp: number;
  swarmGroupId?: number;
}

interface RoomTowerState {
  col: number;
  row: number;
  type: string;
  level?: number;
  specId?: string;
  damageDealt?: number;
  totalSpent?: number;
}

interface SyncFullGameStatePayload {
  hostTileSize: number;
  activeEnemies: SyncEnemyState[];
  enemiesToSpawn: number;
  spawnCooldown: number;
  enemyPool: string[];
  isWaveActive: boolean;
  autoStartActive: boolean;
  wave: number;
  lives: number;
  gold: number;
  screenDamageEffect: number;
  benchmarkActive: boolean;
  projectileEvents?: any[];
  towers?: RoomTowerState[];
  tick?: number;
  timestamp?: number;
}

interface SyncDeltaGameStatePayload {
  tick: number;
  timestamp: number;
  hostTileSize?: number;
  enemyDelta: Array<Partial<SyncEnemyState> & { id: number }>;
  deletedEnemyIds: number[];
  projectileEvents?: any[];
  enemiesToSpawn?: number;
  spawnCooldown?: number;
  wave?: number;
  isWaveActive?: boolean;
  autoStartActive?: boolean;
  lives?: number;
  gold?: number;
  enemyPool?: string[];
  screenDamageEffect?: number;
  benchmarkActive?: boolean;
  towers?: RoomTowerState[];
}

interface RoomState {
  hostId: string | null;
  headlessSocketId: string | null;
  towers: RoomTowerState[];
  wave: number;
  isPaused: boolean;
  activeEnemies: SyncEnemyState[];
  enemiesToSpawn: number;
  spawnCooldown: number;
  enemyPool: string[];
  isWaveActive: boolean;
  gameSpeed: number;
  godModeActive: boolean;
  infiniteGoldActive: boolean;
  waveModified: boolean;
  benchmarkActive: boolean;
  lives: number;
  gold: number;
  playerCount: number;
  sockets: Set<string>;
  hostTileSize: number;
  autoStartActive: boolean;
  currentTick: number;
  lastReceivedState: SyncFullGameStatePayload | null;
  [key: string]: any;
}

const roomStates: Record<string, RoomState> = {};
const roomJoinLocks = new Set<string>();

function initRoomState(mapName: string) {
  if (!roomStates[mapName]) {
    roomStates[mapName] = {
      hostId: null,
      headlessSocketId: null,
      towers: [],
      wave: 1,
      isPaused: false,
      activeEnemies: [],
      enemiesToSpawn: 0,
      spawnCooldown: 0,
      enemyPool: [],
      isWaveActive: false,
      gameSpeed: 1.5,
      godModeActive: false,
      infiniteGoldActive: false,
      waveModified: false,
      benchmarkActive: false,
      lives: 20,
      gold: 250,
      playerCount: 0,
      sockets: new Set<string>(),
      hostTileSize: 40, // Default, updated by host
      autoStartActive: false,
      currentTick: 0,
      lastReceivedState: null
    };
  }
}

const missionRooms = ["The Spiral", "The ZigZag", "Quantum Bypass"];

function getMissionStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  missionRooms.forEach(room => {
    stats[room] = roomStates[room] ? roomStates[room].playerCount : 0;
  });
  return stats;
}

app.get('/api/mission_stats', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json(getMissionStats());
});

interface CustomSocket extends Socket {
  mission?: string;
  isHeadless?: boolean;
}

io.on("connection", (socket: CustomSocket) => {
  console.log(`Spieler verbunden: ${socket.id}`);
  socket.emit("mission_stats_update", getMissionStats());

  socket.on("join_mission", async (rawMapName: unknown) => {
    const parsed = JoinMissionSchema.safeParse(rawMapName);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] join_mission mit ungültigem Wert:`, rawMapName);
      return;
    }
    const mapName = parsed.data;

    // Synchrones, zustandsbasiertes Locking für die Raum-Erstellung
    while (roomJoinLocks.has(mapName)) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    roomJoinLocks.add(mapName);

    try {
      initRoomState(mapName);
      const state = roomStates[mapName];

      const isHeadless = socket.handshake.query.headless === 'true';
      socket.isHeadless = isHeadless;

      state.sockets.add(socket.id);

      // Development Host Assignment Logic
      const isDevEnv = process.env.NODE_ENV === 'development';
      const wantHost = socket.handshake.query.wantHost === 'true';
      const shouldBeHost = isHeadless || (isDevEnv && wantHost && !state.hostId);

      if (shouldBeHost) {
        if (isHeadless) {
          console.log(`[HEADLESS] Headless-Host Socket verbunden für Room ${mapName}: ${socket.id}`);
          state.headlessSocketId = socket.id;
        } else {
          console.log(`[DEV-HOST] Human Player ${socket.id} joined Room ${mapName} as HOST!`);
        }
        state.hostId = socket.id;
        socket.emit("role_assigned", { isHost: true, iceServers: ICE_SERVERS });
      } else {
        console.log(`[NETZWERK] Human Player ${socket.id} joined Room ${mapName} as CLIENT`);

        // Only spawn headless host if there is no active host (headless or human) in the room
        if (!state.hostId && (!activeBrowsers[mapName] || activeBrowsers[mapName].status === 'failed')) {
          spawnHeadlessHost(mapName).catch(err => {
            console.error("Async spawnHeadlessHost failed:", err);
          });
        }

        socket.emit("role_assigned", { isHost: false, iceServers: ICE_SERVERS });
      }

      // Unified human player count calculation (both host and clients)
      let humanCount = 0;
      for (const sid of state.sockets) {
        const s = io.sockets.sockets.get(sid) as CustomSocket;
        if (s && !s.isHeadless) {
          humanCount++;
        }
      }
      state.playerCount = humanCount;

      // Update the lobby menu immediately for everyone
      io.emit("mission_stats_update", getMissionStats());

      // Asynchroner Beitritt zum Socket.io-Raum erfolgt erst nach der synchronen Zustands-Aktualisierung
      await socket.join(mapName);
      socket.mission = mapName;

      // Update player count for everyone in the same mission (including the new player/host)
      io.to(mapName).emit("player_count_update", state.playerCount);

      const stateToSend = { ...state, sockets: Array.from(state.sockets) };
      socket.emit("full_game_state", stateToSend);
      console.log(`Spieler ${socket.id} ist Mission ${mapName} beigetreten. (Größe: ${state.playerCount})`);
    } finally {
      // Lock freigeben
      roomJoinLocks.delete(mapName);
    }
  });

  socket.on("ready_to_play", () => {
    socket.emit("sync_complete");
  });

  // Generische Relay-Funktion für alle Spielereignisse (Room-Isolated)
  const relay = (event: string) => {
    socket.on(event, (data: any) => {
      if (socket.mission) {
        socket.to(socket.mission).emit(event, data);
      }
    });
  };

  // 1. Turm-Aktionen - Requests (von Clients an Host)
  socket.on("request_place_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestPlaceTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] request_place_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    if (state.hostId) {
      io.to(state.hostId).emit("request_place_tower", data);
    }
  });

  socket.on("request_upgrade_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestUpgradeTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] request_upgrade_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    if (state.hostId) {
      io.to(state.hostId).emit("request_upgrade_tower", data);
    }
  });

  socket.on("request_sell_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestSellTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] request_sell_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    if (state.hostId) {
      io.to(state.hostId).emit("request_sell_tower", data);
    }
  });

  // Turm-Aktionen - Confirms (von Host an alle anderen)
  socket.on("confirm_place_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ConfirmPlaceTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] confirm_place_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    roomStates[socket.mission].towers.push(data);
    socket.to(socket.mission).emit("confirm_place_tower", data);
  });

  socket.on("reject_place_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RejectPlaceTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] reject_place_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    socket.to(socket.mission).emit("reject_place_tower", data);
  });

  socket.on("confirm_upgrade_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ConfirmUpgradeTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] confirm_upgrade_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    const tower = roomStates[socket.mission].towers.find((t: RoomTowerState) => t.col === data.col && t.row === data.row);
    if (tower) {
      if (data.specId) {
        tower.specId = data.specId;
      }
      if (data.level) {
        tower.level = data.level;
      } else {
        tower.level = (tower.level || 1) + 1;
      }
    }
    socket.to(socket.mission).emit("confirm_upgrade_tower", data);
  });

  socket.on("confirm_sell_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ConfirmSellTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] confirm_sell_tower von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    roomStates[socket.mission].towers = roomStates[socket.mission].towers.filter((t: RoomTowerState) => !(t.col === data.col && t.row === data.row));
    socket.to(socket.mission).emit("confirm_sell_tower", data);
  });

  socket.on("sync_towers", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = SyncTowersSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] sync_towers von ${socket.id}:`, parsed.error.format());
      return;
    }
    const towersList = parsed.data;
    roomStates[socket.mission].towers = towersList;
    socket.to(socket.mission).emit("sync_towers", towersList);
  });

  // 2. Wellen-Synchronisation
  socket.on("request_wave_start", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestWaveStartSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] request_wave_start von ${socket.id}:`, parsed.error.format());
      return;
    }
    let data = parsed.data;
    const state = roomStates[socket.mission];
    
    // Ensure data is an object for appending metadata
    if (typeof data !== 'object') {
      data = { wave: data };
    }
    
    state.wave = data.wave;
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    
    console.log(`Welle ${state.wave} in ${socket.mission} gestartet (angefordert von ${socket.id})`);
    io.to(socket.mission).emit("start_wave_sync", data);
  });

  // Pause-Synchronisation
  socket.on("toggle_pause", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = TogglePauseSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] toggle_pause von ${socket.id}:`, parsed.error.format());
      return;
    }
    const pausedState = parsed.data;
    roomStates[socket.mission].isPaused = pausedState;
    socket.to(socket.mission).emit("toggle_pause", pausedState);
  });

  // Speed-Synchronisation
  socket.on("change_speed", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ChangeSpeedSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] change_speed von ${socket.id}:`, parsed.error.format());
      return;
    }
    const speed = parsed.data;
    roomStates[socket.mission].gameSpeed = speed;
    socket.to(socket.mission).emit("change_speed", speed);
  });

  // Auto-Synchronisation
  socket.on("toggle_auto", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ToggleAutoSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] toggle_auto von ${socket.id}:`, parsed.error.format());
      return;
    }
    const isActive = parsed.data;
    roomStates[socket.mission].autoStartActive = isActive;
    socket.to(socket.mission).emit("toggle_auto", isActive);
  });

  // Mod-Synchronisation
  socket.on("toggle_mod", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ToggleModSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] toggle_mod von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    if (data.mod === 'godMode') roomStates[socket.mission].godModeActive = data.value;
    if (data.mod === 'infiniteGold') roomStates[socket.mission].infiniteGoldActive = data.value;
    if (data.mod === 'waveModified') roomStates[socket.mission].waveModified = data.value;
    if (data.mod === 'benchmarkActive') roomStates[socket.mission].benchmarkActive = data.value;
    socket.to(socket.mission).emit("toggle_mod", data);
  });

  // Gegner-State vom aktiven Client
  socket.on("sync_game_state", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const state = roomStates[socket.mission];

    // Only process if from host
    if (state.hostId !== socket.id) return;

    const parsed = SyncGameStateSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] sync_game_state von ${socket.id}:`, parsed.error.format());
      return;
    }
    const payload = parsed.data;

    if (payload.fullSync) {
        state.lastReceivedState = payload.state as unknown as SyncFullGameStatePayload;
        state.currentTick = payload.state.tick;
        Object.assign(state, payload.state); // Update shadow state
    } else if (payload.delta) {
        const delta = payload.state as unknown as SyncDeltaGameStatePayload;
        state.currentTick = delta.tick;
        if (!state.lastReceivedState) {
            state.lastReceivedState = {
                hostTileSize: state.hostTileSize || 40,
                activeEnemies: [],
                enemiesToSpawn: state.enemiesToSpawn || 0,
                spawnCooldown: state.spawnCooldown || 0,
                enemyPool: state.enemyPool || [],
                isWaveActive: state.isWaveActive || false,
                autoStartActive: state.autoStartActive || false,
                wave: state.wave || 1,
                lives: state.lives || 20,
                gold: state.gold || 250,
                screenDamageEffect: 0,
                benchmarkActive: state.benchmarkActive || false
            };
        }
        
        const lastState = state.lastReceivedState;

        // Reconstruct shadow state
        const existingMap = new Map<number, SyncEnemyState>();
        for (let e of lastState.activeEnemies) {
            existingMap.set(e.id, e);
        }
        const enemyDelta = (delta.enemyDelta || []) as any[];
        for (let d of enemyDelta) {
            let existing = existingMap.get(d.id);
            if (existing) Object.assign(existing, d);
            else lastState.activeEnemies.push(d as SyncEnemyState);
        }
        const deletedEnemyIds = delta.deletedEnemyIds;
        if (deletedEnemyIds) {
            lastState.activeEnemies = lastState.activeEnemies.filter((e: SyncEnemyState) => !deletedEnemyIds.includes(e.id));
        }
        for (let key in delta) {
            if (key !== 'enemyDelta' && key !== 'deletedEnemyIds' && key !== 'tick' && key !== 'timestamp') {
                (lastState as any)[key] = (delta as any)[key];
                state[key] = (delta as any)[key]; // Update top-level shadow state
            }
        }
        state.activeEnemies = lastState.activeEnemies;
    }

    // Relay to clients
    socket.to(socket.mission).emit("sync_game_state", payload);
  });

  socket.on("sync_lives", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = SyncLivesSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] sync_lives von ${socket.id}:`, parsed.error.format());
      return;
    }
    const lives = parsed.data;
    roomStates[socket.mission].lives = lives;
    socket.to(socket.mission).emit("sync_lives", lives);
  });

  socket.on("sync_gold", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = SyncGoldSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] sync_gold von ${socket.id}:`, parsed.error.format());
      return;
    }
    const gold = parsed.data;
    roomStates[socket.mission].gold = gold;
    socket.to(socket.mission).emit("sync_gold", gold);
  });

  // 4. Gegner-Events (Falls wichtig für Spezialeffekte)
  relay("enemy_leaked");
  relay("host_ended_wave");

  // WebRTC-Signalisierungs-Relay
  socket.on("webrtc_signal", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = WebRTCSignalSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] webrtc_signal von ${socket.id}:`, parsed.error.format());
      return;
    }
    const data = parsed.data;
    if (data.targetId) {
      io.to(data.targetId).emit("webrtc_signal", {
        senderId: socket.id,
        signal: data.signal
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Spieler getrennt: ${socket.id}`);
    if (socket.mission && roomStates[socket.mission]) {
      const state = roomStates[socket.mission];

      // Socket aus dem manuellen Tracking entfernen
      state.sockets.delete(socket.id);

      if (state.hostId === socket.id) {
        console.log(`[HOST] Host ${socket.id} disconnected.`);
        state.hostId = null;
      }

      if (socket.isHeadless) {
        console.log(`[HEADLESS] Headless-Host getrennt für Sektor ${socket.mission}`);
        state.headlessSocketId = null;
      } else {
        // Recalculate human players count
        let humanCount = 0;
        for (const sid of state.sockets) {
          const s = io.sockets.sockets.get(sid) as CustomSocket;
          if (s && !s.isHeadless) {
            humanCount++;
          }
        }
        state.playerCount = humanCount;
        io.to(socket.mission).emit("player_count_update", state.playerCount);

        // If no human players left, clean up the headless browser and room state!
        if (state.playerCount === 0) {
          console.log(`[NETZWERK] Keine Spieler mehr in ${socket.mission}. Beende Headless-Host.`);
          stopHeadlessHost(socket.mission).catch(err => {
            console.error("Async stopHeadlessHost failed:", err);
          });
          delete roomStates[socket.mission];
        }
      }
    }
    // Update lobby stats for everyone
    io.emit("mission_stats_update", getMissionStats());
  });
});

server.listen(3000, () => {
  console.log("Server lauscht auf http://localhost:3000");
  
  // Periodischen Health-Check alle 30 Sekunden starten
  setInterval(() => {
    runHeadlessHealthCheck().catch(err => {
      console.error("Fehler im periodischen Headless-Health-Check:", err);
    });
  }, 30000);
});
