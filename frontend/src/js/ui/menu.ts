/*
 * @file: frontend\src\js\ui\menu.ts
 * @purpose: Controls the game's home page menus, level selections, lobby status checks, and the database lexicon.
 * @dependencies: config, enemies, background, types
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
 * @last_update: 2026-06-01 / v1.7.4 - Added rotationSpeedMultiplier support to Lexicon enemy preview spin animation.
 */
import { EnemyData } from '../core/config';
import { EnemyFactory } from '../entities/enemies';
import { BackgroundController } from './background';
import { EnemyType } from '../types';
import * as PIXI from 'pixi.js';

class MenuController {
    private tabs: NodeListOf<HTMLElement>;
    private contents: NodeListOf<HTMLElement>;
    private lexiconApp: PIXI.Application | null = null;
    private currentLexiconTickFn: (() => void) | null = null;
    private currentLexiconEnemyType: string | null;
    
    // Changelog state
    private changelogData: any[];

    // Room System Selection state
    private selectedMapName: string | null = null;

    constructor() {
        this.tabs = document.querySelectorAll('.portal-tab');
        this.contents = document.querySelectorAll('.tab-content-wrapper');
        new BackgroundController('bgCanvas');
        
        this.lexiconApp = null;
        this.currentLexiconEnemyType = null;
        
        this.changelogData = [];
        
        this.init();
    }

