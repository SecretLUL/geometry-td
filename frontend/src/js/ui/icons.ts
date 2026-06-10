/*
 * @file: frontend/src/js/ui/icons.ts
 * @purpose: Stores inline SVG path templates for tower/upgrade visual buttons in the UI panel.
 * @dependencies: None
 * @last_update: 2026-05-20 / v1.0.0
 */
export const ICONS: Record<string, string> = {
  Base: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Cannon barrel -->
        <rect x="16" y="13" width="13" height="6" rx="2" fill="#fff"/>
        <!-- Turret circle -->
        <circle cx="14" cy="16" r="7" fill="#4299e1"/>
        <!-- Highlight -->
        <circle cx="11" cy="13" r="2.5" fill="rgba(255,255,255,0.25)"/>
    </svg>`,

  Sniper: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Crosshair rings -->
        <circle cx="16" cy="16" r="10" stroke="#a0d8ef" stroke-width="1.5" fill="none"/>
        <circle cx="16" cy="16" r="5" stroke="#a0d8ef" stroke-width="1.5" fill="none"/>
        <!-- Cross hairs -->
        <line x1="16" y1="4" x2="16" y2="28" stroke="#a0d8ef" stroke-width="1.5"/>
        <line x1="4" y1="16" x2="28" y2="16" stroke="#a0d8ef" stroke-width="1.5"/>
        <!-- Center dot -->
        <circle cx="16" cy="16" r="2" fill="#fff"/>
    </svg>`,

  Bomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Bomb body -->
        <circle cx="16" cy="18" r="9" fill="#ff4040"/>
        <!-- Fuse cap -->
        <rect x="14" y="7" width="5" height="4" rx="1" fill="#888"/>
        <!-- Fuse wire -->
        <path d="M16 7 Q22 4 24 2" stroke="#fca311" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Spark -->
        <circle cx="24" cy="2" r="2.5" fill="#ffb703"/>
        <!-- Shine -->
        <circle cx="12" cy="14" r="2.5" fill="rgba(255,255,255,0.2)"/>
    </svg>`,

  Tesla: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Octagon base -->
        <path d="M10 4 L22 4 L28 10 L28 22 L22 28 L10 28 L4 22 L4 10 Z" fill="#0059b3"/>
        <!-- Core -->
        <circle cx="16" cy="16" r="6" fill="#fff"/>
        <!-- Electricity bolts -->
        <path d="M16 10 L16 4 M16 22 L16 28 M10 16 L4 16 M22 16 L28 16" stroke="#00ffff" stroke-width="2" stroke-linecap="round"/>
        <path d="M12 12 L8 8 M20 20 L24 24 M12 20 L8 24 M20 12 L24 8" stroke="#00ffff" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  Prisma: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Triangle Base -->
        <path d="M16 4 L28 26 L4 26 Z" fill="#b8860b" stroke="rgba(255, 255, 255, 0.2)" stroke-width="1"/>
        <!-- Floating central diamond crystal -->
        <path d="M16 9 L21 16 L16 23 L11 16 Z" fill="#ffd700"/>
        <path d="M16 9 L16 23" stroke="#ffffff" stroke-width="1"/>
        <path d="M11 16 L21 16" stroke="#ffffff" stroke-width="0.5"/>
        <!-- Glow accents -->
        <circle cx="16" cy="16" r="3" fill="#ffffff" opacity="0.8"/>
    </svg>`,

  Booster: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Orbiting ring -->
        <circle cx="16" cy="16" r="11" stroke="#ff9f43" stroke-width="1.5" fill="none" stroke-dasharray="4 2"/>
        <!-- Central Octahedron / Diamond -->
        <path d="M16 6 L24 16 L16 26 L8 16 Z" fill="#ff9f43" stroke="#fff" stroke-width="1.5"/>
        <!-- Inner Core -->
        <path d="M16 11 L20 16 L16 21 L12 16 Z" fill="#fff"/>
        <!-- Connection energy lines / arrows -->
        <line x1="16" y1="3" x2="16" y2="6" stroke="#ff9f43" stroke-width="2" stroke-linecap="round"/>
        <line x1="16" y1="26" x2="16" y2="29" stroke="#ff9f43" stroke-width="2" stroke-linecap="round"/>
        <line x1="6" y1="16" x2="8" y2="16" stroke="#ff9f43" stroke-width="2" stroke-linecap="round"/>
        <line x1="24" y1="16" x2="26" y2="16" stroke="#ff9f43" stroke-width="2" stroke-linecap="round"/>
    </svg>`,

  Generator: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="48" height="48">
        <!-- Outer Glowing Gear / Ring -->
        <circle cx="16" cy="16" r="11" stroke="#26de81" stroke-width="1.5" fill="none" stroke-dasharray="3 2"/>
        <!-- Gold Coin Body -->
        <circle cx="16" cy="16" r="9" fill="#00b894" stroke="#ffd700" stroke-width="2"/>
        <!-- Inner Details: Dollar Sign -->
        <path d="M16 10 L16 22 M13 13 C13 11, 19 11, 19 13.5 C19 16, 13 16, 13 18.5 C13 21, 19 21, 19 19" fill="none" stroke="#ffd700" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`,
};
