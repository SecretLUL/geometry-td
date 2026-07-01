import { Server } from "socket.io";
import {
  roomStates,
  roomJoinLocks,
  ICE_SERVERS,
  getMissionStats,
  getTotalOnlinePlayers,
  initRoomState,
} from "../state";
import { spawnHeadlessHost, stopHeadlessHost, activeBrowsers } from "../headless";
import { JoinMissionSchema } from "../schemas";
import { CustomSocket } from "../types";
import { recalculateStartingGold } from "./utils";

export function registerRoomHandlers(io: Server, socket: CustomSocket) {
  socket.on("join_mission", async (rawPayload: unknown) => {
    const parsed = JoinMissionSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(`[VALIDATION FAILED] join_mission with invalid payload:`, rawPayload);
      return;
    }

    let mapName: string;
    let mode: "singleplayer" | "public" | "private" = "public";
    let roomId: string | undefined;
    let action: string | undefined;

    if (typeof parsed.data === "string") {
      mapName = parsed.data;
    } else {
      mapName = parsed.data.mapName;
      mode = (parsed.data.mode as any) || "public";
      roomId = parsed.data.roomId;
      action = parsed.data.action;
    }

    const isHeadless = socket.handshake.query.headless === "true";
    socket.isHeadless = isHeadless;

    if (isHeadless) {
      const queryRoomId = socket.handshake.query.roomId as string;
      if (queryRoomId) {
        roomId = queryRoomId;
      }
    }

    let finalRoomId = roomId;

    if (mode === "singleplayer") {
      finalRoomId = `single-${socket.id}`;
    } else if (mode === "public") {
      if (!finalRoomId) {
        finalRoomId = Object.keys(roomStates).find((rid) => {
          const r = roomStates[rid];
          return r.mapName === mapName && r.mode === "public" && r.playerCount < 4;
        });

        if (!finalRoomId) {
          finalRoomId = `pub-${Math.random().toString(36).substring(2, 10)}`;
        }
      }
    } else if (mode === "private") {
      if (action === "create" || !finalRoomId) {
        let code = "";
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        do {
          code = "";
          for (let i = 0; i < 4; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        } while (roomStates[code]);
        finalRoomId = code;
      } else {
        finalRoomId = finalRoomId.toUpperCase();
        const targetRoom = roomStates[finalRoomId];
        if (!targetRoom) {
          socket.emit("room_error", "The requested private room does not exist or has expired.");
          return;
        }
        if (targetRoom.playerCount >= 4) {
          socket.emit("room_error", "The private room is already full (maximum 4 players).");
          return;
        }
        mapName = targetRoom.mapName;
      }
    }

    if (!finalRoomId) {
      socket.emit("room_error", "Failed to determine room ID.");
      return;
    }

    while (roomJoinLocks.has(finalRoomId)) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    roomJoinLocks.add(finalRoomId);

    try {
      initRoomState(finalRoomId, mapName, mode);
      const state = roomStates[finalRoomId];

      let assignedSlot = -1;
      if (!socket.isHeadless) {
        if (!state.playerSlots) {
          state.playerSlots = [null, null, null, null];
        }
        let idx = state.playerSlots.indexOf(socket.id);
        if (idx === -1) {
          idx = state.playerSlots.indexOf(null);
        }
        if (idx !== -1) {
          state.playerSlots[idx] = socket.id;
          assignedSlot = idx;
        }
        recalculateStartingGold(state);
      }

      state.sockets.add(socket.id);

      const isDevEnv = process.env.NODE_ENV === "development";
      const wantHost = socket.handshake.query.wantHost === "true";
      const shouldBeHost =
        isHeadless ||
        mode === "singleplayer" ||
        (isDevEnv && wantHost && !state.hostId) ||
        !state.hostId;

      if (shouldBeHost) {
        if (isHeadless) {
          console.log(
            `[HEADLESS] Headless host socket connected for room ${finalRoomId} (${mapName}): ${socket.id}`
          );
          state.headlessSocketId = socket.id;
        } else {
          console.log(
            `[DEV-HOST] Human player ${socket.id} joined room ${finalRoomId} (${mapName}) as HOST.`
          );
        }
        state.hostId = socket.id;
        socket.emit("role_assigned", {
          isHost: true,
          iceServers: ICE_SERVERS,
          playerIndex: assignedSlot,
        });
      } else {
        console.log(
          `[NETWORK] Human player ${socket.id} joined room ${finalRoomId} (${mapName}) as CLIENT.`
        );

        if (
          mode !== "singleplayer" &&
          !state.hostId &&
          (!activeBrowsers[finalRoomId] || activeBrowsers[finalRoomId].status === "failed")
        ) {
          spawnHeadlessHost(finalRoomId, mapName).catch((err) => {
            console.error("Async spawnHeadlessHost failed:", err);
          });
        }

        socket.emit("role_assigned", {
          isHost: false,
          iceServers: ICE_SERVERS,
          playerIndex: assignedSlot,
        });
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
      io.to(finalRoomId).emit("player_slots_update", {
        playerSlots: state.playerSlots,
        playerGolds: state.playerGolds,
        hostId: state.hostId,
      });

      const stateToSend = { ...state, sockets: Array.from(state.sockets) };
      socket.emit("full_game_state", stateToSend);
      console.log(`Player ${socket.id} joined room ${finalRoomId}. (Size: ${state.playerCount})`);
    } finally {
      roomJoinLocks.delete(finalRoomId);
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    if (socket.mission && roomStates[socket.mission]) {
      const state = roomStates[socket.mission];

      state.sockets.delete(socket.id);

      if (state.playerSlots) {
        const idx = state.playerSlots.indexOf(socket.id);
        if (idx !== -1) {
          const leavingGold = state.playerGolds ? state.playerGolds[idx] : 0;
          state.playerSlots[idx] = null;
          if (state.playerGolds) {
            state.playerGolds[idx] = 0;
          }

          // Distribute gold among remaining players
          const remainingCount = state.playerSlots.filter((id: any) => id !== null).length;
          if (remainingCount > 0 && leavingGold > 0 && state.playerGolds) {
            const share = Math.floor(leavingGold / remainingCount);
            const extra = leavingGold % remainingCount;

            let distributedExtra = false;
            for (let i = 0; i < 4; i++) {
              if (state.playerSlots[i] !== null) {
                state.playerGolds[i] += share;
                if (!distributedExtra) {
                  state.playerGolds[i] += extra;
                  distributedExtra = true;
                }
              }
            }
          }

          // Reassign towers in server cache
          let recipientIdx = -1;
          for (let k = 1; k <= 3; k++) {
            const targetIdx = (idx - k + 4) % 4;
            if (state.playerSlots[targetIdx] !== null) {
              recipientIdx = targetIdx;
              break;
            }
          }

          if (recipientIdx !== -1 && state.towers) {
            for (const t of state.towers) {
              if (t.ownerIndex === idx) {
                t.ownerIndex = recipientIdx;
              }
            }
          }
        }
      }

      if (state.hostId === socket.id) {
        console.log(`[HOST] Host ${socket.id} disconnected.`);
        state.hostId = null;

        // Assign a new host from the remaining active players
        if (state.playerSlots) {
          const nextHostSocketId = state.playerSlots.find((id: any) => id !== null);
          if (nextHostSocketId) {
            state.hostId = nextHostSocketId;
            const nextHostSocket = io.sockets.sockets.get(nextHostSocketId) as CustomSocket;
            if (nextHostSocket) {
              console.log(`[HOST-MIGRATION] Assigned new host: ${nextHostSocketId}`);
              const assignedSlot = state.playerSlots.indexOf(nextHostSocketId);
              nextHostSocket.emit("role_assigned", {
                isHost: true,
                iceServers: ICE_SERVERS,
                playerIndex: assignedSlot,
              });
            }
          }
        }
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

        if (state.wave === 1 && !state.isWaveActive) {
          recalculateStartingGold(state);
        }

        io.to(socket.mission).emit("player_count_update", state.playerCount);
        io.to(socket.mission).emit("player_slots_update", {
          playerSlots: state.playerSlots,
          playerGolds: state.playerGolds,
          hostId: state.hostId,
        });

        if (state.playerCount === 0) {
          console.log(
            `[NETWORK] No players remaining in ${socket.mission}. Stopping headless host.`
          );
          stopHeadlessHost(socket.mission).catch((err) => {
            console.error("Async stopHeadlessHost failed:", err);
          });
          delete roomStates[socket.mission];
        }
      }
    }
    io.emit("mission_stats_update", getMissionStats());
    io.emit("online_players_update", getTotalOnlinePlayers(io, socket.id));
  });
}
