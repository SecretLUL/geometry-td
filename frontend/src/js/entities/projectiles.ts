/*
 * @file: frontend\src\js\entities\projectiles.ts
 * @purpose: Models standard and rocket projectiles, including trajectories, homing updates, trails, area-of-effect detonations, and target tracking.
 * @dependencies: config, state, fx, utils, types, pool
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
 * @last_update: 2026-05-29 / v1.1.0 - Integrated new premium visual rendering for Cluster parent bombs and fragmentation sub-munitions.
 */
import { Config, TowerData } from '../core/config';
import { state } from '../core/state';
import { FloatingText, createExplosion, RadiationArea, Shockwave } from '../fx/fx';
import { getDistanceSq, getNearbyEnemies } from '../core/utils';
import { Enemy, Tower, Vector2D } from '../types';
import { PoolManager } from '../core/pool';
import { app, entitiesContainer, inactivePoolContainer } from '../core/game/viewport';
import * as PIXI from 'pixi.js';

// ─── Projectile ───────────────────────────────────────────────────────────────
export class Projectile {
    public x!: number;
    public y!: number;
    public target!: Enemy | Vector2D | null;
    public targetPoint?: Vector2D;
    public damage!: number;
    public tower!: Tower | null;
    public aoeRadius!: number;
    public speed!: number;
    public active!: boolean;
    public trailX!: Float32Array;
    public trailY!: Float32Array;
    public trailHead!: number;
    public trailCount!: number;
    public bounceCount!: number;
    public isCluster!: boolean;
    public hitEnemies: Enemy[];
    public isHoming!: boolean;
    public angle!: number;
    public pixiSprite?: PIXI.Container;
    private trailGraphics?: PIXI.Graphics;
    private bodyGraphics?: PIXI.Graphics;

    constructor(
        x = 0,
        y = 0,
        target: Enemy | Vector2D | null = null,
        damage = 0,
        tower: Tower | null = null,
        aoeRadius = 0,
        speed: number | null = null,
        bounceCount = 0,
        isCluster = false
    ) {
        this.trailX = new Float32Array(15);
        this.trailY = new Float32Array(15);
        this.trailHead = 0;
        this.trailCount = 0;
        this.hitEnemies = [];
        if (target !== null || x !== 0 || y !== 0) {
            this.init(x, y, target, damage, tower, aoeRadius, speed, bounceCount, isCluster);
        } else {
            this.x = 0;
            this.y = 0;
            this.target = null;
            this.damage = 0;
            this.tower = null;
            this.aoeRadius = 0;
            this.speed = 0;
            this.active = false;
            this.bounceCount = 0;
            this.isCluster = false;
            this.isHoming = false;
            this.angle = 0;
        }
    }

