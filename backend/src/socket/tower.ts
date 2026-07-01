import { Server } from "socket.io";
import { roomStates } from "../state";
import { CustomSocket, RoomTowerState } from "../types";
import {
  RequestPlaceTowerSchema,
  RequestUpgradeTowerSchema,
  RequestSellTowerSchema,
  RequestRelocateTowerSchema,
  ConfirmPlaceTowerSchema,
  RejectPlaceTowerSchema,
  ConfirmUpgradeTowerSchema,
  ConfirmSellTowerSchema,
  SyncTowersSchema,
} from "../schemas";

export function registerTowerHandlers(io: Server, socket: CustomSocket) {
  socket.on("request_place_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestPlaceTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `[VALIDATION FAILED] request_place_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    data.playerId = socket.id;
    if (state.hostId) {
      io.to(state.hostId).emit("request_place_tower", data);
    }
  });

  socket.on("request_upgrade_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestUpgradeTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `[VALIDATION FAILED] request_upgrade_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    data.playerId = socket.id;
    if (state.hostId) {
      io.to(state.hostId).emit("request_upgrade_tower", data);
    }
  });

  socket.on("request_sell_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestSellTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `[VALIDATION FAILED] request_sell_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    data.playerId = socket.id;
    if (state.hostId) {
      io.to(state.hostId).emit("request_sell_tower", data);
    }
  });

  socket.on("request_relocate_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = RequestRelocateTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `[VALIDATION FAILED] request_relocate_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data as any;
    const state = roomStates[socket.mission];
    data.tick = state.currentTick || 0;
    data.timestamp = Date.now();
    data.playerId = socket.id;
    if (state.hostId) {
      io.to(state.hostId).emit("request_relocate_tower", data);
    }
  });

  socket.on("confirm_place_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ConfirmPlaceTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `[VALIDATION FAILED] confirm_place_tower von ${socket.id}:`,
        parsed.error.format()
      );
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
      console.warn(
        `[VALIDATION FAILED] reject_place_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data;
    socket.to(socket.mission).emit("reject_place_tower", data);
  });

  socket.on("confirm_upgrade_tower", (rawPayload: unknown) => {
    if (!socket.mission) return;
    const parsed = ConfirmUpgradeTowerSchema.safeParse(rawPayload);
    if (!parsed.success) {
      console.warn(
        `[VALIDATION FAILED] confirm_upgrade_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data;
    const tower = roomStates[socket.mission].towers.find(
      (t: RoomTowerState) => t.col === data.col && t.row === data.row
    );
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
      console.warn(
        `[VALIDATION FAILED] confirm_sell_tower von ${socket.id}:`,
        parsed.error.format()
      );
      return;
    }
    const data = parsed.data;
    roomStates[socket.mission].towers = roomStates[socket.mission].towers.filter(
      (t: RoomTowerState) => !(t.col === data.col && t.row === data.row)
    );
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
}
