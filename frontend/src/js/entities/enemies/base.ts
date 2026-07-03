/*
 * @file: frontend/src/js/entities/enemies/base.ts
 * @purpose: Implementation of the abstract BaseEnemy class managing coordinates, flashing visual cues, stun conditions, and path traversing.
 * @dependencies: config, state, map, fx, utils, types
 * @last_update: 2026-06-01 / v1.2.1 - Added rotationSpeedMultiplier support to limit rotation speed for fast enemies like Collector.
 */
import { state } from "../../core/state";
import { waypoints } from "../../core/map";
import { createExplosion } from "../../fx/fx";
import { getDistance, getDistanceSq } from "../../core/utils";
import { Enemy, EnemyType } from "../../types";
import { app, entitiesContainer } from "../../core/game/viewport";
import { Config } from "../../core/config";
import { PoolManager } from "../../core/pool";
import * as PIXI from "pixi.js";

export class BaseEnemy implements Enemy {
  public id!: number;
  public x: number;
  public y: number;
  public targetWaypointIndex: number;
  public distanceTravelled: number;
  public flashTime: number;
  public lastFlashTime: number = 0;
  public customFlash: boolean = false;
  public pulseTime: number;
  public rotation: number;
  public deadMarked: boolean;
  public waveNumber: number;

  public typeName: EnemyType;
  public radius: number;
  public color: string;
  public speed: number;
  public maxHp: number;
  public hp!: number;
  public reward: number;
  public shieldActive: boolean;
  public stunTimer: number;
  public stunCooldown: number;
  public hideHealthBar?: boolean;
  public lastDamageParticleTime: number;
  public damageSources: Map<any, number>;
  public spawnFrames?: number;

  // Optional traits used by subclasses
  public healTimer?: number;
  public abilityTimer?: number;
  public nextAbility?: "spawn" | "stun";
  public outerRotation?: number;
  public stunRange?: number;
  public specialAbility?: string;
  public maxShieldHp?: number;
  public shieldHp?: number;
  public regenTimer?: number;
  public swarmGroupId?: number;
  public needsRedraw: boolean = true;
  public rotationSpeedMultiplier: number = 1.0;
  public cachedAcceleratorBuff: boolean = false;

  public pixiSprite?: PIXI.Container;
  public bodyGraphics?: PIXI.Graphics;
  public flashGraphics?: PIXI.Graphics;
  public hpGraphics?: PIXI.Graphics; // Used as background
  public hpFillGraphics?: PIXI.Graphics; // Used for dynamic scaling
  public shieldGraphics?: PIXI.Graphics;
  public auraGraphics?: PIXI.Graphics;

  constructor(waveNumber: number) {
    this.x = waypoints.length > 0 ? waypoints[0].x : 0;
    this.y = waypoints.length > 0 ? waypoints[0].y : 0;
    this.targetWaypointIndex = 1;
    this.distanceTravelled = 0;
    this.flashTime = 0;
    this.lastFlashTime = 0;
    this.customFlash = false;
    this.pulseTime = 0;
    this.rotation = 0;
    this.deadMarked = false;
    this.waveNumber = waveNumber;
    this.spawnFrames = 0;

    this.typeName = "Base";
    this.radius = 12;
    this.color = "#fff";
    this.speed = 1;
    this.maxHp = 10;
    this.reward = 1;
    this.shieldActive = false;
    this.stunTimer = 0;
    this.stunCooldown = 0;
    this.lastDamageParticleTime = 0;
    this.damageSources = new Map();
    this.rotationSpeedMultiplier = 1.0;

    this.initPixi();
  }

