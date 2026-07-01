/*
 * @file: frontend/src/js/ui/tower-builder.ts
 * @purpose: Logic for building/placing towers with client-side prediction and gold checks.
 * @dependencies: state, config, multiplayer, pool, utils, ui, modals, towers
 */
import { state } from "../core/state";
import {
  Tower,
  SniperTower,
  BombTower,
  TeslaTower,
  PrismaTower,
  BoosterTower,
  GeneratorTower,
} from "../entities/towers/index";
import { Config, TowerData, getTowerPurchaseCost } from "../core/config";
import { Multiplayer } from "../core/multiplayer/context";
import { PoolManager } from "../core/pool";
import { hideContextShop } from "./modals";
import { updateUI } from "./ui";
import { isCellAllowedForPlayer } from "../core/utils";

export function buildTowerAt(type: string, col: number, row: number): boolean {
  const TS = Config.TILE_SIZE;
  if (!type || !TowerData[type]) return false;

  const activeCount = state.playerSlots ? state.playerSlots.filter((id) => id !== null).length : 1;
  const myIndex = Multiplayer.myPlayerIndex || 0;
  if (!isCellAllowedForPlayer(col, row, myIndex, activeCount)) {
    const mouseX = col * TS + TS / 2;
    const mouseY = row * TS + TS / 2;
    PoolManager.getFloatingText(mouseX, mouseY, "Nicht dein Bereich!", "#ff3366");
    return false;
  }

  const existingCount = state.towers
    ? state.towers.filter((t) => t.type === "Generator" && !t.isPredicted).length
    : 0;
  const cost = getTowerPurchaseCost(type, existingCount);

  if (state.infiniteGold || state.gold >= cost) {
    // Optimistic client-side prediction if not host
    if (!state.isHost) {
      let TowerClass = Tower;
      if (type === "Sniper") TowerClass = SniperTower;
      else if (type === "Bomb") TowerClass = BombTower;
      else if (type === "Tesla") TowerClass = TeslaTower;
      else if (type === "Prisma") TowerClass = PrismaTower;
      else if (type === "Booster") TowerClass = BoosterTower;
      else if (type === "Generator") TowerClass = GeneratorTower;

      const predTower = new TowerClass(col, row);
      predTower.isPredicted = true;
      predTower.predictionTime = Date.now();
      predTower.predictedCost = cost;

      state.towers.push(predTower);
      Tower.recalculateAllBoosts();

      if (!state.infiniteGold) {
        state.gold -= cost;
        if (
          state.playerGolds &&
          Multiplayer.myPlayerIndex !== undefined &&
          state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
        ) {
          state.playerGolds[Multiplayer.myPlayerIndex] = state.gold;
        }
      }
      updateUI();
    }

    // Multiplayer: Request placement
    Multiplayer.emitRequestPlaceTower(type as any, col, row);

    // Mobile UX: Close panel after placement
    if (window.innerWidth <= 950) {
      document.getElementById("ui-panel")?.classList.remove("mobile-open");
      document.getElementById("mobile-ui-toggle")?.classList.remove("active");
      hideContextShop();
    }
    return true;
  } else {
    const mouseX = col * TS + TS / 2;
    const mouseY = row * TS + TS / 2;
    PoolManager.getFloatingText(mouseX, mouseY, "Nicht genug Gold!", "#ff3366");
    return false;
  }
}
