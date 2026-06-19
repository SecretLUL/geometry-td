import { state } from "../core/state";
import { PoolManager } from "../core/pool";
import { app, entitiesContainer, inactivePoolContainer } from "../core/game/viewport";
import * as PIXI from "pixi.js";

let _particleTexture: PIXI.Texture | null = null;
function getParticleTexture() {
  if (!_particleTexture && typeof window !== "undefined" && app && app.renderer) {
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

  public gravity: number = 0;
  public rotationSpeed: number = 0;
  public wobbleSpeed: number = 0;
  public wobble: number = 0;

  constructor(x = 0, y = 0, color = "", speed = 0, size = 0) {
    if (x !== 0 || y !== 0 || color !== "") {
      this.init(x, y, color, speed, size);
    } else {
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.life = 0;
      this.decay = 0;
      this.color = "";
      this.size = 0;
      this.gravity = 0;
      this.rotationSpeed = 0;
      this.wobbleSpeed = 0;
      this.wobble = 0;
      this.active = false;
    }
  }

  public init(x: number, y: number, color: string, speed: number, size: number, gravity = 0): this {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * speed;
    this.vy = (Math.random() - 0.5) * speed;
    this.life = 1.0;
    this.decay = Math.random() * 0.05 + 0.02;
    this.color = color;
    this.size = size;
    this.gravity = gravity;
    this.rotationSpeed = 0;
    this.wobbleSpeed = 0;
    this.wobble = 0;
    this.active = true;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.sprite) {
        this.sprite = new PIXI.Sprite(getParticleTexture());
        this.sprite.anchor.set(0.5);
      }
      entitiesContainer.addChild(this.sprite);
      this.sprite.visible = true;
      this.sprite.tint = color;
      this.sprite.width = size * 2;
      this.sprite.height = size * 2;
      this.sprite.x = this.x;
      this.sprite.y = this.y;
      this.sprite.alpha = this.life;
      this.sprite.rotation = 0;
      const texWidth = getParticleTexture().width || 10;
      const texHeight = getParticleTexture().height || 10;
      this.sprite.scale.x = (size * 2) / texWidth;
      this.sprite.scale.y = (size * 2) / texHeight;
    }
    return this;
  }

  public update(): void {
    if (!this.active) return;
    this.x += this.vx;
    this.vy += this.gravity;
    this.y += this.vy;
    this.life -= this.decay;

    if (this.wobbleSpeed) {
      this.wobble += this.wobbleSpeed;
      this.x += Math.sin(this.wobble) * 0.8;
    }

    if (this.sprite) {
      this.sprite.x = this.x;
      this.sprite.y = this.y;
      this.sprite.alpha = Math.max(0, this.life);
      if (this.rotationSpeed) {
        this.sprite.rotation += this.rotationSpeed;
      }
      if (this.wobbleSpeed) {
        const texWidth = getParticleTexture().width || 10;
        const baseScale = (this.size * 2) / texWidth;
        this.sprite.scale.x = Math.sin(this.wobble) * baseScale;
      }
    }

    if (this.life <= 0) {
      this.active = false;
      if (this.sprite) inactivePoolContainer.addChild(this.sprite);
    }
  }

  public draw(): void {}
}

// ─── FloatingText ────────────────────────────────────────────────────────────
let _standardGoldGradient: PIXI.FillGradient | null = null;
let _bountyGoldGradient: PIXI.FillGradient | null = null;
let _bankGoldGradient: PIXI.FillGradient | null = null;

function getStandardGoldGradient(): PIXI.FillGradient | string {
  if (typeof window !== "undefined" && typeof PIXI !== "undefined" && PIXI.FillGradient) {
    if (!_standardGoldGradient) {
      _standardGoldGradient = new PIXI.FillGradient({
        type: "linear",
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: "#ffe5a3" },
          { offset: 1, color: "#fca311" },
        ],
        textureSpace: "local",
      });
    }
    return _standardGoldGradient;
  }
  return "#fca311";
}

function getBountyGoldGradient(): PIXI.FillGradient | string {
  if (typeof window !== "undefined" && typeof PIXI !== "undefined" && PIXI.FillGradient) {
    if (!_bountyGoldGradient) {
      _bountyGoldGradient = new PIXI.FillGradient({
        type: "linear",
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: "#fff3b0" },
          { offset: 1, color: "#ffb703" },
        ],
        textureSpace: "local",
      });
    }
    return _bountyGoldGradient;
  }
  return "#ffb703";
}

