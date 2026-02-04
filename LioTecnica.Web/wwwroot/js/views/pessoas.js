const PESSOAS_API_BASE = "/api/pessoas";
const BLOQUEIO_API_BASE = "/api/bloqueio-pessoa";
const AUDIT_ENTITY_CHANGES_URL = "/api/audit/entity-changes";

const state = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  filters: { q: "" },
  bloqueioPessoaId: null,
  bloqueioPessoaNome: "",
  editingPessoaId: null
};

function apiFetchJson(url, opts) {
  return fetch(url, {
    headers: { "Accept": "application/json", "Content-Type": "application/json", ...(opts?.headers || {}) },
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
  return `${PESSOAS_API_BASE}?${params.toString()}`;
}

function formatDate(iso) {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return iso || "-"; }
}

function toast(msg) {
  const el = document.getElementById("toastMessage") || document.querySelector("[data-toast-message]");
  if (el) {
    el.textContent = msg;
    const toastEl = document.querySelector(".toast");
    if (toastEl && window.bootstrap) {
      const t = new bootstrap.Toast(toastEl);
      t.show();
    }
  } else {
    console.log(msg);
  }
}

async function loadList() {
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
  const tbody = document.getElementById("pessoasTbody");
  const tplRow = document.getElementById("tpl-pessoa-row");
  const tplEmpty = document.getElementById("tpl-pessoa-empty");
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
      row.querySelector("[data-role=cidadeUf]").textContent = [item.cidade, item.uf].filter(Boolean).join(" / ") || "-";
      row.querySelector("[data-role=createdAt]").textContent = formatDate(item.createdAtUtc);

      const bloqueadoHost = row.querySelector("[data-role=bloqueado-host]");
      if (bloqueadoHost) {
        const badge = document.createElement("span");
        badge.className = item.estaBloqueado ? "badge bg-danger" : "badge bg-secondary";
        badge.textContent = item.estaBloqueado ? "Sim" : "Não";
        bloqueadoHost.appendChild(badge);
      }

      const acoesHost = row.querySelector("[data-role=acoes-host]");
      if (acoesHost) {
        const btnEdit = document.createElement("button");
        btnEdit.type = "button";
        btnEdit.className = "btn btn-ghost btn-sm";
        btnEdit.title = "Editar";
        btnEdit.innerHTML = "<i class=\"bi bi-pencil\"></i>";
        btnEdit.addEventListener("click", (e) => { e.stopPropagation(); openModalPessoa(item.id); });
        acoesHost.appendChild(btnEdit);
        if (item.estaBloqueado) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-ghost btn-sm";
          btn.title = "Desbloquear";
          btn.innerHTML = "<i class=\"bi bi-unlock\"></i>";
          btn.addEventListener("click", (e) => { e.stopPropagation(); desbloquear(item.bloqueioId); });
          acoesHost.appendChild(btn);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "btn btn-ghost btn-sm";
          btn.title = "Bloquear";
          btn.innerHTML = "<i class=\"bi bi-person-x\"></i>";
          btn.addEventListener("click", (e) => { e.stopPropagation(); bloquear(item.id); });
          acoesHost.appendChild(btn);
        }
      }

      tbody.appendChild(row);
    });
  }

  const hintEl = document.getElementById("pessoasHint");
  const countEl = document.getElementById("pessoasCount");
  if (hintEl) hintEl.textContent = `Total: ${state.totalCount}`;
  if (countEl) countEl.textContent = String(state.items.length);
}

function renderPagination() {
  const wrap = document.getElementById("paginationWrap");
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil(state.totalCount / state.pageSize));
  wrap.innerHTML = "";
  if (totalPages <= 1) return;

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "btn btn-ghost btn-sm";
  prev.innerHTML = "<i class=\"bi bi-chevron-left\"></i>";
  prev.disabled = state.page <= 1;
  prev.addEventListener("click", () => { state.page = Math.max(1, state.page - 1); loadList(); });
  wrap.appendChild(prev);

  const span = document.createElement("span");
  span.className = "small text-muted ms-1 me-1";
  span.textContent = `${state.page} / ${totalPages}`;
  wrap.appendChild(span);

  const next = document.createElement("button");
  next.type = "button";
  next.className = "btn btn-ghost btn-sm";
  next.innerHTML = "<i class=\"bi bi-chevron-right\"></i>";
  next.disabled = state.page >= totalPages;
  next.addEventListener("click", () => { state.page = Math.min(totalPages, state.page + 1); loadList(); });
  wrap.appendChild(next);
}

function openModalMotivoBloqueio(pessoaId) {
  const item = state.items.find((p) => p.id === pessoaId);
  if (!item) return;
  state.bloqueioPessoaId = pessoaId;
  state.bloqueioPessoaNome = item.nome ?? "";
  const titleEl = document.getElementById("modalMotivoBloqueioTitle");
  if (titleEl) titleEl.textContent = state.bloqueioPessoaNome ? `Bloquear pessoa — ${state.bloqueioPessoaNome}` : "Bloquear pessoa";
  const motivoEl = document.getElementById("modalMotivoBloqueioMotivo");
  if (motivoEl) motivoEl.value = "";
  const modal = document.getElementById("modalMotivoBloqueio");
  if (modal && window.bootstrap) {
    const m = new bootstrap.Modal(modal);
    m.show();
  }
}

