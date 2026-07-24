/*
 * @file: frontend/src/js/core/multiplayer/inbound.ts
 * @purpose: Handles reception and parsing of inbound server socket messages (role assignments,
 *           game state updates, tower confirmations, pause commands). Applies full state sync
 *           and delta updates from the host.
 * @dependencies: state, config, ui, types, context, webrtc, inbound helpers
 * @last_update: 2026-07-01 / v1.11.0 - Refactored and modularized into sub-helpers.
 */
import { state } from "../state";
import { Config } from "../config";
import { showGameNotification, setPauseState } from "../../ui/ui";
import {
  Enemy,
  GameStateSocketPayload,
  SyncEnemyState,
  SyncTowerState,
  SocketEventMap,
} from "../../types";
import { Multiplayer, socket, setSocket } from "./context";
import {
  handleWebRTCSignal,
  setWebRTCRole,
  registerWebRTCMessageHandler,
  cleanupAllWebRTC,
  setIceServers,
} from "./webrtc";

import { updateAutoStartBtn, updatePauseBtn, updateSpeedBtn } from "./inbound/domUpdates";
import { triggerWaveCompleteVisuals, handleProjectileEvents } from "./inbound/visualEffects";
import {
  syncTowersFromList,
  recreateTowersFromList,
  handleConfirmPlaceTower,
  handleRejectPlaceTower,
  handleConfirmUpgradeTower,
  handleConfirmSellTower,
  handlePlayerDisconnectReassignment,
} from "./inbound/towerReconciliation";
import {
  initializeLastReceivedState,
  reconstructGameState,
  syncEnemies,
} from "./inbound/stateReconciliation";

