/*
 * @file: frontend\src\js\ui\tooltips.ts
 * @purpose: Renders context-sensitive stats and upgrade details when hovering towers or UI icons.
 * @dependencies: state, config, utils
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
 * @last_update: 2026-05-27 / v1.2.0 - Unified and localized tower tooltips on the battlefield and in the shop UI, removed Kills completely, hid Spezial/Upgrade in shop tooltips, and simplified Prisma Tower stats to DPS.
 */
import { state } from '../core/state';
import { Config } from '../core/config';
import { getEl } from '../core/utils';

export function updateTooltip(): void {
    const tooltip = getEl('tooltip');
    if (!tooltip) return;

    const mouseX = state.ghostMouse.x;
    const mouseY = state.ghostMouse.y;

    // Recalculate hovers (important if they moved under a static mouse)
    let hoveredTower: any = null;
    for (let tower of state.towers) {
        if (tower.checkHover && tower.checkHover(mouseX, mouseY)) {
            hoveredTower = tower;
            break;
        }
    }
    state.hoveredTower = hoveredTower;

    let hoveredEnemy: any = null;
    for (let enemy of state.enemies) {
        if (enemy.checkHover && enemy.checkHover(mouseX, mouseY)) {
            hoveredEnemy = enemy;
            break;
        }
    }
    state.hoveredEnemy = hoveredEnemy;

    if (hoveredTower && !state.selectedTowerType) {
        const maxLvl = hoveredTower.level >= Config.TOWER_MAX_LEVEL;
        const specs = hoveredTower.getSpecializations ? hoveredTower.getSpecializations() : [];
        const specData = specs.find((s: any) => s.id === hoveredTower.specialization);
        const specName = specData ? specData.name : 'Keine';

        let bottomSection = '';
        if (hoveredTower.level < Config.TOWER_SPECIALIZATION_LEVEL) {
            const specList = specs.map((s: any) => s.name).join(' | ');
            bottomSection = `
                <strong style="color:#fca311">Level ${Config.TOWER_SPECIALIZATION_LEVEL} Spezialisierung:</strong><br>
                <span style="color:#aaa">${specList}</span>
            `;
        } else {
            const spec = hoveredTower.specialization;
            const specsList = hoveredTower.getSpecializations ? hoveredTower.getSpecializations() : [];

            if (spec) {
                const specInfo = hoveredTower.getSpecializationInfo(spec, false);
                const masteryInfo = hoveredTower.getSpecializationInfo(spec, true);

                bottomSection = `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div>
                            <strong style="color:#fca311">Spezialisierung:</strong><br>
                            <span style="color:#eee">${specInfo}</span>
                        </div>
                        <div style="border-top:1px dashed rgba(255,255,255,0.1); padding-top:4px;">
                            <strong style="color:#fca311">Mastery (Level ${Config.TOWER_MASTERY_LEVEL}):</strong><br>
                            <span style="color:${hoveredTower.masteryUnlocked ? '#00ff00' : '#aaa'}">${masteryInfo}</span>
                        </div>
                    </div>
                `;
            } else {
                const specList = specsList.map((s: any) => s.name).join(' | ');
                bottomSection = `
                    <strong style="color:#fca311">Wähle Level ${Config.TOWER_SPECIALIZATION_LEVEL} Spezialisierung:</strong><br>
                    <span style="color:#aaa">${specList}</span>
                `;
            }
        }

        tooltip.innerHTML = `
            <h3 style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${hoveredTower.type} Tower</h3>
            <p>Level: <span>${hoveredTower.level}${maxLvl ? ' <em style="color:#fca311">(MAX)</em>' : ''}</span></p>
            <p>Spezial: <span style="color:#ffb703">${specName}</span></p>
            ${hoveredTower.type === 'Prisma' ? `
                <p>DPS: <span>${hoveredTower.getDisplayDamage ? hoveredTower.getDisplayDamage() : hoveredTower.damage}/s</span></p>
            ` : `
                <p>Schaden: <span>${hoveredTower.getDisplayDamage ? hoveredTower.getDisplayDamage() : hoveredTower.damage}</span></p>
                <p>Speed: <span>${hoveredTower.getDisplayFireRate ? hoveredTower.getDisplayFireRate() : (60 / hoveredTower.fireRate).toFixed(1)}/s</span></p>
            `}
            <p>Reichweite: <span>${hoveredTower.range >= 9999 ? '∞' : (hoveredTower.getDisplayRange ? hoveredTower.getDisplayRange() : hoveredTower.range)}</span></p>
            ${hoveredTower.type === 'Bomb' ? `<p>AoE: <span>${hoveredTower.getDisplayAoe ? hoveredTower.getDisplayAoe() : hoveredTower.aoeRadius}</span></p>` : ''}
            ${!maxLvl ? `<p>Upgrade: <span style="${(!state.infiniteGold && state.gold < hoveredTower.upgradeCost) ? 'color:#ff3366' : 'color:#4cc9f0'}">${hoveredTower.upgradeCost}g</span></p>` : ''}
            <div style="margin-top:8px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.2); font-size:0.85em;">
                ${bottomSection}
            </div>
        `;
        tooltip.classList.remove('hidden');

        // --- Positioning ---
        const padding = 15;
        const rect = tooltip.getBoundingClientRect();
        let x = state.lastClientMouse.x + padding;
        let y = state.lastClientMouse.y + padding;

        // If tooltip exceeds viewport width, move to left of mouse
        if (x + rect.width + padding > window.innerWidth) {
            x = state.lastClientMouse.x - rect.width - padding;
        }
        // If tooltip exceeds viewport height, move above mouse
        if (y + rect.height + padding > window.innerHeight) {
            y = state.lastClientMouse.y - rect.height - padding;
        }

        tooltip.style.left = `${Math.max(padding, x)}px`;
        tooltip.style.top = `${Math.max(padding, y)}px`;
    } else if (hoveredEnemy && !state.selectedTowerType) {
        let specialAbility = hoveredEnemy.specialAbility || 'Keine';
        if (specialAbility === 'Keine') {
            if (hoveredEnemy.typeName === 'Regrower') specialAbility = 'Heilt alle 0,5s';
            if (hoveredEnemy.typeName === 'Shielded') specialAbility = hoveredEnemy.shieldActive ? 'Schild aktiv' : 'Schild zerstört';
            if (hoveredEnemy.typeName === 'Bruiser') specialAbility = 'Tank';
            if (hoveredEnemy.typeName === 'Scout') specialAbility = 'Schnell';
            if (hoveredEnemy.typeName === 'Splinter') specialAbility = 'Spaltet sich beim Tod';
            if (hoveredEnemy.typeName === 'SplinterFragment') specialAbility = 'Sehr schnell';
        }

        tooltip.innerHTML = `
            <h3 style="color: ${hoveredEnemy.color}">${hoveredEnemy.typeName}</h3>
            <p>HP: <span>${Math.ceil(Math.max(0, hoveredEnemy.hp))} / ${hoveredEnemy.maxHp}</span></p>
            <p>Fähigkeit: <span>${specialAbility}</span></p>
        `;
        tooltip.classList.remove('hidden');

        const padding = 15;
        const rect = tooltip.getBoundingClientRect();
        let x = state.lastClientMouse.x + padding;
        let y = state.lastClientMouse.y + padding;

        if (x + rect.width + padding > window.innerWidth) x = state.lastClientMouse.x - rect.width - padding;
        if (y + rect.height + padding > window.innerHeight) y = state.lastClientMouse.y - rect.height - padding;

        tooltip.style.left = `${Math.max(padding, x)}px`;
        tooltip.style.top = `${Math.max(padding, y)}px`;
    } else if (state.shopHoveredType) {
        let name = state.shopHoveredType;
        let stats = "";
        let cost = 0;

        if (name === 'Base') {
            stats = `
                <p>Schaden: <span>${Config.TOWER_BASE_DAMAGE}</span></p>
                <p>Speed: <span>${(60 / Config.TOWER_BASE_FIRE_RATE).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>${Config.TOWER_BASE_RANGE}</span></p>
            `;
            cost = Config.TOWER_BASE_COST;
        } else if (name === 'Sniper') {
            stats = `
                <p>Schaden: <span>${Config.TOWER_SNIPER_DAMAGE}</span></p>
                <p>Speed: <span>${(60 / Config.TOWER_SNIPER_FIRE_RATE).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>∞</span></p>
            `;
            cost = Config.TOWER_SNIPER_COST;
        } else if (name === 'Bomb') {
            stats = `
                <p>Schaden: <span>${Config.TOWER_BOMB_DAMAGE}</span></p>
                <p>Speed: <span>${(60 / Config.TOWER_BOMB_FIRE_RATE).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>${Config.TOWER_BOMB_RANGE}</span></p>
                <p>AoE: <span>${Config.TOWER_BOMB_AOE_RADIUS}</span></p>
            `;
            cost = Config.TOWER_BOMB_COST;
        } else if (name === 'Tesla') {
            stats = `
                <p>Schaden: <span>${Config.TOWER_TESLA_DAMAGE}</span></p>
                <p>Speed: <span>${(60 / Config.TOWER_TESLA_FIRE_RATE).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>${Config.TOWER_TESLA_RANGE}</span></p>
                <p>Aura: <span>Nahkampf</span></p>
            `;
            cost = Config.TOWER_TESLA_COST;
        } else if (name === 'Prisma') {
            const minDps = Math.round(Config.TOWER_PRISMA_DAMAGE * 60 * Config.TOWER_PRISMA_MIN_MULTIPLIER);
            const maxDps = Math.round(Config.TOWER_PRISMA_DAMAGE * 60 * Config.TOWER_PRISMA_MAX_MULTIPLIER);
            stats = `
                <p>DPS: <span>${minDps}-${maxDps}/s</span></p>
                <p>Reichweite: <span>${Config.TOWER_PRISMA_RANGE}</span></p>
                <p>Typ: <span>Kontinuierlicher Laser</span></p>
            `;
            cost = Config.TOWER_PRISMA_COST;
        }

        tooltip.innerHTML = `
            <h3 style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${name} Tower</h3>
            ${stats}
            <p>Preis: <span style="${(!state.infiniteGold && state.gold < cost) ? 'color:#ff3366' : 'color:#fca311'}">${cost}g</span></p>
        `;
        tooltip.classList.remove('hidden');

        const padding = 15;
        const rect = tooltip.getBoundingClientRect();
        // For shop tooltips, always show to the left of the panel
        let x = state.lastClientMouse.x - rect.width - padding;
        let y = state.lastClientMouse.y;

        if (y + rect.height + padding > window.innerHeight) y = window.innerHeight - rect.height - padding;
        if (x < padding) x = state.lastClientMouse.x + padding; // Flip if no space on left

        tooltip.style.left = `${Math.max(padding, x)}px`;
        tooltip.style.top = `${Math.max(padding, y)}px`;
    } else {
        if (!tooltip.classList.contains('hidden')) {
            tooltip.classList.add('hidden');
        }
    }
}

