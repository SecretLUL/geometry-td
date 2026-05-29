/*
 * @file: frontend\src\js\entities\towers\bomb-tower.ts
 * @purpose: Bomb Tower class specialized in heavy splash damage, homing missiles, and nuclear payloads.
 * @dependencies: config, state, fx, projectiles, base-tower, utils, types, pool
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
 * @last_update: 2026-05-29 / v2.0.0 - Migrated rendering to PixiJS.
 */
import { Config, TowerData } from '../../core/config';
import { state } from '../../core/state';
import { FloatingText, createExplosion } from '../../fx/fx';
import { Projectile } from '../projectiles';
import { Tower, tierOf } from './base-tower';
import { getDistanceSq, roundUpgradeCost } from '../../core/utils';
import { Enemy, TowerSpecialization } from '../../types';
import { PoolManager } from '../../core/pool';
import * as PIXI from 'pixi.js';

// ─── Bomb Tower ───────────────────────────────────────────────────────────────
export class BombTower extends Tower {
    private _enemiesInRangeBuffer?: Enemy[];
    private _testPointsBuffer?: { x: number; y: number; enemy: Enemy | null }[];
    private _staticTarget?: { x: number; y: number; hp: number };

    constructor(col: number, row: number) {
        super(col, row);
        this.type = 'Bomb';
        const data = TowerData['Bomb'];
        this.range = data.baseRange;
        this.damage = data.baseDamage;
        this.fireRate = data.baseFireRate;
        this.totalSpent = data.baseCost;
        this.upgradeCost = data.baseCost * 2;
        this.aoeRadius = data.aoeRadius;
        this.projectileSpeed = data.projectileSpeed || 3;
        this.colors = data.colors;
        this.currentColor = this.colors[0];

        this.constructionDuration = 55; // approx 0.92s
        this.constructionTimer = this.constructionDuration;
        
        // Re-bake now that type and colors are set correctly
        this.redrawPixiBase();
        this.redrawPixiTurret();
    }

