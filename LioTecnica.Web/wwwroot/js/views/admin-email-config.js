(() => {
  const apiBase = "/Admin/EmailConfig/_api";
  const smtpHost = document.getElementById("smtpHost");
  const smtpPort = document.getElementById("smtpPort");
  const smtpSsl = document.getElementById("smtpSsl");
  const smtpUser = document.getElementById("smtpUser");
  const smtpPass = document.getElementById("smtpPass");
  const smtpFromName = document.getElementById("smtpFromName");
  const smtpFromAddress = document.getElementById("smtpFromAddress");
  const smtpTestTo = document.getElementById("smtpTestTo");
  const smtpHasPass = document.getElementById("smtpHasPass");

  const imapHost = document.getElementById("imapHost");
  const imapPort = document.getElementById("imapPort");
  const imapSsl = document.getElementById("imapSsl");
  const imapUser = document.getElementById("imapUser");
  const imapPass = document.getElementById("imapPass");
  const imapHasPass = document.getElementById("imapHasPass");

  const btnSave = document.getElementById("btnSaveConfig");
  const btnTestSmtp = document.getElementById("btnTestSmtp");
  const btnTestImap = document.getElementById("btnTestImap");

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

  async function apiFetchText(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text || `HTTP ${res.status}`);
    }
    return text;
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
    smtpHost.value = data.smtpHost ?? "";
    smtpPort.value = data.smtpPort ?? 587;
    smtpSsl.value = String(data.smtpEnableSsl ?? true);
    smtpUser.value = data.smtpUserName ?? "";
    smtpFromName.value = data.smtpFromName ?? "";
    smtpFromAddress.value = data.smtpFromAddress ?? "";
    smtpHasPass.textContent = data.smtpHasPassword ? "Senha configurada." : "Senha nao configurada.";

    imapHost.value = data.imapHost ?? "";
    imapPort.value = data.imapPort ?? 993;
    imapSsl.value = String(data.imapEnableSsl ?? true);
    imapUser.value = data.imapUserName ?? "";
    imapHasPass.textContent = data.imapHasPassword ? "Senha configurada." : "Senha nao configurada.";
  }

  function buildPayload() {
    return {
      provider: "smtp",
      smtpHost: smtpHost.value.trim(),
      smtpPort: Number(smtpPort.value || 587),
      smtpEnableSsl: smtpSsl.value === "true",
      smtpUserName: smtpUser.value.trim(),
      smtpPassword: smtpPass.value.trim() || null,
      smtpFromName: smtpFromName.value.trim(),
      smtpFromAddress: smtpFromAddress.value.trim(),
      imapHost: imapHost.value.trim(),
      imapPort: Number(imapPort.value || 993),
      imapEnableSsl: imapSsl.value === "true",
      imapUserName: imapUser.value.trim(),
      imapPassword: imapPass.value.trim() || null
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
    if (smtpPass) smtpPass.value = "";
    if (imapPass) imapPass.value = "";
    fillForm(data);
    showAlert("success", "Configuracao salva.");
  }

  async function testSmtp() {
    const payload = buildPayload();
    payload.testTo = smtpTestTo.value.trim();
    const message = await apiFetchText(`${apiBase}/test-smtp`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showAlert("success", message || "Teste SMTP OK");
  }

  async function testImap() {
    const payload = buildPayload();
    const message = await apiFetchText(`${apiBase}/test-imap`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showAlert("success", message || "Teste IMAP OK");
  }

  btnSave?.addEventListener("click", () => saveConfig().catch(err => {
    console.error(err);
    showAlert("error", `Falha ao salvar configuracao. ${err.message || ""}`.trim());
  }));
  btnTestSmtp?.addEventListener("click", () => testSmtp().catch(err => {
    console.error(err);
    showAlert("error", `Falha ao testar SMTP. ${err.message || ""}`.trim());
  }));
  btnTestImap?.addEventListener("click", () => testImap().catch(err => {
    console.error(err);
    showAlert("error", `Falha ao testar IMAP. ${err.message || ""}`.trim());
  }));

  loadConfig().catch(console.error);
})();
