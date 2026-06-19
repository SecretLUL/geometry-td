/*
 * @file: frontend/src/js/core/game/loop.ts
 * @purpose: Coordinates game loop execution ticks, CPU throttling via Web Worker, client-side
 *           entity interpolation, client prediction safety timeouts, and boss health bar updates.
 * @dependencies: state, multiplayer, config, enemies, fx, pool, ui, logger, utils, types, viewport, wave, renderer
 * @last_update: 2026-06-04 / v1.10.0 - Added Boss shield health bar rendering updates and integrated achievements check.
 */
import { state } from "../state";
import { Multiplayer } from "../multiplayer/index";
import { isClientWebRTCOpen } from "../multiplayer/webrtc";
import { Config } from "../config";
import { EnemyFactory } from "../../entities/enemies";
import { createExplosion, createCoinBurst } from "../../fx/fx";
import { PoolManager } from "../pool";
import { updateUI, updateTooltip } from "../../ui/ui";
import { logger } from "../logger";
import { getDistanceSq } from "../utils";
import { waypoints } from "../map";
import { Enemy, Tower } from "../../types";
import { handleWaveLogic } from "./wave";
import { drawScene } from "./renderer";
import { checkAchievements } from "../achievements";

const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";

// FPS tracking state
export let lastFpsUpdate = performance.now();
export let fpsDisplayVal = 60;
export let framesSinceLastFps = 0;

function measureTrueFps(timestamp: number) {
  if (!timestamp) timestamp = performance.now();

  if (timestamp - lastFpsUpdate > 1000) {
    // Reset after long inactive periods (e.g. background tab)
    framesSinceLastFps = 0;
    lastFpsUpdate = timestamp;
  } else {
    framesSinceLastFps++;
    if (timestamp - lastFpsUpdate >= 500) {
      fpsDisplayVal = Math.round((framesSinceLastFps * 1000) / (timestamp - lastFpsUpdate));
      framesSinceLastFps = 0;
      lastFpsUpdate = timestamp;
    }
  }
  requestAnimationFrame(measureTrueFps);
}
// Start a standalone FPS measurement loop independent of the main game loop,
// so it continues tracking render rate even when the tab is unfocused.
requestAnimationFrame(measureTrueFps);

function updateEnemiesSet(): void {
  state.enemiesSet.clear();
  const len = state.enemies.length;
  for (let i = 0; i < len; i++) {
    state.enemiesSet.add(state.enemies[i]);
  }
}

function hasActiveDefragmenter(excludeEnemy: Enemy): boolean {
  const len = state.enemies.length;
  for (let i = 0; i < len; i++) {
    const e = state.enemies[i];
    if (
      e !== excludeEnemy &&
      (e.typeName === "Defragmenter" ||
        e.typeName === "DefragmenterFragment" ||
        e.typeName === "DefragmenterSubfragment")
    ) {
      return true;
    }
  }
  return false;
}

// Persistent Map objects to avoid garbage collection thrashing in game loop interpolation
const state0EnemyMap = new Map<number, unknown>();
const currentEnemyMap = new Map<number, Enemy>();
const syncedIds = new Set<number>();
const newEnemiesBuffer: Enemy[] = [];

// Game loop timing state
export let lastFrameTime = performance.now();
export let lastAnimFrameTime = performance.now();
export let frameCount = 0;
let speedAccumulator = 0;

// Cached DOM element references — initialized once in tryStartGame() to avoid
// expensive getElementById() lookups inside the hot game-loop path (60–144×/s).
let cachedRefreshRateSelect: HTMLSelectElement | null = null;
let cachedFpsDisplayEl: HTMLElement | null = null;
let cachedBossHpFill: HTMLElement | null = null;
let cachedBossHpContainer: HTMLElement | null = null;
let cachedBossName: HTMLElement | null = null;
let cachedBossHpBar: HTMLElement | null = null;
let cachedBossShieldFill: HTMLElement | null = null;
let cachedBossShieldBar: HTMLElement | null = null;

