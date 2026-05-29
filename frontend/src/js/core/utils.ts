/*
 * @file: frontend\src\js\core\utils.ts
 * @purpose: Performance-optimized utility functions for distance calculations, collision checks, array management, and custom DOM element querying.
 * @dependencies: state, types
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Ã„nderung der FunktionalitÃ¤t MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
 * @last_update: 2026-05-27 / v1.3.0 - Added roundUpgradeCost helper function to round upgrade costs to clean, round intervals.
 */
import { state } from './state';
import { Enemy } from '../types';

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
    if (!state.enemyGrid) return state.enemies;
    const CELL_SIZE = 100;
    const cx = Math.floor(x / CELL_SIZE);
    const cy = Math.floor(y / CELL_SIZE);
    const radiusCells = Math.ceil(radius / CELL_SIZE);
    
    const nearby = nearbyBuffers[bufferIndex];
    bufferIndex = (bufferIndex + 1) % nearbyBuffers.length;
    nearby.length = 0;

    for (let ix = -radiusCells; ix <= radiusCells; ix++) {
        for (let iy = -radiusCells; iy <= radiusCells; iy++) {
            const key = (cx + ix) | ((cy + iy) << 16);
            const cell = state.enemyGrid.get(key);
            if (cell) {
                for (let i = 0; i < cell.length; i++) {
                    nearby.push(cell[i]);
                }
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
        return (val / 1000000).toFixed(2).replace(/\.?0+$/, '') + 'M';
    }
    if (val >= 10000) {
        return (val / 1000).toFixed(1).replace(/\.?0+$/, '') + 'K';
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

