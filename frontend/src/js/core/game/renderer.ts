/*
 * @file: frontend/src/js/core/game/renderer.ts
 * @purpose: Handles coordinate translations, screen shake, and high-level scene orchestration.
 * @dependencies: state, config, map, modals, viewport, scenery-renderer, overlay-renderer, interaction-renderer
 */
import { state } from "../state";
import { Config } from "../config";
import { drawMap } from "../map";
import { updateContextShopPosition } from "../../ui/modals";
import {
  clampCamera,
  mapContainer,
  pathAnimContainer,
  pathAnimGraphics,
  entitiesContainer,
  uiContainer,
} from "./viewport";

import {
  redrawStaticPaths,
  initSpawnerGraphics,
  drawScenery,
} from "./scenery-renderer";
import { drawOverlay } from "./overlay-renderer";
import { drawInteractions } from "./interaction-renderer";

// Re-exports for backward compatibility
export { getPointAlongPath, redrawStaticPaths, initSpawnerGraphics } from "./scenery-renderer";
export { drawMultiplayerDivisionLines } from "./interaction-renderer";

const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";
let lastTileSize = -1;

export function drawScene(fpsDisplayVal: number, isPaused: boolean = false): void {
  if (isHeadlessMode) return;

  // 1. Smooth camera panning
  if (state.targetCamera) {
    const speed = 0.12;
    state.camera.x += (state.targetCamera.x - state.camera.x) * speed;
    state.camera.y += (state.targetCamera.y - state.camera.y) * speed;

    // Snap to destination and clear target once close enough
    if (
      Math.abs(state.camera.x - state.targetCamera.x) < 0.2 &&
      Math.abs(state.camera.y - state.targetCamera.y) < 0.2
    ) {
      state.camera.x = state.targetCamera.x;
      state.camera.y = state.targetCamera.y;
      state.targetCamera = null;
    }
    clampCamera();
  }

  // 2. Smooth selection square and menu coordinates LERP
  if (state.contextShopCell && state.contextShopPos) {
    const TS = Config.TILE_SIZE;
    const targetX = state.contextShopCell.col * TS;
    const targetY = state.contextShopCell.row * TS;
    const speed = 0.12;
    state.contextShopPos.x += (targetX - state.contextShopPos.x) * speed;
    state.contextShopPos.y += (targetY - state.contextShopPos.y) * speed;

    if (
      Math.abs(state.contextShopPos.x - targetX) < 0.2 &&
      Math.abs(state.contextShopPos.y - targetY) < 0.2
    ) {
      state.contextShopPos.x = targetX;
      state.contextShopPos.y = targetY;
    }
  }

  if (state.contextShopCell) {
    updateContextShopPosition();
  }

  // 3. Shake logic on camera
  let camX = Math.round(state.camera.x);
  let camY = Math.round(state.camera.y);

  if (state.screenShake > 0) {
    const dx = (Math.random() - 0.5) * state.screenShake;
    const dy = (Math.random() - 0.5) * state.screenShake;
    camX += dx;
    camY += dy;
  }

  const TS = Config.TILE_SIZE;

  // 4. Map redraw check
  if (state.mapNeedsRedraw || TS !== lastTileSize) {
    state.mapNeedsRedraw = false;
    lastTileSize = TS;
    drawMap(mapContainer);
    redrawStaticPaths();
    initSpawnerGraphics(TS);
  }

  // 5. PixiJS Stage Panning
  mapContainer.position.set(camX, camY);
  pathAnimContainer.position.set(camX, camY);
  entitiesContainer.position.set(camX, camY);
  uiContainer.position.set(camX, camY);

  pathAnimGraphics.clear();

  // 6. Draw path scenery / active energy photon streams
  drawScenery();

  // 7. Draw selections, overlays, and ranges
  drawInteractions();

  // 8. Draw active screen vignettes / overlays (FPS, Pause overlay)
  drawOverlay(fpsDisplayVal, isPaused);
}
