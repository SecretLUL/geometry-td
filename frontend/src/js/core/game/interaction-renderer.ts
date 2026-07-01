/*
 * @file: frontend/src/js/core/game/interaction-renderer.ts
 * @purpose: Handles rendering of cell selection outlines, active/hovered ranges, multiplayer team grids, and ghost towers.
 * @dependencies: state, config, multiplayer, base-tower, utils, towers, map, viewport, PIXI
 */
import * as PIXI from "pixi.js";
import { state } from "../state";
import { Config } from "../config";
import { Multiplayer } from "../multiplayer/context";
import { getPlayerColor } from "../../entities/towers/base-tower";
import { isCellAllowedForPlayer } from "../utils";
import { drawRangeCircle, drawGhostTower } from "../../entities/towers/index";
import { getCOLS, getROWS } from "../map";
import { uiContainer } from "./viewport";

let uiGraphics: PIXI.Graphics | null = null;

export function getUiGraphics(): PIXI.Graphics | null {
  return uiGraphics;
}

export function drawMultiplayerDivisionLines(g: PIXI.Graphics): void {
  const activeCount = state.playerSlots ? state.playerSlots.filter((id) => id !== null).length : 1;
  if (activeCount <= 1) return;

  const TS = Config.TILE_SIZE;
  const cols = getCOLS();
  const rows = getROWS();
  const width = cols * TS;
  const height = rows * TS;

  const time = state.animTime || Date.now();
  const baseAlpha = 0.5 + 0.15 * Math.sin(time * 0.005);

  const drawGlowLine = (x1: number, y1: number, x2: number, y2: number, color: number) => {
    g.moveTo(x1, y1)
      .lineTo(x2, y2)
      .stroke({ color, alpha: baseAlpha * 0.35, width: 6 });
    g.moveTo(x1, y1).lineTo(x2, y2).stroke({ color, alpha: 0.9, width: 2 });
  };

  if (activeCount === 2) {
    const midX = 8 * TS;
    drawGlowLine(midX, 0, midX, height, 0xff007f);
  } else if (activeCount === 3) {
    drawGlowLine(8 * TS, 0, 8 * TS, height, 0x00f2fe);
    drawGlowLine(8 * TS, 8 * TS, width, 8 * TS, 0xffb703);
  } else if (activeCount >= 4) {
    const midX = 8 * TS;
    const midY = 8 * TS;
    drawGlowLine(midX, 0, midX, height, 0x00ff88);
    drawGlowLine(0, midY, width, midY, 0x00ff88);
  }

  const myIndex = Multiplayer.myPlayerIndex || 0;
  let startCol = 0,
    endCol = cols - 1;
  let startRow = 0,
    endRow = rows - 1;

  if (activeCount === 2) {
    if (myIndex === 0) {
      endCol = 7;
    } else {
      startCol = 8;
    }
  } else if (activeCount === 3) {
    if (myIndex === 0) {
      endCol = 7;
    } else if (myIndex === 1) {
      startCol = 8;
      endRow = 7;
    } else {
      startCol = 8;
      startRow = 8;
    }
  } else if (activeCount >= 4) {
    const isLeft = myIndex === 0 || myIndex === 2;
    const isTop = myIndex === 0 || myIndex === 1;
    if (isLeft) {
      endCol = 7;
    } else {
      startCol = 8;
    }
    if (isTop) {
      endRow = 7;
    } else {
      startRow = 8;
    }
  }

  const zX = startCol * TS;
  const zY = startRow * TS;
  const zW = (endCol - startCol + 1) * TS;
  const zH = (endRow - startRow + 1) * TS;

  if (state.selectedTowerType) {
    const myColor = getPlayerColor(myIndex);
    const pulseAlpha = 0.08 + 0.04 * Math.sin(time * 0.007);
    g.rect(zX, zY, zW, zH).stroke({ color: myColor, alpha: 0.7, width: 2 });
    g.rect(zX, zY, zW, zH).fill({ color: myColor, alpha: pulseAlpha });
  }

  // Relocation highlight flashing red for misplaced towers
  if (state.relocationActive) {
    const flashAlpha = 0.15 + 0.12 * Math.sin(time * 0.012);
    const relocColor = 0xff3366;
    for (const t of state.towers) {
      if (t.ownerIndex !== undefined) {
        if (!isCellAllowedForPlayer(t.col, t.row, t.ownerIndex, activeCount)) {
          g.rect(t.col * TS, t.row * TS, TS, TS).fill({ color: relocColor, alpha: flashAlpha });
          g.rect(t.col * TS, t.row * TS, TS, TS).stroke({
            color: relocColor,
            alpha: 0.8,
            width: 2,
          });
        }
      }
    }

    // Selected relocator tower (yellow border highlight)
    if (state.relocatingTower) {
      const { col, row } = state.relocatingTower;
      g.rect(col * TS, row * TS, TS, TS).stroke({ color: 0xffaa00, alpha: 0.9, width: 3 });
    }
  }
}

export function drawInteractions(): void {
  if (!uiGraphics) {
    uiGraphics = new PIXI.Graphics();
    uiContainer.addChild(uiGraphics);
  }

  uiGraphics.clear();
  const TS = Config.TILE_SIZE;

  // 1. Context Shop Selection Highlight
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

  // 2. Range ring for hovered tower
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

  // 3. Range ring for hovered Boss
  if (state.hoveredEnemy && state.hoveredEnemy.typeName === "Boss") {
    drawRangeCircle(
      uiGraphics,
      state.hoveredEnemy.x,
      state.hoveredEnemy.y,
      state.hoveredEnemy.stunRange || 0,
      0xffff00
    );
  }

  // 4. Multiplayer division lines
  drawMultiplayerDivisionLines(uiGraphics);

  // 5. Ghost tower overlay
  drawGhostTower(uiGraphics);
}
