export class MusicController {
    private menuMusic: HTMLAudioElement | null = null;
    private musicFadeInterval: any = null;

    constructor() {
        this.initMenuMusic();
    }

    public setVolume(volPercent: number): void {
        const vol = volPercent / 100;
        if (this.musicFadeInterval) {
            clearInterval(this.musicFadeInterval);
            this.musicFadeInterval = null;
        }
        if (this.menuMusic) {
            this.menuMusic.volume = vol;
            if (vol > 0 && this.menuMusic.paused) {
                this.menuMusic.play().catch(() => { });
            }
        }
        const creditWidget = document.getElementById('music-credit');
        if (creditWidget) {
            creditWidget.classList.toggle('muted', vol === 0);
        }
    }

    private initMenuMusic(): void {
        const savedVol = parseInt(localStorage.getItem('td_music_vol') || '50', 10);
        const volume = savedVol / 100;

        this.menuMusic = document.getElementById('menu-music-audio') as HTMLAudioElement | null;
        if (!this.menuMusic) return;

        this.menuMusic.volume = volume;
        if (this.menuMusic.crossOrigin !== 'anonymous') {
            this.menuMusic.crossOrigin = 'anonymous';
        }

        const creditWidget = document.getElementById('music-credit');
        const portalTitle = document.querySelector('.portal-title') as HTMLElement | null;

        if (creditWidget && volume === 0) creditWidget.classList.add('muted');

        const startBeatDetection = () => {
            if (!this.menuMusic || !portalTitle) return;

            let lastBeatIndex = -1;
            const BEAT_INTERVAL = 0.4;
            const BEAT_OFFSET_SEC = 0.0;

            const tick = () => {
                requestAnimationFrame(tick);
                if (!this.menuMusic || this.menuMusic.paused) return;

                const currentTime = Math.max(0, this.menuMusic.currentTime - BEAT_OFFSET_SEC);
                const currentBeatIndex = Math.floor(currentTime / BEAT_INTERVAL);

                if (currentBeatIndex !== lastBeatIndex) {
                    lastBeatIndex = currentBeatIndex;
                    portalTitle.classList.remove('beat');
                    void portalTitle.offsetWidth;
                    portalTitle.classList.add('beat');
                    setTimeout(() => portalTitle.classList.remove('beat'), 150);
                }
            };
            tick();
        };

        const splashScreen = document.getElementById('splash-screen');
        const enterBtn = document.getElementById('splash-enter-btn');

        const enterSystem = () => {
            const music = this.menuMusic;
            if (!music) return;

            music.volume = 0;
            startBeatDetection();

            if (portalTitle) {
                portalTitle.classList.remove('beat');
                void portalTitle.offsetWidth;
                portalTitle.classList.add('beat');
                setTimeout(() => portalTitle.classList.remove('beat'), 150);
            }

            music.play()
                .then(() => {
                    if (volume > 0) {
                        const fadeDuration = 1000;
                        const intervalTime = 40;
                        const steps = fadeDuration / intervalTime;
                        const volumeStep = volume / steps;
                        let currentVol = 0;

                        this.musicFadeInterval = setInterval(() => {
                            currentVol += volumeStep;
                            if (currentVol >= volume) {
                                music.volume = volume;
                                clearInterval(this.musicFadeInterval);
                                this.musicFadeInterval = null;
                            } else {
                                music.volume = currentVol;
                            }
                        }, intervalTime);
                    } else {
                        music.volume = 0;
                    }
                })
                .catch(err => {
                    console.warn("Audio play failed on interaction:", err);
                    music.volume = volume;
                });

            document.body.classList.remove('splash-active');
            if (splashScreen) {
                splashScreen.classList.add('fade-out');
                setTimeout(() => {
                    splashScreen.style.display = 'none';
                }, 800);
            }
            const blurElements = document.querySelectorAll('.blur-hidden');
            blurElements.forEach(el => el.classList.remove('blur-hidden'));

            document.removeEventListener('keydown', handleKeyStart);
        };

        const handleKeyStart = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                enterSystem();
            }
        };

        if (enterBtn) {
            enterBtn.addEventListener('click', enterSystem);
        }
        document.addEventListener('keydown', handleKeyStart);
    }
}
