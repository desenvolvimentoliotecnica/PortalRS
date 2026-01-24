// ========= Logo (embutido em Data URI - auto contido)
    // Observação: o arquivo fornecido veio como WebP (mesmo com nome .png).
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const CANDIDATOS_API_URL = window.__candidatosApiUrl || "/api/candidatos";
const AREAS_API_URL = window.__areasApiUrl || "/api/lookup/areas";
const DEPARTMENTS_API_URL = window.__departmentsApiUrl || "/api/lookup/departments";
const NORMALIZE_ENUM = (value) => (value ?? "").toString().trim().toLowerCase();

    const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";
function enumFirstCode(key, fallback){
      const list = getEnumOptions(key);
      return list.length ? list[0].code : fallback;
    }

    function enumPreferredCode(key, preferred, fallback){
      const list = getEnumOptions(key);
      const target = (preferred || []).map(code => NORMALIZE_ENUM(code));
      for(const code of target){
        const match = list.find(opt => NORMALIZE_ENUM(opt.code) === code);
        if(match) return match.code;
      }
      return list.length ? list[0].code : fallback;
    }

    const AREA_ALL = enumFirstCode("vagaAreaFilter", "all");
    let DEFAULT_MODALIDADE = enumFirstCode("vagaModalidade", "presencial");
    let DEFAULT_STATUS = enumPreferredCode("vagaStatus", ["aberta", "rascunho"], "aberta");
    let DEFAULT_SENIORIDADE = enumFirstCode("vagaSenioridade", "junior");
    let DEFAULT_DEPARTAMENTO = enumFirstCode("vagaDepartamento", "");
    let DEFAULT_AREA_TIME = enumFirstCode("vagaAreaTime", "");
    let DEFAULT_TIPO_CONTRATACAO = enumFirstCode("vagaTipoContratacao", "");
    let DEFAULT_MOTIVO = enumFirstCode("vagaMotivoAbertura", "");
    let DEFAULT_ORCAMENTO = enumFirstCode("vagaOrcamentoAprovado", "");
    let DEFAULT_PRIORIDADE = enumFirstCode("vagaPrioridade", "");
    let DEFAULT_REGIME = enumFirstCode("vagaRegimeJornada", "");
    let DEFAULT_ESCALA = enumFirstCode("vagaEscalaTrabalho", "");
    let DEFAULT_MOEDA = enumFirstCode("vagaMoeda", "brl");
    let DEFAULT_REMUN_PERIOD = enumFirstCode("vagaRemuneracaoPeriodicidade", "mensal");
    let DEFAULT_BONUS = enumFirstCode("vagaBonusTipo", "");
    let DEFAULT_BENEFICIO_TIPO = enumFirstCode("vagaBeneficioTipo", "");
    let DEFAULT_BENEFICIO_REC = enumFirstCode("vagaBeneficioRecorrencia", "mensal");
    let DEFAULT_ESCOLARIDADE = enumFirstCode("vagaEscolaridade", "");
    let DEFAULT_FORMACAO = enumFirstCode("vagaFormacaoArea", "");
    let DEFAULT_REQ_NIVEL = enumFirstCode("vagaRequisitoNivel", "");
    let DEFAULT_REQ_AVALIACAO = enumFirstCode("vagaRequisitoAvaliacao", "");
    let DEFAULT_ETAPA_RESP = enumFirstCode("vagaEtapaResponsavel", "");
    let DEFAULT_ETAPA_MODO = enumFirstCode("vagaEtapaModo", "");
    let DEFAULT_QUESTION_TIPO = enumFirstCode("vagaPerguntaTipo", "");
    let DEFAULT_PESO = enumFirstCode("vagaPeso", "1");
    let DEFAULT_PUBLICACAO = enumFirstCode("vagaPublicacaoVisibilidade", "");
    let DEFAULT_GENERO = enumFirstCode("vagaGeneroPreferencia", "");
    const EMPTY_TEXT = "—";
    const CANDIDATO_URL_BASE = "/Candidatos?open=";

    function refreshEnumDefaults(){
      DEFAULT_MODALIDADE = enumFirstCode("vagaModalidade", "presencial");
      DEFAULT_STATUS = enumPreferredCode("vagaStatus", ["aberta", "rascunho"], "aberta");
      DEFAULT_SENIORIDADE = enumFirstCode("vagaSenioridade", "");
      DEFAULT_DEPARTAMENTO = "";
      DEFAULT_AREA_TIME = enumFirstCode("vagaAreaTime", "");
      DEFAULT_TIPO_CONTRATACAO = enumFirstCode("vagaTipoContratacao", "");
      DEFAULT_MOTIVO = enumFirstCode("vagaMotivoAbertura", "");
      DEFAULT_ORCAMENTO = enumFirstCode("vagaOrcamentoAprovado", "");
      DEFAULT_PRIORIDADE = enumFirstCode("vagaPrioridade", "");
      DEFAULT_REGIME = enumFirstCode("vagaRegimeJornada", "");
      DEFAULT_ESCALA = enumFirstCode("vagaEscalaTrabalho", "");
      DEFAULT_MOEDA = enumFirstCode("vagaMoeda", "brl");
      DEFAULT_REMUN_PERIOD = enumFirstCode("vagaRemuneracaoPeriodicidade", "");
      DEFAULT_BONUS = enumFirstCode("vagaBonusTipo", "");
      DEFAULT_BENEFICIO_TIPO = enumFirstCode("vagaBeneficioTipo", "");
      DEFAULT_BENEFICIO_REC = enumFirstCode("vagaBeneficioRecorrencia", "");
      DEFAULT_ESCOLARIDADE = enumFirstCode("vagaEscolaridade", "");
      DEFAULT_FORMACAO = enumFirstCode("vagaFormacaoArea", "");
      DEFAULT_REQ_NIVEL = enumFirstCode("vagaRequisitoNivel", "");
      DEFAULT_REQ_AVALIACAO = enumFirstCode("vagaRequisitoAvaliacao", "");
      DEFAULT_ETAPA_RESP = enumFirstCode("vagaEtapaResponsavel", "");
      DEFAULT_ETAPA_MODO = enumFirstCode("vagaEtapaModo", "");
      DEFAULT_QUESTION_TIPO = enumFirstCode("vagaPerguntaTipo", "");
      DEFAULT_PESO = enumFirstCode("vagaPeso", "");
      DEFAULT_PUBLICACAO = enumFirstCode("vagaPublicacaoVisibilidade", "");
      DEFAULT_GENERO = enumFirstCode("vagaGeneroPreferencia", "");
    }
    const BULLET = "•";

    function setText(root, role, value, fallback = EMPTY_TEXT){
      if(!root) return;
      const el = root.querySelector(`[data-role="${role}"]`);
      if(!el) return;
      el.textContent = (value ?? fallback);
    }

    function setValue(id, value){
      const el = $("#"+id);
      if(!el) return;
      const raw = value ?? "";
      if(el.tagName === "SELECT"){
        const target = raw.toString();
        const normalized = target.toLowerCase();
        const match = Array.from(el.options).find(opt => (opt.value || "").toString().toLowerCase() === normalized);
        el.value = match ? match.value : target;
        return;
      }
      el.value = raw;
    }

    function setChecked(id, value){
      const el = $("#"+id);
      if(!el) return;
      el.checked = !!value;
    }

    function getValue(id){
      const el = $("#"+id);
      return el ? (el.value || "").trim() : "";
    }

    function getChecked(id){
      const el = $("#"+id);
      return !!(el && el.checked);
    }

    function splitTags(text){
      return (text || "")
        .split(";")
        .map(x => x.trim())
        .filter(Boolean);
    }

    function joinTags(list){
      return (Array.isArray(list) ? list : []).join("; ");
    }

    function joinTagsRaw(list){
      return (Array.isArray(list) ? list : [])
        .map(x => String(x || "").trim())
        .filter(Boolean)
        .join(";");
    }

    function formatPeso(value){
      const text = getEnumText("vagaPeso", value, value);
      return text || EMPTY_TEXT;
    }

    function pesoToNumber(value){
      const text = getEnumText("vagaPeso", value, value);
      const n = parseInt(text ?? "", 10);
      return Number.isFinite(n) ? n : 0;
    }

    function isMultipleChoiceQuestion(type){
      const v = (type || "").toString().toLowerCase();
      return v.includes("multipla");
    }

    function listAreas(){
      const list = (state.areas || []).map(a => a.name).filter(Boolean);
      const fromVagas = state.vagas.map(v => v.area).filter(Boolean);
      const set = new Set([...list, ...fromVagas]);
      return Array.from(set).sort((a,b)=>a.localeCompare(b,"pt-BR"));
    }

    async function syncAreasFromApi(){
      try{
        const res = await fetch(AREAS_API_URL, { headers: { "Accept": "application/json" } });
        if(!res.ok) throw new Error(`Falha ao buscar areas: ${res.status}`);
        const data = await res.json();
        state.areas = Array.isArray(data) ? data : [];
      }catch(e){
        console.error("Falha ao carregar areas da API:", e);
        state.areas = [];
      }
    }

    async function syncDepartmentsFromApi(){
      try{
        const res = await fetch(DEPARTMENTS_API_URL, { headers: { "Accept": "application/json" } });
        if(!res.ok) throw new Error(`Falha ao buscar departamentos: ${res.status}`);
        const data = await res.json();
        state.departments = Array.isArray(data) ? data : [];
      }catch(e){
        console.error("Falha ao carregar departamentos da API:", e);
        state.departments = [];
      }
    }

    async function syncVagaEnumsFromApi(){
      await ensureEnumData();
      refreshEnumDefaults();
      applyVagaEnumOptions();
      renderStatusFilter();
      applyEnumSelects();
    }

    function fillEnumSelect(selectId, enumKey, placeholder){
      const select = $("#"+selectId);
      if(!select) return;
      select.replaceChildren();
      if(placeholder){
        select.appendChild(buildOption("", placeholder, true));
      }
      const list = getEnumOptions(enumKey);
      list.forEach(opt => select.appendChild(buildOption(opt.code, opt.text)));
    }

    function applyVagaEnumOptions(){
      fillEnumSelect("vagaModalidade", "vagaModalidade");
      fillEnumSelect("vagaStatus", "vagaStatus", "Selecionar status");
      fillEnumSelect("vagaSenioridade", "vagaSenioridade");
      fillEnumSelect("vagaAreaTime", "vagaAreaTime", "Selecionar area/time");
      fillEnumSelect("vagaTipoContratacao", "vagaTipoContratacao", "Selecionar tipo");
      fillEnumSelect("vagaMotivoAbertura", "vagaMotivoAbertura", "Selecionar motivo");
      fillEnumSelect("vagaOrcamento", "vagaOrcamentoAprovado", "Selecionar orcamento");
      fillEnumSelect("vagaPrioridade", "vagaPrioridade", "Selecionar prioridade");
      fillEnumSelect("vagaRegime", "vagaRegimeJornada", "Selecionar regime");
      fillEnumSelect("vagaEscala", "vagaEscalaTrabalho", "Selecionar escala");
      fillEnumSelect("vagaMoeda", "vagaMoeda");
      fillEnumSelect("vagaPeriodicidade", "vagaRemuneracaoPeriodicidade", "Selecionar periodicidade");
      fillEnumSelect("vagaBonusTipo", "vagaBonusTipo", "Selecionar bonus");
      fillEnumSelect("vagaEscolaridade", "vagaEscolaridade", "Selecionar escolaridade");
      fillEnumSelect("vagaFormacaoArea", "vagaFormacaoArea", "Selecionar formacao");
      fillEnumSelect("vagaVisibilidade", "vagaPublicacaoVisibilidade", "Selecionar visibilidade");
      fillEnumSelect("vagaGeneroPreferencia", "vagaGeneroPreferencia", "Selecionar preferencia");
    }

    function renderStatusFilter(){
      const sel = $("#fStatus");
      if(!sel) return;
      const cur = sel.value || "all";
      sel.replaceChildren();
      sel.appendChild(buildOption("all", "Status: todos", cur === "all"));
      getEnumOptions("vagaStatus").forEach(opt => {
        const code = normalizeStatusCode(opt.code);
        sel.appendChild(buildOption(code, opt.text, code === cur));
      });
    }

    function fillVagaAreaSelect(selected){
      const select = $("#vagaArea");
      if(!select) return;
      select.replaceChildren();
      select.appendChild(buildOption("", "Selecionar area", !selected));
      const areas = (state.areas || []).slice().sort((a,b)=> (a.name || "").localeCompare(b.name || "", "pt-BR"));
      areas.forEach(a => select.appendChild(buildOption(a.id, a.name, a.id === selected)));
      if(selected && !areas.some(a => a.id === selected)){
        select.appendChild(buildOption(selected, selected, true));
      }
      if(selected) select.value = selected;
    }

    function fillVagaDepartmentSelect(selected){
      const select = $("#vagaDepartamento");
      if(!select) return;
      select.replaceChildren();
      select.appendChild(buildOption("", "Selecionar departamento", !selected));
      const list = (state.departments || []).slice().sort((a,b)=> (a.name || "").localeCompare(b.name || "", "pt-BR"));
      list.forEach(d => select.appendChild(buildOption(d.id, d.name, d.id === selected)));
      if(selected && !list.some(d => d.id === selected)){
        select.appendChild(buildOption(selected, selected, true));
      }
      if(selected) select.value = selected;
    }

    function loadReqCategorias(){
      return getEnumOptions("requisitoCategoria");
    }

    function listReqCategorias(){
      const base = loadReqCategorias();
      const map = new Map(base.map(opt => [NORMALIZE_ENUM(opt.code), opt]));
      const fromVagas = state.vagas
        .flatMap(v => (v.requisitos || []).map(r => r.categoria))
        .filter(Boolean);
      fromVagas.forEach(cat => {
        const key = NORMALIZE_ENUM(cat);
        if(!map.has(key)){
          map.set(key, { code: cat, text: cat });
        }
      });
      return Array.from(map.values()).sort((a,b)=>a.text.localeCompare(b.text,"pt-BR"));
    }

    function getDefaultCategoria(){
      const list = listReqCategorias();
      const preferred = list.find(c => NORMALIZE_ENUM(c.code) === "competencia");
      return preferred ? preferred.code : (list[0]?.code || "competencia");
    }

    function getCategoriaText(code){
      return getEnumText("requisitoCategoria", code, code || EMPTY_TEXT);
    }

    function renderReqCategoriaOptions(selected){
      const select = $("#reqCategoria");
      if(!select) return;
      select.replaceChildren();
      select.appendChild(buildOption("", "Selecionar categoria", !selected));
      const list = listReqCategorias();
      list.forEach(c => select.appendChild(buildOption(c.code, c.text, c.code === selected)));
      if(selected && !list.some(c => c.code === selected)){
        select.appendChild(buildOption(selected, selected, true));
      }
      if(selected) select.value = selected;
    }

