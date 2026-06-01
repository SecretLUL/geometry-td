/*
 * @file: frontend\src\js\core\loader.ts
 * @purpose: Handles preloading game assets (audio, visuals) and managing resource loading progress and completion states.
 * @dependencies: logger
 * 
 * --- KI-INTEGRATIONS-DIREKTIVE ---
 * Diese Datei unterliegt einer strikten Dokumentationspflicht.
 * 1. Dieser Header ist ein integraler Bestandteil des Codes.
 * 2. Bei JEDER Ã„nderung der FunktionalitÃ¤t MUSS dieser Block zwingend 
 *    aktualisiert werden, um den aktuellen Stand widerzuspiegeln.
 * 3. Veraltete Dokumentation gilt als technisches Defizit (Technical Debt).
 * 4. Behandle diesen Block bei jeder Interaktion mit dem LLM als 
 *    vordringliche Kontext-Information.
 * ----------------------------------
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
        this.assets = [
            // --- Tower Icons / Images ---
            // 'src/assets/towers/base_tower.png',
            // 'src/assets/towers/sniper_tower.png',
            // 'src/assets/towers/bomb_tower.png',
            // 'src/assets/towers/tesla_tower.png',

            // --- Enemy Sprites ---
            // 'src/assets/enemies/normal.png',
            // 'src/assets/enemies/scout.png',
            // 'src/assets/enemies/bruiser.png',
            // 'src/assets/enemies/boss.png',

            // --- UI & Environment ---
            // 'src/assets/ui/heart.svg',
            // 'src/assets/ui/gold_coin.svg',
            // 'src/assets/maps/spiral_bg.jpg',

            // --- Sounds (Future) ---
            // 'src/assets/sounds/shoot.mp3',
            // 'src/assets/sounds/explosion.wav',
            // 'src/assets/sounds/coin.mp3',
            // 'src/assets/sounds/wave_start.mp3'
        ];
        
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
        const minDuration = 2000; // 2 Sekunden Mindestdauer für geschmeidiges Gefühl
        const startTime = Date.now();
        
        // Starte das Laden der Assets im Hintergrund (falls vorhanden)
        if (this.totalCount > 0) {
            Promise.all(this.assets.map(path => this.loadAsset(path)));
        }

        return new Promise<void>((resolve) => {
            const updateLoop = () => {
                const elapsed = Date.now() - startTime;
                const timeProgress = Math.min(elapsed / minDuration, 1);
                
                // Tatsächlicher Ladefortschritt
                const actualProgress = this.totalCount === 0 ? 1 : (this.loadedCount / this.totalCount);
                
                // Visueller Fortschritt: Er darf nicht schneller sein als die Zeit, 
                // aber auch nicht schneller als das tatsächliche Laden (falls Assets da sind)
                let visualProgress: number;
                if (this.totalCount === 0) {
                    visualProgress = timeProgress;
                } else {
                    // Wir gewichten den Fortschritt: Er folgt der Zeit, wird aber vom Laden gebremst
                    visualProgress = Math.min(timeProgress, actualProgress);
                }

                const pct = Math.round(visualProgress * 100);
                
                // Nachricht gelegentlich wechseln
                if (elapsed % 1000 < 20) { // Ungefähr jede Sekunde
                    this.currentMessage = this.messages[Math.floor(Math.random() * this.messages.length)];
                }

                if (this.onProgress) {
                    this.onProgress(pct, this.currentMessage);
                }

                // Prüfen ob wir fertig sind (Zeit abgelaufen UND Assets geladen)
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
            // Wir rufen hier nicht mehr updateProgress auf, da die updateLoop das übernimmt
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
