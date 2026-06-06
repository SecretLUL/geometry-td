/*
 * @file: frontend/src/js/core/game/wave.ts
 * @purpose: Coordinates wave progression, enemy pool generation, wave execution, multiplayer
 *           synchronization emit requests, and end-of-wave reward calculation.
 * @dependencies: state, config, enemies, fx, ui, multiplayer, logger, viewport
 * @last_update: 2026-06-01 / v1.4.0 - Added Accelerator to new geometry unlock warning descriptions.
 */
import { state } from '../state';
import { Config, EnemyData } from '../config';
import { EnemyFactory } from '../../entities/enemies';
import { createCoinBurst } from '../../fx/fx';
import { updateUI, showGameNotification } from '../../ui/ui';
import { Multiplayer } from '../multiplayer/index';
import { logger } from '../logger';
import { app } from './viewport';

export function generateEnemyPool(wave: number): string[] {
    let enemiesToSpawn = Config.WAVE_BASE_ENEMIES + Math.floor(wave * Config.WAVE_ENEMIES_MULTIPLIER);
    let pool: string[] = [];

    const bossInterval = 20;
    if (wave > 0 && wave % bossInterval === 0) {
        const primaryBosses = Object.keys(EnemyData).filter(type =>
            EnemyData[type as any].category === 'Bosse' &&
            !type.includes('Fragment') &&
            !type.includes('Subfragment')
        );
        const bossIndex = Math.floor(wave / bossInterval) - 1;
        const selectedBoss = primaryBosses[bossIndex % primaryBosses.length] || 'Boss';
        return [selectedBoss];
    } else {
        let availableEnemies = Object.keys(EnemyData).filter(type => {
            if (EnemyData[type].category === 'Bosse' || EnemyData[type].unlockWave > wave) {
                return false;
            }
            if (type === 'Collector') {
                const lastWave = state.lastCollectorWave || 0;
                if (wave - lastWave < 4) {
                    return false; // Needs at least a 3-wave break between spawns
                }
            }
            return true;
        });
        let poolPercentages: Record<string, number> = {};
        let totalWeightOfOthers = 0;

        availableEnemies.forEach(type => {
            if (type !== 'Normal') {
                const weight = EnemyData[type].poolWeight || 0;
                poolPercentages[type] = weight;
                totalWeightOfOthers += weight;
            }
        });

        poolPercentages['Normal'] = Math.max(0.1, 1.0 - totalWeightOfOthers);
        const total = Object.values(poolPercentages).reduce((a, b) => a + b, 0);
        Object.keys(poolPercentages).forEach(k => poolPercentages[k] /= total);

        let extraComplexity = Math.min(0.3, Math.floor(wave / 5) * 0.05);
        if (availableEnemies.length > 1) {
            poolPercentages['Normal'] = Math.max(0.05, poolPercentages['Normal'] - extraComplexity);
            let extraPerType = extraComplexity / (availableEnemies.length - 1);
            availableEnemies.forEach(type => {
                if (type !== 'Normal') poolPercentages[type] += extraPerType;
            });
        }

        let counts: Record<string, number> = {};
        let totalCount = 0;
        availableEnemies.forEach(type => {
            let num = Math.floor(enemiesToSpawn * poolPercentages[type]);
            if (type === 'Collector') {
                num = Math.min(1, num); // Enforce a maximum of 1 Collector per wave
            }
            counts[type] = num;
            totalCount += num;
        });
        counts['Normal'] += (enemiesToSpawn - totalCount);

        availableEnemies.forEach(type => {
            for (let i = 0; i < counts[type]; i++) pool.push(type);
        });

        pool.sort(() => Math.random() - 0.5);
        pool = spaceOutEnemyType(pool, 'Accelerator');

        // Guarantee newly unlocked enemies spawn first (and are guaranteed to be in the pool)
        let newlyUnlocked = availableEnemies.filter(type => EnemyData[type].unlockWave === wave);
        for (let newType of newlyUnlocked) {
            const index = pool.indexOf(newType);
            if (index !== -1) {
                pool.splice(index, 1);
            } else {
                // If the enemy type missed the pool due to low weight, force it in
                const normalIdx = pool.indexOf('Normal');
                if (normalIdx !== -1) {
                    pool.splice(normalIdx, 1); // Remove a Normal to make room
                }
            }
            // Append to end: since spawning pops from the end, this guarantees it spawns first
            pool.push(newType);
        }
        if (pool.includes('Collector')) {
            state.lastCollectorWave = wave;
        }
    }
    return pool;
}

export function startWave(): void {
    if (state.isWaveActive || state.gameOver) return;

    // Multiplayer: host generates the pool and broadcasts it to all players
    if (state.isHost) {
        const pool = generateEnemyPool(state.wave);
        Multiplayer.emitRequestWaveStart({ wave: state.wave, pool: pool });
    } else {
        Multiplayer.emitRequestWaveStart({ wave: state.wave });
    }
}

