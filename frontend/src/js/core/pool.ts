/*
 * @file: frontend\src\js\core\pool.ts
 * @purpose: Highly optimized object pooling system to reuse visual elements (particles, projectiles, floating text, shockwaves). Includes logic to merge nearby gold pop-ups.
 * @dependencies: fx, projectiles, types, config
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
 * @last_update: 2026-05-29 / v2.4.2 - Added overlapping RadiationArea merging to prevent neon-green screen overlay stacking under heavy combat.
 */
import { Particle, FloatingText, StunRay, MuzzleFlash, SniperBeam, RadiationArea, Shockwave, TeslaArc } from '../fx/fx';
import { Projectile } from '../entities/projectiles';
import { Enemy, Tower, Vector2D } from '../types';
import { Config } from './config';

function parseGoldText(text: string): { amount: number, isBounty: boolean } | null {
    const match = text.match(/^\+(\d+)g(\s+Bounty)?$/i);
    if (!match) return null;
    return {
        amount: parseInt(match[1], 10),
        isBounty: !!match[2]
    };
}


class ObjectPool<T extends { active: boolean }> {
    private pool: T[];
    private nextIdx = 0;

    constructor(createFn: () => T, size: number) {
        this.pool = [];
        for (let i = 0; i < size; i++) {
            this.pool.push(createFn());
        }
    }

    public get(): T {
        const item = this.pool[this.nextIdx];
        this.nextIdx = (this.nextIdx + 1) % this.pool.length;
        return item;
    }

    public getArray(): T[] {
        return this.pool;
    }
}

