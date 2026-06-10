/*
 * @file: frontend/src/js/entities/towers/generator-tower.ts
 * @purpose: Economy tower that generates gold over time during waves and offers Investment Bank and Industrial Production upgrade paths.
 * @dependencies: config, state, base-tower, utils, types, pool
 */
import { Config, TowerData, TowerBalancer, getTowerPurchaseCost } from "../../core/config";
import { state } from "../../core/state";
import { createExplosion, createCoinBurst } from "../../fx/fx";
import { Tower } from "./base-tower";

import { PoolManager } from "../../core/pool";
import { socket } from "../../core/multiplayer/context";
import { Multiplayer } from "../../core/multiplayer/index";
import * as PIXI from "pixi.js";

export class GeneratorTower extends Tower {
  public pixiOrbitGraphics?: PIXI.Graphics;

  constructor(col: number, row: number) {
    super(col, row);
    this.type = "Generator";
    const data = TowerData["Generator"];
    this.range = data.baseRange;
    this.damage = data.baseDamage;
    this.fireRate = data.baseFireRate;
    const existingCount = state.towers
      ? state.towers.filter((t) => t.type === "Generator" && !t.isPredicted).length
      : 0;
    const purchaseCost = getTowerPurchaseCost(this.type, existingCount);
    this.totalSpent = purchaseCost;
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
    if (!this.pixiOrbitGraphics) {
      this.pixiOrbitGraphics = new PIXI.Graphics();
      this.pixiSprite.addChild(this.pixiOrbitGraphics);
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
        PoolManager.getFloatingText(this.x, this.y - 20, floatingText, "#26de81");
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

      if (updateUICallback) updateUICallback();
      return true;
    }
    return false;
  }