const ORIGEM_PESSOA_OPTIONS = [
  { value: 0, text: "Manual" },
  { value: 1, text: "Talento" },
  { value: 2, text: "Vaga" },
  { value: 3, text: "Email" },
  { value: 4, text: "Site" },
  { value: 5, text: "Candidatura" },
  { value: 6, text: "Pasta" },
  { value: 7, text: "Funcionário" },
  { value: 8, text: "Outro" }
];

function fillOrigemSelect() {
  const sel = document.getElementById("pessOrigem");
  if (!sel) return;
  sel.innerHTML = "";
  ORIGEM_PESSOA_OPTIONS.forEach((o) => {
    const opt = document.createElement("option");
    opt.value = String(o.value);
    opt.textContent = o.text;
    sel.appendChild(opt);
  });
}

function openModalPessoa(pessoaId) {
  state.editingPessoaId = pessoaId;
  fillOrigemSelect();
  loadPessoaAndFill(pessoaId);
  const modal = document.getElementById("modalPessoa");
  if (modal && window.bootstrap) {
    const m = new bootstrap.Modal(modal);
    m.show();
  }
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

function setElReadOnly(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? "";
}

async function loadPessoaAndFill(pessoaId) {
  try {
    const data = await apiFetchJson(`${PESSOAS_API_BASE}/${pessoaId}`, { method: "GET" });
    if (!data) return;
    setEl("pessId", data.id);
    document.getElementById("modalPessoaTitle").textContent = data.nome ? `Editar — ${data.nome}` : "Editar pessoa";
    setEl("pessNome", data.nome);
    setEl("pessEmail", data.email);
    setEl("pessFone", data.fone);
    setEl("pessCidade", data.cidade);
    setEl("pessUF", data.uf);
    setEl("pessLinkedinUrl", data.linkedinUrl);
    setEl("pessResumoProfissional", data.resumoProfissional);
    setEl("pessObs", data.obs);
    setEl("pessOrigem", data.origem != null ? String(data.origem) : "0");
    setEl("pessCep", data.cep);
    setEl("pessLogradouro", data.logradouro);
    setEl("pessNumero", data.numero);
    setEl("pessBairro", data.bairro);
    setEl("pessComplemento", data.complemento);
    setEl("pessCpf", data.cpf);
    setEl("pessRg", data.rg);
    setEl("pessFoneContato", data.foneContato);
    setElReadOnly("pessCreatedAt", data.createdAtUtc ? formatDate(data.createdAtUtc) : "");
    setElReadOnly("pessUpdatedAt", data.updatedAtUtc ? formatDate(data.updatedAtUtc) : "");
    loadPessoaHistorico(pessoaId);
  } catch (e) {
    toast(e?.message || "Erro ao carregar pessoa.");
  }
}

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso || "—"; }
}

async function loadPessoaHistorico(pessoaId) {
  const wrap = document.getElementById("pessHistoricoListWrap");
  const listEl = document.getElementById("pessHistoricoList");
  if (!wrap || !listEl) return;
  try {
    const url = `${AUDIT_ENTITY_CHANGES_URL}?entityName=Pessoa&entityId=${encodeURIComponent(pessoaId)}&page=1&pageSize=50`;
    const data = await apiFetchJson(url, { method: "GET" });
    const items = data?.items ?? [];
    if (items.length === 0) {
      wrap.style.display = "none";
      listEl.innerHTML = "<span class=\"text-muted\">Nenhuma alteração registrada.</span>";
    } else {
      wrap.style.display = "block";
      listEl.innerHTML = items.map((x) => {
        const stateLabel = x.state === "Added" ? "Criado" : x.state === "Modified" ? "Alterado" : x.state === "Deleted" ? "Removido" : x.state;
        const cols = x.changedColumns ? ` (${x.changedColumns})` : "";
        return `<div class="mb-1">${formatDateTime(x.occurredAt)} — ${stateLabel}${cols}${x.userName ? " por " + x.userName : ""}</div>`;
      }).join("");
    }
  } catch (e) {
    wrap.style.display = "block";
    listEl.innerHTML = "<span class=\"text-muted\">Não foi possível carregar o histórico.</span>";
  }
}

function buildPessoaPayload() {
  return {
    nome: (document.getElementById("pessNome")?.value ?? "").trim(),
    email: (document.getElementById("pessEmail")?.value ?? "").trim(),
    fone: (document.getElementById("pessFone")?.value ?? "").trim() || null,
    cidade: (document.getElementById("pessCidade")?.value ?? "").trim() || null,
    uf: (document.getElementById("pessUF")?.value ?? "").trim() || null,
    linkedinUrl: (document.getElementById("pessLinkedinUrl")?.value ?? "").trim() || null,
    resumoProfissional: (document.getElementById("pessResumoProfissional")?.value ?? "").trim() || null,
    obs: (document.getElementById("pessObs")?.value ?? "").trim() || null,
    origem: parseInt(document.getElementById("pessOrigem")?.value ?? "0", 10),
    cep: (document.getElementById("pessCep")?.value ?? "").trim() || null,
    logradouro: (document.getElementById("pessLogradouro")?.value ?? "").trim() || null,
    numero: (document.getElementById("pessNumero")?.value ?? "").trim() || null,
    bairro: (document.getElementById("pessBairro")?.value ?? "").trim() || null,
    complemento: (document.getElementById("pessComplemento")?.value ?? "").trim() || null,
    cpf: (document.getElementById("pessCpf")?.value ?? "").trim() || null,
    rg: (document.getElementById("pessRg")?.value ?? "").trim() || null,
    foneContato: (document.getElementById("pessFoneContato")?.value ?? "").trim() || null
  };
}

