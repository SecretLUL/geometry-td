import { Server } from 'socket.io';
import { db } from './db';
import {
  roomStates,
  roomJoinLocks,
  ICE_SERVERS,
  getMissionStats,
  getTotalOnlinePlayers,
  initRoomState
} from './state';
import { spawnHeadlessHost, stopHeadlessHost, activeBrowsers } from './headless';
import {
  JoinMissionSchema,
  RequestPlaceTowerSchema,
  RequestUpgradeTowerSchema,
  RequestSellTowerSchema,
  ConfirmPlaceTowerSchema,
  RejectPlaceTowerSchema,
  ConfirmUpgradeTowerSchema,
  ConfirmSellTowerSchema,
  SyncTowersSchema,
  RequestWaveStartSchema,
  TogglePauseSchema,
  ChangeSpeedSchema,
  ToggleAutoSchema,
  ToggleModSchema,
  SyncLivesSchema,
  SyncGoldSchema,
  SyncGameStateSchema,
  WebRTCSignalSchema
} from './schemas';
import {
  CustomSocket,
  RoomTowerState,
  SyncFullGameStatePayload,
  SyncDeltaGameStatePayload,
  SyncEnemyState
} from './types';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth';

async function updateRoomHighscores(roomId: string, io: Server) {
  const state = roomStates[roomId];
  if (!state) return;
  
  if (state.godModeActive || state.infiniteGoldActive || state.waveModified || state.benchmarkActive) {
    return;
  }
  
  const currentWave = state.wave;
  if (currentWave <= 1) return;
  
  for (const socketId of state.sockets) {
    const s = io.sockets.sockets.get(socketId) as CustomSocket;
    if (s && s.user) {
      try {
        await db.none(
          `INSERT INTO progress (user_id, highest_wave, highest_wave_map) 
           VALUES ($1, $2, $3) 
           ON CONFLICT (user_id) 
           DO UPDATE SET 
             highest_wave_map = CASE WHEN EXCLUDED.highest_wave > progress.highest_wave THEN EXCLUDED.highest_wave_map ELSE progress.highest_wave_map END,
             highest_wave = GREATEST(progress.highest_wave, EXCLUDED.highest_wave), 
             updated_at = NOW()`,
          [s.user.id, currentWave, state.mapName]
        );
      } catch (err) {
        console.error(`[DATABASE] Error saving highscore for user ${s.user.username}:`, err);
      }
    }
  }
}

