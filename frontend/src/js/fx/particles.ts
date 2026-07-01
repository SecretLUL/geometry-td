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
