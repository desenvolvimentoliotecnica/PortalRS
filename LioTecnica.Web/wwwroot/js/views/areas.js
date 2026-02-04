const AREAS_API_BASE = "/Areas/_api";
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const CAN_WRITE = true;
const EMPTY_TEXT = "-";

const state = {
  areas: [],
  funcionarios: [],
  vagas: [],
  filters: { q: "", status: "all" },
  collapsedIds: new Set()
};

const FUNCIONARIOS_LOOKUP_URL = window.__funcionariosLookupUrl || "/api/lookup/funcionarios";
const FUNCIONARIOS_API_URL = window.__funcionariosApiUrl || "/api/lookup/funcionarios";

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

function mapStatusFromApi(area) {
  if (area?.status) {
    const s = String(area.status).toLowerCase();
    if (s === "inactive") return "inativo";
    if (s === "active") return "ativo";
    if (s === "inativo" || s === "ativo") return s;
  }

  if (area?.isActive === false) return "inativo";
  if (area?.isActive === true) return "ativo";

  return "ativo";
}

function areaKey(id) {
  return id == null ? null : String(id).trim().toLowerCase();
}

function normalizeAreaRow(area) {
  area = area || {};

  const pick = (...vals) => {
    for (const v of vals) {
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return "";
  };

  const id = pick(area.id, area.Id);
  return {
    id,
    codigo: pick(area.codigo, area.code),
    nome: pick(area.nome, area.name),
    descricao: pick(area.descricao, area.description),
    status: mapStatusFromApi(area),
    parentId: area.parentId ?? area.ParentId ?? null,
    ownerFuncionarioId: area.ownerFuncionarioId ?? area.OwnerFuncionarioId ?? area.ownerManagerId ?? area.OwnerManagerId ?? null
  };
}

async function loadAreasFromApi() {
  const data = await apiFetchJson(AREAS_API_BASE, { method: "GET" });
  const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
  state.areas = items.map(normalizeAreaRow);
  // #region agent log
  const root = state.areas.find(a => !a.parentId);
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'areas.js:loadAreasFromApi',message:'after load',data:{count:state.areas.length,firstRootNome:root?.nome,apiHasItems:!!data?.items},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H-load'})}).catch(()=>{});
  // #endregion
}

async function loadFuncionariosFromApi() {
  try {
    const url = `${FUNCIONARIOS_API_URL}?onlyActive=true&page=1&pageSize=500`;
    const data = await apiFetchJson(url, { method: "GET" });
    const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
    state.funcionarios = list.map(f => ({
      id: f.id ?? f.Id,
      name: f.nome ?? f.name ?? f.Nome ?? f.Name ?? f.email ?? f.Email ?? EMPTY_TEXT
    }));
  } catch (e) {
    console.warn("loadFuncionariosFromApi", e);
    state.funcionarios = [];
  }
}

function getAreasSortedByHierarchy(areas) {
  const byId = new Map(areas.map(a => [areaKey(a.id), { ...a, depth: 0 }]));
  const roots = [];
  for (const a of byId.values()) {
    const parentId = a.parentId || null;
    const parentKey = areaKey(parentId);
    if (!parentKey || !byId.has(parentKey)) roots.push(a);
  }
  const out = [];
  function add(node, depth) {
    const n = { ...node, depth };
    out.push(n);
    const nodeKey = areaKey(node.id);
    const children = areas.filter(a => areaKey(a.parentId) === nodeKey);
    children.forEach(c => add(byId.get(areaKey(c.id)) || c, depth + 1));
  }
  roots.forEach(r => add(r, 0));
  return out;
}

/** Builds a tree of areas: roots have .children (sorted by name). Each node is { ...area, children: [] }. */
function buildAreaTree(areas) {
  const byId = new Map(areas.map(a => [areaKey(a.id), { ...a, children: [] }]));
  const roots = [];
  for (const a of byId.values()) {
    const parentKey = areaKey(a.parentId);
    if (!parentKey || !byId.has(parentKey)) {
      roots.push(a);
    } else {
      const parent = byId.get(parentKey);
      if (parent) parent.children.push(a);
    }
  }
  const sortByName = (list) => list.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  sortByName(roots);
  function sortChildren(nodes) {
    nodes.forEach(n => {
      if (n.children && n.children.length) {
        sortByName(n.children);
        sortChildren(n.children);
      }
    });
  }
  sortChildren(roots);
  return roots;
}

/** Collects area keys of all nodes that have children (for initial "all collapsed" state). */
function collectNodeIdsWithChildren(roots) {
  const keys = new Set();
  function walk(nodes) {
    for (const n of nodes) {
      if (n.children && n.children.length) {
        keys.add(areaKey(n.id));
        walk(n.children);
      }
    }
  }
  walk(roots);
  return keys;
}

/** Walks tree in depth order; yields only visible nodes (ancestors not collapsed). Yields { node, depth, hasChildren }. */
function* walkTreeVisible(roots, collapsedIds) {
  function* walk(nodes, depth, ancestorCollapsed) {
    for (const node of nodes) {
      if (ancestorCollapsed) continue;
      const hasChildren = node.children && node.children.length > 0;
      const isCollapsed = hasChildren && collapsedIds.has(areaKey(node.id));
      yield { node, depth, hasChildren, isCollapsed };
      if (hasChildren && !isCollapsed) {
        yield* walk(node.children, depth + 1, false);
      }
    }
  }
  yield* walk(roots, 0, false);
}

async function loadVagasFromApi() {
  const data = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
  const list = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  state.vagas = list;
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

function getAreaVagas(area) {
  const areaId = area?.id;
  const vagas = state.vagas || [];
  if (areaId) {
    return vagas.filter(v => String(v.areaId || "").toLowerCase() === String(areaId).toLowerCase());
  }
  const key = normalizeText(area?.nome || "");
  return vagas.filter(v => normalizeText(v.areaName || v.area || "") === key);
}

function getAreaOpenCount(area) {
  return getAreaVagas(area).filter(v => v.status === "aberta").length;
}

function updateKpis() {
  const total = state.areas.length;
  const ativos = state.areas.filter(a => a.status === "ativo").length;
  const vagas = state.vagas || [];
  const openVagas = vagas.filter(v => v.status === "aberta").length;

  $("#kpiAreaTotal").textContent = total;
  $("#kpiAreaActive").textContent = ativos;
  $("#kpiAreaOpenRoles").textContent = openVagas;
  $("#kpiAreaTotalRoles").textContent = vagas.length;
}

function getFiltered() {
  const q = normalizeText(state.filters.q || "");
  const st = state.filters.status;

  return state.areas.filter(a => {
    if (st !== "all" && (a.status || "") !== st) return false;
    if (!q) return true;
    const blob = normalizeText([a.nome, a.codigo, a.descricao].join(" "));
    return blob.includes(q);
  });
}

/** Returns all ancestor keys (parent, grandparent, ...) for an area so the hierarchy stays visible when filtering. */
function getAncestorKeys(area) {
  const keys = new Set();
  let parentKey = areaKey(area?.parentId);
  while (parentKey) {
    const parent = state.areas.find(a => areaKey(a.id) === parentKey);
    if (!parent) break;
    keys.add(areaKey(parent.id));
    parentKey = areaKey(parent.parentId);
  }
  return keys;
}

function getParentName(area) {
  if (!area?.parentId) return EMPTY_TEXT;
  const p = state.areas.find(a => a.id === area.parentId);
  return p ? (p.nome || p.codigo || EMPTY_TEXT) : EMPTY_TEXT;
}

function getOwnerName(area) {
  const ownerId = area?.ownerFuncionarioId ?? area?.ownerManagerId;
  if (!ownerId) return EMPTY_TEXT;
  const f = (state.funcionarios || []).find(x => x.id === ownerId);
  return f ? (f.name || EMPTY_TEXT) : EMPTY_TEXT;
}

function renderTable() {
  const tbody = $("#areaTbody");
  if (!tbody) return;
  tbody.replaceChildren();

  const filtered = getFiltered();
  const tree = buildAreaTree(state.areas);
  const filteredSet = new Set(filtered.map(a => areaKey(a.id)));
  filtered.forEach(a => getAncestorKeys(a).forEach(k => filteredSet.add(k)));
  const visibleRows = [...walkTreeVisible(tree, state.collapsedIds)].filter(({ node }) => filteredSet.has(areaKey(node.id)));

  // #region agent log
  const firstVisibleNome = visibleRows.length ? visibleRows[0].node.nome : null;
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'areas.js:renderTable:visible',message:'visibleRows first',data:{visibleCount:visibleRows.length,firstVisibleNome,allVisibleNomes:visibleRows.map(r=>r.node.nome)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H-visible'})}).catch(()=>{});
  // #endregion

  $("#areaCount").textContent = visibleRows.length;
  $("#areaHint").textContent = visibleRows.length ? `${visibleRows.length} areas encontradas.` : "Nenhuma area encontrada.";

  if (!visibleRows.length) {
    const empty = cloneTemplate("tpl-area-empty-row");
    if (empty) tbody.appendChild(empty);
    return;
  }

  for (const { node: a, depth, hasChildren, isCollapsed } of visibleRows) {
    const tr = cloneTemplate("tpl-area-row");
    if (!tr) return;
    const toggleBtn = tr.querySelector('[data-role="area-toggle"]');
    const labelWrap = tr.querySelector(".area-tree-label");
    if (toggleBtn) {
      if (hasChildren) {
        toggleBtn.style.visibility = "visible";
        toggleBtn.innerHTML = "";
        const icon = document.createElement("i");
        icon.className = isCollapsed ? "bi bi-chevron-right" : "bi bi-chevron-down";
        toggleBtn.appendChild(icon);
        toggleBtn.dataset.id = a.id;
        const key = areaKey(a.id);
        toggleBtn.onclick = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (state.collapsedIds.has(key)) state.collapsedIds.delete(key);
          else state.collapsedIds.add(key);
          renderTable();
        };
      } else {
        toggleBtn.style.visibility = "hidden";
        toggleBtn.innerHTML = "";
        toggleBtn.onclick = null;
      }
    }
    if (labelWrap) labelWrap.style.paddingLeft = (depth || 0) * 2 + "rem";
    const nameCell = tr.querySelector('[data-role="area-name"]');
    if (nameCell) nameCell.textContent = a.nome || EMPTY_TEXT;
    setText(tr, "area-code", a.codigo || EMPTY_TEXT);
    setText(tr, "area-parent", getParentName(a));
    setText(tr, "area-owner", getOwnerName(a));
    setText(tr, "area-desc", a.descricao || EMPTY_TEXT);
    const statusHost = tr.querySelector('[data-role="area-status-host"]');
    if (statusHost) statusHost.replaceChildren(buildStatusBadge(a.status));

    const totalVagas = getAreaVagas(a).length;
    const abertas = getAreaOpenCount(a);
    setText(tr, "area-vagas", `${abertas}/${totalVagas}`);

    tr.querySelectorAll("button[data-act]").forEach(btn => {
      btn.dataset.id = a.id;
      const act = btn.dataset.act;
      if (!CAN_WRITE && (act === "edit" || act === "del")) {
        btn.disabled = true;
        btn.title = "API ainda nao oferece edicao";
        return;
      }

      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (act === "detail") openAreaDetail(a.id);
        if (act === "edit") openAreaModal("edit", a.id);
        if (act === "del") deleteArea(a.id);
      });
    });

    tbody.appendChild(tr);
  }

  // #region agent log
  const firstTr = tbody.querySelector("tr");
  const firstCellName = firstTr ? (firstTr.querySelector("[data-role=\"area-name\"]")?.textContent || null) : null;
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'areas.js:renderTable:dom',message:'first row in DOM after append',data:{tbodyRows:tbody.children.length,firstRowNameInDom:firstCellName},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H-dom'})}).catch(()=>{});
  // #endregion
}

