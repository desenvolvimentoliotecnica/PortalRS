(function () {
    "use strict";

    const API_HISTORY = "/Feedback/_api/gamification/history";

    const root = document.getElementById("gamificationHistoryRoot");
    const USE_MOCK = (root?.dataset?.useMock ?? "true") === "true";
    const GOAL = Number(root?.dataset?.goal ?? "5000") || 5000;

    const gridEl = document.getElementById("historyGrid");
    const emptyEl = document.getElementById("historyEmpty");
    const btnRefresh = document.getElementById("btnRefreshHistory");

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

    function initials(name) {
        return (name || "")
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map(p => p[0])
            .join("")
            .toUpperCase();
    }

    function fmtPoints(n) {
        const v = typeof n === "number" ? n : 0;
        return v.toLocaleString("pt-BR");
    }

    function monthTitle(year, month) {
        const d = new Date(Date.UTC(year, Math.max(0, month - 1), 1));
        const m = d.toLocaleDateString("pt-BR", { month: "long" });
        const cap = m.charAt(0).toUpperCase() + m.slice(1);
        return `Ranking de ${cap} ${year}`;
    }

    function clamp01(x) {
        if (typeof x !== "number" || Number.isNaN(x)) return 0;
        return Math.max(0, Math.min(1, x));
    }

    function renderEntry(e) {
        const pct = Math.round(clamp01((e.points || 0) / GOAL) * 100);
        const avatar = e.avatarUrl
            ? `<img src="${e.avatarUrl}" alt="${escapeHtml(e.fullName)}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;">`
            : `<div class="bg-light d-flex align-items-center justify-content-center" style="width:34px;height:34px;border-radius:50%;font-weight:800;">
                    ${escapeHtml(initials(e.fullName))}
               </div>`;

        return `
            <div class="d-flex align-items-center justify-content-between gap-2 py-2 border-bottom">
                <div class="d-flex align-items-center gap-2 flex-grow-1">
                    <div class="badge bg-primary rounded-pill" style="width:26px">${e.rank}</div>
                    ${avatar}
                    <div class="flex-grow-1">
                        <div class="fw-semibold small">${escapeHtml(e.fullName)}</div>
                        <div class="progress" style="height:8px">
                            <div class="progress-bar bg-success" style="width:${pct}%"></div>
                        </div>
                    </div>
                </div>
                <div class="text-end small text-muted" style="min-width:72px">
                    <i class="bi bi-coin me-1"></i>${fmtPoints(e.points)}
                </div>
            </div>`;
    }

    function renderCard(item) {
        return `
            <div class="col-12 col-md-6 col-xl-4">
                <div class="card-soft overflow-hidden h-100">
                    <div class="p-3 text-center text-white" style="background:#49b35c">
                        <div class="fw-bold">${escapeHtml(monthTitle(item.year, item.month))}</div>
                        <div class="small opacity-75">Meta ${GOAL.toLocaleString("pt-BR")} Feedzcoin</div>
                    </div>
                    <div class="p-3">
                        ${(item.top3 || []).map(renderEntry).join("")}
                    </div>
                </div>
            </div>`;
    }

    function render(items) {
        if (!gridEl) return;
        gridEl.innerHTML = (items || []).map(renderCard).join("");
        if (emptyEl) emptyEl.classList.toggle("d-none", (items || []).length !== 0);
    }

    function buildMock() {
        return [
            {
                year: 2026,
                month: 1,
                top3: [
                    { rank: 1, fullName: "JEFFERSON FERRE", points: 2800 },
                    { rank: 2, fullName: "Telma Lígia da", points: 1600 },
                    { rank: 3, fullName: "PAULO CEZAR DOS", points: 1400 },
                ]
            },
            {
                year: 2025,
                month: 12,
                top3: [
                    { rank: 1, fullName: "PAULO CEZAR DOS", points: 3500 },
                    { rank: 2, fullName: "JEFFERSON FERRE", points: 2600 },
                    { rank: 3, fullName: "JAIRO DIAS GONC", points: 2100 },
                ]
            },
            {
                year: 2025,
                month: 11,
                top3: [
                    { rank: 1, fullName: "JEFFERSON FERRE", points: 4400 },
                    { rank: 2, fullName: "PAULO CEZAR DOS", points: 2200 },
                    { rank: 3, fullName: "JAIRO DIAS GONC", points: 2200 },
                ]
            },
        ];
    }

    async function loadFromApi() {
        const url = API_HISTORY + `?months=12&goal=${encodeURIComponent(String(GOAL))}`;
        const data = await apiGet(url);
        const items = data?.items || [];
        return items.map(x => ({
            year: x.year,
            month: x.month,
            top3: (x.top3 || []).map((e) => ({
                rank: e.rank,
                fullName: e.fullName,
                points: Number(e.points) || 0,
                avatarUrl: e.avatarUrl || null,
            })),
        }));
    }

    async function load() {
        try {
            const items = USE_MOCK ? buildMock() : await loadFromApi();
            render(items);
        } catch (e) {
            console.error("history load:", e);
            render(buildMock());
        }
    }

    if (btnRefresh) btnRefresh.addEventListener("click", load);
    load();
})();

