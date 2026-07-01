/*
 * @file: frontend/src/js/core/game/loop.ts
 * @purpose: Coordinates game loop execution ticks, CPU throttling via Web Worker, client-side
 *           entity interpolation, client prediction safety timeouts, and boss health bar updates.
 * @dependencies: state, multiplayer, ui, logger, achievements, renderer, helpers, bossBar, clientInterpolation, simulation
 * @last_update: 2026-07-01 / Refactored - Modularized interpolation, simulation tick, and boss UI bar.
 */
import { state } from "../state";
import { updateTooltip } from "../../ui/ui";
import { logger } from "../logger";
import { drawScene } from "./renderer";
import { checkAchievements } from "../achievements";
import { initBossBarDOM, updateBossBar } from "./bossBar";
import { interpolateClientEnemies } from "./clientInterpolation";
import { runSimulationTick } from "./simulation";
import { prePopulateEnemyGrid } from "./helpers";

const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";

// FPS tracking state
export let lastFpsUpdate = performance.now();
export let fpsDisplayVal = 60;
export let framesSinceLastFps = 0;

// Game loop timing state
export let lastFrameTime = performance.now();
export let lastAnimFrameTime = performance.now();
let nextFrameTime = performance.now();
export let frameCount = 0;
let speedAccumulator = 0;

// Cached DOM element references — initialized once in tryStartGame()
let cachedRefreshRateSelect: HTMLSelectElement | null = null;
let cachedFpsDisplayEl: HTMLElement | null = null;

export function gameLoop(timestamp: number, fromWorker = false): void {
  if (!fromWorker) {
    requestAnimationFrame((ts) => gameLoop(ts, false));
  }

  // Determine current focus state
  const isFocused = document.hasFocus() && !document.hidden;

  // Prevent double tick or conflict:
  // 1. Worker ticks should ONLY execute when the window is unfocused or hidden.
  // 2. requestAnimationFrame ticks should ONLY execute when the window is active and focused.
  if (fromWorker && isFocused && !isHeadlessMode) return;
  if (!fromWorker && !isFocused && !isHeadlessMode) return;

  if (!timestamp) timestamp = performance.now();

  const refreshRateVal = cachedRefreshRateSelect
    ? cachedRefreshRateSelect.value
    : localStorage.getItem("td_refresh_rate") || "60";
  const isUncapped = refreshRateVal === "uncapped";
  let targetFPS = isUncapped ? 9999 : parseInt(refreshRateVal) || 60;

  // If the window is unfocused and Low Performance Mode is enabled, cap target FPS to 60 FPS
  // to save system resources. Otherwise, allow the high refresh rate (e.g. 144 FPS) to continue.
  if (!isFocused && state.perfMode && targetFPS > 60) {
    targetFPS = 60;
  }
  const frameInterval = isUncapped ? 0 : 1000 / targetFPS;

  // Frame pacing check using nextFrameTime to prevent VSync beating and high refresh rate capping issues
  if (!isUncapped) {
    if (timestamp - nextFrameTime > 100) {
      nextFrameTime = timestamp;
    }
    // Tolerance of 1.0 ms to absorb VSync jitter
    if (timestamp < nextFrameTime - 1.0) return;
  }

  // FPS Tracking
  framesSinceLastFps++;
  const now = performance.now();
  if (now - lastFpsUpdate > 1000) {
    framesSinceLastFps = 0;
    lastFpsUpdate = now;
  } else if (now - lastFpsUpdate >= 500) {
    fpsDisplayVal = Math.round((framesSinceLastFps * 1000) / (now - lastFpsUpdate));
    framesSinceLastFps = 0;
    lastFpsUpdate = now;
  }

  // Update nextFrameTime for target FPS pacing
  if (!isUncapped) {
    nextFrameTime = Math.max(nextFrameTime + frameInterval, timestamp);
  }

  let elapsed = timestamp - lastFrameTime;
  if (elapsed > 100) elapsed = 100; // Cap to prevent spiral of death

  let consumedTime = elapsed;
  lastFrameTime = timestamp;

  // Keep high-brightness HTML DOM FPS overlay hidden (drawn on canvas instead)
  cachedFpsDisplayEl?.classList.add("hidden");

  // Track real elapsed time for visual animations (decoupled from VSync jitter mitigation)
  let animElapsed = timestamp - lastAnimFrameTime;
  if (animElapsed > 100) animElapsed = 100;
  lastAnimFrameTime = timestamp;

  if (!state.gameOver) {
    state.animTime = (state.animTime || 0) + animElapsed;
  }

  if (!state.gameOver) {
    if (!state.isPaused) {
      frameCount++;

      // Run client-side enemy interpolation exactly once per frame
      interpolateClientEnemies();

      // Decouple game speed from frame rate using a fixed timestep accumulator
      const baseTickInterval = 1000 / 60;
      speedAccumulator += state.gameSpeed * (consumedTime / baseTickInterval);

      while (speedAccumulator >= 1) {
        speedAccumulator -= 1;
        runSimulationTick();
      }

      // Boss HP and Shield bar rendering updates
      updateBossBar();

      if (frameCount % 30 === 0 && !isHeadlessMode) {
        checkAchievements();
      }

      drawScene(fpsDisplayVal);
    } else {
      // Paused updates (keep passive visual animations updating)
      for (let i = 0; i < state.floatingTexts.length; i++) {
        state.floatingTexts[i].update();
      }
      drawScene(fpsDisplayVal, true);
    }
    updateTooltip();
  }
}

