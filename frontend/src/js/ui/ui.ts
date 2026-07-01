/*
 * @file: frontend/src/js/ui/ui.ts
 * @purpose: Main orchestration layer coordinating UI updates, setting key listeners, and linking panels together.
 * @dependencies: state, multiplayer, config, utils, icons, hud, tooltips, modals, modMenu, events, notifications
 * @last_update: 2026-05-29 / v1.6.1 - Enabled dynamic modUndoWaveBtn status updates for hosts.
 */
import { state } from "../core/state";
import { Config, TowerData, getTowerPurchaseCost } from "../core/config";
import { getEl, formatNumber } from "../core/utils";

import { ICONS } from "./icons";
import { updateHudDisplay } from "./hud";
import { updateTooltip } from "./tooltips";
import { showGameOverScreen } from "./modals";
import { setupModMenu } from "./modMenu";
import { setupEvents } from "./events";
import { showGameNotification } from "./notifications";
import { isCellAllowedForPlayer } from "../core/utils";
import { Multiplayer } from "../core/multiplayer/context";

export { updateTooltip, showGameNotification };

let lastRenderedWave = -1;
let lastRenderedHost: boolean | null = null;
let lastRenderedCheats: boolean | null = null;
let lastRenderedInfiniteGold: boolean | null = null;
let lastRenderedModInfiniteGold: boolean | null = null;
let lastRenderedGodMode: boolean | null = null;
let lastRenderedGold = -1;
let lastRenderedGeneratorCount = -1;
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
    cachedTowerBtns = document.querySelectorAll(".tower-btn");
  }
  return cachedTowerBtns;
}