export function setupSockets(io: Server) {
  io.use((socket: any, next) => {
    const cookieHeader = socket.handshake.headers.cookie;
    if (cookieHeader) {
      const cookies = Object.fromEntries(
        cookieHeader.split(';').map((c: string) => {
          const parts = c.trim().split('=');
          return [parts[0], parts.slice(1).join('=')];
        })
      );
      const isProd = process.env.NODE_ENV === 'production';
      const cName = isProd ? '__Host-gtd-session' : 'gtd-session';
      const token = cookies[cName];
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
          socket.user = decoded;
          console.log(`[SOCKET] User authenticated: ${decoded.username} (${socket.id})`);
        } catch (err) {
          console.warn(`[SOCKET] Invalid token from connection ${socket.id}`);
        }
      }
    }
    next();
  });

  io.on("connection", (socket: CustomSocket) => {
    socket.isHeadless = socket.handshake.query.headless === 'true';
    console.log(`Player connected: ${socket.id}`);
    socket.emit("mission_stats_update", getMissionStats());
    io.emit("online_players_update", getTotalOnlinePlayers(io));

    socket.on("join_mission", async (rawPayload: unknown) => {
      const parsed = JoinMissionSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] join_mission with invalid payload:`, rawPayload);
        return;
      }

      let mapName: string;
      let mode: 'singleplayer' | 'public' | 'private' = 'public';
      let roomId: string | undefined;
      let action: string | undefined;

      if (typeof parsed.data === 'string') {
        mapName = parsed.data;
      } else {
        mapName = parsed.data.mapName;
        mode = (parsed.data.mode as any) || 'public';
        roomId = parsed.data.roomId;
        action = parsed.data.action;
      }

      const isHeadless = socket.handshake.query.headless === 'true';
      socket.isHeadless = isHeadless;
      
      if (isHeadless) {
        const queryRoomId = socket.handshake.query.roomId as string;
        if (queryRoomId) {
          roomId = queryRoomId;
        }
      }

      let finalRoomId = roomId;

      if (mode === 'singleplayer') {
        finalRoomId = `single-${socket.id}`;
      } else if (mode === 'public') {
        if (!finalRoomId) {
          finalRoomId = Object.keys(roomStates).find(rid => {
            const r = roomStates[rid];
            return r.mapName === mapName && r.mode === 'public' && r.playerCount < 4;
          });

          if (!finalRoomId) {
            finalRoomId = `pub-${Math.random().toString(36).substring(2, 10)}`;
          }
        }
      } else if (mode === 'private') {
        if (action === 'create' || !finalRoomId) {
          let code = '';
          const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
          do {
            code = '';
            for (let i = 0; i < 4; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
          } while (roomStates[code]);
          finalRoomId = code;
        } else {
          finalRoomId = finalRoomId.toUpperCase();
          const targetRoom = roomStates[finalRoomId];
          if (!targetRoom) {
            socket.emit('room_error', 'The requested private room does not exist or has expired.');
            return;
          }
          if (targetRoom.playerCount >= 4) {
            socket.emit('room_error', 'The private room is already full (maximum 4 players).');
            return;
          }
          mapName = targetRoom.mapName;
        }
      }

      if (!finalRoomId) {
        socket.emit('room_error', 'Failed to determine room ID.');
        return;
      }

      while (roomJoinLocks.has(finalRoomId)) {
        await new Promise(resolve => setTimeout(resolve, 5));
      }
      roomJoinLocks.add(finalRoomId);

      try {
        initRoomState(finalRoomId, mapName, mode);
        const state = roomStates[finalRoomId];

        state.sockets.add(socket.id);

        const isDevEnv = process.env.NODE_ENV === 'development';
        const wantHost = socket.handshake.query.wantHost === 'true';
        const shouldBeHost = isHeadless || (mode === 'singleplayer') || (isDevEnv && wantHost && !state.hostId) || (!state.hostId);

        if (shouldBeHost) {
          if (isHeadless) {
            console.log(`[HEADLESS] Headless host socket connected for room ${finalRoomId} (${mapName}): ${socket.id}`);
            state.headlessSocketId = socket.id;
          } else {
            console.log(`[DEV-HOST] Human player ${socket.id} joined room ${finalRoomId} (${mapName}) as HOST.`);
          }
          state.hostId = socket.id;
          socket.emit("role_assigned", { isHost: true, iceServers: ICE_SERVERS });
        } else {
          console.log(`[NETWORK] Human player ${socket.id} joined room ${finalRoomId} (${mapName}) as CLIENT.`);

          if (mode !== 'singleplayer' && !state.hostId && (!activeBrowsers[finalRoomId] || activeBrowsers[finalRoomId].status === 'failed')) {
            spawnHeadlessHost(finalRoomId, mapName).catch(err => {
              console.error("Async spawnHeadlessHost failed:", err);
            });
          }

          socket.emit("role_assigned", { isHost: false, iceServers: ICE_SERVERS });
        }

        let humanCount = 0;
        for (const sid of state.sockets) {
          const s = io.sockets.sockets.get(sid) as CustomSocket;
          if (s && !s.isHeadless) {
            humanCount++;
          }
        }
        state.playerCount = humanCount;

        io.emit("mission_stats_update", getMissionStats());

        await socket.join(finalRoomId);
        socket.mission = finalRoomId;

        io.to(finalRoomId).emit("player_count_update", state.playerCount);

        const stateToSend = { ...state, sockets: Array.from(state.sockets) };
        socket.emit("full_game_state", stateToSend);
        console.log(`Player ${socket.id} joined room ${finalRoomId}. (Size: ${state.playerCount})`);
      } finally {
        roomJoinLocks.delete(finalRoomId);
      }
    });

    socket.on("ready_to_play", () => {
      socket.emit("sync_complete");
    });

    const relay = (event: string) => {
      socket.on(event, (data: any) => {
        if (socket.mission) {
          socket.to(socket.mission).emit(event, data);
        }
      });
    };

    socket.on("request_place_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = RequestPlaceTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] request_place_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      const state = roomStates[socket.mission];
      data.tick = state.currentTick || 0;
      data.timestamp = Date.now();
      if (state.hostId) {
        io.to(state.hostId).emit("request_place_tower", data);
      }
    });

    socket.on("request_upgrade_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = RequestUpgradeTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] request_upgrade_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      const state = roomStates[socket.mission];
      data.tick = state.currentTick || 0;
      data.timestamp = Date.now();
      if (state.hostId) {
        io.to(state.hostId).emit("request_upgrade_tower", data);
      }
    });

    socket.on("request_sell_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = RequestSellTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] request_sell_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      const state = roomStates[socket.mission];
      data.tick = state.currentTick || 0;
      data.timestamp = Date.now();
      if (state.hostId) {
        io.to(state.hostId).emit("request_sell_tower", data);
      }
    });

    socket.on("confirm_place_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = ConfirmPlaceTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] confirm_place_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      roomStates[socket.mission].towers.push(data);
      socket.to(socket.mission).emit("confirm_place_tower", data);
    });

    socket.on("reject_place_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = RejectPlaceTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] reject_place_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      socket.to(socket.mission).emit("reject_place_tower", data);
    });

    socket.on("confirm_upgrade_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = ConfirmUpgradeTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] confirm_upgrade_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      const tower = roomStates[socket.mission].towers.find((t: RoomTowerState) => t.col === data.col && t.row === data.row);
      if (tower) {
        if (data.specId) {
          tower.specId = data.specId;
        }
        if (data.level) {
          tower.level = data.level;
        } else {
          tower.level = (tower.level || 1) + 1;
        }
      }
      socket.to(socket.mission).emit("confirm_upgrade_tower", data);
    });

    socket.on("confirm_sell_tower", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = ConfirmSellTowerSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] confirm_sell_tower von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      roomStates[socket.mission].towers = roomStates[socket.mission].towers.filter((t: RoomTowerState) => !(t.col === data.col && t.row === data.row));
      socket.to(socket.mission).emit("confirm_sell_tower", data);
    });

    socket.on("sync_towers", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = SyncTowersSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] sync_towers von ${socket.id}:`, parsed.error.format());
        return;
      }
      const towersList = parsed.data;
      roomStates[socket.mission].towers = towersList;
      socket.to(socket.mission).emit("sync_towers", towersList);
    });

    socket.on("request_wave_start", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = RequestWaveStartSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] request_wave_start von ${socket.id}:`, parsed.error.format());
        return;
      }
      let data = parsed.data;
      const state = roomStates[socket.mission];
      
      if (typeof data !== 'object') {
        data = { wave: data };
      }
      
      state.wave = data.wave;
      data.tick = state.currentTick || 0;
      data.timestamp = Date.now();
      
      updateRoomHighscores(socket.mission, io).catch(err => {
        console.error("[DATABASE] Error during async highscore update for room:", err);
      });
      
      console.log(`Wave ${state.wave} started in ${socket.mission} (requested by ${socket.id})`);
      io.to(socket.mission).emit("start_wave_sync", data);
    });

    socket.on("toggle_pause", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = TogglePauseSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] toggle_pause von ${socket.id}:`, parsed.error.format());
        return;
      }
      const pausedState = parsed.data;
      roomStates[socket.mission].isPaused = pausedState;
      socket.to(socket.mission).emit("toggle_pause", pausedState);
    });

    socket.on("change_speed", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = ChangeSpeedSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] change_speed von ${socket.id}:`, parsed.error.format());
        return;
      }
      const speed = parsed.data;
      roomStates[socket.mission].gameSpeed = speed;
      socket.to(socket.mission).emit("change_speed", speed);
    });

    socket.on("toggle_auto", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = ToggleAutoSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] toggle_auto von ${socket.id}:`, parsed.error.format());
        return;
      }
      const isActive = parsed.data;
      roomStates[socket.mission].autoStartActive = isActive;
      socket.to(socket.mission).emit("toggle_auto", isActive);
    });

    socket.on("toggle_mod", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = ToggleModSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] toggle_mod von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      if (data.mod === 'godMode') roomStates[socket.mission].godModeActive = data.value;
      if (data.mod === 'infiniteGold') roomStates[socket.mission].infiniteGoldActive = data.value;
      if (data.mod === 'waveModified') roomStates[socket.mission].waveModified = data.value;
      if (data.mod === 'benchmarkActive') roomStates[socket.mission].benchmarkActive = data.value;
      socket.to(socket.mission).emit("toggle_mod", data);
    });

    socket.on("sync_game_state", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const state = roomStates[socket.mission];

      if (state.hostId !== socket.id) return;

      const parsed = SyncGameStateSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] sync_game_state von ${socket.id}:`, parsed.error.format());
        return;
      }
      const payload = parsed.data;

      if (payload.fullSync) {
          state.lastReceivedState = payload.state as unknown as SyncFullGameStatePayload;
          state.currentTick = payload.state.tick;
          Object.assign(state, payload.state);
      } else if (payload.delta) {
          const delta = payload.state as unknown as SyncDeltaGameStatePayload;
          state.currentTick = delta.tick;
          if (!state.lastReceivedState) {
              state.lastReceivedState = {
                  hostTileSize: state.hostTileSize || 40,
                  activeEnemies: [],
                  enemiesToSpawn: state.enemiesToSpawn || 0,
                  spawnCooldown: state.spawnCooldown || 0,
                  enemyPool: state.enemyPool || [],
                  isWaveActive: state.isWaveActive || false,
                  autoStartActive: state.autoStartActive || false,
                  wave: state.wave || 1,
                  lives: state.lives || 20,
                  gold: state.gold || 250,
                  screenDamageEffect: 0,
                  benchmarkActive: state.benchmarkActive || false
              };
          }
          
          const lastState = state.lastReceivedState;

          const existingMap = new Map<number, SyncEnemyState>();
          for (let e of lastState.activeEnemies) {
              existingMap.set(e.id, e);
          }
          const enemyDelta = (delta.enemyDelta || []) as any[];
          for (let d of enemyDelta) {
              let existing = existingMap.get(d.id);
              if (existing) Object.assign(existing, d);
              else lastState.activeEnemies.push(d as SyncEnemyState);
          }
          const deletedEnemyIds = delta.deletedEnemyIds;
          if (deletedEnemyIds) {
              lastState.activeEnemies = lastState.activeEnemies.filter((e: SyncEnemyState) => !deletedEnemyIds.includes(e.id));
          }
          for (let key in delta) {
              if (key !== 'enemyDelta' && key !== 'deletedEnemyIds' && key !== 'tick' && key !== 'timestamp') {
                  (lastState as any)[key] = (delta as any)[key];
                  state[key] = (delta as any)[key];
              }
          }
          state.activeEnemies = lastState.activeEnemies;
      }

      socket.to(socket.mission).emit("sync_game_state", payload);
    });

    socket.on("sync_lives", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = SyncLivesSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] sync_lives von ${socket.id}:`, parsed.error.format());
        return;
      }
      const lives = parsed.data;
      roomStates[socket.mission].lives = lives;
      socket.to(socket.mission).emit("sync_lives", lives);
    });

    socket.on("sync_gold", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = SyncGoldSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] sync_gold von ${socket.id}:`, parsed.error.format());
        return;
      }
      const gold = parsed.data;
      roomStates[socket.mission].gold = gold;
      socket.to(socket.mission).emit("sync_gold", gold);
    });

    relay("enemy_leaked");
    relay("host_ended_wave");

    socket.on("webrtc_signal", (rawPayload: unknown) => {
      if (!socket.mission) return;
      const parsed = WebRTCSignalSchema.safeParse(rawPayload);
      if (!parsed.success) {
        console.warn(`[VALIDATION FAILED] webrtc_signal von ${socket.id}:`, parsed.error.format());
        return;
      }
      const data = parsed.data;
      if (data.targetId) {
        io.to(data.targetId).emit("webrtc_signal", {
          senderId: socket.id,
          signal: data.signal
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Player disconnected: ${socket.id}`);
      if (socket.mission && roomStates[socket.mission]) {
        const state = roomStates[socket.mission];

        state.sockets.delete(socket.id);

        if (state.hostId === socket.id) {
          console.log(`[HOST] Host ${socket.id} disconnected.`);
          state.hostId = null;
        }

        if (socket.isHeadless) {
          console.log(`[HEADLESS] Headless host disconnected for room ${socket.mission}`);
          state.headlessSocketId = null;
        } else {
          let humanCount = 0;
          for (const sid of state.sockets) {
            const s = io.sockets.sockets.get(sid) as CustomSocket;
            if (s && !s.isHeadless) {
              humanCount++;
            }
          }
          state.playerCount = humanCount;
          io.to(socket.mission).emit("player_count_update", state.playerCount);

          if (state.playerCount === 0) {
            console.log(`[NETWORK] No players remaining in ${socket.mission}. Stopping headless host.`);
            stopHeadlessHost(socket.mission).catch(err => {
              console.error("Async stopHeadlessHost failed:", err);
            });
            delete roomStates[socket.mission];
          }
        }
      }
      io.emit("mission_stats_update", getMissionStats());
      io.emit("online_players_update", getTotalOnlinePlayers(io, socket.id));
    });
  });
}
