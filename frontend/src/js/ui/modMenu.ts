/*
 * @file: frontend/src/js/ui/modMenu.ts
 * @purpose: Cheat, admin, and test sidebar overlay allowing developers to activate God Mode, Infinite Gold, and map custom waves.
 * @dependencies: state, config, multiplayer, pool, towers, map, ui
 * @last_update: 2026-06-01 / v2.5.3 - Removed unused cancelPlacement import from ui.ts to satisfy strict TypeScript unused checks.
 */
import { state } from "../core/state";
import { Config } from "../core/config";
import { Multiplayer } from "../core/multiplayer/context";
import { PoolManager } from "../core/pool";
import { EnemyFactory } from "../entities/enemies";
import {
  Tower,
  SniperTower,
  BombTower,
  TeslaTower,
  PrismaTower,
  BoosterTower,
} from "../entities/towers/index";
import { map } from "../core/map";
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
  document.getElementById("modStartBenchmarkBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    if (state.benchmarkActive) return;
    if (!map) return;

    // 1. Save towers in state.benchmarkBackup
    state.benchmarkBackup = {
      wave: state.wave,
      godMode: state.godMode,
      infiniteGold: state.infiniteGold,
      towers: state.towers.map((t) => ({
        type: t.type,
        col: t.col,
        row: t.row,
        level: t.level,
        specialization: t.specialization,
      })),
    };

    // 2. Set wave to 301, activate infiniteGold and godMode
    state.wave = 301;
    state.infiniteGold = true;
    state.godMode = true;

    // 3. Clear existing towers (and cleanly destroy PixiJS sprites)
    state.towers.forEach((t) => {
      t.destroy();
    });
    state.towers = [];

    const towerTypes = ["Base", "Sniper", "Bomb", "Tesla", "Prisma", "Booster"];
    const typeClasses: Record<string, any> = {
      Base: Tower,
      Sniper: SniperTower,
      Bomb: BombTower,
      Tesla: TeslaTower,
      Prisma: PrismaTower,
      Booster: BoosterTower,
    };

    const rows = map.length;
    const cols = map[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (map[r][c] === 0) {
          const type = towerTypes[Math.floor(Math.random() * towerTypes.length)];
          const TowerClass = typeClasses[type];
          if (TowerClass) {
            const tower = new TowerClass(c, r);
            tower.constructionTimer = 0;
            tower.initPixi();

            // Upgrade to Level 4
            for (let l = 1; l < 4; l++) {
              tower.upgrade();
            }

            // Choose a random specialization dynamically from the class definition
            const specs = tower.getSpecializations ? tower.getSpecializations() : [];
            if (specs.length > 0) {
              const randomSpec = specs[Math.floor(Math.random() * specs.length)].id;
              tower.applySpecialization(randomSpec);
            }

            // Upgrade remaining levels until the maximum level 20
            while (tower.level < Config.TOWER_MAX_LEVEL) {
              tower.upgrade();
            }

            state.towers.push(tower);
          }
        }
      }
    }

    // 4. Set benchmarkActive = true
    state.benchmarkActive = true;

    // 5. Update UI
    updateUI();

    // 6. Broadcast mod toggle for benchmarkActive
    Multiplayer.emitToggleMod("benchmarkActive", true);
    Multiplayer.emitToggleMod("infiniteGold", true);
    Multiplayer.emitToggleMod("godMode", true);

    // 7. Sync all generated towers instantly to all clients
    const towersList = state.towers.map((t) => ({
      type: t.type,
      col: t.col,
      row: t.row,
      level: t.level,
      specId: t.specialization,
    }));
    Multiplayer.emitSyncTowers(towersList);

    // 8. Force immediate sync
    Multiplayer.syncNow();
  });

  document.getElementById("modUndoBenchmarkBtn")?.addEventListener("click", () => {
    if (!state.isHost) return;
    if (!state.benchmarkActive || !state.benchmarkBackup) return;

    // 1. Restore wave, godMode, infiniteGold
    state.wave = state.benchmarkBackup.wave;
    state.godMode = state.benchmarkBackup.godMode;
    state.infiniteGold = state.benchmarkBackup.infiniteGold;

    // 2. Restore towers (and cleanly destroy all benchmark towers' PixiJS sprites)
    state.towers.forEach((t) => {
      t.destroy();
    });
    state.towers = [];

    const typeClasses: Record<string, any> = {
      Base: Tower,
      Sniper: SniperTower,
      Bomb: BombTower,
      Tesla: TeslaTower,
      Prisma: PrismaTower,
      Booster: BoosterTower,
    };

    const wasInfinite = state.infiniteGold;
    state.infiniteGold = true;

    for (let tBackup of state.benchmarkBackup.towers) {
      const TowerClass = typeClasses[tBackup.type];
      if (TowerClass) {
        const tower = new TowerClass(tBackup.col, tBackup.row);
        tower.constructionTimer = 0;
        tower.initPixi();

        // Upgrade to backup level, accounting for specialization upgrade
        const targetLevel = tBackup.level;
        const limit = tBackup.specialization ? targetLevel - 1 : targetLevel;
        for (let l = 1; l < limit; l++) {
          tower.upgrade();
        }
        if (tBackup.specialization) {
          tower.applySpecialization(tBackup.specialization);
        }
        state.towers.push(tower);
      }
    }

    state.infiniteGold = wasInfinite;

    // 3. Reset benchmarkActive and backup
    state.benchmarkBackup = null;
    state.benchmarkActive = false;

    // 4. Update UI
    updateUI();

    // 5. Broadcast mod toggles
    Multiplayer.emitToggleMod("benchmarkActive", false);
    Multiplayer.emitToggleMod("infiniteGold", state.infiniteGold);
    Multiplayer.emitToggleMod("godMode", state.godMode);

    // 6. Sync restored towers to all clients
    const towersList = state.towers.map((t) => ({
      type: t.type,
      col: t.col,
      row: t.row,
      level: t.level,
      specId: t.specialization,
    }));
    Multiplayer.emitSyncTowers(towersList);

    // 7. Force immediate sync
    Multiplayer.syncNow();
  });

  document.getElementById("modCloseBtn")?.addEventListener("click", () => {
    modMenu?.classList.add("hidden");
  });
  document.getElementById("modCloseBtnSmall")?.addEventListener("click", () => {
    modMenu?.classList.add("hidden");
  });
}
