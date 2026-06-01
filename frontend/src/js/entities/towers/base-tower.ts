/*
 * @file: frontend\src\js\entities\towers\base-tower.ts
 * @purpose: Defines the base class and shared visual helper utilities for all defenses.
 * @dependencies: config, state, fx, projectiles, utils, types, pool
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
 * @last_update: 2026-05-29 / v2.0.2 - Made Base Tower attack speed scale linearly and removed visual antennas.
 */
import { Config, TowerData, TowerBalancer } from '../../core/config';
import { state } from '../../core/state';
import { createExplosion } from '../../fx/fx';
import { getDistanceSq, getNearbyEnemies } from '../../core/utils';
import { Enemy, TowerType, TowerSpecialization } from '../../types';
import { PoolManager } from '../../core/pool';
import * as PIXI from 'pixi.js';
import { app, entitiesContainer } from '../../core/game/viewport';

export function tierOf(level: number): number {
    return Math.floor((level - 1) / 3);
}

export class Tower {
    public col: number;
    public row: number;
    public x: number;
    public y: number;
    public type: TowerType;
    public kills: number;
    public damageDealt: number;
    public level: number;
    public range: number;
    public damage: number;
    public fireRate: number;
    public fireCooldown: number;
    public missileCooldown: number;
    public projectileSpeed: number;
    public stunTimer: number;
    public target: Enemy | null;
    public angle: number;
    public recoil: number;
    public totalSpent: number;
    public upgradeCost: number;
    public specialization: TowerSpecialization | null;
    public masteryUnlocked: boolean;
    public colors: string[];
    public currentColor: string;
    public aoeRadius?: number;
    public isPredicted?: boolean;
    public predictionTime?: number;
    public predictedCost?: number;
    public constructionTimer: number;
    public constructionDuration: number;

    public pixiSprite?: PIXI.Container;
    public pixiBaseGraphics?: PIXI.Graphics;
    public pixiTurretGraphics?: PIXI.Graphics;
    public pixiLevelText?: PIXI.Text;
    public pixiStunSprite?: PIXI.Text;
    public pixiGhostContainer?: PIXI.Container;

    constructor(col: number, row: number) {
        const data = TowerData['Base'];
        this.col = col;
        this.row = row;
        this.x = col * Config.TILE_SIZE + Config.TILE_SIZE / 2;
        this.y = row * Config.TILE_SIZE + Config.TILE_SIZE / 2;
        this.type = 'Base';
        this.kills = 0;
        this.damageDealt = 0;

        this.level = 1;
        this.range = data.baseRange;
        this.damage = data.baseDamage;
        this.fireRate = data.baseFireRate;
        this.fireCooldown = 0;
        this.missileCooldown = 0;
        this.projectileSpeed = data.projectileSpeed || Config.PROJECTILE_SPEED;
        this.stunTimer = 0;

        this.target = null;
        this.angle = 0;
        this.recoil = 0;
        this.totalSpent = data.baseCost;
        this.upgradeCost = data.baseCost * 2;
        this.specialization = null;
        this.masteryUnlocked = false;

        this.colors = data.colors;
        this.currentColor = this.colors[0];

        this.constructionDuration = 90; // 3x slower: 1.5s at 60 FPS
        this.constructionTimer = this.constructionDuration;

        this.initPixi();
    }

