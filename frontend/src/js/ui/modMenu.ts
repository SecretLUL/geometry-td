/*
 * @file: frontend/src/js/ui/modMenu.ts
 * @purpose: Cheat, admin, and test sidebar overlay allowing developers to activate God Mode, Infinite Gold, and map custom waves.
 * @dependencies: state, config, multiplayer, pool, towers, map, ui
 * @last_update: 2026-06-01 / v2.5.3 - Removed unused cancelPlacement import from ui.ts to satisfy strict TypeScript unused checks.
 */
import { state } from "../core/state";
import { Multiplayer } from "../core/multiplayer/context";
import { PoolManager } from "../core/pool";
import { EnemyFactory } from "../entities/enemies";

import { updateUI, showGameNotification } from "./ui";

export function makeDraggable(element: HTMLElement, handle: HTMLElement): void {
  let pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;
  handle.onmousedown = dragMouseDown;

  function dragMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    // Check if we didn't click a button in the header
    if (target.tagName === "BUTTON") return;

    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = element.offsetTop - pos2 + "px";
    element.style.left = element.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

export function setupModMenu() {
  const modMenu = document.getElementById("modMenu");

  const modMenuHeader = document.getElementById("modMenuHeader");

  if (modMenu && modMenuHeader) {
    makeDraggable(modMenu, modMenuHeader);
  }

  document.getElementById("modGoldBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    state.infiniteGold = !state.infiniteGold;
    updateUI();
    PoolManager.getFloatingText(
      state.ghostMouse.x,
      state.ghostMouse.y,
      state.infiniteGold ? "Infinite Gold AN" : "Infinite Gold AUS",
      "#fca311"
    );
    Multiplayer.emitToggleMod("infiniteGold", state.infiniteGold);
    Multiplayer.syncNow();
  });
  document.getElementById("modLifeBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    state.godMode = !state.godMode;
    updateUI();
    PoolManager.getFloatingText(
      state.ghostMouse.x,
      state.ghostMouse.y,
      state.godMode ? "God Mode AN" : "God Mode AUS",
      "#ff3366"
    );
    Multiplayer.emitToggleMod("godMode", state.godMode);
    Multiplayer.syncNow();
  });
  document.getElementById("modWinBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    // Release all active enemy sprites back to the pool before clearing,
    // so their PixiJS sprites are hidden immediately and don't freeze on screen.
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      EnemyFactory.releaseEnemyToPool(state.enemies[i]);
    }
    state.enemies = [];
    state.enemiesToSpawn = 0;
    state.enemyPool = [];
    updateUI();
    PoolManager.getFloatingText(
      state.ghostMouse.x,
      state.ghostMouse.y,
      "Welle beendet!",
      "#00ff00"
    );
    showGameNotification(
      "info",
      "🌊 WELLE BEENDET",
      "Der Host hat die aktuelle Welle sofort beendet."
    );
    Multiplayer.emitHostEndedWave();
    Multiplayer.syncNow();
  });
  document.getElementById("modLoseBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    state.lives = 0;
    updateUI();
    Multiplayer.syncNow();
  });
  document.getElementById("modTakeDamageBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    if (state.lives > 0) {
      if (!state.godMode) {
        state.lives = Math.max(0, state.lives - 1);
      }
      state.screenDamageEffect = 30; // Start pulse
      Multiplayer.updateUI();
      Multiplayer.syncNow();

      if (state.lives <= 0 && !state.gameOver) {
        state.gameOver = true;
        Multiplayer.syncNow();
      }
    }
  });
  document.getElementById("modAddLifeBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    state.lives++;
    Multiplayer.updateUI();
    Multiplayer.syncNow();
  });
  document.getElementById("modSetWaveBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    const input = document.getElementById("modWaveInput") as HTMLInputElement | null;
    if (input) {
      const val = parseInt(input.value);
      if (val >= 1) {
        if (state.originalWave === null) {
          state.originalWave = state.wave;
        }
        state.wave = val;
        state.waveModified = true;
        updateUI();
        PoolManager.getFloatingText(
          state.ghostMouse.x,
          state.ghostMouse.y,
          `Welle auf ${val} gesetzt!`,
          "#4cc9f0"
        );
        Multiplayer.emitToggleMod("waveModified", true);
        Multiplayer.syncNow();
      }
    }
  });
  document.getElementById("modUndoWaveBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    if (state.originalWave === null) return;

    const original = state.originalWave;
    state.wave = original;
    state.originalWave = null;
    state.waveModified = false;

    updateUI();
    PoolManager.getFloatingText(
      state.ghostMouse.x,
      state.ghostMouse.y,
      `Welle auf ursprüngliche ${original} zurückgesetzt!`,
      "#ff9f1c"
    );
    Multiplayer.emitToggleMod("waveModified", false);
    Multiplayer.syncNow();
  });

  document.getElementById("modCloseBtn")?.addEventListener("click", () => {
    modMenu?.classList.add("hidden");
  });
  document.getElementById("modCloseBtnSmall")?.addEventListener("click", () => {
    modMenu?.classList.add("hidden");
  });
}
