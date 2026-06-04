/*
 * @file: frontend\src\js\core\config.ts
 * @purpose: Static configuration settings for game grid, starting resources, cost/damage of basic/specialized towers, and enemy attributes.
 * @dependencies: ./utils
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
 * @last_update: 2026-06-01 / v2.5.0 - Added Accelerator enemy config data.
 */
import { roundUpgradeCost } from './utils';

export const Config = {
    CANVAS_COLS: 15,
    CANVAS_ROWS: 15,
    TILE_SIZE: 50,          // base tile size; recalculated at runtime by viewport scaling

    GAME_SPEEDS: {
        NORMAL: 1.5,
        FAST: 3.0,
        SUPER_FAST: 6.0
    },

    STARTING_GOLD: 250,
    STARTING_LIVES: 20,

    TOWER_MAX_LEVEL: 20,
    TOWER_SPECIALIZATION_LEVEL: 10,
    TOWER_MASTERY_LEVEL: 20,

    TOWER_MIN_FIRE_RATE: 10,
    TOWER_FIRE_RATE_DECREASE: 10,
    PROJECTILE_SPEED: 15,

    // Enemy Parameters
    ENEMY_BASE_HP: 20,
    ENEMY_HP_MULTIPLIER: 1.15,
    ENEMY_REWARD_BASE: 5,
    ENEMY_REWARD_MULTIPLIER: 1.02, // lowered from 1.05 to prevent extreme gold scaling in later waves

    INTEREST_RATE: 0.10,            // interest rate per wave (lowered from 15%)
    DIFFICULTY_LINEAR_FACTOR: 0.8,  // linear coefficient for wave health scaling (increased from 0.5)
    DIFFICULTY_QUADRATIC_FACTOR: 0.05, // quadratic coefficient for wave health scaling

    /** Computes the HP multiplier for a given wave using a linear-quadratic curve */
    getHpMultiplier(wave: number): number {
        return 1 + this.DIFFICULTY_LINEAR_FACTOR * (wave - 1) + this.DIFFICULTY_QUADRATIC_FACTOR * Math.pow(wave - 1, 2);
    },


    // Wave Parameters
    SPAWN_RATE: 80,
    WAVE_BASE_ENEMIES: 12,
    WAVE_ENEMIES_MULTIPLIER: 2.2,
    WAVE_BONUS_BASE: 20,
    WAVE_BONUS_PER_WAVE: 5,

    // Derived (kept for backward compat, updated by viewport scaler)
    get CANVAS_WIDTH() { return this.TILE_SIZE * this.CANVAS_COLS; },
    get CANVAS_HEIGHT() { return this.TILE_SIZE * this.CANVAS_ROWS; },
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

// NOTE FOR DEVELOPERS & AI AGENTS: Keep stats (hp, speed, reward) inside EnemyData capped at 100 max!
// They are mapped 1:1 as percentages to fill bars in the Lexicon UI (menu.js).
export const EnemyData: Record<string, EnemyConfig> = {
    'Normal': {
        category: 'Minions',
        unlockWave: 1,
        poolWeight: 1.0,
        name: 'Normal',
        icon: '🟥',
        color: '#ff3366',
        description: 'Ein einfacher Standardgegner ohne besondere Fähigkeiten.',
        hp: 15,
        speed: 35,
        reward: 8,
        difficulty: 1,
        ability: 'Keine',
        flavorText: 'Der Standard-Kanonenfutter-Kubus. Er weiß nicht viel, aber er marschiert tapfer seinem Ende entgegen.',
        weakness: 'Keine besondere Schwäche.'
    },
    'Scout': {
        category: 'Minions',
        unlockWave: 3,
        poolWeight: 0.20,
        name: 'Scout',
        icon: '🔺',
        color: '#ffb703',
        description: 'Ein extrem schneller, aber fragiler Gegner.',
        hp: 8,
        speed: 75,
        reward: 5,
        difficulty: 2,
        ability: 'Keine',
        flavorText: 'Rennt schneller als sein Verstand erlaubt. Platzt schon beim scharfen Anschauen.',
        weakness: 'Anfällig für Bomb-Türme aufgrund ihrer geringen HP.'
    },
    'Bruiser': {
        category: 'Minions',
        unlockWave: 7,
        poolWeight: 0.15,
        name: 'Bruiser',
        icon: '🛑',
        color: '#8b0000',
        description: 'Ein massiver, stark gepanzerter Tank.',
        hp: 40,
        speed: 15,
        reward: 18,
        difficulty: 3,
        ability: 'Keine',
        flavorText: 'Er hat heute Morgen Gewichte gestemmt... und sich dabei eine Zerrung geholt. Daher ist er sehr langsam.',
        weakness: 'Besonders anfällig für Sniper-Türme aufgrund ihrer niedrigen Geschwindigkeit.'
    },
    'Regrower': {
        category: 'Minions',
        unlockWave: 12,
        poolWeight: 0.10,
        name: 'Regrower',
        icon: '🟩',
        color: '#228b22',
        description: 'Ein regenerativer Gegner, der sich konstant heilt.',
        hp: 25,
        speed: 35,
        reward: 15,
        difficulty: 4,
        ability: 'Heilt sich alle 0,5s',
        flavorText: 'Bio-Zell-Reparatur auf Steroiden. Er weigert sich beharrlich, einfach zu sterben.',
        weakness: 'Muss durch konstanten hohen Schaden schnell ausgeschaltet werden.'
    },
    'Shielded': {
        category: 'Minions',
        unlockWave: 18,
        poolWeight: 0.10,
        name: 'Shielded',
        icon: '💠',
        color: '#4682b4',
        description: 'Absorbiert den allerersten Treffer komplett.',
        hp: 18,
        speed: 35,
        reward: 25,
        difficulty: 4,
        ability: 'Blockt den ersten Treffer ab',
        flavorText: 'Hat einen Premium-Schutzschild im AppStore gekauft. Wehrt den allerersten Treffer komplett ab.',
        weakness: 'Türme mit hoher Feuerrate zerschlagen den Schild blitzschnell.'
    },
    'Boss': {
        category: 'Bosse',
        unlockWave: 10,
        poolWeight: 0, // Boss handles separately
        name: 'Mutterschiff',
        icon: '🔮',
        color: '#aa00ff',
        description: 'Schutzschildgepanzert. Spawnt große Minion-Gefolgschaften und feuert duale Störstrahlen ab, die bis zu 2 Türme gleichzeitig lahmlegen.',
        hp: 100,
        speed: 8,
        reward: 100,
        difficulty: 5,
        ability: 'Schild, Massenspawns & Dualer Stun',
        flavorText: 'Die absolute Endstation. Es ist riesig, unberechenbar und blockiert mit seinem High-Tech-Schild den ersten mächtigen Treffer vollkommen.',
        weakness: 'Schnellfeuernde Tesla- oder Laser-Spezialisierungen zerschlagen den Schild. Benötigt Fokus-Schaden aller Türme!'
    },
    'Defragmenter': {
        category: 'Bosse',
        unlockWave: 20,
        poolWeight: 0,
        name: 'Defragmenter',
        icon: '💎',
        color: '#00f5d4',
        description: 'Ein gigantischer kristalliner Hexagon-Boss. Zerfällt bei Zerstörung schrittweise in immer kleinere und schnellere Fragmente.',
        hp: 100,
        speed: 10,
        reward: 100,
        difficulty: 5,
        ability: 'Ketten-Spaltung',
        flavorText: 'Ein gigantischer geometrischer Kristall, der durch einen uralten Systemfehler entstanden ist. Seine Struktur ist so labil, dass er sich bei Schaden in selbstständige Unterprogramme zerlegt.',
        weakness: 'Flächenschaden (Bomben) und Prisma-Laser, um die anstürmenden Fragmente zu kontrollieren.'
    },
    'DefragmenterFragment': {
        category: 'Bosse',
        unlockWave: 20,
        poolWeight: 0,
        name: 'Defragmenter-Fragment',
        icon: '🔷',
        color: '#00f5d4',
        description: 'Ein mittelschweres Pentagon-Bruchstück des Defragmentierers. Spaltet sich bei Zerstörung erneut.',
        hp: 40,
        speed: 25,
        reward: 20,
        difficulty: 4,
        ability: 'Spaltung',
        flavorText: 'Die mittlere Zerfallsstufe des Defragmentierers. Schneller und wendiger als die Ursprungsform.',
        weakness: 'Standard- und Tesla-Türme.'
    },
    'DefragmenterSubfragment': {
        category: 'Bosse',
        unlockWave: 20,
        poolWeight: 0,
        name: 'Defragmenter-Subfragment',
        icon: '🔹',
        color: '#00f5d4',
        description: 'Ein kleines, extrem schnelles Dreiecks-Fragment. Die letzte Zerfallsstufe.',
        hp: 15,
        speed: 60,
        reward: 10,
        difficulty: 3,
        ability: 'Sehr schnell',
        flavorText: 'Das kleinste, flinkste Überbleibsel des Defragmentierers. Ein panisches Datenpaket auf dem Weg ins Ziel.',
        weakness: 'Tesla-Schock-Türme und schnelle Prisma-Strahlen.'
    },
    'Collector': {
        category: 'Special Minions',
        unlockWave: 5,
        poolWeight: 0.003,
        name: 'Collector',
        icon: '💰',
        color: '#ffd700',
        description: 'Ein seltener und schwer fassbarer Dieb, der riesigen Reichtum birgt.',
        hp: 50,
        speed: 100,
        reward: 100,
        difficulty: 4,
        ability: 'Loot Drop',
        flavorText: 'Legenden besagen, er trägt den Schatz eines ganzen Königreichs bei sich.',
        weakness: 'Hoher Burst-Schaden'
    },
    'Fortress': {
        category: 'Special Minions',
        unlockWave: 22,
        poolWeight: 0.05,
        name: 'Fortress',
        icon: '🏰',
        color: '#2d3436',
        description: 'Ein massiver Panzer mit einer regenerativen Hülle.',
        hp: 65,
        speed: 20,
        reward: 55,
        difficulty: 5,
        ability: 'Regenerative Hülle (Schild)',
        flavorText: 'Dieses Monstrum aus Stahl und Energie regeneriert seinen Schild schneller, als die meisten Türme feuern können.',
        weakness: 'Dauerhafter Fokus-Schaden durch Tesla oder Sniper.'
    },
    'Splinter': {
        category: 'Minions',
        unlockWave: 6,
        poolWeight: 0.15,
        name: 'Splinter',
        icon: '🌀',
        color: '#00f5d4',
        description: 'Ein instabiles Konstrukt aus reinem Licht. Zerfällt beim Ableben in zwei flinke Fragmente.',
        hp: 16,
        speed: 32,
        reward: 10,
        difficulty: 2,
        ability: 'Spaltung',
        flavorText: 'Ein instabiles Konstrukt aus reinem Licht. Zerstört man seine Form, entstehen daraus zwei flinke Bruchstücke, die panisch das Ziel anvisieren.',
        weakness: 'Bombentürme und Prisma-Kettenstrahl.'
    },
    'Swarm': {
        category: 'Minions',
        unlockWave: 4,
        poolWeight: 0.15,
        name: 'Schwarm',
        icon: '🦠',
        color: '#ff00ff',
        description: 'Ein massiver Schwarm winziger Punkte, der Single-Target-Türme komplett überfordert.',
        hp: 1,
        speed: 60,
        reward: 1,
        difficulty: 2,
        ability: 'Cluster-Spawn',
        flavorText: 'Spawnen in extrem großen Gruppen. Einzeln nutzlos, in der Masse tödlich.',
        weakness: 'Flächenschaden (Bomben, Kettenblitz) vernichtet sie mühelos.'
    },
    'Accelerator': {
        category: 'Special Minions',
        unlockWave: 14,
        poolWeight: 0.08,
        name: 'Accelerator',
        icon: '⏩',
        color: '#ccff00',
        description: 'Erhöht das Bewegungstempo aller Gegner im Umkreis um 40%.',
        hp: 30,
        speed: 15,
        reward: 20,
        difficulty: 4,
        ability: 'Tempo-Aura (+40%)',
        flavorText: 'Ein aerodynamisches Kraftpaket. Seine bloße Anwesenheit verzerrt das Raum-Zeit-Gitter und peitscht andere Formen voran.',
        weakness: 'Muss sofort priorisiert werden, bevor er andere Feinde beschleunigt.'
    }
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
    costScaling: {
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
    'Base': {
        type: 'Base',
        baseCost: 50,
        baseDamage: 10,
        damagePerLevel: 5,
        baseRange: 180,
        rangePerLevel: 10,
        baseFireRate: 60,
        fireRateDecrease: 10,
        projectileSpeed: 15,
        colors: ['#0f3460', '#123e75', '#1a508b', '#205e9e', '#2b6cb0', '#3182ce', '#4299e1', '#63b3ed', '#90cdf4', '#cbd5e0', '#d6bcfa', '#b794f4', '#9f7aea', '#805ad5', '#ecc94b', '#ecc94b', '#ecc94b', '#f6ad55', '#f687b3', '#ffffff'],
        costScaling: {
            earlyMultiplier: 2.0,
            lateMultiplier: 1.4,
            thresholdLevel: 5
        },
        specializations: {
            'missiles': {
                name: 'Homing Missiles',
                desc: '3x 1000 DMG, 4s CD',
                masteryDesc: '4x 8000 DMG, 1.5s CD',
                color: '#d63031',
                values: {
                    normalCount: 3,
                    masteryCount: 4,
                    normalDmg: 1000,
                    masteryDmg: 8000,
                    normalCooldown: 240, // 4 seconds at 60 FPS
                    masteryCooldown: 90,  // 1.5 seconds at 60 FPS
                    aoeRadius: 30,
                    speed: 6.0
                }
            },
            'heavy': {
                name: 'Heavy Ammo',
                desc: '2.0x Schaden',
                masteryDesc: '5.0x Schaden',
                color: '#2d3436',
                multipliers: {
                    normalDmg: 2.0,
                    masteryDmg: 5.0
                }
            }
        }
    },
    'Sniper': {
        type: 'Sniper',
        baseCost: 200,
        baseDamage: 1200,
        damagePerLevel: 600,
        damageLevelBonus: 50,
        baseRange: 9999,
        rangePerLevel: 0,
        baseFireRate: 450,
        fireRateDecrease: 28,
        projectileSpeed: 40,
        colors: ['#2b2b2b', '#333333', '#3d3d3d', '#444444', '#4f4f4f', '#5a5a5a', '#666666', '#717171', '#808080', '#8c8c8c', '#999999', '#a6a6a6', '#b3b3b3', '#c0c0c0', '#cccccccc', '#d9d9d9', '#e6e6e6', '#f2f2f2', '#fbfbfb', '#ffffff'],
        costScaling: {
            earlyMultiplier: 2.0,
            lateMultiplier: 1.4,
            thresholdLevel: 5
        },
        specializations: {
            'ricochet': {
                name: 'Ricochet',
                desc: '4 Hits, 0.4s Speed',
                masteryDesc: '8 Hits, 0.2s Speed',
                color: '#00b894',
                values: {
                    normalHits: 4,
                    masteryHits: 8,
                    normalFireRate: 24,
                    masteryFireRate: 12,
                    ricochetRange: 150
                }
            },
            'bounty': {
                name: 'Bounty Hunter',
                desc: '+250g/Kill, 2.0x DMG, 2.5s Speed',
                masteryDesc: '+1000g/Kill, 4.5x DMG, 1.5s Speed',
                color: '#f1c40f',
                multipliers: {
                    normalDmg: 2.0,
                    masteryDmg: 4.5
                },
                values: {
                    normalBounty: 250,
                    masteryBounty: 1000,
                    normalFireRate: 150,
                    masteryFireRate: 90
                }
            }
        }
    },
    'Bomb': {
        type: 'Bomb',
        baseCost: 100,
        baseDamage: 350,
        damagePerLevel: 120,
        baseRange: 100,
        rangePerLevel: 5,
        baseFireRate: 140,
        fireRateDecrease: 4.5,
        projectileSpeed: 3,
        aoeRadius: 80,
        aoeRadiusPerLevel: 4,
        colors: ['#4a0e0e', '#530f0f', '#5e1212', '#691414', '#731616', '#7f1818', '#8c1a1a', '#991c1c', '#a61e1e', '#b32020', '#bf2222', '#cc2424', '#d92626', '#e62828', '#f22b2b', '#ff3333', '#ff4040', '#ff5050', '#ff6060', '#ffffff'],
        costScaling: {
            earlyMultiplier: 2.0,
            lateMultiplier: 1.4,
            thresholdLevel: 5
        },
        specializations: {
            'nuke': {
                name: 'Nuke',
                desc: 'Radioaktive Strahlung, 0.8x Radius, 2.0x DMG',
                masteryDesc: '1.2x Radius, 4.5x DMG',
                color: '#2d3436',
                multipliers: {
                    normalAoe: 0.8,
                    masteryAoe: 1.2,
                    normalDmg: 2.0,
                    masteryDmg: 4.5
                }
            },
            'cluster': {
                name: 'Cluster',
                desc: 'Fragment-AOE, 5 Mini-Bomben',
                masteryDesc: '9 Mini-Bomben',
                color: '#d63031',
                values: {
                    normalClusters: 5,
                    masteryClusters: 9
                }
            }
        }
    },
    'Tesla': {
        type: 'Tesla',
        baseCost: 150,
        baseDamage: 120,
        damagePerLevel: 55,
        baseRange: 120,
        rangePerLevel: 3,
        baseFireRate: 210,
        fireRateDecrease: 10,
        colors: ['#002244', '#003366', '#003c77', '#004080', '#004c99', '#0059b3', '#0066cc', '#0073e6', '#0080ff', '#1a8cff', '#3399ff', '#4db8ff', '#66c2ff', '#80d4ff', '#99e0ff', '#b3e6ff', '#ccf2ff', '#e6f7ff', '#f2faff', '#ffffff'],
        costScaling: {
            earlyMultiplier: 2.0,
            lateMultiplier: 1.4,
            thresholdLevel: 5
        },
        specializations: {
            'highvolt': {
                name: 'High Voltage',
                desc: '2.5x Schaden',
                masteryDesc: '6.0x Schaden',
                color: '#6c5ce7',
                multipliers: {
                    normalDmg: 2.5,
                    masteryDmg: 6.0
                }
            },
            'stun': {
                name: 'Shock Stun',
                desc: '0.6s Betäubung',
                masteryDesc: '1.2s Betäubung',
                color: '#00cec9',
                values: {
                    normalDuration: 36,
                    masteryDuration: 72,
                    cooldown: 90
                }
            }
        }
    },
    'Prisma': {
        type: 'Prisma',
        baseCost: 250,
        baseDamage: 1.0,
        damagePerLevel: 1.5,
        baseRange: 150,
        rangePerLevel: 8,
        baseFireRate: 1,
        fireRateDecrease: 0,
        colors: ['#9c6f00', '#b8860b', '#c7960c', '#d4af37', '#e3bf3b', '#ffd700', '#ffe01a', '#ffea00', '#fff033', '#ffff00', '#ffff4d', '#ffff66', '#ffff80', '#ffff99', '#ffffb3', '#ffffcc', '#ffffe6', '#fffacd', '#fff8dc', '#ffffff'],
        costScaling: {
            earlyMultiplier: 2.0,
            lateMultiplier: 1.4,
            thresholdLevel: 5
        },
        prismaMinMultiplier: 0.25,
        prismaMaxMultiplier: 25.0,
        prismaChargeFrames: 480,
        specializations: {
            'meltdown': {
                name: 'Meltdown Overdrive',
                desc: 'Meltdown: 2000 DMG (Radius 100)',
                masteryDesc: 'Meltdown: 25000 DMG (Radius 150)',
                color: '#e65f00',
                values: {
                    normalRadius: 100,
                    masteryRadius: 150,
                    normalDmg: 2000,
                    masteryDmg: 25000
                }
            },
            'refraction': {
                name: 'Refraction Split',
                desc: 'Kettenstrahl: 4 Extraziele (75% DMG)',
                masteryDesc: 'Kettenstrahl: 8 Extraziele (100% DMG)',
                color: '#00e699',
                values: {
                    normalSplits: 4,
                    masterySplits: 8,
                    damageMultiplier: 0.75
                }
            }
        }
    }
};

export const TowerBalancer = {
    /** Berechnet die Upgrade-Kosten für einen bestimmten Turmtyp und ein bestimmtes Level */
    getUpgradeCost(type: string, level: number, currentCost: number): number {
        const stats = TowerData[type];
        if (!stats) return currentCost * 2;
        
        const scale = stats.costScaling;
        let newCost = currentCost;
        if (level >= scale.thresholdLevel) {
            newCost = Math.floor(currentCost * scale.lateMultiplier);
        } else {
            newCost = currentCost * scale.earlyMultiplier;
        }
        return roundUpgradeCost(newCost);
    },

    /** Berechnet den Schaden für ein bestimmtes Level */
    getDamageForLevel(type: string, level: number, baseDamage: number): number {
        const stats = TowerData[type];
        if (!stats) return baseDamage;
        
        if (type === 'Bomb') {
            if (level === 19) return 4500;
            if (level === 20) return 13500;
            return baseDamage + ((level - 1) * stats.damagePerLevel);
        }
        
        let dmg = baseDamage + (level * stats.damagePerLevel);
        if (stats.damageLevelBonus) {
            dmg += level * stats.damageLevelBonus;
        }
        return dmg;
    },

    /** Berechnet die Reichweite für ein bestimmtes Level */
    getRangeForLevel(type: string, baseRange: number): number {
        const stats = TowerData[type];
        if (!stats) return baseRange;
        return baseRange + stats.rangePerLevel;
    },

    /** Berechnet die Feuerrate für ein bestimmtes Level */
    getFireRateForLevel(type: string, level: number, currentFireRate: number): number {
        const stats = TowerData[type];
        if (!stats) return currentFireRate;
        
        if (type === 'Base') {
            const attackSpeed = 1.0 + 9.0 * (level - 1) / (Config.TOWER_MAX_LEVEL - 1);
            return 60 / attackSpeed;
        } else if (type === 'Bomb') {
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
    }
};

