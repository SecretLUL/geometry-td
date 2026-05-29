/*
 * @file: frontend\src\js\core\game\renderer.ts
 * @purpose: Handles coordinate translations, screen shake math, rendering passive/active canvas layers, range circles, ghost towers, screen damage vignettes, and drawing canvas FPS text.
 * @dependencies: state, config, towers, map, modals, viewport
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
 * @last_update: 2026-05-29 / v1.2.0 - Migrated entirely to pure PixiJS for GPU acceleration, completely eliminating CanvasRenderingContext2D.
 */
import { state } from '../state';
import { Config } from '../config';
import { drawRangeCircle, drawGhostTower } from '../../entities/towers/index';
import { drawMap, waypoints } from '../map';
import { updateContextShopPosition } from '../../ui/modals';
import { clampCamera, mapContainer, pathAnimContainer, pathAnimGraphics, entitiesContainer, uiContainer, app } from './viewport';
import * as PIXI from 'pixi.js';

export function getPointAlongPath(waypoints: {x: number, y: number}[], t: number): {x: number, y: number} {
    if (waypoints.length === 0) return { x: 0, y: 0 };
    if (waypoints.length === 1) return { x: waypoints[0].x, y: waypoints[0].y };

    let lengths: number[] = [];
    let totalLength = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        const dx = waypoints[i+1].x - waypoints[i].x;
        const dy = waypoints[i+1].y - waypoints[i].y;
        const len = Math.sqrt(dx*dx + dy*dy);
        lengths.push(len);
        totalLength += len;
    }

    t = ((t % 1) + 1) % 1; // Wrap t between 0 and 1
    const targetDist = t * totalLength;

    let accum = 0;
    for (let i = 0; i < lengths.length; i++) {
        const len = lengths[i];
        if (accum + len >= targetDist) {
            const segmentT = (targetDist - accum) / len;
            const p0 = waypoints[i];
            const p1 = waypoints[i+1];
            return {
                x: p0.x + (p1.x - p0.x) * segmentT,
                y: p0.y + (p1.y - p0.y) * segmentT
            };
        }
        accum += len;
    }
    return { x: waypoints[waypoints.length - 1].x, y: waypoints[waypoints.length - 1].y };
}

const isHeadlessMode = new URLSearchParams(window.location.search).get('headless') === 'true';

let lastCameraX = -9999;
let lastCameraY = -9999;
let lastTileSize = -1;

let uiGraphics: PIXI.Graphics | null = null;
let screenDamageGraphics: PIXI.Graphics | null = null;
let fpsText: PIXI.Text | null = null;

