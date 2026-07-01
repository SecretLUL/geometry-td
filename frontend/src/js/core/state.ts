/*
 * @file: frontend/src/js/core/state.ts
 * @purpose: Holds the reactive in-memory GameState instance for local tracking of lives, gold,
 *           camera position, and arrays of all active game entities.
 * @dependencies: types, pool, config
 * @last_update: 2026-06-04 / v1.4.5 - Initialized isGuest and unlockedAchievements in state.
 */
import { GameState } from "../types";
import { Config } from "./config";
import { setGameStateRef } from "./utils";

// NOTE: PoolManager.init() is now called in game.ts AFTER initPixi(), to avoid
// a Race Condition where pool constructors (Particle, Projectile, etc.) run before
// the PixiJS renderer (app.renderer) is ready, leaving them without GPU sprites.

export const state: GameState = {
  isHost: false,
  lives: Config.STARTING_LIVES,
  gold: Config.STARTING_GOLD,
  playerGolds: [Config.STARTING_GOLD, 0, 0, 0],
  playerSlots: [null, null, null, null],
  relocationActive: false,
  playerRelocationStates: [false, false, false, false],
  relocatingTower: null,
  wave: 1,
  totalGoldEarned: 0,
  totalGoldFromInterest: 0,
  recordWave: localStorage.getItem("td_record_wave") || 0,
  isWaveActive: false,
  gameOver: false,
  isPaused: false,
  wasPaused: false,
  gameSpeed: Config.GAME_SPEEDS.NORMAL,
  webRTCStatus: "idle",
  autoStartActive: false,
  godMode: false,
  infiniteGold: false,
  waveModified: false,
  originalWave: null,
  benchmarkActive: false,
  benchmarkBackup: null,
  selectedTowerType: null, // null = no tower selected (placement mode off)
  camera: { x: 0, y: 0 },

  // Ghost / placement cursor state
  ghostMouse: { x: 0, y: 0 }, // canvas-space mouse coords
  lastClientMouse: { x: 0, y: 0 }, // client-space (for UI positioning)
  hoveredTower: null, // Tower currently under mouse cursor
  hoveredEnemy: null, // Enemy currently under mouse cursor

  enemies: [],
  enemiesSet: new Set(),
  activeAccelerators: [],
  towers: [],
  projectiles: [], // Populated by PoolManager.init() in game.ts after initPixi()
  particles: [], // Populated by PoolManager.init() in game.ts after initPixi()
  floatingTexts: [], // Populated by PoolManager.init() in game.ts after initPixi()
  stunEffects: [], // Populated by PoolManager.init() in game.ts after initPixi()
  groundEffects: [], // Populated by PoolManager.init() in game.ts after initPixi()

  enemiesToSpawn: 0,
  spawnCooldown: 0,
  screenDamageEffect: 0,
  screenShake: 0,
  shopHoveredType: null,
  animTime: 0,
  perfMode: false,
  showFps: localStorage.getItem("td_show_fps") === "true",
  contextShopCell: null,
  contextShopPos: null,
  targetCamera: null,
  mapNeedsRedraw: true,
  lastCollectorWave: 0,
  unlockedAchievements: [],
  isGuest: true,
};

// Register game state reference in utils to break circular import dependency
setGameStateRef(state);