  public override updatePixi(): void {
    super.updatePixi();
    const time = state.animTime || 0;

    // Generator Tower rotates continuously to denote production
    if (this.constructionTimer <= 0) {
      this.angle = time * 0.0015;
      if (this.pixiTurretGraphics) {
        this.pixiTurretGraphics.position.set(0, 0);
      }
      if (this.pixiOrbitGraphics && this.masteryUnlocked) {
        this.pixiOrbitGraphics.rotation = time * 0.001;
      }
    } else {
      const progress = 1 - this.constructionTimer / this.constructionDuration;
      // Spin coin rapidly during construction
      this.angle = time * 0.003 * (1.5 - progress * 0.5);

      if (this.pixiTurretGraphics) {
        const coinY = -30 * (1 - progress);
        this.pixiTurretGraphics.position.set(0, coinY);
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
        g.stroke({ color: "#26de81", alpha: 0.3, width: 6 });

        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: "#26de81", alpha: 1, width: 3 });

        // Holographic concentric pulsing blueprint hexagons
        const pulse = 0.5 + 0.5 * Math.sin(state.animTime * 0.003);
        const r = (TS / 2 - 6) * scale;

        const drawHex = (radius: number, alpha: number) => {
          for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.closePath();
          g.stroke({ color: "#26de81", alpha: alpha, width: 1 });
        };

        drawHex(r, 0.15 + pulse * 0.08);
        drawHex(r * 0.7, 0.1 + pulse * 0.05);

        // Sweeping digital 3D printer laser scanline
        const scanY = -r + 2 * r * ((state.animTime * 0.0008) % 1.0);
        const halfW = Math.sqrt(r * r - scanY * scanY) || 0;
        if (halfW > 0) {
          g.moveTo(-halfW, scanY)
            .lineTo(halfW, scanY)
            .stroke({ color: "#26de81", alpha: 0.75, width: 1.5 });
          g.rect(-halfW, scanY - 1, halfW * 2, 2).fill({ color: "#26de81", alpha: 0.2 });
        }
      }
    }

    if (part === "base") {
      const r = (TS / 2 - 6) * scale;
      let baseColor = this.currentColor;

      if (this.specialization) {
        const spec = TowerData[this.type].specializations[this.specialization];
        if (spec) baseColor = spec.color;
      }

      // Draw Hexagonal base
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill({ color: baseColor });
      g.stroke({ color: 0xffffff, alpha: 0.25, width: 1 });

      // Green grid lines inside the base
      g.moveTo(-r, 0)
        .lineTo(r, 0)
        .moveTo(0, -r)
        .lineTo(0, r)
        .stroke({ color: "#26de81", alpha: 0.25, width: 1.5 });

      // Draw level badge
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
        else if (this.level >= Config.TOWER_SPECIALIZATION_LEVEL) borderColor = "#26de81";

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
          this.pixiLevelText.style.fill = "#26de81";
        else this.pixiLevelText.style.fill = "#ffffff";
        this.pixiLevelText.visible = true;
      } else if (this.pixiLevelText) {
        this.pixiLevelText.visible = false;
      }
    }

    if (part === "turret") {
      const coinRadius = 10 * scale;
      let coinColor = "#ffd700"; // Gold coin
      let strokeColor = "#00b894";

      if (this.specialization === "industrial") {
        coinColor = "#26de81"; // Industrial Green Coin
        strokeColor = "#ffffff";
      } else if (this.specialization === "bank") {
        coinColor = "#ffeaa7"; // Pastel Golden/Yellow Bank Coin
        strokeColor = "#e17055";
      }

      // Central rotating coin
      g.circle(0, 0, coinRadius)
        .fill({ color: coinColor })
        .stroke({ color: strokeColor, width: 1.5 });

      // Inner dollar sign design (rotated with container, so it rotates!)
      g.moveTo(0, -coinRadius + 3.5).lineTo(0, coinRadius - 3.5);
      g.stroke({ color: strokeColor, width: 1.5 });

      // If mastery is unlocked, draw floating outer orbit rings and nodes
      if (this.pixiOrbitGraphics) {
        this.pixiOrbitGraphics.clear();
        if (this.masteryUnlocked && this.constructionTimer <= 0) {
          const orbitRadius = coinRadius + 5;
          this.pixiOrbitGraphics
            .circle(0, 0, orbitRadius)
            .stroke({ color: coinColor, alpha: 0.35, width: 1.2 });
          this.pixiOrbitGraphics.circle(orbitRadius, 0, 2).fill({ color: "#ffffff" });
          this.pixiOrbitGraphics.circle(-orbitRadius, 0, 2).fill({ color: "#ffffff" });
          this.pixiOrbitGraphics.visible = true;
        } else {
          this.pixiOrbitGraphics.visible = false;
        }
      }
    }
  }

  public override getEffectiveGoldIncome(): number {
    let goldAmount = 5 + this.level * 10;
    if (this.specialization === "industrial") {
      const spec = TowerData["Generator"].specializations["industrial"];
      const multiplier = this.masteryUnlocked
        ? spec.multipliers!.masteryIncome
        : spec.multipliers!.normalIncome;
      goldAmount = Math.floor(goldAmount * multiplier);
    } else if (this.specialization === "bank") {
      const spec = TowerData["Generator"].specializations["bank"];
      goldAmount = this.masteryUnlocked ? spec.values!.masteryGold : spec.values!.normalGold;
    }
    const boosterDmgMultiplier = this.getBoosterDamageMultiplier();
    return Math.floor(goldAmount * boosterDmgMultiplier);
  }

  public override update(): void {
    if (this.constructionTimer > 0) {
      this.constructionTimer--;
      if (this.constructionTimer === 0) {
        this.redrawPixiBase();
        this.redrawPixiTurret();
        // satisfying complete coin burst & green shockwave
        createCoinBurst(this.x, this.y, 12);
        PoolManager.getShockwave(this.x, this.y, 40, "#26de81");
      } else {
        const spawnChance = state.perfMode ? 0.15 : 0.45;
        if (Math.random() < spawnChance) {
          const px = this.x + (Math.random() - 0.5) * 20;
          const py = this.y + (Math.random() - 0.5) * 20;
          const color = this.currentColor || "#26de81";
          // negative gravity causing particles to float upwards like bubbles
          const p = PoolManager.getParticle(px, py, color, 0.2, Math.random() * 1.5 + 0.5, -0.01);
          p.vy = -Math.random() * 0.3 - 0.2;
          p.vx = (Math.random() - 0.5) * 0.4;
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

    // Only generate tick gold and decrease cooldown during active waves (prevents AFK farming)
    if (state.isWaveActive) {
      if (this.fireCooldown > 0) {
        this.fireCooldown--;
      }

      if (this.fireCooldown <= 0) {
        // Bank specialization does not generate gold during ticks, only at wave-end
        if (this.specialization !== "bank") {
          const goldAmount = this.getEffectiveGoldIncome();

          // Authoritative gold addition (host only or singleplayer)
          const isAlone = !socket || !socket.connected;
          if (state.isHost || isAlone) {
            state.gold += goldAmount;
            state.totalGoldEarned += goldAmount;
            state.totalGoldFromInterest += goldAmount; // Reuse state field to track generator gold

            if (state.isHost) {
              Multiplayer.emitSyncGold(state.gold);
            }
          }

          // Visual feedbacks on both host and client
          createCoinBurst(this.x, this.y, 6);
          PoolManager.getFloatingText(this.x, this.y - 20, `+${goldAmount}g`, "#ffd700");
        }

        // Reset cooldown
        this.fireCooldown = this.getEffectiveFireRate();
      }
    }

    this.updatePixi();
  }

  public override _acquireAndFire(): void {
    // Generator Tower is passive and doesn't target/shoot at enemies.
  }
}
