/*
 * @file: frontend/src/js/core/game/renderer.ts
 * @purpose: Handles coordinate translations, screen shake, rendering passive/active canvas layers,
 *           range circles, ghost towers, screen damage vignettes, and the canvas FPS overlay.
 * @dependencies: state, config, towers, map, modals, viewport
 * @last_update: 2026-06-01 / v2.2.0 - Fully overhauled spawners and base with counter-rotating geometric portals (triangles for spawners, diamonds for base) and breathing fluid cores.
 */
import { state } from "../state";
import { Config } from "../config";
import { drawRangeCircle, drawGhostTower } from "../../entities/towers/index";
import { drawMap, waypoints } from "../map";
import { updateContextShopPosition } from "../../ui/modals";
import {
  clampCamera,
  mapContainer,
  pathAnimContainer,
  staticPathGraphics,
  pathAnimGraphics,
  entitiesContainer,
  uiContainer,
  app,
} from "./viewport";
import * as PIXI from "pixi.js";

let cachedWaypoints: { x: number; y: number }[] | null = null;
let cachedLengths: number[] = [];
let cachedTotalLength = 0;

export function getPointAlongPath(
  waypoints: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  if (waypoints.length === 0) return { x: 0, y: 0 };
  if (waypoints.length === 1) return { x: waypoints[0].x, y: waypoints[0].y };

  if (cachedWaypoints !== waypoints || waypoints.length !== cachedLengths.length + 1) {
    cachedWaypoints = waypoints;
    cachedLengths = [];
    cachedTotalLength = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      const dx = waypoints[i + 1].x - waypoints[i].x;
      const dy = waypoints[i + 1].y - waypoints[i].y;
      const len = Math.sqrt(dx * dx + dy * dy);
      cachedLengths.push(len);
      cachedTotalLength += len;
    }
  }

  t = ((t % 1) + 1) % 1; // Wrap t between 0 and 1
  const targetDist = t * cachedTotalLength;

  let accum = 0;
  for (let i = 0; i < cachedLengths.length; i++) {
    const len = cachedLengths[i];
    if (accum + len >= targetDist) {
      const segmentT = (targetDist - accum) / len;
      const p0 = waypoints[i];
      const p1 = waypoints[i + 1];
      return {
        x: p0.x + (p1.x - p0.x) * segmentT,
        y: p0.y + (p1.y - p0.y) * segmentT,
      };
    }
    accum += len;
  }
  return { x: waypoints[waypoints.length - 1].x, y: waypoints[waypoints.length - 1].y };
}

const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";

let lastTileSize = -1;

let uiGraphics: PIXI.Graphics | null = null;
let screenDamageGraphics: PIXI.Graphics | null = null;
let fpsText: PIXI.Text | null = null;

let pauseGraphics: PIXI.Graphics | null = null;
let pauseText: PIXI.Text | null = null;

// --- Performance Cache & Optimization variables ---
let photonTexture: PIXI.Texture | null = null;
const photonSprites: PIXI.Sprite[] = [];

function getPhotonTexture(): PIXI.Texture {
  if (!photonTexture && typeof window !== "undefined" && app && app.renderer) {
    const g = new PIXI.Graphics();
    g.circle(0, 0, 6).fill({ color: 0x00f2fe, alpha: 0.15 });
    g.circle(0, 0, 3).fill({ color: 0x00f2fe, alpha: 0.75 });
    g.circle(0, 0, 1.5).fill({ color: 0xffffff, alpha: 1.0 });
    photonTexture = app.renderer.generateTexture(g);
    g.destroy();
  }
  return photonTexture || PIXI.Texture.WHITE;
}

function initPhotonSprites(): void {
  if (photonSprites.length > 0) return;
  const tex = getPhotonTexture();
  const numPhotons = 20;
  for (let i = 0; i < numPhotons; i++) {
    const sprite = new PIXI.Sprite(tex);
    sprite.anchor.set(0.5);
    sprite.visible = false;
    pathAnimContainer.addChild(sprite);
    photonSprites.push(sprite);
  }
}

function redrawStaticPaths(): void {
  if (!staticPathGraphics) return;
  staticPathGraphics.clear();

  if (waypoints.length > 1) {
    staticPathGraphics.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      staticPathGraphics.lineTo(waypoints[i].x, waypoints[i].y);
    }
    staticPathGraphics.stroke({
      color: 0x00f2fe,
      alpha: 0.08,
      width: 14,
      cap: "round",
      join: "round",
    });

    staticPathGraphics.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) {
      staticPathGraphics.lineTo(waypoints[i].x, waypoints[i].y);
    }
    staticPathGraphics.stroke({
      color: 0x00f2fe,
      alpha: 0.25,
      width: 5,
      cap: "round",
      join: "round",
    });
  }
}

