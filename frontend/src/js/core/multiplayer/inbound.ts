/*
 * @file: frontend/src/js/core/multiplayer/inbound.ts
 * @purpose: Handles reception and parsing of inbound server socket messages (role assignments,
 *           game state updates, tower confirmations, pause commands). Applies full state sync
 *           and delta updates from the host.
 * @dependencies: state, towers, enemies, config, fx, projectiles, ui, types, pool, context, webrtc
 * @last_update: 2026-06-01 / v1.10.3 - Synchronize shieldHp and maxShieldHp in processIncomingGameState.
 */
import { state } from '../state';
import { Tower, SniperTower, BombTower, TeslaTower, PrismaTower, BoosterTower } from '../../entities/towers/index';
import { EnemyFactory } from '../../entities/enemies';
import { Config } from '../config';
import { createExplosion, createCoinBurst } from '../../fx/fx';
import { showGameNotification, setPauseState } from '../../ui/ui';
import {
    Enemy,
    GameStateSocketPayload,
    SyncFullGameStatePayload,
    SyncEnemyState,
    SyncTowerState,
    ProjectileEvent,
    SyncDeltaGameStatePayload,
    SocketEventMap,
    Vector2D
} from '../../types';
import { PoolManager } from '../pool';
import { Multiplayer, socket, setSocket } from './context';
import { handleWebRTCSignal, setWebRTCRole, registerWebRTCMessageHandler, cleanupAllWebRTC, setIceServers } from './webrtc';


