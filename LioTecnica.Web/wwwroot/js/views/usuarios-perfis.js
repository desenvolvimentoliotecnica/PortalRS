// ========= Logo (data URI real do arquivo recebido)
// Obs: apesar do nome do arquivo ser .png, o conteudo e WebP (ok).
const USERS_API_BASE = "/UsuariosPerfis/_api/users";
const ROLES_API_BASE = "/UsuariosPerfis/_api/roles";
const MENUS_API_BASE = "/UsuariosPerfis/_api/menus";

const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";

function enumFirstCode(key, fallback) {
    const list = getEnumOptions(key);
    return list.length ? list[0].code : fallback;
}

let ROLE_ALL = enumFirstCode("roleFilter", "all");
let DEFAULT_USER_STATUS = enumFirstCode("usuarioStatus", "active");
let DEFAULT_USER_STATUS_FILTER = enumFirstCode("usuarioStatusFilter", "all");
let DEFAULT_MFA_OPTION = enumFirstCode("usuarioMfaOption", "false");

const DEFAULT_MODULES = [
    { key: "dashboard", label: "Dashboard" },
    { key: "vagas", label: "Vagas" },
    { key: "candidatos", label: "Candidatos" },
    { key: "triagem", label: "Triagem" },
    { key: "matching", label: "Matching" },
    { key: "entrada", label: "Entrada (Email/Pasta)" },
    { key: "relatorios", label: "Relatorios" },
    { key: "config", label: "Configuracoes" },
    { key: "usuarios", label: "Usuarios & Perfis" }
];

const ACTIONS = [
    { key: "view", label: "Visualizar" },
    { key: "create", label: "Criar" },
    { key: "edit", label: "Editar" },
    { key: "delete", label: "Excluir" },
    { key: "export", label: "Exportar" },
    { key: "admin", label: "Admin" }
];

const ACTION_PERMISSION_OVERRIDES = {
    users: {
        view: "users.read",
        create: "users.write",
        edit: "users.write",
        delete: "users.write",
        export: "users.write",
        admin: "users.write"
    },
    roles: {
        view: "roles.manage",
        create: "roles.manage",
        edit: "roles.manage",
        delete: "roles.manage",
        export: "roles.manage",
        admin: "roles.manage"
    },
    menus: {
        view: "menus.manage",
        create: "menus.manage",
        edit: "menus.manage",
        delete: "menus.manage",
        export: "menus.manage",
        admin: "menus.manage"
    },
    access: {
        view: "access.manage",
        create: "access.manage",
        edit: "access.manage",
        delete: "access.manage",
        export: "access.manage",
        admin: "access.manage"
    }
};

