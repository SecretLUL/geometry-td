import { MenuController } from '../menu';
import { state } from '../../core/state';

export class ProfileController {
    private main: MenuController;

    constructor(main: MenuController) {
        this.main = main;
        this.initProfile();
    }

    private initProfile(): void {
        const authSection = document.getElementById('profile-auth-section');
        const dashboardSection = document.getElementById('profile-dashboard-section');

        const loginForm = document.getElementById('auth-login-form');
        const registerForm = document.getElementById('auth-register-form');
        const gotoRegister = document.getElementById('goto-register');
        const gotoLogin = document.getElementById('goto-login');

        const loginUser = document.getElementById('login-username') as HTMLInputElement | null;
        const loginPass = document.getElementById('login-password') as HTMLInputElement | null;
        const loginBtn = document.getElementById('login-submit-btn');
        const loginError = document.getElementById('login-error-msg');

        const regUser = document.getElementById('register-username') as HTMLInputElement | null;
        const regPass = document.getElementById('register-password') as HTMLInputElement | null;
        const regBtn = document.getElementById('register-submit-btn');
        const regError = document.getElementById('register-error-msg');
        const regSuccess = document.getElementById('register-success-msg');

        const logoutBtn = document.getElementById('logout-btn');

        const getBaseUrl = () => {
            return '';
        };

        gotoRegister?.addEventListener('click', () => {
            if (loginForm) { loginForm.style.display = 'none'; loginForm.classList.add('hidden'); }
            if (registerForm) { registerForm.style.display = 'block'; registerForm.classList.remove('hidden'); }
            if (loginError) loginError.style.display = 'none';
        });

        gotoLogin?.addEventListener('click', () => {
            if (registerForm) { registerForm.style.display = 'none'; registerForm.classList.add('hidden'); }
            if (loginForm) { loginForm.style.display = 'block'; loginForm.classList.remove('hidden'); }
            if (regError) regError.style.display = 'none';
            if (regSuccess) regSuccess.style.display = 'none';
        });

        const checkSession = async () => {
            try {
                const response = await fetch(`${getBaseUrl()}/api/auth/me`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.user) {
                        showDashboard(data.user);
                    } else {
                        showAuth();
                    }
                } else {
                    showAuth();
                }
            } catch (err) {
                console.warn('Session check failed:', err);
                showAuth();
            }
        };

        const showAuth = () => {
            sessionStorage.setItem('td_logged_in', 'false');
            state.isGuest = true;
            state.recordWave = parseInt(sessionStorage.getItem('td_record_wave') || '0');
            this.main.currentUsername = null;
            if (authSection) { authSection.style.display = 'block'; authSection.classList.remove('hidden'); }
            if (dashboardSection) { dashboardSection.style.display = 'none'; dashboardSection.classList.add('hidden'); }
            this.main.lexicon.initLexicon();
        };

        const showDashboard = async (user: { username: string, avatar?: string | null, created_at?: string | Date | null }) => {
            sessionStorage.setItem('td_logged_in', 'true');
            state.isGuest = false;
            state.recordWave = parseInt(localStorage.getItem('td_record_wave') || '0');
            this.main.currentUsername = user.username;
            if (authSection) { authSection.style.display = 'none'; authSection.classList.add('hidden'); }
            if (dashboardSection) { dashboardSection.style.display = 'grid'; dashboardSection.classList.remove('hidden'); }

            const userEl = document.getElementById('dashboard-username');
            if (userEl) userEl.textContent = user.username;

            const avatarDisplay = document.getElementById('profile-avatar-display');
            if (avatarDisplay) {
                avatarDisplay.replaceChildren();
                if (user.avatar) {
                    const img = document.createElement('img');
                    img.src = user.avatar;
                    img.alt = 'Profile Picture';
                    avatarDisplay.appendChild(img);
                } else {
                    avatarDisplay.textContent = '👤';
                }
            }

            const joinedEl = document.getElementById('dashboard-joined');
            if (joinedEl) {
                if (user.created_at) {
                    const date = new Date(user.created_at);
                    const formattedDate = date.toLocaleDateString('de-DE', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                    });
                    joinedEl.textContent = `Mitglied seit: ${formattedDate}`;
                } else {
                    joinedEl.textContent = 'Mitglied seit: --.--.----';
                }
            }

