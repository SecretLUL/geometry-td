import { Server } from "socket.io";
import { db } from "../db";
import { CustomSocket } from "../types";
import { roomStates } from "../state";

export function recalculateStartingGold(state: any) {
  if (state.wave > 1 || state.isWaveActive) return;
  const activeCount = state.playerSlots
    ? state.playerSlots.filter((id: any) => id !== null).length
    : 1;
  const splitGold = Math.floor(300 / Math.max(1, activeCount));
  if (!state.playerGolds) {
    state.playerGolds = [300, 300, 300, 300];
  }
  for (let i = 0; i < 4; i++) {
    if (state.playerSlots && state.playerSlots[i] !== null) {
      state.playerGolds[i] = splitGold;
    } else {
      state.playerGolds[i] = 0;
    }
  }
}

export async function updateRoomHighscores(roomId: string, io: Server) {
  const state = roomStates[roomId];
  if (!state) return;

  if (state.godModeActive || state.infiniteGoldActive || state.waveModified) {
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
