/*
 * @file: frontend/src/js/entities/enemies/types/bosses.ts
 * @purpose: Implementation of high-tier Boss enemies (Muttershiff, Defragmenter, Pentagon fragments, Triangles) extending BaseEnemy.
 * @dependencies: base, config, state, fx, pool, map, factory
 * @last_update: 2026-06-01 / v1.0.2 - Added drawShape overrides for boss hit-flash to match boss geometry; fixed Defragmenter shield bar bleeding.
 */
import { BaseEnemy } from "../base";
import { Config, EnemyData } from "../../../core/config";
import { state } from "../../../core/state";
import { createExplosion } from "../../../fx/fx";
import { PoolManager } from "../../../core/pool";
import { EnemyFactory } from "../factory";
import { EnemyType } from "../../../types";

export class BossEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Boss";
    this.radius = Config.TILE_SIZE * 1.5;
    this.color = "#aa00ff";
    this.speed = 0.5;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 30); // Balanced down from 160x to account for 10x ENEMY_BASE_HP
    this.reward = Config.WAVE_BONUS_BASE * 10;
    this.shieldActive = true; // Equips initial shield
    this.maxShieldHp = Math.floor(this.maxHp * 0.2); // Shield has 20% of the max HP (reduced from 50%)
    this.shieldHp = this.maxShieldHp;
    this.initHp();

    this.abilityTimer = 0;
    this.nextAbility = "spawn";
    this.outerRotation = 0;
    this.stunRange = 300;
    this.specialAbility = "Spawnt Gegner & Stunnt Türme";
    this.hideHealthBar = true;
    this.customFlash = true;
  }

  public override takeDamage(amount: number, source?: any): number {
    if (this.shieldActive && this.shieldHp !== undefined) {
      const actualShieldDmg = Math.min(amount, Math.max(0, this.shieldHp));
      this.shieldHp -= amount;
      this.triggerFlash(3);
      if (this.shieldHp <= 0) {
        this.shieldActive = false;
        this.shieldHp = 0;
        createExplosion(this.x, this.y, "#00f5d4", 15);
      }
      if (source) {
        const current = this.damageSources.get(source) || 0;
        this.damageSources.set(source, current + actualShieldDmg);
      }
      return actualShieldDmg;
    }
    return super.takeDamage(amount, source);
  }

  public performAbility(): void {
    if (this.nextAbility === "spawn") {
      const count = Math.floor(Math.random() * 3) + 3; // Buffed from 2-3 to 3-5 enemies for heavy path flooding
      const availableTypes = Object.keys(EnemyData).filter(
        (type) =>
          EnemyData[type as EnemyType].category !== "Bosse" &&
          EnemyData[type as EnemyType].unlockWave <= this.waveNumber
      ) as EnemyType[];
      const enemyTypes = availableTypes.length > 0 ? availableTypes : ["Normal" as EnemyType];

      const weights = enemyTypes.map((type) => {
        const weight = EnemyData[type].poolWeight;
        return weight !== undefined ? weight : 1.0;
      });
      const totalWeight = weights.reduce((sum, w) => sum + w, 0);

      for (let i = 0; i < count; i++) {
        let randomType = enemyTypes[0];
        if (totalWeight > 0) {
          let randomVal = Math.random() * totalWeight;
          for (let j = 0; j < enemyTypes.length; j++) {
            randomVal -= weights[j];
            if (randomVal <= 0) {
              randomType = enemyTypes[j];
              break;
            }
          }
        }
        if (randomType === "Swarm") {
          const clusterSize = Config.SWARM_CLUSTER_SIZE || 6;
          const swarmGroupId = Math.floor(Math.random() * 1000000000);
          for (let k = 0; k < clusterSize; k++) {
            const spawnedEnemy = EnemyFactory.createEnemy("Swarm", this.waveNumber) as any;
            spawnedEnemy.swarmGroupId = swarmGroupId;

            const angle = Math.random() * Math.PI * 2;
            const r = 20 * Math.sqrt(Math.random());
            spawnedEnemy.swarmOffsetX = Math.cos(angle) * r;
            spawnedEnemy.swarmOffsetY = Math.sin(angle) * r;

            spawnedEnemy.x = this.x + (Math.random() - 0.5) * 40 + spawnedEnemy.swarmOffsetX;
            spawnedEnemy.y = this.y + (Math.random() - 0.5) * 40 + spawnedEnemy.swarmOffsetY;
            spawnedEnemy.targetWaypointIndex = this.targetWaypointIndex;
            spawnedEnemy.distanceTravelled = this.distanceTravelled;
            state.enemies.push(spawnedEnemy);
          }
        } else {
          const spawnedEnemy = EnemyFactory.createEnemy(randomType, this.waveNumber);
          spawnedEnemy.x = this.x + (Math.random() - 0.5) * 40;
          spawnedEnemy.y = this.y + (Math.random() - 0.5) * 40;
          spawnedEnemy.targetWaypointIndex = this.targetWaypointIndex;
          spawnedEnemy.distanceTravelled = this.distanceTravelled;
          state.enemies.push(spawnedEnemy);
          if (randomType === "Accelerator") {
            if (!state.activeAccelerators) state.activeAccelerators = [];
            state.activeAccelerators.push(spawnedEnemy);
          }
        }
      }
      createExplosion(this.x, this.y, "#aa00ff", 12);
      this.nextAbility = "stun";
    } else {
      // Find all towers within range and sort by distance
      const targets: { tower: any; dist: number }[] = [];
      for (let tower of state.towers) {
        const dx = tower.x - this.x;
        const dy = tower.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.stunRange!) {
          targets.push({ tower, dist });
        }
      }
      targets.sort((a, b) => a.dist - b.dist);

      // Dual Stun: Disable up to 2 nearest towers simultaneously
      const stunCount = Math.min(2, targets.length);
      for (let i = 0; i < stunCount; i++) {
        const tower = targets[i].tower;
        tower.stunTimer = 480; // 8 seconds
        PoolManager.getStunRay(this.x, this.y, tower.x, tower.y);
        createExplosion(tower.x, tower.y, "#ffff00", 10);
      }
      this.nextAbility = "spawn";
    }
  }

  public override update(): "stunned" | "reached_end" | "moving" {
    if (this.shieldActive) {
      this.stunTimer = 0;
    }
    if (!state.isHost) {
      const res = super.update();
      const hpFill = document.getElementById("bossHpFill");
      if (hpFill) {
        hpFill.style.width = (Math.max(0, this.hp) / this.maxHp) * 100 + "%";
        const bossHpContainer = document.getElementById("bossHpContainer");
        if (bossHpContainer) {
          bossHpContainer.classList.remove("hidden");
          bossHpContainer.style.boxShadow = "0 0 25px rgba(255, 51, 102, 0.4)";
        }
        const bossName = document.getElementById("bossName");
        if (bossName) {
          bossName.textContent = "m u t t e r s c h i f f";
          bossName.style.textShadow = "0 0 10px #ff3366";
        }
        const bossHpBar = document.getElementById("bossHpBar");

        if (this.hp < this.maxHp * 0.25) {
          const isFlickering = Math.floor(state.animTime / 100) % 2 === 0;
          hpFill.style.background = isFlickering
            ? "#ffffff"
            : "linear-gradient(90deg, #8b0000, #ff0000)";
          if (bossHpContainer)
            bossHpContainer.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
          if (bossHpBar) bossHpBar.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
        } else if (this.hp < this.maxHp * 0.5) {
          hpFill.style.background = "linear-gradient(90deg, #8b0000, #ff0000)";
          if (bossHpContainer) bossHpContainer.style.borderColor = "#ff0000";
          if (bossHpBar) bossHpBar.style.borderColor = "#ff0000";
        } else {
          hpFill.style.background = "linear-gradient(90deg, #ff3366, #ff0000)";
          if (bossHpContainer) bossHpContainer.style.borderColor = "#ff3366";
          if (bossHpBar) bossHpBar.style.borderColor = "#ff3366";
        }
      }
      return res;
    }

    this.abilityTimer!++;
    if (
      (this.nextAbility === "spawn" && this.abilityTimer! >= 480) ||
      (this.nextAbility === "stun" && this.abilityTimer! >= 420)
    ) {
      this.performAbility();
      this.abilityTimer = 0;
    }

    const res = super.update();

    const hpFill = document.getElementById("bossHpFill");
    if (hpFill) {
      hpFill.style.width = (Math.max(0, this.hp) / this.maxHp) * 100 + "%";
      const bossHpContainer = document.getElementById("bossHpContainer");
      if (bossHpContainer) {
        bossHpContainer.classList.remove("hidden");
        bossHpContainer.style.boxShadow = "0 0 25px rgba(255, 51, 102, 0.4)";
      }
      const bossName = document.getElementById("bossName");
      if (bossName) {
        bossName.textContent = "m u t t e r s c h i f f";
        bossName.style.textShadow = "0 0 10px #ff3366";
      }
      const bossHpBar = document.getElementById("bossHpBar");

      if (this.hp < this.maxHp * 0.25) {
        const isFlickering = Math.floor(state.animTime / 100) % 2 === 0;
        hpFill.style.background = isFlickering
          ? "#ffffff"
          : "linear-gradient(90deg, #8b0000, #ff0000)";
        if (bossHpContainer)
          bossHpContainer.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
        if (bossHpBar) bossHpBar.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
      } else if (this.hp < this.maxHp * 0.5) {
        hpFill.style.background = "linear-gradient(90deg, #8b0000, #ff0000)";
        if (bossHpContainer) bossHpContainer.style.borderColor = "#ff0000";
        if (bossHpBar) bossHpBar.style.borderColor = "#ff0000";
      } else {
        hpFill.style.background = "linear-gradient(90deg, #ff3366, #ff0000)";
        if (bossHpContainer) bossHpContainer.style.borderColor = "#ff3366";
        if (bossHpBar) bossHpBar.style.borderColor = "#ff3366";
      }
    }

    return res;
  }

  public override drawShape(g: any): void {
    // Used by base class to pre-render the flash graphics with the correct shape
    const pulse = Math.sin(this.pulseTime * 3) * 0.2 + 1;
    g.ellipse(0, 0, this.radius * 0.5 * pulse, this.radius * 0.5 * pulse).fill({
      color: this.flashTime > 0 ? "#ffffff" : "#ff3366",
    });
  }

  public override updatePixi(): void {
    super.updatePixi();
    if (!this.bodyGraphics) return;

    const isEnraged = this.hp < this.maxHp * 0.5;
    if (isEnraged && !state.isPaused) {
      if (Math.random() < 0.3) {
        PoolManager.getParticle(
          this.x + (Math.random() - 0.5) * this.radius,
          this.y + (Math.random() - 0.5) * this.radius,
          "#555",
          2,
          Math.random() * 4 + 2
        );
      }
    }

    if (!state.isPaused) {
      this.outerRotation = (this.outerRotation || 0) + 0.02 * this.speed;
    }

    const g = this.bodyGraphics;
    g.clear();
    g.rotation = 0; // Prevent super from rotating us globally

    const rot = this.outerRotation || 0;
    const color = this.flashTime > 0 ? "#ffffff" : isEnraged ? "#8b0000" : "#aa00ff";

    g.arc(0, 0, this.radius, rot, rot + Math.PI * 0.7).stroke({ color, width: 6 });
    g.arc(0, 0, this.radius, rot + Math.PI, rot + Math.PI * 1.7).stroke({ color, width: 6 });

    const pulse = Math.sin(this.pulseTime * 3) * 0.2 + 1;
    const eyeColor = this.flashTime > 0 ? "#ffffff" : isEnraged ? "#ff0000" : "#ff3366";

    g.ellipse(0, 0, this.radius * 0.5 * pulse, this.radius * 0.5 * pulse).fill({ color: eyeColor });
    g.ellipse(0, 0, this.radius * 0.15 * pulse, this.radius * 0.35 * pulse).fill({
      color: "#000000",
    });
  }
}

