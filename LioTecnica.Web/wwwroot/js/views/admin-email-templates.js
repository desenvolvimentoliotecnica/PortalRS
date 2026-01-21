(() => {
  const apiBase = "/Admin/EmailTemplates/_api";
  const listEl = document.getElementById("tplList");
  const searchEl = document.getElementById("tplSearch");
  const searchTopEl = document.getElementById("tplSearchTop");
  const countEl = document.getElementById("tplCount");
  const nameEl = document.getElementById("tplName");
  const subjectEl = document.getElementById("tplSubject");
  const editorEl = document.getElementById("tplEditor");
  const metaEl = document.getElementById("tplMeta");
  const btnSave = document.getElementById("btnSave");
  const btnActivate = document.getElementById("btnActivate");
  const btnNew = document.getElementById("btnNewTemplate");

  let templates = [];
  let selected = null;

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  function renderList() {
    const term = (searchEl.value || "").trim().toLowerCase();
    const items = templates.filter(t => t.name.toLowerCase().includes(term));
    listEl.innerHTML = "";
    items.forEach(t => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      btn.dataset.id = t.id;
      btn.innerHTML = `
        <div>
          <div class="fw-semibold">${t.name}</div>
          <div class="text-muted small">v${t.version}</div>
        </div>
        ${t.isActive ? '<span class="badge bg-success">Ativo</span>' : '<span class="badge bg-secondary">Inativo</span>'}
      `;
      btn.addEventListener("click", () => selectTemplate(t.id));
      listEl.appendChild(btn);
    });
    countEl.textContent = String(items.length);
  }

  function updateEditorState(enabled) {
    subjectEl.disabled = !enabled;
    editorEl.setAttribute("contenteditable", enabled ? "true" : "false");
    btnSave.disabled = !enabled;
    btnActivate.disabled = !enabled || (selected && selected.isActive);
  }

  function fillEditor(tpl) {
    if (!tpl) {
      nameEl.textContent = "Nenhum";
      subjectEl.value = "";
      editorEl.innerHTML = "";
      metaEl.textContent = "Versao: -";
      updateEditorState(false);
      return;
    }
    nameEl.textContent = tpl.name;
    subjectEl.value = tpl.subjectTemplate || "";
    editorEl.innerHTML = tpl.bodyHtml || "";
    metaEl.textContent = `Versao: ${tpl.version} | ${tpl.isActive ? "Ativo" : "Inativo"}`;
    updateEditorState(true);
  }

  async function loadTemplates() {
    const data = await apiFetch(`${apiBase}/templates?includeInactive=true`);
    templates = Array.isArray(data) ? data : [];
    renderList();
    if (templates.length && !selected) {
      await selectTemplate(templates[0].id);
    }
  }

  async function selectTemplate(id) {
    const tpl = templates.find(t => t.id === id);
    if (!tpl) return;
    const detail = await apiFetch(`${apiBase}/templates/${id}`);
    selected = { ...tpl, ...detail };
    fillEditor(selected);
  }

  async function saveTemplate() {
    if (!selected) return;
    const payload = {
      subjectTemplate: subjectEl.value || "",
      bodyHtml: editorEl.innerHTML || ""
    };
    const updated = await apiFetch(`${apiBase}/templates/${selected.id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    selected = updated;
    await loadTemplates();
    await selectTemplate(updated.id);
  }

  async function activateTemplate() {
    if (!selected) return;
    await apiFetch(`${apiBase}/templates/${selected.id}/set-active`, { method: "POST" });
    await loadTemplates();
    await selectTemplate(selected.id);
  }

  async function createTemplate() {
    const name = prompt("Nome do template (ex: CandidaturaConfirmacao)");
    if (!name) return;
    const payload = {
      name,
      subjectTemplate: "Assunto do email",
      bodyHtml: "<p>Conteudo do template.</p>"
    };
    const created = await apiFetch(`${apiBase}/templates`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    selected = created;
    await loadTemplates();
    await selectTemplate(created.id);
  }

  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-cmd]");
    if (!btn) return;
    const cmd = btn.getAttribute("data-cmd");
    if (cmd === "createLink") {
      const url = prompt("URL");
      if (url) document.execCommand(cmd, false, url);
      return;
    }
    document.execCommand(cmd, false, null);
  });

  searchEl?.addEventListener("input", renderList);
  searchTopEl?.addEventListener("input", () => {
    if (searchEl) searchEl.value = searchTopEl.value;
    renderList();
  });
  btnSave?.addEventListener("click", saveTemplate);
  btnActivate?.addEventListener("click", activateTemplate);
  btnNew?.addEventListener("click", createTemplate);

  loadTemplates().catch(err => {
    console.error(err);
    if (listEl) listEl.innerHTML = `<div class="text-danger small">Falha ao carregar templates.</div>`;
  });
})();