const state = {
    users: [],
    roles: [],
    menus: [],
    modules: [],
    moduleMenuMap: new Map(),
    roleMenus: {},
    selectedRoleId: null,
    selectedUserId: null,
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

function showToast(title, body) {
    if (typeof window.toast !== "function") return;
    window.toast(body || "-", title || "Notificacao");
}

function moduleKeyFromPermission(permissionKey) {
    const raw = (permissionKey || "").split(".")[0];
    return raw || permissionKey || "module";
}

function permissionKeyFor(moduleKey, actionKey) {
    const override = ACTION_PERMISSION_OVERRIDES[moduleKey];
    if (override && override[actionKey]) return override[actionKey];

    const suffix = actionKey === "admin" ? "manage" : actionKey;
    return `${moduleKey}.${suffix}`;
}

function buildModulesFromMenus(menus) {
    const byKey = new Map();
    const menuMap = new Map();

    menus.forEach(menu => {
        const key = moduleKeyFromPermission(menu.permissionKey || "");
        if (!byKey.has(key)) {
            byKey.set(key, { key, label: menu.displayName || key });
        }
        if (!menuMap.has(key)) {
            menuMap.set(key, menu.id);
        }
    });

    state.moduleMenuMap = menuMap;
    return Array.from(byKey.values()).sort((a, b) => (a.label || "").localeCompare(b.label || ""));
}

function roleById(id) { return state.roles.find(r => r.id === id) || null; }
function roleName(id) { return roleById(id)?.name || "?"; }
function userById(id) { return state.users.find(u => u.id === id) || null; }

async function apiGetJson(url) {
    return await apiFetchJson(url, { method: "GET" });
}

async function loadRoles() {
    const list = await apiGetJson(ROLES_API_BASE) || [];
    state.roles = list.map(r => ({
        id: r.id,
        name: r.name,
        desc: r.description,
        isActive: r.isActive,
        builtIn: false
    }));
}

async function loadMenus() {
    const list = await apiGetJson(MENUS_API_BASE) || [];
    state.menus = list || [];
    state.modules = buildModulesFromMenus(state.menus);
    if (!state.modules.length) state.modules = DEFAULT_MODULES.slice();
}

function mapUsersFromApi(users) {
    const roleNameMap = new Map(state.roles.map(r => [String(r.name || "").toLowerCase(), r.id]));
    state.users = (users || []).map(u => {
        const ids = (u.roles || [])
            .map(name => roleNameMap.get(String(name || "").toLowerCase()))
            .filter(Boolean);

        return {
            id: u.id,
            name: u.fullName,
            email: u.email,
            dept: "",
            status: u.isActive ? "active" : "disabled",
            mfaEnabled: false,
            roleIds: ids,
            createdAt: null,
            updatedAt: null,
            lastLoginAt: null
        };
    });
}

async function loadUsers() {
    const list = await apiGetJson(USERS_API_BASE) || [];
    mapUsersFromApi(list);
}

async function loadRoleMenus(roleId) {
    if (!roleId) return;
    const items = await apiGetJson(`${ROLES_API_BASE}/${roleId}/menus`) || [];
    state.roleMenus[roleId] = items;
}

function renderKPIs() {
    const total = state.users.length;
    const active = state.users.filter(u => u.status === "active").length;
    const invited = state.users.filter(u => u.status === "invited").length;
    const roles = state.roles.length;

    $("#kpiUsers").textContent = total;
    $("#kpiActive").textContent = active;
    $("#kpiInvites").textContent = invited;
    $("#kpiRoles").textContent = roles;
}

function renderRoleFilterOptions() {
    const sel = $("#uRole");
    const current = sel.value || ROLE_ALL;
    const selected = state.filters.role || current || ROLE_ALL;
    sel.replaceChildren();

    const enumOptions = getEnumOptions("roleFilter");
    enumOptions.forEach(opt => {
        sel.appendChild(buildOption(opt.code, opt.text, opt.code === selected));
    });

    state.roles
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .forEach(r => {
            sel.appendChild(buildOption(r.id, r.name, r.id === selected));
        });

    sel.value = selected;
}

function applyUserFilters(users) {
    const q = (state.filters.q || "").trim().toLowerCase();
    const status = state.filters.status;
    const role = state.filters.role;

    return users.filter(u => {
        if (status !== "all" && u.status !== status) return false;
        if (role !== "all" && !(u.roleIds || []).includes(role)) return false;

        if (!q) return true;
        const blob = [u.name, u.email, u.dept, (u.roleIds || []).map(roleName).join(" ")].join(" ").toLowerCase();
        return blob.includes(q);
    });
}

function statusTag(status) {
    const label = getEnumText("usuarioStatus", status, status || "-");
    if (status === "active") return `<span class="tag ok"><i class="bi bi-check2-circle"></i>${escapeHtml(label)}</span>`;
    if (status === "invited") return `<span class="tag warn"><i class="bi bi-envelope"></i>${escapeHtml(label)}</span>`;
    if (status === "disabled") return `<span class="tag bad"><i class="bi bi-slash-circle"></i>${escapeHtml(label)}</span>`;
    return `<span class="tag"><i class="bi bi-dot"></i>${escapeHtml(label)}</span>`;
}

function mfaTag(enabled) {
    return enabled
        ? `<span class="tag ok"><i class="bi bi-shield-lock"></i>On</span>`
        : `<span class="tag"><i class="bi bi-shield"></i>Off</span>`;
}

function renderUsers() {
    const filtered = applyUserFilters(state.users.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    $("#usersCount").textContent = filtered.length;

    $("#usersHint").textContent = filtered.length
        ? "Dica: clique na linha para ver detalhes no drawer."
        : "Nenhum usuario com os filtros atuais.";

    const tbody = $("#usersTbody");
    tbody.innerHTML = filtered.map(u => {
        const roles = (u.roleIds || []).map(id => `<span class="pill"><i class="bi bi-person-badge"></i>${escapeHtml(roleName(id))}</span>`).join(" ");
        const last = u.lastLoginAt ? fmtDate(u.lastLoginAt) : "?";

        return `
          <tr data-id="${u.id}" class="user-row" style="cursor:pointer;">
            <td>
              <div class="d-flex align-items-center gap-2">
                <div class="avatar">${escapeHtml(initials(u.name, "U"))}</div>
                <div class="lh-1">
                  <div class="fw-bold">${escapeHtml(u.name || "?")}</div>
                  <small class="text-muted">${escapeHtml(u.id.slice(0, 8))}</small>
                </div>
              </div>
            </td>
            <td class="mono">${escapeHtml(u.email || "?")}</td>
            <td>${escapeHtml(u.dept || "?")}</td>
            <td>${roles || "?"}</td>
            <td>${statusTag(u.status)}</td>
            <td>${mfaTag(!!u.mfaEnabled)}</td>
            <td>${escapeHtml(last)}</td>
            <td class="text-end actions">
              <button class="btn btn-ghost btn-sm" data-act="edit" title="Editar"><i class="bi bi-pencil"></i></button>
              <button class="btn btn-ghost btn-sm" data-act="invite" title="Reenviar convite"><i class="bi bi-envelope"></i></button>
              <button class="btn btn-ghost btn-sm" data-act="reset" title="Reset senha"><i class="bi bi-key"></i></button>
              <button class="btn btn-ghost btn-sm" data-act="toggle" title="Ativar/Desativar"><i class="bi bi-toggle2-on"></i></button>
            </td>
          </tr>
        `;
    }).join("");

    $$(".user-row", tbody).forEach(tr => {
        tr.addEventListener("click", (ev) => {
            const btn = ev.target.closest("button[data-act]");
            const id = tr.getAttribute("data-id");

            if (btn) {
                ev.preventDefault();
                ev.stopPropagation();
                const act = btn.getAttribute("data-act");
                if (act === "edit") openUserModal(id);
                if (act === "invite") { showToast("Convite", "Reenvio de convite ainda nao implementado."); }
                if (act === "reset") { showToast("Senha", "Reset de senha ainda nao implementado."); }
                if (act === "toggle") { toggleUserStatus(id); }
                return;
            }

            openUserDrawer(id);
        });
    });
}

async function openUserDrawer(userId) {
    state.selectedUserId = userId;
    const u = userById(userId);
    if (!u) return;

    $("#drawerAvatar").textContent = initials(u.name, "U");
    $("#drawerName").textContent = u.name || "?";
    $("#drawerEmail").textContent = u.email || "?";
    $("#drawerDept").textContent = u.dept || "?";
    $("#drawerCreated").textContent = u.createdAt ? fmtDate(u.createdAt) : "?";
    $("#drawerLastLogin").textContent = u.lastLoginAt ? fmtDate(u.lastLoginAt) : "?";
    $("#drawerRoles").textContent = (u.roleIds || []).map(roleName).join(", ") || "?";
    $("#drawerMfa").textContent = u.mfaEnabled ? "Habilitado" : "Desabilitado";

    const st = u.status;
    const tag = $("#drawerStatusTag");
    if (st === "active") { tag.className = "tag ok"; tag.innerHTML = `<i class="bi bi-check2-circle"></i>Ativo`; }
    else if (st === "invited") { tag.className = "tag warn"; tag.innerHTML = `<i class="bi bi-envelope"></i>Convidado`; }
    else if (st === "disabled") { tag.className = "tag bad"; tag.innerHTML = `<i class="bi bi-slash-circle"></i>Desativado`; }
    else { tag.className = "tag"; tag.innerHTML = `<i class="bi bi-dot"></i>${escapeHtml(st || "?")}`; }

    const oc = new bootstrap.Offcanvas($("#offcanvasUser"));
    oc.show();

    const detail = await apiGetJson(`${USERS_API_BASE}/${userId}`);
    if (!detail) return;

    u.createdAt = detail.createdAtUtc;
    u.updatedAt = detail.updatedAtUtc;
    u.roleIds = (detail.roles || []).map(r => r.id);

    $("#drawerCreated").textContent = u.createdAt ? fmtDate(u.createdAt) : "?";
    $("#drawerRoles").textContent = (u.roleIds || []).map(roleName).join(", ") || "?";
}

function wireDrawerButtons() {
    $("#btnDrawerEdit").addEventListener("click", () => {
        if (!state.selectedUserId) return;
        openUserModal(state.selectedUserId);
    });
    $("#btnDrawerInvite").addEventListener("click", () => {
        if (!state.selectedUserId) return;
        showToast("Convite", "Reenvio de convite ainda nao implementado.");
    });
    $("#btnDrawerReset").addEventListener("click", () => {
        if (!state.selectedUserId) return;
        showToast("Senha", "Reset de senha ainda nao implementado.");
    });
    $("#btnDrawerToggle").addEventListener("click", () => {
        if (!state.selectedUserId) return;
        toggleUserStatus(state.selectedUserId, true);
    });
    $("#btnDrawerDelete").addEventListener("click", () => {
        if (!state.selectedUserId) return;
        showToast("Usuario", "Exclusao de usuario ainda nao implementada na API.");
    });
}

async function openUserModal(userId) {
    const modal = new bootstrap.Modal($("#modalUser"));
    const isEdit = !!userId;
    $("#userModalTitle").textContent = isEdit ? "Editar usuario" : "Novo usuario";

    $("#userId").value = "";
    $("#userName").value = "";
    $("#userEmail").value = "";
    $("#userDept").value = "";
    $("#userStatus").value = DEFAULT_USER_STATUS;
    $("#userMfa").value = DEFAULT_MFA_OPTION;
    $("#userPassword").value = "";

    if (isEdit) {
        const detail = await apiGetJson(`${USERS_API_BASE}/${userId}`);
        if (!detail) return;
        $("#userId").value = detail.id;
        $("#userName").value = detail.fullName || "";
        $("#userEmail").value = detail.email || "";
        $("#userStatus").value = detail.isActive ? "active" : "disabled";
        renderUserRoleSelectors((detail.roles || []).map(r => r.id));
    } else {
        renderUserRoleSelectors([]);
    }

    modal.show();
}

function renderUserRoleSelectors(selectedIds) {
    const chips = $("#userRolesChips");
    const checks = $("#userRolesChecks");
    const set = new Set(selectedIds || []);

    chips.innerHTML = (Array.from(set).map(id => {
        const r = roleById(id);
        if (!r) return "";
        return `<span class="pill"><i class="bi bi-person-badge"></i>${escapeHtml(r.name)}</span>`;
    }).join(" ") || `<span class="text-muted small">Nenhum perfil selecionado.</span>`);

    checks.innerHTML = state.roles
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map(r => `
          <div class="col-12 col-md-6">
            <div class="form-check">
              <input class="form-check-input role-check" type="checkbox" id="role_${r.id}" value="${r.id}" ${set.has(r.id) ? "checked" : ""}>
              <label class="form-check-label" for="role_${r.id}">
                <span class="fw-bold">${escapeHtml(r.name)}</span>
                <small class="text-muted ms-1">${escapeHtml(r.desc || "")}</small>
              </label>
            </div>
          </div>
        `).join("");

    $$(".role-check", checks).forEach(cb => {
        cb.addEventListener("change", () => {
            const ids = $$(".role-check", checks).filter(x => x.checked).map(x => x.value);
            renderUserRoleSelectors(ids);
        });
    });
}

async function saveUserFromModal() {
    const id = ($("#userId").value || "").trim();
    const name = ($("#userName").value || "").trim();
    const email = ($("#userEmail").value || "").trim();
    const status = $("#userStatus").value;
    const roleIds = $$("#userRolesChecks .role-check").filter(x => x.checked).map(x => x.value);
    const password = ($("#userPassword").value || "").trim();

    if (!name || !email) {
        showToast("Validacao", "Informe Nome e Email.");
        return;
    }

    if (!id && !password) {
        showToast("Validacao", "Informe uma senha para o novo usuario.");
        return;
    }

    if (id) {
        const updated = await apiFetchJson(`${USERS_API_BASE}/${id}`, {
            method: "PUT",
            body: JSON.stringify({
                email,
                fullName: name,
                isActive: status === "active"
            })
        });

        if (!updated) {
            showToast("Usuario", "Falha ao atualizar usuario.");
            return;
        }

        await apiFetchJson(`${USERS_API_BASE}/${id}/roles`, {
            method: "PUT",
            body: JSON.stringify({ roleIds })
        });

        await loadUsers();
        renderKPIs();
        renderUsers();
        showToast("Usuario", "Atualizado com sucesso.");
    } else {
        const created = await apiFetchJson(USERS_API_BASE, {
            method: "POST",
            body: JSON.stringify({
                email,
                fullName: name,
                password,
                isActive: status === "active",
                roleIds
            })
        });

        if (!created) {
            showToast("Usuario", "Falha ao criar usuario.");
            return;
        }

        await loadUsers();
        renderKPIs();
        renderUsers();
        showToast("Usuario", "Criado com sucesso.");
    }

    bootstrap.Modal.getInstance($("#modalUser")).hide();
}

async function toggleUserStatus(userId, keepDrawerOpen = false) {
    const u = userById(userId);
    if (!u) return;
    const nextActive = u.status === "disabled";

    const updated = await apiFetchJson(`${USERS_API_BASE}/${userId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: nextActive })
    });

    if (!updated) {
        showToast("Status", "Falha ao atualizar status.");
        return;
    }

    await loadUsers();
    renderKPIs();
    renderUsers();
    showToast("Status", `Usuario agora esta: ${nextActive ? "active" : "disabled"}.`);

    if (keepDrawerOpen) openUserDrawer(userId);
}

function renderRolesList() {
    const host = $("#rolesList");
    host.innerHTML = state.roles
        .slice()
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
        .map(r => `
          <div class="role-item ${r.id === state.selectedRoleId ? "active" : ""}" data-id="${r.id}">
            <div class="d-flex align-items-start justify-content-between gap-2">
              <div class="d-flex align-items-center gap-2">
                <div class="iconbox"><i class="bi bi-shield-lock"></i></div>
                <div>
                  <div class="fw-bold">${escapeHtml(r.name)}</div>
                  <div class="text-muted small">${escapeHtml(r.desc || "?")}</div>
                </div>
              </div>
              ${r.builtIn ? `<span class="pill"><i class="bi bi-stars"></i>padrao</span>` : `<span class="pill"><i class="bi bi-person-badge"></i>custom</span>`}
            </div>
          </div>
        `).join("");

    $$(".role-item", host).forEach(el => {
        el.addEventListener("click", async () => {
            state.selectedRoleId = el.getAttribute("data-id");
            await loadRoleMenus(state.selectedRoleId);
            renderRolesList();
            renderRoleEditor();
        });
    });
}

function renderRoleEditor() {
    const r = roleById(state.selectedRoleId);
    if (!r) {
        $("#roleEditorTitle").textContent = "?";
        $("#roleEditorDesc").textContent = "Selecione um perfil ao lado.";
        $("#roleName").value = "";
        $("#roleDesc").value = "";
        $("#permTbody").innerHTML = "";
        return;
    }

    $("#roleEditorTitle").textContent = `Editor de perfil: ${r.name}`;
    $("#roleEditorDesc").textContent = r.desc || "?";
    $("#roleName").value = r.name || "";
    $("#roleDesc").value = r.desc || "";

    const rolePerms = new Set((state.roleMenus[r.id] || []).map(x => x.permissionKey));
    const tbody = $("#permTbody");

    tbody.innerHTML = state.modules.map(m => {
        return `
          <tr>
            <td class="fw-bold">${escapeHtml(m.label)}</td>
            ${ACTIONS.map(a => {
                const permKey = permissionKeyFor(m.key, a.key);
                const checked = rolePerms.has(permKey);
                const id = `p_${r.id}_${m.key}_${a.key}`;
                return `
                <td>
                  <div class="form-check m-0">
                    <input class="form-check-input perm-cb" type="checkbox" id="${id}"
                           data-role="${r.id}" data-module="${m.key}" data-action="${a.key}"
                           ${checked ? "checked" : ""}>
                  </div>
                </td>
              `;
            }).join("")}
          </tr>
        `;
    }).join("");

    $$(".perm-cb", tbody).forEach(cb => {
        cb.addEventListener("change", () => {
            const roleId = cb.dataset.role;
            const mod = cb.dataset.module;
            const act = cb.dataset.action;

            if (act === "admin" && cb.checked) {
                $$(".perm-cb", tbody).forEach(x => {
                    if (x.dataset.role === roleId && x.dataset.module === mod) x.checked = true;
                });
            }
            if (act === "admin" && !cb.checked) {
                cb.checked = false;
            }
        });
    });
}

async function saveRoleEditor() {
    const r = roleById(state.selectedRoleId);
    if (!r) return;

    const name = ($("#roleName").value || "").trim();
    const desc = ($("#roleDesc").value || "").trim();
    const visibilityScope = parseInt($("#roleVisibilityScope").value || "0", 10);
    const vagasDataScope = parseInt($("#roleVagasDataScope").value || "0", 10);
    const accessMode = parseInt($("#roleAccessMode").value || "0", 10);
    if (!name) {
        showToast("Validacao", "Informe o nome do perfil.");
        return;
    }

    const updated = await apiFetchJson(`${ROLES_API_BASE}/${r.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, description: desc, isActive: true, visibilityScope, vagasDataScope, accessMode })
    });

    if (!updated) {
        showToast("Perfil", "Falha ao salvar perfil.");
        return;
    }

    const checked = $$(".perm-cb").filter(cb => cb.checked);
    const items = checked.map(cb => {
        const moduleKey = cb.dataset.module;
        const permissionKey = permissionKeyFor(moduleKey, cb.dataset.action);
        const menuId = state.moduleMenuMap.get(moduleKey);
        if (!menuId) return null;
        return { menuId, permissionKey };
    }).filter(Boolean);

    await apiFetchJson(`${ROLES_API_BASE}/${r.id}/menus`, {
        method: "PUT",
        body: JSON.stringify({ items })
    });

    await loadRoles();
    await loadRoleMenus(r.id);
    renderRolesList();
    renderRoleEditor();
    renderRoleFilterOptions();
    renderUsers();
    showToast("Perfil", "Permissoes salvas com sucesso.");
}

