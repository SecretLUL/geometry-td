/*
 * @file: frontend/src/js/core/config.ts
 * @purpose: Facade re-exporting the modular configuration modules
 *           (base constants, enemy data, tower data, and game scaling/balancer logic).
 * @dependencies: ./config/base, ./config/enemies, ./config/towers, ./config/balancer
 * @last_update: 2026-07-01 / Refactored into a facade of modular config files.
 */

export { Config } from "./config/base";
export { EnemyData } from "./config/enemies";
export type { EnemyConfig } from "./config/enemies";
export { TowerData } from "./config/towers";
export type { TowerSpecConfig, TowerStatsConfig } from "./config/towers";
export { TowerBalancer, getTowerPurchaseCost } from "./config/balancer";
export { towerDatabase } from "./config/tower-database";
export type { TowerLevelStats } from "./config/tower-database";
