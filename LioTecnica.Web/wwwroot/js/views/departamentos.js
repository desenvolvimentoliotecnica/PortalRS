const AREAS_PROXY_URLS = [
    "/api/lookup/areas"
];
const UNITS_PROXY_URLS = [
    "/api/lookup/units"
];

const MANAGERS_PROXY_URLS = [
    "/api/lookup/managers"
];

const cache = {
    areas: null,
    units: null,
    managersFirstPage: null
};


function normalizeManager(m) {
    return {
        name: (m?.name || m?.nome || m?.managerName || "").trim(),
        email: (m?.email || m?.managerEmail || "").trim(),
        phone: (m?.phone || m?.telefone || "").trim()
    };
}

async function loadManagersLookup(force = false) {
    if (cache.managers && !force) return cache.managers;

    // 1) tenta via proxy no mesmo domínio (evita CORS)
    for (const url of MANAGERS_PROXY_URLS) {
        try {
            const raw = await apiFetchJson(url, { method: "GET" });
            const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
            const list = arr.map(normalizeManager).filter(x => x.name);

            if (list.length) {
                cache.managers = list;
                return list;
            }
        } catch (e) {
            if (e?.status !== 404) console.warn("Falha ao carregar gestores:", url, e);
        }
    }

    // 2) fallback final: deriva de departamentos
    const derived = deriveManagersFromDepartments();
    cache.managers = derived;
    return derived;
}

// ✅ Popula o select do modal
async function fillGestorSelect(selectedName) {
    const select = $("#deptGestor");
    if (!select) return;

    select.replaceChildren();
    select.appendChild(buildOption("", "Selecionar gestor"));

    let items = [];
    try {
        items = await loadManagersLookup();
    } catch (e) {
        console.warn("loadManagersLookup falhou:", e);
        items = [];
    }

    items
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "pt-BR"))
        .forEach(m => {
            const opt = document.createElement("option");
            opt.value = m.name;         // mantém string (managerName)
            opt.textContent = m.name;
            opt.dataset.email = m.email || "";
            opt.dataset.phone = m.phone || "";
            if (selectedName && m.name === selectedName) opt.selected = true;
            select.appendChild(opt);
        });

    // garante seleção mesmo que não exista na lista
    if (selectedName && !Array.from(select.options).some(o => o.value === selectedName)) {
        const opt = document.createElement("option");
        opt.value = selectedName;
        opt.textContent = selectedName;
        opt.selected = true;
        select.appendChild(opt);
    }

    select.value = selectedName || "";
}

function deriveManagersFromDepartments() {
    const map = new Map();
    (state.departamentos || []).forEach(d => {
        const name = (d.gestor || d.managerName || "").trim();
        if (!name) return;

        if (!map.has(name)) {
            map.set(name, {
                name,
                email: (d.email || d.managerEmail || "").trim(),
                phone: (d.telefone || d.phone || "").trim()
            });
        }
    });
    return Array.from(map.values());
}

async function apiFetchJson(url, opts) {
    const res = await fetch(url, {
        headers: { "Accept": "application/json", ...(opts?.headers || {}) },
        ...opts
    });

    if (res.status === 204) return null;

    let body = null;
    try { body = await res.json(); } catch { }

    if (!res.ok) {
        const msg = body?.message || body?.title || `Erro HTTP ${res.status}`;
        throw new Error(msg);
    }
    return body;
}

function looksLikeGuid(s) {
    return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}


const DEPT_API_BASE = "/Departamentos/_api"; // proxy do seu MVC (recomendado)
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";

function fromApiStatus(apiStatus) {
    // API: "Active"/"Inactive" | UI: "ativo"/"inativo"
    const s = (apiStatus || "").toLowerCase();
    if (s === "inactive") return "inativo";
    if (s === "active") return "ativo";
    // caso já venha normalizado do proxy
    if (s === "inativo" || s === "ativo") return s;
    return "ativo";
}

function toApiStatus(uiStatus) {
    const s = (uiStatus || "").toLowerCase();
    return s === "inativo" ? "Inactive" : "Active";
}

async function apiFetch(url, opts) {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        console.error("HTTP", resp.status, url, txt);
        throw new Error(`Erro HTTP ${resp.status} - ${txt}`);
    }
    if (resp.status === 204) return null;

    const ct = resp.headers.get("content-type") || "";
    return ct.includes("application/json") ? resp.json() : resp.text();
}


