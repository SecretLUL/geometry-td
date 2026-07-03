/*
 * @file: frontend/src/js/entities/towers/base-tower.ts
 * @purpose: Defines the base class and shared visual helper utilities for all defenses.
 * @dependencies: config, state, fx, projectiles, utils, types, pool
 * @last_update: 2026-05-29 / v2.0.2 - Made Base Tower attack speed scale linearly and removed visual antennas.
 */
import { Config, TowerData, TowerBalancer } from "../../core/config";
import { state } from "../../core/state";
import { createExplosion } from "../../fx/fx";
import { getDistanceSq, getNearbyEnemies } from "../../core/utils";
import { Enemy, TowerType, TowerSpecialization, Tower as ITower } from "../../types";
import { PoolManager } from "../../core/pool";
import * as PIXI from "pixi.js";
import { app, entitiesContainer } from "../../core/game/viewport";
import { Multiplayer } from "../../core/multiplayer/context";
import { BaseTowerRenderer } from "./base-tower-renderer";
import {
  recalculateAllBoosts as recalculateAllBoostsHelper,
  recalculateBoosts as recalculateBoostsHelper,
} from "./booster/booster-calc";

export function getPlayerColor(playerIndex: number): number {
  if (playerIndex === 0) return 0x00f2fe; // Cyan
  if (playerIndex === 1) return 0xff007f; // Pink
  if (playerIndex === 2) return 0xffb703; // Yellow
  if (playerIndex === 3) return 0x00ff88; // Green
  return 0xffffff;
}