export function processIncomingGameState(payload: GameStateSocketPayload): void {
  if (state.isHost) return;
  if (!payload) return;

  const stateData = payload.state;
  if (!stateData) return;

  // Deduplication check: ignore older or already processed packets
  if (
    Multiplayer.latestServerTimestamp &&
    stateData.timestamp &&
    stateData.timestamp <= Multiplayer.latestServerTimestamp
  ) {
    return;
  }

  initializeLastReceivedState();

  const reconstruction = reconstructGameState(payload);
  if (!reconstruction) return;

  const { reconstructedState, projectileEvents } = reconstruction;
  Multiplayer.lastReceivedState = reconstructedState;

  Multiplayer.latestServerTimestamp = Math.max(
    Multiplayer.latestServerTimestamp || 0,
    reconstructedState.timestamp || 0
  );

  // Add high-precision local receipt timestamp to reconstructedState for client-driven interpolation
  reconstructedState.localTimestamp = performance.now();

  const interpolationFrame = {
    localTimestamp: reconstructedState.localTimestamp,
    hostTileSize: reconstructedState.hostTileSize,
    activeEnemies: reconstructedState.activeEnemies.map((e: SyncEnemyState) => ({
      id: e.id,
      typeName: e.typeName,
      wave: e.wave || reconstructedState.wave || 1,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      distanceTravelled: e.distanceTravelled,
      targetWaypointIndex: e.targetWaypointIndex,
      speed: e.speed,
      shieldActive: e.shieldActive,
      swarmGroupId: e.swarmGroupId,
      shieldHp: e.shieldHp,
      maxShieldHp: e.maxShieldHp,
    })),
  };

  Multiplayer.stateBuffer.push(interpolationFrame);

  // Reconstruct visual projectiles/beams
  if (projectileEvents && projectileEvents.length > 0) {
    const enemiesMap = new Map<number, Enemy>();
    for (const e of state.enemies) {
      enemiesMap.set(e.id, e);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const towersMap = new Map<string, any>();
    for (const t of state.towers) {
      towersMap.set(`${t.col},${t.row}`, t);
    }

    handleProjectileEvents(projectileEvents, enemiesMap, towersMap);
  }

  // Apply immediate game state non-visual updates
  if (reconstructedState.enemiesToSpawn !== undefined)
    state.enemiesToSpawn = reconstructedState.enemiesToSpawn;
  if (reconstructedState.spawnCooldown !== undefined)
    state.spawnCooldown = reconstructedState.spawnCooldown;
  if (reconstructedState.enemyPool !== undefined) state.enemyPool = reconstructedState.enemyPool;

  // Visual wave complete trigger for clients
  if (reconstructedState.isWaveActive !== undefined) {
    if (
      state.isWaveActive &&
      !reconstructedState.isWaveActive &&
      !state.gameOver &&
      (reconstructedState.lives === undefined || reconstructedState.lives > 0) &&
      state.lives > 0
    ) {
      triggerWaveCompleteVisuals();
    }
    state.isWaveActive = reconstructedState.isWaveActive;
  }

  if (reconstructedState.autoStartActive !== undefined)
    state.autoStartActive = reconstructedState.autoStartActive;
  if (reconstructedState.wave !== undefined) state.wave = reconstructedState.wave;
  if (reconstructedState.lives !== undefined) {
    if (reconstructedState.lives < state.lives && !state.godMode) {
      state.screenDamageEffect = 30; // Start pulse
    }
    state.lives = reconstructedState.lives;
  }
  if (
    reconstructedState.screenDamageEffect !== undefined &&
    reconstructedState.screenDamageEffect > 0
  ) {
    if (
      state.screenDamageEffect === 0 ||
      reconstructedState.screenDamageEffect > state.screenDamageEffect
    ) {
      state.screenDamageEffect = reconstructedState.screenDamageEffect;
    }
  }

  if (reconstructedState.playerGolds !== undefined) {
    state.playerGolds = reconstructedState.playerGolds;
  }
  if (
    Multiplayer.myPlayerIndex !== undefined &&
    state.playerGolds &&
    state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
  ) {
    state.gold = state.playerGolds[Multiplayer.myPlayerIndex];
  } else if (reconstructedState.gold !== undefined) {
    state.gold = reconstructedState.gold;
  }

  if (reconstructedState.playerSlots !== undefined) {
    state.playerSlots = reconstructedState.playerSlots;
    const activeCount = state.playerSlots.filter((id) => id !== null).length;
    Multiplayer.lastPlayerCount = activeCount || 1;
  }

  if (reconstructedState.relocationActive !== undefined) {
    state.relocationActive = reconstructedState.relocationActive;
  }

  if (reconstructedState.playerRelocationStates !== undefined) {
    state.playerRelocationStates = reconstructedState.playerRelocationStates;
  }

  if (reconstructedState.towers) {
    syncTowersFromList(reconstructedState.towers);
    (Multiplayer as any).recalculateRelocationState();
  }

  Multiplayer.updateUI();
}

export function bindInboundEvents(
  startWaveCallback: (data?: { wave: number; tick?: number; timestamp?: number }) => void
): void {
  if (!socket) return;
  try {
    const s = socket!;
    const onConnect = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const mapName = urlParams.get("map") || "Unknown Map";
      const mode = urlParams.get("mode") || "public";
      const roomId = urlParams.get("roomId") || undefined;
      const action = urlParams.get("action") || undefined;
      s.emit("join_mission", { mapName, mode, roomId, action });
    };

    if (s.connected) {
      onConnect();
    }
    s.on("connect", onConnect);

    s.on("disconnect", () => {
      cleanupAllWebRTC();
    });

    s.on("room_error", (msg: string) => {
      console.error("Room error:", msg);
      alert("Sector connection error: " + msg);
      window.location.href = "index.html?error=" + encodeURIComponent(msg);
    });

    s.on("role_assigned", (data: any) => {
      state.isHost = data.isHost;
      if (data.playerIndex !== undefined && data.playerIndex !== -1) {
        Multiplayer.myPlayerIndex = data.playerIndex;
      } else {
        Multiplayer.myPlayerIndex = 0;
      }
      if (data.iceServers) {
        setIceServers(data.iceServers);
      }
      // Inform the WebRTC manager of the role change
      setWebRTCRole(state.isHost, null);
      if (state.isHost) {
        // Host immediately syncs the starting parameters to the server!
        Multiplayer.emitSyncGold(state.playerGolds);
        Multiplayer.emitSyncLives(state.lives);
      }
    });

    s.on("webrtc_signal", (data: { senderId: string; signal: unknown }) => {
      handleWebRTCSignal(data.senderId, data.signal);
    });

    s.on("connect_error", () => {
      console.warn("Connection to server failed. Switching to local host mode.");
      state.isHost = true;
    });

    // Register WebRTC message handler to receive UDP-like packets
    registerWebRTCMessageHandler(processIncomingGameState);

    // Initial state for late-joining clients
    s.on("full_game_state", (data: any) => {
      if (data.playerSlots !== undefined) {
        state.playerSlots = data.playerSlots;
        const idx = state.playerSlots.indexOf(s.id || "");
        if (idx !== -1) {
          Multiplayer.myPlayerIndex = idx;
        }
        const activeCount = state.playerSlots.filter((id: any) => id !== null).length;
        Multiplayer.lastPlayerCount = activeCount || 1;
      }
      if (data.playerGolds !== undefined) {
        state.playerGolds = data.playerGolds;
        if (
          Multiplayer.myPlayerIndex !== undefined &&
          state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
        ) {
          state.gold = state.playerGolds[Multiplayer.myPlayerIndex];
        }
      }
      if (data.relocationActive !== undefined) {
        state.relocationActive = data.relocationActive;
      }
      if (data.playerRelocationStates !== undefined) {
        state.playerRelocationStates = data.playerRelocationStates;
      }
      if (!state.isHost) {
        if (data.wave) state.wave = data.wave;
        if (data.lives !== undefined) state.lives = data.lives;
        if (data.gold !== undefined) {
          if (
            Multiplayer.myPlayerIndex !== undefined &&
            state.playerGolds &&
            state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
          ) {
            state.gold = state.playerGolds[Multiplayer.myPlayerIndex];
          } else if (state.gold === undefined || state.gold === 300) {
            state.gold = data.gold;
          }
        }
      }

      // Initialize WebRTC connection using hostId provided by server
      setWebRTCRole(state.isHost, data.hostId || null);
      const {
        towers,
        wave,
        isPaused,
        activeEnemies,
        enemiesToSpawn,
        spawnCooldown,
        gameSpeed,
        godModeActive,
        infiniteGoldActive,
        playerCount,
        enemyPool,
        isWaveActive,
        lives,
        gold,
        hostTileSize,
        autoStartActive,
        waveModified,
        mode,
        roomId,
      } = data;

      Multiplayer.activeMode = mode;
      Multiplayer.activeRoomId = roomId;

      if (towers) {
        recreateTowersFromList(towers);
      }

      if (wave) state.wave = wave;
      if (isPaused !== undefined) state.isPaused = isPaused;
      if (gameSpeed !== undefined) state.gameSpeed = gameSpeed;
      if (godModeActive !== undefined) state.godMode = godModeActive;
      if (infiniteGoldActive !== undefined) state.infiniteGold = infiniteGoldActive;
      if (waveModified !== undefined) state.waveModified = waveModified;
      if (enemyPool !== undefined) state.enemyPool = enemyPool;
      if (isWaveActive !== undefined) state.isWaveActive = isWaveActive;
      if (autoStartActive !== undefined) {
        state.autoStartActive = autoStartActive;
        updateAutoStartBtn();
      }

      if (activeEnemies) {
        syncEnemies(activeEnemies, hostTileSize);
      }
      if (enemiesToSpawn !== undefined) state.enemiesToSpawn = enemiesToSpawn;
      if (spawnCooldown !== undefined) state.spawnCooldown = spawnCooldown;

      updatePauseBtn();
      updateSpeedBtn();

      if (!state.isHost) {
        if (lives !== undefined) state.lives = lives;
        if (gold !== undefined) {
          if (
            Multiplayer.myPlayerIndex !== undefined &&
            state.playerGolds &&
            state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
          ) {
            state.gold = state.playerGolds[Multiplayer.myPlayerIndex];
          } else {
            state.gold = gold;
          }
        }
      }

      if (playerCount !== undefined) {
        Multiplayer.updatePlayerCountUI(playerCount);
      }

      // Initialize lastReceivedState for future delta updates
      Multiplayer.lastReceivedState = {
        tick: wave || 0,
        timestamp: performance.now(),
        hostTileSize: hostTileSize || Config.TILE_SIZE,
        activeEnemies: activeEnemies
          ? activeEnemies.map((eData: SyncEnemyState) => ({
              id: eData.id,
              typeName: eData.typeName,
              wave: eData.wave || wave || state.wave,
              x: eData.x,
              y: eData.y,
              hp: eData.hp,
              maxHp: eData.maxHp || eData.hp,
              distanceTravelled: eData.distanceTravelled,
              targetWaypointIndex:
                eData.targetWaypointIndex !== undefined ? eData.targetWaypointIndex : 0,
              speed: eData.speed !== undefined ? eData.speed : 1,
              shieldActive: eData.shieldActive || false,
              swarmGroupId: eData.swarmGroupId,
              shieldHp: eData.shieldHp,
              maxShieldHp: eData.maxShieldHp,
            }))
          : [],
        enemiesToSpawn: enemiesToSpawn || 0,
        spawnCooldown: spawnCooldown || 0,
        wave: wave || 1,
        isWaveActive: isWaveActive || false,
        autoStartActive: autoStartActive || false,
        lives: lives || 20,
        gold: gold || 0,
        enemyPool: enemyPool || [],
        screenDamageEffect: 0,
        towers: towers || [],
        playerSlots: data.playerSlots || [null, null, null, null],
        playerGolds: data.playerGolds || [300, 300, 300, 300],
        relocationActive: data.relocationActive || false,
        playerRelocationStates: data.playerRelocationStates || [false, false, false, false],
      };

      (Multiplayer as any).recalculateRelocationState();
      Multiplayer.updateUI();
      s.emit("ready_to_play");
    });

    s.on("sync_complete", () => {
      const globalWindow = window as unknown as { onSyncComplete?: () => void };
      if (globalWindow.onSyncComplete) globalWindow.onSyncComplete();
    });

    s.on("sync_game_state", (payload: GameStateSocketPayload) => {
      processIncomingGameState(payload);
    });

    // Toggle Pause
    s.on("toggle_pause", (isPaused: boolean) => {
      setPauseState(isPaused);
    });

    // Change Speed
    s.on("change_speed", (speed: number) => {
      state.gameSpeed = speed;
      updateSpeedBtn();
    });

    // Toggle Mod
    s.on("toggle_mod", (data: SocketEventMap["toggle_mod"]) => {
      if (data.mod === "godMode") state.godMode = data.value;
      if (data.mod === "infiniteGold") state.infiniteGold = data.value;
      if (data.mod === "waveModified") state.waveModified = data.value;
      Multiplayer.updateUI();
    });

    // Toggle Auto
    s.on("toggle_auto", (isActive: boolean) => {
      state.autoStartActive = isActive;
      Multiplayer.updateUI();

      if (state.autoStartActive && !state.isWaveActive && !state.gameOver) {
        startWaveCallback();
      }
    });

    // Player Count Update
    s.on("player_count_update", (count: number) => {
      if (Multiplayer.lastPlayerCount !== undefined && Multiplayer.lastPlayerCount !== null) {
        if (count > Multiplayer.lastPlayerCount) {
          showGameNotification(
            "info",
            "👥 MITGLIED BEIGETRETEN",
            "Ein neuer Spieler ist der Mission beigetreten. Willkommen im Trupp!"
          );
          // Reset lastSyncState to force a full state update for the new player
          if (state.isHost) {
            Multiplayer.lastSyncState = null;
            Multiplayer.syncNow();
          }
        } else if (count < Multiplayer.lastPlayerCount) {
          showGameNotification(
            "warning",
            "👥 SPIELER AUSGETRETEN",
            "Ein Spieler hat die Verbindung getrennt. Weiterkämpfen!"
          );
        }
      }
      Multiplayer.lastPlayerCount = count;
      Multiplayer.updatePlayerCountUI(count);
    });

    // Sync Towers
    s.on("sync_towers", (towersList: SyncTowerState[]) => {
      if (state.isHost) return; // Only clients process this
      recreateTowersFromList(towersList);
      (Multiplayer as any).recalculateRelocationState();
      Multiplayer.updateUI();
    });

    // Host Validation Listeners
    s.on("request_place_tower", (data: any) => {
      if (!state.isHost) return;
      Multiplayer.processPlaceTower(data.type, data.col, data.row, data.playerId);
    });

    s.on("request_upgrade_tower", (data: any) => {
      if (!state.isHost) return;
      Multiplayer.processUpgradeTower(data.col, data.row, data.specId, true, data.playerId);
    });

    s.on("request_sell_tower", (data: any) => {
      if (!state.isHost) return;
      Multiplayer.processSellTower(data.col, data.row, data.playerId);
    });

    s.on("request_relocate_tower", (data: any) => {
      if (!state.isHost) return;
      (Multiplayer as any).processRelocateTower(
        data.fromCol,
        data.fromRow,
        data.toCol,
        data.toRow,
        data.playerId
      );
    });

    // Client Confirms
    s.on("confirm_place_tower", (data: any) => {
      if (state.isHost) return;
      handleConfirmPlaceTower(data);
      Multiplayer.updateUI();
    });

    s.on("reject_place_tower", (data: SocketEventMap["reject_place_tower"]) => {
      if (state.isHost) return;
      handleRejectPlaceTower(data);
      Multiplayer.updateUI();
    });

    s.on("confirm_upgrade_tower", (data: SocketEventMap["confirm_upgrade_tower"]) => {
      if (state.isHost) return;
      handleConfirmUpgradeTower(data);
      Multiplayer.updateUI();
    });

    s.on("confirm_sell_tower", (data: SocketEventMap["confirm_sell_tower"]) => {
      if (state.isHost) return;
      handleConfirmSellTower(data);
      Multiplayer.updateUI();
    });

    // Wave start synchronization
    s.on("start_wave_sync", (data: any) => {
      if (!state.isWaveActive) {
        startWaveCallback(data);
      }
    });

    // Lives synchronization
    s.on("sync_lives", (lives: number) => {
      if (lives < state.lives && !state.godMode) {
        state.screenDamageEffect = 30; // Start pulse
      }
      state.lives = lives;
      Multiplayer.updateUI();
    });

    // Gold synchronization
    s.on("sync_gold", (playerGolds: number[]) => {
      state.playerGolds = playerGolds;
      if (Multiplayer.lastReceivedState) {
        Multiplayer.lastReceivedState.playerGolds = [...playerGolds];
      }
      if (
        Multiplayer.myPlayerIndex !== undefined &&
        state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
      ) {
        state.gold = state.playerGolds[Multiplayer.myPlayerIndex];
      }
      Multiplayer.updateUI();
    });

    // Player slots update
    s.on(
      "player_slots_update",
      (data: { playerSlots: Array<string | null>; playerGolds: number[]; hostId?: string }) => {
        const oldSlots = [...state.playerSlots];

        state.playerSlots = data.playerSlots;
        state.playerGolds = data.playerGolds;
        if (Multiplayer.lastReceivedState) {
          Multiplayer.lastReceivedState.playerSlots = [...data.playerSlots];
          Multiplayer.lastReceivedState.playerGolds = [...data.playerGolds];
        }

        handlePlayerDisconnectReassignment(oldSlots, data.playerSlots);

        if (data.hostId !== undefined) {
          if (!state.isHost) {
            setWebRTCRole(state.isHost, data.hostId || null);
          }
        }

        const idx = state.playerSlots.indexOf(s.id || "");
        if (idx !== -1) {
          Multiplayer.myPlayerIndex = idx;
        }

        if (
          Multiplayer.myPlayerIndex !== undefined &&
          state.playerGolds[Multiplayer.myPlayerIndex] !== undefined
        ) {
          state.gold = state.playerGolds[Multiplayer.myPlayerIndex];
        }

        Multiplayer.lastPlayerCount = state.playerSlots.filter((id) => id !== null).length;

        // Force redraw of towers to update neon colors immediately
        for (const t of state.towers) {
          if (t.drawOwnerGlow) {
            t.drawOwnerGlow();
          }
        }

        (Multiplayer as any).recalculateRelocationState();
        if (state.isHost) {
          Multiplayer.syncNow();
        }

        Multiplayer.updateUI();
      }
    );

    // Host ended wave notification
    s.on("host_ended_wave", () => {
      showGameNotification(
        "info",
        "🌊 WELLE BEENDET",
        "Der Host hat die aktuelle Welle sofort beendet."
      );
    });
  } catch (err) {
    console.error("Error binding socket events. Multiplayer disabled.", err);
    setSocket(null); // Disable multiplayer if events cannot be bound
    cleanupAllWebRTC();
  }
}
