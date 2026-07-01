/*
 * @file: frontend/src/js/entities/towers/prisma-beam-renderer.ts
 * @purpose: Handles laser beam drawing for the Prisma Tower.
 * @dependencies: config, state, fx, utils, types, pixi.js, prisma-renderer, prisma-hud-renderer
 */
import * as PIXI from "pixi.js";
import { TowerData } from "../../../core/config";
import { state } from "../../../core/state";
import { createExplosion } from "../../../fx/fx";
import { getDistanceSq } from "../../../core/utils";
import { Enemy } from "../../../types";
import { drawTargetReticle } from "./prisma-hud-renderer";
import type { PrismaTowerRenderer } from "./prisma-renderer";

const checkedEnemies = new Set<number>();

export function drawPrismaBeams(renderer: PrismaTowerRenderer, g: PIXI.Graphics): void {
  const tower = renderer.tower;
  if (tower.stunTimer > 0) return;

  let baseColor = tower.currentColor;
  if (tower.specialization) {
    const spec = TowerData[tower.type].specializations[tower.specialization];
    if (spec) baseColor = spec.color;
  }

  if (
    tower.fireCooldown <= 0 &&
    tower.target &&
    state.enemiesSet.has(tower.target) &&
    tower.target.hp > 0
  ) {
    const prismR = 10;
    const tipX = tower.x + Math.cos(tower.angle) * (prismR * 1.3);
    const tipY = tower.y + Math.sin(tower.angle) * (prismR * 1.3);
    drawLaserBeam(renderer, g, tipX, tipY, tower.target, baseColor, tower.lockTimer);
  }

  if (tower.specialization === "refraction") {
    const rangeSq = tower.range * tower.range;
    const nearby = tower.getNearbyEnemies(tower.x, tower.y, tower.range);
    let splits = 0;
    const maxSplits = tower.masteryUnlocked ? 6 : 3;
    checkedEnemies.clear();

    for (let i = 0; i < nearby.length; i++) {
      const enemy = nearby[i];
      if (!enemy || enemy.hp <= 0 || enemy.deadMarked) continue;
      if (checkedEnemies.has(enemy.id)) continue;
      checkedEnemies.add(enemy.id);

      if (tower.target && enemy === tower.target) continue;
      if (getDistanceSq(enemy.x, enemy.y, tower.x, tower.y) <= rangeSq) {
        drawLaserBeam(renderer, g, tower.x, tower.y, enemy, "#00ffcc", tower.lockTimer * 0.7, true);
        splits++;
        if (splits >= maxSplits) break;
      }
    }
  }
}

function drawLaserBeam(
  renderer: PrismaTowerRenderer,
  g: PIXI.Graphics,
  x1: number,
  y1: number,
  target: Enemy,
  colorStr: string,
  lockTime: number,
  isSplit = false
): void {
  const tower = renderer.tower;
  const x2 = target.x;
  const y2 = target.y;

  if (!state.isHost && !state.isPaused) {
    const enemy = target as any;
    if (state.animTime - (enemy.lastDamageParticleTime || 0) >= 6) {
      createExplosion(enemy.x, enemy.y, "#fca311", 2);
      enemy.lastDamageParticleTime = state.animTime;
    }
  }

  const progress = Math.min(1.0, lockTime / TowerData["Prisma"].prismaChargeFrames!);
  const widthMultiplier = isSplit ? 0.85 : 1.0 + progress * 2.0;
  const colorNum = parseInt(colorStr.replace("#", "0x"), 16);

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  // --- SPECIFIC VISUALS PER SPECIALIZATION ---
  const isMeltdown = tower.specialization === "meltdown" && !isSplit;
  const isRefraction = tower.specialization === "refraction" || isSplit;

  if (isRefraction && len > 5) {
    drawRefractionLaser(
      g,
      x1,
      y1,
      x2,
      y2,
      dx,
      dy,
      len,
      target.id,
      progress,
      widthMultiplier,
      state.animTime,
      isSplit
    );
  } else if (isMeltdown && len > 5) {
    drawMeltdownLaser(
      g,
      x1,
      y1,
      x2,
      y2,
      dx,
      dy,
      len,
      colorNum,
      progress,
      widthMultiplier,
      state.animTime
    );
  } else if (len > 5) {
    drawStandardLaser(
      g,
      x1,
      y1,
      x2,
      y2,
      dx,
      dy,
      len,
      colorNum,
      progress,
      widthMultiplier,
      state.animTime
    );
  }

  // --- MUZZLE FLARE (TOWER TIP EFFECTS) ---
  if (!isSplit && progress > 0.05) {
    drawMuzzleFlare(g, x1, y1, colorNum, progress, widthMultiplier, state.animTime);
  }

  // --- HOLOGRAPHIC TARGETING RETICLE (HEXAGON HUD) ---
  drawTargetReticle(
    g,
    x2,
    y2,
    target.id,
    colorNum,
    progress,
    widthMultiplier,
    isSplit,
    state.animTime
  );
}

