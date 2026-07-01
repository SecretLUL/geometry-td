/*
 * @file: frontend/src/js/core/game/simulation.ts
 * @purpose: Handles spatial collision hashing, projectile incoming damage, tower updates (host-specific
 *           logic and client prediction/rotation), enemy updates (host updates, reached end, splitter/defragmenter
 *           split logic, gold reward calculations, and state.lives/state.gold updates), entity tickers
 *           (projectiles, particles, ground effects, floating texts), and orchestrates host wave logic.
 * @dependencies: state, multiplayer, config, enemies, fx, pool, logger, utils, map, types, wave, helpers, bossBar
 */
import { state } from "../state";
import { Multiplayer } from "../multiplayer/index";
import { EnemyFactory } from "../../entities/enemies";
import { createExplosion, createCoinBurst } from "../../fx/fx";
import { PoolManager } from "../pool";
import { logger } from "../logger";
import { getDistanceSq } from "../utils";
import { waypoints } from "../map";
import { Enemy, Tower } from "../../types";
import { handleWaveLogic } from "./wave";
import { updateEnemiesSet, hasActiveDefragmenter } from "./helpers";
import { hideBossBar } from "./bossBar";

const CELL_SIZE = 100;
const GRID_WIDTH = 50;
const GRID_HEIGHT = 50;

