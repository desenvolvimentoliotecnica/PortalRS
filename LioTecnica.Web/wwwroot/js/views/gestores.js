const GESTORES_API_BASE = "/Gestores/_api";
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const AREAS_LOOKUP_URL = "/api/lookup/areas";
const UNITS_LOOKUP_URL = "/api/lookup/units";
const JOB_POSITIONS_LOOKUP_URL = "/api/lookup/job-positions";
const EMPTY_TEXT = "-";

const state = {
  gestores: [],
  vagas: [],
  areas: [],
  unidades: [],
  cargos: [],
  filters: { q: "", status: "all" }
};

function apiFetchJson(url, opts) {
  return fetch(url, {
    headers: { "Accept": "application/json", ...(opts?.headers || {}) },
    ...opts
  }).then(async (res) => {
    const contentType = res.headers.get("content-type") || "";
    let bodyText = "";
    let bodyJson = null;

    try { bodyText = await res.text(); } catch { bodyText = ""; }

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

    if (contentType.includes("application/json")) {
      try { return bodyJson ?? JSON.parse(bodyText || "null"); } catch { return null; }
    }

    return bodyText || null;
  });
}

function setText(root, role, value, fallback = EMPTY_TEXT) {
  if (!root) return;
  const el = root.querySelector(`[data-role="${role}"]`);
  if (!el) return;
  el.textContent = value ?? fallback;
}

function fromApiStatus(raw) {
  const v = (raw || "").toString().trim().toLowerCase();
  if (v === "active" || v === "ativo" || v === "true" || v === "1") return "ativo";
  if (v === "inactive" || v === "inativo" || v === "false" || v === "0") return "inativo";
  return v || "inativo";
}

function toApiStatus(uiStatus) {
  return (uiStatus || "").toLowerCase() === "inativo" ? "Inactive" : "Active";
}

function normalizeGestorRow(g) {
  g = g || {};
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  return {
    id: pick(g.id, g.Id),
    nome: pick(g.nome, g.name),
    email: pick(g.email),
    telefone: pick(g.telefone, g.phone),
    status: fromApiStatus(pick(g.status)),
    headcount: Number.isFinite(+g.headcount) ? +g.headcount : 0,
    observacao: pick(g.observacao, g.notes),
    areaId: pick(g.areaId),
    area: pick(g.area, g.areaName),
    unidadeId: pick(g.unidadeId, g.unitId),
    unidade: pick(g.unidade, g.unitName),
    cargoId: pick(g.cargoId, g.jobPositionId),
    cargo: pick(g.cargo, g.jobPositionName)
  };
}

async function loadGestoresFromApi() {
  const params = new URLSearchParams({ page: "1", pageSize: "200" });
  const data = await apiFetchJson(`${GESTORES_API_BASE}?${params.toString()}`, { method: "GET" });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  state.gestores = items.map(normalizeGestorRow);
}

async function loadVagasFromApi() {
  const data = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
  const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  state.vagas = list;
}

async function loadAreasLookup(force = false) {
  if (state.areas.length && !force) return state.areas;
  const raw = await apiFetchJson(AREAS_LOOKUP_URL, { method: "GET" });
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  state.areas = list
    .map(a => ({
      id: a.id || a.Id || "",
      code: a.code || a.codigo || a.Code || "",
      name: a.name || a.nome || a.Name || ""
    }))
    .filter(a => a.name);
  return state.areas;
}

async function loadUnidadesLookup(force = false) {
  if (state.unidades.length && !force) return state.unidades;
  const raw = await apiFetchJson(UNITS_LOOKUP_URL, { method: "GET" });
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  state.unidades = list
    .map(u => ({
      id: u.id || u.Id || "",
      code: u.code || u.codigo || u.Code || "",
      name: u.name || u.nome || u.Name || ""
    }))
    .filter(u => u.name);
  return state.unidades;
}

async function loadCargosLookup(force = false) {
  if (state.cargos.length && !force) return state.cargos;
  const raw = await apiFetchJson(JOB_POSITIONS_LOOKUP_URL, { method: "GET" });
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  state.cargos = list
    .map(c => ({
      id: c.id || c.Id || "",
      code: c.code || c.codigo || c.Code || "",
      name: c.name || c.nome || c.Name || ""
    }))
    .filter(c => c.name);
  return state.cargos;
}

function buildOption(value, label, selected = false) {
  const o = document.createElement("option");
  o.value = value ?? "";
  o.textContent = label ?? "";
  if (selected) o.selected = true;
  return o;
}

function buildLabel(item) {
  const code = (item.code || "").trim();
  const name = (item.name || "").trim();
  return code ? `${code} — ${name}` : (name || "-");
}

