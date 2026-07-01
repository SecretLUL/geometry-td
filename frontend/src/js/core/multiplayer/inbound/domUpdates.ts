import { state } from "../../state";
import { Config } from "../../config";

export function updateAutoStartBtn(): void {
  const autoBtn = document.getElementById("autoStartBtn");
  if (autoBtn) {
    autoBtn.innerText = state.autoStartActive ? "Auto: An" : "Auto: Aus";
    autoBtn.style.background = state.autoStartActive
      ? "linear-gradient(to bottom, #00ff88, #00b35f)"
      : "";
    autoBtn.style.color = state.autoStartActive ? "#fff" : "";
  }
}

export function updatePauseBtn(): void {
  const pauseBtn = document.getElementById("pauseBtn");
  if (pauseBtn) {
    pauseBtn.innerText = state.isPaused ? "Weiter" : "Pause";
    pauseBtn.style.background = state.isPaused
      ? "linear-gradient(to bottom, #ffb703, #d49a00)"
      : "";
    pauseBtn.style.color = state.isPaused ? "#fff" : "";
  }
}

export function updateSpeedBtn(): void {
  const speedBtn = document.getElementById("speedBtn");
  if (speedBtn) {
    if (state.gameSpeed === Config.GAME_SPEEDS.FAST) {
      speedBtn.innerText = "2x Speed";
      speedBtn.style.background = "linear-gradient(to bottom, #ffb703, #d49a00)";
      speedBtn.style.color = "#fff";
    } else if (state.gameSpeed === Config.GAME_SPEEDS.SUPER_FAST) {
      speedBtn.innerText = "4x Speed";
      speedBtn.style.background = "linear-gradient(to bottom, #ff0055, #b3003b)";
      speedBtn.style.color = "#fff";
    } else {
      speedBtn.innerText = "1x Speed";
      speedBtn.style.background = "";
      speedBtn.style.color = "";
    }
  }
}