export function gameLoop(timestamp: number, fromWorker = false): void {
  if (!fromWorker) {
    requestAnimationFrame((ts) => gameLoop(ts, false));
  }

  // Determine current focus state
  const isFocused = document.hasFocus() && !document.hidden;

  // Prevent double tick or conflict:
  // 1. Worker ticks should ONLY execute when the window is unfocused or hidden.
  // 2. requestAnimationFrame ticks should ONLY execute when the window is active and focused.
  if (fromWorker && isFocused && !isHeadlessMode) return;
  if (!fromWorker && !isFocused && !isHeadlessMode) return;

  if (!timestamp) timestamp = performance.now();

  let targetFPS =
    parseInt(
      cachedRefreshRateSelect
        ? cachedRefreshRateSelect.value
        : localStorage.getItem("td_refresh_rate") || "60"
    ) || 60;

  // If the window is unfocused and Low Performance Mode is enabled, cap target FPS to 60 FPS
  // to save system resources. Otherwise, allow the high refresh rate (e.g. 144 FPS) to continue.
  if (!isFocused && state.perfMode && targetFPS > 60) {
    targetFPS = 60;
  }
  const frameInterval = 1000 / targetFPS;

  let elapsed = timestamp - lastFrameTime;

  if (elapsed > 100) elapsed = 100; // Cap to prevent spiral of death

  // Mitigate timing jitter (VSync beating for requestAnimationFrame, setInterval inaccuracy for worker).
  // Using a tolerance ensures that if a tick arrives a fraction of a millisecond early,
  // we don't drop it and cause a stutter.
  const tolerance = fromWorker ? 1.0 : 2.0;
  if (elapsed < frameInterval - tolerance) return;

  let consumedTime = 0;
  if (elapsed >= frameInterval) {
    consumedTime = elapsed - (elapsed % frameInterval);
    lastFrameTime = timestamp - (elapsed % frameInterval);
  } else {
    // If we fired slightly early because of the tolerance, advance the timer
    // by exactly one frame interval to keep the average pacing stable.
    consumedTime = frameInterval;
    lastFrameTime += frameInterval;
  }

  // Keep high-brightness HTML DOM FPS overlay hidden (drawn on canvas instead)
  cachedFpsDisplayEl?.classList.add("hidden");

  // Track real elapsed time for visual animations (decoupled from VSync jitter mitigation)
  let animElapsed = timestamp - lastAnimFrameTime;
  if (animElapsed > 100) animElapsed = 100;
  lastAnimFrameTime = timestamp;

  if (!state.isPaused && !state.gameOver) {
    state.animTime = (state.animTime || 0) + animElapsed;
  }

  // Canvas 2D clearing is no longer needed; PixiJS handles clearing on its own tick

  if (state.screenDamageEffect > 0) {
    state.screenDamageEffect--;
  }
  if (state.screenShake > 0) {
    state.screenShake *= 0.9;
    if (state.screenShake < 0.5) state.screenShake = 0;
  }

  if (!state.gameOver) {
    if (!state.isPaused) {
      frameCount++;

      // Run client-side enemy interpolation exactly once per frame
      if (!state.isHost) {
        const now = performance.now();
        // Smooth, ultra-low-latency client interpolation using client local timestamps
        // Dynamic delay: 80ms for high-frequency WebRTC, 150ms to absorb jitter on 10Hz Socket.io fallback.
        const interpolationDelay = isClientWebRTCOpen() ? 80 : 150;
        const renderTime = now - interpolationDelay;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let state0: any = null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let state1: any = null;

        if (Multiplayer.stateBuffer && Multiplayer.stateBuffer.length >= 2) {
          const len = Multiplayer.stateBuffer.length;
          for (let i = 0; i < len - 1; i++) {
            const frameI = Multiplayer.stateBuffer.get(i);
            const frameNext = Multiplayer.stateBuffer.get(i + 1);
            const t0 = frameI.localTimestamp || now - 100;
            const t1 = frameNext.localTimestamp || now;
            if (t0 <= renderTime && t1 >= renderTime) {
              state0 = frameI;
              state1 = frameNext;
              break;
            }
          }
          if (!state0) {
            // If renderTime is ahead of the buffer, interpolate between the latest two frames
            state0 = Multiplayer.stateBuffer.get(len - 2);
            state1 = Multiplayer.stateBuffer.get(len - 1);
          }
        }

        if (state0 && state1) {
          const t0 = state0.localTimestamp || now - 100;
          const t1 = state1.localTimestamp || now;
          let t = t1 === t0 ? 0 : (renderTime - t0) / (t1 - t0);
          if (t < 0) t = 0;
          if (t > 1.3) t = 1.3; // Allow slight extrapolation but cap it to prevent massive jumps/stutter

          const hostTile = state1.hostTileSize || Config.TILE_SIZE;
          const scale = Config.TILE_SIZE / hostTile;

          syncedIds.clear();
          newEnemiesBuffer.length = 0;
          if (!state.activeAccelerators) state.activeAccelerators = [];
          state.activeAccelerators.length = 0;

          state0EnemyMap.clear();
          for (const e of state0.activeEnemies || []) {
            state0EnemyMap.set(e.id, e);
          }

          currentEnemyMap.clear();
          for (const e of state.enemies) {
            currentEnemyMap.set(e.id, e);
          }

          for (const eData1 of state1.activeEnemies || []) {
            // Guard: skip entries without a valid ID
            if (!eData1 || eData1.id === undefined || eData1.id === null) {
              continue;
            }

            const eData0 = state0EnemyMap.get(eData1.id) || eData1;

            let existing = currentEnemyMap.get(eData1.id);
            if (!existing) {
              // Guard: without a typeName we cannot construct a valid enemy
              if (!eData1.typeName) {
                console.warn(
                  `[Client Sync] Skipped spawning enemy ID ${eData1.id} due to missing typeName.`
                );
                continue;
              }
              existing = EnemyFactory.getPooledEnemy(eData1.typeName, eData1.wave || state.wave);
              existing.id = eData1.id;
            }

            const startX = eData0.x * scale;
            const startY = eData0.y * scale;
            const endX = eData1.x * scale;
            const endY = eData1.y * scale;

            // Guard against NaN coordinates
            if (isNaN(startX) || isNaN(startY) || isNaN(endX) || isNaN(endY)) {
              console.warn(
                `[Client Sync] Invalid coordinates for enemy ID ${eData1.id}. start: (${startX}, ${startY}), end: (${endX}, ${endY}).`
              );
              continue;
            }

            existing.x = startX + (endX - startX) * t;
            existing.y = startY + (endY - startY) * t;

            // Guard: only assign values if defined and not NaN
            if (eData1.hp !== undefined && !isNaN(eData1.hp)) {
              existing.hp = eData1.hp;
            }
            if (eData1.distanceTravelled !== undefined && !isNaN(eData1.distanceTravelled)) {
              existing.distanceTravelled = eData1.distanceTravelled * scale;
            }
            if (eData1.targetWaypointIndex !== undefined && !isNaN(eData1.targetWaypointIndex)) {
              existing.targetWaypointIndex = eData1.targetWaypointIndex;
            }
            if (eData1.speed !== undefined && eData1.speed !== null && !isNaN(eData1.speed)) {
              existing.speed = eData1.speed * scale;
            }
            if (eData1.shieldActive !== undefined) {
              existing.shieldActive = eData1.shieldActive;
            }
            if (eData1.maxHp !== undefined && !isNaN(eData1.maxHp)) {
              existing.maxHp = eData1.maxHp;
            }
            if (eData1.swarmGroupId !== undefined) {
              existing.swarmGroupId = eData1.swarmGroupId;
            }

            newEnemiesBuffer.push(existing);
            syncedIds.add(existing.id);
            if (existing.typeName === "Accelerator") {
              state.activeAccelerators.push(existing);
            }
          }

          // Local death detection
          for (const oldEnemy of state.enemies) {
            if (!syncedIds.has(oldEnemy.id)) {
              const lastWaypoint = waypoints[waypoints.length - 1];
              const distToEndSq = lastWaypoint
                ? getDistanceSq(oldEnemy.x, oldEnemy.y, lastWaypoint.x, lastWaypoint.y)
                : 999999;
              const reachedEnd =
                oldEnemy.targetWaypointIndex >= waypoints.length || distToEndSq < 900; // 30 pixels

              if (!reachedEnd) {
                createExplosion(oldEnemy.x, oldEnemy.y, oldEnemy.color, 15);
                createCoinBurst(oldEnemy.x, oldEnemy.y, 8);
                PoolManager.getFloatingText(
                  oldEnemy.x,
                  oldEnemy.y,
                  `+${oldEnemy.reward}g`,
                  "#fca311"
                );
              }

              if (
                oldEnemy.typeName === "Boss" ||
                oldEnemy.typeName === "Defragmenter" ||
                oldEnemy.typeName === "DefragmenterFragment" ||
                oldEnemy.typeName === "DefragmenterSubfragment"
              ) {
                if (oldEnemy.typeName === "Boss") {
                  for (const tw of state.towers) tw.stunTimer = 0;
                }
                const hasDefragActive = hasActiveDefragmenter(oldEnemy);
                if (
                  !hasDefragActive &&
                  oldEnemy.typeName !== "Defragmenter" &&
                  oldEnemy.typeName !== "DefragmenterFragment"
                ) {
                  cachedBossHpContainer?.classList.add("hidden");
                }
              }
              // Release stale/dead client enemy to the pool to prevent GC thrashing
              EnemyFactory.releaseEnemyToPool(oldEnemy);
            }
          }

          state.enemies.length = 0;
          for (let i = 0; i < newEnemiesBuffer.length; i++) {
            state.enemies.push(newEnemiesBuffer[i]);
          }
          updateEnemiesSet();

          // On the host, enemy.update() calls updatePixi() internally.
          // Clients skip enemy.update() entirely, so sprites are never repositioned and become invisible.
          // Fix: call updatePixi() explicitly after each interpolation round.
          for (let i = 0; i < state.enemies.length; i++) {
            (state.enemies[i] as Enemy & { updatePixi?: () => void }).updatePixi?.();
          }
        }
      }

      // Decouple game speed from frame rate using a fixed timestep accumulator.
      // Base logic rate: 60 ticks per second (16.666 ms per tick).
      const baseTickInterval = 1000 / 60;
      speedAccumulator += state.gameSpeed * (consumedTime / baseTickInterval);

      while (speedAccumulator >= 1) {
        speedAccumulator -= 1;
        updateEnemiesSet();

        // Spatial Hashing Grid for Collision optimization (Zero Allocation Array)
        const CELL_SIZE = 100;
        const GRID_WIDTH = 50;
        const GRID_HEIGHT = 50;

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

              // Trigger UI refresh
              updateUI();
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
                PoolManager.getParticle(
                  px,
                  py,
                  color,
                  Math.random() * 1.5 + 0.5,
                  Math.random() * 2 + 1
                );
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
                (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget =
                  null;
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
                (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget =
                  null;
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
                (tower as Tower & { beamTarget: Enemy | null; lockTimer: number }).beamTarget =
                  null;
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
                state.lives -=
                  enemy.typeName === "Boss" || enemy.typeName === "Defragmenter" ? 100 : 1;
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
                  cachedBossHpContainer?.classList.add("hidden");
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
                (enemy as Enemy & { pixiSprite?: { visible: boolean } }).pixiSprite!.visible =
                  false;
              createExplosion(enemy.x, enemy.y, enemy.color, 10);
              updateUI();
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
                  (
                    topContributor as Tower & { triggerMeltdown: (enemy: Enemy) => void }
                  ).triggerMeltdown(enemy);
                }
              }

              state.gold += enemy.reward;
              state.totalGoldEarned += enemy.reward;
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
                  cachedBossHpContainer?.classList.add("hidden");
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
                  const fragment = EnemyFactory.getPooledEnemy(
                    "SplinterFragment",
                    enemy.waveNumber
                  );
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
                  const fragment = EnemyFactory.getPooledEnemy(
                    "DefragmenterFragment",
                    enemy.waveNumber
                  );
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
                (enemy as Enemy & { pixiSprite?: { visible: boolean } }).pixiSprite!.visible =
                  false;
              updateUI();

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

      // Centralized Boss Bar Coordinator
      // Optimized: avoids per-frame array allocation (.filter).
      let defragPartsCount = 0;
      let currentHpSum = 0;
      let defragWaveNumber = state.wave;
      const baseHp = Config.ENEMY_BASE_HP;

      for (let i = 0; i < state.enemies.length; i++) {
        const e = state.enemies[i];
        if (
          e.typeName === "Defragmenter" ||
          e.typeName === "DefragmenterFragment" ||
          e.typeName === "DefragmenterSubfragment"
        ) {
          if (defragPartsCount === 0) {
            defragWaveNumber = e.waveNumber || state.wave;
          }
          defragPartsCount++;

          const hpMultiplier = Config.getHpMultiplier(defragWaveNumber);
          let latentHp = 0;
          if (e.typeName === "Defragmenter") {
            latentHp = Math.floor(baseHp * hpMultiplier * 24);
          } else if (e.typeName === "DefragmenterFragment") {
            latentHp = Math.floor(baseHp * hpMultiplier * 4);
          }
          currentHpSum += Math.max(0, e.hp) + latentHp;
        }
      }

      if (defragPartsCount > 0) {
        const hpMultiplier = Config.getHpMultiplier(defragWaveNumber);
        const totalMaxHp = Math.floor(baseHp * hpMultiplier * 49);

        if (cachedBossHpFill) {
          cachedBossHpFill.style.width = (Math.max(0, currentHpSum) / totalMaxHp) * 100 + "%";
          if (cachedBossHpContainer) {
            cachedBossHpContainer.classList.remove("hidden");
            cachedBossHpContainer.style.boxShadow = "0 0 25px rgba(0, 245, 212, 0.4)";
          }
          if (cachedBossName) {
            cachedBossName.textContent = "d e f r a g m e n t i e r e r";
            cachedBossName.style.textShadow = "0 0 10px #00f5d4";
          }

          // Shield bar must be hidden for the Defragmenter
          if (cachedBossShieldBar) {
            cachedBossShieldBar.classList.add("hidden");
          }

          if (currentHpSum < totalMaxHp * 0.25) {
            const isFlickering = Math.floor(state.animTime / 100) % 2 === 0;
            cachedBossHpFill.style.background = isFlickering
              ? "#ffffff"
              : "linear-gradient(90deg, #00b894, #00f5d4)";
            if (cachedBossHpContainer)
              cachedBossHpContainer.style.borderColor = isFlickering ? "#ffffff" : "#00f5d4";
            if (cachedBossHpBar)
              cachedBossHpBar.style.borderColor = isFlickering ? "#ffffff" : "#00f5d4";
          } else {
            cachedBossHpFill.style.background = "linear-gradient(90deg, #00f5d4, #00cec9)";
            if (cachedBossHpContainer) cachedBossHpContainer.style.borderColor = "#00f5d4";
            if (cachedBossHpBar) cachedBossHpBar.style.borderColor = "#00f5d4";
          }
        }
      } else {
        let boss: Enemy | null = null;
        const enemiesLen = state.enemies.length;
        for (let idx = 0; idx < enemiesLen; idx++) {
          if (state.enemies[idx].typeName === "Boss") {
            boss = state.enemies[idx];
            break;
          }
        }
        if (boss) {
          if (cachedBossHpFill) {
            cachedBossHpFill.style.width = (Math.max(0, boss.hp) / boss.maxHp) * 100 + "%";
            if (cachedBossHpContainer) {
              cachedBossHpContainer.classList.remove("hidden");
              cachedBossHpContainer.style.boxShadow = "0 0 25px rgba(255, 51, 102, 0.4)";
            }
            if (cachedBossName) {
              cachedBossName.textContent = "m u t t e r s c h i f f";
              cachedBossName.style.textShadow = "0 0 10px #ff3366";
            }

            if (boss.hp < boss.maxHp * 0.25) {
              const isFlickering = Math.floor(state.animTime / 100) % 2 === 0;
              cachedBossHpFill.style.background = isFlickering
                ? "#ffffff"
                : "linear-gradient(90deg, #8b0000, #ff0000)";
              if (cachedBossHpContainer)
                cachedBossHpContainer.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
              if (cachedBossHpBar)
                cachedBossHpBar.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
            } else if (boss.hp < boss.maxHp * 0.5) {
              cachedBossHpFill.style.background = "linear-gradient(90deg, #8b0000, #ff0000)";
              if (cachedBossHpContainer) cachedBossHpContainer.style.borderColor = "#ff0000";
              if (cachedBossHpBar) cachedBossHpBar.style.borderColor = "#ff0000";
            } else {
              cachedBossHpFill.style.background = "linear-gradient(90deg, #ff3366, #ff0000)";
              if (cachedBossHpContainer) cachedBossHpContainer.style.borderColor = "#ff3366";
              if (cachedBossHpBar) cachedBossHpBar.style.borderColor = "#ff3366";
            }

            if (cachedBossShieldBar) {
              if (
                boss.shieldActive &&
                boss.shieldHp !== undefined &&
                boss.maxShieldHp !== undefined &&
                boss.shieldHp > 0
              ) {
                cachedBossShieldBar.classList.remove("hidden");
                if (cachedBossShieldFill) {
                  cachedBossShieldFill.style.width =
                    (Math.max(0, boss.shieldHp) / boss.maxShieldHp) * 100 + "%";
                }
              } else {
                cachedBossShieldBar.classList.add("hidden");
              }
            }
          }
        } else {
          if (cachedBossHpContainer && !cachedBossHpContainer.classList.contains("hidden")) {
            cachedBossHpContainer.classList.add("hidden");
          }
        }
      }

      if (frameCount % 30 === 0 && !isHeadlessMode) {
        checkAchievements();
      }

      drawScene(fpsDisplayVal);
    } else {
      // Paused
      drawScene(fpsDisplayVal, true);
    }
    updateTooltip();
  }
}

let assetsLoaded = false;
let syncCompleted = false;

export function triggerAssetsLoaded(): void {
  assetsLoaded = true;
  if (!syncCompleted) {
    const loaderStatus = document.getElementById("loader-status");
    if (loaderStatus) loaderStatus.innerText = "Waiting for server synchronization...";
  }
  tryStartGame();
}

export function triggerSyncCompleted(): void {
  syncCompleted = true;
  tryStartGame();
}

export function prePopulateEnemyGrid(): void {
  const GRID_WIDTH = 50;
  const GRID_HEIGHT = 50;

  if (!state.enemyGrid || !state.activeGridIndices) {
    state.enemyGrid = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => []);
    state.activeGridIndices = [];
  } else {
    for (let i = 0; i < state.enemyGrid.length; i++) {
      state.enemyGrid[i].length = 0;
    }
    state.activeGridIndices.length = 0;
  }
}