function normalizeStatusCode(s) {
    const v = (s || "").toString().trim().toLowerCase();

    if (v === "aberta" || v === "open" || v === "ativa" || v === "active") return "aberta";
    if (v === "pausada" || v === "paused" || v === "pause") return "pausada";
    if (v === "fechada" || v === "closed" || v === "encerrada" || v === "cancelada" || v === "inactive") return "fechada";
    if (v === "naoinformado" || v === "nao informado") return "rascunho";
    if (v === "rascunho" || v === "draft") return "rascunho";
    if (v === "emtriagem" || v === "triagem") return "triagem";
    if (v === "ementrevistas" || v === "entrevistas") return "entrevistas";
    if (v === "emoferta" || v === "oferta") return "oferta";
    if (v === "congelada") return "congelada";

    return v || "aberta";
}

function parseDateOnly(ymd) {
    // evita bug de fuso (não use new Date("2026-01-20") puro)
    if (!ymd) return null;
    const [y, m, d] = String(ymd).split("-").map(n => parseInt(n, 10));
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d); // local midnight
}

function mapApiVagaToState(v) {
    const areaName = v.areaName ?? v.area?.name ?? "";
    const departmentName = v.departmentName ?? v.department?.name ?? "";
    const requisitosRaw = Array.isArray(v.requisitos) ? v.requisitos : [];
    const hasDetail = Array.isArray(v.requisitos) || Array.isArray(v.beneficios) || Array.isArray(v.etapas) || Array.isArray(v.perguntasTriagem);
    const matchMinimo = Number.isFinite(+v.matchMinimoPercentual) ? +v.matchMinimoPercentual : 0;

      const requisitosDetalhados = requisitosRaw.map(r => ({
        id: r.id,
        categoria: r.categoria ?? getDefaultCategoria(),
        nome: r.nome ?? "",
        peso: r.peso ?? DEFAULT_PESO,
        obrigatorio: !!r.obrigatorio,
        anos: r.anosMinimos ?? "",
        nivel: r.nivel ?? DEFAULT_REQ_NIVEL,
        avaliacao: r.avaliacao ?? DEFAULT_REQ_AVALIACAO,
        sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : [],
        obs: r.observacoes ?? ""
      }));

    return {
        id: v.id,
        codigo: v.codigo ?? "",
        titulo: v.titulo ?? "",
        status: normalizeStatusCode(v.status),
        statusRaw: v.status ?? "",
        area: areaName,

        areaId: v.areaId ?? null,
        areaCode: v.areaCode ?? "",
        areaName,

        departmentId: v.departmentId ?? null,
        departmentCode: v.departmentCode ?? "",
        departmentName,

        modalidade: v.modalidade ?? "",
        senioridade: v.senioridade ?? "",
        quantidadeVagas: Number.isFinite(+v.quantidadeVagas) ? +v.quantidadeVagas : 0,
        matchMinimoPercentual: matchMinimo,
        threshold: matchMinimo,

        confidencial: !!v.confidencial,
        urgente: !!v.urgente,
        aceitaPcd: !!v.aceitaPcd,

        dataInicio: parseDateOnly(v.dataInicio),
        dataEncerramento: parseDateOnly(v.dataEncerramento),

        cidade: v.cidade ?? "",
        uf: v.uf ?? "",

        descricao: v.descricaoInterna ?? "",
        createdAt: v.createdAtUtc ?? null,
        updatedAt: v.updatedAtUtc ?? null,
        hasDetail,

        requisitosTotal: Number.isFinite(+v.requisitosTotal) ? +v.requisitosTotal : requisitosRaw.length,
        requisitosObrigatorios: Number.isFinite(+v.requisitosObrigatorios) ? +v.requisitosObrigatorios : requisitosRaw.filter(r => r.obrigatorio).length,
          requisitos: requisitosRaw.map(r => ({
            id: r.id,
            categoria: r.categoria ?? getDefaultCategoria(),
            termo: r.nome ?? "",
            peso: r.peso ?? DEFAULT_PESO,
            obrigatorio: !!r.obrigatorio,
            sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : [],
            obs: r.observacoes ?? ""
          })),

        weights: v.weights || { competencia:40, experiencia:30, formacao:15, localidade:15 },
        meta: {
          departamento: v.departmentId ?? "",
          areaTime: v.areaTime ?? "",
          quantidade: Number.isFinite(+v.quantidadeVagas) ? +v.quantidadeVagas : 1,
          tipoContratacao: v.tipoContratacao ?? "",
          codigoInterno: v.codigoInterno ?? "",
          cbo: v.codigoCbo ?? "",
          gestorRequisitante: v.gestorRequisitante ?? "",
          recrutador: v.recrutadorResponsavel ?? "",
          motivoAbertura: v.motivoAbertura ?? "",
          orcamentoAprovado: v.orcamentoAprovado ?? "",
          prioridade: v.prioridade ?? "",
          resumo: v.resumoPitch ?? "",
          tagsResponsabilidades: splitTags(v.tagsResponsabilidadesRaw),
          tagsKeywords: splitTags(v.tagsKeywordsRaw),
          confidencial: !!v.confidencial,
          aceitaPcd: !!v.aceitaPcd,
          urgente: !!v.urgente,
          projeto: {
            nome: v.projetoNome ?? "",
            cliente: v.projetoClienteAreaImpactada ?? "",
            prazo: v.projetoPrazoPrevisto ?? "",
            descricao: v.projetoDescricao ?? ""
          },
          pcdObs: v.observacoesPcd ?? ""
        },
        jornada: {
          regime: v.regime ?? "",
          cargaSemanal: v.cargaSemanalHoras != null ? String(v.cargaSemanalHoras) : "",
          horaEntrada: v.horaEntrada ?? "",
          horaSaida: v.horaSaida ?? "",
          intervalo: v.intervalo ?? "",
          escala: v.escala ?? "",
          local: {
            cep: v.cep ?? "",
            logradouro: v.logradouro ?? "",
            numero: v.numero ?? "",
            bairro: v.bairro ?? "",
            cidade: v.cidade ?? "",
            uf: v.uf ?? "",
            politicaTrabalho: v.politicaTrabalho ?? "",
            deslocamentoObs: v.observacoesDeslocamento ?? ""
          }
        },
        remuneracao: {
          moeda: v.moeda ?? "",
          salarioMin: v.salarioMinimo != null ? String(v.salarioMinimo) : "",
          salarioMax: v.salarioMaximo != null ? String(v.salarioMaximo) : "",
          periodicidade: v.periodicidade ?? "",
          bonusTipo: v.bonusTipo ?? "",
          percentual: v.bonusPercentual != null ? String(v.bonusPercentual) : "",
          obs: v.observacoesRemuneracao ?? "",
          beneficios: (Array.isArray(v.beneficios) ? v.beneficios : []).map(b => ({
            tipo: b.tipo ?? DEFAULT_BENEFICIO_TIPO,
            valor: b.valor != null ? String(b.valor) : "",
            recorrencia: b.recorrencia ?? DEFAULT_BENEFICIO_REC,
            obrigatorio: !!b.obrigatorio,
            obs: b.observacoes ?? ""
          }))
        },
        requisitosExtras: {
          escolaridade: v.escolaridade ?? "",
          formacaoArea: v.formacaoArea ?? "",
          expMinAnos: v.experienciaMinimaAnos != null ? String(v.experienciaMinimaAnos) : "",
          tagsStack: splitTags(v.tagsStackRaw),
          tagsIdiomas: splitTags(v.tagsIdiomasRaw),
          diferenciais: v.diferenciais ?? "",
          requisitosDetalhados
        },
        processo: {
          etapas: (Array.isArray(v.etapas) ? v.etapas : []).map(e => ({
            nome: e.nome ?? "",
            responsavel: e.responsavel ?? DEFAULT_ETAPA_RESP,
            modo: e.modo ?? DEFAULT_ETAPA_MODO,
            slaDias: e.slaDias != null ? String(e.slaDias) : "",
            descricao: e.descricaoInstrucoes ?? ""
          })),
          perguntas: (Array.isArray(v.perguntasTriagem) ? v.perguntasTriagem : []).map(p => ({
            pergunta: p.texto ?? "",
            tipo: p.tipo ?? DEFAULT_QUESTION_TIPO,
            peso: p.peso ?? DEFAULT_PESO,
            obrigatoria: !!p.obrigatoria,
            knockout: !!p.knockout,
            opcoes: splitTags(p.opcoesRaw)
          })),
          obsInternas: v.observacoesProcesso ?? ""
        },
        publicacao: {
          visibilidade: v.visibilidade ?? "",
          dataInicio: v.dataInicio ?? "",
          dataFim: v.dataEncerramento ?? "",
          canais: {
            linkedin: !!v.canalLinkedIn,
            site: !!v.canalSiteCarreiras,
            indicacao: !!v.canalIndicacao,
            portalEmprego: !!v.canalPortaisEmprego
          },
          descricaoPublica: v.descricaoPublica ?? ""
        },
        compliance: {
          diversidade: {
            generoPreferencia: v.generoPreferencia ?? "",
            vagaAfirmativa: !!v.vagaAfirmativa,
            linguagemInclusiva: !!v.linguagemInclusiva,
            publicoAfirmativo: v.publicoAfirmativo ?? ""
          },
          lgpd: {
            consentimentoBase: !!v.lgpdSolicitarConsentimentoExplicito,
            compartilhamento: !!v.lgpdCompartilharCurriculoInternamente,
            retencao: !!v.lgpdRetencaoAtiva,
            retencaoMeses: v.lgpdRetencaoMeses != null ? String(v.lgpdRetencaoMeses) : ""
          },
          docs: {
            cnh: !!v.exigeCnh,
            disponibilidadeViagens: !!v.disponibilidadeParaViagens,
            antecedentes: !!v.checagemAntecedentes
          }
        }
    };
}

