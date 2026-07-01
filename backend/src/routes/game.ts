import { Router } from "express";
import { Server } from "socket.io";
import { roomStates, getMissionStats, getTotalOnlinePlayers } from "../state";

export function createGameRouter(io: Server): Router {
  const router = Router();

  router.get("/mission_stats", (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.json(getMissionStats());
  });

  router.get("/online_players", (_req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.json({ total: getTotalOnlinePlayers(io) });
  });

  router.get("/room/:roomId", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
    const roomId = (req.params.roomId as string).toUpperCase();
    const room = roomStates[roomId];
    if (room && room.mode !== "singleplayer") {
      res.json({
        exists: true,
        mapName: room.mapName,
        playerCount: room.playerCount,
        mode: room.mode,
      });
    } else {
      res.json({ exists: false });
    }
  });

  return router;
}
