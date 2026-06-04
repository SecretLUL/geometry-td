/*
 * @file: frontend\src\js\core\achievements.ts
 * @purpose: Defines achievement structures, checks unlock conditions during gameplay, triggers animations, and persists unlocks to the database.
 * @dependencies: state, ui, fx
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
 * @last_update: 2026-06-04 / v1.1.0 - Guest mode: initAchievements sets state.isGuest, checkAchievements exits early for guests.
 */
import { state } from './state';
import { showGameNotification } from '../ui/ui';
import { createConfettiBurst } from '../fx/fx';

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    check: () => boolean;
}

export const AchievementsList: Achievement[] = [
    {
        id: 'ach-first-wave',
        title: 'Erste Wellen',
        description: 'Überlebe Welle 5 in einer beliebigen Simulation.',
        icon: '👾',
        check: () => state.wave > 5
    },
    {
        id: 'ach-wave-20',
        title: 'Verteidiger-Veteran',
        description: 'Erreiche Welle 20 in einer beliebigen Simulation.',
        icon: '🛡️',
        check: () => state.wave >= 20
    },
    {
        id: 'ach-wave-50',
        title: 'Sektor-Beherrscher',
        description: 'Erreiche Welle 50 in einer beliebigen Simulation.',
        icon: '👑',
        check: () => state.wave >= 50
    },
    {
        id: 'ach-gold-1000',
        title: 'Gold-Sammler',
        description: 'Besitze 1.000 Gold in einer Simulation.',
        icon: '💰',
        check: () => state.gold >= 1000
    },
    {
        id: 'ach-towers-15',
        title: 'Turm-Spezialist',
        description: 'Baue 15 Türme gleichzeitig auf dem Spielfeld.',
        icon: '🏗️',
        check: () => state.towers.length >= 15
    },
    {
        id: 'ach-kill-boss',
        title: 'Chef-Schredder',
        description: 'Besiege das Mutterschiff (Welle 10).',
        icon: '☠️',
        check: () => state.wave > 10
    },
    {
        id: 'ach-no-lives-lost',
        title: 'Perfekte Verteidigung',
        description: 'Erreiche Welle 15, ohne ein Leben zu verlieren.',
        icon: '💖',
        check: () => state.wave >= 15 && state.lives === 20
    },
    {
        id: 'ach-tesla-5',
        title: 'Tesla-Fan',
        description: 'Besitze mindestens 5 Tesla-Türme gleichzeitig.',
        icon: '⚡',
        check: () => state.towers.filter(t => t.type === 'Tesla').length >= 5
    }
];

const getBaseUrl = () => {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
           ? 'http://localhost:3000' : '';
};

// Laden bereits freigeschalteter Errungenschaften aus der DB
export async function initAchievements(): Promise<void> {
    try {
        const response = await fetch(`${getBaseUrl()}/api/user/progress`);
        if (response.ok) {
            const data = await response.json();
            state.isGuest = false;
            if (data.progress && data.progress.unlocked_achievements) {
                state.unlockedAchievements = data.progress.unlocked_achievements;
                console.log('[ACHIEVEMENTS] Bereits freigeschaltet:', state.unlockedAchievements);
            }
        } else {
            // 401 or other non-ok response means the user is not logged in
            state.isGuest = true;
            console.log('[ACHIEVEMENTS] Gast-Modus aktiv – keine Errungenschaften.');
        }
    } catch (err) {
        state.isGuest = true;
        console.warn('[ACHIEVEMENTS] Fehler beim Laden der Errungenschaften:', err);
    }
}

// Überprüfung und Freischaltung von Errungenschaften im Spiel
export async function checkAchievements(): Promise<void> {
    // Errungenschaften sind für Gäste komplett deaktiviert
    if (state.isGuest) {
        return;
    }

    // Errungenschaften sind gesperrt bei aktiven Cheats/Mods
    if (state.godMode || state.infiniteGold || state.waveModified) {
        return;
    }

    if (!state.unlockedAchievements) {
        state.unlockedAchievements = [];
    }

    for (const ach of AchievementsList) {
        if (state.unlockedAchievements.includes(ach.id)) {
            continue;
        }

        if (ach.check()) {
            state.unlockedAchievements.push(ach.id);
            console.log(`[ACHIEVEMENT UNLOCKED] ${ach.title} (${ach.id})`);

            // In-Game Notification
            showGameNotification(
                'wave',
                `🏆 ERRUNGENSCHAFT FREIGESCHALTET: ${ach.title}`,
                ach.description
            );

            // Confetti Burst in the center of the screen
            const width = window.innerWidth || 800;
            const height = window.innerHeight || 600;
            createConfettiBurst(width / 2, height / 2);

            // Persist to database
            try {
                await fetch(`${getBaseUrl()}/api/user/unlock-achievement`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ achievementId: ach.id })
                });
            } catch (err) {
                console.error(`[ACHIEVEMENT] Fehler beim Speichern von ${ach.id}:`, err);
            }
        }
    }
}
