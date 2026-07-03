/*
 * @file: frontend/src/js/entities/towers/tesla-tower.ts
 * @purpose: Melee AOE electricity tower executing high-voltage discharges and stunning chains.
 * @dependencies: config, state, fx, base-tower, utils, types, pool
 * @last_update: 2026-06-01 / v2.0.1 - Prevent stunning the Boss/Mutterschiff if its shield is active.
 */
import { Config, TowerData, TowerBalancer } from "../../../core/config";
import { state } from "../../../core/state";
import { createExplosion } from "../../../fx/fx";
import { Tower } from "../base-tower";
import { getDistanceSq } from "../../../core/utils";
import { Enemy, TowerSpecialization } from "../../../types";
import { PoolManager } from "../../../core/pool";
import * as PIXI from "pixi.js";

// ─── Tesla Tower (Melee AOE) ──────────────────────────────────────────────────
export class TeslaTower extends Tower {
  public auraTime: number;
  private _enemiesInRangeBuffer?: Enemy[];
  private _targetIdsBuffer?: number[];

  public pixiCoreGraphics?: PIXI.Graphics;
  public pixiRing1Graphics?: PIXI.Graphics;
  public pixiRing2Graphics?: PIXI.Graphics;
  public pixiOrbitGraphics?: PIXI.Graphics;
  public pixiPulseGraphics?: PIXI.Graphics;
  public pixiDischargeGraphics?: PIXI.Graphics;

  constructor(col: number, row: number) {
    super(col, row);
    this.type = "Tesla";
    const data = TowerData["Tesla"];
    const levelStats = TowerBalancer.getStats(this.type, 1);
    this.range = levelStats.range;
    this.damage = levelStats.damage;
    this.fireRate = levelStats.fireRate;
    this.totalSpent = data.baseCost;
    this.upgradeCost = levelStats.upgradeCost;
    this.colors = data.colors;
    this.currentColor = this.colors[0];
    this.auraTime = 0;

    this.constructionDuration = 195; // 3x slower: 3.0s at 60 FPS
    this.constructionTimer = this.constructionDuration;

    this.initPixi();
    this.redrawPixiBase();
    this.redrawPixiTurret();
  }

