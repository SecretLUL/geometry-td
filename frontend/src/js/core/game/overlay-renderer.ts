/*
 * @file: frontend/src/js/core/game/overlay-renderer.ts
 * @purpose: Handles rendering of passive/active top-level graphics overlay components (FPS, Pause, Damage vignette).
 * @dependencies: state, viewport, PIXI
 */
import * as PIXI from "pixi.js";
import { state } from "../state";
import { app } from "./viewport";

let screenDamageGraphics: PIXI.Graphics | null = null;
let fpsText: PIXI.Text | null = null;
let pauseGraphics: PIXI.Graphics | null = null;
let pauseText: PIXI.Text | null = null;

function initOverlayGraphics(): void {
  if (typeof window === "undefined" || !app || !app.stage) return;

  if (!screenDamageGraphics) {
    screenDamageGraphics = new PIXI.Graphics();
    app.stage.addChild(screenDamageGraphics);
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
    app.stage.addChild(pauseGraphics);
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
}

export function drawOverlay(fpsDisplayVal: number, isPaused: boolean = false): void {
  initOverlayGraphics();

  if (!screenDamageGraphics || !fpsText || !pauseGraphics || !pauseText || !app) return;

  screenDamageGraphics.clear();

  const viewW = app.canvas.clientWidth;
  const viewH = app.canvas.clientHeight;

  // 1. Screen damage pulse
  if (state.screenDamageEffect > 0) {
    const alpha = (state.screenDamageEffect / 30) * 0.4;
    screenDamageGraphics.rect(0, 0, viewW, viewH).fill({ color: 0xff0000, alpha: alpha });
    screenDamageGraphics
      .rect(0, 0, viewW, viewH)
      .stroke({ color: 0xff0000, alpha: alpha * 2, width: 15 });
    state.screenDamageEffect--;
  }

  // 2. FPS Display
  if (state.showFps) {
    fpsText.visible = true;
    fpsText.text = `FPS: ${fpsDisplayVal}`;
    fpsText.position.set(viewW - 19, viewH - 19);
  } else {
    fpsText.visible = false;
  }

  // 3. Pause Screen overlay
  if (isPaused && !state.relocationActive) {
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
