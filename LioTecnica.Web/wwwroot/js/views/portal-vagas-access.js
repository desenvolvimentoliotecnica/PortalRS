(() => {
  const loginForm = document.getElementById("candidateLoginForm");
  if (!loginForm) return;

  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginSubmit = document.getElementById("loginSubmit");
  const registerBtn = document.getElementById("openRegister");
  const registerModalEl = document.getElementById("registerModal");
  const registerForm = document.getElementById("registerForm");
  const registerSubmit = document.getElementById("registerSubmit");
  const registerName = document.getElementById("registerName");
  const registerEmail = document.getElementById("registerEmail");
  const registerPhone = document.getElementById("registerPhone");
  const registerUf = document.getElementById("registerUf");
  const registerCity = document.getElementById("registerCity");
  const registerPassword = document.getElementById("registerPassword");
  const registerPasswordConfirm = document.getElementById("registerPasswordConfirm");
  const tenantInput = document.getElementById("tenantId");
  const returnUrlInput = document.getElementById("returnUrl");
  const tenantNotice = document.getElementById("tenantNotice");
  const LOCATION_BASE = "/PortalVagas/Locations";
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  let cachedUfs = null;
  const cityCache = new Map();

  const getTenantId = () => (tenantInput?.value || "").trim();
  const getReturnUrl = () => (returnUrlInput?.value || "").trim();

  const toggleLoading = (isLoading) => {
    if (!loginSubmit) return;
    loginSubmit.disabled = isLoading;
    loginSubmit.textContent = isLoading ? "Entrando..." : "Entrar no portal";
  };

  const showSwal = (icon, title, text) => {
    window.Swal.fire({
      icon,
      title,
      text,
      confirmButtonText: "Ok"
    });
  };

  const ensureTenant = () => {
    const tenantId = getTenantId();
    const invalid = !tenantId;
    if (tenantNotice) tenantNotice.hidden = !invalid;
    return !invalid;
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

  const populateUfSelect = async (select) => {
    if (!select) return;
    setSelectLoading(select, "Carregando UFs...", true);
    try {
      const list = await fetchUfs();
      select.disabled = false;
      select.innerHTML = '<option value="" selected>Selecione</option>';
      list.forEach(uf => {
        const opt = document.createElement("option");
        opt.value = uf;
        opt.textContent = uf;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      setSelectLoading(select, "Nao foi possivel carregar UFs", true);
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

  const populateCitySelect = async (uf, select) => {
    if (!select) return;
    if (!uf) {
      setSelectLoading(select, "Selecione a UF primeiro", true);
      return;
    }
    setSelectLoading(select, "Carregando municipios...", true);
    try {
      const list = await fetchCitiesForUf(uf);
      select.disabled = false;
      select.innerHTML = '<option value="" selected>Selecione</option>';
      list.forEach(city => {
        const opt = document.createElement("option");
        opt.value = city;
        opt.textContent = city;
        select.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      setSelectLoading(select, "Nao foi possivel carregar cidades", true);
    }
  };

  ensureTenant();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!ensureTenant()) {
      showSwal("warning", "Tenant nao informado", "Use o link enviado pelo RH para acessar.");
      return;
    }

    if (!loginForm.checkValidity()) {
      loginForm.reportValidity();
      return;
    }

    toggleLoading(true);
    try {
      const payload = {
        email: loginEmail?.value?.trim() || "",
        password: loginPassword?.value || "",
        tenantId: getTenantId(),
        returnUrl: getReturnUrl()
      };

      const response = await fetch("/PortalVagas/Auth/Login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        showSwal("error", "Nao foi possivel entrar", data.message || "Verifique seus dados e tente novamente.");
        return;
      }

      if (data && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      showSwal("success", "Acesso liberado", "Redirecionando...");
      window.location.href = "/PortalVagas";
    } catch (err) {
      console.error(err);
      showSwal("error", "Erro inesperado", "Tente novamente em alguns instantes.");
    } finally {
      toggleLoading(false);
    }
  });

  const registerModal = registerModalEl && window.bootstrap
    ? new bootstrap.Modal(registerModalEl, { backdrop: true })
    : null;

  const resetRegisterForm = async () => {
    if (!registerForm) return;
    registerForm.reset();
    registerForm.classList.remove("was-validated");
    if (registerUf) {
      await populateUfSelect(registerUf);
    }
    if (registerCity) {
      setSelectLoading(registerCity, "Selecione a UF primeiro", true);
    }
    if (registerPhone) {
      registerPhone.value = "";
      registerPhone.setCustomValidity("Telefone invalido.");
    }
    if (registerPassword) registerPassword.setCustomValidity("");
    if (registerPasswordConfirm) registerPasswordConfirm.setCustomValidity("");
  };

  if (registerBtn && registerModal) {
    registerBtn.addEventListener("click", async () => {
      if (!ensureTenant()) {
        showSwal("warning", "Tenant nao informado", "Use o link enviado pelo RH para acessar.");
        return;
      }
      await resetRegisterForm();
      registerModal.show();
    });
  }

  if (registerPhone) {
    registerPhone.addEventListener("input", () => {
      const formatted = formatPhone(registerPhone.value);
      registerPhone.value = formatted;
      const digits = digitsOnly(formatted);
      registerPhone.setCustomValidity(digits.length === 11 ? "" : "Telefone invalido.");
    });
  }

  if (registerUf && registerCity) {
    registerUf.addEventListener("change", async () => {
      await populateCitySelect(registerUf.value, registerCity);
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (!ensureTenant()) {
        showSwal("warning", "Tenant nao informado", "Use o link enviado pelo RH para acessar.");
        return;
      }

      const emailValue = registerEmail?.value?.trim() || "";
      if (registerEmail) {
        registerEmail.setCustomValidity(EMAIL_REGEX.test(emailValue) ? "" : "Email invalido.");
      }

      const phoneDigits = digitsOnly(registerPhone?.value || "");
      if (registerPhone) {
        registerPhone.setCustomValidity(phoneDigits.length === 11 ? "" : "Telefone invalido.");
      }

      const passValue = registerPassword?.value || "";
      if (registerPassword) {
        registerPassword.setCustomValidity(PASSWORD_REGEX.test(passValue) ? "" : "Senha invalida.");
      }

      const confirmValue = registerPasswordConfirm?.value || "";
      if (registerPasswordConfirm) {
        registerPasswordConfirm.setCustomValidity(passValue === confirmValue ? "" : "Senha diferente.");
      }

      if (!registerForm.checkValidity()) {
        registerForm.classList.add("was-validated");
        registerForm.reportValidity();
        return;
      }

      const confirm = await window.Swal.fire({
        title: "Confirmar cadastro",
        text: `Criar acesso para ${emailValue}?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Cadastrar",
        cancelButtonText: "Cancelar"
      });

      if (!confirm.isConfirmed) return;

      if (registerSubmit) {
        registerSubmit.disabled = true;
        registerSubmit.textContent = "Criando...";
      }

      try {
        const payload = {
          nome: registerName?.value?.trim() || "",
          email: emailValue,
          fone: formatPhone(phoneDigits),
          cidade: registerCity?.value?.trim() || "",
          uf: registerUf?.value?.trim().toUpperCase() || "",
          password: passValue,
          tenantId: getTenantId(),
          returnUrl: getReturnUrl()
        };

        const response = await fetch("/PortalVagas/Auth/Register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          credentials: "same-origin",
          body: JSON.stringify(payload)
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          window.Swal.fire({
            icon: "error",
            title: "Nao foi possivel cadastrar",
            text: data.message || "Verifique seus dados e tente novamente."
          });
          return;
        }

        registerModal?.hide();
        await window.Swal.fire({
          icon: "success",
          title: "Acesso criado",
          text: "Seu acesso foi criado com sucesso.",
          confirmButtonText: "Entrar"
        });

        if (data && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }

        window.location.href = "/PortalVagas";
      } catch (err) {
        console.error(err);
        window.Swal.fire({
          icon: "error",
          title: "Erro inesperado",
          text: "Nao foi possivel concluir o cadastro. Tente novamente."
        });
      } finally {
        if (registerSubmit) {
          registerSubmit.disabled = false;
          registerSubmit.textContent = "Criar acesso";
        }
      }
    });
  }
})();
