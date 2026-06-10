/*
 * @file: frontend/src/js/ui/tooltips.ts
 * @purpose: Renders context-sensitive stats and upgrade details when hovering towers or UI icons.
 * @dependencies: state, config, utils
 * @last_update: 2026-06-01 / v1.3.0 - Added Accelerator ability tooltip support.
 */
import { state } from "../core/state";
import { Config, TowerData, getTowerPurchaseCost } from "../core/config";
import { getEl } from "../core/utils";

export function updateTooltip(): void {
  const tooltip = getEl("tooltip");
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
    const specName = specData ? specData.name : "Keine";

    let bottomSection = "";
    if (hoveredTower.level < Config.TOWER_SPECIALIZATION_LEVEL) {
      const specList = specs.map((s: any) => s.name).join(" | ");
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
                            <span style="color:${hoveredTower.masteryUnlocked ? "#00ff00" : "#aaa"}">${masteryInfo}</span>
                        </div>
                    </div>
                `;
      } else {
        const specList = specsList.map((s: any) => s.name).join(" | ");
        bottomSection = `
                    <strong style="color:#fca311">Wähle Level ${Config.TOWER_SPECIALIZATION_LEVEL} Spezialisierung:</strong><br>
                    <span style="color:#aaa">${specList}</span>
                `;
      }
    }

    let buffDesc = "";
    if (hoveredTower.type === "Booster") {
      if (hoveredTower.specialization === "frequency") {
        buffDesc = hoveredTower.masteryUnlocked
          ? "+75% Angriffsgeschwindigkeit"
          : "+40% Angriffsgeschwindigkeit";
      } else if (hoveredTower.specialization === "amplitude") {
        buffDesc = hoveredTower.masteryUnlocked
          ? "+80% DMG, +35% Reichweite"
          : "+40% DMG, +20% Reichweite";
      } else {
        buffDesc = "+15% DMG, +10% Reichweite";
      }
    }

    const isDmgBoosted =
      hoveredTower.getBoosterDamageMultiplier && hoveredTower.getBoosterDamageMultiplier() > 1;
    const isRangeBoosted =
      hoveredTower.getEffectiveRange && hoveredTower.getEffectiveRange() !== hoveredTower.range;
    const isSpeedBoosted =
      hoveredTower.getEffectiveFireRate &&
      hoveredTower.getEffectiveFireRate() !== hoveredTower.fireRate;

    const formatStat = (val: string | number, isBoosted: boolean) => {
      return isBoosted ? `<span style="font-style: italic;">${val}</span>` : `${val}`;
    };

    let statsHtml = "";
    if (hoveredTower.type === "Prisma") {
      const dpsVal = hoveredTower.getDisplayDamage
        ? hoveredTower.getDisplayDamage()
        : hoveredTower.damage;
      statsHtml = `<p>DPS: <span>${formatStat(`${dpsVal}/s`, isDmgBoosted)}</span></p>`;
    } else if (hoveredTower.type === "Booster") {
      statsHtml = `<p>Buff: <span style="color:#ff9f43">${buffDesc}</span></p>`;
    } else if (hoveredTower.type === "Generator") {
      const incomeVal = hoveredTower.getEffectiveGoldIncome
        ? hoveredTower.getEffectiveGoldIncome()
        : 0;
      const incomeText =
        hoveredTower.specialization === "bank" ? `+${incomeVal}g / Welle` : `+${incomeVal}g / Takt`;
      const intervalVal = (hoveredTower.getEffectiveFireRate() / 60).toFixed(1);

      statsHtml = `
                <p>Einkommen: <span style="color:#26de81">${formatStat(incomeText, isDmgBoosted)}</span></p>
                <p>Intervall: <span>${formatStat(`${intervalVal}s`, isSpeedBoosted)}</span></p>
            `;
    } else {
      const dmgVal = hoveredTower.getDisplayDamage
        ? hoveredTower.getDisplayDamage()
        : hoveredTower.damage;
      const speedVal = hoveredTower.getDisplayFireRate
        ? hoveredTower.getDisplayFireRate()
        : (60 / hoveredTower.fireRate).toFixed(1);
      statsHtml = `
                <p>Schaden: <span>${formatStat(dmgVal, isDmgBoosted)}</span></p>
                <p>Speed: <span>${formatStat(`${speedVal}/s`, isSpeedBoosted)}</span></p>
            `;
    }

    const rangeVal =
      hoveredTower.range >= 9999
        ? "∞"
        : hoveredTower.getEffectiveRange
          ? Math.round(hoveredTower.getEffectiveRange())
          : hoveredTower.range;
    const rangeHtml =
      hoveredTower.type === "Generator"
        ? ""
        : `<p>Reichweite: <span>${formatStat(rangeVal, isRangeBoosted)}</span></p>`;

    tooltip.innerHTML = `
            <h3 style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${hoveredTower.type} Tower</h3>
            <p>Level: <span>${hoveredTower.level}${maxLvl ? ' <em style="color:#fca311">(MAX)</em>' : ""}</span></p>
            <p>Spezial: <span style="color:#ffb703">${specName}</span></p>
            ${statsHtml}
            ${rangeHtml}
            ${hoveredTower.type === "Bomb" ? `<p>AoE: <span>${hoveredTower.getDisplayAoe ? hoveredTower.getDisplayAoe() : hoveredTower.aoeRadius}</span></p>` : ""}
            ${!maxLvl ? `<p>Upgrade: <span style="${!state.infiniteGold && state.gold < hoveredTower.upgradeCost ? "color:#ff3366" : "color:#4cc9f0"}">${hoveredTower.upgradeCost}g</span></p>` : ""}
            <div style="margin-top:8px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.2); font-size:0.85em;">
                ${bottomSection}
            </div>
        `;
    tooltip.classList.remove("hidden");

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
    let specialAbility = hoveredEnemy.specialAbility || "Keine";
    if (specialAbility === "Keine") {
      if (hoveredEnemy.typeName === "Regrower") specialAbility = "Heilt alle 0,5s";
      if (hoveredEnemy.typeName === "Shielded")
        specialAbility = hoveredEnemy.shieldActive ? "Schild aktiv" : "Schild zerstört";
      if (hoveredEnemy.typeName === "Bruiser") specialAbility = "Tank";
      if (hoveredEnemy.typeName === "Scout") specialAbility = "Schnell";
      if (hoveredEnemy.typeName === "Splinter") specialAbility = "Spaltet sich beim Tod";
      if (hoveredEnemy.typeName === "SplinterFragment") specialAbility = "Sehr schnell";
      if (hoveredEnemy.typeName === "Accelerator") specialAbility = "Tempo-Aura (+40%)";
    }

    tooltip.innerHTML = `
            <h3 style="color: ${hoveredEnemy.color}">${hoveredEnemy.typeName}</h3>
            <p>HP: <span>${Math.ceil(Math.max(0, hoveredEnemy.hp))} / ${hoveredEnemy.maxHp}</span></p>
            <p>Fähigkeit: <span>${specialAbility}</span></p>
        `;
    tooltip.classList.remove("hidden");

    const padding = 15;
    const rect = tooltip.getBoundingClientRect();
    let x = state.lastClientMouse.x + padding;
    let y = state.lastClientMouse.y + padding;

    if (x + rect.width + padding > window.innerWidth)
      x = state.lastClientMouse.x - rect.width - padding;
    if (y + rect.height + padding > window.innerHeight)
      y = state.lastClientMouse.y - rect.height - padding;

    tooltip.style.left = `${Math.max(padding, x)}px`;
    tooltip.style.top = `${Math.max(padding, y)}px`;
  } else if (state.shopHoveredType) {
    const name = state.shopHoveredType;
    if (!TowerData[name]) return;
    const data = TowerData[name];
    const existingCount = state.towers
      ? state.towers.filter((t) => t.type === "Generator" && !t.isPredicted).length
      : 0;
    const cost = getTowerPurchaseCost(name, existingCount);

    let stats = "";
    if (name === "Base") {
      stats = `
                <p>Schaden: <span>${data.baseDamage}</span></p>
                <p>Speed: <span>${(60 / data.baseFireRate).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>${data.baseRange}</span></p>
            `;
    } else if (name === "Sniper") {
      stats = `
                <p>Schaden: <span>${data.baseDamage}</span></p>
                <p>Speed: <span>${(60 / data.baseFireRate).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>∞</span></p>
            `;
    } else if (name === "Bomb") {
      stats = `
                <p>Schaden: <span>${data.baseDamage}</span></p>
                <p>Speed: <span>${(60 / data.baseFireRate).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>${data.baseRange}</span></p>
                <p>AoE: <span>${data.aoeRadius}</span></p>
            `;
    } else if (name === "Tesla") {
      stats = `
                <p>Schaden: <span>${data.baseDamage}</span></p>
                <p>Speed: <span>${(60 / data.baseFireRate).toFixed(1)}/s</span></p>
                <p>Reichweite: <span>${data.baseRange}</span></p>
                <p>Aura: <span>Nahkampf</span></p>
            `;
    } else if (name === "Prisma") {
      const minDps = Math.round(data.baseDamage * 60 * data.prismaMinMultiplier!);
      const maxDps = Math.round(data.baseDamage * 60 * data.prismaMaxMultiplier!);
      stats = `
                <p>DPS: <span>${minDps}-${maxDps}/s</span></p>
                <p>Reichweite: <span>${data.baseRange}</span></p>
                <p>Typ: <span>Kontinuierlicher Laser</span></p>
            `;
    } else if (name === "Booster") {
      stats = `
                <p>Buffs: <span style="color:#ff9f43">+15% DMG, +10% Reichweite</span></p>
                <p>Reichweite: <span>${data.baseRange}</span></p>
                <p>Typ: <span>Unterstützungs-Aura</span></p>
            `;
    } else if (name === "Generator") {
      stats = `
                <p>Einkommen: <span style="color:#26de81">+15g / Takt (Startwert)</span></p>
                <p>Intervall: <span>5.0s</span></p>
                <p>Typ: <span>Wirtschafts-Ertrag</span></p>
            `;
    }

    tooltip.innerHTML = `
            <h3 style="margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">${name} Tower</h3>
            ${stats}
            <p>Preis: <span style="${!state.infiniteGold && state.gold < cost ? "color:#ff3366" : "color:#fca311"}">${cost}g</span></p>
        `;
    tooltip.classList.remove("hidden");

    const padding = 15;
    const rect = tooltip.getBoundingClientRect();
    // For shop tooltips, always show to the left of the panel
    let x = state.lastClientMouse.x - rect.width - padding;
    let y = state.lastClientMouse.y;

    if (y + rect.height + padding > window.innerHeight)
      y = window.innerHeight - rect.height - padding;
    if (x < padding) x = state.lastClientMouse.x + padding; // Flip if no space on left

    tooltip.style.left = `${Math.max(padding, x)}px`;
    tooltip.style.top = `${Math.max(padding, y)}px`;
  } else {
    if (!tooltip.classList.contains("hidden")) {
      tooltip.classList.add("hidden");
    }
  }
}
