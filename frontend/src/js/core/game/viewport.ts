/*
 * @file: frontend/src/js/core/game/viewport.ts
 * @purpose: Manages canvas sizing, aspect ratio constraints, smooth camera translation and
 *           clamping, and pointer-drag camera panning.
 * @dependencies: state, config, map, modals
 * @last_update: 2026-05-30 / v1.3.0 - Added staticPathGraphics export and added it to pathAnimContainer.
 */
import { state } from "../state";
import { Config } from "../config";
import { rescaleWaypoints } from "../map";
import { hideContextShop } from "../../ui/modals";

import * as PIXI from "pixi.js";

export const app = new PIXI.Application();
export const mapContainer = new PIXI.Container({ isRenderGroup: true });
export const pathAnimContainer = new PIXI.Container({ isRenderGroup: true });
export const staticPathGraphics = new PIXI.Graphics();
export const pathAnimGraphics = new PIXI.Graphics();
export const entitiesContainer = new PIXI.Container({ isRenderGroup: true });
export const uiContainer = new PIXI.Container({ isRenderGroup: true });
export const inactivePoolContainer = new PIXI.Container(); // NEVER added to stage!

export async function initPixi() {
  const pixiContainer = document.getElementById("pixi-container");
  if (!pixiContainer) return;

  // Calculate the correct canvas size before initializing PixiJS
  // to ensure it never starts with a 0x0 WebGL context (prevents context loss).
  const dpr = window.devicePixelRatio || 1;
  const uiPanelWidth =
    parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ui-panel-width")) ||
    240;
  const isMobile = window.innerWidth <= 950;
  const isLandscape = window.innerWidth > window.innerHeight;
  const isColumnMode = window.innerWidth <= 800 && !isLandscape;
  let availW = window.innerWidth;
  let availH = window.innerHeight;
  if (!isColumnMode && (!isMobile || !isLandscape)) availW -= uiPanelWidth;
  else if (isColumnMode) availH *= 0.65;
  const initW = Math.max(300, availW);
  const initH = Math.max(300, availH);

  await app.init({
    backgroundAlpha: 0,
    resolution: dpr,
    autoDensity: true,
    width: initW,
    height: initH,
    preference: "webgl",
    powerPreference: "high-performance",
    antialias: true,
  });
  pixiContainer.appendChild(app.canvas);

  // WebGL Context Restoration: rebuild the stage when the browser restores
  // a lost WebGL context (e.g. after GPU memory pressure or background throttling).
  app.canvas.addEventListener(
    "webglcontextlost",
    (e: Event) => {
      e.preventDefault();
      console.warn("[PixiJS] WebGL context lost. Waiting for restoration...");
    },
    false
  );
  app.canvas.addEventListener(
    "webglcontextrestored",
    () => {
      console.info("[PixiJS] WebGL context restored.");
      state.mapNeedsRedraw = true;
    },
    false
  );

  app.stage.addChild(mapContainer);
  app.stage.addChild(pathAnimContainer);
  pathAnimContainer.addChild(staticPathGraphics);
  pathAnimContainer.addChild(pathAnimGraphics);
  app.stage.addChild(entitiesContainer);
  app.stage.addChild(uiContainer);
}

export let isDragging = false;
export let lastPointerPos = { x: 0, y: 0 };

/**
 * Resize the canvas so the grid fills as much of the available viewport as
 * possible while keeping the aspect ratio 1:1 (square grid).
 * The UI panel sits beside the canvas in a flex container, so we leave room
 * for it (≈220 px) and some vertical padding.
 *
 * High-DPI (Retina) support: The canvas backing store is scaled by
 * window.devicePixelRatio so all vector geometry is drawn at physical pixel
 * resolution for maximum crispness. All game-logic coordinates (TILE_SIZE,
 * camera, waypoints, entities) remain in CSS pixel units — only the backing
 * store and the ctx transform are multiplied by dpr.
 */