    private init(): void {
        this.initTabs();
        this.initMissions();
        this.initSettings();
        this.initLexicon();
        this.fetchMissionStats();
        this.fetchOnlinePlayers();
        this.initChangelog();
        this.initModeModal();
        
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
        } catch(e) {
            console.warn("Socket.io not available in menu", e);
        }
    }

    private async fetchMissionStats(): Promise<void> {
        try {
            // Using absolute URL or relative if served from same host
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

    // --- Navigation & Tabs ---
    private positionTabIndicator(): void {
        const activeTab = document.querySelector('.portal-tab.active') as HTMLElement | null;
        const indicator = document.querySelector('.portal-tab-indicator') as HTMLElement | null;
        if (activeTab && indicator) {
            indicator.style.left = `${activeTab.offsetLeft}px`;
            indicator.style.width = `${activeTab.offsetWidth}px`;
        }
    }

    private initTabs(): void {
        // Initialize the first active tab content
        const firstActive = Array.from(this.contents).find(c => !c.classList.contains('hidden'));
        if (firstActive) {
            firstActive.classList.add('active-tab-content');
        }

        // Initialize active tab indicator position asynchronously once the DOM renders
        setTimeout(() => this.positionTabIndicator(), 60);

        this.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                if (target) {
                    this.switchTab(target);
                }
            });
        });

        // Add resize listener to keep active indicator perfectly aligned on screen resize
        window.addEventListener('resize', () => this.positionTabIndicator());
    }

    private switchTab(tabId: string): void {
        const currentActive = Array.from(this.contents).find(c => !c.classList.contains('hidden')) as HTMLElement;
        const targetActive = document.getElementById(`tab-${tabId}`) as HTMLElement;
        
        if (!targetActive || currentActive === targetActive) return;
        
        // 1. Update tab button states immediately for instant UI feedback
        this.tabs.forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`[data-tab="${tabId}"]`) as HTMLElement | null;
        if (activeTab) {
            activeTab.classList.add('active');
            // Animate the physical tab slider indicator smoothly
            this.positionTabIndicator();
        }
        
        if (currentActive) {
            // 2. Fade out current content
            currentActive.classList.remove('active-tab-content');
            
            // 3. Wait for fade-out transition to complete (250ms)
            setTimeout(() => {
                currentActive.classList.add('hidden');
                
                // 4. Unhide new content (set display, but keeping opacity: 0 and transform: translateY)
                targetActive.classList.remove('hidden');
                
                // 5. Force reflow to register the display change before animating
                void targetActive.offsetWidth;
                
                // 6. Fade in new content smoothly
                targetActive.classList.add('active-tab-content');
                
                if (tabId === 'lexicon') {
                    this.initLexicon(); // Refresh Lexicon
                }
            }, 250); // Matches the 0.25s CSS transition duration!
        } else {
            // Fallback for initial load
            targetActive.classList.remove('hidden');
            void targetActive.offsetWidth;
            targetActive.classList.add('active-tab-content');
            if (tabId === 'lexicon') {
                this.initLexicon();
            }
        }
    }

    // --- Mission Selection ---
    private initMissions(): void {
        const cards = document.querySelectorAll('.mission-card');
        cards.forEach(card => {
            const htmlCard = card as HTMLElement;
            htmlCard.addEventListener('click', () => {
                const mapName = htmlCard.dataset.map;
                if (!mapName) return;
                
                this.selectedMapName = mapName;

                // Update Modal Header Map Title
                const modalMapHeader = document.getElementById('modalMapName');
                if (modalMapHeader) {
                    modalMapHeader.textContent = `SEKTOR-ZUGRIFF: ${mapName.toUpperCase()}`;
                }

                // Show the selection Modal
                const modal = document.getElementById('modeSelectionModal');
                if (modal) {
                    modal.classList.remove('hidden');
                }
            });
        });
    }

    // --- Mode Selection Modal Controller ---
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

        // URL Error Banner checking
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

        // Close on background click or close click
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) hideModal();
        });
        closeModal?.addEventListener('click', hideModal);

        // Core transition and redirection helper
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

        // Solo Simulation
        startSolo?.addEventListener('click', () => {
            if (!this.selectedMapName) return;
            transitionAndRedirect(`game.html?map=${encodeURIComponent(this.selectedMapName)}&mode=singleplayer`);
        });

        // Public Matchmaking
        startPublic?.addEventListener('click', () => {
            if (!this.selectedMapName) return;
            transitionAndRedirect(`game.html?map=${encodeURIComponent(this.selectedMapName)}&mode=public`);
        });

        // Private Lobby Creation
        createPrivate?.addEventListener('click', () => {
            if (!this.selectedMapName) return;
            transitionAndRedirect(`game.html?map=${encodeURIComponent(this.selectedMapName)}&mode=private&action=create`);
        });

        // Private Lobby Joining (Modal View)
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

        // Direct Code Join View (Quick-Access Bar)
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
                    // Transition and redirect
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

        // XSS Prevention: Build structural DOM nodes and strictly set textContent
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
            
            // Clear parameter from history securely without refresh
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
        });

        portalBody.insertBefore(banner, portalBody.firstChild);
    }

    // --- Einstellungen (Settings) ---
    private initSettings(): void {
        const sound = document.getElementById('soundVolume') as HTMLInputElement | null;
        const music = document.getElementById('musicVolume') as HTMLInputElement | null;
        const perf = document.getElementById('perfModeToggle') as HTMLInputElement | null;
        const fps = document.getElementById('fpsToggle') as HTMLInputElement | null;
        const refresh = document.getElementById('refreshRateSelect') as HTMLSelectElement | null;

        // Load saved
        if (sound) sound.value = localStorage.getItem('td_sound_vol') || '50';
        if (music) music.value = localStorage.getItem('td_music_vol') || '50';
        if (perf) perf.checked = localStorage.getItem('td_perf_mode') === 'true';
        if (fps) fps.checked = localStorage.getItem('td_show_fps') === 'true';
        if (refresh) refresh.value = localStorage.getItem('td_refresh_rate') || '60';

        // Listeners
        sound?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_sound_vol', target.value);
        });
        music?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_music_vol', target.value);
        });
        perf?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_perf_mode', String(target.checked));
        });
        fps?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_show_fps', String(target.checked));
        });
        refresh?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            localStorage.setItem('td_refresh_rate', target.value);
        });
    }

    // --- Database (Lexicon) ---
    private initLexicon(): void {
        const listContainer = document.getElementById('lexiconList');
        const detailsContainer = document.getElementById('lexiconDetails');
        const placeholder = document.getElementById('lexiconPlaceholder');
        
        if (!listContainer) return;
        listContainer.innerHTML = '';
        
        const discovered = JSON.parse(localStorage.getItem('td_discovered_enemies') || '{}');
        const recordWave = parseInt(localStorage.getItem('td_record_wave') || '0');
        
        const categories = ['Bosse', 'Special Minions', 'Minions'];
        
        categories.forEach(cat => {
            const catEnemies = Object.keys(EnemyData).filter(key => EnemyData[key].category === cat);
            if (catEnemies.length === 0) return;

            const header = document.createElement('div');
            header.className = 'lexicon-category-header';
            header.innerText = cat;
            listContainer.appendChild(header);

            // Filter out fragments from main loop
            const mainEnemies = catEnemies.filter(k => k !== 'DefragmenterFragment' && k !== 'DefragmenterSubfragment');

            mainEnemies.forEach(key => {
                const data = EnemyData[key];
                // If they reached the wave, it's discovered automatically in the database
                const isDiscovered = !!discovered[key] || (!!data.unlockWave && recordWave >= data.unlockWave);
                
                const btn = document.createElement('button');
                btn.className = 'lexicon-entry-btn';
                btn.dataset.discovered = isDiscovered ? 'true' : 'false';
                btn.style.width = '100%';
                btn.style.marginBottom = '10px';
                btn.style.textAlign = 'left';
                btn.style.padding = '15px 20px';
                btn.style.background = 'rgba(255,255,255,0.03)';
                btn.style.border = '1px solid rgba(255,255,255,0.05)';
                btn.style.borderRadius = '10px';
                btn.style.color = isDiscovered ? '#fff' : '#444';
                btn.style.fontFamily = 'Outfit';
                btn.style.fontSize = '1.1rem';
                btn.style.letterSpacing = '1px';
                btn.style.cursor = 'pointer';
                btn.style.transition = '0.3s';
                
                if (isDiscovered) {
                    btn.innerHTML = `<span style="margin-right: 15px; font-size: 1.4rem;">${data.icon}</span> ${data.name.toUpperCase()}`;
                } else {
                    btn.innerHTML = `<span style="margin-right: 15px; font-size: 1.4rem; opacity: 0.3;">?</span> UNKNOWN ENTITY`;
                    btn.style.fontStyle = 'italic';
                }
                
                btn.addEventListener('click', () => {
                    document.querySelectorAll('.lexicon-entry-btn').forEach(b => {
                        const htmlB = b as HTMLElement;
                        htmlB.style.background = 'rgba(255,255,255,0.03)';
                        htmlB.style.borderColor = 'rgba(255,255,255,0.05)';
                        htmlB.style.color = htmlB.dataset.discovered === 'true' ? '#fff' : '#444';
                    });
                    btn.style.background = isDiscovered ? 'rgba(76, 201, 240, 0.1)' : 'rgba(255,255,255,0.05)';
                    btn.style.borderColor = isDiscovered ? 'var(--tesla-cyan)' : 'rgba(255,255,255,0.1)';
                    if (isDiscovered) btn.style.color = 'var(--tesla-cyan)';

                    if (placeholder) placeholder.style.display = 'none';
                    if (detailsContainer) detailsContainer.style.display = 'flex';
                    
                    this.updateLexiconDetails(key, data, isDiscovered);

                    const fragContainer = document.getElementById('defragmenter-fragments-container');
                    if (fragContainer) {
                        if (key === 'Defragmenter') {
                            fragContainer.style.display = 'block';
                        } else {
                            fragContainer.style.display = 'none';
                        }
                    }
                });
                listContainer.appendChild(btn);

                if (key === 'Defragmenter') {
                    const fragmentsContainer = document.createElement('div');
                    fragmentsContainer.id = 'defragmenter-fragments-container';
                    fragmentsContainer.style.display = 'none';
                    fragmentsContainer.style.paddingLeft = '35px';
                    
                    const fragments = ['DefragmenterFragment', 'DefragmenterSubfragment'];
                    fragments.forEach(fragKey => {
                        const fragData = EnemyData[fragKey];
                        const fragDiscovered = !!discovered[fragKey] || (!!fragData.unlockWave && recordWave >= fragData.unlockWave);
                        
                        const fragBtn = document.createElement('button');
                        fragBtn.className = 'lexicon-entry-btn';
                        fragBtn.dataset.discovered = fragDiscovered ? 'true' : 'false';
                        fragBtn.style.width = '100%';
                        fragBtn.style.marginBottom = '10px';
                        fragBtn.style.textAlign = 'left';
                        fragBtn.style.padding = '10px 15px';
                        fragBtn.style.background = 'rgba(255,255,255,0.03)';
                        fragBtn.style.border = '1px solid rgba(255,255,255,0.05)';
                        fragBtn.style.borderRadius = '10px';
                        fragBtn.style.color = fragDiscovered ? '#fff' : '#444';
                        fragBtn.style.fontFamily = 'Outfit';
                        fragBtn.style.fontSize = '0.95rem';
                        fragBtn.style.letterSpacing = '1px';
                        fragBtn.style.cursor = 'pointer';
                        fragBtn.style.transition = '0.3s';
                        
                        if (fragDiscovered) {
                            fragBtn.innerHTML = `<span style="margin-right: 15px; font-size: 1.2rem;">${fragData.icon}</span> ${fragData.name.toUpperCase()}`;
                        } else {
                            fragBtn.innerHTML = `<span style="margin-right: 15px; font-size: 1.2rem; opacity: 0.3;">?</span> UNKNOWN ENTITY`;
                            fragBtn.style.fontStyle = 'italic';
                        }

                        fragBtn.addEventListener('click', () => {
                            document.querySelectorAll('.lexicon-entry-btn').forEach(b => {
                                const htmlB = b as HTMLElement;
                                htmlB.style.background = 'rgba(255,255,255,0.03)';
                                htmlB.style.borderColor = 'rgba(255,255,255,0.05)';
                                htmlB.style.color = htmlB.dataset.discovered === 'true' ? '#fff' : '#444';
                            });
                            fragBtn.style.background = fragDiscovered ? 'rgba(76, 201, 240, 0.1)' : 'rgba(255,255,255,0.05)';
                            fragBtn.style.borderColor = fragDiscovered ? 'var(--tesla-cyan)' : 'rgba(255,255,255,0.1)';
                            if (fragDiscovered) fragBtn.style.color = 'var(--tesla-cyan)';

                            if (placeholder) placeholder.style.display = 'none';
                            if (detailsContainer) detailsContainer.style.display = 'flex';
                            
                            this.updateLexiconDetails(fragKey, fragData, fragDiscovered);
                        });

                        fragmentsContainer.appendChild(fragBtn);
                    });
                    
                    listContainer.appendChild(fragmentsContainer);
                }
            });
        });
    }

    private updateLexiconDetails(key: string, data: any, isDiscovered: boolean): void {
        const title = document.getElementById('lexTitle');
        const desc = document.getElementById('lexDescription');
        const hpBar = document.getElementById('lexHpBar');
        const speedBar = document.getElementById('lexSpeedBar');
        const rewardBar = document.getElementById('lexRewardBar');
        const stars = document.getElementById('lexDifficultyStars');
        const wave = document.getElementById('lexMinWave');
        const ability = document.getElementById('lexAbility');
        const weakness = document.getElementById('lexWeakness');
        const flavor = document.getElementById('lexFlavor');
        const iconContainer = document.getElementById('lexIcon');

        if (!title || !desc || !hpBar || !speedBar || !rewardBar || !stars || !wave || !ability || !weakness || !flavor || !iconContainer) return;

        if (isDiscovered) {
            title.innerText = data.name;
            title.style.color = data.color;
            iconContainer.style.borderColor = data.color;
            desc.innerText = data.description || 'No detailed tactical data available.';
            hpBar.style.width = Math.min(100, data.hp) + '%';
            hpBar.style.backgroundColor = '#ff3366';
            speedBar.style.width = Math.min(100, data.speed) + '%';
            speedBar.style.backgroundColor = '#4cc9f0';
            rewardBar.style.width = Math.min(100, data.reward) + '%';
            rewardBar.style.backgroundColor = '#fca311';
            stars.innerText = '★'.repeat(data.difficulty) + '☆'.repeat(5 - data.difficulty);
            wave.innerText = `WAVE ${data.unlockWave || 1}`;
            ability.innerText = data.ability;
            weakness.innerText = data.weakness;
            flavor.innerText = `"${data.flavorText}"`;
            iconContainer.style.boxShadow = `0 0 50px ${data.color}33`;
        } else {
            title.innerText = 'ENCRYPTED';
            title.style.color = '#333';
            iconContainer.style.borderColor = '#222';
            desc.innerText = 'Tactic data restricted. Neutralize entity in simulation to unlock database entry.';
            hpBar.style.width = '0%';
            speedBar.style.width = '0%';
            rewardBar.style.width = '0%';
            stars.innerText = '?????';
            wave.innerText = 'LOCKED';
            ability.innerText = 'Unknown';
            weakness.innerText = 'Unknown';
            flavor.innerText = 'Simulation progress required.';
            iconContainer.style.boxShadow = 'none';
        }
        
        this.renderLexiconEnemy(key, isDiscovered);
    }

    private renderLexiconEnemy(enemyType: string, isDiscovered: boolean): void {
        if (this.currentLexiconEnemyType === enemyType) {
            return;
        }
        this.currentLexiconEnemyType = enemyType;

        const initLexiconApp = async () => {
            if (!this.lexiconApp) {
                const canvas = document.getElementById('lexiconCanvas') as HTMLCanvasElement | null;
                if (!canvas) return;
                
                this.lexiconApp = new PIXI.Application();
                await this.lexiconApp.init({
                    canvas: canvas,
                    backgroundAlpha: 0,
                    width: 180,
                    height: 180,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true
                });
            } else {
                this.lexiconApp.stage.removeChildren();
                if (this.currentLexiconTickFn) {
                    this.lexiconApp.ticker.remove(this.currentLexiconTickFn);
                    this.currentLexiconTickFn = null;
                }
            }

            const enemy = EnemyFactory.createEnemy(enemyType as EnemyType, 1, true);
            enemy.x = 90;
            enemy.y = 90;
            enemy.hideHealthBar = true;
            
            // Add to stage
            if (enemy.pixiSprite) {
                this.lexiconApp.stage.addChild(enemy.pixiSprite);
                enemy.pixiSprite.position.set(90, 90);
                
                let scaleFactor = 3.0;
                if (enemyType === 'Boss' || enemyType === 'Defragmenter') scaleFactor = 0.8;
                if (enemyType === 'DefragmenterFragment') scaleFactor = 1.5;
                if (enemyType === 'Bruiser') scaleFactor = 2.2;
                if (enemyType === 'Accelerator') scaleFactor = 2.0;
                
                enemy.pixiSprite.scale.set(scaleFactor);
            }

            const tickFn = () => {
                if (enemy.pulseTime !== undefined) enemy.pulseTime += 0.05 * Math.max(1, enemy.speed);
                if (enemyType !== 'Accelerator' && enemy.rotation !== undefined) {
                    enemy.rotation += 0.02 * Math.max(1, enemy.speed) * (enemy.rotationSpeedMultiplier ?? 1.0);
                }
                if (enemy.outerRotation !== undefined) enemy.outerRotation += 0.02 * Math.max(1, enemy.speed);
                
                if (enemy.updatePixi) enemy.updatePixi();
                
                if (enemy.pixiSprite) {
                    if (!isDiscovered) {
                        enemy.pixiSprite.tint = 0x111111;
                    } else {
                        enemy.pixiSprite.tint = 0xffffff;
                    }
                }
            };
            
            this.currentLexiconTickFn = tickFn;
            this.lexiconApp.ticker.add(tickFn);
        };
        
        initLexiconApp();
    }

    private async initChangelog(): Promise<void> {
        const toggleBtn = document.getElementById('changelog-toggle');
        const panel = document.getElementById('changelog-panel');
        const icon = toggleBtn?.querySelector('.toggle-icon') as HTMLElement | null;
        const pulseDot = document.getElementById('changelog-pulse');

        if (!toggleBtn || !panel || !icon) {
            console.warn("Changelog DOM elements not found");
            return;
        }

        // 1. Restore/Determine collapse state
        const savedCollapsed = localStorage.getItem('td_changelog_collapsed');
        const isMobileOrTablet = window.innerWidth < 1400;
        const shouldCollapse = savedCollapsed !== null ? savedCollapsed === 'true' : isMobileOrTablet;

        if (shouldCollapse) {
            panel.classList.add('collapsed');
            icon.innerText = '◀';
        } else {
            panel.classList.remove('collapsed');
            icon.innerText = '▶';
        }

        // 2. Toggle Panel click listener
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyCollapsed = panel.classList.contains('collapsed');
            if (isCurrentlyCollapsed) {
                panel.classList.remove('collapsed');
                icon.innerText = '▶';
                localStorage.setItem('td_changelog_collapsed', 'false');

                // Mark as read when expanded (find first actual version)
                const firstActualVersion = this.changelogData.find(v => v.version);
                if (firstActualVersion) {
                    const latestVersion = firstActualVersion.version;
                    localStorage.setItem('td_changelog_last_read', latestVersion);
                }
                if (pulseDot) {
                    pulseDot.classList.add('hidden');
                }
            } else {
                panel.classList.add('collapsed');
                icon.innerText = '◀';
                localStorage.setItem('td_changelog_collapsed', 'true');
            }
        });

        // 3. Fetch the changelog.json
        try {
            const response = await fetch('assets/changelog.json', { cache: 'no-cache' });
            if (response.ok) {
                this.changelogData = await response.json();
                this.renderChangelog();

                // Check read status to display notification dot
                if (this.changelogData && this.changelogData.length > 0) {
                    const firstActualVersion = this.changelogData.find(v => v.version);
                    if (firstActualVersion) {
                        const latestVersion = firstActualVersion.version;
                        const lastReadVersion = localStorage.getItem('td_changelog_last_read');
                        const isCurrentlyOpen = !panel.classList.contains('collapsed');

                        if (isCurrentlyOpen) {
                            // Mark as read immediately if it loads open (e.g. wide desktop screen)
                            localStorage.setItem('td_changelog_last_read', latestVersion);
                        } else if (lastReadVersion !== latestVersion) {
                            // Show pulsing dot if closed and unread
                            if (pulseDot) {
                                pulseDot.classList.remove('hidden');
                            }
                        }
                    }
                }
            } else {
                this.showChangelogError();
            }
        } catch (err) {
            console.warn('Changelog fetch failed:', err);
            this.showChangelogError();
        }
    }

    private showChangelogError(): void {
        const listContainer = document.getElementById('changelog-list');
        if (listContainer) {
            listContainer.innerHTML = '<div class="changelog-empty" style="color: var(--bomb-red);">Fehler beim Laden des Update-Logs.</div>';
        }
    }

    private renderChangelog(): void {
        const listContainer = document.getElementById('changelog-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        if (!this.changelogData || this.changelogData.length === 0) {
            listContainer.innerHTML = '<div class="changelog-empty">Keine Einträge vorhanden.</div>';
            return;
        }

        let renderedCount = 0;

        this.changelogData.forEach((versionEntry) => {
            // Skip metadata/comment entries in the JSON array
            if (versionEntry.isComment || !versionEntry.version || !versionEntry.changes) {
                return;
            }

            renderedCount++;

            // Create card element
            const card = document.createElement('div');
            card.className = 'version-card';
            if (renderedCount === 1) {
                card.classList.add('expanded');
            }

            // Create Header Click Area
            const header = document.createElement('div');
            header.className = 'version-header-click';
            
            header.innerHTML = `
                <div class="version-meta">
                    <span class="version-num">${versionEntry.version}</span>
                    <span class="version-date">${versionEntry.date}</span>
                </div>
                <span class="version-toggle-icon">▶</span>
            `;

            // Create Details block
            const details = document.createElement('div');
            details.className = 'version-details';

            // Fill details with changes
            versionEntry.changes.forEach((change: any) => {
                const item = document.createElement('div');
                item.className = 'change-item';

                // Category badge translation
                let badgeClass = 'feature';
                let badgeLabel = 'NEW';
                if (change.type === 'balance') { badgeClass = 'balance'; badgeLabel = 'BAL'; }
                if (change.type === 'fix') { badgeClass = 'fix'; badgeLabel = 'FIX'; }
                if (change.type === 'perf') { badgeClass = 'perf'; badgeLabel = 'PERF'; }

                item.innerHTML = `
                    <span class="change-badge ${badgeClass}">${badgeLabel}</span>
                    <p class="change-desc">${change.desc}</p>
                `;
                details.appendChild(item);
            });

            // Toggle Expand click listener
            header.addEventListener('click', () => {
                const isExpanded = card.classList.contains('expanded');
                if (isExpanded) {
                    card.classList.remove('expanded');
                } else {
                    card.classList.add('expanded');
                }
            });

            card.appendChild(header);
            card.appendChild(details);
            listContainer.appendChild(card);
        });

        // If no version cards were rendered, show clean empty state
        if (renderedCount === 0) {
            listContainer.innerHTML = '<div class="changelog-empty">Keine Einträge vorhanden.</div>';
        }
    }
}

// Start Controller
window.addEventListener('DOMContentLoaded', () => {
    new MenuController();
});
