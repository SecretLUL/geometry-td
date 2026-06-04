import { Server } from 'socket.io';
import { RoomState } from './types';

export const roomStates: Record<string, RoomState> = {};
export const roomJoinLocks = new Set<string>();
export const missionRooms = ["The Spiral", "The ZigZag", "Quantum Bypass"];

export const FRONTEND_URL = process.env.FRONTEND_URL || "http://gtd-frontend-dev:5173";

export const ICE_SERVERS = process.env.ICE_SERVERS
  ? JSON.parse(process.env.ICE_SERVERS)
  : [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

export function initRoomState(roomId: string, mapName: string, mode: 'singleplayer' | 'public' | 'private') {
  if (!roomStates[roomId]) {
    roomStates[roomId] = {
      hostId: null,
      headlessSocketId: null,
      towers: [],
      wave: 1,
      isPaused: false,
      activeEnemies: [],
      enemiesToSpawn: 0,
      spawnCooldown: 0,
      enemyPool: [],
      isWaveActive: false,
      gameSpeed: 1.5,
      godModeActive: false,
      infiniteGoldActive: false,
      waveModified: false,
      benchmarkActive: false,
      lives: 20,
      gold: 250,
      playerCount: 0,
      sockets: new Set<string>(),
      hostTileSize: 40,
      autoStartActive: false,
      currentTick: 0,
      lastReceivedState: null,
      mapName,
      mode,
      roomId
    };
  }
}

export function getMissionStats(): Record<string, number> {
  const stats: Record<string, number> = {};
  missionRooms.forEach(room => {
    stats[room] = 0;
  });
  for (const roomId in roomStates) {
    const room = roomStates[roomId];
    if (room.mode === 'public' && stats[room.mapName] !== undefined) {
      stats[room.mapName] += room.playerCount;
    }
  }
  return stats;
}

export function getTotalOnlinePlayers(io: Server, disconnectingSocketId?: string): number {
  let count = 0;
  for (const [id, socket] of io.sockets.sockets) {
    if (id === disconnectingSocketId) continue;
    if (!(socket as any).isHeadless && socket.connected) {
      count++;
    }
  }
  return count;
}
