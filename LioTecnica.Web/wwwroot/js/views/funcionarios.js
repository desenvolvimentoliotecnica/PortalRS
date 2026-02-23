const FUNCIONARIOS_API_BASE = "/Funcionarios/_api";
const AREAS_LOOKUP_URL = "/api/lookup/areas";
const UNITS_LOOKUP_URL = "/api/lookup/units";
const JOB_POSITIONS_LOOKUP_URL = "/api/lookup/job-positions";
const EMPTY_TEXT = "-";

const SYNC_USERS_API = `${FUNCIONARIOS_API_BASE}/users-without-funcionario`;

const state = {
  funcionarios: [],
  areas: [],
  unidades: [],
  cargos: [],
  filters: { q: "", status: "all" },
  syncUsers: [],
  pagination: { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 }
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
      const msg = bodyJson?.message || bodyJson?.title || (bodyText ? bodyText.slice(0, 300) : "") || `Erro HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      err.url = url;
      err.body = bodyJson ?? bodyText;
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

function normalizeFuncionarioRow(f) {
  f = f || {};
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };
  return {
    id: pick(f.id, f.Id),
    nome: pick(f.nome, f.name),
    email: pick(f.email),
    telefone: pick(f.telefone, f.phone),
    status: fromApiStatus(pick(f.status)),
    headcount: Number.isFinite(+f.headcount) ? +f.headcount : 0,
    observacao: pick(f.observacao, f.notes),
    areaId: pick(f.areaId),
    area: pick(f.area, f.areaName),
    unidadeId: pick(f.unidadeId, f.unitId),
    unidade: pick(f.unidade, f.unitName),
    cargoId: pick(f.cargoId, f.jobPositionId),
    cargo: pick(f.cargo, f.jobPositionName)
  };
}

async function loadFuncionariosFromApi(page, pageSize) {
  page = Math.max(1, parseInt(page, 10) || 1);
  pageSize = Math.min(100, Math.max(10, parseInt(pageSize, 10) || state.pagination.pageSize));
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize)
  });
  const search = (state.filters.q || "").trim();
  const status = (state.filters.status || "all").trim();
  if (search) params.set("search", search);
  if (status !== "all") params.set("status", status);
  const url = `${FUNCIONARIOS_API_BASE}?${params.toString()}`;
  let data;
  try {
    data = await apiFetchJson(url, { method: "GET" });
  } catch (err) {
    throw err;
  }
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  state.funcionarios = items.map(normalizeFuncionarioRow);
  state.pagination = {
    page: data.page ?? page,
    pageSize: data.pageSize ?? pageSize,
    totalItems: data.totalItems ?? 0,
    totalPages: data.totalPages ?? 1
  };
  const pageSizeEl = $("#funcionarioPageSize");
  if (pageSizeEl && state.pagination.pageSize) pageSizeEl.value = String(state.pagination.pageSize);
}

async function loadAreasLookup(force = false) {
  if (state.areas.length && !force) return state.areas;
  const raw = await apiFetchJson(AREAS_LOOKUP_URL, { method: "GET" });
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  state.areas = list.map(a => ({ id: a.id || a.Id || "", code: a.code || a.codigo || a.Code || "", name: a.name || a.nome || a.Name || "" })).filter(a => a.name);
  return state.areas;
}

async function loadUnidadesLookup(force = false) {
  if (state.unidades.length && !force) return state.unidades;
  const raw = await apiFetchJson(UNITS_LOOKUP_URL, { method: "GET" });
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  state.unidades = list.map(u => ({ id: u.id || u.Id || "", code: u.code || u.codigo || u.Code || "", name: u.name || u.nome || u.Name || "" })).filter(u => u.name);
  return state.unidades;
}

async function loadCargosLookup(force = false) {
  if (state.cargos.length && !force) return state.cargos;
  const raw = await apiFetchJson(JOB_POSITIONS_LOOKUP_URL, { method: "GET" });
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.items) ? raw.items : []);
  state.cargos = list.map(c => ({ id: c.id || c.Id || "", code: c.code || c.codigo || c.Code || "", name: c.name || c.nome || c.Name || "" })).filter(c => c.name);
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
  const select = $("#funcionarioArea");
  if (!select) return;
  select.replaceChildren();
  select.appendChild(buildOption("", "Selecionar área"));
  const list = await loadAreasLookup();
  list.forEach(a => select.appendChild(buildOption(a.id, buildLabel(a), String(a.id) === String(selectedId))));
  if (selectedId && !Array.from(select.options).some(o => String(o.value) === String(selectedId))) {
    select.appendChild(buildOption(selectedId, `(atual) ${selectedId}`, true));
  }
  select.value = selectedId ? String(selectedId) : "";
}

async function fillUnidadeSelect(selectedId) {
  const select = $("#funcionarioUnidade");
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
  const select = $("#funcionarioCargo");
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
  const map = { ativo: { text: "Ativo", cls: "success" }, inativo: { text: "Inativo", cls: "secondary" } };
  const meta = map[status] || { text: status || "-", cls: "secondary" };
  const span = document.createElement("span");
  span.className = `badge text-bg-${meta.cls} rounded-pill`;
  span.textContent = meta.text;
  return span;
}

function updateKpis() {
  const total = state.pagination.totalItems;
  const ativos = state.funcionarios.filter(g => g.status === "ativo").length;
  const headcount = state.funcionarios.reduce((acc, g) => acc + (parseInt(g.headcount, 10) || 0), 0);
  $("#kpiFuncionarioTotal").textContent = total;
  $("#kpiFuncionarioActive").textContent = ativos;
  $("#kpiFuncionarioHeadcount").textContent = headcount;
}

function renderTable() {
  const tbody = $("#funcionarioTbody");
  if (!tbody) return;
  tbody.replaceChildren();
  const rows = state.funcionarios;
  const p = state.pagination;
  const start = p.totalItems === 0 ? 0 : (p.page - 1) * p.pageSize + 1;
  const end = Math.min(p.page * p.pageSize, p.totalItems);
  $("#funcionarioCount").textContent = rows.length;
  $("#funcionarioHint").textContent = p.totalItems === 0
    ? "Nenhum funcionário encontrado."
    : `${start}–${end} de ${p.totalItems} funcionários.`;

  if (!rows.length) {
    const empty = cloneTemplate("tpl-funcionario-empty-row");
    if (empty) tbody.appendChild(empty);
    return;
  }

  rows.forEach(g => {
    const tr = cloneTemplate("tpl-funcionario-row");
    if (!tr) return;
    setText(tr, "funcionario-nome", g.nome || EMPTY_TEXT);
    setText(tr, "funcionario-cargo", g.cargo || EMPTY_TEXT);
    setText(tr, "funcionario-area", g.area || EMPTY_TEXT);
    setText(tr, "funcionario-email", g.email || EMPTY_TEXT);
    setText(tr, "funcionario-unidade", g.unidade || EMPTY_TEXT);
    setText(tr, "funcionario-headcount", g.headcount != null ? String(g.headcount) : "0");
    const statusHost = tr.querySelector('[data-role="funcionario-status-host"]');
    if (statusHost) statusHost.replaceChildren(buildStatusBadge(g.status));
    tr.querySelectorAll("button[data-act]").forEach(btn => {
      btn.dataset.id = g.id;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const act = btn.dataset.act;
        if (act === "detail") openFuncionarioDetail(g.id);
        if (act === "edit") openFuncionarioModal("edit", g.id);
        if (act === "bloqueio") sendToBloqueioFuncionario(g.id);
        if (act === "del") deleteFuncionario(g.id);
      });
    });
    tbody.appendChild(tr);
  });
}

function findFuncionario(id) {
  return state.funcionarios.find(g => g.id === id) || null;
}

async function openFuncionarioModal(mode, id) {
  const modal = bootstrap.Modal.getOrCreateInstance($("#modalFuncionario"));
  const isEdit = mode === "edit";
  $("#modalFuncionarioTitle").textContent = isEdit ? "Editar funcionário" : "Novo funcionário";

  if (isEdit) {
    try {
      const apiItem = await apiFetchJson(`${FUNCIONARIOS_API_BASE}/${id}`, { method: "GET" });
      const g = normalizeFuncionarioRow(apiItem || findFuncionario(id) || {});
      $("#funcionarioId").value = g.id || "";
      $("#funcionarioNome").value = g.nome || "";
      $("#funcionarioStatus").value = g.status || "ativo";
      $("#funcionarioHeadcount").value = g.headcount != null ? String(g.headcount) : "0";
      $("#funcionarioEmail").value = g.email || "";
      $("#funcionarioTelefone").value = g.telefone || "";
      $("#funcionarioObs").value = g.observacao || "";
      await fillCargoSelect(g.cargoId || "");
      await fillAreaSelect(g.areaId || "");
      await fillUnidadeSelect(g.unidadeId || "");
    } catch (err) {
      console.error(err);
      toast("Falha ao carregar funcionário para edição.");
      return;
    }
  } else {
    $("#funcionarioId").value = "";
    $("#funcionarioNome").value = "";
    $("#funcionarioStatus").value = "ativo";
    $("#funcionarioHeadcount").value = "0";
    $("#funcionarioEmail").value = "";
    $("#funcionarioTelefone").value = "";
    $("#funcionarioObs").value = "";
    await fillCargoSelect("");
    await fillAreaSelect("");
    await fillUnidadeSelect("");
  }
  modal.show();
}

function openFuncionarioDetail(id) {
  openFuncionarioModal("edit", id);
}

async function saveFuncionarioFromModal() {
  const id = $("#funcionarioId").value || null;
  const nome = ($("#funcionarioNome").value || "").trim();
  const email = ($("#funcionarioEmail").value || "").trim();
  const cargoId = ($("#funcionarioCargo").value || "").trim() || null;
  const areaId = ($("#funcionarioArea").value || "").trim() || null;
  const status = ($("#funcionarioStatus").value || "ativo").trim();
  const headcount = parseInt($("#funcionarioHeadcount").value, 10) || 0;
  const telefone = ($("#funcionarioTelefone").value || "").trim() || null;
  const unidadeId = ($("#funcionarioUnidade").value || "").trim() || null;
  const observacao = ($("#funcionarioObs").value || "").trim() || null;

  if (!nome || !email) {
    toast("Informe nome e email do funcionário.");
    return;
  }

  const payload = {
    name: nome,
    email,
    phone: telefone,
    status: (status || "").toLowerCase() === "inativo" ? 2 : 1,
    headcount,
    unitId: unidadeId || null,
    areaId: areaId || null,
    jobPositionId: cargoId || null,
    notes: observacao
  };

  const btn = $("#btnSaveFuncionario");
  if (btn) btn.disabled = true;

  try {
    if (id) {
      await apiFetchJson(`${FUNCIONARIOS_API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Funcionário atualizado.");
    } else {
      await apiFetchJson(FUNCIONARIOS_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Funcionário criado.");
    }
    await loadFuncionariosFromApi(state.pagination.page, state.pagination.pageSize);
    updateKpis();
    renderTable();
    renderPagination();
    bootstrap.Modal.getOrCreateInstance($("#modalFuncionario")).hide();
  } catch (err) {
    console.error(err);
    toast("Falha ao salvar funcionário.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

const BLOQUEIO_PESSOA_API = "/api/bloqueio-pessoa";

async function sendToBloqueioFuncionario(id) {
  const g = findFuncionario(id);
  if (!g) return;
  const ok = confirm(`Enviar "${g.nome}" para Bloqueio de pessoa (blacklist)?`);
  if (!ok) return;
  try {
    await apiFetchJson(`${BLOQUEIO_PESSOA_API}/from-funcionario/${id}`, { method: "POST" });
    toast("Pessoa enviada para Bloqueio de pessoa.");
  } catch (err) {
    console.error(err);
    toast(err?.message || "Falha ao enviar para Bloqueio de pessoa.");
  }
}

async function deleteFuncionario(id) {
  const g = findFuncionario(id);
  if (!g) return;
  const ok = confirm(`Excluir o funcionário "${g.nome}"?`);
  if (!ok) return;
  try {
    await apiFetchJson(`${FUNCIONARIOS_API_BASE}/${id}`, { method: "DELETE" });
    toast("Funcionário removido.");
    await loadFuncionariosFromApi(state.pagination.page, state.pagination.pageSize);
    updateKpis();
    renderTable();
    renderPagination();
  } catch (err) {
    console.error(err);
    toast("Falha ao excluir funcionário.");
  }
}

function exportCsv() {
  const headers = ["Nome", "Cargo", "Área", "Email", "Telefone", "Unidade", "Headcount", "Status"];
  const rows = state.funcionarios.map(g => [g.nome, g.cargo, g.area, g.email, g.telefone, g.unidade, g.headcount, g.status]);
  const csv = [
    headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(";"),
    ...rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";"))
  ].join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "funcionarios_liotecnica.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireFilters() {
  const apply = async () => {
    state.filters.q = ($("#gSearch").value || "").trim();
    state.filters.status = $("#gStatus").value || "all";
    try {
      await loadFuncionariosFromApi(1, state.pagination.pageSize);
      updateKpis();
      renderTable();
      renderPagination();
    } catch (err) {
      console.error(err);
      toast("Falha ao aplicar filtros.");
    }
  };
  const gSearch = $("#gSearch");
  const gStatus = $("#gStatus");
  if (gSearch) gSearch.addEventListener("input", debounce(apply, 350));
  if (gStatus) gStatus.addEventListener("change", apply);
  const globalSearch = $("#globalSearchFuncionario");
  if (globalSearch) globalSearch.addEventListener("input", () => {
    if ($("#gSearch")) $("#gSearch").value = globalSearch.value;
    apply();
  });
}

function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

function renderPagination() {
  const container = $("#funcionarioPagination");
  if (!container) return;
  container.replaceChildren();
  const p = state.pagination;
  if (p.totalPages <= 1 && p.totalItems <= p.pageSize) return;
  const start = (p.page - 1) * p.pageSize + 1;
  const end = Math.min(p.page * p.pageSize, p.totalItems);
  const ul = document.createElement("ul");
  ul.className = "pagination pagination-sm mb-0 flex-wrap";
  const addPage = (label, pageNum, disabled = false, active = false) => {
    const li = document.createElement("li");
    li.className = `page-item ${disabled ? "disabled" : ""} ${active ? "active" : ""}`;
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = label;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (!disabled) goToPage(pageNum);
    });
    li.appendChild(a);
    ul.appendChild(li);
  };
  addPage("Anterior", p.page - 1, p.page <= 1);
  const maxButtons = 5;
  let from = Math.max(1, p.page - Math.floor(maxButtons / 2));
  let to = Math.min(p.totalPages, from + maxButtons - 1);
  if (to - from < maxButtons - 1) from = Math.max(1, to - maxButtons + 1);
  for (let i = from; i <= to; i++) addPage(String(i), i, false, i === p.page);
  addPage("Próxima", p.page + 1, p.page >= p.totalPages);
  container.appendChild(ul);
  const info = document.createElement("span");
  info.className = "text-muted small ms-2 align-self-center";
  info.textContent = `${start}–${end} de ${p.totalItems}`;
  container.appendChild(info);
}

