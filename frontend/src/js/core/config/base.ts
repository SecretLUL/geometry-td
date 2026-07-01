/*
 * @file: frontend/src/js/core/config/base.ts
 * @purpose: Core game configuration, grid layout, starting resources, and wave HP formulas.
 * @last_update: 2026-07-01 / Refactored into a separate module.
 */

export const Config = {
  CANVAS_COLS: 16,
  CANVAS_ROWS: 16,
  TILE_SIZE: 50, // base tile size; recalculated at runtime by viewport scaling

  GAME_SPEEDS: {
    NORMAL: 1.5,
    FAST: 3.0,
    SUPER_FAST: 6.0,
  },

  STARTING_GOLD: 300,
  STARTING_LIVES: 20,

  TOWER_MAX_LEVEL: 20,
  TOWER_SPECIALIZATION_LEVEL: 10,
  TOWER_MASTERY_LEVEL: 20,

  TOWER_MIN_FIRE_RATE: 10,
  TOWER_FIRE_RATE_DECREASE: 10,
  PROJECTILE_SPEED: 15,

  // Tower cost scaling SSOT (Single Source of Truth)
  DEFAULT_COST_SCALING: {
    earlyMultiplier: 1.3,
    lateMultiplier: 1.3,
    thresholdLevel: 10,
  },

  // Enemy Parameters
  ENEMY_BASE_HP: 200,
  ENEMY_HP_MULTIPLIER: 1.15,
  ENEMY_REWARD_BASE: 12,
  ENEMY_REWARD_MULTIPLIER: 1.015, // lowered from 1.03 to prevent extreme gold scaling in later waves
  SWARM_CLUSTER_SIZE: 6,

  INTEREST_RATE: 0.0, // interest rate per wave (disabled, set to 0.0)
  DIFFICULTY_LINEAR_FACTOR: 1.0, // linear coefficient for wave health scaling (increased from 0.5)
  DIFFICULTY_QUADRATIC_FACTOR: 0.08, // quadratic coefficient for wave health scaling

  /** Computes the HP multiplier for a given wave using a linear-quadratic curve */
  getHpMultiplier(wave: number): number {
    return (
      1 +
      this.DIFFICULTY_LINEAR_FACTOR * (wave - 1) +
      this.DIFFICULTY_QUADRATIC_FACTOR * Math.pow(wave - 1, 2)
    );
  },

  // Wave Parameters
  SPAWN_RATE: 120,
  WAVE_BASE_ENEMIES: 3,
  WAVE_ENEMIES_MULTIPLIER: 0.35,
  WAVE_BONUS_BASE: 30,
  WAVE_BONUS_PER_WAVE: 6,

  // Derived (kept for backward compat, updated by viewport scaler)
  get CANVAS_WIDTH() {
    return this.TILE_SIZE * this.CANVAS_COLS;
  },
  get CANVAS_HEIGHT() {
    return this.TILE_SIZE * this.CANVAS_ROWS;
  },
};
