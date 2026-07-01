/*
 * @file: frontend/src/js/core/game/clientInterpolation.ts
 * @purpose: Coordinates client-side entity interpolation from Multiplayer.stateBuffer,
 *           triggers local death visual effects, and handles pool releases.
 * @dependencies: state, multiplayer, config, enemies, fx, pool, utils, map, types, helpers, bossBar
 */
import { state } from "../state";
import { Multiplayer } from "../multiplayer/index";
import { isClientWebRTCOpen } from "../multiplayer/webrtc";
import { Config } from "../config";
import { EnemyFactory } from "../../entities/enemies";
import { createExplosion, createCoinBurst } from "../../fx/fx";
import { PoolManager } from "../pool";
import { getDistanceSq } from "../utils";
import { waypoints } from "../map";
import { Enemy } from "../../types";
import { updateEnemiesSet, hasActiveDefragmenter } from "./helpers";
import { hideBossBar } from "./bossBar";

// Persistent Map objects to avoid garbage collection thrashing in game loop interpolation
const state0EnemyMap = new Map<number, unknown>();
const currentEnemyMap = new Map<number, Enemy>();
const syncedIds = new Set<number>();
const newEnemiesBuffer: Enemy[] = [];

export function interpolateClientEnemies(): void {
  if (state.isHost) return;

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
        const reachedEnd = oldEnemy.targetWaypointIndex >= waypoints.length || distToEndSq < 900; // 30 pixels

        if (!reachedEnd) {
          createExplosion(oldEnemy.x, oldEnemy.y, oldEnemy.color, 15);
          createCoinBurst(oldEnemy.x, oldEnemy.y, 8);
          PoolManager.getFloatingText(oldEnemy.x, oldEnemy.y, `+${oldEnemy.reward}g`, "#fca311");
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
            hideBossBar();
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