export function updateUI(): void {
  updateHudDisplay();

  if (lastRenderedWave !== state.wave) {
    lastRenderedWave = state.wave;
    const waveDisplay = getEl("waveDisplay");
    if (waveDisplay) waveDisplay.innerText = String(state.wave);
  }

  if (lastRenderedHost !== state.isHost) {
    lastRenderedHost = state.isHost;
    const hostInd = getEl("hostIndicatorText");
    if (hostInd) {
      hostInd.innerText = state.isHost ? "👑 HOST" : "👥 CLIENT";
      hostInd.style.color = state.isHost ? "#ffb703" : "#4cc9f0";
    }
    const modMenu = getEl("modMenu");
    if (modMenu && !state.isHost && !modMenu.classList.contains("hidden")) {
      modMenu.classList.add("hidden");
    }
  }

  if (lastRenderedWebRTCStatus !== state.webRTCStatus || lastRenderedHost !== state.isHost) {
    lastRenderedWebRTCStatus = state.webRTCStatus || "idle";
    const netStatus = getEl("networkStatus");
    if (netStatus) {
      if (!state.isHost && state.webRTCStatus && state.webRTCStatus !== "idle") {
        netStatus.style.display = "flex";
        if (state.webRTCStatus === "connected") {
          netStatus.style.borderColor = "#00ff88";
          netStatus.style.color = "#00ff88";
          netStatus.style.background = "rgba(0, 255, 136, 0.1)";
          netStatus.style.boxShadow = "0 0 10px rgba(0, 255, 136, 0.2)";
          netStatus.style.animation = "";
          netStatus.setAttribute("title", "Netzwerk: WebRTC (Direkt & Schnell)");
        } else if (state.webRTCStatus === "connecting") {
          netStatus.style.borderColor = "#ffb703";
          netStatus.style.color = "#ffb703";
          netStatus.style.background = "rgba(255, 183, 3, 0.1)";
          netStatus.style.boxShadow = "0 0 10px rgba(255, 183, 3, 0.2)";
          netStatus.style.animation = "pulse-orange-glow 1.5s infinite alternate";
          netStatus.setAttribute("title", "Netzwerk: Verbinde WebRTC...");
        } else if (state.webRTCStatus === "failed") {
          netStatus.style.borderColor = "#ff3366";
          netStatus.style.color = "#ff3366";
          netStatus.style.background = "rgba(255, 51, 102, 0.1)";
          netStatus.style.boxShadow = "0 0 10px rgba(255, 51, 102, 0.2)";
          netStatus.style.animation = "pulse-red 1.5s infinite alternate";
          netStatus.setAttribute("title", "Netzwerk-Degradierung: Socket.io Fallback (Langsam)");
        }
      } else {
        netStatus.style.display = "none";
      }
    }
  }

  const cheatsActive =
    state.godMode || state.infiniteGold || state.waveModified || state.benchmarkActive;
  if (lastRenderedCheats !== cheatsActive) {
    lastRenderedCheats = cheatsActive;
    const cheatInd = getEl("cheatIndicator");
    if (cheatInd) {
      if (cheatsActive) {
        cheatInd.classList.remove("hidden");
      } else {
        cheatInd.classList.add("hidden");
      }
    }
  }

  if (state.isHost) {
    if (lastRenderedModInfiniteGold !== state.infiniteGold) {
      lastRenderedModInfiniteGold = state.infiniteGold;
      const modGoldBtn = getEl("modGoldBtn");
      if (modGoldBtn) {
        modGoldBtn.innerText = `Infinite Gold: ${state.infiniteGold ? "AN" : "AUS"}`;
        modGoldBtn.style.borderColor = state.infiniteGold ? "#00ff88" : "";
      }
    }
    if (lastRenderedGodMode !== state.godMode) {
      lastRenderedGodMode = state.godMode;
      const modLifeBtn = getEl("modLifeBtn");
      if (modLifeBtn) {
        modLifeBtn.innerText = `God Mode: ${state.godMode ? "AN" : "AUS"}`;
        modLifeBtn.style.borderColor = state.godMode ? "#ff3366" : "";
      }
    }
    if (lastRenderedOriginalWave !== state.originalWave) {
      lastRenderedOriginalWave = state.originalWave;
      const modUndoWaveBtn = getEl("modUndoWaveBtn");
      if (modUndoWaveBtn) {
        if (state.originalWave !== null) {
          (modUndoWaveBtn as HTMLButtonElement).disabled = false;
          modUndoWaveBtn.classList.remove("btn-disabled");
          modUndoWaveBtn.style.opacity = "";
          modUndoWaveBtn.style.pointerEvents = "";
        } else {
          (modUndoWaveBtn as HTMLButtonElement).disabled = true;
          modUndoWaveBtn.classList.add("btn-disabled");
          modUndoWaveBtn.style.opacity = "0.4";
          modUndoWaveBtn.style.pointerEvents = "none";
        }
      }
    }
  }

  const currentGeneratorCount = state.towers
    ? state.towers.filter((t) => t.type === "Generator" && !t.isPredicted).length
    : 0;
  if (
    lastRenderedGold !== state.gold ||
    lastRenderedInfiniteGold !== state.infiniteGold ||
    lastRenderedGeneratorCount !== currentGeneratorCount
  ) {
    lastRenderedGold = state.gold;
    lastRenderedInfiniteGold = state.infiniteGold;
    lastRenderedGeneratorCount = currentGeneratorCount;

    const intPreview = getEl("interestPreview");
    if (intPreview) {
      if (state.infiniteGold && Config.INTEREST_RATE > 0) {
        intPreview.innerText = `(+∞g)`;
        intPreview.style.display = "inline";
      } else {
        const interest = Math.floor(state.gold * Config.INTEREST_RATE);
        intPreview.innerText = `(+${formatNumber(interest)}g)`;
        intPreview.style.display = interest > 0 ? "inline" : "none";
      }
    }

    getTowerBtns().forEach((btn) => {
      const htmlBtn = btn as HTMLElement;
      const type = htmlBtn.dataset.type;
      if (!type || !TowerData[type]) return;
      const cost = getTowerPurchaseCost(type, currentGeneratorCount);

      const priceTag = htmlBtn.querySelector(".btn-label small");
      if (priceTag) {
        priceTag.textContent = `${cost}g`;
        if (!state.infiniteGold && state.gold < cost) priceTag.classList.add("too-expensive");
        else priceTag.classList.remove("too-expensive");
      }
    });
  }

  const benchmarkActive = state.benchmarkActive === true;

  if (
    lastBtnBenchmark !== benchmarkActive ||
    lastBtnHost !== state.isHost ||
    lastBtnWaveActive !== state.isWaveActive ||
    lastBtnAutoStart !== state.autoStartActive ||
    lastBtnWave !== state.wave
  ) {
    lastBtnBenchmark = benchmarkActive;
    lastBtnHost = state.isHost;
    lastBtnWaveActive = state.isWaveActive;
    lastBtnAutoStart = state.autoStartActive;
    lastBtnWave = state.wave;

    const benchmarkInd = getEl("benchmarkIndicator");
    if (benchmarkInd) {
      if (benchmarkActive && !state.isHost) {
        benchmarkInd.classList.remove("hidden");
      } else {
        benchmarkInd.classList.add("hidden");
      }
    }

    const clientInteractiveBtnIds = ["startWaveBtn", "autoStartBtn", "speedBtn", "pauseBtn"];
    clientInteractiveBtnIds.forEach((id) => {
      const btn = getEl(id) as HTMLButtonElement | null;
      if (btn) {
        if (benchmarkActive && !state.isHost) {
          btn.disabled = true;
          btn.classList.add("btn-disabled");
          btn.style.opacity = "0.5";
          btn.style.pointerEvents = "none";
          if (id === "startWaveBtn") {
            btn.innerText = "Benchmark läuft...";
          }
        } else {
          btn.style.opacity = "";
          btn.style.pointerEvents = "";

          if (id === "startWaveBtn") {
            if (state.isWaveActive) {
              btn.disabled = true;
              btn.classList.add("btn-disabled");
              btn.innerText = "Welle läuft...";
            } else if (state.autoStartActive) {
              btn.disabled = true;
              btn.classList.add("btn-disabled");
              btn.innerText = "Auto aktiv";
            } else {
              btn.disabled = false;
              btn.classList.remove("btn-disabled");
              btn.innerText = `Start Welle ${state.wave}`;
            }
          } else if (id === "autoStartBtn") {
            btn.disabled = false;
            btn.classList.remove("btn-disabled");
            btn.innerText = state.autoStartActive ? "Auto: An" : "Auto: Aus";
            btn.style.background = state.autoStartActive
              ? "linear-gradient(to bottom, #00ff88, #00b35f)"
              : "";
            btn.style.color = state.autoStartActive ? "#fff" : "";
          } else {
            btn.disabled = false;
            btn.classList.remove("btn-disabled");
          }
        }
      }
    });

    getTowerBtns().forEach((btn) => {
      const htmlBtn = btn as HTMLElement;
      if (benchmarkActive && !state.isHost) {
        htmlBtn.style.opacity = "0.4";
        htmlBtn.style.pointerEvents = "none";
        htmlBtn.style.cursor = "not-allowed";
      } else {
        htmlBtn.style.opacity = "";
        htmlBtn.style.pointerEvents = "";
        htmlBtn.style.cursor = "";
      }
    });
  }

  if (state.lives <= 0 && !state.gameOver) {
    state.gameOver = true;
    showGameOverScreen();
  }

  // Update Pause & Relocation overlays reactively
  const pauseOverlay = document.getElementById("pauseOverlay");
  const pauseTipText = document.getElementById("pauseTipText");
  const pauseBtn = document.getElementById("pauseBtn");
  const resumeGameBtn = document.getElementById("resumeGameBtn");

  if (pauseBtn) {
    pauseBtn.innerText = state.isPaused ? "Weiter" : "Pause";
    pauseBtn.style.background = state.isPaused
      ? "linear-gradient(to bottom, #ffb703, #d49a00)"
      : "";
    pauseBtn.style.color = state.isPaused ? "#fff" : "";
  }

  if (resumeGameBtn) {
    if (state.relocationActive) {
      resumeGameBtn.style.display = "none";
    } else {
      resumeGameBtn.style.display = "";
    }
  }

  // Handle relocation phase UI specifically
  if (state.relocationActive && state.isPaused) {
    if (pauseOverlay) pauseOverlay.classList.add("hidden"); // do not cover screen
    updateRelocationUI();
  } else {
    const relocBanner = document.getElementById("relocationBanner");
    if (relocBanner) relocBanner.classList.add("hidden");
    const relocModal = document.getElementById("relocationModal");
    if (relocModal) relocModal.classList.add("hidden");

    if (pauseOverlay) {
      if (state.isPaused) {
        if (pauseOverlay.classList.contains("hidden")) {
          pauseOverlay.classList.remove("hidden");
          if (pauseTipText) {
            const randomTip = PAUSE_TIPS[Math.floor(Math.random() * PAUSE_TIPS.length)];
            pauseTipText.innerText = `„${randomTip}“`;
          }
        }
      } else {
        pauseOverlay.classList.add("hidden");
      }
    }
  }
}

