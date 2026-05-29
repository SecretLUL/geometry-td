/*
 * @file: frontend\src\js\types.ts
 * @purpose: Core TypeScript interface and type definitions for state, vectors, entities (Enemy, Tower, Projectile), and socket messages.
 * @dependencies: None
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
 * @last_update: 2026-05-28 / v1.9.0 - Added optional webRTCStatus property to GameState interface.
 */
/**
 * Geometry Tower Defense - Core TypeScript Definitions
 * Phase 1 Infrastructure Types
 */

// ─── GAME STATE TYPES ─────────────────────────────────────────────────────────

export interface GameState {
    isHost: boolean;
    lives: number;
    gold: number;
    wave: number;
    totalGoldEarned: number;
    totalGoldFromInterest: number;
    recordWave: number | string;
    isWaveActive: boolean;
    gameOver: boolean;
    isPaused: boolean;
    wasPaused: boolean;
    gameSpeed: number;
    autoStartActive: boolean;
    godMode: boolean;
    infiniteGold: boolean;
    waveModified: boolean;
    benchmarkActive: boolean;
    benchmarkBackup: any | null;
    selectedTowerType: string | null;   // null = no tower selected (placement mode off)
    camera: Vector2D;

    // Ghost / placement cursor state
    ghostMouse: Vector2D;               // canvas-space mouse coords
    lastClientMouse: Vector2D;           // client-space (for UI positioning)
    hoveredTower: Tower | null;         // Tower currently under mouse cursor
    hoveredEnemy: Enemy | null;         // Enemy currently under mouse cursor

    enemies: Enemy[];
    towers: Tower[];
    projectiles: Projectile[];
    particles: any[];
    floatingTexts: any[];
    stunEffects: any[];                  // Boss stun rays / FX
    groundEffects: any[];                // Napalm, Shockwaves, Radiation, etc.

    enemiesToSpawn: number;
    spawnCooldown: number;
    screenDamageEffect: number;
    screenShake: number;
    shopHoveredType: string | null;
    animTime: number;
    enemyGrid?: Map<number, Enemy[]>;
    projectileEvents?: any[];
    enemyPool?: any;
    perfMode?: boolean;
    showFps?: boolean;
    contextShopCell?: { col: number; row: number } | null;
    centerCameraOnCell?: (col: number, row: number) => void;
    targetCamera?: Vector2D | null;
    contextShopPos?: Vector2D | null;
    webRTCStatus?: 'connected' | 'connecting' | 'failed' | 'idle';
    mapNeedsRedraw?: boolean;
}

export interface Vector2D {
    x: number;
    y: number;
}

// ─── ENEMY ENTITY TYPES ───────────────────────────────────────────────────────

export type EnemyType = 'Base' | 'Normal' | 'Scout' | 'Bruiser' | 'Regrower' | 'Shielded' | 'Boss' | 'Collector' | 'Fortress' | 'Splinter' | 'SplinterFragment' | 'Defragmenter' | 'DefragmenterFragment' | 'DefragmenterSubfragment' | 'Swarm';

export interface Enemy {
    id: number;
    x: number;
    y: number;
    targetWaypointIndex: number;
    distanceTravelled: number;
    flashTime: number;
    pulseTime: number;
    rotation: number;
    deadMarked: boolean;
    waveNumber: number;
    typeName: EnemyType;
    radius: number;
    color: string;
    speed: number;
    maxHp: number;
    hp: number;
    reward: number;
    shieldActive: boolean;
    stunTimer: number;
    stunCooldown: number;
    hideHealthBar?: boolean;
    lastDamageParticleTime?: number;
    spawnFrames?: number;
    swarmGroupId?: number;
    damageSources?: Map<any, number>;

    // Regrower / Heal traits
    healTimer?: number;

    // Boss traits
    abilityTimer?: number;
    nextAbility?: 'spawn' | 'stun';
    outerRotation?: number;
    stunRange?: number;
    specialAbility?: string;

    // Fortress traits
    maxShieldHp?: number;
    shieldHp?: number;
    regenTimer?: number;
    incomingDamage?: number;
    pixiSprite?: any;