    public initPixi() {
        if (typeof window === 'undefined' || !app || !app.renderer) return;
        
        if (!this.pixiSprite) {
            this.pixiSprite = new PIXI.Container();
            entitiesContainer.addChild(this.pixiSprite);
            
            this.pixiBaseGraphics = new PIXI.Graphics();
            this.pixiSprite.addChild(this.pixiBaseGraphics);

            this.pixiTurretGraphics = new PIXI.Graphics();
            this.pixiSprite.addChild(this.pixiTurretGraphics);
            
            this.pixiLevelText = new PIXI.Text({ text: '', style: { fontFamily: 'Outfit', fontSize: 10, fill: '#ffffff', fontWeight: 'bold' } });
            this.pixiLevelText.anchor.set(0.5);
            this.pixiSprite.addChild(this.pixiLevelText);

            this.pixiStunSprite = new PIXI.Text({ text: '⚡', style: { fill: 'yellow', fontSize: 24, fontWeight: 'bold' } as any });
            this.pixiStunSprite.anchor.set(0.5);
            this.pixiStunSprite.visible = false;
            this.pixiSprite.addChild(this.pixiStunSprite);
        }
        
        // Initial drawing
        this.redrawPixiBase();
        this.redrawPixiTurret();
    }

    public updatePixi(): void {
        if (!this.pixiSprite || !this.pixiTurretGraphics || !this.pixiBaseGraphics) return;

        this.pixiSprite.position.set(this.x, this.y);

        if (state.isHost && this.recoil > 0) {
            this.recoil--;
        }

        this.pixiTurretGraphics.rotation = this.angle;
        this.pixiTurretGraphics.position.set(
            -this.recoil * Math.cos(this.angle),
            -this.recoil * Math.sin(this.angle)
        );

        if (this.pixiStunSprite) {
            this.pixiStunSprite.visible = this.stunTimer > 0;
        }

        if (this.constructionTimer > 0) {
            this.redrawPixiBase();
            this.redrawPixiTurret();
        }
    }
    
    public redrawPixiBase(): void {
        if (!this.pixiBaseGraphics) return;
        this.pixiBaseGraphics.clear();
        this.drawPixi(this.pixiBaseGraphics, 'base');
    }
    
    public redrawPixiTurret(): void {
        if (!this.pixiTurretGraphics) return;
        this.pixiTurretGraphics.clear();
        this.drawPixi(this.pixiTurretGraphics, 'turret');
    }

    public getNearbyEnemies(x: number, y: number, radius: number): Enemy[] {
        return getNearbyEnemies(x, y, radius);
    }

    public getDisplayDamage(): number | string {
        let dmg = this.damage;
        if (this.specialization === 'heavy') {
            const spec = TowerData[this.type].specializations['heavy'];
            const mult = this.masteryUnlocked ? spec.multipliers!.masteryDmg : spec.multipliers!.normalDmg;
            dmg = Math.floor(dmg * mult);
        }
        return dmg;
    }

    public getDisplayFireRate(): string {
        return (60 / this.fireRate).toFixed(1);
    }

    public rescale(): void {
        this.x = this.col * Config.TILE_SIZE + Config.TILE_SIZE / 2;
        this.y = this.row * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    }