  public initPixi(): void {
    if (typeof window === "undefined") return;
    const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";
    if (isHeadlessMode) return;

    if (!this.pixiSprite) {
      this.pixiSprite = new PIXI.Container();
      this.bodyGraphics = new PIXI.Graphics();
      this.flashGraphics = new PIXI.Graphics();
      this.hpGraphics = new PIXI.Graphics();
      this.hpFillGraphics = new PIXI.Graphics();

      this.pixiSprite.addChild(this.bodyGraphics);
      this.pixiSprite.addChild(this.flashGraphics);
      this.pixiSprite.addChild(this.hpGraphics);
      this.pixiSprite.addChild(this.hpFillGraphics);

      if (this.shieldActive) {
        this.shieldGraphics = new PIXI.Graphics();
        this.pixiSprite.addChild(this.shieldGraphics);
      }
    }
    if (app && app.renderer && entitiesContainer) {
      entitiesContainer.addChild(this.pixiSprite);
    }
    this.needsRedraw = true;
    this.pixiSprite.visible = true;
  }

  public initHp(): void {
    this.hp = this.maxHp;
  }

  public reset(waveNumber: number): void {
    this.waveNumber = waveNumber;
    this.distanceTravelled = 0;
    this.flashTime = 0;
    this.lastFlashTime = 0;
    this.pulseTime = 0;
    this.rotation = 0;
    this.deadMarked = false;
    this.spawnFrames = 0;
    this.stunTimer = 0;
    this.stunCooldown = 0;
    this.lastDamageParticleTime = 0;
    this.shieldActive = false;
    this.shieldHp = 0;
    if (this.damageSources) {
      this.damageSources.clear();
    }
    this.initHp();
    this.needsRedraw = true;
  }

  public triggerFlash(duration: number): void {
    const now = state.animTime;
    if (now - this.lastFlashTime >= 200) {
      this.flashTime = duration;
      this.lastFlashTime = now;
    }
  }

  public takeDamage(amount: number, source?: any): number {
    if (this.shieldActive) {
      this.shieldActive = false;
      createExplosion(this.x, this.y, "#00ffff", 5);
      return 0;
    }
    const actualDmg = Math.min(amount, Math.max(0, this.hp));
    this.hp -= amount;
    this.triggerFlash(5);

    if (source) {
      const current = this.damageSources.get(source) || 0;
      this.damageSources.set(source, current + actualDmg);
    }

    // Cooldown of 6 frames (approx 100ms) for standard damage particles to avoid visual clutter
    if (state.animTime - this.lastDamageParticleTime >= 6) {
      createExplosion(this.x, this.y, "#fca311", 2);
      this.lastDamageParticleTime = state.animTime;
    }
    return actualDmg;
  }

  public drawShape(g: PIXI.Graphics): void {
    g.rect(-this.radius, -this.radius, this.radius * 2, this.radius * 2).fill({
      color: this.flashTime > 0 ? "#ffffff" : this.color,
    });
  }

