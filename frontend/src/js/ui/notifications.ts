/*
 * @file: frontend\src\js\ui\notifications.ts
 * @purpose: Component rendering temporary in-game alerts (e.g. Success, Warning) overlayed on top of the screen.
 * @dependencies: None
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
 * @last_update: 2026-05-20 / v1.0.0
 */
export function showGameNotification(type: 'wave' | 'warning' | 'info', title: string, description: string, meta: any = null): void {
    const container = document.getElementById('game-notifications');
    if (!container) return;

    const alert = document.createElement('div');
    alert.className = `game-alert theme-${type}`;

    let headerIcon = 'ℹ️';
    let headerText = 'System';
    if (type === 'wave') {
        headerIcon = '🏆';
        headerText = 'Erfolg';
    } else if (type === 'warning') {
        headerIcon = '🚨';
        headerText = 'Achtung';
    }

    let metaHtml = '';
    if (meta) {
        metaHtml = `<div class="alert-meta">`;
        if (meta.bonus !== undefined) {
            metaHtml += `<span class="alert-gold-bonus">💰 +${meta.bonus}g Bonus</span>`;
        }
        if (meta.interest !== undefined) {
            metaHtml += `<span class="alert-gold-interest">📈 +${meta.interest}g Zinsen</span>`;
        }
        metaHtml += `</div>`;
    }

    alert.innerHTML = `
        <div class="alert-header">
            <span>${headerIcon}</span>
            <span>${headerText}</span>
        </div>
        <div class="alert-title">${title}</div>
        <div class="alert-desc">${description}</div>
        ${metaHtml}
    `;

    // Click to dismiss early with smooth transition
    alert.addEventListener('click', () => {
        alert.style.animation = 'alert-fade-out 0.25s ease forwards';
        setTimeout(() => alert.remove(), 250);
    });

    container.appendChild(alert);

    // Auto remove from DOM after CSS animation completes
    const displayDuration = type === 'warning' ? 7000 : 5000;
    setTimeout(() => {
        if (alert.parentNode) {
            alert.style.animation = 'alert-fade-out 0.4s ease forwards';
            setTimeout(() => {
                if (alert.parentNode) alert.remove();
            }, 400);
        }
    }, displayDuration);
}