    public upgrade(updateUICallback?: () => void, silent: boolean = false): boolean {
        if (this.level >= Config.TOWER_MAX_LEVEL) return false;
        if (state.infiniteGold || state.gold >= this.upgradeCost) {
            if (!state.infiniteGold) state.gold -= this.upgradeCost;
            this.totalSpent += this.upgradeCost;
            this.level++;

            const data = TowerData[this.type];
            this.damage += data.baseDamage + (this.level * data.damagePerLevel);
            this.range += data.rangePerLevel;
            
            this.fireRate = TowerBalancer.getFireRateForLevel(this.type, this.level, this.fireRate);

            this.currentColor = this.colors[Math.min(this.level - 1, this.colors.length - 1)];
            
            this.upgradeCost = TowerBalancer.getUpgradeCost(this.type, this.level, this.upgradeCost);

            if (!silent) {
                PoolManager.getFloatingText(this.x, this.y - 20, `Level ${this.level}!`, '#4cc9f0');
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

    public getSpecializationInfo(specId: TowerSpecialization, isMastery = false): string {
        const spec = TowerData[this.type].specializations[specId];
        if (!spec) return 'Keine';
        return isMastery ? spec.masteryDesc : spec.desc;
    }

    public getSpecializations(): { id: TowerSpecialization; name: string; desc: string }[] {
        const specs = TowerData[this.type].specializations;
        return Object.keys(specs).map(key => ({
            id: key as TowerSpecialization,
            name: specs[key].name,
            desc: specs[key].desc
        }));
    }

    public applySpecialization(specId: TowerSpecialization, silent: boolean = false): void {
        this.specialization = specId;
        this.upgrade(undefined, silent);
    }

    public drawPixi(g: PIXI.Graphics, part: 'base' | 'turret'): void {
        const TS = Config.TILE_SIZE;


        let scale = 1;
        if (this.constructionTimer > 0) {
            const progress = 1 - (this.constructionTimer / this.constructionDuration);
            const c1 = 1.70158;
            const c3 = c1 + 1;
            scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

            if (part === 'base') {
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#4cc9f0', alpha: 0.3, width: 6 });
                
                g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
                g.stroke({ color: '#4cc9f0', alpha: 1, width: 3 });
            }
        }

        if (part === 'base') {
            const halfBase = TS / 2 - 5;
            let baseColor = this.currentColor;
            
            if (this.specialization) {
                const spec = TowerData[this.type].specializations[this.specialization];
                if (spec) baseColor = spec.color;
            }

            g.roundRect(-halfBase * scale, -halfBase * scale, halfBase * 2 * scale, halfBase * 2 * scale, 4).fill({ color: baseColor });
            
            g.rect((-halfBase + 4) * scale, (-halfBase + 4) * scale, (halfBase * 2 - 8) * scale, (halfBase * 2 - 8) * scale).stroke({ color: 0xffffff, alpha: 0.1, width: 1 });

            if (this.specialization === 'heavy') {
                const s = 6 * scale;
                g.rect(-halfBase * scale, -halfBase * scale, s, s).fill({ color: '#636e72' });
                g.rect((halfBase - 6) * scale, -halfBase * scale, s, s).fill({ color: '#636e72' });
                g.rect(-halfBase * scale, (halfBase - 6) * scale, s, s).fill({ color: '#636e72' });
                g.rect((halfBase - 6) * scale, (halfBase - 6) * scale, s, s).fill({ color: '#636e72' });
                
                if (this.masteryUnlocked) {
                    const radius = 1.5 * scale;
                    g.circle((-halfBase + 3) * scale, (-halfBase + 3) * scale, radius).fill({ color: '#ffd700' });
                    g.circle((halfBase - 3) * scale, (-halfBase + 3) * scale, radius).fill({ color: '#ffd700' });
                    g.circle((-halfBase + 3) * scale, (halfBase - 3) * scale, radius).fill({ color: '#ffd700' });
                    g.circle((halfBase - 3) * scale, (halfBase - 3) * scale, radius).fill({ color: '#ffd700' });
                }
            }

            // Antenna elements removed
            
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

                // We have to redraw the hexpath because stroke consumes it? Or fill consumes it?
                // Yes, drawing paths usually consumes it.
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

            const turretColor2 = this.specialization === 'heavy' ? '#636e72' : (this.specialization === 'missiles' ? '#ff7675' : '#fff');
            
            // Draw turret body
            g.circle(0, 0, 10 * scale).fill({ color: turretColor2 }).stroke({ color: 0x000000, alpha: 0.3, width: 1 });

            // barrel
            if (this.specialization === 'heavy') {
                g.rect(0, -5 * scale, 18 * scale, 10 * scale).fill({ color: '#1e272e' }).stroke({ color: '#636e72', width: 1 });
                g.rect(16 * scale, -7 * scale, 4 * scale, 14 * scale).fill({ color: '#1e272e' });
            } else {
                g.rect(0, -3 * scale, 15 * scale, 6 * scale).fill({ color: this.specialization === 'missiles' ? '#2d3436' : '#ddd' });
            }

            if (this.specialization === 'missiles') {
                g.rect(-5 * scale, -14 * scale, 12 * scale, 6 * scale).fill({ color: '#fca311' });
                g.rect(-5 * scale, 8 * scale, 12 * scale, 6 * scale).fill({ color: '#fca311' });
                
                g.moveTo(7 * scale, -14 * scale).lineTo(11 * scale, -11 * scale).lineTo(7 * scale, -8 * scale).fill({ color: '#ff3366' });
                g.moveTo(7 * scale, 8 * scale).lineTo(11 * scale, 11 * scale).lineTo(7 * scale, 14 * scale).fill({ color: '#ff3366' });

                if (this.masteryUnlocked) {
                    g.rect(-12 * scale, -4 * scale, 8 * scale, 8 * scale).fill({ color: '#2d3436' });
                    g.circle(-8 * scale, 0, 3 * scale).fill({ color: '#ff3366' });
                }
            }
        }
    }

    public update(): void {
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
                    
                    let color = '#4cc9f0';
                    if (this.type === 'Bomb') color = Math.random() < 0.5 ? '#ff4757' : '#57606f';
                    else if (this.type === 'Tesla') color = Math.random() < 0.7 ? '#00ffff' : '#81ecec';
                    else if (this.type === 'Prisma') {
                        const colors = ['#ffe100', '#df00ff', '#00ffd0'];
                        color = colors[Math.floor(Math.random() * colors.length)];
                    } else if (this.type === 'Sniper') color = Math.random() < 0.6 ? '#a0d8ef' : '#ffd700';

                    PoolManager.getParticle(px, py, color, Math.random() * 1.5 + 0.5, Math.random() * 2 + 1);
                }
                this.updatePixi();
            }
            return;
        }

        if (this.stunTimer > 0) {
            this.stunTimer--;
            this.target = null;
            if ((this as any).lockTimer !== undefined) {
                (this as any).lockTimer = 0;
            }
            return;
        }
        if (this.fireCooldown > 0) this.fireCooldown--;
        if (this.missileCooldown > 0) this.missileCooldown--;
        
        const rangeSq = this.range * this.range;
        const needsTarget = !this.target || 
                            this.target.hp <= 0 || 
                            this.target.deadMarked || 
                            getDistanceSq(this.target.x, this.target.y, this.x, this.y) > rangeSq;

        if (needsTarget || this.fireCooldown <= 0) {
            this.target = this.findOptimalTarget();
        }

        this._acquireAndFire();
        this.updatePixi();
    }



