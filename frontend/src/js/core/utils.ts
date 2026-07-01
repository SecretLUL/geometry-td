/*
 * @file: frontend/src/js/core/utils.ts
 * @purpose: Performance-optimized utility functions for distance calculations, collision checks,
 *           array management, and cached DOM element querying.
 * @dependencies: state, types
 * @last_update: 2026-05-29 / v1.3.1 - Removed direct state import and introduced setGameStateRef to resolve circular dependency with Config.
 */
import { Enemy, GameState } from "../types";

let stateRef: GameState | null = null;

export function setGameStateRef(ref: GameState) {
  stateRef = ref;
}

/**
 * Calculates the squared distance between two points.
 * Highly optimized, avoiding slow Math.sqrt calls.
 */
export function getDistanceSq(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return dx * dx + dy * dy;
}

/**
 * Calculates the Euclidean distance between two points.
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

const nearbyBuffers: Enemy[][] = Array.from({ length: 8 }, () => []);
let bufferIndex = 0;

/**
 * Centralized, high-performance spatial grid lookup for enemies.
 * Avoids any array allocations by rotating through a pre-allocated circular buffer.
 */
export function getNearbyEnemies(x: number, y: number, radius: number): Enemy[] {
  if (!stateRef || !stateRef.enemyGrid) return stateRef ? stateRef.enemies : [];

  const nearby = nearbyBuffers[bufferIndex];
  bufferIndex = (bufferIndex + 1) % nearbyBuffers.length;
  nearby.length = 0;

  const enemyCount = stateRef.enemies.length;
  if (enemyCount === 0) {
    return nearby;
  }

  const CELL_SIZE = 100;
  const cx = Math.floor(x / CELL_SIZE);
  const cy = Math.floor(y / CELL_SIZE);
  const radiusCells = Math.ceil(radius / CELL_SIZE);
  const cellsToSearch = (radiusCells * 2 + 1) * (radiusCells * 2 + 1);

  // If the number of enemies is small, or the search grid area is much larger
  // than the number of active enemies, skip grid cell lookups entirely.
  if (enemyCount <= 15 || cellsToSearch > enemyCount * 1.5) {
    for (let i = 0; i < enemyCount; i++) {
      nearby.push(stateRef.enemies[i]);
    }
    return nearby;
  }

  const GRID_WIDTH = 50;
  const GRID_HEIGHT = 50;

  const minX = Math.max(0, cx - radiusCells);
  const maxX = Math.min(GRID_WIDTH - 1, cx + radiusCells);
  const minY = Math.max(0, cy - radiusCells);
  const maxY = Math.min(GRID_HEIGHT - 1, cy + radiusCells);

  for (let gy = minY; gy <= maxY; gy++) {
    for (let gx = minX; gx <= maxX; gx++) {
      const index = gx + gy * GRID_WIDTH;
      const cell = stateRef.enemyGrid[index];
      for (let i = 0; i < cell.length; i++) {
        nearby.push(cell[i]);
      }
    }
  }
  return nearby;
}

/**
 * Cache for DOM elements to prevent repeated expensive querySelector / getElementById calls.
 */
const domCache = new Map<string, HTMLElement | null>();

export function getEl(id: string): HTMLElement | null {
  let el = domCache.get(id);
  if (!el) {
    el = document.getElementById(id);
    if (el) domCache.set(id, el);
  }
  return el;
}

/**
 * Formats a number/value for readability with K/M rounding above certain thresholds,
 * matching the tower damage efficiency table representation.
 */
export function formatNumber(val: number): string {
  if (val >= 1000000) {
    return (val / 1000000).toFixed(2).replace(/\.?0+$/, "") + "M";
  }
  if (val >= 10000) {
    return (val / 1000).toFixed(1).replace(/\.?0+$/, "") + "K";
  }
  return Math.floor(val).toLocaleString();
}

/**
 * Rounds tower upgrade costs to clean, intuitive numbers depending on their scale.
 * Prevents awkward values like 115670g and instead rounds them to nice intervals (e.g., 115000g).
 */
export function roundUpgradeCost(cost: number): number {
  if (cost < 100) {
    return Math.round(cost / 5) * 5;
  } else if (cost < 500) {
    return Math.round(cost / 10) * 10;
  } else if (cost < 2000) {
    return Math.round(cost / 50) * 50;
  } else if (cost < 10000) {
    return Math.round(cost / 100) * 100;
  } else if (cost < 50000) {
    return Math.round(cost / 500) * 500;
  } else if (cost < 100000) {
    return Math.round(cost / 1000) * 1000;
  } else {
    return Math.round(cost / 5000) * 5000;
  }
}

export function isCellAllowedForPlayer(
  col: number,
  row: number,
  playerIndex: number,
  playerCount: number
): boolean {
  if (playerCount <= 1) return true; // Singleplayer

  if (playerCount === 2) {
    if (playerIndex === 0) return col <= 7;
    if (playerIndex === 1) return col >= 8;
  } else if (playerCount === 3) {
    if (playerIndex === 0) return col <= 7;
    if (playerIndex === 1) return col >= 8 && row <= 7;
    if (playerIndex === 2) return col >= 8 && row >= 8;
  } else if (playerCount >= 4) {
    const isLeft = col <= 7;
    const isTop = row <= 7;
    if (playerIndex === 0) return isLeft && isTop;
    if (playerIndex === 1) return !isLeft && isTop;
    if (playerIndex === 2) return isLeft && !isTop;
    if (playerIndex === 3) return !isLeft && !isTop;
  }
  return false;
}