function findArea(id) {
  return state.areas.find(a => a.id === id) || null;
}

function fillParentSelect(excludeId) {
  const sel = $("#areaParentId");
  if (!sel) return;
  const opts = [{ value: "", text: "Nenhuma (raiz)" }];
  const sorted = getAreasSortedByHierarchy(state.areas);
  sorted.forEach(a => {
    if (a.id === excludeId) return;
    const indent = (a.depth || 0) > 0 ? "\u00A0\u00A0".repeat(a.depth) + "\u2514 " : "";
    opts.push({ value: a.id, text: indent + (a.nome || a.codigo || a.id) });
  });
  sel.replaceChildren(...opts.map(o => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.text;
    return opt;
  }));
}

function fillOwnerSelect() {
  const sel = $("#areaOwnerFuncionarioId");
  if (!sel) return;
  const opts = [{ value: "", text: "Nenhum" }];
  const list = (state.funcionarios && state.funcionarios.length > 0) ? state.funcionarios : (state.managers || []);
  list.forEach(m => {
    opts.push({ value: m.id, text: m.name || m.id });
  });
  sel.replaceChildren(...opts.map(o => {
    const opt = document.createElement("option");
    opt.value = o.value;
    opt.textContent = o.text;
    return opt;
  }));
}

function openAreaModal(mode, id) {
  const modal = bootstrap.Modal.getOrCreateInstance($("#modalArea"));
  const isEdit = mode === "edit";
  $("#modalAreaTitle").textContent = isEdit ? "Editar area" : "Nova area";

  fillParentSelect(isEdit ? id : null);
  fillOwnerSelect();

  if (isEdit) {
    const a = findArea(id);
    if (!a) return;
    $("#areaId").value = a.id || "";
    $("#areaCodigo").value = a.codigo || "";
    $("#areaNome").value = a.nome || "";
    $("#areaStatus").value = a.status || "ativo";
    $("#areaDescricao").value = a.descricao || "";
    $("#areaParentId").value = a.parentId || "";
    $("#areaOwnerFuncionarioId").value = a.ownerManagerId || a.ownerFuncionarioId || "";
  } else {
    $("#areaId").value = "";
    $("#areaCodigo").value = "";
    $("#areaNome").value = "";
    $("#areaStatus").value = "ativo";
    $("#areaDescricao").value = "";
    $("#areaParentId").value = "";
    $("#areaOwnerFuncionarioId").value = "";
  }

  modal.show();
}

