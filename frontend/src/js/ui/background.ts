/*
 * @file: frontend/src/js/ui/background.ts
 * @purpose: Background animator that renders ambient starry particle flows and laser beam grids using PixiJS.
 * @dependencies: None
 * @last_update: 2026-05-29 / v2.1.0 - Migrated entirely to pure PixiJS.
 */
import * as PIXI from 'pixi.js';

interface BackgroundParticle {
    x: number;
    y: number;
    size: number;
    vx: number;
    vy: number;
    alpha: number;
}

interface LaserSpark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: number;
    size: number;
    alpha: number;
    life: number;
    decay: number;
}

export class BackgroundController {
    private canvas: HTMLCanvasElement | null;
    private app: PIXI.Application | null = null;
    private particles: BackgroundParticle[] = [];
    private laserProgress: number = 0;
    private showFps: boolean = false;
    private lastUnthrottledFpsUpdate: number = performance.now();
    private unthrottledFrames: number = 0;
    private laserSparks: LaserSpark[] = [];
    private cachedFpsEl: HTMLElement | null = null;

    private gridGraphics: PIXI.Graphics | null = null;
    private particleGraphics: PIXI.Graphics | null = null;
    private laserGraphics: PIXI.Graphics | null = null;

    private lastGridWidth: number = 0;
    private lastGridHeight: number = 0;
    private lastFrameTime: number = performance.now();

