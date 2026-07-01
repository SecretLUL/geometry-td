import { app, entitiesContainer, inactivePoolContainer } from "../core/game/viewport";
import * as PIXI from "pixi.js";

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
