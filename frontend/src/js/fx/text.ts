import { app, entitiesContainer, inactivePoolContainer } from "../core/game/viewport";
import * as PIXI from "pixi.js";
import { createGoldMergeBurst } from "./bursts";

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
