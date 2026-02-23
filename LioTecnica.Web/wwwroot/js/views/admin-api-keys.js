(() => {
  const apiBase = "/Admin/ApiKeys/_api";
  const keysLoading = document.getElementById("keysLoading");
  const keysList = document.getElementById("keysList");
  const keysEmpty = document.getElementById("keysEmpty");
  const modalCreateKey = document.getElementById("modalCreateKey");
  const modalShowKey = document.getElementById("modalShowKey");
  const newKeyName = document.getElementById("newKeyName");
  const newKeyDescription = document.getElementById("newKeyDescription");
  const btnCreateKey = document.getElementById("btnCreateKey");
  const createdKeyValue = document.getElementById("createdKeyValue");
  const btnCopyKey = document.getElementById("btnCopyKey");

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      const body = await res.text();
      let msg = body;
      try {
        const j = JSON.parse(body);
        if (j.error) msg = j.error;
      } catch (_) {}
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  function showAlert(type, message) {
    if (window.Swal && typeof window.Swal.fire === "function") {
      window.Swal.fire({ icon: type, text: message || "", confirmButtonText: "Ok" });
      return;
    }
    if (window.toast) window.toast(message || "");
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function renderKeys(list) {
    if (!list || list.length === 0) {
      keysList.classList.add("d-none");
      keysEmpty.classList.remove("d-none");
      return;
    }
    keysEmpty.classList.add("d-none");
    keysList.classList.remove("d-none");
    keysList.innerHTML = `
      <div class="table-responsive">
        <table class="table table-hover align-middle mb-0">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Descrição</th>
              <th>Ativa</th>
              <th>Criada em</th>
              <th>Último uso</th>
              <th class="text-end">Ações</th>
            </tr>
          </thead>
          <tbody>
            ${list.map(k => `
              <tr data-id="${k.id}">
                <td><strong>${escapeHtml(k.name)}</strong></td>
                <td class="text-muted">${escapeHtml(k.description || "—")}</td>
                <td>${k.isActive ? '<span class="badge bg-success">Sim</span>' : '<span class="badge bg-secondary">Revogada</span>'}</td>
                <td>${formatDate(k.createdAtUtc)}</td>
                <td>${formatDate(k.lastUsedAtUtc)}</td>
                <td class="text-end">
                  ${k.isActive ? `<button type="button" class="btn btn-sm btn-outline-danger revoke-key" data-id="${k.id}" data-name="${escapeHtml(k.name)}">Revogar</button>` : "—"}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    keysList.querySelectorAll(".revoke-key").forEach(btn => {
      btn.addEventListener("click", () => revokeKey(btn.dataset.id, btn.dataset.name));
    });
  }

  function escapeHtml(s) {
    if (!s) return "";
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  async function loadKeys() {
    keysLoading.classList.remove("d-none");
    keysList.classList.add("d-none");
    keysEmpty.classList.add("d-none");
    try {
      const list = await apiFetch(`${apiBase}/keys`);
      renderKeys(list);
    } catch (err) {
      showAlert("error", "Falha ao carregar chaves: " + (err.message || ""));
      keysEmpty.classList.remove("d-none");
      keysEmpty.textContent = "Erro ao carregar.";
    } finally {
      keysLoading.classList.add("d-none");
    }
  }

  async function createKey() {
    const name = (newKeyName.value || "").trim();
    if (!name) {
      showAlert("warning", "Informe o nome da chave.");
      return;
    }
    btnCreateKey.disabled = true;
    try {
      const result = await apiFetch(`${apiBase}/keys`, {
        method: "POST",
        body: JSON.stringify({ name, description: (newKeyDescription.value || "").trim() || null })
      });
      if (result && result.key) {
        createdKeyValue.value = result.key;
        const bsModal = bootstrap.Modal.getOrCreateInstance(modalCreateKey);
        bsModal.hide();
        newKeyName.value = "";
        newKeyDescription.value = "";
        const showModal = bootstrap.Modal.getOrCreateInstance(modalShowKey);
        showModal.show();
        await loadKeys();
      } else {
        showAlert("error", "Chave criada mas valor não retornado.");
      }
    } catch (err) {
      showAlert("error", "Falha ao criar chave: " + (err.message || ""));
    } finally {
      btnCreateKey.disabled = false;
    }
  }

  async function revokeKey(id, name) {
    if (!window.Swal || typeof window.Swal.fire !== "function") {
      if (!confirm(`Revogar a chave "${name}"? Ela deixará de funcionar.`)) return;
    } else {
      const { isConfirmed } = await window.Swal.fire({
        title: "Revogar chave?",
        text: `A chave "${name}" deixará de funcionar. Esta ação não pode ser desfeita.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sim, revogar",
        cancelButtonText: "Cancelar"
      });
      if (!isConfirmed) return;
    }
    try {
      await apiFetch(`${apiBase}/keys/${id}`, { method: "DELETE" });
      showAlert("success", "Chave revogada.");
      await loadKeys();
    } catch (err) {
      showAlert("error", "Falha ao revogar: " + (err.message || ""));
    }
  }

  btnCreateKey?.addEventListener("click", () => createKey());
  btnCopyKey?.addEventListener("click", () => {
    createdKeyValue.select();
    document.execCommand("copy");
    showAlert("success", "Chave copiada para a área de transferência.");
  });

  loadKeys().catch(console.error);
})();
