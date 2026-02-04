const BLOQUEIO_API_BASE = "/api/bloqueio-pessoa";

const state = {
  items: [],
  totalCount: 0,
  page: 1,
  pageSize: 20,
  filters: { q: "" }
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
  return `${BLOQUEIO_API_BASE}?${params.toString()}`;
}

function mapOrigemBloqueio(origem) {
  const o = Number(origem);
  const map = { 0: "Candidato", 1: "Funcionário", 2: "Talento", 3: "Manual" };
  return map[o] ?? origem ?? "-";
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
  const tbody = document.getElementById("bloqueioTbody");
  const tplRow = document.getElementById("tpl-bloqueio-row");
  const tplEmpty = document.getElementById("tpl-bloqueio-empty");
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
      row.querySelector("[data-role=motivo]").textContent = item.motivo ?? "-";
      row.querySelector("[data-role=origem]").textContent = mapOrigemBloqueio(item.origemBloqueio);
      row.querySelector("[data-role=createdAt]").textContent = formatDate(item.createdAtUtc);
      row.querySelector("[data-act=remove]").addEventListener("click", (e) => {
        e.stopPropagation();
        removeBloqueio(item.id);
      });
      tbody.appendChild(row);
    });
  }

  const hintEl = document.getElementById("bloqueioHint");
  const countEl = document.getElementById("bloqueioCount");
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

async function removeBloqueio(id) {
  if (!confirm("Remover o bloqueio desta pessoa? A pessoa continuará cadastrada.")) return;
  try {
    const res = await fetch(`${BLOQUEIO_API_BASE}/${id}`, { method: "DELETE" });
    if (res.status === 204 || res.ok) {
      toast("Bloqueio removido.");
      loadList();
    } else {
      const j = await res.json().catch(() => ({}));
      toast(j?.message || "Erro ao remover.");
    }
  } catch (e) {
    toast(e?.message || "Erro ao remover.");
  }
}

function openModalCadastrar() {
  document.getElementById("modalBloqueioNome").value = "";
  document.getElementById("modalBloqueioEmail").value = "";
  document.getElementById("modalBloqueioMotivo").value = "";
  const modal = document.getElementById("modalCadastrarBloqueio");
  if (modal && window.bootstrap) {
    const m = new bootstrap.Modal(modal);
    m.show();
  }
}

async function submitCadastrarBloqueio() {
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
      const modal = document.getElementById("modalCadastrarBloqueio");
      if (modal && window.bootstrap) {
        const m = bootstrap.Modal.getInstance(modal);
        if (m) m.hide();
      }
      toast("Bloqueio cadastrado.");
      loadList();
    } else {
      toast(data?.message || "Erro ao cadastrar bloqueio.");
    }
  } catch (e) {
    toast(e?.message || "Erro ao cadastrar.");
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

  document.getElementById("btnRefreshBloqueio")?.addEventListener("click", () => loadList());
  document.getElementById("btnCadastrarBloqueioManual")?.addEventListener("click", () => openModalCadastrar());
  document.getElementById("btnConfirmarCadastroBloqueio")?.addEventListener("click", () => submitCadastrarBloqueio());

  loadList();
})();
