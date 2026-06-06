import { EnemyData } from '../../core/config';
import { EnemyFactory } from '../../entities/enemies';
import { EnemyType } from '../../types';
import * as PIXI from 'pixi.js';

export class LexiconController {
    private lexiconApp: PIXI.Application | null = null;
    private currentLexiconTickFn: (() => void) | null = null;
    private currentLexiconEnemyType: string | null = null;

    constructor() {
        this.initLexicon();
    }

    public initLexicon(): void {
        const listContainer = document.getElementById('lexiconList');
        const detailsContainer = document.getElementById('lexiconDetails');
        const placeholder = document.getElementById('lexiconPlaceholder');

        if (!listContainer) return;
        listContainer.innerHTML = '';

        const isLoggedIn = sessionStorage.getItem('td_logged_in') === 'true';
        const storage = isLoggedIn ? localStorage : sessionStorage;
        const discovered = JSON.parse(storage.getItem('td_discovered_enemies') || '{}');
        const recordWave = parseInt(storage.getItem('td_record_wave') || '0');

        const categories = ['Bosse', 'Special Minions', 'Minions'];

        categories.forEach(cat => {
            const catEnemies = Object.keys(EnemyData).filter(key => EnemyData[key].category === cat);
            if (catEnemies.length === 0) return;

            const header = document.createElement('div');
            header.className = 'lexicon-category-header';
            header.innerText = cat;
            listContainer.appendChild(header);

            const mainEnemies = catEnemies.filter(k => k !== 'DefragmenterFragment' && k !== 'DefragmenterSubfragment');

            mainEnemies.forEach(key => {
                const data = EnemyData[key];
                const isDiscovered = !!discovered[key] || (!!data.unlockWave && recordWave >= data.unlockWave);

                const btn = document.createElement('button');
                btn.className = 'lexicon-entry-btn';
                btn.dataset.discovered = isDiscovered ? 'true' : 'false';
                btn.style.width = '100%';
                btn.style.marginBottom = '10px';
                btn.style.textAlign = 'left';
                btn.style.padding = '15px 20px';
                btn.style.background = 'rgba(255,255,255,0.03)';
                btn.style.border = '1px solid rgba(255,255,255,0.05)';
                btn.style.borderRadius = '10px';
                btn.style.color = isDiscovered ? '#fff' : '#444';
                btn.style.fontFamily = 'Outfit';
                btn.style.fontSize = '1.1rem';
                btn.style.letterSpacing = '1px';
                btn.style.cursor = 'pointer';
                btn.style.transition = '0.3s';

                if (isDiscovered) {
                    btn.innerHTML = `<span style="margin-right: 15px; font-size: 1.4rem;">${data.icon}</span> ${data.name.toUpperCase()}`;
                } else {
                    btn.innerHTML = `<span style="margin-right: 15px; font-size: 1.4rem; opacity: 0.3;">?</span> UNKNOWN ENTITY`;
                    btn.style.fontStyle = 'italic';
                }

                btn.addEventListener('click', () => {
                    document.querySelectorAll('.lexicon-entry-btn').forEach(b => {
                        const htmlB = b as HTMLElement;
                        htmlB.style.background = 'rgba(255,255,255,0.03)';
                        htmlB.style.borderColor = 'rgba(255,255,255,0.05)';
                        htmlB.style.color = htmlB.dataset.discovered === 'true' ? '#fff' : '#444';
                    });
                    btn.style.background = isDiscovered ? 'rgba(76, 201, 240, 0.1)' : 'rgba(255,255,255,0.05)';
                    btn.style.borderColor = isDiscovered ? 'var(--tesla-cyan)' : 'rgba(255,255,255,0.1)';
                    if (isDiscovered) btn.style.color = 'var(--tesla-cyan)';

                    if (placeholder) placeholder.style.display = 'none';
                    if (detailsContainer) detailsContainer.style.display = 'flex';

                    this.updateLexiconDetails(key, data, isDiscovered);

                    const fragContainer = document.getElementById('defragmenter-fragments-container');
                    if (fragContainer) {
                        if (key === 'Defragmenter') {
                            fragContainer.style.display = 'block';
                        } else {
                            fragContainer.style.display = 'none';
                        }
                    }
                });
                listContainer.appendChild(btn);

                if (key === 'Defragmenter') {
                    const fragmentsContainer = document.createElement('div');
                    fragmentsContainer.id = 'defragmenter-fragments-container';
                    fragmentsContainer.style.display = 'none';
                    fragmentsContainer.style.paddingLeft = '35px';

                    const fragments = ['DefragmenterFragment', 'DefragmenterSubfragment'];
                    fragments.forEach(fragKey => {
                        const fragData = EnemyData[fragKey];
                        const fragDiscovered = !!discovered[fragKey] || (!!fragData.unlockWave && recordWave >= fragData.unlockWave);

                        const fragBtn = document.createElement('button');
                        fragBtn.className = 'lexicon-entry-btn';
                        fragBtn.dataset.discovered = fragDiscovered ? 'true' : 'false';
                        fragBtn.style.width = '100%';
                        fragBtn.style.marginBottom = '10px';
                        fragBtn.style.textAlign = 'left';
                        fragBtn.style.padding = '10px 15px';
                        fragBtn.style.background = 'rgba(255,255,255,0.03)';
                        fragBtn.style.border = '1px solid rgba(255,255,255,0.05)';
                        fragBtn.style.borderRadius = '10px';
                        fragBtn.style.color = fragDiscovered ? '#fff' : '#444';
                        fragBtn.style.fontFamily = 'Outfit';
                        fragBtn.style.fontSize = '0.95rem';
                        fragBtn.style.letterSpacing = '1px';
                        fragBtn.style.cursor = 'pointer';
                        fragBtn.style.transition = '0.3s';

                        if (fragDiscovered) {
                            fragBtn.innerHTML = `<span style="margin-right: 15px; font-size: 1.2rem;">${fragData.icon}</span> ${fragData.name.toUpperCase()}`;
                        } else {
                            fragBtn.innerHTML = `<span style="margin-right: 15px; font-size: 1.2rem; opacity: 0.3;">?</span> UNKNOWN ENTITY`;
                            fragBtn.style.fontStyle = 'italic';
                        }

                        fragBtn.addEventListener('click', () => {
                            document.querySelectorAll('.lexicon-entry-btn').forEach(b => {
                                const htmlB = b as HTMLElement;
                                htmlB.style.background = 'rgba(255,255,255,0.03)';
                                htmlB.style.borderColor = 'rgba(255,255,255,0.05)';
                                htmlB.style.color = htmlB.dataset.discovered === 'true' ? '#fff' : '#444';
                            });
                            fragBtn.style.background = fragDiscovered ? 'rgba(76, 201, 240, 0.1)' : 'rgba(255,255,255,0.05)';
                            fragBtn.style.borderColor = fragDiscovered ? 'var(--tesla-cyan)' : 'rgba(255,255,255,0.1)';
                            if (fragDiscovered) fragBtn.style.color = 'var(--tesla-cyan)';

                            if (placeholder) placeholder.style.display = 'none';
                            if (detailsContainer) detailsContainer.style.display = 'flex';

                            this.updateLexiconDetails(fragKey, fragData, fragDiscovered);
                        });

                        fragmentsContainer.appendChild(fragBtn);
                    });

                    listContainer.appendChild(fragmentsContainer);
                }
            });
        });
    }

