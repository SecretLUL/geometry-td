/*
 * @file: frontend/src/js/entities/enemies/index.ts
 * @purpose: Entrypoint and re-exports for the modular enemy entities system.
 * @dependencies: base, factory, basic, special, bosses, event
 * @last_update: 2026-06-01 / v1.1.0 - Exported AcceleratorEnemy.
 */
export { BaseEnemy } from "./base";
export { EnemyFactory } from "./factory";
export { NormalEnemy, ScoutEnemy, BruiserEnemy } from "./types/basic";
export { RegrowerEnemy, ShieldedEnemy, SwarmEnemy, AcceleratorEnemy } from "./types/special";
export {
  BossEnemy,
  DefragmenterEnemy,
  DefragmenterFragmentEnemy,
  DefragmenterSubfragmentEnemy,
} from "./types/bosses";
export { CollectorEnemy, FortressEnemy, SplinterEnemy, SplinterFragmentEnemy } from "./types/event";
