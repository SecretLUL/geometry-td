/*
 * @file: frontend/src/js/core/game/helpers.ts
 * @purpose: Common utility helper functions for enemies set management, defragmenter checks,
 *           and spatial hashing grid pre-population.
 * @dependencies: state, types
 */
import { state } from "../state";
import { Enemy } from "../../types";

export function updateEnemiesSet(): void {
  state.enemiesSet.clear();
  const len = state.enemies.length;
  for (let i = 0; i < len; i++) {
    state.enemiesSet.add(state.enemies[i]);
  }
}

export function hasActiveDefragmenter(excludeEnemy: Enemy): boolean {
  const len = state.enemies.length;
  for (let i = 0; i < len; i++) {
    const e = state.enemies[i];
    if (
      e !== excludeEnemy &&
      (e.typeName === "Defragmenter" ||
        e.typeName === "DefragmenterFragment" ||
        e.typeName === "DefragmenterSubfragment")
    ) {
      return true;
    }
  }
  return false;
}

export function prePopulateEnemyGrid(): void {
  const GRID_WIDTH = 50;
  const GRID_HEIGHT = 50;

  if (!state.enemyGrid || !state.activeGridIndices) {
    state.enemyGrid = Array.from({ length: GRID_WIDTH * GRID_HEIGHT }, () => []);
    state.activeGridIndices = [];
  } else {
    for (let i = 0; i < state.enemyGrid.length; i++) {
      state.enemyGrid[i].length = 0;
    }
    state.activeGridIndices.length = 0;
  }
}
