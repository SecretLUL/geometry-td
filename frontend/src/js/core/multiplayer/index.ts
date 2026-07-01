/*
 * @file: frontend/src/js/core/multiplayer/index.ts
 * @purpose: Entry point for multiplayer setup, unifying host and client logic into a single API
 *           with headless-host connection support.
 * @dependencies: state, config, context, host, inbound, outbound
 * @last_update: 2026-05-29 / v1.4.1 - Bound emitHostEndedWave to Multiplayer API.
 */
import { state } from "../state";
import { Config } from "../config";
import { Multiplayer, socket, setSocket } from "./context";
import {
  processPlaceTower,
  processUpgradeTower,
  processSellTower,
  recalculateRelocationState,
  processRelocateTower,
} from "./host";
import { bindInboundEvents } from "./inbound";
import {
  emitSyncGameState,
  syncNow,
  emitChangeSpeed,
  emitToggleMod,
  emitTogglePause,
  emitToggleAuto,
  emitSyncTowers,
  emitRequestPlaceTower,
  emitRequestUpgradeTower,
  emitRequestSellTower,
  emitRequestWaveStart,
  emitSyncLives,
  emitSyncGold,
  emitHostEndedWave,
  emitRequestRelocateTower,
} from "./outbound";
import { cleanupAllWebRTC, hasActiveWebRTCClients } from "./webrtc";
import { logger } from "../logger";

// Setup/initialize the Multiplayer object methods
Multiplayer.init = function (
  startWaveCallback: (data?: unknown) => void,
  updateUICallback: () => void
): void {
  this.updateUI = updateUICallback;
  this.startWaveCallback = startWaveCallback;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const isHeadless = urlParams.get("headless") === "true";

    // Detect if we are in development environment
    const isDevEnv =
      window.location.hostname.includes("gtd-dev") ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    // Determine if we should request being the Host
    let wantHost = false;
    if (isHeadless) {
      wantHost = true;
    } else if (isDevEnv) {
      const roleParam = urlParams.get("role");
      wantHost = roleParam !== "client"; // default to host in dev
    }

    const roomIdParam = urlParams.get("roomId");
    const queryParams: Record<string, string> = {
      headless: isHeadless ? "true" : "false",
      wantHost: wantHost ? "true" : "false",
    };
    if (roomIdParam) {
      queryParams.roomId = roomIdParam;
    }

    const ioSocket = (window as unknown as { io?: (opts?: unknown) => unknown }).io
      ? ((window as unknown as { io: (opts?: unknown) => unknown }).io({
          query: queryParams,
        }) as import("./context").SocketInstance)
      : null;
    setSocket(ioSocket);
  } catch (e) {
    logger.error("Fehler beim Initialisieren von Socket.io:", { error: e });
  }

  if (!socket) {
    logger.warn("Socket.io nicht geladen oder Verbindung fehlgeschlagen. Lokaler Modus aktiv.");
    state.isHost = true; // Im lokalen Modus sind wir immer Host
    cleanupAllWebRTC();
    return;
  }

  logger.info("Multiplayer-System initialisiert.");

  // Decoupled host state sync timeout loop (50ms/20Hz for WebRTC, 100ms/10Hz fallback for Socket.io)
  let idleTicks = 0;
  if (this.syncInterval) {
    clearTimeout(this.syncInterval);
    this.syncInterval = null;
  }

  const runSyncLoop = () => {
    if (state.isHost && (!state.isPaused || state.relocationActive) && !state.gameOver) {
      const hasWebRTC = hasActiveWebRTCClients();
      const intervalDuration = hasWebRTC ? 50 : 100;

      const isIdle =
        state.enemies.length === 0 &&
        !state.isWaveActive &&
        (!state.projectileEvents || state.projectileEvents.length === 0);
      let skipSync = false;

      if (isIdle) {
        idleTicks++;
        // Sync every 500ms when idle
        const idleLimit = hasWebRTC ? 10 : 5;
        if (idleTicks % idleLimit !== 0) {
          skipSync = true;
        }
      } else {
        idleTicks = 0;
      }

      if (!skipSync) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload: Record<string, any> = {
          hostTileSize: Config.TILE_SIZE,
          activeEnemies: state.enemies.map((e) => ({
            id: e.id,
            typeName: e.typeName,
            hp: e.hp,
            distanceTravelled: e.distanceTravelled,
            targetWaypointIndex: e.targetWaypointIndex,
            x: e.x,
            y: e.y,
            wave: e.waveNumber,
            speed: e.speed,
            shieldActive: e.shieldActive,
            maxHp: e.maxHp,
            swarmGroupId: e.swarmGroupId,
          })),
          enemiesToSpawn: state.enemiesToSpawn,
          spawnCooldown: state.spawnCooldown,
          enemyPool: state.enemyPool,
          isWaveActive: state.isWaveActive,
          autoStartActive: state.autoStartActive,
          wave: state.wave,
          lives: state.lives,
          gold: state.gold,
          playerSlots: state.playerSlots,
          playerGolds: state.playerGolds,
          screenDamageEffect: state.screenDamageEffect,
          towers: state.towers.map((t) => ({
            col: t.col,
            row: t.row,
            type: t.type,
            level: t.level,
            specId: t.specialization,
            damageDealt: t.damageDealt,
            totalSpent: t.totalSpent,
            ownerIndex: (t as any).ownerIndex,
          })),
        };

        // Add and clear projectileEvents
        if (state.projectileEvents && state.projectileEvents.length > 0) {
          payload.projectileEvents = state.projectileEvents;
          state.projectileEvents = []; // Clear the Host buffer
        } else {
          payload.projectileEvents = [];
        }

        this.emitSyncGameState(payload as import("../../types").SyncFullGameStatePayload);
      }

      this.syncInterval = setTimeout(runSyncLoop, intervalDuration);
    } else {
      // Recheck/retry after a short delay if game is paused or we are not host yet
      this.syncInterval = setTimeout(runSyncLoop, 100);
    }
  };

  runSyncLoop();

  bindInboundEvents(startWaveCallback);
};

