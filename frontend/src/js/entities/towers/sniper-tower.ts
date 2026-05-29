/*
 * @file: frontend\src\js\entities\towers\sniper-tower.ts
 * @purpose: Defines the precise sniper tower targeting, muzzle fire, precise line traces, and kill bounty modifiers.
 * @dependencies: config, state, fx, base-tower, utils, types, pool
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
import { FloatingText, createExplosion, MuzzleFlash, SniperBeam } from '../../fx/fx';
import { Tower, tierOf } from './base-tower';
import { getDistanceSq, roundUpgradeCost } from '../../core/utils';
import { Enemy, TowerSpecialization } from '../../types';
import { PoolManager } from '../../core/pool';
import * as PIXI from 'pixi.js';

// ─── Sniper Tower ─────────────────────────────────────────────────────────────
export class SniperTower extends Tower {
    constructor(col: number, row: number) {
        super(col, row);
        this.type = 'Sniper';
        const data = TowerData['Sniper'];
        this.range = data.baseRange;
        this.damage = data.baseDamage;
        this.fireRate = data.baseFireRate;
        this.projectileSpeed = data.projectileSpeed || 40;
        this.totalSpent = data.baseCost;
        this.upgradeCost = data.baseCost * 2;
        this.colors = data.colors;
        this.currentColor = this.colors[0];

        this.constructionDuration = 120; // 3x slower: 2.0s at 60 FPS
        this.constructionTimer = this.constructionDuration;

        this.redrawPixiBase();
        this.redrawPixiTurret();
    }

    public override upgrade(updateUICallback?: () => void): boolean {
        if (this.level >= Config.TOWER_MAX_LEVEL) return false;
        if (state.infiniteGold || state.gold >= this.upgradeCost) {
            if (!state.infiniteGold) state.gold -= this.upgradeCost;
            this.totalSpent += this.upgradeCost;
            this.level++;

            const data = TowerData['Sniper'];
            this.damage += data.damagePerLevel + (this.level * (data.damageLevelBonus || 0));
            this.range += data.rangePerLevel;
            this.fireRate = Math.max(Config.TOWER_MIN_FIRE_RATE, this.fireRate - data.fireRateDecrease);
            
            // Specialization Speed Buffs for Ricochet
            if (this.specialization === 'ricochet') {
                const spec = data.specializations['ricochet'];
                if (this.level >= Config.TOWER_MASTERY_LEVEL || this.masteryUnlocked) {
                    this.fireRate = spec.values!.masteryFireRate;
                } else if (this.level >= Config.TOWER_SPECIALIZATION_LEVEL) {
                    this.fireRate = spec.values!.normalFireRate;
                }
            }

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

        if (this.constructionTimer > 0) {
            progress = 1 - (this.constructionTimer / this.constructionDuration);
            const c1 = 1.70158;
            const c3 = c1 + 1;
            scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

            if (part === 'base') {
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#a0d8ef', alpha: 1, width: 2.5 });

                // Reticle crosshairs
                g.moveTo(-TS / 2 - 5, 0).lineTo(TS / 2 + 5, 0)
                 .moveTo(0, -TS / 2 - 5).lineTo(0, TS / 2 + 5)
                 .stroke({ color: '#a0d8ef', alpha: 0.4, width: 1 });
            }
        }

        if (part === 'base') {
            const baseW = (TS / 2 - 10) * scale;
            const baseH = (TS / 2 - 4) * scale;
            let baseColor = this.currentColor;

            if (this.specialization) {
                const spec = TowerData[this.type].specializations[this.specialization];
                if (spec) baseColor = spec.color;
            }

            g.roundRect(-baseW, -baseH, baseW * 2, baseH * 2, 3 * scale).fill({ color: baseColor });

            // Ricochet pattern
            if (this.specialization === 'ricochet') {
                g.moveTo(-baseW, 0).lineTo(0, -baseH).lineTo(baseW, 0).lineTo(0, baseH).closePath();
                g.stroke({ color: 0xffffff, alpha: 0.3, width: 1 });
            }

            if (this.specialization === 'bounty') {
                // Add bounty text manually to graphics if possible, otherwise use a PIXI.Text in the container
                // PIXI.Graphics doesn't draw text natively, so we just add a gold circle instead
                g.circle(0, 0, 4 * scale).fill({ color: '#d35400' });
            }

            if (this.masteryUnlocked) {
                const mstColor = this.specialization === 'ricochet' ? '#55efc4' : (this.specialization === 'bounty' ? '#f1c40f' : '#ffffff');
                g.circle(baseW - 2 * scale, -baseH + 2 * scale, 3 * scale).stroke({ color: mstColor, width: 1 });
                g.moveTo(baseW - 2 * scale, -baseH + 2 * scale).lineTo(baseW + 2 * scale, -baseH - 2 * scale).stroke({ color: mstColor, width: 1 });
            }

            if (tier >= 1) {
                const lensColor = this.specialization === 'ricochet' ? '#55efc4' : (this.specialization === 'bounty' ? '#ffeaa7' : '#a0d8ef');
                g.circle(0, -baseH - 6 * scale, 4 * scale).stroke({ color: lensColor, width: 1.5 });
            }

            if (this.constructionTimer > 0) {
                const scopeY = -baseH - 6 * scale * progress;
                g.circle(0, scopeY, 4 * scale).stroke({ color: '#a0d8ef', alpha: progress, width: 1.5 });
                g.moveTo(0, scopeY + 4 * scale).lineTo(0, 0).stroke({ color: '#a0d8ef', alpha: 0.5 * progress, width: 1.5 });
            }

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
                
                let borderColor = '#a0d8ef';
                if (this.specialization === 'ricochet') borderColor = '#55efc4';
                if (this.specialization === 'bounty') borderColor = '#f39c12';

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
            const turretColor1 = this.specialization === 'ricochet' ? '#55efc4' : (this.specialization === 'bounty' ? '#ffeaa7' : '#cccccc');
            
            g.circle(0, 0, 8 * scale).fill({ color: turretColor1 }).stroke({ color: 0x000000, alpha: 0.2, width: 1 });

            let barrelColor = '#ffffff';
            if (this.specialization === 'ricochet') barrelColor = '#e0ffff';
            if (this.specialization === 'bounty') barrelColor = '#fffbe0';
            
            let barrelLen = 24;
            if (this.constructionTimer > 0) {
                barrelLen = 24 * progress;
            }
            g.rect(0, -2 * scale, barrelLen * scale, 4 * scale).fill({ color: barrelColor });
            
            if (barrelLen > 4) {
                g.rect((barrelLen - 4) * scale, -3 * scale, 6 * scale, 6 * scale).fill({ color: '#333333' });
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

    public override getDisplayDamage(): number {
        let dmg = this.damage;
        if (this.specialization === 'bounty') {
            const spec = TowerData[this.type].specializations['bounty'];
            const mult = this.masteryUnlocked ? spec.multipliers!.masteryDmg : spec.multipliers!.normalDmg;
            dmg = Math.floor(dmg * mult);
        }
        return Math.floor(dmg);
    }

    public override _acquireAndFire(): void {
        const needsNewTarget = !this.target || 
                               this.target.hp <= 0 || 
                               this.target.deadMarked ||
                               getDistanceSq(this.target.x, this.target.y, this.x, this.y) > (this.range * this.range);

        if (needsNewTarget || this.fireCooldown <= 0) {
            this.target = this.findOptimalTarget();
        }

        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            if (this.fireCooldown <= 0) {
                this.fireCooldown = this.fireRate;
                this.recoil = 12;

                const muzzleX = this.x + Math.cos(this.angle) * 26;
                const muzzleY = this.y + Math.sin(this.angle) * 26;
                PoolManager.getMuzzleFlash(muzzleX, muzzleY, this.angle, this.specialization === 'ricochet' ? '#55efc4' : '#a0d8ef');

                let currentTarget: Enemy | null = this.target;
                let lastX = muzzleX;
                let lastY = muzzleY;
                
                const dmg = this.getDisplayDamage();
                
                let hits = 0;
                let maxHits = 1;
                if (this.specialization === 'ricochet') {
                    const spec = TowerData[this.type].specializations['ricochet'];
                    maxHits = this.masteryUnlocked ? spec.values!.masteryHits : spec.values!.normalHits;
                }
                
                const alreadyHit: Enemy[] = [];
                const targetIds: number[] = [];

                while (currentTarget && hits < maxHits) {
                    targetIds.push(currentTarget.id);

                    PoolManager.getSniperBeam(
                        lastX, lastY, 
                        currentTarget.x, currentTarget.y, 
                        this.specialization === 'ricochet' ? '#55efc4' : '#a0d8ef'
                    );
                    
                    const actualDmg = currentTarget.takeDamage(dmg, this);
                    this.damageDealt += actualDmg;
                    if (currentTarget.hp <= 0 && !currentTarget.deadMarked) {
                        currentTarget.deadMarked = true;
                        this.kills++;
                        
                        if (this.specialization === 'bounty') {
                            const spec = TowerData[this.type].specializations['bounty'];
                            const bonus = this.masteryUnlocked ? spec.values!.masteryBounty : spec.values!.normalBounty;
                            state.gold += bonus;
                            state.totalGoldEarned += bonus;
                            PoolManager.getFloatingText(currentTarget.x, currentTarget.y - 20, `+${bonus}g Bounty`, '#ffb703');
                        }
                    }

                    hits++;
                    alreadyHit.push(currentTarget);
                    
                    if (hits < maxHits) {
                        const spec = TowerData[this.type].specializations['ricochet'];
                        const nearby = this.getNearbyEnemies(currentTarget.x, currentTarget.y, spec.values!.ricochetRange);
                        let bestDistSq = spec.values!.ricochetRange * spec.values!.ricochetRange;
                        let next: Enemy | null = null;
                        
                        for (let i = 0; i < nearby.length; i++) {
                            const enemy = nearby[i];
                            if (enemy.hp <= 0 || alreadyHit.includes(enemy)) continue;
                            const dSq = getDistanceSq(enemy.x, enemy.y, currentTarget.x, currentTarget.y);
                            if (dSq < bestDistSq) {
                                bestDistSq = dSq;
                                next = enemy;
                            }
                        }
                        
                        lastX = currentTarget.x;
                        lastY = currentTarget.y;
                        currentTarget = next;
                    }
                }

                if (!(state as any).projectileEvents) (state as any).projectileEvents = [];
                (state as any).projectileEvents.push({
                    type: 'sniper',
                    col: this.col,
                    row: this.row,
                    targetIds: targetIds
                });
            }
        }
    }

    private isBetterTarget(a: Enemy, b: Enemy): boolean {
        const aIsBoss = a.maxHp > 500;
        const bIsBoss = b.maxHp > 500;
        if (aIsBoss && !bIsBoss) return true;
        if (bIsBoss && !aIsBoss) return false;

        const distDiff = b.distanceTravelled - a.distanceTravelled;
        if (Math.abs(distDiff) < 50) {
            return a.maxHp > b.maxHp;
        }
        return distDiff < 0;
    }

    public override findOptimalTarget(): Enemy | null {
        const rangeSq = this.range * this.range;
        const nearby = this.getNearbyEnemies(this.x, this.y, this.range);
        
        let bestViable: Enemy | null = null;
        let bestBackup: Enemy | null = null;

        for (let i = 0; i < nearby.length; i++) {
            const enemy = nearby[i];
            if (enemy.hp <= 0) continue;
            
            if (getDistanceSq(enemy.x, enemy.y, this.x, this.y) > rangeSq) continue;

            if (!enemy.deadMarked) {
                if (!bestViable || this.isBetterTarget(enemy, bestViable)) {
                    bestViable = enemy;
                }
            } else {
                if (!bestBackup || enemy.distanceTravelled > bestBackup.distanceTravelled) {
                    bestBackup = enemy;
                }
            }
        }

        return bestViable || bestBackup;
    }
}
