import { state } from '../core/state';
import { PoolManager } from '../core/pool';
import { app, entitiesContainer } from '../core/game/viewport';
import * as PIXI from 'pixi.js';

let _particleTexture: PIXI.Texture | null = null;
function getParticleTexture() {
    if (!_particleTexture && typeof window !== 'undefined' && app && app.renderer) {
        const g = new PIXI.Graphics().rect(-5, -5, 10, 10).fill({ color: 0xffffff, alpha: 1 });
        _particleTexture = app.renderer.generateTexture(g);
    }
    return _particleTexture || PIXI.Texture.WHITE;
}

// ─── Particle ───────────────────────────────────────────────────────────────
export class Particle {
    public x!: number;
    public y!: number;
    public vx!: number;
    public vy!: number;
    public life!: number;
    public decay!: number;
    public color!: string;
    public size!: number;
    public active: boolean = false;
    public sprite?: PIXI.Sprite;

    constructor(x = 0, y = 0, color = '', speed = 0, size = 0) {
        if (x !== 0 || y !== 0 || color !== '') {
            this.init(x, y, color, speed, size);
        } else {
            this.x = 0;
            this.y = 0;
            this.vx = 0;
            this.vy = 0;
            this.life = 0;
            this.decay = 0;
            this.color = '';
            this.size = 0;
            this.active = false;
        }
    }

    public init(x: number, y: number, color: string, speed: number, size: number): this {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.05 + 0.02;
        this.color = color;
        this.size = size;
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.sprite) {
                this.sprite = new PIXI.Sprite(getParticleTexture());
                this.sprite.anchor.set(0.5);
                entitiesContainer.addChild(this.sprite);
            }
            this.sprite.visible = true;
            this.sprite.tint = color; 
            this.sprite.width = size * 2;
            this.sprite.height = size * 2;
            this.sprite.x = this.x;
            this.sprite.y = this.y;
            this.sprite.alpha = this.life;
        }
        return this;
    }

    public update(): void {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;

        if (this.sprite) {
            this.sprite.x = this.x;
            this.sprite.y = this.y;
            this.sprite.alpha = Math.max(0, this.life);
        }

        if (this.life <= 0) {
            this.active = false;
            if (this.sprite) this.sprite.visible = false;
        }
    }

    public draw(): void {}
}

// ─── FloatingText ────────────────────────────────────────────────────────────
export class FloatingText {
    public x!: number;
    public y!: number;
    public text!: string;
    public color!: string;
    public life!: number;
    public vy!: number;
    public vx!: number;
    public scale!: number;
    public isGold!: boolean;
    public active: boolean = false;
    public textObj?: PIXI.Text;

    constructor(x = 0, y = 0, text = '', color = '') {
        if (x !== 0 || y !== 0 || text !== '') {
            this.init(x, y, text, color);
        } else {
            this.x = 0;
            this.y = 0;
            this.text = '';
            this.color = '';
            this.life = 0;
            this.vy = 0;
            this.vx = 0;
            this.scale = 0;
            this.isGold = false;
            this.active = false;
        }
    }

    public init(x: number, y: number, text: string, color: string): this {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -1.2;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.scale = 1.8;
        this.isGold = (text.includes('+') && text.includes('g')) || color === '#fca311' || color === '#ffd700';
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.textObj) {
                this.textObj = new PIXI.Text({
                    text: this.text,
                    style: {
                        fontFamily: 'Outfit, sans-serif',
                        fontSize: 20,
                        fontWeight: 'bold',
                        fill: this.color,
                        dropShadow: {
                            alpha: 0.4,
                            blur: 0,
                            color: 0x000000,
                            distance: 2
                        }
                    }
                });
                this.textObj.anchor.set(0.5);
                entitiesContainer.addChild(this.textObj);
            } else {
                this.textObj.text = this.text;
                this.textObj.style.fill = this.color;
            }
            this.textObj.visible = true;
            this.textObj.x = this.x;
            this.textObj.y = this.y;
            this.textObj.alpha = this.life;
            this.textObj.scale.set(this.scale);
        }
        return this;
    }

    public update(): void {
        if (!this.active) return;
        this.x += this.vx;
        this.y += this.vy;
        this.vy *= 0.98;
        this.life -= 0.015;
        if (this.scale > 1) this.scale -= 0.05;

        if (this.textObj) {
            this.textObj.text = this.text; 
            this.textObj.style.fill = this.color;
            this.textObj.x = this.x;
            this.textObj.y = this.y;
            this.textObj.alpha = Math.max(0, this.life);
            const currentScale = Math.max(0.1, this.scale * (0.9 + this.life * 0.1));
            this.textObj.scale.set(currentScale);
        }

        if (this.life <= 0) {
            this.active = false;
            if (this.textObj) this.textObj.visible = false;
        }
    }

    public draw(): void {}
}