export class DefragmenterEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "Defragmenter";
    this.radius = Config.TILE_SIZE * 1.4;
    this.color = "#00f5d4";
    this.speed = 0.5;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 25); // Balanced down from 100x to account for 10x ENEMY_BASE_HP
    this.reward = Config.WAVE_BONUS_BASE * 10;
    this.initHp();

    this.outerRotation = 0;
    this.specialAbility = "Ketten-Spaltung";
    this.hideHealthBar = true;
    this.customFlash = true;
  }

  public override update(): "stunned" | "reached_end" | "moving" {
    return super.update();
  }

  public override drawShape(g: any): void {
    // Hexagon shape used by base class to pre-render the flash graphics
    const pulse = Math.sin(this.pulseTime * 2.5) * 0.15 + 0.85;
    const color = this.flashTime > 0 ? "#ffffff" : "#00f5d4";
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = Math.cos(angle) * (this.radius * 0.65 * pulse);
      const py = Math.sin(angle) * (this.radius * 0.65 * pulse);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.fill({ color, alpha: this.flashTime > 0 ? 1 : 0.85 });
  }

  public override updatePixi(): void {
    super.updatePixi();
    if (!this.bodyGraphics) return;

    if (!state.isPaused) {
      this.outerRotation = (this.outerRotation || 0) + 0.015 * this.speed;
    }

    const g = this.bodyGraphics;
    g.clear();
    g.rotation = 0; // Prevent super from rotating us globally

    const flashActive = this.flashTime > 0;
    const mainColor = flashActive ? "#ffffff" : "#00f5d4";

    // Draw outer rotating triangle satellites
    const rot = -(this.outerRotation || 0);
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + rot;
      const sx = Math.cos(angle) * (this.radius + 12);
      const sy = Math.sin(angle) * (this.radius + 12);

      const rAng = angle + Math.PI / 2;
      const pts = [
        { x: 0, y: -6 },
        { x: 5, y: 4 },
        { x: -5, y: 4 },
      ];
      const tPts = pts.map((p) => ({
        x: sx + p.x * Math.cos(rAng) - p.y * Math.sin(rAng),
        y: sy + p.x * Math.sin(rAng) + p.y * Math.cos(rAng),
      }));

      g.moveTo(tPts[0].x, tPts[0].y);
      g.lineTo(tPts[1].x, tPts[1].y);
      g.lineTo(tPts[2].x, tPts[2].y);
      g.fill({ color: mainColor, alpha: flashActive ? 0.8 : 0.4 });
    }

    // Draw hexagon outline (rotated by outerRotation)
    const hexRot = this.outerRotation || 0;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + hexRot;
      const px = Math.cos(angle) * this.radius;
      const py = Math.sin(angle) * this.radius;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.lineTo(Math.cos(hexRot) * this.radius, Math.sin(hexRot) * this.radius);
    g.stroke({ color: mainColor, width: 4 });

    // Draw inner pulsing core
    const pulse = Math.sin(this.pulseTime * 2.5) * 0.15 + 0.85;
    const colorCore = mainColor;
    const alphaCore = flashActive ? 1 : 0.85;

    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = Math.cos(angle) * (this.radius * 0.65 * pulse);
      const py = Math.sin(angle) * (this.radius * 0.65 * pulse);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.fill({ color: colorCore, alpha: alphaCore });

    // Inner dark detail
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const px = Math.cos(angle) * (this.radius * 0.25 * pulse);
      const py = Math.sin(angle) * (this.radius * 0.25 * pulse);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.fill({ color: "#000000", alpha: 0.7 });
  }
}