function getBankGoldGradient(): PIXI.FillGradient | string {
  if (typeof window !== "undefined" && typeof PIXI !== "undefined" && PIXI.FillGradient) {
    if (!_bankGoldGradient) {
      _bankGoldGradient = new PIXI.FillGradient({
        type: "linear",
        start: { x: 0, y: 0 },
        end: { x: 0, y: 1 },
        colorStops: [
          { offset: 0, color: "#ffffff" },
          { offset: 1, color: "#ffd700" },
        ],
        textureSpace: "local",
      });
    }
    return _bankGoldGradient;
  }
  return "#ffd700";
}

const GOLD_STROKE_CONFIG = { color: "#1a0f00", width: 3 };
const GOLD_SHADOW_CONFIG = {
  alpha: 0.6,
  blur: 3,
  color: 0x000000,
  distance: 2,
  angle: Math.PI / 4,
};
const NORMAL_SHADOW_CONFIG = {
  alpha: 0.4,
  blur: 0,
  color: 0x000000,
  distance: 2,
  angle: Math.PI / 4,
};

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

  public scaleForce: number = 0;
  public targetScale: number = 1.0;

  constructor(x = 0, y = 0, text = "", color = "") {
    if (x !== 0 || y !== 0 || text !== "") {
      this.init(x, y, text, color);
    } else {
      this.x = 0;
      this.y = 0;
      this.text = "";
      this.color = "";
      this.life = 0;
      this.vy = 0;
      this.vx = 0;
      this.scale = 0;
      this.isGold = false;
      this.active = false;
    }
  }

  private getGoldGradient(): any {
    if (this.text.includes("Bounty") || this.color === "#ffb703") {
      return getBountyGoldGradient();
    }
    if (this.text.includes("Bank") || this.color === "#ffd700") {
      return getBankGoldGradient();
    }
    return getStandardGoldGradient();
  }

  public init(x: number, y: number, text: string, color: string): this {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 1.0;
    this.vy = -1.5;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.isGold =
      (text.includes("+") && text.includes("g")) ||
      color === "#fca311" ||
      color === "#ffd700" ||
      color === "#ffb703";
    this.active = true;

    this.scale = 0.4;
    this.scaleForce = 0.25; // Pop velocity kick
    this.targetScale = this.isGold ? 1.4 : 1.0;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.textObj) {
        this.textObj = new PIXI.Text({
          text: this.text.toLowerCase(),
          style: {
            fontFamily: "BLADRMF_.TTF",
            fontSize: this.isGold ? 22 : 20,
            fontWeight: this.isGold ? "900" : "bold",
            fill: this.isGold ? this.getGoldGradient() : this.color,
            stroke: this.isGold ? GOLD_STROKE_CONFIG : undefined,
            dropShadow: this.isGold ? GOLD_SHADOW_CONFIG : NORMAL_SHADOW_CONFIG,
          },
        });
        this.textObj.anchor.set(0.5);
      } else {
        this.textObj.text = this.text.toLowerCase();
        this.textObj.style.fontFamily = "BLADRMF_.TTF";
        this.textObj.style.fontSize = this.isGold ? 22 : 20;
        this.textObj.style.fontWeight = this.isGold ? "900" : "bold";
        this.textObj.style.fill = this.isGold ? this.getGoldGradient() : this.color;
        this.textObj.style.stroke = this.isGold ? GOLD_STROKE_CONFIG : (undefined as any);
        this.textObj.style.dropShadow = this.isGold ? GOLD_SHADOW_CONFIG : NORMAL_SHADOW_CONFIG;
      }
      entitiesContainer.addChild(this.textObj);
      this.textObj.visible = true;
      this.textObj.x = this.x;
      this.textObj.y = this.y;
      this.textObj.alpha = this.life;
      this.textObj.scale.set(this.scale);
    }
    return this;
  }

  public merge(newAmount: number, suffix: string, fromX: number, fromY: number): void {
    this.text = `+${newAmount}g${suffix}`;

    if (suffix.includes("Bounty")) {
      this.color = "#ffb703";
    } else if (suffix.includes("Bank")) {
      this.color = "#ffd700";
    } else {
      this.color = "#fca311";
    }

    // Add to lifetime (refresh up to a max of 1.0)
    this.life = Math.min(1.0, this.life + 0.35);

    // Spring target scale grows slightly with amount to feel powerful
    this.targetScale = Math.min(2.4, 1.4 + newAmount * 0.008);

    // Spike scale for a strong pop animation, adding outward spring force
    this.scale = this.targetScale * 1.5;
    this.scaleForce = 0.2;

    if (this.textObj) {
      this.textObj.text = this.text.toLowerCase();
      this.textObj.style.fontFamily = "BLADRMF_.TTF";
      this.textObj.style.fontSize = 22;
      this.textObj.style.fontWeight = "900";
      this.textObj.style.fill = this.getGoldGradient();
      this.textObj.style.stroke = GOLD_STROKE_CONFIG;
      this.textObj.style.dropShadow = GOLD_SHADOW_CONFIG;
    }

    // Spawn particles at the merge source (coin location)
    createGoldMergeBurst(fromX, fromY, 4);
    // Spawn particles at the merge destination (text location)
    createGoldMergeBurst(this.x, this.y, 4);
  }

  public update(): void {
    if (!this.active) return;
    this.x += this.vx;
    this.y += this.vy;
    this.vy *= 0.98;
    this.life -= this.isGold ? 0.012 : 0.015; // gold texts linger a tiny bit longer

    // Spring-mass calculation for scale pop/bounce
    const k = 0.16; // spring constant
    const d = 0.82; // damping factor
    this.scaleForce += (this.targetScale - this.scale) * k;
    this.scaleForce *= d;
    this.scale += this.scaleForce;

    if (this.textObj) {
      this.textObj.x = this.x;
      this.textObj.y = this.y;
      this.textObj.alpha = Math.max(0, this.life);

      // scale shrinks slightly as it fades (life factor)
      const currentScale = Math.max(0.1, this.scale * (0.85 + this.life * 0.15));
      this.textObj.scale.set(currentScale);
    }

    if (this.life <= 0) {
      this.active = false;
      if (this.textObj) inactivePoolContainer.addChild(this.textObj);
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
    const p = PoolManager.getParticle(x, y, "#ffd700", 8, Math.random() * 3 + 1);
    p.vy -= 2;
  }
}

