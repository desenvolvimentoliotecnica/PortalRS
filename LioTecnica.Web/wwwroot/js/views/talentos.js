const TALENTOS_API_BASE = "/Talentos/_api";
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const CANDIDATOS_API_URL = "/api/candidatos";

let _talSuggestedDataPayload = null;

const state = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  filters: { q: "", origem: "" },
  vagas: [],
  cadastroCandidatoTalento: null,
  editingTalentoId: null,
  editingTalentoData: null,
  detailTalentoData: null,
  lastImportPdfData: null,
  pendingCreatePayload: null,
  similarConflict: null
};

function apiFetchJson(url, opts) {
  return fetch(url, {
    headers: { "Accept": "application/json", ...(opts?.headers || {}) },
    ...opts
  }).then(async (res) => {
    const contentType = res.headers.get("content-type") || "";
    let bodyText = "";
    let bodyJson = null;
    try { bodyText = await res.text(); } catch { bodyText = ""; }
    if (bodyText && contentType.includes("application/json")) {
      try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = null; }
    }
    if (res.status === 204) return null;
    if (!res.ok) {
      const msg = bodyJson?.message || bodyJson?.title || (bodyText ? bodyText.slice(0, 300) : "") || `Erro HTTP ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    if (contentType.includes("application/json")) {
      try { return bodyJson ?? JSON.parse(bodyText || "null"); } catch { return null; }
    }
    return bodyText || null;
  });
}

function buildListUrl() {
  const params = new URLSearchParams();
  params.set("page", String(state.page));
  params.set("pageSize", String(state.pageSize));
  if (state.filters.q) params.set("q", state.filters.q);
  if (state.filters.origem) params.set("origem", state.filters.origem);
  return `${TALENTOS_API_BASE}/list?${params.toString()}`;
}

function mapOrigem(origem) {
  const o = String(origem || "").toLowerCase();
  const map = { email: "Email", site: "Site", candidatura: "Candidatura", pasta: "Pasta", manual: "Manual" };
  return map[o] || origem || "-";
}

function mapCvImportStatus(status) {
  if (status == null || status === undefined) return "-";
  // API serializa enum como string (JsonStringEnumConverter); aceitar número ou string
  const byNumber = {
    0: "Pendente",
    1: "Em processamento",
    2: "Pendente de validação",
    3: "Concluído"
  };
  const byString = {
    Pendente: "Pendente",
    EmProcessamento: "Em processamento",
    PendenteValidacao: "Pendente de validação",
    Concluido: "Concluído"
  };
  if (typeof status === "number") return byNumber[status] ?? "-";
  return byString[String(status)] ?? byNumber[status] ?? "-";
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso || "-"; }
}

async function loadTalentos() {
  const url = buildListUrl();
  const data = await apiFetchJson(url, { method: "GET" });
  state.items = data?.items ?? [];
  state.totalCount = data?.totalCount ?? 0;
  state.page = data?.page ?? state.page;
  state.pageSize = data?.pageSize ?? state.pageSize;
  renderList();
  renderPagination();
}

function renderList() {
  const tbody = document.getElementById("talentosTbody");
  const tplRow = document.getElementById("tpl-talento-row");
  const tplEmpty = document.getElementById("tpl-talento-empty");
  if (!tbody || !tplRow) return;

  tbody.innerHTML = "";

  if (state.items.length === 0) {
    if (tplEmpty) {
      const row = tplEmpty.content.cloneNode(true);
      tbody.appendChild(row);
    }
  } else {
    state.items.forEach((item) => {
      const row = tplRow.content.cloneNode(true);
      row.querySelector("[data-role=nome]").textContent = item.nome ?? "-";
      row.querySelector("[data-role=email]").textContent = item.email ?? "-";
      row.querySelector("[data-role=fone]").textContent = item.fone ?? "-";
      row.querySelector("[data-role=cpf]").textContent = item.cpf ?? "-";
      row.querySelector("[data-role=cidadeUf]").textContent = [item.cidade, item.uf].filter(Boolean).join(" / ") || "-";
      row.querySelector("[data-role=origem]").textContent = mapOrigem(item.origem);
      row.querySelector("[data-role=cvImportStatus]").textContent = mapCvImportStatus(item.cvImportStatus);
      row.querySelector("[data-role=createdAt]").textContent = formatDate(item.createdAtUtc);
      row.querySelector("[data-role=updatedAt]").textContent = formatDate(item.updatedAtUtc);
      row.querySelector("[data-role=versao]").textContent = item.versao != null ? String(item.versao) : "-";
      row.querySelector("[data-act=cadastrar-candidato]").addEventListener("click", (e) => { e.stopPropagation(); openModalCadastrarCandidato(item); });
      row.querySelector("[data-act=bloqueio]").addEventListener("click", (e) => { e.stopPropagation(); sendToBloqueioTalento(item.id); });
      row.querySelector("[data-act=detail]").addEventListener("click", (e) => { e.stopPropagation(); openModalDetalheTalento(item.id); });
      row.querySelector("[data-act=edit]").addEventListener("click", (e) => { e.stopPropagation(); openModalEditarTalento(item.id); });
      row.querySelector("[data-act=del]").addEventListener("click", (e) => { e.stopPropagation(); eliminarTalento(item.id, item.nome); });
      tbody.appendChild(row);
    });
  }

  const hintEl = document.getElementById("talentosHint");
  const countEl = document.getElementById("talentosCount");
  if (hintEl) hintEl.textContent = `Total: ${state.totalCount}`;
  if (countEl) countEl.textContent = String(state.items.length);
}

function renderPagination() {
  const wrap = document.getElementById("paginationWrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  const total = Number(state.totalCount || 0);
  const pageSize = Math.max(1, Number(state.pageSize || 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Number(state.page || 1)), totalPages);

  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "btn btn-ghost btn-sm";
  prevBtn.innerHTML = '<i class="bi bi-chevron-left"></i>';
  prevBtn.title = "Página anterior";
  prevBtn.disabled = page <= 1;
  prevBtn.addEventListener("click", () => goToPage(page - 1));
  wrap.appendChild(prevBtn);

  const pageLabel = document.createElement("span");
  pageLabel.className = "small text-muted ms-1 me-1";
  pageLabel.textContent = `${page} / ${totalPages}`;
  wrap.appendChild(pageLabel);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-ghost btn-sm";
  nextBtn.innerHTML = '<i class="bi bi-chevron-right"></i>';
  nextBtn.title = "Próxima página";
  nextBtn.disabled = page >= totalPages;
  nextBtn.addEventListener("click", () => goToPage(page + 1));
  wrap.appendChild(nextBtn);
}

async function goToPage(page) {
  const total = Number(state.totalCount || 0);
  const pageSize = Math.max(1, Number(state.pageSize || 20));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page < 1 || page > totalPages || page === state.page) return;
  state.page = page;
  await loadTalentos();
}

const BLOQUEIO_PESSOA_API = "/api/bloqueio-pessoa";

async function eliminarTalento(id, nome) {
  if (!confirm(`Eliminar o talento "${nome || "este registro"}"? A pessoa vinculada não será removida.`)) return;
  try {
    const res = await fetch(`${TALENTOS_API_BASE}/${id}`, { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      toast("Talento eliminado.");
      loadTalentos();
    } else {
      const data = await res.json().catch(() => ({}));
      toast(data?.message || "Falha ao eliminar talento.");
    }
  } catch (e) {
    toast(e?.message || "Erro ao eliminar talento.");
  }
}

async function sendToBloqueioTalento(id) {
  const item = state.items.find((t) => t.id === id);
  if (!item) return;
  const ok = confirm(`Enviar "${item.nome}" para Bloqueio de pessoa (blacklist)?`);
  if (!ok) return;
  try {
    await apiFetchJson(`${BLOQUEIO_PESSOA_API}/from-talento/${id}`, { method: "POST" });
    toast("Pessoa enviada para Bloqueio de pessoa.");
  } catch (err) {
    console.error(err);
    toast(err?.message || "Falha ao enviar para Bloqueio de pessoa.");
  }
}

function openDetail(id) {
  window.location.href = `/Talentos?_id=${id}`;
}

function toast(msg) {
  const el = document.getElementById("toastMessage") || document.querySelector("[data-toast-message]");
  if (el) {
    el.textContent = msg;
    const toast = document.querySelector(".toast");
    if (toast && window.bootstrap) {
      const t = new bootstrap.Toast(toast);
      t.show();
    }
  } else {
    try { window.toast?.(); } catch { }
    console.info(msg);
  }
}

async function loadVagas() {
  try {
    const data = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
    state.vagas = Array.isArray(data) ? data : (data?.items ?? []);
  } catch {
    state.vagas = [];
  }
}

function openModalCadastrarCandidato(talento) {
  state.cadastroCandidatoTalento = talento;
  const modalEl = document.getElementById("modalCadastrarCandidato");
  const selectVaga = document.getElementById("cadastroCandidatoVaga");
  const obsEl = document.getElementById("cadastroCandidatoObs");
  if (!modalEl || !selectVaga) return;

  selectVaga.innerHTML = '<option value="">Carregando...</option>';
  selectVaga.value = "";
  if (obsEl) obsEl.value = "";

  loadVagas().then(() => {
    selectVaga.innerHTML = '<option value="">Selecione a vaga</option>';
    state.vagas.forEach((v) => {
      const id = v.id ?? v.Id;
      const titulo = (v.titulo ?? v.titulo ?? v.Titulo ?? "").trim() || "(sem título)";
      const codigo = (v.codigo ?? v.Codigo ?? "").trim();
      const opt = document.createElement("option");
      opt.value = id || "";
      opt.textContent = codigo ? `${codigo} — ${titulo}` : titulo;
      selectVaga.appendChild(opt);
    });
  });

  if (window.bootstrap && bootstrap.Modal) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function bindModalCadastrarCandidato() {
  const modalEl = document.getElementById("modalCadastrarCandidato");
  const btnConfirm = document.getElementById("btnConfirmarCadastroCandidato");
  const selectVaga = document.getElementById("cadastroCandidatoVaga");
  const obsEl = document.getElementById("cadastroCandidatoObs");

  if (!btnConfirm || !selectVaga) return;

  btnConfirm.addEventListener("click", async () => {
    const vagaId = (selectVaga?.value ?? "").trim();
    if (!vagaId) {
      toast("Selecione uma vaga.");
      return;
    }
    const t = state.cadastroCandidatoTalento;
    if (!t) {
      toast("Nenhum talento selecionado.");
      return;
    }

    const body = {
      nome: t.nome ?? "",
      email: t.email ?? "",
      fone: t.fone ?? null,
      cidade: t.cidade ?? null,
      uf: t.uf ?? null,
      fonte: "Indicacao",
      status: "Novo",
      vagaId: vagaId,
      obs: (obsEl?.value ?? "").trim() || null,
      talentoId: t.id ?? null
    };

    try {
      const res = await fetch(CANDIDATOS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast(err?.message || `Falha ao cadastrar (${res.status}).`);
        return;
      }
      toast("Candidato cadastrado com sucesso.");
      if (window.bootstrap && modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      state.cadastroCandidatoTalento = null;
    } catch (e) {
      toast(e?.message || "Erro ao cadastrar candidato.");
    }
  });
}

function openModalSelecionarTalento() {
  if (state.items.length === 0) {
    toast("Nenhum talento na lista. Adicione talentos pela Entrada de Email/Pasta ou ajuste os filtros.");
    return;
  }
  const modalEl = document.getElementById("modalSelecionarTalento");
  const selectEl = document.getElementById("selecionarTalentoDropdown");
  if (!modalEl || !selectEl) return;

  selectEl.innerHTML = '<option value="">-- Selecione --</option>';
  state.items.forEach((t) => {
    const opt = document.createElement("option");
    opt.value = t.id ?? "";
    opt.textContent = [t.nome, t.email].filter(Boolean).join(" — ") || "(sem nome)";
    selectEl.appendChild(opt);
  });
  selectEl.value = "";

  if (window.bootstrap && bootstrap.Modal) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function bindTopCadastrarCandidato() {
  const btnTop = document.getElementById("btnCadastrarCandidatoTop");
  const modalSelecionar = document.getElementById("modalSelecionarTalento");
  const selectTalento = document.getElementById("selecionarTalentoDropdown");
  const btnContinuar = document.getElementById("btnContinuarSelecaoTalento");

  if (!btnTop) return;
  btnTop.addEventListener("click", () => openModalSelecionarTalento());

  if (btnContinuar && selectTalento) {
    btnContinuar.addEventListener("click", () => {
      const id = (selectTalento?.value ?? "").trim();
      if (!id) {
        toast("Selecione um talento.");
        return;
      }
      const talento = state.items.find((t) => (t.id ?? String(t.id)) === id);
      if (!talento) {
        toast("Talento não encontrado.");
        return;
      }
      if (window.bootstrap && modalSelecionar) {
        const modal = bootstrap.Modal.getInstance(modalSelecionar);
        if (modal) modal.hide();
      }
      openModalCadastrarCandidato(talento);
    });
  }
}

function bindFilters() {
  const fSearch = document.getElementById("fSearch");
  const fOrigem = document.getElementById("fOrigem");
  const btnRefresh = document.getElementById("btnRefreshTalentos");

  function applyAndLoad() {
    state.filters.q = (fSearch?.value ?? "").trim();
    state.filters.origem = (fOrigem?.value ?? "").trim();
    state.page = 1;
    loadTalentos();
  }

  if (fSearch) {
    fSearch.addEventListener("input", () => { state.filters.q = fSearch.value.trim(); state.page = 1; });
    fSearch.addEventListener("keydown", (e) => { if (e.key === "Enter") applyAndLoad(); });
  }
  if (fOrigem) fOrigem.addEventListener("change", applyAndLoad);
  if (btnRefresh) btnRefresh.addEventListener("click", () => loadTalentos());

  const searchTop = document.getElementById("talentosSearch");
  if (searchTop) {
    searchTop.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        state.filters.q = searchTop.value.trim();
        state.page = 1;
        if (fSearch) fSearch.value = state.filters.q;
        loadTalentos();
      }
    });
  }
}

function openModalNovoTalento() {
  state.editingTalentoId = null;
  state.editingTalentoData = null;
  const modalEl = document.getElementById("modalNovoTalento");
  const title = modalEl?.querySelector(".modal-title");
  if (title) title.textContent = "Novo talento";
  const similarBox = document.getElementById("novoTalentoSimilarBox");
  if (similarBox) similarBox.style.display = "none";
  ["novoTalentoNome", "novoTalentoEmail", "novoTalentoFone", "novoTalentoCidade", "novoTalentoUf", "novoTalentoCpf", "novoTalentoDataNascimento", "novoTalentoCep", "novoTalentoLogradouro", "novoTalentoNumero", "novoTalentoBairro", "novoTalentoLinkedin", "novoTalentoResumo", "novoTalentoObs", "novoTalentoOrigem"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const orig = document.getElementById("novoTalentoOrigem");
  if (orig) orig.value = "Manual";
  if (window.bootstrap && modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

async function openModalEditarTalento(id) {
  try {
    const data = await apiFetchJson(`${TALENTOS_API_BASE}/${id}`, { method: "GET" });
    if (!data) { toast("Talento não encontrado."); return; }
    // #region agent log
    const expLen = (data.experiencias ?? data.Experiencias)?.length ?? -1;
    const treinLen = (data.treinamentos ?? data.Treinamentos)?.length ?? -1;
    const compLen = (data.competencias ?? data.Competencias)?.length ?? -1;
    const formLen = (data.formacao ?? data.Formacao)?.length ?? -1;
    fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'talentos.js:openModalEditarTalento',message:'GET talento response',data:{id,keys:Object.keys(data),experienciasLen:expLen,treinamentosLen:treinLen,competenciasLen:compLen,formacaoLen:formLen},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H1-H2'})}).catch(()=>{});
    // #endregion
    state.editingTalentoId = id;
    state.editingTalentoData = data;
    const modalEl = document.getElementById("modalNovoTalento");
    const title = modalEl?.querySelector(".modal-title");
    if (title) title.textContent = "Editar talento";
    const set = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v ?? ""; };
    set("novoTalentoNome", data.nome);
    set("novoTalentoEmail", data.email);
    set("novoTalentoFone", data.fone);
    set("novoTalentoCidade", data.cidade);
    set("novoTalentoUf", data.uf);
    set("novoTalentoCpf", data.cpf);
    const dataNascEl = document.getElementById("novoTalentoDataNascimento");
    if (dataNascEl && data.dataNascimento) {
      try {
        const d = new Date(data.dataNascimento);
        dataNascEl.value = d.toISOString().slice(0, 10);
      } catch { dataNascEl.value = ""; }
    } else if (dataNascEl) dataNascEl.value = "";
    set("novoTalentoCep", data.cep);
    set("novoTalentoLogradouro", data.logradouro);
    set("novoTalentoNumero", data.numero);
    set("novoTalentoBairro", data.bairro);
    set("novoTalentoLinkedin", data.linkedinUrl);
    set("novoTalentoResumo", data.resumoProfissional);
    set("novoTalentoObs", data.obs);
    set("novoTalentoOrigem", data.origem ?? "Manual");
    if (window.bootstrap && modalEl) {
      const modal = new bootstrap.Modal(modalEl);
      modal.show();
    }
  } catch (e) {
    toast(e?.message || "Erro ao carregar talento.");
  }
}

function bindNovoTalento() {
  const btnNovo = document.getElementById("btnNovoTalento");
  const btnConfirm = document.getElementById("btnConfirmarNovoTalento");
  const modalEl = document.getElementById("modalNovoTalento");
  if (!btnNovo || !btnConfirm) return;

  btnNovo.addEventListener("click", () => openModalNovoTalento());

  btnConfirm.addEventListener("click", async () => {
    const nome = (document.getElementById("novoTalentoNome")?.value ?? "").trim();
    const email = (document.getElementById("novoTalentoEmail")?.value ?? "").trim().toLowerCase();
    if (!nome || !email) {
      toast("Nome e email são obrigatórios.");
      return;
    }
    const existing = state.editingTalentoData;
    const dataNascVal = (document.getElementById("novoTalentoDataNascimento")?.value ?? "").trim();
    const compSource = existing?.competencias ?? existing?.Competencias ?? [];
    var competenciasPayload = compSource.map(function (c) {
      const r = c || {};
      return {
        id: r.id ?? null,
        tipo: r.tipo ?? r.Tipo ?? "",
        nome: r.nome ?? r.Nome ?? "",
        nivel: r.nivel ?? r.Nivel ?? "",
        tempoAtuacao: (r.tempoAtuacao ?? r.TempoAtuacao) != null ? String(r.tempoAtuacao ?? r.TempoAtuacao).trim() || null : null,
        evidencia: (r.evidencia ?? r.Evidencia) != null ? String(r.evidencia ?? r.Evidencia).trim() || null : null
      };
    });
    const expSource = existing?.experiencias ?? existing?.Experiencias ?? [];
    const treinSource = existing?.treinamentos ?? existing?.Treinamentos ?? [];
    const formSource = existing?.formacao ?? existing?.Formacao ?? [];
    const payload = {
      nome,
      email,
      fone: (document.getElementById("novoTalentoFone")?.value ?? "").trim() || null,
      cidade: (document.getElementById("novoTalentoCidade")?.value ?? "").trim() || null,
      uf: (document.getElementById("novoTalentoUf")?.value ?? "").trim() || null,
      linkedinUrl: (document.getElementById("novoTalentoLinkedin")?.value ?? "").trim() || null,
      resumoProfissional: (document.getElementById("novoTalentoResumo")?.value ?? "").trim() || null,
      obs: (document.getElementById("novoTalentoObs")?.value ?? "").trim() || null,
      origem: (document.getElementById("novoTalentoOrigem")?.value ?? "Manual").trim(),
      cpf: (document.getElementById("novoTalentoCpf")?.value ?? "").trim() || null,
      dataNascimento: dataNascVal ? dataNascVal + "T12:00:00Z" : null,
      cep: (document.getElementById("novoTalentoCep")?.value ?? "").trim() || null,
      logradouro: (document.getElementById("novoTalentoLogradouro")?.value ?? "").trim() || null,
      numero: (document.getElementById("novoTalentoNumero")?.value ?? "").trim() || null,
      bairro: (document.getElementById("novoTalentoBairro")?.value ?? "").trim() || null,
      forceCreate: false,
      competencias: competenciasPayload,
      experiencias: Array.isArray(expSource) ? expSource : [],
      treinamentos: Array.isArray(treinSource) ? treinSource : [],
      formacao: Array.isArray(formSource) ? formSource : []
    };
    const isEdit = state.editingTalentoId != null;
    // #region agent log
    const expPayloadLen = payload.experiencias?.length ?? -1;
    const treinPayloadLen = payload.treinamentos?.length ?? -1;
    fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'talentos.js:bindNovoTalento-confirm',message:'PUT payload (modal Editar)',data:{isEdit,existingKeys:existing?Object.keys(existing):null,experienciasLen:expPayloadLen,treinamentosLen:treinPayloadLen},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    const url = isEdit ? `${TALENTOS_API_BASE}/${state.editingTalentoId}` : TALENTOS_API_BASE;
    const method = isEdit ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && body.similarFound) {
          state.pendingCreatePayload = { ...payload, forceCreate: true };
          state.similarConflict = { similarTalentoId: body.similarTalentoId, similarPessoaSummary: body.similarPessoaSummary };
          const similarBox = document.getElementById("novoTalentoSimilarBox");
          const similarText = document.getElementById("novoTalentoSimilarText");
          if (similarBox && similarText) {
            const s = body.similarPessoaSummary || {};
            similarText.textContent = `Encontramos um cadastro similar: ${s.nome || "-"}${s.email ? ", " + s.email : ""}. Abrir cadastro existente ou criar mesmo assim?`;
            similarBox.style.display = "block";
          }
          return;
        }
        toast(body?.message || `Falha ao ${isEdit ? "atualizar" : "criar"} talento (${res.status}).`);
        return;
      }
      toast(isEdit ? "Talento atualizado com sucesso." : "Talento criado com sucesso.");
      if (window.bootstrap && modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      state.editingTalentoId = null;
      state.editingTalentoData = null;
      state.pendingCreatePayload = null;
      state.similarConflict = null;
      loadTalentos();
    } catch (e) {
      toast(e?.message || (isEdit ? "Erro ao atualizar talento." : "Erro ao criar talento."));
    }
  });

  const btnAbrirExistente = document.getElementById("btnNovoTalentoAbrirExistente");
  const btnCriarMesmo = document.getElementById("btnNovoTalentoCriarMesmo");
  if (btnAbrirExistente) {
    btnAbrirExistente.addEventListener("click", () => {
      const conflict = state.similarConflict;
      const similarBox = document.getElementById("novoTalentoSimilarBox");
      if (similarBox) similarBox.style.display = "none";
      state.pendingCreatePayload = null;
      state.similarConflict = null;
      if (window.bootstrap && modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      if (conflict?.similarTalentoId) openModalEditarTalento(conflict.similarTalentoId);
    });
  }
  if (btnCriarMesmo) {
    btnCriarMesmo.addEventListener("click", async () => {
      const payload = state.pendingCreatePayload;
      if (!payload) return;
      const similarBox = document.getElementById("novoTalentoSimilarBox");
      if (similarBox) similarBox.style.display = "none";
      try {
        const res = await fetch(TALENTOS_API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(data?.message || "Falha ao criar talento.");
          return;
        }
        toast("Talento criado com sucesso.");
        state.pendingCreatePayload = null;
        state.similarConflict = null;
        if (window.bootstrap && modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        loadTalentos();
        if (data?.id) openModalDetalheTalento(data.id);
      } catch (e) {
        toast(e?.message || "Erro ao criar talento.");
      }
    });
  }
}

function openModalImportarPdf() {
  const modalEl = document.getElementById("modalImportarPdf");
  const fileInput = document.getElementById("importPdfArquivo");
  const resultEl = document.getElementById("importPdfResult");
  const similarBox = document.getElementById("importPdfSimilarBox");
  if (fileInput) fileInput.value = "";
  if (resultEl) { resultEl.style.display = "none"; resultEl.textContent = ""; }
  if (similarBox) similarBox.style.display = "none";
  const cb = document.getElementById("importPdfEnviarGpt");
  if (cb) cb.checked = true;
  if (window.bootstrap && modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function openModalDetalheTalento(id) {
  apiFetchJson(`${TALENTOS_API_BASE}/${id}`, { method: "GET" })
    .then((data) => {
      if (!data) { toast("Talento não encontrado."); return; }
      openModalDetalheTalentoWithData(data);
    })
    .catch((e) => { toast(e?.message || "Erro ao carregar detalhes."); });
}

function openModalDetalheTalentoWithData(data) {
  if (!data) return;
  state.detailTalentoData = data;
  renderDetailTabs(data);
  const modalEl = document.getElementById("modalDetalheTalento");
  if (window.bootstrap && modalEl) {
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  }
}

function formatDataNascimento(isoOrDate) {
  if (!isoOrDate) return "-";
  try {
    const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return isoOrDate || "-"; }
}

function buildEnderecoLine(d) {
  const parts = [d.logradouro, d.numero].filter(Boolean);
  if (d.bairro) parts.push(d.bairro);
  const linha = parts.join(", ");
  if (d.cep) return linha ? `${linha} — CEP ${d.cep}` : `CEP ${d.cep}`;
  return linha || "-";
}

function renderDetailTabs(data) {
  const d = data || state.detailTalentoData;
  if (!d) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v ?? "-"; };
  set("detailNome", d.nome);
  set("detailEmail", d.email);
  set("detailCpf", d.cpf || "-");
  set("detailDataNascimento", formatDataNascimento(d.dataNascimento));
  set("detailFone", d.fone);
  set("detailEndereco", buildEnderecoLine(d));
  set("detailCidadeUf", [d.cidade, d.uf].filter(Boolean).join(" / ") || "-");
  set("detailLinkedin", d.linkedinUrl || "-");
  const resumoEl = document.getElementById("detailResumo");
  if (resumoEl) resumoEl.textContent = d.resumoProfissional || "-";
  set("detailObs", d.obs || "-");

  const exp = (d.experiencias ?? d.Experiencias) ?? [];
  const expTbody = document.getElementById("detailExpTbody");
  const expEmpty = document.getElementById("detailExpEmpty");
  if (expTbody) {
    expTbody.innerHTML = "";
    exp.forEach((e, i) => {
      const tr = document.createElement("tr");
      const eEmpresa = e.empresa ?? e.Empresa; const eCargo = e.cargo ?? e.Cargo; const eInicio = e.inicio ?? e.Inicio; const eFim = e.fim ?? e.Fim; const eNs = e.nivelSenioridade ?? e.NivelSenioridade; const eNh = e.nivelHierarquico ?? e.NivelHierarquico; const eTipo = e.tipoContratacao ?? e.TipoContratacao; const eLocal = e.local ?? e.Local;
    tr.innerHTML = `<td>${escapeHtml(eEmpresa || "-")}</td><td>${escapeHtml(eCargo || "-")}</td><td>${escapeHtml(eInicio || "-")}</td><td>${escapeHtml(eFim || "-")}</td><td>${escapeHtml(eNs || "-")}</td><td>${escapeHtml(eNh || "-")}</td><td>${escapeHtml(eTipo || "-")}</td><td>${escapeHtml(eLocal || "-")}</td><td class="text-end"><button type="button" class="btn btn-ghost btn-sm btn-edit-exp" data-index="${i}"><i class="bi bi-pencil"></i></button></td>`;
      expTbody.appendChild(tr);
    });
    if (expTbody.querySelector(".btn-edit-exp")) expTbody.querySelectorAll(".btn-edit-exp").forEach((btn) => btn.addEventListener("click", () => openSubModalExp(parseInt(btn.getAttribute("data-index"), 10))));
  }
  if (expEmpty) expEmpty.style.display = exp.length === 0 ? "block" : "none";

  const trein = (d.treinamentos ?? d.Treinamentos) ?? [];
  const treinTbody = document.getElementById("detailTreinTbody");
  const treinEmpty = document.getElementById("detailTreinEmpty");
  if (treinTbody) {
    treinTbody.innerHTML = "";
    trein.forEach((t, i) => {
      const tr = document.createElement("tr");
      const tNome = t.nome ?? t.Nome; const tInst = t.instituicao ?? t.Instituicao; const tAno = t.ano ?? t.Ano; const tLink = t.link ?? t.Link;
    tr.innerHTML = `<td>${escapeHtml(tNome || "-")}</td><td>${escapeHtml(tInst || "-")}</td><td>${escapeHtml(tAno || "-")}</td><td>${escapeHtml(tLink || "-")}</td><td class="text-end"><button type="button" class="btn btn-ghost btn-sm btn-edit-trein" data-index="${i}"><i class="bi bi-pencil"></i></button></td>`;
      treinTbody.appendChild(tr);
    });
    if (treinTbody.querySelector(".btn-edit-trein")) treinTbody.querySelectorAll(".btn-edit-trein").forEach((btn) => btn.addEventListener("click", () => openSubModalTrein(parseInt(btn.getAttribute("data-index"), 10))));
  }
  if (treinEmpty) treinEmpty.style.display = trein.length === 0 ? "block" : "none";

  const form = (d.formacao ?? d.Formacao) ?? [];
  const formTbody = document.getElementById("detailFormTbody");
  const formEmpty = document.getElementById("detailFormEmpty");
  if (formTbody) {
    formTbody.innerHTML = "";
    form.forEach((f, i) => {
      const tr = document.createElement("tr");
      const fCurso = f.curso ?? f.Curso; const fInst = f.instituicao ?? f.Instituicao; const fTipo = f.tipo ?? f.Tipo; const fStatus = f.status ?? f.Status; const fInicio = f.inicio ?? f.Inicio; const fFim = f.fim ?? f.Fim;
    tr.innerHTML = `<td>${escapeHtml(fCurso || "-")}</td><td>${escapeHtml(fInst || "-")}</td><td>${escapeHtml(fTipo || "-")}</td><td>${escapeHtml(fStatus || "-")}</td><td>${escapeHtml(fInicio || "-")}</td><td>${escapeHtml(fFim || "-")}</td><td class="text-end"><button type="button" class="btn btn-ghost btn-sm btn-edit-form" data-index="${i}"><i class="bi bi-pencil"></i></button></td>`;
      formTbody.appendChild(tr);
    });
    if (formTbody.querySelector(".btn-edit-form")) formTbody.querySelectorAll(".btn-edit-form").forEach((btn) => btn.addEventListener("click", () => openSubModalForm(parseInt(btn.getAttribute("data-index"), 10))));
  }
  if (formEmpty) formEmpty.style.display = form.length === 0 ? "block" : "none";

  const hab = (d.competencias ?? d.Competencias) ?? [];
  const habTbody = document.getElementById("detailHabTbody");
  const habEmpty = document.getElementById("detailHabEmpty");
  if (habTbody) {
    habTbody.innerHTML = "";
    hab.forEach((h, i) => {
      const tr = document.createElement("tr");
      const hTipo = h.tipo ?? h.Tipo; const hNome = h.nome ?? h.Nome; const hNivel = h.nivel ?? h.Nivel; const hTa = h.tempoAtuacao ?? h.TempoAtuacao; const hEv = h.evidencia ?? h.Evidencia;
    tr.innerHTML = `<td>${escapeHtml(hTipo || "-")}</td><td>${escapeHtml(hNome || "-")}</td><td>${escapeHtml(hNivel || "-")}</td><td>${escapeHtml(hTa || "-")}</td><td>${escapeHtml(hEv || "-")}</td><td class="text-end"><button type="button" class="btn btn-ghost btn-sm btn-edit-hab" data-index="${i}"><i class="bi bi-pencil"></i></button></td>`;
      habTbody.appendChild(tr);
    });
    if (habTbody.querySelector(".btn-edit-hab")) habTbody.querySelectorAll(".btn-edit-hab").forEach((btn) => btn.addEventListener("click", () => openSubModalHab(parseInt(btn.getAttribute("data-index"), 10))));
  }
  if (habEmpty) habEmpty.style.display = hab.length === 0 ? "block" : "none";

  const docs = d.documentos || [];
  const docsList = document.getElementById("detailDocsList");
  const docsEmpty = document.getElementById("detailDocsEmpty");
  if (docsList) {
    docsList.innerHTML = "";
    const talentoId = d.id;
    docs.forEach((doc) => {
      const li = document.createElement("li");
      li.className = "list-group-item d-flex justify-content-between align-items-center";
      const a = document.createElement("a");
      a.href = `${TALENTOS_API_BASE}/${talentoId}/documentos/${doc.id}/download`;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = doc.nomeArquivo || doc.id;
      li.appendChild(a);
      docsList.appendChild(li);
    });
  }
  if (docsEmpty) docsEmpty.style.display = docs.length === 0 ? "block" : "none";

  const pendingBox = document.getElementById("detailPendingCvValidationBox");
  const pendingText = document.getElementById("detailPendingCvValidationText");
  if (pendingBox && pendingText) {
    const pending = d.pendingCvImportJob;
    if (pending && pending.similarPessoaSummary) {
      const s = pending.similarPessoaSummary;
      pendingText.textContent = `Encontramos um cadastro similar: ${s.nome || "-"}${s.email ? ", " + s.email : ""}${s.fone ? ", " + s.fone : ""}. Deseja atualizar esse cadastro com os dados do currículo importado?`;
      pendingBox.style.display = "block";
      pendingBox.dataset.jobId = pending.id || "";
    } else {
      pendingBox.style.display = "none";
      delete pendingBox.dataset.jobId;
    }
  }
}

function escapeHtml(s) {
  if (s == null || s === "") return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function openSubModalExp(index) {
  const d = state.detailTalentoData;
  const list = (d?.experiencias ?? d?.Experiencias) ?? [];
  const item = index >= 0 && index < list.length ? list[index] : null;
  const r = item || {};
  document.getElementById("subExpIndex").value = String(index);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  set("subExpEmpresa", r.empresa ?? r.Empresa);
  set("subExpCargo", r.cargo ?? r.Cargo);
  set("subExpInicio", r.inicio ?? r.Inicio);
  set("subExpFim", r.fim ?? r.Fim);
  set("subExpTipoContratacao", r.tipoContratacao ?? r.TipoContratacao);
  set("subExpLocal", r.local ?? r.Local);
  set("subExpNivelSenioridade", r.nivelSenioridade ?? r.NivelSenioridade);
  set("subExpNivelHierarquico", r.nivelHierarquico ?? r.NivelHierarquico);
  set("subExpResumoAtividades", r.resumoAtividades ?? r.ResumoAtividades);
  set("subExpAtividades", r.atividades ?? r.Atividades);
  if (window.bootstrap) new bootstrap.Modal(document.getElementById("modalDetalheExp")).show();
}

function openSubModalTrein(index) {
  const d = state.detailTalentoData;
  const list = (d?.treinamentos ?? d?.Treinamentos) ?? [];
  const item = index >= 0 && index < list.length ? list[index] : null;
  const r = item || {};
  document.getElementById("subTreinIndex").value = String(index);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  set("subTreinNome", r.nome ?? r.Nome);
  set("subTreinInstituicao", r.instituicao ?? r.Instituicao);
  set("subTreinAno", r.ano ?? r.Ano);
  set("subTreinLink", r.link ?? r.Link);
  if (window.bootstrap) new bootstrap.Modal(document.getElementById("modalDetalheTrein")).show();
}

function openSubModalForm(index) {
  const d = state.detailTalentoData;
  const list = (d?.formacao ?? d?.Formacao) ?? [];
  const item = index >= 0 && index < list.length ? list[index] : null;
  const r = item || {};
  document.getElementById("subFormIndex").value = String(index);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  set("subFormCurso", r.curso ?? r.Curso);
  set("subFormInstituicao", r.instituicao ?? r.Instituicao);
  set("subFormTipo", r.tipo ?? r.Tipo);
  set("subFormStatus", r.status ?? r.Status);
  set("subFormInicio", r.inicio ?? r.Inicio);
  set("subFormFim", r.fim ?? r.Fim);
  set("subFormObservacoes", r.observacoes ?? r.Observacoes);
  set("subFormLink", r.link ?? r.Link);
  if (window.bootstrap) new bootstrap.Modal(document.getElementById("modalDetalheForm")).show();
}

function openSubModalHab(index) {
  const d = state.detailTalentoData;
  const list = (d?.competencias ?? d?.Competencias) ?? [];
  const item = index >= 0 && index < list.length ? list[index] : null;
  const r = item || {};
  document.getElementById("subHabIndex").value = String(index);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ""; };
  set("subHabTipo", r.tipo ?? r.Tipo);
  set("subHabNome", r.nome ?? r.Nome);
  set("subHabNivel", r.nivel ?? r.Nivel);
  set("subHabTempoAtuacao", r.tempoAtuacao ?? r.TempoAtuacao);
  set("subHabEvidencia", r.evidencia ?? r.Evidencia);
  if (window.bootstrap) new bootstrap.Modal(document.getElementById("modalDetalheHab")).show();
}

function buildPutPayload(dataSource) {
  const d = dataSource ?? state.detailTalentoData;
  if (!d) return null;
  // #region agent log
  const dExpLen = (d.experiencias ?? d.Experiencias)?.length ?? -1;
  const dTreinLen = (d.treinamentos ?? d.Treinamentos)?.length ?? -1;
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'talentos.js:buildPutPayload',message:'detailTalentoData before build',data:{detailKeys:Object.keys(d),experienciasLen:dExpLen,treinamentosLen:dTreinLen},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  var competencias = (d.competencias ?? d.Competencias ?? []).map(function (c) {
    const r = c || {};
    return {
      id: r.id ?? null,
      tipo: r.tipo ?? r.Tipo ?? "",
      nome: r.nome ?? r.Nome ?? "",
      nivel: r.nivel ?? r.Nivel ?? "",
      tempoAtuacao: (r.tempoAtuacao ?? r.TempoAtuacao) != null ? String(r.tempoAtuacao ?? r.TempoAtuacao).trim() || null : null,
      evidencia: (r.evidencia ?? r.Evidencia) != null ? String(r.evidencia ?? r.Evidencia).trim() || null : null
    };
  });
  const expRaw = d.experiencias ?? d.Experiencias ?? [];
  const experiencias = (Array.isArray(expRaw) ? expRaw : []).map(function (e) {
    const r = e || {};
    return {
      id: r.id ?? r.Id ?? null,
      empresa: (r.empresa ?? r.Empresa ?? "").trim() || "",
      cargo: (r.cargo ?? r.Cargo ?? "").trim() || "",
      inicio: (r.inicio ?? r.Inicio ?? "")?.trim() || null,
      fim: (r.fim ?? r.Fim ?? "")?.trim() || null,
      tipoContratacao: (r.tipoContratacao ?? r.TipoContratacao ?? "")?.trim() || null,
      local: (r.local ?? r.Local ?? "")?.trim() || null,
      atividades: (r.atividades ?? r.Atividades ?? "")?.trim() || null,
      resumoAtividades: (r.resumoAtividades ?? r.ResumoAtividades ?? "")?.trim() || null,
      nivelSenioridade: (r.nivelSenioridade ?? r.NivelSenioridade ?? "")?.trim() || null,
      nivelHierarquico: (r.nivelHierarquico ?? r.NivelHierarquico ?? "")?.trim() || null
    };
  });
  const treinRaw = d.treinamentos ?? d.Treinamentos ?? [];
  const treinamentos = (Array.isArray(treinRaw) ? treinRaw : []).map(function (t) {
    const r = t || {};
    return { id: r.id ?? r.Id ?? null, nome: (r.nome ?? r.Nome ?? "").trim() || "", instituicao: (r.instituicao ?? r.Instituicao ?? "")?.trim() || null, ano: (r.ano ?? r.Ano ?? "")?.trim() || null, link: (r.link ?? r.Link ?? "")?.trim() || null };
  });
  const formRaw = d.formacao ?? d.Formacao ?? [];
  const formacao = (Array.isArray(formRaw) ? formRaw : []).map(function (f) {
    const r = f || {};
    return { id: r.id ?? r.Id ?? null, curso: (r.curso ?? r.Curso ?? "").trim() || "", instituicao: (r.instituicao ?? r.Instituicao ?? "")?.trim() || null, tipo: (r.tipo ?? r.Tipo ?? "")?.trim() || null, status: (r.status ?? r.Status ?? "")?.trim() || null, inicio: (r.inicio ?? r.Inicio ?? "")?.trim() || null, fim: (r.fim ?? r.Fim ?? "")?.trim() || null, observacoes: (r.observacoes ?? r.Observacoes ?? "")?.trim() || null, link: (r.link ?? r.Link ?? "")?.trim() || null };
  });
  return {
    nome: d.nome ?? "",
    email: d.email ?? "",
    fone: d.fone ?? null,
    cidade: d.cidade ?? null,
    uf: d.uf ?? null,
    linkedinUrl: d.linkedinUrl ?? null,
    resumoProfissional: d.resumoProfissional ?? null,
    obs: d.obs ?? null,
    origem: d.origem ?? "Manual",
    competencias: competencias,
    experiencias: experiencias,
    treinamentos: treinamentos,
    formacao: formacao
  };
}

function saveDetailAndRefresh(dataSource) {
  const dataToUse = dataSource ?? state.detailTalentoData;
  const id = dataToUse?.id;
  if (!id) return Promise.reject(new Error("Sem talento."));
  const payload = buildPutPayload(dataToUse);
  if (!payload) return Promise.reject(new Error("Sem dados."));
  // #region agent log
  var firstExp = payload.experiencias?.[0];
  fetch('http://127.0.0.1:7256/ingest/0fc6dcde-670e-45dd-8620-222860647680',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'talentos.js:saveDetailAndRefresh',message:'PUT payload first exp',data:{id,firstExpTipoContratacao:firstExp?.tipoContratacao,firstExpEmpresa:firstExp?.empresa},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'H4'})}).catch(()=>{});
  // #endregion
  return fetch(`${TALENTOS_API_BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify(payload)
  }).then((res) => {
    if (!res.ok) return res.json().then((err) => { throw new Error(err?.message || `Erro ${res.status}`); });
    return res.json();
  }).then((updated) => {
    state.detailTalentoData = updated;
    renderDetailTabs(updated);
    toast("Salvo.");
  });
}

function buildTalentoUpdateFromSuggested(s) {
  if (!s) return null;
  return {
    nome: (s.nome || "").trim(),
    email: (s.email || "").trim(),
    fone: s.fone || null,
    cidade: s.cidade || null,
    uf: (s.uf || "").trim().toUpperCase().slice(0, 2) || null,
    linkedinUrl: s.linkedinUrl || null,
    resumoProfissional: s.resumoProfissional || null,
    obs: null,
    cpf: s.cpf || null,
    dataNascimento: s.dataNascimento || null,
    cep: s.cep || null,
    logradouro: s.logradouro || null,
    numero: s.numero || null,
    bairro: s.bairro || null,
    origem: "Manual",
    competencias: Array.isArray(s.competencias) ? s.competencias : null,
    experiencias: Array.isArray(s.experiencias) ? s.experiencias : null,
    treinamentos: Array.isArray(s.treinamentos) ? s.treinamentos : null,
    formacao: Array.isArray(s.formacao) ? s.formacao : null
  };
}

async function uploadCvEExtrairTalento() {
  const talentoId = state.detailTalentoData?.id;
  if (!talentoId) {
    toast("Nenhum talento em detalhe.");
    return;
  }
  const fileInput = document.getElementById("talCvPdfArquivo");
  const file = fileInput?.files?.[0];
  if (!file) {
    toast("Selecione um arquivo PDF.");
    return;
  }
  const ext = (file.name || "").toLowerCase().slice(-4);
  if (ext !== ".pdf") {
    toast("Apenas arquivos PDF são aceitos.");
    return;
  }
  const enviarParaGpt = document.getElementById("talCvEnviarParaGpt")?.checked !== false;
  const form = new FormData();
  form.append("arquivo", file);
  form.append("enviarParaGpt", enviarParaGpt ? "true" : "false");
  try {
    const resp = await apiFetchJson(`${TALENTOS_API_BASE}/${talentoId}/documentos/curriculo-extrair`, {
      method: "POST",
      body: form
    });
    if (!resp) {
      toast("Currículo enviado.");
    } else {
      const d = state.detailTalentoData;
      if (d && resp.documento) {
        if (!Array.isArray(d.documentos)) d.documentos = [];
        d.documentos.unshift(resp.documento);
        renderDetailTabs(d);
      }
      if (resp.suggestedData) {
        _talSuggestedDataPayload = resp.suggestedData;
        document.getElementById("talSuggestedTalentoId").value = talentoId;
        const cvEl = document.getElementById("talSuggestedCvText");
        if (cvEl) cvEl.value = resp.cvText || "";
        const s = resp.suggestedData;
        document.getElementById("talSuggestedNome").value = s.nome || "";
        document.getElementById("talSuggestedEmail").value = s.email || "";
        document.getElementById("talSuggestedFone").value = s.fone || "";
        document.getElementById("talSuggestedCidade").value = s.cidade || "";
        document.getElementById("talSuggestedUf").value = (s.uf || "").toUpperCase().slice(0, 2) || "";
        document.getElementById("talSuggestedResumo").value = s.resumoProfissional || "";
        const modalEl = document.getElementById("modalTalCvSuggested");
        if (window.bootstrap && modalEl) {
          const modal = new bootstrap.Modal(modalEl);
          modal.show();
        }
      } else {
        toast("Currículo enviado." + (enviarParaGpt ? " Nenhum dado extraído pela IA." : ""));
      }
    }
    if (fileInput) fileInput.value = "";
  } catch (err) {
    console.error(err);
    toast("Falha ao enviar currículo.");
  }
}

async function applySuggestedToTalento() {
  const talentoId = (document.getElementById("talSuggestedTalentoId")?.value || "").trim();
  if (!talentoId) {
    toast("Talento não definido.");
    return;
  }
  const nome = (document.getElementById("talSuggestedNome")?.value || "").trim();
  const email = (document.getElementById("talSuggestedEmail")?.value || "").trim();
  if (!nome || !email) {
    toast("Preencha nome e email.");
    return;
  }
  const s = _talSuggestedDataPayload;
  const payload = buildTalentoUpdateFromSuggested({
    ...s,
    nome,
    email,
    fone: (document.getElementById("talSuggestedFone")?.value || "").trim() || null,
    cidade: (document.getElementById("talSuggestedCidade")?.value || "").trim() || null,
    uf: (document.getElementById("talSuggestedUf")?.value || "").trim().toUpperCase().slice(0, 2) || null,
    resumoProfissional: (document.getElementById("talSuggestedResumo")?.value || "").trim() || null
  });
  if (!payload) {
    toast("Dados inválidos.");
    return;
  }
  try {
    await apiFetchJson(`${TALENTOS_API_BASE}/${talentoId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const modalEl = document.getElementById("modalTalCvSuggested");
    if (window.bootstrap && modalEl) bootstrap.Modal.getInstance(modalEl)?.hide();
    toast("Dados aplicados no talento.");
    openModalDetalheTalento(talentoId);
  } catch (err) {
    console.error(err);
    toast("Falha ao aplicar dados.");
  }
}

function bindDetailModal() {
  const btnEditarDados = document.getElementById("btnDetalheEditarDados");
  if (btnEditarDados) btnEditarDados.addEventListener("click", () => {
    const id = state.detailTalentoData?.id;
    if (id) {
      const modalDetalhe = document.getElementById("modalDetalheTalento");
      if (window.bootstrap && modalDetalhe) bootstrap.Modal.getInstance(modalDetalhe)?.hide();
      openModalEditarTalento(id);
    }
  });

  const btnAprovar = document.getElementById("btnDetailAprovarCvImport");
  if (btnAprovar) btnAprovar.addEventListener("click", async () => {
    const box = document.getElementById("detailPendingCvValidationBox");
    const jobId = box?.dataset?.jobId;
    if (!jobId) return;
    btnAprovar.disabled = true;
    try {
      const res = await fetch(`${TALENTOS_API_BASE}/import-jobs/${jobId}/aprovar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data?.message || "Falha ao aprovar.");
        return;
      }
      toast("Cadastro similar atualizado com sucesso.");
      loadTalentos();
      const similarTalentoId = state.detailTalentoData?.pendingCvImportJob?.similarTalentoId;
      if (similarTalentoId) openModalDetalheTalento(similarTalentoId);
      else {
        const id = state.detailTalentoData?.id;
        if (id) openModalDetalheTalento(id);
      }
    } catch (e) {
      toast(e?.message || "Erro ao aprovar.");
    } finally {
      btnAprovar.disabled = false;
    }
  });

  const btnRecusar = document.getElementById("btnDetailRecusarCvImport");
  if (btnRecusar) btnRecusar.addEventListener("click", async () => {
    const box = document.getElementById("detailPendingCvValidationBox");
    const jobId = box?.dataset?.jobId;
    if (!jobId) return;
    btnRecusar.disabled = true;
    try {
      const res = await fetch(`${TALENTOS_API_BASE}/import-jobs/${jobId}/recusar`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast(data?.message || "Falha ao recusar.");
        return;
      }
      toast("Mantido o cadastro atual.");
      loadTalentos();
      const id = state.detailTalentoData?.id;
      if (id) openModalDetalheTalento(id);
    } catch (e) {
      toast(e?.message || "Erro ao recusar.");
    } finally {
      btnRecusar.disabled = false;
    }
  });

  const btnTalUploadCv = document.getElementById("btnTalUploadCvExtrair");
  if (btnTalUploadCv) btnTalUploadCv.addEventListener("click", uploadCvEExtrairTalento);
  const btnTalApply = document.getElementById("btnTalApplySuggested");
  if (btnTalApply) btnTalApply.addEventListener("click", applySuggestedToTalento);

  document.getElementById("btnDetalheAddExp")?.addEventListener("click", () => { document.getElementById("subExpIndex").value = "-1"; openSubModalExp(-1); });
  document.getElementById("btnDetalheAddTrein")?.addEventListener("click", () => { document.getElementById("subTreinIndex").value = "-1"; openSubModalTrein(-1); });
  document.getElementById("btnDetalheAddForm")?.addEventListener("click", () => { document.getElementById("subFormIndex").value = "-1"; openSubModalForm(-1); });
  document.getElementById("btnDetalheAddHab")?.addEventListener("click", () => { document.getElementById("subHabIndex").value = "-1"; openSubModalHab(-1); });

  document.getElementById("btnSubExpSave")?.addEventListener("click", () => {
    const idx = parseInt(document.getElementById("subExpIndex").value, 10);
    const expList = (state.detailTalentoData?.experiencias ?? state.detailTalentoData?.Experiencias) ?? [];
    const existing = idx >= 0 && idx < expList.length ? expList[idx] : null;
    const item = {
      id: (existing?.id ?? existing?.Id) ?? null,
      empresa: document.getElementById("subExpEmpresa")?.value?.trim() || "",
      cargo: document.getElementById("subExpCargo")?.value?.trim() || "",
      inicio: document.getElementById("subExpInicio")?.value?.trim() || null,
      fim: document.getElementById("subExpFim")?.value?.trim() || null,
      tipoContratacao: document.getElementById("subExpTipoContratacao")?.value?.trim() || null,
      local: document.getElementById("subExpLocal")?.value?.trim() || null,
      nivelSenioridade: document.getElementById("subExpNivelSenioridade")?.value?.trim() || null,
      nivelHierarquico: document.getElementById("subExpNivelHierarquico")?.value?.trim() || null,
      resumoAtividades: document.getElementById("subExpResumoAtividades")?.value?.trim() || null,
      atividades: document.getElementById("subExpAtividades")?.value?.trim() || null
    };
    let list = [...expList];
    if (idx >= 0 && idx < list.length) list[idx] = item; else list.push(item);
    var updated = { ...state.detailTalentoData, experiencias: list };
    state.detailTalentoData = updated;
    bootstrap.Modal.getInstance(document.getElementById("modalDetalheExp"))?.hide();
    saveDetailAndRefresh(updated);
  });
  document.getElementById("btnSubTreinSave")?.addEventListener("click", () => {
    const idx = parseInt(document.getElementById("subTreinIndex").value, 10);
    const treinList = (state.detailTalentoData?.treinamentos ?? state.detailTalentoData?.Treinamentos) ?? [];
    const existing = idx >= 0 && idx < treinList.length ? treinList[idx] : null;
    const item = {
      id: (existing?.id ?? existing?.Id) ?? null,
      nome: document.getElementById("subTreinNome")?.value?.trim() || "",
      instituicao: document.getElementById("subTreinInstituicao")?.value?.trim() || null,
      ano: document.getElementById("subTreinAno")?.value?.trim() || null,
      link: document.getElementById("subTreinLink")?.value?.trim() || null
    };
    let list = [...treinList];
    if (idx >= 0 && idx < list.length) list[idx] = item; else list.push(item);
    var updated = { ...state.detailTalentoData, treinamentos: list };
    state.detailTalentoData = updated;
    bootstrap.Modal.getInstance(document.getElementById("modalDetalheTrein"))?.hide();
    saveDetailAndRefresh(updated);
  });
  document.getElementById("btnSubFormSave")?.addEventListener("click", () => {
    const idx = parseInt(document.getElementById("subFormIndex").value, 10);
    const formList = (state.detailTalentoData?.formacao ?? state.detailTalentoData?.Formacao) ?? [];
    const existing = idx >= 0 && idx < formList.length ? formList[idx] : null;
    const item = {
      id: (existing?.id ?? existing?.Id) ?? null,
      curso: document.getElementById("subFormCurso")?.value?.trim() || "",
      instituicao: document.getElementById("subFormInstituicao")?.value?.trim() || null,
      tipo: document.getElementById("subFormTipo")?.value?.trim() || null,
      status: document.getElementById("subFormStatus")?.value?.trim() || null,
      inicio: document.getElementById("subFormInicio")?.value?.trim() || null,
      fim: document.getElementById("subFormFim")?.value?.trim() || null,
      observacoes: document.getElementById("subFormObservacoes")?.value?.trim() || null,
      link: document.getElementById("subFormLink")?.value?.trim() || null
    };
    let list = [...formList];
    if (idx >= 0 && idx < list.length) list[idx] = item; else list.push(item);
    var updated = { ...state.detailTalentoData, formacao: list };
    state.detailTalentoData = updated;
    bootstrap.Modal.getInstance(document.getElementById("modalDetalheForm"))?.hide();
    saveDetailAndRefresh(updated);
  });
  document.getElementById("btnSubHabSave")?.addEventListener("click", () => {
    const idx = parseInt(document.getElementById("subHabIndex").value, 10);
    const compList = (state.detailTalentoData?.competencias ?? state.detailTalentoData?.Competencias) ?? [];
    const existing = idx >= 0 && idx < compList.length ? compList[idx] : null;
    const item = {
      id: (existing?.id ?? existing?.Id) ?? null,
      tipo: document.getElementById("subHabTipo")?.value?.trim() || "",
      nome: document.getElementById("subHabNome")?.value?.trim() || "",
      nivel: document.getElementById("subHabNivel")?.value?.trim() || "",
      tempoAtuacao: document.getElementById("subHabTempoAtuacao")?.value?.trim() || null,
      evidencia: document.getElementById("subHabEvidencia")?.value?.trim() || null
    };
    let list = [...compList];
    if (idx >= 0 && idx < list.length) list[idx] = item; else list.push(item);
    var updated = { ...state.detailTalentoData, competencias: list };
    state.detailTalentoData = updated;
    bootstrap.Modal.getInstance(document.getElementById("modalDetalheHab"))?.hide();
    saveDetailAndRefresh(updated);
  });
}

