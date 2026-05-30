/*
 * @file: frontend\src\js\entities\enemies\base.ts
 * @purpose: Implementation of the abstract BaseEnemy class managing coordinates, flashing visual cues, stun conditions, and path traversing.
 * @dependencies: config, state, map, fx, utils, types
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
 * @last_update: 2026-05-22 / v1.0.0 - Created base.ts as part of enemies.ts split.
 */
import { Config } from '../../core/config';
import { state } from '../../core/state';
import { waypoints } from '../../core/map';
import { createExplosion } from '../../fx/fx';
import { getDistance } from '../../core/utils';
import { Enemy, EnemyType } from '../../types';
import { app, entitiesContainer } from '../../core/game/viewport';
import * as PIXI from 'pixi.js';

export class BaseEnemy implements Enemy {
    public id!: number;
    public x: number;
    public y: number;
    public targetWaypointIndex: number;
    public distanceTravelled: number;
    public flashTime: number;
    public pulseTime: number;
    public rotation: number;
    public deadMarked: boolean;
    public waveNumber: number;

    public typeName: EnemyType;
    public radius: number;
    public color: string;
    public speed: number;
    public maxHp: number;
    public hp!: number;
    public reward: number;
    public shieldActive: boolean;
    public stunTimer: number;
    public stunCooldown: number;
    public hideHealthBar?: boolean;
    public lastDamageParticleTime: number;
    public damageSources: Map<any, number>;
    public spawnFrames?: number;

    // Optional traits used by subclasses
    public healTimer?: number;
    public abilityTimer?: number;
    public nextAbility?: 'spawn' | 'stun';
    public outerRotation?: number;
    public stunRange?: number;
    public specialAbility?: string;
    public maxShieldHp?: number;
    public shieldHp?: number;
    public regenTimer?: number;
    public swarmGroupId?: number;
    public needsRedraw: boolean = true;

    public pixiSprite?: PIXI.Container;
    public bodyGraphics?: PIXI.Graphics;
    public flashGraphics?: PIXI.Graphics;
    public hpGraphics?: PIXI.Graphics; // Used as background
    public hpFillGraphics?: PIXI.Graphics; // Used for dynamic scaling
    public shieldGraphics?: PIXI.Graphics;

    constructor(waveNumber: number) {
        this.x = waypoints.length > 0 ? waypoints[0].x : 0;
        this.y = waypoints.length > 0 ? waypoints[0].y : 0;
        this.targetWaypointIndex = 1;
        this.distanceTravelled = 0;
        this.flashTime = 0;
        this.pulseTime = 0;
        this.rotation = 0;
        this.deadMarked = false;
        this.waveNumber = waveNumber;
        this.spawnFrames = 0;

        this.typeName = 'Base';
        this.radius = 12;
        this.color = '#fff';
        this.speed = 1;
        this.maxHp = 10;
        this.reward = 1;
        this.shieldActive = false;
        this.stunTimer = 0;
        this.stunCooldown = 0;
        this.lastDamageParticleTime = 0;
        this.damageSources = new Map();

        this.initPixi();
    }

    public initPixi(): void {
        if (typeof window === 'undefined' || !app || !app.renderer) return;
        if (!this.pixiSprite) {
            this.pixiSprite = new PIXI.Container();
            this.bodyGraphics = new PIXI.Graphics();
            this.flashGraphics = new PIXI.Graphics();
            this.hpGraphics = new PIXI.Graphics();
            this.hpFillGraphics = new PIXI.Graphics();
            
            this.pixiSprite.addChild(this.bodyGraphics);
            this.pixiSprite.addChild(this.flashGraphics);
            this.pixiSprite.addChild(this.hpGraphics);
            this.pixiSprite.addChild(this.hpFillGraphics);
            
            if (this.shieldActive) {
                this.shieldGraphics = new PIXI.Graphics();
                this.pixiSprite.addChild(this.shieldGraphics);
            }
        }
        entitiesContainer.addChild(this.pixiSprite);
        this.needsRedraw = true;
        this.pixiSprite.visible = true;
    }

    public initHp(): void {
        this.hp = this.maxHp;
    }

    public takeDamage(amount: number, source?: any): number {
        if (this.shieldActive) {
            this.shieldActive = false;
            createExplosion(this.x, this.y, '#00ffff', 5);
            return 0;
        }
        const actualDmg = Math.min(amount, Math.max(0, this.hp));
        this.hp -= amount;
        this.flashTime = 5;

        if (source) {
            const current = this.damageSources.get(source) || 0;
            this.damageSources.set(source, current + actualDmg);
        }

        // Cooldown of 6 frames (approx 100ms) for standard damage particles to avoid visual clutter
        if (state.animTime - this.lastDamageParticleTime >= 6) {
            createExplosion(this.x, this.y, '#fca311', 2);
            this.lastDamageParticleTime = state.animTime;
        }
        return actualDmg;
    }

