/*
 * @file: frontend\src\js\ui\hud.ts
 * @purpose: Renders and updates resource UI numbers (Gold, Lives, Wave) using smooth counting animations.
 * @dependencies: state, utils
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
 * @last_update: 2026-05-27 / v1.1.0 - Use formatNumber utility for HUD gold display.
 */
import { state } from '../core/state';
import { getEl, formatNumber } from '../core/utils';

let currentDisplayedGold: number | null = null;
let goldAnimFrameId: number | null = null;
let goldAnimStartVal: number = 0;
let goldAnimTargetVal: number = 0;
let goldAnimStartTime: number = 0;
let goldAnimDuration: number = 0;

let currentDisplayedLives: number | null = null;
let livesAnimFrameId: number | null = null;
let livesAnimStartVal: number = 0;
let livesAnimTargetVal: number = 0;
let livesAnimStartTime: number = 0;
let livesAnimDuration: number = 0;

export function resetHudDisplay(gold: number, lives: number) {
    currentDisplayedGold = gold;
    if (goldAnimFrameId !== null) {
        cancelAnimationFrame(goldAnimFrameId);
        goldAnimFrameId = null;
    }
    currentDisplayedLives = lives;
    if (livesAnimFrameId !== null) {
        cancelAnimationFrame(livesAnimFrameId);
        livesAnimFrameId = null;
    }
}

export function updateHudDisplay(): void {

    const livesDisplay = getEl('livesDisplay');
    if (livesDisplay) {
        if (state.godMode) {
            livesDisplay.innerText = '∞';
            currentDisplayedLives = null;
            if (livesAnimFrameId !== null) {
                cancelAnimationFrame(livesAnimFrameId);
                livesAnimFrameId = null;
            }
            livesDisplay.style.transform = 'scale(1)';
            livesDisplay.style.color = '';
            livesDisplay.style.textShadow = '';
        } else {
            if (currentDisplayedLives === null) {
                currentDisplayedLives = state.lives;
                livesDisplay.innerText = String(state.lives);
                livesDisplay.style.color = '';
                livesDisplay.style.textShadow = '';
            } else if (currentDisplayedLives !== state.lives) {
                animateLivesDisplay(livesDisplay);
            }
        }
    }

    const goldDisplay = getEl('goldDisplay');
    if (goldDisplay) {
        if (state.infiniteGold) {
            goldDisplay.innerText = '∞';
            currentDisplayedGold = null;
            if (goldAnimFrameId !== null) {
                cancelAnimationFrame(goldAnimFrameId);
                goldAnimFrameId = null;
            }
            goldDisplay.style.transform = 'scale(1)';
            goldDisplay.style.color = '';
            goldDisplay.style.textShadow = '';
        } else {
            if (currentDisplayedGold === null) {
                currentDisplayedGold = state.gold;
                goldDisplay.innerText = formatNumber(state.gold);
                goldDisplay.style.color = '';
                goldDisplay.style.textShadow = '';
            } else if (currentDisplayedGold !== state.gold) {
                animateGoldDisplay(goldDisplay);
            }
        }
    }

    }

