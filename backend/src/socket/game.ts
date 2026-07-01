import { Server } from 'socket.io';
import { roomStates } from '../state';
import {
  CustomSocket,
  SyncFullGameStatePayload,
  SyncDeltaGameStatePayload,
  SyncEnemyState
} from '../types';
import {
  RequestWaveStartSchema,
  TogglePauseSchema,
  ChangeSpeedSchema,
  ToggleAutoSchema,
  ToggleModSchema,
  SyncGameStateSchema,
  SyncLivesSchema,
  SyncGoldSchema
} from '../schemas';
import { updateRoomHighscores } from './utils';

export function registerGameHandlers(io: Server, socket: CustomSocket) {
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
    roomStates[socket.mission].playerGolds = gold;
    if (gold && gold.length > 0) {
      roomStates[socket.mission].gold = gold[0];
    }
    socket.to(socket.mission).emit("sync_gold", gold);
  });
}
