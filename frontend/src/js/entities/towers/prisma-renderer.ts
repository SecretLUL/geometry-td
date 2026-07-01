/*
 * @file: frontend/src/js/entities/towers/prisma-renderer.ts
 * @purpose: Encapsulates detailed PIXI.js rendering code and visual effects for the Prisma Tower.
 * @dependencies: config, state, fx, base-tower, utils, types, pool
 */
import * as PIXI from "pixi.js";
import { Config, TowerData } from "../../core/config";
import { state } from "../../core/state";
import { createExplosion } from "../../fx/fx";
import { getDistanceSq } from "../../core/utils";
import { Enemy } from "../../types";
import { app, entitiesContainer } from "../../core/game/viewport";
import type { PrismaTower } from "./prisma-tower";

const checkedEnemies = new Set<number>();

export class PrismaTowerRenderer {
  private tower: PrismaTower;

  public pixiBeamsGraphics?: PIXI.Graphics;
  public pixiBasePlatformGraphics?: PIXI.Graphics;
  public pixiShardGraphicsList: PIXI.Graphics[] = [];
  public pixiReactorPoolGraphics?: PIXI.Graphics;
  public pixiRing1Graphics?: PIXI.Graphics;
  public pixiRing2Graphics?: PIXI.Graphics;
  public pixiStandardRingGraphics?: PIXI.Graphics;
  public pixiTurretCoreGraphics?: PIXI.Graphics;
  public pixiTurretOrbitGraphics?: PIXI.Graphics;

  constructor(tower: PrismaTower) {
    this.tower = tower;
  }

