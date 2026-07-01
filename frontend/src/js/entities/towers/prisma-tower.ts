/*
 * @file: frontend/src/js/entities/towers/prisma-tower.ts
 * @purpose: High-tier focusing defense utilizing continuous locking beams, structural meltdowns, and ray refraction to melt targets.
 * @dependencies: config, state, fx, base-tower, utils, types, pool, prisma-renderer
 */
import { Config, TowerData, TowerBalancer } from "../../core/config";
import { state } from "../../core/state";
import { createExplosion } from "../../fx/fx";
import { Tower } from "./base-tower";
import { getDistanceSq } from "../../core/utils";
import { Enemy, TowerSpecialization } from "../../types";
import { PoolManager } from "../../core/pool";
import * as PIXI from "pixi.js";
import { PrismaTowerRenderer } from "./prisma-renderer";

const checkedEnemies = new Set<number>();

export class PrismaTower extends Tower {
  public lockTimer: number;
  public beamTarget: Enemy | null;
  public renderer: PrismaTowerRenderer;

  constructor(col: number, row: number) {
    super(col, row);
    this.type = "Prisma";
    const data = TowerData["Prisma"];
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

    // Instantiate rendering delegate
    this.renderer = new PrismaTowerRenderer(this);

    this.initPixi();
    this.redrawPixiBase();
    this.redrawPixiTurret();
  }

  // Getter for backward compatibility (e.g. in ghost-tower.ts)
  public get pixiBeamsGraphics(): PIXI.Graphics | undefined {
    return this.renderer.pixiBeamsGraphics;
  }

  public override initPixi(): void {
    super.initPixi();
    if (this.renderer) {
      this.renderer.initPixi();
    }
  }

