export class MatchmakingController {
    private selectedMapName: string | null = null;

    constructor() {
        this.init();
    }

    private init(): void {
        this.initMissions();
        this.initModeModal();
        this.fetchMissionStats();
        this.fetchOnlinePlayers();

        // Listen to real-time updates from server
        try {
            const socket = (window as any).io ? (window as any).io() : null;
            if (socket) {
                socket.on('mission_stats_update', (stats: Record<string, number>) => {
                    this.updateMissionStatsUI(stats);
                });
                socket.on('online_players_update', (count: number) => {
                    this.updateOnlinePlayersUI(count);
                });
            }
        } catch (e) {
            console.warn("Socket.io not available in menu", e);
        }
    }

    private async fetchMissionStats(): Promise<void> {
        try {
            const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000' : '';
            const response = await fetch(`${baseUrl}/api/mission_stats`, { cache: 'no-store' });
            if (response.ok) {
                const stats = await response.json();
                this.updateMissionStatsUI(stats);
            }
        } catch (err) {
            console.warn('Mission stats fetch failed (server may be offline):', err);
        }
    }

    private async fetchOnlinePlayers(): Promise<void> {
        try {
            const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000' : '';
            const response = await fetch(`${baseUrl}/api/online_players`, { cache: 'no-store' });
            if (response.ok) {
                const data = await response.json();
                this.updateOnlinePlayersUI(data.total);
            }
        } catch (err) {
            console.warn('Online players fetch failed (server may be offline):', err);
        }
    }

    private updateOnlinePlayersUI(count: number): void {
        const liveTickerEl = document.getElementById('liveTickerValue');
        if (liveTickerEl) {
            liveTickerEl.textContent = String(count);
        }
    }

    private updateMissionStatsUI(stats: Record<string, number>): void {
        document.querySelectorAll('.mission-player-count').forEach(el => {
            const htmlEl = el as HTMLElement;
            const mapName = htmlEl.dataset.map;
            if (!mapName) return;
            const count = stats[mapName] || 0;
            htmlEl.innerText = `${count}/4`;
            if (count > 0) {
                htmlEl.style.color = '#fff';
                htmlEl.style.background = 'rgba(255, 51, 102, 0.4)';
                htmlEl.style.boxShadow = '0 0 10px rgba(255, 51, 102, 0.5)';
            } else {
                htmlEl.style.color = 'var(--tesla-cyan)';
                htmlEl.style.background = 'rgba(76,201,240,0.1)';
                htmlEl.style.boxShadow = 'none';
            }
        });
    }

    private initMissions(): void {
        const cards = document.querySelectorAll('.mission-card');
        cards.forEach(card => {
            const htmlCard = card as HTMLElement;
            htmlCard.addEventListener('click', () => {
                const mapName = htmlCard.dataset.map;
                if (!mapName) return;

                this.selectedMapName = mapName;

                const modalMapHeader = document.getElementById('modalMapName');
                if (modalMapHeader) {
                    modalMapHeader.textContent = `SEKTOR-ZUGRIFF: ${mapName.toUpperCase()}`;
                }

                const modal = document.getElementById('modeSelectionModal');
                if (modal) {
                    modal.classList.remove('hidden');
                }
            });
        });
    }

