const UNIDADES_API_BASE = "/Unidades/_api";
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const EMPTY_TEXT = "-";

const state = {
  unidades: [],
  vagas: [],
  filters: { q: "", status: "all" },
  editingUnit: null
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

function fromApiStatus(apiStatus) {
  const s = (apiStatus || "").toLowerCase();
  if (s === "inactive") return "inativo";
  if (s === "active") return "ativo";
  if (s === "inativo" || s === "ativo") return s;
  return "ativo";
}

function toApiStatus(uiStatus) {
  const s = (uiStatus || "").toLowerCase();
  return s === "inativo" ? "Inactive" : "Active";
}

/** Converte chaves de erro da API em mensagens em português quando a API retorna a chave em vez do texto. */
function unitErrorMessage(msg) {
  if (!msg || typeof msg !== "string") return null;
  const key = msg.trim();
  const map = {
    "ServiceErrors.UnitCodePrefix": "Reinicie a API (RHPortal.Api) para aplicar a atualização. O código da unidade é livre.",
    "ServiceErrors.UnitCodeTooShort": "Informe um código para a unidade.",
    "ServiceErrors.UnitCodeExists": "Já existe uma unidade com esse código.",
    "ServiceErrors.UnitCodeExistsOther": "Já existe outra unidade com esse código.",
    "ServiceErrors.UnitHeadcountNegative": "Headcount não pode ser negativo."
  };
  return map[key] || null;
}

function normalizeUnitRow(u) {
  u = u || {};
  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  return {
    id: pick(u.id, u.Id),
    codigo: pick(u.codigo, u.code),
    nome: pick(u.nome, u.name),
    status: fromApiStatus(pick(u.status)),
    cidade: pick(u.cidade, u.city),
    uf: pick(u.uf, u.state),
    endereco: pick(u.endereco, u.addressLine),
    bairro: pick(u.bairro, u.neighborhood),
    cep: pick(u.cep, u.zipCode),
    email: pick(u.email),
    telefone: pick(u.telefone, u.phone),
    responsavel: pick(u.responsavel, u.responsibleName),
    tipo: pick(u.tipo, u.type),
    headcount: Number.isFinite(+u.headcount) ? (+u.headcount) : 0,
    observacao: pick(u.observacao, u.notes)
  };
}

async function loadUnidadesFromApi() {
  const data = await apiFetchJson(UNIDADES_API_BASE, { method: "GET" });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  state.unidades = items.map(normalizeUnitRow);
}

async function loadVagasFromApi() {
  const data = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
  const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  state.vagas = list;
}

function setText(root, role, value, fallback = EMPTY_TEXT) {
  if (!root) return;
  const el = root.querySelector(`[data-role="${role}"]`);
  if (!el) return;
  el.textContent = value ?? fallback;
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

function unidadeKey(unidade) {
  const text = unidade?.nome || `${unidade?.cidade || ""} - ${unidade?.uf || ""}`.trim();
  return normalizeText(text);
}

function vagaLocalKey(vaga) {
  const parts = [vaga?.cidade, vaga?.uf].filter(Boolean);
  return parts.length ? normalizeText(parts.join(" - ")) : "";
}

function getUnidadeVagas(unidade) {
  const key = unidadeKey(unidade);
  if (!key) return [];
  return (state.vagas || []).filter(v => vagaLocalKey(v) === key);
}

function updateKpis() {
  const total = state.unidades.length;
  const ativos = state.unidades.filter(u => u.status === "ativo").length;
  const headcount = state.unidades.reduce((acc, u) => acc + (parseInt(u.headcount, 10) || 0), 0);
  const openVagas = (state.vagas || []).filter(v => v.status === "aberta" && vagaLocalKey(v)).length;

  $("#kpiUnTotal").textContent = total;
  $("#kpiUnActive").textContent = ativos;
  $("#kpiUnHeadcount").textContent = headcount;
  $("#kpiUnOpenRoles").textContent = openVagas;
}

function getFiltered() {
  const q = normalizeText(state.filters.q || "");
  const st = state.filters.status;

  return state.unidades.filter(u => {
    if (st !== "all" && (u.status || "") !== st) return false;
    if (!q) return true;
    const blob = normalizeText([
      u.nome, u.codigo, u.cidade, u.uf, u.endereco, u.bairro, u.email, u.telefone, u.responsavel, u.tipo
    ].join(" "));
    return blob.includes(q);
  });
}

function renderTable() {
  const tbody = $("#unTbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const rows = getFiltered();
  $("#unCount").textContent = rows.length;
  $("#unHint").textContent = rows.length ? `${rows.length} unidades encontradas.` : "Nenhuma unidade encontrada.";

  if (!rows.length) {
    const empty = cloneTemplate("tpl-un-empty-row");
    if (empty) tbody.appendChild(empty);
    return;
  }

  rows.forEach(u => {
    const tr = cloneTemplate("tpl-un-row");
    if (!tr) return;
    const initialsText = (u.nome || u.codigo || "U").trim().slice(0, 2).toUpperCase();
    setText(tr, "un-initials", initialsText);
    setText(tr, "un-name", u.nome || EMPTY_TEXT);
    setText(tr, "un-code", u.codigo || EMPTY_TEXT);
    setText(tr, "un-headcount", u.headcount != null ? String(u.headcount) : "0");
    setText(tr, "un-email", u.email || EMPTY_TEXT);
    setText(tr, "un-phone", u.telefone || EMPTY_TEXT);
    setText(tr, "un-type", u.tipo || EMPTY_TEXT);

    const statusHost = tr.querySelector('[data-role="un-status-host"]');
    if (statusHost) statusHost.replaceChildren(buildStatusBadge(u.status));

    tr.querySelectorAll("button[data-act]").forEach(btn => {
      btn.dataset.id = u.id;
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        const act = btn.dataset.act;
        if (act === "detail") openUnidadeDetail(u.id);
        if (act === "edit") openUnidadeModal("edit", u.id);
        if (act === "del") deleteUnidade(u.id);
      });
    });

    tbody.appendChild(tr);
  });
}

function findUnidade(id) {
  return state.unidades.find(u => u.id === id) || null;
}

async function openUnidadeModal(mode, id) {
  const modal = bootstrap.Modal.getOrCreateInstance($("#modalUnidade"));
  const isEdit = mode === "edit";
  $("#modalUnidadeTitle").textContent = isEdit ? "Editar unidade" : "Nova unidade";

  if (isEdit) {
    try {
      const apiUnit = await apiFetchJson(`${UNIDADES_API_BASE}/${id}`, { method: "GET" });
      const u = normalizeUnitRow(apiUnit || findUnidade(id) || {});
      state.editingUnit = u;

      $("#unId").value = u.id || "";
      $("#unCodigo").value = u.codigo || "";
      $("#unNome").value = u.nome || "";
      $("#unStatus").value = u.status || "ativo";
      const statusRow = document.getElementById("unStatusRow");
      if (statusRow) statusRow.style.display = "";
    } catch (err) {
      console.error(err);
      toast("Falha ao carregar unidade para edicao.");
      return;
    }
  } else {
    state.editingUnit = null;
    $("#unId").value = "";
    $("#unCodigo").value = "";
    $("#unNome").value = "";
    $("#unStatus").value = "ativo";
    const statusRow = document.getElementById("unStatusRow");
    if (statusRow) statusRow.style.display = "none";
  }

  modal.show();
}

async function saveUnidadeFromModal() {
  const id = $("#unId").value || null;
  const codigo = ($("#unCodigo").value || "").trim();
  const nome = ($("#unNome").value || "").trim();
  const status = id ? (($("#unStatus").value || "ativo").trim()) : "ativo";

  if (!codigo || !nome) {
    toast("Informe código e nome da unidade.");
    return;
  }

  const e = state.editingUnit;
  const opt = (v) => (v != null && String(v).trim() !== "" ? String(v).trim() : null);
  const payload = {
    code: codigo,
    name: nome,
    status: toApiStatus(status),
    city: opt(e?.cidade),
    uf: opt(e?.uf) ? opt(e?.uf).toUpperCase().slice(0, 2) : null,
    addressLine: opt(e?.endereco),
    neighborhood: opt(e?.bairro),
    zipCode: opt(e?.cep),
    email: opt(e?.email),
    phone: opt(e?.telefone),
    responsibleName: opt(e?.responsavel),
    type: opt(e?.tipo),
    headcount: Number.isFinite(+e?.headcount) ? (+e?.headcount) : 0,
    notes: opt(e?.observacao)
  };

  const btn = $("#btnSaveUnidade");
  if (btn) btn.disabled = true;

  try {
    if (id) {
      await apiFetchJson(`${UNIDADES_API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Unidade atualizada.");
    } else {
      await apiFetchJson(UNIDADES_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Unidade criada.");
    }

    await loadUnidadesFromApi();
    updateKpis();
    renderTable();
    bootstrap.Modal.getOrCreateInstance($("#modalUnidade")).hide();
  } catch (err) {
    console.error(err);
    const rawMsg = err?.message || (typeof err?.body === 'object' && err?.body?.message) || "";
    const displayMsg = unitErrorMessage(rawMsg) || rawMsg || "Falha ao salvar unidade.";
    toast(displayMsg);
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteUnidade(id) {
  const u = findUnidade(id);
  const nome = u?.nome || "esta unidade";
  const ok = confirm(`Excluir a unidade "${nome}"?`);
  if (!ok) return;

  try {
    await apiFetchJson(`${UNIDADES_API_BASE}/${id}`, { method: "DELETE" });
    toast("Unidade removida.");

    await loadUnidadesFromApi();
    updateKpis();
    renderTable();
  } catch (err) {
    console.error(err);
    toast("Falha ao excluir unidade.");
  }
}

function goToVagaDetail(vagaId) {
  if (!vagaId) return;
  const url = new URL("/Vagas", window.location.origin);
  url.searchParams.set("vagaId", vagaId);
  url.searchParams.set("open", "detail");
  window.location.href = url.toString();
}

async function renderFuncionariosFromApi(unitId) {
  const body = $("#unFuncionariosTbody");
  if (!body) return;

  body.replaceChildren();
  const trLoading = document.createElement("tr");
  trLoading.innerHTML = `<td colspan="5" class="text-muted py-3">Carregando funcionários...</td>`;
  body.appendChild(trLoading);

  $("#unFuncionariosCount").textContent = "...";

  try {
    const resp = await fetch(`/Unidades/${unitId}/funcionarios`, {
      headers: { "accept": "application/json" }
    });

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    const data = await resp.json();
    const list = Array.isArray(data?.items) ? data.items : [];

    $("#unFuncionariosCount").textContent = list.length;

    body.replaceChildren();

    if (!list.length) {
      const empty = cloneTemplate("tpl-un-funcionario-empty-row");
      if (empty) body.appendChild(empty);
      return;
    }

    list
      .slice()
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
      .forEach(g => {
        const tr = cloneTemplate("tpl-un-funcionario-row");
        if (!tr) return;

        setText(tr, "funcionario-name", g.nome || EMPTY_TEXT);
        setText(tr, "funcionario-email", g.email || EMPTY_TEXT);
        setText(tr, "funcionario-cargo", g.cargo || EMPTY_TEXT);
        setText(tr, "funcionario-area", g.area || EMPTY_TEXT);
        setText(tr, "funcionario-headcount", g.headcount != null ? String(g.headcount) : "0");

        const statusEl = tr.querySelector('[data-role="funcionario-status-host"]');
        if (statusEl) statusEl.replaceChildren(buildStatusBadge(g.status));

        body.appendChild(tr);
      });
  } catch (err) {
    $("#unFuncionariosCount").textContent = "0";
    body.replaceChildren();
    const empty = cloneTemplate("tpl-un-funcionario-empty-row");
    if (empty) body.appendChild(empty);
    toast("Nao foi possivel carregar funcionários desta unidade.");
  }
}

async function openUnidadeDetail(id) {
  const u = findUnidade(id);
  if (!u) return;
  const root = $("#modalUnidadeDetalhes");
  if (!root) return;
  const modal = bootstrap.Modal.getOrCreateInstance(root);

  setText(root, "un-name", u.nome || EMPTY_TEXT);
  setText(root, "un-code", u.codigo || EMPTY_TEXT);
  const addressParts = [u.endereco, u.bairro, u.cidade, u.uf].filter(Boolean);
  setText(root, "un-address", addressParts.join(" - ") || EMPTY_TEXT);
  setText(root, "un-email", u.email || EMPTY_TEXT);
  setText(root, "un-phone", u.telefone || EMPTY_TEXT);
  setText(root, "un-owner", u.responsavel || EMPTY_TEXT);
  setText(root, "un-type", u.tipo || EMPTY_TEXT);

  const statusHost = root.querySelector('[data-role="un-status-host"]');
  if (statusHost) statusHost.replaceChildren(buildStatusBadge(u.status));

  renderFuncionariosFromApi(u.id);

  const vagas = getUnidadeVagas(u);
  $("#unVagasCount").textContent = vagas.length;
  const vagasBody = $("#unVagasTbody");
  vagasBody.replaceChildren();

  if (!vagas.length) {
    const empty = cloneTemplate("tpl-un-vaga-empty-row");
    if (empty) vagasBody.appendChild(empty);
  } else {
    vagas
      .slice()
      .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""))
      .forEach(v => {
        const tr = cloneTemplate("tpl-un-vaga-row");
        if (!tr) return;

        setText(tr, "vaga-code", v.codigo || EMPTY_TEXT);
        setText(tr, "vaga-title", v.titulo || EMPTY_TEXT);
        setText(tr, "vaga-modalidade", v.modalidade || EMPTY_TEXT);
        setText(tr, "vaga-local", formatLocal(v));
        setText(tr, "vaga-updated", formatDate(v.updatedAt));

        const statusEl = tr.querySelector('[data-role="vaga-status-host"]');
        if (statusEl) statusEl.replaceChildren(buildVagaStatusBadge(v.status));

        const btn = tr.querySelector('[data-act="open-vaga"]');
        if (btn) btn.addEventListener("click", () => goToVagaDetail(v.id));

        vagasBody.appendChild(tr);
      });
  }

  modal.show();
}

function exportCsv() {
  const headers = ["Codigo", "Unidade", "Status", "Cidade", "UF", "Endereco", "Bairro", "CEP", "Email", "Telefone", "Responsavel", "Tipo", "Headcount"];
  const rows = state.unidades.map(u => [
    u.codigo, u.nome, u.status, u.cidade, u.uf, u.endereco, u.bairro, u.cep, u.email, u.telefone, u.responsavel, u.tipo, u.headcount
  ]);
  const csv = [
    headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(";"),
    ...rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";"))
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "unidades_liotecnica.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function wireFilters() {
  const apply = () => {
    state.filters.q = ($("#uSearch").value || "").trim();
    state.filters.status = $("#uStatus").value || "all";
    renderTable();
  };

  $("#uSearch").addEventListener("input", apply);
  $("#uStatus").addEventListener("change", apply);

  $("#globalSearchUnidade").addEventListener("input", () => {
    $("#uSearch").value = $("#globalSearchUnidade").value;
    apply();
  });
}

function wireButtons() {
  $("#btnNewUnidade").addEventListener("click", () => openUnidadeModal("new"));
  $("#btnSaveUnidade").addEventListener("click", saveUnidadeFromModal);
  $("#btnSeedReset").addEventListener("click", async () => {
    const ok = confirm("Recarregar dados da API?");
    if (!ok) return;
    try {
      await loadUnidadesFromApi();
      await loadVagasFromApi();
      updateKpis();
      renderTable();
      toast("Dados recarregados.");
    } catch (err) {
      console.error(err);
      toast("Falha ao recarregar.");
    }
  });
  $("#btnExportUnidade").addEventListener("click", exportCsv);
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
    await loadUnidadesFromApi();
    await loadVagasFromApi();
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar dados da API.");
    state.unidades = [];
    state.vagas = [];
  }

  updateKpis();
  renderTable();

  wireFilters();
  wireButtons();
})();