export function getPlayerColorString(playerIndex: number): string {
  if (playerIndex === 0) return "#00f2fe"; // Cyan
  if (playerIndex === 1) return "#ff007f"; // Pink
  if (playerIndex === 2) return "#ffb703"; // Yellow
  if (playerIndex === 3) return "#00ff88"; // Green
  return "#ffffff";
}

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

  public cachedRange: number;
  public cachedDamage: number;
  public cachedFireRate: number;
  public cachedIsBoosted: boolean;
  public cachedBoosterDamageMult: number;
  public visualBooster: ITower | null;

  public pixiSprite?: PIXI.Container;
  public pixiBoostGraphics?: PIXI.Graphics;
  public pixiBaseGraphics?: PIXI.Graphics;
  public pixiTurretGraphics?: PIXI.Graphics;
  public pixiLevelText?: PIXI.Text;
  public pixiStunSprite?: PIXI.Text;
  public pixiGhostContainer?: PIXI.Container;
  public ownerIndex: number;
  public pixiOwnerGlowGraphics?: PIXI.Graphics;
  public renderer?: any;

  constructor(col: number, row: number) {
    const data = TowerData["Base"];
    this.col = col;
    this.row = row;
    this.x = col * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    this.y = row * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    this.type = "Base";
    this.kills = 0;
    this.damageDealt = 0;

    this.ownerIndex = Multiplayer.myPlayerIndex !== undefined ? Multiplayer.myPlayerIndex : 0;
    this.level = 1;

    const levelStats = TowerBalancer.getStats(this.type, 1);
    this.range = levelStats.range;
    this.damage = levelStats.damage;
    this.fireRate = levelStats.fireRate;
    this.upgradeCost = levelStats.upgradeCost;

    this.fireCooldown = 0;
    this.missileCooldown = 0;
    this.projectileSpeed = data.projectileSpeed || Config.PROJECTILE_SPEED;
    this.stunTimer = 0;

    this.target = null;
    this.angle = 0;
    this.recoil = 0;
    this.totalSpent = data.baseCost;
    this.specialization = null;
    this.masteryUnlocked = false;

    this.colors = data.colors;
    this.currentColor = this.colors[0];

    this.constructionDuration = 90; // 3x slower: 1.5s at 60 FPS
    this.constructionTimer = this.constructionDuration;

    this.cachedRange = this.range;
    this.cachedDamage = this.damage;
    this.cachedFireRate = this.fireRate;
    this.cachedIsBoosted = false;
    this.cachedBoosterDamageMult = 1;
    this.visualBooster = null;

    if (this.constructor === Tower) {
      this.renderer = new BaseTowerRenderer(this);
    }

    this.initPixi();
  }

  public initPixi() {
    if (typeof window === "undefined" || !app || !app.renderer) return;
    const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";
    if (isHeadlessMode) return;

    if (this.constructor === Tower && !this.renderer) {
      this.renderer = new BaseTowerRenderer(this);
    }

    if (!this.pixiSprite) {
      this.pixiSprite = new PIXI.Container();
      entitiesContainer.addChild(this.pixiSprite);

      this.pixiBoostGraphics = new PIXI.Graphics();
      const radius = Config.TILE_SIZE / 2 - 2;
      this.pixiBoostGraphics.circle(0, 0, radius).fill({ color: 0xffa801, alpha: 0.5 });
      this.pixiBoostGraphics
        .circle(0, 0, radius + 2)
        .stroke({ color: 0xffa801, alpha: 1, width: 1.5 });
      this.pixiBoostGraphics.visible = false;
      this.pixiSprite.addChild(this.pixiBoostGraphics);

      this.pixiOwnerGlowGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiOwnerGlowGraphics);

      this.pixiBaseGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiBaseGraphics);

      this.pixiTurretGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiTurretGraphics);

      this.pixiLevelText = new PIXI.Text({
        text: "",
        style: { fontFamily: "Outfit", fontSize: 10, fill: "#ffffff", fontWeight: "bold" },
      });
      this.pixiLevelText.anchor.set(0.5);
      this.pixiSprite.addChild(this.pixiLevelText);

      this.pixiStunSprite = new PIXI.Text({
        text: "⚡",
        style: { fill: "yellow", fontSize: 24, fontWeight: "bold" } as any,
      });
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

    if (this.pixiOwnerGlowGraphics && this.pixiOwnerGlowGraphics.visible) {
      const pulse = 0.75 + Math.sin(Date.now() / 150) * 0.2;
      this.pixiOwnerGlowGraphics.alpha = pulse;
    }

    if (this.pixiBoostGraphics) {
      if (this.constructionTimer <= 0 && this.isBoosted()) {
        this.pixiBoostGraphics.visible = true;
        const pulse = 0.5 + 0.5 * Math.sin(state.animTime * 0.0025);
        this.pixiBoostGraphics.alpha = 0.3 + 0.3 * pulse;
        const baseRadius = Config.TILE_SIZE / 2 - 2;
        const scale = 1 + (pulse * 2) / baseRadius;
        this.pixiBoostGraphics.scale.set(scale);
      } else {
        this.pixiBoostGraphics.visible = false;
      }
    }

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

  public drawOwnerGlow(): void {
    if (!this.pixiOwnerGlowGraphics) return;
    this.pixiOwnerGlowGraphics.clear();

    const activeCount = state.playerSlots
      ? state.playerSlots.filter((id) => id !== null).length
      : 1;
    if (activeCount <= 1) {
      this.pixiOwnerGlowGraphics.visible = false;
      return;
    }

    this.pixiOwnerGlowGraphics.visible = true;
    const color = getPlayerColor(this.ownerIndex);
    const radius = Config.TILE_SIZE / 2;

    // Draw neon outer glow circle (glow under tower base)
    this.pixiOwnerGlowGraphics.circle(0, 0, radius - 2).fill({ color, alpha: 0.12 });
    this.pixiOwnerGlowGraphics.circle(0, 0, radius - 2).stroke({ color, alpha: 0.75, width: 2 });
  }

  public redrawPixiBase(): void {
    if (!this.pixiBaseGraphics) return;
    this.pixiBaseGraphics.clear();
    this.drawPixi(this.pixiBaseGraphics, "base");
    this.drawOwnerGlow();
  }

  public redrawPixiTurret(): void {
    if (!this.pixiTurretGraphics) return;
    this.pixiTurretGraphics.clear();
    this.drawPixi(this.pixiTurretGraphics, "turret");
  }

  public getNearbyEnemies(x: number, y: number, radius: number): Enemy[] {
    return getNearbyEnemies(x, y, radius);
  }

  public static recalculateAllBoosts(): void {
    recalculateAllBoostsHelper();
  }

  public recalculateBoosts(): void {
    recalculateBoostsHelper(this);
  }

  public getEffectiveRange(): number {
    return this.cachedRange;
  }

  public getDamageWithSpecialization(): number {
    return this.damage;
  }

  public getBoosterDamageMultiplier(): number {
    return this.cachedBoosterDamageMult;
  }

  public getEffectiveDamage(): number {
    const multiplier = this.getBoosterDamageMultiplier();
    return Math.floor(this.getDamageWithSpecialization() * multiplier);
  }

  public getEffectiveGoldIncome(): number {
    return 0;
  }

  public getEffectiveFireRate(): number {
    return this.cachedFireRate;
  }

  public isBoosted(): boolean {
    return this.cachedIsBoosted;
  }

  public getDisplayDamage(): number | string {
    return this.getEffectiveDamage();
  }

  public getDisplayFireRate(): string {
    return (60 / this.getEffectiveFireRate()).toFixed(1);
  }

  public rescale(): void {
    this.x = this.col * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    this.y = this.row * Config.TILE_SIZE + Config.TILE_SIZE / 2;
    Tower.recalculateAllBoosts();
  }

  public upgrade(updateUICallback?: () => void, silent: boolean = false): boolean {
    if (this.level >= Config.TOWER_MAX_LEVEL) return false;
    if (state.infiniteGold || state.gold >= this.upgradeCost) {
      if (!state.infiniteGold) state.gold -= this.upgradeCost;
      this.totalSpent += this.upgradeCost;
      this.level++;

      const levelStats = TowerBalancer.getStats(this.type, this.level, this.specialization);
      this.damage = levelStats.damage;
      this.range = levelStats.range;
      this.fireRate = levelStats.fireRate;
      this.upgradeCost = levelStats.upgradeCost;

      this.currentColor = this.colors[Math.min(this.level - 1, this.colors.length - 1)];

      if (!silent) {
        PoolManager.getFloatingText(this.x, this.y - 20, `Level ${this.level}!`, "#4cc9f0");
        createExplosion(this.x, this.y, this.currentColor, 10);
      }

      if (this.level === Config.TOWER_MASTERY_LEVEL) {
        this.masteryUnlocked = true;
        if (!silent) {
          PoolManager.getFloatingText(this.x, this.y - 40, `MASTERY UNLOCKED!`, "#ffd700");
        }
      }

      this.redrawPixiBase();
      this.redrawPixiTurret();

      Tower.recalculateAllBoosts();

      if (updateUICallback) updateUICallback();
      return true;
    }
    return false;
  }

  public getSpecializationInfo(specId: TowerSpecialization, isMastery = false): string {
    const level = isMastery ? Config.TOWER_MASTERY_LEVEL : Config.TOWER_SPECIALIZATION_LEVEL;
    try {
      const stats = TowerBalancer.getStats(this.type, level, specId);
      const baseStats = TowerBalancer.getStats(this.type, level, null);

      if (specId === "missiles") {
        const cd = ((stats.missileCooldown || 240) / 60).toFixed(1).replace(/\.0$/, "");
        return `${stats.missileCount}x ${stats.missileDmg} DMG, ${cd}s CD`;
      }
      if (specId === "heavy") {
        const mult = (stats.damage / baseStats.damage).toFixed(1).replace(/\.0$/, "");
        return `${mult}x Schaden`;
      }
      if (specId === "ricochet") {
        const spd = (60 / stats.fireRate).toFixed(1).replace(/\.0$/, "");
        return `${stats.ricochetHits} Hits, ${spd}/s Speed`;
      }
      if (specId === "bounty") {
        const mult = (stats.damage / baseStats.damage).toFixed(1).replace(/\.0$/, "");
        const spd = (60 / stats.fireRate).toFixed(1).replace(/\.0$/, "");
        return `+${stats.bounty}g/Kill, ${mult}x DMG, ${spd}/s Speed`;
      }
      if (specId === "nuke") {
        const mult = (stats.damage / baseStats.damage).toFixed(1).replace(/\.0$/, "");
        const aoeMult = ((stats.aoeRadius || 1) / (baseStats.aoeRadius || 1))
          .toFixed(1)
          .replace(/\.0$/, "");
        return `Radioaktive Strahlung, ${aoeMult}x Radius, ${mult}x DMG`;
      }
      if (specId === "cluster") {
        return isMastery
          ? `${stats.clusterCount} Mini-Bomben`
          : `Fragment-AOE, ${stats.clusterCount} Mini-Bomben`;
      }
      if (specId === "highvolt") {
        const mult = (stats.damage / baseStats.damage).toFixed(1).replace(/\.0$/, "");
        return `${mult}x Schaden`;
      }
      if (specId === "stun") {
        const dur = ((stats.stunDuration || 0) / 60).toFixed(1).replace(/\.0$/, "");
        return `${dur}s Betäubung`;
      }
      if (specId === "meltdown") {
        return `Meltdown: ${stats.meltdownDmg} DMG (Radius ${stats.meltdownRadius})`;
      }
      if (specId === "refraction") {
        return `Kettenstrahl: ${stats.splits} Extraziele (${Math.round((stats.damageMultiplier || 0.75) * 100)}% DMG)`;
      }
      if (specId === "frequency") {
        return `+${Math.round((stats.speedBoost || 0) * 100)}% Angriffsgeschwindigkeit`;
      }
      if (specId === "amplitude") {
        return `+${Math.round((stats.dmgBoost || 0) * 100)}% DMG, +${Math.round((stats.rangeBoost || 0) * 100)}% Reichweite`;
      }
      if (specId === "bank") {
        return `+${stats.bankGold}g am Wellenende`;
      }
      if (specId === "industrial") {
        const mult = ((stats.goldIncome || 0) / (baseStats.goldIncome || 1))
          .toFixed(1)
          .replace(/\.0$/, "");
        return `${mult}x Gold-Einkommen`;
      }
    } catch (e) {
      console.error("Error formatting specialization info:", e);
    }

    const spec = TowerData[this.type].specializations[specId];
    if (!spec) return "Keine";
    return isMastery ? spec.masteryDesc : spec.desc;
  }

  public getSpecializations(): { id: TowerSpecialization; name: string; desc: string }[] {
    const specs = TowerData[this.type].specializations;
    return Object.keys(specs).map((key) => ({
      id: key as TowerSpecialization,
      name: specs[key].name,
      desc: specs[key].desc,
    }));
  }

  public applySpecialization(specId: TowerSpecialization, silent: boolean = false): void {
    this.specialization = specId;
    this.upgrade(undefined, silent);
  }

  public drawPixi(g: PIXI.Graphics, part: "base" | "turret"): void {
    if (this.constructor === Tower) {
      if (!this.renderer) {
        this.renderer = new BaseTowerRenderer(this);
      }
      this.renderer.drawPixi(g, part);
    }
  }

  public update(): void {
    if (this.constructionTimer > 0) {
      this.constructionTimer--;
      if (this.constructionTimer === 0) {
        this.redrawPixiBase();
        this.redrawPixiTurret();
        Tower.recalculateAllBoosts();
      } else {
        if (Math.random() < 0.25) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 16;
          const px = this.x + Math.cos(angle) * dist;
          const py = this.y + Math.sin(angle) * dist;

          let color = "#4cc9f0";
          if (this.type === "Bomb") color = Math.random() < 0.5 ? "#ff4757" : "#57606f";
          else if (this.type === "Tesla") color = Math.random() < 0.7 ? "#00ffff" : "#81ecec";
          else if (this.type === "Prisma") {
            const colors = ["#ffe100", "#df00ff", "#00ffd0"];
            color = colors[Math.floor(Math.random() * colors.length)];
          } else if (this.type === "Sniper") color = Math.random() < 0.6 ? "#a0d8ef" : "#ffd700";

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
      this.updatePixi();
      return;
    }
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (this.missileCooldown > 0) this.missileCooldown--;

    if (!state.enemies || state.enemies.length === 0) {
      this.target = null;
      this.updatePixi();
      return;
    }

    const rangeSq = this.getEffectiveRange() * this.getEffectiveRange();
    const needsTarget =
      !this.target ||
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
    const effRange = this.getEffectiveRange();
    const rangeSq = effRange * effRange;
    const nearby = getNearbyEnemies(this.x, this.y, effRange);

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
        const incomingDmg = (enemy as any).incomingDamage || 0;

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
        const dmg = this.getEffectiveDamage();
        const fr = this.getEffectiveFireRate();

        const aoe = this.aoeRadius || 0;
        PoolManager.getProjectile(
          this.x,
          this.y,
          this.target,
          dmg,
          this,
          aoe,
          this.projectileSpeed
        );

        if (!(state as any).projectileEvents) (state as any).projectileEvents = [];
        (state as any).projectileEvents.push({
          type: "projectile",
          col: this.col,
          row: this.row,
          targetId: this.target.id,
          damage: dmg,
          aoeRadius: aoe,
          projectileSpeed: this.projectileSpeed,
          isHoming: false,
        });

        this.fireCooldown = fr;
        this.recoil = 6;
      }
    }

    if (this.specialization === "missiles" && this.missileCooldown <= 0) {
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
        const stats = TowerBalancer.getStats(this.type, this.level, this.specialization);
        const count = stats.missileCount || 3;
        const missileDmg = stats.missileDmg || 8000;
        const missileAoe = stats.missileAoe || 30;
        const missileSpeed = stats.missileSpeed || 6.0;

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

          const p = PoolManager.getProjectile(
            this.x + offsetX,
            this.y + offsetY,
            missileTarget,
            missileDmg,
            this,
            missileAoe,
            missileSpeed,
            0,
            false
          );
          (p as any).isHoming = true;

          if (!(state as any).projectileEvents) (state as any).projectileEvents = [];
          (state as any).projectileEvents.push({
            type: "projectile",
            col: this.col,
            row: this.row,
            targetId: missileTarget.id,
            damage: missileDmg,
            aoeRadius: missileAoe,
            projectileSpeed: missileSpeed,
            isHoming: true,
            offsetX: offsetX,
            offsetY: offsetY,
          });
        }
        this.missileCooldown = stats.missileCooldown || 240;
      }
    }
  }

  public checkHover(mouseX: number, mouseY: number): boolean {
    const TS = Config.TILE_SIZE;
    return Math.abs(mouseX - this.x) < TS / 2 && Math.abs(mouseY - this.y) < TS / 2;
  }

  public destroy(): void {
    if (this.pixiSprite) {
      this.pixiSprite.destroy({ children: true });
      this.pixiSprite = undefined;
    }
    // Cache will be recalculated by the seller or server sync
  }
}

export function drawRangeCircle(
  g: PIXI.Graphics,
  x: number,
  y: number,
  range: number,
  color: string | number
): void {
  const parsedColor = typeof color === "string" ? parseInt(color.replace("#", "0x"), 16) : color;
  g.circle(x, y, range).stroke({ color: parsedColor, alpha: 0.5, width: 2 });
  g.circle(x, y, range).fill({ color: parsedColor, alpha: 0.08 });
}
