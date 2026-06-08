/*
 * @file: frontend/src/js/ui/ui.ts
 * @purpose: Main orchestration layer coordinating UI updates, setting key listeners, and linking panels together.
 * @dependencies: state, multiplayer, config, utils, icons, hud, tooltips, modals, modMenu, events, notifications
 * @last_update: 2026-05-29 / v1.6.1 - Enabled dynamic modUndoWaveBtn status updates for hosts.
 */
import { state } from '../core/state';
import { Config, TowerData } from '../core/config';
import { getEl, formatNumber } from '../core/utils';

import { ICONS } from './icons';
import { updateHudDisplay } from './hud';
import { updateTooltip } from './tooltips';
import { showGameOverScreen } from './modals';
import { setupModMenu } from './modMenu';
import { setupEvents } from './events';
import { showGameNotification } from './notifications';

export { updateTooltip, showGameNotification };

let lastRenderedWave = -1;
let lastRenderedHost: boolean | null = null;
let lastRenderedCheats: boolean | null = null;
let lastRenderedInfiniteGold: boolean | null = null;
let lastRenderedModInfiniteGold: boolean | null = null;
let lastRenderedGodMode: boolean | null = null;
let lastRenderedGold = -1;
let lastRenderedOriginalWave: number | null | undefined = undefined;

let lastBtnBenchmark: boolean | null = null;
let lastBtnHost: boolean | null = null;
let lastBtnWaveActive: boolean | null = null;
let lastBtnAutoStart: boolean | null = null;
let lastBtnWave = -1;
let lastRenderedWebRTCStatus: string | null = null;

let cachedTowerBtns: NodeListOf<Element> | null = null;
function getTowerBtns(): NodeListOf<Element> {
    if (!cachedTowerBtns) {
        cachedTowerBtns = document.querySelectorAll('.tower-btn');
    }
    return cachedTowerBtns;
}