  public updatePixi(): void {
    if (!this.pixiSprite || !this.bodyGraphics || !this.hpGraphics) return;

    if (this.needsRedraw) {
      this.bodyGraphics.clear();
      const originalFlashTime = this.flashTime;

      // Draw normal color
      this.flashTime = 0;
      this.drawShape(this.bodyGraphics);

      // Draw flash white
      if (this.flashGraphics) {
        this.flashTime = 1;
        this.flashGraphics.clear();
        this.drawShape(this.flashGraphics);
      }

      this.flashTime = originalFlashTime;

      // Draw HP background once
      this.hpGraphics.clear();
      if (!this.hideHealthBar) {
        const barWidth = 30;
        const barHeight = 4;
        const borderRadius = 2;
        const yOffset = -this.radius - 8;

        // 1. Draw glassmorphic shadow/glow backing
        this.hpGraphics.roundRect(-barWidth / 2 - 0.5, yOffset - 0.5, barWidth + 1, barHeight + 1, borderRadius)
          .fill({ color: 0x000000, alpha: 0.35 });

        // 2. Draw background bar (dark slate with subtle emerald glowing border)
        this.hpGraphics.roundRect(-barWidth / 2, yOffset, barWidth, barHeight, borderRadius)
          .fill({ color: 0x1f2937, alpha: 0.85 })
          .stroke({ color: 0x10b981, width: 0.7, alpha: 0.3 });
      }

      // Draw HP fill once (drawn at 0,0, positioned relative)
      if (this.hpFillGraphics) {
        this.hpFillGraphics.clear();
        if (!this.hideHealthBar) {
          const barWidth = 30;
          const barHeight = 4;
          const borderRadius = 2;
          const yOffset = -this.radius - 8;

          // 1. Draw progress fill with neon emerald green
          this.hpFillGraphics.roundRect(0, 0, barWidth, barHeight, borderRadius)
            .fill({ color: 0x10b981 });

          // 2. Draw white translucent inner sheen core for premium 3D look
          this.hpFillGraphics.roundRect(0, 0.5, barWidth, barHeight - 1, borderRadius - 0.5)
            .fill({ color: 0xffffff, alpha: 0.25 });

          this.hpFillGraphics.position.set(-barWidth / 2, yOffset);
        }
      }

      // Draw shield once
      if (this.shieldActive && this.shieldGraphics) {
        this.shieldGraphics.clear();
        this.shieldGraphics.circle(0, 0, this.radius + 6).stroke({ color: 0x00ffff, width: 2 });
      }

      this.needsRedraw = false;
    }

    this.pixiSprite.position.set(this.x, this.y);

    // Check for Accelerator speed buff aura
    let speedMultiplier = 1.0;
    const auraRadius = 3.0 * Config.TILE_SIZE;
    if (this.cachedAcceleratorBuff) {
      speedMultiplier = 1.4;
    }

    const effectiveSpeed = this.speed * speedMultiplier;

    if (effectiveSpeed > 0 && !state.isPaused) {
      this.pulseTime += 0.05 * effectiveSpeed;
    }

    let scale = 1;
    if (this.typeName === "Regrower") {
      scale = 1 + Math.sin(this.pulseTime * 2) * 0.15;
    } else if (this.typeName === "Accelerator") {
      this.bodyGraphics.rotation = this.rotation;
      if (this.flashGraphics) this.flashGraphics.rotation = this.rotation;
    } else {
      if (!state.isPaused) {
        this.rotation += 0.02 * effectiveSpeed * this.rotationSpeedMultiplier;
      }
      this.bodyGraphics.rotation = this.rotation;
      if (this.flashGraphics) this.flashGraphics.rotation = this.rotation;
    }

    if (
      !this.hideHealthBar &&
      (this.typeName === "DefragmenterFragment" || this.typeName === "DefragmenterSubfragment")
    ) {
      if (!state.isPaused) {
        this.spawnFrames = (this.spawnFrames ?? 0) + 1;
      }
      const duration = 20;
      const t = Math.min(1.0, (this.spawnFrames ?? 0) / duration);
      const easeScale = t === 1.0 ? 1.0 : t * t * (2.70158 * t - 1.70158) + 1;
      scale *= easeScale;
    }

    this.bodyGraphics.scale.set(scale);
    if (this.flashGraphics) this.flashGraphics.scale.set(scale);

    // Flash logic - toggle visibility
    if (this.flashTime > 0) {
      this.flashTime--;
      if (this.customFlash) {
        this.bodyGraphics.visible = true;
        if (this.flashGraphics) this.flashGraphics.visible = false;
      } else {
        this.bodyGraphics.visible = false;
        if (this.flashGraphics) this.flashGraphics.visible = true;
      }
    } else {
      this.bodyGraphics.visible = true;
      if (this.flashGraphics) this.flashGraphics.visible = false;
    }

    // Shield
    if (this.shieldActive) {
      if (!this.shieldGraphics) {
        this.shieldGraphics = new PIXI.Graphics();
        this.pixiSprite.addChild(this.shieldGraphics);
        this.needsRedraw = true; // Draw in next frame
      } else {
        this.shieldGraphics.visible = true;
      }
    } else if (this.shieldGraphics) {
      this.shieldGraphics.visible = false;
    }

    // HP Bar - update scale.x instead of redrawing
    if (!this.hideHealthBar && this.hpFillGraphics) {
      if (this.swarmGroupId) {
        // SwarmEnemy handles its own HP bar manually
        this.hpFillGraphics.visible = false;
      } else {
        this.hpFillGraphics.scale.x = Math.max(0, this.hp / this.maxHp);
        this.hpGraphics.visible = true;
        this.hpFillGraphics.visible = true;
      }
    } else {
      if (!this.swarmGroupId) this.hpGraphics.visible = false;
      if (this.hpFillGraphics) this.hpFillGraphics.visible = false;
    }

    // Draw Accelerator glowing speed aura range circle
    if (this.typeName === "Accelerator") {
      if (!this.auraGraphics) {
        this.auraGraphics = new PIXI.Graphics();
        this.pixiSprite.addChildAt(this.auraGraphics, 0);
        this.auraGraphics
          .circle(0, 0, auraRadius)
          .fill({ color: 0xccff00, alpha: 1 })
          .stroke({ color: 0xccff00, width: 1.0, alpha: 5 });
      }

      const pulse = 1.0 + Math.sin(state.animTime * 0.01) * 0.015;
      const alpha = 0.03 + Math.sin(state.animTime * 0.01) * 0.01;

      this.auraGraphics.scale.set(pulse);
      this.auraGraphics.alpha = alpha;
    }

    // Spawn neon glowing speed trail particles behind accelerated enemies
    if (this.cachedAcceleratorBuff && !state.isPaused && Math.random() < 0.1) {
      PoolManager.getParticle(
        this.x + (Math.random() - 0.5) * 12,
        this.y + (Math.random() - 0.5) * 12,
        "#ccff00",
        1.5,
        1.5
      );
    }
  }