function fmtStatus(s){
      const map = {
        aberta: "Aberta",
        pausada: "Pausada",
        fechada: "Fechada",
        rascunho: "Rascunho",
        triagem: "Em triagem",
        entrevistas: "Em entrevistas",
        oferta: "Em oferta",
        congelada: "Congelada"
      };
      return map[s] || s;
    }

    function buildStatusBadge(s){
      const map = {
        aberta: "success",
        pausada: "warning",
        fechada: "secondary",
        rascunho: "secondary",
        triagem: "info",
        entrevistas: "info",
        oferta: "success",
        congelada: "warning"
      };
      const bs = map[s] || "primary";
      const badge = cloneTemplate("tpl-vaga-status-badge");
      if(!badge) return document.createElement("span");
      badge.classList.add("text-bg-" + bs);
      const text = badge.querySelector('[data-role="text"]');
      if(text) text.textContent = fmtStatus(s);
      return badge;
    }
    // ========= State
    const state = {
      vagas: [],
      areas: [],
      departments: [],
      selectedId: null,
      filters: { q:"", status:"all", area:"all" }
    };



    // ========= Rendering
    function updateKpis(){
      const total = state.vagas.length;
      const abertas = state.vagas.filter(v => v.status === "aberta").length;
      const pausadas = state.vagas.filter(v => v.status === "pausada").length;
      const fechadas = state.vagas.filter(v => v.status === "fechada").length;

      $("#kpiTotal").textContent = total;
      $("#kpiAbertas").textContent = abertas;
      $("#kpiPausadas").textContent = pausadas;
      $("#kpiFechadas").textContent = fechadas;
    }

    function distinctAreas(){
      return listAreas();
    }

    function renderAreaFilter(){
      const areas = distinctAreas();
      const sel = $("#fArea");
      const cur = sel.value || AREA_ALL;
      sel.replaceChildren();
      getEnumOptions("vagaAreaFilter").forEach(opt => {
        sel.appendChild(buildOption(opt.code, opt.text, opt.code === cur));
      });
      areas.forEach(a => {
        sel.appendChild(buildOption(a, a, a === cur));
      });
      sel.value = areas.includes(cur) ? cur : AREA_ALL;
    }

    function getFilteredVagas(){
      const q = (state.filters.q || "").trim().toLowerCase();
      const st = state.filters.status;
      const ar = state.filters.area;

      return state.vagas.filter(v => {
        if(st !== "all" && v.status !== st) return false;
        if(ar !== "all" && (v.area || "") !== ar) return false;

        if(!q) return true;

        const blob = [
          v.codigo, v.titulo, v.area, v.modalidade, v.cidade, v.uf, v.senioridade
        ].join(" ").toLowerCase();

        return blob.includes(q);
      });
    }

    function renderList(){
      const tbody = $("#tblVagas");
      tbody.replaceChildren();

      const rows = getFilteredVagas();
      if(!rows.length){
        const emptyRow = cloneTemplate("tpl-vaga-empty-row");
        if(emptyRow) tbody.appendChild(emptyRow);
        return;
      }

      rows.forEach(v => {
        const reqTotal = Number.isFinite(+v.requisitosTotal)
          ? +v.requisitosTotal
          : (v.requisitos || []).length;
        const reqObrig = Number.isFinite(+v.requisitosObrigatorios)
          ? +v.requisitosObrigatorios
          : (v.requisitos || []).filter(r => !!r.obrigatorio).length;
        const isSel = v.id === state.selectedId;

        const tr = cloneTemplate("tpl-vaga-row");
        if(!tr) return;
        tr.style.cursor = "default";
        if(isSel) tr.classList.add("table-active");

        setText(tr, "vaga-title", v.titulo);
        setText(tr, "vaga-code", v.codigo);
        setText(tr, "vaga-modalidade", v.modalidade);
        setText(tr, "vaga-area", v.area);
        setText(tr, "req-total", `${reqTotal} total`);
        setText(tr, "req-obrig", `${reqObrig} obrig.`);

        const thrVal = clamp(parseInt(v.threshold ?? 0,10)||0,0,100);
        setText(tr, "vaga-thr", `${thrVal}%`);

        const locParts = [v.cidade, v.uf].filter(Boolean);
        const hasLoc = locParts.length > 0;
        setText(tr, "vaga-location", hasLoc ? locParts.join(" - ") : EMPTY_TEXT);
        toggleRole(tr, "vaga-location", hasLoc);
        toggleRole(tr, "vaga-location-sep", hasLoc);

        const statusHost = tr.querySelector('[data-role="status-host"]');
        if(statusHost) statusHost.replaceChildren(buildStatusBadge(v.status));

        tr.querySelectorAll("button[data-act]").forEach(btn => {
          btn.dataset.id = v.id;
        });

        tr.addEventListener("click", (ev) => {
          const btn = ev.target.closest("button[data-act]");
          if(btn){
            ev.preventDefault();
            ev.stopPropagation();
            const act = btn.dataset.act;
            const id = btn.dataset.id;
            if(act === "detail") void openDetailModal(id);
            if(act === "edit") void openVagaModal("edit", id);
            if(act === "dup") void duplicateVaga(id);
            if(act === "del") void deleteVaga(id);
            return;
          }
        });

        tbody.appendChild(tr);
      });
    }

    function findVaga(id){
      return state.vagas.find(v => v.id === id) || null;
    }

    function upsertVagaInState(v){
      const idx = state.vagas.findIndex(x => x.id === v.id);
      if(idx >= 0){
        state.vagas[idx] = v;
      }else{
        state.vagas.unshift(v);
      }
      return v;
    }

    async function ensureVagaDetail(id){
      let v = findVaga(id);
      if(v && v.hasDetail) return v;
      try{
        const detail = await fetchVagaById(id);
        if(detail){
          upsertVagaInState(detail);
          return detail;
        }
      }catch(e){
        console.error("Falha ao buscar detalhes da vaga:", e);
        toast("Falha ao carregar detalhes da vaga.");
      }
      return v;
    }

    function selectVaga(id){
      state.selectedId = id;
      renderList();
      renderDetail();
    }

    async function openDetailModal(id){
      const v = await ensureVagaDetail(id);
      if(!v) return;
      selectVaga(v.id);
      const modal = bootstrap.Modal.getOrCreateInstance($("#modalVagaDetalhes"));
      modal.show();
    }

    // ========= Detail UI
    function renderDetail(){
      const host = $("#detailHost");
      host.replaceChildren();

      const v = findVaga(state.selectedId);
      if(!v){
        const empty = cloneTemplate("tpl-vaga-detail-empty");
        if(empty) host.appendChild(empty);
        return;
      }

      const reqTotal = (v.requisitos || []).length;
      const reqObrig = (v.requisitos || []).filter(r => !!r.obrigatorio).length;

      const updated = v.updatedAt ? new Date(v.updatedAt) : null;
      const updatedTxt = updated ? updated.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : EMPTY_TEXT;

      const weights = v.weights || { competencia:40, experiencia:30, formacao:15, localidade:15 };
      const sumW = (weights.competencia||0) + (weights.experiencia||0) + (weights.formacao||0) + (weights.localidade||0);

      const thrVal = clamp(parseInt(v.threshold ?? 0,10)||0,0,100);

      const root = cloneTemplate("tpl-vaga-detail");
      if(!root) return;

      setText(root, "detail-title", v.titulo);
      setText(root, "detail-code", v.codigo);
      setText(root, "detail-area", v.area);
      setText(root, "detail-modalidade", v.modalidade);

      const statusHost = root.querySelector('[data-role="detail-status-host"]');
      if(statusHost) statusHost.replaceChildren(buildStatusBadge(v.status));

      setText(root, "detail-updated", updatedTxt);
      setText(root, "detail-req-total", `${reqTotal} requisitos`);
      setText(root, "detail-req-obrig", `${reqObrig} obrigatorios`);
      setText(root, "detail-thr", `${thrVal}%`);

      setText(root, "detail-descricao", v.descricao);
      const locParts = [v.cidade, v.uf].filter(Boolean);
      setText(root, "detail-local", locParts.join(" - ") || EMPTY_TEXT);
      setText(root, "detail-senioridade", v.senioridade);

      const thresholdRange = root.querySelector("#thresholdRange");
      const thresholdLabel = root.querySelector("#thresholdLabel");
      if(thresholdRange) thresholdRange.value = thrVal;
      if(thresholdLabel) thresholdLabel.textContent = `${thrVal}%`;

      const weightsSum = root.querySelector("#weightsSum");
      if(weightsSum) weightsSum.textContent = sumW;

      const weightKeys = ["competencia","experiencia","formacao","localidade"];
      weightKeys.forEach(key => {
        const slider = root.querySelector("#w_" + key);
        const val = root.querySelector("#w_" + key + "_val");
        const w = clamp(parseInt(weights[key] ?? 0,10)||0, 0, 100);
        if(slider) slider.value = w;
        if(val) val.textContent = w;
      });

      host.appendChild(root);

      // bind detail actions + render req table + bind sliders
      bindDetailActions(v);
      renderReqTable(v);
      void fetchCandidatesByVaga(v.id).then(list => {
        renderVagaCandidates("#detailHost", list, {
          bodySelector: "#tblVagaCands",
          countSelector: "#vagaCandsCount"
        });
      });
    }

    function bindDetailActions(v){
      if(!v) return;

      // detail buttons
      $$("#detailHost [data-dact]").forEach(btn => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.dact;
          if(act === "editvaga") void openVagaModal("edit", v.id);
          if(act === "duplicate") void duplicateVaga(v.id);
          if(act === "delete") void deleteVaga(v.id);
          if(act === "addreq") openReqModal("new", v.id);
          if(act === "saveWeights") saveWeightsFromDetail(v.id);
          if(act === "simulate") simulateMatch(v.id);
          if(act === "simClear") clearSimulation();
        });
      });

      // threshold
      const r = $("#detailHost #thresholdRange");
      const lbl = $("#detailHost #thresholdLabel");
      if(r && lbl){
        r.addEventListener("input", () => {
          lbl.textContent = clamp(parseInt(r.value,10)||0,0,100) + "%";
        });
      }

      // weights
      ["competencia","experiencia","formacao","localidade"].forEach(k => {
        const slider = $("#detailHost #w_" + k);
        const val = $("#detailHost #w_" + k + "_val");
        if(slider && val){
          slider.addEventListener("input", () => {
            val.textContent = slider.value;
            updateWeightsSumInDetail();
          });
        }
      });

      // req search
      const reqSearch = $("#detailHost #reqSearch");
      if(reqSearch){
        reqSearch.addEventListener("input", () => renderReqTable(v));
      }
    }

    function updateWeightsSumInDetail(){
      const keys = ["competencia","experiencia","formacao","localidade"];
      let sum = 0;
      keys.forEach(k => {
        const slider = $("#detailHost #w_" + k);
        sum += (slider ? parseInt(slider.value,10) : 0) || 0;
      });
      const sumEl = $("#detailHost #weightsSum");
      if(sumEl) sumEl.textContent = sum;
    }

    function renderReqTable(v){
      const tbody = $("#detailHost #tblReq");
      if(!tbody) return;

      tbody.replaceChildren();
      const reqs = (v?.requisitos || []);

      const q = ($("#detailHost #reqSearch")?.value || "").trim().toLowerCase();
      const filtered = !q ? reqs : reqs.filter(r => {
        const categoriaText = getCategoriaText(r.categoria);
        const blob = [categoriaText, r.termo, (r.sinonimos||[]).join(" "), r.obs].join(" ").toLowerCase();
        return blob.includes(q);
      });

      if(!filtered.length){
        const emptyRow = cloneTemplate("tpl-vaga-req-empty-row");
        if(emptyRow) tbody.appendChild(emptyRow);
        return;
      }

      filtered.forEach(r => {
        const tr = cloneTemplate("tpl-vaga-req-row");
        if(!tr) return;

        const toggleInput = tr.querySelector('[data-role="req-toggle"]');
        if(toggleInput){
          toggleInput.checked = !!r.obrigatorio;
          toggleInput.dataset.rid = r.id;
        }

        setText(tr, "req-categoria", getCategoriaText(r.categoria));
        setText(tr, "req-termo", r.termo);
        setText(tr, "req-obs", r.obs || EMPTY_TEXT);
        setText(tr, "req-peso", formatPeso(r.peso));
        const syn = (r.sinonimos || []).join(", ");
        setText(tr, "req-sinonimos", syn || EMPTY_TEXT);

        tr.querySelectorAll("[data-ract]").forEach(el => {
          el.dataset.rid = r.id;
          el.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const act = el.dataset.ract;
            const rid = el.dataset.rid;
            if(act === "toggle") toggleReqMandatory(v.id, rid);
            if(act === "edit") openReqModal("edit", v.id, rid);
            if(act === "del") deleteReq(v.id, rid);
          });
        });

        tbody.appendChild(tr);
      });
    }

    
    async function fetchCandidatesByVaga(vagaId){
      if(!vagaId) return [];
      try{
        const res = await fetch(`${CANDIDATOS_API_URL}?vagaId=${encodeURIComponent(vagaId)}`, {
          headers: { "Accept": "application/json" }
        });
        if(!res.ok) throw new Error(`Falha ao buscar candidatos: ${res.status}`);
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }catch(e){
        console.error("Falha ao carregar candidatos da vaga:", e);
        return [];
      }
    }

    function renderVagaCandidates(hostSelector, list, target){
      const host = hostSelector ? document.querySelector(hostSelector) : document;
      if(!host) return;
      const tbody = host.querySelector(target.bodySelector);
      const countEl = host.querySelector(target.countSelector);
      if(countEl) countEl.textContent = list.length;
      if(!tbody) return;

      tbody.replaceChildren();
      if(!list.length){
        const emptyRow = cloneTemplate("tpl-vaga-cand-empty-row");
        if(emptyRow) tbody.appendChild(emptyRow);
        return;
      }

      list.forEach(c => {
        const tr = cloneTemplate("tpl-vaga-cand-row");
        if(!tr) return;
        setText(tr, "cand-nome", c.nome);
        setText(tr, "cand-fonte", c.fonte || EMPTY_TEXT);
        setText(tr, "cand-email", c.email || EMPTY_TEXT);
        setText(tr, "cand-status", c.status || EMPTY_TEXT);
        const score = c.lastMatch?.score ?? "";
        setText(tr, "cand-match", score !== "" ? `${score}%` : EMPTY_TEXT);

        const openBtn = tr.querySelector('[data-role="cand-open"]');
        if(openBtn){
          openBtn.href = `${CANDIDATO_URL_BASE}${encodeURIComponent(c.id)}`;
        }

        tbody.appendChild(tr);
      });
    }

    function newBenefit(){
      return {
        tipo: DEFAULT_BENEFICIO_TIPO,
        valor: "",
        recorrencia: DEFAULT_BENEFICIO_REC,
        obrigatorio: true,
        obs: ""
      };
    }

    function newModalReq(){
      return {
        nome: "",
        peso: DEFAULT_PESO,
        obrigatorio: false,
        anos: "",
        nivel: DEFAULT_REQ_NIVEL,
        avaliacao: DEFAULT_REQ_AVALIACAO,
        obs: ""
      };
    }

    function newStage(){
      return {
        nome: "Entrevista RH",
        responsavel: DEFAULT_ETAPA_RESP,
        modo: DEFAULT_ETAPA_MODO,
        slaDias: "3",
        descricao: ""
      };
    }

    function newQuestion(){
      return {
        pergunta: "Tem disponibilidade para presencial 2x por semana?",
        tipo: DEFAULT_QUESTION_TIPO,
        peso: DEFAULT_PESO,
        obrigatoria: true,
        knockout: false,
        opcoes: []
      };
    }

    function bindRemoveRow(row){
      const btn = row.querySelector('[data-act="remove"]');
      if(btn) btn.addEventListener("click", () => row.remove());
    }

    function buildBenefitRow(item){
      const row = cloneTemplate("tpl-vaga-benefit-row");
      if(!row) return null;
      const typeEl = row.querySelector('[data-role="benefit-type"]');
      const valEl = row.querySelector('[data-role="benefit-value"]');
      const recEl = row.querySelector('[data-role="benefit-rec"]');
      const reqEl = row.querySelector('[data-role="benefit-required"]');
      const obsEl = row.querySelector('[data-role="benefit-obs"]');
      const titleEl = row.querySelector('[data-role="benefit-title"]');

      if(typeEl) fillSelectFromEnum(typeEl, "vagaBeneficioTipo", item.tipo || DEFAULT_BENEFICIO_TIPO);
      if(recEl) fillSelectFromEnum(recEl, "vagaBeneficioRecorrencia", item.recorrencia || DEFAULT_BENEFICIO_REC);
      if(valEl) valEl.value = item.valor || "";
      if(reqEl) reqEl.checked = !!item.obrigatorio;
      if(obsEl) obsEl.value = item.obs || "";
      if(titleEl && typeEl) titleEl.textContent = typeEl.selectedOptions[0]?.textContent || "Beneficio";

      if(typeEl && titleEl){
        typeEl.addEventListener("change", () => {
          titleEl.textContent = typeEl.selectedOptions[0]?.textContent || "Beneficio";
        });
      }

      bindRemoveRow(row);
      return row;
    }

    function renderBenefitList(items){
      const host = $("#vagaBenefitsList");
      if(!host) return;
      host.replaceChildren();
      (items || []).forEach(it => {
        const row = buildBenefitRow(it);
        if(row) host.appendChild(row);
      });
    }

    function collectBenefitList(){
      const host = $("#vagaBenefitsList");
      if(!host) return [];
      return $$(".vaga-benefit-row", host).map(row => ({
        tipo: row.querySelector('[data-role="benefit-type"]')?.value || "",
        valor: row.querySelector('[data-role="benefit-value"]')?.value || "",
        recorrencia: row.querySelector('[data-role="benefit-rec"]')?.value || "",
        obrigatorio: !!row.querySelector('[data-role="benefit-required"]')?.checked,
        obs: row.querySelector('[data-role="benefit-obs"]')?.value || ""
      }));
    }

    function buildModalReqRow(item){
      const row = cloneTemplate("tpl-vaga-modal-req-row");
      if(!row) return null;
      const nameEl = row.querySelector('[data-role="req-name"]');
      const weightEl = row.querySelector('[data-role="req-weight"]');
      const reqEl = row.querySelector('[data-role="req-required"]');
      const yearsEl = row.querySelector('[data-role="req-years"]');
      const levelEl = row.querySelector('[data-role="req-level"]');
      const evalEl = row.querySelector('[data-role="req-eval"]');
      const obsEl = row.querySelector('[data-role="req-obs"]');
      const titleEl = row.querySelector('[data-role="req-title"]');

      if(nameEl) nameEl.value = item.nome || "";
      if(weightEl) fillSelectFromEnum(weightEl, "vagaPeso", item.peso != null ? String(item.peso) : DEFAULT_PESO);
      if(reqEl) reqEl.checked = !!item.obrigatorio;
      if(yearsEl) yearsEl.value = item.anos || "";
      if(levelEl) fillSelectFromEnum(levelEl, "vagaRequisitoNivel", item.nivel || DEFAULT_REQ_NIVEL);
      if(evalEl) fillSelectFromEnum(evalEl, "vagaRequisitoAvaliacao", item.avaliacao || DEFAULT_REQ_AVALIACAO);
      if(obsEl) obsEl.value = item.obs || "";
      if(titleEl && nameEl) titleEl.textContent = nameEl.value || "Requisito";

      if(nameEl && titleEl){
        nameEl.addEventListener("input", () => {
          titleEl.textContent = nameEl.value || "Requisito";
        });
      }

      bindRemoveRow(row);
      return row;
    }

    function renderModalReqList(items){
      const host = $("#vagaReqList");
      if(!host) return;
      host.replaceChildren();
      (items || []).forEach(it => {
        const row = buildModalReqRow(it);
        if(row) host.appendChild(row);
      });
    }

    function collectModalReqList(){
      const host = $("#vagaReqList");
      if(!host) return [];
      return $$(".vaga-req-row", host).map(row => ({
        nome: row.querySelector('[data-role="req-name"]')?.value || "",
        peso: row.querySelector('[data-role="req-weight"]')?.value || DEFAULT_PESO,
        obrigatorio: !!row.querySelector('[data-role="req-required"]')?.checked,
        anos: row.querySelector('[data-role="req-years"]')?.value || "",
        nivel: row.querySelector('[data-role="req-level"]')?.value || "",
        avaliacao: row.querySelector('[data-role="req-eval"]')?.value || "",
        obs: row.querySelector('[data-role="req-obs"]')?.value || ""
      }));
    }

    function buildStageRow(item){
      const row = cloneTemplate("tpl-vaga-stage-row");
      if(!row) return null;
      const nameEl = row.querySelector('[data-role="stage-name"]');
      const ownerEl = row.querySelector('[data-role="stage-owner"]');
      const modeEl = row.querySelector('[data-role="stage-mode"]');
      const slaEl = row.querySelector('[data-role="stage-sla"]');
      const descEl = row.querySelector('[data-role="stage-desc"]');
      const titleEl = row.querySelector('[data-role="stage-title"]');

      if(nameEl) nameEl.value = item.nome || "";
      if(ownerEl) fillSelectFromEnum(ownerEl, "vagaEtapaResponsavel", item.responsavel || DEFAULT_ETAPA_RESP);
      if(modeEl) fillSelectFromEnum(modeEl, "vagaEtapaModo", item.modo || DEFAULT_ETAPA_MODO);
      if(slaEl) slaEl.value = item.slaDias || "";
      if(descEl) descEl.value = item.descricao || "";
      if(titleEl && nameEl) titleEl.textContent = nameEl.value || "Etapa";

      if(nameEl && titleEl){
        nameEl.addEventListener("input", () => {
          titleEl.textContent = nameEl.value || "Etapa";
        });
      }

      bindRemoveRow(row);
      return row;
    }

    function renderStageList(items){
      const host = $("#vagaEtapasList");
      if(!host) return;
      host.replaceChildren();
      (items || []).forEach(it => {
        const row = buildStageRow(it);
        if(row) host.appendChild(row);
      });
    }

    function collectStageList(){
      const host = $("#vagaEtapasList");
      if(!host) return [];
      return $$(".vaga-stage-row", host).map(row => ({
        nome: row.querySelector('[data-role="stage-name"]')?.value || "",
        responsavel: row.querySelector('[data-role="stage-owner"]')?.value || "",
        modo: row.querySelector('[data-role="stage-mode"]')?.value || "",
        slaDias: row.querySelector('[data-role="stage-sla"]')?.value || "",
        descricao: row.querySelector('[data-role="stage-desc"]')?.value || ""
      }));
    }

    function toggleQuestionOptions(row){
      const typeEl = row.querySelector('[data-role="question-type"]');
      const wrap = row.querySelector('[data-role="question-options-wrap"]');
      if(!typeEl || !wrap) return;
      wrap.classList.toggle("d-none", !isMultipleChoiceQuestion(typeEl.value));
    }

    function buildQuestionRow(item){
      const row = cloneTemplate("tpl-vaga-question-row");
      if(!row) return null;
      const textEl = row.querySelector('[data-role="question-text"]');
      const typeEl = row.querySelector('[data-role="question-type"]');
      const weightEl = row.querySelector('[data-role="question-weight"]');
      const reqEl = row.querySelector('[data-role="question-required"]');
      const koEl = row.querySelector('[data-role="question-ko"]');
      const optEl = row.querySelector('[data-role="question-options"]');
      const titleEl = row.querySelector('[data-role="question-title"]');

      if(textEl) textEl.value = item.pergunta || "";
      if(typeEl) fillSelectFromEnum(typeEl, "vagaPerguntaTipo", item.tipo || DEFAULT_QUESTION_TIPO);
      if(weightEl) fillSelectFromEnum(weightEl, "vagaPeso", item.peso != null ? String(item.peso) : DEFAULT_PESO);
      if(reqEl) reqEl.checked = !!item.obrigatoria;
      if(koEl) koEl.checked = !!item.knockout;
      if(optEl) optEl.value = Array.isArray(item.opcoes) ? item.opcoes.join("; ") : (item.opcoes || "");
      if(titleEl && textEl) titleEl.textContent = textEl.value || "Pergunta";

      if(textEl && titleEl){
        textEl.addEventListener("input", () => {
          titleEl.textContent = textEl.value || "Pergunta";
        });
      }
      if(typeEl){
        typeEl.addEventListener("change", () => toggleQuestionOptions(row));
      }
      toggleQuestionOptions(row);

      bindRemoveRow(row);
      return row;
    }

    function renderQuestionList(items){
      const host = $("#vagaPerguntasList");
      if(!host) return;
      host.replaceChildren();
      (items || []).forEach(it => {
        const row = buildQuestionRow(it);
        if(row) host.appendChild(row);
      });
    }

    function collectQuestionList(){
      const host = $("#vagaPerguntasList");
      if(!host) return [];
      return $$(".vaga-question-row", host).map(row => {
        const type = row.querySelector('[data-role="question-type"]')?.value || "";
        const optText = row.querySelector('[data-role="question-options"]')?.value || "";
        const hasOptions = isMultipleChoiceQuestion(type);
        return {
          pergunta: row.querySelector('[data-role="question-text"]')?.value || "",
          tipo: type,
          peso: row.querySelector('[data-role="question-weight"]')?.value || DEFAULT_PESO,
          obrigatoria: !!row.querySelector('[data-role="question-required"]')?.checked,
          knockout: !!row.querySelector('[data-role="question-ko"]')?.checked,
          opcoes: hasOptions ? splitTags(optText) : []
        };
      });
    }

    // ========= CRUD: Vagas
    async function openVagaModal(mode, id){
      const modal = bootstrap.Modal.getOrCreateInstance($("#modalVaga"));
      const isEdit = mode === "edit";
      $("#modalVagaTitle").textContent = isEdit ? "Editar vaga" : "Nova vaga";
      applyVagaEnumOptions();
      const tabBtn = document.querySelector('#vagaModalTabs [data-bs-target="#tabVagaForm"]');
      if(tabBtn){
        bootstrap.Tab.getOrCreateInstance(tabBtn).show();
      }

      if(isEdit){
        const v = await ensureVagaDetail(id);
        if(!v) return;
        const meta = v.meta || {};
        const jornada = v.jornada || {};
        const local = jornada.local || {};
        const remuneracao = v.remuneracao || {};
        const requisitosExtras = v.requisitosExtras || {};
        const processo = v.processo || {};
        const publicacao = v.publicacao || {};
        const compliance = v.compliance || {};
        const diversidade = compliance.diversidade || {};
        const lgpd = compliance.lgpd || {};
        const docs = compliance.docs || {};

        $("#vagaId").value = v.id;
        $("#vagaCodigo").value = v.codigo || "";
        $("#vagaTitulo").value = v.titulo || "";
        fillVagaDepartmentSelect(v.departmentId || meta.departamento || "");
        fillVagaAreaSelect(v.areaId || "");
        $("#vagaArea").value = v.areaId || "";
        setValue("vagaModalidade", v.modalidade || DEFAULT_MODALIDADE);
        setValue("vagaStatus", normalizeStatusCode(v.statusRaw || v.status || DEFAULT_STATUS));
        $("#vagaCidade").value = v.cidade || local.cidade || "";
        $("#vagaUF").value = v.uf || local.uf || "";
        setValue("vagaSenioridade", v.senioridade || DEFAULT_SENIORIDADE);
        $("#vagaThreshold").value = clamp(parseInt(v.threshold ?? 70,10)||70, 0, 100);
        $("#vagaDescricao").value = v.descricao || "";

        setValue("vagaDepartamento", v.departmentId || meta.departamento || DEFAULT_DEPARTAMENTO);
        setValue("vagaAreaTime", meta.areaTime || DEFAULT_AREA_TIME);
        setValue("vagaQuantidade", meta.quantidade ?? 1);
        setValue("vagaTipoContratacao", meta.tipoContratacao || DEFAULT_TIPO_CONTRATACAO);
        setValue("vagaCodigoInterno", meta.codigoInterno || "");
        setValue("vagaCbo", meta.cbo || "");
        setValue("vagaGestor", meta.gestorRequisitante || "");
        setValue("vagaRecrutador", meta.recrutador || "");
        setValue("vagaMotivoAbertura", meta.motivoAbertura || DEFAULT_MOTIVO);
        setValue("vagaOrcamento", meta.orcamentoAprovado || DEFAULT_ORCAMENTO);
        setValue("vagaPrioridade", meta.prioridade || DEFAULT_PRIORIDADE);
        setValue("vagaResumo", meta.resumo || "");
        setValue("vagaTagsResponsabilidades", joinTags(meta.tagsResponsabilidades));
        setValue("vagaTagsKeywords", joinTags(meta.tagsKeywords));
        setChecked("vagaConfidencial", meta.confidencial);
        setChecked("vagaAceitaPcd", meta.aceitaPcd);
        setChecked("vagaUrgente", meta.urgente);
        setValue("vagaProjetoNome", meta.projeto?.nome || "");
        setValue("vagaProjetoCliente", meta.projeto?.cliente || "");
        setValue("vagaProjetoPrazo", meta.projeto?.prazo || "");
        setValue("vagaProjetoDescricao", meta.projeto?.descricao || "");

        setValue("vagaGeneroPreferencia", diversidade.generoPreferencia || DEFAULT_GENERO);
        setChecked("vagaVagaAfirmativa", diversidade.vagaAfirmativa);
        setChecked("vagaLinguagemInclusiva", diversidade.linguagemInclusiva);
        setValue("vagaPublicoAfirmativo", diversidade.publicoAfirmativo || "");
        setValue("vagaPcdObs", meta.pcdObs || "");

        setValue("vagaRegime", jornada.regime || DEFAULT_REGIME);
        setValue("vagaCargaSemanal", jornada.cargaSemanal || "");
        setValue("vagaHoraEntrada", jornada.horaEntrada || "");
        setValue("vagaHoraSaida", jornada.horaSaida || "");
        setValue("vagaIntervalo", jornada.intervalo || "");
        setValue("vagaEscala", jornada.escala || DEFAULT_ESCALA);
        setValue("vagaCep", local.cep || "");
        setValue("vagaLogradouro", local.logradouro || "");
        setValue("vagaNumero", local.numero || "");
        setValue("vagaBairro", local.bairro || "");
        setValue("vagaPoliticaTrabalho", local.politicaTrabalho || "");
        setValue("vagaDeslocamentoObs", local.deslocamentoObs || "");

        setValue("vagaMoeda", remuneracao.moeda || DEFAULT_MOEDA);
        setValue("vagaSalarioMin", remuneracao.salarioMin || "");
        setValue("vagaSalarioMax", remuneracao.salarioMax || "");
        setValue("vagaPeriodicidade", remuneracao.periodicidade || DEFAULT_REMUN_PERIOD);
        setValue("vagaBonusTipo", remuneracao.bonusTipo || DEFAULT_BONUS);
        setValue("vagaBonusPercentual", remuneracao.percentual || "");
        setValue("vagaRemObs", remuneracao.obs || "");

        setValue("vagaEscolaridade", requisitosExtras.escolaridade || DEFAULT_ESCOLARIDADE);
        setValue("vagaFormacaoArea", requisitosExtras.formacaoArea || DEFAULT_FORMACAO);
        setValue("vagaExpMinAnos", requisitosExtras.expMinAnos || "");
        setValue("vagaTagsStack", joinTags(requisitosExtras.tagsStack));
        setValue("vagaTagsIdiomas", joinTags(requisitosExtras.tagsIdiomas));
        setValue("vagaDiferenciais", requisitosExtras.diferenciais || "");

        setValue("vagaObsProcesso", processo.obsInternas || "");

        setValue("vagaVisibilidade", publicacao.visibilidade || DEFAULT_PUBLICACAO);
        setValue("vagaDataInicio", publicacao.dataInicio || "");
        setValue("vagaDataFim", publicacao.dataFim || "");
        setChecked("vagaCanalLinkedin", publicacao.canais?.linkedin);
        setChecked("vagaCanalSite", publicacao.canais?.site);
        setChecked("vagaCanalIndicacao", publicacao.canais?.indicacao);
        setChecked("vagaCanalPortal", publicacao.canais?.portalEmprego);
        setValue("vagaDescricaoPublica", publicacao.descricaoPublica || "");

        setChecked("vagaLgpdConsentimento", lgpd.consentimentoBase);
        setChecked("vagaLgpdCompartilhamento", lgpd.compartilhamento);
        setChecked("vagaLgpdRetencao", lgpd.retencao);
        setValue("vagaLgpdRetencaoMeses", lgpd.retencaoMeses || "");
        setChecked("vagaDocCnh", docs.cnh);
        setChecked("vagaDocViagens", docs.disponibilidadeViagens);
        setChecked("vagaDocAntecedentes", docs.antecedentes);

        renderBenefitList(Array.isArray(remuneracao.beneficios) ? remuneracao.beneficios : []);
        renderModalReqList(Array.isArray(requisitosExtras.requisitosDetalhados) ? requisitosExtras.requisitosDetalhados : []);
        renderStageList(Array.isArray(processo.etapas) ? processo.etapas : []);
        renderQuestionList(Array.isArray(processo.perguntas) ? processo.perguntas : []);
        void fetchCandidatesByVaga(v.id).then(list => {
          renderVagaCandidates("#modalVaga", list, {
            bodySelector: "#tblVagaEditCands",
            countSelector: "#vagaEditCandsCount"
          });
        });
      }else{
        $("#vagaId").value = "";
        $("#vagaCodigo").value = "";
        $("#vagaTitulo").value = "";
        fillVagaDepartmentSelect("");
        fillVagaAreaSelect("");
        $("#vagaArea").value = "";
        setValue("vagaModalidade", DEFAULT_MODALIDADE);
        setValue("vagaStatus", DEFAULT_STATUS);
        $("#vagaCidade").value = "";
        $("#vagaUF").value = "SP";
        setValue("vagaSenioridade", DEFAULT_SENIORIDADE);
        $("#vagaThreshold").value = 70;
        $("#vagaDescricao").value = "";

        setValue("vagaDepartamento", DEFAULT_DEPARTAMENTO);
        setValue("vagaAreaTime", DEFAULT_AREA_TIME);
        setValue("vagaQuantidade", 1);
        setValue("vagaTipoContratacao", DEFAULT_TIPO_CONTRATACAO);
        setValue("vagaCodigoInterno", "");
        setValue("vagaCbo", "");
        setValue("vagaGestor", "");
        setValue("vagaRecrutador", "");
        setValue("vagaMotivoAbertura", DEFAULT_MOTIVO);
        setValue("vagaOrcamento", DEFAULT_ORCAMENTO);
        setValue("vagaPrioridade", DEFAULT_PRIORIDADE);
        setValue("vagaResumo", "");
        setValue("vagaTagsResponsabilidades", "");
        setValue("vagaTagsKeywords", "");
        setChecked("vagaConfidencial", false);
        setChecked("vagaAceitaPcd", false);
        setChecked("vagaUrgente", false);
        setValue("vagaProjetoNome", "");
        setValue("vagaProjetoCliente", "");
        setValue("vagaProjetoPrazo", "");
        setValue("vagaProjetoDescricao", "");

        setValue("vagaGeneroPreferencia", DEFAULT_GENERO);
        setChecked("vagaVagaAfirmativa", false);
        setChecked("vagaLinguagemInclusiva", false);
        setValue("vagaPublicoAfirmativo", "");
        setValue("vagaPcdObs", "");

        setValue("vagaRegime", DEFAULT_REGIME);
        setValue("vagaCargaSemanal", "");
        setValue("vagaHoraEntrada", "");
        setValue("vagaHoraSaida", "");
        setValue("vagaIntervalo", "");
        setValue("vagaEscala", DEFAULT_ESCALA);
        setValue("vagaCep", "");
        setValue("vagaLogradouro", "");
        setValue("vagaNumero", "");
        setValue("vagaBairro", "");
        setValue("vagaPoliticaTrabalho", "");
        setValue("vagaDeslocamentoObs", "");

        setValue("vagaMoeda", DEFAULT_MOEDA);
        setValue("vagaSalarioMin", "");
        setValue("vagaSalarioMax", "");
        setValue("vagaPeriodicidade", DEFAULT_REMUN_PERIOD);
        setValue("vagaBonusTipo", DEFAULT_BONUS);
        setValue("vagaBonusPercentual", "");
        setValue("vagaRemObs", "");

        setValue("vagaEscolaridade", DEFAULT_ESCOLARIDADE);
        setValue("vagaFormacaoArea", DEFAULT_FORMACAO);
        setValue("vagaExpMinAnos", "");
        setValue("vagaTagsStack", "");
        setValue("vagaTagsIdiomas", "");
        setValue("vagaDiferenciais", "");

        setValue("vagaObsProcesso", "");

        setValue("vagaVisibilidade", DEFAULT_PUBLICACAO);
        setValue("vagaDataInicio", "");
        setValue("vagaDataFim", "");
        setChecked("vagaCanalLinkedin", false);
        setChecked("vagaCanalSite", false);
        setChecked("vagaCanalIndicacao", false);
        setChecked("vagaCanalPortal", false);
        setValue("vagaDescricaoPublica", "");

        setChecked("vagaLgpdConsentimento", false);
        setChecked("vagaLgpdCompartilhamento", false);
        setChecked("vagaLgpdRetencao", false);
        setValue("vagaLgpdRetencaoMeses", "");
        setChecked("vagaDocCnh", false);
        setChecked("vagaDocViagens", false);
        setChecked("vagaDocAntecedentes", false);

        renderBenefitList([newBenefit()]);
        renderModalReqList([newModalReq()]);
        renderStageList([newStage()]);
        renderQuestionList([newQuestion()]);
      }

      modal.show();
    }

    function buildVagaPayloadFromForm(){
      const titulo = getValue("vagaTitulo");
      const departmentId = getValue("vagaDepartamento");
      const areaId = getValue("vagaArea");
      const status = getValue("vagaStatus");
      const quantidadeVagas = parseIntOrNull(getValue("vagaQuantidade"));
      const matchMinimoPercentual = parseIntOrNull(getValue("vagaThreshold"));

      if(!titulo) return { error: "Informe o titulo da vaga." };
      if(!departmentId) return { error: "Selecione o departamento da vaga." };
      if(!areaId) return { error: "Selecione a area da vaga." };
      if(!status) return { error: "Selecione o status da vaga." };
      if(quantidadeVagas == null || quantidadeVagas < 1) return { error: "Informe a quantidade de vagas." };
      if(matchMinimoPercentual == null || matchMinimoPercentual < 0 || matchMinimoPercentual > 100) return { error: "Informe o match minimo (0 a 100)." };

      const tagsResponsabilidadesRaw = joinTagsRaw(splitTags(getValue("vagaTagsResponsabilidades")));
      const tagsKeywordsRaw = joinTagsRaw(splitTags(getValue("vagaTagsKeywords")));
      const tagsStackRaw = joinTagsRaw(splitTags(getValue("vagaTagsStack")));
      const tagsIdiomasRaw = joinTagsRaw(splitTags(getValue("vagaTagsIdiomas")));
      const uf = emptyToNull(getValue("vagaUF"));
      const ufCode = uf ? uf.toUpperCase().slice(0, 2) : null;

      const beneficios = collectBenefitList().map((b, idx) => ({
        ordem: idx + 1,
        tipo: emptyToNull(b.tipo) || DEFAULT_BENEFICIO_TIPO,
        valor: parseDecimalOrNull(b.valor),
        recorrencia: emptyToNull(b.recorrencia) || DEFAULT_BENEFICIO_REC,
        obrigatorio: !!b.obrigatorio,
        observacoes: emptyToNull(b.obs)
      }));

      const requisitos = collectModalReqList()
        .filter(r => (r.nome || "").trim())
        .map((r, idx) => ({
          ordem: idx + 1,
          categoria: emptyToNull(r.categoria) || getDefaultCategoria(),
          nome: r.nome.trim(),
          peso: emptyToNull(r.peso) || DEFAULT_PESO,
          obrigatorio: !!r.obrigatorio,
          anosMinimos: parseIntOrNull(r.anos),
          nivel: emptyToNull(r.nivel),
          avaliacao: emptyToNull(r.avaliacao),
          sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : [],
          observacoes: emptyToNull(r.obs)
        }));

      const etapas = collectStageList()
        .filter(e => (e.nome || "").trim())
        .map((e, idx) => ({
          ordem: idx + 1,
          nome: e.nome.trim(),
          responsavel: emptyToNull(e.responsavel) || DEFAULT_ETAPA_RESP,
          modo: emptyToNull(e.modo) || DEFAULT_ETAPA_MODO,
          slaDias: parseIntOrNull(e.slaDias),
          descricaoInstrucoes: emptyToNull(e.descricao)
        }));

      const perguntasTriagem = collectQuestionList()
        .filter(p => (p.pergunta || "").trim())
        .map((p, idx) => ({
          ordem: idx + 1,
          texto: p.pergunta.trim(),
          tipo: emptyToNull(p.tipo) || DEFAULT_QUESTION_TIPO,
          peso: emptyToNull(p.peso) || DEFAULT_PESO,
          obrigatoria: !!p.obrigatoria,
          knockout: !!p.knockout,
          opcoesRaw: isMultipleChoiceQuestion(p.tipo) ? joinTagsRaw(p.opcoes) : null
        }));

      const currentId = $("#vagaId").value || null;
      const current = currentId ? findVaga(currentId) : null;
      const weights = current?.weights || { competencia:40, experiencia:30, formacao:15, localidade:15 };

      const payload = {
        titulo,
        departmentId,
        areaId,
        status,
        codigo: emptyToNull(getValue("vagaCodigo")),
        areaTime: emptyToNull(getValue("vagaAreaTime")),
        modalidade: emptyToNull(getValue("vagaModalidade")),
        senioridade: emptyToNull(getValue("vagaSenioridade")),
        quantidadeVagas,
        tipoContratacao: emptyToNull(getValue("vagaTipoContratacao")),
        matchMinimoPercentual,
        weights,
        descricaoInterna: emptyToNull(getValue("vagaDescricao")),
        codigoInterno: emptyToNull(getValue("vagaCodigoInterno")),
        codigoCbo: emptyToNull(getValue("vagaCbo")),
        motivoAbertura: emptyToNull(getValue("vagaMotivoAbertura")),
        orcamentoAprovado: emptyToNull(getValue("vagaOrcamento")),
        gestorRequisitante: emptyToNull(getValue("vagaGestor")),
        recrutadorResponsavel: emptyToNull(getValue("vagaRecrutador")),
        prioridade: emptyToNull(getValue("vagaPrioridade")),
        resumoPitch: emptyToNull(getValue("vagaResumo")),
        tagsResponsabilidadesRaw: emptyToNull(tagsResponsabilidadesRaw),
        tagsKeywordsRaw: emptyToNull(tagsKeywordsRaw),
        confidencial: getChecked("vagaConfidencial"),
        aceitaPcd: getChecked("vagaAceitaPcd"),
        urgente: getChecked("vagaUrgente"),
        generoPreferencia: emptyToNull(getValue("vagaGeneroPreferencia")),
        vagaAfirmativa: getChecked("vagaVagaAfirmativa"),
        linguagemInclusiva: getChecked("vagaLinguagemInclusiva"),
        publicoAfirmativo: emptyToNull(getValue("vagaPublicoAfirmativo")),
        observacoesPcd: emptyToNull(getValue("vagaPcdObs")),
        projetoNome: emptyToNull(getValue("vagaProjetoNome")),
        projetoClienteAreaImpactada: emptyToNull(getValue("vagaProjetoCliente")),
        projetoPrazoPrevisto: emptyToNull(getValue("vagaProjetoPrazo")),
        projetoDescricao: emptyToNull(getValue("vagaProjetoDescricao")),
        regime: emptyToNull(getValue("vagaRegime")),
        cargaSemanalHoras: parseIntOrNull(getValue("vagaCargaSemanal")),
        escala: emptyToNull(getValue("vagaEscala")),
        horaEntrada: parseTimeOrNull(getValue("vagaHoraEntrada")),
        horaSaida: parseTimeOrNull(getValue("vagaHoraSaida")),
        intervalo: parseTimeSpanOrNull(getValue("vagaIntervalo")),
        cep: emptyToNull(getValue("vagaCep")),
        logradouro: emptyToNull(getValue("vagaLogradouro")),
        numero: emptyToNull(getValue("vagaNumero")),
        bairro: emptyToNull(getValue("vagaBairro")),
        cidade: emptyToNull(getValue("vagaCidade")),
        uf: ufCode,
        politicaTrabalho: emptyToNull(getValue("vagaPoliticaTrabalho")),
        observacoesDeslocamento: emptyToNull(getValue("vagaDeslocamentoObs")),
        moeda: emptyToNull(getValue("vagaMoeda")),
        salarioMinimo: parseDecimalOrNull(getValue("vagaSalarioMin")),
        salarioMaximo: parseDecimalOrNull(getValue("vagaSalarioMax")),
        periodicidade: emptyToNull(getValue("vagaPeriodicidade")),
        bonusTipo: emptyToNull(getValue("vagaBonusTipo")),
        bonusPercentual: parseDecimalOrNull(getValue("vagaBonusPercentual")),
        observacoesRemuneracao: emptyToNull(getValue("vagaRemObs")),
        escolaridade: emptyToNull(getValue("vagaEscolaridade")),
        formacaoArea: emptyToNull(getValue("vagaFormacaoArea")),
        experienciaMinimaAnos: parseIntOrNull(getValue("vagaExpMinAnos")),
        tagsStackRaw: emptyToNull(tagsStackRaw),
        tagsIdiomasRaw: emptyToNull(tagsIdiomasRaw),
        diferenciais: emptyToNull(getValue("vagaDiferenciais")),
        observacoesProcesso: emptyToNull(getValue("vagaObsProcesso")),
        visibilidade: emptyToNull(getValue("vagaVisibilidade")),
        dataInicio: parseDateInput(getValue("vagaDataInicio")),
        dataEncerramento: parseDateInput(getValue("vagaDataFim")),
        canalLinkedIn: getChecked("vagaCanalLinkedin"),
        canalSiteCarreiras: getChecked("vagaCanalSite"),
        canalIndicacao: getChecked("vagaCanalIndicacao"),
        canalPortaisEmprego: getChecked("vagaCanalPortal"),
        descricaoPublica: emptyToNull(getValue("vagaDescricaoPublica")),
        lgpdSolicitarConsentimentoExplicito: getChecked("vagaLgpdConsentimento"),
        lgpdCompartilharCurriculoInternamente: getChecked("vagaLgpdCompartilhamento"),
        lgpdRetencaoAtiva: getChecked("vagaLgpdRetencao"),
        lgpdRetencaoMeses: parseIntOrNull(getValue("vagaLgpdRetencaoMeses")),
        exigeCnh: getChecked("vagaDocCnh"),
        disponibilidadeParaViagens: getChecked("vagaDocViagens"),
        checagemAntecedentes: getChecked("vagaDocAntecedentes"),
        beneficios,
        requisitos,
        etapas,
        perguntasTriagem
      };

      return { payload };
    }

    function buildVagaPayloadFromState(v){
      const meta = v.meta || {};
      const jornada = v.jornada || {};
      const local = jornada.local || {};
      const remuneracao = v.remuneracao || {};
      const requisitosExtras = v.requisitosExtras || {};
      const processo = v.processo || {};
      const publicacao = v.publicacao || {};
      const compliance = v.compliance || {};
      const diversidade = compliance.diversidade || {};
      const lgpd = compliance.lgpd || {};
      const docs = compliance.docs || {};

      const departmentId = v.departmentId || meta.departamento;
      const areaId = v.areaId;
      const status = v.statusRaw || DEFAULT_STATUS;
      if(!v.titulo || !departmentId || !areaId || !status) return null;

      const tagsResponsabilidadesRaw = joinTagsRaw(meta.tagsResponsabilidades);
      const tagsKeywordsRaw = joinTagsRaw(meta.tagsKeywords);
      const tagsStackRaw = joinTagsRaw(requisitosExtras.tagsStack);
      const tagsIdiomasRaw = joinTagsRaw(requisitosExtras.tagsIdiomas);
      const uf = emptyToNull(local.uf || v.uf);
      const ufCode = uf ? uf.toUpperCase().slice(0, 2) : null;

        return {
          titulo: v.titulo,
          departmentId,
          areaId,
          status,
        codigo: emptyToNull(v.codigo),
        areaTime: emptyToNull(meta.areaTime),
        modalidade: emptyToNull(v.modalidade),
        senioridade: emptyToNull(v.senioridade),
        quantidadeVagas: parseIntOrNull(meta.quantidade) ?? v.quantidadeVagas ?? 1,
        tipoContratacao: emptyToNull(meta.tipoContratacao),
          matchMinimoPercentual: Number.isFinite(+v.threshold) ? +v.threshold : (v.matchMinimoPercentual ?? 0),
          weights: v.weights || { competencia:40, experiencia:30, formacao:15, localidade:15 },
          descricaoInterna: emptyToNull(v.descricao),
        codigoInterno: emptyToNull(meta.codigoInterno),
        codigoCbo: emptyToNull(meta.cbo),
        motivoAbertura: emptyToNull(meta.motivoAbertura),
        orcamentoAprovado: emptyToNull(meta.orcamentoAprovado),
        gestorRequisitante: emptyToNull(meta.gestorRequisitante),
        recrutadorResponsavel: emptyToNull(meta.recrutador),
        prioridade: emptyToNull(meta.prioridade),
        resumoPitch: emptyToNull(meta.resumo),
        tagsResponsabilidadesRaw: emptyToNull(tagsResponsabilidadesRaw),
        tagsKeywordsRaw: emptyToNull(tagsKeywordsRaw),
        confidencial: !!(meta.confidencial || v.confidencial),
        aceitaPcd: !!(meta.aceitaPcd || v.aceitaPcd),
        urgente: !!(meta.urgente || v.urgente),
        generoPreferencia: emptyToNull(diversidade.generoPreferencia),
        vagaAfirmativa: !!diversidade.vagaAfirmativa,
        linguagemInclusiva: !!diversidade.linguagemInclusiva,
        publicoAfirmativo: emptyToNull(diversidade.publicoAfirmativo),
        observacoesPcd: emptyToNull(meta.pcdObs),
        projetoNome: emptyToNull(meta.projeto?.nome),
        projetoClienteAreaImpactada: emptyToNull(meta.projeto?.cliente),
        projetoPrazoPrevisto: emptyToNull(meta.projeto?.prazo),
        projetoDescricao: emptyToNull(meta.projeto?.descricao),
        regime: emptyToNull(jornada.regime),
        cargaSemanalHoras: parseIntOrNull(jornada.cargaSemanal),
        escala: emptyToNull(jornada.escala),
        horaEntrada: parseTimeOrNull(jornada.horaEntrada),
        horaSaida: parseTimeOrNull(jornada.horaSaida),
        intervalo: parseTimeSpanOrNull(jornada.intervalo),
        cep: emptyToNull(local.cep),
        logradouro: emptyToNull(local.logradouro),
        numero: emptyToNull(local.numero),
        bairro: emptyToNull(local.bairro),
        cidade: emptyToNull(local.cidade || v.cidade),
        uf: ufCode,
        politicaTrabalho: emptyToNull(local.politicaTrabalho),
        observacoesDeslocamento: emptyToNull(local.deslocamentoObs),
        moeda: emptyToNull(remuneracao.moeda),
        salarioMinimo: parseDecimalOrNull(remuneracao.salarioMin),
        salarioMaximo: parseDecimalOrNull(remuneracao.salarioMax),
        periodicidade: emptyToNull(remuneracao.periodicidade),
        bonusTipo: emptyToNull(remuneracao.bonusTipo),
        bonusPercentual: parseDecimalOrNull(remuneracao.percentual),
        observacoesRemuneracao: emptyToNull(remuneracao.obs),
        escolaridade: emptyToNull(requisitosExtras.escolaridade),
        formacaoArea: emptyToNull(requisitosExtras.formacaoArea),
        experienciaMinimaAnos: parseIntOrNull(requisitosExtras.expMinAnos),
        tagsStackRaw: emptyToNull(tagsStackRaw),
        tagsIdiomasRaw: emptyToNull(tagsIdiomasRaw),
        diferenciais: emptyToNull(requisitosExtras.diferenciais),
        observacoesProcesso: emptyToNull(processo.obsInternas),
        visibilidade: emptyToNull(publicacao.visibilidade),
        dataInicio: parseDateInput(publicacao.dataInicio),
        dataEncerramento: parseDateInput(publicacao.dataFim),
        canalLinkedIn: !!publicacao.canais?.linkedin,
        canalSiteCarreiras: !!publicacao.canais?.site,
        canalIndicacao: !!publicacao.canais?.indicacao,
        canalPortaisEmprego: !!publicacao.canais?.portalEmprego,
        descricaoPublica: emptyToNull(publicacao.descricaoPublica),
        lgpdSolicitarConsentimentoExplicito: !!lgpd.consentimentoBase,
        lgpdCompartilharCurriculoInternamente: !!lgpd.compartilhamento,
        lgpdRetencaoAtiva: !!lgpd.retencao,
        lgpdRetencaoMeses: parseIntOrNull(lgpd.retencaoMeses),
        exigeCnh: !!docs.cnh,
        disponibilidadeParaViagens: !!docs.disponibilidadeViagens,
        checagemAntecedentes: !!docs.antecedentes,
        beneficios: (remuneracao.beneficios || []).map((b, idx) => ({
          ordem: idx + 1,
          tipo: emptyToNull(b.tipo) || DEFAULT_BENEFICIO_TIPO,
          valor: parseDecimalOrNull(b.valor),
          recorrencia: emptyToNull(b.recorrencia) || DEFAULT_BENEFICIO_REC,
          obrigatorio: !!b.obrigatorio,
          observacoes: emptyToNull(b.obs)
        })),
          requisitos: (v.requisitos || []).map((r, idx) => ({
            ordem: idx + 1,
            categoria: emptyToNull(r.categoria) || getDefaultCategoria(),
            nome: (r.termo || r.nome || "").trim(),
            peso: emptyToNull(r.peso) || DEFAULT_PESO,
            obrigatorio: !!r.obrigatorio,
            anosMinimos: parseIntOrNull(r.anos),
            nivel: emptyToNull(r.nivel),
            avaliacao: emptyToNull(r.avaliacao),
            sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : [],
            observacoes: emptyToNull(r.obs)
          })),
        etapas: (processo.etapas || []).map((e, idx) => ({
          ordem: idx + 1,
          nome: (e.nome || "").trim(),
          responsavel: emptyToNull(e.responsavel) || DEFAULT_ETAPA_RESP,
          modo: emptyToNull(e.modo) || DEFAULT_ETAPA_MODO,
          slaDias: parseIntOrNull(e.slaDias),
          descricaoInstrucoes: emptyToNull(e.descricao)
        })),
        perguntasTriagem: (processo.perguntas || []).map((p, idx) => ({
          ordem: idx + 1,
          texto: (p.pergunta || "").trim(),
          tipo: emptyToNull(p.tipo) || DEFAULT_QUESTION_TIPO,
          peso: emptyToNull(p.peso) || DEFAULT_PESO,
          obrigatoria: !!p.obrigatoria,
          knockout: !!p.knockout,
          opcoesRaw: isMultipleChoiceQuestion(p.tipo) ? joinTagsRaw(p.opcoes || []) : null
        }))
      };
    }

    async function readJsonSafe(res){
      const text = await res.text();
      if(!text) return null;
      try{
        return JSON.parse(text);
      }catch{
        return null;
      }
    }

    async function createVaga(payload){
      const res = await fetch(VAGAS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      if(!res.ok){
        const msg = await res.text();
        throw new Error(msg || `Falha ao criar vaga (${res.status}).`);
      }
      return await readJsonSafe(res);
    }

    async function updateVaga(id, payload){
      const res = await fetch(`${VAGAS_API_URL}/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      if(res.status === 404) return null;
      if(!res.ok){
        const msg = await res.text();
        throw new Error(msg || `Falha ao atualizar vaga (${res.status}).`);
      }
      return await readJsonSafe(res);
    }

    async function persistVagaChange(v, successMessage){
      const payload = buildVagaPayloadFromState(v);
      if(!payload){
        toast("Nao foi possivel salvar as alteracoes.");
        return;
      }

      try{
        const data = await updateVaga(v.id, payload);
        if(data){
          const mapped = mapApiVagaToState(data);
          upsertVagaInState(mapped);
          state.selectedId = mapped.id;
        }
        if(successMessage) toast(successMessage);
      }catch(e){
        console.error("Falha ao persistir vaga:", e);
        toast("Falha ao salvar alteracoes.");
        await syncVagasFromApi();
        renderAreaFilter();
        updateKpis();
        renderList();
        renderDetail();
      }
    }

    async function upsertVagaFromModal(){
      const id = $("#vagaId").value || null;
      const result = buildVagaPayloadFromForm();
      if(result.error){
        toast(result.error);
        return;
      }

      try{
        const data = id
          ? await updateVaga(id, result.payload)
          : await createVaga(result.payload);

        if(!data && id){
          toast("Vaga nao encontrada.");
          return;
        }

        if(data){
          const v = mapApiVagaToState(data);
          upsertVagaInState(v);
          state.selectedId = v.id;
        }

        renderAreaFilter();
        updateKpis();
        renderList();
        renderDetail();

        bootstrap.Modal.getOrCreateInstance($("#modalVaga")).hide();
        toast(id ? "Vaga atualizada." : "Vaga criada.");
      }catch(e){
        console.error("Falha ao salvar vaga:", e);
        toast("Falha ao salvar vaga.");
      }
    }

    async function deleteVaga(id){
      const v = findVaga(id);
      if(!v) return;

      const ok = confirm(`Excluir a vaga "${v.titulo}"?

Isso remove tambem os requisitos.`);
      if(!ok) return;

      try{
        const res = await fetch(`${VAGAS_API_URL}/${id}`, { method: "DELETE" });
        if(res.status === 404){
          toast("Vaga nao encontrada.");
          return;
        }
        if(!res.ok){
          const msg = await res.text();
          throw new Error(msg || `Falha ao excluir vaga (${res.status}).`);
        }

        state.vagas = state.vagas.filter(x => x.id !== id);
        if(state.selectedId === id){
          state.selectedId = state.vagas[0]?.id || null;
        }
        renderAreaFilter();
        updateKpis();
        renderList();
        renderDetail();
        toast("Vaga excluida.");
      }catch(e){
        console.error("Falha ao excluir vaga:", e);
        toast("Falha ao excluir vaga.");
      }
    }

    async function duplicateVaga(id){
      const v = await ensureVagaDetail(id);
      if(!v) return;

      const payload = buildVagaPayloadFromState(v);
      if(!payload){
        toast("Nao foi possivel duplicar a vaga.");
        return;
      }

      const baseCode = payload.codigo ? `${payload.codigo}-COPY` : null;
      const baseTitle = payload.titulo ? `${payload.titulo} (Copia)` : "Copia";
      payload.codigo = baseCode ? baseCode.slice(0, 40) : null;
      payload.titulo = baseTitle.slice(0, 160);

      try{
        const data = await createVaga(payload);
        if(!data) return;
        const created = mapApiVagaToState(data);
        upsertVagaInState(created);
        state.selectedId = created.id;
        renderAreaFilter();
        updateKpis();
        renderList();
        renderDetail();
        toast("Vaga duplicada.");
      }catch(e){
        console.error("Falha ao duplicar vaga:", e);
        toast("Falha ao duplicar vaga.");
      }
    }
    // ========= CRUD: Requisitos
    function openReqModal(mode, vagaId, reqId){
      const v = findVaga(vagaId);
      if(!v) return;

      const modal = bootstrap.Modal.getOrCreateInstance($("#modalReq"));
      const isEdit = mode === "edit";

      $("#modalReqTitle").textContent = isEdit ? "Editar requisito" : "Novo requisito";
      $("#reqId").value = "";

      if(isEdit){
        const r = (v.requisitos || []).find(x => x.id === reqId);
        if(!r) return;

        $("#reqId").value = r.id;
        const selected = r.categoria || getDefaultCategoria();
        renderReqCategoriaOptions(selected);
        $("#reqCategoria").value = selected;
        $("#reqPeso").value = clamp(pesoToNumber(r.peso), 0, 10);
        $("#reqObrigatorio").checked = !!r.obrigatorio;
        $("#reqTermo").value = r.termo || "";
        $("#reqSinonimos").value = (r.sinonimos || []).join(", ");
        $("#reqObs").value = r.obs || "";
      }else{
        const selected = getDefaultCategoria();
        renderReqCategoriaOptions(selected);
        $("#reqCategoria").value = selected;
        $("#reqPeso").value = 7;
        $("#reqObrigatorio").checked = false;
        $("#reqTermo").value = "";
        $("#reqSinonimos").value = "";
        $("#reqObs").value = "";
      }

      // guarda vaga atual no dataset do botão salvar
      $("#btnSaveReq").dataset.vagaId = vagaId;

      modal.show();
    }

    async function saveReqFromModal(){
      const vagaId = $("#btnSaveReq").dataset.vagaId;
      const v = findVaga(vagaId);
      if(!v) return;

      const rid = $("#reqId").value || null;
      const categoria = ($("#reqCategoria").value || "").trim() || getDefaultCategoria();
      const peso = clamp(parseInt($("#reqPeso").value,10)||0, 0, 10);
      const obrigatorio = !!$("#reqObrigatorio").checked;
      const termo = ($("#reqTermo").value || "").trim();
      const sinonimos = ($("#reqSinonimos").value || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      const obs = ($("#reqObs").value || "").trim();

      if(!termo){
        toast("Informe a palavra-chave/termo do requisito.");
        return;
      }

      let message = "Requisito atualizado.";
      if(rid){
        const r = (v.requisitos || []).find(x => x.id === rid);
        if(!r) return;

        r.categoria = categoria;
        r.peso = peso;
        r.obrigatorio = obrigatorio;
        r.termo = termo;
        r.sinonimos = sinonimos;
        r.obs = obs;
      }else{
        v.requisitos = v.requisitos || [];
        v.requisitos.push({
          id: uid(),
          categoria,
          peso,
          obrigatorio,
          termo,
          sinonimos,
          obs
        });
        message = "Requisito adicionado.";
      }

      v.updatedAt = new Date().toISOString();
      renderList();
      renderDetail();
      bootstrap.Modal.getOrCreateInstance($("#modalReq")).hide();
      await persistVagaChange(v, message);
    }

    async function deleteReq(vagaId, reqId){
      const v = findVaga(vagaId);
      if(!v) return;

      const r = (v.requisitos || []).find(x => x.id === reqId);
      if(!r) return;

      const ok = confirm(`Excluir requisito "${r.termo}"?`);
      if(!ok) return;

      v.requisitos = (v.requisitos || []).filter(x => x.id !== reqId);
      v.updatedAt = new Date().toISOString();
      renderList();
      renderDetail();
      await persistVagaChange(v, "Requisito removido.");
    }

    async function toggleReqMandatory(vagaId, reqId){
      const v = findVaga(vagaId);
      if(!v) return;
      const r = (v.requisitos || []).find(x => x.id === reqId);
      if(!r) return;

      r.obrigatorio = !r.obrigatorio;
      v.updatedAt = new Date().toISOString();
      renderList();
      renderDetail();
      await persistVagaChange(v, r.obrigatorio ? "Requisito marcado como obrigatorio." : "Requisito marcado como nao obrigatorio.");
    }

    // ========= Pesos/Threshold
    async function saveWeightsFromDetail(vagaId, fromMobile=false){
      const v = findVaga(vagaId);
      if(!v) return;

      const root = fromMobile ? $("#mobileDetailBody") : $("#detailHost");
      const threshold = clamp(parseInt(root.querySelector("#thresholdRange")?.value || "0",10) || 0, 0, 100);

      const w = {
        competencia: clamp(parseInt(root.querySelector("#w_competencia")?.value || "0",10) || 0, 0, 100),
        experiencia: clamp(parseInt(root.querySelector("#w_experiencia")?.value || "0",10) || 0, 0, 100),
        formacao: clamp(parseInt(root.querySelector("#w_formacao")?.value || "0",10) || 0, 0, 100),
        localidade: clamp(parseInt(root.querySelector("#w_localidade")?.value || "0",10) || 0, 0, 100)
      };

      v.threshold = threshold;
      v.weights = w;
      v.updatedAt = new Date().toISOString();

      renderList();
      renderDetail();
      await persistVagaChange(v, "Pesos e match minimo salvos.");
    }

    // ========= Simulador (keyword match)
function simulateMatch(vagaId, fromMobile=false){
      const v = findVaga(vagaId);
      if(!v) return;

      const root = fromMobile ? $("#mobileDetailBody") : $("#detailHost");
      const area = root.querySelector("#simResult");
      if(!area) return;
      area.replaceChildren();

      const text = normalizeText(root.querySelector("#simText")?.value || "");
      const reqs = v.requisitos || [];

      if(!text){
        const warn = cloneTemplate("tpl-vaga-sim-alert-warning");
        if(warn) area.appendChild(warn);
        return;
      }
      if(!reqs.length){
        const info = cloneTemplate("tpl-vaga-sim-alert-info");
        if(info) area.appendChild(info);
        return;
      }

      const totalPeso = reqs.reduce((acc, r)=> acc + clamp(pesoToNumber(r.peso), 0, 10), 0) || 1;
      let hitPeso = 0;

      const hits = [];
      const missMandatory = [];

      reqs.forEach(r => {
        const termo = normalizeText(r.termo || "");
        const syns = (r.sinonimos || []).map(normalizeText).filter(Boolean);
        const bag = [termo, ...syns].filter(Boolean);

        const found = bag.some(t => t && text.includes(t));
        const p = clamp(pesoToNumber(r.peso), 0, 10);

        if(found){
          hitPeso += p;
          hits.push(r);
        }else if(r.obrigatorio){
          missMandatory.push(r);
        }
      });

      let score = Math.round((hitPeso / totalPeso) * 100);
      if(missMandatory.length){
        score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
      }

      const thr = clamp(parseInt(v.threshold||0,10)||0,0,100);
      const pass = score >= thr;

      const card = cloneTemplate("tpl-vaga-sim-result");
      if(!card) return;

      const badge = card.querySelector('[data-role="sim-badge"]');
      if(badge){
        badge.classList.add(pass ? "text-bg-success" : "text-bg-danger");
      }
      setText(card, "sim-badge-text", pass ? "Dentro" : "Fora");

      const progress = card.querySelector('[data-role="sim-progress"]');
      if(progress) progress.style.width = `${score}%`;
      setText(card, "sim-score", `${score}%`);
      setText(card, "sim-thr", `${thr}%`);
      setText(card, "sim-hits", hits.length);
      setText(card, "sim-miss", missMandatory.length);

      const missBlock = card.querySelector('[data-role="sim-miss-block"]');
      if(missBlock) missBlock.classList.toggle("d-none", !missMandatory.length);
      setText(card, "sim-miss-list", missMandatory.map(r => r.termo).join(", "));
      setText(card, "sim-hit-list", hits.length ? hits.map(r => r.termo).join(", ") : EMPTY_TEXT);

      area.appendChild(card);
    }

    function clearSimulation(fromMobile=false){
      const root = fromMobile ? $("#mobileDetailBody") : $("#detailHost");
      const ta = root.querySelector("#simText");
      const res = root.querySelector("#simResult");
      if(ta) ta.value = "";
      if(res) res.replaceChildren();
    }

    // ========= Import/Export
    function exportJson(){
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        vagas: state.vagas
      };
      const json = JSON.stringify(payload, null, 2);
      // download client-side
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "vagas_mvp_liotecnica.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Exportação iniciada.");
    }

    function importJson(){
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/json";
      inp.onchange = () => {
        const file = inp.files && inp.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = () => {
          try{
            const data = JSON.parse(reader.result);
            if(!data || !Array.isArray(data.vagas)) throw new Error("Formato inválido.");
            // validação simples
            state.vagas = data.vagas.map(v => {
              const meta = v.meta || {};
              const jornada = v.jornada || {};
              const local = jornada.local || {};
              const remuneracao = v.remuneracao || {};
              const requisitosExtras = v.requisitosExtras || {};
              const processo = v.processo || {};
              const publicacao = v.publicacao || {};
              const compliance = v.compliance || {};
              const diversidade = compliance.diversidade || {};
              const lgpd = compliance.lgpd || {};
              const docs = compliance.docs || {};
              const cidade = (v.cidade || local.cidade || "").trim();
              const uf = (v.uf || local.uf || "").trim().toUpperCase().slice(0,2);

              return {
                id: v.id || uid(),
                codigo: v.codigo || "",
                titulo: v.titulo || "",
                area: v.area || "",
                modalidade: v.modalidade || DEFAULT_MODALIDADE,
                status: v.status || DEFAULT_STATUS,
                cidade,
                uf,
                senioridade: v.senioridade || DEFAULT_SENIORIDADE,
                threshold: clamp(parseInt(v.threshold ?? 70,10)||70,0,100),
                descricao: v.descricao || "",
                createdAt: v.createdAt || new Date().toISOString(),
                updatedAt: v.updatedAt || new Date().toISOString(),
                weights: v.weights || { competencia:40, experiencia:30, formacao:15, localidade:15 },
                requisitos: Array.isArray(v.requisitos) ? v.requisitos.map(r => ({
                  id: r.id || uid(),
                  categoria: r.categoria || getDefaultCategoria(),
                  termo: r.termo || "",
                  peso: clamp(parseInt(r.peso ?? 0,10)||0,0,10),
                  obrigatorio: !!r.obrigatorio,
                  sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : [],
                  obs: r.obs || ""
                })) : [],
                meta: {
                  departamento: meta.departamento || DEFAULT_DEPARTAMENTO,
                  areaTime: meta.areaTime || DEFAULT_AREA_TIME,
                  quantidade: parseInt(meta.quantidade ?? 1, 10) || 1,
                  tipoContratacao: meta.tipoContratacao || DEFAULT_TIPO_CONTRATACAO,
                  codigoInterno: meta.codigoInterno || "",
                  cbo: meta.cbo || "",
                  gestorRequisitante: meta.gestorRequisitante || "",
                  recrutador: meta.recrutador || "",
                  motivoAbertura: meta.motivoAbertura || DEFAULT_MOTIVO,
                  orcamentoAprovado: meta.orcamentoAprovado || DEFAULT_ORCAMENTO,
                  prioridade: meta.prioridade || DEFAULT_PRIORIDADE,
                  resumo: meta.resumo || "",
                  tagsResponsabilidades: Array.isArray(meta.tagsResponsabilidades) ? meta.tagsResponsabilidades : [],
                  tagsKeywords: Array.isArray(meta.tagsKeywords) ? meta.tagsKeywords : [],
                  confidencial: !!meta.confidencial,
                  aceitaPcd: !!meta.aceitaPcd,
                  urgente: !!meta.urgente,
                  projeto: {
                    nome: meta.projeto?.nome || "",
                    cliente: meta.projeto?.cliente || "",
                    prazo: meta.projeto?.prazo || "",
                    descricao: meta.projeto?.descricao || ""
                  },
                  pcdObs: meta.pcdObs || ""
                },
                jornada: {
                  regime: jornada.regime || DEFAULT_REGIME,
                  cargaSemanal: jornada.cargaSemanal || "",
                  horaEntrada: jornada.horaEntrada || "",
                  horaSaida: jornada.horaSaida || "",
                  intervalo: jornada.intervalo || "",
                  escala: jornada.escala || DEFAULT_ESCALA,
                  local: {
                    cep: local.cep || "",
                    logradouro: local.logradouro || "",
                    numero: local.numero || "",
                    bairro: local.bairro || "",
                    cidade,
                    uf,
                    politicaTrabalho: local.politicaTrabalho || "",
                    deslocamentoObs: local.deslocamentoObs || ""
                  }
                },
                remuneracao: {
                  moeda: remuneracao.moeda || DEFAULT_MOEDA,
                  salarioMin: remuneracao.salarioMin || "",
                  salarioMax: remuneracao.salarioMax || "",
                  periodicidade: remuneracao.periodicidade || DEFAULT_REMUN_PERIOD,
                  bonusTipo: remuneracao.bonusTipo || DEFAULT_BONUS,
                  percentual: remuneracao.percentual || "",
                  obs: remuneracao.obs || "",
                  beneficios: Array.isArray(remuneracao.beneficios) ? remuneracao.beneficios.map(b => ({
                    tipo: b.tipo || DEFAULT_BENEFICIO_TIPO,
                    valor: b.valor || "",
                    recorrencia: b.recorrencia || DEFAULT_BENEFICIO_REC,
                    obrigatorio: !!b.obrigatorio,
                    obs: b.obs || ""
                  })) : []
                },
                requisitosExtras: {
                  escolaridade: requisitosExtras.escolaridade || DEFAULT_ESCOLARIDADE,
                  formacaoArea: requisitosExtras.formacaoArea || DEFAULT_FORMACAO,
                  expMinAnos: requisitosExtras.expMinAnos || "",
                  tagsStack: Array.isArray(requisitosExtras.tagsStack) ? requisitosExtras.tagsStack : [],
                  tagsIdiomas: Array.isArray(requisitosExtras.tagsIdiomas) ? requisitosExtras.tagsIdiomas : [],
                  diferenciais: requisitosExtras.diferenciais || "",
                  requisitosDetalhados: Array.isArray(requisitosExtras.requisitosDetalhados) ? requisitosExtras.requisitosDetalhados.map(r => ({
                    categoria: r.categoria || getDefaultCategoria(),
                    nome: r.nome || "",
                    peso: parseInt(r.peso ?? DEFAULT_PESO, 10) || parseInt(DEFAULT_PESO, 10),
                    obrigatorio: !!r.obrigatorio,
                    anos: r.anos || "",
                    nivel: r.nivel || DEFAULT_REQ_NIVEL,
                    avaliacao: r.avaliacao || DEFAULT_REQ_AVALIACAO,
                    obs: r.obs || ""
                  })) : []
                },
                processo: {
                  etapas: Array.isArray(processo.etapas) ? processo.etapas.map(e => ({
                    nome: e.nome || "",
                    responsavel: e.responsavel || DEFAULT_ETAPA_RESP,
                    modo: e.modo || DEFAULT_ETAPA_MODO,
                    slaDias: e.slaDias || "",
                    descricao: e.descricao || ""
                  })) : [],
                  perguntas: Array.isArray(processo.perguntas) ? processo.perguntas.map(p => ({
                    pergunta: p.pergunta || "",
                    tipo: p.tipo || DEFAULT_QUESTION_TIPO,
                    peso: parseInt(p.peso ?? DEFAULT_PESO, 10) || parseInt(DEFAULT_PESO, 10),
                    obrigatoria: !!p.obrigatoria,
                    knockout: !!p.knockout,
                    opcoes: Array.isArray(p.opcoes) ? p.opcoes : []
                  })) : [],
                  obsInternas: processo.obsInternas || ""
                },
                publicacao: {
                  visibilidade: publicacao.visibilidade || DEFAULT_PUBLICACAO,
                  dataInicio: publicacao.dataInicio || "",
                  dataFim: publicacao.dataFim || "",
                  canais: {
                    linkedin: !!publicacao.canais?.linkedin,
                    site: !!publicacao.canais?.site,
                    indicacao: !!publicacao.canais?.indicacao,
                    portalEmprego: !!publicacao.canais?.portalEmprego
                  },
                  descricaoPublica: publicacao.descricaoPublica || ""
                },
                compliance: {
                  diversidade: {
                    generoPreferencia: diversidade.generoPreferencia || DEFAULT_GENERO,
                    vagaAfirmativa: !!diversidade.vagaAfirmativa,
                    linguagemInclusiva: !!diversidade.linguagemInclusiva,
                    publicoAfirmativo: diversidade.publicoAfirmativo || ""
                  },
                  lgpd: {
                    consentimentoBase: !!lgpd.consentimentoBase,
                    compartilhamento: !!lgpd.compartilhamento,
                    retencao: !!lgpd.retencao,
                    retencaoMeses: lgpd.retencaoMeses || ""
                  },
                  docs: {
                    cnh: !!docs.cnh,
                    disponibilidadeViagens: !!docs.disponibilidadeViagens,
                    antecedentes: !!docs.antecedentes
                  }
                }
              };
            });

            state.selectedId = state.vagas[0]?.id || null;
            renderAreaFilter();
            updateKpis();
            renderList();
            renderDetail();
            toast("Importação concluí­da.");
          }catch(e){
            console.error(e);
            alert("Falha ao importar JSON. Verifique o arquivo.");
          }
        };
        reader.readAsText(file);
      };
      inp.click();
    }

    // ========= Init + bindings
    function wireClock(){
      const label = $("#nowLabel");
      if(!label) return;
      const tick = () => {
        const d = new Date();
        label.textContent = d.toLocaleString("pt-BR", {
          weekday:"short", day:"2-digit", month:"2-digit",
          hour:"2-digit", minute:"2-digit"
        });
      };
      tick();
      setInterval(tick, 1000 * 15);
    }

    function wireFilters(){
      const apply = () => {
        state.filters.q = ($("#fSearch").value || "").trim();
        state.filters.status = $("#fStatus").value || "all";
        state.filters.area = $("#fArea").value || "all";
        renderList();
      };

      $("#fSearch").addEventListener("input", apply);
      $("#fStatus").addEventListener("change", apply);
      $("#fArea").addEventListener("change", apply);

      $("#globalSearch").addEventListener("input", () => {
        $("#fSearch").value = $("#globalSearch").value;
        apply();
      });
    }

    function wireButtons(){
      $("#btnNewVaga").addEventListener("click", () => void openVagaModal("new"));
      $("#btnSaveVaga").addEventListener("click", () => void upsertVagaFromModal());
      $("#btnSaveReq").addEventListener("click", saveReqFromModal);
      $("#btnAddBenefit").addEventListener("click", () => {
        const host = $("#vagaBenefitsList");
        const row = buildBenefitRow(newBenefit());
        if(host && row) host.appendChild(row);
      });
      $("#btnAddVagaReq").addEventListener("click", () => {
        const host = $("#vagaReqList");
        const row = buildModalReqRow(newModalReq());
        if(host && row) host.appendChild(row);
      });
      $("#btnAddVagaEtapa").addEventListener("click", () => {
        const host = $("#vagaEtapasList");
        const row = buildStageRow(newStage());
        if(host && row) host.appendChild(row);
      });
      $("#btnAddVagaPergunta").addEventListener("click", () => {
        const host = $("#vagaPerguntasList");
        const row = buildQuestionRow(newQuestion());
        if(host && row) host.appendChild(row);
      });

      $("#btnExportJson").addEventListener("click", exportJson);
      $("#btnImportJson").addEventListener("click", importJson);
    }

    function initLogo(){
      $("#logoDesktop").src = LOGO_DATA_URI;
      $("#logoMobile").src = LOGO_DATA_URI;
    }

    async function openDetailFromQuery(){
      const params = new URLSearchParams(window.location.search);
      const vagaId = params.get("vagaId");
      const open = params.get("open");
      if(!vagaId) return;

      const v = await ensureVagaDetail(vagaId);
      if(!v) return;

      if(open === "detail"){
        await openDetailModal(vagaId);
      }else{
        selectVaga(vagaId);
      }
    }


async function fetchVagaById(id) {
    const res = await fetch(`${VAGAS_API_URL}/${id}`, { headers: { "Accept": "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Falha ao buscar vaga: ${res.status}`);
    const data = await res.json();
    return data ? mapApiVagaToState(data) : null;
}

async function syncVagasFromApi() {
    const res = await fetch(VAGAS_API_URL, { headers: { "Accept": "application/json" } });
    if (!res.ok) throw new Error(`Falha ao buscar vagas: ${res.status}`);

    const apiList = await res.json();
    const list = Array.isArray(apiList) ? apiList : (apiList?.items ?? []);

    // se você já tem mapApiVagaToState, use aqui
    state.vagas = list.map(mapApiVagaToState);

    state.selectedId = state.vagas[0]?.id || null;
}

(async function init() {
    initLogo();
    wireClock();

    try {
        await syncVagaEnumsFromApi();
        await syncAreasFromApi();
        await syncDepartmentsFromApi();
        await syncVagasFromApi();
    } catch (e) {
        console.error("Falha ao carregar vagas da API:", e);
        state.vagas = [];
        state.selectedId = null;
    }

    renderAreaFilter();
    updateKpis();
    renderList();
    renderDetail();

    wireFilters();
    wireButtons();
    await openDetailFromQuery();
})();







