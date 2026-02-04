(function () {
    "use strict";
    const API = "/Feedback/_api/plans/team";
    const plansTeamList = document.getElementById("plansTeamList");
    const plansTeamEmpty = document.getElementById("plansTeamEmpty");
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
        return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function renderPlan(p) {
        const target = p.targetUserFullName ? " → " + escapeHtml(p.targetUserFullName) : "";
        const goals = (p.goals || []).map(g => `<li class="small">${escapeHtml(g.description)}${g.concludedAt ? " ✓" : ""}</li>`).join("");
        return `<div class="border-bottom pb-2 mb-2">
            <div class="fw-semibold">${escapeHtml(p.title)}</div>
            <div class="text-muted small">${escapeHtml(p.ownerUserFullName || "")}${target} · ${formatDate(p.updatedAtUtc)}</div>
            ${goals ? "<ul class=\"mb-0 mt-1\">" + goals + "</ul>" : ""}
        </div>`;
    }

    async function load() {
        if (plansTeamList) plansTeamList.innerHTML = "";
        if (plansTeamEmpty) plansTeamEmpty.classList.add("d-none");
        try {
            const data = await apiGet(API + "?page=1&pageSize=50");
            const items = data.items || [];
            items.forEach(p => { if (plansTeamList) plansTeamList.insertAdjacentHTML("beforeend", renderPlan(p)); });
            if (items.length === 0 && plansTeamEmpty) plansTeamEmpty.classList.remove("d-none");
        } catch (e) {
            console.error(e);
            if (plansTeamList) plansTeamList.innerHTML = "<div class=\"text-danger\">Erro ao carregar. Verifique permissão.</div>";
        }
    }

    if (btnRefresh) btnRefresh.addEventListener("click", load);
    load();
})();
