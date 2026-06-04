/*
 * @file: backend\src\server.ts
 * @purpose: Authoritative Headless-Host coordinating Express & Socket.io server using Puppeteer to run secure, background-safe Coop game simulations.
 * @dependencies: express, http, socket.io, path, cookie-parser, pg-promise
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Änderung der Funktionalität MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
 * @last_update: 2026-06-04 / v1.12.0 - Refactored and modularized server.ts code.
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

// REST APIs
app.use('/api', authRouter);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use('/api', createGameRouter(io));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Initialize WebSocket setup
setupSockets(io);

console.log("Geometry TD Coop-Server läuft auf Port 3000...");

server.listen(3000, async () => {
  console.log("Server lauscht auf http://localhost:3000");
  
  try {
    await initDatabaseSchema();
  } catch (err) {
    console.error("Schwerwiegender Fehler beim Initialisieren der Datenbank:", err);
  }
  
  // Periodischen Health-Check alle 30 Sekunden starten
  setInterval(() => {
    runHeadlessHealthCheck().catch(err => {
      console.error("Fehler im periodischen Headless-Health-Check:", err);
    });
  }, 30000);
});