async function goToPage(pageNum) {
  pageNum = Math.max(1, Math.min(state.pagination.totalPages, pageNum));
  try {
    await loadFuncionariosFromApi(pageNum, state.pagination.pageSize);
    updateKpis();
    renderTable();
    renderPagination();
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar página.");
  }
}

function wireButtons() {
  const btnNew = $("#btnNewFuncionario");
  if (btnNew) btnNew.addEventListener("click", () => openFuncionarioModal("new"));
  const btnSave = $("#btnSaveFuncionario");
  if (btnSave) btnSave.addEventListener("click", saveFuncionarioFromModal);
  const btnReset = $("#btnSeedReset");
  if (btnReset) btnReset.addEventListener("click", async () => {
    const ok = confirm("Recarregar dados da API?");
    if (!ok) return;
    try {
      await loadFuncionariosFromApi(state.pagination.page, state.pagination.pageSize);
      updateKpis();
      renderTable();
      renderPagination();
      toast("Dados recarregados.");
    } catch (err) {
      console.error(err);
      toast("Falha ao recarregar.");
    }
  });
  const btnExport = $("#btnExportFuncionario");
  if (btnExport) btnExport.addEventListener("click", exportCsv);

  const pageSizeSelect = $("#funcionarioPageSize");
  if (pageSizeSelect) pageSizeSelect.addEventListener("change", async () => {
    const size = parseInt(pageSizeSelect.value, 10) || 20;
    try {
      await loadFuncionariosFromApi(1, size);
      updateKpis();
      renderTable();
      renderPagination();
    } catch (err) {
      console.error(err);
      toast("Falha ao alterar página.");
    }
  });

  const btnSyncUsers = $("#btnSyncUsers");
  // #region agent log
  try {
    fetch("http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "funcionarios.js:wireButtons", message: "btnSyncUsers bound", data: { btnSyncUsersExists: !!btnSyncUsers }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H1" }) }).catch(() => {});
  } catch (e) {}
  // #endregion
  if (btnSyncUsers) btnSyncUsers.addEventListener("click", openSyncModal);

  const syncSelectAll = $("#syncSelectAll");
  if (syncSelectAll) syncSelectAll.addEventListener("click", () => setSyncCheckboxes(true));
  const syncDeselectAll = $("#syncDeselectAll");
  if (syncDeselectAll) syncDeselectAll.addEventListener("click", () => setSyncCheckboxes(false));
  const syncCheckAll = $("#syncCheckAll");
  if (syncCheckAll) syncCheckAll.addEventListener("change", () => setSyncCheckboxes(syncCheckAll.checked));
  const syncCadastrar = $("#syncCadastrarSelecionados");
  if (syncCadastrar) syncCadastrar.addEventListener("click", cadastrarSelecionadosComoFuncionarios);
}

