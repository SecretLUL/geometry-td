/*
 * @file: frontend/src/js/core/config/balancer.ts
 * @purpose: Logic for calculating tower upgrade costs, damage scaling, range, fire rates, and purchase costs.
 * @dependencies: ../utils, ./base, ./towers
 * @last_update: 2026-07-01 / Refactored into a separate module.
 */

import { roundUpgradeCost } from "../utils";
import { Config } from "./base";
import { TowerData } from "./towers";

export const TowerBalancer = {
  /** Computes the upgrade cost for a given tower type and level. */
  getUpgradeCost(type: string, level: number, currentCost: number): number {
    const stats = TowerData[type];
    if (!stats) return currentCost * 2;

    const scale = stats.costScaling || Config.DEFAULT_COST_SCALING;
    let newCost = currentCost;
    if (level >= scale.thresholdLevel) {
      newCost = Math.floor(currentCost * scale.lateMultiplier);
    } else {
      newCost = currentCost * scale.earlyMultiplier;
    }
    return roundUpgradeCost(newCost);
  },

  /** Computes the damage value for a given level. */
  getDamageForLevel(type: string, level: number, baseDamage: number): number {
    const stats = TowerData[type];
    if (!stats) return baseDamage;

    if (type === "Bomb") {
      if (level === 19) return 4500;
      if (level === 20) return 13500;
      return baseDamage + (level - 1) * stats.damagePerLevel;
    }

    let dmg = baseDamage + level * stats.damagePerLevel;
    if (stats.damageLevelBonus) {
      dmg += level * stats.damageLevelBonus;
    }
    return dmg;
  },

  /** Computes the range value for a given level. */
  getRangeForLevel(type: string, baseRange: number): number {
    const stats = TowerData[type];
    if (!stats) return baseRange;
    return baseRange + stats.rangePerLevel;
  },

  /** Computes the fire rate value for a given level. */
  getFireRateForLevel(type: string, level: number, currentFireRate: number): number {
    const stats = TowerData[type];
    if (!stats) return currentFireRate;

    if (type === "Base") {
      const attackSpeed = 1.0 + (9.0 * (level - 1)) / (Config.TOWER_MAX_LEVEL - 1);
      return 60 / attackSpeed;
    } else if (type === "Bomb") {
      if (level === 19) {
        return 40.0;
      } else if (level === 20) {
        return 55.0;
      } else {
        return Math.max(Config.TOWER_MIN_FIRE_RATE, currentFireRate - stats.fireRateDecrease);
      }
    } else {
      return Math.max(Config.TOWER_MIN_FIRE_RATE, currentFireRate - stats.fireRateDecrease);
    }
  },
};

export function getTowerPurchaseCost(type: string, generatorCount: number): number {
  const stats = TowerData[type];
  if (!stats) return 0;
  if (type === "Generator") {
    return stats.baseCost + generatorCount * 300;
  }
  return stats.baseCost;
}
