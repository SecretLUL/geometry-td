/*
 * @file: frontend/src/js/entities/towers/booster-tower.ts
 * @purpose: Support tower that amplifies nearby towers (range, fire rate, damage) and draws connecting laser beams.
 * @dependencies: config, state, base-tower, utils, types, pixi.js
 */
import { Config, TowerData, TowerBalancer } from '../../core/config';
import { state } from '../../core/state';
import { createExplosion } from '../../fx/fx';
import { Tower } from './base-tower';
import { getDistanceSq } from '../../core/utils';
import * as PIXI from 'pixi.js';
import { PoolManager } from '../../core/pool';
import { entitiesContainer } from '../../core/game/viewport';

export class BoosterTower extends Tower {
    public pixiBeamsGraphics?: PIXI.Graphics;

    constructor(col: number, row: number) {
        super(col, row);
        this.type = 'Booster';
        const data = TowerData['Booster'];
        this.range = data.baseRange;
        this.damage = data.baseDamage;
        this.fireRate = data.baseFireRate;
        this.totalSpent = data.baseCost;
        this.upgradeCost = TowerBalancer.getUpgradeCost(this.type, 1, data.baseCost);
        this.colors = data.colors;
        this.currentColor = this.colors[0];

        this.constructionDuration = 180; // 3.0s construction duration at 60 FPS
        this.constructionTimer = this.constructionDuration;

        this.initPixi();

        this.redrawPixiBase();
        this.redrawPixiTurret();
    }

    public override initPixi(): void {
        super.initPixi();
        if (typeof window === 'undefined' || !this.pixiSprite) return;
        if (this.type !== 'Booster') return;

        if (!this.pixiBeamsGraphics) {
            this.pixiBeamsGraphics = new PIXI.Graphics();
            entitiesContainer.addChildAt(this.pixiBeamsGraphics, 0); // Render beams behind/underneath the towers for clean visuals

            // Clean up when this tower's sprite is destroyed
            this.pixiSprite.once('destroy', () => {
                if (this.pixiBeamsGraphics) {
                    this.pixiBeamsGraphics.destroy();
                    this.pixiBeamsGraphics = undefined;
                }
            });
        }
    }

    public override upgrade(updateUICallback?: () => void, silent: boolean = false): boolean {
        if (this.level >= Config.TOWER_MAX_LEVEL) return false;
        if (state.infiniteGold || state.gold >= this.upgradeCost) {
            if (!state.infiniteGold) state.gold -= this.upgradeCost;
            this.totalSpent += this.upgradeCost;
            this.level++;

            const data = TowerData[this.type];
            this.damage += data.damagePerLevel;
            this.range += data.rangePerLevel;
            this.fireRate = TowerBalancer.getFireRateForLevel(this.type, this.level, this.fireRate);

            this.currentColor = this.colors[Math.min(this.level - 1, this.colors.length - 1)];
            
            this.upgradeCost = TowerBalancer.getUpgradeCost(this.type, this.level, this.upgradeCost);

            if (!silent) {
                const floatingText = `Level ${this.level}!`;
                PoolManager.getFloatingText(this.x, this.y - 20, floatingText, '#ff9f43');
                createExplosion(this.x, this.y, this.currentColor, 10);
            }
            
            if (this.level === Config.TOWER_MASTERY_LEVEL) {
                this.masteryUnlocked = true;
                if (!silent) {
                    PoolManager.getFloatingText(this.x, this.y - 40, `MASTERY UNLOCKED!`, '#ffd700');
                }
            }
            
            this.redrawPixiBase();
            this.redrawPixiTurret();
            
            if (updateUICallback) updateUICallback();
            return true;
        }
        return false;
    }

