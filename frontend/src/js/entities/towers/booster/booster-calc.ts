/*
 * @file: frontend/src/js/entities/towers/booster/booster-calc.ts
 * @purpose: Calculations for tower stat boosting from nearby Booster Towers.
 * @dependencies: config, state, utils, types
 * @last_update: 2026-07-01 / Refactored booster calculations to booster/booster-calc.ts
 */
import { Config, TowerData } from "../../../core/config";
import { state } from "../../../core/state";
import { getDistanceSq } from "../../../core/utils";
import type { Tower as ITower } from "../../../types";

/**
 * Recalculates booster buffs for all towers in the game state.
 */
export function recalculateAllBoosts(): void {
  if (!state.towers) return;
  for (let i = 0; i < state.towers.length; i++) {
    recalculateBoosts(state.towers[i]);
  }
}

/**
 * Calculates and updates booster/buff multipliers for a specific tower.
 * @param tower The tower instance to recalculate boosts for.
 */
export function recalculateBoosts(tower: ITower): void {
  let rangeMultiplier = 1;
  let damageMultiplier = 1;
  let fireRateMultiplier = 1;
  let isBoosted = false;
  tower.visualBooster = null;

  if (tower.type !== "Booster" && state.towers) {
    for (let i = 0; i < state.towers.length; i++) {
      const t = state.towers[i];
      if (
        t.type === "Booster" &&
        t !== tower &&
        (t.constructionTimer === undefined || t.constructionTimer <= 0)
      ) {
        const distSq = getDistanceSq(tower.x, tower.y, t.x, t.y);
        const boosterRange = t.range;
        if (distSq <= boosterRange * boosterRange) {
          isBoosted = true;
          if (!tower.visualBooster) {
            tower.visualBooster = t;
          }

          // Range multiplier
          if (t.specialization === "amplitude") {
            const spec = TowerData["Booster"].specializations["amplitude"];
            const rangeBoost = t.masteryUnlocked
              ? spec.values!.masteryRangeBoost
              : spec.values!.normalRangeBoost;
            rangeMultiplier += rangeBoost;
          } else {
            rangeMultiplier += 0.1; // +10% base range buff
          }

          // Damage multiplier
          if (t.specialization === "amplitude") {
            const spec = TowerData["Booster"].specializations["amplitude"];
            const dmgBoost = t.masteryUnlocked
              ? spec.values!.masteryDmgBoost
              : spec.values!.normalDmgBoost;
            damageMultiplier += dmgBoost;
          } else {
            damageMultiplier += 0.15; // +15% base damage buff
          }

          // Fire rate multiplier
          if (t.specialization === "frequency") {
            const spec = TowerData["Booster"].specializations["frequency"];
            const speedBoost = t.masteryUnlocked
              ? spec.values!.masteryBoost
              : spec.values!.normalBoost;
            fireRateMultiplier += speedBoost;
          }
        }
      }
    }
  }

  tower.cachedRange = tower.range * rangeMultiplier;
  tower.cachedBoosterDamageMult = damageMultiplier;
  tower.cachedFireRate = Math.max(
    Config.TOWER_MIN_FIRE_RATE,
    Math.round(tower.fireRate / fireRateMultiplier)
  );
  tower.cachedIsBoosted = isBoosted;
}
