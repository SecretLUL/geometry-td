/*
 * @file: frontend\src\js\ui\modals.ts
 * @purpose: Renders game overlay panels including Level Up selections, upgrade paths, and the Game Over layout.
 * @dependencies: state, config, multiplayer, pool, utils, ui, events
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
 * @last_update: 2026-05-27 / v1.10.0 - Use formatNumber utility for Game Over gold stats and efficiency table damage.
 */
import { state } from '../core/state';
import { Config } from '../core/config';
import { Multiplayer } from '../core/multiplayer/context';
import { PoolManager } from '../core/pool';
import { getEl, formatNumber } from '../core/utils';
import { updateUI } from './ui';
import { buildTowerAt } from './events';

export function showGameOverScreen(): void {

    const currentWave = state.wave;
    const currentRecord = typeof state.recordWave === 'string' ? parseInt(state.recordWave) : state.recordWave;
    if (currentWave > currentRecord) {
        state.recordWave = currentWave;
        localStorage.setItem('td_record_wave', String(state.recordWave));
    }
    const goWave = getEl('go-wave');
    if (goWave) goWave.innerText = String(state.wave);

    const goRecord = getEl('go-record');
    if (goRecord) goRecord.innerText = String(state.recordWave);

    const goGold = getEl('go-gold');
    if (goGold) goGold.innerText = formatNumber(state.totalGoldEarned);

    const goGoldInterest = getEl('go-gold-interest');
    if (goGoldInterest) goGoldInterest.innerText = formatNumber(state.totalGoldFromInterest);

    const goGoldRest = getEl('go-gold-rest');
    if (goGoldRest) goGoldRest.innerText = formatNumber(state.totalGoldEarned - state.totalGoldFromInterest);

    // Generate Efficiency Table
    const tbody = getEl('efficiencyTbody');
    if (tbody) {
        tbody.innerHTML = '';
        const sortedTowers = [...state.towers].sort((a, b) => {
            return b.damageDealt - a.damageDealt; // highest damage first
        });

        const formatDmg = formatNumber;

        sortedTowers.forEach(t => {
            const tr = document.createElement('tr');
            const specSuffix = t.specialization ? ` (${t.specialization})` : '';
            const desc = `${t.type}${specSuffix} [X:${t.col + 1}, Y:${t.row + 1}]`;

            tr.innerHTML = `
                <td>${desc}</td>
                <td>${t.level}</td>
                <td>${t.totalSpent}</td>
                <td>${formatDmg(t.damageDealt)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    const bossHp = getEl('bossHpContainer');
    if (bossHp) bossHp.classList.add('hidden');

    const gameOver = getEl('gameOverScreen');
    if (gameOver) gameOver.classList.remove('hidden');
}


export function showUpgradeModal(tower: any): void {

    const modal = document.getElementById('upgradeModal');
    const nameEl = document.getElementById('upgradeTowerName');
    const container = document.getElementById('upgradeOptionsContainer');

    if (nameEl) nameEl.innerText = tower.type + ' Tower';
    if (container) {
        container.innerHTML = '';
        const specs = tower.getSpecializations();
        specs.forEach((spec: any) => {
            const btn = document.createElement('button');
            btn.className = 'upgrade-option-btn';
            btn.innerHTML = `
                <div class="spec-title">${spec.name}</div>
                <div class="spec-desc">${spec.desc}</div>
            `;
            btn.addEventListener('click', () => {
                modal?.classList.add('hidden');
                
                if (!state.isHost) {
                    const cost = tower.upgradeCost;
                    if (state.infiniteGold || state.gold >= cost) {
                        if (!state.infiniteGold) {
                            state.gold -= cost;
                        }
                        tower.applySpecialization(spec.id);
                    }
                }
                
                updateUI();

                // Multiplayer: Request specialization
                (Multiplayer as any).emitRequestUpgradeTower(tower.col, tower.row, spec.id);
            });
            container.appendChild(btn);
        });
        modal?.classList.remove('hidden');
    }
}


export function updateContextShopPosition(): void {
    const contextMenu = document.getElementById('context-shop');
    if (!contextMenu || contextMenu.classList.contains('hidden') || !state.contextShopCell || !state.contextShopPos) return;

    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    // Use CSS layout dimensions so context shop position aligns with CSS pixel space,
    // compatible with High-DPI canvas where canvas.width > clientWidth
    const scaleX = (canvas.clientWidth  || canvas.width)  / rect.width;
    const scaleY = (canvas.clientHeight || canvas.height) / rect.height;
    const camX = state.camera ? state.camera.x : 0;
    const camY = state.camera ? state.camera.y : 0;

    const TS = Config.TILE_SIZE;
    const cellCanvasX = state.contextShopPos.x;
    const cellCanvasY = state.contextShopPos.y;

    const cellLeft = rect.left + (cellCanvasX + camX) / scaleX;
    const cellTop = rect.top + (cellCanvasY + camY) / scaleY;
    const cellWidth = TS / scaleX;
    const cellHeight = TS / scaleY;

    const menuWidth = 175;
    const menuHeight = 310;
    const gap = 18;

    let targetLeft = 0;
    let targetTop = 0;

    const spaceBelow = window.innerHeight - (cellTop + cellHeight);
    const spaceAbove = cellTop;
    const spaceLeft = cellLeft;
    const spaceRight = window.innerWidth - (cellLeft + cellWidth);

    if (spaceAbove >= menuHeight + 10) {
        // Position cleanly ABOVE the selected cell
        targetTop = cellTop - menuHeight - gap;
        targetLeft = cellLeft + cellWidth / 2 - menuWidth / 2;
    } else if (spaceBelow >= menuHeight + 10) {
        // Position cleanly BELOW the selected cell
        targetTop = cellTop + cellHeight + gap;
        targetLeft = cellLeft + cellWidth / 2 - menuWidth / 2;
    } else {
        // Screen height is insufficient -> Position LEFT or RIGHT of the selected cell
        if (spaceLeft >= spaceRight && spaceLeft >= menuWidth + 10) {
            // Position to the LEFT of the selected cell
            targetLeft = cellLeft - menuWidth - gap;
            targetTop = cellTop + cellHeight / 2 - menuHeight / 2;
        } else if (spaceRight >= menuWidth + 10) {
            // Position to the RIGHT of the selected cell
            targetLeft = cellLeft + cellWidth + gap;
            targetTop = cellTop + cellHeight / 2 - menuHeight / 2;
        } else {
            // Absolute maximum space fallback
            const maxSpace = Math.max(spaceAbove, spaceBelow, spaceLeft, spaceRight);
            if (maxSpace === spaceAbove) {
                targetTop = cellTop - menuHeight - gap;
                targetLeft = cellLeft + cellWidth / 2 - menuWidth / 2;
            } else if (maxSpace === spaceBelow) {
                targetTop = cellTop + cellHeight + gap;
                targetLeft = cellLeft + cellWidth / 2 - menuWidth / 2;
            } else if (maxSpace === spaceLeft) {
                targetLeft = cellLeft - menuWidth - gap;
                targetTop = cellTop + cellHeight / 2 - menuHeight / 2;
            } else {
                targetLeft = cellLeft + cellWidth + gap;
                targetTop = cellTop + cellHeight / 2 - menuHeight / 2;
            }
        }
    }

    // Clamp the calculated positions so they remain entirely inside the viewport
    targetLeft = Math.min(window.innerWidth - menuWidth - 10, Math.max(10, targetLeft));
    targetTop = Math.min(window.innerHeight - menuHeight - 10, Math.max(10, targetTop));

    contextMenu.style.left = `${targetLeft}px`;
    contextMenu.style.top = `${targetTop}px`;
}


export function hideContextShop(): void {
    const contextShop = document.getElementById('context-shop');
    if (!contextShop || contextShop.classList.contains('hidden') || contextShop.classList.contains('closing')) {
        state.contextShopCell = null;
        state.contextShopPos = null;
        return;
    }

    state.contextShopCell = null;
    state.contextShopPos = null;
    contextShop.classList.add('closing');

    const onAnimationEnd = (e: AnimationEvent) => {
        if (e.animationName === 'context-pop-out') {
            contextShop.classList.remove('closing');
            contextShop.classList.add('hidden');
            contextShop.removeEventListener('animationend', onAnimationEnd);
        }
    };
    contextShop.addEventListener('animationend', onAnimationEnd);
}


export function showContextShop(x: number, y: number, col: number, row: number): void {

    const contextMenu = document.getElementById('context-shop');
    if (!contextMenu) return;

    // Handle re-entrance: remove closing state if still animating out
    contextMenu.classList.remove('closing');

    // Center camera on the selected cell first
    if (state.centerCameraOnCell) {
        state.centerCameraOnCell(col, row);
    }

    state.contextShopCell = { col, row };

    const TS = Config.TILE_SIZE;
    if (!state.contextShopPos) {
        state.contextShopPos = { x: col * TS, y: row * TS };
    }

    const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement | null;
    if (canvas) {
        updateContextShopPosition();
    } else {
        contextMenu.style.left = `${Math.min(window.innerWidth - 180, Math.max(10, x - 80))}px`;
        contextMenu.style.top = `${Math.min(window.innerHeight - 320, Math.max(10, y - 120))}px`;
    }


    contextMenu.innerHTML = '';

    const shopItems = [
        { type: 'Base', cost: Config.TOWER_BASE_COST },
        { type: 'Sniper', cost: Config.TOWER_SNIPER_COST },
        { type: 'Bomb', cost: Config.TOWER_BOMB_COST },
        { type: 'Tesla', cost: Config.TOWER_TESLA_COST },
        { type: 'Prisma', cost: Config.TOWER_PRISMA_COST }
    ];

    shopItems.forEach(item => {
        const btn = document.createElement('button');
        const tooExpensive = !state.infiniteGold && state.gold < item.cost;
        btn.className = `context-btn ${tooExpensive ? 'too-expensive' : ''}`;
        btn.innerHTML = `<span>${item.type}</span> <span class="cost">${item.cost}g</span>`;
        btn.onclick = (e) => {
            e.stopPropagation();
            if (buildTowerAt(item.type, col, row)) {
                hideContextShop();
            }
        };
        contextMenu.appendChild(btn);
    });

    // Add Cancel ("Abbrechen") Button at the bottom
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'context-btn cancel-btn';
    cancelBtn.innerHTML = `<span>Abbrechen</span>`;
    cancelBtn.onclick = (e) => {
        e.stopPropagation();
        hideContextShop();
    };
    contextMenu.appendChild(cancelBtn);

    contextMenu.classList.remove('hidden');
}

