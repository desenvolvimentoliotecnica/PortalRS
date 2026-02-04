(() => {
  const apiBase = window.__ownerIaApiBase || "/Owner/IA/_api";

  function toast(msg, title) {
    if (typeof window.toast === "function") window.toast(msg, title);
    else console.info(title || "IA", msg);
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    return res.status === 204 ? null : res.json();
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  // ----- Keys -----
  async function loadKeys() {
    const container = document.getElementById("keysListContainer");
    try {
      const list = await apiFetch(apiBase + "/keys");
      if (!list || list.length === 0) {
        container.innerHTML = "<p class=\"text-muted mb-0\">Nenhuma chave cadastrada. Clique em Nova chave para adicionar.</p>";
        return;
      }
      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead><tr><th>Provedor</th><th>Nome</th><th>Ativo</th><th>Padrão</th><th></th></tr></thead>
            <tbody>
              ${list.map(k => `
                <tr>
                  <td>${escapeHtml(k.provider)}</td>
                  <td>${escapeHtml(k.name)}</td>
                  <td>${k.isActive ? "Sim" : "Não"}</td>
                  <td>${k.isDefault ? "Sim" : "—"}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-key-id="${k.id}" data-key-edit title="Editar"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-key-id="${k.id}" data-key-delete title="Excluir"><i class="bi bi-trash3"></i></button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>`;
      container.querySelectorAll("[data-key-delete]").forEach(btn => btn.addEventListener("click", () => deleteKey(btn.dataset.keyId)));
    } catch (e) {
      if (container) container.innerHTML = `<p class="text-danger mb-0">Erro: ${escapeHtml(e.message)}</p>`;
    }
  }

  const modalKey = document.getElementById("modalAiKey");
  const modalKeyTitle = document.getElementById("modalAiKeyTitle");
  const keyIdEl = document.getElementById("aiKeyId");
  const keyProviderEl = document.getElementById("aiKeyProvider");
  const keyNameEl = document.getElementById("aiKeyName");
  const keyValueEl = document.getElementById("aiKeyValue");
  const keyIsActiveEl = document.getElementById("aiKeyIsActive");
  const keyIsDefaultEl = document.getElementById("aiKeyIsDefault");

  function openModalKey(id) {
    keyIdEl.value = id || "";
    keyProviderEl.value = "";
    keyNameEl.value = "";
    keyValueEl.value = "";
    keyValueEl.placeholder = id ? "Deixe em branco para não alterar" : "Cole a API Key";
    keyIsActiveEl.checked = true;
    keyIsDefaultEl.checked = false;
    modalKeyTitle.textContent = id ? "Editar chave de API" : "Nova chave de API";
    keyProviderEl.disabled = !!id;
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalKey);
    bsModal.show();
  }

  document.getElementById("btnAddKey")?.addEventListener("click", () => openModalKey(null));

  document.getElementById("btnSaveAiKey")?.addEventListener("click", async () => {
    const id = (keyIdEl.value || "").trim();
    const provider = (keyProviderEl.value || "").trim();
    const name = (keyNameEl.value || "").trim();
    const key = (keyValueEl.value || "").trim();
    if (!provider) { toast("Selecione o provedor (Gemini, GPT ou Claude)."); return; }
    if (!name) { toast("Informe o nome da chave."); return; }
    if (!id && !key) { toast("Informe a chave (API Key)."); return; }

    try {
      if (id) {
        await apiFetch(apiBase + "/keys/" + id, {
          method: "PUT",
          body: JSON.stringify({
            name: name,
            isActive: keyIsActiveEl.checked,
            isDefault: keyIsDefaultEl.checked,
            key: key || null
          })
        });
        toast("Chave atualizada com sucesso.");
      } else {
        await apiFetch(apiBase + "/keys", {
          method: "POST",
          body: JSON.stringify({
            provider,
            name,
            key,
            isDefault: keyIsDefaultEl.checked
          })
        });
        toast("Chave cadastrada com sucesso.");
      }
      bootstrap.Modal.getInstance(modalKey)?.hide();
      loadKeys();
    } catch (e) {
      toast(e?.message || "Erro ao salvar chave.", "Erro");
    }
  });

  async function deleteKey(id) {
    if (!confirm("Excluir esta chave? Modelos vinculados a ela deixarão de funcionar até você vincular a outra chave.")) return;
    try {
      await apiFetch(apiBase + "/keys/" + id, { method: "DELETE" });
      toast("Chave excluída.");
      loadKeys();
    } catch (e) {
      toast(e?.message || "Erro ao excluir.", "Erro");
    }
  }

  // ----- Models -----
  async function loadModels() {
    const container = document.getElementById("modelsListContainer");
    try {
      const list = await apiFetch(apiBase + "/models");
      const keys = await apiFetch(apiBase + "/keys").catch(() => []);
      const keysMap = (keys || []).reduce((acc, k) => { acc[k.id] = k; return acc; }, {});

      if (!list || list.length === 0) {
        container.innerHTML = "<p class=\"text-muted mb-0\">Nenhum modelo cadastrado. Cadastre uma chave antes e depois clique em Novo modelo.</p>";
        return;
      }
      container.innerHTML = `
        <div class="table-responsive">
          <table class="table table-sm table-hover mb-0">
            <thead><tr><th>Chave (provedor)</th><th>ModelId</th><th>Nome</th><th>Padrão</th><th></th></tr></thead>
            <tbody>
              ${list.map(m => {
                const keyInfo = keysMap[m.aiProviderKeyId];
                const keyLabel = keyInfo ? `${keyInfo.name} (${keyInfo.provider})` : m.aiProviderKeyId;
                return `
                <tr>
                  <td>${escapeHtml(keyLabel)}</td>
                  <td><code>${escapeHtml(m.modelId)}</code></td>
                  <td>${escapeHtml(m.displayName)}</td>
                  <td>${m.isDefault ? "Sim" : "—"}</td>
                  <td>
                    <button type="button" class="btn btn-sm btn-outline-secondary me-1" data-model-id="${m.id}" data-model-edit title="Editar"><i class="bi bi-pencil"></i></button>
                    <button type="button" class="btn btn-sm btn-outline-danger" data-model-id="${m.id}" data-model-delete title="Excluir"><i class="bi bi-trash3"></i></button>
                  </td>
                </tr>
              `;
              }).join("")}
            </tbody>
          </table>
        </div>`;
      container.querySelectorAll("[data-model-edit]").forEach(btn => btn.addEventListener("click", () => editModel(btn.dataset.modelId)));
      container.querySelectorAll("[data-model-delete]").forEach(btn => btn.addEventListener("click", () => deleteModel(btn.dataset.modelId)));
    } catch (e) {
      container.innerHTML = `<p class="text-danger mb-0">Erro: ${escapeHtml(e.message)}</p>`;
    }
  }

  const modalModel = document.getElementById("modalAiModel");
  const modalModelTitle = document.getElementById("modalAiModelTitle");
  const modelIdEl = document.getElementById("aiModelId");
  const modelKeyIdEl = document.getElementById("aiModelKeyId");
  const modelTypeSuggestEl = document.getElementById("aiModelTypeSuggest");
  const modelModelIdEl = document.getElementById("aiModelModelId");
  const modelDisplayNameEl = document.getElementById("aiModelDisplayName");
  const modelIsDefaultEl = document.getElementById("aiModelIsDefault");

  function syncModelIdFromSuggest() {
    const v = (modelTypeSuggestEl?.value || "").trim();
    if (v) modelModelIdEl.value = v;
  }
  modelTypeSuggestEl?.addEventListener("change", syncModelIdFromSuggest);

  async function openModalModel(id) {
    modelIdEl.value = id || "";
    const keys = await apiFetch(apiBase + "/keys").catch(() => []);
    const activeKeys = (keys || []).filter(k => k.isActive);
    modelKeyIdEl.innerHTML = "<option value=\"\">Selecione uma chave...</option>" +
      activeKeys.map(k => `<option value="${k.id}">${escapeHtml(k.name)} (${escapeHtml(k.provider)})</option>`).join("");
    modelTypeSuggestEl.value = "";
    modelModelIdEl.value = "";
    modelDisplayNameEl.value = "";
    modelIsDefaultEl.checked = false;

    if (id) {
      modalModelTitle.textContent = "Editar modelo";
      const list = await apiFetch(apiBase + "/models").catch(() => []);
      const item = (list || []).find(m => m.id === id);
      if (item) {
        modelKeyIdEl.value = item.aiProviderKeyId;
        modelKeyIdEl.disabled = true;
        modelModelIdEl.value = item.modelId;
        modelDisplayNameEl.value = item.displayName || "";
        modelIsDefaultEl.checked = !!item.isDefault;
      }
    } else {
      modalModelTitle.textContent = "Novo modelo";
      modelKeyIdEl.disabled = false;
    }
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalModel);
    bsModal.show();
  }

  function editModel(id) {
    openModalModel(id);
  }

  document.getElementById("btnAddModel")?.addEventListener("click", async () => {
    const keys = await apiFetch(apiBase + "/keys").catch(() => []);
    if (!keys || keys.length === 0) {
      toast("Cadastre pelo menos uma chave antes de adicionar um modelo.");
      return;
    }
    openModalModel(null);
  });

  document.getElementById("btnSaveAiModel")?.addEventListener("click", async () => {
    const id = (modelIdEl.value || "").trim();
    const keyId = (modelKeyIdEl.value || "").trim();
    const modelIdVal = (modelModelIdEl.value || "").trim();
    const displayName = (modelDisplayNameEl.value || "").trim();
    if (!keyId) { toast("Selecione a chave (provedor)."); return; }
    if (!modelIdVal) { toast("Informe o ModelId ou escolha um tipo na lista."); return; }
    if (!displayName) { toast("Informe o nome para exibição."); return; }

    try {
      if (id) {
        await apiFetch(apiBase + "/models/" + id, {
          method: "PUT",
          body: JSON.stringify({
            modelId: modelIdVal,
            displayName: displayName,
            isDefault: modelIsDefaultEl.checked
          })
        });
        toast("Modelo atualizado com sucesso.");
      } else {
        await apiFetch(apiBase + "/models", {
          method: "POST",
          body: JSON.stringify({
            aiProviderKeyId: keyId,
            modelId: modelIdVal,
            displayName: displayName,
            isDefault: modelIsDefaultEl.checked
          })
        });
        toast("Modelo cadastrado com sucesso.");
      }
      bootstrap.Modal.getInstance(modalModel)?.hide();
      loadModels();
    } catch (e) {
      toast(e?.message || "Erro ao salvar modelo.", "Erro");
    }
  });

  async function deleteModel(id) {
    if (!confirm("Excluir este modelo?")) return;
    try {
      await apiFetch(apiBase + "/models/" + id, { method: "DELETE" });
      toast("Modelo excluído.");
      loadModels();
    } catch (e) {
      toast(e?.message || "Erro ao excluir.", "Erro");
    }
  }

  // ----- Dashboard -----
  function buildQuery(extra = {}) {
    const from = document.getElementById("filterFrom")?.value;
    const to = document.getElementById("filterTo")?.value;
    const tenantId = document.getElementById("filterTenantId")?.value?.trim();
    const module = document.getElementById("filterModule")?.value?.trim();
    const params = new URLSearchParams();
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    if (tenantId) params.set("tenantId", tenantId);
    if (module) params.set("module", module);
    Object.entries(extra).forEach(([k, v]) => { if (v != null && v !== "") params.set(k, v); });
    return params.toString();
  }

  document.getElementById("btnApplyFilters")?.addEventListener("click", loadDashboard);

  async function loadDashboard(page = 1) {
    const qSummary = buildQuery();
    const qDetail = buildQuery({ page, pageSize: 20 });
    const summaryTenantEl = document.getElementById("summaryByTenantContainer");
    const summaryUserEl = document.getElementById("summaryByUserContainer");
    const detailEl = document.getElementById("detailContainer");
    const paginationEl = document.getElementById("detailPagination");

    try {
      const [byTenant, byUser, detail] = await Promise.all([
        apiFetch(apiBase + "/usage/summary-by-tenant" + (qSummary ? "?" + qSummary : "")).catch(() => null),
        apiFetch(apiBase + "/usage/summary-by-user" + (qSummary ? "?" + qSummary : "")).catch(() => null),
        apiFetch(apiBase + "/usage/detail?" + qDetail).catch(() => null)
      ]);

      if (byTenant && byTenant.byTenant && byTenant.byTenant.length > 0) {
        summaryTenantEl.innerHTML = `
          <div class="table-responsive">
            <table class="table table-sm mb-0">
              <thead><tr><th>Tenant</th><th>Custo</th><th>Chamadas</th></tr></thead>
              <tbody>
                ${byTenant.byTenant.map(t => `<tr><td><code>${escapeHtml(t.tenantId)}</code></td><td>${Number(t.totalCost).toFixed(4)}</td><td>${t.usageCount}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
          <p class="small text-muted mt-2 mb-0"><strong>Total:</strong> custo ${Number(byTenant.totalCost).toFixed(4)}, ${byTenant.totalUsageCount} chamadas</p>`;
      } else {
        summaryTenantEl.innerHTML = "<p class=\"text-muted mb-0\">Nenhum uso no período.</p>";
      }

      if (byUser && byUser.byUser && byUser.byUser.length > 0) {
        summaryUserEl.innerHTML = `
          <div class="table-responsive">
            <table class="table table-sm mb-0">
              <thead><tr><th>Tenant</th><th>Usuário</th><th>Custo</th><th>Chamadas</th></tr></thead>
              <tbody>
                ${byUser.byUser.map(u => `<tr><td><code>${escapeHtml(u.tenantId)}</code></td><td>${escapeHtml(u.userName || u.userId?.toString() || "—")}</td><td>${Number(u.totalCost).toFixed(4)}</td><td>${u.usageCount}</td></tr>`).join("")}
              </tbody>
            </table>
          </div>
          <p class="small text-muted mt-2 mb-0"><strong>Total:</strong> custo ${Number(byUser.totalCost).toFixed(4)}, ${byUser.totalUsageCount} chamadas</p>`;
      } else {
        summaryUserEl.innerHTML = "<p class=\"text-muted mb-0\">Nenhum uso no período.</p>";
      }

      if (detail && detail.items && detail.items.length > 0) {
        detailEl.innerHTML = `
          <div class="table-responsive">
            <table class="table table-sm table-hover mb-0">
              <thead>
                <tr>
                  <th>Data</th><th>Tenant</th><th>Usuário</th><th>Módulo</th><th>Modelo</th><th>Custo</th><th>Descrição</th><th>Mensagem à IA</th>
                </tr>
              </thead>
              <tbody>
                ${detail.items.map(d => `
                  <tr>
                    <td>${new Date(d.createdAtUtc).toLocaleString()}</td>
                    <td><code>${escapeHtml(d.tenantId)}</code></td>
                    <td>${escapeHtml(d.userName || d.userId?.toString() || "—")}</td>
                    <td>${escapeHtml(d.module)}</td>
                    <td>${escapeHtml(d.modelDisplayName || "—")}</td>
                    <td>${Number(d.cost).toFixed(4)}</td>
                    <td>${escapeHtml((d.actionDescription || "").slice(0, 50))}${(d.actionDescription || "").length > 50 ? "…" : ""}</td>
                    <td>${escapeHtml((d.requestMessage || "").slice(0, 80))}${(d.requestMessage || "").length > 80 ? "…" : ""}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>`;
        const totalPages = detail.totalPages || 1;
        if (totalPages > 1) {
          let html = '<ul class="pagination pagination-sm mb-0">';
          for (let i = 1; i <= totalPages; i++) {
            html += `<li class="page-item ${i === page ? "active" : ""}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
          }
          html += "</ul>";
          paginationEl.innerHTML = html;
          paginationEl.querySelectorAll(".page-link").forEach(a => a.addEventListener("click", e => { e.preventDefault(); loadDashboard(parseInt(a.dataset.page, 10)); }));
        } else {
          paginationEl.innerHTML = "";
        }
      } else {
        detailEl.innerHTML = "<p class=\"text-muted mb-0\">Nenhum detalhe no período.</p>";
        paginationEl.innerHTML = "";
      }
    } catch (e) {
      summaryTenantEl.innerHTML = `<p class="text-danger mb-0">Erro: ${escapeHtml(e.message)}</p>`;
      summaryUserEl.innerHTML = "";
      detailEl.innerHTML = "";
      paginationEl.innerHTML = "";
    }
  }

  // Editar chave: carregar dados reais da API (para ter provider correto no select)
  async function loadKeyForEdit(id) {
    try {
      const list = await apiFetch(apiBase + "/keys");
      const item = (list || []).find(k => k.id === id);
      if (!item) {
        openModalKey(id);
        return;
      }
      keyIdEl.value = item.id;
      modalKeyTitle.textContent = "Editar chave de API";
      let provider = (item.provider || "").trim();
      if (!["Gpt", "Gemini", "Claude"].includes(provider)) {
        const lower = provider.toLowerCase();
        if (lower.includes("openai") || lower.includes("azure")) provider = "Gpt";
        else if (lower.includes("google") || lower.includes("gemini")) provider = "Gemini";
        else if (lower.includes("anthropic") || lower.includes("claude")) provider = "Claude";
      }
      keyProviderEl.value = provider;
      keyProviderEl.disabled = true;
      keyNameEl.value = item.name || "";
      keyValueEl.value = "";
      keyValueEl.placeholder = "Deixe em branco para não alterar";
      keyIsActiveEl.checked = !!item.isActive;
      keyIsDefaultEl.checked = !!item.isDefault;
      bootstrap.Modal.getOrCreateInstance(modalKey).show();
    } catch (_) {
      openModalKey(id);
    }
  }

  // Substituir clique em Editar chave para carregar dados da API
  document.getElementById("keysListContainer")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-key-edit]");
    if (editBtn) {
      e.preventDefault();
      loadKeyForEdit(editBtn.dataset.keyId);
    }
  });

  // Editar modelo: carregar dados reais da API
  async function loadModelForEdit(id) {
    try {
      const list = await apiFetch(apiBase + "/models");
      const item = (list || []).find(m => m.id === id);
      if (!item) return editModel(id);
      const keys = await apiFetch(apiBase + "/keys").catch(() => []);
      const activeKeys = (keys || []).filter(k => k.isActive);
      modelKeyIdEl.innerHTML = "<option value=\"\">Selecione uma chave...</option>" +
        activeKeys.map(k => `<option value="${k.id}">${escapeHtml(k.name)} (${escapeHtml(k.provider)})</option>`).join("");
      modelIdEl.value = item.id;
      modalModelTitle.textContent = "Editar modelo";
      modelKeyIdEl.value = item.aiProviderKeyId;
      modelKeyIdEl.disabled = true;
      modelModelIdEl.value = item.modelId || "";
      modelDisplayNameEl.value = item.displayName || "";
      modelIsDefaultEl.checked = !!item.isDefault;
      bootstrap.Modal.getOrCreateInstance(modalModel).show();
    } catch (_) {
      editModel(id);
    }
  }

  document.getElementById("modelsListContainer")?.addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-model-edit]");
    if (editBtn) {
      e.preventDefault();
      loadModelForEdit(editBtn.dataset.modelId);
    }
  });

  // Init
  loadKeys();
  loadModels();
  document.getElementById("dashboard-tab")?.addEventListener("shown.bs.tab", () => loadDashboard(1));
})();