function animateLivesDisplay(livesDisplay: HTMLElement): void {

    livesAnimTargetVal = state.lives;
    livesAnimStartVal = currentDisplayedLives !== null ? currentDisplayedLives : state.lives;
    livesAnimStartTime = performance.now();

    const delta = Math.abs(livesAnimTargetVal - livesAnimStartVal);
    // Dynamic duration: extremely slow baseline of 800ms for dramatic effect, scales up to 1600ms max
    livesAnimDuration = 800 + Math.min(delta * 200, 800);

    // Apply color and glow immediately
    const isGain = livesAnimTargetVal > livesAnimStartVal;
    const activeColor = isGain ? '#00f0aa' : '#ff3366';
    const activeGlow = isGain 
        ? '0 0 15px rgba(0, 240, 170, 0.6), 0 2px 10px rgba(0, 0, 0, 0.5)' 
        : '0 0 15px rgba(255, 51, 102, 0.6), 0 2px 10px rgba(0, 0, 0, 0.5)';

    livesDisplay.style.color = activeColor;
    livesDisplay.style.textShadow = activeGlow;
    livesDisplay.style.transition = 'color 0.15s ease, text-shadow 0.15s ease, transform 0.05s ease';

    if (livesAnimFrameId !== null) return;

    const tick = (now: number) => {
        if (state.godMode) {
            livesDisplay.innerText = '∞';
            currentDisplayedLives = null;
            livesAnimFrameId = null;
            livesDisplay.style.transform = 'scale(1)';
            livesDisplay.style.color = '';
            livesDisplay.style.textShadow = '';
            return;
        }

        const elapsed = now - livesAnimStartTime;
        const progress = Math.min(elapsed / livesAnimDuration, 1);

        // Cubic ease-out for super smooth deceleration
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        currentDisplayedLives = livesAnimStartVal + (livesAnimTargetVal - livesAnimStartVal) * easeOutCubic;

        livesDisplay.innerText = String(Math.round(currentDisplayedLives));

        const deltaLeft = Math.abs(livesAnimTargetVal - currentDisplayedLives);
        if (deltaLeft > 0.5 && progress < 1) {
            // High intensity pop/shake effect for losing lives
            const pulseIntensity = isGain ? Math.min(delta * 0.005, 0.08) : Math.min(delta * 0.015, 0.15);
            const pulseFactor = Math.sin(progress * Math.PI) * pulseIntensity;
            
            // If losing lives, let's also add a tiny dramatic translation shake!
            if (!isGain) {
                const shakeX = (Math.random() - 0.5) * 4 * Math.sin(progress * Math.PI);
                livesDisplay.style.transform = `scale(${1 + pulseFactor}) translate(${shakeX}px, 0px)`;
            } else {
                livesDisplay.style.transform = `scale(${1 + pulseFactor})`;
            }

            livesAnimFrameId = requestAnimationFrame(tick);
        } else {
            currentDisplayedLives = state.lives;
            livesDisplay.innerText = String(state.lives);
            livesAnimFrameId = null;
            livesDisplay.style.transform = 'scale(1)';
            livesDisplay.style.color = '';
            livesDisplay.style.textShadow = '';
        }
    };

    livesAnimFrameId = requestAnimationFrame(tick);
}

function animateGoldDisplay(goldDisplay: HTMLElement): void {

    goldAnimTargetVal = state.gold;
    goldAnimStartVal = currentDisplayedGold !== null ? currentDisplayedGold : state.gold;
    goldAnimStartTime = performance.now();

    const delta = Math.abs(goldAnimTargetVal - goldAnimStartVal);
    // Dynamic duration: small changes take ~450ms (slower trickle), large changes scale up to 950ms max
    // This makes counting small sums feel beautifully slow and distinct, while keeping huge payouts highly dynamic.
    goldAnimDuration = 450 + Math.min(delta * 1.0, 500);

    // Apply color and glow immediately at the start of the animation
    const isGain = goldAnimTargetVal > goldAnimStartVal;
    const activeColor = isGain ? '#00f0aa' : '#ff3366';
    const activeGlow = isGain 
        ? '0 0 15px rgba(0, 240, 170, 0.6), 0 2px 10px rgba(0, 0, 0, 0.5)' 
        : '0 0 15px rgba(255, 51, 102, 0.6), 0 2px 10px rgba(0, 0, 0, 0.5)';

    goldDisplay.style.color = activeColor;
    goldDisplay.style.textShadow = activeGlow;
    goldDisplay.style.transition = 'color 0.15s ease, text-shadow 0.15s ease, transform 0.05s ease';

    if (goldAnimFrameId !== null) return;

    const tick = (now: number) => {
        if (state.infiniteGold) {
            goldDisplay.innerText = '∞';
            currentDisplayedGold = null;
            goldAnimFrameId = null;
            goldDisplay.style.transform = 'scale(1)';
            goldDisplay.style.color = '';
            goldDisplay.style.textShadow = '';
            return;
        }

        const elapsed = now - goldAnimStartTime;
        const progress = Math.min(elapsed / goldAnimDuration, 1);

        // Cubic ease-out for a super smooth deceleration
        const easeOutCubic = 1 - Math.pow(1 - progress, 3);
        currentDisplayedGold = goldAnimStartVal + (goldAnimTargetVal - goldAnimStartVal) * easeOutCubic;

        goldDisplay.innerText = formatNumber(Math.round(currentDisplayedGold));

        const deltaLeft = Math.abs(goldAnimTargetVal - currentDisplayedGold);
        if (deltaLeft > 0.5 && progress < 1) {
            // Juice effect: HUD item swells in the middle of animation and settles
            const pulseIntensity = Math.min(delta * 0.0004, 0.07);
            const pulseFactor = Math.sin(progress * Math.PI) * pulseIntensity;
            goldDisplay.style.transform = `scale(${1 + pulseFactor})`;

            goldAnimFrameId = requestAnimationFrame(tick);
        } else {
            currentDisplayedGold = state.gold;
            goldDisplay.innerText = formatNumber(state.gold);
            goldAnimFrameId = null;
            goldDisplay.style.transform = 'scale(1)';
            goldDisplay.style.color = '';
            goldDisplay.style.textShadow = '';
        }
    };

    goldAnimFrameId = requestAnimationFrame(tick);
}

