/*
 * @file: frontend/src/js/core/multiplayer/host.ts
 * @purpose: Implements host-authoritative validation for tower placement, selling, and upgrading
 *           in co-op rooms.
 * @dependencies: state, config, towers, fx, types, context
 * @last_update: 2026-05-27 / v1.2.0 - Added max level validation check in processUpgradeTower to prevent gold loss when upgrading past max level.
 */
import { state } from '../state';
import { Config, TowerData } from '../config';
import { Tower, SniperTower, BombTower, TeslaTower, PrismaTower, BoosterTower, GeneratorTower } from '../../entities/towers/index';
import { createExplosion } from '../../fx/fx';
import { TowerSpecialization } from '../../types';
import { Multiplayer, socket } from './context';

export function processPlaceTower(type: any, col: number, row: number): boolean {
    // Check if tower already exists at this position
    if (state.towers.find(t => t.col === col && t.row === row)) {
        socket?.emit('reject_place_tower', { type, col, row });
        return false;
    }

    if (!type || !TowerData[type]) {
        socket?.emit('reject_place_tower', { type, col, row });
        return false;
    }
    const cost = TowerData[type].baseCost;

    if (state.infiniteGold || state.gold >= cost) {
        if (!state.infiniteGold) state.gold -= cost;
        Multiplayer.emitSyncGold(state.gold);

        let TowerClass = Tower;
        if (type === 'Sniper') TowerClass = SniperTower;
        else if (type === 'Bomb') TowerClass = BombTower;
        else if (type === 'Tesla') TowerClass = TeslaTower;
        else if (type === 'Prisma') TowerClass = PrismaTower;
        else if (type === 'Booster') TowerClass = BoosterTower;
        else if (type === 'Generator') TowerClass = GeneratorTower;

        const newTower = new TowerClass(col, row);
        state.towers.push(newTower);

        const TS = Config.TILE_SIZE;
        createExplosion(col * TS + TS / 2, row * TS + TS / 2, '#ffffff', 5);

        Multiplayer.updateUI();
        socket?.emit('confirm_place_tower', { type, col, row });
        return true;
    }

    socket?.emit('reject_place_tower', { type, col, row });
    return false;
}

export function processUpgradeTower(col: number, row: number, specId: TowerSpecialization | null = null, silent: boolean = false): boolean {
    const tower = state.towers.find(t => t.col === col && t.row === row);
    if (tower) {
        if (tower.level >= Config.TOWER_MAX_LEVEL) {
            return false;
        }
        const cost = tower.upgradeCost;
        if (state.infiniteGold || state.gold >= cost) {
            if (!state.infiniteGold) state.gold -= cost;
            Multiplayer.emitSyncGold(state.gold);

            const wasInfinite = state.infiniteGold;
            state.infiniteGold = true;
            if (specId) {
                tower.applySpecialization(specId, silent);
            } else {
                tower.upgrade(undefined, silent);
            }
            state.infiniteGold = wasInfinite;

            Multiplayer.updateUI();
            socket?.emit('confirm_upgrade_tower', { col, row, specId, level: tower.level });
            return true;
        }
    }
    return false;
}

export function processSellTower(col: number, row: number): boolean {
    const idx = state.towers.findIndex(t => t.col === col && t.row === row);
    if (idx !== -1) {
        const tower = state.towers[idx];
        const refund = Math.floor(tower.totalSpent * 0.5);
        state.gold += refund;
        Multiplayer.emitSyncGold(state.gold);

        if (tower.pixiSprite) {
            tower.pixiSprite.destroy();
        }
        state.towers.splice(idx, 1);
        createExplosion(tower.x, tower.y, '#e94560', 10);
        Multiplayer.updateUI();

        socket?.emit('confirm_sell_tower', { col, row });
        return true;
    }
    return false;
}
