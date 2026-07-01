import { MenuController } from "../../menu";

export class AuthHandler {
  private main: MenuController;
  private onLoginSuccess: (user: any) => void;
  private onLogoutSuccess: () => void;

  constructor(
    main: MenuController,
    onLoginSuccess: (user: any) => void,
    onLogoutSuccess: () => void
  ) {
    this.main = main;
    this.onLoginSuccess = onLoginSuccess;
    this.onLogoutSuccess = onLogoutSuccess;
  }

  public init(): void {
    const loginForm = document.getElementById("auth-login-form");
    const registerForm = document.getElementById("auth-register-form");
    const gotoRegister = document.getElementById("goto-register");
    const gotoLogin = document.getElementById("goto-login");

    const loginUser = document.getElementById("login-username") as HTMLInputElement | null;
    const loginPass = document.getElementById("login-password") as HTMLInputElement | null;
    const loginBtn = document.getElementById("login-submit-btn");
    const loginError = document.getElementById("login-error-msg");
    const loginRemember = document.getElementById("login-remember") as HTMLInputElement | null;

    const regUser = document.getElementById("register-username") as HTMLInputElement | null;
    const regPass = document.getElementById("register-password") as HTMLInputElement | null;
    const regPassConfirm = document.getElementById(
      "register-password-confirm"
    ) as HTMLInputElement | null;
    const regBtn = document.getElementById("register-submit-btn");
    const regError = document.getElementById("register-error-msg");
    const regSuccess = document.getElementById("register-success-msg");

    const logoutBtn = document.getElementById("logout-btn");

    gotoRegister?.addEventListener("click", () => {
      if (loginForm) {
        loginForm.style.display = "none";
        loginForm.classList.add("hidden");
      }
      if (registerForm) {
        registerForm.style.display = "block";
        registerForm.classList.remove("hidden");
      }
      if (loginError) loginError.style.display = "none";
    });

    gotoLogin?.addEventListener("click", () => {
      if (registerForm) {
        registerForm.style.display = "none";
        registerForm.classList.add("hidden");
      }
      if (loginForm) {
        loginForm.style.display = "block";
        loginForm.classList.remove("hidden");
      }
      if (regError) regError.style.display = "none";
      if (regSuccess) regSuccess.style.display = "none";
    });

    const handleLoginEnter = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        loginBtn?.click();
      }
    };
    loginUser?.addEventListener("keydown", handleLoginEnter);
    loginPass?.addEventListener("keydown", handleLoginEnter);

    loginBtn?.addEventListener("click", async () => {
      const username = loginUser?.value.trim();
      const password = loginPass?.value;
      const remember = loginRemember?.checked || false;

      if (!username || !password) {
        if (loginError) {
          loginError.textContent = "Bitte fülle alle Felder aus.";
          loginError.style.display = "block";
        }
        return;
      }

      try {
        const response = await fetch(`/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, remember }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          if (loginUser) loginUser.value = "";
          if (loginPass) loginPass.value = "";
          if (loginError) loginError.style.display = "none";
          this.onLoginSuccess(data.user);
        } else {
          if (loginError) {
            loginError.textContent = data.error || "Fehler beim Einloggen.";
            loginError.style.display = "block";
          }
        }
      } catch (err) {
        if (loginError) {
          loginError.textContent = "Verbindungsfehler zum Server.";
          loginError.style.display = "block";
        }
      }
    });

    regBtn?.addEventListener("click", async () => {
      const username = regUser?.value.trim();
      const password = regPass?.value;
      const passwordConfirm = regPassConfirm?.value;

      if (!username || !password || !passwordConfirm) {
        if (regError) {
          regError.textContent = "Bitte fülle alle Felder aus.";
          regError.style.display = "block";
        }
        return;
      }

      if (password !== passwordConfirm) {
        if (regError) {
          regError.textContent = "Die Passwörter stimmen nicht überein.";
          regError.style.display = "block";
        }
        return;
      }

      try {
        const response = await fetch(`/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        const data = await response.json();
        if (response.ok && data.success) {
          localStorage.removeItem("td_discovered_enemies");
          localStorage.removeItem("td_record_wave");
          sessionStorage.removeItem("td_discovered_enemies");
          sessionStorage.removeItem("td_record_wave");
          this.main.lexicon.initLexicon();

          if (regUser) regUser.value = "";
          if (regPass) regPass.value = "";
          if (regPassConfirm) regPassConfirm.value = "";
          if (regError) regError.style.display = "none";
          if (regSuccess) {
            regSuccess.textContent = "Registrierung erfolgreich! Bitte logge dich ein.";
            regSuccess.style.display = "block";
          }
          setTimeout(() => {
            gotoLogin?.click();
          }, 1500);
        } else {
          if (regError) {
            regError.textContent = data.error || "Fehler bei der Registrierung.";
            regError.style.display = "block";
          }
        }
      } catch (err) {
        if (regError) {
          regError.textContent = "Verbindungsfehler zum Server.";
          regError.style.display = "block";
        }
      }
    });

    logoutBtn?.addEventListener("click", async () => {
      try {
        const response = await fetch(`/api/auth/logout`, { method: "POST" });
        if (response.ok) {
          sessionStorage.removeItem("td_discovered_enemies");
          sessionStorage.removeItem("td_record_wave");
          this.onLogoutSuccess();
        }
      } catch (err) {
        console.error("Logout error:", err);
        sessionStorage.removeItem("td_discovered_enemies");
        sessionStorage.removeItem("td_record_wave");
        this.onLogoutSuccess();
      }
    });
  }

  public async checkSession(): Promise<void> {
    try {
      const response = await fetch(`/api/auth/me`);
      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this.onLoginSuccess(data.user);
        } else {
          this.onLogoutSuccess();
        }
      } else {
        this.onLogoutSuccess();
      }
    } catch (err) {
      console.warn("Session check failed:", err);
      this.onLogoutSuccess();
    }
  }
}
