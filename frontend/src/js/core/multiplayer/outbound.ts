/*
 * @file: frontend/src/js/core/multiplayer/outbound.ts
 * @purpose: Transmits local client and host actions (state deltas, tower build/sell/upgrade
 *           requests, speed toggles, wave starts) to the server.
 * @dependencies: state, config, context, types, webrtc
 * @last_update: 2026-06-01 / v1.2.2 - Include shieldHp and maxShieldHp in activeEnemies sync mapping.
 */
import { state } from '../state';
import { Config } from '../config';
import { Multiplayer, socket } from './context';
import { TowerSpecialization, SyncFullGameStatePayload, SyncTowerState, TowerType, ProjectileEvent, SyncEnemyState, SyncDeltaGameStatePayload } from '../../types';
import { broadcastGameStateWebRTC } from './webrtc';

function stringArraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function towersEqual(a: SyncTowerState[] | null | undefined, b: SyncTowerState[] | null | undefined): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].col !== b[i].col ||
            a[i].row !== b[i].row ||
            a[i].type !== b[i].type ||
            a[i].level !== b[i].level ||
            a[i].specId !== b[i].specId ||
            a[i].damageDealt !== b[i].damageDealt ||
            a[i].totalSpent !== b[i].totalSpent) {
            return false;
        }
    }
    return true;
}

export function emitSyncGameState(data: SyncFullGameStatePayload): void {
    Multiplayer.currentTick = (Multiplayer.currentTick || 0) + 1;
    data.tick = Multiplayer.currentTick;
    data.timestamp = Date.now();

    let projectileEvents = data.projectileEvents || [];
    if (projectileEvents.length > 200) {
        // Prioritize: sniper/tesla events, homing rockets, clusters, high damage, and high aoeRadius events
        projectileEvents.sort((a: ProjectileEvent, b: ProjectileEvent) => {
            const scoreA = (a.type === 'sniper' || a.type === 'tesla' ? 5 : 0) +
                           (a.isHoming ? 4 : 0) +
                           (a.isCluster ? 3 : 0) +
                           ((a.aoeRadius && a.aoeRadius > 0) ? 2 : 0) +
                           (a.damage || 0) * 0.01;
            const scoreB = (b.type === 'sniper' || b.type === 'tesla' ? 5 : 0) +
                           (b.isHoming ? 4 : 0) +
                           (b.isCluster ? 3 : 0) +
                           ((b.aoeRadius && b.aoeRadius > 0) ? 2 : 0) +
                           (b.damage || 0) * 0.01;
            return scoreB - scoreA; // Descending order
        });
        projectileEvents = projectileEvents.slice(0, 200);
    }
    delete data.projectileEvents;

    if (!Multiplayer.lastSyncState) {
        Multiplayer.lastSyncState = data;
        const fullPayload = { ...data, projectileEvents };
        const webrtcPayload = { fullSync: true, state: fullPayload };
        const success = broadcastGameStateWebRTC(webrtcPayload);
        if (!success) {
            socket?.emit('sync_game_state', webrtcPayload);
        }
        return;
    }

    const enemyDelta: Array<Partial<SyncEnemyState> & { id: number }> = [];
    const currentEnemies = data.activeEnemies;
    const lastEnemies = Multiplayer.lastSyncState.activeEnemies;

    // O(1) Dictionary Lookup for delta compression
    const lastEnemiesMap = new Map<number, SyncEnemyState>(lastEnemies.map((e: SyncEnemyState) => [e.id, e]));

    for (let e of currentEnemies) {
        const lastE = lastEnemiesMap.get(e.id);
        if (!lastE) {
            enemyDelta.push(e);
        } else {
            const changes: Partial<SyncEnemyState> & { id: number } = { id: e.id };
            let hasChanges = false;
            const objE = e as Record<string, any>;
            const objLastE = lastE as Record<string, any>;
            for (let key in objE) {
                if (objE[key] !== objLastE[key]) {
                    (changes as Record<string, any>)[key] = objE[key];
                    hasChanges = true;
                }
            }
            if (hasChanges) enemyDelta.push(changes);
        }
    }

    // O(1) Set Lookup for deleted enemies to avoid O(N^2) search
    const currentEnemiesSet = new Set<number>(currentEnemies.map((e: SyncEnemyState) => e.id));
    const deletedIds = lastEnemies.filter((le: SyncEnemyState) => !currentEnemiesSet.has(le.id)).map((e: SyncEnemyState) => e.id);

    const delta: SyncDeltaGameStatePayload = {
        tick: data.tick as number,
        timestamp: data.timestamp as number,
        hostTileSize: data.hostTileSize,
        enemyDelta,
        deletedEnemyIds: deletedIds,
        projectileEvents: projectileEvents
    };

    const otherFields: Array<keyof SyncDeltaGameStatePayload & keyof SyncFullGameStatePayload> = ['enemiesToSpawn', 'spawnCooldown', 'wave', 'isWaveActive', 'autoStartActive', 'lives', 'gold', 'enemyPool', 'screenDamageEffect', 'benchmarkActive', 'towers'];
    for (let field of otherFields) {
        if (field === 'enemyPool') {
            if (!stringArraysEqual(data.enemyPool, Multiplayer.lastSyncState.enemyPool) && data.enemyPool !== undefined) {
                delta.enemyPool = data.enemyPool;
            }
        } else if (field === 'towers') {
            if (!towersEqual(data.towers, Multiplayer.lastSyncState.towers) && data.towers !== undefined) {
                delta.towers = data.towers;
            }
        } else {
            if ((data as any)[field] !== (Multiplayer.lastSyncState as any)[field] && (data as any)[field] !== undefined) {
                (delta as any)[field] = (data as any)[field];
            }
        }
    }

    const webrtcPayload = { delta: true, state: delta };
    const success = broadcastGameStateWebRTC(webrtcPayload);
    if (!success) {
        socket?.emit('sync_game_state', webrtcPayload);
    }
    Multiplayer.lastSyncState = data;
}