export function processIncomingGameState(payload: GameStateSocketPayload): void {
    if (state.isHost) return;
    if (!payload) return;

    const stateData = payload.state;
    if (!stateData) return;

    // Deduplication check: ignore older or already processed packets
    if (Multiplayer.latestServerTimestamp && stateData.timestamp && stateData.timestamp <= Multiplayer.latestServerTimestamp) {
        return;
    }

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
            towers: []
        };
    }

    let reconstructedState: SyncFullGameStatePayload;
    let projectileEvents: ProjectileEvent[] = [];
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
        for (let e of reconstructedState.activeEnemies) {
            reconstructedEnemiesMap.set(e.id, e);
        }

        for (let d of delta.enemyDelta) {
            const existing = reconstructedEnemiesMap.get(d.id);
            if (existing) {
                Object.assign(existing, d);
            } else {
                reconstructedState.activeEnemies.push(d as SyncEnemyState);
            }
        }
        if (delta.deletedEnemyIds) {
            reconstructedState.activeEnemies = reconstructedState.activeEnemies.filter((e: SyncEnemyState) => !delta.deletedEnemyIds.includes(e.id));
        }

        const otherFields: Array<keyof SyncDeltaGameStatePayload & keyof SyncFullGameStatePayload> = ['enemiesToSpawn', 'spawnCooldown', 'wave', 'isWaveActive', 'autoStartActive', 'lives', 'gold', 'enemyPool', 'screenDamageEffect', 'benchmarkActive', 'towers'];
        for (let key of otherFields) {
            if (delta[key] !== undefined) {
                (reconstructedState as any)[key] = delta[key];
            }
        }
    } else {
        return;
    }

    Multiplayer.lastReceivedState = reconstructedState;

    Multiplayer.latestServerTimestamp = Math.max(Multiplayer.latestServerTimestamp || 0, reconstructedState.timestamp || 0);

    // Add high-precision local receipt timestamp to reconstructedState for client-driven interpolation
    reconstructedState.localTimestamp = performance.now();

    const interpolationFrame = {
        localTimestamp: reconstructedState.localTimestamp,
        hostTileSize: reconstructedState.hostTileSize,
        activeEnemies: reconstructedState.activeEnemies.map((e: SyncEnemyState) => ({
            id: e.id,
            typeName: e.typeName,
            wave: e.wave || reconstructedState.wave || 1,
            x: e.x,
            y: e.y,
            hp: e.hp,
            maxHp: e.maxHp,
            distanceTravelled: e.distanceTravelled,
            targetWaypointIndex: e.targetWaypointIndex,
            speed: e.speed,
            shieldActive: e.shieldActive,
            swarmGroupId: e.swarmGroupId,
            shieldHp: e.shieldHp,
            maxShieldHp: e.maxShieldHp
        }))
    };

    Multiplayer.stateBuffer.push(interpolationFrame);

    // Reconstruct visual projectiles/beams
    if (projectileEvents && projectileEvents.length > 0) {
        const enemiesMap = new Map<number, Enemy>();
        for (let e of state.enemies) {
            enemiesMap.set(e.id, e);
        }

        const towersMap = new Map<string, any>();
        for (let t of state.towers) {
            towersMap.set(`${t.col},${t.row}`, t);
        }

        for (let event of projectileEvents) {
            const tower = towersMap.get(`${event.col},${event.row}`);
            if (event.type === 'projectile') {
                let projTarget: Enemy | Vector2D | null = null;
                if (event.targetId !== null && event.targetId !== undefined) {
                    projTarget = enemiesMap.get(event.targetId) || null;
                }
                if (event.targetPoint) {
                    projTarget = event.targetPoint;
                }

                if (projTarget) {
                    if (tower) {
                        if ('hp' in projTarget) {
                            tower.target = projTarget as Enemy;
                        }
                        tower.angle = Math.atan2(projTarget.y - tower.y, projTarget.x - tower.x);
                    }
                    let startX = event.startX !== undefined ? event.startX : (tower ? tower.x : 0);
                    let startY = event.startY !== undefined ? event.startY : (tower ? tower.y : 0);
                    if (event.offsetX !== undefined && event.offsetY !== undefined) {
                        startX += event.offsetX;
                        startY += event.offsetY;
                    }
                    const proj = PoolManager.getProjectile(
                        startX, startY, projTarget, 0, // 0 damage
                        tower, event.aoeRadius, event.projectileSpeed, 0, event.isCluster
                    );
                    proj.isHoming = !!event.isHoming;
                    if (event.trail) {
                        const maxTrail = 15;
                        const len = Math.min(event.trail.length, maxTrail);
                        for (let i = 0; i < len; i++) {
                            proj.trailX[i] = event.trail[i].x;
                            proj.trailY[i] = event.trail[i].y;
                        }
                        proj.trailHead = len % maxTrail;
                        proj.trailCount = len;
                    }

                    if (tower) tower.recoil = tower.type === 'Bomb' ? 10 : 6;
                }
            } else if (event.type === 'sniper') {
                if (tower) {
                    if (tower.type === 'Prisma') {
                        if (event.targetPoint) {
                            tower.angle = Math.atan2(event.targetPoint.y - tower.y, event.targetPoint.x - tower.x);
                        }
                    } else {
                        tower.recoil = 12;
                        let lastX = tower.x + Math.cos(tower.angle) * 26;
                        let lastY = tower.y + Math.sin(tower.angle) * 26;

                        PoolManager.getMuzzleFlash(lastX, lastY, tower.angle, tower.specialization === 'ricochet' ? '#55efc4' : '#a0d8ef');

                        if (event.targetIds) {
                            for (let tid of event.targetIds) {
                                const enemy = enemiesMap.get(tid);
                                if (enemy) {
                                    PoolManager.getSniperBeam(
                                        lastX, lastY,
                                        enemy.x, enemy.y,
                                        tower.specialization === 'ricochet' ? '#55efc4' : '#a0d8ef'
                                    );
                                    lastX = enemy.x;
                                    lastY = enemy.y;

                                    enemy.triggerFlash?.(5);
                                    createExplosion(enemy.x, enemy.y, tower.specialization === 'ricochet' ? '#55efc4' : '#a0d8ef', 3);

                                    if (tid === event.targetIds[0]) {
                                        tower.target = enemy;
                                        tower.angle = Math.atan2(enemy.y - tower.y, enemy.x - tower.x);
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (event.type === 'tesla') {
                let arcColor = '#00ffff';
                if (tower) {
                    if (tower.specialization === 'highvolt') arcColor = '#a29bfe';
                    else if (tower.specialization === 'stun') arcColor = '#81ecec';
                    
                    tower.auraTime = 35;
                    createExplosion(tower.x, tower.y, arcColor, 5);
                }

                if (event.targetIds) {
                    for (let tid of event.targetIds) {
                        const enemy = enemiesMap.get(tid);
                        if (enemy) {
                            enemy.triggerFlash?.(5);
                            createExplosion(enemy.x, enemy.y, arcColor, 3);
                            
                            // Draw lightning arc from tower to target
                            if (tower) {
                                PoolManager.getTeslaArc(tower.x, tower.y, enemy.x, enemy.y, arcColor);
                                
                                // Client-side Level 20 Mastery visuals: double arc + secondary branching leaps
                                if (tower.masteryUnlocked) {
                                    PoolManager.getTeslaArc(tower.x, tower.y, enemy.x, enemy.y, arcColor);
                                    
                                    // Chain visual branching
                                    let closestChainTarget: Enemy | null = null;
                                    let closestDistSq = 90 * 90;
                                    for (let j = 0; j < state.enemies.length; j++) {
                                        const potential = state.enemies[j];
                                        if (potential.id === enemy.id || potential.hp <= 0 || potential.deadMarked) continue;
                                        const dx = potential.x - enemy.x;
                                        const dy = potential.y - enemy.y;
                                        const distSq = dx * dx + dy * dy;
                                        if (distSq < closestDistSq) {
                                            closestDistSq = distSq;
                                            closestChainTarget = potential;
                                        }
                                    }
                                    if (closestChainTarget) {
                                        PoolManager.getTeslaArc(enemy.x, enemy.y, closestChainTarget.x, closestChainTarget.y, arcColor);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Apply immediate game state non-visual updates
    if (reconstructedState.enemiesToSpawn !== undefined) state.enemiesToSpawn = reconstructedState.enemiesToSpawn;
    if (reconstructedState.spawnCooldown !== undefined) state.spawnCooldown = reconstructedState.spawnCooldown;
    if (reconstructedState.enemyPool !== undefined) state.enemyPool = reconstructedState.enemyPool;

    // Visual wave complete trigger for clients
    if (reconstructedState.isWaveActive !== undefined) {
        if (state.isWaveActive && !reconstructedState.isWaveActive && !state.gameOver && (reconstructedState.lives === undefined || reconstructedState.lives > 0) && state.lives > 0) {
            const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
            if (canvas) {
                const waveBonus = Config.WAVE_BONUS_BASE + (state.wave * Config.WAVE_BONUS_PER_WAVE);
                const interest = Math.floor(state.gold * Config.INTEREST_RATE);

                showGameNotification(
                    'wave',
                    `🌊 WELLE ${state.wave} ABGEWEHRT!`,
                    `Sektor gesichert. Die nächste Welle formiert sich bereits.`,
                    { bonus: waveBonus, interest: interest }
                );
                createCoinBurst((canvas.clientWidth || canvas.width) / 2, (canvas.clientHeight || canvas.height) / 2, 20);
            }
        }
        state.isWaveActive = reconstructedState.isWaveActive;
    }

    if (reconstructedState.autoStartActive !== undefined) state.autoStartActive = reconstructedState.autoStartActive;
    if (reconstructedState.wave !== undefined) state.wave = reconstructedState.wave;
    if (reconstructedState.lives !== undefined) {
        if (reconstructedState.lives < state.lives && !state.godMode) {
            state.screenDamageEffect = 30; // Start pulse
        }
        state.lives = reconstructedState.lives;
    }
    if (reconstructedState.screenDamageEffect !== undefined && reconstructedState.screenDamageEffect > 0) {
        if (state.screenDamageEffect === 0 || reconstructedState.screenDamageEffect > state.screenDamageEffect) {
            state.screenDamageEffect = reconstructedState.screenDamageEffect;
        }
    }
    if (reconstructedState.benchmarkActive !== undefined) {
        state.benchmarkActive = reconstructedState.benchmarkActive;
    }
    if (reconstructedState.gold !== undefined) state.gold = reconstructedState.gold;

    if (reconstructedState.towers) {
        reconstructedState.towers.forEach((tData: SyncTowerState) => {
            let tower = state.towers.find(t => t.col === tData.col && t.row === tData.row);
            if (!tower) {
                let TowerClass = Tower;
                if (tData.type === 'Sniper') TowerClass = SniperTower;
                else if (tData.type === 'Bomb') TowerClass = BombTower;
                else if (tData.type === 'Tesla') TowerClass = TeslaTower;
                else if (tData.type === 'Prisma') TowerClass = PrismaTower;
                else if (tData.type === 'Booster') TowerClass = BoosterTower;

                tower = new TowerClass(tData.col, tData.row);
                tower.constructionTimer = 0;
                tower.initPixi();
                state.towers.push(tower);
            }

            if (tower) {
                tower.damageDealt = tData.damageDealt || 0;
                tower.totalSpent = tData.totalSpent !== undefined ? tData.totalSpent : tower.totalSpent;

                // Sync level and specialization authoritatively from host
                const targetLevel = tData.level || 1;
                const limit = (tData.specId && tower.specialization !== tData.specId) ? targetLevel - 1 : targetLevel;
                if (tower.level < limit) {
                    const wasInfinite = state.infiniteGold;
                    state.infiniteGold = true;
                    while (tower.level < limit) {
                        tower.upgrade(undefined, true);
                    }
                    state.infiniteGold = wasInfinite;
                }
                if (tData.specId && tower.specialization !== tData.specId) {
                    const wasInfinite = state.infiniteGold;
                    state.infiniteGold = true;
                    tower.applySpecialization(tData.specId, true);
                    state.infiniteGold = wasInfinite;
                }
            }
        });
    }

    Multiplayer.updateUI();
}

export function bindInboundEvents(startWaveCallback: (data?: { wave: number; tick?: number; timestamp?: number }) => void): void {
    try {
        const onConnect = () => {
                const urlParams = new URLSearchParams(window.location.search);
                const mapName = urlParams.get('map') || 'Unknown Map';
                const mode = urlParams.get('mode') || 'public';
                const roomId = urlParams.get('roomId') || undefined;
                const action = urlParams.get('action') || undefined;
                socket.emit('join_mission', { mapName, mode, roomId, action });
            };

            if (socket.connected) {
                onConnect();
            }
            socket.on('connect', onConnect);

            socket.on('disconnect', () => {
                cleanupAllWebRTC();
            });

            socket.on('room_error', (msg: string) => {
                console.error("Room error:", msg);
                alert("Sector connection error: " + msg);
                window.location.href = 'index.html?error=' + encodeURIComponent(msg);
            });

            socket.on('role_assigned', (data: SocketEventMap['role_assigned']) => {
                state.isHost = data.isHost;
                if (data.iceServers) {
                    setIceServers(data.iceServers);
                }
                // Inform the WebRTC manager of the role change
                setWebRTCRole(state.isHost, null);
                if (state.isHost) {
                    // Host immediately syncs the starting parameters to the server!
                    Multiplayer.emitSyncGold(state.gold);
                    Multiplayer.emitSyncLives(state.lives);
                }
            });

            socket.on('webrtc_signal', (data: { senderId: string; signal: any }) => {
                handleWebRTCSignal(data.senderId, data.signal);
            });

            socket.on('connect_error', () => {
                console.warn("Connection to server failed. Switching to local host mode.");
                state.isHost = true;
            });

            // Register WebRTC message handler to receive UDP-like packets
            registerWebRTCMessageHandler(processIncomingGameState);

            // Initial state for late-joining clients
            socket.on('full_game_state', (data: SocketEventMap['full_game_state']) => {
                if (!state.isHost) {
                    if (data.wave) state.wave = data.wave;
                    if (data.lives !== undefined) state.lives = data.lives;
                    if (data.gold !== undefined) state.gold = data.gold;
                }

                // Initialize WebRTC connection using hostId provided by server
                setWebRTCRole(state.isHost, data.hostId || null);
                const {
                    towers, wave, isPaused, activeEnemies,
                    enemiesToSpawn, spawnCooldown, gameSpeed,
                    godModeActive, infiniteGoldActive, playerCount,
                    enemyPool, isWaveActive, lives, gold, hostTileSize, autoStartActive,
                    waveModified, benchmarkActive, mode, roomId
                } = data;

                Multiplayer.activeMode = mode;
                Multiplayer.activeRoomId = roomId;

                if (state.towers) {
                    state.towers.forEach(t => {
                        if (t.pixiSprite) t.pixiSprite.destroy();
                    });
                }
                state.towers = [];
                const wasInfinite = state.infiniteGold;
                state.infiniteGold = true;

                towers.forEach((tData: SyncTowerState) => {
                    let TowerClass = Tower;
                    if (tData.type === 'Sniper') TowerClass = SniperTower;
                    else if (tData.type === 'Bomb') TowerClass = BombTower;
                    else if (tData.type === 'Tesla') TowerClass = TeslaTower;
                    else if (tData.type === 'Prisma') TowerClass = PrismaTower;
                    else if (tData.type === 'Booster') TowerClass = BoosterTower;

                    const newTower = new TowerClass(tData.col, tData.row);
                    const targetLevel = tData.level || 1;
                    const limit = tData.specId ? targetLevel - 1 : targetLevel;
                    for (let i = 1; i < limit; i++) {
                        newTower.upgrade(undefined, true);
                    }
                    if (tData.specId) {
                        newTower.applySpecialization(tData.specId, true);
                    }

                    newTower.damageDealt = tData.damageDealt || 0;
                    newTower.totalSpent = tData.totalSpent !== undefined ? tData.totalSpent : newTower.totalSpent;
                    newTower.constructionTimer = 0;
                    newTower.initPixi();

                    state.towers.push(newTower);
                });

                state.infiniteGold = wasInfinite;

                if (wave) state.wave = wave;
                if (isPaused !== undefined) state.isPaused = isPaused;
                if (gameSpeed !== undefined) state.gameSpeed = gameSpeed;
                if (godModeActive !== undefined) state.godMode = godModeActive;
                if (infiniteGoldActive !== undefined) state.infiniteGold = infiniteGoldActive;
                if (waveModified !== undefined) state.waveModified = waveModified;
                if (benchmarkActive !== undefined) state.benchmarkActive = benchmarkActive;
                if (enemyPool !== undefined) state.enemyPool = enemyPool;
                if (isWaveActive !== undefined) state.isWaveActive = isWaveActive;
                if (autoStartActive !== undefined) {
                    state.autoStartActive = autoStartActive;
                    const autoBtn = document.getElementById('autoStartBtn');
                    if (autoBtn) {
                        autoBtn.innerText = state.autoStartActive ? 'Auto: An' : 'Auto: Aus';
                        autoBtn.style.background = state.autoStartActive ? 'linear-gradient(to bottom, #00ff88, #00b35f)' : '';
                        autoBtn.style.color = state.autoStartActive ? '#fff' : '';
                    }
                }

                if (activeEnemies) {
                    const hostTile = hostTileSize || Config.TILE_SIZE;
                    const scale = Config.TILE_SIZE / hostTile;

                    // Release existing enemies to the pool to prevent memory leaks and GC spikes
                    if (state.enemies && state.enemies.length > 0) {
                        state.enemies.forEach(e => EnemyFactory.releaseEnemyToPool(e));
                    }

                    state.enemies = activeEnemies.map((eData: SyncEnemyState) => {
                        const newEnemy = EnemyFactory.getPooledEnemy(eData.typeName, eData.wave || state.wave);
                        newEnemy.hp = eData.hp;
                        newEnemy.x = eData.x * scale;
                        newEnemy.y = eData.y * scale;
                        newEnemy.distanceTravelled = eData.distanceTravelled * scale;
                        if (eData.targetWaypointIndex !== undefined) newEnemy.targetWaypointIndex = eData.targetWaypointIndex;
                        if (eData.speed) newEnemy.speed = eData.speed * scale;
                        if (eData.shieldActive !== undefined) newEnemy.shieldActive = eData.shieldActive;
                        if (eData.maxHp) newEnemy.maxHp = eData.maxHp;
                        (newEnemy as any).targetX = eData.x * scale;
                        (newEnemy as any).targetY = eData.y * scale;
                        return newEnemy;
                    });
                }
                if (enemiesToSpawn !== undefined) state.enemiesToSpawn = enemiesToSpawn;
                if (spawnCooldown !== undefined) state.spawnCooldown = spawnCooldown;

                // Update UI controls to reflect received state
                const pauseBtn = document.getElementById('pauseBtn');
                if (pauseBtn) {
                    pauseBtn.innerText = state.isPaused ? 'Weiter' : 'Pause';
                    pauseBtn.style.background = state.isPaused ? 'linear-gradient(to bottom, #ffb703, #d49a00)' : '';
                    pauseBtn.style.color = state.isPaused ? '#fff' : '';
                }

                const speedBtn = document.getElementById('speedBtn');
                if (speedBtn) {
                    if (state.gameSpeed === Config.GAME_SPEEDS.FAST) {
                        speedBtn.innerText = '2x Speed';
                        speedBtn.style.background = 'linear-gradient(to bottom, #ffb703, #d49a00)';
                        speedBtn.style.color = '#fff';
                    } else if (state.gameSpeed === Config.GAME_SPEEDS.SUPER_FAST) {
                        speedBtn.innerText = '4x Speed';
                        speedBtn.style.background = 'linear-gradient(to bottom, #ff0055, #b3003b)';
                        speedBtn.style.color = '#fff';
                    } else {
                        speedBtn.innerText = '1x Speed';
                        speedBtn.style.background = '';
                        speedBtn.style.color = '';
                    }
                }

                if (!state.isHost) {
                    if (lives !== undefined) state.lives = lives;
                    if (gold !== undefined) state.gold = gold;
                }

                if (playerCount !== undefined) {
                    Multiplayer.updatePlayerCountUI(playerCount);
                }

                // Initialize lastReceivedState for future delta updates
                Multiplayer.lastReceivedState = {
                    tick: wave || 0,
                    timestamp: performance.now(),
                    hostTileSize: hostTileSize || Config.TILE_SIZE,
                    activeEnemies: activeEnemies ? activeEnemies.map((eData: SyncEnemyState) => ({
                        id: eData.id,
                        typeName: eData.typeName,
                        wave: eData.wave || wave || state.wave,
                        x: eData.x, // Keep in host coordinates
                        y: eData.y, // Keep in host coordinates
                        hp: eData.hp,
                        maxHp: eData.maxHp || eData.hp,
                        distanceTravelled: eData.distanceTravelled, // Keep in host coordinates
                        targetWaypointIndex: eData.targetWaypointIndex !== undefined ? eData.targetWaypointIndex : 0,
                        speed: eData.speed !== undefined ? eData.speed : 1, // Keep in host coordinates
                        shieldActive: eData.shieldActive || false,
                        swarmGroupId: eData.swarmGroupId,
                        shieldHp: eData.shieldHp,
                        maxShieldHp: eData.maxShieldHp
                    })) : [],
                    enemiesToSpawn: enemiesToSpawn || 0,
                    spawnCooldown: spawnCooldown || 0,
                    wave: wave || 1,
                    isWaveActive: isWaveActive || false,
                    autoStartActive: autoStartActive || false,
                    lives: lives || 20,
                    gold: gold || 0,
                    enemyPool: enemyPool || [],
                    screenDamageEffect: 0,
                    benchmarkActive: benchmarkActive || false,
                    towers: towers || []
                };

                Multiplayer.updateUI();
                socket.emit('ready_to_play');
            });

            socket.on('sync_complete', () => {
                if ((window as any).onSyncComplete) (window as any).onSyncComplete();
            });

            socket.on('sync_game_state', (payload: GameStateSocketPayload) => {
                processIncomingGameState(payload);
            });

            // Toggle Pause
            socket.on('toggle_pause', (isPaused: boolean) => {
                setPauseState(isPaused);
            });

            // Change Speed
            socket.on('change_speed', (speed: number) => {
                state.gameSpeed = speed;
                const speedBtn = document.getElementById('speedBtn');
                if (speedBtn) {
                    if (state.gameSpeed === Config.GAME_SPEEDS.FAST) {
                        speedBtn.innerText = '2x Speed';
                        speedBtn.style.background = 'linear-gradient(to bottom, #ffb703, #d49a00)';
                        speedBtn.style.color = '#fff';
                    } else if (state.gameSpeed === Config.GAME_SPEEDS.SUPER_FAST) {
                        speedBtn.innerText = '4x Speed';
                        speedBtn.style.background = 'linear-gradient(to bottom, #ff0055, #b3003b)';
                        speedBtn.style.color = '#fff';
                    } else {
                        speedBtn.innerText = '1x Speed';
                        speedBtn.style.background = '';
                        speedBtn.style.color = '';
                    }
                }
            });

            // Toggle Mod
            socket.on('toggle_mod', (data: SocketEventMap['toggle_mod']) => {
                if (data.mod === 'godMode') state.godMode = data.value;
                if (data.mod === 'infiniteGold') state.infiniteGold = data.value;
                if (data.mod === 'waveModified') state.waveModified = data.value;
                if (data.mod === 'benchmarkActive') state.benchmarkActive = data.value;
                Multiplayer.updateUI();
            });

            // Toggle Auto
            socket.on('toggle_auto', (isActive: boolean) => {
                state.autoStartActive = isActive;
                Multiplayer.updateUI();

                if (state.autoStartActive && !state.isWaveActive && !state.gameOver) {
                    startWaveCallback();
                }
            });

            // Player Count Update
            socket.on('player_count_update', (count: number) => {
                if (Multiplayer.lastPlayerCount !== undefined && Multiplayer.lastPlayerCount !== null) {
                    if (count > Multiplayer.lastPlayerCount) {
                        showGameNotification(
                            'info',
                            '👥 MITGLIED BEIGETRETEN',
                            'Ein neuer Spieler ist der Mission beigetreten. Willkommen im Trupp!'
                        );
                        // Reset lastSyncState to force a full state update for the new player
                        if (state.isHost) {
                            Multiplayer.lastSyncState = null;
                            Multiplayer.syncNow();
                        }
                    } else if (count < Multiplayer.lastPlayerCount) {
                        showGameNotification(
                            'warning',
                            '👥 SPIELER AUSGETRETEN',
                            'Ein Spieler hat die Verbindung getrennt. Weiterkämpfen!'
                        );
                    }
                }
                Multiplayer.lastPlayerCount = count;
                Multiplayer.updatePlayerCountUI(count);
            });

            // Sync Towers
            socket.on('sync_towers', (towersList: SyncTowerState[]) => {
                if (state.isHost) return; // Only clients process this

                if (state.towers) {
                    state.towers.forEach(t => {
                        if (t.pixiSprite) t.pixiSprite.destroy();
                    });
                }
                state.towers = [];
                const wasInfinite = state.infiniteGold;
                state.infiniteGold = true;

                towersList.forEach((tData: SyncTowerState) => {
                    let TowerClass = Tower;
                    if (tData.type === 'Sniper') TowerClass = SniperTower;
                    else if (tData.type === 'Bomb') TowerClass = BombTower;
                    else if (tData.type === 'Tesla') TowerClass = TeslaTower;
                    else if (tData.type === 'Prisma') TowerClass = PrismaTower;
                    else if (tData.type === 'Booster') TowerClass = BoosterTower;

                    const newTower = new TowerClass(tData.col, tData.row);
                    const targetLevel = tData.level || 1;
                    const limit = tData.specId ? targetLevel - 1 : targetLevel;
                    for (let i = 1; i < limit; i++) {
                        newTower.upgrade(undefined, true);
                    }
                    if (tData.specId) {
                        newTower.applySpecialization(tData.specId, true);
                    }

                    newTower.damageDealt = tData.damageDealt || 0;
                    newTower.totalSpent = tData.totalSpent !== undefined ? tData.totalSpent : newTower.totalSpent;
                    newTower.constructionTimer = 0;
                    newTower.initPixi();

                    state.towers.push(newTower);
                });

                state.infiniteGold = wasInfinite;
                Multiplayer.updateUI();
            });

            // Host Validation Listeners
            socket.on('request_place_tower', (data: SocketEventMap['request_place_tower']) => {
                if (!state.isHost) return;
                Multiplayer.processPlaceTower(data.type, data.col, data.row);
            });

            socket.on('request_upgrade_tower', (data: SocketEventMap['request_upgrade_tower']) => {
                if (!state.isHost) return;
                Multiplayer.processUpgradeTower(data.col, data.row, data.specId, true);
            });

            socket.on('request_sell_tower', (data: SocketEventMap['request_sell_tower']) => {
                if (!state.isHost) return;
                Multiplayer.processSellTower(data.col, data.row);
            });

            // Client Confirms
            socket.on('confirm_place_tower', (data: SocketEventMap['confirm_place_tower']) => {
                if (state.isHost) return;
                const { type, col, row } = data;
                
                const TS = Config.TILE_SIZE;
                const existing = state.towers.find(t => t.col === col && t.row === row);
                
                if (existing) {
                    if (existing.isPredicted) {
                        existing.isPredicted = false;
                        delete existing.predictionTime;
                        delete existing.predictedCost;
                        createExplosion(col * TS + TS / 2, row * TS + TS / 2, '#ffffff', 5);
                        Multiplayer.updateUI();
                    }
                    return;
                }

                let TowerClass = Tower;
                if (type === 'Sniper') TowerClass = SniperTower;
                else if (type === 'Bomb') TowerClass = BombTower;
                else if (type === 'Tesla') TowerClass = TeslaTower;
                else if (type === 'Prisma') TowerClass = PrismaTower;
                else if (type === 'Booster') TowerClass = BoosterTower;

                const newTower = new TowerClass(col, row);
                state.towers.push(newTower);

                createExplosion(col * TS + TS / 2, row * TS + TS / 2, '#ffffff', 5);
                Multiplayer.updateUI();
            });

            socket.on('reject_place_tower', (data: SocketEventMap['reject_place_tower']) => {
                if (state.isHost) return;
                const { col, row } = data;
                
                const idx = state.towers.findIndex(t => t.col === col && t.row === row);
                if (idx !== -1) {
                    const tower = state.towers[idx];
                    if (tower.isPredicted) {
                        // Rollback gold
                        if (!state.infiniteGold && tower.predictedCost !== undefined) {
                            state.gold += tower.predictedCost;
                        }
                        
                        // Remove from towers
                        if (tower.pixiSprite) {
                            tower.pixiSprite.destroy();
                        }
                        state.towers.splice(idx, 1);
                        
                        // Spawn red failure explosion and floating text
                        const TS = Config.TILE_SIZE;
                        const centerX = col * TS + TS / 2;
                        const centerY = row * TS + TS / 2;
                        createExplosion(centerX, centerY, '#ff3366', 8);
                        PoolManager.getFloatingText(centerX, centerY, 'Failed!', '#ff3366');
                        
                        Multiplayer.updateUI();
                    }
                }
            });

            socket.on('confirm_upgrade_tower', (data: SocketEventMap['confirm_upgrade_tower']) => {
                if (state.isHost) return;
                const { col, row, specId, level } = data;
                const tower = state.towers.find(t => t.col === col && t.row === row);
                if (tower) {
                    const wasInfinite = state.infiniteGold;
                    state.infiniteGold = true;
                    
                    const targetLevel = level || (specId ? 10 : tower.level + 1);
                    const limit = specId ? targetLevel - 1 : targetLevel;
                    while (tower.level < limit) {
                        tower.upgrade(undefined, true);
                    }
                    if (specId && tower.specialization !== specId) {
                        tower.applySpecialization(specId, true);
                    }
                    
                    state.infiniteGold = wasInfinite;
                    Multiplayer.updateUI();
                }
            });

            socket.on('confirm_sell_tower', (data: SocketEventMap['confirm_sell_tower']) => {
                if (state.isHost) return;
                const { col, row } = data;
                const idx = state.towers.findIndex(t => t.col === col && t.row === row);
                if (idx !== -1) {
                    const tower = state.towers[idx];
                    if (tower.pixiSprite) {
                        tower.pixiSprite.destroy();
                    }
                    state.towers.splice(idx, 1);
                    createExplosion(tower.x, tower.y, '#e94560', 10);
                    Multiplayer.updateUI();
                }
            });

            // Wave start synchronization
            socket.on('start_wave_sync', (data: SocketEventMap['start_wave_sync']) => {
                if (!state.isWaveActive) {
                    startWaveCallback(data);
                }
            });

            // Lives synchronization
            socket.on('sync_lives', (lives: number) => {
                if (lives < state.lives && !state.godMode) {
                    state.screenDamageEffect = 30; // Start pulse
                }
                state.lives = lives;
                Multiplayer.updateUI();
            });

            // Gold synchronization (optional, if needed)
            socket.on('sync_gold', (gold: number) => {
                state.gold = gold;
                Multiplayer.updateUI();
            });

            // Host ended wave notification
            socket.on('host_ended_wave', () => {
                showGameNotification(
                    'info',
                    '🌊 WELLE BEENDET',
                    'Der Host hat die aktuelle Welle sofort beendet.'
                );
            });
        } catch (err) {
            console.error("Error binding socket events. Multiplayer disabled.", err);
            setSocket(null); // Disable multiplayer if events cannot be bound
            cleanupAllWebRTC();
        }
}
