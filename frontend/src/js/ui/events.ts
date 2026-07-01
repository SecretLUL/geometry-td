/*
 * @file: frontend/src/js/ui/events.ts
 * @purpose: Setup and bindings for client click events, tower placement triggers, selling/upgrading selections, and button clicks.
 * @dependencies: state, config, multiplayer, pool, map, modals, tooltips, ui, hud
 * @last_update: 2026-05-29 / v1.9.1 - Reset originalWave and waveModified in game resets.
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
import { Multiplayer, socket } from "../core/multiplayer/context";
import { PoolManager } from "../core/pool";
import { map, getCOLS, getROWS } from "../core/map";
import { showUpgradeModal, showContextShop, hideContextShop } from "./modals";
import { updateTooltip } from "./tooltips";
import { updateUI, cancelPlacement, setPauseState } from "./ui";
import { resetHudDisplay } from "./hud";
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

export function setupEvents(startWaveCallback: () => void, canvas: HTMLCanvasElement) {
  const restartBtn = document.getElementById("restartBtn");
  const startWaveBtn = document.getElementById("startWaveBtn") as HTMLButtonElement | null;
  const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement | null;
  const speedBtn = document.getElementById("speedBtn") as HTMLButtonElement | null;
  const autoStartBtn = document.getElementById("autoStartBtn") as HTMLButtonElement | null;
  const cancelBtn = document.getElementById("cancelPlacementBtn");
  const mainMenuBtn = document.getElementById("mainMenuBtn");

  cancelBtn?.addEventListener("click", () => {
    cancelPlacement();
  });

  document.addEventListener("keydown", (e) => {
    const modMenu = document.getElementById("modMenu");
    if (e.key === "m" || e.key === "M") {
      const activeEl = document.activeElement;
      if (activeEl && activeEl.id === "modWaveInput") return;
      if (state.isHost && modMenu) {
        modMenu.classList.toggle("hidden");
        updateUI(); // Refresh button states on display toggle
      }
    }
    if (e.key === "Escape") {
      const igSettingsModal = document.getElementById("inGameSettingsModal");
      if (modMenu && !modMenu.classList.contains("hidden")) {
        modMenu.classList.add("hidden");
      } else if (igSettingsModal && !igSettingsModal.classList.contains("hidden")) {
        const igCloseBtn = document.getElementById("closeSettingsBtn");
        (igCloseBtn as HTMLElement | null)?.click();
      } else {
        cancelPlacement();
      }
    }
  });

  // ── Quit to Main Menu Modal Logic ─────────────────────────────────────────
  const quitConfirmModal = document.getElementById("quitConfirmModal");
  const confirmQuitBtn = document.getElementById("confirmQuitBtn");
  const cancelQuitBtn = document.getElementById("cancelQuitBtn");

  mainMenuBtn?.addEventListener("click", () => {
    quitConfirmModal?.classList.remove("hidden");
  });

  cancelQuitBtn?.addEventListener("click", () => {
    quitConfirmModal?.classList.add("hidden");
  });

  confirmQuitBtn?.addEventListener("click", () => {
    PoolManager.reset();
    resetHudDisplay(Config.STARTING_GOLD, Config.STARTING_LIVES);
    Object.assign(state, {
      lives: Config.STARTING_LIVES,
      gold: Config.STARTING_GOLD,
      wave: 1,
      totalGoldEarned: 0,
      totalGoldFromInterest: 0,
      isWaveActive: false,
      gameOver: false,
      isPaused: false,
      autoStartActive: false,
      selectedTowerType: null,
      camera: { x: 0, y: 0 },
      enemies: [],
      towers: [],
      enemiesToSpawn: 0,
      spawnCooldown: 0,
      gameSpeed: Config.GAME_SPEEDS.NORMAL,
      hoveredTower: null,
      godMode: false,
      infiniteGold: false,
      waveModified: false,
      originalWave: null,
    });
    document.getElementById("bossHpContainer")?.classList.add("hidden");
    document.getElementById("gameOverScreen")?.classList.add("hidden");
    quitConfirmModal?.classList.add("hidden");
    window.location.href = "index.html";
    updateUI();

    // Reset UI states
    if (startWaveBtn) {
      startWaveBtn.disabled = false;
      startWaveBtn.innerText = "Welle Starten";
    }
    if (pauseBtn) {
      pauseBtn.innerText = "Pause";
      pauseBtn.style.backgroundColor = "";
    }
    if (speedBtn) {
      speedBtn.innerText = "1x Speed";
      speedBtn.style.backgroundColor = "";
    }
    if (autoStartBtn) {
      autoStartBtn.innerText = "Auto: Aus";
      autoStartBtn.style.backgroundColor = "";
    }
    cancelBtn?.classList.add("hidden");
    document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
  });

  // ── In-Game Settings Modal ────────────────────────────────────────────────
  const inGameSettingsBtn = document.getElementById("inGameSettingsBtn");
  const inGameSettingsModal = document.getElementById("inGameSettingsModal");
  const closeSettingsBtn = document.getElementById("closeSettingsBtn");

  // Helper to check if playing alone (no socket, not connected, or only 1 player)
  const checkIsAlone = () => {
    return (
      !socket ||
      !socket.connected ||
      !Multiplayer.lastPlayerCount ||
      Multiplayer.lastPlayerCount <= 1
    );
  };

  inGameSettingsBtn?.addEventListener("click", () => {
    const isAlone = checkIsAlone();
    if (isAlone) {
      state.wasPaused = state.isPaused;
      if (!state.isPaused) {
        setPauseState(true);
        Multiplayer.emitTogglePause(true);
      }
    }
    inGameSettingsModal?.classList.remove("hidden");
  });

  closeSettingsBtn?.addEventListener("click", () => {
    inGameSettingsModal?.classList.add("hidden");
    const isAlone = checkIsAlone();
    if (isAlone) {
      if (!state.wasPaused && state.isPaused) {
        setPauseState(false);
        Multiplayer.emitTogglePause(false);
      }
    }
  });

  // Sync settings between main menu and in-game modal
  const refreshRateSelect = document.getElementById(
    "refreshRateSelect"
  ) as HTMLSelectElement | null;
  const igRefreshRateSelect = document.getElementById(
    "igRefreshRateSelect"
  ) as HTMLSelectElement | null;

  // Load and apply saved refresh rate from localStorage
  const savedRefreshRate = localStorage.getItem("td_refresh_rate") || "60";
  if (refreshRateSelect) refreshRateSelect.value = savedRefreshRate;
  if (igRefreshRateSelect) igRefreshRateSelect.value = savedRefreshRate;

  if (refreshRateSelect) {
    refreshRateSelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      if (igRefreshRateSelect) igRefreshRateSelect.value = target.value;
      localStorage.setItem("td_refresh_rate", target.value);
    });
  }
  if (igRefreshRateSelect) {
    igRefreshRateSelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      if (refreshRateSelect) refreshRateSelect.value = target.value;
      localStorage.setItem("td_refresh_rate", target.value);
    });
  }

  const soundVolume = document.getElementById("soundVolume") as HTMLInputElement | null;
  const igSoundVolume = document.getElementById("igSoundVolume") as HTMLInputElement | null;
  if (soundVolume && igSoundVolume) {
    soundVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      igSoundVolume.value = target.value;
    });
    igSoundVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      soundVolume.value = target.value;
    });
  }

  const musicVolume = document.getElementById("musicVolume") as HTMLInputElement | null;
  const igMusicVolume = document.getElementById("igMusicVolume") as HTMLInputElement | null;
  if (musicVolume && igMusicVolume) {
    musicVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      igMusicVolume.value = target.value;
    });
    igMusicVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      musicVolume.value = target.value;
    });
  }

  const perfModeToggle = document.getElementById("perfModeToggle") as HTMLInputElement | null;
  const igPerfModeToggle = document.getElementById("igPerfModeToggle") as HTMLInputElement | null;

  // Initialize performance mode state from localStorage
  const savedPerfMode = localStorage.getItem("td_perf_mode") === "true";
  state.perfMode = savedPerfMode;
  if (perfModeToggle) perfModeToggle.checked = savedPerfMode;
  if (igPerfModeToggle) igPerfModeToggle.checked = savedPerfMode;

  if (perfModeToggle) {
    perfModeToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (igPerfModeToggle) igPerfModeToggle.checked = target.checked;
      state.perfMode = target.checked;
      localStorage.setItem("td_perf_mode", String(target.checked));
    });
  }
  if (igPerfModeToggle) {
    igPerfModeToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (perfModeToggle) perfModeToggle.checked = target.checked;
      state.perfMode = target.checked;
      localStorage.setItem("td_perf_mode", String(target.checked));
    });
  }

  const fpsToggle = document.getElementById("fpsToggle") as HTMLInputElement | null;
  const igFpsToggle = document.getElementById("igFpsToggle") as HTMLInputElement | null;

  // Initialize FPS toggle state from localStorage
  const savedShowFps = localStorage.getItem("td_show_fps") === "true";
  state.showFps = savedShowFps;
  if (fpsToggle) fpsToggle.checked = savedShowFps;
  if (igFpsToggle) igFpsToggle.checked = savedShowFps;

  if (fpsToggle) {
    fpsToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (igFpsToggle) igFpsToggle.checked = target.checked;
      state.showFps = target.checked;
      localStorage.setItem("td_show_fps", String(target.checked));
    });
  }
  if (igFpsToggle) {
    igFpsToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (fpsToggle) fpsToggle.checked = target.checked;
      state.showFps = target.checked;
      localStorage.setItem("td_show_fps", String(target.checked));
    });
  }

  // ── Tower Selection ───────────────────────────────────────────────────────
  document.querySelectorAll(".tower-btn").forEach((btn) => {
    const htmlBtn = btn as HTMLElement;
    htmlBtn.addEventListener("click", (e) => {
      const clickedBtn = e.currentTarget as HTMLElement;
      const type = clickedBtn.dataset.type;

      if (state.selectedTowerType === type) {
        // Toggle off
        cancelPlacement();
      } else {
        document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
        clickedBtn.classList.add("selected");
        state.selectedTowerType = type || null;
        if (cancelBtn) cancelBtn.classList.remove("hidden");
      }
    });

    // Add hover listeners for shop tooltips
    htmlBtn.addEventListener("mouseenter", (e) => {
      state.shopHoveredType = htmlBtn.dataset.type || null;
      state.lastClientMouse.x = e.clientX;
      state.lastClientMouse.y = e.clientY;
      updateTooltip();
    });
    htmlBtn.addEventListener("mouseleave", () => {
      state.shopHoveredType = null;
      updateTooltip();
    });
  });

  // ── Restart ───────────────────────────────────────────────────────────────
  restartBtn?.addEventListener("click", () => {
    PoolManager.reset();
    resetHudDisplay(Config.STARTING_GOLD, Config.STARTING_LIVES);
    Object.assign(state, {
      lives: Config.STARTING_LIVES,
      gold: Config.STARTING_GOLD,
      wave: 1,
      totalGoldEarned: 0,
      totalGoldFromInterest: 0,
      isWaveActive: false,
      gameOver: false,
      isPaused: false,
      autoStartActive: false,
      selectedTowerType: null,
      camera: { x: 0, y: 0 },
      enemies: [],
      towers: [],
      enemiesToSpawn: 0,
      spawnCooldown: 0,
      gameSpeed: Config.GAME_SPEEDS.NORMAL,
      hoveredTower: null,
      godMode: false,
      infiniteGold: false,
      waveModified: false,
      originalWave: null,
    });
    document.getElementById("bossHpContainer")?.classList.add("hidden");
    document.getElementById("gameOverScreen")?.classList.add("hidden");
    window.location.href = "index.html"; // Go back to menu on game over / restart if desired, or just reset state.

    if (startWaveBtn) {
      startWaveBtn.disabled = false;
      startWaveBtn.innerText = "Welle Starten";
    }
    if (pauseBtn) {
      pauseBtn.innerText = "Pause";
      pauseBtn.style.backgroundColor = "";
    }
    if (speedBtn) {
      speedBtn.innerText = "1x Speed";
      speedBtn.style.backgroundColor = "";
      speedBtn.style.color = "";
    }
    if (autoStartBtn) {
      autoStartBtn.innerText = "Auto: Aus";
      autoStartBtn.style.backgroundColor = "";
      autoStartBtn.style.color = "";
    }
    if (cancelBtn) cancelBtn.classList.add("hidden");
    document.querySelectorAll(".tower-btn").forEach((b) => b.classList.remove("selected"));
    updateUI();
  });

  // ── Pause ─────────────────────────────────────────────────────────────────
  pauseBtn?.addEventListener("click", () => {
    if (state.gameOver) return;
    const newPause = !state.isPaused;
    setPauseState(newPause);
    Multiplayer.emitTogglePause(newPause);
  });

  // ── Pause Overlay Buttons ──────────────────────────────────────────────────
  const resumeGameBtn = document.getElementById("resumeGameBtn");
  const pauseSettingsBtn = document.getElementById("pauseSettingsBtn");
  const pauseQuitBtn = document.getElementById("pauseQuitBtn");

  resumeGameBtn?.addEventListener("click", () => {
    setPauseState(false);
    Multiplayer.emitTogglePause(false);
  });

  pauseSettingsBtn?.addEventListener("click", () => {
    const isAlone = checkIsAlone();
    if (isAlone) {
      state.wasPaused = state.isPaused;
    }
    inGameSettingsModal?.classList.remove("hidden");
  });

  pauseQuitBtn?.addEventListener("click", () => {
    quitConfirmModal?.classList.remove("hidden");
  });

  // ── Speed ─────────────────────────────────────────────────────────────────
  speedBtn?.addEventListener("click", () => {
    if (state.gameSpeed === Config.GAME_SPEEDS.NORMAL) {
      state.gameSpeed = Config.GAME_SPEEDS.FAST;
      speedBtn.innerText = "2x Speed";
      speedBtn.style.background = "linear-gradient(to bottom, #ffb703, #d49a00)";
      speedBtn.style.color = "#fff";
    } else if (state.gameSpeed === Config.GAME_SPEEDS.FAST) {
      state.gameSpeed = Config.GAME_SPEEDS.SUPER_FAST;
      speedBtn.innerText = "4x Speed";
      speedBtn.style.background = "linear-gradient(to bottom, #ff0055, #b3003b)";
      speedBtn.style.color = "#fff";
    } else {
      state.gameSpeed = Config.GAME_SPEEDS.NORMAL;
      speedBtn.innerText = "1x Speed";
      speedBtn.style.background = "";
      speedBtn.style.color = "";
    }
    Multiplayer.emitChangeSpeed(state.gameSpeed);
  });

  // ── Auto-start ────────────────────────────────────────────────────────────
  autoStartBtn?.addEventListener("click", () => {
    state.autoStartActive = !state.autoStartActive;
    autoStartBtn.innerText = state.autoStartActive ? "Auto: An" : "Auto: Aus";
    autoStartBtn.style.background = state.autoStartActive
      ? "linear-gradient(to bottom, #00ff88, #00b35f)"
      : "";
    autoStartBtn.style.color = state.autoStartActive ? "#fff" : "";

    const swBtn = document.getElementById("startWaveBtn") as HTMLButtonElement | null;
    if (swBtn) {
      if (state.autoStartActive) {
        swBtn.classList.add("btn-disabled");
        swBtn.disabled = true;
      } else if (!state.isWaveActive) {
        swBtn.classList.remove("btn-disabled");
        swBtn.disabled = false;
      }
    }

    if (state.autoStartActive && !state.isWaveActive && !state.gameOver) {
      startWaveCallback();
    }

    // Multiplayer Sync
    Multiplayer.emitToggleAuto(state.autoStartActive);
  });

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

  if (startWaveBtn) {
    startWaveBtn.addEventListener("click", startWaveCallback);
  }

  // ── Mobile UI Toggle ──────────────────────────────────────────────────────
  const mobileToggle = document.getElementById("mobile-ui-toggle");
  const uiPanel = document.getElementById("ui-panel");

  mobileToggle?.addEventListener("click", () => {
    uiPanel?.classList.toggle("mobile-open");
    mobileToggle?.classList.toggle("active");
  });

  // ── Upgrade Modal Setup ───────────────────────────────────────────────────

  const upgradeModal = document.getElementById("upgradeModal");
  const cancelUpgradeBtn = document.getElementById("cancelUpgradeBtn");
  cancelUpgradeBtn?.addEventListener("click", () => {
    upgradeModal?.classList.add("hidden");
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
