/*
 * @file: frontend\src\js\core\logger.ts
 * @purpose: Standardized game logger capturing metrics like ticks, waves, lives, and gold to simplify local and remote debug logging.
 * @dependencies: state
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
 * @last_update: 2026-05-21 / v1.1.0
 */
import { state } from './state';

interface LogContext {
    wave: number;
    lives: number;
    gold: number;
    towerCount: number;
    enemyCount: number;
    isWaveActive: boolean;
    enemiesToSpawn?: number;
    gameOver?: boolean;
    isPaused?: boolean;
    gameSpeed?: number;
    autoStartActive?: boolean;
    totalGoldEarned?: number;
    totalGoldFromInterest?: number;
    projectileCount?: number;
    particleCount?: number;
    floatingTextCount?: number;
    cheatsActive?: boolean;
    activeCheats?: string[];
    m?: string;
    s?: string;
    l?: number | string;
    stack?: string;
    r?: string;
    error?: any;
    [key: string]: any;
}

interface LogEntry {
    timestamp: string;
    level: string;
    message: string;
    context: LogContext;
}

/**
 * AI-Optimized Logger for Geometry Tower Defense
 * Captures game state snapshots with each log to facilitate debugging.
 */
class Logger {
    private LOG_KEY: string = 'td_game_logs';
    private MAX_LOGS: number = 500; 
    private levels: Record<string, string> = {
        DEBUG: 'DEBUG',
        INFO:  'INFO',
        WARN:  'WARN',
        ERROR: 'ERROR'
    };
    private hasSyncedOnCrash: boolean = false;
    
    constructor() {
        this.initGlobalHandlers();
        this.initKeyboardListener();
        
        // Initial session header
        this.info('NEW_SESSION_START');
    }

    /**
     * AI-Instruction Header for the debug.log file.
     * Explains the mathematical notation and logic rules.
     */
    getHeader(): string {
        return [
            "// === AI_DEBUG_PROTOCOL_V1 ===",
            "// Rules: Analysis should focus on state inconsistencies.",
            "// IF [l:E] THEN check [s:e] > 0 AND [s:ets] == 0 (Stuck Wave check).",
            "// Notation: t=timestamp, l=level(I|W|E|D), m=msg, s=state{l:lives, g:gold, w:wave, e:enemies, ets:spawnLeft, a:active,",
            "//           tc:towers, go:gameOver, p:paused, sp:gameSpeed, as:autoStart, tg:totalGold, ti:interestGold,",
            "//           pr:projectiles, pa:particles, ft:floatingTexts, ca:cheatsActive, cl:cheatsList}",
            "// Press 'L' in-game to sync logs to debug.log structure.",
            "// ============================"
        ].join('\n');
    }

