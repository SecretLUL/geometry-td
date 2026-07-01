/*
 * @file: frontend/src/js/core/config/enemies.ts
 * @purpose: Static configuration data for enemy types and waves.
 * @last_update: 2026-07-01 / Refactored into a separate module.
 */

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
