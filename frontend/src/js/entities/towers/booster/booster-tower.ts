/*
 * @file: frontend/src/js/entities/towers/booster-tower.ts
 * @purpose: Support tower that amplifies nearby towers (range, fire rate, damage) and draws connecting laser beams.
 * @dependencies: config, state, base-tower, utils, types, pixi.js
 */
import { Config, TowerData, TowerBalancer } from "../../../core/config";
import { state } from "../../../core/state";
import { createExplosion } from "../../../fx/fx";
import { Tower } from "../base-tower";
import { getDistanceSq } from "../../../core/utils";
import * as PIXI from "pixi.js";
import { PoolManager } from "../../../core/pool";
import { entitiesContainer } from "../../../core/game/viewport";

export class BoosterTower extends Tower {
  public pixiBeamsGraphics?: PIXI.Graphics;
  public pixiCoreGraphics?: PIXI.Graphics;
  public pixiRingGraphics?: PIXI.Graphics;
  public pixiMasteryGraphics?: PIXI.Graphics;

  constructor(col: number, row: number) {
    super(col, row);
    this.type = "Booster";
    const data = TowerData["Booster"];
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
    if (typeof window === "undefined" || !this.pixiSprite) return;
    if (this.type !== "Booster") return;

    if (!this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics = new PIXI.Graphics();
      entitiesContainer.addChildAt(this.pixiBeamsGraphics, 0); // Render beams behind/underneath the towers for clean visuals

      // Clean up when this tower's sprite is destroyed
      this.pixiSprite.once("destroy", () => {
        if (this.pixiBeamsGraphics) {
          this.pixiBeamsGraphics.destroy();
          this.pixiBeamsGraphics = undefined;
        }
      });
    }

    if (!this.pixiCoreGraphics) {
      this.pixiCoreGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiCoreGraphics);
    }
    if (!this.pixiRingGraphics) {
      this.pixiRingGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiRingGraphics);
    }
    if (!this.pixiMasteryGraphics) {
      this.pixiMasteryGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiMasteryGraphics);
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
        PoolManager.getFloatingText(this.x, this.y - 20, floatingText, "#ff9f43");
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

  public override updatePixi(): void {
    super.updatePixi();
    const time = state.animTime;

    if (this.constructionTimer <= 0) {
      if (this.pixiCoreGraphics) {
        this.pixiCoreGraphics.position.set(0, 0);
        this.pixiCoreGraphics.rotation = time * 0.001;
        const pulseOffset = Math.sin(time * 0.0015) * 1.5;
        this.pixiCoreGraphics.scale.set(1.0 + pulseOffset / 8);
      }
      if (this.pixiRingGraphics) {
        this.pixiRingGraphics.rotation = -time * 0.0008;
        this.pixiRingGraphics.scale.set(1);
        this.pixiRingGraphics.alpha = 1;
      }
      if (this.pixiMasteryGraphics && this.masteryUnlocked) {
        this.pixiMasteryGraphics.rotation = time * 0.0004;
      }
    } else {
      const progress = 1 - this.constructionTimer / this.constructionDuration;
      if (this.pixiCoreGraphics) {
        const coreY = -30 * (1 - progress);
        this.pixiCoreGraphics.position.set(0, coreY);
        this.pixiCoreGraphics.rotation = time * 0.002 * (1.5 - progress * 0.5);
        this.pixiCoreGraphics.scale.set(1);
      }
      if (this.pixiRingGraphics) {
        this.pixiRingGraphics.rotation = -time * 0.0016 * (1.5 - progress * 0.5);
        this.pixiRingGraphics.scale.set(progress);
        this.pixiRingGraphics.alpha = progress;
      }
    }

    if (!this.pixiBeamsGraphics) return;
    this.pixiBeamsGraphics.clear();

    if (state.towers) {
      const effRange = this.getEffectiveRange();
      const rangeSq = effRange * effRange;

      if (this.constructionTimer > 0) {
        // Sonar range broadcast ripple
        const rippleProgress = (time * 0.001) % 1.0;
        const rippleRadius = rippleProgress * effRange;
        const rippleAlpha = 0.2 * (1 - rippleProgress);
        this.pixiBeamsGraphics
          .circle(this.x, this.y, rippleRadius)
          .stroke({ color: 0xff9f43, width: 1.5, alpha: rippleAlpha });

        // Scanning connections (drawn in a single path for performance & safety)
        const flicker = Math.random() < 0.1 ? 0.05 : 0.12 + 0.08 * Math.sin(time * 0.005);
        let hasLines = false;
        for (const t of state.towers) {
          if (
            t !== this &&
            t.type !== "Booster" &&
            (t.constructionTimer === undefined || t.constructionTimer <= 0)
          ) {
            const distSq = getDistanceSq(this.x, this.y, t.x, t.y);
            if (distSq <= rangeSq) {
              this.pixiBeamsGraphics.moveTo(this.x, this.y).lineTo(t.x, t.y);
              hasLines = true;
            }
          }
        }
        if (hasLines) {
          this.pixiBeamsGraphics.stroke({ color: 0xff9f43, width: 1, alpha: flicker });
        }
      } else {
        let beamColor = 0xff9f43; // Neon orange
        if (this.specialization === "frequency") {
          beamColor = 0xffa801; // Glowing amber/orange
        } else if (this.specialization === "amplitude") {
          beamColor = 0xff3f34; // Intense red-orange
        }
        for (const t of state.towers) {
          // Buff other fully-constructed towers in range
          if (
            t !== this &&
            t.type !== "Booster" &&
            (t.constructionTimer === undefined || t.constructionTimer <= 0)
          ) {
            const distSq = getDistanceSq(this.x, this.y, t.x, t.y);
            if (distSq <= rangeSq) {
              if (t.visualBooster === this) {
                const pulse = 0.5 + 0.5 * Math.sin(state.animTime * 0.003 + t.x);
                const alpha = 0.35 + 0.25 * pulse;
                const width = 1.5 + 1.0 * pulse;
                this.pixiBeamsGraphics
                  .moveTo(this.x, this.y)
                  .lineTo(t.x, t.y)
                  .stroke({ color: beamColor, width: width, alpha: alpha });

                this.pixiBeamsGraphics
                  .circle(t.x, t.y, 3.5)
                  .fill({ color: "#ffffff", alpha: alpha });
              }
            }
          }
        }
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
        g.stroke({ color: "#ff9f43", alpha: 0.3, width: 6 });

        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: "#ff9f43", alpha: 1, width: 3 });

        // Concentric structural framing pulses
        const pulse = 0.5 + 0.5 * Math.sin(state.animTime * 0.002);
        g.circle(0, 0, (TS / 2) * scale).stroke({
          color: "#ff9f43",
          alpha: 0.1 + pulse * 0.05,
          width: 1,
        });
        g.circle(0, 0, (TS / 3) * scale).stroke({
          color: "#ff9f43",
          alpha: 0.05 + pulse * 0.05,
          width: 1,
        });
      }
    }

    if (part === "base") {
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

        g.fill({ color: "#0f172a", alpha: 0.85 });

        let borderColor = this.currentColor;
        if (this.level >= Config.TOWER_MASTERY_LEVEL) borderColor = "#ffd700";
        else if (this.level >= Config.TOWER_SPECIALIZATION_LEVEL) borderColor = "#ff9f43";

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
        if (this.level >= Config.TOWER_MASTERY_LEVEL) this.pixiLevelText.style.fill = "#ffd700";
        else if (this.level >= Config.TOWER_SPECIALIZATION_LEVEL)
          this.pixiLevelText.style.fill = "#ff9f43";
        else this.pixiLevelText.style.fill = "#ffffff";
        this.pixiLevelText.visible = true;
      } else if (this.pixiLevelText) {
        this.pixiLevelText.visible = false;
      }
    }

    if (part === "turret") {
      const r = (TS / 2 - 6) * scale;
      let themeColor = this.currentColor;
      if (this.specialization) {
        const spec = TowerData[this.type].specializations[this.specialization];
        if (spec) themeColor = spec.color;
      }

      // Central core (static diamond template drawn once on pixiCoreGraphics)
      if (this.pixiCoreGraphics) {
        this.pixiCoreGraphics.clear();
        const coreRadius = 8 * scale;
        this.pixiCoreGraphics
          .moveTo(coreRadius, 0)
          .lineTo(0, coreRadius)
          .lineTo(-coreRadius, 0)
          .lineTo(0, -coreRadius)
          .closePath();
        this.pixiCoreGraphics.fill({ color: "#ffffff", alpha: 0.9 });
        this.pixiCoreGraphics.stroke({ color: themeColor, width: 2 });
      }

      // Orbiting rings (static ring template drawn once on pixiRingGraphics)
      if (this.pixiRingGraphics) {
        this.pixiRingGraphics.clear();
        const ringRadius = r * 0.8;
        this.pixiRingGraphics
          .circle(0, 0, ringRadius)
          .stroke({ color: themeColor, alpha: 0.35, width: 1.5 });

        // Rotating satellite dots on the ring (3 nodes at static 120-deg offsets)
        for (let i = 0; i < 3; i++) {
          const dotAngle = (i * Math.PI * 2) / 3;
          const dx = Math.cos(dotAngle) * ringRadius;
          const dy = Math.sin(dotAngle) * ringRadius;
          this.pixiRingGraphics.circle(dx, dy, 2.5).fill({ color: "#ffffff" });
          this.pixiRingGraphics.circle(dx, dy, 2.5).stroke({ color: themeColor, width: 1.5 });
        }
      }

      // Mastery level outer visual additions (static outer ring and brackets drawn once on pixiMasteryGraphics)
      if (this.pixiMasteryGraphics) {
        this.pixiMasteryGraphics.clear();
        if (this.masteryUnlocked && this.constructionTimer <= 0) {
          const outerRingRad = r * 1.15;
          this.pixiMasteryGraphics
            .circle(0, 0, outerRingRad)
            .stroke({ color: themeColor, alpha: 0.5, width: 2 });

          for (let i = 0; i < 4; i++) {
            const startAngle = (i * Math.PI) / 2;
            const endAngle = (i * Math.PI) / 2 + Math.PI / 6;
            this.pixiMasteryGraphics.arc(0, 0, outerRingRad + 2, startAngle, endAngle);
            this.pixiMasteryGraphics.stroke({ color: "#ffffff", width: 2 });
          }
          this.pixiMasteryGraphics.visible = true;
        } else {
          this.pixiMasteryGraphics.visible = false;
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
        Tower.recalculateAllBoosts();
        // Complete explosion burst and ring shockwave
        createExplosion(this.x, this.y, this.currentColor || "#ff9f43", 15);
        PoolManager.getShockwave(this.x, this.y, 50, this.currentColor || "#ff9f43");
      } else {
        const progress = 1 - this.constructionTimer / this.constructionDuration;
        const spawnChance = state.perfMode ? 0.15 : 0.45;
        if (Math.random() < spawnChance) {
          const angle = state.animTime * 0.005 + Math.random() * (Math.PI * 2);
          const radius = (1 - progress) * 48 + 4;
          const px = this.x + Math.cos(angle) * radius;
          const py = this.y + Math.sin(angle) * radius;
          const color = this.currentColor || "#ff9f43";
          const p = PoolManager.getParticle(px, py, color, 0, Math.random() * 1.5 + 0.5);

          const speed = 1.5;
          const toCenterX = this.x - px;
          const toCenterY = this.y - py;
          const len = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
          if (len > 0) {
            p.vx = (toCenterX / len) * speed + -Math.sin(angle) * 0.3;
            p.vy = (toCenterY / len) * speed + Math.cos(angle) * 0.3;
          }
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

  public override destroy(): void {
    if (this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics.destroy();
      this.pixiBeamsGraphics = undefined;
    }
    super.destroy();
  }
}
