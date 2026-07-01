/*
 * @file: frontend/src/js/core/config/towers.ts
 * @purpose: Static configuration for tower attributes, costs, damage, ranges, colors, and specializations.
 * @last_update: 2026-07-01 / Refactored into a separate module.
 */

export interface TowerSpecConfig {
  name: string;
  desc: string;
  masteryDesc: string;
  color: string;
  multipliers?: Record<string, number>;
  values?: Record<string, number>;
}

export interface TowerStatsConfig {
  type: string;
  baseCost: number;
  baseDamage: number;
  damagePerLevel: number;
  damageLevelBonus?: number;
  baseRange: number;
  rangePerLevel: number;
  baseFireRate: number;
  fireRateDecrease: number;
  projectileSpeed?: number;
  aoeRadius?: number;
  aoeRadiusPerLevel?: number;
  colors: string[];
  costScaling?: {
    earlyMultiplier: number;
    lateMultiplier: number;
    thresholdLevel: number;
  };
  prismaMinMultiplier?: number;
  prismaMaxMultiplier?: number;
  prismaChargeFrames?: number;
  specializations: Record<string, TowerSpecConfig>;
}

export const TowerData: Record<string, TowerStatsConfig> = {
  Base: {
    type: "Base",
    baseCost: 150,
    baseDamage: 100,
    damagePerLevel: 45,
    baseRange: 140,
    rangePerLevel: 10,
    baseFireRate: 60,
    fireRateDecrease: 10,
    projectileSpeed: 15,
    colors: [
      "#0f3460",
      "#123e75",
      "#1a508b",
      "#205e9e",
      "#2b6cb0",
      "#3182ce",
      "#4299e1",
      "#63b3ed",
      "#90cdf4",
      "#cbd5e0",
      "#d6bcfa",
      "#b794f4",
      "#9f7aea",
      "#805ad5",
      "#ecc94b",
      "#ecc94b",
      "#ecc94b",
      "#f6ad55",
      "#f687b3",
      "#ffffff",
    ],
    specializations: {
      missiles: {
        name: "Homing Missiles",
        desc: "3x 8000 DMG, 4s CD",
        masteryDesc: "4x 60000 DMG, 1.5s CD",
        color: "#d63031",
        values: {
          normalCount: 3,
          masteryCount: 4,
          normalDmg: 8000,
          masteryDmg: 60000,
          normalCooldown: 240, // 4 seconds at 60 FPS
          masteryCooldown: 90, // 1.5 seconds at 60 FPS
          aoeRadius: 30,
          speed: 6.0,
        },
      },
      heavy: {
        name: "Heavy Ammo",
        desc: "3.0x Schaden",
        masteryDesc: "8.0x Schaden",
        color: "#2d3436",
        multipliers: {
          normalDmg: 3.0,
          masteryDmg: 8.0,
        },
      },
    },
  },
  Sniper: {
    type: "Sniper",
    baseCost: 500,
    baseDamage: 6000,
    damagePerLevel: 3000,
    damageLevelBonus: 250,
    baseRange: 9999,
    rangePerLevel: 0,
    baseFireRate: 450,
    fireRateDecrease: 28,
    projectileSpeed: 40,
    colors: [
      "#2b2b2b",
      "#333333",
      "#3d3d3d",
      "#444444",
      "#4f4f4f",
      "#5a5a5a",
      "#666666",
      "#717171",
      "#808080",
      "#8c8c8c",
      "#999999",
      "#a6a6a6",
      "#b3b3b3",
      "#c0c0c0",
      "#cccccccc",
      "#d9d9d9",
      "#e6e6e6",
      "#f2f2f2",
      "#fbfbfb",
      "#ffffff",
    ],
    specializations: {
      ricochet: {
        name: "Ricochet",
        desc: "4 Hits, 2.5/s Speed",
        masteryDesc: "8 Hits, 5.0/s Speed",
        color: "#00b894",
        values: {
          normalHits: 4,
          masteryHits: 8,
          normalFireRate: 24,
          masteryFireRate: 12,
          ricochetRange: 150,
        },
      },
      bounty: {
        name: "Bounty Hunter",
        desc: "+80g/Kill, 3.0x DMG, 0.4/s Speed",
        masteryDesc: "+300g/Kill, 6.5x DMG, 0.7/s Speed",
        color: "#f1c40f",
        multipliers: {
          normalDmg: 3.0,
          masteryDmg: 6.5,
        },
        values: {
          normalBounty: 80,
          masteryBounty: 300,
          normalFireRate: 150,
          masteryFireRate: 90,
        },
      },
    },
  },
  Bomb: {
    type: "Bomb",
    baseCost: 300,
    baseDamage: 1500,
    damagePerLevel: 600,
    baseRange: 100,
    rangePerLevel: 5,
    baseFireRate: 140,
    fireRateDecrease: 4.5,
    projectileSpeed: 3,
    aoeRadius: 100,
    aoeRadiusPerLevel: 5,
    colors: [
      "#4a0e0e",
      "#530f0f",
      "#5e1212",
      "#691414",
      "#731616",
      "#7f1818",
      "#8c1a1a",
      "#991c1c",
      "#a61e1e",
      "#b32020",
      "#bf2222",
      "#cc2424",
      "#d92626",
      "#e62828",
      "#f22b2b",
      "#ff3333",
      "#ff4040",
      "#ff5050",
      "#ff6060",
      "#ffffff",
    ],
    specializations: {
      nuke: {
        name: "Nuke",
        desc: "Radioaktive Strahlung, 0.8x Radius, 3.0x DMG",
        masteryDesc: "1.2x Radius, 7.0x DMG",
        color: "#2d3436",
        multipliers: {
          normalAoe: 0.8,
          masteryAoe: 1.2,
          normalDmg: 3.0,
          masteryDmg: 7.0,
        },
      },
      cluster: {
        name: "Cluster",
        desc: "Fragment-AOE, 5 Mini-Bomben",
        masteryDesc: "9 Mini-Bomben",
        color: "#d63031",
        values: {
          normalClusters: 5,
          masteryClusters: 9,
        },
      },
    },
  },
  Tesla: {
    type: "Tesla",
    baseCost: 400,
    baseDamage: 800,
    damagePerLevel: 350,
    baseRange: 140,
    rangePerLevel: 3,
    baseFireRate: 210,
    fireRateDecrease: 10,
    colors: [
      "#002244",
      "#003366",
      "#003c77",
      "#004080",
      "#004c99",
      "#0059b3",
      "#0066cc",
      "#0073e6",
      "#0080ff",
      "#1a8cff",
      "#3399ff",
      "#4db8ff",
      "#66c2ff",
      "#80d4ff",
      "#99e0ff",
      "#b3e6ff",
      "#ccf2ff",
      "#e6f7ff",
      "#f2faff",
      "#ffffff",
    ],
    specializations: {
      highvolt: {
        name: "High Voltage",
        desc: "3.5x Schaden",
        masteryDesc: "9.0x Schaden",
        color: "#6c5ce7",
        multipliers: {
          normalDmg: 3.5,
          masteryDmg: 9.0,
        },
      },
      stun: {
        name: "Shock Stun",
        desc: "0.6s Betäubung",
        masteryDesc: "1.2s Betäubung",
        color: "#00cec9",
        values: {
          normalDuration: 36,
          masteryDuration: 72,
          cooldown: 90,
        },
      },
    },
  },
  Prisma: {
    type: "Prisma",
    baseCost: 750,
    baseDamage: 10.0,
    damagePerLevel: 15.0,
    baseRange: 150,
    rangePerLevel: 8,
    baseFireRate: 1,
    fireRateDecrease: 0,
    colors: [
      "#9c6f00",
      "#b8860b",
      "#c7960c",
      "#d4af37",
      "#e3bf3b",
      "#ffd700",
      "#ffe01a",
      "#ffea00",
      "#fff033",
      "#ffff00",
      "#ffff4d",
      "#ffff66",
      "#ffff80",
      "#ffff99",
      "#ffffb3",
      "#ffffcc",
      "#ffffe6",
      "#fffacd",
      "#fff8dc",
      "#ffffff",
    ],
    prismaMinMultiplier: 0.25,
    prismaMaxMultiplier: 75.0,
    prismaChargeFrames: 480,
    specializations: {
      meltdown: {
        name: "Meltdown Overdrive",
        desc: "Meltdown: 10000 DMG (Radius 100)",
        masteryDesc: "Meltdown: 150000 DMG (Radius 150)",
        color: "#e65f00",
        values: {
          normalRadius: 100,
          masteryRadius: 150,
          normalDmg: 10000,
          masteryDmg: 150000,
        },
      },
      refraction: {
        name: "Refraction Split",
        desc: "Kettenstrahl: 4 Extraziele (75% DMG)",
        masteryDesc: "Kettenstrahl: 8 Extraziele (100% DMG)",
        color: "#00e699",
        values: {
          normalSplits: 4,
          masterySplits: 8,
          damageMultiplier: 0.75,
        },
      },
    },
  },
  Booster: {
    type: "Booster",
    baseCost: 600,
    baseDamage: 0,
    damagePerLevel: 0,
    baseRange: 160,
    rangePerLevel: 8,
    baseFireRate: 60,
    fireRateDecrease: 0,
    colors: [
      "#b85c00",
      "#cc6600",
      "#e67300",
      "#ff8000",
      "#ff8c1a",
      "#ff9933",
      "#ffa64d",
      "#ffb366",
      "#ffc080",
      "#ffcd99",
      "#ffd9b3",
      "#ffe6cc",
      "#fff2e6",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
    ],
    specializations: {
      frequency: {
        name: "Frequency Modulation",
        desc: "+40% Angriffsgeschwindigkeit",
        masteryDesc: "+75% Angriffsgeschwindigkeit",
        color: "#ff9f43",
        values: {
          normalBoost: 0.4,
          masteryBoost: 0.75,
        },
      },
      amplitude: {
        name: "Amplitude Amplifier",
        desc: "+40% DMG, +20% Reichweite",
        masteryDesc: "+80% DMG, +35% Reichweite",
        color: "#ee5253",
        values: {
          normalDmgBoost: 0.4,
          normalRangeBoost: 0.2,
          masteryDmgBoost: 0.8,
          masteryRangeBoost: 0.35,
        },
      },
    },
  },
  Generator: {
    type: "Generator",
    baseCost: 350,
    baseDamage: 0,
    damagePerLevel: 0,
    baseRange: 0,
    rangePerLevel: 0,
    baseFireRate: 300, // Cooldown of 5 seconds between gold ticks at 60 FPS
    fireRateDecrease: 10,
    colors: [
      "#20bf6b",
      "#26de81",
      "#00b894",
      "#55efc4",
      "#ffeaa7",
      "#ffd32a",
      "#ffb8b8",
      "#ff7675",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
      "#ffffff",
    ],
    specializations: {
      bank: {
        name: "Investment Bank",
        desc: "+80g am Wellenende",
        masteryDesc: "+400g am Wellenende",
        color: "#ffeaa7",
        values: {
          normalGold: 80,
          masteryGold: 400,
        },
      },
      industrial: {
        name: "Industrial Production",
        desc: "1.5x Gold-Einkommen",
        masteryDesc: "3.0x Gold-Einkommen",
        color: "#26de81",
        multipliers: {
          normalIncome: 1.5,
          masteryIncome: 3.0,
        },
      },
    },
  },
};