export function createExplosion(x: number, y: number, color: string, count: number): void {
    const finalCount = state.perfMode ? Math.min(2, Math.floor(count / 5)) : count;
    for (let i = 0; i < finalCount; i++) {
        PoolManager.getParticle(x, y, color, 5, Math.random() * 4 + 1);
    }
}

export function createCoinBurst(x: number, y: number, count: number): void {
    const finalCount = state.perfMode ? Math.min(2, Math.floor(count / 4)) : count;
    for (let i = 0; i < finalCount; i++) {
        const p = PoolManager.getParticle(x, y, '#ffd700', 8, Math.random() * 3 + 1);
        p.vy -= 2;
    }
}

// ─── StunRay ─────────────────────────────────────────────────────────────────
export class StunRay {
    public startX!: number;
    public startY!: number;
    public targetX!: number;
    public targetY!: number;
    public life!: number;
    public color!: string;
    public active: boolean = false;
    public graphics?: PIXI.Graphics;

    constructor(startX = 0, startY = 0, targetX = 0, targetY = 0) {
        if (startX !== 0 || startY !== 0 || targetX !== 0 || targetY !== 0) {
            this.init(startX, startY, targetX, targetY);
        } else {
            this.startX = 0;
            this.startY = 0;
            this.targetX = 0;
            this.targetY = 0;
            this.life = 0;
            this.color = '#ffff00';
            this.active = false;
        }
    }

    public init(startX: number, startY: number, targetX: number, targetY: number): this {
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.life = 1.0;
        this.color = '#ffff00';
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.graphics) {
                this.graphics = new PIXI.Graphics();
                entitiesContainer.addChild(this.graphics);
            }
            this.graphics.visible = true;
            this.redrawGraphics();
        }
        return this;
    }

    private redrawGraphics() {
        if (!this.graphics) return;
        const g = this.graphics;
        g.clear();
        if (this.life <= 0) return;

        const segments = 5;
        const pts: { x: number, y: number }[] = [];
        pts.push({ x: this.startX, y: this.startY });
        
        for (let i = 1; i < segments; i++) {
            const tx = this.startX + (this.targetX - this.startX) * (i / segments);
            const ty = this.startY + (this.targetY - this.startY) * (i / segments);
            const offset = (Math.random() - 0.5) * 15;
            pts.push({ x: tx + offset, y: ty + offset });
        }
        pts.push({ x: this.targetX, y: this.targetY });

        const drawPath = (color: string, width: number, alpha: number) => {
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                g.lineTo(pts[i].x, pts[i].y);
            }
            g.stroke({ color, width, alpha });
        };

        drawPath(this.color, 8 * this.life, this.life * 0.35);
        drawPath(this.color, 4 * this.life, this.life * 0.7);
        drawPath('#ffffff', 1.5 * this.life, this.life);
    }

    public update(): void {
        if (!this.active) return;
        this.life -= 0.05;

        if (this.graphics) {
            this.redrawGraphics();
        }

        if (this.life <= 0) {
            this.active = false;
            if (this.graphics) this.graphics.visible = false;
        }
    }

    public draw(): void {}
}

// ─── MuzzleFlash ─────────────────────────────────────────────────────────────
export class MuzzleFlash {
    public x!: number;
    public y!: number;
    public angle!: number;
    public life!: number;
    public color!: string;
    public size!: number;
    public active: boolean = false;
    public graphics?: PIXI.Graphics;

