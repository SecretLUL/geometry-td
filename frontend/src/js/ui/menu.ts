/*
 * @file: frontend/src/js/ui/menu.ts
 * @purpose: Controls the game's home page menus, level selections, lobby status checks, database lexicon, and user profiles/authentication.
 * @dependencies: config, enemies, background, types
 * @last_update: 2026-06-04 / v2.16.0 - Refactored menu.ts into modular sub-controllers under src/js/ui/menu/
 */
import { NavigationController } from './menu/navigation';
import { MusicController } from './menu/music';
import { SettingsController } from './menu/settings';
import { LexiconController } from './menu/lexicon';
import { ChangelogController } from './menu/changelog';
import { ProfileController } from './menu/profile';
import { LeaderboardController } from './menu/leaderboard';
import { MatchmakingController } from './menu/matchmaking';
import { BackgroundController } from './background';

export class MenuController {
    public navigation!: NavigationController;
    public music!: MusicController;
    public settings!: SettingsController;
    public lexicon!: LexiconController;
    public changelog!: ChangelogController;
    public profile!: ProfileController;
    public leaderboard!: LeaderboardController;
    public matchmaking!: MatchmakingController;

    private _currentUsername: string | null = null;

    constructor() {
        new BackgroundController('bgCanvas');
        this.init();
    }

    public get currentUsername(): string | null {
        return this._currentUsername;
    }

    public set currentUsername(val: string | null) {
        this._currentUsername = val;
    }

    private init(): void {
        this.navigation = new NavigationController(this);
        this.music = new MusicController();
        this.settings = new SettingsController(this);
        this.lexicon = new LexiconController();
        this.changelog = new ChangelogController();
        this.profile = new ProfileController(this);
        this.leaderboard = new LeaderboardController(this);
        this.matchmaking = new MatchmakingController();
    }
}

// Start Controller
window.addEventListener('DOMContentLoaded', () => {
    new MenuController();
});
