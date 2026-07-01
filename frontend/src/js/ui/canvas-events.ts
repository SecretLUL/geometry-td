/*
 * @file: frontend/src/js/ui/canvas-events.ts
 * @purpose: Event listeners for Canvas hover, click (tower upgrade/placement), relocation, and context menus.
 * @dependencies: state, config, multiplayer, pool, map, modals, tooltips, ui, utils, tower-builder
 */
import { state } from "../core/state";
import { Config } from "../core/config";
import { Multiplayer } from "../core/multiplayer/context";
import { PoolManager } from "../core/pool";
import { map, getCOLS, getROWS } from "../core/map";
import { showUpgradeModal, showContextShop, hideContextShop } from "./modals";
import { updateTooltip } from "./tooltips";
import { updateUI, cancelPlacement } from "./ui";
import { isCellAllowedForPlayer } from "../core/utils";
import { buildTowerAt } from "./tower-builder";

export function setupCanvasEvents(canvas: HTMLCanvasElement): void {
  // ── Canvas: mouse-move for ghost + tooltip ────────────────────────────────
  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    // Use clientWidth/clientHeight (CSS layout px) so coordinates map to CSS px space,
    // compatible with High-DPI canvas where canvas.width > clientWidth
    const scaleX = (canvas.clientWidth || canvas.width) / rect.width;
    const scaleY = (canvas.clientHeight || canvas.height) / rect.height;
    const camX = state.camera ? state.camera.x : 0;
    const camY = state.camera ? state.camera.y : 0;
    const mouseX = (e.clientX - rect.left) * scaleX - camX;
    const mouseY = (e.clientY - rect.top) * scaleY - camY;

    state.ghostMouse.x = mouseX;
    state.ghostMouse.y = mouseY;
    state.lastClientMouse.x = e.clientX;
    state.lastClientMouse.y = e.clientY;

    updateTooltip();
  });

  canvas.addEventListener("mouseleave", () => {
    state.ghostMouse.x = -999;
    state.ghostMouse.y = -999;
    state.hoveredTower = null;
    document.getElementById("tooltip")?.classList.add("hidden");
  });

  // ── Canvas: click ─────────────────────────────────────────────────────────
  canvas.addEventListener("click", (e) => {
    if (state.gameOver || state.benchmarkActive) return;

    const rect = canvas.getBoundingClientRect();
    // Use clientWidth/clientHeight (CSS layout px) so coordinates map to CSS px space,
    // compatible with High-DPI canvas where canvas.width > clientWidth
    const scaleX = (canvas.clientWidth || canvas.width) / rect.width;
    const scaleY = (canvas.clientHeight || canvas.height) / rect.height;
    const camX = state.camera ? state.camera.x : 0;
    const camY = state.camera ? state.camera.y : 0;
    const mouseX = (e.clientX - rect.left) * scaleX - camX;
    const mouseY = (e.clientY - rect.top) * scaleY - camY;

    const TS = Config.TILE_SIZE;
    const col = Math.floor(mouseX / TS);
    const row = Math.floor(mouseY / TS);

    if (col < 0 || col >= getCOLS() || row < 0 || row >= getROWS()) return;

    const activeCount = state.playerSlots
      ? state.playerSlots.filter((id) => id !== null).length
      : 1;
    const myIndex = Multiplayer.myPlayerIndex || 0;

    // Relocation click handler
    if (state.relocationActive) {
      const hasMisplaced = state.towers.some(
        (t) =>
          t.ownerIndex === myIndex && !isCellAllowedForPlayer(t.col, t.row, myIndex, activeCount)
      );
      if (!hasMisplaced) return; // Not our turn to relocate

      const existingTower = state.towers.find((t) => t.col === col && t.row === row);

      if (existingTower) {
        if (
          existingTower.ownerIndex === myIndex &&
          !isCellAllowedForPlayer(existingTower.col, existingTower.row, myIndex, activeCount)
        ) {
          state.relocatingTower = { col, row };
          PoolManager.getFloatingText(mouseX, mouseY, "Verschiebe Turm...", "#ffaa00");
          updateUI();
        }
      } else if (state.relocatingTower) {
        if (isCellAllowedForPlayer(col, row, myIndex, activeCount)) {
          Multiplayer.emitRequestRelocateTower(
            state.relocatingTower.col,
            state.relocatingTower.row,
            col,
            row
          );
          state.relocatingTower = null;
        } else {
          PoolManager.getFloatingText(mouseX, mouseY, "Nicht dein Bereich!", "#ff3366");
        }
      }
      return;
    }

    if (state.isPaused) return;

    const existingTower = state.towers.find((t) => t.col === col && t.row === row);

    if (existingTower && !state.selectedTowerType) {
      if (existingTower.isPredicted) {
        PoolManager.getFloatingText(mouseX, mouseY, "Wird gebaut...", "#ffaa00");
        return;
      }
      // Check if specialization upgrade branch choice (Choice of specialization)
      if (existingTower.level === Config.TOWER_SPECIALIZATION_LEVEL - 1) {
        if (state.infiniteGold || state.gold >= existingTower.upgradeCost) {
          showUpgradeModal(existingTower);
        } else {
          PoolManager.getFloatingText(
            mouseX,
            mouseY,
            `Braucht ${existingTower.upgradeCost}g`,
            "#ff3366"
          );
        }
      } else {
        // Normal upgrade
        if (existingTower.level >= Config.TOWER_MAX_LEVEL) {
          PoolManager.getFloatingText(mouseX, mouseY, "Max Level!", "#ff3366");
        } else if (state.infiniteGold || state.gold >= existingTower.upgradeCost) {
          if (!state.isHost) {
            const cost = existingTower.upgradeCost;
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
            existingTower.upgrade();
            updateUI();
          }
          Multiplayer.emitRequestUpgradeTower(existingTower.col, existingTower.row);
        } else {
          PoolManager.getFloatingText(
            mouseX,
            mouseY,
            `Braucht ${existingTower.upgradeCost}g`,
            "#ff3366"
          );
        }
      }
    } else if (state.selectedTowerType && map && map[row][col] === 0 && !existingTower) {
      buildTowerAt(state.selectedTowerType, col, row);
    } else if (!existingTower && !state.selectedTowerType && map && map[row][col] === 0) {
      // Mobile Contextual Menu
      if (window.innerWidth <= 950) {
        e.stopPropagation(); // Stop bubbling to prevent immediate closure by global dismiss listener
        showContextShop(e.clientX, e.clientY, col, row);
      }
    } else {
      // Clicked elsewhere, hide context shop
      hideContextShop();
    }
  });

  // ── Canvas: right-click sell / cancel ─────────────────────────────────────
  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (state.gameOver || (state.isPaused && !state.relocationActive) || state.benchmarkActive)
      return;

    // Dismiss mobile context shop if open
    const contextShop = document.getElementById("context-shop");
    if (contextShop && !contextShop.classList.contains("hidden")) {
      hideContextShop();
      e.stopPropagation();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    // Use clientWidth/clientHeight (CSS layout px) so coordinates map to CSS px space,
    // compatible with High-DPI canvas where canvas.width > clientWidth
    const scaleX = (canvas.clientWidth || canvas.width) / rect.width;
    const scaleY = (canvas.clientHeight || canvas.height) / rect.height;
    const camX = state.camera ? state.camera.x : 0;
    const camY = state.camera ? state.camera.y : 0;
    const mouseX = (e.clientX - rect.left) * scaleX - camX;
    const mouseY = (e.clientY - rect.top) * scaleY - camY;

    const TS = Config.TILE_SIZE;
    const col = Math.floor(mouseX / TS);
    const row = Math.floor(mouseY / TS);
    const idx = state.towers.findIndex((t) => t.col === col && t.row === row);

    if (state.selectedTowerType) {
      // In build/placement mode, right-clicking anywhere immediately cancels placement mode (no selling allowed!)
      cancelPlacement();
    } else if (idx !== -1) {
      const tower = state.towers[idx];
      if (tower.isPredicted) {
        PoolManager.getFloatingText(mouseX, mouseY, "Wird gebaut...", "#ffaa00");
        return;
      }
      // Multiplayer: Request sell
      Multiplayer.emitRequestSellTower(tower.col, tower.row);
    }
  });

  // ── Global Context Shop Dismissal ──────────────────────────────────────────
  // Dismiss the context menu when clicking or right-clicking anywhere outside it
  const dismissContextShop = (e: Event) => {
    const contextShop = document.getElementById("context-shop");
    if (contextShop && !contextShop.classList.contains("hidden")) {
      if (!contextShop.contains(e.target as Node)) {
        hideContextShop();
      }
    }
  };
  document.addEventListener("click", dismissContextShop);
  document.addEventListener("contextmenu", dismissContextShop);
}
