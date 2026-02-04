(function () {
    "use strict";
    const API_LEADERBOARD = "/Feedback/_api/gamification/leaderboard";
    const API_MY_BALANCE = "/Feedback/_api/gamification/my-balance";
    const myBalanceEl = document.getElementById("myBalance");
    const myBalanceUpdatedEl = document.getElementById("myBalanceUpdated");
    const leaderboardList = document.getElementById("leaderboardList");
    const leaderboardEmpty = document.getElementById("leaderboardEmpty");
    const btnRefresh = document.getElementById("btnRefresh");

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    function escapeHtml(s) {
        if (!s) return "";
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function formatBalance(n) {
        if (typeof n !== "number") return "0";
        return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }

    async function loadMyBalance() {
        try {
            const data = await apiGet(API_MY_BALANCE);
            if (myBalanceEl) myBalanceEl.textContent = formatBalance(data.balance) + " RENDERCOINZ";
            if (myBalanceUpdatedEl) {
                myBalanceUpdatedEl.textContent = data.updatedAtUtc
                    ? "Atualizado em " + formatDate(data.updatedAtUtc)
                    : "";
            }
        } catch (e) {
            console.error(e);
            if (myBalanceEl) myBalanceEl.textContent = "—";
            if (myBalanceUpdatedEl) myBalanceUpdatedEl.textContent = "";
        }
    }

    function renderLeaderboardEntry(entry) {
        const medal = entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] + " " : "";
        return `<div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div>
                <span class="fw-semibold">${medal}#${entry.rank}</span>
                <span class="ms-2">${escapeHtml(entry.fullName)}</span>
            </div>
            <div class="text-primary fw-semibold">${formatBalance(entry.balance)} RENDERCOINZ</div>
        </div>`;
    }

    async function loadLeaderboard() {
        if (leaderboardList) leaderboardList.innerHTML = "";
        if (leaderboardEmpty) leaderboardEmpty.classList.add("d-none");
        try {
            const data = await apiGet(API_LEADERBOARD + "?page=1&pageSize=50");
            const items = data.items || [];
            items.forEach(entry => {
                if (leaderboardList) leaderboardList.insertAdjacentHTML("beforeend", renderLeaderboardEntry(entry));
            });
            if (items.length === 0 && leaderboardEmpty) leaderboardEmpty.classList.remove("d-none");
        } catch (e) {
            console.error(e);
            if (leaderboardList) leaderboardList.innerHTML = "<div class=\"text-danger\">Erro ao carregar ranking.</div>";
        }
    }

    async function load() {
        await Promise.all([loadMyBalance(), loadLeaderboard()]);
    }

    if (btnRefresh) btnRefresh.addEventListener("click", load);
    load();
})();
