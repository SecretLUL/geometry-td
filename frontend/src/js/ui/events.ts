/*
 * @file: frontend/src/js/ui/events.ts
 * @purpose: Entry point for user-input-control event bindings.
 * @dependencies: settings-events, control-events, canvas-events, tower-builder
 */
import { setupSettingsEvents } from "./settings-events";
import { setupControlEvents } from "./control-events";
import { setupCanvasEvents } from "./canvas-events";

// Re-export buildTowerAt for full backward compatibility (e.g. used by modals.ts)
export { buildTowerAt } from "./tower-builder";

export function setupEvents(startWaveCallback: () => void, canvas: HTMLCanvasElement): void {
  // Bind settings listeners (Refresh rate, volume sliders, performance toggle, fps display)
  setupSettingsEvents();

  // Bind HUD control buttons (Restart, quit menu modals, pause controls, game speed, auto-start wave triggers)
  setupControlEvents(startWaveCallback);

  // Bind Canvas interactions (Hover preview tooltips, clicking cells, relocator coordinates, right-click actions)
  setupCanvasEvents(canvas);
}