let startSpawnerContainer: PIXI.Container | null = null;
let startSpawnerGlow: PIXI.Graphics | null = null;
let startOuterTriangle: PIXI.Graphics | null = null;
let startInnerTriangle: PIXI.Graphics | null = null;
let startPulseCore: PIXI.Graphics | null = null;
let startWhiteCore: PIXI.Graphics | null = null;

let endSpawnerContainer: PIXI.Container | null = null;
let endSpawnerGlow: PIXI.Graphics | null = null;
let endOuterDiamond: PIXI.Graphics | null = null;
let endInnerDiamond: PIXI.Graphics | null = null;
let endPulseCore: PIXI.Graphics | null = null;
let endWhiteCore: PIXI.Graphics | null = null;

function initSpawnerGraphics(TS: number): void {
  if (!startSpawnerContainer) {
    startSpawnerContainer = new PIXI.Container();
    pathAnimContainer.addChild(startSpawnerContainer);

    startSpawnerGlow = new PIXI.Graphics();
    startOuterTriangle = new PIXI.Graphics();
    startInnerTriangle = new PIXI.Graphics();
    startPulseCore = new PIXI.Graphics();
    startWhiteCore = new PIXI.Graphics();

    startSpawnerContainer.addChild(startSpawnerGlow);
    startSpawnerContainer.addChild(startOuterTriangle);
    startSpawnerContainer.addChild(startInnerTriangle);
    startSpawnerContainer.addChild(startPulseCore);
    startSpawnerContainer.addChild(startWhiteCore);
  }

  if (!endSpawnerContainer) {
    endSpawnerContainer = new PIXI.Container();
    pathAnimContainer.addChild(endSpawnerContainer);

    endSpawnerGlow = new PIXI.Graphics();
    endOuterDiamond = new PIXI.Graphics();
    endInnerDiamond = new PIXI.Graphics();
    endPulseCore = new PIXI.Graphics();
    endWhiteCore = new PIXI.Graphics();

    endSpawnerContainer.addChild(endSpawnerGlow);
    endSpawnerContainer.addChild(endOuterDiamond);
    endSpawnerContainer.addChild(endInnerDiamond);
    endSpawnerContainer.addChild(endPulseCore);
    endSpawnerContainer.addChild(endWhiteCore);
  }

  startSpawnerGlow!.clear().circle(0, 0, TS).fill({ color: 0xff0055, alpha: 1.0 });

  startOuterTriangle!.clear();
  const a0 = 0;
  const a1 = 2.0944;
  const a2 = 4.1888;
  startOuterTriangle!
    .poly(
      [
        Math.cos(a0) * TS,
        Math.sin(a0) * TS,
        Math.cos(a1) * TS,
        Math.sin(a1) * TS,
        Math.cos(a2) * TS,
        Math.sin(a2) * TS,
      ],
      true
    )
    .stroke({ color: 0xff0055, alpha: 0.45, width: 1.5 / 0.44 });

  startInnerTriangle!.clear();
  startInnerTriangle!
    .poly(
      [
        Math.cos(a0) * TS,
        Math.sin(a0) * TS,
        Math.cos(a1) * TS,
        Math.sin(a1) * TS,
        Math.cos(a2) * TS,
        Math.sin(a2) * TS,
      ],
      true
    )
    .stroke({ color: 0xff0055, alpha: 0.75, width: 2 / 0.35 });

  startPulseCore!.clear().circle(0, 0, TS).fill({ color: 0xff0055, alpha: 1.0 });
  startWhiteCore!.clear().circle(0, 0, TS).fill({ color: 0xffffff, alpha: 1.0 });

  endSpawnerGlow!.clear().circle(0, 0, TS).fill({ color: 0x00d4ff, alpha: 1.0 });

  endOuterDiamond!.clear();
  endOuterDiamond!
    .poly([TS, 0, 0, TS, -TS, 0, 0, -TS], true)
    .stroke({ color: 0x00d4ff, alpha: 0.4, width: 1.5 / 0.48 });

  endInnerDiamond!.clear();
  endInnerDiamond!
    .poly([TS, 0, 0, TS, -TS, 0, 0, -TS], true)
    .stroke({ color: 0x00d4ff, alpha: 0.7, width: 2 / 0.38 });

  endPulseCore!
    .clear()
    .poly([0, -TS, TS, 0, 0, TS, -TS, 0], true)
    .fill({ color: 0x00d4ff, alpha: 1.0 });
  endWhiteCore!
    .clear()
    .poly([0, -TS, TS, 0, 0, TS, -TS, 0], true)
    .fill({ color: 0xffffff, alpha: 1.0 });
}

// redrawSpawnerGraphics has been removed as the rotating line around the base was removed