export function createGoldMergeBurst(x: number, y: number, count: number): void {
  const colors = ["#ffe066", "#ffd700", "#fca311", "#ffb703"];
  const finalCount = state.perfMode ? Math.min(2, Math.floor(count / 2)) : count;
  for (let i = 0; i < finalCount; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speed = Math.random() * 3 + 1.5;
    const size = Math.random() * 2 + 1;
    const p = PoolManager.getParticle(x, y, color, speed, size, 0.08);
    p.vy = (Math.random() - 0.75) * speed; // upward bias
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

  private ptsX = new Float32Array(6);
  private ptsY = new Float32Array(6);

  constructor(startX = 0, startY = 0, targetX = 0, targetY = 0) {
    if (startX !== 0 || startY !== 0 || targetX !== 0 || targetY !== 0) {
      this.init(startX, startY, targetX, targetY);
    } else {
      this.startX = 0;
      this.startY = 0;
      this.targetX = 0;
      this.targetY = 0;
      this.life = 0;
      this.color = "#ffff00";
      this.active = false;
    }
  }

  public init(startX: number, startY: number, targetX: number, targetY: number): this {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.life = 1.0;
    this.color = "#ffff00";
    this.active = true;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.graphics) {
        this.graphics = new PIXI.Graphics();
      }
      entitiesContainer.addChild(this.graphics);
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

    this.ptsX[0] = this.startX;
    this.ptsY[0] = this.startY;

    for (let i = 1; i < segments; i++) {
      const tx = this.startX + (this.targetX - this.startX) * (i / segments);
      const ty = this.startY + (this.targetY - this.startY) * (i / segments);
      const offset = (Math.random() - 0.5) * 15;
      this.ptsX[i] = tx + offset;
      this.ptsY[i] = ty + offset;
    }
    this.ptsX[segments] = this.targetX;
    this.ptsY[segments] = this.targetY;

    const drawPath = (color: string, width: number, alpha: number) => {
      g.moveTo(this.ptsX[0], this.ptsY[0]);
      for (let i = 1; i <= segments; i++) {
        g.lineTo(this.ptsX[i], this.ptsY[i]);
      }
      g.stroke({ color, width, alpha });
    };

    drawPath(this.color, 8 * this.life, this.life * 0.35);
    drawPath(this.color, 4 * this.life, this.life * 0.7);
    drawPath("#ffffff", 1.5 * this.life, this.life);
  }

  public update(): void {
    if (!this.active) return;
    this.life -= 0.05;

    if (this.graphics) {
      this.redrawGraphics();
    }

    if (this.life <= 0) {
      this.active = false;
      if (this.graphics) inactivePoolContainer.addChild(this.graphics);
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

  constructor(startX = 0, startY = 0, targetX = 0, targetY = 0, color = "#a0d8ef") {
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

  public init(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    color = "#a0d8ef"
  ): this {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.life = 1.0;
    this.color = color;
    this.active = true;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.graphics) {
        this.graphics = new PIXI.Graphics();
      }
      entitiesContainer.addChild(this.graphics);
      this.graphics.visible = true;

      // Draw once
      const g = this.graphics;
      g.clear();
      const drawPath = (color: string, width: number, alpha: number) => {
        g.moveTo(this.startX, this.startY);
        g.lineTo(this.targetX, this.targetY);
        g.stroke({ color, width, alpha });
      };

      drawPath(this.color, 10, 0.2);
      drawPath(this.color, 5, 0.5);
      drawPath("#ffffff", 1.5, 1.0);
      g.alpha = 1.0;
    }
    return this;
  }

  public update(): void {
    if (!this.active) return;
    this.life -= 0.08;
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

  private ptsX = new Float32Array(6);
  private ptsY = new Float32Array(6);

  constructor(startX = 0, startY = 0, targetX = 0, targetY = 0, color = "#00ffff") {
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

  public init(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    color = "#00ffff"
  ): this {
    this.startX = startX;
    this.startY = startY;
    this.targetX = targetX;
    this.targetY = targetY;
    this.life = 1.0;
    this.color = color;
    this.active = true;

    if (typeof window !== "undefined" && app.renderer) {
      if (!this.graphics) {
        this.graphics = new PIXI.Graphics();
      }
      entitiesContainer.addChild(this.graphics);
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
    this.ptsX[0] = this.startX;
    this.ptsY[0] = this.startY;

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
        this.ptsX[i] = tx + nx * offset;
        this.ptsY[i] = ty + ny * offset;
      }
    } else {
      for (let i = 1; i < segments; i++) {
        this.ptsX[i] = this.startX;
        this.ptsY[i] = this.startY;
      }
    }
    this.ptsX[segments] = this.targetX;
    this.ptsY[segments] = this.targetY;

    const drawPath = (color: string, width: number, alpha: number) => {
      g.moveTo(this.ptsX[0], this.ptsY[0]);
      for (let i = 1; i <= segments; i++) {
        g.lineTo(this.ptsX[i], this.ptsY[i]);
      }
      g.stroke({ color, width, alpha });
    };

    // Draw multiple passes for a gorgeous neon glow
    drawPath(this.color, 12 * this.life, this.life * 0.15); // Neon glow outer
    drawPath(this.color, 5 * this.life, this.life * 0.45); // Neon glow inner
    drawPath("#ffffff", 1.5 * this.life, this.life * 0.95); // Intense hot core
  }

  public update(): void {
    if (!this.active) return;
    this.life -= 0.12; // Electric arcs vanish quickly (approx 8 frames at 60 FPS)

    if (this.graphics) {
      this.redrawGraphics();
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

export function createConfettiBurst(x: number, y: number): void {
  const colors = [
    "#ff007f",
    "#00f5d4",
    "#ffd700",
    "#ff00ff",
    "#0077ff",
    "#ccff00",
    "#ffb703",
    "#00ff88",
  ];
  const count = 250; // nice dense confetti
  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * colors.length)];
    const speed = Math.random() * 12 + 6; // wider spread speed
    const size = Math.random() * 6 + 5; // bigger particle sizes: 5 to 11 (width/height 10 to 22)
    const p = PoolManager.getParticle(
      x + (Math.random() - 0.5) * 150, // wider spawn area
      y + (Math.random() - 0.5) * 80,
      color,
      speed,
      size,
      0.08 // gentler gravity
    );
    // Shoot upwards (negative vy)
    p.vy = -Math.abs(p.vy) - Math.random() * 6;
    // Float longer
    p.decay = Math.random() * 0.006 + 0.004; // life lasts between ~100 and ~250 frames (approx 1.6 to 4 seconds)
    // Add random rotation and wobble for premium fluttering effect
    p.rotationSpeed = (Math.random() - 0.5) * 0.15;
    p.wobbleSpeed = Math.random() * 0.2 + 0.1;
    p.wobble = Math.random() * Math.PI * 2;
  }
}