async function cloneSelectedRole() {
    const r = roleById(state.selectedRoleId);
    if (!r) return;

    const created = await apiFetchJson(ROLES_API_BASE, {
        method: "POST",
        body: JSON.stringify({ name: `${r.name} (Copia)`, description: r.desc || "", isActive: true })
    });

    if (!created) {
        showToast("Perfil", "Falha ao clonar perfil.");
        return;
    }

    const items = state.roleMenus[r.id] || [];
    await apiFetchJson(`${ROLES_API_BASE}/${created.id}/menus`, {
        method: "PUT",
        body: JSON.stringify({ items })
    });

    await loadRoles();
    state.selectedRoleId = created.id;
    await loadRoleMenus(created.id);
    renderKPIs();
    renderRolesList();
    renderRoleEditor();
    renderRoleFilterOptions();
    renderUsers();
    showToast("Perfil", "Clonado com sucesso.");
}

async function deleteSelectedRole() {
    const r = roleById(state.selectedRoleId);
    if (!r) return;

    const usedBy = state.users.filter(u => (u.roleIds || []).includes(r.id)).length;
    const ok = confirm(`Excluir perfil "${r.name}"? Usuarios afetados: ${usedBy}.`);
    if (!ok) return;

    try {
        await apiFetchJson(`${ROLES_API_BASE}/${r.id}`, { method: "DELETE" });
    } catch {
        showToast("Perfil", "Falha ao excluir perfil.");
        return;
    }

    await loadRoles();
    state.selectedRoleId = state.roles[0]?.id || null;
    if (state.selectedRoleId) await loadRoleMenus(state.selectedRoleId);
    await loadUsers();

    renderKPIs();
    renderUsers();
    renderRoleFilterOptions();
    renderRolesList();
    renderRoleEditor();
    showToast("Perfil", "Excluido com sucesso.");
}