let assetsLoaded = false;
let syncCompleted = false;

export function triggerAssetsLoaded(): void {
  assetsLoaded = true;
  if (!syncCompleted) {
    const loaderStatus = document.getElementById("loader-status");
    if (loaderStatus) loaderStatus.innerText = "Waiting for server synchronization...";
  }
  tryStartGame();
}

export function triggerSyncCompleted(): void {
  syncCompleted = true;
  tryStartGame();
}

export { prePopulateEnemyGrid } from "./helpers";

export function tryStartGame(): void {
  if (assetsLoaded && syncCompleted) {
    logger.info("Assets loaded and sync complete, starting game loop.");

    // Pre-populate spatial hashing grid arrays to completely eliminate GC overhead in game loop
    prePopulateEnemyGrid();

    // Initialize cached DOM element references once — avoids per-frame getElementById() calls
    cachedRefreshRateSelect = (document.getElementById("igRefreshRateSelect") ||
      document.getElementById("refreshRateSelect")) as HTMLSelectElement | null;
    cachedFpsDisplayEl = document.getElementById("fps-display");

    // Initialize boss HP bar DOM caching
    initBossBarDOM();

    const loaderStatus = document.getElementById("loader-status");
    if (loaderStatus) loaderStatus.innerText = "Synchronization complete!";

    // Tab-Throttling Hack: Use Web Worker to keep JS thread and Socket.IO alive when tab is hidden
    if (window.Worker) {
      const worker = new Worker("/worker.js");
      worker.onmessage = (e) => {
        if (e.data === "tick") {
          const isFocused = document.hasFocus() && !document.hidden;
          if (!isFocused) {
            gameLoop(performance.now(), true);
          }
        }
      };
      worker.postMessage("start");

      // Send target FPS updates to worker
      const refreshRateSelect = document.getElementById(
        "refreshRateSelect"
      ) as HTMLSelectElement | null;
      const igRefreshRateSelect = document.getElementById(
        "igRefreshRateSelect"
      ) as HTMLSelectElement | null;
      const perfModeToggle = document.getElementById("perfModeToggle") as HTMLInputElement | null;
      const igPerfModeToggle = document.getElementById(
        "igPerfModeToggle"
      ) as HTMLInputElement | null;
      const updateWorkerFps = () => {
        const selectEl = igRefreshRateSelect || refreshRateSelect;
        const val = selectEl ? selectEl.value : localStorage.getItem("td_refresh_rate") || "60";
        let fps = val === "uncapped" ? 60 : parseInt(val) || 60;

        // If the window is unfocused and Low Performance Mode is enabled, cap worker ticks
        // to a maximum of 60 FPS to save system resources.
        const isFocused = document.hasFocus() && !document.hidden;
        if (!isFocused && state.perfMode && fps > 60) {
          fps = 60;
        }

        worker.postMessage({ type: "setFPS", fps });
      };
      if (refreshRateSelect) refreshRateSelect.addEventListener("change", updateWorkerFps);
      if (igRefreshRateSelect) igRefreshRateSelect.addEventListener("change", updateWorkerFps);
      if (perfModeToggle) perfModeToggle.addEventListener("change", updateWorkerFps);
      if (igPerfModeToggle) igPerfModeToggle.addEventListener("change", updateWorkerFps);
      window.addEventListener("focus", updateWorkerFps);
      window.addEventListener("blur", updateWorkerFps);
      document.addEventListener("visibilitychange", updateWorkerFps);
      // Initial call to align worker FPS with select choice
      updateWorkerFps();
    }

    const loadingScreen = document.getElementById("loading-screen");
    setTimeout(() => {
      if (loadingScreen) loadingScreen.classList.add("fade-out");
      lastFrameTime = performance.now();
      lastAnimFrameTime = performance.now();
      gameLoop(performance.now(), false);
    }, 800);
  }
}
