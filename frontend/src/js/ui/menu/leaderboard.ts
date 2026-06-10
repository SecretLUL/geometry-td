import { MenuController } from "../menu";

export class LeaderboardController {
  private main: MenuController;

  constructor(main: MenuController) {
    this.main = main;
    this.initLeaderboard();
  }

  private initLeaderboard(): void {
    const refreshBtn = document.getElementById("refresh-leaderboard-btn");
    refreshBtn?.addEventListener("click", () => {
      this.loadLeaderboard();
    });
  }

  public async loadLeaderboard(): Promise<void> {
    const listContainer = document.getElementById("leaderboard-list");
    if (!listContainer) return;

    listContainer.innerHTML = `
            <tr class="leaderboard-loading-row">
                <td colspan="5">Lade Bestenliste...</td>
            </tr>
        `;

    try {
      const baseUrl = "";
      const response = await fetch(`${baseUrl}/api/leaderboard`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Server returned " + response.status);
      }
      const data = await response.json();
      const list = data.leaderboard || [];

      listContainer.innerHTML = "";
      if (list.length === 0) {
        listContainer.innerHTML = `
                    <tr>
                        <td colspan="5" style="text-align: center; font-style: italic; color: #555566; padding: 30px 0;">
                            Keine Einträge vorhanden.
                        </td>
                    </tr>
                `;
        return;
      }

      list.forEach((entry: any, index: number) => {
        const rank = index + 1;
        const tr = document.createElement("tr");

        if (this.main.currentUsername && entry.username === this.main.currentUsername) {
          tr.classList.add("current-user-row");
        }

        const tdRank = document.createElement("td");
        tdRank.className = "col-rank";

        let badgeClass = "";
        if (rank === 1) badgeClass = "rank-1";
        else if (rank === 2) badgeClass = "rank-2";
        else if (rank === 3) badgeClass = "rank-3";

        const badge = document.createElement("span");
        badge.className = `rank-badge ${badgeClass}`;
        badge.textContent = String(rank);
        tdRank.appendChild(badge);
        tr.appendChild(tdRank);

        const tdUser = document.createElement("td");
        const userCellDiv = document.createElement("div");
        userCellDiv.className = "leaderboard-user-cell";

        const avatarDiv = document.createElement("div");
        avatarDiv.className = "leaderboard-avatar";

        if (entry.avatar) {
          const img = document.createElement("img");
          img.src = entry.avatar;
          img.alt = "Avatar";
          avatarDiv.appendChild(img);
        } else {
          avatarDiv.textContent = "👤";
        }

        const nameSpan = document.createElement("span");
        nameSpan.className = "leaderboard-username";
        nameSpan.textContent = entry.username;

        userCellDiv.appendChild(avatarDiv);
        userCellDiv.appendChild(nameSpan);
        tdUser.appendChild(userCellDiv);
        tr.appendChild(tdUser);

        const tdMap = document.createElement("td");
        tdMap.className = "col-map";
        tdMap.textContent = entry.highest_wave_map || "Unbekannt";
        tr.appendChild(tdMap);

        const tdWave = document.createElement("td");
        tdWave.className = "col-wave";

        const waveVal = document.createElement("span");
        waveVal.className = "leaderboard-wave-val";
        waveVal.textContent = `Welle ${entry.highest_wave}`;
        tdWave.appendChild(waveVal);
        tr.appendChild(tdWave);

        const tdDate = document.createElement("td");
        tdDate.className = "col-date";

        let formattedDate = "--.--.----";
        if (entry.updated_at) {
          const date = new Date(entry.updated_at);
          formattedDate = date.toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
        }
        tdDate.textContent = formattedDate;
        tr.appendChild(tdDate);

        listContainer.appendChild(tr);
      });
    } catch (err) {
      console.error("Error fetching leaderboard:", err);
      listContainer.innerHTML = `
                <tr class="leaderboard-error-row">
                    <td colspan="5">Fehler beim Laden der Bestenliste.</td>
                </tr>
            `;
    }
  }
}