    // Instance Methods
    initHp(): void;
    takeDamage(amount: number, source?: any): number;
    drawShape(g: any): void;
    draw(): void;
    updatePixi(): void;
    update(): 'stunned' | 'reached_end' | 'moving';
    checkHover(mouseX: number, mouseY: number): boolean;
}

// ─── TOWER ENTITY TYPES ───────────────────────────────────────────────────────

export type TowerType = 'Base' | 'Sniper' | 'Bomb' | 'Tesla' | 'Prisma';
export type TowerSpecialization = 'heavy' | 'missiles' | 'ricochet' | 'bounty' | 'cluster' | 'nuke' | 'highvolt' | 'stun' | 'meltdown' | 'refraction';

export interface Tower {
    col: number;
    row: number;
    x: number;
    y: number;
    type: TowerType;
    kills: number;
    damageDealt: number;
    level: number;
    range: number;
    damage: number;
    fireRate: number;
    fireCooldown: number;
    missileCooldown: number;
    projectileSpeed: number;
    stunTimer: number;
    target: Enemy | null;
    angle: number;
    recoil: number;
    totalSpent: number;
    upgradeCost: number;
    specialization: TowerSpecialization | null;
    masteryUnlocked: boolean;
    colors: string[];
    currentColor: string;

    // Visual timers/helper fields
    auraTime?: number;                  // Tesla Visual Effect Timer
    beamTarget?: Enemy | null;           // Sniper beam target tracking
    constructionTimer?: number;
    constructionDuration?: number;

    // Client-Side Prediction support
    isPredicted?: boolean;
    predictionTime?: number;
    predictedCost?: number;
    pixiSprite?: any;

    // Instance Methods
    getNearbyEnemies(x: number, y: number, radius: number): Enemy[];
    getDisplayDamage(): number | string;
    getDisplayFireRate(): string;
    rescale(): void;
    upgrade(updateUICallback?: () => void, silent?: boolean): boolean;
    getSpecializationInfo(specId: TowerSpecialization, isMastery?: boolean): string;
    getSpecializations(): Array<{ id: TowerSpecialization; name: string; desc: string }>;
    applySpecialization(specId: TowerSpecialization, silent?: boolean): void;
    drawPixi(g: any, part: 'base' | 'turret'): void;
    redrawPixiBase(): void;
    redrawPixiTurret(): void;
    initPixi(): void;
    updatePixi(): void;
    update(): void;
    findOptimalTarget(): Enemy | null;
    _acquireAndFire(): void;
    checkHover(mouseX: number, mouseY: number): boolean;
}

// ─── PROJECTILE ENTITY TYPES ─────────────────────────────────────────────────

export interface Projectile {
    x: number;
    y: number;
    target: Enemy | Vector2D | null;
    targetPoint?: Vector2D;
    damage: number;
    tower: Tower | null;
    aoeRadius: number;
    speed: number;
    active: boolean;
    trailX: Float32Array;
    trailY: Float32Array;
    trailHead: number;
    trailCount: number;
    bounceCount: number;
    isCluster: boolean;
    hitEnemies: Enemy[];
    isHoming: boolean;
    angle: number;
    pixiSprite?: any;

    // Instance Methods
    draw(): void;
    drawRocket(): void;
    drawBomb(): void;
    getNearbyEnemies(): Enemy[];
    getTrailArray(): Vector2D[];
    processKill(): void;
    update(): void;
}

// ─── MULTIPLAYER SOCKET & COMPRESSION PACKET TYPES ───────────────────────────

export interface SyncEnemyState {
    id: number;
    typeName: EnemyType;
    hp: number;
    distanceTravelled: number;
    targetWaypointIndex: number;
    x: number;
    y: number;
    wave?: number;
    speed: number;
    shieldActive: boolean;
    maxHp: number;
    swarmGroupId?: number;
}

export type ProjectileEventType = 'projectile' | 'sniper' | 'tesla';