    public override upgrade(updateUICallback?: () => void): boolean {
        if (this.level >= Config.TOWER_MAX_LEVEL) return false;
        if (state.infiniteGold || state.gold >= this.upgradeCost) {
            if (!state.infiniteGold) state.gold -= this.upgradeCost;
            this.totalSpent += this.upgradeCost;
            this.level++;

            const data = TowerData['Bomb'];
            this.damage += data.damagePerLevel;
            this.range += data.rangePerLevel;
            this.aoeRadius = (this.aoeRadius || 0) + (data.aoeRadiusPerLevel || 0);
            this.fireRate = Math.max(Config.TOWER_MIN_FIRE_RATE, this.fireRate - data.fireRateDecrease);

            this.currentColor = this.colors[Math.min(this.level - 1, this.colors.length - 1)];
            
            // Flattening costs: 2.0x before level 5, 1.4x after
            if (this.level >= 5) {
                this.upgradeCost = Math.floor(this.upgradeCost * 1.4);
            } else {
                this.upgradeCost *= 2;
            }
            this.upgradeCost = roundUpgradeCost(this.upgradeCost);

            PoolManager.getFloatingText(this.x, this.y - 20, `Level ${this.level}!`, '#4cc9f0');
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

    public override drawPixi(g: PIXI.Graphics, part: 'base' | 'turret'): void {
        const TS = Config.TILE_SIZE;
        const tier = tierOf(this.level);

        let scale = 1;
        let progress = 0;
        let yOffset = 0;
        if (this.constructionTimer > 0) {
            progress = 1 - (this.constructionTimer / this.constructionDuration);
            const c4 = (2 * Math.PI) / 3;
            const t = progress === 0 ? 0 : progress === 1 ? 1 : -Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1;
            yOffset = -40 * (1 - t);
            scale = 0.5 + 0.5 * t;

            if (part === 'base') {
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#f1c40f', alpha: 0.3, width: 6 });
                
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#f1c40f', alpha: 1, width: 3 });
            }
        }

        // Apply yOffset to drawing position
        // Since `g` is centered around 0,0 for base and turret drawing in our system,
        // we can adjust drawing coordinates manually or wait for the update loop to adjust sprite Y.
        // Wait, it's easier to just translate the graphics context by yOffset? PIXI.Graphics doesn't have `translate`, it has transforms, but it's easier to just offset the drawn shapes.
        // Actually, we can just apply yOffset to the graphics object itself in updatePixi if it's constructing.
        // Let's just adjust shapes by yOffset here.
        
        if (part === 'base') {
            const baseR = (TS / 2 - 4) * scale;
            let baseColor = this.currentColor;
            
            if (this.specialization) {
                const spec = TowerData[this.type].specializations[this.specialization];
                if (spec) baseColor = spec.color;
            }

            g.circle(0, yOffset, baseR).fill({ color: baseColor });

            if (this.constructionTimer > 0) {
                // Hazard spinning indicator
                const rot = (1 - progress) * Math.PI * 3;
                g.rotation = rot;
                for (let i = 0; i < 3; i++) {
                    const a1 = (Math.PI * 2 / 3) * i;
                    const a2 = a1 + (Math.PI / 3);
                    g.moveTo(0, yOffset);
                    g.arc(0, yOffset, baseR - 3, a1, a2);
                    g.closePath();
                    g.fill({ color: 0xf1c40f, alpha: 0.45 });
                }
                g.rotation = 0; // reset
            }

            if (this.specialization === 'nuke') {
                for (let i = 0; i < 3; i++) {
                    const a1 = (Math.PI * 2 / 3) * i;
                    const a2 = a1 + (Math.PI / 3);
                    g.moveTo(0, yOffset);
                    g.arc(0, yOffset, baseR - 4, a1, a2);
                    g.closePath();
                    g.fill({ color: '#f1c40f' });
                }
                g.circle(0, yOffset, baseR / 3).fill({ color: baseColor });
            }
            
            if (this.specialization === 'cluster') {
                for (let i = 0; i < 6; i++) {
                    const ang = (Math.PI / 3) * i;
                    g.moveTo(0, yOffset).lineTo(Math.cos(ang) * baseR, yOffset + Math.sin(ang) * baseR).stroke({ color: 0x000000, alpha: 0.2, width: 1 });
                }
            }

            if (this.masteryUnlocked) {
                const dotColor = this.specialization === 'nuke' ? '#badc58' : '#ff6060';
                for (let i = 0; i < 4; i++) {
                    const ang = (Math.PI / 2) * i + Math.PI / 4;
                    g.circle(Math.cos(ang) * (baseR - 4), yOffset + Math.sin(ang) * (baseR - 4), 2 * scale).fill({ color: dotColor });
                }
            }

            if (tier >= 1) {
                const ringColor = this.specialization === 'nuke' ? '#badc58' : '#ff6060';
                g.circle(0, yOffset, baseR).stroke({ color: ringColor, width: 2 + tier });
            }

            // Level Badge
            if (this.level > 1 && this.pixiLevelText) {
                const badgeX = (TS / 2 - 11) * scale;
                const badgeY = (TS / 2 - 11) * scale + yOffset;
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
            const turretColor1 = this.specialization === 'nuke' ? '#badc58' : (this.specialization === 'cluster' ? '#ff7675' : '#600');
            const turretColor2 = this.specialization === 'nuke' ? '#2d3436' : (this.specialization === 'cluster' ? '#d63031' : '#300');
            
            g.circle(0, yOffset, 10 * scale).fill({ color: turretColor1 });

            if (this.specialization === 'cluster') {
                g.rect(5 * scale, yOffset - 6 * scale, 8 * scale, 3 * scale).fill({ color: '#ff4040' });
                g.rect(8 * scale, yOffset - 2 * scale, 8 * scale, 4 * scale).fill({ color: '#ff4040' });
                g.rect(5 * scale, yOffset + 3 * scale, 8 * scale, 3 * scale).fill({ color: '#ff4040' });
            } else {
                g.rect(0, yOffset - 6 * scale, 12 * scale, 12 * scale).fill({ color: this.specialization === 'nuke' ? '#2d3436' : '#ff4040' });
                g.rect(10 * scale, yOffset - 7 * scale, 4 * scale, 14 * scale).fill({ color: this.specialization === 'nuke' ? '#badc58' : '#ffffff' });
            }
        }
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

    public getDisplayAoe(): number {
        let aoe = this.aoeRadius || 0;
        if (this.specialization === 'nuke') {
            const spec = TowerData[this.type].specializations['nuke'];
            const mult = this.masteryUnlocked ? spec.multipliers!.masteryAoe : spec.multipliers!.normalAoe;
            aoe = Math.floor(aoe * mult);
        }
        return aoe;
    }

    public override update(): void {
        if (this.constructionTimer > 0) {
            super.update();
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            return;
        }
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.missileCooldown > 0) this.missileCooldown--;
        
        // Bomb Tower logic: Always re-calculate best cluster to track it
        this.target = this.findOptimalTarget();

        this._acquireAndFire();
        this.updatePixi();
    }

    public override findOptimalTarget(): Enemy | null {
        const rangeSq = this.range * this.range;
        
        // Use static buffers to avoid GC array allocations
        if (!this._enemiesInRangeBuffer) this._enemiesInRangeBuffer = [];
        if (!this._testPointsBuffer) this._testPointsBuffer = [];
        
        const enemiesInRange = this._enemiesInRangeBuffer;
        enemiesInRange.length = 0;

        const nearbyEnemies = this.getNearbyEnemies(this.x, this.y, this.range);
        for (let i = 0; i < nearbyEnemies.length; i++) {
            const e = nearbyEnemies[i];
            if (e.hp <= 0 || e.deadMarked) continue;
            if (getDistanceSq(e.x, e.y, this.x, this.y) <= rangeSq) {
                enemiesInRange.push(e);
            }
        }

        if (enemiesInRange.length === 0) return null;

        const currentAoe = this.getDisplayAoe();
        const aoeSq = currentAoe * currentAoe;

        const testPoints = this._testPointsBuffer;
        testPoints.length = 0;

        for (let i = 0; i < enemiesInRange.length; i++) {
            const e1 = enemiesInRange[i];
            testPoints.push({ x: e1.x, y: e1.y, enemy: e1 });
            
            for (let j = i + 1; j < enemiesInRange.length; j++) {
                const e2 = enemiesInRange[j];
                const dx = e2.x - e1.x;
                const dy = e2.y - e1.y;
                const distSq = dx * dx + dy * dy;
                
                if (distSq <= (currentAoe * 2) ** 2) {
                    testPoints.push({ x: e1.x + dx / 2, y: e1.y + dy / 2, enemy: null });
                }
            }
        }

        let bestPoint: { x: number; y: number; enemy: Enemy | null } | null = null;
        let maxScore = -1;

        for (let i = 0; i < testPoints.length; i++) {
            const pt = testPoints[i];
            if (getDistanceSq(pt.x, pt.y, this.x, this.y) > rangeSq) continue;

            let score = 0;
            const nearby = this.getNearbyEnemies(pt.x, pt.y, currentAoe);
            for (let j = 0; j < nearby.length; j++) {
                const other = nearby[j];
                if (other.hp <= 0 || other.deadMarked) continue;
                if (getDistanceSq(other.x, other.y, pt.x, pt.y) <= aoeSq) {
                    score++;
                }
            }
            
            if (pt.enemy) {
                score += 0.1;
                score += pt.enemy.distanceTravelled * 0.0001;
            } else {
                score += (pt.x + pt.y) * 0.0000001;
            }

            if (score > maxScore) {
                maxScore = score;
                bestPoint = pt;
            }
        }

        if (bestPoint) {
            if (!this._staticTarget) {
                this._staticTarget = { x: 0, y: 0, hp: 1 };
            }
            this._staticTarget.x = bestPoint.x;
            this._staticTarget.y = bestPoint.y;
            return this._staticTarget as any;
        }
        return null;
    }

    public override _acquireAndFire(): void {
        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.fireCooldown <= 0) {
                const aoe = this.getDisplayAoe();
                const isCluster = this.specialization === 'cluster';
                
                PoolManager.getProjectile(this.x, this.y, this.target, this.damage, this, aoe, this.projectileSpeed, 0, isCluster);

                if (!(state as any).projectileEvents) (state as any).projectileEvents = [];
                (state as any).projectileEvents.push({
                    type: 'projectile',
                    col: this.col,
                    row: this.row,
                    targetId: null,
                    targetPoint: { x: this.target.x, y: this.target.y },
                    damage: this.damage,
                    aoeRadius: aoe,
                    projectileSpeed: this.projectileSpeed,
                    isHoming: false,
                    isCluster: isCluster
                });

                this.fireCooldown = this.fireRate;
                this.recoil = 6;
            }
        }
    }
}
