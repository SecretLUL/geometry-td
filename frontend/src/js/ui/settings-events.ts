/*
 * @file: frontend/src/js/ui/settings-events.ts
 * @purpose: Registers and synchronizes settings inputs (volumes, performance options, FPS overlays).
 * @dependencies: state
 */
import { state } from "../core/state";

export function setupSettingsEvents(): void {
  // Sync settings between main menu and in-game modal
  const refreshRateSelect = document.getElementById(
    "refreshRateSelect"
  ) as HTMLSelectElement | null;
  const igRefreshRateSelect = document.getElementById(
    "igRefreshRateSelect"
  ) as HTMLSelectElement | null;

  // Load and apply saved refresh rate from localStorage
  const savedRefreshRate = localStorage.getItem("td_refresh_rate") || "60";
  if (refreshRateSelect) refreshRateSelect.value = savedRefreshRate;
  if (igRefreshRateSelect) igRefreshRateSelect.value = savedRefreshRate;

  if (refreshRateSelect) {
    refreshRateSelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      if (igRefreshRateSelect) igRefreshRateSelect.value = target.value;
      localStorage.setItem("td_refresh_rate", target.value);
    });
  }
  if (igRefreshRateSelect) {
    igRefreshRateSelect.addEventListener("change", (e) => {
      const target = e.target as HTMLSelectElement;
      if (refreshRateSelect) refreshRateSelect.value = target.value;
      localStorage.setItem("td_refresh_rate", target.value);
    });
  }

  const soundVolume = document.getElementById("soundVolume") as HTMLInputElement | null;
  const igSoundVolume = document.getElementById("igSoundVolume") as HTMLInputElement | null;
  if (soundVolume && igSoundVolume) {
    soundVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      igSoundVolume.value = target.value;
    });
    igSoundVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      soundVolume.value = target.value;
    });
  }

  const musicVolume = document.getElementById("musicVolume") as HTMLInputElement | null;
  const igMusicVolume = document.getElementById("igMusicVolume") as HTMLInputElement | null;
  if (musicVolume && igMusicVolume) {
    musicVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      igMusicVolume.value = target.value;
    });
    igMusicVolume.addEventListener("input", (e) => {
      const target = e.target as HTMLInputElement;
      musicVolume.value = target.value;
    });
  }

  const perfModeToggle = document.getElementById("perfModeToggle") as HTMLInputElement | null;
  const igPerfModeToggle = document.getElementById("igPerfModeToggle") as HTMLInputElement | null;

  // Initialize performance mode state from localStorage
  const savedPerfMode = localStorage.getItem("td_perf_mode") === "true";
  state.perfMode = savedPerfMode;
  if (perfModeToggle) perfModeToggle.checked = savedPerfMode;
  if (igPerfModeToggle) igPerfModeToggle.checked = savedPerfMode;

  if (perfModeToggle) {
    perfModeToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (igPerfModeToggle) igPerfModeToggle.checked = target.checked;
      state.perfMode = target.checked;
      localStorage.setItem("td_perf_mode", String(target.checked));
    });
  }
  if (igPerfModeToggle) {
    igPerfModeToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (perfModeToggle) perfModeToggle.checked = target.checked;
      state.perfMode = target.checked;
      localStorage.setItem("td_perf_mode", String(target.checked));
    });
  }

  const fpsToggle = document.getElementById("fpsToggle") as HTMLInputElement | null;
  const igFpsToggle = document.getElementById("igFpsToggle") as HTMLInputElement | null;

  // Initialize FPS toggle state from localStorage
  const savedShowFps = localStorage.getItem("td_show_fps") === "true";
  state.showFps = savedShowFps;
  if (fpsToggle) fpsToggle.checked = savedShowFps;
  if (igFpsToggle) igFpsToggle.checked = savedShowFps;

  if (fpsToggle) {
    fpsToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (igFpsToggle) igFpsToggle.checked = target.checked;
      state.showFps = target.checked;
      localStorage.setItem("td_show_fps", String(target.checked));
    });
  }
  if (igFpsToggle) {
    igFpsToggle.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      if (fpsToggle) fpsToggle.checked = target.checked;
      state.showFps = target.checked;
      localStorage.setItem("td_show_fps", String(target.checked));
    });
  }
}
