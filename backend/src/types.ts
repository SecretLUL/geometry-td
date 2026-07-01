import { Request } from "express";
import { Socket } from "socket.io";
import { Browser, Page } from "puppeteer-core";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    username: string;
  };
}

export interface CustomSocket extends Socket {
  mission?: string;
  isHeadless?: boolean;
  user?: {
    id: number;
    username: string;
  };
}

export interface ActiveBrowserInstance {
  browser: Browser | null;
  page: Page | null;
  status: "launching" | "running" | "failed";
  instanceId: string;
  launchStartedAt: number;
}

export interface SyncEnemyState {
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

export interface RoomTowerState {
  col: number;
  row: number;
  type: string;
  level?: number;
  specId?: string;
  damageDealt?: number;
  totalSpent?: number;
  ownerIndex?: number;
}

export interface SyncFullGameStatePayload {
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
  projectileEvents?: any[];
  towers?: RoomTowerState[];
  tick?: number;
  timestamp?: number;
  playerSlots?: Array<string | null>;
  playerGolds?: number[];
  relocationActive?: boolean;
  playerRelocationStates?: boolean[];
}

export interface SyncDeltaGameStatePayload {
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
  towers?: RoomTowerState[];
  playerSlots?: Array<string | null>;
  playerGolds?: number[];
  relocationActive?: boolean;
  playerRelocationStates?: boolean[];
}

export interface RoomState {
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
  lives: number;
  gold: number;
  playerCount: number;
  sockets: Set<string>;
  hostTileSize: number;
  autoStartActive: boolean;
  currentTick: number;
  lastReceivedState: SyncFullGameStatePayload | null;
  mapName: string;
  mode: "singleplayer" | "public" | "private";
  roomId: string;
  playerSlots?: Array<string | null>;
  playerGolds?: number[];
  relocationActive?: boolean;
  playerRelocationStates?: boolean[];
  [key: string]: any;
}
