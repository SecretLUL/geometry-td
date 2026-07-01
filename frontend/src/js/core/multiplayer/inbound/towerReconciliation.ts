import { state } from "../../state";
import { Config } from "../../config";
import {
  Tower,
  SniperTower,
  BombTower,
  TeslaTower,
  PrismaTower,
  BoosterTower,
  GeneratorTower,
} from "../../../entities/towers/index";
import { SyncTowerState, TowerSpecialization } from "../../../types";
import { createExplosion } from "../../../fx/fx";
import { PoolManager } from "../../pool";
import { getPlayerColorString } from "../../../entities/towers/base-tower";
import { showGameNotification } from "../../../ui/ui";

export function getTowerClass(type: string): typeof Tower {
  switch (type) {
    case "Sniper":
      return SniperTower;
    case "Bomb":
      return BombTower;
    case "Tesla":
      return TeslaTower;
    case "Prisma":
      return PrismaTower;
    case "Booster":
      return BoosterTower;
    case "Generator":
      return GeneratorTower;
    default:
      return Tower;
  }
}

export function syncTowersFromList(towersList: SyncTowerState[]): void {
  towersList.forEach((tData: SyncTowerState) => {
    let tower = state.towers.find((t) => t.col === tData.col && t.row === tData.row);
    if (!tower) {
      const TowerClass = getTowerClass(tData.type);
      tower = new TowerClass(tData.col, tData.row);
      tower.constructionTimer = 0;
      tower.initPixi();
      state.towers.push(tower);
    }

    if (tower) {
      tower.damageDealt = tData.damageDealt || 0;
      tower.totalSpent = tData.totalSpent !== undefined ? tData.totalSpent : tower.totalSpent;
      if (tData.ownerIndex !== undefined) {
        const oldOwner = tower.ownerIndex;
        tower.ownerIndex = tData.ownerIndex;
        if (oldOwner !== tData.ownerIndex) {
          tower.drawOwnerGlow?.();
        }
      }

      // Sync level and specialization authoritatively from host
      const targetLevel = tData.level || 1;
      const limit =
        tData.specId && tower.specialization !== tData.specId ? targetLevel - 1 : targetLevel;
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

  // Clean up any local towers that are not present in the host's authoritative list
  const syncedPositions = new Set(towersList.map((t) => `${t.col},${t.row}`));
  for (let i = state.towers.length - 1; i >= 0; i--) {
    const localTower = state.towers[i];
    const posKey = `${localTower.col},${localTower.row}`;
    if (!syncedPositions.has(posKey)) {
      localTower.destroy();
      state.towers.splice(i, 1);
    }
  }

  Tower.recalculateAllBoosts();
}

export function recreateTowersFromList(towersList: SyncTowerState[]): void {
  if (state.towers) {
    state.towers.forEach((t) => {
      t.destroy();
    });
  }
  state.towers = [];
  const wasInfinite = state.infiniteGold;
  state.infiniteGold = true;

  towersList.forEach((tData: SyncTowerState) => {
    const TowerClass = getTowerClass(tData.type);
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
    if (tData.ownerIndex !== undefined) {
      newTower.ownerIndex = tData.ownerIndex;
      newTower.drawOwnerGlow?.();
    }
    newTower.constructionTimer = 0;
    newTower.initPixi();

    state.towers.push(newTower);
  });

  Tower.recalculateAllBoosts();
  state.infiniteGold = wasInfinite;
}

export function handleConfirmPlaceTower(data: {
  type: string;
  col: number;
  row: number;
  ownerIndex?: number;
}): void {
  const { type, col, row, ownerIndex } = data;
  const TS = Config.TILE_SIZE;
  const existing = state.towers.find((t) => t.col === col && t.row === row);

  if (existing) {
    if (existing.isPredicted) {
      existing.isPredicted = false;
      delete existing.predictionTime;
      delete existing.predictedCost;
      if (ownerIndex !== undefined) {
        (existing as any).ownerIndex = ownerIndex;
      }
      createExplosion(col * TS + TS / 2, row * TS + TS / 2, "#ffffff", 5);
    }
    return;
  }

  const TowerClass = getTowerClass(type);
  const newTower = new TowerClass(col, row);
  if (ownerIndex !== undefined) {
    (newTower as any).ownerIndex = ownerIndex;
  }
  state.towers.push(newTower);
  Tower.recalculateAllBoosts();

  createExplosion(col * TS + TS / 2, row * TS + TS / 2, "#ffffff", 5);
}

export function handleRejectPlaceTower(data: { col: number; row: number }): void {
  const { col, row } = data;
  const idx = state.towers.findIndex((t) => t.col === col && t.row === row);
  if (idx !== -1) {
    const tower = state.towers[idx];
    if (tower.isPredicted) {
      // Rollback gold
      if (!state.infiniteGold && tower.predictedCost !== undefined) {
        state.gold += tower.predictedCost;
      }

      // Remove from towers
      tower.destroy();
      state.towers.splice(idx, 1);

      // Spawn red failure explosion and floating text
      const TS = Config.TILE_SIZE;
      const centerX = col * TS + TS / 2;
      const centerY = row * TS + TS / 2;
      createExplosion(centerX, centerY, "#ff3366", 8);
      PoolManager.getFloatingText(centerX, centerY, "Failed!", "#ff3366");
    }
  }
}

export function handleConfirmUpgradeTower(data: {
  col: number;
  row: number;
  specId?: TowerSpecialization | null;
  level?: number;
}): void {
  const { col, row, specId, level } = data;
  const tower = state.towers.find((t) => t.col === col && t.row === row);
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
  }
}

export function handleConfirmSellTower(data: { col: number; row: number }): void {
  const { col, row } = data;
  const idx = state.towers.findIndex((t) => t.col === col && t.row === row);
  if (idx !== -1) {
    const tower = state.towers[idx];
    tower.destroy();
    state.towers.splice(idx, 1);
    Tower.recalculateAllBoosts();
    createExplosion(tower.x, tower.y, "#e94560", 10);
  }
}

export function handlePlayerDisconnectReassignment(
  oldSlots: Array<string | null>,
  newSlots: Array<string | null>
): void {
  for (let i = 0; i < 4; i++) {
    if (oldSlots[i] !== null && newSlots[i] === null) {
      // Player i has left!
      // Find the recipient for Player i's towers (closest preceding active slot)
      let recipientIdx = -1;
      for (let k = 1; k <= 3; k++) {
        const targetIdx = (i - k + 4) % 4;
        if (newSlots[targetIdx] !== null) {
          recipientIdx = targetIdx;
          break;
        }
      }

      if (recipientIdx !== -1) {
        const newOwnerColor = getPlayerColorString(recipientIdx);

        // Reassign towers owned by player i to recipientIdx
        let reassignedCount = 0;
        for (const t of state.towers) {
          if (t.ownerIndex === i) {
            t.ownerIndex = recipientIdx;
            reassignedCount++;

            // Visual effect: neon burst at tower position
            createExplosion(t.x, t.y, newOwnerColor, 6);

            // Floating text over the tower
            const msg = `Spieler ${recipientIdx + 1} übernimmt!`;
            PoolManager.getFloatingText(t.x, t.y, msg, newOwnerColor);
          }
        }
        if (reassignedCount > 0) {
          console.log(
            `[NETWORK] Player ${i + 1} disconnected. Reassigned ${reassignedCount} towers to Player ${recipientIdx + 1}.`
          );
          showGameNotification(
            "info",
            "⚠️ SPIELER VERLASSEN",
            `Spieler ${i + 1} hat das Spiel verlassen! Seine ${reassignedCount} Türme wurden an Spieler ${recipientIdx + 1} übertragen.`
          );
        }
      }
    }
  }
}
