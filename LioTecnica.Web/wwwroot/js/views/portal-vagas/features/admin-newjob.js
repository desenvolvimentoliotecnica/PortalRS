(function () {
  const ctx = window.PortalVagasIndexContext;
  const S = window.PortalVagasStrings;
  if (!ctx || window.PortalVagasAdminNewJob) return;

  const newJobModalEl = document.getElementById("newJobModal");
  const newJobForm = document.getElementById("newJobForm");
  const newJobAlert = document.getElementById("newJobAlert");
  const newJobSubmit = document.getElementById("newJobSubmit");
  const newJobLoading = document.getElementById("newJobLoading");
  const newJobModal = newJobModalEl ? new bootstrap.Modal(newJobModalEl, { backdrop: true, keyboard: true }) : null;
  const newJobUf = document.getElementById("newJobUf");
  const newJobCity = document.getElementById("newJobCity");
  const newJobSalaryMin = document.getElementById("newJobSalaryMin");
  const newJobSalaryMax = document.getElementById("newJobSalaryMax");

  const LOCATION_BASE = "/PortalVagas/Locations";
  const newJobCityCache = new Map();
  let newJobCachedUfs = null;
  let newJobLookupsLoaded = false;

  function setNewJobAlert(message, type = "danger") {
    if (!newJobAlert) return;
    newJobAlert.className = `alert alert-${type}`;
    newJobAlert.textContent = message;
    newJobAlert.classList.remove("d-none");
  }

  function clearNewJobAlert() {
    if (!newJobAlert) return;
    newJobAlert.textContent = "";
    newJobAlert.classList.add("d-none");
  }

  function toggleNewJobLoading(isLoading) {
    if (!newJobSubmit || !newJobLoading) return;
    newJobSubmit.disabled = isLoading;
    newJobLoading.classList.toggle("d-none", !isLoading);
  }

  function renderOptions(select, options, placeholder = S.newJob.selectOption) {
    if (!select) return;
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = placeholder;
    select.appendChild(opt);
    options.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.value;
      option.textContent = item.text;
      select.appendChild(option);
    });
  }

  function setNewJobSelectLoading(select, label, disabled = true) {
    if (!select) return;
    select.disabled = disabled;
    select.innerHTML = "";
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = label;
    select.appendChild(opt);
  }

  async function fetchNewJobUfs() {
    if (newJobCachedUfs) return newJobCachedUfs;
    const res = await fetch(`${LOCATION_BASE}/Ufs`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    newJobCachedUfs = (Array.isArray(data) ? data : [])
      .map((uf) => (uf || "").toString().trim().toUpperCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    return newJobCachedUfs;
  }

  async function fetchNewJobCitiesForUf(uf) {
    const key = (uf || "").trim().toUpperCase();
    if (!key) return [];
    if (newJobCityCache.has(key)) return newJobCityCache.get(key);
    const res = await fetch(`${LOCATION_BASE}/Ufs/${encodeURIComponent(key)}/Cities`, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = (Array.isArray(data) ? data : [])
      .map((city) => (city || "").toString().trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "pt-BR"));
    newJobCityCache.set(key, list);
    return list;
  }

  async function populateNewJobUfSelect(select) {
    if (!select) return;
    setNewJobSelectLoading(select, S.newJob.loadUf, true);
    const list = await fetchNewJobUfs();
    select.disabled = false;
    select.innerHTML = `<option value="" selected>${S.newJob.selectOption}</option>`;
    list.forEach((uf) => {
      const opt = document.createElement("option");
      opt.value = uf;
      opt.textContent = uf;
      select.appendChild(opt);
    });
  }

  async function populateNewJobCitySelect(uf, select) {
    if (!select) return;
    if (!uf) {
      setNewJobSelectLoading(select, S.newJob.selectUfFirst, true);
      return;
    }
    setNewJobSelectLoading(select, S.newJob.loadCity, true);
    const cities = await fetchNewJobCitiesForUf(uf);
    select.disabled = false;
    select.innerHTML = `<option value="" selected>${S.newJob.selectOption}</option>`;
    cities.forEach((city) => {
      const opt = document.createElement("option");
      opt.value = city;
      opt.textContent = city;
      select.appendChild(opt);
    });
  }

  async function loadNewJobLookups() {
    if (newJobLookupsLoaded || !ctx.isAdminUser) return;

    const headers = ctx.buildAuthHeaders();
    const [areasRes, departmentsRes, enumsRes] = await Promise.all([
      fetch(`/api/lookup/areas`, { headers, credentials: "same-origin" }),
      fetch(`/api/lookup/departments`, { headers, credentials: "same-origin" }),
      fetch(`/api/lookup/enums`, { headers, credentials: "same-origin" })
    ]);

    if (!areasRes.ok || !departmentsRes.ok || !enumsRes.ok)
      throw new Error(S.newJob.loadJobFail);

    const [areas, departments, enums] = await Promise.all([
      areasRes.json(),
      departmentsRes.json(),
      enumsRes.json()
    ]);

    renderOptions(
      document.getElementById("newJobArea"),
      (areas || []).map((item) => ({ value: item.id, text: item.name })),
      S.newJob.selectArea
    );

    renderOptions(
      document.getElementById("newJobDepartment"),
      (departments || []).map((item) => ({ value: item.id, text: item.name })),
      S.newJob.selectDepartment
    );

    renderOptions(
      document.getElementById("newJobStatus"),
      (enums?.vagaStatus || []).map((item) => ({ value: item.code, text: item.text })),
      S.newJob.selectStatus
    );

    renderOptions(
      document.getElementById("newJobModalidade"),
      (enums?.vagaModalidade || []).map((item) => ({ value: item.code, text: item.text })),
      S.newJob.selectModalidade
    );

    renderOptions(
      document.getElementById("newJobSenioridade"),
      (enums?.vagaSenioridade || []).map((item) => ({ value: item.code, text: item.text })),
      S.newJob.selectSenioridade
    );

    renderOptions(
      document.getElementById("newJobTipo"),
      (enums?.vagaTipoContratacao || []).map((item) => ({ value: item.code, text: item.text })),
      S.newJob.selectTipo
    );

    renderOptions(
      document.getElementById("newJobVisibilidade"),
      (enums?.vagaPublicacaoVisibilidade || []).map((item) => ({ value: item.code, text: item.text })),
      S.newJob.selectVisibilidade
    );

    const statusSelect = document.getElementById("newJobStatus");
    if (statusSelect && !statusSelect.value) statusSelect.value = "Aberta";
    const visSelect = document.getElementById("newJobVisibilidade");
    if (visSelect && !visSelect.value) visSelect.value = "Externa";

    newJobLookupsLoaded = true;
  }

  async function handleSubmit(loadJobs) {
    if (!newJobForm) return;

    if (!ctx.isAdminUser) {
      setNewJobAlert(S.newJob.unauthorized);
      return;
    }

    if (!newJobForm.checkValidity()) {
      newJobForm.classList.add("was-validated");
      newJobForm.reportValidity();
      return;
    }

    clearNewJobAlert();
    toggleNewJobLoading(true);

    try {
      const payload = {
        titulo: document.getElementById("newJobTitle").value.trim(),
        departmentId: document.getElementById("newJobDepartment").value,
        areaId: document.getElementById("newJobArea").value,
        status: document.getElementById("newJobStatus").value,
        codigo: null,
        areaTime: null,
        modalidade: document.getElementById("newJobModalidade").value || null,
        senioridade: document.getElementById("newJobSenioridade").value || null,
        quantidadeVagas: PortalVagasUtils.toNumber(document.getElementById("newJobQuantidade").value) ?? 1,
        tipoContratacao: document.getElementById("newJobTipo").value || null,
        matchMinimoPercentual: PortalVagasUtils.toNumber(document.getElementById("newJobMatch").value) ?? 0,
        weights: null,
        descricaoInterna: null,
        codigoInterno: null,
        codigoCbo: null,
        motivoAbertura: null,
        orcamentoAprovado: null,
        gestorRequisitante: null,
        recrutadorResponsavel: null,
        prioridade: null,
        resumoPitch: null,
        tagsResponsabilidadesRaw: document.getElementById("newJobTagsResp").value || null,
        tagsKeywordsRaw: document.getElementById("newJobTagsKeywords").value || null,
        confidencial: document.getElementById("newJobConfidencial").checked,
        aceitaPcd: document.getElementById("newJobAceitaPcd").checked,
        urgente: document.getElementById("newJobUrgente").checked,
        generoPreferencia: null,
        vagaAfirmativa: false,
        linguagemInclusiva: false,
        publicoAfirmativo: null,
        observacoesPcd: null,
        projetoNome: null,
        projetoClienteAreaImpactada: null,
        projetoPrazoPrevisto: null,
        projetoDescricao: null,
        regime: null,
        cargaSemanalHoras: null,
        escala: null,
        horaEntrada: null,
        horaSaida: null,
        intervalo: null,
        cep: null,
        logradouro: null,
        numero: null,
        bairro: null,
        cidade: document.getElementById("newJobCity").value || null,
        uf: document.getElementById("newJobUf").value || null,
        politicaTrabalho: null,
        observacoesDeslocamento: null,
        moeda: null,
        salarioMinimo: PortalVagasUtils.parseMoneyBR(document.getElementById("newJobSalaryMin").value),
        salarioMaximo: PortalVagasUtils.parseMoneyBR(document.getElementById("newJobSalaryMax").value),
        periodicidade: null,
        bonusTipo: null,
        bonusPercentual: null,
        observacoesRemuneracao: null,
        escolaridade: null,
        formacaoArea: null,
        experienciaMinimaAnos: null,
        tagsStackRaw: document.getElementById("newJobTagsStack").value || null,
        tagsIdiomasRaw: null,
        diferenciais: null,
        observacoesProcesso: null,
        visibilidade: document.getElementById("newJobVisibilidade").value || null,
        dataInicio: null,
        dataEncerramento: null,
        canalLinkedIn: document.getElementById("newJobCanalLinkedIn").checked,
        canalSiteCarreiras: document.getElementById("newJobCanalSite").checked,
        canalIndicacao: document.getElementById("newJobCanalIndicacao").checked,
        canalPortaisEmprego: document.getElementById("newJobCanalPortais").checked,
        descricaoPublica: document.getElementById("newJobResumo").value || null,
        lgpdSolicitarConsentimentoExplicito: false,
        lgpdCompartilharCurriculoInternamente: false,
        lgpdRetencaoAtiva: false,
        lgpdRetencaoMeses: null,
        exigeCnh: false,
        disponibilidadeParaViagens: false,
        checagemAntecedentes: false,
        beneficios: [],
        requisitos: [],
        etapas: [],
        perguntasTriagem: []
      };

      const response = await fetch(`/api/vagas`, {
        method: "POST",
        headers: {
          ...ctx.buildAuthHeaders(),
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNewJobAlert(data.message || S.newJob.createFail);
        window.Swal?.fire({
          icon: "error",
          title: S.newJob.saveFailTitle,
          text: data.message || S.newJob.createFail
        });
        return;
      }

      newJobModal?.hide();
      newJobForm.reset();
      newJobForm.classList.remove("was-validated");
      if (typeof loadJobs === "function") await loadJobs(true);
      window.Swal?.fire({
        icon: "success",
        title: S.newJob.saveSuccessTitle,
        text: S.newJob.saveSuccessText
      });
    } catch (err) {
      console.error(err);
      setNewJobAlert(S.newJob.createFailAlert);
      window.Swal?.fire({
        icon: "error",
        title: S.newJob.unexpectedErrorTitle,
        text: S.newJob.createFail
      });
    } finally {
      toggleNewJobLoading(false);
    }
  }

  function wireInputs() {
    if (newJobUf) {
      newJobUf.addEventListener("change", () => {
        populateNewJobCitySelect(newJobUf.value, newJobCity);
      });
    }

    if (newJobSalaryMin) {
      newJobSalaryMin.addEventListener("input", () => {
        newJobSalaryMin.value = PortalVagasUtils.formatMoneyBR(newJobSalaryMin.value);
      });
    }

    if (newJobSalaryMax) {
      newJobSalaryMax.addEventListener("input", () => {
        newJobSalaryMax.value = PortalVagasUtils.formatMoneyBR(newJobSalaryMax.value);
      });
    }
  }

  function init(loadJobs) {
    if (!ctx.isAdminUser) return;
    wireInputs();
    if (newJobModalEl) {
      newJobModalEl.addEventListener("show.bs.modal", async () => {
        try {
          clearNewJobAlert();
          await loadNewJobLookups();
          await populateNewJobUfSelect(newJobUf);
          await populateNewJobCitySelect(newJobUf?.value, newJobCity);
        } catch (err) {
          console.error(err);
          setNewJobAlert(S.newJob.loadJobFailShort);
        }
      });
    }

    if (newJobForm) {
      newJobForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await handleSubmit(loadJobs);
      });
    }
  }

  window.PortalVagasAdminNewJob = { init };
})();