    constructor(canvasId: string) {
        this.canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!this.canvas) return;
        this.init();
    }

    private async init(): Promise<void> {
        this.app = new PIXI.Application();
        await this.app.init({
            canvas: this.canvas!,
            backgroundAlpha: 0,
            resizeTo: window,
            autoDensity: true,
            resolution: window.devicePixelRatio || 1,
            antialias: true
        });
        
        this.gridGraphics = new PIXI.Graphics();
        this.particleGraphics = new PIXI.Graphics();
        this.laserGraphics = new PIXI.Graphics();
        
        this.app.stage.addChild(this.gridGraphics);
        this.app.stage.addChild(this.particleGraphics);
        this.app.stage.addChild(this.laserGraphics);

        this.createParticles();
        this.cachedFpsEl = document.getElementById('fps-display');
        
        // Stop default ticker to control it manually for custom throttling
        this.app.ticker.stop();
        this.animate();
    }

    private createParticles(): void {
        this.particles = [];
        const count = 100;
        const width = window.innerWidth;
        const height = window.innerHeight;
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2 + 1,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                alpha: Math.random() * 0.5 + 0.1
            });
        }
    }

    private getPerimeterCoords(p: number, w: number, h: number): { x: number; y: number } {
        const P = 2 * (w + h);
        let wrapped = p % P;
        if (wrapped < 0) wrapped += P;

        if (wrapped < w) {
            return { x: wrapped, y: 0 };
        } else if (wrapped < w + h) {
            return { x: w, y: wrapped - w };
        } else if (wrapped < 2 * w + h) {
            return { x: w - (wrapped - (w + h)), y: h };
        } else {
            return { x: 0, y: h - (wrapped - (2 * w + h)) };
        }
    }

    private drawGrid(width: number, height: number): void {
        if (!this.gridGraphics) return;
        this.gridGraphics.clear();

        const spacing = 80;
        
        for (let x = 0; x <= width; x += spacing) {
            this.gridGraphics.moveTo(x, 0);
            this.gridGraphics.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += spacing) {
            this.gridGraphics.moveTo(0, y);
            this.gridGraphics.lineTo(width, y);
        }
        this.gridGraphics.stroke({ color: 0x4cc9f0, alpha: 0.05, width: 1 });

        this.lastGridWidth = width;
        this.lastGridHeight = height;
    }

    private animate(): void {
        if (!this.app || !this.particleGraphics || !this.laserGraphics) return;
        
        const isMenu = document.body.classList.contains('menu-page');
        const isPerfMode = localStorage.getItem('td_perf_mode') === 'true';
        const hasFocus = document.hasFocus();

        const refreshRateSelect = (document.getElementById('igRefreshRateSelect') || document.getElementById('refreshRateSelect')) as HTMLSelectElement | null;
        const configuredFPS = parseInt(refreshRateSelect ? refreshRateSelect.value : (localStorage.getItem('td_refresh_rate') || '60')) || 60;

        let targetFPS = configuredFPS;
        if (isPerfMode) {
            if (!hasFocus) {
                targetFPS = 10;
            } else {
                targetFPS = 30;
            }
        }

        if (targetFPS === 0) {
            this.particleGraphics.clear();
            this.laserGraphics.clear();
            this.app.render();
            requestAnimationFrame(() => this.animate());
            return;
        }

        const timestamp = performance.now();
        let elapsed = timestamp - this.lastFrameTime;
        const frameInterval = 1000 / targetFPS;

        if (elapsed < frameInterval - 4.0) {
            requestAnimationFrame(() => this.animate());
            return;
        }

        if (elapsed > 100) {
            elapsed = frameInterval;
        }

        this.lastFrameTime = timestamp;

        const timeScale = elapsed / 16.666;

        const width = this.app.screen.width;
        const height = this.app.screen.height;

        if (this.lastGridWidth !== width || this.lastGridHeight !== height) {
            this.drawGrid(width, height);
        }

        this.particleGraphics.clear();
        this.particles.forEach(p => {
            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;
            
            if(p.x < 0) p.x = width;
            if(p.x > width) p.x = 0;
            if(p.y < 0) p.y = height;
            if(p.y > height) p.y = 0;
            
            this.particleGraphics!.circle(p.x, p.y, p.size).fill({ color: 0x4cc9f0, alpha: 0.25 });
        });

        this.laserGraphics.clear();

        if (isMenu) {
            const P = 2 * (width + height);
            const speed = 240 * (elapsed / 1000);
            this.laserProgress = (this.laserProgress + speed) % P;

            const segments = 5;
            const trailLength = 200;

            const getEdge = (pVal: number) => {
                let wrapped = pVal % P;
                if (wrapped < 0) wrapped += P;
                if (wrapped < width) return 0;
                if (wrapped < width + height) return 1;
                if (wrapped < 2 * width + height) return 2;
                return 3;
            };

            for (let l = 0; l < 2; l++) {
                const currentProgress = this.laserProgress + l * (P / 2);
                const laserColor = l === 0 ? 0x4cc9f0 : 0xf72585;

                for (let i = 0; i < segments; i++) {
                    const pStart = currentProgress - (i + 1) * (trailLength / segments);
                    const pEnd = currentProgress - i * (trailLength / segments);
                    
                    const startPt = this.getPerimeterCoords(pStart, width, height);
                    const endPt = this.getPerimeterCoords(pEnd, width, height);
                    
                    const edgeStart = getEdge(pStart);
                    const edgeEnd = getEdge(pEnd);
                    
                    const alpha = (1 - i / segments) * 0.8;

                    const drawSegment = () => {
                        this.laserGraphics!.moveTo(startPt.x, startPt.y);
                        if (edgeStart !== edgeEnd) {
                            if (edgeStart === 0 && edgeEnd === 1) this.laserGraphics!.lineTo(width, 0);
                            else if (edgeStart === 1 && edgeEnd === 2) this.laserGraphics!.lineTo(width, height);
                            else if (edgeStart === 2 && edgeEnd === 3) this.laserGraphics!.lineTo(0, height);
                            else if (edgeStart === 3 && edgeEnd === 0) this.laserGraphics!.lineTo(0, 0);
                        }
                        this.laserGraphics!.lineTo(endPt.x, endPt.y);
                    };

                    drawSegment();
                    this.laserGraphics.stroke({ color: laserColor, alpha: alpha * 0.25, width: (1 - i / segments) * 8 + 4, cap: 'round' });
                    
                    drawSegment();
                    this.laserGraphics.stroke({ color: laserColor, alpha: alpha, width: (1 - i / segments) * 4 + 1.5, cap: 'round' });
                    
                    drawSegment();
                    this.laserGraphics.stroke({ color: 0xffffff, alpha: alpha * 0.9, width: (1 - i / segments) * 1.5 + 0.5, cap: 'round' });
                }

                const headPt = this.getPerimeterCoords(currentProgress, width, height);
                const pulse = Math.sin(performance.now() / 100) * 2;
                
                this.laserGraphics.circle(headPt.x, headPt.y, 14 + pulse).fill({ color: laserColor, alpha: 0.15 });
                this.laserGraphics.circle(headPt.x, headPt.y, 8 + pulse * 0.5).fill({ color: laserColor, alpha: 0.5 });
                this.laserGraphics.circle(headPt.x, headPt.y, 4).fill({ color: 0xffffff, alpha: 1 });

                const edge = getEdge(currentProgress);
                let biasX = 0;
                let biasY = 0;
                if (edge === 0) biasY = 0.8;
                else if (edge === 1) biasX = -0.8;
                else if (edge === 2) biasY = -0.8;
                else biasX = 0.8;

                const numSparks = Math.min(3, Math.ceil(targetFPS / 60));
                for (let s = 0; s < numSparks; s++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speedMag = Math.random() * 1.5 + 0.5;
                    this.laserSparks.push({
                        x: headPt.x,
                        y: headPt.y,
                        vx: Math.cos(angle) * speedMag + biasX,
                        vy: Math.sin(angle) * speedMag + biasY,
                        color: laserColor,
                        size: Math.random() * 2.5 + 1.2,
                        alpha: Math.random() * 0.8 + 0.2,
                        life: 1.0,
                        decay: Math.random() * 0.03 + 0.02
                    });
                }
            }

            for (let i = this.laserSparks.length - 1; i >= 0; i--) {
                const spark = this.laserSparks[i];
                spark.x += spark.vx * timeScale;
                spark.y += spark.vy * timeScale;
                spark.life -= spark.decay * timeScale;
                
                if (spark.life <= 0) {
                    this.laserSparks.splice(i, 1);
                    continue;
                }

                const currentAlpha = spark.alpha * spark.life;
                this.laserGraphics.circle(spark.x, spark.y, spark.size * spark.life).fill({ color: spark.color, alpha: currentAlpha });
            }
        } else if (this.laserSparks.length > 0) {
            this.laserSparks = [];
        }

        this.updateFpsDisplay(isMenu);
        this.app.render();

        requestAnimationFrame(() => this.animate());
    }

    private updateFpsDisplay(isMenu: boolean): void {
        if (!isMenu) {
            this.cachedFpsEl?.classList.add('hidden');
            return;
        }

        this.showFps = localStorage.getItem('td_show_fps') === 'true';
        if (!this.cachedFpsEl) return;

        if (this.showFps) {
            this.cachedFpsEl.classList.remove('hidden');
            this.unthrottledFrames++;
            const now = performance.now();
            const elapsed = now - this.lastUnthrottledFpsUpdate;
            if (elapsed >= 500) {
                const fps = Math.round((this.unthrottledFrames * 1000) / elapsed);
                this.cachedFpsEl.textContent = `FPS: ${fps}`;
                this.unthrottledFrames = 0;
                this.lastUnthrottledFpsUpdate = now;
            }
        } else {
            this.cachedFpsEl.classList.add('hidden');
        }
    }
}
