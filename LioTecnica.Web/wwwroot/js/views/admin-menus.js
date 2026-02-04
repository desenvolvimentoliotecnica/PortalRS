const MENUS_DATA = window.__adminMenusData || [];

const state = {
  menus: MENUS_DATA.map(m => ({
    id: m.id,
    name: m.displayName,
    route: m.route,
    icon: m.icon,
    order: m.order,
    parentId: m.parentId,
    permissionKey: m.permissionKey,
    isActive: !!m.isActive,
    openInNewTab: !!m.openInNewTab
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
  const total = state.menus.length;
  const active = state.menus.filter(m => m.isActive).length;
  const inactive = total - active;
  const withIcon = state.menus.filter(m => (m.icon || "").trim().length > 0).length;

  $("#kpiMenusTotal").textContent = total;
  $("#kpiMenusActive").textContent = active;
  $("#kpiMenusInactive").textContent = inactive;
  $("#kpiMenusIcon").textContent = withIcon;
}

function applyFilters(list) {
  const q = (state.filters.q || "").trim().toLowerCase();
  const status = state.filters.status;

  return list.filter(m => {
    if (status === "active" && !m.isActive) return false;
    if (status === "inactive" && m.isActive) return false;
    if (!q) return true;
    const blob = [m.name, m.route, m.permissionKey].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function statusTag(isActive) {
  if (isActive) return '<span class="tag ok"><i class="bi bi-check2-circle"></i>Ativo</span>';
  return '<span class="tag bad"><i class="bi bi-slash-circle"></i>Inativo</span>';
}

function renderMenus() {
  const tbody = $("#menusTbody");
  const filtered = applyFilters(state.menus.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));

  $("#menusCount").textContent = filtered.length;
  $("#menusHint").textContent = filtered.length
    ? "Dica: use os filtros para refinar a busca."
    : "Nenhum menu com os filtros atuais.";

  tbody.replaceChildren();

  if (!filtered.length) {
    const row = cloneTemplate("tpl-menu-empty");
    if (row) tbody.appendChild(row);
    return;
  }

  filtered.forEach(m => {
    const row = cloneTemplate("tpl-menu-row");
    if (!row) return;

    const nameEl = row.querySelector('[data-role="menu-name"]');
    if (nameEl) nameEl.textContent = m.name || "-";
    const idEl = row.querySelector('[data-role="menu-id"]');
    if (idEl) idEl.textContent = m.id ? m.id.slice(0, 8) : "-";
    const routeEl = row.querySelector('[data-role="menu-route"]');
    if (routeEl) routeEl.textContent = m.route || "-";
    const permEl = row.querySelector('[data-role="menu-permission"]');
    if (permEl) permEl.textContent = m.permissionKey || "-";
    const orderEl = row.querySelector('[data-role="menu-order"]');
    if (orderEl) orderEl.textContent = m.order ?? 0;

    const statusEl = row.querySelector('[data-role="menu-status"]');
    if (statusEl) statusEl.innerHTML = statusTag(m.isActive);

    row.dataset.id = m.id;
    tbody.appendChild(row);
  });
}

function openDetailsModal(menuId) {
  const menu = state.menus.find(m => m.id === menuId);
  if (!menu) return;

  const modal = new bootstrap.Modal($("#modalAdminMenuDetails"));
  const nameEl = $("#modalAdminMenuDetails [data-role=\"detail-name\"]");
  const idEl = $("#modalAdminMenuDetails [data-role=\"detail-id\"]");
  const statusEl = $("#modalAdminMenuDetails [data-role=\"detail-status\"]");
  const routeEl = $("#modalAdminMenuDetails [data-role=\"detail-route\"]");
  const permEl = $("#modalAdminMenuDetails [data-role=\"detail-permission\"]");
  const iconEl = $("#modalAdminMenuDetails [data-role=\"detail-icon\"]");
  const orderEl = $("#modalAdminMenuDetails [data-role=\"detail-order\"]");
  const parentEl = $("#modalAdminMenuDetails [data-role=\"detail-parent\"]");
  const createdEl = $("#modalAdminMenuDetails [data-role=\"detail-created\"]");
  const updatedEl = $("#modalAdminMenuDetails [data-role=\"detail-updated\"]");

  if (nameEl) nameEl.textContent = menu.name || "-";
  if (idEl) idEl.textContent = menu.id || "-";
  if (statusEl) statusEl.innerHTML = statusTag(menu.isActive);
  if (routeEl) routeEl.textContent = menu.route || "-";
  if (permEl) permEl.textContent = menu.permissionKey || "-";
  if (iconEl) iconEl.textContent = menu.icon || "-";
  if (orderEl) orderEl.textContent = menu.order ?? 0;
  if (parentEl) parentEl.textContent = menu.parentId || "-";
  if (createdEl) createdEl.textContent = "-";
  if (updatedEl) updatedEl.textContent = "-";

  apiFetchJson(`/UsuariosPerfis/_api/menus/${menuId}`, { method: "GET" })
    .then(detail => {
      if (!detail) return;
  if (iconEl) iconEl.textContent = detail.icon || "-";
      if (parentEl) parentEl.textContent = detail.parentId || "-";
      if (createdEl) createdEl.textContent = detail.createdAtUtc ? fmtDate(detail.createdAtUtc) : "-";
      if (updatedEl) updatedEl.textContent = detail.updatedAtUtc ? fmtDate(detail.updatedAtUtc) : "-";
    })
    .catch(() => {});

  modal.show();
}

async function openEditModal(menuId) {
  const detail = await apiFetchJson(`/UsuariosPerfis/_api/menus/${menuId}`, { method: "GET" });
  if (!detail) return;

  $("#adminMenuId").value = detail.id;
  $("#adminMenuName").value = detail.displayName || "";
  $("#adminMenuRoute").value = detail.route || "";
  $("#adminMenuIcon").value = detail.icon || "";
  $("#adminMenuOrder").value = detail.order ?? 0;
  $("#adminMenuPermission").value = detail.permissionKey || "";
  $("#adminMenuStatus").value = detail.isActive ? "active" : "inactive";
  const entry = state.menus.find(m => m.id === detail.id);
  if (entry) {
    entry.openInNewTab = !!detail.openInNewTab;
  }

  const modal = new bootstrap.Modal($("#modalAdminMenu"));
  modal.show();
}

async function saveMenu() {
  const id = ($("#adminMenuId").value || "").trim();
  const name = ($("#adminMenuName").value || "").trim();
  const route = ($("#adminMenuRoute").value || "").trim();
  const icon = ($("#adminMenuIcon").value || "").trim();
  const order = Number.parseInt($("#adminMenuOrder").value || "0", 10);
  const permissionKey = ($("#adminMenuPermission").value || "").trim();
  const status = $("#adminMenuStatus").value;

  if (!id || !name || !route || !permissionKey) return;
  const entry = state.menus.find(m => m.id === id);
  const openInNewTab = entry ? !!entry.openInNewTab : false;

  await apiFetchJson(`/UsuariosPerfis/_api/menus/${id}`, {
    method: "PUT",
    body: JSON.stringify({
      displayName: name,
      route,
      icon,
      order,
      parentId: null,
      permissionKey,
      isActive: status === "active",
      openInNewTab
    })
  });

  if (entry) {
    entry.name = name;
    entry.route = route;
    entry.icon = icon;
    entry.order = order;
    entry.permissionKey = permissionKey;
    entry.isActive = status === "active";
  }

  renderKPIs();
  renderMenus();
  bootstrap.Modal.getInstance($("#modalAdminMenu")).hide();
}

async function deleteMenu(menuId) {
  const menu = state.menus.find(m => m.id === menuId);
  const ok = confirm(`Excluir menu "${menu?.name || menuId}"?`);
  if (!ok) return;

  await apiFetchJson(`/UsuariosPerfis/_api/menus/${menuId}`, { method: "DELETE" });
  state.menus = state.menus.filter(m => m.id !== menuId);
  renderKPIs();
  renderMenus();
}

function wireFilters() {
  $("#mSearch").addEventListener("input", () => {
    state.filters.q = $("#mSearch").value || "";
    renderMenus();
  });
  $("#mStatus").addEventListener("change", () => {
    state.filters.status = $("#mStatus").value;
    renderMenus();
  });
}

function wireGlobalSearch() {
  const input = $("#globalSearchMenus");
  if (!input) return;
  input.addEventListener("input", () => {
    $("#mSearch").value = input.value;
    state.filters.q = input.value || "";
    renderMenus();
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
  const tbody = $("#menusTbody");
  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const tr = event.target.closest("tr");
    const menuId = tr?.dataset?.id;
    if (!menuId) return;

    const act = btn.dataset.act;
    if (act === "detail") openDetailsModal(menuId);
    if (act === "edit") openEditModal(menuId);
    if (act === "del") deleteMenu(menuId);
  });
}

(function init() {
  renderKPIs();
  renderMenus();
  wireFilters();
  wireGlobalSearch();
  wireClock();
  wireRowActions();
  $("#btnAdminMenuSave").addEventListener("click", saveMenu);
})();
