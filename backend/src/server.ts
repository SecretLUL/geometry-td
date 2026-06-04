/*
 * @file: backend/src/server.ts
 * @purpose: Entry point for the authoritative game server. Wires Express, Socket.IO,
 *           and the Puppeteer-based headless host into a single coordinated process.
 * @dependencies: express, http, socket.io, path, cookie-parser, pg-promise
 * @last_update: 2026-06-04 / v1.12.0 - Refactored and modularized server.ts.
 */
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import cookieParser from 'cookie-parser';
import { initDatabaseSchema } from './db';
import { authRouter } from './routes/auth';
import { createGameRouter } from './routes/game';
import { setupSockets } from './socket';
import { runHeadlessHealthCheck } from './headless';

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cookieParser());

// REST API routes
app.use('/api', authRouter);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use('/api', createGameRouter(io));

app.use(express.static(path.join(__dirname, '../../frontend')));

setupSockets(io);

console.log("Geometry TD Coop-Server listening on port 3000...");

server.listen(3000, async () => {
  console.log("Server listening on http://localhost:3000");
  
  try {
    await initDatabaseSchema();
  } catch (err) {
    console.error("Fatal error during database schema initialization:", err);
  }
  
  // Run a periodic health check every 30 seconds to detect and recover stale headless browsers
  setInterval(() => {
    runHeadlessHealthCheck().catch(err => {
      console.error("Error in periodic headless health check:", err);
    });
  }, 30000);
});
