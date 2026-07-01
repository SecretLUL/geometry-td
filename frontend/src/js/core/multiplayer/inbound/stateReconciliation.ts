import { state } from "../../state";
import { Config } from "../../config";
import { EnemyFactory } from "../../../entities/enemies";
import {
  SyncEnemyState,
  SyncFullGameStatePayload,
  SyncDeltaGameStatePayload,
  GameStateSocketPayload,
} from "../../../types";
import { Multiplayer } from "../context";

export function initializeLastReceivedState(): void {
  if (!Multiplayer.lastReceivedState) {
    Multiplayer.lastReceivedState = {
      tick: 0,
      timestamp: performance.now(),
      hostTileSize: Config.TILE_SIZE,
      activeEnemies: [],
      enemiesToSpawn: 0,
      spawnCooldown: 0,
      wave: 1,
      isWaveActive: false,
      autoStartActive: false,
      lives: 20,
      gold: 0,
      enemyPool: [],
      screenDamageEffect: 0,
      benchmarkActive: false,
      towers: [],
    };
  }
}

export function reconstructGameState(
  payload: GameStateSocketPayload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { reconstructedState: SyncFullGameStatePayload; projectileEvents: any[] } | null {
  const stateData = payload.state;
  if (!stateData) return null;

  let reconstructedState: SyncFullGameStatePayload;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let projectileEvents: any[] = [];

  if (payload.fullSync) {
    reconstructedState = payload.state as SyncFullGameStatePayload;
    projectileEvents = (payload.state as SyncFullGameStatePayload).projectileEvents || [];
  } else if (payload.delta) {
    const delta = payload.state as SyncDeltaGameStatePayload;
    projectileEvents = delta.projectileEvents || [];
    reconstructedState = Multiplayer.lastReceivedState as SyncFullGameStatePayload;
    reconstructedState.tick = delta.tick;
    reconstructedState.timestamp = delta.timestamp;
    if (delta.hostTileSize) reconstructedState.hostTileSize = delta.hostTileSize;

    const reconstructedEnemiesMap = new Map<number, SyncEnemyState>();
    for (const e of reconstructedState.activeEnemies) {
      reconstructedEnemiesMap.set(e.id, e);
    }

    for (const d of delta.enemyDelta) {
      const existing = reconstructedEnemiesMap.get(d.id);
      if (existing) {
        Object.assign(existing, d);
      } else {
        reconstructedState.activeEnemies.push(d as SyncEnemyState);
      }
    }
    if (delta.deletedEnemyIds) {
      reconstructedState.activeEnemies = reconstructedState.activeEnemies.filter(
        (e: SyncEnemyState) => !delta.deletedEnemyIds.includes(e.id)
      );
    }

    const otherFields: Array<keyof SyncDeltaGameStatePayload & keyof SyncFullGameStatePayload> = [
      "enemiesToSpawn",
      "spawnCooldown",
      "wave",
      "isWaveActive",
      "autoStartActive",
      "lives",
      "gold",
      "enemyPool",
      "screenDamageEffect",
      "benchmarkActive",
      "towers",
      "playerGolds",
      "playerSlots",
      "relocationActive",
      "playerRelocationStates",
    ];
    for (const key of otherFields) {
      if (delta[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (reconstructedState as any)[key] = delta[key];
      }
    }
  } else {
    return null;
  }

  return { reconstructedState, projectileEvents };
}

export function syncEnemies(activeEnemies: SyncEnemyState[], hostTileSize?: number): void {
  const hostTile = hostTileSize || Config.TILE_SIZE;
  const scale = Config.TILE_SIZE / hostTile;

  // Release existing enemies to the pool to prevent memory leaks and GC spikes
  if (state.enemies && state.enemies.length > 0) {
    state.enemies.forEach((e) => EnemyFactory.releaseEnemyToPool(e));
  }

  state.enemies = activeEnemies.map((eData: SyncEnemyState) => {
    const newEnemy = EnemyFactory.getPooledEnemy(eData.typeName, eData.wave || state.wave);
    newEnemy.hp = eData.hp;
    newEnemy.x = eData.x * scale;
    newEnemy.y = eData.y * scale;
    newEnemy.distanceTravelled = eData.distanceTravelled * scale;
    if (eData.targetWaypointIndex !== undefined) {
      newEnemy.targetWaypointIndex = eData.targetWaypointIndex;
    }
    if (eData.speed) newEnemy.speed = eData.speed * scale;
    if (eData.shieldActive !== undefined) newEnemy.shieldActive = eData.shieldActive;
    if (eData.maxHp) newEnemy.maxHp = eData.maxHp;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newEnemy as any).targetX = eData.x * scale;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (newEnemy as any).targetY = eData.y * scale;
    return newEnemy;
  });
}