Multiplayer.updatePlayerCountUI = function (count: number): void {
  let counterEl = document.getElementById("playerCounter");
  if (!counterEl) {
    counterEl = document.createElement("div");
    counterEl.id = "playerCounter";
    counterEl.style.cssText = `
            color: #4cc9f0; 
            font-weight: bold; 
            background: rgba(0,0,0,0.4); 
            border: 1px solid rgba(76, 201, 240, 0.3);
            padding: 10px 15px; 
            border-radius: 8px; 
            margin-top: 15px; 
            text-align: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            letter-spacing: 2px;
            text-transform: uppercase;
            font-size: 0.9em;
        `;

    const btnGroup = document.querySelector(".button-group");
    if (btnGroup) {
      btnGroup.insertAdjacentElement("afterend", counterEl);
    } else {
      const controls = document.querySelector(".controls");
      if (controls) controls.appendChild(counterEl);
    }
  }
  if (counterEl) {
    let roomInfoText = `👥 ${count} SPIELER VERBUNDEN`;
    const activeMode = Multiplayer.activeMode || "public";
    const activeRoomId = Multiplayer.activeRoomId;

    let modeLabel = "ÖFFENTLICH";
    if (activeMode === "singleplayer") {
      modeLabel = "SINGLEPLAYER";
    } else if (activeMode === "private") {
      modeLabel = "PRIVAT";
    }

    roomInfoText += `\n⚙️ MODUS: ${modeLabel}`;
    if (activeMode === "private" && activeRoomId) {
      roomInfoText += `\n🔑 CODE: ${activeRoomId}`;
    }

    counterEl.innerText = roomInfoText;
  }

  // Role switcher button ONLY in Dev environment
  const isDevEnv =
    window.location.hostname.includes("gtd-dev") ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  if (isDevEnv && counterEl) {
    let toggleBtn = document.getElementById("devRoleToggleBtn") as HTMLButtonElement | null;
    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.id = "devRoleToggleBtn";
      toggleBtn.style.cssText = `
                display: block;
                width: 100%;
                margin-top: 8px;
                padding: 10px 15px;
                font-family: 'Outfit', sans-serif;
                font-weight: bold;
                font-size: 0.85em;
                letter-spacing: 1px;
                text-transform: uppercase;
                border-radius: 8px;
                border: 1px solid rgba(252, 163, 17, 0.3);
                background: linear-gradient(135deg, rgba(252, 163, 17, 0.2), rgba(212, 154, 0, 0.1));
                color: #fca311;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            `;

      toggleBtn.addEventListener("mouseenter", () => {
        if (toggleBtn) {
          toggleBtn.style.background =
            "linear-gradient(135deg, rgba(252, 163, 17, 0.4), rgba(212, 154, 0, 0.2))";
          toggleBtn.style.border = "1px solid rgba(252, 163, 17, 0.6)";
          toggleBtn.style.boxShadow = "0 0 15px rgba(252, 163, 17, 0.4)";
          toggleBtn.style.transform = "translateY(-1px)";
        }
      });

      toggleBtn.addEventListener("mouseleave", () => {
        if (toggleBtn) {
          toggleBtn.style.background =
            "linear-gradient(135deg, rgba(252, 163, 17, 0.2), rgba(212, 154, 0, 0.1))";
          toggleBtn.style.border = "1px solid rgba(252, 163, 17, 0.3)";
          toggleBtn.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
          toggleBtn.style.transform = "translateY(0)";
        }
      });

      toggleBtn.addEventListener("click", () => {
        const params = new URLSearchParams(window.location.search);
        const currentRole = params.get("role");
        if (currentRole === "client" || !state.isHost) {
          params.delete("role"); // Switch to Host (default in dev)
        } else {
          params.set("role", "client"); // Switch to Client
        }
        window.location.search = params.toString();
      });

      counterEl.insertAdjacentElement("afterend", toggleBtn);
    }

    // Update button text based on current actual assigned host state
    if (state.isHost) {
      toggleBtn.innerText = "🔄 ALS CLIENT BEITRETEN";
    } else {
      toggleBtn.innerText = "🔄 ALS HOST BEITRETEN";
    }
  }
};

