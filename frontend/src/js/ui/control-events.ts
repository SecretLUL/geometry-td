/*
 * @file: frontend/src/js/ui/control-events.ts
 * @purpose: Registers and manages event listeners for control HUD buttons, mod menus, restart, and wave toggles.
 * @dependencies: state, config, multiplayer, pool, ui, hud, tooltips
 */
import { state } from "../core/state";
import { Config } from "../core/config";
import { Multiplayer, socket } from "../core/multiplayer/context";
import { PoolManager } from "../core/pool";
import { updateUI, cancelPlacement, setPauseState } from "./ui";
import { resetHudDisplay } from "./hud";
import { updateTooltip } from "./tooltips";

export function setupControlEvents(startWaveCallback: () => void): void {
  const cancelBtn = document.getElementById("cancelPlacementBtn");
  const restartBtn = document.getElementById("restartBtn");
  const startWaveBtn = document.getElementById("startWaveBtn") as HTMLButtonElement | null;
  const pauseBtn = document.getElementById("pauseBtn") as HTMLButtonElement | null;
  const speedBtn = document.getElementById("speedBtn") as HTMLButtonElement | null;
  const autoStartBtn = document.getElementById("autoStartBtn") as HTMLButtonElement | null;
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
}