let pauseGraphics: PIXI.Graphics | null = null;
let pauseText: PIXI.Text | null = null;

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
            text: '',
            style: {
                fontFamily: 'Outfit, sans-serif',
                fontSize: 16,
                fontWeight: 'bold',
                fill: 0x00ff88,
                dropShadow: {
                    alpha: 0.25,
                    blur: 0,
                    color: 0x00ff88,
                    distance: 1,
                    angle: Math.PI / 4
                }
            }
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
            text: 'PAUSIERT',
            style: {
                fontFamily: 'Arial',
                fontWeight: 'bold',
                fill: '#ffffff',
                align: 'center'
            }
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
        if (Math.abs(state.camera.x - state.targetCamera.x) < 0.2 && Math.abs(state.camera.y - state.targetCamera.y) < 0.2) {
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

        if (Math.abs(state.contextShopPos.x - targetX) < 0.2 && Math.abs(state.contextShopPos.y - targetY) < 0.2) {
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
    }
    
    // PixiJS Panning
    mapContainer.position.set(camX, camY);
    pathAnimContainer.position.set(camX, camY);
    entitiesContainer.position.set(camX, camY);
    uiContainer.position.set(camX, camY);

    pathAnimGraphics.clear();
    uiGraphics.clear();
    screenDamageGraphics.clear();

    // 1. Draw active energy streams flowing along path waypoints
    if (waypoints.length > 1) {
        const time = state.animTime * 0.002;
        
        pathAnimGraphics.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
            pathAnimGraphics.lineTo(waypoints[i].x, waypoints[i].y);
        }
        pathAnimGraphics.stroke({ color: 0x00f2fe, alpha: 0.08, width: 14, cap: 'round', join: 'round' });

        pathAnimGraphics.moveTo(waypoints[0].x, waypoints[0].y);
        for (let i = 1; i < waypoints.length; i++) {
            pathAnimGraphics.lineTo(waypoints[i].x, waypoints[i].y);
        }
        pathAnimGraphics.stroke({ color: 0x00f2fe, alpha: 0.25, width: 5, cap: 'round', join: 'round' });

        const numPhotons = 8;
        for (let j = 0; j < numPhotons; j++) {
            const t = (time * 0.03 + (j / numPhotons)) % 1.0;
            const pos = getPointAlongPath(waypoints, t);
            
            pathAnimGraphics.circle(pos.x, pos.y, 6).fill({ color: 0x00f2fe, alpha: 0.15 });
            pathAnimGraphics.circle(pos.x, pos.y, 3).fill({ color: 0x00f2fe, alpha: 0.75 });
            pathAnimGraphics.circle(pos.x, pos.y, 1.5).fill({ color: 0xffffff, alpha: 1.0 });
        }
    }

    // 2. Draw Start & End Spawners
    if (waypoints.length > 0) {
        const time = state.animTime * 0.002;
        const pulse = Math.sin(time * 2) * 0.15 + 0.85;
        
        const start = waypoints[0];
        pathAnimGraphics.circle(start.x, start.y, TS * 0.32 * pulse).stroke({ color: 0xff0055, alpha: 0.85, width: 3 });
        pathAnimGraphics.circle(start.x, start.y, TS * 0.25 * (2 - pulse)).fill({ color: 0xff0055, alpha: 0.18 * pulse });
        pathAnimGraphics.circle(start.x, start.y, TS * 0.12).fill({ color: 0xff0055, alpha: 1.0 });

        const end = waypoints[waypoints.length - 1];
        pathAnimGraphics.circle(end.x, end.y, TS * 0.42 * pulse).stroke({ color: 0x00d4ff, alpha: 0.85, width: 4 });
        pathAnimGraphics.circle(end.x, end.y, TS * 0.35).fill({ color: 0x00d4ff, alpha: 0.12 });
        pathAnimGraphics.poly([
            end.x, end.y - TS * 0.28,
            end.x + TS * 0.28, end.y,
            end.x, end.y + TS * 0.28,
            end.x - TS * 0.28, end.y
        ], true).fill({ color: 0x00d4ff, alpha: 1.0 });

        const dashRadius = TS * 0.58;
        const numSegments = 12;
        const angleStep = (Math.PI * 2) / numSegments;
        const rotationSpeed = time * 0.75;
        for (let i = 0; i < numSegments; i++) {
            if (i % 2 === 0) {
                const startAngle = rotationSpeed + i * angleStep;
                const endAngle = rotationSpeed + (i + 0.5) * angleStep;
                const startX = end.x + dashRadius * Math.cos(startAngle);
                const startY = end.y + dashRadius * Math.sin(startAngle);
                pathAnimGraphics.moveTo(startX, startY);
                pathAnimGraphics.arc(end.x, end.y, dashRadius, startAngle, endAngle);
            }
        }
        pathAnimGraphics.stroke({ color: 0x4cc9f0, alpha: 0.5, width: 1.5 });
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
        uiGraphics.moveTo(cellX + len, cellY)
                  .lineTo(cellX, cellY)
                  .lineTo(cellX, cellY + len)
                  .stroke({ color: 0xffffff, alpha: 1, width: 2 });
                  
        uiGraphics.moveTo(cellX + TS - len, cellY)
                  .lineTo(cellX + TS, cellY)
                  .lineTo(cellX + TS, cellY + len)
                  .stroke({ color: 0xffffff, alpha: 1, width: 2 });
                  
        uiGraphics.moveTo(cellX + len, cellY + TS)
                  .lineTo(cellX, cellY + TS)
                  .lineTo(cellX, cellY + TS - len)
                  .stroke({ color: 0xffffff, alpha: 1, width: 2 });
                  
        uiGraphics.moveTo(cellX + TS - len, cellY + TS)
                  .lineTo(cellX + TS, cellY + TS)
                  .lineTo(cellX + TS, cellY + TS - len)
                  .stroke({ color: 0xffffff, alpha: 1, width: 2 });
    }

    // Active beams for Prisma Tower are now handled internally inside updatePixi, 
    // so no need to draw them here manually.

    // Range ring for hovered tower
    if (state.hoveredTower && !state.selectedTowerType && state.hoveredTower.type !== 'Sniper') {
        let rangeColor = 0x4299e1; // Default
        if (state.hoveredTower.type === 'Bomb') rangeColor = 0xff6060;
        drawRangeCircle(uiGraphics, state.hoveredTower.x, state.hoveredTower.y, state.hoveredTower.range, rangeColor);
    }

    // Range ring for hovered Boss
    if (state.hoveredEnemy && state.hoveredEnemy.typeName === 'Boss') {
        drawRangeCircle(uiGraphics, state.hoveredEnemy.x, state.hoveredEnemy.y, state.hoveredEnemy.stunRange || 0, 0xffff00);
    }

    // Ghost tower overlay
    drawGhostTower(uiGraphics);

    // Screen damage pulse
    if (state.screenDamageEffect > 0) {
        const viewW = app.canvas.clientWidth;
        const viewH = app.canvas.clientHeight;
        const alpha = (state.screenDamageEffect / 30) * 0.4;
        
        screenDamageGraphics.rect(0, 0, viewW, viewH).fill({ color: 0xff0000, alpha: alpha });
        screenDamageGraphics.rect(0, 0, viewW, viewH).stroke({ color: 0xff0000, alpha: alpha * 2, width: 15 });
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
