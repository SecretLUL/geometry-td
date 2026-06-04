import { MenuController } from '../menu';

export class SettingsController {
    private main: MenuController;

    constructor(main: MenuController) {
        this.main = main;
        this.initSettings();
    }

    private initSettings(): void {
        const sound = document.getElementById('soundVolume') as HTMLInputElement | null;
        const music = document.getElementById('musicVolume') as HTMLInputElement | null;
        const perf = document.getElementById('perfModeToggle') as HTMLInputElement | null;
        const fps = document.getElementById('fpsToggle') as HTMLInputElement | null;
        const refresh = document.getElementById('refreshRateSelect') as HTMLSelectElement | null;

        // Load saved
        if (sound) sound.value = localStorage.getItem('td_sound_vol') || '50';
        if (music) music.value = localStorage.getItem('td_music_vol') || '50';
        if (perf) perf.checked = localStorage.getItem('td_perf_mode') === 'true';
        if (fps) fps.checked = localStorage.getItem('td_show_fps') === 'true';
        if (refresh) refresh.value = localStorage.getItem('td_refresh_rate') || '60';

        // Listeners
        sound?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_sound_vol', target.value);
        });
        music?.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const volVal = parseInt(target.value, 10);
            localStorage.setItem('td_music_vol', target.value);
            // Apply volume via MusicController
            this.main.music.setVolume(volVal);
        });
        perf?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_perf_mode', String(target.checked));
        });
        fps?.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            localStorage.setItem('td_show_fps', String(target.checked));
        });
        refresh?.addEventListener('change', (e) => {
            const target = e.target as HTMLSelectElement;
            localStorage.setItem('td_refresh_rate', target.value);
        });
    }
}