export function updateUI(): void {
    updateHudDisplay();

    if (lastRenderedWave !== state.wave) {
        lastRenderedWave = state.wave;
        const waveDisplay = getEl('waveDisplay');
        if (waveDisplay) waveDisplay.innerText = String(state.wave);
    }

    if (lastRenderedHost !== state.isHost) {
        lastRenderedHost = state.isHost;
        const hostInd = getEl('hostIndicatorText');
        if (hostInd) {
            hostInd.innerText = state.isHost ? '👑 HOST' : '👥 CLIENT';
            hostInd.style.color = state.isHost ? '#ffb703' : '#4cc9f0';
        }
        const modMenu = getEl('modMenu');
        if (modMenu && !state.isHost && !modMenu.classList.contains('hidden')) {
            modMenu.classList.add('hidden');
        }
    }

    if (lastRenderedWebRTCStatus !== state.webRTCStatus || lastRenderedHost !== state.isHost) {
        lastRenderedWebRTCStatus = state.webRTCStatus || 'idle';
        const netStatus = getEl('networkStatus');
        if (netStatus) {
            if (!state.isHost && state.webRTCStatus && state.webRTCStatus !== 'idle') {
                netStatus.style.display = 'flex';
                if (state.webRTCStatus === 'connected') {
                    netStatus.style.borderColor = '#00ff88';
                    netStatus.style.color = '#00ff88';
                    netStatus.style.background = 'rgba(0, 255, 136, 0.1)';
                    netStatus.style.boxShadow = '0 0 10px rgba(0, 255, 136, 0.2)';
                    netStatus.style.animation = '';
                    netStatus.setAttribute('title', 'Netzwerk: WebRTC (Direkt & Schnell)');
                } else if (state.webRTCStatus === 'connecting') {
                    netStatus.style.borderColor = '#ffb703';
                    netStatus.style.color = '#ffb703';
                    netStatus.style.background = 'rgba(255, 183, 3, 0.1)';
                    netStatus.style.boxShadow = '0 0 10px rgba(255, 183, 3, 0.2)';
                    netStatus.style.animation = 'pulse-orange-glow 1.5s infinite alternate';
                    netStatus.setAttribute('title', 'Netzwerk: Verbinde WebRTC...');
                } else if (state.webRTCStatus === 'failed') {
                    netStatus.style.borderColor = '#ff3366';
                    netStatus.style.color = '#ff3366';
                    netStatus.style.background = 'rgba(255, 51, 102, 0.1)';
                    netStatus.style.boxShadow = '0 0 10px rgba(255, 51, 102, 0.2)';
                    netStatus.style.animation = 'pulse-red 1.5s infinite alternate';
                    netStatus.setAttribute('title', 'Netzwerk-Degradierung: Socket.io Fallback (Langsam)');
                }
            } else {
                netStatus.style.display = 'none';
            }
        }
    }

    const cheatsActive = state.godMode || state.infiniteGold || state.waveModified || state.benchmarkActive;
    if (lastRenderedCheats !== cheatsActive) {
        lastRenderedCheats = cheatsActive;
        const cheatInd = getEl('cheatIndicator');
        if (cheatInd) {
            if (cheatsActive) {
                cheatInd.classList.remove('hidden');
            } else {
                cheatInd.classList.add('hidden');
            }
        }
    }

    if (state.isHost) {
        if (lastRenderedModInfiniteGold !== state.infiniteGold) {
            lastRenderedModInfiniteGold = state.infiniteGold;
            const modGoldBtn = getEl('modGoldBtn');
            if (modGoldBtn) {
                modGoldBtn.innerText = `Infinite Gold: ${state.infiniteGold ? 'AN' : 'AUS'}`;
                modGoldBtn.style.borderColor = state.infiniteGold ? '#00ff88' : '';
            }
        }
        if (lastRenderedGodMode !== state.godMode) {
            lastRenderedGodMode = state.godMode;
            const modLifeBtn = getEl('modLifeBtn');
            if (modLifeBtn) {
                modLifeBtn.innerText = `God Mode: ${state.godMode ? 'AN' : 'AUS'}`;
                modLifeBtn.style.borderColor = state.godMode ? '#ff3366' : '';
            }
        }
        if (lastRenderedOriginalWave !== state.originalWave) {
            lastRenderedOriginalWave = state.originalWave;
            const modUndoWaveBtn = getEl('modUndoWaveBtn');
            if (modUndoWaveBtn) {
                if (state.originalWave !== null) {
                    (modUndoWaveBtn as HTMLButtonElement).disabled = false;
                    modUndoWaveBtn.classList.remove('btn-disabled');
                    modUndoWaveBtn.style.opacity = '';
                    modUndoWaveBtn.style.pointerEvents = '';
                } else {
                    (modUndoWaveBtn as HTMLButtonElement).disabled = true;
                    modUndoWaveBtn.classList.add('btn-disabled');
                    modUndoWaveBtn.style.opacity = '0.4';
                    modUndoWaveBtn.style.pointerEvents = 'none';
                }
            }
        }
    }

    if (lastRenderedGold !== state.gold || lastRenderedInfiniteGold !== state.infiniteGold) {
        lastRenderedGold = state.gold;
        lastRenderedInfiniteGold = state.infiniteGold;

        const intPreview = getEl('interestPreview');
        if (intPreview) {
            if (state.infiniteGold) {
                intPreview.innerText = `(+∞g)`;
                intPreview.style.display = 'inline';
            } else {
                const interest = Math.floor(state.gold * Config.INTEREST_RATE);
                intPreview.innerText = `(+${formatNumber(interest)}g)`;
                intPreview.style.display = interest > 0 ? 'inline' : 'none';
            }
        }

        getTowerBtns().forEach(btn => {
            const htmlBtn = btn as HTMLElement;
            const type = htmlBtn.dataset.type;
            if (!type || !TowerData[type]) return;
            const cost = TowerData[type].baseCost;

            const priceTag = htmlBtn.querySelector('.btn-label small');
            if (priceTag) {
                if (!state.infiniteGold && state.gold < cost) priceTag.classList.add('too-expensive');
                else priceTag.classList.remove('too-expensive');
            }
        });
    }

    const benchmarkActive = state.benchmarkActive === true;

    if (lastBtnBenchmark !== benchmarkActive || 
        lastBtnHost !== state.isHost || 
        lastBtnWaveActive !== state.isWaveActive || 
        lastBtnAutoStart !== state.autoStartActive || 
        lastBtnWave !== state.wave) {
        
        lastBtnBenchmark = benchmarkActive;
        lastBtnHost = state.isHost;
        lastBtnWaveActive = state.isWaveActive;
        lastBtnAutoStart = state.autoStartActive;
        lastBtnWave = state.wave;

        const benchmarkInd = getEl('benchmarkIndicator');
        if (benchmarkInd) {
            if (benchmarkActive && !state.isHost) {
                benchmarkInd.classList.remove('hidden');
            } else {
                benchmarkInd.classList.add('hidden');
            }
        }

        const clientInteractiveBtnIds = ['startWaveBtn', 'autoStartBtn', 'speedBtn', 'pauseBtn'];
        clientInteractiveBtnIds.forEach(id => {
            const btn = getEl(id) as HTMLButtonElement | null;
            if (btn) {
                if (benchmarkActive && !state.isHost) {
                    btn.disabled = true;
                    btn.classList.add('btn-disabled');
                    btn.style.opacity = '0.5';
                    btn.style.pointerEvents = 'none';
                    if (id === 'startWaveBtn') {
                        btn.innerText = 'Benchmark läuft...';
                    }
                } else {
                    btn.style.opacity = '';
                    btn.style.pointerEvents = '';

                    if (id === 'startWaveBtn') {
                        if (state.isWaveActive) {
                            btn.disabled = true;
                            btn.classList.add('btn-disabled');
                            btn.innerText = 'Welle läuft...';
                        } else if (state.autoStartActive) {
                            btn.disabled = true;
                            btn.classList.add('btn-disabled');
                            btn.innerText = 'Auto aktiv';
                        } else {
                            btn.disabled = false;
                            btn.classList.remove('btn-disabled');
                            btn.innerText = `Start Welle ${state.wave}`;
                        }
                    } else if (id === 'autoStartBtn') {
                        btn.disabled = false;
                        btn.classList.remove('btn-disabled');
                        btn.innerText = state.autoStartActive ? 'Auto: An' : 'Auto: Aus';
                        btn.style.background = state.autoStartActive ? 'linear-gradient(to bottom, #00ff88, #00b35f)' : '';
                        btn.style.color = state.autoStartActive ? '#fff' : '';
                    } else {
                        btn.disabled = false;
                        btn.classList.remove('btn-disabled');
                    }
                }
            }
        });

        getTowerBtns().forEach(btn => {
            const htmlBtn = btn as HTMLElement;
            if (benchmarkActive && !state.isHost) {
                htmlBtn.style.opacity = '0.4';
                htmlBtn.style.pointerEvents = 'none';
                htmlBtn.style.cursor = 'not-allowed';
            } else {
                htmlBtn.style.opacity = '';
                htmlBtn.style.pointerEvents = '';
                htmlBtn.style.cursor = '';
            }
        });
    }

    if (state.lives <= 0 && !state.gameOver) {
        state.gameOver = true;
        showGameOverScreen();
    }
}


