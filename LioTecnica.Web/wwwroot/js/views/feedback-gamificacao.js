(function () {
    "use strict";

    const API_LEADERBOARD = "/Feedback/_api/gamification/leaderboard";
    const API_MY_BALANCE = "/Feedback/_api/gamification/my-balance";

    const root = document.getElementById("gamificationRankingRoot");
    const USE_MOCK = (root?.dataset?.useMock ?? "true") === "true";

    const rulesLeftEl = document.getElementById("rulesLeft");
    const rulesRightEl = document.getElementById("rulesRight");
    const totalEl = document.getElementById("rankingTotal");
    const searchEl = document.getElementById("rankingSearch");
    const gridEl = document.getElementById("rankingGrid");
    const emptyEl = document.getElementById("rankingEmpty");

    const tabAll = document.getElementById("tabAll");
    const tabColab = document.getElementById("tabColab");
    const tabGestor = document.getElementById("tabGestor");

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
        return v.toLocaleString("pt-BR") + " Feedzcoin";
    }

    const MOCK_RULES_LEFT = [
        { label: "Acesso diário à plataforma", points: 100 },
        { label: "Alterar Avatar/Foto do perfil (pontua uma única vez)", points: 500 },
        { label: "Responder Pesquisa de Engajamento", points: 10 },
        { label: "Responder Pesquisa de Satisfação", points: 500 },
        { label: "Responder Termômetro de Humor", points: 100 },
    ];

    const MOCK_RULES_RIGHT = [
        { label: "Realizar checkin em um Objetivo", points: 100 },
        { label: "Celebrar", points: 200 },
        { label: "Enviar Feedback", points: 50 },
        { label: "Responder Pesquisa Rápida", points: 500 },
        { label: "Responder uma Super Pesquisa", points: 500 },
    ];

    const MOCK_PEOPLE = [
        { id: "1", name: "PAULO SANTOS", roleLine1: "1-OPERACIONAL SENSORIAL", roleLine2: "CONTR. DE QUALIDADE • 01.11.005.001", points: 700, type: "colaborador", avatarUrl: "" },
        { id: "2", name: "JEFFERSON LIMA", roleLine1: "1-OPERACIONAL CONTROLE", roleLine2: "DE QUALIDADE • 2º T • 01.11.003.006", points: 400, type: "colaborador", avatarUrl: "" },
        { id: "3", name: "EVERTON CONCEIÇÃO", roleLine1: "1-OPERACIONAL ENGENHARIA", roleLine2: "DE PROCESSOS • 01.11.036.005", points: 400, type: "colaborador", avatarUrl: "" },
        { id: "4", name: "ANDRE FILHO", roleLine1: "1-OPERACIONAL ALMOXARIFADO", roleLine2: "• 2º T • EQUIPE 02 • 01.11.004.007", points: 200, type: "colaborador", avatarUrl: "" },
        { id: "5", name: "THAIS DINIZ", roleLine1: "1-OPERACIONAL JURÍDICO", roleLine2: "O1.11.025.001", points: 100, type: "colaborador", avatarUrl: "" },
        { id: "6", name: "VITORIA ANDRADE", roleLine1: "1-ADM GERENCIAMENTO", roleLine2: "FAB 4 • 01.01.020.001", points: 100, type: "colaborador", avatarUrl: "" },
        { id: "7", name: "FABIANO SANTOS", roleLine1: "1-OPERACIONAL SUPRIMENTOS", roleLine2: "01.11.028.001", points: 100, type: "colaborador", avatarUrl: "" },
        { id: "8", name: "AGENER SILVA", roleLine1: "1-OPERACIONAL ALMOXARIFADO", roleLine2: "• 1º T • EQUIPE 02 • 01.11.004.006", points: 100, type: "colaborador", avatarUrl: "" },

        { id: "9", name: "LUCAS MUNIZ MACHADO", roleLine1: "GESTOR", roleLine2: "Líder de equipe", points: 600, type: "gestor", avatarUrl: "" },
        { id: "10", name: "MARCOS RYUJI TONOOKA", roleLine1: "GESTOR", roleLine2: "Coordenação", points: 520, type: "gestor", avatarUrl: "" },
    ];

    let activeTab = "all"; // all | colaborador | gestor
    let cachedPeople = [];
    let cachedMyBalance = null;

    function renderRuleLine(r) {
        return `<div class="d-flex justify-content-between gap-3">
            <div class="text-muted">${escapeHtml(r.label)}</div>
            <div class="fw-semibold">${escapeHtml(String(r.points))} Feedzcoin</div>
        </div>`;
    }

    function setActiveTab(next) {
        activeTab = next;
        const map = { all: tabAll, colaborador: tabColab, gestor: tabGestor };
        Object.keys(map).forEach(k => {
            const el = map[k];
            if (!el) return;
            const isActive = k === activeTab;
            el.classList.toggle("fw-semibold", isActive);
            el.classList.toggle("text-muted", !isActive);
        });
        renderRanking();
    }

    function getFilteredPeople() {
        const q = (searchEl && searchEl.value ? searchEl.value.trim().toLowerCase() : "");
        return cachedPeople
            .filter(p => activeTab === "all" ? true : (p.type ? p.type === activeTab : true))
            .filter(p => !q ? true : (p.name || "").toLowerCase().includes(q))
            .sort((a, b) => (b.points || 0) - (a.points || 0));
    }

    function renderCard(p) {
        const avatar = p.avatarUrl
            ? `<img src="${p.avatarUrl}" alt="${escapeHtml(p.name)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;">`
            : `<div class="bg-light d-flex align-items-center justify-content-center" style="width:72px;height:72px;border-radius:50%;font-weight:800;">
                    ${escapeHtml(initials(p.name))}
               </div>`;

        return `<div class="col-12 col-sm-6 col-lg-3">
            <div class="card-soft p-3 h-100 text-center">
                <div class="d-flex justify-content-center mb-2">${avatar}</div>
                <div class="fw-bold">${escapeHtml(p.name)}</div>
                <div class="text-muted small mt-1">${escapeHtml(p.roleLine1 || "")}</div>
                <div class="text-muted small">${escapeHtml(p.roleLine2 || "")}</div>
                <div class="mt-3">
                    <span class="btn btn-primary btn-sm disabled">${escapeHtml(fmtPoints(p.points))}</span>
                </div>
            </div>
        </div>`;
    }

    function renderRanking() {
        if (!gridEl) return;
        const people = getFilteredPeople();
        gridEl.innerHTML = people.map(renderCard).join("");
        if (emptyEl) emptyEl.classList.toggle("d-none", people.length !== 0);

        if (totalEl) {
            if (cachedMyBalance && typeof cachedMyBalance.balance === "number") {
                totalEl.textContent = cachedMyBalance.balance.toLocaleString("pt-BR");
            } else {
                const total = people.reduce((acc, p) => acc + (p.points || 0), 0);
                totalEl.textContent = total.toLocaleString("pt-BR");
            }
        }
    }

    function renderRules(rulesLeft, rulesRight) {
        if (rulesLeftEl) rulesLeftEl.innerHTML = (rulesLeft || []).map(renderRuleLine).join("");
        if (rulesRightEl) rulesRightEl.innerHTML = (rulesRight || []).map(renderRuleLine).join("");
    }

    async function loadFromApi() {
        const [leaderboard, myBalance] = await Promise.all([
            apiGet(API_LEADERBOARD + "?page=1&pageSize=200"),
            apiGet(API_MY_BALANCE),
        ]);

        cachedMyBalance = myBalance || null;

        const items = (leaderboard && leaderboard.items) ? leaderboard.items : [];
        cachedPeople = items.map((e) => ({
            id: e.userId || e.id || "",
            name: e.fullName || e.name || "",
            points: typeof e.balance === "number" ? e.balance : (typeof e.points === "number" ? e.points : 0),
            rank: e.rank,
            type: e.type || null,
            avatarUrl: e.avatarUrl || null,
            roleLine1: e.roleLine1 || "",
            roleLine2: e.roleLine2 || "",
        }));

        renderRules(MOCK_RULES_LEFT, MOCK_RULES_RIGHT);
    }

    async function loadFromMock() {
        cachedMyBalance = { balance: 6900 };
        cachedPeople = MOCK_PEOPLE.slice();
        renderRules(MOCK_RULES_LEFT, MOCK_RULES_RIGHT);
    }

    async function load() {
        try {
            if (USE_MOCK) await loadFromMock();
            else await loadFromApi();
        } catch (e) {
            console.error("gamificacao load:", e);
            await loadFromMock();
        } finally {
            renderRanking();
        }
    }

    function bind() {
        if (tabAll) tabAll.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("all"); });
        if (tabColab) tabColab.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("colaborador"); });
        if (tabGestor) tabGestor.addEventListener("click", (e) => { e.preventDefault(); setActiveTab("gestor"); });
        if (searchEl) searchEl.addEventListener("input", renderRanking);
        if (btnRefresh) btnRefresh.addEventListener("click", load);
    }

    bind();
    setActiveTab("all");
    load();
})();