    private initModeModal(): void {
        const modal = document.getElementById('modeSelectionModal');
        const closeModal = document.getElementById('closeModeModal');
        const startSolo = document.getElementById('startSoloBtn');
        const startPublic = document.getElementById('startPublicBtn');
        const createPrivate = document.getElementById('createPrivateBtn');
        const joinPrivate = document.getElementById('joinPrivateBtnModal');
        const privateInput = document.getElementById('privateCodeInputModal') as HTMLInputElement | null;

        const directJoin = document.getElementById('directJoinBtn');
        const directInput = document.getElementById('directCodeInput') as HTMLInputElement | null;

        const urlParams = new URLSearchParams(window.location.search);
        const errorMsg = urlParams.get('error');
        if (errorMsg) {
            this.showErrorBanner(errorMsg);
        }

        const hideModal = () => {
            if (modal) modal.classList.add('hidden');
            this.selectedMapName = null;
            if (privateInput) privateInput.value = '';
        };

        modal?.addEventListener('click', (e) => {
            if (e.target === modal) hideModal();
        });
        closeModal?.addEventListener('click', hideModal);

        const transitionAndRedirect = (url: string) => {
            const portalContainer = document.querySelector('.portal-container') as HTMLElement;
            if (portalContainer) {
                portalContainer.style.opacity = '0';
                portalContainer.style.transform = 'scale(1.1)';
                portalContainer.style.transition = '0.5s cubic-bezier(0.16, 1, 0.3, 1)';
            }
            setTimeout(() => {
                window.location.href = url;
            }, 500);
        };

        startSolo?.addEventListener('click', () => {
            if (!this.selectedMapName) return;
            transitionAndRedirect(`game.html?map=${encodeURIComponent(this.selectedMapName)}&mode=singleplayer`);
        });

        startPublic?.addEventListener('click', () => {
            if (!this.selectedMapName) return;
            transitionAndRedirect(`game.html?map=${encodeURIComponent(this.selectedMapName)}&mode=public`);
        });

        createPrivate?.addEventListener('click', () => {
            if (!this.selectedMapName) return;
            transitionAndRedirect(`game.html?map=${encodeURIComponent(this.selectedMapName)}&mode=private&action=create`);
        });

        joinPrivate?.addEventListener('click', () => {
            if (!this.selectedMapName || !privateInput) return;
            const code = privateInput.value.trim().toUpperCase();
            if (code.length !== 4) {
                alert("Bitte gib einen gültigen 4-stelligen Raum-Code ein.");
                return;
            }
            this.verifyAndJoinRoom(code);
        });

        privateInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const code = privateInput.value.trim().toUpperCase();
                if (code.length === 4) {
                    this.verifyAndJoinRoom(code);
                }
            }
        });

        directJoin?.addEventListener('click', () => {
            if (!directInput) return;
            const code = directInput.value.trim().toUpperCase();
            if (code.length !== 4) {
                alert("Bitte gib einen gültigen 4-stelligen Raum-Code ein.");
                return;
            }
            this.verifyAndJoinRoom(code);
        });

        directInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const code = directInput.value.trim().toUpperCase();
                if (code.length === 4) {
                    this.verifyAndJoinRoom(code);
                }
            }
        });
    }

    private async verifyAndJoinRoom(code: string): Promise<void> {
        try {
            const baseUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:3000' : '';
            const response = await fetch(`${baseUrl}/api/room/${encodeURIComponent(code)}`);
            if (response.ok) {
                const data = await response.json();
                if (data.exists) {
                    const portalContainer = document.querySelector('.portal-container') as HTMLElement;
                    if (portalContainer) {
                        portalContainer.style.opacity = '0';
                        portalContainer.style.transform = 'scale(1.1)';
                        portalContainer.style.transition = '0.5s cubic-bezier(0.16, 1, 0.3, 1)';
                    }
                    setTimeout(() => {
                        window.location.href = `game.html?map=${encodeURIComponent(data.mapName)}&roomId=${encodeURIComponent(code)}&mode=private`;
                    }, 500);
                } else {
                    alert("Zugriff verweigert: Der Raum-Code existiert nicht oder ist abgelaufen.");
                }
            } else {
                alert("Verbindungsfehler bei der Code-Verifizierung.");
            }
        } catch (err) {
            console.warn("Room verification failed:", err);
            alert("Simulation-Server nicht erreichbar.");
        }
    }

    private showErrorBanner(msg: string): void {
        const portalBody = document.querySelector('.portal-body');
        if (!portalBody) return;

        const banner = document.createElement('div');
        banner.className = 'error-banner';

        const icon = document.createElement('div');
        icon.className = 'error-banner-icon';
        icon.textContent = '🚨';
        banner.appendChild(icon);

        const content = document.createElement('div');
        content.className = 'error-banner-content';

        const strong = document.createElement('strong');
        strong.textContent = 'SYSTEM-WARNHINWEIS: ';
        content.appendChild(strong);

        const textSpan = document.createElement('span');
        textSpan.textContent = msg;
        content.appendChild(textSpan);

        banner.appendChild(content);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'error-banner-close';
        closeBtn.textContent = '×';
        banner.appendChild(closeBtn);

        closeBtn.addEventListener('click', () => {
            banner.style.opacity = '0';
            banner.style.transform = 'translateY(-10px)';
            banner.style.transition = '0.3s ease';
            setTimeout(() => banner.remove(), 300);

            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        });

        portalBody.insertBefore(banner, portalBody.firstChild);
    }
}