function normalizeDeptRow(d) {
    d = d || {};

    const pick = (...vals) => {
        for (const v of vals) {
            if (v !== undefined && v !== null && String(v).trim() !== "") return v;
        }
        return "";
    };

    const looksGuid = (s) =>
        typeof s === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());

    const id = pick(d.id);
    const codigo = pick(d.codigo, d.code);
    const nome = pick(d.nome, d.name);

    const gestor = pick(d.gestor, d.managerName);
    const email = pick(d.email, d.managerEmail);
    const telefone = pick(d.telefone, d.phone);

    // ===== FILIAL / LOCATION =====
    const rawLocation = pick(
        d.location, d.branchOrLocation, d.filialId, d.unitId, d.filial
    );

    const filialId = looksGuid(String(rawLocation))
        ? String(rawLocation).trim()
        : pick(d.filialId, d.unitId, "");

    const filialLabel = !looksGuid(String(rawLocation))
        ? String(rawLocation).trim()
        : pick(d.filial, d.locationLabel, "");

    // ✅ ESTE é o campo que sua GRID usa
    // prioridade: label -> cache lookup (se existir) -> raw (guid)
    let filial = filialLabel;

    if (!filial && filialId && cache?.units?.length) {
        const hit = cache.units.find(u => String(u.id) === String(filialId));
        if (hit) filial = buildUnitLabel(hit);
    }

    if (!filial) filial = rawLocation; // não deixa vazio

    const descricao = pick(d.descricao, d.description);
    const headcount = Number.isFinite(+d.headcount) ? (+d.headcount) : 0;

    const rawStatus = pick(d.status);
    const status =
        rawStatus === "ativo" || rawStatus === "inativo"
            ? rawStatus
            : fromApiStatus(rawStatus);

    const vagasOpen =
        d.vagasOpen != null ? +d.vagasOpen :
            d.vacanciesOpen != null ? +d.vacanciesOpen : null;

    const vagasTotal =
        d.vagasTotal != null ? +d.vagasTotal :
            d.vacanciesTotal != null ? +d.vacanciesTotal : null;

    const areaId = pick(d.areaId) || null;
    const areaName = pick(d.areaName) || null;

    return {
        id,
        codigo,
        nome,
        gestor,
        email,
        telefone,

        // ✅ grid
        filial,

        // ✅ modal (seleção por id)
        filialId,
        filialLabel,

        descricao,
        headcount,
        status,
        vagasOpen,
        vagasTotal,
        areaId,
        areaName
    };
}


async function loadDepartmentsFromApi() {
    // o proxy retorna { items, page, ... }
    const data = await apiFetch(DEPT_API_BASE);
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    state.departamentos = items.map(normalizeDeptRow);
}

async function loadVagasFromApi() {
    const data = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
    const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    state.vagas = list;
}

const EMPTY_TEXT = "-";

const state = {
    departamentos: [],
    vagas: [],
    filters: { q: "", status: "all" }
};

function setText(root, role, value, fallback = EMPTY_TEXT) {
    if (!root) return;
    const el = root.querySelector(`[data-role="${role}"]`);
    if (!el) return;
    el.textContent = value ?? fallback;
}

async function apiFetchJson(url, opts) {
    const res = await fetch(url, {
        headers: { "Accept": "application/json", ...(opts?.headers || {}) },
        ...opts
    });

    const contentType = res.headers.get("content-type") || "";
    let bodyText = "";
    let bodyJson = null;

    try { bodyText = await res.text(); } catch { bodyText = ""; }

    // tenta parsear JSON se fizer sentido
    if (bodyText && contentType.includes("application/json")) {
        try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = null; }
    }

    if (res.status === 204) return null;

    if (!res.ok) {
        const msg =
            bodyJson?.message ||
            bodyJson?.title ||
            (bodyText ? bodyText.slice(0, 300) : "") ||
            `Erro HTTP ${res.status}`;

        const err = new Error(msg);
        err.status = res.status;
        err.url = url;
        err.body = bodyJson ?? bodyText;
        err.headers = Object.fromEntries(res.headers.entries());
        throw err;
    }

    // sucesso: retorna JSON ou null se não for JSON
    if (contentType.includes("application/json")) {
        try { return bodyJson ?? JSON.parse(bodyText || "null"); } catch { return null; }
    }

    return bodyText || null;
}


