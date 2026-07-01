import { MenuController } from "../menu";
import { AvatarCropper } from "./profile/cropper";
import { AuthHandler } from "./profile/auth";
import { DashboardHandler } from "./profile/dashboard";

export class ProfileController {
  private main: MenuController;
  private cropper: AvatarCropper;
  private auth: AuthHandler;
  private dashboard: DashboardHandler;

  constructor(main: MenuController) {
    this.main = main;
    this.cropper = new AvatarCropper();
    this.dashboard = new DashboardHandler(this.main);
    this.auth = new AuthHandler(
      this.main,
      (user) => this.dashboard.showDashboard(user),
      () => this.dashboard.showAuth()
    );

    this.initProfile();
  }

  private initProfile(): void {
    const topProfileWidget = document.getElementById("top-profile-widget");
    topProfileWidget?.addEventListener("click", () => {
      this.main.navigation.switchTab("profile");
    });

    // Initialize sub-controllers
    this.cropper.init();
    this.dashboard.init();
    this.auth.init();

    // Perform initial session check
    this.auth.checkSession();
  }
}
