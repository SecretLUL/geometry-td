/*
 * @file: frontend\src\js\entities\enemies\types\special.ts
 * @purpose: Implementation of specialized gameplay enemies (Regrower, Shielded, Swarm) extending BaseEnemy.
 * @dependencies: base, config, state, map, utils
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Änderung der Funktionalität MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
 * @last_update: 2026-05-29 / v1.2.0 - Fixed SwarmEnemy invisibility: update() now calls updatePixi() to position the sprite on the Host (was missing, unlike BaseEnemy).
 */
import { BaseEnemy } from '../base';
import { Config } from '../../../core/config';
import { state } from '../../../core/state';
import { waypoints } from '../../../core/map';
import { getDistance } from '../../../core/utils';

export class RegrowerEnemy extends BaseEnemy {
    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'Regrower';
        this.radius = 12;
        this.color = '#228b22';
        this.speed = 1.2;

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);
        this.maxHp = Math.floor(baseHp * hpMultiplier * 1.2);
        this.reward = Math.floor((Config.ENEMY_REWARD_BASE * 1.2) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1));
        this.healTimer = 30;
        this.initHp();
    }

    public override drawShape(g: any): void {
        for (let i = 0; i < 5; i++) {
            const angle = (Math.PI * 2 / 5) * i - Math.PI / 2;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }
        g.fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });
    }
}

export class ShieldedEnemy extends BaseEnemy {
    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'Shielded';
        this.radius = 12;
        this.color = '#4682b4';
        this.speed = 1.3;

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);
        this.maxHp = Math.floor(baseHp * hpMultiplier * 0.8);
        this.reward = Math.floor((Config.ENEMY_REWARD_BASE * 1.5) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1));
        this.shieldActive = true;
        this.initHp();
    }
}

export class SwarmEnemy extends BaseEnemy {
    public swarmOffsetX: number = 0;
    public swarmOffsetY: number = 0;

    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'Swarm';
        this.radius = 4; // Very small
        this.color = '#ff00ff'; // Neon pink
        this.speed = 2.0; // 60 map speed approx

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);
        this.maxHp = Math.max(1, Math.floor(baseHp * hpMultiplier * 0.05)); // Minimal HP, dies in 1 hit early on
        this.reward = Math.max(1, Math.floor((Config.ENEMY_REWARD_BASE * 0.2) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)));
        this.initHp();
        this.hideHealthBar = true; // No HP bar for micro dots to avoid clutter
    }

    public override drawShape(g: any): void {
        g.circle(0, 0, this.radius).fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });
    }

    public override update(): 'stunned' | 'reached_end' | 'moving' {
        if (this.stunCooldown > 0) this.stunCooldown--;

        if (this.stunTimer > 0) {
            this.stunTimer--;
            this.updatePixi();
            return 'stunned';
        }

        const target = waypoints[this.targetWaypointIndex];
        if (!target) return 'reached_end';

        const fakeTargetX = target.x + this.swarmOffsetX;
        const fakeTargetY = target.y + this.swarmOffsetY;

        const distance = getDistance(this.x, this.y, fakeTargetX, fakeTargetY);
        const dx = fakeTargetX - this.x;
        const dy = fakeTargetY - this.y;

        if (distance < this.speed) {
            this.x = fakeTargetX;
            this.y = fakeTargetY;
            this.targetWaypointIndex++;
            if (this.targetWaypointIndex >= waypoints.length) {
                return 'reached_end';
            }
        } else {
            const moveX = (dx / distance) * this.speed;
            const moveY = (dy / distance) * this.speed;
            this.x += moveX;
            this.y += moveY;
            this.distanceTravelled += this.speed;
        }
        this.updatePixi();
        return 'moving';
    }

    public override updatePixi(): void {
        super.updatePixi();
        
        if (this.swarmGroupId) {
            const swarmMembers = state.enemies.filter(e => e.swarmGroupId === this.swarmGroupId);
            const firstMember = swarmMembers[0];
            
            if (firstMember === this && this.hpGraphics) {
                const aliveCount = swarmMembers.length;
                if (aliveCount > 0) {
                    const ratio = Math.max(0, aliveCount / 12);
                    
                    let sumX = 0;
                    let sumY = 0;
                    for (const member of swarmMembers) {
                        sumX += member.x;
                        sumY += member.y;
                    }
                    const centerX = sumX / aliveCount;
                    const centerY = sumY / aliveCount;
                    
                    this.hpGraphics.position.set(centerX - this.x, centerY - this.y);
                    this.hpGraphics.clear();
                    this.hpGraphics.rect(-15, -this.radius - 22, 30, 4).fill({ color: 0xff0000 });
                    this.hpGraphics.rect(-15, -this.radius - 22, 30 * ratio, 4).fill({ color: 0x00ff00 });
                }
            } else if (this.hpGraphics) {
                this.hpGraphics.clear();
            }
        }
    }
}