async function saveAreaFromModal() {
  const id = $("#areaId").value || null;
  const codigo = ($("#areaCodigo").value || "").trim();
  const nome = ($("#areaNome").value || "").trim();
  const status = ($("#areaStatus").value || "ativo").trim();
  const descricao = ($("#areaDescricao").value || "").trim();
  const parentIdVal = ($("#areaParentId").value || "").trim();
  const ownerFuncionarioIdVal = ($("#areaOwnerFuncionarioId").value || "").trim();

  if (!codigo || !nome) {
    toast("Informe codigo e nome da area.");
    return;
  }

  const payload = {
    code: codigo,
    name: nome,
    description: descricao,
    isActive: status === "ativo",
    parentId: parentIdVal ? parentIdVal : null,
    ownerFuncionarioId: ownerFuncionarioIdVal ? ownerFuncionarioIdVal : null
  };

  const btn = $("#btnSaveArea");
  if (btn) btn.disabled = true;

  try {
    if (id) {
      await apiFetchJson(`${AREAS_API_BASE}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Area atualizada.");
    } else {
      await apiFetchJson(AREAS_API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      toast("Area criada.");
    }

    await loadAreasFromApi();
    updateKpis();
    renderTable();
    bootstrap.Modal.getOrCreateInstance($("#modalArea")).hide();
  } catch (err) {
    console.error(err);
    toast("Falha ao salvar area.");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteArea(id) {
  const a = findArea(id);
  const nome = a?.nome || "esta area";
  const ok = confirm(`Excluir a area "${nome}"?`);
  if (!ok) return;

  try {
    await apiFetchJson(`${AREAS_API_BASE}/${id}`, { method: "DELETE" });
    toast("Area removida.");

    await loadAreasFromApi();
    updateKpis();
    renderTable();
  } catch (err) {
    console.error(err);
    toast("Falha ao excluir area.");
  }
}

function goToVagaDetail(vagaId) {
  if (!vagaId) return;
  const url = new URL("/Vagas", window.location.origin);
  url.searchParams.set("vagaId", vagaId);
  url.searchParams.set("open", "detail");
  window.location.href = url.toString();
}

function openAreaDetail(id) {
  const a = findArea(id);
  if (!a) return;
  const root = $("#modalAreaDetalhes");
  if (!root) return;
  const modal = bootstrap.Modal.getOrCreateInstance(root);

  setText(root, "area-name", a.nome || EMPTY_TEXT);
  setText(root, "area-code", a.codigo || EMPTY_TEXT);
  setText(root, "area-desc", a.descricao || EMPTY_TEXT);

  const statusHost = root.querySelector('[data-role="area-status-host"]');
  if (statusHost) statusHost.replaceChildren(buildStatusBadge(a.status));

  const vagas = getAreaVagas(a);
  $("#areaVagasCount").textContent = vagas.length;

  const tbody = $("#areaVagasTbody");
  tbody.replaceChildren();
  if (!vagas.length) {
    const empty = cloneTemplate("tpl-area-vaga-empty-row");
    if (empty) tbody.appendChild(empty);
    modal.show();
    return;
  }

  vagas
    .slice()
    .sort((x, y) => (x.titulo || "").localeCompare(y.titulo || ""))
    .forEach(v => {
      const tr = cloneTemplate("tpl-area-vaga-row");
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
  const headers = ["Codigo", "Area", "Status", "Descricao"];
  const rows = state.areas.map(a => [
    a.codigo, a.nome, a.status, a.descricao
  ]);
  const csv = [
    headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(";"),
    ...rows.map(r => r.map(c => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";"))
  ].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "areas_liotecnica.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function renderOrgChartArea(container) {
  if (!container) return;
  container.replaceChildren();
  const tree = buildAreaTree(state.areas);
  if (!tree.length) {
    container.textContent = "Nenhuma area cadastrada.";
    return;
  }
  function buildList(nodes) {
    const ul = document.createElement("ul");
    ul.className = "list-unstyled mb-0 ms-3";
    for (const n of nodes) {
      const li = document.createElement("li");
      li.className = "mb-1";
      li.textContent = (n.nome || n.codigo || n.id) + (n.children?.length ? ` (${n.children.length})` : "");
      if (n.children && n.children.length) {
        li.appendChild(buildList(n.children));
      }
      ul.appendChild(li);
    }
    return ul;
  }
  container.appendChild(buildList(tree));
}

function renderOrgChartDonos(container) {
  if (!container) return;
  container.replaceChildren();
  const byOwner = new Map();
  for (const a of state.areas) {
    const ownerId = a.ownerFuncionarioId ?? a.ownerManagerId ?? null;
    const key = ownerId != null ? areaKey(ownerId) : "__sem_dono__";
    if (!byOwner.has(key)) byOwner.set(key, []);
    byOwner.get(key).push(a);
  }
  const semDono = byOwner.get("__sem_dono__") || [];
  byOwner.delete("__sem_dono__");
  const ownerNames = new Map(state.funcionarios.map(f => [areaKey(f.id), f.name || f.id]));
  const frag = document.createDocumentFragment();
  function addSection(title, areas) {
    if (!areas.length) return;
    const h6 = document.createElement("h6");
    h6.className = "text-muted small mt-3 mb-1";
    h6.textContent = title;
    frag.appendChild(h6);
    const ul = document.createElement("ul");
    ul.className = "list-unstyled mb-0";
    areas.forEach(a => {
      const li = document.createElement("li");
      li.textContent = a.nome || a.codigo || a.id;
      ul.appendChild(li);
    });
    frag.appendChild(ul);
  }
  for (const [key, list] of byOwner) {
    const name = ownerNames.get(key) || key;
    addSection(name, list);
  }
  addSection("Sem dono", semDono);
  if (!frag.childNodes.length) {
    container.textContent = "Nenhuma area cadastrada.";
    return;
  }
  container.appendChild(frag);
}

function mermaidSafeId(id) {
  return "a_" + (areaKey(id) || "").replace(/[^a-z0-9]/g, "_");
}

function buildMermaidFlowDefinition() {
  const tree = buildAreaTree(state.areas);
  if (!tree.length) return "";
  const idToNode = new Map();
  function collect(nodes) {
    for (const n of nodes) {
      idToNode.set(areaKey(n.id), n);
      if (n.children?.length) collect(n.children);
    }
  }
  collect(tree);
  const lines = ["flowchart TB"];
  const seen = new Set();
  for (const n of idToNode.values()) {
    const sid = mermaidSafeId(n.id);
    if (seen.has(sid)) continue;
    seen.add(sid);
    const label = (n.nome || n.codigo || "Area").replace(/"/g, "'").replace(/\[|\]/g, " ");
    lines.push(`  ${sid}["${label}"]`);
  }
  for (const n of idToNode.values()) {
    const parentKey = areaKey(n.parentId);
    if (!parentKey || !idToNode.has(parentKey)) continue;
    const fromId = mermaidSafeId(n.parentId);
    const toId = mermaidSafeId(n.id);
    lines.push(`  ${fromId} --> ${toId}`);
  }
  return lines.join("\n");
}

async function renderOrgChartFlow(container) {
  if (!container) return;
  container.replaceChildren();
  const definition = buildMermaidFlowDefinition();
  if (!definition || definition === "flowchart TB") {
    container.textContent = "Nenhuma area cadastrada.";
    return;
  }
  const pre = document.createElement("pre");
  pre.className = "mermaid";
  pre.textContent = definition;
  container.appendChild(pre);
  try {
    if (typeof mermaid !== "undefined" && mermaid.run) {
      await mermaid.run({ nodes: [pre] });
    }
  } catch (err) {
    console.warn("Mermaid render", err);
    container.textContent = "Erro ao renderizar diagrama de fluxo.";
  }
}

function openOrgChartModal() {
  const modalEl = document.getElementById("modalOrgChart");
  if (!modalEl) return;
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  const areaContainer = document.getElementById("orgChartContainerArea");
  const donosContainer = document.getElementById("orgChartContainerDonos");
  const flowContainer = document.getElementById("orgChartContainerFlow");
  renderOrgChartArea(areaContainer);
  renderOrgChartDonos(donosContainer);
  renderOrgChartFlow(flowContainer);
  modal.show();
}

function wireFilters() {
  const apply = () => {
    state.filters.q = ($("#aSearch").value || "").trim();
    state.filters.status = $("#aStatus").value || "all";
    renderTable();
  };

  $("#aSearch").addEventListener("input", apply);
  $("#aStatus").addEventListener("change", apply);

  $("#globalSearchArea").addEventListener("input", () => {
    $("#aSearch").value = $("#globalSearchArea").value;
    apply();
  });
}

function wireButtons() {
  const newBtn = $("#btnNewArea");
  if (newBtn) newBtn.addEventListener("click", () => openAreaModal("new"));

  $("#btnSaveArea").addEventListener("click", saveAreaFromModal);

  $("#btnSeedReset").addEventListener("click", async () => {
    const ok = confirm("Recarregar dados da API?");
    if (!ok) return;
    try {
      await loadAreasFromApi();
      await loadVagasFromApi();
      updateKpis();
      renderTable();
      toast("Dados recarregados.");
    } catch (err) {
      console.error(err);
      toast("Falha ao recarregar.");
    }
  });

  $("#btnExportArea").addEventListener("click", exportCsv);

  const btnOrgChart = $("#btnOrgChart");
  if (btnOrgChart) btnOrgChart.addEventListener("click", openOrgChartModal);
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
  // #region agent log
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'areas.js:init:start',message:'init start',data:{stateAreasLength:state.areas.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H-init'})}).catch(()=>{});
  // #endregion
  wireClock();

  try {
    await Promise.all([loadAreasFromApi(), loadFuncionariosFromApi(), loadVagasFromApi()]);
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar dados da API.");
    state.areas = [];
    state.vagas = [];
  }

  // #region agent log
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'areas.js:init:afterLoad',message:'after await load',data:{stateAreasLength:state.areas.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H-init'})}).catch(()=>{});
  // #endregion
  const tree = buildAreaTree(state.areas);
  state.collapsedIds = collectNodeIdsWithChildren(tree);
  updateKpis();
  renderTable();

  wireFilters();
  wireButtons();
})();
