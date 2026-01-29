(function () {
  const ctx = window.PortalVagasIndexContext;
  const S = window.PortalVagasStrings;
  if (!ctx || window.PortalVagasApply) return;

  const LOCATION_BASE = "/PortalVagas/Locations";
  const ufSelect = document.getElementById("candidateUf");
  const citySelect = document.getElementById("candidateCity");
  const phoneInput = document.getElementById("phone");
  const salaryInput = document.getElementById("salaryExpectation");

  const applyModalEl = document.getElementById("applyModal");
  const applyModal = applyModalEl ? new bootstrap.Modal(applyModalEl, { backdrop: "static", keyboard: true }) : null;
  const applyForm = document.getElementById("applyForm");
  const applyAlert = document.getElementById("applyAlert");
  const sendBtn = document.getElementById("sendApplicationBtn");
  const sendBtnText = document.getElementById("sendBtnText");
  const sendBtnSpinner = document.getElementById("sendBtnSpinner");
  const attachmentInput = document.getElementById("attachment");
  const attachmentInvalid = document.getElementById("attachmentInvalid");

  let cachedUfs = null;
  const cityCache = new Map();

  function showApplyAlert(message) {
    if (!applyAlert) return;
    applyAlert.textContent = message;
    applyAlert.classList.remove("d-none");
  }

  function clearApplyAlert() {
    if (!applyAlert) return;
    applyAlert.textContent = "";
    applyAlert.classList.add("d-none");
  }

  function setSendLoading(isLoading) {
    if (!sendBtn || !sendBtnText || !sendBtnSpinner) return;
    sendBtn.disabled = isLoading;
    sendBtnSpinner.classList.toggle("d-none", !isLoading);
    sendBtnText.textContent = isLoading ? S.apply.sending : S.apply.send;
  }

  function setUfLoading(label, disabled = true) {
    if (!ufSelect) return;
    ufSelect.disabled = disabled;
    ufSelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = label;
    ufSelect.appendChild(opt);
  }

  function setCityLoading(label, disabled = true) {
    if (!citySelect) return;
    citySelect.disabled = disabled;
    citySelect.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = label;
    citySelect.appendChild(opt);
  }

  async function fetchUfs() {
    if (cachedUfs) return cachedUfs;
    const res = await fetch(`${LOCATION_BASE}/Ufs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = (Array.isArray(data) ? data : [])
      .map(uf => (uf || "").toString().trim().toUpperCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    cachedUfs = list;
    return list;
  }

  async function fetchCitiesForUf(uf) {
    const key = uf.toUpperCase();
    if (cityCache.has(key)) return cityCache.get(key);
    const res = await fetch(`${LOCATION_BASE}/Ufs/${encodeURIComponent(key)}/Cities`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = (Array.isArray(data) ? data : [])
      .map(city => (city || "").toString().trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    cityCache.set(key, list);
    return list;
  }

  async function populateUfSelect(selectedUf = "", lockSelect = false) {
    if (!ufSelect) return;
    setUfLoading(S.apply.loadUf, true);
    try {
      const list = await fetchUfs();
      ufSelect.disabled = false;
      ufSelect.innerHTML = `<option value="" selected>${S.apply.selectOption}</option>`;
      list.forEach(uf => {
        const opt = document.createElement("option");
        opt.value = uf;
        opt.textContent = uf;
        if (uf === selectedUf) opt.selected = true;
        ufSelect.appendChild(opt);
      });
      if (lockSelect) ufSelect.disabled = true;
    } catch (err) {
      console.error(err);
      setUfLoading(S.apply.ufLoadFail, true);
    }
  }

  async function loadCitiesForUf(uf, selectedCity = "", lockSelect = false) {
    if (!uf) {
      setCityLoading(S.apply.selectUfFirst, true);
      return;
    }
    setCityLoading(S.apply.loadCity, true);
    try {
      const cities = await fetchCitiesForUf(uf);
      citySelect.disabled = false;
      citySelect.innerHTML = `<option value="" selected>${S.apply.selectOption}</option>`;
      cities.forEach(name => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        if (name === selectedCity) opt.selected = true;
        citySelect.appendChild(opt);
      });
      if (lockSelect) citySelect.disabled = true;
    } catch (err) {
      console.error(err);
      setCityLoading(S.apply.cityLoadFail, true);
    }
  }

  const formatPhone = (value) => window.PortalVagasUtils?.formatPhone
    ? window.PortalVagasUtils.formatPhone(value)
    : value;

  function setupApplyMasks() {
    if (phoneInput) {
      phoneInput.addEventListener("input", () => {
      phoneInput.value = formatPhone(phoneInput.value);
      });
    }

    if (salaryInput) {
      salaryInput.addEventListener("input", () => {
        const digits = window.PortalVagasUtils?.digitsOnly
          ? window.PortalVagasUtils.digitsOnly(salaryInput.value)
          : salaryInput.value.replace(/[^\d]/g, "");
        salaryInput.dataset.raw = digits;
        const formatted = digits ? Number(digits).toLocaleString("pt-BR") : "";
        salaryInput.value = formatted;
      });
    }
  }

  function resetApplyLocation() {
    if (!ufSelect || !citySelect) return;
    populateUfSelect();
    setCityLoading(S.apply.selectUfFirst, true);
  }

  function validateAttachment() {
    if (!attachmentInput) return true;
    const file = attachmentInput.files && attachmentInput.files[0] ? attachmentInput.files[0] : null;
    attachmentInput.classList.remove("is-invalid");

    if (!file) return true;

    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      attachmentInvalid.textContent = S.apply.attachmentTooLarge;
      attachmentInput.classList.add("is-invalid");
      return false;
    }

    const allowedExt = [".pdf", ".doc", ".docx"];
    const name = (file.name || "").toLowerCase();
    const okExt = allowedExt.some(ext => name.endsWith(ext));

    if (!okExt) {
      attachmentInvalid.textContent = S.apply.attachmentInvalid;
      attachmentInput.classList.add("is-invalid");
      return false;
    }

    return true;
  }

  async function applyProfileToForm() {
    if (!ctx.apiBase || !ctx.tenantId) return;
    const response = await fetch("/PortalVagas/Profile", { credentials: "same-origin" });
    if (!response.ok) return;
    const data = await response.json();
    if (!data) return;

    const fullNameInput = document.getElementById("fullName");
    const emailInput = document.getElementById("email");
    const linkedinInput = document.getElementById("linkedin");
    const portfolioInput = document.getElementById("portfolio");

    if (fullNameInput) fullNameInput.value = data.nome ?? "";
    if (emailInput) emailInput.value = data.email ?? "";
    if (phoneInput) phoneInput.value = data.telefone ?? "";
    if (linkedinInput) linkedinInput.value = data.linkedin ?? "";
    if (portfolioInput) portfolioInput.value = data.portfolio ?? "";

    const uf = (data.uf || "").toUpperCase();
    const city = data.cidade || "";
    await populateUfSelect(uf, false);
    await loadCitiesForUf(uf, city, false);
  }

  function scrollToFirstInvalid() {
    const invalid = applyForm?.querySelector(".is-invalid, :invalid");
    if (invalid && typeof invalid.scrollIntoView === "function") {
      invalid.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function submitApplication(currentJob) {
    if (!applyForm) return;
    clearApplyAlert();
    applyForm.classList.add("was-validated");

    const isFormValid = applyForm.checkValidity();
    const isAttachmentValid = validateAttachment();

    if (!isFormValid || !isAttachmentValid) {
      showApplyAlert(S.apply.reviewFields);
      scrollToFirstInvalid();
      return;
    }

    if (!ctx.tenantId) {
      showApplyAlert(S.apply.tenantMissing);
      return;
    }

    setSendLoading(true);

    try {
      const formData = new FormData();
      formData.append("vagaId", currentJob?.dataset?.id || "");
      formData.append("nome", document.getElementById("fullName")?.value || "");
      formData.append("email", document.getElementById("email")?.value || "");
      formData.append("fone", document.getElementById("phone")?.value || "");
      const uf = document.getElementById("candidateUf")?.value || "";
      const city = document.getElementById("candidateCity")?.value || "";
      const cidadeUf = (city && uf) ? `${city}, ${uf}` : (city || uf);
      formData.append("cidadeUf", cidadeUf);
      formData.append("linkedin", document.getElementById("linkedin")?.value || "");
      formData.append("portfolio", document.getElementById("portfolio")?.value || "");
      formData.append("cargoAtual", document.getElementById("currentRole")?.value || "");
      formData.append("anosExperiencia", document.getElementById("experienceYears")?.value || "");

      const obsParts = [];
      const highlights = document.getElementById("highlights")?.value || "";
      const notes = document.getElementById("recruiterNotes")?.value || "";
      const salaryRaw = salaryInput?.dataset?.raw
        || (window.PortalVagasUtils?.digitsOnly
          ? window.PortalVagasUtils.digitsOnly(salaryInput?.value || "")
          : (salaryInput?.value || "").replace(/[^\d]/g, ""));
      const salary = salaryRaw ? `R$ ${Number(salaryRaw).toLocaleString("pt-BR")}` : "";
      const availability = document.getElementById("availability")?.value || "";

      if (highlights) obsParts.push(`Resumo: ${highlights}`);
      if (notes) obsParts.push(`Info: ${notes}`);
      if (salary) obsParts.push(`Pretensao salarial: ${salary}`);
      if (availability) obsParts.push(`Disponibilidade: ${availability}`);

      formData.append("observacoes", obsParts.join(" | "));

      if (attachmentInput?.files?.[0]) {
        formData.append("arquivo", attachmentInput.files[0]);
      }

      const url = `${ctx.apiBase}/api/public/candidaturas?tenantId=${encodeURIComponent(ctx.tenantId)}`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "X-Tenant-Id": ctx.tenantId },
        body: formData
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `HTTP ${response.status}`);
      }

      applyModal?.hide();
      if (window.Swal?.fire) {
        window.Swal.fire({
          icon: "success",
          title: S.apply.submitSuccessTitle,
          text: S.apply.submitSuccessText,
          confirmButtonText: S.common.ok
        });
      } else {
        ctx.showAppAlert("success", S.apply.submitSuccessFallback);
      }
    } catch (err) {
      console.error(err);
      showApplyAlert(S.apply.submitError);
    } finally {
      setSendLoading(false);
    }
  }

  function init(ctxRef) {
    if (ufSelect) {
      ufSelect.addEventListener("change", () => {
        loadCitiesForUf(ufSelect.value);
      });
    }

    if (attachmentInput) {
      attachmentInput.addEventListener("change", () => {
        try {
          validateAttachment();
        } catch (err) {
          console.error(err);
          showApplyAlert(S.apply.validateFileError);
        }
      });
    }

    if (applyForm) {
      applyForm.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        await submitApplication(ctxRef.currentJob);
      });
    }

    setupApplyMasks();
    resetApplyLocation();
  }

  window.PortalVagasApply = {
    init,
    open: async function (currentJob, applyModalJobLine) {
      if (!applyForm || !applyModal) return;
      clearApplyAlert();
      applyForm.classList.remove("was-validated");
      applyForm.reset();
      setSendLoading(false);
      resetApplyLocation();
      if (salaryInput) salaryInput.dataset.raw = "";

      document.getElementById("applyJobTitle").value = currentJob.dataset.title;
      document.getElementById("applyCompany").value = currentJob.dataset.company;
      document.getElementById("applyModalJobLine").textContent = applyModalJobLine;

      attachmentInput?.classList.remove("is-invalid");
      if (attachmentInvalid) attachmentInvalid.textContent = S.apply.invalidFile;

      await applyProfileToForm();
      applyModal.show();
    }
  };
})();