export function cancelPlacement(): void {
  state.selectedTowerType = null;
  getTowerBtns().forEach((b) => b.classList.remove("selected"));
  const cancelBtn = getEl("cancelPlacementBtn");
  if (cancelBtn) cancelBtn.classList.add("hidden");
}

export function setupUI(startWaveCallback: () => void, canvas: HTMLCanvasElement): void {
  // Inject SVG icons into tower buttons
  getTowerBtns().forEach((btn) => {
    const htmlBtn = btn as HTMLElement;
    const type = htmlBtn.dataset.type;
    if (type && ICONS[type]) {
      const iconEl = htmlBtn.querySelector(".btn-icon");
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
  "Booster-Türme greifen nicht selbst an, sondern verstärken Schaden, Reichweite oder Feuerrate naher Türme!",
];

export function setPauseState(paused: boolean): void {
  if (state.gameOver) return;
  state.isPaused = paused;
  updateUI();
}

export function updateRelocationUI(): void {
  const relocBannerId = "relocationBanner";
  const relocModalId = "relocationModal";

  let relocBanner = document.getElementById(relocBannerId);
  let relocModal = document.getElementById(relocModalId);

  if (!relocBanner) {
    relocBanner = document.createElement("div");
    relocBanner.id = relocBannerId;
    relocBanner.style.position = "absolute";
    relocBanner.style.top = "15px";
    relocBanner.style.left = "50%";
    relocBanner.style.transform = "translateX(-50%)";
    relocBanner.style.background = "linear-gradient(135deg, #ff0055, #ff5500)";
    relocBanner.style.color = "#fff";
    relocBanner.style.padding = "10px 20px";
    relocBanner.style.borderRadius = "8px";
    relocBanner.style.fontSize = "16px";
    relocBanner.style.fontWeight = "bold";
    relocBanner.style.boxShadow = "0 0 15px rgba(255, 0, 85, 0.5)";
    relocBanner.style.zIndex = "9999";
    relocBanner.style.pointerEvents = "none";
    relocBanner.style.fontFamily = "'Outfit', sans-serif";
    document.getElementById("game-container")?.appendChild(relocBanner);
  }

  if (!relocModal) {
    relocModal = document.createElement("div");
    relocModal.id = relocModalId;
    relocModal.style.position = "absolute";
    relocModal.style.top = "0";
    relocModal.style.left = "0";
    relocModal.style.width = "100%";
    relocModal.style.height = "100%";
    relocModal.style.background = "rgba(10, 10, 15, 0.85)";
    relocModal.style.backdropFilter = "blur(10px)";
    relocModal.style.display = "flex";
    relocModal.style.flexDirection = "column";
    relocModal.style.justifyContent = "center";
    relocModal.style.alignItems = "center";
    relocModal.style.zIndex = "9998";
    relocModal.style.color = "#fff";
    relocModal.style.fontFamily = "'Outfit', sans-serif";

    const content = document.createElement("div");
    content.className = "reloc-modal-content";
    content.style.textAlign = "center";
    content.style.padding = "40px";
    content.style.borderRadius = "16px";
    content.style.border = "1px solid rgba(255, 0, 85, 0.3)";
    content.style.background =
      "linear-gradient(135deg, rgba(20, 20, 30, 0.9), rgba(10, 10, 15, 0.95))";
    content.style.boxShadow = "0 0 30px rgba(0, 0, 0, 0.5)";

    const title = document.createElement("h2");
    title.innerText = "Spielfeld-Aufteilung!";
    title.style.fontSize = "32px";
    title.style.margin = "0 0 15px 0";
    title.style.color = "#ff0055";
    title.style.textShadow = "0 0 10px rgba(255, 0, 85, 0.5)";

    const desc = document.createElement("p");
    desc.id = "relocModalDesc";
    desc.style.fontSize = "18px";
    desc.style.color = "#a0a5c0";

    content.appendChild(title);
    content.appendChild(desc);
    relocModal.appendChild(content);

    document.getElementById("game-container")?.appendChild(relocModal);
  }

  const myIndex = Multiplayer.myPlayerIndex !== undefined ? Multiplayer.myPlayerIndex : 0;
  const activeCount = state.playerSlots ? state.playerSlots.filter((id) => id !== null).length : 1;

  // Use host-authoritative relocation state if available, otherwise fallback to local calculation
  const hasMisplaced =
    state.playerRelocationStates && state.playerRelocationStates[myIndex] !== undefined
      ? state.playerRelocationStates[myIndex]
      : state.towers.some(
          (t) =>
            t.ownerIndex === myIndex && !isCellAllowedForPlayer(t.col, t.row, myIndex, activeCount)
        );

  if (hasMisplaced) {
    relocBanner.classList.remove("hidden");
    relocBanner.innerText =
      "⚠️ ZONE GEÄNDERT! Versetze deine misplaced (blinkenden) Türme oder verkaufe sie für 100% Rückerstattung.";
    relocModal.classList.add("hidden");
  } else {
    relocBanner.classList.add("hidden");
    relocModal.classList.remove("hidden");

    const relocatingNames = [];
    if (state.playerRelocationStates) {
      for (let i = 0; i < 4; i++) {
        if (state.playerRelocationStates[i]) {
          relocatingNames.push(`Spieler ${i + 1}`);
        }
      }
    }
    const namesStr = relocatingNames.length > 0 ? relocatingNames.join(", ") : "andere Spieler";
    const descEl = document.getElementById("relocModalDesc");
    if (descEl) {
      descEl.innerText = `Das Spiel ist pausiert, da sich die Zonengrenzen verschoben haben. Bitte warte, während ${namesStr} ihre außerhalb der neuen Grenzen liegenden Türme umplatzieren oder verkaufen...`;
    }
  }
}
