(() => {
// ===============================
// Dashboard.js (i18n-ready)
// ===============================

const EMPTY_TEXT = "-";
const DASHBOARD_API_BASE = "/Dashboard/_api";

// i18n helper (strings vêm do cshtml via window.__i18n)
const t = (key, fallback) => {
    const v = window.__i18n?.[key];
    if (v == null || v === "") return (fallback ?? key);
    return v;
};

function setText(root, role, value) {
    if (!root) return;
    const el = root.querySelector(`[data-role="${role}"]`);
    if (!el) return;
    el.textContent = (value ?? EMPTY_TEXT);
}

async function apiFetchJson(url, options = {}) {
    const opts = { ...options };
    opts.headers = { Accept: "application/json", ...(opts.headers || {}) };
    const res = await fetch(url, opts);
    if (!res.ok) {
        const message = await res.text();
        throw new Error(message || t("apiFail", `Falha na API (${res.status}).`));
    }
    if (res.status === 204) return null;
    return res.json();
}

function enumFirstCode(key, fallback) {
    const list = getEnumOptions(key);
    return list.length ? list[0].code : fallback;
}

let VAGA_ALL = enumFirstCode("vagaFilterSimple", "all");

const state = {
    vagas: [],
    areas: [],
    chart: null
};

function formatLocal(vaga) {
    const parts = [vaga?.cidade, vaga?.uf].filter(Boolean);
    return parts.length ? parts.join(" - ") : EMPTY_TEXT;
}

function formatDate(iso) {
    if (!iso) return EMPTY_TEXT;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return EMPTY_TEXT;

    // usa cultura do navegador (que já vai refletir a culture do app, na maioria dos casos)
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
}

function badgeEtapa(etapa) {
    const map = {
        Recebido: "secondary",
        Triagem: "primary",
        Entrevista: "warning",
        Aprovado: "success",
        Reprovado: "danger"
    };
    const bs = map[etapa] ?? "primary";
    return `<span class="badge text-bg-${bs} rounded-pill">${etapa}</span>`;
}

function renderQuickAreaOptions() {
    const sel = $("#quickArea");
    if (!sel) return;
    sel.replaceChildren();
    sel.appendChild(buildOption("", t("quickAreaSelect", "Selecionar área")));
    state.areas.forEach(a => sel.appendChild(buildOption(a.id, a.nome)));
}

function renderVagaFilterOptions() {
    const sel = $("#fVaga");
    if (!sel) return;
    const current = sel.value || VAGA_ALL;

    sel.replaceChildren();

    // opções do enum já vêm traduzidas do backend (se você gerar por enum + localizer)
    getEnumOptions("vagaFilterSimple").forEach(opt => {
        sel.appendChild(buildOption(opt.code, opt.text, opt.code === current));
    });

    state.vagas
        .slice()
        .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""))
        .forEach(v => {
            sel.appendChild(buildOption(v.id, `${v.titulo || "-"} (${v.codigo || "-"})`, v.id === current));
        });

    sel.value = (current === VAGA_ALL || state.vagas.some(v => v.id === current)) ? current : VAGA_ALL;
}

async function loadAreas() {
    state.areas = (await apiFetchJson(`${DASHBOARD_API_BASE}/areas`, { method: "GET" })) || [];
    renderQuickAreaOptions();
}

async function loadVagasLookup() {
    state.vagas = (await apiFetchJson(`${DASHBOARD_API_BASE}/vagas`, { method: "GET" })) || [];
    renderVagaFilterOptions();
}

async function updateDashboardKpis() {
    const data = await apiFetchJson(`${DASHBOARD_API_BASE}/kpis`, { method: "GET" });
    if (!data) return;

    const elVagas = $("#kpiVagas");
    const elCvs = $("#kpiCvsHoje");
    const elPend = $("#kpiPendentes");
    const elApr = $("#kpiAprovados");
    if (elVagas) elVagas.textContent = data.openVagas ?? 0;
    if (elCvs) elCvs.textContent = data.cvsHoje ?? 0;
    if (elPend) elPend.textContent = data.pendentesMatch ?? 0;
    if (elApr) elApr.textContent = data.aprovados7Dias ?? 0;
}

