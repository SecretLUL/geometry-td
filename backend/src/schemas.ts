/*
 * @file: backend\src\schemas.ts
 * @purpose: Strict runtime schema validation schemas using Zod for all incoming WebSocket payloads to prevent data corruption and DoS.
 * @dependencies: zod
 */
import { z } from 'zod';

// 1. Join lobby validation
export const JoinMissionSchema = z.string().min(1).max(100);

// 2. Tower Actions - Requests (Client to Host)
export const RequestPlaceTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  type: z.string().min(1).max(50),
  cost: z.number().nonnegative().optional(),
}).passthrough();

export const RequestUpgradeTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  cost: z.number().nonnegative().optional(),
}).passthrough();

export const RequestSellTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  goldEarned: z.number().nonnegative().optional(),
}).passthrough();

// 3. Tower Actions - Confirms (Host to all clients)
export const ConfirmPlaceTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  type: z.string().min(1).max(50),
}).passthrough();

export const RejectPlaceTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
}).passthrough();

export const ConfirmUpgradeTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
  specId: z.string().min(1).max(50).optional(),
  level: z.number().int().positive().optional(),
}).passthrough();

export const ConfirmSellTowerSchema = z.object({
  col: z.number().int().nonnegative(),
  row: z.number().int().nonnegative(),
}).passthrough();

export const SyncTowersSchema = z.array(
  z.object({
    col: z.number().int().nonnegative(),
    row: z.number().int().nonnegative(),
    type: z.string().min(1).max(50),
  }).passthrough()
);

// 4. Wave & Game State Actions
export const RequestWaveStartSchema = z.union([
  z.number().int().positive(),
  z.object({
    wave: z.number().int().positive(),
  }).passthrough()
]);

export const TogglePauseSchema = z.boolean();

export const ChangeSpeedSchema = z.number().positive().max(10);

export const ToggleAutoSchema = z.boolean();

export const ToggleModSchema = z.object({
  mod: z.enum(['godMode', 'infiniteGold', 'waveModified', 'benchmarkActive']),
  value: z.boolean(),
});

export const SyncLivesSchema = z.number().int().nonnegative().max(10000);

export const SyncGoldSchema = z.number().nonnegative().max(100000000);

// 5. Game State Synchronization (Host authoritative updates)
export const SyncGameStateSchema = z.object({
  fullSync: z.boolean().optional(),
  delta: z.boolean().optional(),
  state: z.object({
    tick: z.number().int().nonnegative(),
    enemyDelta: z.array(z.any()).optional(),
    deletedEnemyIds: z.array(z.any()).optional(),
  }).passthrough(),
}).passthrough();

// 6. WebRTC Signaling Relay
export const WebRTCSignalSchema = z.object({
  targetId: z.string().min(1).max(100),
  signal: z.any(),
});
