const ROLES_DATA = window.__adminRolesData || [];

function visibilityLabel(v) {
  const n = Number(v);
  if (n === 0) return "Completa";
  if (n === 1) return "Restrita (área/recrutador)";
  return "—";
}

function vagasScopeLabel(v) {
  const n = Number(v);
  if (n === 0) return "Todas";
  if (n === 1) return "Por área";
  if (n === 2) return "Por recrutador";
  return "—";
}

function accessModeLabel(v) {
  const n = Number(v);
  if (n === 0) return "Completo";
  if (n === 1) return "Somente leitura";
  return "—";
}

const state = {
  roles: ROLES_DATA.map(r => ({
    id: r.id,
    name: r.name,
    desc: r.description,
    isActive: !!r.isActive,
    visibilityScope: r.visibilityScope,
    vagasDataScope: r.vagasDataScope,
    accessMode: r.accessMode
  })),
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

function renderKPIs() {
  const total = state.roles.length;
  const active = state.roles.filter(r => r.isActive).length;
  const inactive = total - active;
  const adminCount = state.roles.filter(r => /admin|gestao|manage/i.test(r.name || "")).length;

  $("#kpiRolesTotal").textContent = total;
  $("#kpiRolesActive").textContent = active;
  $("#kpiRolesInactive").textContent = inactive;
  $("#kpiRolesAdmin").textContent = adminCount;
}

function applyFilters(list) {
  const q = (state.filters.q || "").trim().toLowerCase();
  const status = state.filters.status;

  return list.filter(r => {
    if (status === "active" && !r.isActive) return false;
    if (status === "inactive" && r.isActive) return false;
    if (!q) return true;
    const blob = [r.name, r.desc].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function statusTag(isActive) {
  if (isActive) return '<span class="tag ok"><i class="bi bi-check2-circle"></i>Ativo</span>';
  return '<span class="tag bad"><i class="bi bi-slash-circle"></i>Inativo</span>';
}

function renderRoles() {
  const tbody = $("#rolesTbody");
  const filtered = applyFilters(state.roles.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")));

  $("#rolesCount").textContent = filtered.length;
  $("#rolesHint").textContent = filtered.length
    ? "Dica: use os filtros para refinar a busca."
    : "Nenhum perfil com os filtros atuais.";

  tbody.replaceChildren();

  if (!filtered.length) {
    const row = cloneTemplate("tpl-role-empty");
    if (row) tbody.appendChild(row);
    return;
  }

  filtered.forEach(r => {
    const row = cloneTemplate("tpl-role-row");
    if (!row) return;

    const nameEl = row.querySelector('[data-role="role-name"]');
    if (nameEl) nameEl.textContent = r.name || "-";
    const idEl = row.querySelector('[data-role="role-id"]');
    if (idEl) idEl.textContent = r.id ? r.id.slice(0, 8) : "-";
    const descEl = row.querySelector('[data-role="role-desc"]');
    if (descEl) descEl.textContent = r.desc || "-";

    const visEl = row.querySelector('[data-role="role-visibility"]');
    if (visEl) visEl.textContent = visibilityLabel(r.visibilityScope);
    const vagasEl = row.querySelector('[data-role="role-vagas"]');
    if (vagasEl) vagasEl.textContent = vagasScopeLabel(r.vagasDataScope);
    const accessEl = row.querySelector('[data-role="role-access"]');
    if (accessEl) accessEl.textContent = accessModeLabel(r.accessMode);
    const menusCountEl = row.querySelector('[data-role="role-menus-count"]');
    if (menusCountEl) menusCountEl.innerHTML = '<span class="text-muted small">Ver detalhes</span>';

    const statusEl = row.querySelector('[data-role="role-status"]');
    if (statusEl) statusEl.innerHTML = statusTag(r.isActive);

    row.dataset.id = r.id;
    tbody.appendChild(row);
  });
}

const API_ROLES = "/UsuariosPerfis/_api/roles";

function openDetailsModal(roleId) {
  const role = state.roles.find(r => r.id === roleId);
  if (!role) return;

  const modalEl = document.getElementById("modalAdminRoleDetails");
  const nameEl = modalEl?.querySelector("[data-role=\"detail-name\"]");
  const idEl = modalEl?.querySelector("[data-role=\"detail-id\"]");
  const descEl = modalEl?.querySelector("[data-role=\"detail-desc\"]");
  const statusEl = modalEl?.querySelector("[data-role=\"detail-status\"]");
  const visEl = modalEl?.querySelector("[data-role=\"detail-visibility\"]");
  const vagasEl = modalEl?.querySelector("[data-role=\"detail-vagas\"]");
  const accessEl = modalEl?.querySelector("[data-role=\"detail-access\"]");
  const createdEl = modalEl?.querySelector("[data-role=\"detail-created\"]");
  const updatedEl = modalEl?.querySelector("[data-role=\"detail-updated\"]");
  const menusLoadingEl = modalEl?.querySelector("[data-role=\"detail-menus-loading\"]");
  const menusListEl = document.getElementById("detail-menus-list");
  const detailEditLink = modalEl?.querySelector("[data-role=\"detail-edit-link\"]");

  if (nameEl) nameEl.textContent = role.name || "-";
  if (idEl) idEl.textContent = role.id || "-";
  if (descEl) descEl.textContent = role.desc || "-";
  if (statusEl) statusEl.innerHTML = statusTag(role.isActive);
  if (visEl) visEl.textContent = visibilityLabel(role.visibilityScope);
  if (vagasEl) vagasEl.textContent = vagasScopeLabel(role.vagasDataScope);
  if (accessEl) accessEl.textContent = accessModeLabel(role.accessMode);
  if (createdEl) createdEl.textContent = "-";
  if (updatedEl) updatedEl.textContent = "-";
  if (detailEditLink) {
    detailEditLink.href = "/Admin/Roles/Edit/" + roleId;
  }

  if (menusLoadingEl) menusLoadingEl.textContent = "Carregando...";
  if (menusListEl) menusListEl.innerHTML = "";

  Promise.all([
    apiFetchJson(`${API_ROLES}/${roleId}`, { method: "GET" }),
    apiFetchJson(`${API_ROLES}/${roleId}/menus`, { method: "GET" })
  ]).then(([detail, menus]) => {
    if (createdEl && detail?.createdAtUtc) createdEl.textContent = fmtDate(detail.createdAtUtc);
    if (updatedEl && detail?.updatedAtUtc) updatedEl.textContent = fmtDate(detail.updatedAtUtc);
    if (menusLoadingEl) menusLoadingEl.remove();
    if (menusListEl && Array.isArray(menus)) {
      if (menus.length === 0) {
        menusListEl.innerHTML = "<li class=\"text-muted\">Nenhum menu atribuído.</li>";
      } else {
        menus.forEach(m => {
          const li = document.createElement("li");
          li.className = "py-1";
          const code = document.createElement("code");
          code.className = "small";
          code.textContent = m.permissionKey || "-";
          li.appendChild(code);
          menusListEl.appendChild(li);
        });
      }
    }
  }).catch(() => {
    if (menusLoadingEl) menusLoadingEl.textContent = "Erro ao carregar.";
    if (menusListEl) menusListEl.innerHTML = "<li class=\"text-muted\">Não foi possível carregar os menus.</li>";
  });

  new bootstrap.Modal(modalEl).show();
}

async function deleteRole(roleId) {
  const role = state.roles.find(r => r.id === roleId);
  const ok = confirm(`Excluir perfil "${role?.name || roleId}"?`);
  if (!ok) return;

  await apiFetchJson(`${API_ROLES}/${roleId}`, { method: "DELETE" });
  state.roles = state.roles.filter(r => r.id !== roleId);
  renderKPIs();
  renderRoles();
}

function wireFilters() {
  $("#rSearch").addEventListener("input", () => {
    state.filters.q = $("#rSearch").value || "";
    renderRoles();
  });
  $("#rStatus").addEventListener("change", () => {
    state.filters.status = $("#rStatus").value;
    renderRoles();
  });
}

function wireGlobalSearch() {
  const input = $("#globalSearchRoles");
  if (!input) return;
  input.addEventListener("input", () => {
    $("#rSearch").value = input.value;
    state.filters.q = input.value || "";
    renderRoles();
  });
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

function wireRowActions() {
  const tbody = $("#rolesTbody");
  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const tr = event.target.closest("tr");
    const roleId = tr?.dataset?.id;
    if (!roleId) return;

    const act = btn.dataset.act;
    if (act === "detail") openDetailsModal(roleId);
    if (act === "edit") {
      window.location.href = "/Admin/Roles/Edit/" + roleId;
      return;
    }
    if (act === "del") deleteRole(roleId);
  });
}

(function init() {
  renderKPIs();
  renderRoles();
  wireFilters();
  wireGlobalSearch();
  wireClock();
  wireRowActions();
})();
