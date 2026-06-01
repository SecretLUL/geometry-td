/*
 * @file: frontend\src\js\core\state.ts
 * @purpose: Holds the reactive in-memory GameState instance for local tracking of lives, gold, cameras, and arrays of active entities.
 * @dependencies: types, pool, config
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Ã„nderung der FunktionalitÃ¤t MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
 * @last_update: 2026-05-29 / v1.4.3 - Initialized originalWave to null in state.
 */
import { GameState } from '../types';
import { Config } from './config';
import { setGameStateRef } from './utils';

// NOTE: PoolManager.init() is now called in game.ts AFTER initPixi(), to avoid
// a Race Condition where pool constructors (Particle, Projectile, etc.) run before
// the PixiJS renderer (app.renderer) is ready, leaving them without GPU sprites.

export const state: GameState = {
    isHost: false,
    lives: Config.STARTING_LIVES,
    gold: Config.STARTING_GOLD,
    wave: 1,
    totalGoldEarned: 0,
    totalGoldFromInterest: 0,
    recordWave: localStorage.getItem('td_record_wave') || 0,
    isWaveActive: false,
    gameOver: false,
    isPaused: false,
    wasPaused: false,
    gameSpeed: Config.GAME_SPEEDS.NORMAL,
    webRTCStatus: 'idle',
    autoStartActive: false,
    godMode: false,
    infiniteGold: false,
    waveModified: false,
    originalWave: null,
    benchmarkActive: false,
    benchmarkBackup: null,
    selectedTowerType: null,   // null = no tower selected (placement mode off)
    camera: { x: 0, y: 0 },
    
    // Ghost / placement cursor state
    ghostMouse: { x: 0, y: 0 },  // canvas-space mouse coords
    lastClientMouse: { x: 0, y: 0 }, // client-space (for UI positioning)
    hoveredTower: null,         // Tower currently under mouse cursor
    hoveredEnemy: null,         // Enemy currently under mouse cursor

    enemies: [],
    towers: [],
    projectiles: [] as any[],   // Populated by PoolManager.init() in game.ts after initPixi()
    particles: [] as any[],     // Populated by PoolManager.init() in game.ts after initPixi()
    floatingTexts: [] as any[], // Populated by PoolManager.init() in game.ts after initPixi()
    stunEffects: [] as any[],   // Populated by PoolManager.init() in game.ts after initPixi()
    groundEffects: [] as any[], // Populated by PoolManager.init() in game.ts after initPixi()
    
    enemiesToSpawn: 0,
    spawnCooldown: 0,
    screenDamageEffect: 0,
    screenShake: 0,
    shopHoveredType: null,
    animTime: 0,
    perfMode: false,
    showFps: localStorage.getItem('td_show_fps') === 'true',
    contextShopCell: null,
    contextShopPos: null,
    targetCamera: null,
    mapNeedsRedraw: true,
    lastCollectorWave: 0
};

// Register game state reference in utils to break circular import dependency
setGameStateRef(state);
