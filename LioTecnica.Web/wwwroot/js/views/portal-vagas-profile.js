(() => {
  const btnProfile = document.getElementById("btnProfile");
  const modalEl = document.getElementById("profileModal");
  const form = document.getElementById("profileForm");
  const saveBtn = document.getElementById("profileSaveBtn");
  const nameInput = document.getElementById("profileName");
  const emailInput = document.getElementById("profileEmail");
  const phoneInput = document.getElementById("profilePhone");
  const citySelect = document.getElementById("profileCity");
  const ufSelect = document.getElementById("profileUf");
  const linkedinInput = document.getElementById("profileLinkedin");
  const resumoInput = document.getElementById("profileResumo");
  const detailNameInput = document.getElementById("profileDetailNameInput");
  const detailEmailInput = document.getElementById("profileDetailEmailInput");
  const detailPhoneInput = document.getElementById("profileDetailPhoneInput");
  const avatarInput = document.getElementById("profileAvatarInput");
  const avatarImg = document.getElementById("profileAvatarImg");
  const avatarFallback = document.getElementById("profileAvatarFallback");
  const avatarName = document.getElementById("profileAvatarName");
  const cvInput = document.getElementById("cvFileInput");
  const cvName = document.getElementById("cvFileName");
  const cvDate = document.getElementById("cvFileDate");
  const userName = document.getElementById("portalUserName");
  const userEmail = document.getElementById("portalUserEmail");
  const userAvatar = document.getElementById("portalUserAvatar");

  if (!btnProfile || !modalEl || !form || !saveBtn || !window.bootstrap) return;

  const modal = new bootstrap.Modal(modalEl, { backdrop: true });
  const LOCATION_BASE = "/PortalVagas/Locations";
  let cachedUfs = null;
  const cityCache = new Map();

  const showSwal = (icon, title, text) => {
    window.Swal.fire({
      icon,
      title,
      text,
      confirmButtonText: "Ok"
    });
  };

  const setLoading = (isLoading) => {
    if (!saveBtn) return;
    saveBtn.disabled = isLoading;
    saveBtn.textContent = isLoading ? "Salvando..." : "Salvar";
  };

  const digitsOnly = (value) => (value || "").replace(/\D/g, "");

  const formatPhone = (value) => {
    const digits = digitsOnly(value).slice(0, 11);
    if (!digits) return "";
    const ddd = digits.slice(0, 2);
    const part1 = digits.length > 2 ? digits.slice(2, digits.length > 6 ? 7 : 6) : "";
    const part2 = digits.length > 6 ? digits.slice(7) : "";
    if (digits.length <= 6) return `(${ddd}) ${digits.slice(2)}`;
    return `(${ddd}) ${part1}-${part2}`;
  };

  const setSelectLoading = (select, label, disabled = true) => {
    if (!select) return;
    select.disabled = disabled;
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = label;
    select.appendChild(opt);
  };

  const fetchUfs = async () => {
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
  };

  const populateUfSelect = async (selectedUf = "") => {
    if (!ufSelect) return;
    setSelectLoading(ufSelect, "Carregando UFs...", true);
    try {
      const list = await fetchUfs();
      ufSelect.disabled = false;
      ufSelect.innerHTML = '<option value="" selected>Selecione</option>';
      list.forEach(uf => {
        const opt = document.createElement("option");
        opt.value = uf;
        opt.textContent = uf;
        if (uf === selectedUf) opt.selected = true;
        ufSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      setSelectLoading(ufSelect, "Nao foi possivel carregar UFs", true);
    }
  };

  const fetchCitiesForUf = async (uf) => {
    const key = (uf || "").trim().toUpperCase();
    if (!key) return [];
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
  };

  const populateCitySelect = async (uf, selectedCity = "") => {
    if (!citySelect) return;
    if (!uf) {
      setSelectLoading(citySelect, "Selecione a UF primeiro", true);
      return;
    }
    setSelectLoading(citySelect, "Carregando municipios...", true);
    try {
      const list = await fetchCitiesForUf(uf);
      citySelect.disabled = false;
      citySelect.innerHTML = '<option value="" selected>Selecione</option>';
      list.forEach(city => {
        const opt = document.createElement("option");
        opt.value = city;
        opt.textContent = city;
        if (city === selectedCity) opt.selected = true;
        citySelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      setSelectLoading(citySelect, "Nao foi possivel carregar cidades", true);
    }
  };

  const buildInitials = (name) => {
    const parts = (name || "")
      .trim()
      .split(" ")
      .filter(Boolean);
    if (!parts.length) return "US";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
    return (first + last).toUpperCase() || "US";
  };

  const formatDateTimeBr = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR");
  };

  const setAvatar = (url, name) => {
    if (avatarName) avatarName.textContent = name || "";
    if (!avatarImg || !avatarFallback) return;
    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = "block";
      avatarFallback.style.display = "none";
      return;
    }
    avatarImg.removeAttribute("src");
    avatarImg.style.display = "none";
    avatarFallback.textContent = buildInitials(name || "U");
    avatarFallback.style.display = "inline";
  };

  const setCurriculo = (curriculo) => {
    if (!cvName || !cvDate) return;
    if (!curriculo) {
      cvName.textContent = "";
      cvDate.textContent = "";
      return;
    }
    cvName.textContent = curriculo.nomeArquivo || "";
    cvDate.textContent = curriculo.createdAtUtc ? `Enviado em ${formatDateTimeBr(curriculo.createdAtUtc)}` : "";
  };

  const loadProfile = async () => {
    const response = await fetch("/PortalVagas/Profile", {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "same-origin"
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showSwal("error", "Nao foi possivel carregar", data.message || "Tente novamente.");
      return null;
    }

    return data;
  };

  btnProfile.addEventListener("click", async () => {
    try {
      const data = await loadProfile();
      if (!data) return;

      nameInput.value = data.nome || "";
      emailInput.value = data.email || "";
      phoneInput.value = formatPhone(data.fone || "");
      if (detailNameInput) detailNameInput.value = data.nome || "";
      if (detailEmailInput) detailEmailInput.value = data.email || "";
      if (detailPhoneInput) detailPhoneInput.value = formatPhone(data.fone || "");
      if (linkedinInput) linkedinInput.value = data.linkedinUrl || "";
      if (resumoInput) resumoInput.value = data.resumoProfissional || "";
      setAvatar(data.avatarUrl || "", data.nome || "");
      setCurriculo(data.curriculo);
      if (phoneInput) {
        const digits = digitsOnly(phoneInput.value);
        phoneInput.setCustomValidity(digits.length === 11 ? "" : "Telefone invalido.");
      }

      await populateUfSelect((data.uf || "").toUpperCase());
      await populateCitySelect((data.uf || "").toUpperCase(), data.cidade || "");

      form.classList.remove("was-validated");
      modal.show();
    } catch (err) {
      console.error(err);
      showSwal("error", "Erro inesperado", "Tente novamente em alguns instantes.");
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add("was-validated");
      form.reportValidity();
      return;
    }

    const payload = {
      nome: nameInput.value.trim(),
      fone: phoneInput.value.trim(),
      cidade: citySelect.value.trim(),
      uf: ufSelect.value.trim().toUpperCase(),
      linkedinUrl: (linkedinInput?.value || "").trim(),
      resumoProfissional: (resumoInput?.value || "").trim()
    };

    setLoading(true);
    try {
      const response = await fetch("/PortalVagas/Profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showSwal("error", "Nao foi possivel atualizar", data.message || "Verifique seus dados e tente novamente.");
        return;
      }

      if (userName) userName.textContent = data.nome || payload.nome;
      if (userEmail) userEmail.textContent = data.email || emailInput.value;
      if (userAvatar) userAvatar.textContent = buildInitials(data.nome || payload.nome);
      if (detailNameInput) detailNameInput.value = data.nome || payload.nome;
      if (detailEmailInput) detailEmailInput.value = data.email || emailInput.value;
      if (detailPhoneInput) detailPhoneInput.value = formatPhone(data.fone || payload.fone);
      if (linkedinInput && data.linkedinUrl !== undefined) linkedinInput.value = data.linkedinUrl || "";
      if (resumoInput && data.resumoProfissional !== undefined) resumoInput.value = data.resumoProfissional || "";
      setAvatar(data.avatarUrl || "", data.nome || payload.nome);
      setCurriculo(data.curriculo);

      showSwal("success", "Perfil atualizado", "Seus dados foram salvos.");
    } catch (err) {
      console.error(err);
      showSwal("error", "Erro inesperado", "Nao foi possivel salvar seu perfil.");
    } finally {
      setLoading(false);
    }
  });

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      const formatted = formatPhone(phoneInput.value);
      phoneInput.value = formatted;
      const digits = digitsOnly(formatted);
      phoneInput.setCustomValidity(digits.length === 11 ? "" : "Telefone invalido.");
    });
  }

  if (ufSelect) {
    ufSelect.addEventListener("change", async () => {
      await populateCitySelect(ufSelect.value, "");
    });
  }

  if (avatarInput) {
    avatarInput.addEventListener("change", async () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("arquivo", file);
      try {
        const response = await fetch("/PortalVagas/Profile/Avatar", {
          method: "POST",
          credentials: "same-origin",
          body: formData
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showSwal("error", "Nao foi possivel salvar foto", data.message || "Tente novamente.");
          return;
        }
        setAvatar(data.avatarUrl || "", nameInput.value.trim());
      } catch (err) {
        console.error(err);
        showSwal("error", "Erro inesperado", "Nao foi possivel salvar sua foto.");
      } finally {
        avatarInput.value = "";
      }
    });
  }

  if (cvInput) {
    cvInput.addEventListener("change", async () => {
      const file = cvInput.files?.[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("arquivo", file);
      try {
        const response = await fetch("/PortalVagas/Profile/Curriculo", {
          method: "POST",
          credentials: "same-origin",
          body: formData
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          showSwal("error", "Nao foi possivel enviar curriculo", data.message || "Tente novamente.");
          return;
        }
        setCurriculo(data);
      } catch (err) {
        console.error(err);
        showSwal("error", "Erro inesperado", "Nao foi possivel enviar seu curriculo.");
      } finally {
        cvInput.value = "";
      }
    });
  }
})();
