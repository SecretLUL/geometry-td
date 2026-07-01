import { app, entitiesContainer, inactivePoolContainer } from "../core/game/viewport";
import * as PIXI from "pixi.js";
import { state } from "../core/state";
import { PoolManager } from "../core/pool";

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

  constructor(x = 0, y = 0, angle = 0, color = "#fff") {
    if (x !== 0 || y !== 0 || angle !== 0) {
      this.init(x, y, angle, color);
    } else {
      this.x = 0;
      this.y = 0;
      this.angle = 0;
      this.life = 0;
      this.color = "#fff";
      this.size = 0;
      this.active = false;
    }
  }

  public init(x: number, y: number, angle: number, color = "#fff"): this {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 10 + 20;
    this.active = true;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.graphics) {
        this.graphics = new PIXI.Graphics();
      }
      entitiesContainer.addChild(this.graphics);
      this.graphics.visible = true;
      this.graphics.x = this.x;
      this.graphics.y = this.y;
      this.graphics.rotation = this.angle;

      // Draw once, scale via alpha
      const g = this.graphics;
      g.clear();
      g.circle(0, 0, this.size * 0.7).fill({ color: this.color });
      g.circle(0, 0, this.size * 0.3).fill({ color: "#ffffff" });

      for (let i = 0; i < 3; i++) {
        const a = (Math.random() - 0.5) * 0.8;
        const len = this.size * (1.5 + Math.random());
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        g.stroke({ color: "#ffffff", width: 2 });
      }
    }
    return this;
  }

  public update(): void {
    if (!this.active) return;
    this.life -= 0.15;
    if (this.graphics) {
      this.graphics.alpha = this.life;
    }
    if (this.life <= 0) {
      this.active = false;
      if (this.graphics) inactivePoolContainer.addChild(this.graphics);
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

  public init(
    x: number,
    y: number,
    radius: number,
    damagePerTick: number,
    lifeTime = 240,
    tower: any = null
  ): this {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.damage = damagePerTick;
    this.life = 1.0;
    this.decay = 1.0 / lifeTime;
    this.pulse = 0;
    this.active = true;
    this.tower = tower;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.graphics) {
        this.graphics = new PIXI.Graphics();
      }
      entitiesContainer.addChild(this.graphics);
      this.graphics.visible = true;

      // Draw once, radius 100
      const g = this.graphics;
      g.clear();
      g.circle(0, 0, 100).fill({ color: 0xbadc58, alpha: 0.05 });
      g.circle(0, 0, 100).stroke({ color: 0xbadc58, alpha: 0.25, width: 1.5 });
      g.x = this.x;
      g.y = this.y;
      g.scale.set(this.radius / 100);
      g.alpha = 0.6;
    }
    return this;
  }

  public update(): void {
    if (!this.active) return;
    this.life -= this.decay;
    this.pulse += 0.1;

    if (this.graphics) {
      const p = Math.sin(this.pulse) * 4;
      const currentRadius = this.radius + p;
      this.graphics.scale.set(currentRadius / 100);
      this.graphics.alpha = Math.max(0, this.life * 0.6);
    }

    if (this.life <= 0) {
      this.active = false;
      if (this.graphics) inactivePoolContainer.addChild(this.graphics);
      return;
    }

    if (state.isHost && Math.floor(this.life * 100) % 10 === 0) {
      const radiusSq = this.radius * this.radius;
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0 || enemy.deadMarked) continue;
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        if (dx * dx + dy * dy <= radiusSq) {
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
        PoolManager.getParticle(
          this.x + Math.cos(ang) * dist,
          this.y + Math.sin(ang) * dist,
          "#badc58",
          1.5,
          2
        );
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

  constructor(x = 0, y = 0, maxRadius = 0, color = "#fff") {
    if (x !== 0 || maxRadius !== 0) {
      this.init(x, y, maxRadius, color);
    } else {
      this.x = 0;
      this.y = 0;
      this.radius = 0;
      this.maxRadius = 0;
      this.life = 0;
      this.speed = 4;
      this.color = "#fff";
      this.active = false;
    }
  }

  public init(x: number, y: number, maxRadius: number, color = "#fff"): this {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.maxRadius = maxRadius;
    this.life = 1.0;
    this.speed = 4;
    this.color = color;
    this.active = true;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.graphics) {
        this.graphics = new PIXI.Graphics();
      }
      entitiesContainer.addChild(this.graphics);
      this.graphics.visible = true;

      // Draw once, radius 100
      const g = this.graphics;
      g.clear();
      const isCustomColor = this.color !== "#fff";
      const mainWidth = isCustomColor ? 5 : 3;
      g.circle(0, 0, 100).stroke({ color: this.color, alpha: 1, width: mainWidth });

      if (isCustomColor) {
        g.circle(0, 0, 100).stroke({ color: "#ffffff", alpha: 1, width: 1.5 });
      }
      g.x = this.x;
      g.y = this.y;
      g.scale.set(0);
    }
    return this;
  }

  public update(): void {
    if (!this.active) return;
    this.radius += this.speed;
    this.life = 1.0 - this.radius / this.maxRadius;

    if (this.graphics) {
      const isCustomColor = this.color !== "#fff";
      const mainAlpha = this.life * (isCustomColor ? 0.8 : 0.5);
      this.graphics.scale.set(this.radius / 100);
      this.graphics.alpha = mainAlpha;
    }

    if (this.life <= 0) {
      this.active = false;
      if (this.graphics) inactivePoolContainer.addChild(this.graphics);
    }
  }

  public draw(): void {}
}
