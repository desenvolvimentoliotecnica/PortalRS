(() => {
  const apiBase = "/Admin/EntraIdConfig/_api";
  const entraEnabled = document.getElementById("entraEnabled");
  const entraTenantId = document.getElementById("entraTenantId");
  const entraClientId = document.getElementById("entraClientId");
  const entraClientSecret = document.getElementById("entraClientSecret");
  const entraCallbackPath = document.getElementById("entraCallbackPath");
  const entraHasSecret = document.getElementById("entraHasSecret");
  const btnSave = document.getElementById("btnSaveConfig");

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

  function showAlert(type, message) {
    if (window.Swal && typeof window.Swal.fire === "function") {
      window.Swal.fire({
        icon: type,
        text: message || "",
        confirmButtonText: "Ok"
      });
      return;
    }
    if (window.toast) window.toast(message || "");
  }

  function fillForm(data) {
    if (!data) return;
    entraEnabled.checked = !!data.isEnabled;
    entraTenantId.value = data.entraTenantId ?? "";
    entraClientId.value = data.clientId ?? "";
    entraCallbackPath.value = data.callbackPath ?? "/signin-entra";
    entraHasSecret.textContent = data.hasClientSecret ? "Segredo configurado." : "Segredo nao configurado.";
  }

  function buildPayload() {
    return {
      isEnabled: !!entraEnabled.checked,
      entraTenantId: entraTenantId.value.trim(),
      clientId: entraClientId.value.trim(),
      clientSecret: entraClientSecret.value.trim() || null,
      callbackPath: entraCallbackPath.value.trim()
    };
  }

  async function loadConfig() {
    try {
      const data = await apiFetch(`${apiBase}/config`);
      fillForm(data);
    } catch {
      fillForm(null);
    }
  }

  async function saveConfig() {
    const payload = buildPayload();
    const data = await apiFetch(`${apiBase}/config`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    if (entraClientSecret) entraClientSecret.value = "";
    fillForm(data);
    showAlert("success", "Configuracao salva.");
  }

  btnSave?.addEventListener("click", () => saveConfig().catch(err => {
    console.error(err);
    showAlert("error", `Falha ao salvar configuracao. ${err.message || ""}`.trim());
  }));

  loadConfig().catch(console.error);
})();