export function runSimulationTick(): void {
  updateEnemiesSet();

  // Spatial Hashing Grid for Collision optimization (Zero Allocation Array)
  if (!state.enemyGrid || !state.activeGridIndices) {
    state.enemyGrid = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => []);
    state.activeGridIndices = [];
  } else {
    // Zero-allocation clear: only clear cells that had enemies last frame
    for (let i = 0; i < state.activeGridIndices.length; i++) {
      const idx = state.activeGridIndices[i];
      state.enemyGrid[idx].length = 0;
    }
    state.activeGridIndices.length = 0;
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const enemy = state.enemies[i];
    // Clamp coordinates to grid bounds to prevent out-of-bounds indexing
    const cx = Math.max(0, Math.min(GRID_WIDTH - 1, Math.floor(enemy.x / CELL_SIZE)));
    const cy = Math.max(0, Math.min(GRID_HEIGHT - 1, Math.floor(enemy.y / CELL_SIZE)));
    const index = cx + cy * GRID_WIDTH;

    const cell = state.enemyGrid[index];
    if (cell.length === 0) {
      state.activeGridIndices.push(index);
    }
    cell.push(enemy);
  }

  // Pre-calculate incoming damage to avoid overkill in tower updates (Host only)
  if (state.isHost) {
    for (let i = 0; i < state.enemies.length; i++) {
      state.enemies[i].incomingDamage = 0;
    }
    for (let i = 0; i < state.projectiles.length; i++) {
      const p = state.projectiles[i];
      if (p.active && p.target && "hp" in p.target && p.target.hp !== undefined) {
        const enemyTarget = p.target as Enemy;
        enemyTarget.incomingDamage = (enemyTarget.incomingDamage || 0) + p.damage;
      }
    }
  }

  if (state.isHost) {
    for (const tower of state.towers) tower.update();
  } else {
    // Clients: Safety check for prediction timeout
    const nowMs = Date.now();
    for (let i = state.towers.length - 1; i >= 0; i--) {
      const tower = state.towers[i];
      if (tower.isPredicted && tower.predictionTime && nowMs - tower.predictionTime > 3000) {
        logger.warn(
          `[Client Prediction] Safety timeout reached for tower at ${tower.col},${tower.row}`
        );

        // Refund predicted cost locally
        const refund = tower.predictedCost || 0;
        if (!state.infiniteGold) {
          state.gold += refund;
        }

        // Visual feedback: red explosion particles + "Timeout!" floating text
        createExplosion(tower.x, tower.y, "#ff3366", 8);
        PoolManager.getFloatingText(tower.x, tower.y, "Timeout!", "#ff3366");

        // Remove from state.towers
        tower.destroy();
        state.towers[i] = state.towers[state.towers.length - 1];
        state.towers.pop();

        // Trigger UI refresh (Authoritative Mutation: state.gold refunded)
        Multiplayer.updateUI();
      }
    }

    // Clients only update visual properties (angle and recoil decay)
    for (const tower of state.towers) {
      if (tower.constructionTimer !== undefined && tower.constructionTimer > 0) {
        tower.constructionTimer--;
        if (tower.constructionTimer === 0) {
          tower.initPixi();
        }
        if (Math.random() < 0.25) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * 16;
          const px = tower.x + Math.cos(angle) * dist;
          const py = tower.y + Math.sin(angle) * dist;
          const color = tower.currentColor || "#4cc9f0";
          PoolManager.getParticle(px, py, color, Math.random() * 1.5 + 0.5, Math.random() * 2 + 1);
        }
        // PIXI: update position/scale during construction animation
        tower.updatePixi();
        continue;
      }

      if (tower.stunTimer > 0) {
        tower.stunTimer--;
        // PIXI: update stun icon state
        tower.updatePixi();
        continue;
      }
      if (tower.recoil > 0) tower.recoil--;
      if (tower.fireCooldown > 0) tower.fireCooldown--;
      if (tower.missileCooldown > 0) tower.missileCooldown--;

      if (!state.enemies || state.enemies.length === 0) {
        tower.target = null;
        if (tower.type === "Prisma") {
          (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget = null;
          (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).lockTimer = 0;
        }
        tower.updatePixi();
        continue;
      }

      if (tower.type === "Prisma" && tower.fireCooldown > 0) {
        // During any cooldown (like target switch cooldown), keep looking at target if we still have one
        if (tower.target) {
          tower.angle = Math.atan2(tower.target.y - tower.y, tower.target.x - tower.x);
        }
        continue;
      }

      // Check if current target is still valid
      const rangeSq = tower.range * tower.range;
      const hasValidTarget =
        tower.target &&
        tower.target.hp > 0 &&
        !tower.target.deadMarked &&
        getDistanceSq(tower.target.x, tower.target.y, tower.x, tower.y) <= rangeSq &&
        state.enemiesSet.has(tower.target);

      if (!hasValidTarget) {
        if (tower.type === "Prisma" && tower.target) {
          // We just lost a target on the client! Trigger the 30-frame search delay
          tower.target = null;
          (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget = null;
          (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).lockTimer = 0;
          tower.fireCooldown = 30; // 30 frames delay before searching for a new target
          continue;
        } else {
          tower.target = tower.findOptimalTarget();
        }
      }

      if (tower.target) {
        tower.angle = Math.atan2(tower.target.y - tower.y, tower.target.x - tower.x);
        if (tower.type === "Prisma") {
          if (
            tower.target ===
            (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget
          ) {
            (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).lockTimer++;
          } else {
            (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget =
              tower.target;
            (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).lockTimer = 0;
            tower.fireCooldown = 15; // 15 frames lock-on delay when switching targets
          }
        }
      } else {
        if (tower.type === "Prisma") {
          (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).lockTimer = 0;
          (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget = null;
        }
      }

      // PIXI: update turret sprite rotation and recoil
      tower.updatePixi();
    }
  }

  if (state.isHost) {
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const enemy = state.enemies[i];
      const status = enemy.update();
      if (status === "reached_end") {
        if (!state.godMode) {
          state.lives -= enemy.typeName === "Boss" || enemy.typeName === "Defragmenter" ? 100 : 1;
          state.lives = Math.max(0, state.lives); // prevent negative lives
        }
        state.screenDamageEffect = 30; // Start pulse
        if (
          enemy.typeName === "Boss" ||
          enemy.typeName === "Defragmenter" ||
          enemy.typeName === "DefragmenterFragment" ||
          enemy.typeName === "DefragmenterSubfragment"
        ) {
          const hasDefragActive = hasActiveDefragmenter(enemy);
          if (
            !hasDefragActive &&
            enemy.typeName !== "Defragmenter" &&
            enemy.typeName !== "DefragmenterFragment"
          ) {
            hideBossBar();
          }
        }
        enemy.deadMarked = true;
        if (enemy.typeName === "Accelerator" && state.activeAccelerators) {
          const accIdx = state.activeAccelerators.indexOf(enemy);
          if (accIdx !== -1) {
            state.activeAccelerators[accIdx] =
              state.activeAccelerators[state.activeAccelerators.length - 1];
            state.activeAccelerators.pop();
          }
        }
        state.enemies[i] = state.enemies[state.enemies.length - 1];
        state.enemies.pop();
        // Hide the PixiJS sprite immediately so the enemy vanishes from view
        if ((enemy as Enemy & { pixiSprite?: { visible: boolean } }).pixiSprite)
          (enemy as Enemy & { pixiSprite?: { visible: boolean } }).pixiSprite!.visible = false;
        createExplosion(enemy.x, enemy.y, enemy.color, 10);

        // Trigger UI refresh (Authoritative Mutation: state.lives updated)
        Multiplayer.updateUI();

        // Multiplayer: Sync lives
        Multiplayer.emitSyncLives(state.lives);
      } else if (enemy.hp <= 0) {
        // Check Meltdown Specialization of Prisma Tower if it was the highest damage contributor
        if (
          (enemy as Enemy & { damageSources?: Map<Tower, number> }).damageSources &&
          (enemy as Enemy & { damageSources?: Map<Tower, number> }).damageSources!.size > 0
        ) {
          let topContributor: Tower | null = null;
          let maxDmg = 0;
          for (const [source, dmg] of (
            enemy as Enemy & { damageSources?: Map<Tower, number> }
          ).damageSources!.entries()) {
            if (dmg > maxDmg) {
              maxDmg = dmg;
              topContributor = source as Tower;
            }
          }
          if (
            topContributor &&
            state.towers.includes(topContributor) &&
            topContributor.type === "Prisma" &&
            topContributor.specialization === "meltdown"
          ) {
            (topContributor as Tower & { triggerMeltdown: (enemy: Enemy) => void }).triggerMeltdown(
              enemy
            );
          }
        }

        let ownerIndex = Multiplayer.myPlayerIndex || 0;
        if (
          (enemy as Enemy & { damageSources?: Map<Tower, number> }).damageSources &&
          (enemy as Enemy & { damageSources?: Map<Tower, number> }).damageSources!.size > 0
        ) {
          let topContributor: Tower | null = null;
          let maxDmg = 0;
          for (const [source, dmg] of (
            enemy as Enemy & { damageSources?: Map<Tower, number> }
          ).damageSources!.entries()) {
            if (dmg > maxDmg) {
              maxDmg = dmg;
              topContributor = source as Tower;
            }
          }
          if (topContributor && (topContributor as any).ownerIndex !== undefined) {
            ownerIndex = (topContributor as any).ownerIndex;
          }
        }

        if (!state.playerGolds) {
          state.playerGolds = [300, 300, 300, 300];
        }
        state.playerGolds[ownerIndex] += enemy.reward;
        if (Multiplayer.myPlayerIndex !== undefined) {
          state.gold = state.playerGolds[Multiplayer.myPlayerIndex] || 0;
        }
        state.totalGoldEarned += enemy.reward;

        if (state.isHost) {
          Multiplayer.emitSyncGold(state.playerGolds);
        }
        createExplosion(enemy.x, enemy.y, enemy.color, 15);
        createCoinBurst(enemy.x, enemy.y, 8);
        PoolManager.getFloatingText(enemy.x, enemy.y, `+${enemy.reward}g`, "#fca311");
        if (
          enemy.typeName === "Boss" ||
          enemy.typeName === "Defragmenter" ||
          enemy.typeName === "DefragmenterFragment" ||
          enemy.typeName === "DefragmenterSubfragment"
        ) {
          if (enemy.typeName === "Boss") {
            for (const t of state.towers) t.stunTimer = 0;
          }
          const hasDefragActive = hasActiveDefragmenter(enemy);
          if (
            !hasDefragActive &&
            enemy.typeName !== "Defragmenter" &&
            enemy.typeName !== "DefragmenterFragment"
          ) {
            hideBossBar();
          }
        }

        // Splinter Split Ability: Spawns 2 extremely fast triangle fragments on death
        if (enemy.typeName === "Splinter") {
          const target = waypoints[enemy.targetWaypointIndex] || {
            x: enemy.x + 1,
            y: enemy.y,
          };
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const dirX = dx / len;
          const dirY = dy / len;
          const perpX = -dirY;
          const perpY = dirX;
          const splitDistance = 25; // split 25px to the left and right (total 50px apart)

          for (let f = 0; f < 2; f++) {
            const fragment = EnemyFactory.getPooledEnemy("SplinterFragment", enemy.waveNumber);
            const side = f === 0 ? 1 : -1;
            fragment.x = enemy.x + perpX * splitDistance * side;
            fragment.y = enemy.y + perpY * splitDistance * side;
            fragment.targetWaypointIndex = enemy.targetWaypointIndex;
            fragment.distanceTravelled = enemy.distanceTravelled;
            state.enemies.push(fragment);
          }
        }

        // Defragmenter Split Ability: Spawns 2 Pentagon fragments on death
        if (enemy.typeName === "Defragmenter") {
          const target = waypoints[enemy.targetWaypointIndex] || {
            x: enemy.x + 1,
            y: enemy.y,
          };
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const dirX = dx / len;
          const dirY = dy / len;

          PoolManager.getShockwave(enemy.x, enemy.y, 80, "#00f5d4");
          createExplosion(enemy.x, enemy.y, "#00f5d4", 35);

          for (let f = 0; f < 2; f++) {
            const fragment = EnemyFactory.getPooledEnemy("DefragmenterFragment", enemy.waveNumber);
            const side = f === 0 ? 1 : -1;
            fragment.x = enemy.x + dirX * 38 * side;
            fragment.y = enemy.y + dirY * 38 * side;
            fragment.targetWaypointIndex = enemy.targetWaypointIndex;
            fragment.distanceTravelled = enemy.distanceTravelled;
            fragment.flashTime = 20;
            state.enemies.push(fragment);
          }
        }

        // DefragmenterFragment Split Ability: Spawns 2 fast Triangle subfragments on death
        if (enemy.typeName === "DefragmenterFragment") {
          const target = waypoints[enemy.targetWaypointIndex] || {
            x: enemy.x + 1,
            y: enemy.y,
          };
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const dirX = dx / len;
          const dirY = dy / len;

          PoolManager.getShockwave(enemy.x, enemy.y, 50, "#00f5d4");
          createExplosion(enemy.x, enemy.y, "#00f5d4", 20);

          for (let f = 0; f < 2; f++) {
            const subfragment = EnemyFactory.getPooledEnemy(
              "DefragmenterSubfragment",
              enemy.waveNumber
            );
            const side = f === 0 ? 1 : -1;
            subfragment.x = enemy.x + dirX * 24 * side;
            subfragment.y = enemy.y + dirY * 24 * side;
            subfragment.targetWaypointIndex = enemy.targetWaypointIndex;
            subfragment.distanceTravelled = enemy.distanceTravelled;
            subfragment.flashTime = 15;
            state.enemies.push(subfragment);
          }
        }

        enemy.deadMarked = true;
        if (enemy.typeName === "Accelerator" && state.activeAccelerators) {
          const accIdx = state.activeAccelerators.indexOf(enemy);
          if (accIdx !== -1) {
            state.activeAccelerators[accIdx] =
              state.activeAccelerators[state.activeAccelerators.length - 1];
            state.activeAccelerators.pop();
          }
        }
        state.enemies[i] = state.enemies[state.enemies.length - 1];
        state.enemies.pop();
        // Hide the PixiJS sprite immediately so the enemy vanishes from view
        if ((enemy as Enemy & { pixiSprite?: { visible: boolean } }).pixiSprite)
          (enemy as Enemy & { pixiSprite?: { visible: boolean } }).pixiSprite!.visible = false;

        // Trigger UI refresh (Authoritative Mutation: state.gold earned)
        Multiplayer.updateUI();

        if (state.lives <= 0 && !state.gameOver) {
          state.gameOver = true;
          logger.warn("Game Over triggered", { wave: state.wave, gold: state.gold });
          Multiplayer.syncNow();
        }
      }
    }
  }

  for (let i = 0; i < state.projectiles.length; i++) {
    state.projectiles[i].update();
  }
  for (let i = 0; i < state.particles.length; i++) {
    state.particles[i].update();
  }
  for (let i = 0; i < state.floatingTexts.length; i++) {
    state.floatingTexts[i].update();
  }
  for (let i = 0; i < state.stunEffects.length; i++) {
    state.stunEffects[i].update();
  }
  for (let i = 0; i < state.groundEffects.length; i++) {
    state.groundEffects[i].update();
  }

  if (state.isHost) {
    handleWaveLogic();
  }
}