export function tryStartGame(): void {
  if (assetsLoaded && syncCompleted) {
    logger.info("Assets loaded and sync complete, starting game loop.");

    // Pre-populate spatial hashing grid arrays to completely eliminate GC overhead in game loop
    prePopulateEnemyGrid();

    // Initialize cached DOM element references once — avoids per-frame getElementById() calls
    cachedRefreshRateSelect = (document.getElementById("igRefreshRateSelect") ||
      document.getElementById("refreshRateSelect")) as HTMLSelectElement | null;
    cachedFpsDisplayEl = document.getElementById("fps-display");
    cachedBossHpFill = document.getElementById("bossHpFill");
    cachedBossHpContainer = document.getElementById("bossHpContainer");
    cachedBossName = document.getElementById("bossName");
    cachedBossHpBar = document.getElementById("bossHpBar");
    cachedBossShieldFill = document.getElementById("bossShieldFill");
    cachedBossShieldBar = document.getElementById("bossShieldBar");

    const loaderStatus = document.getElementById("loader-status");
    if (loaderStatus) loaderStatus.innerText = "Synchronization complete!";

    // Tab-Throttling Hack: Use Web Worker to keep JS thread and Socket.IO alive when tab is hidden
    if (window.Worker) {
      const worker = new Worker("/worker.js");
      worker.onmessage = (e) => {
        if (e.data === "tick") {
          const isFocused = document.hasFocus() && !document.hidden;
          if (!isFocused) {
            gameLoop(performance.now(), true);
          }
        }
      };
      worker.postMessage("start");

      // Send target FPS updates to worker
      const refreshRateSelect = document.getElementById(
        "refreshRateSelect"
      ) as HTMLSelectElement | null;
      const igRefreshRateSelect = document.getElementById(
        "igRefreshRateSelect"
      ) as HTMLSelectElement | null;
      const perfModeToggle = document.getElementById("perfModeToggle") as HTMLInputElement | null;
      const igPerfModeToggle = document.getElementById(
        "igPerfModeToggle"
      ) as HTMLInputElement | null;
      const updateWorkerFps = () => {
        const selectEl = igRefreshRateSelect || refreshRateSelect;
        let fps =
          parseInt(selectEl ? selectEl.value : localStorage.getItem("td_refresh_rate") || "60") ||
          60;

        // If the window is unfocused and Low Performance Mode is enabled, cap worker ticks
        // to a maximum of 60 FPS to save system resources.
        const isFocused = document.hasFocus() && !document.hidden;
        if (!isFocused && state.perfMode && fps > 60) {
          fps = 60;
        }

        worker.postMessage({ type: "setFPS", fps });
      };
      if (refreshRateSelect) refreshRateSelect.addEventListener("change", updateWorkerFps);
      if (igRefreshRateSelect) igRefreshRateSelect.addEventListener("change", updateWorkerFps);
      if (perfModeToggle) perfModeToggle.addEventListener("change", updateWorkerFps);
      if (igPerfModeToggle) igPerfModeToggle.addEventListener("change", updateWorkerFps);
      window.addEventListener("focus", updateWorkerFps);
      window.addEventListener("blur", updateWorkerFps);
      document.addEventListener("visibilitychange", updateWorkerFps);
      // Initial call to align worker FPS with select choice
      updateWorkerFps();
    }

    const loadingScreen = document.getElementById("loading-screen");
    setTimeout(() => {
      if (loadingScreen) loadingScreen.classList.add("fade-out");
      lastFrameTime = performance.now();
      lastAnimFrameTime = performance.now();
      gameLoop(performance.now(), false);
    }, 800);
  }
}
