/*
 * @file: frontend/src/js/core/loader.ts
 * @purpose: Handles preloading of game assets (audio, images) and manages loading
 *           progress and completion state before the game starts.
 * @dependencies: logger
 * @last_update: 2026-05-20 / v1.0.0
 */
import { logger } from './logger';

export class AssetLoader {
    private assets: string[];
    private loadedCount: number;
    private totalCount: number;
    public onProgress: ((pct: number, message: string) => void) | null;
    public onComplete: (() => void) | null;
    private messages: string[];
    private currentMessage: string;

    constructor() {
        // No static assets are currently preloaded; the array is reserved for future use.
        this.assets = [];
        
        this.loadedCount = 0;
        this.totalCount = this.assets.length;
        this.onProgress = null;
        this.onComplete = null;

        this.messages = [
            "Polierende Pixel...",
            "Gegner werden bestochen...",
            "Türme werden geölt...",
            "Kaffee für die Programmierer wird gekocht...",
            "Sichere Verbindung zum Pentagon wird aufgebaut...",
            "Geometrie-Unterricht wird geschwänzt...",
            "Quadrate werden abgerundet...",
            "Ladebalken wird künstlich verlangsamt...",
            "Hamster im Laufrad wird gefüttert...",
            "Warte auf die Erlaubnis von Mutti...",
            "Berechne die Flugbahn von wütenden Dreiecken...",
            "Suche nach dem Sinn des Lebens (bitte warten)...",
            "Lade Schadenfreude über besiegte Gegner...",
            "Erstelle Backup von deinem Highscore..."
        ];
        this.currentMessage = this.messages[Math.floor(Math.random() * this.messages.length)];
    }

    /**
     * Start the preloading process
     */
    public async loadAll(): Promise<void> {
        const minDuration = 2000; // 2-second minimum to ensure a smooth feel
        const startTime = Date.now();
        
        // Start loading assets in the background (if any exist)
        if (this.totalCount > 0) {
            Promise.all(this.assets.map(path => this.loadAsset(path)));
        }

        return new Promise<void>((resolve) => {
            const updateLoop = () => {
                const elapsed = Date.now() - startTime;
                const timeProgress = Math.min(elapsed / minDuration, 1);
                
                // Actual loading progress (ratio of loaded to total assets)
                const actualProgress = this.totalCount === 0 ? 1 : (this.loadedCount / this.totalCount);
                
                // Visual progress: capped by both elapsed time and actual asset loading.
                // This prevents the bar from jumping ahead of real work.
                let visualProgress: number;
                if (this.totalCount === 0) {
                    visualProgress = timeProgress;
                } else {
                    // Progress follows time but is gated by actual asset loading
                    visualProgress = Math.min(timeProgress, actualProgress);
                }

                const pct = Math.round(visualProgress * 100);
                
                // Rotate to a new message approximately once per second
                if (elapsed % 1000 < 20) {
                    this.currentMessage = this.messages[Math.floor(Math.random() * this.messages.length)];
                }

                if (this.onProgress) {
                    this.onProgress(pct, this.currentMessage);
                }

                // Done when minimum time has elapsed AND all assets are loaded
                if (elapsed >= minDuration && this.loadedCount === this.totalCount) {
                    if (this.onProgress) this.onProgress(100, "Startklar!");
                    setTimeout(() => {
                        this.finish();
                        resolve();
                    }, 200);
                } else {
                    requestAnimationFrame(updateLoop);
                }
            };

            requestAnimationFrame(updateLoop);
        });
    }

    /**
     * Load a single asset based on its file extension
     */
    private async loadAsset(path: string): Promise<void> {
        const ext = path.split('.').pop()?.toLowerCase() || '';
        
        try {
            if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
                await this.loadImage(path);
            } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
                await this.loadAudio(path);
            } else {
                await fetch(path);
            }
        } catch (error) {
            logger.error(`Failed to load asset: ${path}`, { error: String(error) });
        } finally {
            this.loadedCount++;
            // Progress updates are driven by the updateLoop, not called here directly
        }
    }

    private loadImage(path: string): Promise<HTMLImageElement> {
        return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject();
            img.src = path;
        });
    }

    private loadAudio(path: string): Promise<HTMLAudioElement> {
        return new Promise<HTMLAudioElement>((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => reject();
            audio.src = path;
            audio.load();
        });
    }

    private finish(): void {
        if (this.onComplete) {
            this.onComplete();
        }
    }
}