async function openSyncModal() {
  // #region agent log
  try {
    fetch("http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "funcionarios.js:openSyncModal:entry", message: "openSyncModal called", data: {}, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H2" }) }).catch(() => {});
  } catch (e) {}
  // #endregion
  const modalEl = document.getElementById("modalSyncUsuarios");
  const loading = document.getElementById("syncUsersLoading");
  const empty = document.getElementById("syncUsersEmpty");
  const tableWrap = document.getElementById("syncUsersTableWrap");
  const tbody = document.getElementById("syncUsersTbody");
  const btnCadastrar = document.getElementById("syncCadastrarSelecionados");
  const checkAll = document.getElementById("syncCheckAll");
  // #region agent log
  try {
    fetch("http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "funcionarios.js:openSyncModal:elements", message: "modal elements", data: { modalEl: !!modalEl, loading: !!loading, empty: !!empty, tableWrap: !!tableWrap, tbody: !!tbody }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H2" }) }).catch(() => {});
  } catch (e) {}
  // #endregion
  if (loading) loading.classList.remove("d-none");
  if (empty) {
    empty.textContent = "Nenhum usuário cadastrado no tenant.";
    empty.classList.add("d-none");
  }
  if (tableWrap) tableWrap.classList.add("d-none");
  if (tbody) tbody.replaceChildren();
  if (btnCadastrar) btnCadastrar.disabled = true;
  if (checkAll) checkAll.checked = false;
  let modal;
  try {
    modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
  } catch (modalErr) {
    // #region agent log
    try {
      fetch("http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "funcionarios.js:openSyncModal:modalShow", message: "modal.show threw", data: { errMessage: (modalErr && modalErr.message) || "" }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H2" }) }).catch(() => {});
    } catch (e) {}
    // #endregion
    throw modalErr;
  }

  try {
    const raw = await apiFetchJson(SYNC_USERS_API, { method: "GET" });
    const list = Array.isArray(raw) ? raw : (raw?.items ?? raw?.data ?? []);
    state.syncUsers = Array.isArray(list) ? list : [];
    // #region agent log
    try {
      fetch("http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "funcionarios.js:openSyncModal:afterFetch", message: "sync API success", data: { listLength: (state.syncUsers || []).length, rawIsArray: Array.isArray(raw), rawKeys: raw && typeof raw === "object" ? Object.keys(raw) : [] }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H4,H5" }) }).catch(() => {});
    } catch (e) {}
    // #endregion
  } catch (err) {
    // #region agent log
    try {
      fetch("http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "funcionarios.js:openSyncModal:catch", message: "sync API failed", data: { errMessage: (err && err.message) || "", errStatus: err && err.status, errUrl: err && err.url }, timestamp: Date.now(), sessionId: "debug-session", hypothesisId: "H3" }) }).catch(() => {});
    } catch (e) {}
    // #endregion
    console.error(err);
    state.syncUsers = [];
    if (empty) {
      empty.textContent = "Falha ao carregar usuários.";
      empty.classList.remove("d-none");
    }
    toast("Falha ao carregar usuários sem funcionário.");
  } finally {
    if (loading) loading.classList.add("d-none");
  }

  if (!state.syncUsers.length) {
    if (empty) empty.classList.remove("d-none");
    toast("Nenhum usuário cadastrado no tenant.");
    return;
  }
  if (tableWrap) tableWrap.classList.remove("d-none");
  state.syncUsers.forEach(u => {
    const tr = document.createElement("tr");
    const id = u.id ?? u.Id ?? "";
    const fullName = (u.fullName ?? u.FullName ?? "").trim() || "-";
    const email = (u.email ?? u.Email ?? "").trim() || "-";
    const hasFuncionario = !!(u.hasFuncionario ?? u.HasFuncionario);
    const cbDisabled = hasFuncionario ? " disabled" : "";
    const vinculoText = hasFuncionario ? "Já é funcionário" : "—";
    tr.innerHTML = `
      <td><input type="checkbox" class="form-check-input sync-user-cb" data-id="${id}" data-fullname="${fullName.replace(/"/g, "&quot;")}" data-email="${email.replace(/"/g, "&quot;")}" data-has-funcionario="${hasFuncionario}"${cbDisabled}></td>
      <td>${escapeHtml(fullName)}</td>
      <td>${escapeHtml(email)}</td>
      <td><span class="small ${hasFuncionario ? "text-success" : "text-muted"}">${escapeHtml(vinculoText)}</span></td>
    `;
    tr.querySelector(".sync-user-cb")?.addEventListener("change", updateSyncCadastrarDisabled);
    if (tbody) tbody.appendChild(tr);
  });
  updateSyncCadastrarDisabled();
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s ?? "";
  return div.innerHTML;
}

