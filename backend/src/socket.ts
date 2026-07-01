import { Server } from 'socket.io';
import { getMissionStats, getTotalOnlinePlayers } from './state';
import { WebRTCSignalSchema } from './schemas';
import { CustomSocket } from './types';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './auth';

import { registerRoomHandlers } from './socket/room';
import { registerTowerHandlers } from './socket/tower';
import { registerGameHandlers } from './socket/game';

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

    // Register modular event handlers
    registerRoomHandlers(io, socket);
    registerTowerHandlers(io, socket);
    registerGameHandlers(io, socket);

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
  });
}