var _importJobPollingTimer = null;

function startImportJobPolling(talentoId) {
  if (_importJobPollingTimer) return;
  var pollCount = 0;
  var maxPolls = 30;
  function poll() {
    _importJobPollingTimer = null;
    if (pollCount >= maxPolls) return;
    pollCount++;
    loadTalentos().then(function () {
      var item = state.items.find(function (t) { return (t.id ?? String(t.id)) === String(talentoId); });
      var status = item?.cvImportStatus;
      // API serializes enum as string (JsonStringEnumConverter); accept number or string
      var isTerminal = status === 2 || status === 3 || status === "PendenteValidacao" || status === "Concluido";
      if (isTerminal) {
        if (state.detailTalentoData?.id != null && String(state.detailTalentoData.id) === String(talentoId)) openModalDetalheTalento(talentoId);
        return;
      }
      _importJobPollingTimer = setTimeout(poll, 6000);
    });
  }
  _importJobPollingTimer = setTimeout(poll, 6000);
}

function bindImportarPdf() {
  const btnImport = document.getElementById("btnImportarPdf");
  const btnConfirm = document.getElementById("btnConfirmarImportarPdf");
  const modalEl = document.getElementById("modalImportarPdf");
  const resultEl = document.getElementById("importPdfResult");
  if (!btnImport || !btnConfirm) return;

  btnImport.addEventListener("click", () => openModalImportarPdf());

  btnConfirm.addEventListener("click", async () => {
    const fileInput = document.getElementById("importPdfArquivo");
    const file = fileInput?.files?.[0];
    if (!file || file.size === 0) {
      toast("Selecione um arquivo PDF.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      toast("Apenas arquivos PDF são aceitos.");
      return;
    }
    const enviarParaGpt = document.getElementById("importPdfEnviarGpt")?.checked ?? true;
    const form = new FormData();
    form.append("Arquivo", file);
    form.append("EnviarParaGpt", enviarParaGpt);

    btnConfirm.disabled = true;
    if (resultEl) { resultEl.style.display = "none"; resultEl.textContent = ""; }
    try {
      const res = await fetch(`${TALENTOS_API_BASE}/import-pdf`, {
        method: "POST",
        body: form
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { }
      if (!res.ok) {
        toast(data?.message || `Falha ao importar (${res.status}).`);
        btnConfirm.disabled = false;
        return;
      }
      if (resultEl && data) {
        resultEl.className = "alert alert-success small mb-0";
        resultEl.textContent = `Upload concluído. O processamento do currículo segue em background. Nome: ${data.talento?.nome ?? "-"}.`;
        resultEl.style.display = "block";
      }
      toast("Upload concluído. O processamento do currículo segue em background.");
      loadTalentos();
      const talento = data?.talento;
      const talentoId = talento?.id;
      setTimeout(() => {
        if (window.bootstrap && modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        btnConfirm.disabled = false;
        if (talento) openModalDetalheTalentoWithData(talento);
        if (talentoId) startImportJobPolling(talentoId);
      }, 1500);
    } catch (e) {
      toast(e?.message || "Erro ao importar PDF.");
      btnConfirm.disabled = false;
    }
  });

  const btnSimAtualizar = document.getElementById("btnImportPdfSimAtualizar");
  const btnNaoAtualizar = document.getElementById("btnImportPdfNaoAtualizar");
  if (btnSimAtualizar) {
    btnSimAtualizar.addEventListener("click", async () => {
      const data = state.lastImportPdfData;
      if (!data?.similarTalentoId || !data?.talento) return;
      const payload = {
        nome: data.talento.nome,
        email: data.talento.email,
        fone: data.talento.fone ?? null,
        cidade: data.talento.cidade ?? null,
        uf: data.talento.uf ?? null,
        linkedinUrl: data.talento.linkedinUrl ?? null,
        resumoProfissional: data.talento.resumoProfissional ?? null,
        obs: data.talento.obs ?? null,
        origem: data.talento.origem ?? "Manual",
        competencias: data.talento.competencias ?? [],
        experiencias: data.talento.experiencias ?? [],
        treinamentos: data.talento.treinamentos ?? [],
        formacao: data.talento.formacao ?? []
      };
      try {
        const res = await fetch(`${TALENTOS_API_BASE}/${data.similarTalentoId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(err?.message || "Falha ao atualizar cadastro similar.");
          return;
        }
        toast("Cadastro similar atualizado com sucesso.");
        state.lastImportPdfData = null;
        const similarBox = document.getElementById("importPdfSimilarBox");
        if (similarBox) similarBox.style.display = "none";
        if (window.bootstrap && modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
        loadTalentos();
        openModalDetalheTalento(data.similarTalentoId);
      } catch (e) {
        toast(e?.message || "Erro ao atualizar.");
      }
    });
  }
  if (btnNaoAtualizar) {
    btnNaoAtualizar.addEventListener("click", () => {
      const data = state.lastImportPdfData;
      state.lastImportPdfData = null;
      const similarBox = document.getElementById("importPdfSimilarBox");
      if (similarBox) similarBox.style.display = "none";
      toast("Mantido o novo cadastro.");
      if (window.bootstrap && modalEl) {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      loadTalentos();
      if (data?.talento?.id) openModalDetalheTalento(data.talento.id);
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindFilters();
  bindModalCadastrarCandidato();
  bindTopCadastrarCandidato();
  bindNovoTalento();
  bindDetailModal();
  bindImportarPdf();
  loadTalentos();

  const params = new URLSearchParams(window.location.search);
  const editId = params.get("_id");
  if (editId) {
    openModalDetalheTalento(editId);
    try { window.history.replaceState({}, "", window.location.pathname); } catch { }
  }
});