function drawRefractionLaser(
  g: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dx: number,
  dy: number,
  len: number,
  targetId: number,
  progress: number,
  widthMultiplier: number,
  animTime: number,
  isSplit: boolean
): void {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const nx = -dy / len;
  const ny = dx / len;

  const curveDirection = targetId % 2 === 0 ? 1 : -1;
  const baseOffset = curveDirection * (len * 0.12);
  const shimmer = Math.sin(animTime * 0.02 + targetId) * 1.5;
  const finalOffset = baseOffset + shimmer;

  const cx = midX + nx * finalOffset;
  const cy = midY + ny * finalOffset;

  const refractionColor = isSplit ? 0x00ffcc : 0x00e699;

  // 1. Crystal Neon Aura
  g.moveTo(x1, y1)
    .quadraticCurveTo(cx, cy, x2, y2)
    .stroke({
      color: refractionColor,
      alpha: 0.15 + (isSplit ? 0.1 : progress * 0.15),
      width: (isSplit ? 7 : 11) * widthMultiplier,
      cap: "round",
    });

  // 2. Middle laser body
  g.moveTo(x1, y1)
    .quadraticCurveTo(cx, cy, x2, y2)
    .stroke({
      color: refractionColor,
      alpha: 0.5 + (isSplit ? 0.1 : progress * 0.25),
      width: (isSplit ? 3.5 : 5) * widthMultiplier,
      cap: "round",
    });

  // 3. Ultra white core
  g.moveTo(x1, y1)
    .quadraticCurveTo(cx, cy, x2, y2)
    .stroke({
      color: 0xffffff,
      alpha: 0.95,
      width: (isSplit ? 1.2 : 1.6) * widthMultiplier,
      cap: "round",
    });

  // Traveling Light Shards on Refraction curve
  const numShards = isSplit ? 1 : 2;
  for (let s = 0; s < numShards; s++) {
    const t = (animTime * (isSplit ? 0.002 : 0.003) + s / numShards) % 1.0;
    const t1 = 1 - t;
    const bx = t1 * t1 * x1 + 2 * t1 * t * cx + t * t * x2;
    const by = t1 * t1 * y1 + 2 * t1 * t * cy + t * t * y2;

    const shardSize = (isSplit ? 2.5 : 3.5) * widthMultiplier;
    g.moveTo(bx, by - shardSize)
      .lineTo(bx + shardSize, by)
      .lineTo(bx, by + shardSize)
      .lineTo(bx - shardSize, by)
      .closePath()
      .fill({ color: 0xffffff, alpha: 0.85 })
      .stroke({ color: refractionColor, width: 1 });
  }
}

function drawMeltdownLaser(
  g: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dx: number,
  dy: number,
  len: number,
  colorNum: number,
  progress: number,
  widthMultiplier: number,
  animTime: number
): void {
  const nx = -dy / len;
  const ny = dx / len;

  // 1. Unstable plasma fire aura
  const heatPulse = 1.0 + 0.15 * Math.sin(animTime * 0.02);
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({
      color: colorNum,
      alpha: 0.25 + progress * 0.25,
      width: 14 * widthMultiplier * heatPulse,
      cap: "round",
    });

  // 2. Yellow middle heat cylinder
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({
      color: 0xffcc00,
      alpha: 0.6 + progress * 0.3,
      width: 6.5 * widthMultiplier,
      cap: "round",
    });

  // 3. Super hot white core
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({
      color: 0xffffff,
      alpha: 0.95,
      width: 2.2 * widthMultiplier,
      cap: "round",
    });

  // 4. Crackling lightning arcs along the beam
  const steps = 18;
  const time = animTime * 0.035;
  const maxOffset = (3.5 + progress * 7.5) * widthMultiplier;

  g.moveTo(x1, y1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const basePx = x1 + dx * t;
    const basePy = y1 + dy * t;

    const noise = Math.sin(t * Math.PI * 8 - time) * Math.cos(t * Math.PI * 4 + time * 0.5);
    const offset = noise * maxOffset * Math.sin(t * Math.PI);
    const hx = basePx + nx * offset;
    const hy = basePy + ny * offset;
    g.lineTo(hx, hy);
  }
  g.lineTo(x2, y2);
  g.stroke({
    color: 0xff6600,
    alpha: 0.55 + progress * 0.35,
    width: 1.2 + progress * 1.5,
    cap: "round",
    join: "round",
  });

  // White hot secondary thin arc inside the main arc for high charge
  if (progress > 0.5) {
    g.moveTo(x1, y1);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const basePx = x1 + dx * t;
      const basePy = y1 + dy * t;

      const noise =
        Math.cos(t * Math.PI * 10 + time * 1.1) * Math.sin(t * Math.PI * 5 - time * 0.7);
      const offset = noise * maxOffset * 0.65 * Math.sin(t * Math.PI);
      const hx = basePx + nx * offset;
      const hy = basePy + ny * offset;
      g.lineTo(hx, hy);
    }
    g.lineTo(x2, y2);
    g.stroke({
      color: 0xffffff,
      alpha: 0.75,
      width: 0.7 + progress * 0.7,
      cap: "round",
      join: "round",
    });
  }
}

