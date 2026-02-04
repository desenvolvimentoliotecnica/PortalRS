const USERS_DATA = window.__adminUsersData || [];
const ROLES_DATA = window.__adminRolesData || [];

const state = {
  users: USERS_DATA.map(u => ({
    id: u.id,
    name: u.fullName,
    email: u.email,
    roles: Array.isArray(u.roles) ? u.roles : [],
    isActive: !!u.isActive
  })),
  roles: ROLES_DATA.map(r => ({ id: r.id, name: r.name })),
  filters: { q: "", status: "all", role: "all" }
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
  const total = state.users.length;
  const active = state.users.filter(u => u.isActive).length;
  const inactive = total - active;
  const rolesCount = state.roles.length;

  $("#kpiUsersTotal").textContent = total;
  $("#kpiUsersActive").textContent = active;
  $("#kpiUsersInactive").textContent = inactive;
  $("#kpiUsersRoles").textContent = rolesCount;
}

function applyFilters(list) {
  const q = (state.filters.q || "").trim().toLowerCase();
  const status = state.filters.status;
  const role = state.filters.role;

  return list.filter(u => {
    if (status === "active" && !u.isActive) return false;
    if (status === "inactive" && u.isActive) return false;
    if (role !== "all" && !u.roles.includes(role)) return false;

    if (!q) return true;
    const blob = [u.name, u.email, u.roles.join(" ")].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function renderRoleFilter() {
  const sel = $("#uRole");
  sel.replaceChildren();
  sel.appendChild(buildOption("all", "Todos", true));

  state.roles
    .slice()
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .forEach(r => {
      sel.appendChild(buildOption(r.name, r.name));
    });
}

function statusTag(isActive) {
  if (isActive) return '<span class="tag ok"><i class="bi bi-check2-circle"></i>Ativo</span>';
  return '<span class="tag bad"><i class="bi bi-slash-circle"></i>Inativo</span>';
}

function renderUsers() {
  const tbody = $("#usersTbody");
  const filtered = applyFilters(state.users.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")));

  $("#usersCount").textContent = filtered.length;
  $("#usersHint").textContent = filtered.length
    ? "Dica: use os filtros para refinar a busca."
    : "Nenhum usuario com os filtros atuais.";

  tbody.replaceChildren();

  if (!filtered.length) {
    const row = cloneTemplate("tpl-user-empty");
    if (row) tbody.appendChild(row);
    return;
  }

  filtered.forEach(u => {
    const row = cloneTemplate("tpl-user-row");
    if (!row) return;

    const nameEl = row.querySelector('[data-role="user-name"]');
    if (nameEl) nameEl.textContent = u.name || "-";
    const idEl = row.querySelector('[data-role="user-id"]');
    if (idEl) idEl.textContent = u.id ? u.id.slice(0, 8) : "-";
    const emailEl = row.querySelector('[data-role="user-email"]');
    if (emailEl) emailEl.textContent = u.email || "-";

    const roles = u.roles.map(r => `<span class="pill"><i class="bi bi-person-badge"></i>${escapeHtml(r)}</span>`).join(" ");
    const rolesHost = row.querySelector('[data-role="user-roles"]');
    if (rolesHost) rolesHost.innerHTML = roles || "-";

    const statusHost = row.querySelector('[data-role="user-status"]');
    if (statusHost) statusHost.innerHTML = statusTag(u.isActive);

    const avatar = row.querySelector('[data-role="user-avatar"]');
    if (avatar) avatar.textContent = initials(u.name, "U");

    row.dataset.id = u.id;

    tbody.appendChild(row);
  });
}

function openDetailsModal(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  const editLink = document.getElementById("detailUserEditLink");
  if (editLink) editLink.href = "/Admin/Users/Edit/" + userId;

  const modal = new bootstrap.Modal($("#modalAdminUserDetails"));
  const nameEl = $("#modalAdminUserDetails [data-role=\"detail-name\"]");
  const emailEl = $("#modalAdminUserDetails [data-role=\"detail-email\"]");
  const rolesEl = $("#modalAdminUserDetails [data-role=\"detail-roles\"]");
  const statusEl = $("#modalAdminUserDetails [data-role=\"detail-status\"]");
  const createdEl = $("#modalAdminUserDetails [data-role=\"detail-created\"]");
  const updatedEl = $("#modalAdminUserDetails [data-role=\"detail-updated\"]");

  if (nameEl) nameEl.textContent = user.name || "-";
  if (emailEl) emailEl.textContent = user.email || "-";
  if (rolesEl) rolesEl.textContent = user.roles.join(", ") || "-";
  if (statusEl) statusEl.innerHTML = statusTag(user.isActive);

  createdEl.textContent = "-";
  updatedEl.textContent = "-";

  apiFetchJson(`/UsuariosPerfis/_api/users/${userId}`, { method: "GET" })
    .then(detail => {
      if (!detail) return;
      const roles = Array.isArray(detail.roles) ? detail.roles.map(r => r.name) : [];
      if (rolesEl) rolesEl.textContent = roles.join(", ") || "-";
      createdEl.textContent = detail.createdAtUtc ? fmtDate(detail.createdAtUtc) : "-";
      updatedEl.textContent = detail.updatedAtUtc ? fmtDate(detail.updatedAtUtc) : "-";
    })
    .catch(() => {});

  modal.show();
}

async function deleteUser(userId) {
  const user = state.users.find(u => u.id === userId);
  const ok = confirm(`Excluir usuario "${user?.name || userId}"?`);
  if (!ok) return;

  await apiFetchJson(`/UsuariosPerfis/_api/users/${userId}`, { method: "DELETE" });
  state.users = state.users.filter(u => u.id !== userId);
  renderKPIs();
  renderUsers();
}

function wireRowActions() {
  const tbody = $("#usersTbody");
  tbody.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-act]");
    if (!btn) return;
    const tr = event.target.closest("tr");
    const userId = tr?.dataset?.id;
    if (!userId) return;

    const act = btn.dataset.act;
    if (act === "detail") openDetailsModal(userId);
    if (act === "edit") {
      window.location.href = "/Admin/Users/Edit/" + userId;
      return;
    }
    if (act === "chpwd") openChangePasswordModal(userId);
    if (act === "del") deleteUser(userId);
  });
}

const USERS_API = "/UsuariosPerfis/_api/users";

function openChangePasswordModal(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;

  const idEl = document.getElementById("chpwdUserId");
  const nameEl = document.getElementById("modalPasswordUserName");
  const newEl = document.getElementById("chpwdNewPassword");
  const confirmEl = document.getElementById("chpwdConfirmPassword");
  const errEl = document.getElementById("chpwdError");
  if (idEl) idEl.value = userId;
  if (nameEl) nameEl.textContent = user.name || user.email || "—";
  if (newEl) { newEl.value = ""; newEl.focus(); }
  if (confirmEl) confirmEl.value = "";
  if (errEl) errEl.textContent = "";

  new bootstrap.Modal(document.getElementById("modalAdminUserPassword")).show();
}

async function saveNewPassword() {
  const idEl = document.getElementById("chpwdUserId");
  const newEl = document.getElementById("chpwdNewPassword");
  const confirmEl = document.getElementById("chpwdConfirmPassword");
  const errEl = document.getElementById("chpwdError");
  const id = (idEl?.value || "").trim();
  const newPassword = (newEl?.value || "").trim();
  const confirmPassword = (confirmEl?.value || "").trim();

  if (errEl) errEl.textContent = "";
  if (!id) return;
  if (newPassword.length < 8) {
    if (errEl) errEl.textContent = "A senha deve ter no mínimo 8 caracteres.";
    return;
  }
  if (newPassword !== confirmPassword) {
    if (errEl) errEl.textContent = "As senhas não coincidem.";
    return;
  }

  try {
    const res = await fetch(USERS_API + "/" + id + "/password", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ newPassword: newPassword })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (errEl) errEl.textContent = data.detail || data.message || "Erro ao alterar senha.";
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById("modalAdminUserPassword"))?.hide();
  } catch (e) {
    if (errEl) errEl.textContent = "Erro ao alterar senha.";
  }
}

function wireFilters() {
  $("#uSearch").addEventListener("input", () => {
    state.filters.q = $("#uSearch").value || "";
    renderUsers();
  });
  $("#uStatus").addEventListener("change", () => {
    state.filters.status = $("#uStatus").value;
    renderUsers();
  });
  $("#uRole").addEventListener("change", () => {
    state.filters.role = $("#uRole").value;
    renderUsers();
  });
}

function wireGlobalSearch() {
  const input = $("#globalSearchUsers");
  if (!input) return;
  input.addEventListener("input", () => {
    $("#uSearch").value = input.value;
    state.filters.q = input.value || "";
    renderUsers();
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

(function init() {
  renderRoleFilter();
  renderKPIs();
  renderUsers();
  wireFilters();
  wireGlobalSearch();
  wireClock();
  wireRowActions();
  const btnChpwd = document.getElementById("btnChpwdSave");
  if (btnChpwd) btnChpwd.addEventListener("click", saveNewPassword);
})();
