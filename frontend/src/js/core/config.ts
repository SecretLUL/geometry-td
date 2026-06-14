/*
 * @file: frontend/src/js/core/config.ts
 * @purpose: Static configuration for the game grid, starting resources, tower costs/damage
 *           (base and specialized), and enemy attributes.
 * @dependencies: ./utils
 * @last_update: 2026-06-01 / v2.5.0 - Added Accelerator enemy config data.
 */
import { roundUpgradeCost } from "./utils";

export const Config = {
  CANVAS_COLS: 15,
  CANVAS_ROWS: 15,
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
    earlyMultiplier: 1.5,
    lateMultiplier: 1.5,
    thresholdLevel: 5,
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

export interface EnemyConfig {
  category: string;
  unlockWave: number;
  poolWeight: number;
  name: string;
  icon: string;
  color: string;
  description: string;
  hp: number;
  speed: number;
  reward: number;
  difficulty: number;
  ability: string;
  flavorText: string;
  weakness: string;
}

// NOTE FOR DEVELOPERS & AI AGENTS: Keep hp, speed, and reward values inside EnemyData capped at 100.
// These values are mapped 1:1 as percentages to fill stat bars in the Lexicon UI.
export const EnemyData: Record<string, EnemyConfig> = {
  Normal: {
    category: "Minions",
    unlockWave: 1,
    poolWeight: 1.0,
    name: "Normal",
    icon: "🟥",
    color: "#ff3366",
    description: "Ein zäher Standardgegner, der sich wie ein kleiner Miniboss verhält.",
    hp: 30,
    speed: 35,
    reward: 12,
    difficulty: 1,
    ability: "Keine",
    flavorText: "Der Standard-Kanonenfutter-Kubus. Durch Systemhärtung extrem zäh geworden.",
    weakness: "Keine besondere Schwäche.",
  },
  Scout: {
    category: "Minions",
    unlockWave: 3,
    poolWeight: 0.2,
    name: "Scout",
    icon: "🔺",
    color: "#ffb703",
    description: "Ein sehr schneller, widerstandsfähiger Aufklärer.",
    hp: 18,
    speed: 75,
    reward: 9,
    difficulty: 2,
    ability: "Keine",
    flavorText: "Rennt schneller als sein Verstand erlaubt, hält aber deutlich mehr aus.",
    weakness: "Anfällig für Bomb-Türme aufgrund ihrer relativ geringen HP.",
  },
  Bruiser: {
    category: "Minions",
    unlockWave: 7,
    poolWeight: 0.15,
    name: "Bruiser",
    icon: "🛑",
    color: "#8b0000",
    description: "Ein extrem massiver, schwer gepanzerter Titan.",
    hp: 75,
    speed: 15,
    reward: 24,
    difficulty: 3,
    ability: "Keine",
    flavorText: "Gewaltige Masse und massive Rüstung machen ihn zu einer wandelnden Festung.",
    weakness: "Besonders anfällig für Sniper-Türme aufgrund ihrer niedrigen Geschwindigkeit.",
  },
  Regrower: {
    category: "Minions",
    unlockWave: 12,
    poolWeight: 0.1,
    name: "Regrower",
    icon: "🟩",
    color: "#228b22",
    description: "Ein regenerativer Gegner mit enormen Selbstheilungskräften.",
    hp: 50,
    speed: 35,
    reward: 20,
    difficulty: 4,
    ability: "Heilt sich alle 0,5s",
    flavorText:
      "Bio-Zell-Reparatur auf Steroiden. Seine Regeneration erfordert massiven Fokus-Schaden.",
    weakness: "Muss durch konstanten hohen Schaden schnell ausgeschaltet werden.",
  },
  Shielded: {
    category: "Minions",
    unlockWave: 18,
    poolWeight: 0.1,
    name: "Shielded",
    icon: "💠",
    color: "#4682b4",
    description: "Absorbiert den allerersten Treffer komplett mit einem Schild.",
    hp: 36,
    speed: 35,
    reward: 25,
    difficulty: 4,
    ability: "Blockt den ersten Treffer ab",
    flavorText: "Ein hochentwickelter Schild schützt ihn vor dem ersten verheerenden Treffer.",
    weakness: "Türme mit hoher Feuerrate zerschlagen den Schild blitzschnell.",
  },
  Boss: {
    category: "Bosse",
    unlockWave: 10,
    poolWeight: 0, // Boss handles separately
    name: "Mutterschiff",
    icon: "🔮",
    color: "#aa00ff",
    description:
      "Schutzschildgepanzert. Spawnt große Minion-Gefolgschaften und feuert duale Störstrahlen ab, die bis zu 2 Türme gleichzeitig lahmlegen.",
    hp: 100,
    speed: 8,
    reward: 100,
    difficulty: 5,
    ability: "Schild, Massenspawns & Dualer Stun",
    flavorText:
      "Die absolute Endstation. Es ist riesig, unberechenbar und blockiert mit seinem High-Tech-Schild den ersten mächtigen Treffer vollkommen.",
    weakness:
      "Schnellfeuernde Tesla- oder Laser-Spezialisierungen zerschlagen den Schild. Benötigt Fokus-Schaden aller Türme!",
  },
  Defragmenter: {
    category: "Bosse",
    unlockWave: 20,
    poolWeight: 0,
    name: "Defragmenter",
    icon: "💎",
    color: "#00f5d4",
    description:
      "Ein gigantischer kristalliner Hexagon-Boss. Zerfällt bei Zerstörung schrittweise in immer kleinere und schnellere Fragmente.",
    hp: 100,
    speed: 10,
    reward: 100,
    difficulty: 5,
    ability: "Ketten-Spaltung",
    flavorText:
      "Ein gigantischer geometrischer Kristall, der durch einen uralten Systemfehler entstanden ist. Seine Struktur ist so labil, dass er sich bei Schaden in selbstständige Unterprogramme zerlegt.",
    weakness:
      "Flächenschaden (Bomben) und Prisma-Laser, um die anstürmenden Fragmente zu kontrollieren.",
  },
  DefragmenterFragment: {
    category: "Bosse",
    unlockWave: 20,
    poolWeight: 0,
    name: "Defragmenter-Fragment",
    icon: "🔷",
    color: "#00f5d4",
    description:
      "Ein mittelschweres Pentagon-Bruchstück des Defragmentierers. Spaltet sich bei Zerstörung erneut.",
    hp: 80,
    speed: 25,
    reward: 20,
    difficulty: 4,
    ability: "Spaltung",
    flavorText:
      "Die mittlere Zerfallsstufe des Defragmentierers. Schneller und wendiger als die Ursprungsform.",
    weakness: "Standard- und Tesla-Türme.",
  },
  DefragmenterSubfragment: {
    category: "Bosse",
    unlockWave: 20,
    poolWeight: 0,
    name: "Defragmenter-Subfragment",
    icon: "🔹",
    color: "#00f5d4",
    description: "Ein kleines, extrem schnelles Dreiecks-Fragment. Die letzte Zerfallsstufe.",
    hp: 35,
    speed: 60,
    reward: 10,
    difficulty: 3,
    ability: "Sehr schnell",
    flavorText:
      "Das kleinste, flinkste Überbleibsel des Defragmentierers. Ein panisches Datenpaket auf dem Weg ins Ziel.",
    weakness: "Tesla-Schock-Türme und schnelle Prisma-Strahlen.",
  },
  Collector: {
    category: "Special Minions",
    unlockWave: 15,
    poolWeight: 0.003,
    name: "Collector",
    icon: "💰",
    color: "#ffd700",
    description: "Ein seltener und schwer fassbarer Dieb, der riesigen Reichtum birgt.",
    hp: 85,
    speed: 100,
    reward: 100,
    difficulty: 4,
    ability: "Loot Drop",
    flavorText: "Legenden besagen, er trägt den Schatz eines ganzen Königreichs bei sich.",
    weakness: "Hoher Burst-Schaden",
  },
  Fortress: {
    category: "Special Minions",
    unlockWave: 22,
    poolWeight: 0.05,
    name: "Fortress",
    icon: "🏰",
    color: "#2d3436",
    description: "Ein massiver Panzer mit einer regenerativen Hülle.",
    hp: 95,
    speed: 20,
    reward: 55,
    difficulty: 5,
    ability: "Regenerative Hülle (Schild)",
    flavorText:
      "Dieses Monstrum aus Stahl und Energie regeneriert seinen Schild schneller, als die meisten Türme feuern können.",
    weakness: "Dauerhafter Fokus-Schaden durch Tesla oder Sniper.",
  },
  Splinter: {
    category: "Minions",
    unlockWave: 6,
    poolWeight: 0.15,
    name: "Splinter",
    icon: "🌀",
    color: "#00f5d4",
    description:
      "Ein instabiles Konstrukt aus reinem Licht. Zerfällt beim Ableben in zwei flinke Fragmente.",
    hp: 35,
    speed: 32,
    reward: 10,
    difficulty: 2,
    ability: "Spaltung",
    flavorText:
      "Ein instabiles Konstrukt aus reinem Licht. Zerstört man seine Form, entstehen daraus zwei flinke Bruchstücke, die panisch das Ziel anvisieren.",
    weakness: "Bombentürme und Prisma-Kettenstrahl.",
  },
  Swarm: {
    category: "Minions",
    unlockWave: 4,
    poolWeight: 0.15,
    name: "Schwarm",
    icon: "🦠",
    color: "#ff00ff",
    description:
      "Ein kleiner Schwarm winziger Punkte, der Single-Target-Türme komplett überfordert.",
    hp: 5,
    speed: 60,
    reward: 1,
    difficulty: 2,
    ability: "Cluster-Spawn",
    flavorText: "Spawnen in Gruppen. Einzeln nutzlos, in der Masse tödlich.",
    weakness: "Flächenschaden (Bomben, Kettenblitz) vernichtet sie mühelos.",
  },
  Accelerator: {
    category: "Special Minions",
    unlockWave: 14,
    poolWeight: 0.08,
    name: "Accelerator",
    icon: "⏩",
    color: "#ccff00",
    description: "Erhöht das Bewegungstempo aller Gegner im Umkreis um 40%.",
    hp: 70,
    speed: 15,
    reward: 20,
    difficulty: 4,
    ability: "Tempo-Aura (+40%)",
    flavorText:
      "Ein aerodynamisches Kraftpaket. Seine bloße Anwesenheit verzerrt das Raum-Zeit-Gitter und peitscht andere Formen voran.",
    weakness: "Muss sofort priorisiert werden, bevor er andere Feinde beschleunigt.",
  },
};

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
    baseRange: 120,
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
