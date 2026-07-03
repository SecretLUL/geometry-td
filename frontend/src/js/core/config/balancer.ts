/*
 * @file: frontend/src/js/core/config/balancer.ts
 * @purpose: Logic for calculating tower upgrade costs, damage scaling, range, fire rates, and purchase costs from the lookup database.
 * @dependencies: ./tower-database, ./towers
 * @last_update: 2026-07-03 / Switched to purely data-driven lookup.
 */

import { TowerData } from "./towers";
import { towerDatabase, TowerLevelStats } from "./tower-database";

export const TowerBalancer = {
  /** Retrieves the stats object for a given tower type, level, and specialization. */
  getStats(type: string, level: number, specialization: string | null = null): TowerLevelStats {
    const entry = towerDatabase[type];
    if (!entry) {
      throw new Error(`Tower type ${type} not found in database`);
    }

    // Check if specialization exists and is active for this level (levels 10-20)
    let specToUse = specialization;
    if (level >= 10) {
      if (!specToUse || !entry.specializations[specToUse]) {
        // Fallback: use the first defined specialization as a base reference
        const specs = Object.keys(entry.specializations);
        if (specs.length > 0) {
          specToUse = specs[0];
        }
      }

      if (specToUse && entry.specializations[specToUse]) {
        const specStats = entry.specializations[specToUse][level];
        if (specStats) {
          return specStats;
        }
      }
    }

    const baseStats = entry.base[level];
    if (!baseStats) {
      throw new Error(`Stats for tower ${type} at level ${level} not found`);
    }
    return baseStats;
  },

  /** Computes the upgrade cost for a given tower type and level. */
  getUpgradeCost(
    type: string,
    level: number,
    currentCostOrSpecialization?: number | string | null
  ): number {
    const specialization =
      typeof currentCostOrSpecialization === "string" ? currentCostOrSpecialization : null;
    try {
      const stats = this.getStats(type, level, specialization);
      return stats.upgradeCost;
    } catch (e) {
      return 0;
    }
  },

  /** Computes the damage value for a given level. */
  getDamageForLevel(type: string, level: number, specialization: string | null = null): number {
    try {
      const stats = this.getStats(type, level, specialization);
      return stats.damage;
    } catch (e) {
      return 0;
    }
  },

  /** Computes the range value for a given level. */
  getRangeForLevel(type: string, level: number, specialization: string | null = null): number {
    try {
      const stats = this.getStats(type, level, specialization);
      return stats.range;
    } catch (e) {
      return 0;
    }
  },

  /** Computes the fire rate value for a given level. */
  getFireRateForLevel(
    type: string,
    level: number,
    currentFireRateOrSpecialization?: number | string | null
  ): number {
    const specialization =
      typeof currentFireRateOrSpecialization === "string" ? currentFireRateOrSpecialization : null;
    try {
      const stats = this.getStats(type, level, specialization);
      return stats.fireRate;
    } catch (e) {
      return 60;
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