  public initPixi(): void {
    if (typeof window === "undefined" || !app || !app.renderer) return;
    const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";
    if (isHeadlessMode) return;

    if (!this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics = new PIXI.Graphics();
      entitiesContainer.addChild(this.pixiBeamsGraphics);
    }

    if (!this.tower.pixiSprite) return;

    if (!this.pixiBasePlatformGraphics) {
      this.pixiBasePlatformGraphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChildAt(this.pixiBasePlatformGraphics, 0); // behind turret
    }
    if (this.pixiShardGraphicsList.length === 0) {
      for (let i = 0; i < 3; i++) {
        const shard = new PIXI.Graphics();
        this.tower.pixiSprite.addChild(shard);
        this.pixiShardGraphicsList.push(shard);
      }
    }
    if (!this.pixiReactorPoolGraphics) {
      this.pixiReactorPoolGraphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiReactorPoolGraphics);
    }
    if (!this.pixiRing1Graphics) {
      this.pixiRing1Graphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiRing1Graphics);
    }
    if (!this.pixiRing2Graphics) {
      this.pixiRing2Graphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiRing2Graphics);
    }
    if (!this.pixiStandardRingGraphics) {
      this.pixiStandardRingGraphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiStandardRingGraphics);
    }
    if (!this.pixiTurretCoreGraphics) {
      this.pixiTurretCoreGraphics = new PIXI.Graphics();
      if (this.tower.pixiTurretGraphics) {
        this.tower.pixiTurretGraphics.addChild(this.pixiTurretCoreGraphics);
      }
    }
    if (!this.pixiTurretOrbitGraphics) {
      this.pixiTurretOrbitGraphics = new PIXI.Graphics();
      if (this.tower.pixiTurretGraphics) {
        this.tower.pixiTurretGraphics.addChild(this.pixiTurretOrbitGraphics);
      }
    }
  }

  public updatePixi(): void {
    if (this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics.clear();
      this.drawBeams(this.pixiBeamsGraphics);
    }

    const time = state.animTime;
    if (this.tower.constructionTimer <= 0) {
      if (
        this.pixiShardGraphicsList &&
        this.pixiShardGraphicsList.length > 0 &&
        this.tower.masteryUnlocked
      ) {
        const baseR = Config.TILE_SIZE / 2 - 4;
        for (let i = 0; i < 3; i++) {
          const shardG = this.pixiShardGraphicsList[i];
          const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6;
          const bob = Math.sin(time * 0.004 + (i * Math.PI * 2) / 3) * 2.5;
          const dist = baseR + 5 + bob;
          const sx = Math.cos(angle) * dist;
          const sy = Math.sin(angle) * dist;
          shardG.position.set(sx, sy);
        }
      }

      if (this.pixiReactorPoolGraphics && this.tower.masteryUnlocked) {
        const pulseSize = 1 + (Math.sin(time * 0.003) * 1.5) / (Config.TILE_SIZE / 4);
        this.pixiReactorPoolGraphics.scale.set(pulseSize);
      }

      if (this.pixiRing1Graphics && this.tower.masteryUnlocked) {
        this.pixiRing1Graphics.rotation = time * 0.0003;
      }
      if (this.pixiRing2Graphics && this.tower.masteryUnlocked) {
        this.pixiRing2Graphics.rotation = -time * 0.0004;
      }

      if (this.pixiStandardRingGraphics && !this.tower.masteryUnlocked) {
        this.pixiStandardRingGraphics.rotation = -time * 0.003;
      }

      if (this.tower.masteryUnlocked) {
        const isFiring =
          this.tower.target && state.enemiesSet.has(this.tower.target) && this.tower.target.hp > 0;
        const rotSpeed = isFiring ? time * 0.0035 : time * 0.001;

        if (this.pixiTurretCoreGraphics) {
          const corePulse = 1.0 + 0.15 * Math.sin(time * 0.005);
          this.pixiTurretCoreGraphics.scale.set(corePulse);
        }
        if (this.pixiTurretOrbitGraphics) {
          this.pixiTurretOrbitGraphics.rotation = rotSpeed;
        }
      }
    }
  }

  public drawPixi(g: PIXI.Graphics, part: "base" | "turret"): void {
    const TS = Config.TILE_SIZE;
    let scale = 1;
    let progress = 0;

    if (this.tower.constructionTimer > 0) {
      progress = 1 - this.tower.constructionTimer / this.tower.constructionDuration;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

      if (part === "base") {
        const hueVal = (state.animTime + progress * 360) % 360;
        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: `hsl(${hueVal}, 100%, 65%)`, alpha: 0.3, width: 6 });

        g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
        g.stroke({ color: `hsl(${hueVal}, 100%, 65%)`, alpha: 1, width: 3 });
      }
    }

    if (part === "base") {
      let baseColor = this.tower.currentColor;
      if (this.tower.specialization) {
        const spec = TowerData[this.tower.type].specializations[this.tower.specialization];
        if (spec) baseColor = spec.color;
      }

      const baseR = (TS / 2 - 4) * scale;
      const rotateOffset = this.tower.constructionTimer > 0 ? (1 - progress) * Math.PI * 2 : 0;

      if (this.tower.masteryUnlocked && this.tower.constructionTimer <= 0) {
        // REDESIGN: Heavy Triangular Mastery Platform with Circuit Traces (drawn once)
        if (this.pixiBasePlatformGraphics) {
          this.pixiBasePlatformGraphics.clear();
          const platformG = this.pixiBasePlatformGraphics;
          for (let i = 0; i < 3; i++) {
            const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6;
            const px = Math.cos(angle) * baseR;
            const py = Math.sin(angle) * baseR;
            if (i === 0) platformG.moveTo(px, py);
            else platformG.lineTo(px, py);
          }
          platformG.closePath();
          platformG.fill({ color: baseColor });

          // Neon inner circuit triangle
          const innerR = baseR * 0.7;
          for (let i = 0; i < 3; i++) {
            const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6;
            const px = Math.cos(angle) * innerR;
            const py = Math.sin(angle) * innerR;
            if (i === 0) platformG.moveTo(px, py);
            else platformG.lineTo(px, py);
          }
          platformG.closePath();
          platformG.stroke({ color: 0xffffff, alpha: 0.35, width: 1.5 * scale });
        }

        // Central Glowing Reactor Containment Pool (drawn once, scaled dynamically)
        if (this.pixiReactorPoolGraphics) {
          this.pixiReactorPoolGraphics.clear();
          const poolG = this.pixiReactorPoolGraphics;
          const basePulseSize = TS / 4;
          poolG.circle(0, 0, basePulseSize).fill({ color: baseColor, alpha: 0.15 });
          poolG.circle(0, 0, basePulseSize).stroke({ color: baseColor, alpha: 0.4, width: 1 });
          poolG.circle(0, 0, basePulseSize * 0.6).fill({ color: "#ffffff", alpha: 0.25 });
        }

        // Counter-Rotating Calibration Rings (drawn once, rotated dynamically)
        if (this.pixiRing1Graphics && this.pixiRing2Graphics) {
          this.pixiRing1Graphics.clear();
          this.pixiRing2Graphics.clear();

          const r1 = (TS / 3) * scale;
          const r2 = (TS / 3 + 3.5) * scale;

          // Ring 1 (Dashed arcs)
          for (let j = 0; j < 4; j++) {
            const aStart = (j * Math.PI) / 2;
            const aEnd = aStart + Math.PI / 4;
            this.pixiRing1Graphics.moveTo(Math.cos(aStart) * r1, Math.sin(aStart) * r1);
            this.pixiRing1Graphics.arc(0, 0, r1, aStart, aEnd);
          }
          this.pixiRing1Graphics.stroke({ color: baseColor, alpha: 0.6, width: 1 });

          // Ring 2 (Dashed arcs)
          for (let j = 0; j < 4; j++) {
            const aStart = (j * Math.PI) / 2;
            const aEnd = aStart + Math.PI / 5;
            this.pixiRing2Graphics.moveTo(Math.cos(aStart) * r2, Math.sin(aStart) * r2);
            this.pixiRing2Graphics.arc(0, 0, r2, aStart, aEnd);
          }
          this.pixiRing2Graphics.stroke({ color: 0xffffff, alpha: 0.45, width: 0.8 });
        }

        if (this.pixiShardGraphicsList && this.pixiShardGraphicsList.length > 0) {
          const parsedColor = parseInt(baseColor.replace("#", "0x"), 16);
          for (let i = 0; i < 3; i++) {
            const shardG = this.pixiShardGraphicsList[i];
            shardG.clear();
            const shardSize = 3.5;
            shardG
              .moveTo(0, -shardSize)
              .lineTo(shardSize, 0)
              .lineTo(0, shardSize)
              .lineTo(-shardSize, 0)
              .closePath()
              .fill({ color: parsedColor })
              .stroke({ color: 0xffffff, width: 1 });
            shardG.visible = true;
          }
        }
        if (this.pixiReactorPoolGraphics) this.pixiReactorPoolGraphics.visible = true;
        if (this.pixiRing1Graphics) this.pixiRing1Graphics.visible = true;
        if (this.pixiRing2Graphics) this.pixiRing2Graphics.visible = true;
        if (this.pixiStandardRingGraphics) this.pixiStandardRingGraphics.visible = false;
      } else {
        // Standard triangular base
        for (let i = 0; i < 3; i++) {
          const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6 + rotateOffset;
          const px = Math.cos(angle) * baseR;
          const py = Math.sin(angle) * baseR;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();

        g.fill({ color: baseColor });

        for (let i = 0; i < 3; i++) {
          const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6 + rotateOffset;
          const px = Math.cos(angle) * baseR;
          const py = Math.sin(angle) * baseR;
          if (i === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        }
        g.closePath();
        g.stroke({ color: 0xffffff, alpha: 0.2, width: 1.5 });

        // Spinning base charging ring (drawn once, rotated dynamically)
        if (this.pixiStandardRingGraphics) {
          this.pixiStandardRingGraphics.clear();
          const segments = 12;
          for (let i = 0; i < segments; i++) {
            if (i % 2 === 0) {
              const a1 = (i / segments) * Math.PI * 2;
              const a2 = ((i + 1) / segments) * Math.PI * 2;
              this.pixiStandardRingGraphics.moveTo(
                ((Math.cos(a1) * TS) / 3) * scale,
                ((Math.sin(a1) * TS) / 3) * scale
              );
              this.pixiStandardRingGraphics.arc(0, 0, (TS / 3) * scale, a1, a2);
            }
          }
          this.pixiStandardRingGraphics.stroke({ color: baseColor, width: 1 });
          this.pixiStandardRingGraphics.visible = true;
        }

        if (this.pixiShardGraphicsList) {
          for (const shardG of this.pixiShardGraphicsList) {
            shardG.visible = false;
          }
        }
        if (this.pixiReactorPoolGraphics) this.pixiReactorPoolGraphics.visible = false;
        if (this.pixiRing1Graphics) this.pixiRing1Graphics.visible = false;
        if (this.pixiRing2Graphics) this.pixiRing2Graphics.visible = false;
      }

      // Level indicator
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

        let borderColor = "#ffd700";
        if (this.tower.specialization === "meltdown") borderColor = "#e65f00";
        if (this.tower.specialization === "refraction") borderColor = "#00e699";

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
        this.tower.pixiLevelText.style.fill = borderColor;
        this.tower.pixiLevelText.visible = true;
      } else if (this.tower.pixiLevelText) {
        this.tower.pixiLevelText.visible = false;
      }
    }

    if (part === "turret") {
      const prismR = 10 * scale;

      if (this.tower.masteryUnlocked && this.tower.constructionTimer <= 0) {
        // REDESIGN: Levitating Cluster of Highly Polished Shards/Crystals

        // Central core crystal (drawn once on pixiTurretCoreGraphics)
        if (this.pixiTurretCoreGraphics) {
          this.pixiTurretCoreGraphics.clear();
          const cR = prismR * 1.15;
          this.pixiTurretCoreGraphics
            .moveTo(cR * 1.3, 0)
            .lineTo(-cR * 0.7, cR * 0.8)
            .lineTo(-cR * 0.4, 0)
            .lineTo(-cR * 0.7, -cR * 0.8)
            .closePath()
            .fill({ color: this.tower.currentColor, alpha: 0.95 })
            .stroke({ color: 0xffffff, width: 1.5 * scale });

          // White inner diamond glow
          this.pixiTurretCoreGraphics
            .moveTo(cR * 0.8, 0)
            .lineTo(-cR * 0.4, cR * 0.4)
            .lineTo(-cR * 0.2, 0)
            .lineTo(-cR * 0.4, -cR * 0.4)
            .closePath()
            .fill({ color: "#ffffff", alpha: 0.8 });

          this.pixiTurretCoreGraphics.visible = true;
        }

        // Satellite shards & connection trace lines (drawn once on static angles on pixiTurretOrbitGraphics)
        if (this.pixiTurretOrbitGraphics) {
          this.pixiTurretOrbitGraphics.clear();
          const orbitRadius = prismR * 1.7;
          for (let i = 0; i < 3; i++) {
            const orbAngle = (i * Math.PI * 2) / 3;
            const ox = Math.cos(orbAngle) * orbitRadius;
            const oy = Math.sin(orbAngle) * orbitRadius;

            const sSize = 3.5 * scale;
            const shardRot = orbAngle + Math.PI; // shards point inward towards core

            // Draw satellite shard relative to rotation
            const cosShard = Math.cos(shardRot);
            const sinShard = Math.sin(shardRot);
            const cosShard2 = Math.cos(shardRot + 2);
            const sinShard2 = Math.sin(shardRot + 2);
            const cosShardPI = Math.cos(shardRot + Math.PI);
            const sinShardPI = Math.sin(shardRot + Math.PI);
            const cosShardM2 = Math.cos(shardRot - 2);
            const sinShardM2 = Math.sin(shardRot - 2);

            this.pixiTurretOrbitGraphics
              .moveTo(ox + cosShard * sSize * 1.3, oy + sinShard * sSize * 1.3)
              .lineTo(ox + cosShard2 * sSize * 0.8, oy + sinShard2 * sSize * 0.8)
              .lineTo(ox + cosShardPI * sSize * 0.5, oy + sinShardPI * sSize * 0.5)
              .lineTo(ox + cosShardM2 * sSize * 0.8, oy + sinShardM2 * sSize * 0.8)
              .closePath()
              .fill({ color: this.tower.currentColor, alpha: 0.85 })
              .stroke({ color: 0xffffff, width: 1 * scale });

            // Draw trace line
            this.pixiTurretOrbitGraphics
              .moveTo(ox, oy)
              .lineTo(0, 0)
              .stroke({ color: this.tower.currentColor, alpha: 0.25, width: 0.8 * scale });
          }
          this.pixiTurretOrbitGraphics.visible = true;
        }
      } else {
        // Standard 2D prism diamond
        const crystalY = this.tower.constructionTimer > 0 ? -20 * (1 - progress) : 0;
        const crystalAngle = this.tower.constructionTimer > 0 ? (1 - progress) * Math.PI * 8 : 0;

        g.rotation = this.tower.angle + crystalAngle;

        for (let step = 0; step < 2; step++) {
          g.moveTo(prismR * 1.3, crystalY);
          g.lineTo(-prismR * 0.7, crystalY + prismR * 0.8);
          g.lineTo(-prismR * 0.4, crystalY);
          g.lineTo(-prismR * 0.7, crystalY - prismR * 0.8);
          g.closePath();

          if (step === 0) {
            g.fill({ color: this.tower.currentColor, alpha: 0.9 });
          } else {
            g.stroke({ color: 0xffffff, alpha: 1, width: 1 });
          }
        }

        if (this.pixiTurretCoreGraphics) this.pixiTurretCoreGraphics.visible = false;
        if (this.pixiTurretOrbitGraphics) this.pixiTurretOrbitGraphics.visible = false;
      }
    }
  }

  private drawBeams(g: PIXI.Graphics): void {
    if (this.tower.stunTimer > 0) return;

    let baseColor = this.tower.currentColor;
    if (this.tower.specialization) {
      const spec = TowerData[this.tower.type].specializations[this.tower.specialization];
      if (spec) baseColor = spec.color;
    }

    if (
      this.tower.fireCooldown <= 0 &&
      this.tower.target &&
      state.enemiesSet.has(this.tower.target) &&
      this.tower.target.hp > 0
    ) {
      const prismR = 10;
      const tipX = this.tower.x + Math.cos(this.tower.angle) * (prismR * 1.3);
      const tipY = this.tower.y + Math.sin(this.tower.angle) * (prismR * 1.3);
      this.drawLaserBeam(g, tipX, tipY, this.tower.target, baseColor, this.tower.lockTimer);
    }

    if (this.tower.specialization === "refraction") {
      const rangeSq = this.tower.range * this.tower.range;
      const nearby = this.tower.getNearbyEnemies(this.tower.x, this.tower.y, this.tower.range);
      let splits = 0;
      const maxSplits = this.tower.masteryUnlocked ? 6 : 3;
      checkedEnemies.clear();

      for (let i = 0; i < nearby.length; i++) {
        const enemy = nearby[i];
        if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
        if (checkedEnemies.has(enemy.id)) continue;
        checkedEnemies.add(enemy.id);

        if (this.tower.target && enemy === this.tower.target) continue;
        if (getDistanceSq(enemy.x, enemy.y, this.tower.x, this.tower.y) <= rangeSq) {
          this.drawLaserBeam(
            g,
            this.tower.x,
            this.tower.y,
            enemy,
            "#00ffcc",
            this.tower.lockTimer * 0.7,
            true
          );
          splits++;
          if (splits >= maxSplits) break;
        }
      }
    }
  }

  private drawLaserBeam(
    g: PIXI.Graphics,
    x1: number,
    y1: number,
    target: Enemy,
    colorStr: string,
    lockTime: number,
    isSplit = false
  ): void {
    const x2 = target.x;
    const y2 = target.y;

    if (!state.isHost && !state.isPaused) {
      const enemy = target as any;
      if (state.animTime - (enemy.lastDamageParticleTime || 0) >= 6) {
        createExplosion(enemy.x, enemy.y, "#fca311", 2);
        enemy.lastDamageParticleTime = state.animTime;
      }
    }

    const progress = Math.min(1.0, lockTime / TowerData["Prisma"].prismaChargeFrames!);
    const widthMultiplier = isSplit ? 0.85 : 1.0 + progress * 2.0;
    const colorNum = parseInt(colorStr.replace("#", "0x"), 16);

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    // --- SPECIFIC VISUALS PER SPECIALIZATION ---
    const isMeltdown = this.tower.specialization === "meltdown" && !isSplit;
    const isRefraction = this.tower.specialization === "refraction" || isSplit;

    if (isRefraction && len > 5) {
      // Neon teal curve for Refraction splits & Refraction primary beam
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const nx = -dy / len;
      const ny = dx / len;

      // Stable offset determined by target.id
      const curveDirection = target.id % 2 === 0 ? 1 : -1;
      const baseOffset = curveDirection * (len * 0.12);
      // Crystal micro-vibration
      const shimmer = Math.sin(state.animTime * 0.02 + target.id) * 1.5;
      const finalOffset = baseOffset + shimmer;

      const cx = midX + nx * finalOffset;
      const cy = midY + ny * finalOffset;

      // Draw refraction laser core layers
      // 1. Crystal Neon Aura
      const refractionColor = isSplit ? 0x00ffcc : 0x00e699;
      g.moveTo(x1, y1)
        .quadraticCurveTo(cx, cy, x2, y2)
        .stroke({
          color: refractionColor,
          alpha: 0.15 + (isSplit ? 0.1 : progress * 0.15),
          width: (isSplit ? 7 : 11) * widthMultiplier,
          cap: "round",
        });

      // 2. Middle laser body
      g.moveTo(x1, y1)
        .quadraticCurveTo(cx, cy, x2, y2)
        .stroke({
          color: refractionColor,
          alpha: 0.5 + (isSplit ? 0.1 : progress * 0.25),
          width: (isSplit ? 3.5 : 5) * widthMultiplier,
          cap: "round",
        });

      // 3. Ultra white core
      g.moveTo(x1, y1)
        .quadraticCurveTo(cx, cy, x2, y2)
        .stroke({
          color: 0xffffff,
          alpha: 0.95,
          width: (isSplit ? 1.2 : 1.6) * widthMultiplier,
          cap: "round",
        });

      // Traveling Light Shards on Refraction curve
      const numShards = isSplit ? 1 : 2;
      for (let s = 0; s < numShards; s++) {
        const t = (state.animTime * (isSplit ? 0.002 : 0.003) + s / numShards) % 1.0;
        const t1 = 1 - t;
        const bx = t1 * t1 * x1 + 2 * t1 * t * cx + t * t * x2;
        const by = t1 * t1 * y1 + 2 * t1 * t * cy + t * t * y2;

        const shardSize = (isSplit ? 2.5 : 3.5) * widthMultiplier;
        g.moveTo(bx, by - shardSize)
          .lineTo(bx + shardSize, by)
          .lineTo(bx, by + shardSize)
          .lineTo(bx - shardSize, by)
          .closePath()
          .fill({ color: 0xffffff, alpha: 0.85 })
          .stroke({ color: refractionColor, width: 1 });
      }
    } else if (isMeltdown && len > 5) {
      // Raging Orange-Red Plasma Stream
      const nx = -dy / len;
      const ny = dx / len;

      // 1. Unstable plasma fire aura
      const heatPulse = 1.0 + 0.15 * Math.sin(state.animTime * 0.02);
      g.moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke({
          color: colorNum,
          alpha: 0.25 + progress * 0.25,
          width: 14 * widthMultiplier * heatPulse,
          cap: "round",
        });

      // 2. Yellow middle heat cylinder
      g.moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke({
          color: 0xffcc00,
          alpha: 0.6 + progress * 0.3,
          width: 6.5 * widthMultiplier,
          cap: "round",
        });

      // 3. Super hot white core
      g.moveTo(x1, y1)
        .lineTo(x2, y2)
        .stroke({
          color: 0xffffff,
          alpha: 0.95,
          width: 2.2 * widthMultiplier,
          cap: "round",
        });

      // 4. Crackling lightning arcs along the beam
      const steps = 18;
      const time = state.animTime * 0.035;
      const maxOffset = (3.5 + progress * 7.5) * widthMultiplier;

      g.moveTo(x1, y1);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const basePx = x1 + dx * t;
        const basePy = y1 + dy * t;

        const noise = Math.sin(t * Math.PI * 8 - time) * Math.cos(t * Math.PI * 4 + time * 0.5);
        const offset = noise * maxOffset * Math.sin(t * Math.PI);
        const hx = basePx + nx * offset;
        const hy = basePy + ny * offset;
        g.lineTo(hx, hy);
      }
      g.lineTo(x2, y2);
      g.stroke({
        color: 0xff6600,
        alpha: 0.55 + progress * 0.35,
        width: 1.2 + progress * 1.5,
        cap: "round",
        join: "round",
      });

      // White hot secondary thin arc inside the main arc for high charge
      if (progress > 0.5) {
        g.moveTo(x1, y1);
        for (let i = 1; i < steps; i++) {
          const t = i / steps;
          const basePx = x1 + dx * t;
          const basePy = y1 + dy * t;

          const noise =
            Math.cos(t * Math.PI * 10 + time * 1.1) * Math.sin(t * Math.PI * 5 - time * 0.7);
          const offset = noise * maxOffset * 0.65 * Math.sin(t * Math.PI);
          const hx = basePx + nx * offset;
          const hy = basePy + ny * offset;
          g.lineTo(hx, hy);
        }
        g.lineTo(x2, y2);
        g.stroke({
          color: 0xffffff,
          alpha: 0.75,
          width: 0.7 + progress * 0.7,
          cap: "round",
          join: "round",
        });
      }
    } else {
      // --- Standard / Default gold/yellow laser beam ---
      // 1. Outer golden aura
      if (len > 5) {
        g.moveTo(x1, y1)
          .lineTo(x2, y2)
          .stroke({
            color: colorNum,
            alpha: 0.18 + progress * 0.22,
            width: 10 * widthMultiplier,
            cap: "round",
          });

        // 2. Middle yellow laser body
        g.moveTo(x1, y1)
          .lineTo(x2, y2)
          .stroke({
            color: colorNum,
            alpha: 0.55 + progress * 0.25,
            width: 5 * widthMultiplier,
            cap: "round",
          });

        // 3. Core white laser line
        g.moveTo(x1, y1)
          .lineTo(x2, y2)
          .stroke({
            color: 0xffffff,
            alpha: 0.95,
            width: 1.8 * widthMultiplier,
            cap: "round",
          });
      }

      // 4. Plasma Spiral wrapping around the core
      if (progress > 0.2 && len > 10) {
        const nx = -dy / len;
        const ny = dx / len;
        const steps = 24;
        const time = state.animTime * (0.0015 + progress * 0.002);

        g.moveTo(x1, y1);
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = x1 + dx * t;
          const py = y1 + dy * t;
          const waveAngle = t * Math.PI * 6 - time;
          const amplitude = (7 + progress * 10) * Math.sin(t * Math.PI) * widthMultiplier;
          const hx = px + nx * Math.cos(waveAngle) * amplitude;
          const hy = py + ny * Math.cos(waveAngle) * amplitude;

          if (i === 0) g.moveTo(hx, hy);
          else g.lineTo(hx, hy);
        }
        g.stroke({
          color: colorNum,
          alpha: 0.45 + progress * 0.45,
          width: 1.0 + progress * 1.5,
        });

        if (progress > 0.55) {
          g.moveTo(x1, y1);
          for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const px = x1 + dx * t;
            const py = y1 + dy * t;
            const waveAngle = t * Math.PI * 6 - time;
            const amplitude = (7 + progress * 10) * Math.sin(t * Math.PI) * widthMultiplier;
            const hx = px + nx * Math.cos(waveAngle) * amplitude;
            const hy = py + ny * Math.cos(waveAngle) * amplitude;

            if (i === 0) g.moveTo(hx, hy);
            else g.lineTo(hx, hy);
          }
          g.stroke({
            color: 0xffffff,
            alpha: 0.75,
            width: 0.6 + progress * 0.6,
          });
        }
      }

      // 5. Flowing energy nodes
      if (len > 5) {
        const numNodes = 3;
        for (let i = 0; i < numNodes; i++) {
          const t = (state.animTime * 0.002 + i / numNodes) % 1.0;
          const px = x1 + dx * t;
          const py = y1 + dy * t;

          const nx = -dy / len;
          const ny = dx / len;
          const tickLen = 4 * widthMultiplier;

          g.moveTo(px - nx * tickLen, py - ny * tickLen)
            .lineTo(px + nx * tickLen, py + ny * tickLen)
            .stroke({
              color: 0xffffff,
              alpha: 0.8,
              width: 2.0 * widthMultiplier,
              cap: "round",
            });
        }
      }
    }

    // --- MUZZLE FLARE (TOWER TIP EFFECTS) ---
    if (!isSplit && progress > 0.05) {
      const flareR = (4 + progress * 8) * Math.min(1.3, widthMultiplier);
      const ringCount = 2;
      for (let r = 0; r < ringCount; r++) {
        const pulseR = flareR * (0.5 + 0.5 * Math.sin(state.animTime * 0.015 + r * Math.PI));
        g.circle(x1, y1, pulseR).stroke({
          color: colorNum,
          alpha: 0.25 * (1 - pulseR / (flareR * 1.0)),
          width: 1.0,
        });
      }

      g.circle(x1, y1, flareR * 0.75).fill({ color: colorNum, alpha: 0.25 });
      g.circle(x1, y1, Math.min(2.5, flareR * 0.3)).fill({ color: 0xffffff, alpha: 0.75 });
    }

    // --- HOLOGRAPHIC TARGETING RETICLE (HEXAGON HUD) ---
    const targetRadius = (isSplit ? 8 : 11 + progress * 22) * widthMultiplier;

    g.circle(x2, y2, targetRadius).stroke({
      color: colorNum,
      alpha: isSplit ? 0.2 : 0.1 + progress * 0.15,
      width: 1.0,
    });

    g.circle(x2, y2, targetRadius * 0.82).stroke({
      color: colorNum,
      alpha: isSplit ? 0.3 : 0.2 + progress * 0.3,
      width: 1.2,
    });

    if (!isSplit) {
      const rot = state.animTime * 0.006;
      g.moveTo(x2 + targetRadius * Math.cos(rot), y2 + targetRadius * Math.sin(rot));
      for (let i = 1; i <= 6; i++) {
        const angle = rot + (i * Math.PI * 2) / 6;
        g.lineTo(x2 + targetRadius * Math.cos(angle), y2 + targetRadius * Math.sin(angle));
      }
      g.closePath();
      g.stroke({
        color: colorNum,
        alpha: 0.25 + progress * 0.35,
        width: 1.2,
      });

      const bracketRot = -state.animTime * 0.003;
      for (let i = 0; i < 3; i++) {
        const angle = bracketRot + (i * Math.PI * 2) / 3;
        const aStart = angle - 0.25;
        const aEnd = angle + 0.25;
        const bracketR = targetRadius * 1.2;

        g.moveTo(x2 + Math.cos(aStart) * bracketR, y2 + Math.sin(aStart) * bracketR);
        g.arc(x2, y2, bracketR, aStart, aEnd);
      }
      g.stroke({
        color: colorNum,
        alpha: 0.35 + progress * 0.45,
        width: 1.6,
      });
    }

    if (!isSplit && progress > 0.15) {
      const innerBound = targetRadius * 0.3;
      const outerBound = targetRadius * 0.75;
      const tickAlpha = 0.25 + progress * 0.5;
      const tickWidth = 1.0 * widthMultiplier;

      g.moveTo(x2 - outerBound, y2)
        .lineTo(x2 - innerBound, y2)
        .moveTo(x2 + innerBound, y2)
        .lineTo(x2 + outerBound, y2)
        .moveTo(x2, y2 - outerBound)
        .lineTo(x2, y2 - innerBound)
        .moveTo(x2, y2 + innerBound)
        .lineTo(x2, y2 + outerBound)
        .stroke({ color: 0xffffff, alpha: tickAlpha, width: tickWidth });
    }

    if (!isSplit && progress > 0.05) {
      const pulseProgress = (state.animTime * 0.003) % 1.0;
      const pulseRadius = targetRadius * (1.1 - pulseProgress * 0.9);
      g.circle(x2, y2, pulseRadius).stroke({
        color: colorNum,
        alpha: (1.0 - pulseProgress) * (0.35 + progress * 0.45),
        width: 1.2,
      });
    }

    const coreRadius = Math.max(3.0, targetRadius * 0.15);
    g.circle(x2, y2, coreRadius).fill({ color: 0xffffff, alpha: 0.4 + progress * 0.4 });
    g.circle(x2, y2, coreRadius).stroke({
      color: colorNum,
      alpha: 0.55 + progress * 0.35,
      width: 1.0,
    });

    if (!isSplit && progress > 0.35) {
      const flareSize = 14 * progress * widthMultiplier;
      const flareRot = state.animTime * 0.0015;

      for (let i = 0; i < 2; i++) {
        const angle = flareRot + (i * Math.PI) / 2;
        g.moveTo(x2 - Math.cos(angle) * flareSize, y2 - Math.sin(angle) * flareSize).lineTo(
          x2 + Math.cos(angle) * flareSize,
          y2 + Math.sin(angle) * flareSize
        );
      }
      g.stroke({
        color: 0xffffff,
        alpha: 0.55 * progress,
        width: 1.0 * widthMultiplier,
      });
    }

    const sparkCount = isSplit ? 1 : Math.floor(2 + progress * 5);
    for (let i = 0; i < sparkCount; i++) {
      const seed = state.animTime * 0.005 + i * 1.5 + target.id;
      const sparkR =
        (isSplit ? 2.5 : 3.5 + (Math.sin(seed * 2.3) * 0.5 + 0.5) * 3) * widthMultiplier;
      const angle = seed * 3.7;
      const maxDist = isSplit ? 4 : 7 + progress * 16;

      const lifetime = 500;
      const tElapsed = (state.animTime + i * (lifetime / sparkCount)) % lifetime;
      const dist = (tElapsed / lifetime) * maxDist;
      const sx = x2 + Math.cos(angle) * dist;
      const sy = y2 + Math.sin(angle) * dist;
      g.circle(sx, sy, sparkR).fill({ color: colorNum, alpha: 0.85 * (1 - tElapsed / lifetime) });
    }
  }

  public destroy(): void {
    if (this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics.destroy();
      this.pixiBeamsGraphics = undefined;
    }
  }
}