function setSyncCheckboxes(checked) {
  const checkAll = $("#syncCheckAll");
  document.querySelectorAll(".sync-user-cb:not([disabled])").forEach(cb => { cb.checked = checked; });
  if (checkAll) checkAll.checked = checked;
  updateSyncCadastrarDisabled();
}

function updateSyncCadastrarDisabled() {
  const btn = $("#syncCadastrarSelecionados");
  const checked = document.querySelectorAll(".sync-user-cb:not([disabled]):checked");
  if (btn) btn.disabled = !checked.length;
}

async function cadastrarSelecionadosComoFuncionarios() {
  const checkboxes = document.querySelectorAll(".sync-user-cb:not([disabled]):checked");
  if (!checkboxes.length) return;
  const btn = $("#syncCadastrarSelecionados");
  if (btn) btn.disabled = true;
  let okCount = 0;
  let failCount = 0;
  for (const cb of checkboxes) {
    const id = cb.dataset.id;
    const fullName = cb.dataset.fullname || "";
    const email = cb.dataset.email || "";
    if (!id) continue;
    const payload = { userId: id, name: fullName, email, status: 1, headcount: 0, phone: null, unitId: null, areaId: null, jobPositionId: null, notes: null };
    try {
      await apiFetchJson(FUNCIONARIOS_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      okCount++;
    } catch (err) {
      console.error(err);
      failCount++;
    }
  }
  bootstrap.Modal.getOrCreateInstance($("#modalSyncUsuarios")).hide();
  await loadFuncionariosFromApi(1, state.pagination.pageSize);
  updateKpis();
  renderTable();
  renderPagination();
  if (failCount === 0) toast(`${okCount} funcionário(s) cadastrado(s).`);
  else toast(`${okCount} cadastrado(s), ${failCount} falha(s).`);
  if (btn) btn.disabled = false;
}

function wireClock() {
  const label = $("#nowLabel");
  if (!label) return;
  const tick = () => {
    const d = new Date();
    label.textContent = d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 1000 * 15);
}

(async function init() {
  wireClock();
  try {
    await loadFuncionariosFromApi(1, state.pagination.pageSize);
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar dados da API.");
    state.funcionarios = [];
  }
  try {
    await Promise.allSettled([loadAreasLookup(), loadUnidadesLookup(), loadCargosLookup()]);
  } catch (err) {
    console.warn("Falha ao carregar lookups:", err);
  }
  updateKpis();
  renderTable();
  renderPagination();
  wireFilters();
  wireButtons();
})();