    public findOptimalTarget(): Enemy | null {
        const rangeSq = this.range * this.range;
        const nearby = getNearbyEnemies(this.x, this.y, this.range);
        
        let bestViableEnemy: Enemy | null = null;
        let bestViableDist = -1;
        
        let bestBackupEnemy: Enemy | null = null;
        let bestBackupDist = -1;

        for (let i = 0; i < nearby.length; i++) {
            const enemy = nearby[i];
            if (enemy.hp <= 0 || enemy.deadMarked) continue;
            
            const distSq = getDistanceSq(enemy.x, enemy.y, this.x, this.y);
            if (distSq > rangeSq) continue;
            
            if (enemy.shieldActive) {
                if (enemy.distanceTravelled > bestViableDist) {
                    bestViableDist = enemy.distanceTravelled;
                    bestViableEnemy = enemy;
                }
            } else {
                let incomingDmg = (enemy as any).incomingDamage || 0;
                for (let j = 0; j < state.projectiles.length; j++) {
                    const p = state.projectiles[j];
                    if (p.active && p.tower === this && p.target === enemy) {
                        incomingDmg -= p.damage;
                    }
                }
                
                if (enemy.hp - incomingDmg > 0) {
                    if (enemy.distanceTravelled > bestViableDist) {
                        bestViableDist = enemy.distanceTravelled;
                        bestViableEnemy = enemy;
                    }
                } else {
                    if (enemy.distanceTravelled > bestBackupDist) {
                        bestBackupDist = enemy.distanceTravelled;
                        bestBackupEnemy = enemy;
                    }
                }
            }
        }
        
        return bestViableEnemy || bestBackupEnemy;
    }