function wireGestorAutoFill() {
    const select = $("#deptGestor");
    if (!select) return;

    select.addEventListener("change", () => {
        const opt = select.selectedOptions?.[0];
        if (!opt) return;

        // Só preenche se estiver vazio (não sobrescreve o que o usuário digitou)
        if ($("#deptEmail") && !$("#deptEmail").value) $("#deptEmail").value = opt.dataset.email || "";
        if ($("#deptTelefone") && !$("#deptTelefone").value) $("#deptTelefone").value = opt.dataset.phone || "";
    });
}


function buildUnitLabel(u) {
    const code = (u.code || "").trim();
    const name = (u.name || "").trim();
    return code ? `${code} — ${name}` : (name || "-");
}
async function fillFilialSelect(selectedId) {
    const select = $("#deptFilial");
    if (!select) return;

    select.replaceChildren();
    select.appendChild(buildOption("", "Selecionar filial/local"));

    const list = await loadUnitsLookup();

    list.forEach(u => {
        const label = buildUnitLabel(u); // ex: "UNI-EMB — Embu das Artes - SP"
        select.appendChild(buildOption(u.id, label, String(u.id) === String(selectedId)));
    });

    // se veio um id que não está na lista, mantém ele visível pra não "perder" seleção
    if (selectedId && !Array.from(select.options).some(o => String(o.value) === String(selectedId))) {
        select.appendChild(buildOption(selectedId, `(atual) ${selectedId}`, true));
    }

    select.value = selectedId ? String(selectedId) : "";
}


const LOOKUP_API_BASE = window.LOOKUP_API_BASE || window.location.origin;

// tenta: /api/lookup/areas e /api/lookups/areas (porque você não tem certeza do path)
async function loadAreasLookup(force = false) {
    if (cache.areas && !force) return cache.areas;

    for (const url of AREAS_PROXY_URLS) {
        try {
            const raw = await apiFetchJson(url, { method: "GET" });
            const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
            cache.areas = arr;
            return arr;
        } catch (e) {
            if (e?.status !== 404) console.warn("Failed to load areas:", url, e);
        }
    }

    cache.areas = [];
    return [];
}


async function loadUnitsLookup(force = false) {
    if (cache.units && !force) return cache.units;

    for (const url of UNITS_PROXY_URLS) {
        try {
            const raw = await apiFetchJson(url, { method: "GET" });
            const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);

            cache.units = arr
                .map(u => ({
                    id: u.id || u.Id || "",
                    code: u.code || u.codigo || u.Code || "",
                    name: u.name || u.nome || u.Name || ""
                }))
                .filter(x => x.name);

            return cache.units;
        } catch (e) {
            if (e?.status !== 404) {
                console.warn("Failed to load units:", url, e);
            }
        }
    }

    cache.units = [];
    return [];
}

// ✅ SELECT COM GUID NO VALUE
async function fillAreaSelect(selectedAreaId) {
    const select = document.querySelector("#deptArea");
    if (!select) return;

    const areas = await loadAreasLookup();

    select.replaceChildren();
    select.appendChild(buildOption("", "Selecionar área"));

    areas
        .filter(a => a && a.id && a.name && a.isActive !== false)
        .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"))
        .forEach(a => {
            const id = String(a.id);
            select.appendChild(buildOption(id, a.name, id === String(selectedAreaId || "")));
        });

    select.value = selectedAreaId ? String(selectedAreaId) : "";
}

function looksLikeGuid(v) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
        .test(String(v || ""));
}




function buildAreaLabel(a) {
    const code = (a.code || "").trim();
    const name = (a.name || "").trim();
    return code ? `${code} — ${name}` : (name || "-");
}


function buildOption(value, label, selected = false) {
    const o = document.createElement("option");
    o.value = value ?? "";
    o.textContent = label ?? "";
    if (selected) o.selected = true;
    return o;
}

