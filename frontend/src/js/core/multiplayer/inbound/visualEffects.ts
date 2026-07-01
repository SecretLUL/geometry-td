import { state } from "../../state";
import { Config } from "../../config";
import { Enemy, ProjectileEvent, Vector2D } from "../../../types";
import { PoolManager } from "../../pool";
import { createExplosion, createCoinBurst } from "../../../fx/fx";
import { showGameNotification } from "../../../ui/ui";

export function triggerWaveCompleteVisuals(): void {
  const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement | null;
  if (canvas) {
    const waveBonus = Config.WAVE_BONUS_BASE + state.wave * Config.WAVE_BONUS_PER_WAVE;
    const interest = Math.floor(state.gold * Config.INTEREST_RATE);

    showGameNotification(
      "wave",
      `🌊 WELLE ${state.wave} ABGEWEHRT!`,
      `Sektor gesichert. Die nächste Welle formiert sich bereits.`,
      { bonus: waveBonus, interest: interest }
    );
    createCoinBurst(
      (canvas.clientWidth || canvas.width) / 2,
      (canvas.clientHeight || canvas.height) / 2,
      20
    );
  }
}

export function handleProjectileEvents(
  projectileEvents: ProjectileEvent[],
  enemiesMap: Map<number, Enemy>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  towersMap: Map<string, any>
): void {
  if (!projectileEvents || projectileEvents.length === 0) return;

  for (const event of projectileEvents) {
    const tower = towersMap.get(`${event.col},${event.row}`);
    if (event.type === "projectile") {
      let projTarget: Enemy | Vector2D | null = null;
      if (event.targetId !== null && event.targetId !== undefined) {
        projTarget = enemiesMap.get(event.targetId) || null;
      }
      if (event.targetPoint) {
        projTarget = event.targetPoint;
      }

      if (projTarget) {
        if (tower) {
          if ("hp" in projTarget) {
            tower.target = projTarget as Enemy;
          }
          tower.angle = Math.atan2(projTarget.y - tower.y, projTarget.x - tower.x);
        }
        let startX = event.startX !== undefined ? event.startX : tower ? tower.x : 0;
        let startY = event.startY !== undefined ? event.startY : tower ? tower.y : 0;
        if (event.offsetX !== undefined && event.offsetY !== undefined) {
          startX += event.offsetX;
          startY += event.offsetY;
        }
        const proj = PoolManager.getProjectile(
          startX,
          startY,
          projTarget,
          0, // 0 damage
          tower,
          event.aoeRadius,
          event.projectileSpeed,
          0,
          event.isCluster
        );
        proj.isHoming = !!event.isHoming;
        if (event.trail) {
          const maxTrail = 15;
          const len = Math.min(event.trail.length, maxTrail);
          for (let i = 0; i < len; i++) {
            proj.trailX[i] = event.trail[i].x;
            proj.trailY[i] = event.trail[i].y;
          }
          proj.trailHead = len % maxTrail;
          proj.trailCount = len;
        }

        if (tower) tower.recoil = tower.type === "Bomb" ? 10 : 6;
      }
    } else if (event.type === "sniper") {
      if (tower) {
        if (tower.type === "Prisma") {
          if (event.targetPoint) {
            tower.angle = Math.atan2(event.targetPoint.y - tower.y, event.targetPoint.x - tower.x);
          }
        } else {
          tower.recoil = 12;
          let lastX = tower.x + Math.cos(tower.angle) * 26;
          let lastY = tower.y + Math.sin(tower.angle) * 26;

          PoolManager.getMuzzleFlash(
            lastX,
            lastY,
            tower.angle,
            tower.specialization === "ricochet" ? "#55efc4" : "#a0d8ef"
          );

          if (event.targetIds) {
            for (const tid of event.targetIds) {
              const enemy = enemiesMap.get(tid);
              if (enemy) {
                PoolManager.getSniperBeam(
                  lastX,
                  lastY,
                  enemy.x,
                  enemy.y,
                  tower.specialization === "ricochet" ? "#55efc4" : "#a0d8ef"
                );
                lastX = enemy.x;
                lastY = enemy.y;

                enemy.triggerFlash?.(5);
                createExplosion(
                  enemy.x,
                  enemy.y,
                  tower.specialization === "ricochet" ? "#55efc4" : "#a0d8ef",
                  3
                );

                if (tid === event.targetIds[0]) {
                  tower.target = enemy;
                  tower.angle = Math.atan2(enemy.y - tower.y, enemy.x - tower.x);
                }
              }
            }
          }
        }
      }
    } else if (event.type === "tesla") {
      let arcColor = "#00ffff";
      if (tower) {
        if (tower.specialization === "highvolt") arcColor = "#a29bfe";
        else if (tower.specialization === "stun") arcColor = "#81ecec";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tower as any).auraTime = 35;
        createExplosion(tower.x, tower.y, arcColor, 5);
      }

      if (event.targetIds) {
        for (const tid of event.targetIds) {
          const enemy = enemiesMap.get(tid);
          if (enemy) {
            enemy.triggerFlash?.(5);
            createExplosion(enemy.x, enemy.y, arcColor, 3);

            // Draw lightning arc from tower to target
            if (tower) {
              PoolManager.getTeslaArc(tower.x, tower.y, enemy.x, enemy.y, arcColor);

              // Client-side Level 20 Mastery visuals: double arc + secondary branching leaps
              if (tower.masteryUnlocked) {
                PoolManager.getTeslaArc(tower.x, tower.y, enemy.x, enemy.y, arcColor);

                // Chain visual branching
                let closestChainTarget: Enemy | null = null;
                let closestDistSq = 90 * 90;
                for (let j = 0; j < state.enemies.length; j++) {
                  const potential = state.enemies[j];
                  if (potential.id === enemy.id || potential.hp <= 0 || potential.deadMarked)
                    continue;
                  const dx = potential.x - enemy.x;
                  const dy = potential.y - enemy.y;
                  const distSq = dx * dx + dy * dy;
                  if (distSq < closestDistSq) {
                    closestDistSq = distSq;
                    closestChainTarget = potential;
                  }
                }
                if (closestChainTarget) {
                  PoolManager.getTeslaArc(
                    enemy.x,
                    enemy.y,
                    closestChainTarget.x,
                    closestChainTarget.y,
                    arcColor
                  );
                }
              }
            }
          }
        }
      }
    }
  }
}