export function resizeCanvas(): void {
  const COLS = Config.CANVAS_COLS;
  const ROWS = Config.CANVAS_ROWS;

  if (!state.camera) state.camera = { x: 0, y: 0 };

  // Get current UI panel width from CSS
  const uiPanelWidth =
    parseInt(getComputedStyle(document.documentElement).getPropertyValue("--ui-panel-width")) ||
    240;

  // Check if we are in column mode (mobile) or row mode (desktop)
  const isMobile = window.innerWidth <= 950;
  const isLandscape = window.innerWidth > window.innerHeight;
  const isColumnMode = window.innerWidth <= 800 && !isLandscape;

  // Available space (in CSS pixels)
  let availW = window.innerWidth;
  let availH = window.innerHeight;

  if (!isColumnMode && (!isMobile || !isLandscape)) {
    availW -= uiPanelWidth;
  } else if (isColumnMode) {
    // In column mode, the UI is below the canvas, so we subtract its estimated height or just use a ratio
    availH *= 0.65; // Reserve 35% of height for UI in mobile
  }

  const canvasAvailW = Math.max(300, availW);
  const canvasAvailH = Math.max(300, availH);

  // Pick the size that fits both dimensions while keeping square cells
  const tileFromW = Math.floor(canvasAvailW / COLS);
  const tileFromH = Math.floor(canvasAvailH / ROWS);

  let newTile = Math.max(15, Math.min(tileFromW, tileFromH));

  // Mobile Landscape Refactor: Enforce 48px minimum so map overflows viewport
  if (isMobile && isLandscape) {
    newTile = Math.max(newTile, 48);
  }

  Config.TILE_SIZE = newTile;

  if (app.renderer) {
    app.renderer.resize(canvasAvailW, canvasAvailH);
  }

  state.mapNeedsRedraw = true;

  // HUD Positioning: Calculate the empty space on the sides
  const totalEmptyW = Math.max(0, availW - newTile * COLS);
  const sidebarWidth = isColumnMode ? 20 : Math.floor(totalEmptyW / 2);

  // Set CSS variable for use in styles
  document.documentElement.style.setProperty("--sidebar-width", `${sidebarWidth}px`);

  const hud = document.getElementById("game-hud");
  if (hud) {
    hud.style.paddingLeft = isColumnMode ? "10px" : "20px";
    hud.style.paddingRight = isColumnMode ? "10px" : "20px";
  }

  // Clamp camera after resize
  clampCamera();

  // Re-scale tower positions
  for (let t of state.towers) t.rescale();

  // Re-scale waypoints
  rescaleWaypoints();

  // Re-scale enemies and projectiles
  const oldTile = (Config as any)._oldTile;
  if (oldTile && oldTile !== newTile) {
    const scale = newTile / oldTile;
    for (let enemy of state.enemies) {
      enemy.x *= scale;
      enemy.y *= scale;
      enemy.distanceTravelled *= scale;
      enemy.speed *= scale;
    }
    for (let p of state.projectiles) {
      p.x *= scale;
      p.y *= scale;
      p.speed *= scale;
      for (let i = 0; i < p.trailCount; i++) {
        p.trailX[i] *= scale;
        p.trailY[i] *= scale;
      }
    }
    for (let pt of state.particles) {
      if (pt.active) {
        pt.x *= scale;
        pt.y *= scale;
        pt.vx *= scale;
        pt.vy *= scale;
      }
    }
  }
  (Config as any)._oldTile = newTile;
}

export function clampCamera(): void {
  if (!app.renderer) return;
  if (!state.camera) state.camera = { x: 0, y: 0 };
  const mapW = Config.TILE_SIZE * Config.CANVAS_COLS;
  const mapH = Config.TILE_SIZE * Config.CANVAS_ROWS;
  const TS = Config.TILE_SIZE;

  // Use CSS layout dimensions for camera boundary
  // math, since all game coordinates are in CSS pixel space.
  const viewW = app.canvas.clientWidth;
  const viewH = app.canvas.clientHeight;

  // Soft clamp: If map fits in viewport, center it. Otherwise, allow any cell (including edges) to center perfectly.
  if (viewW > mapW) {
    state.camera.x = (viewW - mapW) / 2;
  } else {
    const maxX = viewW / 2 - TS / 2;
    const minX = viewW / 2 - (mapW - TS / 2);
    state.camera.x = Math.max(minX, Math.min(maxX, state.camera.x));
  }

  if (viewH > mapH) {
    state.camera.y = (viewH - mapH) / 2;
  } else {
    const maxY = viewH / 2 - TS / 2;
    const minY = viewH / 2 - (mapH - TS / 2);
    state.camera.y = Math.max(minY, Math.min(maxY, state.camera.y));
  }
}

export function centerCameraOnCell(col: number, row: number): void {
  if (!app.renderer) return;
  if (!state.camera) state.camera = { x: 0, y: 0 };
  const TS = Config.TILE_SIZE;
  const cellCenterX = col * TS + TS / 2;
  const cellCenterY = row * TS + TS / 2;

  const viewW = app.canvas.clientWidth;
  const viewH = app.canvas.clientHeight;

  const targetX = viewW / 2 - cellCenterX;
  const targetY = viewH / 2 - cellCenterY;

  const mapW = Config.TILE_SIZE * Config.CANVAS_COLS;
  const mapH = Config.TILE_SIZE * Config.CANVAS_ROWS;

  let targetClampedX = targetX;
  let targetClampedY = targetY;

  if (viewW > mapW) {
    targetClampedX = (viewW - mapW) / 2;
  } else {
    const maxX = viewW / 2 - TS / 2;
    const minX = viewW / 2 - (mapW - TS / 2);
    targetClampedX = Math.max(minX, Math.min(maxX, targetX));
  }

  if (viewH > mapH) {
    targetClampedY = (viewH - mapH) / 2;
  } else {
    const maxY = viewH / 2 - TS / 2;
    const minY = viewH / 2 - (mapH - TS / 2);
    targetClampedY = Math.max(minY, Math.min(maxY, targetY));
  }

  state.targetCamera = { x: targetClampedX, y: targetClampedY };
}

// Set up camera panning events immediately
export function setupViewportEvents(): void {
  const target = app.canvas;
  target.addEventListener("pointerdown", (e: PointerEvent) => {
    if (e.button !== 0) return;
    isDragging = true;
    state.targetCamera = null; // Abort smooth centering if user starts dragging manually
    lastPointerPos = { x: e.clientX, y: e.clientY };
    target.setPointerCapture(e.pointerId);
  });

  target.addEventListener("pointermove", (e: PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPointerPos.x;
    const dy = e.clientY - lastPointerPos.y;

    // Dismiss context shop on actual drag movement
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
      const contextShop = document.getElementById("context-shop");
      if (contextShop && !contextShop.classList.contains("hidden")) {
        hideContextShop();
      }
    }

    state.camera.x += dx;
    state.camera.y += dy;
    lastPointerPos = { x: e.clientX, y: e.clientY };
    clampCamera();
  });

  target.addEventListener("pointerup", (e: PointerEvent) => {
    isDragging = false;
    target.releasePointerCapture(e.pointerId);
  });
}