    private updateLexiconDetails(key: string, data: any, isDiscovered: boolean): void {
        const title = document.getElementById('lexTitle');
        const desc = document.getElementById('lexDescription');
        const hpBar = document.getElementById('lexHpBar');
        const speedBar = document.getElementById('lexSpeedBar');
        const rewardBar = document.getElementById('lexRewardBar');
        const stars = document.getElementById('lexDifficultyStars');
        const wave = document.getElementById('lexMinWave');
        const ability = document.getElementById('lexAbility');
        const weakness = document.getElementById('lexWeakness');
        const flavor = document.getElementById('lexFlavor');
        const iconContainer = document.getElementById('lexIcon');

        if (!title || !desc || !hpBar || !speedBar || !rewardBar || !stars || !wave || !ability || !weakness || !flavor || !iconContainer) return;

        if (isDiscovered) {
            title.innerText = data.name;
            title.style.color = data.color;
            iconContainer.style.borderColor = data.color;
            desc.innerText = data.description || 'No detailed tactical data available.';
            hpBar.style.width = Math.min(100, data.hp) + '%';
            hpBar.style.backgroundColor = '#ff3366';
            speedBar.style.width = Math.min(100, data.speed) + '%';
            speedBar.style.backgroundColor = '#4cc9f0';
            rewardBar.style.width = Math.min(100, data.reward) + '%';
            rewardBar.style.backgroundColor = '#fca311';
            stars.innerText = '★'.repeat(data.difficulty) + '☆'.repeat(5 - data.difficulty);
            wave.innerText = `WAVE ${data.unlockWave || 1}`;
            ability.innerText = data.ability;
            weakness.innerText = data.weakness;
            flavor.innerText = `"${data.flavorText}"`;
            iconContainer.style.boxShadow = `0 0 50px ${data.color}33`;
        } else {
            title.innerText = 'ENCRYPTED';
            title.style.color = '#333';
            iconContainer.style.borderColor = '#222';
            desc.innerText = 'Tactic data restricted. Neutralize entity in simulation to unlock database entry.';
            hpBar.style.width = '0%';
            speedBar.style.width = '0%';
            rewardBar.style.width = '0%';
            stars.innerText = '?????';
            wave.innerText = 'LOCKED';
            ability.innerText = 'Unknown';
            weakness.innerText = 'Unknown';
            flavor.innerText = 'Simulation progress required.';
            iconContainer.style.boxShadow = 'none';
        }

        this.renderLexiconEnemy(key, isDiscovered);
    }