    public init(
        x: number,
        y: number,
        target: Enemy | Vector2D | null,
        damage: number,
        tower: Tower | null = null,
        aoeRadius = 0,
        speed: number | null = null,
        bounceCount = 0,
        isCluster = false
    ): this {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.tower = tower;
        this.aoeRadius = aoeRadius;
        this.speed = speed || Config.PROJECTILE_SPEED;
        this.active = true;
        this.trailHead = 0;
        this.trailCount = 0;
        this.bounceCount = bounceCount;
        this.isCluster = isCluster;
        this.hitEnemies.length = 0; // Clear the recycled array
        this.isHoming = false;
        this.angle = 0;

        // BOMB LOGIC: Fly to fixed point, no homing
        if (this.tower && this.tower.type === 'Bomb') {
            this.targetPoint = { x: target!.x, y: target!.y };
            this.speed = speed || TowerData['Bomb'].projectileSpeed!;
        } else {
            this.targetPoint = undefined;
        }

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.pixiSprite) {
                this.pixiSprite = new PIXI.Container();
                this.trailGraphics = new PIXI.Graphics();
                this.bodyGraphics = new PIXI.Graphics();
                this.pixiSprite.addChild(this.trailGraphics);
                this.pixiSprite.addChild(this.bodyGraphics);
            }
            entitiesContainer.addChild(this.pixiSprite);
            this.pixiSprite.visible = true;
            if (this.bodyGraphics) {
                this.bodyGraphics.clear();
                this.drawBodyPixi(this.bodyGraphics);
            }
        }
        return this;
    }

    private redrawTrail(): void {
        if (!this.trailGraphics) return;
        const g = this.trailGraphics;
        g.clear();

        const maxTrail = state.perfMode ? 4 : 15;
        if (this.trailCount > 1) {
            const drawPath = (color: string, width: number, alpha: number) => {
                const startIdx = (this.trailHead - this.trailCount + 2 * maxTrail) % maxTrail;
                g.moveTo(this.trailX[startIdx], this.trailY[startIdx]);
                for (let i = 1; i < this.trailCount; i++) {
                    const idx = (this.trailHead - this.trailCount + i + 2 * maxTrail) % maxTrail;
                    g.lineTo(this.trailX[idx], this.trailY[idx]);
                }
                g.stroke({ color, width, alpha });
            };

            if (this.tower && this.tower.type === 'Sniper') {
                drawPath('#a0d8ef', 4, 0.4);
            } else if (this.tower && this.tower.type === 'Bomb') {
                if (this.isCluster) {
                    drawPath('#ff4757', 5, 0.5); // Thick fiery red path for parent
                    drawPath('#fffa65', 2, 0.3); // Inner hot yellow trail
                } else if (this.tower.specialization === 'cluster') {
                    drawPath('#ff7675', 2.5, 0.35); // Sleeker red trail for fragments
                } else {
                    drawPath('#fca311', 3, 0.4); // Standard bomb trail
                }
            } else if (this.isHoming) {
                drawPath('#ff6b6b', 6, 0.5);
                drawPath('#ffe600', 2, 0.3); // Inner
            } else {
                drawPath('#fca311', 1.5, 0.15);
            }
        }
    }

    private drawBodyPixi(g: PIXI.Graphics): void {
        if (this.isHoming) {
            // Rocket
            g.roundRect(-8, -4, 16, 8, 2).fill({ color: '#dfe6e9' });
            g.rect(0, -4, 4, 8).fill({ color: '#d63031' }); // Stripes
            
            // Nose cone
            g.moveTo(8, -4).lineTo(14, 0).lineTo(8, 4).fill({ color: '#d63031' });
            
            // Fins
            g.moveTo(-8, -4).lineTo(-12, -7).lineTo(-4, -4).fill({ color: '#2d3436' });
            g.moveTo(-8, 4).lineTo(-12, 7).lineTo(-4, 4).fill({ color: '#2d3436' });

            // Glow
            g.rect(-8, -4, 16, 8).stroke({ color: '#ff7675', alpha: 0.4, width: 3 });
            g.rect(-8, -4, 16, 8).stroke({ color: '#ffffff', alpha: 1, width: 1 });

        } else if (this.tower && this.tower.type === 'Bomb') {
            const isParentCluster = this.isCluster; // Only parent bomb has isCluster = true
            const isMiniBomb = !this.isCluster && this.tower.specialization === 'cluster';
            
            if (isParentCluster) {
                const radius = 10; // slightly larger for the main payload
                const bodyColor = '#2f3542';
                g.circle(0, 0, radius).fill({ color: bodyColor });
                g.circle(0, 0, radius).stroke({ color: '#d63031', width: 1.5 });
                g.circle(0, 0, radius + 2).stroke({ color: '#ff4757', alpha: 0.4, width: 1 });
                
                // Sub-munitions visible on body
                for (let i = 0; i < 3; i++) {
                    const ang = (Math.PI * 2 / 3) * i + state.animTime * 0.05;
                    g.circle(Math.cos(ang) * 5.5, Math.sin(ang) * 5.5, 2.0).fill({ color: '#fffa65' });
                }
                g.circle(0, 0, 3).fill({ color: '#ffffff' });
            } else if (isMiniBomb) {
                const radius = 5; // smaller mini fragmentation pellets
                g.circle(0, 0, radius).fill({ color: '#ff4757' });
                g.circle(0, 0, radius * 0.5).fill({ color: '#fffa65' });
                g.circle(0, 0, radius).stroke({ color: '#d63031', alpha: 0.8, width: 1 });
            } else {
                const radius = 9;
                const bodyColor = this.tower.specialization === 'nuke' ? '#2d3436' : '#5e1212';
                const coreColor = this.tower.specialization === 'nuke' ? '#badc58' : '#ff7675';

                g.circle(0, 0, radius).fill({ color: bodyColor });
                g.circle(-radius * 0.3, -radius * 0.3, radius * 0.4).fill({ color: '#ffffff', alpha: 0.2 });
                g.circle(0, 0, radius * 0.3).fill({ color: coreColor });
                
                g.circle(0, 0, radius).stroke({ color: coreColor, alpha: 0.44, width: 4 });
                g.circle(0, 0, radius).stroke({ color: coreColor, alpha: 1, width: 1.5 });
            }
        } else {
            const radius = 4;
            const color = this.tower && this.tower.type === 'Sniper' ? '#a0d8ef' : '#fca311';
            g.rect(-radius, -radius, radius * 2, radius * 2).fill({ color });
        }
    }

    public draw(): void {}
    public drawRocket(): void {}
    public drawBomb(): void {}

    public getTrailArray(): { x: number, y: number }[] {
        const arr: { x: number, y: number }[] = [];
        const maxTrail = state.perfMode ? 4 : 15;
        for (let i = 0; i < this.trailCount; i++) {
            const idx = (this.trailHead - this.trailCount + i + 2 * maxTrail) % maxTrail;
            arr.push({ x: this.trailX[idx], y: this.trailY[idx] });
        }
        return arr;
    }

    public getNearbyEnemies(): Enemy[] {
        return getNearbyEnemies(this.x, this.y, this.aoeRadius || 100);
    }

    public processKill(): void {
        if (this.tower && this.tower.specialization === 'bounty') {
            const bonus = this.tower.masteryUnlocked ? 250 : 50;
            state.gold += bonus;
            state.totalGoldEarned += bonus;
            PoolManager.getFloatingText(this.x, this.y - 20, `+${bonus}g Bounty`, '#ffb703');
        }
    }

    public update(): void {
        const maxTrail = state.perfMode ? 4 : 15;
        if (this.active) {
            this.trailX[this.trailHead] = this.x;
            this.trailY[this.trailHead] = this.y;
            this.trailHead = (this.trailHead + 1) % maxTrail;
            this.trailCount = Math.min(this.trailCount + 1, maxTrail);
        } else {
            // Gradually empty the trail when inactive so it disappears
            if (this.trailCount > 0) {
                this.trailCount--;
            }
        }

        if (this.active) {
            // Check for early collision with ANY enemy
            if (this.isHoming) {
                const nearby = this.getNearbyEnemies();
                for (let i = 0; i < nearby.length; i++) {
                    const enemy = nearby[i];
                    if (enemy.deadMarked || enemy.hp <= 0) continue;
                    const dEnemySq = getDistanceSq(enemy.x, enemy.y, this.x, this.y);
                    const limit = enemy.radius + 8;
                    if (dEnemySq < limit * limit) {
                        this.target = enemy;
                        break;
                    }
                }
            }

            if (!this.targetPoint && (!this.target || (this.target as Enemy).hp <= 0)) {
                if (this.isHoming && state.enemies.length > 0) {
                    // Find new target for homing missile
                    this.target = state.enemies[0];
                } else {
                    this.active = false;
                }
            }

            if (this.active) {
                const tx = this.targetPoint ? this.targetPoint.x : this.target!.x;
                const ty = this.targetPoint ? this.targetPoint.y : this.target!.y;

                const dx = tx - this.x;
                const dy = ty - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.speed) {
                    if (this.aoeRadius > 0) {
                        // VISUAL COMPONENTS: Executed by ALL clients and host
                        createExplosion(this.x, this.y, '#ff3333', 15);
                        PoolManager.getShockwave(this.x, this.y, this.aoeRadius * 1.5);

                        // RADIATION: Nuke specialization leaves radioactive ground
                        if (this.tower && this.tower.specialization === 'nuke') {
                            const dmgPerTick = Math.max(1, Math.floor(this.damage * 0.05));
                            PoolManager.getRadiationArea(this.x, this.y, this.aoeRadius, dmgPerTick, 240, this.tower);
                        }

                        // Get nearby enemies to flash their hit state
                        const nearby = this.getNearbyEnemies();
                        const aoeSq = this.aoeRadius * this.aoeRadius;

                        for (let i = 0; i < nearby.length; i++) {
                            const enemy = nearby[i];
                            if (enemy.hp <= 0 || enemy.deadMarked) continue;
                            const distSq = getDistanceSq(enemy.x, enemy.y, this.x, this.y);

                            if (distSq <= aoeSq) {
                                enemy.flashTime = 5; // Visual feedback
                            }
                        }

                        // LOGICAL STATE: Strictly host-isolated
                        if (state.isHost) {
                            for (let i = 0; i < nearby.length; i++) {
                                const enemy = nearby[i];
                                if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
                                const distSq = getDistanceSq(enemy.x, enemy.y, this.x, this.y);

                                if (distSq <= aoeSq) {
                                    if (enemy && typeof enemy.takeDamage === 'function') {
                                        const actualDmg = enemy.takeDamage(this.damage, this.tower);
                                        if (this.tower) {
                                            this.tower.damageDealt += actualDmg;
                                        }

                                        if (enemy.hp <= 0 && this.tower && !enemy.deadMarked) {
                                            enemy.deadMarked = true;
                                            this.tower.kills++;
                                            this.processKill();
                                        }
                                    }
                                }
                            }

                            if (this.isCluster) {
                                const spec = TowerData['Bomb'].specializations['cluster'];
                                const clusterCount = this.tower && this.tower.masteryUnlocked ? spec.values!.masteryClusters : spec.values!.normalClusters;
                                for (let i = 0; i < clusterCount; i++) {
                                    const miniEnemy = nearby[Math.floor(Math.random() * nearby.length)] || this.target;
                                    if (miniEnemy) {
                                        const mx = this.x + (Math.random() - 0.5) * 80;
                                        const my = this.y + (Math.random() - 0.5) * 80;
                                        const miniProj = PoolManager.getProjectile(mx, my, miniEnemy, this.damage * 0.4, this.tower, this.aoeRadius * 0.4, this.speed);
                                        miniProj.trailX[0] = this.x;
                                        miniProj.trailY[0] = this.y;
                                        miniProj.trailHead = 1;
                                        miniProj.trailCount = 1;

                                        if (!state.projectileEvents) state.projectileEvents = [];
                                        state.projectileEvents.push({
                                            type: 'projectile',
                                            col: this.tower ? this.tower.col : -1,
                                            row: this.tower ? this.tower.row : -1,
                                            targetId: (miniEnemy as any).id || null,
                                            damage: this.damage * 0.4,
                                            aoeRadius: this.aoeRadius * 0.4,
                                            projectileSpeed: this.speed,
                                            isHoming: false,
                                            startX: mx,
                                            startY: my,
                                            trail: [{ x: this.x, y: this.y }]
                                        });
                                    }
                                }
                            }
                        }
                    } else {
                        // VISUAL COMPONENTS: Executed by ALL clients and host
                        const targetEnemy = this.target as any;
                        const canSpawnParticles = !targetEnemy || 
                            (targetEnemy.lastDamageParticleTime === undefined) ||
                            (state.animTime - targetEnemy.lastDamageParticleTime >= 6);

                        if (canSpawnParticles) {
                            const explosionColor = this.tower && this.tower.type === 'Sniper' ? '#a0d8ef' : '#fca311';
                            createExplosion(this.x, this.y, explosionColor, 2);
                            if (targetEnemy && targetEnemy.lastDamageParticleTime !== undefined) {
                                targetEnemy.lastDamageParticleTime = state.animTime;
                            }
                        }
                        if (targetEnemy && 'flashTime' in targetEnemy) {
                            targetEnemy.flashTime = 5;
                        }

                        // LOGICAL STATE: Strictly host-isolated
                        if (state.isHost && this.target) {
                            const targetEnemy = this.target as Enemy;
                            if (targetEnemy && typeof targetEnemy.takeDamage === 'function') {
                                const actualDmg = targetEnemy.takeDamage(this.damage, this.tower);
                                if (this.tower) {
                                    this.tower.damageDealt += actualDmg;
                                }
                                if (targetEnemy.hp <= 0 && this.tower && !targetEnemy.deadMarked) {
                                    targetEnemy.deadMarked = true;
                                    this.tower.kills++;
                                    this.processKill();
                                }
                            }

                            if (this.bounceCount > 0) {
                                this.hitEnemies.push(targetEnemy);
                                const nearby = this.getNearbyEnemies();
                                let bestDistSq = 150 * 150;
                                let nextTarget = null;
                                for (let i = 0; i < nearby.length; i++) {
                                    const enemy = nearby[i];
                                    if (enemy.hp > 0 && !this.hitEnemies.includes(enemy)) {
                                        const dSq = getDistanceSq(enemy.x, enemy.y, this.x, this.y);
                                        if (dSq < bestDistSq) {
                                            bestDistSq = dSq;
                                            nextTarget = enemy;
                                        }
                                    }
                                }
                                if (nextTarget) {
                                    const nextProj = PoolManager.getProjectile(this.x, this.y, nextTarget, this.damage, this.tower, 0, this.speed, this.bounceCount - 1);
                                    nextProj.hitEnemies = [...this.hitEnemies];
                                    nextProj.trailX.set(this.trailX);
                                    nextProj.trailY.set(this.trailY);
                                    nextProj.trailHead = this.trailHead;
                                    nextProj.trailCount = this.trailCount;

                                    if (!state.projectileEvents) state.projectileEvents = [];
                                    state.projectileEvents.push({
                                        type: 'projectile',
                                        col: this.tower ? this.tower.col : -1,
                                        row: this.tower ? this.tower.row : -1,
                                        targetId: nextTarget.id,
                                        damage: this.damage,
                                        aoeRadius: 0,
                                        projectileSpeed: this.speed,
                                        isHoming: false,
                                        startX: this.x,
                                        startY: this.y,
                                        trail: this.getTrailArray()
                                    });
                                }
                            }
                        }
                    }
                    this.active = false;
                } else {
                    this.angle = Math.atan2(dy, dx);
                    this.x += (dx / distance) * this.speed;
                    this.y += (dy / distance) * this.speed;
                }
            }
        }

        if (this.pixiSprite) {
            if (!this.active && this.trailCount === 0) {
                inactivePoolContainer.addChild(this.pixiSprite);
            } else {
                this.pixiSprite.visible = true;
                this.redrawTrail();
                if (this.bodyGraphics) {
                    this.bodyGraphics.visible = this.active;
                    this.bodyGraphics.x = this.x;
                    this.bodyGraphics.y = this.y;
                    this.bodyGraphics.rotation = this.angle;
                }
            }
        }
    }
}