    constructor(x = 0, y = 0, angle = 0, color = '#fff') {
        if (x !== 0 || y !== 0 || angle !== 0) {
            this.init(x, y, angle, color);
        } else {
            this.x = 0;
            this.y = 0;
            this.angle = 0;
            this.life = 0;
            this.color = '#fff';
            this.size = 0;
            this.active = false;
        }
    }

    public init(x: number, y: number, angle: number, color = '#fff'): this {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.life = 1.0;
        this.color = color;
        this.size = Math.random() * 10 + 20;
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.graphics) {
                this.graphics = new PIXI.Graphics();
                entitiesContainer.addChild(this.graphics);
            }
            this.graphics.visible = true;
            this.graphics.x = this.x;
            this.graphics.y = this.y;
            this.graphics.rotation = this.angle;
            this.redrawGraphics();
        }
        return this;
    }

    private redrawGraphics() {
        if (!this.graphics) return;
        const g = this.graphics;
        g.clear();
        if (this.life <= 0) return;

        g.alpha = this.life;

        g.circle(0, 0, this.size * 0.7).fill({ color: this.color });
        g.circle(0, 0, this.size * 0.3).fill({ color: '#ffffff' });

        for (let i = 0; i < 3; i++) {
            const a = (Math.random() - 0.5) * 0.8;
            const len = this.size * (1.5 + Math.random());
            g.moveTo(0, 0);
            g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
            g.stroke({ color: '#ffffff', width: 2 });
        }
    }

    public update(): void {
        if (!this.active) return;
        this.life -= 0.15;
        if (this.graphics) {
            this.redrawGraphics();
        }
        if (this.life <= 0) {
            this.active = false;
            if (this.graphics) this.graphics.visible = false;
        }
    }

    public draw(): void {}
}

// ─── SniperBeam ──────────────────────────────────────────────────────────────
export class SniperBeam {
    public startX!: number;
    public startY!: number;
    public targetX!: number;
    public targetY!: number;
    public life!: number;
    public color!: string;
    public active: boolean = false;
    public graphics?: PIXI.Graphics;

    constructor(startX = 0, startY = 0, targetX = 0, targetY = 0, color = '#a0d8ef') {
        if (startX !== 0 || startY !== 0 || targetX !== 0 || targetY !== 0) {
            this.init(startX, startY, targetX, targetY, color);
        } else {
            this.startX = 0;
            this.startY = 0;
            this.targetX = 0;
            this.targetY = 0;
            this.life = 0;
            this.color = color;
            this.active = false;
        }
    }

    public init(startX: number, startY: number, targetX: number, targetY: number, color = '#a0d8ef'): this {
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.life = 1.0;
        this.color = color;
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.graphics) {
                this.graphics = new PIXI.Graphics();
                entitiesContainer.addChild(this.graphics);
            }
            this.graphics.visible = true;
            this.redrawGraphics();
        }
        return this;
    }

    private redrawGraphics() {
        if (!this.graphics) return;
        const g = this.graphics;
        g.clear();
        if (this.life <= 0) return;

        const drawPath = (color: string, width: number, alpha: number) => {
            g.moveTo(this.startX, this.startY);
            g.lineTo(this.targetX, this.targetY);
            g.stroke({ color, width, alpha });
        };

        drawPath(this.color, 10, this.life * 0.2);
        drawPath(this.color, 5, this.life * 0.5);
        drawPath('#ffffff', 1.5, this.life);
    }

    public update(): void {
        if (!this.active) return;
        this.life -= 0.08;
        if (this.graphics) {
            this.redrawGraphics();
        }
        if (this.life <= 0) {
            this.active = false;
            if (this.graphics) this.graphics.visible = false;
        }
    }

    public draw(): void {}
}

// ─── TeslaArc ─────────────────────────────────────────────────────────────
export class TeslaArc {
    public startX!: number;
    public startY!: number;
    public targetX!: number;
    public targetY!: number;
    public life!: number;
    public color!: string;
    public active: boolean = false;
    public graphics?: PIXI.Graphics;

    constructor(startX = 0, startY = 0, targetX = 0, targetY = 0, color = '#00ffff') {
        if (startX !== 0 || startY !== 0 || targetX !== 0 || targetY !== 0) {
            this.init(startX, startY, targetX, targetY, color);
        } else {
            this.startX = 0;
            this.startY = 0;
            this.targetX = 0;
            this.targetY = 0;
            this.life = 0;
            this.color = color;
            this.active = false;
        }
    }