    private renderLexiconEnemy(enemyType: string, isDiscovered: boolean): void {
        if (this.currentLexiconEnemyType === enemyType) {
            return;
        }
        this.currentLexiconEnemyType = enemyType;

        const initLexiconApp = async () => {
            if (!this.lexiconApp) {
                const canvas = document.getElementById('lexiconCanvas') as HTMLCanvasElement | null;
                if (!canvas) return;

                this.lexiconApp = new PIXI.Application();
                await this.lexiconApp.init({
                    canvas: canvas,
                    backgroundAlpha: 0,
                    width: 180,
                    height: 180,
                    resolution: window.devicePixelRatio || 1,
                    autoDensity: true,
                    antialias: true
                });
            } else {
                this.lexiconApp.stage.removeChildren();
                if (this.currentLexiconTickFn) {
                    this.lexiconApp.ticker.remove(this.currentLexiconTickFn);
                    this.currentLexiconTickFn = null;
                }
            }

            const enemy = EnemyFactory.createEnemy(enemyType as EnemyType, 1, true);
            enemy.x = 90;
            enemy.y = 90;
            enemy.hideHealthBar = true;

            if (enemy.pixiSprite) {
                this.lexiconApp.stage.addChild(enemy.pixiSprite);
                enemy.pixiSprite.position.set(90, 90);

                let scaleFactor = 3.0;
                if (enemyType === 'Boss' || enemyType === 'Defragmenter') scaleFactor = 0.8;
                if (enemyType === 'DefragmenterFragment') scaleFactor = 1.5;
                if (enemyType === 'Bruiser') scaleFactor = 2.2;
                if (enemyType === 'Accelerator') scaleFactor = 2.0;

                enemy.pixiSprite.scale.set(scaleFactor);
            }

            const tickFn = () => {
                if (enemy.pulseTime !== undefined) enemy.pulseTime += 0.05 * Math.max(1, enemy.speed);
                if (enemyType !== 'Accelerator' && enemy.rotation !== undefined) {
                    enemy.rotation += 0.02 * Math.max(1, enemy.speed) * (enemy.rotationSpeedMultiplier ?? 1.0);
                }
                if (enemy.outerRotation !== undefined) enemy.outerRotation += 0.02 * Math.max(1, enemy.speed);

                if (enemy.updatePixi) enemy.updatePixi();

                if (enemy.pixiSprite) {
                    if (!isDiscovered) {
                        enemy.pixiSprite.tint = 0x111111;
                    } else {
                        enemy.pixiSprite.tint = 0xffffff;
                    }
                }
            };

            this.currentLexiconTickFn = tickFn;
            this.lexiconApp.ticker.add(tickFn);
        };

        initLexiconApp();
    }
}
