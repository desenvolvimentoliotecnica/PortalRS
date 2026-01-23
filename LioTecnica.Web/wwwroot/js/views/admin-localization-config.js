(() => {
  const apiBase = "/Admin/LocalizationConfig/_api";
  const cultureSelect = document.getElementById("cultureSelect");
  const uiCultureSelect = document.getElementById("uiCultureSelect");
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
    const culture = data?.culture || "pt-BR";
    const uiCulture = data?.uiCulture || culture;
    if (cultureSelect) cultureSelect.value = culture;
    if (uiCultureSelect) uiCultureSelect.value = uiCulture;
  }

  function buildPayload() {
    const culture = cultureSelect?.value || "pt-BR";
    const uiCulture = uiCultureSelect?.value || culture;
    return { culture, uiCulture };
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
    fillForm(data);
    if (window.Swal && typeof window.Swal.fire === "function") {
      await window.Swal.fire({
        icon: "success",
        text: "Configuracao salva.",
        confirmButtonText: "Ok"
      });
      window.location.reload();
      return;
    }

    showAlert("success", "Configuracao salva.");
    window.location.reload();
  }

  btnSave?.addEventListener("click", () => saveConfig().catch(err => {
    console.error(err);
    showAlert("error", `Falha ao salvar configuracao. ${err.message || ""}`.trim());
  }));

  loadConfig().catch(console.error);
})();