function openRoleModal() {
    $("#newRoleName").value = "";
    $("#newRoleDesc").value = "";
    $("#newRoleVisibilityScope").value = "0";
    $("#newRoleVagasDataScope").value = "0";
    $("#newRoleAccessMode").value = "0";
    new bootstrap.Modal($("#modalRole")).show();
}

async function createRoleFromModal() {
    const name = ($("#newRoleName").value || "").trim();
    const desc = ($("#newRoleDesc").value || "").trim();
    const visibilityScope = parseInt($("#newRoleVisibilityScope").value || "0", 10);
    const vagasDataScope = parseInt($("#newRoleVagasDataScope").value || "0", 10);
    const accessMode = parseInt($("#newRoleAccessMode").value || "0", 10);
    if (!name) {
        showToast("Validacao", "Informe o nome do perfil.");
        return;
    }

    const created = await apiFetchJson(ROLES_API_BASE, {
        method: "POST",
        body: JSON.stringify({ name, description: desc, isActive: true, visibilityScope, vagasDataScope, accessMode })
    });

    if (!created) {
        showToast("Perfil", "Falha ao criar perfil.");
        return;
    }

    await loadRoles();
    state.selectedRoleId = created.id;
    await loadRoleMenus(created.id);

    renderKPIs();
    renderRolesList();
    renderRoleEditor();
    renderRoleFilterOptions();
    renderUsers();
    bootstrap.Modal.getInstance($("#modalRole")).hide();
    showToast("Perfil", "Criado com sucesso. Ajuste as permissoes ao lado.");
}

