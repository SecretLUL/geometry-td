import { MenuController } from "../menu";

export class NavigationController {
  private main: MenuController;
  private tabs: NodeListOf<HTMLElement>;
  private contents: NodeListOf<HTMLElement>;

  constructor(main: MenuController) {
    this.main = main;
    this.tabs = document.querySelectorAll(".portal-tab");
    this.contents = document.querySelectorAll(".tab-content-wrapper");
    this.initTabs();
  }

  public positionTabIndicator(): void {
    const activeTab = document.querySelector(".portal-tab.active") as HTMLElement | null;
    const indicator = document.querySelector(".portal-tab-indicator") as HTMLElement | null;
    if (activeTab && indicator) {
      indicator.style.left = `${activeTab.offsetLeft}px`;
      indicator.style.width = `${activeTab.offsetWidth}px`;
    }
  }

  private initTabs(): void {
    const firstActive = Array.from(this.contents).find((c) => !c.classList.contains("hidden"));
    if (firstActive) {
      firstActive.classList.add("active-tab-content");
    }

    setTimeout(() => this.positionTabIndicator(), 60);

    this.tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        if (target) {
          this.switchTab(target);
        }
      });
    });

    window.addEventListener("resize", () => this.positionTabIndicator());
  }

  public switchTab(tabId: string): void {
    const currentActive = Array.from(this.contents).find(
      (c) => !c.classList.contains("hidden")
    ) as HTMLElement;
    const targetActive = document.getElementById(`tab-${tabId}`) as HTMLElement;

    if (!targetActive || currentActive === targetActive) return;

    this.tabs.forEach((t) => t.classList.remove("active"));
    const activeTab = document.querySelector(`[data-tab="${tabId}"]`) as HTMLElement | null;
    if (activeTab) {
      activeTab.classList.add("active");
      this.positionTabIndicator();
    }

    if (currentActive) {
      currentActive.classList.remove("active-tab-content");

      setTimeout(() => {
        currentActive.classList.add("hidden");
        targetActive.classList.remove("hidden");
        void targetActive.offsetWidth;
        targetActive.classList.add("active-tab-content");

        if (tabId === "lexicon") {
          this.main.lexicon.initLexicon();
        } else if (tabId === "leaderboard") {
          this.main.leaderboard.loadLeaderboard();
        }
      }, 250);
    } else {
      targetActive.classList.remove("hidden");
      void targetActive.offsetWidth;
      targetActive.classList.add("active-tab-content");
      if (tabId === "lexicon") {
        this.main.lexicon.initLexicon();
      } else if (tabId === "leaderboard") {
        this.main.leaderboard.loadLeaderboard();
      }
    }
  }
}