async function fillAreaSelect(selectedId) {
  const select = $("#gestorArea");
  if (!select) return;
  select.replaceChildren();
  select.appendChild(buildOption("", "Selecionar area"));

  const list = await loadAreasLookup();
  list.forEach(a => select.appendChild(buildOption(a.id, buildLabel(a), String(a.id) === String(selectedId))));

  if (selectedId && !Array.from(select.options).some(o => String(o.value) === String(selectedId))) {
    select.appendChild(buildOption(selectedId, `(atual) ${selectedId}`, true));
  }

  select.value = selectedId ? String(selectedId) : "";
}

async function fillUnidadeSelect(selectedId) {
  const select = $("#gestorUnidade");
  if (!select) return;
  select.replaceChildren();
  select.appendChild(buildOption("", "Selecionar unidade"));

  const list = await loadUnidadesLookup();
  list.forEach(u => select.appendChild(buildOption(u.id, buildLabel(u), String(u.id) === String(selectedId))));

  if (selectedId && !Array.from(select.options).some(o => String(o.value) === String(selectedId))) {
    select.appendChild(buildOption(selectedId, `(atual) ${selectedId}`, true));
  }

  select.value = selectedId ? String(selectedId) : "";
}

async function fillCargoSelect(selectedId) {
  const select = $("#gestorCargo");
  if (!select) return;
  select.replaceChildren();
  select.appendChild(buildOption("", "Selecionar cargo"));

  const list = await loadCargosLookup();
  list.forEach(c => select.appendChild(buildOption(c.id, buildLabel(c), String(c.id) === String(selectedId))));

  if (selectedId && !Array.from(select.options).some(o => String(o.value) === String(selectedId))) {
    select.appendChild(buildOption(selectedId, `(atual) ${selectedId}`, true));
  }

  select.value = selectedId ? String(selectedId) : "";
}

