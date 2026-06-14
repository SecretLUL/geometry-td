/*
 * @file: frontend/src/js/core/multiplayer/context.ts
 * @purpose: Provides the shared multiplayer context — socket.io client reference, sync intervals,
 *           tick state, and basic lobby synchronization logic.
 * @dependencies: types
 * @last_update: 2026-05-29 / v1.1.1 - Added emitHostEndedWave to IMultiplayer.
 */
import {
  TowerSpecialization,
  SyncFullGameStatePayload,
  SyncTowerState,
  TowerType,
} from "../../types";

export class CircularBuffer<T> {
  private buffer: T[];
  private capacity: number;
  private head: number = 0;
  private tail: number = 0;
  private isFull: boolean = false;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array<T>(capacity);
  }

  push(item: T): void {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    if (this.isFull) {
      this.head = (this.head + 1) % this.capacity;
    }
    if (this.tail === this.head) {
      this.isFull = true;
    }
  }

  get length(): number {
    if (this.isFull) return this.capacity;
    if (this.tail >= this.head) return this.tail - this.head;
    return this.capacity - this.head + this.tail;
  }

  get(index: number): T {
    if (index < 0 || index >= this.length) {
      throw new Error("Index out of bounds");
    }
    const actualIndex = (this.head + index) % this.capacity;
    return this.buffer[actualIndex];
  }

  clear(): void {
    this.head = 0;
    this.tail = 0;
    this.isFull = false;
    this.buffer.fill(undefined as unknown as T);
  }
}

export interface IMultiplayer {
  stateBuffer: CircularBuffer<{
    localTimestamp: number;
    hostTileSize: number;
    activeEnemies: Array<{
      id: number;
      typeName: string;
      wave: number;
      x: number;
      y: number;
      hp: number;
      maxHp: number;
      distanceTravelled: number;
      targetWaypointIndex: number;
      speed: number;
      shieldActive: boolean;
      swarmGroupId?: number;
    }>;
  }>;
  latestServerTimestamp: number;
  lastPlayerCount: number | null;
  syncInterval: ReturnType<typeof setInterval> | null;
  updateUI: () => void;
  currentTick: number;
  lastSyncState: SyncFullGameStatePayload | null;
  lastReceivedState: SyncFullGameStatePayload | null;
  activeMode?: "singleplayer" | "public" | "private";
  activeRoomId?: string;
  startWaveCallback?: (data?: any) => void;

  init(startWaveCallback: (data?: unknown) => void, updateUICallback: () => void): void;
  updatePlayerCountUI(count: number): void;

  processPlaceTower(type: TowerType, col: number, row: number): boolean;
  processUpgradeTower(
    col: number,
    row: number,
    specId?: TowerSpecialization | null,
    silent?: boolean
  ): boolean;
  processSellTower(col: number, row: number): boolean;

  emitSyncGameState(data: SyncFullGameStatePayload): void;
  syncNow(): void;
  emitChangeSpeed(speed: number): void;
  emitToggleMod(
    mod: "godMode" | "infiniteGold" | "waveModified" | "benchmarkActive",
    value: boolean
  ): void;
  emitTogglePause(isPaused: boolean): void;
  emitToggleAuto(isActive: boolean): void;
  emitSyncTowers(towersList: SyncTowerState[]): void;
  emitRequestPlaceTower(type: TowerType, col: number, row: number): void;
  emitRequestUpgradeTower(col: number, row: number, specId?: TowerSpecialization | null): void;
  emitRequestSellTower(col: number, row: number): void;
  emitRequestWaveStart(wave: number | { wave: number; pool?: string[] }): void;
  emitSyncLives(lives: number): void;
  emitSyncGold(gold: number): void;
  emitHostEndedWave(): void;
}

export interface SocketInstance {
  emit(ev: string, ...args: unknown[]): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(ev: string, listener: (...args: any[]) => void): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(ev: string, listener?: (...args: any[]) => void): this;
  id?: string;
  connected?: boolean;
}

export let socket: SocketInstance | null = null;
export function setSocket(s: SocketInstance | null) {
  socket = s;
}

export const Multiplayer = {
  stateBuffer: new CircularBuffer(20) as IMultiplayer["stateBuffer"],
  latestServerTimestamp: 0,
  lastPlayerCount: null as number | null,
  syncInterval: null as ReturnType<typeof setInterval> | null,
  updateUI: (() => {}) as () => void,
  currentTick: 0,
  lastSyncState: null as SyncFullGameStatePayload | null,
  lastReceivedState: null as SyncFullGameStatePayload | null,
} as IMultiplayer;
