/*
 * @file: frontend/src/js/entities/towers/prisma-hud-renderer.ts
 * @purpose: Handles target HUD reticle and hit spark drawing for the Prisma Tower.
 * @dependencies: pixi.js
 */
import * as PIXI from "pixi.js";

export function drawTargetReticle(
  g: PIXI.Graphics,
  x2: number,
  y2: number,
  targetId: number,
  colorNum: number,
  progress: number,
  widthMultiplier: number,
  isSplit: boolean,
  animTime: number
): void {
  // --- HOLOGRAPHIC TARGETING RETICLE (HEXAGON HUD) ---
  const targetRadius = (isSplit ? 8 : 11 + progress * 22) * widthMultiplier;

  g.circle(x2, y2, targetRadius).stroke({
    color: colorNum,
    alpha: isSplit ? 0.2 : 0.1 + progress * 0.15,
    width: 1.0,
  });

  g.circle(x2, y2, targetRadius * 0.82).stroke({
    color: colorNum,
    alpha: isSplit ? 0.3 : 0.2 + progress * 0.3,
    width: 1.2,
  });

  if (!isSplit) {
    const rot = animTime * 0.006;
    g.moveTo(x2 + targetRadius * Math.cos(rot), y2 + targetRadius * Math.sin(rot));
    for (let i = 1; i <= 6; i++) {
      const angle = rot + (i * Math.PI * 2) / 6;
      g.lineTo(x2 + targetRadius * Math.cos(angle), y2 + targetRadius * Math.sin(angle));
    }
    g.closePath();
    g.stroke({
      color: colorNum,
      alpha: 0.25 + progress * 0.35,
      width: 1.2,
    });

    const bracketRot = -animTime * 0.003;
    for (let i = 0; i < 3; i++) {
      const angle = bracketRot + (i * Math.PI * 2) / 3;
      const aStart = angle - 0.25;
      const aEnd = angle + 0.25;
      const bracketR = targetRadius * 1.2;

      g.moveTo(x2 + Math.cos(aStart) * bracketR, y2 + Math.sin(aStart) * bracketR);
      g.arc(x2, y2, bracketR, aStart, aEnd);
    }
    g.stroke({
      color: colorNum,
      alpha: 0.35 + progress * 0.45,
      width: 1.6,
    });
  }

  if (!isSplit && progress > 0.15) {
    const innerBound = targetRadius * 0.3;
    const outerBound = targetRadius * 0.75;
    const tickAlpha = 0.25 + progress * 0.5;
    const tickWidth = 1.0 * widthMultiplier;

    g.moveTo(x2 - outerBound, y2)
      .lineTo(x2 - innerBound, y2)
      .moveTo(x2 + innerBound, y2)
      .lineTo(x2 + outerBound, y2)
      .moveTo(x2, y2 - outerBound)
      .lineTo(x2, y2 - innerBound)
      .moveTo(x2, y2 + innerBound)
      .lineTo(x2, y2 + outerBound)
      .stroke({ color: 0xffffff, alpha: tickAlpha, width: tickWidth });
  }

  if (!isSplit && progress > 0.05) {
    const pulseProgress = (animTime * 0.003) % 1.0;
    const pulseRadius = targetRadius * (1.1 - pulseProgress * 0.9);
    g.circle(x2, y2, pulseRadius).stroke({
      color: colorNum,
      alpha: (1.0 - pulseProgress) * (0.35 + progress * 0.45),
      width: 1.2,
    });
  }

  const coreRadius = Math.max(3.0, targetRadius * 0.15);
  g.circle(x2, y2, coreRadius).fill({ color: 0xffffff, alpha: 0.4 + progress * 0.4 });
  g.circle(x2, y2, coreRadius).stroke({
    color: colorNum,
    alpha: 0.55 + progress * 0.35,
    width: 1.0,
  });

  if (!isSplit && progress > 0.35) {
    const flareSize = 14 * progress * widthMultiplier;
    const flareRot = animTime * 0.0015;

    for (let i = 0; i < 2; i++) {
      const angle = flareRot + (i * Math.PI) / 2;
      g.moveTo(x2 - Math.cos(angle) * flareSize, y2 - Math.sin(angle) * flareSize).lineTo(
        x2 + Math.cos(angle) * flareSize,
        y2 + Math.sin(angle) * flareSize
      );
    }
    g.stroke({
      color: 0xffffff,
      alpha: 0.55 * progress,
      width: 1.0 * widthMultiplier,
    });
  }

  drawTargetSparks(g, x2, y2, targetId, colorNum, progress, widthMultiplier, isSplit, animTime);
}

function drawTargetSparks(
  g: PIXI.Graphics,
  x2: number,
  y2: number,
  targetId: number,
  colorNum: number,
  progress: number,
  widthMultiplier: number,
  isSplit: boolean,
  animTime: number
): void {
  const sparkCount = isSplit ? 1 : Math.floor(2 + progress * 5);
  for (let i = 0; i < sparkCount; i++) {
    const seed = animTime * 0.005 + i * 1.5 + targetId;
    const sparkR = (isSplit ? 2.5 : 3.5 + (Math.sin(seed * 2.3) * 0.5 + 0.5) * 3) * widthMultiplier;
    const angle = seed * 3.7;
    const maxDist = isSplit ? 4 : 7 + progress * 16;

    const lifetime = 500;
    const tElapsed = (animTime + i * (lifetime / sparkCount)) % lifetime;
    const dist = (tElapsed / lifetime) * maxDist;
    const sx = x2 + Math.cos(angle) * dist;
    const sy = y2 + Math.sin(angle) * dist;
    g.circle(sx, sy, sparkR).fill({ color: colorNum, alpha: 0.85 * (1 - tElapsed / lifetime) });
  }
}
