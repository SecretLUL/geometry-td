/*
 * @file: frontend/src/js/core/game.ts
 * @purpose: High-level bootstrapping entry point. Parses URL parameters, loads the map,
 *           binds global events, tracks asset loading progress, and initializes all
 *           subsystems (UI, multiplayer, viewport, wave controller, achievements).
 * @dependencies: state, config, map, ui, background, loader, logger, viewport, wave, loop
 * @last_update: 2026-06-04 / v2.1.0 - Modularized and refactored game.ts; initialized achievements logic in bootstrap.
 */
import { state } from './state';
import { Multiplayer } from './multiplayer/index';
import { loadMap } from './map';
import { updateUI, setupUI } from '../ui/ui';
import { BackgroundController } from '../ui/background';
import { AssetLoader } from './loader';
import { PoolManager } from './pool';

import { app, resizeCanvas, centerCameraOnCell, setupViewportEvents, initPixi } from './game/viewport';
import { startWave, executeStartWave } from './game/wave';
import { triggerAssetsLoaded, triggerSyncCompleted } from './game/loop';
import { initAchievements } from './achievements';

// ─── Global Error Handling ───────────────────────────────────────────────────
window.addEventListener('error', (event) => {
    console.error('[GLOBAL ERROR]', event.message, event.filename, event.lineno, event.error);
    // Optional: trigger a fatal error UI screen here
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[UNHANDLED PROMISE REJECTION]', event.reason);
});

// ─── Bootstrap ───────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const mapName = urlParams.get('map');
const isHeadlessMode = urlParams.get('headless') === 'true';

if (!mapName) {
    window.location.href = 'index.html';
    throw new Error("Map parameter missing, redirecting to menu...");
}

// Initial map load from URL
loadMap(mapName);

// ─── Viewport scaling (first pass, before PixiJS) ────────────────────────────
// Required so that initPixi() receives the correct canvas dimensions.
resizeCanvas();

// ─── Initialize PixiJS ────────────────────────────────────────────────────────
await initPixi();

// ─── Initialize Object Pools (AFTER PixiJS!) ─────────────────────────────────
// CRITICAL: Pool objects (Particle, Projectile, etc.) create PIXI.Sprite /
// PIXI.Graphics in their constructors. This MUST run after app.renderer is ready,
// otherwise all GPU sprites are missing and entities will be invisible.
PoolManager.init();

// Link state arrays to the now-populated pool arrays
state.projectiles   = PoolManager.projectiles.getArray();
state.particles     = PoolManager.particles.getArray();
state.floatingTexts = PoolManager.floatingTexts.getArray();
state.stunEffects   = PoolManager.stunEffectsList;
state.groundEffects = PoolManager.groundEffectsList;

// ─── Viewport scaling (second pass, PixiJS can now resize correctly) ─────────
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ─── Camera Dragging Events ──────────────────────────────────────────────────
setupViewportEvents();

// ─── Center Camera On Cell Callback ──────────────────────────────────────────
state.centerCameraOnCell = centerCameraOnCell;

// ─── Setup UI and Multiplayer ────────────────────────────────────────────────
setupUI(startWave, app.canvas);
Multiplayer.init(executeStartWave, updateUI);
updateUI();
(window as any).state = state;


if (!isHeadlessMode) {
    new BackgroundController('bgCanvas');
    initAchievements();
}

// ─── Asset Loading & Start ───────────────────────────────────────────────────
const loader = new AssetLoader();
const progressBar = document.getElementById('progressBar');
const loaderStatus = document.getElementById('loader-status');

loader.onProgress = (pct, message) => {
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (loaderStatus) loaderStatus.innerText = message || `Lade Assets: ${pct}%`;
};

loader.onComplete = () => {
    triggerAssetsLoaded();
};

(window as any).onSyncComplete = () => {
    triggerSyncCompleted();
};

loader.loadAll();