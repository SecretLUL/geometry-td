/*
 * @file: frontend/src/js/entities/towers/base-tower-renderer.ts
 * @purpose: Handles visual rendering details and PIXI.js drawing instructions for the Base Tower.
 * @dependencies: config, base-tower, types, pixi.js
 * @last_update: 2026-07-01 / Refactored rendering logic from base-tower.ts
 */
import * as PIXI from "pixi.js";
import { Config, TowerData } from "../../core/config";
import type { Tower } from "./base-tower";

export class BaseTowerRenderer {
  private tower: Tower;

  constructor(tower: Tower) {
    this.tower = tower;
  }

  /**
   * Performs the detailed PIXI.js drawing instructions for the Base Tower base or turret.
   * @param g The PIXI Graphics context.
   * @param part The tower component to draw: "base" or "turret".
   */
  public drawPixi(g: PIXI.Graphics, part: "base" | "turret"): void {
    const TS = Config.TILE_SIZE;

    let scale = 1;
    if (this.tower.constructionTimer > 0) {
      const progress = 1 - this.tower.constructionTimer / this.tower.constructionDuration;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

      if (part === "base") {
        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: "#4cc9f0", alpha: 0.3, width: 6 });

        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: "#4cc9f0", alpha: 1, width: 3 });
      }
    }

    if (part === "base") {
      const halfBase = TS / 2 - 5;
      let baseColor = this.tower.currentColor;

      if (this.tower.specialization) {
        const spec = TowerData[this.tower.type].specializations[this.tower.specialization];
        if (spec) baseColor = spec.color;
      }

      g.roundRect(
        -halfBase * scale,
        -halfBase * scale,
        halfBase * 2 * scale,
        halfBase * 2 * scale,
        4
      ).fill({ color: baseColor });

      g.rect(
        (-halfBase + 4) * scale,
        (-halfBase + 4) * scale,
        (halfBase * 2 - 8) * scale,
        (halfBase * 2 - 8) * scale
      ).stroke({ color: 0xffffff, alpha: 0.1, width: 1 });

      if (this.tower.specialization === "heavy") {
        const s = 6 * scale;
        g.rect(-halfBase * scale, -halfBase * scale, s, s).fill({ color: "#636e72" });
        g.rect((halfBase - 6) * scale, -halfBase * scale, s, s).fill({ color: "#636e72" });
        g.rect(-halfBase * scale, (halfBase - 6) * scale, s, s).fill({ color: "#636e72" });
        g.rect((halfBase - 6) * scale, (halfBase - 6) * scale, s, s).fill({ color: "#636e72" });

        if (this.tower.masteryUnlocked) {
          const radius = 1.5 * scale;
          g.circle((-halfBase + 3) * scale, (-halfBase + 3) * scale, radius).fill({
            color: "#ffd700",
          });
          g.circle((halfBase - 3) * scale, (-halfBase + 3) * scale, radius).fill({
            color: "#ffd700",
          });
          g.circle((-halfBase + 3) * scale, (halfBase - 3) * scale, radius).fill({
            color: "#ffd700",
          });
          g.circle((halfBase - 3) * scale, (halfBase - 3) * scale, radius).fill({
            color: "#ffd700",
          });
        }
      }

      // Level Badge
      if (this.tower.level > 1 && this.tower.pixiLevelText) {
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

        let borderColor = this.tower.currentColor;
        if (this.tower.level >= Config.TOWER_MASTERY_LEVEL) borderColor = "#ffd700";
        else if (this.tower.level >= Config.TOWER_SPECIALIZATION_LEVEL) borderColor = "#ff9f43";

        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const hx = badgeX + size * Math.cos(angle);
          const hy = badgeY + size * Math.sin(angle);
          if (i === 0) g.moveTo(hx, hy);
          else g.lineTo(hx, hy);
        }
        g.closePath();

        g.stroke({ color: borderColor, width: 1.5 });

        this.tower.pixiLevelText.text = this.tower.level.toString();
        this.tower.pixiLevelText.position.set(badgeX, badgeY);
        if (this.tower.level >= Config.TOWER_MASTERY_LEVEL) {
          this.tower.pixiLevelText.style.fill = "#ffd700";
        } else if (this.tower.level >= Config.TOWER_SPECIALIZATION_LEVEL) {
          this.tower.pixiLevelText.style.fill = "#ff9f43";
        } else {
          this.tower.pixiLevelText.style.fill = "#ffffff";
        }
        this.tower.pixiLevelText.visible = true;
      } else if (this.tower.pixiLevelText) {
        this.tower.pixiLevelText.visible = false;
      }
    }

    if (part === "turret") {
      const turretColor2 =
        this.tower.specialization === "heavy"
          ? "#636e72"
          : this.tower.specialization === "missiles"
            ? "#ff7675"
            : "#fff";

      // Draw turret body
      g.circle(0, 0, 10 * scale)
        .fill({ color: turretColor2 })
        .stroke({ color: 0x000000, alpha: 0.3, width: 1 });

      // barrel
      if (this.tower.specialization === "heavy") {
        g.rect(0, -5 * scale, 18 * scale, 10 * scale)
          .fill({ color: "#1e272e" })
          .stroke({ color: "#636e72", width: 1 });
        g.rect(16 * scale, -7 * scale, 4 * scale, 14 * scale).fill({ color: "#1e272e" });
      } else {
        g.rect(0, -3 * scale, 15 * scale, 6 * scale).fill({
          color: this.tower.specialization === "missiles" ? "#2d3436" : "#ddd",
        });
      }

      if (this.tower.specialization === "missiles") {
        g.rect(-5 * scale, -14 * scale, 12 * scale, 6 * scale).fill({ color: "#fca311" });
        g.rect(-5 * scale, 8 * scale, 12 * scale, 6 * scale).fill({ color: "#fca311" });

        g.moveTo(7 * scale, -14 * scale)
          .lineTo(11 * scale, -11 * scale)
          .lineTo(7 * scale, -8 * scale)
          .fill({ color: "#ff3366" });
        g.moveTo(7 * scale, 8 * scale)
          .lineTo(11 * scale, 11 * scale)
          .lineTo(7 * scale, 14 * scale)
          .fill({ color: "#ff3366" });

        if (this.tower.masteryUnlocked) {
          g.rect(-12 * scale, -4 * scale, 8 * scale, 8 * scale).fill({ color: "#2d3436" });
          g.circle(-8 * scale, 0, 3 * scale).fill({ color: "#ff3366" });
        }
      }
    }
  }
}
