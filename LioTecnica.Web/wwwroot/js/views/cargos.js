const CARGOS_API_BASE = "/Cargos/_api";
const AREAS_LOOKUP_URL = "/api/lookup/areas";
const MANAGERS_LOOKUP_URL = "/api/lookup/managers";
const EMPTY_TEXT = "-";

const state = {
  cargos: [],
  managers: [],
  areas: [],
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

function mapStatusFromApi(raw) {
  const s = (raw || "").toString().toLowerCase();
  if (s === "inactive") return "inativo";
  if (s === "active") return "ativo";
  if (s === "inativo" || s === "ativo") return s;
  return "ativo";
}

function toApiStatus(uiStatus) {
  return (uiStatus || "").toLowerCase() === "inativo" ? "Inactive" : "Active";
}

function toEnumName(value) {
  const raw = (value || "").toString().trim();
  if (!raw) return "";
  return raw[0].toUpperCase() + raw.slice(1);
}

function normalizeCargoRow(c) {
  c = c || {};
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  return {
    id: pick(c.id, c.Id),
    codigo: pick(c.codigo, c.code),
    nome: pick(c.nome, c.name),
    area: pick(c.area, c.areaName),
    areaId: pick(c.areaId),
    senioridade: (pick(c.senioridade, c.seniority) || "").toString().toLowerCase(),
    gestores: Number.isFinite(+c.gestores) ? +c.gestores : (Number.isFinite(+c.managersCount) ? +c.managersCount : 0),
    status: mapStatusFromApi(pick(c.status)),
    tipo: pick(c.tipo, c.type),
    descricao: pick(c.descricao, c.description)
  };
}

async function loadCargosFromApi() {
  const params = new URLSearchParams({ page: "1", pageSize: "200" });
  const data = await apiFetchJson(`${CARGOS_API_BASE}?${params.toString()}`, { method: "GET" });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  state.cargos = items.map(normalizeCargoRow);
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

function buildAreaLabel(a) {
  const code = (a.code || "").trim();
  const name = (a.name || "").trim();
  return code ? `${code} — ${name}` : (name || "-");
}

async function fillAreaSelect(selectedId) {
  const select = $("#cargoArea");
  if (!select) return;

  select.replaceChildren();
  select.appendChild(buildOption("", "Selecionar area"));

  const list = await loadAreasLookup();
  list.forEach(a => select.appendChild(buildOption(a.id, buildAreaLabel(a), String(a.id) === String(selectedId))));

  if (selectedId && !Array.from(select.options).some(o => String(o.value) === String(selectedId))) {
    select.appendChild(buildOption(selectedId, `(atual) ${selectedId}`, true));
  }

  select.value = selectedId ? String(selectedId) : "";
}

function getDefaultSenioridade() {
  const list = getEnumOptions("vagaSenioridade");
  const pref = list.find(x => (x.code || "").toString().toLowerCase() === "gerencia" || (x.code || "").toString().toLowerCase() === "gerente");
  return pref ? pref.code : (list[0]?.code || "");
}

function fillSenioridadeSelect(selected) {
  const select = $("#cargoSenioridade");
  if (!select) return;
  select.replaceChildren();
  select.appendChild(buildOption("", "Selecionar senioridade"));
  const list = getEnumOptions("vagaSenioridade");
  const selectedKey = (selected || "").toString().toLowerCase();
  list.forEach(opt => {
    const isSelected = selectedKey && (opt.code || "").toString().toLowerCase() === selectedKey;
    select.appendChild(buildOption(opt.code, opt.text, isSelected));
  });
  if (selected && !list.some(x => (x.code || "").toString().toLowerCase() === selectedKey)) {
    select.appendChild(buildOption(selected, selected, true));
  }
  if (selected) {
    const match = list.find(x => (x.code || "").toString().toLowerCase() === selectedKey);
    select.value = match ? match.code : selected;
  }
}

function buildStatusBadge(status) {
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

function normalizeManager(m) {
  return {
    id: m?.id || m?.Id || "",
    nome: (m?.nome || m?.name || m?.Nome || "").trim(),
    email: (m?.email || m?.Email || "").trim(),
    area: (m?.area || m?.Area || "").trim(),
    unidade: (m?.unidade || m?.Unit || m?.unit || m?.Unidade || "").trim(),
    cargo: (m?.cargo || m?.Cargo || "").trim(),
    headcount: Number.isFinite(+m?.headcount) ? +m.headcount : 0,
    status: mapStatusFromApi(m?.status)
  };
}

async function loadManagersLookup() {
  const all = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 20) {
    const params = new URLSearchParams({ page: String(page), pageSize: "200" });
    const data = await apiFetchJson(`${MANAGERS_LOOKUP_URL}?${params.toString()}`, { method: "GET" });
    const items = Array.isArray(data?.items) ? data.items : [];

    items.forEach(i => all.push(normalizeManager(i)));

    hasMore = Boolean(data?.hasMore);
    page += 1;
  }

  state.managers = all;
}

function getCargoGestores(cargo) {
  const key = normalizeText(cargo?.nome || "");
  if (!key) return [];
  return (state.managers || []).filter(g => normalizeText(g.cargo) === key);
}

function updateKpis() {
  const total = state.cargos.length;
  const ativos = state.cargos.filter(c => c.status === "ativo").length;
  const gestoresCount = state.cargos.reduce((acc, c) => acc + (parseInt(c.gestores, 10) || 0), 0);
  const headcount = (state.managers || []).reduce((acc, g) => acc + (parseInt(g.headcount, 10) || 0), 0);

  $("#kpiCargoTotal").textContent = total;
  $("#kpiCargoActive").textContent = ativos;
  $("#kpiCargoManagers").textContent = gestoresCount;
  $("#kpiCargoHeadcount").textContent = headcount;
}

function getFiltered() {
  const q = normalizeText(state.filters.q || "");
  const st = state.filters.status;

  return state.cargos.filter(c => {
    if (st !== "all" && (c.status || "") !== st) return false;
    if (!q) return true;
    const blob = normalizeText([c.nome, c.codigo, c.area, c.senioridade, c.tipo, c.descricao].join(" "));
    return blob.includes(q);
  });
}

function renderTable() {
  const tbody = $("#cargoTbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const rows = getFiltered();
  $("#cargoCount").textContent = rows.length;
  $("#cargoHint").textContent = rows.length ? `${rows.length} cargos encontrados.` : "Nenhum cargo encontrado.";

  if (!rows.length) {
    const empty = cloneTemplate("tpl-cargo-empty-row");
    if (empty) tbody.appendChild(empty);
    return;
  }

  rows.forEach(c => {
    const tr = cloneTemplate("tpl-cargo-row");
    if (!tr) return;
    setText(tr, "cargo-name", c.nome || EMPTY_TEXT);
    setText(tr, "cargo-code", c.codigo || EMPTY_TEXT);
    setText(tr, "cargo-area", c.area || EMPTY_TEXT);
    setText(tr, "cargo-senioridade", getEnumText("vagaSenioridade", c.senioridade, c.senioridade));
    setText(tr, "cargo-gestores", String(c.gestores || 0));

    const statusHost = tr.querySelector('[data-role="cargo-status-host"]');
    if (statusHost) statusHost.replaceChildren(buildStatusBadge(c.status));

    tr.querySelectorAll("button[data-act]").forEach(btn => {
      btn.dataset.id = c.id;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const act = btn.dataset.act;
        if (act === "detail") openCargoDetail(c.id);
        if (act === "edit") openCargoModal("edit", c.id);
        if (act === "del") deleteCargo(c.id);
      });
    });

    tbody.appendChild(tr);
  });
}

function findCargo(id) {
  return state.cargos.find(c => c.id === id) || null;
}

async function openCargoModal(mode, id) {
  const modal = bootstrap.Modal.getOrCreateInstance($("#modalCargo"));
  const isEdit = mode === "edit";
  $("#modalCargoTitle").textContent = isEdit ? "Editar cargo" : "Novo cargo";

  if (isEdit) {
    try {
      const apiCargo = await apiFetchJson(`${CARGOS_API_BASE}/${id}`, { method: "GET" });
      const c = normalizeCargoRow(apiCargo || findCargo(id) || {});

      await fillAreaSelect(c.areaId || "");
      fillSenioridadeSelect(c.senioridade || getDefaultSenioridade());

      $("#cargoId").value = c.id || "";
      $("#cargoCodigo").value = c.codigo || "";
      $("#cargoNome").value = c.nome || "";
      $("#cargoStatus").value = c.status || "ativo";
      $("#cargoTipo").value = c.tipo || "";
      $("#cargoDescricao").value = c.descricao || "";
    } catch (err) {
      console.error(err);
      toast("Falha ao carregar cargo para edicao.");
      return;
    }
  } else {
    await fillAreaSelect("");
    fillSenioridadeSelect(getDefaultSenioridade());

    $("#cargoId").value = "";
    $("#cargoCodigo").value = "";
    $("#cargoNome").value = "";
    $("#cargoStatus").value = "ativo";
    $("#cargoTipo").value = "";
    $("#cargoDescricao").value = "";
  }

  modal.show();
}

async function saveCargoFromModal() {
  const id = $("#cargoId").value || null;
  const codigo = ($("#cargoCodigo").value || "").trim();
  const nome = ($("#cargoNome").value || "").trim();
  const status = ($("#cargoStatus").value || "ativo").trim();
  const areaId = ($("#cargoArea").value || "").trim();
  const senioridade = ($("#cargoSenioridade").value || "").trim();
  const tipo = ($("#cargoTipo").value || "").trim();
  const descricao = ($("#cargoDescricao").value || "").trim();

  if (!codigo || !nome) {
    toast("Informe codigo e nome do cargo.");
    return;
  }

  if (!areaId) {
    toast("Selecione a area do cargo.");
    return;
  }

  if (!senioridade) {
    toast("Selecione a senioridade do cargo.");
    return;
  }

  const payload = {
    code: codigo,
    name: nome,
    status: toApiStatus(status),
    areaId,
    seniority: toEnumName(senioridade),
    type: tipo,
    description: descricao
  };

  const btn = $("#btnSaveCargo");
  if (btn) btn.disabled = true;

  try {
    if (id) {
      await apiFetchJson(`${CARGOS_API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Cargo atualizado.");
    } else {
      await apiFetchJson(CARGOS_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Cargo criado.");
    }

    await loadCargosFromApi();
    updateKpis();
    renderTable();
    bootstrap.Modal.getOrCreateInstance($("#modalCargo")).hide();
  } catch (err) {
    console.error(err);
    toast("Falha ao salvar cargo.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteCargo(id) {
  const c = findCargo(id);
  const nome = c?.nome || "este cargo";
  const ok = confirm(`Excluir o cargo "${nome}"?`);
  if (!ok) return;

  try {
    await apiFetchJson(`${CARGOS_API_BASE}/${id}`, { method: "DELETE" });
    toast("Cargo removido.");

    await loadCargosFromApi();
    updateKpis();
    renderTable();
  } catch (err) {
    console.error(err);
    toast("Falha ao excluir cargo.");
  }
}

async function openCargoDetail(id) {
  let c = findCargo(id);
  if (!c) return;
  const root = $("#modalCargoDetalhes");
  if (!root) return;
  const modal = bootstrap.Modal.getOrCreateInstance(root);

  try {
    const detail = await apiFetchJson(`${CARGOS_API_BASE}/${id}`, { method: "GET" });
    if (detail) {
      c = { ...c, ...normalizeCargoRow(detail) };
    }
  } catch (err) {
    console.warn("Falha ao carregar detalhes do cargo:", err);
  }

  if (!state.managers.length) {
    try { await loadManagersLookup(); } catch { }
  }

  setText(root, "cargo-name", c.nome || EMPTY_TEXT);
  setText(root, "cargo-code", c.codigo || EMPTY_TEXT);
  setText(root, "cargo-area", c.area || EMPTY_TEXT);
  setText(root, "cargo-senioridade", getEnumText("vagaSenioridade", c.senioridade, c.senioridade));
  setText(root, "cargo-tipo", c.tipo || EMPTY_TEXT);
  setText(root, "cargo-desc", c.descricao || EMPTY_TEXT);

  const statusHost = root.querySelector('[data-role="cargo-status-host"]');
  if (statusHost) statusHost.replaceChildren(buildStatusBadge(c.status));

  const gestores = getCargoGestores(c);
  $("#cargoGestoresCount").textContent = gestores.length;
  const tbody = $("#cargoGestoresTbody");
  tbody.replaceChildren();

  if (!gestores.length) {
    const empty = cloneTemplate("tpl-cargo-gestor-empty-row");
    if (empty) tbody.appendChild(empty);
    modal.show();
    return;
  }

  gestores
    .slice()
    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
    .forEach(g => {
      const tr = cloneTemplate("tpl-cargo-gestor-row");
      if (!tr) return;
      setText(tr, "gestor-name", g.nome || EMPTY_TEXT);
      setText(tr, "gestor-email", g.email || EMPTY_TEXT);
      setText(tr, "gestor-area", g.area || EMPTY_TEXT);
      setText(tr, "gestor-unidade", g.unidade || EMPTY_TEXT);
      setText(tr, "gestor-headcount", g.headcount != null ? String(g.headcount) : "0");
      const statusEl = tr.querySelector('[data-role="gestor-status-host"]');
      if (statusEl) statusEl.replaceChildren(buildStatusBadge(g.status));
      tbody.appendChild(tr);
    });

  modal.show();
}


function exportCsv() {
  const headers = ["Codigo", "Cargo", "Area", "Senioridade", "Tipo", "Status", "Descricao"];
  const rows = state.cargos.map(c => [
    c.codigo, c.nome, c.area, c.senioridade, c.tipo, c.status, c.descricao
  ]);
  const csv = [
    headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(";"),
    ...rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";"))
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "cargos_liotecnica.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireFilters() {
  const apply = () => {
    state.filters.q = ($("#cSearch").value || "").trim();
    state.filters.status = $("#cStatus").value || "all";
    renderTable();
  };

  $("#cSearch").addEventListener("input", apply);
  $("#cStatus").addEventListener("change", apply);

  $("#globalSearchCargo").addEventListener("input", () => {
    $("#cSearch").value = $("#globalSearchCargo").value;
    apply();
  });
}

function wireButtons() {
  $("#btnNewCargo").addEventListener("click", () => openCargoModal("new"));
  $("#btnSaveCargo").addEventListener("click", saveCargoFromModal);
  $("#btnSeedReset").addEventListener("click", async () => {
    const ok = confirm("Recarregar dados da API?");
    if (!ok) return;
    try {
      await loadCargosFromApi();
      await loadManagersLookup();
      updateKpis();
      renderTable();
      toast("Dados recarregados.");
    } catch (err) {
      console.error(err);
      toast("Falha ao recarregar.");
    }
  });
  $("#btnExportCargo").addEventListener("click", exportCsv);
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
  await ensureEnumData();
  applyEnumSelects();

  try {
    await loadCargosFromApi();
    await loadManagersLookup();
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar dados da API.");
    state.cargos = [];
    state.managers = [];
  }

  updateKpis();
  renderTable();

  wireFilters();
  wireButtons();
})();