    public init(startX: number, startY: number, targetX: number, targetY: number, color = '#00ffff'): this {
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.life = 1.0;
        this.color = color;
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.graphics) {
                this.graphics = new PIXI.Graphics();
                entitiesContainer.addChild(this.graphics);
            }
            this.graphics.visible = true;
            this.redrawGraphics();
        }
        return this;
    }

    private redrawGraphics() {
        if (!this.graphics) return;
        const g = this.graphics;
        g.clear();
        if (this.life <= 0) return;

        // Draw a beautiful jagged electric arc with 5 segments
        const segments = 5;
        const pts: { x: number, y: number }[] = [];
        pts.push({ x: this.startX, y: this.startY });
        
        const dx = this.targetX - this.startX;
        const dy = this.targetY - this.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Normal vector for offset direction
            const nx = -dy / distance;
            const ny = dx / distance;
            
            for (let i = 1; i < segments; i++) {
                const ratio = i / segments;
                const tx = this.startX + dx * ratio;
                const ty = this.startY + dy * ratio;
                // Scale offset by distance so short arcs are less jagged, and long arcs are suitably jagged
                const maxOffset = Math.min(20, distance * 0.12);
                const offset = (Math.random() - 0.5) * maxOffset * 2;
                pts.push({ x: tx + nx * offset, y: ty + ny * offset });
            }
        }
        pts.push({ x: this.targetX, y: this.targetY });

        const drawPath = (color: string, width: number, alpha: number) => {
            g.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) {
                g.lineTo(pts[i].x, pts[i].y);
            }
            g.stroke({ color, width, alpha });
        };

        // Draw multiple passes for a gorgeous neon glow
        drawPath(this.color, 12 * this.life, this.life * 0.15); // Neon glow outer
        drawPath(this.color, 5 * this.life, this.life * 0.45);  // Neon glow inner
        drawPath('#ffffff', 1.5 * this.life, this.life * 0.95);  // Intense hot core
    }

    public update(): void {
        if (!this.active) return;
        this.life -= 0.12; // Electric arcs vanish quickly (approx 8 frames at 60 FPS)

        if (this.graphics) {
            this.redrawGraphics();
        }

        if (this.life <= 0) {
            this.active = false;
            if (this.graphics) this.graphics.visible = false;
        }
    }

    public draw(): void {}
}


// ─── RadiationArea ───────────────────────────────────────────────────────────
export class RadiationArea {
    public x!: number;
    public y!: number;
    public radius!: number;
    public damage!: number;
    public life!: number;
    public decay!: number;
    public pulse!: number;
    public active: boolean = false;
    public tower: any = null;
    public graphics?: PIXI.Graphics;

    constructor(x = 0, y = 0, radius = 0, damagePerTick = 0, lifeTime = 240) {
        if (x !== 0 || y !== 0 || radius !== 0) {
            this.init(x, y, radius, damagePerTick, lifeTime);
        } else {
            this.x = 0;
            this.y = 0;
            this.radius = 0;
            this.damage = 0;
            this.life = 0;
            this.decay = 0;
            this.pulse = 0;
            this.active = false;
            this.tower = null;
        }
    }