export interface ProjectileEvent {
    type: ProjectileEventType;
    col: number;
    row: number;
    targetId?: number | null;
    targetPoint?: Vector2D;
    startX?: number;
    startY?: number;
    offsetX?: number;
    offsetY?: number;
    aoeRadius?: number;
    projectileSpeed?: number;
    isHoming?: boolean;
    isCluster?: boolean;
    trail?: Vector2D[];
    targetIds?: number[];          // Sniper bounce lists or Tesla chains
    specialization?: string;       // Ricochet or electric chain modifiers
    damage?: number;               // Visual sorting score helper
}

export interface SyncTowerState {
    col: number;
    row: number;
    type: TowerType;
    level?: number;
    specId?: TowerSpecialization | null;
    damageDealt?: number;
    totalSpent?: number;
}

/** Complete state emitted by the Host (e.g. at 20Hz sync interval) */
export interface SyncFullGameStatePayload {
    hostTileSize: number;
    activeEnemies: SyncEnemyState[];
    enemiesToSpawn: number;
    spawnCooldown: number;
    enemyPool: string[];
    isWaveActive: boolean;
    autoStartActive: boolean;
    wave: number;
    lives: number;
    gold: number;
    screenDamageEffect: number;
    benchmarkActive: boolean;
    projectileEvents?: ProjectileEvent[];
    tick?: number;
    timestamp?: number;
    localTimestamp?: number;
    towers?: SyncTowerState[];
}

/** Delta compressed update sent between clients to minimize bandwidth */
export interface SyncDeltaGameStatePayload {
    tick: number;
    timestamp: number;
    hostTileSize?: number;
    enemyDelta: Array<Partial<SyncEnemyState> & { id: number }>;
    deletedEnemyIds: number[];
    projectileEvents?: ProjectileEvent[];

    // Optional changed singular states
    enemiesToSpawn?: number;
    spawnCooldown?: number;
    wave?: number;
    isWaveActive?: boolean;
    autoStartActive?: boolean;
    lives?: number;
    gold?: number;
    enemyPool?: string[];
    screenDamageEffect?: number;
    benchmarkActive?: boolean;
    towers?: SyncTowerState[];
}

/** Outer envelope wrapping game state synchronizations */
export interface GameStateSocketPayload {
    fullSync?: boolean;
    delta?: boolean;
    state: SyncFullGameStatePayload | SyncDeltaGameStatePayload;
}

/** Type map mapping all multiplayer events to their strict payloads */
export interface SocketEventMap {
    // Connection
    'join_mission': string; // Map name
    'ready_to_play': void;

    // Setup and Admin
    'role_assigned': { isHost: boolean; iceServers?: RTCIceServer[] };
    'connect_error': void;
    'player_count_update': number;

    // Late Join full setup load
    'full_game_state': SyncFullGameStatePayload & {
        towers: SyncTowerState[];
        isPaused?: boolean;
        gameSpeed?: number;
        godModeActive?: boolean;
        infiniteGoldActive?: boolean;
        waveModified?: boolean;
        playerCount?: number;
        hostId?: string | null;
    };

    // General sync events
    'sync_complete': void;
    'sync_game_state': GameStateSocketPayload;

    // Host Authoritative requests (Clients -> Host)
    'request_place_tower': { type: TowerType; col: number; row: number };
    'request_upgrade_tower': { col: number; row: number; specId?: TowerSpecialization | null };
    'request_sell_tower': { col: number; row: number };

    // Host Authoritative confirmations (Host -> Clients)
    'confirm_place_tower': { type: TowerType; col: number; row: number };
    'reject_place_tower': { type: TowerType; col: number; row: number };
    'confirm_upgrade_tower': { col: number; row: number; specId?: TowerSpecialization | null; level?: number };
    'confirm_sell_tower': { col: number; row: number };

    // Control broadcasts
    'toggle_pause': boolean;
    'change_speed': number;
    'toggle_mod': { mod: 'godMode' | 'infiniteGold' | 'waveModified'; value: boolean };
    'toggle_auto': boolean;
    'start_wave_sync': any;
    'sync_lives': number;
    'sync_gold': number;
    'sync_towers': SyncTowerState[];
}
