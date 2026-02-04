(() => {
  const loginForm = document.getElementById("candidateLoginForm");
  if (!loginForm) return;

  const loginEmail = document.getElementById("loginEmail");
  const loginPassword = document.getElementById("loginPassword");
  const loginSubmit = document.getElementById("loginSubmit");
  const registerBtn = document.getElementById("openRegister");
  const registerModalEl = document.getElementById("registerModal");
  const registerForm = document.getElementById("registerForm");
  const languageButtons = Array.from(document.querySelectorAll(".language-flags [data-lang]"));
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

  window.initVLIBRAS = () => {
    const widgetCtor =
      window.VLibras?.Widget ||
      window.VLibras?.default?.Widget ||
      (typeof window.VLibras?.default === "function" ? window.VLibras.default : null);

    if (typeof widgetCtor === "function") {
      try { new widgetCtor("https://vlibras.gov.br/app"); } catch {}
    }
  };

  const getTenantId = () => (tenantInput?.value || "").trim();
  const getReturnUrl = () => (returnUrlInput?.value || "").trim();

  const translations = {
    "pt-BR": {
      help_link: "Precisa de ajuda?",
      login_title: "Acesse sua conta",
      login_subtitle: "Faça o seu login ou crie a sua conta. É simples e rápido.",
      label_email: "E-mail",
      label_password: "Senha",
      login_button: "Entrar no portal",
      login_loading: "Entrando...",
      register_hint: "Ainda nao possui acesso?",
      register_button: "Criar acesso",
      tenant_notice: "Tenant nao informado. Use o link enviado pelo RH.",
      language_label: "Idioma do perfil",
      help_title: "Como funciona o processo",
      help_subtitle: "Etapas para acompanhar sua candidatura.",
      help_step1: "Cadastro rapido e perfil unico.",
      help_step2: "Triagem e retorno em ate 5 dias.",
      help_step3: "Entrevista com gestor.",
      help_step4: "Proposta e onboarding.",
      close_button: "Fechar",
      register_title: "Criar acesso",
      register_subtitle: "Preencha os dados basicos para entrar no portal.",
      label_full_name: "Nome completo",
      error_full_name: "Informe seu nome completo.",
      error_email: "Informe um e-mail valido.",
      label_phone: "Telefone",
      error_phone: "Informe um telefone com DDD e 9 digitos.",
      label_uf: "UF",
      select_option: "Selecione",
      loading_ufs: "Carregando UFs...",
      loading_cities: "Carregando municipios...",
      error_load_ufs: "Nao foi possivel carregar UFs",
      error_load_cities: "Nao foi possivel carregar cidades",
      error_uf: "Selecione a UF.",
      label_city: "Cidade",
      select_city_first: "Selecione a UF primeiro",
      error_city: "Selecione a cidade.",
      password_hint: "Minimo 8 caracteres, 1 maiuscula, 1 numero e 1 especial.",
      error_password: "Senha fora do criterio.",
      label_password_confirm: "Confirmar senha",
      error_password_confirm: "As senhas nao conferem.",
      error_phone_invalid: "Telefone invalido.",
      error_email_invalid: "Email invalido.",
      error_password_invalid: "Senha invalida.",
      error_password_mismatch: "Senha diferente.",
      cancel_button: "Cancelar",
      swal_ok: "Ok",
      swal_tenant_title: "Tenant nao informado",
      swal_tenant_text: "Use o link enviado pelo RH para acessar.",
      swal_login_error_title: "Nao foi possivel entrar",
      swal_login_error_text: "Verifique seus dados e tente novamente.",
      swal_login_success_title: "Acesso liberado",
      swal_login_success_text: "Redirecionando...",
      swal_unexpected_title: "Erro inesperado",
      swal_unexpected_text: "Tente novamente em alguns instantes.",
      swal_confirm_title: "Confirmar cadastro",
      swal_confirm_text: "Criar acesso para {email}?",
      swal_confirm_yes: "Cadastrar",
      swal_confirm_no: "Cancelar",
      swal_register_error_title: "Nao foi possivel cadastrar",
      swal_register_error_text: "Verifique seus dados e tente novamente.",
      swal_register_success_title: "Acesso criado",
      swal_register_success_text: "Seu acesso foi criado com sucesso.",
      swal_register_success_confirm: "Entrar",
      swal_register_unexpected_title: "Erro inesperado",
      swal_register_unexpected_text: "Nao foi possivel concluir o cadastro. Tente novamente.",
      register_loading: "Criando..."
    },
    "en-US": {
      help_link: "Need help?",
      login_title: "Access your account",
      login_subtitle: "Log in or create your account. It is simple and fast.",
      label_email: "Email",
      label_password: "Password",
      login_button: "Enter the portal",
      login_loading: "Signing in...",
      register_hint: "Do not have access yet?",
      register_button: "Create access",
      tenant_notice: "Tenant not informed. Use the link sent by HR.",
      language_label: "Profile language",
      help_title: "How the process works",
      help_subtitle: "Steps to follow your application.",
      help_step1: "Quick signup and a single profile.",
      help_step2: "Screening and response within 5 days.",
      help_step3: "Interview with the manager.",
      help_step4: "Offer and onboarding.",
      close_button: "Close",
      register_title: "Create access",
      register_subtitle: "Fill in the basic data to enter the portal.",
      label_full_name: "Full name",
      error_full_name: "Please enter your full name.",
      error_email: "Please enter a valid email.",
      label_phone: "Phone",
      error_phone: "Provide a phone with area code and 9 digits.",
      label_uf: "State",
      select_option: "Select",
      loading_ufs: "Loading states...",
      loading_cities: "Loading cities...",
      error_load_ufs: "Unable to load states",
      error_load_cities: "Unable to load cities",
      error_uf: "Select the state.",
      label_city: "City",
      select_city_first: "Select the state first",
      error_city: "Select the city.",
      password_hint: "Minimum 8 characters, 1 uppercase, 1 number and 1 special.",
      error_password: "Password does not meet criteria.",
      label_password_confirm: "Confirm password",
      error_password_confirm: "Passwords do not match.",
      error_phone_invalid: "Invalid phone.",
      error_email_invalid: "Invalid email.",
      error_password_invalid: "Invalid password.",
      error_password_mismatch: "Password mismatch.",
      cancel_button: "Cancel",
      swal_ok: "Ok",
      swal_tenant_title: "Tenant not informed",
      swal_tenant_text: "Use the link sent by HR to access.",
      swal_login_error_title: "Unable to sign in",
      swal_login_error_text: "Check your details and try again.",
      swal_login_success_title: "Access granted",
      swal_login_success_text: "Redirecting...",
      swal_unexpected_title: "Unexpected error",
      swal_unexpected_text: "Try again in a few moments.",
      swal_confirm_title: "Confirm registration",
      swal_confirm_text: "Create access for {email}?",
      swal_confirm_yes: "Register",
      swal_confirm_no: "Cancel",
      swal_register_error_title: "Unable to register",
      swal_register_error_text: "Check your details and try again.",
      swal_register_success_title: "Access created",
      swal_register_success_text: "Your access was created successfully.",
      swal_register_success_confirm: "Sign in",
      swal_register_unexpected_title: "Unexpected error",
      swal_register_unexpected_text: "Unable to complete registration. Try again.",
      register_loading: "Creating..."
    },
    "es-ES": {
      help_link: "¿Necesitas ayuda?",
      login_title: "Accede a tu cuenta",
      login_subtitle: "Inicia sesion o crea tu cuenta. Es simple y rapido.",
      label_email: "Correo",
      label_password: "Contrasena",
      login_button: "Entrar al portal",
      login_loading: "Ingresando...",
      register_hint: "¿Aun no tienes acceso?",
      register_button: "Crear acceso",
      tenant_notice: "Tenant no informado. Usa el enlace enviado por RR. HH.",
      language_label: "Idioma del perfil",
      help_title: "Como funciona el proceso",
      help_subtitle: "Pasos para seguir tu candidatura.",
      help_step1: "Registro rapido y perfil unico.",
      help_step2: "Filtrado y respuesta en hasta 5 dias.",
      help_step3: "Entrevista con el responsable.",
      help_step4: "Oferta e incorporacion.",
      close_button: "Cerrar",
      register_title: "Crear acceso",
      register_subtitle: "Completa los datos basicos para entrar al portal.",
      label_full_name: "Nombre completo",
      error_full_name: "Ingresa tu nombre completo.",
      error_email: "Ingresa un correo valido.",
      label_phone: "Telefono",
      error_phone: "Ingresa un telefono con codigo de area y 9 digitos.",
      label_uf: "Estado",
      select_option: "Seleccionar",
      loading_ufs: "Cargando estados...",
      loading_cities: "Cargando ciudades...",
      error_load_ufs: "No se pudo cargar los estados",
      error_load_cities: "No se pudo cargar las ciudades",
      error_uf: "Selecciona el estado.",
      label_city: "Ciudad",
      select_city_first: "Selecciona el estado primero",
      error_city: "Selecciona la ciudad.",
      password_hint: "Minimo 8 caracteres, 1 mayuscula, 1 numero y 1 especial.",
      error_password: "La contrasena no cumple el criterio.",
      label_password_confirm: "Confirmar contrasena",
      error_password_confirm: "Las contrasenas no coinciden.",
      error_phone_invalid: "Telefono invalido.",
      error_email_invalid: "Correo invalido.",
      error_password_invalid: "Contrasena invalida.",
      error_password_mismatch: "Contrasena diferente.",
      cancel_button: "Cancelar",
      swal_ok: "Ok",
      swal_tenant_title: "Tenant no informado",
      swal_tenant_text: "Usa el enlace enviado por RR. HH. para acceder.",
      swal_login_error_title: "No se pudo ingresar",
      swal_login_error_text: "Verifica tus datos e intenta nuevamente.",
      swal_login_success_title: "Acceso concedido",
      swal_login_success_text: "Redirigiendo...",
      swal_unexpected_title: "Error inesperado",
      swal_unexpected_text: "Intenta nuevamente en unos momentos.",
      swal_confirm_title: "Confirmar registro",
      swal_confirm_text: "¿Crear acceso para {email}?",
      swal_confirm_yes: "Registrar",
      swal_confirm_no: "Cancelar",
      swal_register_error_title: "No se pudo registrar",
      swal_register_error_text: "Verifica tus datos e intenta nuevamente.",
      swal_register_success_title: "Acceso creado",
      swal_register_success_text: "Tu acceso fue creado con exito.",
      swal_register_success_confirm: "Ingresar",
      swal_register_unexpected_title: "Error inesperado",
      swal_register_unexpected_text: "No se pudo completar el registro. Intenta nuevamente.",
      register_loading: "Creando..."
    }
  };

  let currentLang = "pt-BR";

  const t = (key) => translations[currentLang]?.[key] || translations["pt-BR"]?.[key] || key;

  const applyTranslations = () => {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });
    if (tenantNotice) tenantNotice.textContent = t("tenant_notice");
    if (loginSubmit && !loginSubmit.disabled) loginSubmit.textContent = t("login_button");
    if (registerSubmit && !registerSubmit.disabled) registerSubmit.textContent = t("register_button");
    if (registerUf) {
      const option = registerUf.querySelector("option[value='']");
      if (option) option.textContent = t("select_option");
    }
    if (registerCity) {
      const option = registerCity.querySelector("option[value='']");
      if (option) option.textContent = registerCity.disabled ? t("select_city_first") : t("select_option");
    }
  };

  const setLanguage = (lang) => {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem("portal-vagas-lang", lang);
    languageButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.lang === lang));
    applyTranslations();
  };

  const toggleLoading = (isLoading) => {
    if (!loginSubmit) return;
    loginSubmit.disabled = isLoading;
    loginSubmit.textContent = isLoading ? t("login_loading") : t("login_button");
  };

  const showSwal = (icon, title, text) => {
    window.Swal.fire({
      icon,
      title,
      text,
      confirmButtonText: t("swal_ok")
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
    setSelectLoading(select, t("loading_ufs"), true);
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
      setSelectLoading(select, t("error_load_ufs"), true);
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
      setSelectLoading(select, t("select_city_first"), true);
      return;
    }
    setSelectLoading(select, t("loading_cities"), true);
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
      setSelectLoading(select, t("error_load_cities"), true);
    }
  };

  ensureTenant();

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!ensureTenant()) {
      showSwal("warning", t("swal_tenant_title"), t("swal_tenant_text"));
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
        showSwal("error", t("swal_login_error_title"), data.message || t("swal_login_error_text"));
        return;
      }

      if (data && data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      showSwal("success", t("swal_login_success_title"), t("swal_login_success_text"));
      window.location.href = "/PortalVagas";
    } catch (err) {
      console.error(err);
      showSwal("error", t("swal_unexpected_title"), t("swal_unexpected_text"));
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
      setSelectLoading(registerCity, t("select_city_first"), true);
    }
    if (registerPhone) {
      registerPhone.value = "";
      registerPhone.setCustomValidity(t("error_phone_invalid"));
    }
    if (registerPassword) registerPassword.setCustomValidity("");
    if (registerPasswordConfirm) registerPasswordConfirm.setCustomValidity("");
  };

  if (registerBtn && registerModal) {
    registerBtn.addEventListener("click", async () => {
      if (!ensureTenant()) {
        showSwal("warning", t("swal_tenant_title"), t("swal_tenant_text"));
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
      registerPhone.setCustomValidity(digits.length === 11 ? "" : t("error_phone_invalid"));
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
        showSwal("warning", t("swal_tenant_title"), t("swal_tenant_text"));
        return;
      }

      const emailValue = registerEmail?.value?.trim() || "";
      if (registerEmail) {
        registerEmail.setCustomValidity(EMAIL_REGEX.test(emailValue) ? "" : t("error_email_invalid"));
      }

      const phoneDigits = digitsOnly(registerPhone?.value || "");
      if (registerPhone) {
        registerPhone.setCustomValidity(phoneDigits.length === 11 ? "" : t("error_phone_invalid"));
      }

      const passValue = registerPassword?.value || "";
      if (registerPassword) {
        registerPassword.setCustomValidity(PASSWORD_REGEX.test(passValue) ? "" : t("error_password_invalid"));
      }

      const confirmValue = registerPasswordConfirm?.value || "";
      if (registerPasswordConfirm) {
        registerPasswordConfirm.setCustomValidity(passValue === confirmValue ? "" : t("error_password_mismatch"));
      }

      if (!registerForm.checkValidity()) {
        registerForm.classList.add("was-validated");
        registerForm.reportValidity();
        return;
      }

      const confirm = await window.Swal.fire({
        title: t("swal_confirm_title"),
        text: t("swal_confirm_text").replace("{email}", emailValue),
        icon: "question",
        showCancelButton: true,
        confirmButtonText: t("swal_confirm_yes"),
        cancelButtonText: t("swal_confirm_no")
      });

      if (!confirm.isConfirmed) return;

      if (registerSubmit) {
        registerSubmit.disabled = true;
        registerSubmit.textContent = t("register_loading");
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
            title: t("swal_register_error_title"),
            text: data.message || t("swal_register_error_text")
          });
          return;
        }

        registerModal?.hide();
        await window.Swal.fire({
          icon: "success",
          title: t("swal_register_success_title"),
          text: t("swal_register_success_text"),
          confirmButtonText: t("swal_register_success_confirm")
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
          title: t("swal_register_unexpected_title"),
          text: t("swal_register_unexpected_text")
        });
      } finally {
        if (registerSubmit) {
          registerSubmit.disabled = false;
          registerSubmit.textContent = t("register_button");
        }
      }
    });
  }

  languageButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setLanguage(button.dataset.lang);
    });
  });

  setLanguage(localStorage.getItem("portal-vagas-lang") || "pt-BR");
})();