export class DefragmenterFragmentEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "DefragmenterFragment";
    this.radius = Config.TILE_SIZE * 0.8;
    this.color = "#00f5d4";
    this.speed = 0.9;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 8); // Balanced down from 30x to account for 10x ENEMY_BASE_HP
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 4 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.initHp();
    this.specialAbility = "Spaltet sich bei Zerstörung";
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

    for (let i = 0; i < 5; i++) {
      const angle = ((Math.PI * 2) / 5) * i - Math.PI / 2;
      const px = Math.cos(angle) * (this.radius * 0.5);
      const py = Math.sin(angle) * (this.radius * 0.5);
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.lineTo(
      Math.cos(-Math.PI / 2) * this.radius * 0.5,
      Math.sin(-Math.PI / 2) * this.radius * 0.5
    );
    g.stroke({ color: "#000000", alpha: 0.5, width: 2 });
  }

  public override reset(waveNumber: number): void {
    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 8);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 4 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    super.reset(waveNumber);
  }
}

export class DefragmenterSubfragmentEnemy extends BaseEnemy {
  constructor(waveNumber: number) {
    super(waveNumber);
    this.typeName = "DefragmenterSubfragment";
    this.radius = Config.TILE_SIZE * 0.45;
    this.color = "#00f5d4";
    this.speed = 1.8;

    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 2); // Balanced down from 8x to account for 10x ENEMY_BASE_HP
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 1.5 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    this.initHp();
    this.specialAbility = "Extrem schnell";
  }

  public override drawShape(g: any): void {
    g.moveTo(0, -this.radius);
    g.lineTo(this.radius, this.radius);
    g.lineTo(-this.radius, this.radius);
    g.fill({ color: this.flashTime > 0 ? "#ffffff" : this.color });

    g.moveTo(0, -this.radius * 0.3);
    g.lineTo(this.radius * 0.5, this.radius * 0.5);
    g.lineTo(-this.radius * 0.5, this.radius * 0.5);
    g.fill({ color: "#000000", alpha: 0.4 });
  }

  public override reset(waveNumber: number): void {
    const baseHp = Config.ENEMY_BASE_HP;
    const hpMultiplier = Config.getHpMultiplier(waveNumber);
    this.maxHp = Math.floor(baseHp * hpMultiplier * 2);
    this.reward = Math.floor(
      Config.ENEMY_REWARD_BASE * 1.5 * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)
    );
    super.reset(waveNumber);
  }
}
