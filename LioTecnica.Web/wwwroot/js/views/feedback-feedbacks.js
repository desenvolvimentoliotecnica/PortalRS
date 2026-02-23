(function () {
    "use strict";

    const API_MINE = "/Feedback/_api/items/mine";
    const API_ALL = "/Feedback/_api/items/all";
    const PAGE_SIZE = 20;
    let pageReceived = 1;
    let pageSent = 1;
    let pageAll = 1;
    let totalReceived = 0;
    let totalSent = 0;
    let totalAll = 0;

    const listReceived = document.getElementById("listReceived");
    const emptyReceived = document.getElementById("emptyReceived");
    const loadMoreReceived = document.getElementById("loadMoreReceived");
    const btnLoadMoreReceived = document.getElementById("btnLoadMoreReceived");
    const listSent = document.getElementById("listSent");
    const emptySent = document.getElementById("emptySent");
    const loadMoreSent = document.getElementById("loadMoreSent");
    const btnLoadMoreSent = document.getElementById("btnLoadMoreSent");
    const listAll = document.getElementById("listAll");
    const emptyAll = document.getElementById("emptyAll");
    const loadMoreAll = document.getElementById("loadMoreAll");
    const btnLoadMoreAll = document.getElementById("btnLoadMoreAll");
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
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function renderRow(item) {
        const fromName = escapeHtml(item.fromUserFullName || "");
        const toName = escapeHtml(item.toUserFullName || "");
        const content = escapeHtml(item.content || "");
        const date = formatDate(item.createdAtUtc);
        const tipo = item.tipo ? `<span class="tag ms-1">${escapeHtml(item.tipo)}</span>` : "";
        const avatarUrl = item.fromUserAvatarUrl || item.fromAvatarUrl || "";

        const avatarHtml = avatarUrl
            ? `<img src="${avatarUrl}" alt="${fromName}" class="avatar" style="width:48px;height:48px;border-radius:12px;object-fit:cover;">`
            : `<div class="initials-badge">${(fromName || "").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase()}</div>`;

        return `
            <div class="item mb-2 p-2">
                <div class="d-flex align-items-start gap-3">
                    <div class="flex-shrink-0">${avatarHtml}</div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <span class="fw-semibold">${fromName}</span>
                                <span class="text-muted"> → </span>
                                <span class="fw-semibold">${toName}</span>
                                ${tipo}
                            </div>
                            <div class="text-muted small">${date}</div>
                        </div>
                        <div class="mt-2 text-break">${content}</div>
                    </div>
                </div>
            </div>`;
    }

    async function loadReceived(append) {
        if (!append) {
            pageReceived = 1;
            if (listReceived) listReceived.innerHTML = "";
            if (emptyReceived) emptyReceived.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_MINE}?filter=received&page=${pageReceived}&pageSize=${PAGE_SIZE}`);
            totalReceived = data.totalCount || 0;
            (data.items || []).forEach(item => {
                if (listReceived) listReceived.insertAdjacentHTML("beforeend", renderRow(item));
            });
            if (!append && totalReceived === 0 && emptyReceived) emptyReceived.classList.remove("d-none");
            if (loadMoreReceived) loadMoreReceived.classList.toggle("d-none", pageReceived * PAGE_SIZE >= totalReceived);
        } catch (e) {
            console.error(e);
            if (listReceived && !append) listReceived.innerHTML = "<div class=\"text-danger\">Erro ao carregar.</div>";
        }
    }

    async function loadSent(append) {
        if (!append) {
            pageSent = 1;
            if (listSent) listSent.innerHTML = "";
            if (emptySent) emptySent.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_MINE}?filter=sent&page=${pageSent}&pageSize=${PAGE_SIZE}`);
            totalSent = data.totalCount || 0;
            (data.items || []).forEach(item => {
                if (listSent) listSent.insertAdjacentHTML("beforeend", renderRow(item));
            });
            if (!append && totalSent === 0 && emptySent) emptySent.classList.remove("d-none");
            if (loadMoreSent) loadMoreSent.classList.toggle("d-none", pageSent * PAGE_SIZE >= totalSent);
        } catch (e) {
            console.error(e);
            if (listSent && !append) listSent.innerHTML = "<div class=\"text-danger\">Erro ao carregar.</div>";
        }
    }

    async function loadAll(append) {
        if (!append) {
            pageAll = 1;
            if (listAll) listAll.innerHTML = "";
            if (emptyAll) emptyAll.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_ALL}?page=${pageAll}&pageSize=${PAGE_SIZE}`);
            totalAll = data.totalCount || 0;
            (data.items || []).forEach(item => {
                if (listAll) listAll.insertAdjacentHTML("beforeend", renderRow(item));
            });
            if (!append && totalAll === 0 && emptyAll) emptyAll.classList.remove("d-none");
            if (loadMoreAll) loadMoreAll.classList.toggle("d-none", pageAll * PAGE_SIZE >= totalAll);
        } catch (e) {
            console.error(e);
            if (listAll && !append) listAll.innerHTML = "<div class=\"text-danger\">Erro ao carregar. Verifique permissão.</div>";
        }
    }

    if (btnLoadMoreReceived) btnLoadMoreReceived.addEventListener("click", function () { pageReceived++; loadReceived(true); });
    if (btnLoadMoreSent) btnLoadMoreSent.addEventListener("click", function () { pageSent++; loadSent(true); });
    if (btnLoadMoreAll) btnLoadMoreAll.addEventListener("click", function () { pageAll++; loadAll(true); });

    if (btnRefresh) {
        btnRefresh.addEventListener("click", function () {
            if (listReceived) loadReceived(false);
            if (listSent) loadSent(false);
            if (listAll) loadAll(false);
            loadKPIs();
            loadRanking();
            loadOneOnOne();
            loadActivities();
            loadMood();
            loadTeamSummary();
            loadQuickLinks();
            loadProfilePanel();
        });
    }

    document.getElementById("tab-received")?.addEventListener("shown.bs.tab", () => { if (pageReceived === 1 && listReceived && listReceived.children.length === 0) loadReceived(false); });
    document.getElementById("tab-sent")?.addEventListener("shown.bs.tab", () => { if (pageSent === 1 && listSent && listSent.children.length === 0) loadSent(false); });
    document.getElementById("tab-all")?.addEventListener("shown.bs.tab", () => { if (pageAll === 1 && listAll && listAll.children.length === 0) loadAll(false); });

    if (listReceived) loadReceived(false);

    const DEMO_MODE = true;
    const MOCK_DASH = {
        kpis: { coins: 600, rank: 4, teamCount: 5, efficiencyFeedback: 0, efficiencyOneOnOne: 60, efficiencyCelebration: 0, efficiencyDev: 60 },
        profile: { name: "LUCAS MUNIZ MACHADO", coins: 600, progress: 50, progressText: "4 de 8", roleBadge: "Gestor campeão" },
        ranking: {
            goal: 5000,
            current: 600,
            items: [
                { name: "PAULO", initials: "P", points: 700, position: 2 },
                { name: "JEFFERSON", initials: "J", points: 400, position: 5 },
                { name: "EVERTON", initials: "E", points: 400, position: 6 },
                { name: "ANDRE", initials: "A", points: 200, position: 9 },
                { name: "THAIS", initials: "T", points: 100, position: 10 },
            ]
        },
        oneOnOne: {
            items: [
                { withName: "MARCOS RYUJI TONOOKA", date: "27 de janeiro de 2026", time: "12:30 até 13:00" },
                { withName: "MARCOS RYUJI TONOOKA", date: "29 de janeiro de 2026", time: "09:15 até 09:45" },
                { withName: "GABRIEL VICTOR LAUDARES CELSO", date: "02 de fevereiro de 2026", time: "17:00 até 17:30" },
            ]
        },
        teamTable: [
            { name: "ELTON DE FREITAS ...", mood: "Nunca respondeu", feedback: "435 dias", oneOnOne: "28 dias", pdi: "Todos em dia" },
            { name: "GABRIEL VICTOR ...", mood: "20/10/2025 07:49", feedback: "160 dias", oneOnOne: "24 dias", pdi: "Todos em dia" },
        ],
        activities: [
            { name: "ADRIANO VITOR DOS SANTOS", action: "respondeu o Termômetro de Humor", summary: "😟 😕 😐 🙂 😀", date: "1 semana atrás" },
            { name: "ANTONIO FRANCISCO ALMEIDA", action: "enviou um novo Feedback", summary: "Novo feedback enviado", date: "1 semana atrás" },
            { name: "PAULO CEZAR DOS SANTOS", action: "respondeu o Termômetro de Humor", summary: "😟 😕 😐 🙂 😀", date: "2 semanas atrás" },
        ],
    };

    function getInitials(name) {
        return (name || "").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
    }

    async function loadKPIs() {
        try {
            const data = DEMO_MODE ? MOCK_DASH.kpis : await apiGet("/Feedback/_api/gamification/my-balance");
            const row = document.getElementById("kpiRow");
            if (!row) return;
            row.innerHTML = `
                <div class="fd-hero card-soft">
                    <div class="fd-hero-title">Olá LUCAS MUNIZ MACHADO, como está sua gestão?</div>
                    <div class="fd-hero-grid">
                        <div class="fd-hero-item">
                            <div class="fd-hero-label">Seu time</div>
                            <div class="fd-hero-value">Colaboradores: ${data?.teamCount ?? 0}</div>
                        </div>
                        <div class="fd-hero-item">
                            <div class="fd-hero-label">Feedbacks</div>
                            <div class="fd-hero-value">Eficiência: ${data?.efficiencyFeedback ?? 0}%</div>
                        </div>
                        <div class="fd-hero-item">
                            <div class="fd-hero-label">1:1</div>
                            <div class="fd-hero-value">Eficiência: ${data?.efficiencyOneOnOne ?? 0}%</div>
                        </div>
                        <div class="fd-hero-item">
                            <div class="fd-hero-label">Celebrações</div>
                            <div class="fd-hero-value">Eficiência: ${data?.efficiencyCelebration ?? 0}%</div>
                        </div>
                        <div class="fd-hero-item">
                            <div class="fd-hero-label">Desenvolvimento</div>
                            <div class="fd-hero-value">Eficiência: ${data?.efficiencyDev ?? 0}%</div>
                        </div>
                    </div>
                </div>
                <div class="d-flex gap-2 flex-wrap mt-2">
                    <div class="kpi card-soft p-3">
                        <div class="meta"><div class="label">Feedzcoin</div><div class="value">${data?.coins ?? 0}</div></div>
                    </div>
                    <div class="kpi card-soft p-3">
                        <div class="meta"><div class="label">Posição</div><div class="value">${data?.rank ?? "-"}</div></div>
                    </div>
                    <div class="kpi card-soft p-3">
                        <div class="meta"><div class="label">Equipe</div><div class="value">${data?.teamCount ?? "-"}</div></div>
                    </div>
                </div>`;
        } catch (e) { console.error("loadKPIs:", e); }
    }

    async function loadRanking() {
        try {
            const data = DEMO_MODE ? MOCK_DASH.ranking : await apiGet("/Feedback/_api/gamification/leaderboard?page=1&pageSize=10");
            const el = document.getElementById("rankingPanel");
            if (!el) return;
            const goal = data.goal || 5000;
            const current = data.current || 0;
            const progress = Math.min(100, Math.round((current / goal) * 100));
            el.innerHTML = `
                <div class="fd-panel-title">Ranking Mensal</div>
                <div class="fd-rank-meta">Meta ${goal.toLocaleString("pt-BR")} Feedzcoin</div>
                <div class="progress my-2"><div class="progress-bar" style="width:${progress}%"></div></div>
                <div class="fd-rank-number">${current.toLocaleString("pt-BR")} / ${goal.toLocaleString("pt-BR")}</div>
                <div class="fd-rank-tabs"><span class="active">Colaboradores</span><span>Gestores</span></div>
                ${(data.items || []).map((it) => `
                    <div class="row-item d-flex justify-content-between align-items-center p-2">
                        <div class="d-flex align-items-center gap-2">
                            <div class="avatar">${(it.initials || getInitials(it.name)).slice(0,2)}</div>
                            <div>
                                <div class="fw-semibold">${it.name}</div>
                            </div>
                        </div>
                        <div class="muted small">${it.position || "-"}º <strong>${it.points ?? 0}</strong></div>
                    </div>`).join("")}
            `;
        } catch (e) { console.error("loadRanking:", e); }
    }

    async function loadOneOnOne() {
        try {
            const data = DEMO_MODE ? MOCK_DASH.oneOnOne : await apiGet("/Feedback/_api/oneonone?page=1&pageSize=5");
            const el = document.getElementById("oneOnOnePanel");
            if (!el) return;
            if (!data.items || data.items.length === 0) {
                el.innerHTML = '<div class="text-muted">Nenhuma reunião 1:1 agendada.</div>';
                return;
            }
            el.innerHTML = `
                <div class="fd-panel-head">
                    <div>
                        <div class="fd-panel-title">Você possui reuniões 1:1 que não foram finalizadas</div>
                        <div class="fd-panel-sub">Confira as reuniões que já passaram e não foram finalizadas</div>
                    </div>
                    <div class="fd-panel-sub">Mostrando ${data.items.length} reuniões</div>
                </div>
                ${(data.items || []).map(it => `
                <div class="item mb-2 p-2">
                    <div class="d-flex justify-content-between">
                        <div>
                            <div class="fw-semibold">${it.title || it.withName || "1:1"}</div>
                            <div class="muted small">${it.date || it.scheduledAt || ""} ${it.time ? `• ${it.time}` : ""}</div>
                        </div>
                        <div><a class="btn btn-ghost btn-sm" href="${it.url || '#'}">Ir para reunião</a></div>
                    </div>
                </div>`).join("")}
                <div class="text-center"><button class="btn btn-link btn-sm">Carregar mais</button></div>
            `;
        } catch (e) { console.error("loadOneOnOne:", e); }
    }

    async function loadActivities() {
        try {
            const data = DEMO_MODE ? { items: MOCK_DASH.activities } : await apiGet("/Feedback/_api/celebrations/feed?page=1&pageSize=10");
            const el = document.getElementById("activitiesPanel");
            if (!el) return;
            if (!data.items || data.items.length === 0) {
                el.innerHTML = '<div class="text-muted">Nenhuma atividade recente.</div>';
                return;
            }
            el.innerHTML = `
                <div class="fd-panel-title">Atividades recentes</div>
                ${(data.items || []).map(it => `
                <div class="item mb-2 p-2 d-flex align-items-start">
                    <div class="flex-shrink-0">${it.avatarUrl ? `<img src="${it.avatarUrl}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;">` : `<div class="initials-badge">${getInitials(it.name)}</div>`}</div>
                    <div class="flex-grow-1 ms-3">
                        <div class="fw-semibold">${it.name || it.from || ''} <span class="muted small"> ${it.action || ''}</span></div>
                        <div class="muted small">${it.summary || it.content || ''}</div>
                    </div>
                    <div class="muted small ms-2">${it.date || it.createdAtUtc || ''}</div>
                </div>`).join("")}
            `;
        } catch (e) { console.error("loadActivities:", e); }
    }

    async function loadMood() {
        try {
            const el = document.getElementById("moodPanel");
            if (!el) return;
            el.innerHTML = `
                <div class="fd-panel-title text-center">Como você está se sentindo?</div>
                <div class="d-flex gap-2 align-items-center justify-content-center mb-3 fd-mood-row">
                    <button class="btn btn-ghost">😢</button>
                    <button class="btn btn-ghost">🙁</button>
                    <button class="btn btn-ghost">😐</button>
                    <button class="btn btn-ghost">🙂</button>
                    <button class="btn btn-ghost">😀</button>
                </div>
                <textarea class="form-control mb-2" rows="2" placeholder="Nos conte o que te faz sentir assim"></textarea>
                <div class="text-center"><button class="btn btn-brand">Enviar humor</button></div>
            `;
        } catch (e) { console.error("loadMood:", e); }
    }

    async function loadTeamSummary() {
        const el = document.getElementById("teamSummary");
        if (!el) return;
        const rows = DEMO_MODE ? MOCK_DASH.teamTable : [];
        el.innerHTML = `
            <div class="fd-panel-title">Acompanhe seu time</div>
            <div class="table-responsive">
                <table class="table fd-team-table">
                    <thead>
                        <tr>
                            <th>Colaborador</th>
                            <th>Humor</th>
                            <th>Feedback</th>
                            <th>1:1</th>
                            <th>PDI</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.name}</td>
                                <td>${r.mood}</td>
                                <td>${r.feedback}</td>
                                <td>${r.oneOnOne}</td>
                                <td>${r.pdi}</td>
                            </tr>`).join("")}
                    </tbody>
                </table>
            </div>
            <div class="text-end"><a href="#" class="small">Mostrar mais detalhes</a></div>
        `;
    }

    function loadQuickLinks() {
        const el = document.getElementById("quickLinksPanel");
        if (!el) return;
        el.innerHTML = `
            <div class="fd-quick-links">
                <a href="/Gestao/ResumoAtividades" class="fd-link-card"><i class="bi bi-activity me-2"></i>Resumo de atividades</a>
                <a href="/Gestao/Feedbacks" class="fd-link-card"><i class="bi bi-chat-left-text me-2"></i>Gestão de Feedbacks</a>
                <a href="/Feedback/Celebracao" class="fd-link-card"><i class="bi bi-stars me-2"></i>Celebrações <strong class="ms-1">3 Recebidas</strong></a>
                <a href="/Feedback/Feedbacks" class="fd-link-card"><i class="bi bi-chat-quote me-2"></i>Feedbacks <strong class="ms-1">3 Recebidos</strong></a>
                ${"" /* Pesquisas desativado temporariamente.
                <a href="/Pesquisas" class="fd-link-card"><i class="bi bi-search me-2"></i>Pesquisas <strong class="ms-1">0 Respondidas</strong></a>
                */}
            </div>
        `;
    }

    function loadProfilePanel() {
        const el = document.getElementById("profilePanel");
        if (!el) return;
        const p = MOCK_DASH.profile;
        el.innerHTML = `
            <div class="d-flex align-items-center gap-2 mb-2">
                <img src="/assets/images/user.png" alt="${p.name}" class="avatar">
                <div>
                    <div class="fw-semibold">${p.name}</div>
                    <div class="muted small">💰 ${p.coins}</div>
                </div>
            </div>
            <div class="fd-badge">${p.roleBadge}</div>
            <p class="muted small mb-2">Mantenha o engajamento na Feedz e seja um gestor campeão.</p>
            <div class="progress mb-1"><div class="progress-bar" style="width:${p.progress}%"></div></div>
            <div class="d-flex justify-content-between muted small"><span>${p.progress}%</span><span>${p.progressText}</span></div>
            <div class="fd-action-list mt-2">
                <div class="fd-action-item"><i class="bi bi-arrow-right-short"></i> 0/2 Feedbacks para liderados</div>
                <div class="fd-action-item done"><i class="bi bi-check2"></i> 4/4 Acessar a Feedz</div>
                <div class="fd-action-item"><i class="bi bi-arrow-right-short"></i> 0/2 Enviar celebração</div>
            </div>
        `;
    }

    // Initialize home blocks (non-blocking)
    loadKPIs();
    loadRanking();
    loadOneOnOne();
    loadActivities();
    loadMood();
    loadTeamSummary();
    loadQuickLinks();
    loadProfilePanel();

    // Persist tab selection: keep selected tab when navigating/reloading
    (function persistTab() {
        try {
            const tabContainer = document.getElementById('feedbacksTab');
            if (!tabContainer) return;
            const tabLinks = Array.from(tabContainer.querySelectorAll('.nav-link'));
            // Restore saved tab
            const saved = localStorage.getItem('feedbackSelectedTab');
            if (saved) {
                const savedBtn = document.getElementById(saved);
                if (savedBtn) {
                    if (window.bootstrap && typeof window.bootstrap.Tab === 'function') {
                        new bootstrap.Tab(savedBtn).show();
                    } else {
                        savedBtn.click();
                    }
                }
            }
            // Store on shown (Bootstrap event) and on click fallback
            tabLinks.forEach(btn => {
                btn.addEventListener('shown.bs.tab', () => {
                    try { localStorage.setItem('feedbackSelectedTab', btn.id); } catch (e) {}
                });
                btn.addEventListener('click', () => {
                    tabLinks.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    try { localStorage.setItem('feedbackSelectedTab', btn.id); } catch (e) {}
                });
            });
        } catch (e) {
            console.warn('persistTab error', e);
        }
    })();
})();