export function syncNow(): void {
    if (state.isHost) {
        const payload: SyncFullGameStatePayload = {
            hostTileSize: Config.TILE_SIZE,
            activeEnemies: state.enemies.map(e => ({
                id: e.id,
                typeName: e.typeName, hp: e.hp, distanceTravelled: e.distanceTravelled,
                targetWaypointIndex: e.targetWaypointIndex,
                x: e.x, y: e.y, wave: e.waveNumber, speed: e.speed,
                shieldActive: e.shieldActive, maxHp: e.maxHp,
                swarmGroupId: e.swarmGroupId,
                shieldHp: e.shieldHp, maxShieldHp: e.maxShieldHp
            })),
            enemiesToSpawn: state.enemiesToSpawn,
            spawnCooldown: state.spawnCooldown,
            enemyPool: state.enemyPool,
            isWaveActive: state.isWaveActive,
            autoStartActive: state.autoStartActive,
            wave: state.wave,
            lives: state.lives,
            gold: state.gold,
            screenDamageEffect: state.screenDamageEffect,
            benchmarkActive: state.benchmarkActive,
            towers: state.towers.map(t => ({
                col: t.col,
                row: t.row,
                type: t.type,
                level: t.level,
                specId: t.specialization,
                damageDealt: t.damageDealt,
                totalSpent: t.totalSpent
            }))
        };

        if (state.projectileEvents && state.projectileEvents.length > 0) {
            payload.projectileEvents = state.projectileEvents;
            state.projectileEvents = [];
        } else {
            payload.projectileEvents = [];
        }
        Multiplayer.emitSyncGameState(payload);
    }
}

export function emitChangeSpeed(speed: number): void {
    socket?.emit('change_speed', speed);
}

export function emitToggleMod(mod: 'godMode' | 'infiniteGold' | 'waveModified' | 'benchmarkActive', value: boolean): void {
    socket?.emit('toggle_mod', { mod, value });
}

export function emitTogglePause(isPaused: boolean): void {
    socket?.emit('toggle_pause', isPaused);
}

export function emitToggleAuto(isActive: boolean): void {
    socket?.emit('toggle_auto', isActive);
}

export function emitSyncTowers(towersList: SyncTowerState[]): void {
    socket?.emit('sync_towers', towersList);
}

export function emitRequestPlaceTower(type: TowerType, col: number, row: number): void {
    if (state.isHost || !socket || !socket.connected) {
        Multiplayer.processPlaceTower(type, col, row);
    } else {
        socket?.emit('request_place_tower', { type, col, row });
    }
}

export function emitRequestUpgradeTower(col: number, row: number, specId: TowerSpecialization | null = null): void {
    if (state.isHost || !socket || !socket.connected) {
        Multiplayer.processUpgradeTower(col, row, specId);
    } else {
        socket?.emit('request_upgrade_tower', { col, row, specId });
    }
}

export function emitRequestSellTower(col: number, row: number): void {
    if (state.isHost || !socket || !socket.connected) {
        Multiplayer.processSellTower(col, row);
    } else {
        socket?.emit('request_sell_tower', { col, row });
    }
}

export function emitRequestWaveStart(wave: number | { wave: number; pool?: string[] }): void {
    socket?.emit('request_wave_start', wave);
}

export function emitSyncLives(lives: number): void {
    socket?.emit('sync_lives', lives);
}

export function emitSyncGold(gold: number): void {
    socket?.emit('sync_gold', gold);
}

export function emitHostEndedWave(): void {
    socket?.emit('host_ended_wave');
}
