/*
 * @file: frontend/src/js/entities/towers/prisma-renderer.ts
 * @purpose: Encapsulates detailed PIXI.js rendering code and visual effects for the Prisma Tower.
 * @dependencies: config, state, base-tower, types, prisma-base-renderer, prisma-beam-renderer
 */
import * as PIXI from "pixi.js";
import { Config } from "../../../core/config";
import { state } from "../../../core/state";
import { app, entitiesContainer } from "../../../core/game/viewport";
import type { PrismaTower } from "./prisma-tower";
import { drawPrismaPixi } from "./prisma-base-renderer";
import { drawPrismaBeams } from "./prisma-beam-renderer";

export class PrismaTowerRenderer {
  public tower: PrismaTower;

  public pixiBeamsGraphics?: PIXI.Graphics;
  public pixiBasePlatformGraphics?: PIXI.Graphics;
  public pixiShardGraphicsList: PIXI.Graphics[] = [];
  public pixiReactorPoolGraphics?: PIXI.Graphics;
  public pixiRing1Graphics?: PIXI.Graphics;
  public pixiRing2Graphics?: PIXI.Graphics;
  public pixiStandardRingGraphics?: PIXI.Graphics;
  public pixiTurretCoreGraphics?: PIXI.Graphics;
  public pixiTurretOrbitGraphics?: PIXI.Graphics;

  constructor(tower: PrismaTower) {
    this.tower = tower;
  }

  public initPixi(): void {
    if (typeof window === "undefined" || !app || !app.renderer) return;
    const isHeadlessMode = new URLSearchParams(window.location.search).get("headless") === "true";
    if (isHeadlessMode) return;

    if (!this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics = new PIXI.Graphics();
      entitiesContainer.addChild(this.pixiBeamsGraphics);
    }

    if (!this.tower.pixiSprite) return;

    if (!this.pixiBasePlatformGraphics) {
      this.pixiBasePlatformGraphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChildAt(this.pixiBasePlatformGraphics, 0); // behind turret
    }
    if (this.pixiShardGraphicsList.length === 0) {
      for (let i = 0; i < 3; i++) {
        const shard = new PIXI.Graphics();
        this.tower.pixiSprite.addChild(shard);
        this.pixiShardGraphicsList.push(shard);
      }
    }
    if (!this.pixiReactorPoolGraphics) {
      this.pixiReactorPoolGraphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiReactorPoolGraphics);
    }
    if (!this.pixiRing1Graphics) {
      this.pixiRing1Graphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiRing1Graphics);
    }
    if (!this.pixiRing2Graphics) {
      this.pixiRing2Graphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiRing2Graphics);
    }
    if (!this.pixiStandardRingGraphics) {
      this.pixiStandardRingGraphics = new PIXI.Graphics();
      this.tower.pixiSprite.addChild(this.pixiStandardRingGraphics);
    }
    if (!this.pixiTurretCoreGraphics) {
      this.pixiTurretCoreGraphics = new PIXI.Graphics();
      if (this.tower.pixiTurretGraphics) {
        this.tower.pixiTurretGraphics.addChild(this.pixiTurretCoreGraphics);
      }
    }
    if (!this.pixiTurretOrbitGraphics) {
      this.pixiTurretOrbitGraphics = new PIXI.Graphics();
      if (this.tower.pixiTurretGraphics) {
        this.tower.pixiTurretGraphics.addChild(this.pixiTurretOrbitGraphics);
      }
    }
  }

  public updatePixi(): void {
    if (this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics.clear();
      drawPrismaBeams(this, this.pixiBeamsGraphics);
    }

    const time = state.animTime;
    if (this.tower.constructionTimer <= 0) {
      if (
        this.pixiShardGraphicsList &&
        this.pixiShardGraphicsList.length > 0 &&
        this.tower.masteryUnlocked
      ) {
        const baseR = Config.TILE_SIZE / 2 - 4;
        for (let i = 0; i < 3; i++) {
          const shardG = this.pixiShardGraphicsList[i];
          const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6;
          const bob = Math.sin(time * 0.004 + (i * Math.PI * 2) / 3) * 2.5;
          const dist = baseR + 5 + bob;
          const sx = Math.cos(angle) * dist;
          const sy = Math.sin(angle) * dist;
          shardG.position.set(sx, sy);
        }
      }

      if (this.pixiReactorPoolGraphics && this.tower.masteryUnlocked) {
        const pulseSize = 1 + (Math.sin(time * 0.003) * 1.5) / (Config.TILE_SIZE / 4);
        this.pixiReactorPoolGraphics.scale.set(pulseSize);
      }

      if (this.pixiRing1Graphics && this.tower.masteryUnlocked) {
        this.pixiRing1Graphics.rotation = time * 0.0003;
      }
      if (this.pixiRing2Graphics && this.tower.masteryUnlocked) {
        this.pixiRing2Graphics.rotation = -time * 0.0004;
      }

      if (this.pixiStandardRingGraphics && !this.tower.masteryUnlocked) {
        this.pixiStandardRingGraphics.rotation = -time * 0.003;
      }

      if (this.tower.masteryUnlocked) {
        const isFiring =
          this.tower.target && state.enemiesSet.has(this.tower.target) && this.tower.target.hp > 0;
        const rotSpeed = isFiring ? time * 0.0035 : time * 0.001;

        if (this.pixiTurretCoreGraphics) {
          const corePulse = 1.0 + 0.15 * Math.sin(time * 0.005);
          this.pixiTurretCoreGraphics.scale.set(corePulse);
        }
        if (this.pixiTurretOrbitGraphics) {
          this.pixiTurretOrbitGraphics.rotation = rotSpeed;
        }
      }
    }
  }

  public drawPixi(g: PIXI.Graphics, part: "base" | "turret"): void {
    drawPrismaPixi(this, g, part);
  }

  public destroy(): void {
    if (this.pixiBeamsGraphics) {
      this.pixiBeamsGraphics.destroy();
      this.pixiBeamsGraphics = undefined;
    }
  }
}
