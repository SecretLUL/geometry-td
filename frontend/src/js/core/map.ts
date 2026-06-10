/*
 * @file: frontend/src/js/core/map.ts
 * @purpose: Defines mission map grid matrices (Spiral, ZigZag, Quantum Bypass) and
 *           converts fractional waypoint coordinates to absolute pixel positions.
 * @dependencies: config, state, types
 * @last_update: 2026-05-21 / v1.1.0 - Added grid cell highlight drawing for mobile context shop selection.
 */
import { Config } from "./config";
import { state } from "./state";
import { Vector2D } from "../types";
import * as PIXI from "pixi.js";

interface MapDefinition {
  map: number[][];
  waypointsFrac: Vector2D[];
}

export const maps: Record<string, MapDefinition> = {
  "The Spiral": {
    map: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      [0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    waypointsFrac: [
      { x: 0.5, y: 1.5 },
      { x: 13.5, y: 1.5 },
      { x: 13.5, y: 13.5 },
      { x: 2.5, y: 13.5 },
      { x: 2.5, y: 3.5 },
      { x: 11.5, y: 3.5 },
      { x: 11.5, y: 11.5 },
      { x: 4.5, y: 11.5 },
      { x: 4.5, y: 5.5 },
      { x: 9.5, y: 5.5 },
      { x: 9.5, y: 9.5 },
      { x: 6.5, y: 9.5 },
      { x: 6.5, y: 7.5 },
      { x: 7.5, y: 7.5 },
    ],
  },
  "The ZigZag": {
    map: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    waypointsFrac: [
      { x: 0.5, y: 1.5 },
      { x: 1.5, y: 1.5 },
      { x: 1.5, y: 3.5 },
      { x: 5.5, y: 3.5 },
      { x: 5.5, y: 1.5 },
      { x: 9.5, y: 1.5 },
      { x: 9.5, y: 3.5 },
      { x: 13.5, y: 3.5 },
      { x: 13.5, y: 5.5 },
      { x: 2.5, y: 5.5 },
      { x: 2.5, y: 7.5 },
      { x: 13.5, y: 7.5 },
      { x: 13.5, y: 9.5 },
      { x: 4.5, y: 9.5 },
      { x: 4.5, y: 11.5 },
      { x: 13.5, y: 11.5 },
      { x: 13.5, y: 13.5 },
      { x: 14.5, y: 13.5 },
    ],
  },
  "Quantum Bypass": {
    map: [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
      [0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0],
      [0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0],
      [0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
    ],
    waypointsFrac: [
      { x: 0.5, y: 3.5 },
      { x: 3.5, y: 3.5 },
      { x: 3.5, y: 11.5 },
      { x: 1.5, y: 11.5 },
      { x: 1.5, y: 5.5 },
      { x: 5.5, y: 5.5 },
      { x: 5.5, y: 9.5 },
      { x: 7.5, y: 9.5 },
      { x: 7.5, y: 5.5 },
      { x: 9.5, y: 5.5 },
      { x: 9.5, y: 9.5 },
      { x: 13.5, y: 9.5 },
      { x: 13.5, y: 3.5 },
      { x: 11.5, y: 3.5 },
      { x: 11.5, y: 7.5 },
      { x: 7.5, y: 7.5 },
      { x: 7.5, y: 14.5 },
    ],
  },
};

export let map: number[][] | null = null;
export let waypoints: Vector2D[] = [];
export let currentMapName: string | null = null;

// Always read COLS / ROWS from Config so they stay in sync with dynamic TILE_SIZE
export function getCOLS(): number {
  return Config.CANVAS_COLS;
}
export function getROWS(): number {
  return Config.CANVAS_ROWS;
}

/** Loads (or re-scales) a map. Call after tile-size changes too. */
export function loadMap(mapName: string): void {
  currentMapName = mapName;
  const selected = maps[mapName];
  if (!selected) {
    console.error(`Map "${mapName}" not found!`);
    return;
  }
  map = selected.map;
  waypoints = selected.waypointsFrac.map((wp) => ({
    x: wp.x * Config.TILE_SIZE,
    y: wp.y * Config.TILE_SIZE,
  }));
  state.mapNeedsRedraw = true;
}

/** Re-apply tile-size to already-loaded waypoints (called on resize). */
export function rescaleWaypoints(): void {
  if (!currentMapName) return;
  const selected = maps[currentMapName];
  if (!selected) return;
  waypoints = selected.waypointsFrac.map((wp) => ({
    x: wp.x * Config.TILE_SIZE,
    y: wp.y * Config.TILE_SIZE,
  }));
}

export function drawMap(container: PIXI.Container): void {
  if (!map) return;
  const TS = Config.TILE_SIZE;
  const COLS = Config.CANVAS_COLS;
  const ROWS = Config.CANVAS_ROWS;

  container.removeChildren();

  const graphics = new PIXI.Graphics();

  // 1. Draw individual grid tiles (Path and Buildable)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (map[r][c] === 1) {
        // --- PATH TILE: Fully transparent to let mapCanvas animation line shine through ---
        graphics.rect(c * TS, r * TS, TS, TS).fill({ color: 0x10142b, alpha: 0.0 });

        // Very subtle central track guide
        graphics
          .rect(c * TS + TS * 0.1, r * TS + TS * 0.1, TS * 0.8, TS * 0.8)
          .fill({ color: 0x4cc9f0, alpha: 0.02 });

        // --- LASER BOUNDARY EDGES ---
        // Detect transitions from Path to Buildable (or canvas edge) to draw a glowing border
        const hasTopEdge = r === 0 || map[r - 1][c] === 0;
        const hasBottomEdge = r === ROWS - 1 || map[r + 1][c] === 0;
        const hasLeftEdge = c === 0 || map[r][c - 1] === 0;
        const hasRightEdge = c === COLS - 1 || map[r][c + 1] === 0;

        if (hasTopEdge || hasBottomEdge || hasLeftEdge || hasRightEdge) {
          const edges = [
            { cond: hasTopEdge, x1: c * TS, y1: r * TS, x2: (c + 1) * TS, y2: r * TS },
            {
              cond: hasBottomEdge,
              x1: c * TS,
              y1: (r + 1) * TS,
              x2: (c + 1) * TS,
              y2: (r + 1) * TS,
            },
            { cond: hasLeftEdge, x1: c * TS, y1: r * TS, x2: c * TS, y2: (r + 1) * TS },
            {
              cond: hasRightEdge,
              x1: (c + 1) * TS,
              y1: r * TS,
              x2: (c + 1) * TS,
              y2: (r + 1) * TS,
            },
          ];

          for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            if (edge.cond) {
              // Outer laser glow
              graphics
                .moveTo(edge.x1, edge.y1)
                .lineTo(edge.x2, edge.y2)
                .stroke({ color: 0x00f2fe, alpha: 0.25, width: 4 });

              // Inner bright laser core
              graphics
                .moveTo(edge.x1, edge.y1)
                .lineTo(edge.x2, edge.y2)
                .stroke({ color: 0x00f2fe, alpha: 1.0, width: 1.5 });
            }
          }
        }
      } else {
        // --- BUILDABLE TILE: Cyber Grid Blueprint (Translucent Glassmorphism) ---
        graphics.rect(c * TS, r * TS, TS, TS).fill({ color: 0x06070d, alpha: 0.82 });

        // Cyber corner brackets for a precision tech feel
        const margin = TS * 0.15;

        // Top-left bracket
        graphics
          .moveTo(c * TS + margin, r * TS)
          .lineTo(c * TS, r * TS)
          .lineTo(c * TS, r * TS + margin)
          .stroke({ color: 0x4cc9f0, alpha: 0.22, width: 1 });

        // Bottom-right bracket
        graphics
          .moveTo(c * TS + TS - margin, r * TS + TS)
          .lineTo(c * TS + TS, r * TS + TS)
          .lineTo(c * TS + TS, r * TS + TS - margin)
          .stroke({ color: 0x4cc9f0, alpha: 0.22, width: 1 });

        // Faint blueprint crosshair in center
        graphics
          .rect(c * TS + TS / 2 - 1, r * TS + TS / 2 - 1, 2, 2)
          .fill({ color: 0x4cc9f0, alpha: 0.08 });

        // Subtle blueprint grid boundaries
        graphics.rect(c * TS, r * TS, TS, TS).stroke({ color: 0xffffff, alpha: 0.02, width: 1 });
      }
    }
  }

  // Outer map boundary glow for seamless blending with the cosmic background
  graphics.rect(0, 0, COLS * TS, ROWS * TS).stroke({ color: 0x00f2fe, alpha: 0.12, width: 2 });
  graphics.rect(0, 0, COLS * TS, ROWS * TS).stroke({ color: 0x00f2fe, alpha: 0.04, width: 10 });

  container.addChild(graphics);
}