  public draw(): void {}

  public update(): "stunned" | "reached_end" | "moving" {
    if (this.stunCooldown > 0) this.stunCooldown--;

    if (this.stunTimer > 0) {
      this.stunTimer--;
      return "stunned";
    }
    if (this.healTimer !== undefined) {
      this.healTimer--;
      if (this.healTimer <= 0) {
        if (this.hp < this.maxHp) {
          this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.05);
          createExplosion(this.x, this.y, "#00ff00", 2);
        }
        this.healTimer = 30;
      }
    }

    // Check for Accelerator speed buff aura
    let speedMultiplier = 1.0;
    const auraRadiusSq = (3.0 * Config.TILE_SIZE) ** 2;
    const accelerators = state.activeAccelerators || [];

    this.cachedAcceleratorBuff =
      accelerators.length > 0 &&
      accelerators.some(
        (e) => !e.deadMarked && getDistanceSq(this.x, this.y, e.x, e.y) <= auraRadiusSq
      );

    if (this.cachedAcceleratorBuff) {
      speedMultiplier = 1.4;
    }

    const effectiveSpeed = this.speed * speedMultiplier;

    const target = waypoints[this.targetWaypointIndex];
    const distance = getDistance(this.x, this.y, target.x, target.y);
    const dx = target.x - this.x;
    const dy = target.y - this.y;

    if (this.typeName === "Accelerator") {
      this.rotation = Math.atan2(dy, dx);
    }

    if (distance < effectiveSpeed) {
      this.x = target.x;
      this.y = target.y;
      this.targetWaypointIndex++;
      if (this.targetWaypointIndex >= waypoints.length) {
        return "reached_end";
      }
    } else {
      const moveX = (dx / distance) * effectiveSpeed;
      const moveY = (dy / distance) * effectiveSpeed;
      this.x += moveX;
      this.y += moveY;
      this.distanceTravelled += effectiveSpeed;
    }

    this.updatePixi();
    return "moving";
  }

  public checkHover(mouseX: number, mouseY: number): boolean {
    return (
      Math.abs(mouseX - this.x) < this.radius + 5 && Math.abs(mouseY - this.y) < this.radius + 5
    );
  }
}