export function cancelPlacement(): void {

    state.selectedTowerType = null;
    getTowerBtns().forEach(b => b.classList.remove('selected'));
    const cancelBtn = getEl('cancelPlacementBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}


export function setupUI(startWaveCallback: () => void, canvas: HTMLCanvasElement): void {
    // Inject SVG icons into tower buttons
    getTowerBtns().forEach(btn => {
        const htmlBtn = btn as HTMLElement;
        const type = htmlBtn.dataset.type;
        if (type && ICONS[type]) {
            const iconEl = htmlBtn.querySelector('.btn-icon');
            if (iconEl) iconEl.innerHTML = ICONS[type];
        }
    });

    setupModMenu();
    setupEvents(startWaveCallback, canvas);
}

const PAUSE_TIPS = [

    "Prismalaser laden ihren Schaden über Zeit auf. Perfekt gegen dicke Bosse!",
    "Kettenstrahl-Spezialisierung teilt den Laser auf mehrere Gegner auf.",
    "Tesla-Türme verursachen flächendeckenden Schaden. Platziere sie an Kurven!",
    "Scharfschützen-Türme haben eine enorme Reichweite. Upgrade sie für verheerende kritische Treffer.",
    "Bomben-Türme eignen sich hervorragend, um die Schilde von schnellen Gegnern zu brechen.",
    "Regenerierende Gegner heilen sich mit der Zeit. Konzentriere dein Feuer auf sie!",
    "Das Mutterschiff stutzt deine Türme kurzzeitig. Platziere deine Verteidigung klug verteilt.",
    "Gold-Interesse erhöht sich am Ende jeder Welle. Spare etwas Gold an, um reich zu werden!",
    "Im Baumodus kannst du keine Türme verkaufen oder upgraden – brich ihn vorher per Rechtsklick ab!",
    "Booster-Türme greifen nicht selbst an, sondern verstärken Schaden, Reichweite oder Feuerrate naher Türme!"
];

export function setPauseState(paused: boolean): void {
    if (state.gameOver) return;
    state.isPaused = paused;
    
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseOverlay = document.getElementById('pauseOverlay');
    const pauseTipText = document.getElementById('pauseTipText');

    if (pauseBtn) {
        pauseBtn.innerText = state.isPaused ? 'Weiter' : 'Pause';
        pauseBtn.style.background = state.isPaused ? 'linear-gradient(to bottom, #ffb703, #d49a00)' : '';
        pauseBtn.style.color = state.isPaused ? '#fff' : '';
    }

    if (pauseOverlay) {
        if (state.isPaused) {
            pauseOverlay.classList.remove('hidden');
            if (pauseTipText) {
                const randomTip = PAUSE_TIPS[Math.floor(Math.random() * PAUSE_TIPS.length)];
                pauseTipText.innerText = `„${randomTip}“`;
            }
        } else {
            pauseOverlay.classList.add('hidden');
        }
    }
}