export function drawScene(fpsDisplayVal: number, isPaused: boolean = false): void {
  if (isHeadlessMode) return;

  if (!uiGraphics) {
    uiGraphics = new PIXI.Graphics();
    uiContainer.addChild(uiGraphics);
  }
  if (!screenDamageGraphics) {
    screenDamageGraphics = new PIXI.Graphics();
    app.stage.addChild(screenDamageGraphics); // at the very top of the stage
  }
  if (!fpsText) {
    fpsText = new PIXI.Text({
      text: "",
      style: {
        fontFamily: "Outfit, sans-serif",
        fontSize: 16,
        fontWeight: "bold",
        fill: 0x00ff88,
        dropShadow: {
          alpha: 0.25,
          blur: 0,
          color: 0x00ff88,
          distance: 1,
          angle: Math.PI / 4,
        },
      },
    });
    fpsText.anchor.set(1, 1);
    app.stage.addChild(fpsText);
  }
  if (!pauseGraphics) {
    pauseGraphics = new PIXI.Graphics();
    app.stage.addChild(pauseGraphics); // At very top
  }
  if (!pauseText) {
    pauseText = new PIXI.Text({
      text: "PAUSIERT",
      style: {
        fontFamily: "Arial",
        fontWeight: "bold",
        fill: "#ffffff",
        align: "center",
      },
    });
    pauseText.anchor.set(0.5, 0.5);
    app.stage.addChild(pauseText);
  }

  // Smooth camera panning
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

  // Smooth selection square and menu coordinates LERP
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

  // Shake logic on camera
  let camX = Math.round(state.camera.x);
  let camY = Math.round(state.camera.y);

  if (state.screenShake > 0) {
    const dx = (Math.random() - 0.5) * state.screenShake;
    const dy = (Math.random() - 0.5) * state.screenShake;
    camX += dx;
    camY += dy;
  }

  const TS = Config.TILE_SIZE;

  if (state.mapNeedsRedraw || TS !== lastTileSize) {
    state.mapNeedsRedraw = false;
    lastTileSize = TS;
    drawMap(mapContainer);
    redrawStaticPaths();
    initSpawnerGraphics(TS);
  }

  // PixiJS Panning
  mapContainer.position.set(camX, camY);
  pathAnimContainer.position.set(camX, camY);
  entitiesContainer.position.set(camX, camY);
  uiContainer.position.set(camX, camY);

  pathAnimGraphics.clear();
  uiGraphics.clear();
  screenDamageGraphics.clear();

  // 1. Draw active energy streams flowing along path waypoints (pooled sprites)
  if (waypoints.length > 1) {
    initPhotonSprites();
    const time = state.animTime * 0.002;
    const numPhotons = 20;

    for (let j = 0; j < numPhotons; j++) {
      const t = (time * 0.03 + j / numPhotons) % 1.0;
      const pos = getPointAlongPath(waypoints, t);

      const sprite = photonSprites[j];
      if (sprite) {
        sprite.position.set(pos.x, pos.y);
        sprite.visible = true;
      }
    }
  } else {
    for (const sprite of photonSprites) {
      sprite.visible = false;
    }
  }

  // 2. Draw Start & End Spawners
  if (waypoints.length > 0) {
    const time = state.animTime * 0.002;

    const start = waypoints[0];
    const spawnerPulse = Math.sin(time * 3.0);

    if (startSpawnerContainer) {
      startSpawnerContainer.position.set(start.x, start.y);
      startSpawnerContainer.visible = true;

      startSpawnerGlow!.scale.set(0.38 + 0.04 * spawnerPulse);
      startSpawnerGlow!.alpha = 0.08 + 0.03 * spawnerPulse;

      startOuterTriangle!.rotation = -time * 0.55;
      startOuterTriangle!.scale.set(0.44 + 0.015 * Math.sin(time * 3.5 + 1.0));

      startInnerTriangle!.rotation = time * 0.9;
      startInnerTriangle!.scale.set(0.35 + 0.01 * Math.sin(time * 5));

      startPulseCore!.scale.set(0.2 + 0.02 * spawnerPulse);
      startWhiteCore!.scale.set(0.09 + 0.02 * Math.sin(time * 3.0 + Math.PI));
    }

    const end = waypoints[waypoints.length - 1];
    const glowPulse = Math.sin(time * 2.5);

    if (endSpawnerContainer) {
      endSpawnerContainer.position.set(end.x, end.y);
      endSpawnerContainer.visible = true;

      endSpawnerGlow!.scale.set(0.42 + 0.05 * glowPulse);
      endSpawnerGlow!.alpha = 0.08 + 0.03 * glowPulse;

      endOuterDiamond!.rotation = -time * 0.5;
      endOuterDiamond!.scale.set(0.48 + 0.015 * Math.sin(time * 3 + 1.5));

      endInnerDiamond!.rotation = time * 0.85;
      endInnerDiamond!.scale.set(0.38 + 0.01 * Math.sin(time * 4));

      endPulseCore!.scale.set(0.24 + 0.02 * glowPulse);
      endWhiteCore!.scale.set(0.11 + 0.02 * Math.sin(time * 2.5 + Math.PI));
    }
  } else {
    if (startSpawnerContainer) startSpawnerContainer.visible = false;
    if (endSpawnerContainer) endSpawnerContainer.visible = false;
  }

  // Context Shop Selection Highlight via PixiJS
  if (state.contextShopCell && state.contextShopPos) {
    const cellX = state.contextShopPos.x;
    const cellY = state.contextShopPos.y;
    const pulse = Math.sin(state.animTime * 0.005) * 0.15 + 0.35;

    uiGraphics.rect(cellX - 6, cellY - 6, TS + 12, TS + 12).fill({ color: 0x00f2fe, alpha: 0.08 });
    uiGraphics.rect(cellX - 3, cellY - 3, TS + 6, TS + 6).fill({ color: 0x00f2fe, alpha: 0.15 });
    uiGraphics.rect(cellX, cellY, TS, TS).fill({ color: 0x00f2fe, alpha: pulse });
    uiGraphics.rect(cellX, cellY, TS, TS).stroke({ color: 0x00f2fe, alpha: 1, width: 2.5 });

    const len = TS * 0.25;
    uiGraphics
      .moveTo(cellX + len, cellY)
      .lineTo(cellX, cellY)
      .lineTo(cellX, cellY + len)
      .stroke({ color: 0xffffff, alpha: 1, width: 2 });

    uiGraphics
      .moveTo(cellX + TS - len, cellY)
      .lineTo(cellX + TS, cellY)
      .lineTo(cellX + TS, cellY + len)
      .stroke({ color: 0xffffff, alpha: 1, width: 2 });

    uiGraphics
      .moveTo(cellX + len, cellY + TS)
      .lineTo(cellX, cellY + TS)
      .lineTo(cellX, cellY + TS - len)
      .stroke({ color: 0xffffff, alpha: 1, width: 2 });

    uiGraphics
      .moveTo(cellX + TS - len, cellY + TS)
      .lineTo(cellX + TS, cellY + TS)
      .lineTo(cellX + TS, cellY + TS - len)
      .stroke({ color: 0xffffff, alpha: 1, width: 2 });
  }

  // Active beams for Prisma Tower are now handled internally inside updatePixi,
  // so no need to draw them here manually.

  // Range ring for hovered tower
  if (state.hoveredTower && !state.selectedTowerType && state.hoveredTower.type !== "Sniper") {
    let rangeColor = 0x4299e1; // Default
    if (state.hoveredTower.type === "Bomb") rangeColor = 0xff6060;
    drawRangeCircle(
      uiGraphics,
      state.hoveredTower.x,
      state.hoveredTower.y,
      state.hoveredTower.range,
      rangeColor
    );
  }

  // Range ring for hovered Boss
  if (state.hoveredEnemy && state.hoveredEnemy.typeName === "Boss") {
    drawRangeCircle(
      uiGraphics,
      state.hoveredEnemy.x,
      state.hoveredEnemy.y,
      state.hoveredEnemy.stunRange || 0,
      0xffff00
    );
  }

  // Ghost tower overlay
  drawGhostTower(uiGraphics);

  // Screen damage pulse
  if (state.screenDamageEffect > 0) {
    const viewW = app.canvas.clientWidth;
    const viewH = app.canvas.clientHeight;
    const alpha = (state.screenDamageEffect / 30) * 0.4;

    screenDamageGraphics.rect(0, 0, viewW, viewH).fill({ color: 0xff0000, alpha: alpha });
    screenDamageGraphics
      .rect(0, 0, viewW, viewH)
      .stroke({ color: 0xff0000, alpha: alpha * 2, width: 15 });
  }

  // FPS Display
  if (state.showFps) {
    fpsText.visible = true;
    fpsText.text = `FPS: ${fpsDisplayVal}`;
    const viewW = app.canvas.clientWidth;
    const viewH = app.canvas.clientHeight;
    fpsText.position.set(viewW - 19, viewH - 19);
  } else {
    fpsText.visible = false;
  }

  if (isPaused) {
    const viewW = app.canvas.clientWidth;
    const viewH = app.canvas.clientHeight;
    pauseGraphics.clear();
    pauseGraphics.rect(0, 0, viewW, viewH).fill({ color: 0x000000, alpha: 0.6 });
    pauseGraphics.visible = true;

    pauseText.style.fontSize = Math.round(viewH * 0.067);
    pauseText.position.set(viewW / 2, viewH / 2);
    pauseText.visible = true;
  } else {
    pauseGraphics.visible = false;
    pauseText.visible = false;
  }
}
