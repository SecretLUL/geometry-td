/*
 * @file: frontend/src/js/core/multiplayer/host.ts
 * @purpose: Implements host-authoritative validation for tower placement, selling, and upgrading
 *           in co-op rooms.
 * @dependencies: state, config, towers, fx, types, context
 * @last_update: 2026-05-27 / v1.2.0 - Added max level validation check in processUpgradeTower to prevent gold loss when upgrading past max level.
 */
import { state } from "../state";
import { Config, TowerData, getTowerPurchaseCost } from "../config";
import {
  Tower,
  SniperTower,
  BombTower,
  TeslaTower,
  PrismaTower,
  BoosterTower,
  GeneratorTower,
} from "../../entities/towers/index";
import { createExplosion } from "../../fx/fx";
import { TowerSpecialization, TowerType } from "../../types";
import { Multiplayer, socket } from "./context";
import { isCellAllowedForPlayer } from "../utils";

function getPlayerIndex(playerId?: string): number {
  if (!state.playerSlots || !playerId) return 0;
  const idx = state.playerSlots.indexOf(playerId);
  return idx === -1 ? 0 : idx;
}

export function processPlaceTower(
  type: TowerType,
  col: number,
  row: number,
  playerId?: string
): boolean {
  const pIdx = getPlayerIndex(playerId);

  // Check if tower already exists at this position
  if (state.towers.find((t) => t.col === col && t.row === row)) {
    socket?.emit("reject_place_tower", { type, col, row });
    return false;
  }

  if (!type || !TowerData[type]) {
    socket?.emit("reject_place_tower", { type, col, row });
    return false;
  }
  const existingCount = state.towers
    ? state.towers.filter((t) => t.type === "Generator").length
    : 0;
  const cost = getTowerPurchaseCost(type, existingCount);

  if (!state.playerGolds) {
    state.playerGolds = [300, 300, 300, 300];
  }

  if (state.infiniteGold || state.playerGolds[pIdx] >= cost) {
    if (!state.infiniteGold) {
      state.playerGolds[pIdx] -= cost;
      if (pIdx === Multiplayer.myPlayerIndex) {
        state.gold = state.playerGolds[pIdx];
      }
    }
    Multiplayer.emitSyncGold(state.playerGolds);

    let TowerClass = Tower;
    if (type === "Sniper") TowerClass = SniperTower;
    else if (type === "Bomb") TowerClass = BombTower;
    else if (type === "Tesla") TowerClass = TeslaTower;
    else if (type === "Prisma") TowerClass = PrismaTower;
    else if (type === "Booster") TowerClass = BoosterTower;
    else if (type === "Generator") TowerClass = GeneratorTower;

    const newTower = new TowerClass(col, row);
    (newTower as any).ownerIndex = pIdx;
    state.towers.push(newTower);

    Tower.recalculateAllBoosts();

    const TS = Config.TILE_SIZE;
    createExplosion(col * TS + TS / 2, row * TS + TS / 2, "#ffffff", 5);

    Multiplayer.updateUI();
    socket?.emit("confirm_place_tower", { type, col, row, ownerIndex: pIdx });
    return true;
  }

  socket?.emit("reject_place_tower", { type, col, row });
  return false;
}

export function processUpgradeTower(
  col: number,
  row: number,
  specId: TowerSpecialization | null = null,
  silent: boolean = false,
  playerId?: string
): boolean {
  const pIdx = getPlayerIndex(playerId);
  const tower = state.towers.find((t) => t.col === col && t.row === row);
  if (tower) {
    if ((tower as any).ownerIndex !== undefined && (tower as any).ownerIndex !== pIdx) {
      return false;
    }
    if (tower.level >= Config.TOWER_MAX_LEVEL) {
      return false;
    }
    const cost = tower.upgradeCost;
    if (!state.playerGolds) {
      state.playerGolds = [300, 300, 300, 300];
    }
    if (state.infiniteGold || state.playerGolds[pIdx] >= cost) {
      if (!state.infiniteGold) {
        state.playerGolds[pIdx] -= cost;
        if (pIdx === Multiplayer.myPlayerIndex) {
          state.gold = state.playerGolds[pIdx];
        }
      }
      Multiplayer.emitSyncGold(state.playerGolds);

      const wasInfinite = state.infiniteGold;
      state.infiniteGold = true;
      if (specId) {
        tower.applySpecialization(specId, silent);
      } else {
        tower.upgrade(undefined, silent);
      }
      state.infiniteGold = wasInfinite;

      Multiplayer.updateUI();
      socket?.emit("confirm_upgrade_tower", { col, row, specId, level: tower.level });
      return true;
    }
  }
  return false;
}