// Assign remaining functions
Multiplayer.processPlaceTower = processPlaceTower;
Multiplayer.processUpgradeTower = processUpgradeTower;
Multiplayer.processSellTower = processSellTower;
(Multiplayer as any).recalculateRelocationState = recalculateRelocationState;
(Multiplayer as any).processRelocateTower = processRelocateTower;

Multiplayer.emitSyncGameState = emitSyncGameState;
Multiplayer.syncNow = syncNow;
Multiplayer.emitChangeSpeed = emitChangeSpeed;
Multiplayer.emitToggleMod = emitToggleMod;
Multiplayer.emitTogglePause = emitTogglePause;
Multiplayer.emitToggleAuto = emitToggleAuto;
Multiplayer.emitSyncTowers = emitSyncTowers;
Multiplayer.emitRequestPlaceTower = emitRequestPlaceTower;
Multiplayer.emitRequestUpgradeTower = emitRequestUpgradeTower;
Multiplayer.emitRequestSellTower = emitRequestSellTower;
Multiplayer.emitRequestWaveStart = emitRequestWaveStart;
Multiplayer.emitSyncLives = emitSyncLives;
Multiplayer.emitSyncGold = emitSyncGold;
Multiplayer.emitHostEndedWave = emitHostEndedWave;
Multiplayer.emitRequestRelocateTower = emitRequestRelocateTower;

export { Multiplayer, socket, setSocket };