// Called by the multiplayer system or locally to start a wave
export function executeStartWave(data: any): void {
    if (state.isWaveActive || state.gameOver) return;

    const waveNumber = (typeof data === 'object') ? data.wave : data;
    const pool = (typeof data === 'object') ? data.pool : null;

    state.isWaveActive = true;
    state.wave = waveNumber;

    logger.info(`Starting wave ${state.wave}`, { enemiesToSpawn: state.enemiesToSpawn });
    const swBtn = document.getElementById('startWaveBtn') as HTMLButtonElement | null;
    if (swBtn) {
        swBtn.disabled = true;
        swBtn.classList.add('btn-disabled');
    }

    state.enemiesToSpawn = Config.WAVE_BASE_ENEMIES + Math.floor(state.wave * Config.WAVE_ENEMIES_MULTIPLIER);
    state.spawnCooldown = 0;

    // Check newly unlocked enemies
    let newlyUnlocked: string[] = [];
    Object.keys(EnemyData).forEach(type => {
        if (EnemyData[type].category !== 'Bosse' && EnemyData[type].unlockWave === state.wave) {
            newlyUnlocked.push(type);
        }
    });

    if (newlyUnlocked.length > 0) {
        const enemyNames = newlyUnlocked.map(type => {
            if (type === 'Fast') return 'Schneller Feind ⚡';
            if (type === 'Bruiser') return 'Panzer-Feind 🛡️';
            if (type === 'Shielded') return 'Schild-Feind 🧪';
            if (type === 'Regrower') return 'Heil-Feind 🩹';
            if (type === 'Splinter') return 'Splitter-Feind 🌀';
            if (type === 'Accelerator') return 'Beschleuniger ⏩';
            return type;
        }).join(', ');
        showGameNotification(
            'warning',
            '⚠️ GEFAHR... NEUE GEOMETRIE!',
            `Neue gegnerische Geometrie gesichtet: <strong>${enemyNames}</strong>. Bereite die Verteidigung vor!`
        );
    }

    // Use synced pool or generate local fallback
    if (pool) {
        state.enemyPool = [...pool];
        state.enemiesToSpawn = state.enemyPool.length;
        if (state.enemyPool.includes('Collector')) {
            state.lastCollectorWave = state.wave;
        }
    } else {
        state.enemyPool = generateEnemyPool(state.wave);
        state.enemiesToSpawn = state.enemyPool.length;
    }

    updateUI();
}

export function handleWaveLogic(): void {
    if (!state.isWaveActive || state.gameOver || state.lives <= 0) return;

    if (state.enemiesToSpawn > 0) {
        if (state.spawnCooldown <= 0) {
            let type = 'Normal';
            if (state.enemyPool && state.enemyPool.length > 0) {
                type = state.enemyPool.pop()!;
            }

            if (type === 'Swarm') {
                const clusterSize = 12;
                const swarmGroupId = Math.floor(Math.random() * 1000000000);
                for (let i = 0; i < clusterSize; i++) {
                    const swarmEntity = EnemyFactory.createEnemy('Swarm', state.wave) as any;
                    swarmEntity.swarmGroupId = swarmGroupId;

                    const angle = Math.random() * Math.PI * 2;
                    const r = 20 * Math.sqrt(Math.random()); // Wild spawning within radius 20
                    swarmEntity.swarmOffsetX = Math.cos(angle) * r;
                    swarmEntity.swarmOffsetY = Math.sin(angle) * r;

                    swarmEntity.x += swarmEntity.swarmOffsetX;
                    swarmEntity.y += swarmEntity.swarmOffsetY;
                    state.enemies.push(swarmEntity);
                }
            } else {
                state.enemies.push(EnemyFactory.createEnemy(type as any, state.wave));
            }

            if (type === 'Boss' || type === 'Defragmenter') {
                const hpContainer = document.getElementById('bossHpContainer');
                if (hpContainer) hpContainer.classList.remove('hidden');
            }
            state.enemiesToSpawn--;
            // Smarter scaling: starts faster (80 frames), gets much denser (down to 8 frames)
            state.spawnCooldown = Math.max(8, Config.SPAWN_RATE - Math.floor(state.wave * 3.5));
        } else {
            state.spawnCooldown--;
        }
    } else if (state.enemies.length === 0) {
        state.isWaveActive = false;
        state.wave++;

        const waveBonus = Config.WAVE_BONUS_BASE + (state.wave * Config.WAVE_BONUS_PER_WAVE);

        // Interest earned on current gold
        const interest = Math.floor(state.gold * Config.INTEREST_RATE);

        state.gold += waveBonus + interest;
        state.totalGoldEarned += waveBonus + interest;
        state.totalGoldFromInterest += interest;

        // High-Tech DOM Alert Notification replaces ugly canvas texts
        showGameNotification(
            'wave',
            `🌊 WELLE ${state.wave - 1} ABGEWEHRT!`,
            `Sektor gesichert. Die nächste Welle formiert sich bereits.`,
            { bonus: waveBonus, interest: interest }
        );
        createCoinBurst((app.canvas.clientWidth || app.canvas.width) / 2, (app.canvas.clientHeight || app.canvas.height) / 2, 20);
        updateUI();
        Multiplayer.emitSyncGold(state.gold);

        if (state.autoStartActive && !state.gameOver) {
            setTimeout(() => startWave(), 1200);
        }
    }
}

/**
 * Spaces out a specific enemy type in the pool as evenly as possible to avoid clustering.
 */
function spaceOutEnemyType(pool: string[], typeToSpace: string): string[] {
    const targets = pool.filter(x => x === typeToSpace);
    if (targets.length <= 1) return pool;

    const rest = pool.filter(x => x !== typeToSpace);
    if (rest.length === 0) return pool;

    const result: string[] = [];
    const A = targets.length;
    const N = rest.length;
    const step = N / (A + 1);
    let targetIdx = 0;

    // Insert targets that should go at index 0 (before rest[0])
    while (targetIdx < A && Math.floor((targetIdx + 1) * step) === 0) {
        result.push(targets[targetIdx++]);
    }

    for (let i = 0; i < N; i++) {
        result.push(rest[i]);
        while (targetIdx < A && (i + 1) >= Math.floor((targetIdx + 1) * step)) {
            result.push(targets[targetIdx++]);
        }
    }

    while (targetIdx < A) {
        result.push(targets[targetIdx++]);
    }

    return result;
}

