/*
 * @file: frontend/src/js/core/game/bossBar.ts
 * @purpose: Coordinates boss HP and Shield health bar DOM updates, flickering animations,
 *           and visibility controls.
 * @dependencies: state, config, types, helpers
 */
import { state } from "../state";
import { Config } from "../config";
import { Enemy } from "../../types";

// Cached DOM element references
let cachedBossHpFill: HTMLElement | null = null;
let cachedBossHpContainer: HTMLElement | null = null;
let cachedBossName: HTMLElement | null = null;
let cachedBossHpBar: HTMLElement | null = null;
let cachedBossShieldFill: HTMLElement | null = null;
let cachedBossShieldBar: HTMLElement | null = null;

export function initBossBarDOM(): void {
  cachedBossHpFill = document.getElementById("bossHpFill");
  cachedBossHpContainer = document.getElementById("bossHpContainer");
  cachedBossName = document.getElementById("bossName");
  cachedBossHpBar = document.getElementById("bossHpBar");
  cachedBossShieldFill = document.getElementById("bossShieldFill");
  cachedBossShieldBar = document.getElementById("bossShieldBar");
}

export function hideBossBar(): void {
  if (cachedBossHpContainer && !cachedBossHpContainer.classList.contains("hidden")) {
    cachedBossHpContainer.classList.add("hidden");
  }
}

export function updateBossBar(): void {
  let defragPartsCount = 0;
  let currentHpSum = 0;
  let defragWaveNumber = state.wave;
  const baseHp = Config.ENEMY_BASE_HP;

  for (let i = 0; i < state.enemies.length; i++) {
    const e = state.enemies[i];
    if (
      e.typeName === "Defragmenter" ||
      e.typeName === "DefragmenterFragment" ||
      e.typeName === "DefragmenterSubfragment"
    ) {
      if (defragPartsCount === 0) {
        defragWaveNumber = e.waveNumber || state.wave;
      }
      defragPartsCount++;

      const hpMultiplier = Config.getHpMultiplier(defragWaveNumber);
      let latentHp = 0;
      if (e.typeName === "Defragmenter") {
        latentHp = Math.floor(baseHp * hpMultiplier * 24);
      } else if (e.typeName === "DefragmenterFragment") {
        latentHp = Math.floor(baseHp * hpMultiplier * 4);
      }
      currentHpSum += Math.max(0, e.hp) + latentHp;
    }
  }

  if (defragPartsCount > 0) {
    const hpMultiplier = Config.getHpMultiplier(defragWaveNumber);
    const totalMaxHp = Math.floor(baseHp * hpMultiplier * 49);

    if (cachedBossHpFill) {
      cachedBossHpFill.style.width = (Math.max(0, currentHpSum) / totalMaxHp) * 100 + "%";
      if (cachedBossHpContainer) {
        cachedBossHpContainer.classList.remove("hidden");
        cachedBossHpContainer.style.boxShadow = "0 0 25px rgba(0, 245, 212, 0.4)";
      }
      if (cachedBossName) {
        cachedBossName.textContent = "d e f r a g m e n t i e r e r";
        cachedBossName.style.textShadow = "0 0 10px #00f5d4";
      }

      // Shield bar must be hidden for the Defragmenter
      if (cachedBossShieldBar) {
        cachedBossShieldBar.classList.add("hidden");
      }

      if (currentHpSum < totalMaxHp * 0.25) {
        const isFlickering = Math.floor(state.animTime / 100) % 2 === 0;
        cachedBossHpFill.style.background = isFlickering
          ? "#ffffff"
          : "linear-gradient(90deg, #00b894, #00f5d4)";
        if (cachedBossHpContainer)
          cachedBossHpContainer.style.borderColor = isFlickering ? "#ffffff" : "#00f5d4";
        if (cachedBossHpBar)
          cachedBossHpBar.style.borderColor = isFlickering ? "#ffffff" : "#00f5d4";
      } else {
        cachedBossHpFill.style.background = "linear-gradient(90deg, #00f5d4, #00cec9)";
        if (cachedBossHpContainer) cachedBossHpContainer.style.borderColor = "#00f5d4";
        if (cachedBossHpBar) cachedBossHpBar.style.borderColor = "#00f5d4";
      }
    }
  } else {
    let boss: Enemy | null = null;
    const enemiesLen = state.enemies.length;
    for (let idx = 0; idx < enemiesLen; idx++) {
      if (state.enemies[idx].typeName === "Boss") {
        boss = state.enemies[idx];
        break;
      }
    }
    if (boss) {
      if (cachedBossHpFill) {
        cachedBossHpFill.style.width = (Math.max(0, boss.hp) / boss.maxHp) * 100 + "%";
        if (cachedBossHpContainer) {
          cachedBossHpContainer.classList.remove("hidden");
          cachedBossHpContainer.style.boxShadow = "0 0 25px rgba(255, 51, 102, 0.4)";
        }
        if (cachedBossName) {
          cachedBossName.textContent = "m u t t e r s c h i f f";
          cachedBossName.style.textShadow = "0 0 10px #ff3366";
        }

        if (boss.hp < boss.maxHp * 0.25) {
          const isFlickering = Math.floor(state.animTime / 100) % 2 === 0;
          cachedBossHpFill.style.background = isFlickering
            ? "#ffffff"
            : "linear-gradient(90deg, #8b0000, #ff0000)";
          if (cachedBossHpContainer)
            cachedBossHpContainer.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
          if (cachedBossHpBar)
            cachedBossHpBar.style.borderColor = isFlickering ? "#ffffff" : "#ff0000";
        } else if (boss.hp < boss.maxHp * 0.5) {
          cachedBossHpFill.style.background = "linear-gradient(90deg, #8b0000, #ff0000)";
          if (cachedBossHpContainer) cachedBossHpContainer.style.borderColor = "#ff0000";
          if (cachedBossHpBar) cachedBossHpBar.style.borderColor = "#ff0000";
        } else {
          cachedBossHpFill.style.background = "linear-gradient(90deg, #ff3366, #ff0000)";
          if (cachedBossHpContainer) cachedBossHpContainer.style.borderColor = "#ff3366";
          if (cachedBossHpBar) cachedBossHpBar.style.borderColor = "#ff3366";
        }

        if (cachedBossShieldBar) {
          if (
            boss.shieldActive &&
            boss.shieldHp !== undefined &&
            boss.maxShieldHp !== undefined &&
            boss.shieldHp > 0
          ) {
            cachedBossShieldBar.classList.remove("hidden");
            if (cachedBossShieldFill) {
              cachedBossShieldFill.style.width =
                (Math.max(0, boss.shieldHp) / boss.maxShieldHp) * 100 + "%";
            }
          } else {
            cachedBossShieldBar.classList.add("hidden");
          }
        }
      }
    } else {
      hideBossBar();
    }
  }
}