  public override upgrade(updateUICallback?: () => void): boolean {
    if (this.level >= Config.TOWER_MAX_LEVEL) return false;
    if (state.infiniteGold || state.gold >= this.upgradeCost) {
      if (!state.infiniteGold) state.gold -= this.upgradeCost;
      this.totalSpent += this.upgradeCost;
      this.level++;

      const data = TowerData["Prisma"];
      this.damage += data.damagePerLevel;
      this.range += data.rangePerLevel;

      this.currentColor = this.colors[Math.min(this.level - 1, this.colors.length - 1)];

      this.upgradeCost = TowerBalancer.getUpgradeCost(this.type, this.level, this.upgradeCost);

      PoolManager.getFloatingText(this.x, this.y - 20, `Level ${this.level}!`, "#ffea00");
      createExplosion(this.x, this.y, this.currentColor, 10);

      if (this.level === Config.TOWER_MASTERY_LEVEL) {
        this.masteryUnlocked = true;
        PoolManager.getFloatingText(this.x, this.y - 40, `MASTERY UNLOCKED!`, "#ffd700");
      }

      this.redrawPixiBase();
      this.redrawPixiTurret();

      Tower.recalculateAllBoosts();

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
    const needsTarget =
      !this.target ||
      this.target.hp <= 0 ||
      this.target.deadMarked ||
      getDistanceSq(this.target.x, this.target.y, this.x, this.y) > rangeSq ||
      !state.enemiesSet.has(this.target);

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
    if (this.renderer) {
      this.renderer.updatePixi();
    }
  }

  public override findOptimalTarget(): Enemy | null {
    const effRange = this.getEffectiveRange();
    const rangeSq = effRange * effRange;
    const nearby = this.getNearbyEnemies(this.x, this.y, effRange);

    let bestEnemy: Enemy | null = null;
    checkedEnemies.clear();

    for (let i = 0; i < nearby.length; i++) {
      const enemy = nearby[i];
      if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;

      if (checkedEnemies.has(enemy.id)) continue;
      checkedEnemies.add(enemy.id);

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
    if (!spec) return "Keine";
    return isMastery ? spec.masteryDesc : spec.desc;
  }

  public override getSpecializations(): { id: TowerSpecialization; name: string; desc: string }[] {
    const specs = TowerData[this.type].specializations;
    return Object.keys(specs).map((key) => ({
      id: key as TowerSpecialization,
      name: specs[key].name,
      desc: specs[key].desc,
    }));
  }

  public override getEffectiveDamage(): number {
    const multiplier = this.getBoosterDamageMultiplier();
    return this.getDamageWithSpecialization() * multiplier;
  }

  public override getDisplayDamage(): string {
    const baseDps = this.getEffectiveDamage() * 60;
    const data = TowerData["Prisma"];
    const minDps = Math.floor(baseDps * data.prismaMinMultiplier!);
    const maxDps = Math.floor(baseDps * data.prismaMaxMultiplier!);
    return `${minDps}-${maxDps}`;
  }

  public override getDisplayFireRate(): string {
    return "CONT";
  }

  public override drawPixi(g: PIXI.Graphics, part: "base" | "turret"): void {
    if (this.renderer) {
      this.renderer.drawPixi(g, part);
    }
  }

  public triggerMeltdown(target: Enemy): void {
    if ((target as any).meltdownExploded) return;
    (target as any).meltdownExploded = true;

    const spec = TowerData[this.type].specializations["meltdown"];
    const aoeRadius = this.masteryUnlocked ? spec.values!.masteryRadius : spec.values!.normalRadius;
    const aoeDmg = this.masteryUnlocked ? spec.values!.masteryDmg : spec.values!.normalDmg;

    const radiusSq = aoeRadius * aoeRadius;
    const nearby = this.getNearbyEnemies(target.x, target.y, aoeRadius);
    checkedEnemies.clear();

    for (let i = 0; i < nearby.length; i++) {
      const enemy = nearby[i];
      if (!enemy || enemy === target || enemy.hp <= 0 || enemy.deadMarked) continue;
      if (checkedEnemies.has(enemy.id)) continue;
      checkedEnemies.add(enemy.id);

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

    PoolManager.getShockwave(target.x, target.y, aoeRadius, "#ff4500");

    createExplosion(target.x, target.y, "#ff4500", 20);
    createExplosion(target.x, target.y, "#ffd700", 10);

    PoolManager.getFloatingText(target.x, target.y - 15, "MELTDOWN!", "#ff4500");
  }

  public override _acquireAndFire(): void {
    if (this.specialization === "refraction") {
      const data = TowerData["Prisma"];
      const progress = Math.min(1.0, this.lockTimer / data.prismaChargeFrames!);
      const multiplier =
        data.prismaMinMultiplier! +
        (data.prismaMaxMultiplier! - data.prismaMinMultiplier!) * (progress * progress);
      const finalDmg = this.getEffectiveDamage() * multiplier;

      const effRange = this.getEffectiveRange();
      const rangeSq = effRange * effRange;
      const nearby = this.getNearbyEnemies(this.x, this.y, effRange);
      let splits = 0;
      const spec = TowerData[this.type].specializations["refraction"];
      const maxSplits = this.masteryUnlocked
        ? spec.values!.masterySplits
        : spec.values!.normalSplits;

      checkedEnemies.clear();

      for (let i = 0; i < nearby.length; i++) {
        const enemy = nearby[i];
        if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
        if (checkedEnemies.has(enemy.id)) continue;
        checkedEnemies.add(enemy.id);

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

      const data = TowerData["Prisma"];
      const progress = Math.min(1.0, this.lockTimer / data.prismaChargeFrames!);
      const multiplier =
        data.prismaMinMultiplier! +
        (data.prismaMaxMultiplier! - data.prismaMinMultiplier!) * (progress * progress);
      const finalDmg = this.getEffectiveDamage() * multiplier;

      const actualDmg = this.target.takeDamage(finalDmg, this);
      this.damageDealt += actualDmg;

      const isTargetDying = this.target.hp <= 0 || this.target.deadMarked;
      if (this.specialization === "meltdown" && isTargetDying) {
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

  public override destroy(): void {
    if (this.renderer) {
      this.renderer.destroy();
    }
    super.destroy();
  }
}
