/*
 * @file: frontend/src/js/entities/towers/ghost-tower.ts
 * @purpose: Semi-transparent visual representation of standard towers displayed during layout mode prior to construction.
 * @dependencies: config, state, base-tower, sniper-tower, bomb-tower, tesla-tower, prisma-tower
 * @last_update: 2026-05-29 / v2.0.0 - Migrated rendering to PixiJS.
 */
import { Config, TowerData } from '../../core/config';
import { state } from '../../core/state';
import { Tower, drawRangeCircle } from './base-tower';
import { SniperTower } from './sniper-tower';
import { BombTower } from './bomb-tower';
import { TeslaTower } from './tesla-tower';
import { PrismaTower } from './prisma-tower';
import { BoosterTower } from './booster-tower';
import { GeneratorTower } from './generator-tower';
import * as PIXI from 'pixi.js';

// ─── Ghost Tower (placement preview) ─────────────────────────────────────────
/**
 * Renders the ghost (semi-transparent) tower + range ring at the current mouse position.
 */
export function drawGhostTower(g: PIXI.Graphics): void {
    if (!(state as any).ghostCache) {
        (state as any).ghostCache = {};
    }
    const ghostCache = (state as any).ghostCache;

    if (!state.selectedTowerType || !state.ghostMouse) {
        for (const key in ghostCache) {
            if (ghostCache[key] && ghostCache[key].pixiSprite) {
                ghostCache[key].pixiSprite.visible = false;
            }
        }
        return;
    }

    const { x: mx, y: my } = state.ghostMouse;
    const TS = Config.TILE_SIZE;

    const col = Math.floor(mx / TS);
    const row = Math.floor(my / TS);
    const cx = col * TS + TS / 2;
    const cy = row * TS + TS / 2;

    // Determine which tower prototype to use for range/color
    let range: number, towerColor: number;
    const type = state.selectedTowerType;
    const data = TowerData[type] || TowerData['Base'];
    
    range = data.baseRange;
    if (type === 'Sniper') {
        towerColor = 0x4cc9f0;
    } else if (type === 'Bomb') {
        towerColor = 0xff6060;
    } else if (type === 'Tesla') {
        towerColor = 0x00ffff;
    } else if (type === 'Prisma') {
        towerColor = 0xffd700;
    } else if (type === 'Booster') {
        towerColor = 0xff9f43;
    } else if (type === 'Generator') {
        towerColor = 0x26de81;
    } else {
        towerColor = 0x4299e1;
    }

    // Range ring
    if (state.selectedTowerType !== 'Sniper') {
        drawRangeCircle(g, cx, cy, range, towerColor);
    }


    for (const key in ghostCache) {
        if (ghostCache[key] && ghostCache[key].pixiSprite) {
            ghostCache[key].pixiSprite.visible = (key === type);
        }
    }

    if (!ghostCache[type]) {
        let tmp: Tower;
        if (type === 'Sniper') tmp = new SniperTower(col, row);
        else if (type === 'Bomb') tmp = new BombTower(col, row);
        else if (type === 'Tesla') tmp = new TeslaTower(col, row);
        else if (type === 'Prisma') tmp = new PrismaTower(col, row);
        else if (type === 'Booster') tmp = new BoosterTower(col, row);
        else if (type === 'Generator') tmp = new GeneratorTower(col, row);
        else tmp = new Tower(col, row);
        
        tmp.constructionTimer = 0; // Show as fully built
        tmp.redrawPixiBase();
        tmp.redrawPixiTurret();

        if (tmp.pixiSprite) {
            tmp.pixiSprite.alpha = 0.55;
            tmp.pixiSprite.visible = true;
        }
        ghostCache[type] = tmp;
    }

    const ghost = ghostCache[type];
    if (ghost.pixiSprite) {
        ghost.pixiSprite.position.set(cx, cy);
        
        // If it's a Prisma Tower, it might have a beams graphics, hide it just in case
        if ((ghost as any).pixiBeamsGraphics) {
            (ghost as any).pixiBeamsGraphics.visible = false;
        }
    }
}