    initGlobalHandlers(): void {
        window.onerror = (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => {
            this.error('RUNTIME_ERR', {
                m: typeof message === 'string' ? message : message.type,
                s: source || '',
                l: lineno || 0,
                stack: error?.stack?.substring(0, 200)
            });
            if (!this.hasSyncedOnCrash) {
                this.hasSyncedOnCrash = true;
                this.sync(); // Auto-sync on crash only once
            }
            return false;
        };

        window.onunhandledrejection = (event: PromiseRejectionEvent) => {
            this.error('PROMISE_REJ', { r: String(event.reason) });
            if (!this.hasSyncedOnCrash) {
                this.hasSyncedOnCrash = true;
                this.sync();
            }
        };
    }

    initKeyboardListener(): void {
        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'l' && !e.ctrlKey && !e.metaKey) {
                this.sync();
                console.info('Manual log sync triggered.');
            }
        });
    }

    private _getActiveCheats(): { active: boolean; list: string[] } {
        const list: string[] = [];
        if (state.godMode) list.push('godMode');
        if (state.infiniteGold) list.push('infiniteGold');
        if (state.waveModified) list.push('waveModified');
        if (state.benchmarkActive) list.push('benchmarkActive');
        return {
            active: list.length > 0,
            list
        };
    }

    private _getTimestamp(): string {
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const hh = pad(now.getHours());
        const mm = pad(now.getMinutes());
        const ss = pad(now.getSeconds());
        return `${hh}:${mm}:${ss}`;
    }

    /**
     * Generates a high-density, single-line JSON string for the debug.log.
     */
    generateLogEntry(entry: LogEntry): string {
        const s = entry.context;
        const compact: any = {
            t: entry.timestamp,
            l: entry.level[0], 
            m: entry.message,
            s: {
                l: s.lives,
                g: s.gold,
                w: s.wave,
                e: s.enemyCount,
                ets: s.enemiesToSpawn !== undefined ? s.enemiesToSpawn : state.enemiesToSpawn,
                a: s.isWaveActive ? 1 : 0,
                tc: s.towerCount,
                go: s.gameOver ? 1 : 0,
                p: s.isPaused ? 1 : 0,
                sp: s.gameSpeed ?? 1,
                as: s.autoStartActive ? 1 : 0,
                tg: s.totalGoldEarned ?? 0,
                ti: s.totalGoldFromInterest ?? 0,
                pr: s.projectileCount ?? 0,
                pa: s.particleCount ?? 0,
                ft: s.floatingTextCount ?? 0,
                ca: s.cheatsActive ? 1 : 0,
                cl: s.activeCheats || []
            }
        };

        // Bei Fehlern packen wir die Details in das Message-Feld, 
        // da das State-Objekt im Debug-Protokoll fix definiert ist.
        if (entry.level === 'ERROR' || entry.level === 'E') {
            if (entry.message === 'RUNTIME_ERR' || s.m) {
                compact.m = `ERR: ${s.m || entry.message || 'Unknown'} @ ${s.s || '?'}:${s.l || '?'}`;
                if (s.stack) compact.stack = s.stack;
            } else if (entry.message === 'PROMISE_REJ' || s.r) {
                compact.m = `REJ: ${s.r || 'Unknown'}`;
            }
            if (s.error) compact.error = s.error;
        }
        return JSON.stringify(compact);
    }

    private _log(level: string, message: string, extra: Record<string, any> = {}): void {
        const cheatInfo = this._getActiveCheats();
        const logEntry: LogEntry = {
            timestamp: this._getTimestamp(),
            level,
            message,
            context: {
                wave: state.wave,
                lives: state.lives,
                gold: state.gold,
                towerCount: state.towers?.length || 0,
                enemyCount: state.enemies?.length || 0,
                isWaveActive: state.isWaveActive,
                enemiesToSpawn: state.enemiesToSpawn,
                gameOver: state.gameOver,
                isPaused: state.isPaused,
                gameSpeed: state.gameSpeed,
                autoStartActive: state.autoStartActive,
                totalGoldEarned: state.totalGoldEarned,
                totalGoldFromInterest: state.totalGoldFromInterest,
                projectileCount: state.projectiles?.length || 0,
                particleCount: state.particles?.length || 0,
                floatingTextCount: state.floatingTexts?.length || 0,
                cheatsActive: cheatInfo.active,
                activeCheats: cheatInfo.list,
                ...extra
            }
        };

        // Standard Console
        const colors: Record<string, string> = { INFO: '#00bfff', WARN: '#ffa500', ERROR: '#ff4500' };
        console.log(`%c[${logEntry.level[0]}] ${message}`, `color: ${colors[level] || '#888'}`, logEntry.context);

        this._persist(logEntry);
    }

    private _persist(entry: LogEntry): void {
        try {
            const logs = JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]');
            logs.push(entry);
            if (logs.length > this.MAX_LOGS) logs.shift();
            localStorage.setItem(this.LOG_KEY, JSON.stringify(logs));
        } catch (e) {}
    }

    /**
     * Bridges the browser to the physical debug.log.
     * Generates the full log content and copies it to clipboard/console.
     */
    sync(): void {
        const logs = this.getLogs();
        const output = [
            this.getHeader(),
            ...logs.map(entry => this.generateLogEntry(entry))
        ].join('\n');

        // 1. Copy to console for easy "Copy Value"
        console.group('=== SYNC TO debug.log ===');
        console.log(output);
        console.groupEnd();

        // 2. Offer as Download
        const blob = new Blob([output], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'debug.log';
        a.click();
        URL.revokeObjectURL(url);
    }

    debug(msg: string, extra?: Record<string, any>): void { this._log(this.levels.DEBUG, msg, extra); }
    info(msg: string, extra?: Record<string, any>): void  { this._log(this.levels.INFO, msg, extra); }
    warn(msg: string, extra?: Record<string, any>): void  { this._log(this.levels.WARN, msg, extra); }
    error(msg: string, extra?: Record<string, any>): void { this._log(this.levels.ERROR, msg, extra); }

    getLogs(): LogEntry[] {
        try {
            return JSON.parse(localStorage.getItem(this.LOG_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    clearLogs(): void {
        localStorage.removeItem(this.LOG_KEY);
    }
}

export const logger = new Logger();
