export class ChangelogController {
  private changelogData: any[] = [];

  constructor() {
    this.initChangelog();
  }

  private async initChangelog(): Promise<void> {
    const toggleBtn = document.getElementById("changelog-toggle");
    const panel = document.getElementById("changelog-panel");
    const icon = toggleBtn?.querySelector(".toggle-icon") as HTMLElement | null;
    const pulseDot = document.getElementById("changelog-pulse");

    if (!toggleBtn || !panel || !icon) {
      console.warn("Changelog DOM elements not found");
      return;
    }

    const savedCollapsed = localStorage.getItem("td_changelog_collapsed");
    const isMobileOrTablet = window.innerWidth < 1400;
    const shouldCollapse = savedCollapsed !== null ? savedCollapsed === "true" : isMobileOrTablet;

    if (shouldCollapse) {
      panel.classList.add("collapsed");
      icon.innerText = "◀";
    } else {
      panel.classList.remove("collapsed");
      icon.innerText = "▶";
    }

    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isCurrentlyCollapsed = panel.classList.contains("collapsed");
      if (isCurrentlyCollapsed) {
        panel.classList.remove("collapsed");
        icon.innerText = "▶";
        localStorage.setItem("td_changelog_collapsed", "false");

        const firstActualVersion = this.changelogData.find((v) => v.version);
        if (firstActualVersion) {
          const latestVersion = firstActualVersion.version;
          localStorage.setItem("td_changelog_last_read", latestVersion);
        }
        if (pulseDot) {
          pulseDot.classList.add("hidden");
        }
      } else {
        panel.classList.add("collapsed");
        icon.innerText = "◀";
        localStorage.setItem("td_changelog_collapsed", "true");
      }
    });

    try {
      const response = await fetch("assets/changelog.json", { cache: "no-cache" });
      if (response.ok) {
        this.changelogData = await response.json();
        this.renderChangelog();

        if (this.changelogData && this.changelogData.length > 0) {
          const firstActualVersion = this.changelogData.find((v) => v.version);
          if (firstActualVersion) {
            const latestVersion = firstActualVersion.version;
            const lastReadVersion = localStorage.getItem("td_changelog_last_read");
            const isCurrentlyOpen = !panel.classList.contains("collapsed");

            if (isCurrentlyOpen) {
              localStorage.setItem("td_changelog_last_read", latestVersion);
            } else if (lastReadVersion !== latestVersion) {
              if (pulseDot) {
                pulseDot.classList.remove("hidden");
              }
            }
          }
        }
      } else {
        this.showChangelogError();
      }
    } catch (err) {
      console.warn("Changelog fetch failed:", err);
      this.showChangelogError();
    }
  }

  private showChangelogError(): void {
    const listContainer = document.getElementById("changelog-list");
    if (listContainer) {
      listContainer.innerHTML =
        '<div class="changelog-empty" style="color: var(--bomb-red);">Fehler beim Laden des Update-Logs.</div>';
    }
  }

  private renderChangelog(): void {
    const listContainer = document.getElementById("changelog-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";

    if (!this.changelogData || this.changelogData.length === 0) {
      listContainer.innerHTML = '<div class="changelog-empty">Keine Einträge vorhanden.</div>';
      return;
    }

    let renderedCount = 0;

    this.changelogData.forEach((versionEntry) => {
      if (versionEntry.isComment || !versionEntry.version || !versionEntry.changes) {
        return;
      }

      renderedCount++;

      const card = document.createElement("div");
      card.className = "version-card";
      if (renderedCount === 1) {
        card.classList.add("expanded");
      }

      const header = document.createElement("div");
      header.className = "version-header-click";

      header.innerHTML = `
                <div class="version-meta">
                    <span class="version-num">${versionEntry.version}</span>
                    <span class="version-date">${versionEntry.date}</span>
                </div>
                <span class="version-toggle-icon">▶</span>
            `;

      const details = document.createElement("div");
      details.className = "version-details";

      versionEntry.changes.forEach((change: any) => {
        const item = document.createElement("div");
        item.className = "change-item";

        let badgeClass = "feature";
        let badgeLabel = "NEW";
        if (change.type === "balance") {
          badgeClass = "balance";
          badgeLabel = "BAL";
        }
        if (change.type === "fix") {
          badgeClass = "fix";
          badgeLabel = "FIX";
        }
        if (change.type === "perf") {
          badgeClass = "perf";
          badgeLabel = "PERF";
        }

        item.innerHTML = `
                    <span class="change-badge ${badgeClass}">${badgeLabel}</span>
                    <p class="change-desc">${change.desc}</p>
                `;
        details.appendChild(item);
      });

      header.addEventListener("click", () => {
        const isExpanded = card.classList.contains("expanded");
        if (isExpanded) {
          card.classList.remove("expanded");
        } else {
          card.classList.add("expanded");
        }
      });

      card.appendChild(header);
      card.appendChild(details);
      listContainer.appendChild(card);
    });

    if (renderedCount === 0) {
      listContainer.innerHTML = '<div class="changelog-empty">Keine Einträge vorhanden.</div>';
    }
  }
}
