/*
 * @file: backend\src\server.ts
 * @purpose: Authoritative Headless-Host coordinating Express & Socket.io server using Puppeteer to run secure, background-safe Coop game simulations.
 * @dependencies: express, http, socket.io, path, puppeteer-core, zod, cookie-parser, bcrypt, jsonwebtoken, pg-promise
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
 * @last_update: 2026-06-04 / v1.11.0 - Added /api/user/unlock-achievement endpoint.
 */
import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import path from 'path';
import puppeteer, { Browser, Page, ConsoleMessage } from 'puppeteer-core';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db, initDatabaseSchema } from './db';
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

app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_dev_key_123!';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const isProd = process.env.NODE_ENV === 'production';
  const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
  const token = req.cookies[cName];
  
  if (!token) {
    res.status(401).json({ error: 'Nicht authentifiziert' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
    (req as AuthenticatedRequest).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Ungültige Sitzung' });
  }
}

// REST-Endpunkte für Authentication & Progression
app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Ungültige Eingabedaten' });
    return;
  }
  
  const trimmedUser = username.trim();
  if (trimmedUser.length < 4 || trimmedUser.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUser)) {
    res.status(400).json({ error: 'Benutzername muss zwischen 4 und 20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und - enthalten.' });
    return;
  }
  
  if (password.length < 8) {
    res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein.' });
    return;
  }
  
  try {
    const existing = await db.oneOrNone('SELECT id FROM users WHERE username = $1', [trimmedUser]);
    if (existing) {
      res.status(400).json({ error: 'Benutzername ist bereits vergeben.' });
      return;
    }
    
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    await db.tx(async t => {
      const newUser = await t.one(
        'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
        [trimmedUser, passwordHash]
      );
      await t.none(
        'INSERT INTO progress (user_id, highest_wave, unlocked_skins, unlocked_achievements, selected_skin) VALUES ($1, 0, $2, $3, $4)',
        [newUser.id, JSON.stringify(['default']), JSON.stringify([]), 'default']
      );
    });
    
    res.status(201).json({ success: true, message: 'Registrierung erfolgreich.' });
  } catch (error) {
    console.error('[AUTH] Fehler bei Registrierung:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password, remember } = req.body;
  
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'Ungültige Eingabedaten' });
    return;
  }
  
  try {
    const user = await db.oneOrNone('SELECT id, username, password_hash, avatar, created_at FROM users WHERE username = $1', [username.trim()]);
    if (!user) {
      res.status(400).json({ error: 'Ungültiger Benutzername oder Passwort.' });
      return;
    }
    
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      res.status(400).json({ error: 'Ungültiger Benutzername oder Passwort.' });
      return;
    }
    
    // Remember me cookie/JWT config
    const isRemember = remember === true;
    const jwtExpires = isRemember ? '30d' : '24h';
    const cookieMaxAge = isRemember ? 30 * 24 * 60 * 60 * 1000 : undefined;
    
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: jwtExpires });
    
    const isProd = process.env.NODE_ENV === 'production';
    const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
    
    res.cookie(cName, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      ...(cookieMaxAge !== undefined ? { maxAge: cookieMaxAge } : {}),
      path: '/'
    });
    
    res.json({ success: true, user: { id: user.id, username: user.username, avatar: user.avatar, created_at: user.created_at } });
  } catch (error) {
    console.error('[AUTH] Fehler bei Login:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  const isProd = process.env.NODE_ENV === 'production';
  const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
  res.clearCookie(cName, { path: '/' });
  res.json({ success: true });
});

