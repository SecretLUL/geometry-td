/*
 * @file: frontend/src/js/entities/towers/prisma-tower.ts
 * @purpose: High-tier focusing defense utilizing continuous locking beams, structural meltdowns, and ray refraction to melt targets.
 * @dependencies: config, state, fx, base-tower, utils, types, pool
 * @last_update: 2026-05-29 / v2.1.0 - Redesigned Level 20 Mastery visuals with levitating crystal shards, light focusing traces, and counter-rotating rings.
 */
import { Config, TowerData, TowerBalancer } from '../../core/config';
import { state } from '../../core/state';
import { createExplosion } from '../../fx/fx';
import { Tower } from './base-tower';
import { getDistanceSq } from '../../core/utils';
import { Enemy, TowerSpecialization } from '../../types';
import { PoolManager } from '../../core/pool';
import * as PIXI from 'pixi.js';
import { app, entitiesContainer } from '../../core/game/viewport';

export class PrismaTower extends Tower {
    public lockTimer: number;
    public beamTarget: Enemy | null;
    public pixiBeamsGraphics?: PIXI.Graphics;

    constructor(col: number, row: number) {
        super(col, row);
        this.type = 'Prisma';
        const data = TowerData['Prisma'];
        this.range = data.baseRange;
        this.damage = data.baseDamage;
        this.fireRate = data.baseFireRate;
        this.totalSpent = data.baseCost;
        this.upgradeCost = data.baseCost * 2;
        
        this.colors = data.colors;
        this.currentColor = this.colors[0];
        
        this.lockTimer = 0;
        this.beamTarget = null;

        this.constructionDuration = 240; // 3x slower: 4.0s at 60 FPS
        this.constructionTimer = this.constructionDuration;

        if (typeof window !== 'undefined' && app && app.renderer) {
            this.pixiBeamsGraphics = new PIXI.Graphics();
            entitiesContainer.addChild(this.pixiBeamsGraphics);
        }

        this.redrawPixiBase();
        this.redrawPixiTurret();
    }

    public override upgrade(updateUICallback?: () => void): boolean {
        if (this.level >= Config.TOWER_MAX_LEVEL) return false;
        if (state.infiniteGold || state.gold >= this.upgradeCost) {
            if (!state.infiniteGold) state.gold -= this.upgradeCost;
            this.totalSpent += this.upgradeCost;
            this.level++;

            const data = TowerData['Prisma'];
            this.damage += data.damagePerLevel;
            this.range += data.rangePerLevel;

            this.currentColor = this.colors[Math.min(this.level - 1, this.colors.length - 1)];
            
            this.upgradeCost = TowerBalancer.getUpgradeCost(this.type, this.level, this.upgradeCost);

            PoolManager.getFloatingText(this.x, this.y - 20, `Level ${this.level}!`, '#ffea00');
            createExplosion(this.x, this.y, this.currentColor, 10);
            
            if (this.level === Config.TOWER_MASTERY_LEVEL) {
                this.masteryUnlocked = true;
                PoolManager.getFloatingText(this.x, this.y - 40, `MASTERY UNLOCKED!`, '#ffd700');
            }
            
            this.redrawPixiBase();
            this.redrawPixiTurret();

            if (updateUICallback) updateUICallback();
            return true;
        }
        return false;
    }

    public override update(): void {
        if (this.constructionTimer > 0) {
            super.update();
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            this.target = null;
            this.lockTimer = 0;
            this.beamTarget = null;
            this.updatePixi();
            return;
        }
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.missileCooldown > 0) this.missileCooldown--;

        const rangeSq = this.range * this.range;
        const needsTarget = !this.target || 
                            this.target.hp <= 0 || 
                            this.target.deadMarked || 
                            getDistanceSq(this.target.x, this.target.y, this.x, this.y) > rangeSq ||
                            !state.enemies.includes(this.target);