function buildStatusBadge(status) {
  status = fromApiStatus(status);
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

function formatLocal(vaga) {
  const parts = [vaga?.cidade, vaga?.uf].filter(Boolean);
  return parts.length ? parts.join(" - ") : EMPTY_TEXT;
}

function formatDate(iso) {
  if (!iso) return EMPTY_TEXT;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EMPTY_TEXT;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getGestorVagas(gestor) {
  const areaId = gestor?.areaId;
  const vagas = state.vagas || [];
  if (areaId) {
    return vagas.filter(v => String(v.areaId || "").toLowerCase() === String(areaId).toLowerCase());
  }
  const key = normalizeText(gestor?.area || "");
  return vagas.filter(v => normalizeText(v.areaName || v.area || "") === key);
}

function getGestorOpenCount(gestor) {
  return getGestorVagas(gestor).filter(v => v.status === "aberta").length;
}

function updateKpis() {
  const total = state.gestores.length;
  const ativos = state.gestores.filter(g => g.status === "ativo").length;
  const headcount = state.gestores.reduce((acc, g) => acc + (parseInt(g.headcount, 10) || 0), 0);
  const openVagas = (state.vagas || []).filter(v => v.status === "aberta").length;

  $("#kpiGestorTotal").textContent = total;
  $("#kpiGestorActive").textContent = ativos;
  $("#kpiGestorOpenRoles").textContent = openVagas;
  $("#kpiGestorHeadcount").textContent = headcount;
}

function getFiltered() {
  const q = normalizeText(state.filters.q || "");
  const st = state.filters.status;

  return state.gestores.filter(g => {
    if (st !== "all" && (g.status || "") !== st) return false;
    if (!q) return true;
    const blob = normalizeText([g.nome, g.cargo, g.area, g.email, g.unidade].join(" "));
    return blob.includes(q);
  });
}

function renderTable() {
  const tbody = $("#gestorTbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const rows = getFiltered();
  $("#gestorCount").textContent = rows.length;
  $("#gestorHint").textContent = rows.length ? `${rows.length} gestores encontrados.` : "Nenhum gestor encontrado.";

  if (!rows.length) {
    const empty = cloneTemplate("tpl-gestor-empty-row");
    if (empty) tbody.appendChild(empty);
    return;
  }

  rows.forEach(g => {
    const tr = cloneTemplate("tpl-gestor-row");
    if (!tr) return;
    setText(tr, "gestor-nome", g.nome || EMPTY_TEXT);
    setText(tr, "gestor-cargo", g.cargo || EMPTY_TEXT);
    setText(tr, "gestor-area", g.area || EMPTY_TEXT);
    setText(tr, "gestor-email", g.email || EMPTY_TEXT);
    setText(tr, "gestor-unidade", g.unidade || EMPTY_TEXT);
    setText(tr, "gestor-headcount", g.headcount != null ? String(g.headcount) : "0");

    const statusHost = tr.querySelector('[data-role="gestor-status-host"]');
    if (statusHost) statusHost.replaceChildren(buildStatusBadge(g.status));

    const totalVagas = getGestorVagas(g).length;
    const abertas = getGestorOpenCount(g);
    setText(tr, "gestor-vagas", `${abertas}/${totalVagas}`);

    tr.querySelectorAll("button[data-act]").forEach(btn => {
      btn.dataset.id = g.id;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const act = btn.dataset.act;
        if (act === "detail") openGestorDetail(g.id);
        if (act === "edit") openGestorModal("edit", g.id);
        if (act === "del") deleteGestor(g.id);
      });
    });

    tbody.appendChild(tr);
  });
}

function findGestor(id) {
  return state.gestores.find(g => g.id === id) || null;
}

async function openGestorModal(mode, id) {
  const modal = bootstrap.Modal.getOrCreateInstance($("#modalGestor"));
  const isEdit = mode === "edit";
  $("#modalGestorTitle").textContent = isEdit ? "Editar gestor" : "Novo gestor";

  if (isEdit) {
    try {
      const apiGestor = await apiFetchJson(`${GESTORES_API_BASE}/${id}`, { method: "GET" });
      const g = normalizeGestorRow(apiGestor || findGestor(id) || {});

      $("#gestorId").value = g.id || "";
      $("#gestorNome").value = g.nome || "";
      $("#gestorStatus").value = g.status || "ativo";
      $("#gestorHeadcount").value = g.headcount != null ? String(g.headcount) : "0";
      $("#gestorEmail").value = g.email || "";
      $("#gestorTelefone").value = g.telefone || "";
      $("#gestorObs").value = g.observacao || "";

      await fillCargoSelect(g.cargoId || "");
      await fillAreaSelect(g.areaId || "");
      await fillUnidadeSelect(g.unidadeId || "");
    } catch (err) {
      console.error(err);
      toast("Falha ao carregar gestor para edicao.");
      return;
    }
  } else {
    $("#gestorId").value = "";
    $("#gestorNome").value = "";
    $("#gestorStatus").value = "ativo";
    $("#gestorHeadcount").value = "0";
    $("#gestorEmail").value = "";
    $("#gestorTelefone").value = "";
    $("#gestorObs").value = "";

    await fillCargoSelect("");
    await fillAreaSelect("");
    await fillUnidadeSelect("");
  }

  modal.show();
}

async function saveGestorFromModal() {
  const id = $("#gestorId").value || null;
  const nome = ($("#gestorNome").value || "").trim();
  const cargoId = ($("#gestorCargo").value || "").trim();
  const areaId = ($("#gestorArea").value || "").trim();
  const status = ($("#gestorStatus").value || "ativo").trim();
  const headcount = parseInt($("#gestorHeadcount").value, 10) || 0;
  const email = ($("#gestorEmail").value || "").trim();
  const telefone = ($("#gestorTelefone").value || "").trim();
  const unidadeId = ($("#gestorUnidade").value || "").trim();
  const observacao = ($("#gestorObs").value || "").trim();

  if (!nome || !email || !cargoId || !areaId || !unidadeId) {
    toast("Informe nome, email, cargo, area e unidade do gestor.");
    return;
  }

  const payload = {
    name: nome,
    email,
    phone: telefone,
    status: toApiStatus(status),
    headcount,
    unitId: unidadeId,
    areaId,
    jobPositionId: cargoId,
    notes: observacao
  };

  const btn = $("#btnSaveGestor");
  if (btn) btn.disabled = true;

  try {
    if (id) {
      await apiFetchJson(`${GESTORES_API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Gestor atualizado.");
    } else {
      await apiFetchJson(GESTORES_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Gestor criado.");
    }

    await loadGestoresFromApi();
    await loadVagasFromApi();
    updateKpis();
    renderTable();
    bootstrap.Modal.getOrCreateInstance($("#modalGestor")).hide();
  } catch (err) {
    console.error(err);
    toast("Falha ao salvar gestor.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteGestor(id) {
  const g = findGestor(id);
  if (!g) return;
  const ok = confirm(`Excluir o gestor "${g.nome}"?`);
  if (!ok) return;

  try {
    await apiFetchJson(`${GESTORES_API_BASE}/${id}`, { method: "DELETE" });
    toast("Gestor removido.");

    await loadGestoresFromApi();
    await loadVagasFromApi();
    updateKpis();
    renderTable();
  } catch (err) {
    console.error(err);
    toast("Falha ao excluir gestor.");
  }
}

function goToVagaDetail(vagaId) {
  if (!vagaId) return;
  const url = new URL("/Vagas", window.location.origin);
  url.searchParams.set("vagaId", vagaId);
  url.searchParams.set("open", "detail");
  window.location.href = url.toString();
}

async function openGestorDetail(id) {
  let g = findGestor(id);
  if (!g) return;
  const root = $("#modalGestorDetalhes");
  if (!root) return;
  const modal = bootstrap.Modal.getOrCreateInstance(root);

  try {
    const detail = await apiFetchJson(`${GESTORES_API_BASE}/${id}`, { method: "GET" });
    if (detail) g = { ...g, ...normalizeGestorRow(detail) };
  } catch (err) {
    console.warn("Falha ao carregar detalhes do gestor:", err);
  }

  setText(root, "gestor-nome", g.nome || EMPTY_TEXT);
  setText(root, "gestor-cargo", g.cargo || EMPTY_TEXT);
  setText(root, "gestor-area", g.area || EMPTY_TEXT);
  setText(root, "gestor-email", g.email || EMPTY_TEXT);
  setText(root, "gestor-unidade", g.unidade || EMPTY_TEXT);
  setText(root, "gestor-telefone", g.telefone || EMPTY_TEXT);
  setText(root, "gestor-obs", g.observacao || EMPTY_TEXT);
  setText(root, "gestor-headcount", g.headcount != null ? String(g.headcount) : "0");

  const statusHost = root.querySelector('[data-role="gestor-status-host"]');
  if (statusHost) statusHost.replaceChildren(buildStatusBadge(g.status));

  const vagas = getGestorVagas(g);
  $("#gestorVagasCount").textContent = vagas.length;

  const tbody = $("#gestorVagasTbody");
  tbody.replaceChildren();
  if (!vagas.length) {
    const empty = cloneTemplate("tpl-gestor-vaga-empty-row");
    if (empty) tbody.appendChild(empty);
    modal.show();
    return;
  }

  vagas
    .slice()
    .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""))
    .forEach(v => {
      const tr = cloneTemplate("tpl-gestor-vaga-row");
      if (!tr) return;
      setText(tr, "vaga-code", v.codigo || EMPTY_TEXT);
      setText(tr, "vaga-title", v.titulo || EMPTY_TEXT);
      setText(tr, "vaga-modalidade", v.modalidade || EMPTY_TEXT);
      setText(tr, "vaga-local", formatLocal(v));
      setText(tr, "vaga-updated", formatDate(v.updatedAtUtc || v.updatedAt));
      const statusEl = tr.querySelector('[data-role="vaga-status-host"]');
      if (statusEl) statusEl.replaceChildren(buildVagaStatusBadge(v.status));
      const btn = tr.querySelector('[data-act="open-vaga"]');
      if (btn) btn.addEventListener("click", () => goToVagaDetail(v.id));
      tbody.appendChild(tr);
    });

  modal.show();
}

function exportCsv() {
  const headers = ["Nome", "Cargo", "Area", "Email", "Telefone", "Unidade", "Headcount", "Status"];
  const rows = state.gestores.map(g => [
    g.nome, g.cargo, g.area, g.email, g.telefone, g.unidade, g.headcount, g.status
  ]);
  const csv = [
    headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(";"),
    ...rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";"))
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gestores_liotecnica.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireFilters() {
  const apply = () => {
    state.filters.q = ($("#gSearch").value || "").trim();
    state.filters.status = $("#gStatus").value || "all";
    renderTable();
  };

  $("#gSearch").addEventListener("input", apply);
  $("#gStatus").addEventListener("change", apply);

  $("#globalSearchGestor").addEventListener("input", () => {
    $("#gSearch").value = $("#globalSearchGestor").value;
    apply();
  });
}

function wireButtons() {
  $("#btnNewGestor").addEventListener("click", () => openGestorModal("new"));
  $("#btnSaveGestor").addEventListener("click", saveGestorFromModal);
  $("#btnSeedReset").addEventListener("click", async () => {
    const ok = confirm("Recarregar dados da API?");
    if (!ok) return;
    try {
      await loadGestoresFromApi();
      await loadVagasFromApi();
      updateKpis();
      renderTable();
      toast("Dados recarregados.");
    } catch (err) {
      console.error(err);
      toast("Falha ao recarregar.");
    }
  });
  $("#btnExportGestor").addEventListener("click", exportCsv);
}

function wireClock() {
  const label = $("#nowLabel");
  if (!label) return;
  const tick = () => {
    const d = new Date();
    label.textContent = d.toLocaleString("pt-BR", {
      weekday: "short", day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  };
  tick();
  setInterval(tick, 1000 * 15);
}

(async function init() {
  wireClock();

  try {
    await loadGestoresFromApi();
    await loadVagasFromApi();
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar dados da API.");
    state.gestores = [];
    state.vagas = [];
  }

  try {
    await Promise.allSettled([
      loadAreasLookup(),
      loadUnidadesLookup(),
      loadCargosLookup()
    ]);
  } catch (err) {
    console.warn("Falha ao carregar lookups:", err);
  }

  updateKpis();
  renderTable();

  wireFilters();
  wireButtons();
})();
