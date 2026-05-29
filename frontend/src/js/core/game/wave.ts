/*
 * @file: frontend\src\js\core\game\wave.ts
 * @purpose: Coordinates wave progression, enemy pool generation, wave execution hooks, multiplayer synchronization emit requests, and wave rewards calculation.
 * @dependencies: state, config, enemies, fx, ui, multiplayer, logger, viewport
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Änderung der Funktionalität MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
 * @last_update: 2026-05-29 / v1.3.1 - Implemented Collector spawn frequency constraints and multiplayer tracking.
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

    const bossInterval = 10;
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

        // Guarantee newly unlocked enemies spawn first (and are guaranteed to be in the pool)
        let newlyUnlocked = availableEnemies.filter(type => EnemyData[type].unlockWave === wave);
        for (let newType of newlyUnlocked) {
            const index = pool.indexOf(newType);
            if (index !== -1) {
                pool.splice(index, 1);
            } else {
                // Wenn er durch Zufall/niedriges Gewicht gar nicht im Pool gelandet ist, erzwingen wir es:
                const normalIdx = pool.indexOf('Normal');
                if (normalIdx !== -1) {
                    pool.splice(normalIdx, 1); // Ein Normalen entfernen, um Platz zu machen
                }
            }
            // An das Ende anhängen, da beim Spawnen mit pop() vom Ende genommen wird
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

    // Multiplayer: Host generiert den Pool und schickt ihn an alle
    if (state.isHost) {
        const pool = generateEnemyPool(state.wave);
        Multiplayer.emitRequestWaveStart({ wave: state.wave, pool: pool });
    } else {
        Multiplayer.emitRequestWaveStart({ wave: state.wave });
    }
}

// Diese Funktion wird vom Multiplayer-System oder lokal aufgerufen
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

        // Interest (Zinsen)
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
