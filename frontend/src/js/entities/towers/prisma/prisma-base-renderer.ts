/*
 * @file: frontend/src/js/entities/towers/prisma-base-renderer.ts
 * @purpose: Handles base and turret geometry drawing for the Prisma Tower.
 * @dependencies: config, state, pixi.js, prisma-renderer
 */
import * as PIXI from "pixi.js";
import { Config, TowerData } from "../../../core/config";
import { state } from "../../../core/state";
import type { PrismaTowerRenderer } from "./prisma-renderer";

export function drawPrismaPixi(
  renderer: PrismaTowerRenderer,
  g: PIXI.Graphics,
  part: "base" | "turret"
): void {
  const tower = renderer.tower;
  const TS = Config.TILE_SIZE;
  let scale = 1;
  let progress = 0;

  if (tower.constructionTimer > 0) {
    progress = 1 - tower.constructionTimer / tower.constructionDuration;
    const c1 = 1.70158;
    const c3 = c1 + 1;
    scale = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

    if (part === "base") {
      const hueVal = (state.animTime + progress * 360) % 360;
      g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      g.stroke({ color: `hsl(${hueVal}, 100%, 65%)`, alpha: 0.3, width: 6 });

      g.arc(0, 0, TS / 2 + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      g.stroke({ color: `hsl(${hueVal}, 100%, 65%)`, alpha: 1, width: 3 });
    }
  }

  if (part === "base") {
    let baseColor = tower.currentColor;
    if (tower.specialization) {
      const spec = TowerData[tower.type].specializations[tower.specialization];
      if (spec) baseColor = spec.color;
    }

    const baseR = (TS / 2 - 4) * scale;
    const rotateOffset = tower.constructionTimer > 0 ? (1 - progress) * Math.PI * 2 : 0;

    if (tower.masteryUnlocked && tower.constructionTimer <= 0) {
      // Heavy Triangular Mastery Platform with Circuit Traces
      if (renderer.pixiBasePlatformGraphics) {
        renderer.pixiBasePlatformGraphics.clear();
        const platformG = renderer.pixiBasePlatformGraphics;
        for (let i = 0; i < 3; i++) {
          const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6;
          const px = Math.cos(angle) * baseR;
          const py = Math.sin(angle) * baseR;
          if (i === 0) platformG.moveTo(px, py);
          else platformG.lineTo(px, py);
        }
        platformG.closePath();
        platformG.fill({ color: baseColor });

        // Neon inner circuit triangle
        const innerR = baseR * 0.7;
        for (let i = 0; i < 3; i++) {
          const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6;
          const px = Math.cos(angle) * innerR;
          const py = Math.sin(angle) * innerR;
          if (i === 0) platformG.moveTo(px, py);
          else platformG.lineTo(px, py);
        }
        platformG.closePath();
        platformG.stroke({ color: 0xffffff, alpha: 0.35, width: 1.5 * scale });
      }

      // Central Glowing Reactor Containment Pool
      if (renderer.pixiReactorPoolGraphics) {
        renderer.pixiReactorPoolGraphics.clear();
        const poolG = renderer.pixiReactorPoolGraphics;
        const basePulseSize = TS / 4;
        poolG.circle(0, 0, basePulseSize).fill({ color: baseColor, alpha: 0.15 });
        poolG.circle(0, 0, basePulseSize).stroke({ color: baseColor, alpha: 0.4, width: 1 });
        poolG.circle(0, 0, basePulseSize * 0.6).fill({ color: "#ffffff", alpha: 0.25 });
      }

      // Counter-Rotating Calibration Rings
      if (renderer.pixiRing1Graphics && renderer.pixiRing2Graphics) {
        renderer.pixiRing1Graphics.clear();
        renderer.pixiRing2Graphics.clear();

        const r1 = (TS / 3) * scale;
        const r2 = (TS / 3 + 3.5) * scale;

        // Ring 1 (Dashed arcs)
        for (let j = 0; j < 4; j++) {
          const aStart = (j * Math.PI) / 2;
          const aEnd = aStart + Math.PI / 4;
          renderer.pixiRing1Graphics.moveTo(Math.cos(aStart) * r1, Math.sin(aStart) * r1);
          renderer.pixiRing1Graphics.arc(0, 0, r1, aStart, aEnd);
        }
        renderer.pixiRing1Graphics.stroke({ color: baseColor, alpha: 0.6, width: 1 });

        // Ring 2 (Dashed arcs)
        for (let j = 0; j < 4; j++) {
          const aStart = (j * Math.PI) / 2;
          const aEnd = aStart + Math.PI / 5;
          renderer.pixiRing2Graphics.moveTo(Math.cos(aStart) * r2, Math.sin(aStart) * r2);
          renderer.pixiRing2Graphics.arc(0, 0, r2, aStart, aEnd);
        }
        renderer.pixiRing2Graphics.stroke({ color: 0xffffff, alpha: 0.45, width: 0.8 });
      }

      if (renderer.pixiShardGraphicsList && renderer.pixiShardGraphicsList.length > 0) {
        const parsedColor = parseInt(baseColor.replace("#", "0x"), 16);
        for (let i = 0; i < 3; i++) {
          const shardG = renderer.pixiShardGraphicsList[i];
          shardG.clear();
          const shardSize = 3.5;
          shardG
            .moveTo(0, -shardSize)
            .lineTo(shardSize, 0)
            .lineTo(0, shardSize)
            .lineTo(-shardSize, 0)
            .closePath()
            .fill({ color: parsedColor })
            .stroke({ color: 0xffffff, width: 1 });
          shardG.visible = true;
        }
      }
      if (renderer.pixiReactorPoolGraphics) renderer.pixiReactorPoolGraphics.visible = true;
      if (renderer.pixiRing1Graphics) renderer.pixiRing1Graphics.visible = true;
      if (renderer.pixiRing2Graphics) renderer.pixiRing2Graphics.visible = true;
      if (renderer.pixiStandardRingGraphics) renderer.pixiStandardRingGraphics.visible = false;
    } else {
      // Standard triangular base
      for (let i = 0; i < 3; i++) {
        const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6 + rotateOffset;
        const px = Math.cos(angle) * baseR;
        const py = Math.sin(angle) * baseR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();

      g.fill({ color: baseColor });

      for (let i = 0; i < 3; i++) {
        const angle = ((Math.PI * 2) / 3) * i - Math.PI / 6 + rotateOffset;
        const px = Math.cos(angle) * baseR;
        const py = Math.sin(angle) * baseR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.stroke({ color: 0xffffff, alpha: 0.2, width: 1.5 });

      // Spinning base charging ring
      if (renderer.pixiStandardRingGraphics) {
        renderer.pixiStandardRingGraphics.clear();
        const segments = 12;
        for (let i = 0; i < segments; i++) {
          if (i % 2 === 0) {
            const a1 = (i / segments) * Math.PI * 2;
            const a2 = ((i + 1) / segments) * Math.PI * 2;
            renderer.pixiStandardRingGraphics.moveTo(
              ((Math.cos(a1) * TS) / 3) * scale,
              ((Math.sin(a1) * TS) / 3) * scale
            );
            renderer.pixiStandardRingGraphics.arc(0, 0, (TS / 3) * scale, a1, a2);
          }
        }
        renderer.pixiStandardRingGraphics.stroke({ color: baseColor, width: 1 });
        renderer.pixiStandardRingGraphics.visible = true;
      }

      if (renderer.pixiShardGraphicsList) {
        for (const shardG of renderer.pixiShardGraphicsList) {
          shardG.visible = false;
        }
      }
      if (renderer.pixiReactorPoolGraphics) renderer.pixiReactorPoolGraphics.visible = false;
      if (renderer.pixiRing1Graphics) renderer.pixiRing1Graphics.visible = false;
      if (renderer.pixiRing2Graphics) renderer.pixiRing2Graphics.visible = false;
    }

    // Level indicator
    if (tower.level > 1 && tower.pixiLevelText) {
      const badgeX = (TS / 2 - 11) * scale;
      const badgeY = (TS / 2 - 11) * scale;
      const size = 9.5 * scale;

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = badgeX + size * Math.cos(angle);
        const hy = badgeY + size * Math.sin(angle);
        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.closePath();

      g.fill({ color: "#0f172a", alpha: 0.85 });

      let borderColor = "#ffd700";
      if (tower.specialization === "meltdown") borderColor = "#e65f00";
      if (tower.specialization === "refraction") borderColor = "#00e699";

      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        const hx = badgeX + size * Math.cos(angle);
        const hy = badgeY + size * Math.sin(angle);
        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.closePath();
      g.stroke({ color: borderColor, width: 1.5 });

      tower.pixiLevelText.text = tower.level.toString();
      tower.pixiLevelText.position.set(badgeX, badgeY);
      tower.pixiLevelText.style.fill = borderColor;
      tower.pixiLevelText.visible = true;
    } else if (tower.pixiLevelText) {
      tower.pixiLevelText.visible = false;
    }
  }

  if (part === "turret") {
    const prismR = 10 * scale;

    if (tower.masteryUnlocked && tower.constructionTimer <= 0) {
      // Levitating Cluster of Highly Polished Shards/Crystals

      // Central core crystal
      if (renderer.pixiTurretCoreGraphics) {
        renderer.pixiTurretCoreGraphics.clear();
        const cR = prismR * 1.15;
        renderer.pixiTurretCoreGraphics
          .moveTo(cR * 1.3, 0)
          .lineTo(-cR * 0.7, cR * 0.8)
          .lineTo(-cR * 0.4, 0)
          .lineTo(-cR * 0.7, -cR * 0.8)
          .closePath()
          .fill({ color: tower.currentColor, alpha: 0.95 })
          .stroke({ color: 0xffffff, width: 1.5 * scale });

        // White inner diamond glow
        renderer.pixiTurretCoreGraphics
          .moveTo(cR * 0.8, 0)
          .lineTo(-cR * 0.4, cR * 0.4)
          .lineTo(-cR * 0.2, 0)
          .lineTo(-cR * 0.4, -cR * 0.4)
          .closePath()
          .fill({ color: "#ffffff", alpha: 0.8 });

        renderer.pixiTurretCoreGraphics.visible = true;
      }

      // Satellite shards & connection trace lines
      if (renderer.pixiTurretOrbitGraphics) {
        renderer.pixiTurretOrbitGraphics.clear();
        const orbitRadius = prismR * 1.7;
        for (let i = 0; i < 3; i++) {
          const orbAngle = (i * Math.PI * 2) / 3;
          const ox = Math.cos(orbAngle) * orbitRadius;
          const oy = Math.sin(orbAngle) * orbitRadius;

          const sSize = 3.5 * scale;
          const shardRot = orbAngle + Math.PI;

          const cosShard = Math.cos(shardRot);
          const sinShard = Math.sin(shardRot);
          const cosShard2 = Math.cos(shardRot + 2);
          const sinShard2 = Math.sin(shardRot + 2);
          const cosShardPI = Math.cos(shardRot + Math.PI);
          const sinShardPI = Math.sin(shardRot + Math.PI);
          const cosShardM2 = Math.cos(shardRot - 2);
          const sinShardM2 = Math.sin(shardRot - 2);

          renderer.pixiTurretOrbitGraphics
            .moveTo(ox + cosShard * sSize * 1.3, oy + sinShard * sSize * 1.3)
            .lineTo(ox + cosShard2 * sSize * 0.8, oy + sinShard2 * sSize * 0.8)
            .lineTo(ox + cosShardPI * sSize * 0.5, oy + sinShardPI * sSize * 0.5)
            .lineTo(ox + cosShardM2 * sSize * 0.8, oy + sinShardM2 * sSize * 0.8)
            .closePath()
            .fill({ color: tower.currentColor, alpha: 0.85 })
            .stroke({ color: 0xffffff, width: 1 * scale });

          // Draw trace line
          renderer.pixiTurretOrbitGraphics
            .moveTo(ox, oy)
            .lineTo(0, 0)
            .stroke({ color: tower.currentColor, alpha: 0.25, width: 0.8 * scale });
        }
        renderer.pixiTurretOrbitGraphics.visible = true;
      }
    } else {
      // Standard 2D prism diamond
      const crystalY = tower.constructionTimer > 0 ? -20 * (1 - progress) : 0;
      const crystalAngle = tower.constructionTimer > 0 ? (1 - progress) * Math.PI * 8 : 0;

      g.rotation = tower.angle + crystalAngle;

      for (let step = 0; step < 2; step++) {
        g.moveTo(prismR * 1.3, crystalY);
        g.lineTo(-prismR * 0.7, crystalY + prismR * 0.8);
        g.lineTo(-prismR * 0.4, crystalY);
        g.lineTo(-prismR * 0.7, crystalY - prismR * 0.8);
        g.closePath();

        if (step === 0) {
          g.fill({ color: tower.currentColor, alpha: 0.9 });
        } else {
          g.stroke({ color: 0xffffff, alpha: 1, width: 1 });
        }
      }

      if (renderer.pixiTurretCoreGraphics) renderer.pixiTurretCoreGraphics.visible = false;
      if (renderer.pixiTurretOrbitGraphics) renderer.pixiTurretOrbitGraphics.visible = false;
    }
  }
}