function drawStandardLaser(
  g: PIXI.Graphics,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dx: number,
  dy: number,
  len: number,
  colorNum: number,
  progress: number,
  widthMultiplier: number,
  animTime: number
): void {
  // 1. Outer golden aura
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({
      color: colorNum,
      alpha: 0.18 + progress * 0.22,
      width: 10 * widthMultiplier,
      cap: "round",
    });

  // 2. Middle yellow laser body
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({
      color: colorNum,
      alpha: 0.55 + progress * 0.25,
      width: 5 * widthMultiplier,
      cap: "round",
    });

  // 3. Core white laser line
  g.moveTo(x1, y1)
    .lineTo(x2, y2)
    .stroke({
      color: 0xffffff,
      alpha: 0.95,
      width: 1.8 * widthMultiplier,
      cap: "round",
    });

  // 4. Plasma Spiral wrapping around the core
  if (progress > 0.2 && len > 10) {
    const nx = -dy / len;
    const ny = dx / len;
    const steps = 24;
    const time = animTime * (0.0015 + progress * 0.002);

    g.moveTo(x1, y1);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const waveAngle = t * Math.PI * 6 - time;
      const amplitude = (7 + progress * 10) * Math.sin(t * Math.PI) * widthMultiplier;
      const hx = px + nx * Math.cos(waveAngle) * amplitude;
      const hy = py + ny * Math.cos(waveAngle) * amplitude;

      if (i === 0) g.moveTo(hx, hy);
      else g.lineTo(hx, hy);
    }
    g.stroke({
      color: colorNum,
      alpha: 0.45 + progress * 0.45,
      width: 1.0 + progress * 1.5,
    });

    if (progress > 0.55) {
      g.moveTo(x1, y1);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = x1 + dx * t;
        const py = y1 + dy * t;
        const waveAngle = t * Math.PI * 6 - time;
        const amplitude = (7 + progress * 10) * Math.sin(t * Math.PI) * widthMultiplier;
        const hx = px + nx * Math.cos(waveAngle) * amplitude;
        const hy = py + ny * Math.cos(waveAngle) * amplitude;

        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.stroke({
        color: 0xffffff,
        alpha: 0.75,
        width: 0.6 + progress * 0.6,
      });
    }
  }

  // 5. Flowing energy nodes
  const numNodes = 3;
  for (let i = 0; i < numNodes; i++) {
    const t = (animTime * 0.002 + i / numNodes) % 1.0;
    const px = x1 + dx * t;
    const py = y1 + dy * t;

    const nx = -dy / len;
    const ny = dx / len;
    const tickLen = 4 * widthMultiplier;

    g.moveTo(px - nx * tickLen, py - ny * tickLen)
      .lineTo(px + nx * tickLen, py + ny * tickLen)
      .stroke({
        color: 0xffffff,
        alpha: 0.8,
        width: 2.0 * widthMultiplier,
        cap: "round",
      });
  }
}

function drawMuzzleFlare(
  g: PIXI.Graphics,
  x1: number,
  y1: number,
  colorNum: number,
  progress: number,
  widthMultiplier: number,
  animTime: number
): void {
  const flareR = (4 + progress * 8) * Math.min(1.3, widthMultiplier);
  const ringCount = 2;
  for (let r = 0; r < ringCount; r++) {
    const pulseR = flareR * (0.5 + 0.5 * Math.sin(animTime * 0.015 + r * Math.PI));
    g.circle(x1, y1, pulseR).stroke({
      color: colorNum,
      alpha: 0.25 * (1 - pulseR / (flareR * 1.0)),
      width: 1.0,
    });
  }

  g.circle(x1, y1, flareR * 0.75).fill({ color: colorNum, alpha: 0.25 });
  g.circle(x1, y1, Math.min(2.5, flareR * 0.3)).fill({ color: 0xffffff, alpha: 0.75 });
}