function buildDeptStatusBadge(status) {
    const map = {
        ativo: { text: "Ativo", cls: "success" },
        inativo: { text: "Inativo", cls: "secondary" }
    };
    const meta = map[status] || { text: status || "-", cls: "secondary" };
    const span = document.createElement("span");
    span.className = `badge text-bg-${meta.cls} rounded-pill`;
    span.textContent = meta.text;
    return span;
}

function formatVagaStatus(status) {
    const map = {
        aberta: "Aberta",
        pausada: "Pausada",
        fechada: "Fechada",
        rascunho: "Rascunho",
        triagem: "Em triagem",
        entrevistas: "Em entrevistas",
        oferta: "Em oferta",
        congelada: "Congelada"
    };
    return map[status] || status || EMPTY_TEXT;
}

function buildVagaStatusBadge(status) {
    const map = {
        aberta: "success",
        pausada: "warning",
        fechada: "secondary",
        rascunho: "secondary",
        triagem: "info",
        entrevistas: "info",
        oferta: "success",
        congelada: "warning"
    };
    const span = document.createElement("span");
    span.className = `badge text-bg-${map[status] || "primary"} rounded-pill`;
    span.textContent = formatVagaStatus(status);
    return span;
}

function formatDate(iso) {
    if (!iso) return EMPTY_TEXT;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return EMPTY_TEXT;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getDeptVagas(dept) {
    const deptId = dept?.id || dept?.departmentId || "";
    const vagas = state.vagas || [];
    if (deptId) {
        return vagas.filter(v => String(v.departmentId || "").toLowerCase() === String(deptId).toLowerCase());
    }
    const key = normalizeText(dept?.area || dept?.nome || "");
    return vagas.filter(v => normalizeText(v.area || v.areaName || "") === key);
}

function getDeptOpenCount(dept) {
    return getDeptVagas(dept).filter(v => v.status === "aberta").length;
}

function updateKpis() {
    const list = state.departamentos.map(normalizeDeptRow);

    const total = list.length;
    const ativos = list.filter(d => d.status === "ativo").length;
    const headcount = list.reduce((acc, d) => acc + (parseInt(d.headcount, 10) || 0), 0);

    // ✅ se tiver vagasOpen na API, usa soma; senão cai no seed/local
    const anyHasApiVagas = list.some(d => d.vagasOpen != null);
    const openVagas = anyHasApiVagas
        ? list.reduce((acc, d) => acc + (parseInt(d.vagasOpen, 10) || 0), 0)
        : (state.vagas || []).filter(v => (v.status || "").toLowerCase() === "aberta").length;

    $("#kpiDeptTotal").textContent = total;
    $("#kpiDeptActive").textContent = ativos;
    $("#kpiDeptOpenRoles").textContent = openVagas;
    $("#kpiDeptHeadcount").textContent = headcount;
}


function getFiltered() {
    const q = normalizeText(state.filters.q || "");
    const st = state.filters.status;

    return state.departamentos.filter(d => {
        if (st !== "all" && (d.status || "") !== st) return false;
        if (!q) return true;
        const blob = normalizeText([d.nome, d.codigo, d.gestor, d.area].join(" "));
        return blob.includes(q);
    });
}

function renderTable() {
    const tbody = $("#deptTbody");
    if (!tbody) return;
    tbody.replaceChildren();

    const rows = getFiltered();
    $("#deptCount").textContent = rows.length;
    $("#deptHint").textContent = rows.length ? `${rows.length} departamentos encontrados.` : "Nenhum departamento encontrado.";

    if (!rows.length) {
        const empty = cloneTemplate("tpl-dept-empty-row");
        if (empty) tbody.appendChild(empty);
        return;
    }

    rows.forEach(d0 => {
        const d = normalizeDeptRow(d0);
        const tr = cloneTemplate("tpl-dept-row");
        if (!tr) return;

        // iniciais + cor (padrão igual ao cand-list)
        const initHost = tr.querySelector('[data-role="dept-initials"]');
        if (initHost) {
            // escolhe uma chave estável (id > codigo > nome)
            const key = d.id || d.codigo || d.nome || "";
            initHost.textContent = initials(d.nome || d.codigo || "");
            paintInitialsBadge(initHost, key);
            initHost.title = d.nome || "";
        }


        setText(tr, "dept-name", d.nome || EMPTY_TEXT);
        setText(tr, "dept-code", d.codigo || EMPTY_TEXT);
        setText(tr, "dept-gestor", d.gestor || EMPTY_TEXT);
        setText(tr, "dept-email", d.email || EMPTY_TEXT);
        setText(tr, "dept-local", d.filial || EMPTY_TEXT);

        setText(tr, "dept-headcount", d.headcount != null ? String(d.headcount) : "0");

        const statusHost = tr.querySelector('[data-role="dept-status-host"]');
        if (statusHost) statusHost.replaceChildren(buildDeptStatusBadge(d.status));

        // ✅ prioriza vagas vindas da API, senão cai no seed/local:
        const totalVagas = (d.vagasTotal != null) ? d.vagasTotal : getDeptVagas(d).length;
        const abertas = (d.vagasOpen != null) ? d.vagasOpen : getDeptOpenCount(d);
        setText(tr, "dept-vagas", `${abertas}/${totalVagas}`);

        tr.querySelectorAll("button[data-act]").forEach(btn => {
            btn.dataset.id = d.id;
            btn.addEventListener("click", (ev) => {
                ev.preventDefault();
                const act = btn.dataset.act;
                if (act === "detail") openDeptDetail(d.id);
                if (act === "edit") openDeptModal("edit", d.id);
                if (act === "del") deleteDept(d.id);
            });
        });

        tbody.appendChild(tr);
    });
}

// hash simples e estável (FNV-1a)
function hashString(str) {
    str = String(str || "");
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = (h * 16777619) >>> 0;
    }
    return h >>> 0;
}