            this.main.lexicon.initLexicon();

            try {
                const response = await fetch(`${getBaseUrl()}/api/user/progress`);
                if (response.ok) {
                    const data = await response.json();
                    const progress = data.progress;
                    if (progress) {
                        const highestWaveEl = document.getElementById('dashboard-highest-wave');
                        if (highestWaveEl) highestWaveEl.textContent = String(progress.highest_wave || 0);

                        if (progress.highest_wave) {
                            localStorage.setItem('td_record_wave', String(progress.highest_wave));
                            state.recordWave = progress.highest_wave;
                        }

                        updateAchievementsUI(progress.unlocked_achievements || [], progress.highest_wave || 0);
                        updateSkinsUI(progress.unlocked_skins || ['default'], progress.selected_skin || 'default');

                        this.main.lexicon.initLexicon();
                    }
                }
            } catch (err) {
                console.error('Error fetching progress:', err);
            }
        };

        const updateAchievementsUI = (unlockedAchievements: string[], highestWave: number) => {
            const achievements = [
                { id: 'ach-first-wave', reqWave: 5 },
                { id: 'ach-wave-20', reqWave: 20 },
                { id: 'ach-wave-50', reqWave: 50 },
                { id: 'ach-gold-1000', reqWave: null },
                { id: 'ach-towers-15', reqWave: null },
                { id: 'ach-kill-boss', reqWave: 21 },
                { id: 'ach-no-lives-lost', reqWave: null },
                { id: 'ach-tesla-5', reqWave: null }
            ];

            achievements.forEach(ach => {
                const item = document.getElementById(ach.id);
                if (item) {
                    const statusEl = item.querySelector('.achievement-status');
                    const unlockedByDb = unlockedAchievements.includes(ach.id);
                    const unlockedByWave = ach.reqWave !== null && highestWave >= ach.reqWave;

                    if (unlockedByDb || unlockedByWave) {
                        item.classList.add('unlocked');
                        if (statusEl) statusEl.textContent = 'Freigeschaltet';

                        if (unlockedByWave && !unlockedByDb) {
                            fetch(`${getBaseUrl()}/api/user/unlock-achievement`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ achievementId: ach.id })
                            }).catch(() => { });
                        }
                    } else {
                        item.classList.remove('unlocked');
                        if (statusEl) statusEl.textContent = 'Gesperrt';
                    }
                }
            });
        };

        const updateSkinsUI = (unlockedSkins: string[], selectedSkin: string) => {
            const skinCards = document.querySelectorAll('.skin-card');
            skinCards.forEach(card => {
                const htmlCard = card as HTMLElement;
                const skinKey = htmlCard.dataset.skin;
                if (!skinKey) return;

                const statusEl = htmlCard.querySelector('.skin-status');

                htmlCard.classList.remove('selected', 'skin-locked');

                const isUnlocked = unlockedSkins.includes(skinKey);
                if (isUnlocked) {
                    if (skinKey === selectedSkin) {
                        htmlCard.classList.add('selected');
                        if (statusEl) statusEl.textContent = 'Ausgerüstet';
                    } else {
                        if (statusEl) statusEl.textContent = 'Auswählen';
                    }

                    htmlCard.onclick = async () => {
                        try {
                            const response = await fetch(`${getBaseUrl()}/api/user/progress`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ selected_skin: skinKey })
                            });
                            if (response.ok) {
                                updateSkinsUI(unlockedSkins, skinKey);
                            }
                        } catch (err) {
                            console.error('Error equipping skin:', err);
                        }
                    };
                } else {
                    htmlCard.classList.add('skin-locked');
                    if (statusEl) statusEl.textContent = 'Gesperrt';
                    htmlCard.onclick = null;
                }
            });
        };

        const loginRemember = document.getElementById('login-remember') as HTMLInputElement | null;

        const handleLoginEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                loginBtn?.click();
            }
        };
        loginUser?.addEventListener('keydown', handleLoginEnter);
        loginPass?.addEventListener('keydown', handleLoginEnter);

        const avatarContainer = document.getElementById('profile-avatar-container');
        const avatarInput = document.getElementById('profile-avatar-input') as HTMLInputElement | null;

        avatarContainer?.addEventListener('click', () => {
            avatarInput?.click();
        });

        avatarInput?.addEventListener('change', () => {
            if (!avatarInput.files || avatarInput.files.length === 0) return;
            const file = avatarInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                alert('Das ausgewählte Bild ist zu groß (maximal 2 MB).');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 128;
                    canvas.height = 128;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, 128, 128);
                        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.8);

                        try {
                            const response = await fetch(`${getBaseUrl()}/api/user/profile`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ avatar: resizedBase64 })
                            });
                            const result = await response.json();
                            if (response.ok && result.success) {
                                const avatarDisplay = document.getElementById('profile-avatar-display');
                                if (avatarDisplay) {
                                    avatarDisplay.replaceChildren();
                                    const newImg = document.createElement('img');
                                    newImg.src = resizedBase64;
                                    newImg.alt = 'Profile Picture';
                                    avatarDisplay.appendChild(newImg);
                                }
                            } else {
                                alert(result.error || 'Fehler beim Hochladen des Profilbildes.');
                            }
                        } catch (err) {
                            console.error('Error uploading avatar:', err);
                            alert('Verbindungsfehler beim Hochladen.');
                        }
                    }
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });

        const editUsernameBtn = document.getElementById('edit-username-btn');
        const usernameWrapper = document.getElementById('profile-username-wrapper');
        const usernameEditContainer = document.getElementById('username-edit-container');
        const usernameEditInput = document.getElementById('username-edit-input') as HTMLInputElement | null;
        const saveUsernameBtn = document.getElementById('save-username-btn');
        const cancelUsernameBtn = document.getElementById('cancel-username-btn');
        const usernameEditError = document.getElementById('username-edit-error');

        editUsernameBtn?.addEventListener('click', () => {
            const currentUsername = document.getElementById('dashboard-username')?.textContent || '';
            if (usernameEditInput) {
                usernameEditInput.value = currentUsername;
            }
            if (usernameWrapper) {
                usernameWrapper.style.display = 'none';
                usernameWrapper.classList.add('hidden');
            }
            if (usernameEditContainer) {
                usernameEditContainer.style.display = 'flex';
                usernameEditContainer.classList.remove('hidden');
            }
            if (usernameEditError) {
                usernameEditError.style.display = 'none';
                usernameEditError.classList.add('hidden');
            }
        });

        const closeUsernameEdit = () => {
            if (usernameWrapper) {
                usernameWrapper.style.display = 'flex';
                usernameWrapper.classList.remove('hidden');
            }
            if (usernameEditContainer) {
                usernameEditContainer.style.display = 'none';
                usernameEditContainer.classList.add('hidden');
            }
        };

        cancelUsernameBtn?.addEventListener('click', closeUsernameEdit);

        saveUsernameBtn?.addEventListener('click', async () => {
            const newUsername = usernameEditInput?.value.trim();
            if (!newUsername) {
                if (usernameEditError) {
                    usernameEditError.textContent = 'Name darf nicht leer sein.';
                    usernameEditError.style.display = 'block';
                    usernameEditError.classList.remove('hidden');
                }
                return;
            }
            if (newUsername.length < 4 || newUsername.length > 20 || !/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
                if (usernameEditError) {
                    usernameEditError.textContent = 'Name muss zwischen 4 und 20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und - enthalten.';
                    usernameEditError.style.display = 'block';
                    usernameEditError.classList.remove('hidden');
                }
                return;
            }

            try {
                const response = await fetch(`${getBaseUrl()}/api/user/profile`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: newUsername })
                });
                const result = await response.json();
                if (response.ok && result.success) {
                    const userEl = document.getElementById('dashboard-username');
                    if (userEl) userEl.textContent = newUsername;
                    this.main.currentUsername = newUsername;
                    closeUsernameEdit();
                } else {
                    if (usernameEditError) {
                        usernameEditError.textContent = result.error || 'Fehler beim Ändern des Namens.';
                        usernameEditError.style.display = 'block';
                        usernameEditError.classList.remove('hidden');
                    }
                }
            } catch (err) {
                if (usernameEditError) {
                    usernameEditError.textContent = 'Verbindungsfehler zum Server.';
                    usernameEditError.style.display = 'block';
                    usernameEditError.classList.remove('hidden');
                }
            }
        });

        loginBtn?.addEventListener('click', async () => {
            const username = loginUser?.value.trim();
            const password = loginPass?.value;
            const remember = loginRemember?.checked || false;

            if (!username || !password) {
                if (loginError) {
                    loginError.textContent = 'Bitte fülle alle Felder aus.';
                    loginError.style.display = 'block';
                }
                return;
            }

            try {
                const response = await fetch(`${getBaseUrl()}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password, remember })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    if (loginUser) loginUser.value = '';
                    if (loginPass) loginPass.value = '';
                    if (loginError) loginError.style.display = 'none';
                    showDashboard(data.user);
                } else {
                    if (loginError) {
                        loginError.textContent = data.error || 'Fehler beim Einloggen.';
                        loginError.style.display = 'block';
                    }
                }
            } catch (err) {
                if (loginError) {
                    loginError.textContent = 'Verbindungsfehler zum Server.';
                    loginError.style.display = 'block';
                }
            }
        });

        regBtn?.addEventListener('click', async () => {
            const username = regUser?.value.trim();
            const password = regPass?.value;

            if (!username || !password) {
                if (regError) {
                    regError.textContent = 'Bitte fülle alle Felder aus.';
                    regError.style.display = 'block';
                }
                return;
            }

            try {
                const response = await fetch(`${getBaseUrl()}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();
                if (response.ok && data.success) {
                    localStorage.removeItem('td_discovered_enemies');
                    localStorage.removeItem('td_record_wave');
                    sessionStorage.removeItem('td_discovered_enemies');
                    sessionStorage.removeItem('td_record_wave');
                    this.main.lexicon.initLexicon();

                    if (regUser) regUser.value = '';
                    if (regPass) regPass.value = '';
                    if (regError) regError.style.display = 'none';
                    if (regSuccess) {
                        regSuccess.textContent = 'Registrierung erfolgreich! Bitte logge dich ein.';
                        regSuccess.style.display = 'block';
                    }
                    setTimeout(() => {
                        gotoLogin?.click();
                    }, 1500);
                } else {
                    if (regError) {
                        regError.textContent = data.error || 'Fehler bei der Registrierung.';
                        regError.style.display = 'block';
                    }
                }
            } catch (err) {
                if (regError) {
                    regError.textContent = 'Verbindungsfehler zum Server.';
                    regError.style.display = 'block';
                }
            }
        });

        logoutBtn?.addEventListener('click', async () => {
            try {
                const response = await fetch(`${getBaseUrl()}/api/auth/logout`, { method: 'POST' });
                if (response.ok) {
                    sessionStorage.removeItem('td_discovered_enemies');
                    sessionStorage.removeItem('td_record_wave');
                    showAuth();
                }
            } catch (err) {
                console.error('Logout error:', err);
                sessionStorage.removeItem('td_discovered_enemies');
                sessionStorage.removeItem('td_record_wave');
                showAuth();
            }
        });

        checkSession();
    }
}
