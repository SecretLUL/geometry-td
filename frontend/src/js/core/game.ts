/*
 * @file: frontend\src\js\core\game.ts
 * @purpose: High-level bootstrapping entry point. Parses parameters, loads map configurations, binds global events, coordinates loader state progress, and initializes secondary controller systems.
 * @dependencies: state, config, map, ui, background, loader, logger, viewport, wave, loop
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
    // Optional: Hier könnte man einen Fatal-UI-Screen triggern
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

// ─── Viewport scaling (first pass, vor PixiJS) ────────────────────────────
// Notwendig, damit initPixi() korrekte Canvas-Dimensionen erhält.
resizeCanvas();

// ─── Initialize PixiJS ────────────────────────────────────────────────────────
await initPixi();

// ─── Initialize Object Pools (NACH PixiJS!) ─────────────────────────────────
// KRITISCH: Pool-Objekte (Particle, Projectile, etc.) erstellen PIXI.Sprite /
// PIXI.Graphics in ihren Konstruktoren. Das MUSS nach app.renderer laufen,
// sonst fehlen alle GPU-Sprites und Entities sind unsichtbar.
PoolManager.init();

// Verknüpfe State-Arrays mit den jetzt befüllten Pool-Arrays
state.projectiles   = PoolManager.projectiles.getArray();
state.particles     = PoolManager.particles.getArray();
state.floatingTexts = PoolManager.floatingTexts.getArray();
state.stunEffects   = PoolManager.stunEffectsList;
state.groundEffects = PoolManager.groundEffectsList;

// ─── Viewport scaling (zweiter Pass, PixiJS kann jetzt korrekt resizen) ─────
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