// gera cor HSL baseada em "key" (sempre igual para o mesmo dept)
function colorFromKey(key) {
    const hue = hashString(key) % 360;
    return {
        bg: `hsl(${hue} 70% 92%)`,
        border: `hsl(${hue} 55% 78%)`,
        fg: `hsl(${hue} 45% 28%)`
    };
}

// aplica as cores no badge (igual seu setText, mas com style)
function paintInitialsBadge(el, key) {
    if (!el) return;
    const c = colorFromKey(key);
    el.style.background = c.bg;
    el.style.borderColor = c.border;
    el.style.color = c.fg;
}

function findDept(id) {
    return state.departamentos.find(d => d.id === id) || null;
}

async function openDeptModal(mode, id) {
    const modal = bootstrap.Modal.getOrCreateInstance($("#modalDept"));
    const isEdit = mode === "edit";
    $("#modalDeptTitle").textContent = isEdit ? "Editar departamento" : "Novo departamento";

    if (isEdit) {
        try {
            const apiDept = await apiFetch(`${DEPT_API_BASE}/${id}`);
            const d = normalizeDeptRow(apiDept);

            await fillAreaSelect(d.areaId || "");
            await fillGestorSelect(d.gestor || "");

            // ✅ aqui é a chave: selecionar pelo ID (GUID)
            let selectedUnitId = d.filialId || "";

            // fallback: se veio só label, tenta achar o id pela lista
            if (!selectedUnitId && d.filialLabel) {
                const units = await loadUnitsLookup();
                const hit = units.find(u => buildUnitLabel(u) === d.filialLabel);
                if (hit) selectedUnitId = hit.id;
            }

            await fillFilialSelect(selectedUnitId);

            $("#deptId").value = d.id || "";
            $("#deptCodigo").value = d.codigo || "";
            $("#deptNome").value = d.nome || "";

            $("#deptStatus").value = d.status || "ativo";
            $("#deptHeadcount").value = String(d.headcount ?? 0);

            $("#deptGestor").value = d.gestor || "";
            $("#deptEmail").value = d.email || "";
            $("#deptTelefone").value = d.telefone || "";

            // ✅ não sobrescreve com label
            if ($("#deptFilial")) $("#deptFilial").value = selectedUnitId ? String(selectedUnitId) : "";

            $("#deptDescricao").value = d.descricao || "";
        } catch (err) {
            console.error(err);
            toast("Falha ao carregar departamento para edição.");
            return;
        }
    } else {
        await fillAreaSelect("");
        await fillGestorSelect("");
        await fillFilialSelect("");

        $("#deptId").value = "";
        $("#deptCodigo").value = "";
        $("#deptNome").value = "";
        $("#deptStatus").value = "ativo";
        $("#deptHeadcount").value = "0";
        $("#deptGestor").value = "";
        $("#deptEmail").value = "";
        $("#deptTelefone").value = "";
        if ($("#deptFilial")) $("#deptFilial").value = "";
        $("#deptDescricao").value = "";
    }

    modal.show();
}