    public drawShape(g: PIXI.Graphics): void {
        g.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2).fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });
    }

    public updatePixi(): void {
        if (!this.pixiSprite || !this.bodyGraphics || !this.hpGraphics) return;

        if (this.needsRedraw) {
            this.bodyGraphics.clear();
            const originalFlashTime = this.flashTime;
            
            // Draw normal color
            this.flashTime = 0;
            this.drawShape(this.bodyGraphics);

            // Draw flash white
            if (this.flashGraphics) {
                this.flashTime = 1;
                this.flashGraphics.clear();
                this.drawShape(this.flashGraphics);
            }

            this.flashTime = originalFlashTime;

            // Draw HP background once
            this.hpGraphics.clear();
            if (!this.hideHealthBar) {
                this.hpGraphics.rect(-15, -this.radius - 8, 30, 4).fill({ color: 0xff0000 });
            }

            // Draw HP fill once (drawn at 0,0, positioned relative)
            if (this.hpFillGraphics) {
                this.hpFillGraphics.clear();
                if (!this.hideHealthBar) {
                    this.hpFillGraphics.rect(0, 0, 30, 4).fill({ color: 0x00ff00 });
                    this.hpFillGraphics.position.set(-15, -this.radius - 8);
                }
            }

            // Draw shield once
            if (this.shieldActive && this.shieldGraphics) {
                this.shieldGraphics.clear();
                this.shieldGraphics.circle(0, 0, this.radius + 6).stroke({ color: 0x00ffff, width: 2 });
            }

            this.needsRedraw = false;
        }

        this.pixiSprite.position.set(this.x, this.y);

        if (this.speed > 0 && !state.isPaused) {
            this.pulseTime += 0.05 * this.speed;
        }

        let scale = 1;
        if (this.typeName === 'Regrower') {
            scale = 1 + Math.sin(this.pulseTime * 2) * 0.15;
        } else {
            if (!state.isPaused) {
                this.rotation += 0.02 * this.speed;
            }
            this.bodyGraphics.rotation = this.rotation;
            if (this.flashGraphics) this.flashGraphics.rotation = this.rotation;
        }

        if (!this.hideHealthBar && (this.typeName === 'DefragmenterFragment' || this.typeName === 'DefragmenterSubfragment')) {
            if (!state.isPaused) {
                this.spawnFrames = (this.spawnFrames ?? 0) + 1;
            }
            const duration = 20;
            const t = Math.min(1.0, (this.spawnFrames ?? 0) / duration);
            const easeScale = t === 1.0 ? 1.0 : t * t * (2.70158 * t - 1.70158) + 1;
            scale *= easeScale;
        }

        this.bodyGraphics.scale.set(scale);
        if (this.flashGraphics) this.flashGraphics.scale.set(scale);

        // Flash logic - toggle visibility
        if (this.flashTime > 0) {
            this.flashTime--;
            this.bodyGraphics.visible = false;
            if (this.flashGraphics) this.flashGraphics.visible = true;
        } else {
            this.bodyGraphics.visible = true;
            if (this.flashGraphics) this.flashGraphics.visible = false;
        }

        // Shield
        if (this.shieldActive) {
            if (!this.shieldGraphics) {
                this.shieldGraphics = new PIXI.Graphics();
                this.pixiSprite.addChild(this.shieldGraphics);
                this.needsRedraw = true; // Draw in next frame
            } else {
                this.shieldGraphics.visible = true;
            }
        } else if (this.shieldGraphics) {
            this.shieldGraphics.visible = false;
        }

        // HP Bar - update scale.x instead of redrawing
        if (!this.hideHealthBar && this.hpFillGraphics) {
            if (this.swarmGroupId) {
                // SwarmEnemy handles its own HP bar manually
                this.hpFillGraphics.visible = false;
            } else {
                this.hpFillGraphics.scale.x = Math.max(0, this.hp / this.maxHp);
                this.hpGraphics.visible = true;
                this.hpFillGraphics.visible = true;
            }
        } else {
            if (!this.swarmGroupId) this.hpGraphics.visible = false;
            if (this.hpFillGraphics) this.hpFillGraphics.visible = false;
        }
    }

    public draw(): void {}

    public update(): 'stunned' | 'reached_end' | 'moving' {
        if (this.stunCooldown > 0) this.stunCooldown--;

        if (this.stunTimer > 0) {
            this.stunTimer--;
            return 'stunned';
        }
        if (this.healTimer !== undefined) {
            this.healTimer--;
            if (this.healTimer <= 0) {
                if (this.hp < this.maxHp) {
                    this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.05);
                    createExplosion(this.x, this.y, '#00ff00', 2);
                }
                this.healTimer = 30;
            }
        }

        const target = waypoints[this.targetWaypointIndex];
        const distance = getDistance(this.x, this.y, target.x, target.y);
        const dx = target.x - this.x;
        const dy = target.y - this.y;

        if (distance < this.speed) {
            this.x = target.x;
            this.y = target.y;
            this.targetWaypointIndex++;
            if (this.targetWaypointIndex >= waypoints.length) {
                return 'reached_end';
            }
        } else {
            const moveX = (dx / distance) * this.speed;
            const moveY = (dy / distance) * this.speed;
            this.x += moveX;
            this.y += moveY;
            this.distanceTravelled += this.speed;
        }
        
        this.updatePixi();
        return 'moving';
    }

    public checkHover(mouseX: number, mouseY: number): boolean {
        return (Math.abs(mouseX - this.x) < this.radius + 5 && Math.abs(mouseY - this.y) < this.radius + 5);
    }
}