export function processSellTower(col: number, row: number, playerId?: string): boolean {
  const pIdx = getPlayerIndex(playerId);
  const idx = state.towers.findIndex((t) => t.col === col && t.row === row);
  if (idx !== -1) {
    const tower = state.towers[idx];
    if ((tower as any).ownerIndex !== undefined && (tower as any).ownerIndex !== pIdx) {
      return false;
    }
    const activeCount = state.playerSlots
      ? state.playerSlots.filter((id) => id !== null).length
      : 1;
    const isMisplaced = !isCellAllowedForPlayer(
      tower.col,
      tower.row,
      tower.ownerIndex !== undefined ? tower.ownerIndex : 0,
      activeCount
    );
    const refundMult = state.relocationActive && isMisplaced ? 1.0 : 0.5;
    const refund = Math.floor(tower.totalSpent * refundMult);

    if (!state.playerGolds) {
      state.playerGolds = [300, 300, 300, 300];
    }
    state.playerGolds[pIdx] += refund;
    if (pIdx === Multiplayer.myPlayerIndex) {
      state.gold = state.playerGolds[pIdx];
    }
    Multiplayer.emitSyncGold(state.playerGolds);

    tower.destroy();
    state.towers.splice(idx, 1);
    Tower.recalculateAllBoosts();

    createExplosion(tower.x, tower.y, "#e94560", 10);

    recalculateRelocationState();

    Multiplayer.updateUI();

    socket?.emit("confirm_sell_tower", { col, row });
    return true;
  }
  return false;
}

export function recalculateRelocationState(): void {
  const activeCount = state.playerSlots ? state.playerSlots.filter((id) => id !== null).length : 1;
  const relocStates = [false, false, false, false];
  let anyReloc = false;

  for (const t of state.towers) {
    if (t.ownerIndex !== undefined) {
      if (!isCellAllowedForPlayer(t.col, t.row, t.ownerIndex, activeCount)) {
        relocStates[t.ownerIndex] = true;
        anyReloc = true;
      }
    }
  }

  const wasRelocationActive = state.relocationActive;
  state.relocationActive = anyReloc;
  state.playerRelocationStates = relocStates;

  if (anyReloc) {
    state.isPaused = true;
  }

  if (state.isHost) {
    if (anyReloc) {
      if (!wasRelocationActive) {
        Multiplayer.emitTogglePause?.(true);
      }
    } else if (wasRelocationActive) {
      state.isPaused = false;
      Multiplayer.emitTogglePause?.(false);
    }
  }
}

export function processRelocateTower(
  fromCol: number,
  fromRow: number,
  toCol: number,
  toRow: number,
  playerId?: string
): boolean {
  if (!state.isHost) return false;

  const pIdx = state.playerSlots ? state.playerSlots.indexOf(playerId || "") : -1;
  if (pIdx === -1) return false;

  const activeCount = state.playerSlots ? state.playerSlots.filter((id) => id !== null).length : 1;

  const tower = state.towers.find((t) => t.col === fromCol && t.row === fromRow);
  if (!tower) return false;

  if (tower.ownerIndex !== pIdx) return false;

  if (!isCellAllowedForPlayer(toCol, toRow, pIdx, activeCount)) return false;

  if (state.towers.find((t) => t.col === toCol && t.row === toRow)) return false;

  tower.col = toCol;
  tower.row = toRow;
  tower.x = toCol * Config.TILE_SIZE + Config.TILE_SIZE / 2;
  tower.y = toRow * Config.TILE_SIZE + Config.TILE_SIZE / 2;

  if (tower.pixiSprite) {
    tower.pixiSprite.position.set(tower.x, tower.y);
  }

  tower.redrawPixiBase();
  tower.redrawPixiTurret();

  Tower.recalculateAllBoosts();

  const TS = Config.TILE_SIZE;
  createExplosion(toCol * TS + TS / 2, toRow * TS + TS / 2, "#00ff88", 5);

  recalculateRelocationState();

  Multiplayer.syncNow();
  Multiplayer.updateUI();

  return true;
}
