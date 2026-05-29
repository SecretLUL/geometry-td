/*
 * @file: frontend\src\js\entities\enemies\types\event.ts
 * @purpose: Implementation of event-related enemies (Collector, Fortress, Splinter, SplinterFragment) extending BaseEnemy.
 * @dependencies: base, config, state, fx
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
 * @last_update: 2026-05-22 / v1.0.0 - Created event.ts as part of enemies.ts split.
 */
import { BaseEnemy } from '../base';
import { Config } from '../../../core/config';
import { createExplosion } from '../../../fx/fx';

export class CollectorEnemy extends BaseEnemy {
    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'Collector';
        this.radius = 12;
        this.color = '#ffd700';
        this.speed = 5.0;

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);
        // Very high HP (multiplier similar to 'Bruiser', which is 2.5)
        this.maxHp = Math.floor(baseHp * hpMultiplier * 2.5);
        // Massive reward (Config.ENEMY_REWARD_BASE * 35)
        this.reward = Math.floor((Config.ENEMY_REWARD_BASE * 35) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1));
        this.initHp();
    }

    public override drawShape(g: any): void {
        g.moveTo(0, -this.radius);
        g.lineTo(this.radius, 0);
        g.lineTo(0, this.radius);
        g.lineTo(-this.radius, 0);
        g.fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });

        g.moveTo(0, -this.radius * 0.5);
        g.lineTo(this.radius * 0.5, 0);
        g.lineTo(0, this.radius * 0.5);
        g.lineTo(-this.radius * 0.5, 0);
        g.fill({ color: '#000000', alpha: 0.5 });
    }
}

export class FortressEnemy extends BaseEnemy {
    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'Fortress';
        this.radius = 16;
        this.color = '#2d3436';
        this.speed = 0.7;

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);

        // HP: 5x ENEMY_BASE_HP
        this.maxHp = Math.floor(baseHp * hpMultiplier * 5);
        // Reward: Less than Collector, more than Bruiser (8). 
        this.reward = Math.floor((Config.ENEMY_REWARD_BASE * 10) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1));

        this.shieldActive = true;
        this.maxShieldHp = this.maxHp * 0.5;
        this.shieldHp = this.maxShieldHp;
        this.regenTimer = 30; // 0.5s at 60fps

        this.initHp();
    }

    public override takeDamage(amount: number, source?: any): number {
        if (this.shieldActive) {
            const actualShieldDmg = Math.min(amount, Math.max(0, this.shieldHp!));
            this.shieldHp! -= amount;
            this.flashTime = 3;
            if (this.shieldHp! <= 0) {
                this.shieldActive = false;
                this.shieldHp = 0;
                createExplosion(this.x, this.y, '#74b9ff', 10);
            }
            if (source) {
                const current = this.damageSources.get(source) || 0;
                this.damageSources.set(source, current + actualShieldDmg);
            }
            return actualShieldDmg;
        }
        return super.takeDamage(amount, source);
    }

    public override update(): 'stunned' | 'reached_end' | 'moving' {
        if (this.shieldActive && this.shieldHp! < this.maxShieldHp!) {
            this.regenTimer!--;
            if (this.regenTimer! <= 0) {
                this.shieldHp = Math.min(this.maxShieldHp!, this.shieldHp! + (this.maxShieldHp! * 0.05));
                this.regenTimer = 30;
            }
        }
        return super.update();
    }

    public override drawShape(g: any): void {
        const w1 = this.radius * 0.7;
        const w2 = this.radius;
        const h = this.radius;

        g.moveTo(-w1, -h);
        g.lineTo(w1, -h);
        g.lineTo(w2, h);
        g.lineTo(-w2, h);
        g.fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });

        g.rect(-w1 * 0.5, -h * 0.5, w1, h).fill({ color: '#ffffff', alpha: 0.1 });
    }

    public override updatePixi(): void {
        super.updatePixi();
        
        if (this.shieldActive && this.shieldGraphics) {
            this.shieldGraphics.clear();
            const pulse = Math.sin(Date.now() / 150) * 3;
            this.shieldGraphics.circle(0, 0, this.radius + 10 + pulse).stroke({ color: 0x74b9ff, width: 4 });
            this.shieldGraphics.alpha = 0.5 + Math.sin(Date.now() / 150) * 0.2;
            
            // Shield HP bar
            this.shieldGraphics.rect(-15, -this.radius - 18, 30, 3).fill({ color: 0x000000, alpha: 0.5 });
            this.shieldGraphics.rect(-15, -this.radius - 18, 30 * (this.shieldHp! / this.maxShieldHp!), 3).fill({ color: 0x74b9ff });
        }
    }
}

export class SplinterEnemy extends BaseEnemy {
    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'Splinter';
        this.radius = 12;
        this.color = '#00f5d4';
        this.speed = 1.1; // 32 speed is slightly slower than Normal (1.2)

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);
        this.maxHp = Math.floor(baseHp * hpMultiplier * 0.8); // 16 HP at wave 1
        this.reward = Math.floor((Config.ENEMY_REWARD_BASE * 1.5) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1)); // 7g reward at wave 1, scales up to 10
        this.initHp();
        this.specialAbility = 'Spaltet sich beim Tod';
    }

    public override drawShape(g: any): void {
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 3) * i;
            const r = i % 2 === 0 ? this.radius : this.radius * 0.5;
            const px = Math.cos(angle) * r;
            const py = Math.sin(angle) * r;
            if (i === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
        }
        g.fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });
    }
}

export class SplinterFragmentEnemy extends BaseEnemy {
    constructor(waveNumber: number) {
        super(waveNumber);
        this.typeName = 'SplinterFragment';
        this.radius = 7; // smaller
        this.color = '#00f5d4'; // same color as Splinter for thematic consistency
        this.speed = 2.4; // extremely fast (65 speed)

        const baseHp = Config.ENEMY_BASE_HP;
        const hpMultiplier = Config.getHpMultiplier(waveNumber);
        this.maxHp = Math.max(1, Math.floor(baseHp * hpMultiplier * 0.2)); // 4 HP at wave 1
        this.reward = Math.max(1, Math.floor((Config.ENEMY_REWARD_BASE * 0.4) * Math.pow(Config.ENEMY_REWARD_MULTIPLIER, waveNumber - 1))); // 2g reward
        this.initHp();
        this.specialAbility = 'Sehr schnell';
    }

    public override drawShape(g: any): void {
        g.moveTo(0, -this.radius);
        g.lineTo(this.radius, this.radius);
        g.lineTo(-this.radius, this.radius);
        g.fill({ color: this.flashTime > 0 ? '#ffffff' : this.color });
    }
}