    public override updatePixi(): void {
        super.updatePixi();
        if (this.constructionTimer <= 0) {
            this.redrawPixiTurret(); // Keep core rotating
        }

        if (!this.pixiBeamsGraphics) return;
        this.pixiBeamsGraphics.clear();

        if (this.constructionTimer > 0) return;

        if (state.towers) {
            let beamColor = 0xff9f43; // Neon orange
            if (this.specialization === 'frequency') {
                beamColor = 0xffa801; // Glowing amber/orange
            } else if (this.specialization === 'amplitude') {
                beamColor = 0xff3f34; // Intense red-orange
            }

            const effRange = this.getEffectiveRange();
            const rangeSq = effRange * effRange;

            if ((window as any)._lastBoosterLogTime === undefined || Date.now() - (window as any)._lastBoosterLogTime > 2000) {
                (window as any)._lastBoosterLogTime = Date.now();
                console.error(`[Booster] updatePixi: Range = ${effRange}, Towers count = ${state.towers.length}`);
            }

            for (const t of state.towers) {
                // Buff other fully-constructed towers in range
                if (t !== this && (t.constructionTimer === undefined || t.constructionTimer <= 0)) {
                    const distSq = getDistanceSq(this.x, this.y, t.x, t.y);
                    if (distSq <= rangeSq) {
                        if ((window as any)._lastBeamDrawLogTime === undefined || Date.now() - (window as any)._lastBeamDrawLogTime > 2000) {
                            (window as any)._lastBeamDrawLogTime = Date.now();
                            console.error(`[Booster] Drawing beam from ${this.x},${this.y} to ${t.x},${t.y} (dist: ${Math.sqrt(distSq)})`);
                        }

                        const pulse = 0.5 + 0.5 * Math.sin(state.animTime * 0.003 + t.x);
                        const alpha = 0.35 + 0.25 * pulse;
                        const width = 1.5 + 1.0 * pulse;
                        
                        this.pixiBeamsGraphics.moveTo(this.x, this.y)
                            .lineTo(t.x, t.y)
                            .stroke({ color: beamColor, width: width, alpha: alpha });
                            
                        this.pixiBeamsGraphics.circle(t.x, t.y, 3.5).fill({ color: '#ffffff', alpha: alpha });
                    }
                }
            }
        }
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
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#ff9f43', alpha: 0.3, width: 6 });
                
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#ff9f43', alpha: 1, width: 3 });
            }
        }

        if (part === 'base') {
            const r = (TS / 2 - 6) * scale;
            let baseColor = this.currentColor;
            
            if (this.specialization) {
                const spec = TowerData[this.type].specializations[this.specialization];
                if (spec) baseColor = spec.color;
            }

            // Draw Octahedron / Double Diamond base
            g.moveTo(0, -r).lineTo(r, 0).lineTo(0, r).lineTo(-r, 0).closePath();
            g.fill({ color: baseColor });
            g.stroke({ color: 0xffffff, alpha: 0.2, width: 1 });

            // Inner design
            const innerR = r * 0.6;
            g.moveTo(0, -innerR).lineTo(innerR, 0).lineTo(0, innerR).lineTo(-innerR, 0).closePath();
            g.stroke({ color: 0xffffff, alpha: 0.4, width: 1.5 });

            // Level Badge
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
                
                let borderColor = this.currentColor;
                if (this.level >= Config.TOWER_MASTERY_LEVEL) borderColor = '#ffd700';
                else if (this.level >= Config.TOWER_SPECIALIZATION_LEVEL) borderColor = '#ff9f43';

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
                if (this.level >= Config.TOWER_MASTERY_LEVEL) this.pixiLevelText.style.fill = '#ffd700';
                else if (this.level >= Config.TOWER_SPECIALIZATION_LEVEL) this.pixiLevelText.style.fill = '#ff9f43';
                else this.pixiLevelText.style.fill = '#ffffff';
                this.pixiLevelText.visible = true;
            } else if (this.pixiLevelText) {
                this.pixiLevelText.visible = false;
            }
        }

        if (part === 'turret') {
            const r = (TS / 2 - 6) * scale;
            let themeColor = this.currentColor;
            if (this.specialization) {
                const spec = TowerData[this.type].specializations[this.specialization];
                if (spec) themeColor = spec.color;
            }

            // Central floating core (glows, pulses and changes size dynamically)
            const time = state.animTime;
            const pulseOffset = Math.sin(time * 0.0015) * 1.5;
            const coreRadius = (8 + pulseOffset) * scale;

            // Rotating octahedron/diamond shape for core
            const rotAngle = time * 0.001;
            g.moveTo(Math.cos(rotAngle) * coreRadius, Math.sin(rotAngle) * coreRadius)
             .lineTo(Math.cos(rotAngle + Math.PI/2) * coreRadius, Math.sin(rotAngle + Math.PI/2) * coreRadius)
             .lineTo(Math.cos(rotAngle + Math.PI) * coreRadius, Math.sin(rotAngle + Math.PI) * coreRadius)
             .lineTo(Math.cos(rotAngle + 3*Math.PI/2) * coreRadius, Math.sin(rotAngle + 3*Math.PI/2) * coreRadius)
             .closePath();
            g.fill({ color: '#ffffff', alpha: 0.9 });
            g.stroke({ color: themeColor, width: 2 });

            // Draw orbiting rings
            const ringRadius = r * 0.8;
            g.circle(0, 0, ringRadius).stroke({ color: themeColor, alpha: 0.35, width: 1.5 });
            
            // Rotating satellite dots on the ring (3 nodes at 120-deg offsets)
            for (let i = 0; i < 3; i++) {
                const dotAngle = -time * 0.0008 + (i * Math.PI * 2 / 3);
                const dx = Math.cos(dotAngle) * ringRadius;
                const dy = Math.sin(dotAngle) * ringRadius;
                g.circle(dx, dy, 2.5).fill({ color: '#ffffff' });
                g.circle(dx, dy, 2.5).stroke({ color: themeColor, width: 1.5 });
            }

            // Mastery level outer visual additions
            if (this.masteryUnlocked) {
                const outerRingRad = r * 1.15;
                g.circle(0, 0, outerRingRad).stroke({ color: themeColor, alpha: 0.5, width: 2 });
                // Draw rotating outer brackets
                const bracketAngle = time * 0.0004;
                for (let i = 0; i < 4; i++) {
                    const startAngle = i * Math.PI/2 + bracketAngle;
                    const endAngle = i * Math.PI/2 + Math.PI/6 + bracketAngle;
                    g.arc(0, 0, outerRingRad + 2, startAngle, endAngle);
                    g.stroke({ color: '#ffffff', width: 2 });
                }
            }
        }
    }

    public override update(): void {
        if (this.constructionTimer > 0) {
            this.constructionTimer--;
            if (this.constructionTimer === 0) {
                this.redrawPixiBase();
                this.redrawPixiTurret();
            } else {
                if (Math.random() < 0.25) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = Math.random() * 16;
                    const px = this.x + Math.cos(angle) * dist;
                    const py = this.y + Math.sin(angle) * dist;
                    const color = this.currentColor || '#ff9f43';
                    PoolManager.getParticle(px, py, color, Math.random() * 1.5 + 0.5, Math.random() * 2 + 1);
                }
                this.updatePixi();
            }
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            this.updatePixi();
            return;
        }

        this.updatePixi();
    }

    public override _acquireAndFire(): void {
        // Booster Tower doesn't shoot or acquire targets directly.
        // It passive-buffs nearby towers inside getEffectiveRange/Damage/FireRate.
    }
}