export const PoolManager = {
    particles: null as any as ObjectPool<Particle>,
    projectiles: null as any as ObjectPool<Projectile>,
    floatingTexts: null as any as ObjectPool<FloatingText>,
    stunRays: null as any as ObjectPool<StunRay>,
    muzzleFlashes: null as any as ObjectPool<MuzzleFlash>,
    sniperBeams: null as any as ObjectPool<SniperBeam>,
    radiationAreas: null as any as ObjectPool<RadiationArea>,
    shockwaves: null as any as ObjectPool<Shockwave>,
    teslaArcs: null as any as ObjectPool<TeslaArc>,

    // Combined lists for polymorphic state arrays
    stunEffectsList: [] as any[],
    groundEffectsList: [] as any[],

    init(): void {
        console.log("Initializing Global Object Pools...");
        this.particles = new ObjectPool<Particle>(() => new Particle(), 2000);
        this.projectiles = new ObjectPool<Projectile>(() => new Projectile(), 500);
        this.floatingTexts = new ObjectPool<FloatingText>(() => new FloatingText(), 200);
        this.stunRays = new ObjectPool<StunRay>(() => new StunRay(), 50);
        this.muzzleFlashes = new ObjectPool<MuzzleFlash>(() => new MuzzleFlash(), 50);
        this.sniperBeams = new ObjectPool<SniperBeam>(() => new SniperBeam(), 50);
        this.teslaArcs = new ObjectPool<TeslaArc>(() => new TeslaArc(), 80);
        this.radiationAreas = new ObjectPool<RadiationArea>(() => new RadiationArea(), 50);
        this.shockwaves = new ObjectPool<Shockwave>(() => new Shockwave(), 50);

        // Pre-populate combined stunEffects array
        this.stunEffectsList = [
            ...this.stunRays.getArray(),
            ...this.muzzleFlashes.getArray(),
            ...this.sniperBeams.getArray(),
            ...this.teslaArcs.getArray()
        ];

        // Pre-populate combined groundEffects array
        this.groundEffectsList = [
            ...this.radiationAreas.getArray(),
            ...this.shockwaves.getArray()
        ];
    },

    getParticle(x: number, y: number, color: string, speed: number, size: number): Particle {
        return this.particles.get().init(x, y, color, speed, size);
    },

    getProjectile(
        x: number,
        y: number,
        target: Enemy | Vector2D | null,
        damage: number,
        tower: Tower | null = null,
        aoeRadius = 0,
        speed: number | null = null,
        bounceCount = 0,
        isCluster = false
    ): Projectile {
        return this.projectiles.get().init(x, y, target, damage, tower, aoeRadius, speed, bounceCount, isCluster);
    },

    getFloatingText(x: number, y: number, text: string, color: string): FloatingText {
        const newParsed = parseGoldText(text);
        if (newParsed) {
            const array = this.floatingTexts.getArray();
            const radius = Config.TILE_SIZE * 1.5;
            const radiusSq = radius * radius;

            for (let i = 0; i < array.length; i++) {
                const ft = array[i];
                if (ft.active && ft.isGold) {
                    const dx = ft.x - x;
                    const dy = ft.y - y;
                    const distSq = dx * dx + dy * dy;
                    if (distSq <= radiusSq) {
                        const currentParsed = parseGoldText(ft.text);
                        if (currentParsed) {
                            const totalAmount = currentParsed.amount + newParsed.amount;
                            const isBounty = currentParsed.isBounty || newParsed.isBounty;

                            // Weighted average position
                            ft.x = (ft.x * currentParsed.amount + x * newParsed.amount) / totalAmount;
                            ft.y = (ft.y * currentParsed.amount + y * newParsed.amount) / totalAmount;

                            // Update text and properties
                            ft.text = `+${totalAmount}g${isBounty ? ' Bounty' : ''}`;
                            ft.color = isBounty ? '#ffb703' : '#fca311';
                            ft.life = Math.min(1.0, ft.life + 0.4);
                            ft.scale = Math.min(2.8, 1.8 + (totalAmount * 0.015)); // scale pop dynamically
                            ft.isGold = true;

                            return ft;
                        }
                    }
                }
            }
        }

        return this.floatingTexts.get().init(x, y, text, color);
    },

    getStunRay(startX: number, startY: number, targetX: number, targetY: number): StunRay {
        return this.stunRays.get().init(startX, startY, targetX, targetY);
    },

    getMuzzleFlash(x: number, y: number, angle: number, color = '#fff'): MuzzleFlash {
        return this.muzzleFlashes.get().init(x, y, angle, color);
    },

    getSniperBeam(startX: number, startY: number, targetX: number, targetY: number, color = '#a0d8ef'): SniperBeam {
        return this.sniperBeams.get().init(startX, startY, targetX, targetY, color);
    },

    getTeslaArc(startX: number, startY: number, targetX: number, targetY: number, color = '#00ffff'): TeslaArc {
        return this.teslaArcs.get().init(startX, startY, targetX, targetY, color);
    },

    getRadiationArea(x: number, y: number, radius: number, damagePerTick: number, lifeTime = 240, tower: Tower | null = null): RadiationArea {
        const array = this.radiationAreas.getArray();
        const mergeThreshold = 30; // pixels
        const mergeThresholdSq = mergeThreshold * mergeThreshold;

        for (let i = 0; i < array.length; i++) {
            const ra = array[i];
            if (ra.active) {
                const dx = ra.x - x;
                const dy = ra.y - y;
                const distSq = dx * dx + dy * dy;
                if (distSq <= mergeThresholdSq) {
                    ra.life = 1.0; // Refresh lifetime
                    ra.damage = Math.max(ra.damage, damagePerTick);
                    ra.radius = Math.max(ra.radius, radius);
                    ra.tower = tower;
                    if (ra.graphics) {
                        ra.graphics.visible = true;
                    }
                    return ra;
                }
            }
        }

        return this.radiationAreas.get().init(x, y, radius, damagePerTick, lifeTime, tower);
    },

    getShockwave(x: number, y: number, maxRadius: number, color = '#fff'): Shockwave {
        return this.shockwaves.get().init(x, y, maxRadius, color);
    },

    reset(): void {
        if (this.particles) {
            for (let p of this.particles.getArray()) p.active = false;
            for (let p of this.projectiles.getArray()) {
                p.active = false;
                p.trailHead = 0;
                p.trailCount = 0;
                p.hitEnemies.length = 0;
            }
            for (let p of this.floatingTexts.getArray()) p.active = false;
            for (let p of this.stunRays.getArray()) p.active = false;
            for (let p of this.muzzleFlashes.getArray()) p.active = false;
            for (let p of this.sniperBeams.getArray()) p.active = false;
            for (let p of this.teslaArcs.getArray()) p.active = false;
            for (let p of this.radiationAreas.getArray()) p.active = false;
            for (let p of this.shockwaves.getArray()) p.active = false;
        }
    }
};

