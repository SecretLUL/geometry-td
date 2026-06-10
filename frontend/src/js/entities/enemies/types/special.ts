/*
 * @file: frontend/src/js/entities/enemies/types/special.ts
 * @purpose: Implementation of specialized gameplay enemies (Regrower, Shielded, Swarm) extending BaseEnemy.
 * @dependencies: base, config, state, map, utils
 * @last_update: 2026-06-01 / v1.3.0 - Added AcceleratorEnemy subclass with custom Chevron shape and speed aura properties.
 */
import { BaseEnemy } from "../base";
import { Enemy } from "../../../types";
import { Config } from "../../../core/config";
import { state } from "../../../core/state";
import { waypoints } from "../../../core/map";
import { getDistance } from "../../../core/utils";

export class RegrowerEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Regrower";
    this.radius = 12;
    this.color = "#228b22";
    this.speed = 1.2;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 1.2);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 1.2 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.healTimer = 30;
    this.initHp();
  }

  public override drawShape(g: any): void {
    for (let i = 0; i < 5; i++) {
      const angle = ((Math.PI * 2) / 5) * i - Math.PI / 2;
      const px = Math.cos(angle) * this.radius;
      const py = Math.sin(angle) * this.radius;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.fill({ color: this.flashTime > 0 ? "#ffffff" : this.color });
  }
}

export class ShieldedEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Shielded";
    this.radius = 12;
    this.color = "#4682b4";
    this.speed = 1.3;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 0.8);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 1.5 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.shieldActive = true;
    this.initHp();
  }
}

export class SwarmEnemy extends BaseEnemy {
  public swarmOffsetX: number = 0;
  public swarmOffsetY: number = 0;

  private static lastCacheTime: number = -1;
  private static lastEnemiesLength: number = -1;
  private static groupCache: Map<
    number,
    {
      firstMember: Enemy;
      aliveCount: number;
      sumX: number;
      sumY: number;
    }
  > = new Map();

  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Swarm";
    this.radius = 4; // Very small
    this.color = "#ff00ff"; // Neon pink
    this.speed = 2.0; // 60 map speed approx

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.max(1, Math.floor(baseHp * hpMultiplier * 0.05)); // Minimal HP, dies in 1 hit early on
    this.reward = Math.max(
      1,
      Math.floor(
        Config.ENEMY_REWARD_BASE * 0.2 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
      )
    );
    this.initHp();
    this.hideHealthBar = true; // No HP bar for micro dots to avoid clutter
  }

  public override drawShape(g: any): void {
    g.circle(0, 0, this.radius).fill({ color: this.flashTime > 0 ? "#ffffff" : this.color });
  }

  public override update(): "stunned" | "reached_end" | "moving" {
    if (this.stunCooldown > 0) this.stunCooldown--;

    if (this.stunTimer > 0) {
      this.stunTimer--;
      this.updatePixi();
      return "stunned";
    }

    const target = waypoints[this.targetWaypointIndex];
    if (!target) return "reached_end";

    const fakeTargetX = target.x + this.swarmOffsetX;
    const fakeTargetY = target.y + this.swarmOffsetY;

    const distance = getDistance(this.x, this.y, fakeTargetX, fakeTargetY);
    const dx = fakeTargetX - this.x;
    const dy = fakeTargetY - this.y;

    if (distance < this.speed) {
      this.x = fakeTargetX;
      this.y = fakeTargetY;
      this.targetWaypointIndex++;
      if (this.targetWaypointIndex >= waypoints.length) {
        return "reached_end";
      }
    } else {
      const moveX = (dx / distance) * this.speed;
      const moveY = (dy / distance) * this.speed;
      this.x += moveX;
      this.y += moveY;
      this.distanceTravelled += this.speed;
    }
    this.updatePixi();
    return "moving";
  }
  public override updatePixi(): void {
    super.updatePixi();

    if (this.swarmGroupId) {
      if (
        SwarmEnemy.lastCacheTime !== state.animTime ||
        SwarmEnemy.lastEnemiesLength !== state.enemies.length
      ) {
        SwarmEnemy.lastCacheTime = state.animTime;
        SwarmEnemy.lastEnemiesLength = state.enemies.length;
        SwarmEnemy.groupCache.clear();

        for (let i = 0; i < state.enemies.length; i++) {
          const e = state.enemies[i];
          if (e.swarmGroupId !== undefined) {
            let cache = SwarmEnemy.groupCache.get(e.swarmGroupId);
            if (!cache) {
              cache = {
                firstMember: e,
                aliveCount: 0,
                sumX: 0,
                sumY: 0,
              };
              SwarmEnemy.groupCache.set(e.swarmGroupId, cache);
            }
            cache!.aliveCount++;
            cache!.sumX += e.x;
            cache!.sumY += e.y;
          }
        }
      }

      const cached = SwarmEnemy.groupCache.get(this.swarmGroupId);
      if (cached && cached.firstMember === this && this.hpGraphics) {
        const { aliveCount, sumX, sumY } = cached;
        if (aliveCount > 0) {
          const ratio = Math.max(0, aliveCount / 12);
          const centerX = sumX / aliveCount;
          const centerY = sumY / aliveCount;

          this.hpGraphics.position.set(centerX - this.x, centerY - this.y);
          this.hpGraphics.clear();
          this.hpGraphics.rect(-15, -this.radius - 22, 30, 4).fill({ color: 0xff0000 });
          this.hpGraphics.rect(-15, -this.radius - 22, 30 * ratio, 4).fill({ color: 0x00ff00 });
        }
      } else if (this.hpGraphics) {
        this.hpGraphics.clear();
      }
    }
  }
}

export class AcceleratorEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Accelerator";
    this.radius = 12;
    this.color = "#ccff00";
    this.speed = 0.6;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 1.8);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 2.0 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.initHp();
  }

  public override drawShape(g: any): void {
    // Premium chevron polygon pointing right (>)
    g.moveTo(this.radius, 0);
    g.lineTo(-this.radius, -this.radius);
    g.lineTo(-this.radius / 3, 0);
    g.lineTo(-this.radius, this.radius);
    g.lineTo(this.radius, 0);
    g.fill({ color: this.flashTime > 0 ? "#ffffff" : this.color });
  }
}