async function updateFunnel() {
    const data = await apiFetchJson(`${DASHBOARD_API_BASE}/funil`, { method: "GET" });
    if (!data) return;

    const recebidos = data.recebidos ?? 0;
    const triagem = data.triagem ?? 0;
    const entrevista = data.entrevista ?? 0;
    const aprovados = data.aprovados ?? 0;

    $("#funnelRecebidos").textContent = recebidos;
    $("#funnelTriagem").textContent = triagem;
    $("#funnelEntrevista").textContent = entrevista;
    $("#funnelAprovados").textContent = aprovados;

    const base = recebidos > 0 ? recebidos : 1;
    $("#funnelRecebidosBar").style.width = "100%";
    $("#funnelTriagemBar").style.width = `${Math.round((triagem / base) * 100)}%`;
    $("#funnelEntrevistaBar").style.width = `${Math.round((entrevista / base) * 100)}%`;
    $("#funnelAprovadosBar").style.width = `${Math.round((aprovados / base) * 100)}%`;
}

function buildChart(labels, values) {
    const ctx = $("#chartRecebidos");
    if (!ctx) return;

    if (state.chart) {
        state.chart.data.labels = labels;
        state.chart.data.datasets[0].data = values;
        state.chart.update();
        return;
    }

    state.chart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: t("chartLabel_CVsReceived", "CVs recebidos"),
                data: values,
                tension: 0.35,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            },
            scales: {
                x: { grid: { display: false } },
                y: { grid: { color: "rgba(16,82,144,.10)" }, ticks: { precision: 0 } }
            }
        }
    });
}

async function updateSeries(days) {
    const data = await apiFetchJson(`${DASHBOARD_API_BASE}/recebidos-series?days=${days}`, { method: "GET" });
    const labels = Array.isArray(data?.labels) ? data.labels : [];
    const values = Array.isArray(data?.values) ? data.values : [];
    buildChart(labels, values);
}