    public _acquireAndFire(): void {
        if (this.target) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            
            if (this.fireCooldown <= 0) {
                let dmg = this.damage;
                const fr = this.fireRate;
                if (this.specialization === 'heavy') {
                    const spec = TowerData[this.type].specializations['heavy'];
                    const mult = this.masteryUnlocked ? spec.multipliers!.masteryDmg : spec.multipliers!.normalDmg;
                    dmg = Math.floor(dmg * mult);
                }
                
                const aoe = this.aoeRadius || 0;
                PoolManager.getProjectile(this.x, this.y, this.target, dmg, this, aoe, this.projectileSpeed);

                if (!(state as any).projectileEvents) (state as any).projectileEvents = [];
                (state as any).projectileEvents.push({
                    type: 'projectile',
                    col: this.col,
                    row: this.row,
                    targetId: this.target.id,
                    damage: dmg,
                    aoeRadius: aoe,
                    projectileSpeed: this.projectileSpeed,
                    isHoming: false
                });

                this.fireCooldown = fr;
                this.recoil = 6;
            }
        }

        if (this.specialization === 'missiles' && this.missileCooldown <= 0) {
            let missileTarget: Enemy | null = null;
            let maxDist = -1;
            for (let i = 0; i < state.enemies.length; i++) {
                const e = state.enemies[i];
                if (!e.deadMarked && e.hp > 0 && e.distanceTravelled > maxDist) {
                    maxDist = e.distanceTravelled;
                    missileTarget = e;
                }
            }

            if (missileTarget) {
                const spec = TowerData[this.type].specializations['missiles'];
                const count = this.masteryUnlocked ? spec.values!.masteryCount : spec.values!.normalCount;
                const missileDmg = this.masteryUnlocked ? spec.values!.masteryDmg : spec.values!.normalDmg;
                
                for (let i = 0; i < count; i++) {
                    let offsetX: number, offsetY: number;
                    if (i === 2 && this.masteryUnlocked) {
                        const backAngle = this.angle + Math.PI;
                        offsetX = Math.cos(backAngle) * 12;
                        offsetY = Math.sin(backAngle) * 12;
                    } else {
                        const offsetAngle = this.angle + (i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2);
                        offsetX = Math.cos(offsetAngle) * 12;
                        offsetY = Math.sin(offsetAngle) * 12;
                    }
                    
                    const p = PoolManager.getProjectile(this.x + offsetX, this.y + offsetY, missileTarget, missileDmg, this, spec.values!.aoeRadius, spec.values!.speed, 0, false);
                    (p as any).isHoming = true;

                    if (!(state as any).projectileEvents) (state as any).projectileEvents = [];
                    (state as any).projectileEvents.push({
                        type: 'projectile',
                        col: this.col,
                        row: this.row,
                        targetId: missileTarget.id,
                        damage: missileDmg,
                        aoeRadius: spec.values!.aoeRadius,
                        projectileSpeed: spec.values!.speed,
                        isHoming: true,
                        offsetX: offsetX,
                        offsetY: offsetY
                    });
                }
                this.missileCooldown = this.masteryUnlocked ? spec.values!.masteryCooldown : spec.values!.normalCooldown;
            }
        }
    }

    public checkHover(mouseX: number, mouseY: number): boolean {
        const TS = Config.TILE_SIZE;
        return (Math.abs(mouseX - this.x) < TS / 2 && Math.abs(mouseY - this.y) < TS / 2);
    }
}

export function drawRangeCircle(
    g: PIXI.Graphics,
    x: number,
    y: number,
    range: number,
    color: string | number
): void {
    const parsedColor = typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color;
    g.circle(x, y, range).stroke({ color: parsedColor, alpha: 0.5, width: 2 });
    g.circle(x, y, range).fill({ color: parsedColor, alpha: 0.08 });
}