        if (needsTarget) {
            if (this.target) {
                this.target = null;
                this.beamTarget = null;
                this.lockTimer = 0;
                this.fireCooldown = 30;
            } else if (this.fireCooldown <= 0) {
                this.target = this.findOptimalTarget();
            }
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
        }

        this._acquireAndFire();
        this.updatePixi();
    }

    public override updatePixi(): void {
        super.updatePixi();
        if (this.pixiBeamsGraphics) {
            this.pixiBeamsGraphics.clear();
            this.drawBeams(this.pixiBeamsGraphics);
        }
        // Rotate turret graphics locally here since Prisma has constant rotation
        // Actually, BaseTower sets rotation = angle. Prisma draws a spinning crystal in drawPixi, which needs re-drawing to animate!
        // So we need to redraw the turret every frame in PixiJS if we want spinning.
        if (this.constructionTimer <= 0) {
            this.redrawPixiBase(); // For spinning charging ring
            this.redrawPixiTurret();
        }
    }

    public override findOptimalTarget(): Enemy | null {
        const rangeSq = this.range * this.range;
        const nearby = this.getNearbyEnemies(this.x, this.y, this.range);
        
        let bestEnemy: Enemy | null = null;
        const checked = new Set<number>();

        for (let i = 0; i < nearby.length; i++) {
            const enemy = nearby[i];
            if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
            
            if (checked.has(enemy.id)) continue;
            checked.add(enemy.id);

            const distSq = getDistanceSq(enemy.x, enemy.y, this.x, this.y);
            if (distSq > rangeSq) continue;

            if (!bestEnemy) {
                bestEnemy = enemy;
                continue;
            }

            if (enemy.hp > bestEnemy.hp) {
                bestEnemy = enemy;
            } else if (enemy.hp === bestEnemy.hp) {
                if (enemy.distanceTravelled < bestEnemy.distanceTravelled) {
                    bestEnemy = enemy;
                }
            }
        }
        
        return bestEnemy;
    }

    public override getSpecializationInfo(specId: TowerSpecialization, isMastery = false): string {
        const spec = TowerData[this.type].specializations[specId];
        if (!spec) return 'Keine';
        return isMastery ? spec.masteryDesc : spec.desc;
    }

    public override getSpecializations(): { id: TowerSpecialization; name: string; desc: string }[] {
        const specs = TowerData[this.type].specializations;
        return Object.keys(specs).map(key => ({
            id: key as TowerSpecialization,
            name: specs[key].name,
            desc: specs[key].desc
        }));
    }

    public override getDisplayDamage(): string {
        let baseDps = this.damage * 60;
        const data = TowerData['Prisma'];
        const minDps = Math.floor(baseDps * data.prismaMinMultiplier!);
        const maxDps = Math.floor(baseDps * data.prismaMaxMultiplier!);
        return `${minDps}-${maxDps}`;
    }

    public override getDisplayFireRate(): string {
        return "CONT";
    }

    public override drawPixi(g: PIXI.Graphics, part: 'base' | 'turret'): void {
        const TS = Config.TILE_SIZE;
        let scale = 1;
        let progress = 0;

        if (this.constructionTimer > 0) {
            progress = 1 - (this.constructionTimer / this.constructionDuration);
            const c1 = 1.70158;
            const c3 = c1 + 1;
            scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

            if (part === 'base') {
                const hueVal = (state.animTime + progress * 360) % 360;
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: `hsl(${hueVal}, 100%, 65%)`, alpha: 0.3, width: 6 });
                
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: `hsl(${hueVal}, 100%, 65%)`, alpha: 1, width: 3 });
            }
        }

        if (part === 'base') {
            let baseColor = this.currentColor;
            if (this.specialization) {
                const spec = TowerData[this.type].specializations[this.specialization];
                if (spec) baseColor = spec.color;
            }

            const baseR = (TS / 2 - 4) * scale;
            const rotateOffset = this.constructionTimer > 0 ? (1 - progress) * Math.PI * 2 : 0;
            
            if (this.masteryUnlocked && this.constructionTimer <= 0) {
                // REDESIGN: Heavy Triangular Mastery Platform with Circuit Traces
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i - Math.PI / 6;
                    const px = Math.cos(angle) * baseR;
                    const py = Math.sin(angle) * baseR;
                    if (i === 0) g.moveTo(px, py);
                    else g.lineTo(px, py);
                }
                g.closePath();
                g.fill({ color: baseColor });

                // Neon inner circuit triangle
                const innerR = baseR * 0.7;
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i - Math.PI / 6;
                    const px = Math.cos(angle) * innerR;
                    const py = Math.sin(angle) * innerR;
                    if (i === 0) g.moveTo(px, py);
                    else g.lineTo(px, py);
                }
                g.closePath();
                g.stroke({ color: 0xffffff, alpha: 0.35, width: 1.5 * scale });

                const timeVal = state.animTime;

                // 3 Levitating Focus Shards hovering at the corners (calibrated speed)
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i - Math.PI / 6;
                    const bob = Math.sin(timeVal * 0.004 + i * Math.PI * 2 / 3) * 2.5 * scale;
                    const dist = baseR + 5 * scale + bob;
                    const sx = Math.cos(angle) * dist;
                    const sy = Math.sin(angle) * dist;
                    
                    const shardSize = 3.5 * scale;
                    g.moveTo(sx, sy - shardSize)
                     .lineTo(sx + shardSize, sy)
                     .lineTo(sx, sy + shardSize)
                     .lineTo(sx - shardSize, sy)
                     .closePath()
                     .fill({ color: baseColor })
                     .stroke({ color: 0xffffff, width: 1 * scale });
                }

                // Central Glowing Reactor Containment Pool (calibrated speed)
                const pulseSize = (TS / 4 + Math.sin(timeVal * 0.003) * 1.5) * scale;
                g.circle(0, 0, pulseSize).fill({ color: baseColor, alpha: 0.15 });
                g.circle(0, 0, pulseSize).stroke({ color: baseColor, alpha: 0.4, width: 1 });
                g.circle(0, 0, pulseSize * 0.6).fill({ color: '#ffffff', alpha: 0.25 });

                // Counter-Rotating Calibration Rings
                const r1 = TS / 3 * scale;
                const r2 = (TS / 3 + 3.5) * scale;
                const spin1 = timeVal * 0.0003;
                const spin2 = -timeVal * 0.0004;

                // Ring 1 (Dashed arcs)
                for (let j = 0; j < 4; j++) {
                    const aStart = spin1 + (j * Math.PI / 2);
                    const aEnd = aStart + Math.PI / 4;
                    g.moveTo(Math.cos(aStart) * r1, Math.sin(aStart) * r1);
                    g.arc(0, 0, r1, aStart, aEnd);
                }
                g.stroke({ color: baseColor, alpha: 0.6, width: 1 });

                // Ring 2 (Dashed arcs)
                for (let j = 0; j < 4; j++) {
                    const aStart = spin2 + (j * Math.PI / 2);
                    const aEnd = aStart + Math.PI / 5;
                    g.moveTo(Math.cos(aStart) * r2, Math.sin(aStart) * r2);
                    g.arc(0, 0, r2, aStart, aEnd);
                }
                g.stroke({ color: 0xffffff, alpha: 0.45, width: 0.8 });

            } else {
                // Standard triangular base
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i - Math.PI / 6 + rotateOffset;
                    const px = Math.cos(angle) * baseR;
                    const py = Math.sin(angle) * baseR;
                    if (i === 0) g.moveTo(px, py);
                    else g.lineTo(px, py);
                }
                g.closePath();
                
                g.fill({ color: baseColor });
                
                for (let i = 0; i < 3; i++) {
                    const angle = (Math.PI * 2 / 3) * i - Math.PI / 6 + rotateOffset;
                    const px = Math.cos(angle) * baseR;
                    const py = Math.sin(angle) * baseR;
                    if (i === 0) g.moveTo(px, py);
                    else g.lineTo(px, py);
                }
                g.closePath();
                g.stroke({ color: 0xffffff, alpha: 0.2, width: 1.5 });

                // Spinning base charging ring
                const time = state.animTime * 0.003;
                g.rotation = -time;
                const ringPath = new PIXI.GraphicsPath();
                ringPath.arc(0, 0, TS / 3 * scale, 0, Math.PI * 2);
                const segments = 12;
                for(let i=0; i<segments; i++) {
                    if(i % 2 === 0) {
                        const a1 = (i / segments) * Math.PI * 2;
                        const a2 = ((i+1) / segments) * Math.PI * 2;
                        g.moveTo(Math.cos(a1) * TS/3 * scale, Math.sin(a1) * TS/3 * scale);
                        g.arc(0, 0, TS/3 * scale, a1, a2);
                    }
                }
                g.stroke({ color: baseColor, width: 1 });
                g.rotation = 0; // reset
            }
            
            // Level indicator
            if (this.level > 1 && this.pixiLevelText) {
                const badgeX = (TS / 2 - 11) * scale;
                const badgeY = (TS / 2 - 11) * scale;
                const size = 9.5 * scale;

                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const hx = badgeX + size * Math.cos(angle);
                    const hy = badgeY + size * Math.sin(angle);
                    if (i === 0) g.moveTo(hx, hy);
                    else g.lineTo(hx, hy);
                }
                g.closePath();

                g.fill({ color: '#0f172a', alpha: 0.85 });
                
                let borderColor = '#ffd700';
                if (this.specialization === 'meltdown') borderColor = '#e65f00';
                if (this.specialization === 'refraction') borderColor = '#00e699';

                for (let i = 0; i < 6; i++) {
                    const angle = (Math.PI / 3) * i - Math.PI / 6;
                    const hx = badgeX + size * Math.cos(angle);
                    const hy = badgeY + size * Math.sin(angle);
                    if (i === 0) g.moveTo(hx, hy);
                    else g.lineTo(hx, hy);
                }
                g.closePath();
                g.stroke({ color: borderColor, width: 1.5 });

                this.pixiLevelText.text = this.level.toString();
                this.pixiLevelText.position.set(badgeX, badgeY);
                this.pixiLevelText.style.fill = borderColor;
                this.pixiLevelText.visible = true;
            } else if (this.pixiLevelText) {
                this.pixiLevelText.visible = false;
            }
        }

        if (part === 'turret') {
            const prismR = 10 * scale;

            if (this.masteryUnlocked && this.constructionTimer <= 0) {
                // REDESIGN: Levitating Cluster of Highly Polished Shards/Crystals
                const isFiring = this.target && state.enemies.includes(this.target) && this.target.hp > 0;
                const timeVal = state.animTime;
                
                // Spin faster if actively firing! (calibrated speed)
                const rotSpeed = isFiring ? timeVal * 0.0035 : timeVal * 0.001;
                
                g.rotation = this.angle; // Base turret rotation tracks the enemy target

                // 1. Primary Central focus crystal (pulsing core - calibrated speed)
                const corePulse = 1.0 + 0.15 * Math.sin(timeVal * 0.005);
                const cR = prismR * 1.15 * corePulse;

                g.moveTo(cR * 1.3, 0)
                 .lineTo(-cR * 0.7, cR * 0.8)
                 .lineTo(-cR * 0.4, 0)
                 .lineTo(-cR * 0.7, -cR * 0.8)
                 .closePath()
                 .fill({ color: this.currentColor, alpha: 0.95 })
                 .stroke({ color: 0xffffff, width: 1.5 * scale });
                 
                // White inner diamond glow
                g.moveTo(cR * 0.8, 0)
                 .lineTo(-cR * 0.4, cR * 0.4)
                 .lineTo(-cR * 0.2, 0)
                 .lineTo(-cR * 0.4, -cR * 0.4)
                 .closePath()
                 .fill({ color: '#ffffff', alpha: 0.8 });

                // 2. Three orbiting satellite shards channeling light
                const orbitRadius = prismR * 1.7;
                for (let i = 0; i < 3; i++) {
                    const orbAngle = rotSpeed + (i * Math.PI * 2 / 3);
                    const ox = Math.cos(orbAngle) * orbitRadius;
                    const oy = Math.sin(orbAngle) * orbitRadius;
                    
                    const sSize = 3.5 * scale;
                    const shardRot = orbAngle + Math.PI; // shards point inward towards core
                    
                    g.moveTo(ox + Math.cos(shardRot) * sSize * 1.3, oy + Math.sin(shardRot) * sSize * 1.3)
                     .lineTo(ox + Math.cos(shardRot + 2) * sSize * 0.8, oy + Math.sin(shardRot + 2) * sSize * 0.8)
                     .lineTo(ox + Math.cos(shardRot + Math.PI) * sSize * 0.5, oy + Math.sin(shardRot + Math.PI) * sSize * 0.5)
                     .lineTo(ox + Math.cos(shardRot - 2) * sSize * 0.8, oy + Math.sin(shardRot - 2) * sSize * 0.8)
                     .closePath()
                     .fill({ color: this.currentColor, alpha: 0.85 })
                     .stroke({ color: 0xffffff, width: 1 * scale });
                     
                    // Connection laser trace lines from satellites to central core (calibrated speed)
                    const traceAlpha = isFiring ? 0.75 : 0.25 + 0.15 * Math.sin(timeVal * 0.003 + i * 2);
                    const traceWidth = isFiring ? 1.5 * scale : 0.8 * scale;
                    g.moveTo(ox, oy).lineTo(0, 0).stroke({ color: this.currentColor, alpha: traceAlpha, width: traceWidth });
                }

            } else {
                // Standard 2D prism diamond
                const crystalY = this.constructionTimer > 0 ? -20 * (1 - progress) : 0;
                const crystalAngle = this.constructionTimer > 0 
                    ? (1 - progress) * Math.PI * 8 
                    : 0;
                
                g.rotation = this.angle + crystalAngle;
                
                for(let step = 0; step < 2; step++) {
                    g.moveTo(prismR * 1.3, crystalY);
                    g.lineTo(-prismR * 0.7, crystalY + prismR * 0.8);
                    g.lineTo(-prismR * 0.4, crystalY);
                    g.lineTo(-prismR * 0.7, crystalY - prismR * 0.8);
                    g.closePath();
                    
                    if (step === 0) {
                        g.fill({ color: this.currentColor, alpha: 0.9 });
                    } else {
                        g.stroke({ color: 0xffffff, alpha: 1, width: 1 });
                    }
                }
            }
        }
    }

    private drawBeams(g: PIXI.Graphics): void {
        if (this.stunTimer > 0) return;

        let baseColor = this.currentColor;
        if (this.specialization) {
            const spec = TowerData[this.type].specializations[this.specialization];
            if (spec) baseColor = spec.color;
        }

        if (this.fireCooldown <= 0 && this.target && state.enemies.includes(this.target) && this.target.hp > 0) {
            const prismR = 10;
            const tipX = this.x + Math.cos(this.angle) * (prismR * 1.3);
            const tipY = this.y + Math.sin(this.angle) * (prismR * 1.3);
            this.drawLaserBeam(g, tipX, tipY, this.target, baseColor, this.lockTimer);
        }

        if (this.specialization === 'refraction') {
            const rangeSq = this.range * this.range;
            const nearby = this.getNearbyEnemies(this.x, this.y, this.range);
            let splits = 0;
            const maxSplits = this.masteryUnlocked ? 6 : 3;
            const checked = new Set<number>();

            for (let i = 0; i < nearby.length; i++) {
                const enemy = nearby[i];
                if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
                if (checked.has(enemy.id)) continue;
                checked.add(enemy.id);

                if (this.target && enemy === this.target) continue;
                if (getDistanceSq(enemy.x, enemy.y, this.x, this.y) <= rangeSq) {
                    this.drawLaserBeam(g, this.x, this.y, enemy, '#00ffcc', this.lockTimer * 0.7, true);
                    splits++;
                    if (splits >= maxSplits) break;
                }
            }
        }
    }

    private drawLaserBeam(
        g: PIXI.Graphics,
        x1: number,
        y1: number,
        target: Enemy,
        colorStr: string,
        lockTime: number,
        isSplit = false
    ): void {
        const x2 = target.x;
        const y2 = target.y;

        if (!state.isHost && !state.isPaused) {
            const enemy = target as any;
            if (state.animTime - (enemy.lastDamageParticleTime || 0) >= 6) {
                createExplosion(enemy.x, enemy.y, '#fca311', 2);
                enemy.lastDamageParticleTime = state.animTime;
            }
        }

        const progress = Math.min(1.0, lockTime / TowerData['Prisma'].prismaChargeFrames!);
        const widthMultiplier = isSplit ? 0.85 : (1.0 + progress * 2.0);

        const colorNum = parseInt(colorStr.replace('#', '0x'), 16);

        // Ambient outer glow
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ 
            color: colorNum, 
            alpha: isSplit ? 0.35 : (0.2 + progress * 0.2), 
            width: (isSplit ? 5 : 8) * widthMultiplier,
            cap: 'round'
        });

        // Inner laser
        g.moveTo(x1, y1).lineTo(x2, y2).stroke({ 
            color: 0xffffff, 
            alpha: 0.95, 
            width: (isSplit ? 1.4 : 1.8) * widthMultiplier,
            cap: 'round'
        });

        // Plasma Spiral
        if (!isSplit && progress > 0.25) {
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            
            if (len > 10) {
                const nx = -dy / len;
                const ny = dx / len;
                const steps = 24;
                const time = state.animTime * (0.01 + progress * 0.015);
                
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const px = x1 + dx * t;
                    const py = y1 + dy * t;
                    const waveAngle = t * Math.PI * 6 - time;
                    const amplitude = (8 + progress * 12) * Math.sin(t * Math.PI) * widthMultiplier;
                    const hx = px + nx * Math.cos(waveAngle) * amplitude;
                    const hy = py + ny * Math.cos(waveAngle) * amplitude;
                    
                    if (i === 0) g.moveTo(hx, hy);
                    else g.lineTo(hx, hy);
                }
                g.stroke({ color: colorNum, alpha: 0.4 + progress * 0.5, width: 1.0 + progress * 2.0 });
                
                if (progress > 0.6) {
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        const px = x1 + dx * t;
                        const py = y1 + dy * t;
                        const waveAngle = t * Math.PI * 6 - time;
                        const amplitude = (8 + progress * 12) * Math.sin(t * Math.PI) * widthMultiplier;
                        const hx = px + nx * Math.cos(waveAngle) * amplitude;
                        const hy = py + ny * Math.cos(waveAngle) * amplitude;
                        
                        if (i === 0) g.moveTo(hx, hy);
                        else g.lineTo(hx, hy);
                    }
                    g.stroke({ color: 0xffffff, alpha: 0.85, width: 0.6 + progress * 0.6 });
                }
            }
        }

        // Source muzzle flare
        if (!isSplit && progress > 0.1) {
            const flareR = (8 + progress * 15) * widthMultiplier;
            g.circle(x1, y1, flareR).fill({ color: colorNum, alpha: 0.4 });
            g.circle(x1, y1, flareR * 0.5).fill({ color: 0xffffff, alpha: 0.8 });
        }

        // Holographic Targeting Reticle
        const targetRadius = (isSplit ? 8 : (12 + progress * 24)) * widthMultiplier;

        // 1. Thin outer boundary ring (soft target outline)
        g.circle(x2, y2, targetRadius).stroke({ 
            color: colorNum, 
            alpha: isSplit ? 0.25 : (0.12 + progress * 0.18), 
            width: 1.0 
        });

        // 2. Concentric inner soft glow ring
        g.circle(x2, y2, targetRadius * 0.85).stroke({ 
            color: colorNum, 
            alpha: isSplit ? 0.35 : (0.2 + progress * 0.35), 
            width: 1.5 
        });

        // 3. Rotating Tech-HUD Arcs / Brackets
        if (!isSplit) {
            const rot = state.animTime * 0.04;
            const numArcs = 3;
            const arcAngle = (Math.PI * 2) / numArcs;
            const gap = 0.45; // Gap in radians between brackets
            
            for (let i = 0; i < numArcs; i++) {
                const startAngle = rot + i * arcAngle;
                const endAngle = startAngle + arcAngle - gap;
                const rArc = targetRadius * 1.05;
                
                // Draw rotating arc
                g.moveTo(x2 + Math.cos(startAngle) * rArc, y2 + Math.sin(startAngle) * rArc);
                g.arc(x2, y2, rArc, startAngle, endAngle);
            }
            g.stroke({ 
                color: colorNum, 
                alpha: 0.4 + progress * 0.5, 
                width: 2.0 
            });
        }

        // 4. Precision Crosshair Ticks (stops outside center to keep target visible)
        if (!isSplit && progress > 0.2) {
            const innerBound = targetRadius * 0.35;
            const outerBound = targetRadius * 0.7;
            const tickAlpha = 0.3 + progress * 0.5;
            const tickWidth = 1.2 * widthMultiplier;
            
            g.moveTo(x2 - outerBound, y2).lineTo(x2 - innerBound, y2)
             .moveTo(x2 + innerBound, y2).lineTo(x2 + outerBound, y2)
             .moveTo(x2, y2 - outerBound).lineTo(x2, y2 - innerBound)
             .moveTo(x2, y2 + innerBound).lineTo(x2, y2 + outerBound)
             .stroke({ color: 0xffffff, alpha: tickAlpha, width: tickWidth });
        }

        // 5. Shrinking Energy Pulse (dynamic focusing effect)
        if (!isSplit && progress > 0.1) {
            const pulseProgress = (state.animTime * 0.02) % 1.0;
            const pulseRadius = targetRadius * (1.0 - pulseProgress);
            g.circle(x2, y2, pulseRadius).stroke({ 
                color: colorNum, 
                alpha: (1.0 - pulseProgress) * (0.35 + progress * 0.45), 
                width: 1.5 
            });
        }

        // 6. Central Precision Core (very small, semi-transparent focal point)
        const coreRadius = Math.max(3, targetRadius * 0.15);
        g.circle(x2, y2, coreRadius).fill({ color: 0xffffff, alpha: 0.35 + progress * 0.35 });
        g.circle(x2, y2, coreRadius).stroke({ color: colorNum, alpha: 0.5 + progress * 0.3, width: 1.0 });

        if (!isSplit && progress > 0.4) {
            const flareSize = 16 * progress * widthMultiplier;
            g.moveTo(x2 - flareSize, y2).lineTo(x2 + flareSize, y2)
             .moveTo(x2, y2 - flareSize).lineTo(x2, y2 + flareSize)
             .stroke({ color: 0xffffff, alpha: 0.6 * progress, width: 1.0 * widthMultiplier });
        }

        const sparkCount = isSplit ? 1 : Math.floor(1 + progress * 4);
        for (let i = 0; i < sparkCount; i++) {
            const sparkR = (isSplit ? 3 : (4 + Math.random() * 4)) * widthMultiplier;
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (isSplit ? 4 : (8 + progress * 15));
            const sx = x2 + Math.cos(angle) * dist;
            const sy = y2 + Math.sin(angle) * dist;
            g.circle(sx, sy, sparkR).fill({ color: colorNum });
        }
    }

    public triggerMeltdown(target: Enemy): void {
        if ((target as any).meltdownExploded) return;
        (target as any).meltdownExploded = true;
        
        const spec = TowerData[this.type].specializations['meltdown'];
        const aoeRadius = this.masteryUnlocked ? spec.values!.masteryRadius : spec.values!.normalRadius;
        const aoeDmg = this.masteryUnlocked ? spec.values!.masteryDmg : spec.values!.normalDmg;
        
        const radiusSq = aoeRadius * aoeRadius;
        const nearby = this.getNearbyEnemies(target.x, target.y, aoeRadius);
        const checked = new Set<number>();
        
        for (let i = 0; i < nearby.length; i++) {
            const enemy = nearby[i];
            if (!enemy || enemy === target || enemy.hp <= 0 || enemy.deadMarked) continue;
            if (checked.has(enemy.id)) continue;
            checked.add(enemy.id);
            
            if (getDistanceSq(enemy.x, enemy.y, target.x, target.y) > radiusSq) continue;
            
            const actualDmg = enemy.takeDamage(aoeDmg, this);
            this.damageDealt += actualDmg;
            if (enemy.hp <= 0) {
                (enemy as any).meltdownExploded = true;
                if (!enemy.deadMarked) {
                    enemy.deadMarked = true;
                    this.kills++;
                }
            }
        }
        
        PoolManager.getShockwave(target.x, target.y, aoeRadius, '#ff4500');
        
        createExplosion(target.x, target.y, '#ff4500', 20);
        createExplosion(target.x, target.y, '#ffd700', 10);
        
        PoolManager.getFloatingText(target.x, target.y - 15, "MELTDOWN!", "#ff4500");
    }

    public override _acquireAndFire(): void {
        if (this.specialization === 'refraction') {
            const data = TowerData['Prisma'];
            const progress = Math.min(1.0, this.lockTimer / data.prismaChargeFrames!);
            const multiplier = data.prismaMinMultiplier! + (data.prismaMaxMultiplier! - data.prismaMinMultiplier!) * (progress * progress);
            const finalDmg = this.damage * multiplier;

            const rangeSq = this.range * this.range;
            const nearby = this.getNearbyEnemies(this.x, this.y, this.range);
            let splits = 0;
            const spec = TowerData[this.type].specializations['refraction'];
            const maxSplits = this.masteryUnlocked ? spec.values!.masterySplits : spec.values!.normalSplits;
            
            const checked = new Set<number>();

            for (let i = 0; i < nearby.length; i++) {
                const enemy = nearby[i];
                if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
                if (checked.has(enemy.id)) continue;
                checked.add(enemy.id);

                if (this.target && enemy === this.target) continue;

                if (getDistanceSq(enemy.x, enemy.y, this.x, this.y) <= rangeSq) {
                    const actualDmg = enemy.takeDamage(finalDmg * spec.values!.damageMultiplier, this);
                    this.damageDealt += actualDmg;
                    
                    if (enemy.hp <= 0 && !enemy.deadMarked) {
                        enemy.deadMarked = true;
                        this.kills++;
                    }
                    
                    splits++;
                    if (splits >= maxSplits) break;
                }
            }
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);

            if (this.target === this.beamTarget) {
                this.lockTimer++;
            } else {
                this.beamTarget = this.target;
                this.lockTimer = 0;
                this.fireCooldown = 15;
            }

            if (this.fireCooldown > 0) {
                return;
            }

            const data = TowerData['Prisma'];
            const progress = Math.min(1.0, this.lockTimer / data.prismaChargeFrames!);
            const multiplier = data.prismaMinMultiplier! + (data.prismaMaxMultiplier! - data.prismaMinMultiplier!) * (progress * progress);
            const finalDmg = this.damage * multiplier;

            const actualDmg = this.target.takeDamage(finalDmg, this);
            this.damageDealt += actualDmg;

            const isTargetDying = this.target.hp <= 0 || this.target.deadMarked;
            if (this.specialization === 'meltdown' && isTargetDying) {
                this.triggerMeltdown(this.target);
            }

            if (isTargetDying) {
                if (!this.target.deadMarked) {
                    this.target.deadMarked = true;
                    this.kills++;
                }
                this.lockTimer = 0;
                this.beamTarget = null;
            }
        } else {
            this.lockTimer = 0;
            this.beamTarget = null;
        }
    }
}