app.get('/api/auth/me', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const user = await db.oneOrNone('SELECT id, username, avatar, created_at FROM users WHERE id = $1', [authReq.user!.id]);
    if (!user) {
      res.status(401).json({ error: 'Benutzer nicht gefunden' });
      return;
    }
    res.json({ user: { id: user.id, username: user.username, avatar: user.avatar, created_at: user.created_at } });
  } catch (err) {
    console.error('[AUTH] Fehler bei /api/auth/me:', err);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

app.get('/api/user/progress', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  try {
    const progress = await db.oneOrNone(
      'SELECT highest_wave, unlocked_skins, unlocked_achievements, selected_skin FROM progress WHERE user_id = $1',
      [authReq.user!.id]
    );
    if (!progress) {
      res.status(404).json({ error: 'Fortschritt nicht gefunden.' });
      return;
    }
    res.json({ progress });
  } catch (error) {
    console.error('[PROGRESS] Fehler beim Laden:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

app.post('/api/user/progress', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { selected_skin } = req.body;
  
  if (selected_skin && typeof selected_skin !== 'string') {
    res.status(400).json({ error: 'Ungültiges Format für selected_skin' });
    return;
  }
  
  try {
    if (selected_skin) {
      const progress = await db.one('SELECT unlocked_skins FROM progress WHERE user_id = $1', [authReq.user!.id]);
      const unlocked = progress.unlocked_skins || [];
      if (!unlocked.includes(selected_skin)) {
        res.status(400).json({ error: 'Dieser Skin ist noch nicht freigeschaltet.' });
        return;
      }
      
      await db.none('UPDATE progress SET selected_skin = $1, updated_at = NOW() WHERE user_id = $2', [selected_skin, authReq.user!.id]);
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('[PROGRESS] Fehler beim Speichern:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

app.post('/api/user/unlock-achievement', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { achievementId } = req.body;
  
  if (!achievementId || typeof achievementId !== 'string') {
    res.status(400).json({ error: 'Ungültige Errungenschafts-ID.' });
    return;
  }

  try {
    const progress = await db.oneOrNone('SELECT unlocked_achievements FROM progress WHERE user_id = $1', [authReq.user!.id]);
    if (!progress) {
      res.status(404).json({ error: 'Fortschritt nicht gefunden.' });
      return;
    }

    const achievements: string[] = progress.unlocked_achievements || [];
    
    if (achievements.includes(achievementId)) {
      res.json({ success: true, alreadyUnlocked: true });
      return;
    }

    achievements.push(achievementId);

    await db.none(
      'UPDATE progress SET unlocked_achievements = $1, updated_at = NOW() WHERE user_id = $2',
      [JSON.stringify(achievements), authReq.user!.id]
    );

    res.json({ success: true, newlyUnlocked: true });
  } catch (error) {
    console.error('[ACHIEVEMENT] Fehler beim Freischalten:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});


app.post('/api/user/profile', authenticateUser, async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;
  const { username, avatar } = req.body;
  
  try {
    const userId = authReq.user!.id;
    let newUsername = authReq.user!.username;
    
    // 1. Username-Validierung falls übergeben
    if (username !== undefined) {
      if (typeof username !== 'string') {
        res.status(400).json({ error: 'Ungültiger Benutzernamens-Typ.' });
        return;
      }
      const trimmedUser = username.trim();
      if (trimmedUser.length < 4 || trimmedUser.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(trimmedUser)) {
        res.status(400).json({ error: 'Benutzername muss zwischen 4 und 20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und - enthalten.' });
        return;
      }
      
      // Prüfen ob bereits vergeben
      const existing = await db.oneOrNone('SELECT id FROM users WHERE username = $1 AND id != $2', [trimmedUser, userId]);
      if (existing) {
        res.status(400).json({ error: 'Benutzername ist bereits vergeben.' });
        return;
      }
      newUsername = trimmedUser;
    }
    
    // 2. Avatar-Validierung falls übergeben
    if (avatar !== undefined) {
      if (avatar !== null && typeof avatar !== 'string') {
        res.status(400).json({ error: 'Ungültiger Avatar-Typ.' });
        return;
      }
      if (avatar !== null) {
        // Begrenzung auf 500 KB (Zylinder für base64 Länge ist 4/3 * size, also ca 680k Zeichen)
        if (avatar.length > 700000) {
          res.status(400).json({ error: 'Profilbild darf nicht größer als 500 KB sein.' });
          return;
        }
        if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(avatar)) {
          res.status(400).json({ error: 'Ungültiges Bildformat. Nur PNG, JPEG, GIF und WEBP sind erlaubt.' });
          return;
        }
      }
    }
    
    // Datenbank aktualisieren
    await db.tx(async t => {
      if (username !== undefined) {
        await t.none('UPDATE users SET username = $1 WHERE id = $2', [newUsername, userId]);
      }
      if (avatar !== undefined) {
        await t.none('UPDATE users SET avatar = $1 WHERE id = $2', [avatar, userId]);
      }
    });
    
    // Falls der Benutzername geändert wurde, Session-Cookie neu generieren
    if (username !== undefined) {
      const token = jwt.sign({ id: userId, username: newUsername }, JWT_SECRET, { expiresIn: '7d' });
      const isProd = process.env.NODE_ENV === 'production';
      const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
      
      res.cookie(cName, token, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 Tage default
        path: '/'
      });
    }
    
    const user = await db.one('SELECT created_at FROM users WHERE id = $1', [userId]);
    res.json({ success: true, user: { id: userId, username: newUsername, avatar: avatar !== undefined ? avatar : undefined, created_at: user.created_at } });
  } catch (error) {
    console.error('[PROFILE] Fehler beim Aktualisieren des Profils:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

app.get('/api/leaderboard', async (_req: Request, res: Response) => {
  try {
    const leaderboard = await db.any(
      `SELECT u.username, u.avatar, p.highest_wave, p.updated_at
       FROM progress p
       JOIN users u ON p.user_id = u.id
       WHERE p.highest_wave > 0
       ORDER BY p.highest_wave DESC, p.updated_at ASC
       LIMIT 100`
    );
    res.json({ leaderboard });
  } catch (error) {
    console.error('[LEADERBOARD] Fehler beim Laden:', error);
    res.status(500).json({ error: 'Interner Serverfehler.' });
  }
});

// Sicheres Highscore-Update bei Wellen-Fortschritt
async function updateRoomHighscores(roomId: string) {
  const state = roomStates[roomId];
  if (!state) return;
  
  const currentWave = state.wave;
  if (currentWave <= 1) return; // Welle 1 muss nicht separat gespeichert werden
  
  for (const socketId of state.sockets) {
    const s = io.sockets.sockets.get(socketId) as CustomSocket;
    if (s && s.user) {
      try {
        await db.none(
          `INSERT INTO progress (user_id, highest_wave) 
           VALUES ($1, $2) 
           ON CONFLICT (user_id) 
           DO UPDATE SET highest_wave = GREATEST(progress.highest_wave, EXCLUDED.highest_wave), updated_at = NOW()`,
          [s.user.id, currentWave]
        );
      } catch (err) {
        console.error(`[DATABASE] Fehler beim Speichern des Highscores für User ${s.user.username}:`, err);
      }
    }
  }
}

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware zur Authentifizierung von Socket.io-Verbindungen über Cookies
io.use((socket: any, next) => {
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map((c: string) => {
        const parts = c.trim().split('=');
        return [parts[0], parts.slice(1).join('=')];
      })
    );
    const isProd = process.env.NODE_ENV === 'production';
    const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
    const token = cookies[cName];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
        socket.user = decoded;
        console.log(`[SOCKET] Benutzer authentifiziert: ${decoded.username} (${socket.id})`);
      } catch (err) {
        console.warn(`[SOCKET] Ungültiges Token bei Verbindung ${socket.id}`);
      }
    }
  }
  next();
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


async function spawnHeadlessHost(roomId: string, mapName: string) {
  if (activeBrowsers[roomId] && activeBrowsers[roomId].status !== 'failed') return;

  const instanceId = Math.random().toString(36).substring(2, 15);
  console.log(`[HEADLESS] Starte Headless-Host für Room: ${roomId} (Map: ${mapName}, ID: ${instanceId})`);
  activeBrowsers[roomId] = {
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
    if (!activeBrowsers[roomId] || activeBrowsers[roomId].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn für Room ${roomId} abgebrochen (Race-Condition erkannt nach Launch).`);
      if (browser) await browser.close();
      return;
    }

    // Open new tab with 15s timeout
    const page: Page = await withTimeout(
      browser.newPage(),
      15000,
      "Timeout beim Öffnen eines neuen Tabs"
    );

    if (!activeBrowsers[roomId] || activeBrowsers[roomId].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn für Room ${roomId} abgebrochen (Race-Condition erkannt nach newPage).`);
      if (browser) await browser.close();
      return;
    }

    await page.setViewport({ width: 1024, height: 1024 });

    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type() as string;
      const text = msg.text();
      const isProd = process.env.NODE_ENV === 'production';
      const isBenchmark = roomStates[roomId]?.benchmarkActive;

      // Suppress logs completely in benchmark mode to prevent event loop bottlenecks
      if (isBenchmark) return;

      // In production, only log warnings and errors
      if (isProd) {
        if (type === 'warning') {
          console.warn(`[BROWSER WARN][Room ${roomId}]:`, text);
        } else if (type === 'error') {
          console.error(`[BROWSER ERROR][Room ${roomId}]:`, text);
        }
      } else {
        // In development, log everything
        console.log(`[BROWSER LOG][Room ${roomId}]:`, text);
      }
    });
    page.on('error', (err: Error) => console.error(`[BROWSER ERROR][Room ${roomId}]:`, err));
    page.on('pageerror', (err: Error) => console.error(`[BROWSER PAGE-ERROR][Room ${roomId}]:`, err));

    const url = `${FRONTEND_URL}/game.html?map=${encodeURIComponent(mapName)}&headless=true&roomId=${encodeURIComponent(roomId)}`;
    console.log(`[HEADLESS] Lade URL: ${url}`);

    // Navigate with 30s timeout
    await withTimeout(
      page.goto(url, { waitUntil: 'networkidle2' }),
      30000,
      "Timeout beim Laden der Frontend-URL"
    );

    if (!activeBrowsers[roomId] || activeBrowsers[roomId].instanceId !== instanceId) {
      console.log(`[HEADLESS] Spawn für Room ${roomId} abgebrochen (Race-Condition erkannt nach goto).`);
      if (browser) await browser.close();
      return;
    }

    activeBrowsers[roomId] = {
      browser,
      page,
      status: 'running',
      instanceId,
      launchStartedAt: activeBrowsers[roomId].launchStartedAt
    };
    console.log(`[HEADLESS] Headless-Host für Room ${roomId} erfolgreich gestartet.`);
  } catch (err) {
    console.error(`[HEADLESS] Fehler beim Starten des Headless-Hosts für Room ${roomId}:`, err);
    if (activeBrowsers[roomId] && activeBrowsers[roomId].instanceId === instanceId) {
      delete activeBrowsers[roomId];
    }
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error(`[HEADLESS] Fehler beim Schließen des Browsers im Catch-Block für Room ${roomId}:`, closeErr);
      }
    }
  }
}

async function stopHeadlessHost(roomId: string) {
  const instance = activeBrowsers[roomId];
  if (!instance) return;

  console.log(`[HEADLESS] Beende Headless-Host für Room: ${roomId}`);
  delete activeBrowsers[roomId];

  try {
    if (instance.browser) {
      await instance.browser.close();
    }
  } catch (err) {
    console.error(`[HEADLESS] Fehler beim Beenden des Headless-Hosts für Room ${roomId}:`, err);
  }
}

async function runHeadlessHealthCheck() {
  const now = Date.now();
  for (const roomId of Object.keys(activeBrowsers)) {
    const instance = activeBrowsers[roomId];
    if (!instance) continue;

    // 1. Stuck in launching state check (> 45 seconds)
    if (instance.status === 'launching') {
      const duration = now - instance.launchStartedAt;
      if (duration > 45000) {
        console.warn(`[HEALTH-CHECK] Headless-Host für Room ${roomId} hängt im 'launching' Status seit ${Math.round(duration / 1000)}s. Bereinige...`);
        delete activeBrowsers[roomId];
        if (instance.browser) {
          try {
            await instance.browser.close();
          } catch (err) {
            console.error(`[HEALTH-CHECK] Fehler beim Schließen des hängenden Browsers für Room ${roomId}:`, err);
          }
        }
      }
      continue;
    }

    // 2. Orphan check (no active human players in room)
    const room = roomStates[roomId];
    const hasHumanPlayers = room && room.playerCount > 0;
    if (!hasHumanPlayers) {
      console.log(`[HEALTH-CHECK] Keine aktiven menschlichen Spieler mehr für Room ${roomId}. Beende verwaisten Headless-Browser.`);
      await stopHeadlessHost(roomId);
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
        console.error(`[HEALTH-CHECK] Headless-Host für Room ${roomId} reagiert nicht oder ist abgestürzt:`, err);
        await stopHeadlessHost(roomId);
        activeBrowsers[roomId] = {
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
  shieldHp?: number;
  maxShieldHp?: number;
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
  mapName: string;
  mode: 'singleplayer' | 'public' | 'private';
  roomId: string;
  [key: string]: any;
}

const roomStates: Record<string, RoomState> = {};
const roomJoinLocks = new Set<string>();

function initRoomState(roomId: string, mapName: string, mode: 'singleplayer' | 'public' | 'private') {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
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
      lastReceivedState: null,
      mapName,
      mode,
      roomId
    };
  }
}

const missionRooms = ["The Spiral", "The ZigZag", "Quantum Bypass"];

function getMissionStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  missionRooms.forEach(room => {
    stats[room] = 0;
  });
  for (const roomId in roomStates) {
    const room = roomStates[roomId];
    if (room.mode === 'public' && stats[room.mapName] !== undefined) {
      stats[room.mapName] += room.playerCount;
    }
  }
  return stats;
}

function getTotalOnlinePlayers(disconnectingSocketId?: string): number {
  let count = 0;
  for (const [id, socket] of io.sockets.sockets) {
    if (id === disconnectingSocketId) continue;
    if (!(socket as any).isHeadless && socket.connected) {
      count++;
    }
  }
  return count;
}

app.get('/api/mission_stats', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json(getMissionStats());
});

app.get('/api/online_players', (_req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.json({ total: getTotalOnlinePlayers() });
});

app.get('/api/room/:roomId', (req: Request, res: Response) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  const roomId = (req.params.roomId as string).toUpperCase();
  const room = roomStates[roomId];
  if (room && room.mode !== 'singleplayer') {
    res.json({ exists: true, mapName: room.mapName, playerCount: room.playerCount, mode: room.mode });
  } else {
    res.json({ exists: false });
  }
});

interface CustomSocket extends Socket {
  mission?: string;
  isHeadless?: boolean;
  user?: {
    id: number;
    username: string;
  };
}

io.on("connection", (socket: CustomSocket) => {
  socket.isHeadless = socket.handshake.query.headless === 'true';
  console.log(`Spieler verbunden: ${socket.id}`);
  socket.emit("mission_stats_update", getMissionStats());
  io.emit("online_players_update", getTotalOnlinePlayers());

  socket.on("join_mission", async (rawPayload: unknown) => {
    const parsed = JoinMissionSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] join_mission mit ungültigem Wert:`, rawPayload);
      return;
    }

    let mapName: string;
    let mode: 'singleplayer' | 'public' | 'private' = 'public';
    let roomId: string | undefined;
    let action: string | undefined;

    if (typeof parsed.data === 'string') {
      mapName = parsed.data;
    } else {
      mapName = parsed.data.mapName;
      mode = (parsed.data.mode as any) || 'public';
      roomId = parsed.data.roomId;
      action = parsed.data.action;
    }

    const isHeadless = socket.handshake.query.headless === 'true';
    socket.isHeadless = isHeadless;
    
    // Headless-Host can specify roomId in the handshake query
    if (isHeadless) {
      const queryRoomId = socket.handshake.query.roomId as string;
      if (queryRoomId) {
        roomId = queryRoomId;
      }
    }

    let finalRoomId = roomId;

    if (mode === 'singleplayer') {
      finalRoomId = `single-${socket.id}`;
    } else if (mode === 'public') {
      if (!finalRoomId) {
        // Search open public rooms
        finalRoomId = Object.keys(roomStates).find(rid => {
          const r = roomStates[rid];
          return r.mapName === mapName && r.mode === 'public' && r.playerCount < 4;
        });

        if (!finalRoomId) {
          finalRoomId = `pub-${Math.random().toString(36).substring(2, 10)}`;
        }
      }
    } else if (mode === 'private') {
      if (action === 'create' || !finalRoomId) {
        let code = '';
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        do {
          code = '';
          for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        } while (roomStates[code]);
        finalRoomId = code;
      } else {
        finalRoomId = finalRoomId.toUpperCase();
        const targetRoom = roomStates[finalRoomId];
        if (!targetRoom) {
          socket.emit('room_error', 'Der angeforderte private Raum existiert nicht oder ist abgelaufen.');
          return;
        }
        if (targetRoom.playerCount >= 4) {
          socket.emit('room_error', 'Der private Raum ist bereits voll (maximal 4 Spieler).');
          return;
        }
        mapName = targetRoom.mapName;
      }
    }

    if (!finalRoomId) {
      socket.emit('room_error', 'Fehler beim Bestimmen der Raum-ID.');
      return;
    }

    // Synchrones, zustandsbasiertes Locking für die Raum-Erstellung
    while (roomJoinLocks.has(finalRoomId)) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    roomJoinLocks.add(finalRoomId);

    try {
      initRoomState(finalRoomId, mapName, mode);
      const state = roomStates[finalRoomId];

      state.sockets.add(socket.id);

      // Dev or isolated singleplayer logic handles host assignment
      const isDevEnv = process.env.NODE_ENV === 'development';
      const wantHost = socket.handshake.query.wantHost === 'true';
      const shouldBeHost = isHeadless || (mode === 'singleplayer') || (isDevEnv && wantHost && !state.hostId) || (!state.hostId);

      if (shouldBeHost) {
        if (isHeadless) {
          console.log(`[HEADLESS] Headless-Host Socket verbunden für Room ${finalRoomId} (${mapName}): ${socket.id}`);
          state.headlessSocketId = socket.id;
        } else {
          console.log(`[DEV-HOST] Human Player ${socket.id} joined Room ${finalRoomId} (${mapName}) as HOST!`);
        }
        state.hostId = socket.id;
        socket.emit("role_assigned", { isHost: true, iceServers: ICE_SERVERS });
      } else {
        console.log(`[NETZWERK] Human Player ${socket.id} joined Room ${finalRoomId} (${mapName}) as CLIENT`);

        // Only spawn headless host if there is no active host and it's not singleplayer
        if (mode !== 'singleplayer' && !state.hostId && (!activeBrowsers[finalRoomId] || activeBrowsers[finalRoomId].status === 'failed')) {
          spawnHeadlessHost(finalRoomId, mapName).catch(err => {
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
      await socket.join(finalRoomId);
      socket.mission = finalRoomId;

      // Update player count for everyone in the same mission (including the new player/host)
      io.to(finalRoomId).emit("player_count_update", state.playerCount);

      const stateToSend = { ...state, sockets: Array.from(state.sockets) };
      socket.emit("full_game_state", stateToSend);
      console.log(`Spieler ${socket.id} ist Raum ${finalRoomId} beigetreten. (Größe: ${state.playerCount})`);
    } finally {
      // Lock freigeben
      roomJoinLocks.delete(finalRoomId);
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
    
    // Automatisch den Highscore in der DB aktualisieren für alle angemeldeten Spieler im Raum
    updateRoomHighscores(socket.mission).catch(err => {
      console.error("[DATABASE] Fehler beim asynchronen Update der Highscores im Raum:", err);
    });
    
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
    io.emit("online_players_update", getTotalOnlinePlayers(socket.id));
  });
});

server.listen(3000, async () => {
  console.log("Server lauscht auf http://localhost:3000");
  
  try {
    await initDatabaseSchema();
  } catch (err) {
    console.error("Schwerwiegender Fehler beim Initialisieren der Datenbank:", err);
  }
  
  // Periodischen Health-Check alle 30 Sekunden starten
  setInterval(() => {
    runHeadlessHealthCheck().catch(err => {
      console.error("Fehler im periodischen Headless-Health-Check:", err);
    });
  }, 30000);
});