    public init(x: number, y: number, radius: number, damagePerTick: number, lifeTime = 240, tower: any = null): this {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.damage = damagePerTick;
        this.life = 1.0;
        this.decay = 1.0 / lifeTime;
        this.pulse = 0;
        this.active = true;
        this.tower = tower;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.graphics) {
                this.graphics = new PIXI.Graphics();
                entitiesContainer.addChild(this.graphics);
            }
            this.graphics.visible = true;
            this.redrawGraphics();
        }
        return this;
    }

    private redrawGraphics() {
        if (!this.graphics) return;
        const g = this.graphics;
        g.clear();
        if (this.life <= 0) return;

        // Soft global alpha fading over time
        g.alpha = Math.max(0, this.life * 0.6);
        const p = Math.sin(this.pulse) * 4;
        const radius = this.radius + p;

        // Softer transparent inner fill
        g.circle(this.x, this.y, radius).fill({ color: 0xbadc58, alpha: 0.05 });

        // Sleek outer edge ring
        g.circle(this.x, this.y, radius).stroke({ color: 0xbadc58, alpha: 0.25, width: 1.5 });
    }

    public update(): void {
        if (!this.active) return;
        this.life -= this.decay;
        this.pulse += 0.1;

        if (this.graphics) {
            this.redrawGraphics();
        }

        if (this.life <= 0) {
            this.active = false;
            if (this.graphics) this.graphics.visible = false;
            return;
        }

        if (state.isHost && Math.floor(this.life * 100) % 10 === 0) {
            const radiusSq = this.radius * this.radius;
            for (let enemy of state.enemies) {
                if (enemy.hp <= 0 || enemy.deadMarked) continue;
                const dx = enemy.x - this.x;
                const dy = enemy.y - this.y;
                if ((dx * dx + dy * dy) <= radiusSq) {
                    const actualDmg = enemy.takeDamage(this.damage, this.tower);
                    if (this.tower) {
                        this.tower.damageDealt += actualDmg;
                    }
                    if (enemy.hp <= 0 && this.tower && !enemy.deadMarked) {
                        enemy.deadMarked = true;
                        this.tower.kills++;
                    }
                }
            }
        }

        const sparkChance = state.perfMode ? 0.02 : 0.15;
        if (Math.random() < sparkChance) {
            const limit = state.perfMode ? 50 : 300;
            let activeCount = 0;
            for (let i = 0; i < state.particles.length; i++) {
                if (state.particles[i].active) activeCount++;
            }
            if (activeCount < limit) {
                const ang = Math.random() * Math.PI * 2;
                const dist = Math.random() * this.radius;
                PoolManager.getParticle(this.x + Math.cos(ang) * dist, this.y + Math.sin(ang) * dist, '#badc58', 1.5, 2);
            }
        }
    }

    public draw(): void {}
}

// ─── Shockwave ───────────────────────────────────────────────────────────────
export class Shockwave {
    public x!: number;
    public y!: number;
    public radius!: number;
    public maxRadius!: number;
    public life!: number;
    public speed!: number;
    public color!: string;
    public active: boolean = false;
    public graphics?: PIXI.Graphics;

    constructor(x = 0, y = 0, maxRadius = 0, color = '#fff') {
        if (x !== 0 || maxRadius !== 0) {
            this.init(x, y, maxRadius, color);
        } else {
            this.x = 0;
            this.y = 0;
            this.radius = 0;
            this.maxRadius = 0;
            this.life = 0;
            this.speed = 4;
            this.color = '#fff';
            this.active = false;
        }
    }

    public init(x: number, y: number, maxRadius: number, color = '#fff'): this {
        this.x = x;
        this.y = y;
        this.radius = 0;
        this.maxRadius = maxRadius;
        this.life = 1.0;
        this.speed = 4;
        this.color = color;
        this.active = true;

        if (typeof window !== 'undefined' && app.renderer) {
            if (!this.graphics) {
                this.graphics = new PIXI.Graphics();
                entitiesContainer.addChild(this.graphics);
            }
            this.graphics.visible = true;
            this.redrawGraphics();
        }
        return this;
    }

    private redrawGraphics() {
        if (!this.graphics) return;
        const g = this.graphics;
        g.clear();
        if (this.life <= 0) return;

        const isCustomColor = this.color !== '#fff';
        const mainAlpha = this.life * (isCustomColor ? 0.8 : 0.5);
        const mainWidth = isCustomColor ? 5 : 3;

        g.circle(this.x, this.y, this.radius).stroke({ color: this.color, alpha: mainAlpha, width: mainWidth });

        if (isCustomColor) {
            g.circle(this.x, this.y, this.radius).stroke({ color: '#ffffff', alpha: this.life * 0.9, width: 1.5 });
        }
    }

    public update(): void {
        if (!this.active) return;
        this.radius += this.speed;
        this.life = 1.0 - (this.radius / this.maxRadius);
        
        if (this.graphics) {
            this.redrawGraphics();
        }

        if (this.life <= 0) {
            this.active = false;
            if (this.graphics) this.graphics.visible = false;
        }
    }

    public draw(): void {}
}
