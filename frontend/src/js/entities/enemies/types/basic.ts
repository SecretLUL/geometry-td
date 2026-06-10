/*
 * @file: frontend/src/js/entities/enemies/types/basic.ts
 * @purpose: Implementation of basic enemy geometry shapes (Normal, Scout, Bruiser) extending BaseEnemy.
 * @dependencies: base, config
 * @last_update: 2026-05-22 / v1.0.0 - Created basic.ts as part of enemies.ts split.
 */
import { BaseEnemy } from "../base";
import { Config } from "../../../core/config";

export class NormalEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Normal";
    this.radius = 12;
    this.color = "#ff3366";
    this.speed = 1.2;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.initHp();
  }
}

export class ScoutEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Scout";
    this.radius = 8;
    this.color = "#ffb703";
    this.speed = 2.8;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 0.6);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 0.8 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.initHp();
  }

  public override drawShape(g: any): void {
    g.moveTo(0, -this.radius);
    g.lineTo(this.radius, this.radius);
    g.lineTo(-this.radius, this.radius);
    g.fill({ color: this.flashTime > 0 ? "#ffffff" : this.color });
  }
}

export class BruiserEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Bruiser";
    this.radius = 16;
    this.color = "#8b0000";
    this.speed = 0.8;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 2.5);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 2 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.initHp();
  }

  public override drawShape(g: any): void {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * i;
      const px = Math.cos(angle) * this.radius;
      const py = Math.sin(angle) * this.radius;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.fill({ color: this.flashTime > 0 ? "#ffffff" : this.color });
  }
}
