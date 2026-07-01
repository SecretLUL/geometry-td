import { state } from "../core/state";
import { PoolManager } from "../core/pool";

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