function exportUsersCsv() {
    const users = applyUserFilters(state.users);
    const headers = ["Nome", "Email", "Departamento", "Status", "MFA", "Perfis", "Ultimo login", "Criado em"];
    const strip = (s) => String(s ?? "").replace(/\s+/g, " ").trim().replaceAll('"', '""');
    const csv = [
        headers.map(h => `"${strip(h)}"`).join(";"),
        ...users.map(u => {
            const row = [
                u.name,
                u.email,
                u.dept,
                u.status,
                u.mfaEnabled ? "on" : "off",
                (u.roleIds || []).map(roleName).join(", "),
                u.lastLoginAt ? fmtDate(u.lastLoginAt) : "",
                u.createdAt ? fmtDate(u.createdAt) : ""
            ];
            return row.map(x => `"${strip(x)}"`).join(";");
        })
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "usuarios_perfis.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function initLogo() {
    $("#logoDesktop").src = LOGO_DATA_URI;
    $("#logoMobile").src = LOGO_DATA_URI;
}

function wireClock() {
    const now = new Date();
    const buildEl = $("#buildId");
    if (buildEl) {
        buildEl.textContent = "build: api-" + String(now.getFullYear()).slice(2) + "-" + String(now.getMonth() + 1).padStart(2, "0");
    }

    const label = $("#nowLabel");
    if (!label) return;
    const tick = () => {
        const d = new Date();
        label.textContent = d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    };
    tick();
    setInterval(tick, 1000 * 15);
}

function wireTopButtons() {
    $("#btnExportUsers").addEventListener("click", exportUsersCsv);

    $("#btnPrimaryAction").addEventListener("click", () => {
        const usersActive = $("#tab-users").classList.contains("active");
        if (usersActive) openUserModal(null);
        else openRoleModal();
    });

    $("#btnNewUser").addEventListener("click", () => openUserModal(null));
    $("#btnNewRole").addEventListener("click", () => openRoleModal());
    $("#btnAuditMock").addEventListener("click", () => showToast("Auditoria", "Auditoria ainda nao implementada."));
}

function wireUsersFilters() {
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

function wireUserModal() {
    $("#btnUserSave").addEventListener("click", saveUserFromModal);
}

function wireRolesButtons() {
    $("#btnRoleSave").addEventListener("click", saveRoleEditor);
    $("#btnRoleClone").addEventListener("click", cloneSelectedRole);
    $("#btnRoleDelete").addEventListener("click", deleteSelectedRole);
    $("#btnCreateRole").addEventListener("click", createRoleFromModal);
}

function wireTabPrimaryAction() {
    const onTabShown = (ev) => {
        const id = ev.target?.id;
        if (id === "tab-users") {
            $("#btnPrimaryAction").innerHTML = `<i class="bi bi-person-plus"></i><span class="d-none d-sm-inline ms-1">Novo usuario</span>`;
        } else {
            $("#btnPrimaryAction").innerHTML = `<i class="bi bi-plus-circle"></i><span class="d-none d-sm-inline ms-1">Novo perfil</span>`;
        }
    };
    $("#tab-users").addEventListener("shown.bs.tab", onTabShown);
    $("#tab-roles").addEventListener("shown.bs.tab", onTabShown);
}

function refreshEnumDefaults() {
    ROLE_ALL = enumFirstCode("roleFilter", "all");
    DEFAULT_USER_STATUS = enumFirstCode("usuarioStatus", "active");
    DEFAULT_USER_STATUS_FILTER = enumFirstCode("usuarioStatusFilter", "all");
    DEFAULT_MFA_OPTION = enumFirstCode("usuarioMfaOption", "false");
}

function renderAll() {
    renderKPIs();
    renderRoleFilterOptions();
    renderUsers();
    renderRolesList();
    renderRoleEditor();
}

(async function init() {
    initLogo();
    wireClock();

    await ensureEnumData();
    refreshEnumDefaults();
    applyEnumSelects();

    await loadRoles();
    await loadMenus();
    await loadUsers();

    state.selectedRoleId = state.roles[0]?.id || null;
    if (state.selectedRoleId) await loadRoleMenus(state.selectedRoleId);

    wireTopButtons();
    wireUsersFilters();
    wireUserModal();
    wireRolesButtons();
    wireDrawerButtons();
    wireTabPrimaryAction();

    renderAll();
})();