async function saveDeptFromModal() {
    const id = ($("#deptId").value || "").trim() || null;

    const codigo = ($("#deptCodigo").value || "").trim();
    const nome = ($("#deptNome").value || "").trim();

    const areaIdRaw = ($("#deptArea").value || "").trim();
    const areaId = looksLikeGuid(areaIdRaw) ? areaIdRaw : null;

    const statusUi = ($("#deptStatus").value || "ativo").trim();
    const headcount = parseInt($("#deptHeadcount").value, 10) || 0;

    const gestor = ($("#deptGestor").value || "").trim();
    const email = ($("#deptEmail").value || "").trim();
    const phone = ($("#deptTelefone").value || "").trim();
    const description = ($("#deptDescricao").value || "").trim();
    const branchOrLocation = ($("#deptFilial") ? ($("#deptFilial").value || "").trim() : "");

    if (!codigo || !nome) {
        toast("Informe codigo e nome do departamento.");
        return;
    }

    const payload = {
        code: codigo,
        name: nome,
        areaId,                               // ✅ agora vai GUID
        status: toApiStatus(statusUi),        // ✅ "Active"/"Inactive"
        headcount,
        managerName: gestor,
        managerEmail: email,
        phone,
        branchOrLocation,
        description
    };

    const btn = $("#btnSaveDept");
    if (btn) btn.disabled = true;

    try {
        if (id) {
            await apiFetch(`${DEPT_API_BASE}/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            toast("Departamento atualizado.");
        } else {
            await apiFetch(DEPT_API_BASE, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            toast("Departamento criado.");
        }

        await loadDepartmentsFromApi();
        updateKpis();
        renderTable();
        bootstrap.Modal.getOrCreateInstance($("#modalDept")).hide();
    } catch (err) {
        console.error(err);
        toast("Falha ao salvar departamento.");
    } finally {
        if (btn) btn.disabled = false;
    }
}




async function deleteDept(id) {
    const d = findDept(id);
    const nome = d?.nome || "este departamento";
    const ok = confirm(`Excluir o departamento "${nome}"?`);
    if (!ok) return;

    try {
        await apiFetch(`${DEPT_API_BASE}/${id}`, { method: "DELETE" });
        toast("Departamento removido.");

        await loadDepartmentsFromApi();
        updateKpis();
        renderTable();
    } catch (err) {
        console.error(err);
        toast("Falha ao excluir departamento.");
    }
}


function goToVagaDetail(vagaId) {
    if (!vagaId) return;
    const url = new URL("/Vagas", window.location.origin);
    url.searchParams.set("vagaId", vagaId);
    url.searchParams.set("open", "detail");
    window.location.href = url.toString();
}

async function openDeptDetail(id) {
    // o que você já tem
    const d0 = findDept(id);
    if (!d0) return;

    const root = $("#modalDeptDetalhes");
    if (!root) return;

    const modal = bootstrap.Modal.getOrCreateInstance(root);

    // ✅ busca o detalhe completo na API (porque grid não traz description/branchOrLocation)
    let detail = null;
    try {
        // apiFetch pode retornar Response ou JSON; isso cobre os 2 cenários:
        const r = await apiFetch(`${DEPT_API_BASE}/${id}`, { method: "GET" });
        detail = (r && typeof r.json === "function") ? await r.json() : r;
    } catch {
        detail = null;
    }

    // junta o que veio do grid (d0) com o detalhe (detail)
    const d = {
        ...d0,
        // campos do detail (API)
        areaName: detail?.areaName ?? d0.areaName,
        areaId: detail?.areaId ?? d0.areaId,
        description: detail?.description ?? d0.description,
        branchOrLocation: detail?.branchOrLocation ?? d0.branchOrLocation,
        managerName: detail?.managerName ?? d0.managerName,
        managerEmail: detail?.managerEmail ?? d0.managerEmail,
    };

    // ✅ agora preenche tudo (incluindo Local e Descrição)
    setText(root, "dept-name", d.nome || d.name || EMPTY_TEXT);
    setText(root, "dept-code", d.codigo || d.code || EMPTY_TEXT);

    setText(root, "dept-area",
        d.areaName || d.area || d.nome || d.name || EMPTY_TEXT
    );

    setText(root, "dept-gestor",
        d.gestor || d.managerName || EMPTY_TEXT
    );

    setText(root, "dept-email",
        d.email || d.managerEmail || EMPTY_TEXT
    );

    // ✅ faltava preencher local
    setText(root, "dept-local",
        d.local || d.location || d.branchOrLocation || EMPTY_TEXT
    );

    setText(root, "dept-headcount",
        (d.headcount != null ? String(d.headcount) : "0")
    );

    // ✅ descrição agora vem do detail (API)
    setText(root, "dept-desc",
        d.descricao || d.description || EMPTY_TEXT
    );

    const statusHost = root.querySelector('[data-role="dept-status-host"]');
    if (statusHost) statusHost.replaceChildren(buildDeptStatusBadge(d.status));

    // vagas (você já tem)
    const vagas = getDeptVagas(d0);
    $("#deptVagasCount").textContent = vagas.length;

    const tbody = $("#deptVagasTbody");
    tbody.replaceChildren();

    if (!vagas.length) {
        const empty = cloneTemplate("tpl-dept-vaga-empty-row");
        if (empty) tbody.appendChild(empty);
        modal.show();
        return;
    }

    vagas
        .slice()
        .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""))
        .forEach(v => {
            const tr = cloneTemplate("tpl-dept-vaga-row");
            if (!tr) return;
            setText(tr, "vaga-code", v.codigo || EMPTY_TEXT);
            setText(tr, "vaga-title", v.titulo || EMPTY_TEXT);
            setText(tr, "vaga-modalidade", v.modalidade || EMPTY_TEXT);
            setText(tr, "vaga-updated", formatDate(v.updatedAt));
            const statusEl = tr.querySelector('[data-role="vaga-status-host"]');
            if (statusEl) statusEl.replaceChildren(buildVagaStatusBadge(v.status));
            const btn = tr.querySelector('[data-act="open-vaga"]');
            if (btn) btn.addEventListener("click", () => goToVagaDetail(v.id));
            tbody.appendChild(tr);
        });

    modal.show();
}


function exportCsv() {
    const headers = ["Codigo", "Departamento", "Area", "Gestor", "Email", "Telefone", "Headcount", "Status"];
    const rows = state.departamentos.map(d => [
        d.codigo, d.nome, d.area, d.gestor, d.email, d.telefone, d.headcount, d.status
    ]);
    const csv = [
        headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(";"),
        ...rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";"))
    ].join("\r\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "departamentos_liotecnica.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function wireFilters() {
    const apply = () => {
        state.filters.q = ($("#dSearch").value || "").trim();
        state.filters.status = $("#dStatus").value || "all";
        renderTable();
    };

    $("#dSearch").addEventListener("input", apply);
    $("#dStatus").addEventListener("change", apply);

    $("#globalSearchDept").addEventListener("input", () => {
        $("#dSearch").value = $("#globalSearchDept").value;
        apply();
    });
}

function wireButtons() {
    $("#btnNewDept").addEventListener("click", () => openDeptModal("new"));
    $("#btnSaveDept").addEventListener("click", saveDeptFromModal);
    $("#btnSeedReset").addEventListener("click", async () => {
        const ok = confirm("Recarregar dados da API?");
        if (!ok) return;
        try {
            await loadDepartmentsFromApi();
            await loadVagasFromApi();
            updateKpis();
            renderTable();
            toast("Dados recarregados.");
        } catch (err) {
            console.error(err);
            toast("Falha ao recarregar.");
        }
    });

    $("#btnExportDept").addEventListener("click", exportCsv);
}



(async function init() {
    try {
        await loadDepartmentsFromApi();
        await loadVagasFromApi();
    } catch (err) {
        console.error(err);
        toast("Falha ao carregar dados da API.");
        state.departamentos = [];
        state.vagas = [];
    }

    updateKpis();
    renderTable();
    wireGestorAutoFill();
    wireFilters();
    wireButtons();
})();
