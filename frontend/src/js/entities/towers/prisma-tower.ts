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
        this.upgradeCost = TowerBalancer.getUpgradeCost(this.type, 1, data.baseCost);
        
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

        if (!state.enemies || state.enemies.length === 0) {
            this.target = null;
            this.beamTarget = null;
            this.lockTimer = 0;
            this.updatePixi();
            return;
        }

        const rangeSq = this.getEffectiveRange() * this.getEffectiveRange();
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
        const effRange = this.getEffectiveRange();
        const rangeSq = effRange * effRange;
        const nearby = this.getNearbyEnemies(this.x, this.y, effRange);
        
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
        let baseDps = this.getEffectiveDamage() * 60;
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

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);

        // --- SPECIFIC VISUALS PER SPECIALIZATION ---
        const isMeltdown = this.specialization === 'meltdown' && !isSplit;
        const isRefraction = this.specialization === 'refraction' || isSplit;

        if (isRefraction && len > 5) {
            // Neon teal curve for Refraction splits & Refraction primary beam
            // Generate a stable control point based on enemy ID to avoid rapid chaotic shaking,
            // but add a tiny high-frequency crystal shimmer.
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            const nx = -dy / len;
            const ny = dx / len;

            // Stable offset determined by target.id
            const curveDirection = (target.id % 2 === 0) ? 1 : -1;
            const baseOffset = curveDirection * (len * 0.12);
            // Crystal micro-vibration (balanced speed)
            const shimmer = Math.sin(state.animTime * 0.02 + target.id) * 1.5;
            const finalOffset = baseOffset + shimmer;

            const cx = midX + nx * finalOffset;
            const cy = midY + ny * finalOffset;

            // Draw refraction laser core layers
            // 1. Crystal Neon Aura
            const refractionColor = isSplit ? 0x00ffcc : 0x00e699;
            g.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({
                color: refractionColor,
                alpha: 0.15 + (isSplit ? 0.1 : progress * 0.15),
                width: (isSplit ? 7 : 11) * widthMultiplier,
                cap: 'round'
            });

            // 2. Middle laser body
            g.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({
                color: refractionColor,
                alpha: 0.5 + (isSplit ? 0.1 : progress * 0.25),
                width: (isSplit ? 3.5 : 5) * widthMultiplier,
                cap: 'round'
            });

            // 3. Ultra white core
            g.moveTo(x1, y1).quadraticCurveTo(cx, cy, x2, y2).stroke({
                color: 0xffffff,
                alpha: 0.95,
                width: (isSplit ? 1.2 : 1.6) * widthMultiplier,
                cap: 'round'
            });

            // Traveling Light Shards on Refraction curve (balanced speed)
            const numShards = isSplit ? 1 : 2;
            for (let s = 0; s < numShards; s++) {
                const t = ((state.animTime * (isSplit ? 0.002 : 0.003) + s / numShards)) % 1.0;
                // Quadratic Bezier interpolation: B(t) = (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
                const t1 = 1 - t;
                const bx = t1 * t1 * x1 + 2 * t1 * t * cx + t * t * x2;
                const by = t1 * t1 * y1 + 2 * t1 * t * cy + t * t * y2;

                // Draw small diamond shard
                const shardSize = (isSplit ? 2.5 : 3.5) * widthMultiplier;
                g.moveTo(bx, by - shardSize)
                 .lineTo(bx + shardSize, by)
                 .lineTo(bx, by + shardSize)
                 .lineTo(bx - shardSize, by)
                 .closePath()
                 .fill({ color: 0xffffff, alpha: 0.85 })
                 .stroke({ color: refractionColor, width: 1 });
            }

        } else if (isMeltdown && len > 5) {
            // Raging Orange-Red Plasma Stream
            const nx = -dy / len;
            const ny = dx / len;

            // 1. Unstable plasma fire aura (wobbles in size and alpha - balanced)
            const heatPulse = 1.0 + 0.15 * Math.sin(state.animTime * 0.02);
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({
                color: colorNum,
                alpha: 0.25 + progress * 0.25,
                width: 14 * widthMultiplier * heatPulse,
                cap: 'round'
            });

            // 2. Yellow middle heat cylinder
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({
                color: 0xffcc00,
                alpha: 0.6 + progress * 0.3,
                width: 6.5 * widthMultiplier,
                cap: 'round'
            });

            // 3. Super hot white core
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({
                color: 0xffffff,
                alpha: 0.95,
                width: 2.2 * widthMultiplier,
                cap: 'round'
            });

            // 4. Crackling lightning arcs along the beam (balanced)
            const steps = 18;
            const time = state.animTime * 0.035;
            const maxOffset = (3.5 + progress * 7.5) * widthMultiplier;

            g.moveTo(x1, y1);
            for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const basePx = x1 + dx * t;
                const basePy = y1 + dy * t;
                
                // Jagged wave function using high-frequency sine/cos combination
                const noise = Math.sin(t * Math.PI * 8 - time) * Math.cos(t * Math.PI * 4 + time * 0.5);
                const offset = noise * maxOffset * Math.sin(t * Math.PI); // Pin to ends
                const hx = basePx + nx * offset;
                const hy = basePy + ny * offset;
                g.lineTo(hx, hy);
            }
            g.lineTo(x2, y2);
            g.stroke({
                color: 0xff6600,
                alpha: 0.55 + progress * 0.35,
                width: 1.2 + progress * 1.5,
                cap: 'round',
                join: 'round'
            });

            // White hot secondary thin arc inside the main arc for high charge (balanced)
            if (progress > 0.5) {
                g.moveTo(x1, y1);
                for (let i = 1; i < steps; i++) {
                    const t = i / steps;
                    const basePx = x1 + dx * t;
                    const basePy = y1 + dy * t;
                    
                    const noise = Math.cos(t * Math.PI * 10 + time * 1.1) * Math.sin(t * Math.PI * 5 - time * 0.7);
                    const offset = noise * maxOffset * 0.65 * Math.sin(t * Math.PI);
                    const hx = basePx + nx * offset;
                    const hy = basePy + ny * offset;
                    g.lineTo(hx, hy);
                }
                g.lineTo(x2, y2);
                g.stroke({
                    color: 0xffffff,
                    alpha: 0.75,
                    width: 0.7 + progress * 0.7,
                    cap: 'round',
                    join: 'round'
                });
            }

        } else {
            // --- Standard / Default gold/yellow laser beam ---
            // 1. Outer golden aura
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({
                color: colorNum,
                alpha: 0.18 + progress * 0.22,
                width: 10 * widthMultiplier,
                cap: 'round'
            });

            // 2. Middle yellow laser body
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({
                color: colorNum,
                alpha: 0.55 + progress * 0.25,
                width: 5 * widthMultiplier,
                cap: 'round'
            });

            // 3. Core white laser line
            g.moveTo(x1, y1).lineTo(x2, y2).stroke({
                color: 0xffffff,
                alpha: 0.95,
                width: 1.8 * widthMultiplier,
                cap: 'round'
            });

            // 4. Plasma Spiral wrapping around the core (balanced)
            if (progress > 0.2 && len > 10) {
                const nx = -dy / len;
                const ny = dx / len;
                const steps = 24;
                const time = state.animTime * (0.0015 + progress * 0.002);
                
                g.moveTo(x1, y1);
                for (let i = 0; i <= steps; i++) {
                    const t = i / steps;
                    const px = x1 + dx * t;
                    const py = y1 + dy * t;
                    const waveAngle = t * Math.PI * 6 - time;
                    const amplitude = (7 + progress * 10) * Math.sin(t * Math.PI) * widthMultiplier;
                    const hx = px + nx * Math.cos(waveAngle) * amplitude;
                    const hy = py + ny * Math.cos(waveAngle) * amplitude;
                    
                    if (i === 0) g.moveTo(hx, hy);
                    else g.lineTo(hx, hy);
                }
                g.stroke({
                    color: colorNum,
                    alpha: 0.45 + progress * 0.45,
                    width: 1.0 + progress * 1.5
                });
                
                if (progress > 0.55) {
                    g.moveTo(x1, y1);
                    for (let i = 0; i <= steps; i++) {
                        const t = i / steps;
                        const px = x1 + dx * t;
                        const py = y1 + dy * t;
                        const waveAngle = t * Math.PI * 6 - time;
                        const amplitude = (7 + progress * 10) * Math.sin(t * Math.PI) * widthMultiplier;
                        const hx = px + nx * Math.cos(waveAngle) * amplitude;
                        const hy = py + ny * Math.cos(waveAngle) * amplitude;
                        
                        if (i === 0) g.moveTo(hx, hy);
                        else g.lineTo(hx, hy);
                    }
                    g.stroke({
                        color: 0xffffff,
                        alpha: 0.75,
                        width: 0.6 + progress * 0.6
                    });
                }
            }

            // 5. Flowing energy nodes (Traveling golden rings/capsules - balanced)
            const numNodes = 3;
            for (let i = 0; i < numNodes; i++) {
                const t = ((state.animTime * 0.002) + i / numNodes) % 1.0;
                const px = x1 + dx * t;
                const py = y1 + dy * t;

                // Perpendicular tick representing energy capsule
                const nx = -dy / len;
                const ny = dx / len;
                const tickLen = 4 * widthMultiplier;

                g.moveTo(px - nx * tickLen, py - ny * tickLen)
                 .lineTo(px + nx * tickLen, py + ny * tickLen)
                 .stroke({
                     color: 0xffffff,
                     alpha: 0.8,
                     width: 2.0 * widthMultiplier,
                     cap: 'round'
                 });
            }
        }

        // --- MUZZLE FLARE (TOWER TIP EFFECTS) ---
        // REDESIGN: Scaled down and softened white flare so it doesn't cover the turret crystal.
        if (!isSplit && progress > 0.05) {
            const flareR = (4 + progress * 8) * Math.min(1.3, widthMultiplier);
            // Pulsing glow rings centered on muzzle (balanced)
            const ringCount = 2;
            for (let r = 0; r < ringCount; r++) {
                const pulseR = flareR * (0.5 + 0.5 * Math.sin(state.animTime * 0.015 + r * Math.PI));
                g.circle(x1, y1, pulseR).stroke({
                    color: colorNum,
                    alpha: 0.25 * (1 - pulseR / (flareR * 1.0)),
                    width: 1.0
                });
            }

            // Core glow
            g.circle(x1, y1, flareR * 0.75).fill({ color: colorNum, alpha: 0.25 });
            g.circle(x1, y1, Math.min(2.5, flareR * 0.3)).fill({ color: 0xffffff, alpha: 0.75 });
        }

        // --- HOLOGRAPHIC TARGETING RETICLE (HEXAGON HUD) ---
        const targetRadius = (isSplit ? 8 : (11 + progress * 22)) * widthMultiplier;

        // 1. Soft target outline circle
        g.circle(x2, y2, targetRadius).stroke({ 
            color: colorNum, 
            alpha: isSplit ? 0.2 : (0.1 + progress * 0.15), 
            width: 1.0 
        });

        // 2. Concentric inner glow ring
        g.circle(x2, y2, targetRadius * 0.82).stroke({ 
            color: colorNum, 
            alpha: isSplit ? 0.3 : (0.2 + progress * 0.3), 
            width: 1.2 
        });

        // 3. Rotating Hexagonal Visier (balanced)
        if (!isSplit) {
            const rot = state.animTime * 0.006;
            g.moveTo(x2 + targetRadius * Math.cos(rot), y2 + targetRadius * Math.sin(rot));
            for (let i = 1; i <= 6; i++) {
                const angle = rot + (i * Math.PI * 2 / 6);
                g.lineTo(x2 + targetRadius * Math.cos(angle), y2 + targetRadius * Math.sin(angle));
            }
            g.closePath();
            g.stroke({
                color: colorNum,
                alpha: 0.25 + progress * 0.35,
                width: 1.2
            });

            // Outer brackets on corners of Hexagon (balanced)
            const bracketRot = -state.animTime * 0.003;
            for (let i = 0; i < 3; i++) {
                const angle = bracketRot + (i * Math.PI * 2 / 3);
                const aStart = angle - 0.25;
                const aEnd = angle + 0.25;
                const bracketR = targetRadius * 1.2;

                g.moveTo(x2 + Math.cos(aStart) * bracketR, y2 + Math.sin(aStart) * bracketR);
                g.arc(x2, y2, bracketR, aStart, aEnd);
            }
            g.stroke({
                color: colorNum,
                alpha: 0.35 + progress * 0.45,
                width: 1.6
            });
        }

        // 4. Precision Crosshair Ticks (Horizontal & Vertical, stopping before center)
        if (!isSplit && progress > 0.15) {
            const innerBound = targetRadius * 0.3;
            const outerBound = targetRadius * 0.75;
            const tickAlpha = 0.25 + progress * 0.5;
            const tickWidth = 1.0 * widthMultiplier;
            
            g.moveTo(x2 - outerBound, y2).lineTo(x2 - innerBound, y2)
             .moveTo(x2 + innerBound, y2).lineTo(x2 + outerBound, y2)
             .moveTo(x2, y2 - outerBound).lineTo(x2, y2 - innerBound)
             .moveTo(x2, y2 + innerBound).lineTo(x2, y2 + outerBound)
             .stroke({ color: 0xffffff, alpha: tickAlpha, width: tickWidth });
        }

        // 5. Focusing Containment Funnel (expanding/contracting ring - balanced)
        if (!isSplit && progress > 0.05) {
            const pulseProgress = (state.animTime * 0.003) % 1.0;
            const pulseRadius = targetRadius * (1.1 - pulseProgress * 0.9);
            g.circle(x2, y2, pulseRadius).stroke({ 
                color: colorNum, 
                alpha: (1.0 - pulseProgress) * (0.35 + progress * 0.45), 
                width: 1.2 
            });
        }

        // 6. Central Precision Core & Star Lens Flare
        const coreRadius = Math.max(3.0, targetRadius * 0.15);
        g.circle(x2, y2, coreRadius).fill({ color: 0xffffff, alpha: 0.4 + progress * 0.4 });
        g.circle(x2, y2, coreRadius).stroke({ color: colorNum, alpha: 0.55 + progress * 0.35, width: 1.0 });

        if (!isSplit && progress > 0.35) {
            const flareSize = 14 * progress * widthMultiplier;
            const flareRot = state.animTime * 0.0015;
            
            // Draw diagonal cross flare
            for (let i = 0; i < 2; i++) {
                const angle = flareRot + (i * Math.PI / 2);
                g.moveTo(x2 - Math.cos(angle) * flareSize, y2 - Math.sin(angle) * flareSize)
                 .lineTo(x2 + Math.cos(angle) * flareSize, y2 + Math.sin(angle) * flareSize);
            }
            g.stroke({
                color: 0xffffff,
                alpha: 0.55 * progress,
                width: 1.0 * widthMultiplier
            });
        }

        // --- SPARK PARTICLES FADE OUT (balanced speed and Snappy 500ms lifetime) ---
        const sparkCount = isSplit ? 1 : Math.floor(2 + progress * 5);
        for (let i = 0; i < sparkCount; i++) {
            // Seeded randomness based on animTime, spark index and target ID to keep them moving but smooth
            const seed = state.animTime * 0.005 + i * 1.5 + target.id;
            const sparkR = (isSplit ? 2.5 : (3.5 + (Math.sin(seed * 2.3) * 0.5 + 0.5) * 3)) * widthMultiplier;
            const angle = seed * 3.7;
            const maxDist = isSplit ? 4 : (7 + progress * 16);
            
            // Snappy 500ms lifetime per spark cycle
            const lifetime = 500;
            const tElapsed = (state.animTime + i * (lifetime / sparkCount)) % lifetime;
            const dist = (tElapsed / lifetime) * maxDist;
            const sx = x2 + Math.cos(angle) * dist;
            const sy = y2 + Math.sin(angle) * dist;
            g.circle(sx, sy, sparkR).fill({ color: colorNum, alpha: 0.85 * (1 - tElapsed / lifetime) });
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
            const finalDmg = this.getEffectiveDamage() * multiplier;

            const effRange = this.getEffectiveRange();
            const rangeSq = effRange * effRange;
            const nearby = this.getNearbyEnemies(this.x, this.y, effRange);
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
            const finalDmg = this.getEffectiveDamage() * multiplier;

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