async function renderTable() {
    const body = $("#tblBody");
    if (!body) return;
    body.innerHTML = "";

    const minMatch = parseInt($("#fMatchMin")?.value, 10) || 0;
    const vagaId = $("#fVaga")?.value;
    const fromRaw = $("#fDe")?.value;
    const toRaw = $("#fAte")?.value;

    const params = new URLSearchParams();
    params.set("minMatch", minMatch.toString());
    params.set("take", "15");
    if (vagaId && vagaId !== VAGA_ALL) params.set("vagaId", vagaId);

    // OBS: mantendo seu padrão original com Z; se quiser sem timezone, dá pra ajustar depois.
    if (fromRaw) {
        const from = new Date(`${fromRaw}T00:00:00Z`);
        if (!Number.isNaN(from.getTime())) params.set("from", from.toISOString());
    }
    if (toRaw) {
        const to = new Date(`${toRaw}T23:59:59Z`);
        if (!Number.isNaN(to.getTime())) params.set("to", to.toISOString());
    }

    const rows = await apiFetchJson(`${DASHBOARD_API_BASE}/top-matches?${params.toString()}`, { method: "GET" });

    (Array.isArray(rows) ? rows : []).forEach(x => {
        const tr = document.createElement("tr");

        const labelCode = t("labelCode", "Código");
        const labelId = t("labelId", "ID");
        const originEmail = t("originEmail", "Email");
        const matchInfo = t("matchInfo", "Match calculado pela API.");
        const defaultStage = t("stageScreening", "Triagem");

        const origem = x.origem || "-";
        const origemLabel = (origem === "Email") ? originEmail : origem;

        tr.innerHTML = `
      <td>
        <div class="fw-semibold">${x.vagaTitulo || "-"}</div>
        <div class="text-muted small">${labelCode}: ${x.vagaCodigo || "-"}</div>
      </td>
      <td>
        <div class="fw-semibold">${x.candidatoNome || "-"}</div>
        <div class="text-muted small">${labelId}: ${x.candidatoId || "-"}</div>
      </td>
      <td>
        <span class="badge-soft">
          <i class="bi ${x.origem === "Email" ? "bi-envelope" : "bi-folder2"} me-1"></i>${origemLabel}
        </span>
      </td>
      <td>
        <div class="d-flex align-items-center gap-2">
          <div class="progress flex-grow-1"><div class="progress-bar" style="width:${x.matchScore || 0}%"></div></div>
          <div class="fw-bold" style="min-width:44px;text-align:right;">${x.matchScore || 0}%</div>
        </div>
        <div class="text-muted small mt-1">${matchInfo}</div>
      </td>
      <td>${badgeEtapa(x.etapa || defaultStage)}</td>
      <td class="text-end">
        <button class="btn btn-ghost btn-sm" type="button" data-act="open-vaga" data-id="${x.vagaId}">
          <i class="bi bi-box-arrow-up-right me-1"></i>${t("btnViewJob", "Ver vaga")}
        </button>
      </td>
    `;

        const btn = tr.querySelector('[data-act="open-vaga"]');
        if (btn) btn.addEventListener("click", () => goToVagaDetail(x.vagaId));
        body.appendChild(tr);
    });

    if (!body.children.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="6" class="text-center text-muted py-4">${t("emptyTable", "Nenhum registro atende o filtro atual.")}</td>`;
        body.appendChild(tr);
    }
}

async function renderOpenVagasModal() {
    const tbody = $("#tblVagasAbertas");
    const count = $("#openVagaCount");
    if (!tbody) return;

    tbody.replaceChildren();

    const rows = await apiFetchJson(`${DASHBOARD_API_BASE}/open-vagas?take=200`, { method: "GET" });
    const list = Array.isArray(rows) ? rows : [];
    if (count) count.textContent = list.length;

    if (!list.length) {
        const empty = cloneTemplate("tpl-vaga-aberta-empty-row");
        if (empty) tbody.appendChild(empty);
        return;
    }

    list
        .slice()
        .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""))
        .forEach(v => {
            const tr = cloneTemplate("tpl-vaga-aberta-row");
            if (!tr) return;

            setText(tr, "vaga-code", v.codigo || EMPTY_TEXT);
            setText(tr, "vaga-title", v.titulo || EMPTY_TEXT);
            setText(tr, "vaga-desc", v.senioridade || EMPTY_TEXT);
            setText(tr, "vaga-area", v.area || EMPTY_TEXT);
            setText(tr, "vaga-modalidade", v.modalidade || EMPTY_TEXT);
            setText(tr, "vaga-local", formatLocal(v));
            setText(tr, "vaga-updated", formatDate(v.updatedAtUtc));

            const btn = tr.querySelector('[data-act="open-vaga"]');
            if (btn) btn.addEventListener("click", () => goToVagaDetail(v.id));
            tbody.appendChild(tr);
        });
}

function goToVagaDetail(vagaId) {
    if (!vagaId) return;
    const url = new URL("/Vagas", window.location.origin);
    url.searchParams.set("vagaId", vagaId);
    url.searchParams.set("open", "detail");
    window.location.href = url.toString();
}

function wireOpenVagasModal() {
    const modal = $("#modalVagasAbertas");
    if (!modal) return;
    modal.addEventListener("show.bs.modal", () => { void renderOpenVagasModal(); });
}

function wireKpiAccessibility() {
    document.addEventListener("keydown", (ev) => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const card = ev.target.closest("[data-modal-target]");
        if (!card) return;
        const target = card.dataset.modalTarget;
        if (!target) return;
        ev.preventDefault();
        const modal = document.querySelector(target);
        if (modal) bootstrap.Modal.getOrCreateInstance(modal).show();
    });
}

// ========= Menu behavior (mock navigation)
const menuMeta = {
    dashboard: { titleKey: "menu_dashboard_title", subKey: "menu_dashboard_sub" },
    vagas: { titleKey: "menu_vagas_title", subKey: "menu_vagas_sub" },
    candidatos: { titleKey: "menu_candidatos_title", subKey: "menu_candidatos_sub" },
    triagem: { titleKey: "menu_triagem_title", subKey: "menu_triagem_sub" },
    matching: { titleKey: "menu_matching_title", subKey: "menu_matching_sub" },
    entrada: { titleKey: "menu_entrada_title", subKey: "menu_entrada_sub" },
    rm: { titleKey: "menu_rm_title", subKey: "menu_rm_sub" },
    relatorios: { titleKey: "menu_relatorios_title", subKey: "menu_relatorios_sub" },
    usuarios: { titleKey: "menu_usuarios_title", subKey: "menu_usuarios_sub" },
    config: { titleKey: "menu_config_title", subKey: "menu_config_sub" }
};

function setActiveMenu(key) {
    const meta = menuMeta[key] ?? menuMeta.dashboard;

    $("#pageH4").textContent = t(meta.titleKey, t("menu_dashboard_title_fallback", "Dashboard"));
    $("#pageSub").textContent = t(meta.subKey, t("menu_dashboard_sub_fallback", "Visão geral do dia • vagas • recebimentos e triagem."));

    $$(".sidebar .nav-link").forEach(a => a.classList.toggle("active", a.dataset.menu === key));
    $$("#offcanvasSidebar [data-menu]").forEach(a => {
        a.classList.toggle("fw-semibold", a.dataset.menu === key);
    });

    localStorage.setItem("rh_active_menu", key);
}

function wireMenus() {
    const handler = (ev) => {
        const a = ev.target.closest("[data-menu]");
        if (!a) return;
        ev.preventDefault();
        setActiveMenu(a.dataset.menu);

        const off = bootstrap.Offcanvas.getInstance($("#offcanvasSidebar"));
        if (off) off.hide();
    };

    document.addEventListener("click", handler);
}

// ========= Filters drawer
function wireFilters() {
    const range = $("#fMatchMin");
    const label = $("#matchMinLabel");
    if (!range || !label) return;

    label.textContent = range.value + "%";

    range.addEventListener("input", () => {
        label.textContent = range.value + "%";
    });

    $("#btnApplyFilters")?.addEventListener("click", async () => {
        await renderTable();
        bootstrap.Offcanvas.getOrCreateInstance($("#drawerFilters")).hide();
    });

    $("#btnResetFilters")?.addEventListener("click", async () => {
        range.value = 70;
        label.textContent = "70%";
        $("#fVaga").value = VAGA_ALL;
        $("#fDe").value = "";
        $("#fAte").value = "";
        await renderTable();
    });
}

// ========= Quick actions
function wireQuickActions() {
    $("#btnMockCreateVaga")?.addEventListener("click", () => {
        alert(t("alertCreateJob", "Use a tela de Vagas para criar uma nova vaga."));
    });

    const drawer = $("#drawerQuick");
    if (drawer) drawer.addEventListener("show.bs.offcanvas", renderQuickAreaOptions);
}

function refreshEnumDefaults() {
    VAGA_ALL = enumFirstCode("vagaFilterSimple", "all");
}

// ========= Init
(async function init() {
    await ensureEnumData();
    refreshEnumDefaults();
    applyEnumSelects();

    wireMenus();
    wireFilters();
    wireQuickActions();
    wireOpenVagasModal();
    wireKpiAccessibility();

    try {
        await Promise.all([
            loadAreas(),
            loadVagasLookup(),
            updateDashboardKpis(),
            updateFunnel(),
            updateSeries(14)
        ]);
        await renderTable();
    } catch (err) {
        console.error(err);
        toast(t("toastDashboardLoadFail", "Falha ao carregar dados do dashboard."));
    }

    const saved = localStorage.getItem("rh_active_menu") || "dashboard";
    setActiveMenu(saved);
})();

})();
