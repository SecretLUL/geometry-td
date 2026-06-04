/*
 * @file: frontend\src\js\entities\enemies\index.ts
 * @purpose: Entrypoint and re-exports for the modular enemy entities system.
 * @dependencies: base, factory, basic, special, bosses, event
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
 * @last_update: 2026-06-01 / v1.1.0 - Exported AcceleratorEnemy.
 */
export { BaseEnemy } from './base';
export { EnemyFactory } from './factory';
export { NormalEnemy, ScoutEnemy, BruiserEnemy } from './types/basic';
export { RegrowerEnemy, ShieldedEnemy, SwarmEnemy, AcceleratorEnemy } from './types/special';
export { BossEnemy, DefragmenterEnemy, DefragmenterFragmentEnemy, DefragmenterSubfragmentEnemy } from './types/bosses';
export { CollectorEnemy, FortressEnemy, SplinterEnemy, SplinterFragmentEnemy } from './types/event';