async function submitPessoa() {
  const id = state.editingPessoaId;
  if (!id) return;
  const payload = buildPessoaPayload();
  if (!payload.nome || !payload.email) {
    toast("Preencha Nome e E-mail.");
    return;
  }
  try {
    const data = await apiFetchJson(`${PESSOAS_API_BASE}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    if (data) {
      const modal = document.getElementById("modalPessoa");
      if (modal && window.bootstrap) {
        const m = bootstrap.Modal.getInstance(modal);
        if (m) m.hide();
      }
      state.editingPessoaId = null;
      toast("Pessoa atualizada.");
      loadList();
    }
  } catch (e) {
    toast(e?.message || "Erro ao salvar.");
  }
}

async function submitMotivoBloqueio() {
  const pessoaId = state.bloqueioPessoaId;
  if (!pessoaId) return;
  const motivoEl = document.getElementById("modalMotivoBloqueioMotivo");
  const motivo = (motivoEl?.value ?? "").trim() || null;
  try {
    const res = await fetch(`${BLOQUEIO_API_BASE}/block/${pessoaId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ motivo })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      const modal = document.getElementById("modalMotivoBloqueio");
      if (modal && window.bootstrap) {
        const m = bootstrap.Modal.getInstance(modal);
        if (m) m.hide();
      }
      state.bloqueioPessoaId = null;
      state.bloqueioPessoaNome = "";
      toast("Pessoa bloqueada.");
      loadList();
    } else {
      toast(data?.message || "Erro ao bloquear.");
    }
  } catch (e) {
    toast(e?.message || "Erro ao bloquear.");
  }
}

async function bloquear(pessoaId) {
  openModalMotivoBloqueio(pessoaId);
}

async function desbloquear(bloqueioId) {
  if (!bloqueioId) return;
  if (!confirm("Desbloquear esta pessoa?")) return;
  try {
    const res = await fetch(`${BLOQUEIO_API_BASE}/${bloqueioId}`, { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      toast("Pessoa desbloqueada.");
      loadList();
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.message || "Erro ao desbloquear.");
    }
  } catch (e) {
    toast(e?.message || "Erro ao desbloquear.");
  }
}

function openModalBloquearManual() {
  document.getElementById("modalBloqueioNome").value = "";
  document.getElementById("modalBloqueioEmail").value = "";
  document.getElementById("modalBloqueioMotivo").value = "";
  const modal = document.getElementById("modalBloquearPessoa");
  if (modal && window.bootstrap) {
    const m = new bootstrap.Modal(modal);
    m.show();
  }
}

async function submitBloquearManual() {
  const nome = (document.getElementById("modalBloqueioNome")?.value ?? "").trim();
  const email = (document.getElementById("modalBloqueioEmail")?.value ?? "").trim();
  const motivo = (document.getElementById("modalBloqueioMotivo")?.value ?? "").trim() || null;
  if (!nome || !email) {
    toast("Preencha Nome e E-mail.");
    return;
  }
  try {
    const res = await fetch(BLOQUEIO_API_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ nome, email, motivo })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      const modal = document.getElementById("modalBloquearPessoa");
      if (modal && window.bootstrap) {
        const m = bootstrap.Modal.getInstance(modal);
        if (m) m.hide();
      }
      toast("Pessoa bloqueada.");
      loadList();
    } else {
      toast(data?.message || "Erro ao bloquear pessoa.");
    }
  } catch (e) {
    toast(e?.message || "Erro ao bloquear.");
  }
}

(function init() {
  const fSearch = document.getElementById("fSearch");
  if (fSearch) {
    let debounceTimer;
    fSearch.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        state.filters.q = fSearch.value.trim();
        state.page = 1;
        loadList();
      }, 300);
    });
    fSearch.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        state.filters.q = fSearch.value.trim();
        state.page = 1;
        loadList();
      }
    });
  }

  document.getElementById("btnRefreshPessoas")?.addEventListener("click", () => loadList());
  document.getElementById("btnBloquearPessoaManual")?.addEventListener("click", () => openModalBloquearManual());
  document.getElementById("btnConfirmarBloquearPessoa")?.addEventListener("click", () => submitBloquearManual());
  document.getElementById("btnConfirmarMotivoBloqueio")?.addEventListener("click", () => submitMotivoBloqueio());
  document.getElementById("btnSavePessoa")?.addEventListener("click", () => submitPessoa());

  loadList();
})();