  public override initPixi(): void {
    super.initPixi();
    if (typeof window === "undefined" || !this.pixiSprite) return;
    if (!this.pixiCoreGraphics) {
      this.pixiCoreGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiCoreGraphics);
    }
    if (!this.pixiRing1Graphics) {
      this.pixiRing1Graphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiRing1Graphics);
    }
    if (!this.pixiRing2Graphics) {
      this.pixiRing2Graphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiRing2Graphics);
    }
    if (!this.pixiOrbitGraphics) {
      this.pixiOrbitGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiOrbitGraphics);
    }
    if (!this.pixiPulseGraphics) {
      this.pixiPulseGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiPulseGraphics);
    }
    if (!this.pixiDischargeGraphics) {
      this.pixiDischargeGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiDischargeGraphics);
    }
  }

  public override upgrade(updateUICallback?: () => void): boolean {
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

      PoolManager.getFloatingText(this.x, this.y - 20, `Level ${this.level}!`, "#4cc9f0");
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

  public override updatePixi(): void {
    super.updatePixi();
    const time = state.animTime;

    if (this.constructionTimer <= 0) {
      if (this.auraTime > 0) this.auraTime--;

      if (this.pixiCoreGraphics && this.masteryUnlocked) {
        const pulseOffset = Math.sin(time * 0.015) * 1.0;
        this.pixiCoreGraphics.scale.set(1.0 + pulseOffset / 8);
      }
      if (this.pixiRing1Graphics && this.masteryUnlocked) {
        this.pixiRing1Graphics.rotation = time * 0.0025;
      }
      if (this.pixiRing2Graphics && this.masteryUnlocked) {
        this.pixiRing2Graphics.rotation = -time * 0.0015;
      }
      if (this.pixiOrbitGraphics && this.masteryUnlocked) {
        this.pixiOrbitGraphics.rotation = time * 0.009;
      }
      if (this.pixiPulseGraphics) {
        const timeVal = time * 0.005;
        this.pixiPulseGraphics.scale.set((Math.sin(timeVal) * 2 + 8) / 8);
      }
    }

    if (this.pixiDischargeGraphics) {
      if (this.auraTime > 0) {
        this.pixiDischargeGraphics.clear();
        const maxDuration = 35;
        const progressVal = 1 - this.auraTime / maxDuration;
        const auraPulse = progressVal * this.getEffectiveRange();
        const auraColor =
          this.specialization === "highvolt"
            ? "#a29bfe"
            : this.specialization === "stun"
              ? "#81ecec"
              : "#00ffff";
        const alpha = 1 - progressVal;

        this.pixiDischargeGraphics
          .circle(0, 0, auraPulse)
          .stroke({ color: auraColor, width: 2.0, alpha: alpha });
        this.pixiDischargeGraphics.visible = true;
      } else if (this.pixiDischargeGraphics.visible) {
        this.pixiDischargeGraphics.clear();
        this.pixiDischargeGraphics.visible = false;
      }
    }
  }

  public override drawPixi(g: PIXI.Graphics, part: "base" | "turret"): void {
    const TS = Config.TILE_SIZE;
    let scale = 1;
    let progress = 0;

    if (this.constructionTimer > 0) {
      progress = 1 - this.constructionTimer / this.constructionDuration;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

      if (part === "base") {
        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: "#00ffff", alpha: 0.3, width: 6 });

        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: "#00ffff", alpha: 1, width: 3 });
      }
    }

    if (part === "base") {
      const r = (TS / 2 - 6) * scale;
      let baseColor = this.currentColor;

      if (this.specialization) {
        const spec = TowerData[this.type].specializations[this.specialization];
        if (spec) baseColor = spec.color;
      }

      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI / 4) * i;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();

      g.fill({ color: baseColor });

      // Base pattern: circuits
      g.moveTo(-r, 0)
        .lineTo(r, 0)
        .moveTo(0, -r)
        .lineTo(0, r)
        .stroke({ color: 0xffffff, alpha: 0.2, width: 1 });

      // Expanding charging octagonal segments during construction
      if (this.constructionTimer > 0) {
        const pulseRadius = r * (0.3 + 0.7 * progress);
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI / 4) * i;
          const px = Math.cos(angle) * pulseRadius;
          const py = Math.sin(angle) * pulseRadius;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.stroke({ color: "#00ffff", width: 1.5 });
      }

      if (this.masteryUnlocked) {
        const mstColor =
          this.specialization === "highvolt"
            ? "#a29bfe"
            : this.specialization === "stun"
              ? "#81ecec"
              : "#00ffff";
        const rotOffset = state.animTime * 0.001; // slow continuous rotation of outer base arcs

        // 1. Extra outer ring segments - beautifully rotating
        for (let i = 0; i < 4; i++) {
          const startAngle = (i * Math.PI) / 2 + rotOffset;
          const endAngle = (i * Math.PI) / 2 + Math.PI / 4 + rotOffset;
          g.arc(0, 0, r + 2.5 * scale, startAngle, endAngle);
          g.stroke({ color: mstColor, width: 2 });
        }

        // 2. High-tech cybernetic power grid traces on the octagonal base
        g.circle(0, 0, r * 0.75).stroke({ color: mstColor, alpha: 0.22, width: 1 });
        g.circle(0, 0, r * 0.45).stroke({ color: mstColor, alpha: 0.12, width: 1 });

        // Floating energy node points shifting slowly
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 2) * i + state.animTime * 0.0004;
          const px = Math.cos(angle) * r * 0.6;
          const py = Math.sin(angle) * r * 0.6;
          g.circle(px, py, 1.5).fill({ color: mstColor, alpha: 0.75 });
        }
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

        g.fill({ color: "#0f172a", alpha: 0.85 });

        let borderColor = "#00ffff";
        if (this.specialization === "highvolt") borderColor = "#a29bfe";
        if (this.specialization === "stun") borderColor = "#81ecec";

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

    if (part === "turret") {
      const r = (TS / 2 - 6) * scale;
      const coilY = this.constructionTimer > 0 ? -12 * scale * (1 - progress) : 0;
      const coilRadius = this.constructionTimer > 0 ? 8 * scale * progress : 8 * scale;

      let coilColor1 = "#ffffff";
      let coilColor2 = "#00ffff";
      if (this.specialization === "highvolt") {
        coilColor1 = "#a29bfe";
        coilColor2 = "#6c5ce7";
      } else if (this.specialization === "stun") {
        coilColor1 = "#81ecec";
        coilColor2 = "#00cec9";
      }

      if (this.pixiCoreGraphics) {
        this.pixiCoreGraphics.clear();
        if (this.masteryUnlocked && this.constructionTimer <= 0) {
          this.pixiCoreGraphics
            .circle(0, coilY, coilRadius)
            .fill({ color: coilColor2, alpha: 0.8 });
          this.pixiCoreGraphics.circle(0, coilY, coilRadius * 0.55).fill({ color: "#ffffff" });
          this.pixiCoreGraphics
            .circle(0, coilY, coilRadius)
            .stroke({ color: coilColor1, width: 2 });
          this.pixiCoreGraphics
            .circle(0, coilY, coilRadius + 2.5)
            .stroke({ color: coilColor2, alpha: 0.45, width: 1.5 });
        } else {
          this.pixiCoreGraphics.circle(0, coilY, coilRadius).fill({ color: coilColor2 });
          this.pixiCoreGraphics.circle(0, coilY, coilRadius * 0.5).fill({ color: coilColor1 });
          this.pixiCoreGraphics.circle(0, coilY, coilRadius).stroke({ color: 0xffffff, width: 2 });
        }
        this.pixiCoreGraphics.visible = true;
      }

      if (this.pixiRing1Graphics) {
        this.pixiRing1Graphics.clear();
        if (this.masteryUnlocked && this.constructionTimer <= 0) {
          const shieldRad = r + 8;
          this.pixiRing1Graphics.arc(0, coilY, shieldRad, 0, Math.PI * 0.4);
          this.pixiRing1Graphics.arc(0, coilY, shieldRad, Math.PI, Math.PI * 1.4);
          this.pixiRing1Graphics.stroke({ color: coilColor2, width: 2, alpha: 0.7 });
          this.pixiRing1Graphics.visible = true;
        } else {
          this.pixiRing1Graphics.visible = false;
        }
      }

      if (this.pixiRing2Graphics) {
        this.pixiRing2Graphics.clear();
        if (this.masteryUnlocked && this.constructionTimer <= 0) {
          const shieldRad = r + 8;
          this.pixiRing2Graphics.arc(0, coilY, shieldRad - 3.5, 0, Math.PI * 0.3);
          this.pixiRing2Graphics.arc(0, coilY, shieldRad - 3.5, Math.PI, Math.PI * 1.3);
          this.pixiRing2Graphics.stroke({ color: "#ffffff", width: 1.5, alpha: 0.5 });
          this.pixiRing2Graphics.visible = true;
        } else {
          this.pixiRing2Graphics.visible = false;
        }
      }

      if (this.pixiOrbitGraphics) {
        this.pixiOrbitGraphics.clear();
        if (this.masteryUnlocked && this.constructionTimer <= 0) {
          const orbitRadius = coilRadius + 6;
          for (let i = 0; i < 3; i++) {
            const orbitAngle = (i * Math.PI * 2) / 3;
            const ox = Math.cos(orbitAngle) * orbitRadius;
            const oy = coilY + Math.sin(orbitAngle) * orbitRadius;
            this.pixiOrbitGraphics.circle(ox, oy, 2.5).fill({ color: "#ffffff" });
            this.pixiOrbitGraphics.circle(ox, oy, 2.5).stroke({ color: coilColor2, width: 1.5 });
          }
          this.pixiOrbitGraphics.visible = true;
        } else {
          this.pixiOrbitGraphics.visible = false;
        }
      }

      if (this.pixiPulseGraphics) {
        this.pixiPulseGraphics.clear();
        this.pixiPulseGraphics.circle(0, 0, 8).stroke({ color: 0xffffff, alpha: 0.4, width: 1 });
      }
    }
  }

  public override getSpecializations(): { id: TowerSpecialization; name: string; desc: string }[] {
    const specs = TowerData[this.type].specializations;
    return Object.keys(specs).map((key) => ({
      id: key as TowerSpecialization,
      name: specs[key].name,
      desc: specs[key].desc,
    }));
  }

  public override getDamageWithSpecialization(): number {
    return this.damage;
  }

  public override getDisplayDamage(): number {
    return this.getEffectiveDamage();
  }

  public override update(): void {
    if (this.constructionTimer > 0) {
      super.update();
      return;
    }

    if (this.stunTimer > 0) {
      this.stunTimer--;
      this.updatePixi();
      return;
    }
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (this.missileCooldown > 0) this.missileCooldown--;

    if (!state.enemies || state.enemies.length === 0) {
      this.updatePixi();
      return;
    }

    this._acquireAndFire();
    this.updatePixi();
  }

  public override _acquireAndFire(): void {
    if (this.fireCooldown <= 0) {
      const effRange = this.getEffectiveRange();
      const rangeSq = effRange * effRange;

      if (!this._enemiesInRangeBuffer) this._enemiesInRangeBuffer = [];
      const enemiesInRange = this._enemiesInRangeBuffer;
      enemiesInRange.length = 0;

      const nearby = this.getNearbyEnemies(this.x, this.y, effRange);
      for (let i = 0; i < nearby.length; i++) {
        const enemy = nearby[i];
        if (enemy.hp <= 0 || enemy.deadMarked) continue;
        if (getDistanceSq(enemy.x, enemy.y, this.x, this.y) <= rangeSq) {
          enemiesInRange.push(enemy);
        }
      }

      if (enemiesInRange.length > 0) {
        const dmg = this.getEffectiveDamage();
        let stunDuration = 0;

        if (this.specialization === "stun") {
          const stats = TowerBalancer.getStats(this.type, this.level, this.specialization);
          stunDuration = stats.stunDuration || 0;
        }

        if (!this._targetIdsBuffer) this._targetIdsBuffer = [];
        const targetIds = this._targetIdsBuffer;
        targetIds.length = 0;

        let arcColor = "#00ffff";
        if (this.specialization === "highvolt") arcColor = "#a29bfe";
        else if (this.specialization === "stun") arcColor = "#81ecec";

        for (let i = 0; i < enemiesInRange.length; i++) {
          const enemy = enemiesInRange[i];
          targetIds.push(enemy.id);
          const actualDmg = enemy.takeDamage(dmg, this);
          this.damageDealt += actualDmg;
          if (stunDuration > 0 && (!enemy.stunCooldown || enemy.stunCooldown <= 0)) {
            if (!(enemy.typeName === "Boss" && enemy.shieldActive)) {
              enemy.stunTimer = Math.max(enemy.stunTimer || 0, stunDuration);
              const spec = TowerData[this.type].specializations["stun"];
              enemy.stunCooldown = stunDuration + spec.values!.cooldown;
            }
          }
          if (enemy.hp <= 0 && !enemy.deadMarked) {
            enemy.deadMarked = true;
            this.kills++;
          }

          // Spawn visual electrical discharge arc from the tower center to the enemy center
          PoolManager.getTeslaArc(this.x, this.y, enemy.x, enemy.y, arcColor);

          if (this.masteryUnlocked) {
            // Level 20 Mastery Discharge: Double Jagged Arc + Branching static leaps
            PoolManager.getTeslaArc(this.x, this.y, enemy.x, enemy.y, arcColor);

            // Primary jumps to a secondary nearby target (forking electricity visually)
            let closestChainTarget: Enemy | null = null;
            let closestDistSq = 90 * 90; // chain range max 90px
            for (let j = 0; j < state.enemies.length; j++) {
              const potential = state.enemies[j];
              if (potential.id === enemy.id || potential.hp <= 0 || potential.deadMarked) continue;
              const dx = potential.x - enemy.x;
              const dy = potential.y - enemy.y;
              const distSq = dx * dx + dy * dy;
              if (distSq < closestDistSq) {
                closestDistSq = distSq;
                closestChainTarget = potential;
              }
            }

            if (closestChainTarget) {
              // Fork visual lightning discharge
              PoolManager.getTeslaArc(
                enemy.x,
                enemy.y,
                closestChainTarget.x,
                closestChainTarget.y,
                arcColor
              );
            }
          }
        }

        let fr = this.getEffectiveFireRate();
        if (this.specialization === "stun") fr = Math.floor(fr * 1.3);

        this.fireCooldown = fr;
        this.auraTime = 35;

        const explosionColor =
          this.specialization === "highvolt"
            ? "#a29bfe"
            : this.specialization === "stun"
              ? "#81ecec"
              : "#00ffff";
        createExplosion(this.x, this.y, explosionColor, 5);

        if (!state.projectileEvents) state.projectileEvents = [];
        state.projectileEvents.push({
          type: "tesla",
          col: this.col,
          row: this.row,
          targetIds: [...targetIds],
        });
      }
    }
  }
}
