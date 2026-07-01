import { MenuController } from "../../menu";
import { state } from "../../../core/state";

export class DashboardHandler {
  private main: MenuController;

  constructor(main: MenuController) {
    this.main = main;
  }

  public init(): void {
    const editUsernameBtn = document.getElementById("edit-username-btn");
    const usernameWrapper = document.getElementById("profile-username-wrapper");
    const usernameEditContainer = document.getElementById("username-edit-container");
    const usernameEditInput = document.getElementById(
      "username-edit-input"
    ) as HTMLInputElement | null;
    const saveUsernameBtn = document.getElementById("save-username-btn");
    const cancelUsernameBtn = document.getElementById("cancel-username-btn");
    const usernameEditError = document.getElementById("username-edit-error");

    editUsernameBtn?.addEventListener("click", () => {
      const currentUsername = document.getElementById("dashboard-username")?.textContent || "";
      if (usernameEditInput) {
        usernameEditInput.value = currentUsername;
      }
      if (usernameWrapper) {
        usernameWrapper.style.display = "none";
        usernameWrapper.classList.add("hidden");
      }
      if (usernameEditContainer) {
        usernameEditContainer.style.display = "flex";
        usernameEditContainer.classList.remove("hidden");
      }
      if (usernameEditError) {
        usernameEditError.style.display = "none";
        usernameEditError.classList.add("hidden");
      }
    });

    const closeUsernameEdit = () => {
      if (usernameWrapper) {
        usernameWrapper.style.display = "flex";
        usernameWrapper.classList.remove("hidden");
      }
      if (usernameEditContainer) {
        usernameEditContainer.style.display = "none";
        usernameEditContainer.classList.add("hidden");
      }
    };

    cancelUsernameBtn?.addEventListener("click", closeUsernameEdit);

    saveUsernameBtn?.addEventListener("click", async () => {
      const newUsername = usernameEditInput?.value.trim();
      if (!newUsername) {
        if (usernameEditError) {
          usernameEditError.textContent = "Name darf nicht leer sein.";
          usernameEditError.style.display = "block";
          usernameEditError.classList.remove("hidden");
        }
        return;
      }
      if (
        newUsername.length < 4 ||
        newUsername.length > 20 ||
        !/^[a-zA-Z0-9_-]+$/.test(newUsername)
      ) {
        if (usernameEditError) {
          usernameEditError.textContent =
            "Name muss zwischen 4 und 20 Zeichen lang sein und darf nur Buchstaben, Zahlen, _ und - enthalten.";
          usernameEditError.style.display = "block";
          usernameEditError.classList.remove("hidden");
        }
        return;
      }

      try {
        const response = await fetch(`/api/user/profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: newUsername }),
        });
        const result = await response.json();
        if (response.ok && result.success) {
          const userEl = document.getElementById("dashboard-username");
          const topName = document.getElementById("top-profile-name");
          if (userEl) userEl.textContent = newUsername;
          if (topName) topName.textContent = newUsername;
          this.main.currentUsername = newUsername;
          closeUsernameEdit();
        } else {
          if (usernameEditError) {
            usernameEditError.textContent = result.error || "Fehler beim Ändern des Namens.";
            usernameEditError.style.display = "block";
            usernameEditError.classList.remove("hidden");
          }
        }
      } catch (err) {
        if (usernameEditError) {
          usernameEditError.textContent = "Verbindungsfehler zum Server.";
          usernameEditError.style.display = "block";
          usernameEditError.classList.remove("hidden");
        }
      }
    });
  }

  public showAuth(): void {
    const authSection = document.getElementById("profile-auth-section");
    const dashboardSection = document.getElementById("profile-dashboard-section");
    const topProfileWidget = document.getElementById("top-profile-widget");

    sessionStorage.setItem("td_logged_in", "false");
    state.isGuest = true;
    state.recordWave = parseInt(sessionStorage.getItem("td_record_wave") || "0");
    this.main.currentUsername = null;
    if (authSection) {
      authSection.style.display = "block";
      authSection.classList.remove("hidden");
    }
    if (dashboardSection) {
      dashboardSection.style.display = "none";
      dashboardSection.classList.add("hidden");
    }

    const topAvatar = document.getElementById("top-profile-avatar");
    const topName = document.getElementById("top-profile-name");
    if (topAvatar) topAvatar.innerHTML = "👤";
    if (topName) topName.textContent = "Gast";
    topProfileWidget?.classList.add("tooltip-container");

    this.main.lexicon.initLexicon();
  }

  public async showDashboard(user: {
    username: string;
    avatar?: string | null;
    created_at?: string | Date | null;
  }): Promise<void> {
    const authSection = document.getElementById("profile-auth-section");
    const dashboardSection = document.getElementById("profile-dashboard-section");
    const topProfileWidget = document.getElementById("top-profile-widget");

    sessionStorage.setItem("td_logged_in", "true");
    state.isGuest = false;
    state.recordWave = parseInt(localStorage.getItem("td_record_wave") || "0");
    this.main.currentUsername = user.username;
    if (authSection) {
      authSection.style.display = "none";
      authSection.classList.add("hidden");
    }
    if (dashboardSection) {
      dashboardSection.style.display = "grid";
      dashboardSection.classList.remove("hidden");
    }

    const userEl = document.getElementById("dashboard-username");
    if (userEl) userEl.textContent = user.username;

    const avatarDisplay = document.getElementById("profile-avatar-display");
    const topAvatar = document.getElementById("top-profile-avatar");

    if (avatarDisplay) {
      avatarDisplay.replaceChildren();
      if (user.avatar) {
        const img = document.createElement("img");
        img.src = user.avatar;
        img.alt = "Profile Picture";
        avatarDisplay.appendChild(img);
      } else {
        avatarDisplay.textContent = "👤";
      }
    }

    if (topAvatar) {
      topAvatar.replaceChildren();
      if (user.avatar) {
        const img = document.createElement("img");
        img.src = user.avatar;
        img.alt = "Profile";
        topAvatar.appendChild(img);
      } else {
        topAvatar.textContent = "👤";
      }
    }

    const topName = document.getElementById("top-profile-name");
    if (topName) topName.textContent = user.username;
    topProfileWidget?.classList.remove("tooltip-container");

    const joinedEl = document.getElementById("dashboard-joined");
    if (joinedEl) {
      if (user.created_at) {
        const date = new Date(user.created_at);
        const formattedDate = date.toLocaleDateString("de-DE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        joinedEl.textContent = `Mitglied seit: ${formattedDate}`;
      } else {
        joinedEl.textContent = "Mitglied seit: --.--.----";
      }
    }

    this.main.lexicon.initLexicon();

    try {
      const response = await fetch(`/api/user/progress`);
      if (response.ok) {
        const data = await response.json();
        const progress = data.progress;
        if (progress) {
          const highestWaveEl = document.getElementById("dashboard-highest-wave");
          if (highestWaveEl) highestWaveEl.textContent = String(progress.highest_wave || 0);

          if (progress.highest_wave) {
            localStorage.setItem("td_record_wave", String(progress.highest_wave));
            state.recordWave = progress.highest_wave;
          }

          this.updateAchievementsUI(
            progress.unlocked_achievements || [],
            progress.highest_wave || 0
          );
          this.updateSkinsUI(
            progress.unlocked_skins || ["default"],
            progress.selected_skin || "default"
          );

          this.main.lexicon.initLexicon();
        }
      }
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  }

  public updateAchievementsUI(unlockedAchievements: string[], highestWave: number): void {
    const achievements = [
      { id: "ach-first-wave", reqWave: 5 },
      { id: "ach-wave-20", reqWave: 20 },
      { id: "ach-wave-50", reqWave: 50 },
      { id: "ach-gold-1000", reqWave: null },
      { id: "ach-towers-15", reqWave: null },
      { id: "ach-kill-boss", reqWave: 21 },
      { id: "ach-no-lives-lost", reqWave: null },
      { id: "ach-tesla-5", reqWave: null },
    ];

    achievements.forEach((ach) => {
      const item = document.getElementById(ach.id);
      if (item) {
        const statusEl = item.querySelector(".achievement-status");
        const unlockedByDb = unlockedAchievements.includes(ach.id);
        const unlockedByWave = ach.reqWave !== null && highestWave >= ach.reqWave;

        if (unlockedByDb || unlockedByWave) {
          item.classList.add("unlocked");
          if (statusEl) statusEl.textContent = "Freigeschaltet";

          if (unlockedByWave && !unlockedByDb) {
            fetch(`/api/user/unlock-achievement`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ achievementId: ach.id }),
            }).catch(() => {});
          }
        } else {
          item.classList.remove("unlocked");
          if (statusEl) statusEl.textContent = "Gesperrt";
        }
      }
    });
  }

  public updateSkinsUI(unlockedSkins: string[], selectedSkin: string): void {
    const skinCards = document.querySelectorAll(".skin-card");
    skinCards.forEach((card) => {
      const htmlCard = card as HTMLElement;
      const skinKey = htmlCard.dataset.skin;
      if (!skinKey) return;

      const statusEl = htmlCard.querySelector(".skin-status");

      htmlCard.classList.remove("selected", "skin-locked");

      const isUnlocked = unlockedSkins.includes(skinKey);
      if (isUnlocked) {
        if (skinKey === selectedSkin) {
          htmlCard.classList.add("selected");
          if (statusEl) statusEl.textContent = "Ausgerüstet";
        } else {
          if (statusEl) statusEl.textContent = "Auswählen";
        }

        htmlCard.onclick = async () => {
          try {
            const response = await fetch(`/api/user/progress`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ selected_skin: skinKey }),
            });
            if (response.ok) {
              this.updateSkinsUI(unlockedSkins, skinKey);
            }
          } catch (err) {
            console.error("Error equipping skin:", err);
          }
        };
      } else {
        htmlCard.classList.add("skin-locked");
        if (statusEl) statusEl.textContent = "Gesperrt";
        htmlCard.onclick = null;
      }
    });
  }
}
