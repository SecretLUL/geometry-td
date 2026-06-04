/*
 * @file: frontend\src\js\entities\enemies\factory.ts
 * @purpose: Factory for creating enemies based on EnemyType and managing discovered enemies in local storage.
 * @dependencies: types, basic, special, bosses, event
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
 * @last_update: 2026-06-01 / v1.3.0 - Registered AcceleratorEnemy.
 */
import { Enemy, EnemyType } from '../../types';
import { NormalEnemy, ScoutEnemy, BruiserEnemy } from './types/basic';
import { RegrowerEnemy, ShieldedEnemy, SwarmEnemy, AcceleratorEnemy } from './types/special';
import { BossEnemy, DefragmenterEnemy, DefragmenterFragmentEnemy, DefragmenterSubfragmentEnemy } from './types/bosses';
import { CollectorEnemy, FortressEnemy, SplinterEnemy, SplinterFragmentEnemy } from './types/event';
import { inactivePoolContainer } from '../../core/game/viewport';

export class EnemyFactory {
    private static nextEnemyId = 1;
    private static clientEnemyPool = new Map<string, Enemy[]>();

    public static getPooledEnemy(type: EnemyType, waveNumber: number): Enemy {
        let pool = this.clientEnemyPool.get(type);
        if (!pool) {
            pool = [];
            this.clientEnemyPool.set(type, pool);
        }

        if (pool.length > 0) {
            const enemy = pool.pop()!;
            // Reset necessary state properties for client-side interpolation reuse
            enemy.deadMarked = false;
            enemy.waveNumber = waveNumber;
            enemy.flashTime = 0;
            enemy.pulseTime = 0;
            enemy.rotation = 0;
            enemy.spawnFrames = 0;
            enemy.stunTimer = 0;
            enemy.stunCooldown = 0;
            enemy.lastDamageParticleTime = 0;
            if (enemy.damageSources) {
                enemy.damageSources.clear();
            }
            // Re-enable the PixiJS sprite (was hidden by releaseEnemyToPool).
            // initPixi() is idempotent: it only creates the sprite if missing,
            // then unconditionally sets visible = true.
            (enemy as any).initPixi?.();
            return enemy;
        }

        return this.createEnemy(type, waveNumber);
    }

    public static releaseEnemyToPool(enemy: Enemy): void {
        if (!enemy || !enemy.typeName) return;

        // WICHTIG: Pixi-Sprite in den inaktiven Container verschieben, damit der Gegner sofort verschwindet,
        // auch wenn er die Base erreicht hat oder gecancelt wurde, und Iterationskosten vermieden werden.
        if ((enemy as any).pixiSprite) {
            inactivePoolContainer.addChild((enemy as any).pixiSprite);
        }

        let pool = this.clientEnemyPool.get(enemy.typeName);
        if (!pool) {
            pool = [];
            this.clientEnemyPool.set(enemy.typeName, pool);
        }
        // Avoid adding duplicates
        if (!pool.includes(enemy)) {
            pool.push(enemy);
        }
    }

    public static createEnemy(type: EnemyType, waveNumber: number, isPreview = false): Enemy {
        // Unlock in Lexicon
        if (!isPreview) {
            try {
                const discovered = JSON.parse(localStorage.getItem('td_discovered_enemies') || '{}');
                if (!discovered[type]) {
                    discovered[type] = true;
                    localStorage.setItem('td_discovered_enemies', JSON.stringify(discovered));
                }
            } catch (e) { }
        }

        let enemy: Enemy;
        switch (type) {
            case 'Scout': enemy = new ScoutEnemy(waveNumber); break;
            case 'Bruiser': enemy = new BruiserEnemy(waveNumber); break;
            case 'Regrower': enemy = new RegrowerEnemy(waveNumber); break;
            case 'Shielded': enemy = new ShieldedEnemy(waveNumber); break;
            case 'Boss': enemy = new BossEnemy(waveNumber); break;
            case 'Defragmenter': enemy = new DefragmenterEnemy(waveNumber); break;
            case 'DefragmenterFragment': enemy = new DefragmenterFragmentEnemy(waveNumber); break;
            case 'DefragmenterSubfragment': enemy = new DefragmenterSubfragmentEnemy(waveNumber); break;
            case 'Collector': enemy = new CollectorEnemy(waveNumber); break;
            case 'Fortress': enemy = new FortressEnemy(waveNumber); break;
            case 'Splinter': enemy = new SplinterEnemy(waveNumber); break;
            case 'SplinterFragment': enemy = new SplinterFragmentEnemy(waveNumber); break;
            case 'Swarm': enemy = new SwarmEnemy(waveNumber); break;
            case 'Accelerator': enemy = new AcceleratorEnemy(waveNumber); break;
            case 'Normal':
            default: enemy = new NormalEnemy(waveNumber); break;
        }

        enemy.id = EnemyFactory.nextEnemyId++;
        return enemy;
    }
}
