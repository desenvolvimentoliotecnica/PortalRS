// ========= Logo (Data URI placeholder)
const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const CANDIDATOS_API_URL = window.__candidatosApiUrl || "/api/candidatos";
const MATCHING_RECALC_URL = (window.__apiBase || "") + "/api/matching/recalculate";

function enumFirstCode(key, fallback) {
  const list = getEnumOptions(key);
  return list.length ? list[0].code : fallback;
}

let VAGA_ALL = enumFirstCode("vagaFilter", "all");
let STATUS_ALL = enumFirstCode("candidatoStatusFilter", "all");
let SORT_DEFAULT = enumFirstCode("matchingSort", "score_desc");
const EMPTY_TEXT = "—";
const BULLET = "-";

const DEFAULT_RANKING_SIZE = 20;
// const RANKING_SIZE_OPTIONS = [10, 20, 40, 50, 100]; // Removed

const state = {
  vagas: [],
  candidatos: [],
  vagaDetails: {},
  matchCache: {},
  selectedId: null,
  filters: { q: "", vagaId: VAGA_ALL, status: STATUS_ALL, sort: SORT_DEFAULT },
  rankingCandidates: [],
  rankingSize: DEFAULT_RANKING_SIZE,
  rankingLoading: false,
  activeTab: "suggestions", // suggestions | rejected
  // Cache for tabs to avoid database calls on switch
  suggestionsCache: null, // array or null
  rejectedCache: null,    // array or null

  // Status do ranking (para stale + loading)
  rankingMeta: null,      // { status, startedAtUtc, computedAtUtc, filtersHash, lastError }
  rankingPollToken: 0,
  rankingPollTimer: null,
  rankingPollDelayMs: 1200,
  lastEmptyToastAtMs: 0
};

function getRankingSize() {
  return state.rankingSize || DEFAULT_RANKING_SIZE;
}

function showRankingLoading(show) {
  const el = document.getElementById("matchingLoadingOverlay");
  if (!el) return;
  el.classList.toggle("active", !!show);
  el.setAttribute("aria-busy", show ? "true" : "false");
  state.rankingLoading = !!show;
}

function normalizeEnumCode(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function parsePeso(value) {
  if (value == null) return 0;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = getEnumText("vagaPeso", value, "");
  const num = parseInt(text, 10);
  if (Number.isFinite(num)) return num;
  const raw = parseInt((value ?? "").toString().trim(), 10);
  return Number.isFinite(raw) ? raw : 0;
}

async function apiFetchJson(url, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const hasBody = options.body !== undefined && options.body !== null;
  if (hasBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin"
  });

  if (response.status === 401) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/Account/Login?returnUrl=${returnUrl}`;
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    let detail = `Falha ao buscar dados: ${response.status}`;
    try {
      const data = await response.json();
      if (data?.detail) detail = data.detail;
      if (data?.title) detail = data.title;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

function setText(root, role, value, fallback = EMPTY_TEXT) {
  if (!root) return;
  const el = root.querySelector(`[data-role="${role}"]`);
  if (!el) return;
  el.textContent = (value ?? fallback);
}

function buildTag(iconClass, text, cls) {
  const tag = cloneTemplate("tpl-matching-tag");
  if (!tag) return document.createElement("span");
  tag.classList.toggle("ok", cls === "ok");
  tag.classList.toggle("warn", cls === "warn");
  tag.classList.toggle("bad", cls === "bad");
  const icon = tag.querySelector('[data-role="icon"]');
  if (icon) icon.className = "bi " + iconClass;
  const label = tag.querySelector('[data-role="text"]');
  if (label) label.textContent = text || "";
  return tag;
}

function buildStatusTag(status) {
  const map = {
    novo: { cls: "" },
    triagem: { cls: "warn" },
    pendente: { cls: "warn" },
    aprovado: { cls: "ok" },
    reprovado: { cls: "bad" }
  };
  const it = map[status] || { cls: "" };
  const labelText = getEnumText("candidatoStatus", status, status);
  return buildTag("bi-dot", labelText, it.cls);
}

function buildMatchTag(score, thr) {
  const s = clamp(parseInt(score || 0, 10) || 0, 0, 100);
  const t = clamp(parseInt(thr || 0, 10) || 0, 0, 100);
  const ok = s >= t;
  const cls = ok ? "ok" : (s >= (t * 0.8) ? "warn" : "bad");
  const text = ok ? "Dentro" : "Abaixo";
  return buildTag("bi-stars", `${s}% ${BULLET} ${text}`, cls);
}

function mapApiVagaListItem(v) {
  return {
    id: v.id,
    codigo: v.codigo ?? "",
    titulo: v.titulo ?? "",
    status: normalizeEnumCode(v.status),
    threshold: Number.isFinite(+v.matchMinimoPercentual) ? +v.matchMinimoPercentual : 0,
    createdAtUtc: v.createdAtUtc ?? null,
    requisitos: []
  };
}

function mapApiVagaDetail(v) {
  const requisitos = Array.isArray(v.requisitos) ? v.requisitos.map(r => ({
    id: r.id,
    termo: r.nome ?? "",
    peso: parsePeso(r.peso),
    obrigatorio: !!r.obrigatorio,
    sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : [],
    obs: r.observacoes ?? ""
  })) : [];

  return {
    id: v.id,
    codigo: v.codigo ?? "",
    titulo: v.titulo ?? "",
    threshold: Number.isFinite(+v.matchMinimoPercentual) ? +v.matchMinimoPercentual : 0,
    matchingFiltrosRaw: v.matchingFiltrosRaw ?? "",
    matchingFiltrosOriginaisRaw: v.matchingFiltrosOriginaisRaw ?? "",
    requisitos
  };
}

function mapApiCandidatoListItem(c) {
  return {
    id: c.id,
    nome: c.nome ?? "",
    email: c.email ?? "",
    fone: c.fone ?? "",
    cidade: c.cidade ?? "",
    uf: c.uf ?? "",
    fonte: normalizeEnumCode(c.fonte),
    status: normalizeEnumCode(c.status),
    vagaId: c.vagaId,
    vagaCodigo: c.vagaCodigo ?? "",
    vagaTitulo: c.vagaTitulo ?? "",
    obs: c.obs ?? "",
    cvText: c.cvText ?? "",
    lastMatch: c.lastMatch ? {
      score: c.lastMatch.score ?? null,
      pass: c.lastMatch.pass ?? null,
      atUtc: c.lastMatch.atUtc ?? null,
      vagaId: c.lastMatch.vagaId ?? null
    } : null,
    createdAt: c.createdAtUtc ?? null,
    updatedAt: c.updatedAtUtc ?? null
  };
}

async function fetchVagas() {
  const list = await apiFetchJson(VAGAS_API_URL);
  return Array.isArray(list) ? list.map(mapApiVagaListItem) : [];
}

async function fetchCandidatos() {
  const list = await apiFetchJson(CANDIDATOS_API_URL);
  return Array.isArray(list) ? list.map(mapApiCandidatoListItem) : [];
}

function mapApiUnifiedRankingItem(c) {
  return {
    id: c.candidatoId,
    nome: c.nome ?? "",
    email: c.email ?? "",
    score: Number.isFinite(c.score) ? c.score : 0,
    pass: !!c.pass,
    source: c.source ?? "candidato",
    scoreFiltros: Number.isFinite(c.scoreFiltros) ? c.scoreFiltros : 0,
    scoreRequisitos: Number.isFinite(c.scoreRequisitos) ? c.scoreRequisitos : 0,
    justificativa: c.justificativa ?? ""
  };
}

async function fetchMatchingRankingSnapshot(vagaId) {
  if (!vagaId) return { status: "failed", lastError: "Vaga inválida." };
  const size = DEFAULT_RANKING_SIZE;
  const url = `${VAGAS_API_URL}/${encodeURIComponent(vagaId)}/matching-ranking?take=${size}`;

  const response = await fetch(url, {
    headers: { "Accept": "application/json" },
    credentials: "same-origin"
  });

  if (response.status === 401) {
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/Account/Login?returnUrl=${returnUrl}`;
    throw new Error("Unauthorized");
  }

  let data = null;
  try { data = await response.json(); } catch { /* ignore */ }

  if (!response.ok) {
    // Mantém corpo estruturado (failed + stale) quando o backend retornar 500
    return data || { status: "failed", lastError: `Falha ao carregar ranking (${response.status}).` };
  }

  return data || { status: "failed", lastError: "Resposta inválida do servidor." };
}

async function fetchRejectedCandidates(vagaId) {
  if (!vagaId || vagaId === VAGA_ALL) return [];
  const url = `${CANDIDATOS_API_URL}?vagaId=${encodeURIComponent(vagaId)}&status=Reprovado&pageSize=100`;
  const data = await apiFetchJson(url);
  if (data && Array.isArray(data.items)) {
    // Map and calculate match locally
    const vaga = findVaga(vagaId);
    return data.items.map(c => {
      // Convert API item to local candidate state for calcMatch if needed
      // But calcMatch needs full candidate object?
      // Let's assume basic fields are enough or acceptable.
      // Actually matching.js has `calcMatch(c, v)`.
      // We try to calc score.
      const mapped = mapApiCandidatoListItem(c);
      const match = vaga ? calcMatch(mapped, vaga) : { score: 0, pass: false };
      return {
        id: c.id,
        nome: c.nome,
        email: c.email,
        score: match.score || 0,
        pass: match.pass || false,
        source: 'candidato',
        scoreFiltros: 0, // detailed score not available from calcMatch yet unless we expand it
        scoreRequisitos: 0,
        justificativa: "Candidato reprovado."
      };
    });
  }
  return [];
}

/** Carrega o ranking, usa cache se disponivel. Triggered on init, tab switch, filter change. */
async function loadRankingForVaga(vagaId, forceRefresh = false) {
  if (!vagaId || vagaId === VAGA_ALL) {
    state.rankingCandidates = [];
    state.rankingMeta = null;
    renderList();
    return;
  }

  // Check cache first
  if (!forceRefresh) {
    if (state.activeTab === "suggestions" && state.suggestionsCache) {
      state.rankingCandidates = state.suggestionsCache;
      state.rankingMeta = { status: "ready", isCached: true };
      renderList();
      return;
    }
    if (state.activeTab === "rejected" && state.rejectedCache) {
      state.rankingCandidates = state.rejectedCache;
      state.rankingMeta = { status: "ready", isCached: true };
      renderList();
      return;
    }
  }

  // Cancela qualquer polling anterior
  state.rankingPollToken++;
  if (state.rankingPollTimer) {
    clearTimeout(state.rankingPollTimer);
    state.rankingPollTimer = null;
  }

  // Por padrão, só bloqueia com overlay quando não temos stale pra mostrar
  showRankingLoading(true);
  try {
    let results = [];
    if (state.activeTab === "rejected") {
      results = await fetchRejectedCandidates(vagaId);
      state.rejectedCache = results;
      state.rankingMeta = { status: "ready" };
    } else {
      const token = state.rankingPollToken;
      const snap = await fetchMatchingRankingSnapshot(vagaId);

      const toLocal = (arr) => Array.isArray(arr) ? arr.map(mapApiUnifiedRankingItem) : [];

      if (snap?.status === "ready") {
        results = toLocal(snap.items);
        state.suggestionsCache = results;
        state.rankingMeta = { status: "ready", computedAtUtc: snap.computedAtUtc, filtersHash: snap.filtersHash };
        state.rankingPollDelayMs = 1200;
        showRankingLoading(false);
      } else if (snap?.status === "processing") {
        results = toLocal(snap.staleItems);
        state.suggestionsCache = results.length ? results : null;
        state.rankingMeta = { status: "processing", startedAtUtc: snap.startedAtUtc, filtersHash: snap.filtersHash };

        // Se temos stale, não bloqueia a tabela com overlay; mostra indicador no render.
        showRankingLoading(!results.length);

        const delay = state.rankingPollDelayMs || 1200;
        state.rankingPollDelayMs = Math.min(10000, Math.round(delay * 1.35));
        state.rankingPollTimer = setTimeout(async () => {
          if (state.rankingPollToken !== token) return;
          if (state.activeTab !== "suggestions") return;
          if (state.filters.vagaId !== vagaId) return;
          await loadRankingForVaga(vagaId, true);
        }, delay);
      } else if (snap?.status === "failed") {
        results = toLocal(snap.staleItems);
        state.suggestionsCache = results.length ? results : null;
        state.rankingMeta = { status: "failed", lastError: snap.lastError, filtersHash: snap.filtersHash };
        showRankingLoading(false);
        if (typeof toast === "function") toast(snap?.lastError || "Falha ao carregar ranking.");
      } else {
        results = [];
        state.suggestionsCache = null;
        state.rankingMeta = { status: "failed", lastError: "Resposta inesperada do servidor." };
        showRankingLoading(false);
        if (typeof toast === "function") toast("Resposta inesperada do servidor.");
      }
    }
    state.rankingCandidates = results;
    renderList();
  } catch (err) {
    state.rankingCandidates = [];
    state.rankingMeta = { status: "failed", lastError: err?.message || String(err) };
    console.error(err);
    if (typeof toast === "function") toast(err?.message || "Falha ao carregar ranking.");
  } finally {
    // Se estamos em processing e sem stale, mantém overlay; caso contrário, esconde.
    const keep = state.rankingMeta && state.rankingMeta.status === "processing" && (!state.rankingCandidates || state.rankingCandidates.length === 0);
    showRankingLoading(!!keep);
  }
  // Se veio vazio, informar que estamos populando a base vetorial em background
  if (!state.rankingCandidates || state.rankingCandidates.length === 0) {
    if (typeof toast === "function") {
      const now = Date.now();
      if (!state.lastEmptyToastAtMs || (now - state.lastEmptyToastAtMs) > 15000) {
        state.lastEmptyToastAtMs = now;
        toast("Populando a base vetorial de talentos em segundo plano. Tente novamente em alguns segundos.", { duration: 8000 });
      }
    }
  }
}

async function fetchCandidatoFull(id) {
  const data = await apiFetchJson(`${CANDIDATOS_API_URL}/${encodeURIComponent(id)}`);
  return data ? {
    ...mapApiCandidatoListItem(data),
    resumoProfissional: data.resumoProfissional ?? "",
    documentos: data.documentos ?? []
  } : null;
}

async function ensureVagaDetails(vagaId) {
  if (!vagaId || vagaId === VAGA_ALL) return;
  if (state.vagaDetails[vagaId]) return;
  try {
    const data = await apiFetchJson(`${VAGAS_API_URL}/${vagaId}`);
    state.vagaDetails[vagaId] = mapApiVagaDetail(data);
  } catch (err) {
    console.error("Falha ao carregar detalhes da vaga:", err);
  }
}

async function preloadVagaDetails() {
  const ids = new Set(state.candidatos.map(c => c.vagaId).filter(Boolean));
  if (!ids.size) return;
  await Promise.allSettled(Array.from(ids).map(id => ensureVagaDetails(id)));
}

function findVaga(id) {
  return state.vagaDetails[id] || state.vagas.find(v => v.id === id) || null;
}

function findCand(id) {
  return state.candidatos.find(c => c.id === id) || null;
}

// ========= Matching engine
function calcMatch(cand, vaga) {
  if (!cand || !vaga) return { score: 0, pass: false, hits: [], missMandatory: [], totalPeso: 1, hitPeso: 0, threshold: 0 };

  const key = `${cand.id}|${vaga.id}`;
  const cached = state.matchCache[key];
  if (cached && cached.score != null && cached.hits && cached.missMandatory) {
    return { ...cached, fromCache: true };
  }

  const text = normalizeText(cand.cvText || "");
  const reqs = (vaga.requisitos || []);
  const totalPeso = reqs.reduce((acc, r) => acc + clamp(parsePeso(r.peso || 0), 0, 10), 0) || 1;

  let hitPeso = 0;
  const hits = [];
  const missMandatory = [];

  reqs.forEach(r => {
    const termo = normalizeText(r.termo || "");
    const syns = (r.sinonimos || []).map(normalizeText).filter(Boolean);
    const bag = [termo, ...syns].filter(Boolean);

    const found = bag.some(t => t && text.includes(t));
    const p = clamp(parsePeso(r.peso || 0), 0, 10);

    if (found) {
      hitPeso += p;
      hits.push({ ...r });
    } else if (r.obrigatorio) {
      missMandatory.push({ ...r });
    }
  });

  let score = Math.round((hitPeso / totalPeso) * 100);
  if (missMandatory.length) {
    score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
  }

  const threshold = clamp(parseInt(vaga.threshold || 0, 10) || 0, 0, 100);
  const pass = score >= threshold;

  const result = { score, pass, hits, missMandatory, totalPeso, hitPeso, threshold, at: new Date().toISOString() };
  state.matchCache[key] = result;

  return { ...result, fromCache: false };
}

// ========= Filters
function getFiltered() {
  const q = (state.filters.q || "").trim().toLowerCase();
  const vid = state.filters.vagaId;
  const st = state.filters.status;

  return state.candidatos.filter(c => {
    if (vid !== "all" && c.vagaId !== vid) return false;
    if (st !== "all" && normalizeEnumCode(c.status) !== normalizeEnumCode(st)) return false;

    if (!q) return true;
    const v = findVaga(c.vagaId);
    const blob = [c.nome, c.email, c.fone, c.cidade, c.uf, c.fonte, c.status, v?.titulo, v?.codigo, c.cvText].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function sortList(list) {
  const s = state.filters.sort;
  const vid = state.filters.vagaId;

  if (s.startsWith("score_")) {
    // se vaga for "all", usa a vaga do candidato
    const scored = list.map(c => {
      const v = vid === "all" ? findVaga(c.vagaId) : findVaga(vid);
      const m = v ? calcMatch(c, v) : { score: 0, threshold: 0, pass: false, hits: [], missMandatory: [] };
      return { c, m };
    });

    scored.sort((a, b) => {
      const diff = (a.m.score || 0) - (b.m.score || 0);
      return s === "score_asc" ? diff : -diff;
    });

    return scored.map(x => x.c);
  }

  if (s === "updated_desc") {
    return list.slice().sort((a, b) => (new Date(b.updatedAt || 0)) - (new Date(a.updatedAt || 0)));
  }
  if (s === "updated_asc") {
    return list.slice().sort((a, b) => (new Date(a.updatedAt || 0)) - (new Date(b.updatedAt || 0)));
  }
  if (s === "name_asc") {
    return list.slice().sort((a, b) => (a.nome || "").localeCompare((b.nome || ""), "pt-BR"));
  }
  return list;
}

/** Vagas ordenadas por criação (mais recente primeiro). */
function distinctVagas() {
  const list = state.vagas.map(v => {
    const title = v.titulo || EMPTY_TEXT;
    const code = v.codigo || EMPTY_TEXT;
    return { id: v.id, label: `${title} (${code})`, createdAtUtc: v.createdAtUtc };
  });
  list.sort((a, b) => {
    const ta = a.createdAtUtc ? new Date(a.createdAtUtc).getTime() : 0;
    const tb = b.createdAtUtc ? new Date(b.createdAtUtc).getTime() : 0;
    return tb - ta;
  });
  return list;
}

function renderVagaFilter() {
  const sel = $("#fVaga");
  if (!sel) return;
  const cur = sel.value || VAGA_ALL;
  sel.replaceChildren();
  getEnumOptions("vagaFilter").forEach(opt => {
    sel.appendChild(buildOption(opt.code, opt.text, opt.code === cur));
  });
  distinctVagas().forEach(v => {
    sel.appendChild(buildOption(v.id, v.label, v.id === cur));
  });
  sel.value = (cur === VAGA_ALL || state.vagas.some(v => v.id === cur)) ? cur : VAGA_ALL;
}

/** Lista de vagas clicáveis (vagas reais ou mock). Ao clicar, carrega o ranking na mesma tabela do dado real. */
function renderVagaList() {
  const host = $("#vagaList");
  if (!host) return;
  const sourceVagas = state.vagas;
  const currentId = state.filters.vagaId;
  host.replaceChildren();
  sourceVagas.forEach(v => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-ghost btn-sm border";
    btn.style.borderColor = "var(--lt-border, #dee2e6)";
    btn.dataset.vagaId = v.id;
    const label = (v.titulo || v.codigo || v.id) + (v.codigo ? ` (${v.codigo})` : "");
    btn.textContent = label;
    if (v.id === currentId) btn.classList.add("active");
    btn.addEventListener("click", async () => {
      state.filters.vagaId = v.id;
      const sel = $("#fVaga");
      if (sel) sel.value = v.id;
      await ensureVagaDetails(v.id);
      await loadRankingForVaga(v.id);
      renderVagaList();
    });
    host.appendChild(btn);
  });
}

// ========= Render list
function renderList() {
  const vagaId = state.filters.vagaId;
  const host = $("#candList");
  const vagaHeader = $("#vagaHeader");
  const titleActions = $("#matchingPageTitleActions");
  const btnRevert = $("#btnRevertMatchingFiltros");

  if (!vagaId || vagaId === VAGA_ALL) {
    vagaHeader?.classList.add("d-none");
    titleActions?.classList.add("d-none");
    state.rankingCandidates = [];
    host?.replaceChildren();
    const empty = cloneTemplate("tpl-matching-select-vaga");
    if (empty) host?.appendChild(empty);
    $("#listCount").textContent = "0";
    const kpi0 = $("#kpiTotal"); if (kpi0) kpi0.textContent = "0";
    const kpi1 = $("#kpiInside"); if (kpi1) kpi1.textContent = "0";
    const kpi2 = $("#kpiMandatoryFail"); if (kpi2) kpi2.textContent = "0";
    const kpi3 = $("#kpiAvg"); if (kpi3) kpi3.textContent = "0%";
    return;
  }

  const vaga = findVaga(vagaId);
  if (vagaHeader) vagaHeader.classList.remove("d-none");
  if (titleActions) titleActions.classList.remove("d-none");
  if (btnRevert) {
    const orig = (vaga && vaga.matchingFiltrosOriginaisRaw != null) ? String(vaga.matchingFiltrosOriginaisRaw) : "";
    const curr = (vaga && vaga.matchingFiltrosRaw != null) ? String(vaga.matchingFiltrosRaw) : "";
    btnRevert.classList.toggle("d-none", orig === curr);
  }

  const ranking = state.rankingCandidates || [];
  const listCountEl = $("#listCount");
  if (listCountEl) listCountEl.textContent = ranking.length;
  const inside = ranking.filter(r => r.pass).length;
  const sum = ranking.reduce((s, r) => s + (r.score || 0), 0);
  const avgPct = ranking.length ? (Math.round(sum / ranking.length) + "%") : "0%";
  const kpTotal = $("#kpiTotal"); if (kpTotal) kpTotal.textContent = ranking.length;
  const kpInside = $("#kpiInside"); if (kpInside) kpInside.textContent = inside;
  const kpFail = $("#kpiMandatoryFail"); if (kpFail) kpFail.textContent = ranking.filter(r => !r.pass).length;
  const kpAvg = $("#kpiAvg"); if (kpAvg) kpAvg.textContent = avgPct;
  const cardInside = $("#cardInside"); if (cardInside) cardInside.textContent = inside;
  const cardFail = $("#cardFail"); if (cardFail) cardFail.textContent = ranking.filter(r => !r.pass).length;
  const cardAvg = $("#cardAvg"); if (cardAvg) cardAvg.textContent = avgPct;

  host?.replaceChildren();
  host?.classList?.remove("matching-has-table");

  // TABS
  const tabs = document.createElement("ul");
  tabs.className = "nav nav-tabs mb-3";
  const createTab = (id, label) => {
    const li = document.createElement("li");
    li.className = "nav-item";
    const a = document.createElement("button");
    a.className = "nav-link " + (state.activeTab === id ? "active" : "");
    a.type = "button";
    a.textContent = label;
    a.onclick = async () => {
      if (state.activeTab === id) return;
      state.activeTab = id;
      await loadRankingForVaga(vagaId);
    };
    li.appendChild(a);
    return li;
  };
  tabs.appendChild(createTab("suggestions", "Sugestões"));
  tabs.appendChild(createTab("rejected", "Reprovados"));
  host.appendChild(tabs);

  // Indicador de atualização (stale + background)
  if (state.activeTab === "suggestions" && state.rankingMeta && state.rankingMeta.status === "processing") {
    const info = document.createElement("div");
    info.className = "alert alert-info py-2 px-3 small mb-3";
    info.style.borderRadius = "12px";
    info.style.borderColor = "rgba(13,110,253,.25)";
    info.style.background = "rgba(13,110,253,.08)";
    info.innerHTML = "<i class=\"bi bi-arrow-repeat me-1\"></i>Atualizando ranking em segundo plano…";
    host.appendChild(info);
  }
  if (state.activeTab === "suggestions" && state.rankingMeta && state.rankingMeta.status === "failed") {
    const warn = document.createElement("div");
    warn.className = "alert alert-warning py-2 px-3 small mb-3";
    warn.style.borderRadius = "12px";
    warn.innerHTML = "<i class=\"bi bi-exclamation-triangle me-1\"></i>Falha ao atualizar ranking. Exibindo último resultado disponível.";
    host.appendChild(warn);
  }

  if (!ranking.length) {
    const empty = cloneTemplate("tpl-matching-empty");
    if (empty) {
      // Customize empty message based on tab
      const msg = empty.querySelector("p");
      if (msg) msg.textContent = state.activeTab === "rejected" ? "Nenhum candidato reprovado." : "Nenhuma sugestão encontrada.";
      host.appendChild(empty);
    }
  } else {
    host?.classList?.add("matching-has-table");
    const table = document.createElement("table");
    table.className = "table table-hover align-middle mb-0 w-100";
    table.innerHTML = "<thead><tr><th style=\"width:48px;\"></th><th>Nome</th><th>E-mail</th><th style=\"width:90px;\">Match</th><th class=\"text-end\" style=\"width:140px;\">Ações</th><th class=\"text-end\" style=\"width:80px;\">Pontos</th></tr></thead><tbody></tbody>";
    const tbody = table.querySelector("tbody");
    ranking.forEach(r => {
      const row = buildRankingRow(r);
      if (row) tbody.appendChild(row);
    });
    host.appendChild(table);
  }
}

function buildRankingRow(r) {
  const tpl = document.getElementById("tpl-matching-ranking-row");
  if (!tpl || !tpl.content) return null;
  const tr = tpl.content.cloneNode(true).querySelector("tr");
  if (!tr) return null;
  tr.dataset.id = r.id;
  if (r.id === state.selectedId) tr.classList.add("table-active");
  setText(tr, "rank-initials", initials(r.nome));
  setText(tr, "rank-name", r.nome);
  setText(tr, "rank-email", r.email);

  // Source badge (Candidato vs Talento)
  const nameEl = tr.querySelector("[data-role=\"rank-name\"]");
  if (nameEl && r.source) {
    const srcBadge = document.createElement("span");
    srcBadge.className = "badge ms-2 " + (r.source === "talento" ? "bg-info text-dark" : "bg-primary");
    srcBadge.style.fontSize = "0.7em";
    srcBadge.textContent = r.source === "talento" ? "Talento" : "Candidato";
    nameEl.appendChild(document.createTextNode(" "));
    nameEl.appendChild(srcBadge);
  }

  const matchEl = tr.querySelector("[data-role=\"rank-match\"]");
  if (matchEl) {
    matchEl.textContent = r.pass ? "Dentro" : "Abaixo";
    matchEl.className = "badge rank-match-badge " + (r.pass ? "bg-success" : "bg-warning text-dark");
  }
  const score = Number.isFinite(r.score) ? clamp(Math.round(r.score), 0, 100) : 0;
  setText(tr, "rank-score", score + "%");

  // Tooltip
  const scoreEl = tr.querySelector("[data-role=\"rank-score\"]");
  if (scoreEl && (r.justificativa || r.scoreFiltros || r.scoreRequisitos)) {
    const tip = `Filtros: ${r.scoreFiltros ?? 0}% | Requisitos: ${r.scoreRequisitos ?? 0}%${r.justificativa ? "\n" + r.justificativa : ""}`;
    scoreEl.setAttribute("title", tip);
    scoreEl.style.cursor = "help";
  }
  const circleEl = tr.querySelector("[data-role=\"rank-score-circle\"]");
  if (circleEl) {
    circleEl.style.setProperty("--score", String(score));
    circleEl.classList.remove("score-high", "score-medium", "score-low");
    if (score >= 60) circleEl.classList.add("score-high");
    else if (score >= 30) circleEl.classList.add("score-medium");
    else circleEl.classList.add("score-low");
  }
  const valueEl = tr.querySelector(".score-circle-value");
  if (valueEl) {
    valueEl.classList.remove("score-high", "score-medium", "score-low");
    if (score >= 60) valueEl.classList.add("score-high");
    else if (score >= 30) valueEl.classList.add("score-medium");
    else valueEl.classList.add("score-low");
  }

  /* Open Button: Icon only */
  const openBtn = tr.querySelector("[data-role=\"rank-open\"]");
  if (openBtn) {
    openBtn.title = "Abrir Detalhes";
    openBtn.className = "btn btn-sm btn-outline-secondary"; // Ensure consistent styling
    openBtn.innerHTML = "<i class=\"bi bi-eye\"></i>"; // Icon only
    openBtn.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const vagaId = state.filters.vagaId && state.filters.vagaId !== VAGA_ALL ? state.filters.vagaId : "";
      const qs = vagaId ? "?vagaId=" + encodeURIComponent(vagaId) : "";
      window.location.href = "/Candidatos/Detalhes/" + encodeURIComponent(r.id) + qs;
    });

    // Add Reprove Button
    if (state.activeTab === "suggestions") {
      const btnReprove = document.createElement("button");
      btnReprove.className = "btn btn-sm btn-outline-danger ms-2"; // increased spacing
      btnReprove.title = "Reprovar candidato";
      btnReprove.innerHTML = "<i class=\"bi bi-x-lg\"></i>";
      btnReprove.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await reproveCandidate(r.id, r.source);
      };
      const parent = openBtn.parentElement;
      if (parent) {
        // Ensure proper order
        parent.replaceChildren(); // clear
        parent.appendChild(openBtn);
        parent.appendChild(btnReprove);
      }
    }
  }

  tr.addEventListener("click", () => {
    state.selectedId = r.id;
    // Don't re-render entire list because it kills DOM state and selection.
    // Just update active class.
    const all = document.querySelectorAll("#candList tr");
    all.forEach(x => x.classList.remove("table-active"));
    tr.classList.add("table-active");

    const detailHost = $("#detailHost");
    if (detailHost) {
      openDetailPanelFromRanking(r).then(() => { });
    }
  });
  return tr;
}

async function openDetailPanelFromRanking(rankItem) {
  const full = await fetchCandidatoFull(rankItem.id);
  const c = full || { id: rankItem.id, nome: rankItem.nome, email: rankItem.email };
  const detailHost = $("#detailHost");
  if (detailHost) {
    detailHost.classList.remove("d-none");
    renderDetail(c, detailHost);
  }
}

function buildListItem(c) {
  const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
  const m = v ? calcMatch(c, v) : { score: 0, threshold: 0, pass: false, hits: [], missMandatory: [] };

  const item = cloneTemplate("tpl-matching-item");
  if (!item) return null;
  item.dataset.id = c.id;
  if (c.id === state.selectedId) item.classList.add("active");

  setText(item, "item-initials", initials(c.nome));
  setText(item, "item-name", c.nome);
  setText(item, "item-email", c.email);

  const vagaCode = item.querySelector('[data-role="item-vaga-code"]');
  if (vagaCode) {
    const codeText = v ? (v.codigo || EMPTY_TEXT) : (c.vagaCodigo || "Sem vaga");
    vagaCode.textContent = codeText;
    vagaCode.classList.toggle("mono", !!codeText);
  }
  const vagaTitle = v ? v.titulo : (c.vagaTitulo || EMPTY_TEXT);
  setText(item, "item-vaga-title", vagaTitle);

  const score = clamp(parseInt(m.score || 0, 10) || 0, 0, 100);
  const progress = item.querySelector('[data-role="item-progress"]');
  if (progress) progress.style.width = `${score}%`;
  setText(item, "item-score", `${score}%`);

  const tagsHost = item.querySelector('[data-role="item-tags"]');
  if (tagsHost) {
    tagsHost.replaceChildren();
    tagsHost.appendChild(buildMatchTag(m.score, m.threshold));

    const missCount = (m.missMandatory || []).length;
    tagsHost.appendChild(buildTag(
      missCount ? "bi-exclamation-triangle" : "bi-check2",
      missCount ? `${missCount} obrig.` : "Obrig. OK",
      missCount ? "bad" : "ok"
    ));

    tagsHost.appendChild(buildStatusTag(c.status || "novo"));
  }

  item.addEventListener("click", () => {
    state.selectedId = item.dataset.id;
    renderList();
    const selected = findCand(state.selectedId);
    openDetailModal(selected);
  });

  return item;
}

function buildReqRow(r, hitIds, missIds) {
  const isHit = hitIds.has(r.id);
  const isMiss = missIds.has(r.id);
  const row = cloneTemplate("tpl-matching-req-row");
  if (!row) return null;

  if (isHit) row.classList.add("hit");
  if (isMiss) row.classList.add("miss");

  const icon = row.querySelector('[data-role="req-icon"]');
  if (icon) icon.className = "bi bi-" + (isHit ? "check2-circle" : (isMiss ? "x-circle" : "dash-circle"));

  setText(row, "req-term", r.termo);
  setText(row, "req-weight", clamp(parsePeso(r.peso || 0), 0, 10));

  const obrigEl = row.querySelector('[data-role="req-obrig"]');
  if (obrigEl) {
    obrigEl.textContent = r.obrigatorio ? "obrigatorio" : "desejavel";
    obrigEl.classList.toggle("text-danger", !!r.obrigatorio);
    obrigEl.classList.toggle("fw-semibold", !!r.obrigatorio);
  }

  const syn = (r.sinonimos || []).join(", ");
  setText(row, "req-syn", syn);
  toggleRole(row, "req-syn-wrap", !!syn);

  const tagHost = row.querySelector('[data-role="req-tag-host"]');
  if (tagHost) {
    const tag = isHit ? buildTag("bi-check2", "OK", "ok") :
      (isMiss ? buildTag("bi-x-lg", "Faltando", "bad") : buildTag("bi-dash", "Nao achou", ""));
    tagHost.replaceChildren(tag);
  }

  return row;
}

function buildCandidatoPayload(c, overrides = {}) {
  const lastMatch = overrides.lastMatch !== undefined
    ? overrides.lastMatch
    : (c.lastMatch ? {
      score: c.lastMatch.score ?? null,
      pass: c.lastMatch.pass ?? null,
      atUtc: c.lastMatch.atUtc ?? null,
      vagaId: c.lastMatch.vagaId ?? null
    } : null);

  return {
    nome: overrides.nome ?? c.nome,
    email: overrides.email ?? c.email,
    fone: overrides.fone !== undefined ? overrides.fone : (c.fone ?? null),
    cidade: overrides.cidade !== undefined ? overrides.cidade : (c.cidade ?? null),
    uf: overrides.uf !== undefined ? overrides.uf : (c.uf ?? null),
    fonte: overrides.fonte ?? c.fonte,
    status: overrides.status ?? c.status,
    vagaId: overrides.vagaId ?? c.vagaId,
    obs: overrides.obs !== undefined ? overrides.obs : (c.obs ?? null),
    cvText: overrides.cvText !== undefined ? overrides.cvText : (c.cvText ?? null),
    lastMatch,
    documentos: overrides.documentos ?? null
  };
}

async function updateCandidatoFromState(c, overrides = {}) {
  const payload = buildCandidatoPayload(c, overrides);
  const data = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  return mapApiCandidatoListItem(data);
}

function updateCandidateState(updated) {
  const idx = state.candidatos.findIndex(c => c.id === updated.id);
  if (idx >= 0) {
    state.candidatos[idx] = updated;
  }
}

async function persistLastMatch(c, vaga, matchResult) {
  const payload = {
    lastMatch: {
      score: matchResult.score ?? null,
      pass: matchResult.pass ?? null,
      atUtc: matchResult.at ?? new Date().toISOString(),
      vagaId: vaga.id
    }
  };
  const updated = await updateCandidatoFromState(c, payload);
  updateCandidateState(updated);
  return updated;
}

async function callRecalculateMatch(candidatoId, vagaId) {
  const qs = new URLSearchParams({ candidatoId, vagaId });
  const res = await fetch(`${MATCHING_RECALC_URL}?${qs}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Accept": "application/json" }
  });
  if (!res.ok) throw new Error(`Recalcular falhou: ${res.status}`);
}

// ========= Detail
function renderDetail(c, host) {
  if (!host) return;
  host.replaceChildren();

  if (!c) {
    const empty = cloneTemplate("tpl-matching-detail-empty");
    if (empty) host.appendChild(empty);
    return;
  }

  const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
  if (!v) {
    const empty = cloneTemplate("tpl-matching-detail-novaga");
    if (empty) host.appendChild(empty);
    return;
  }

  const m = calcMatch(c, v);
  const miss = (m.missMandatory || []);
  const hits = (m.hits || []);
  const reqs = (v.requisitos || []);

  const hitIds = new Set(hits.map(x => x.id));
  const missIds = new Set(miss.map(x => x.id));

  const root = cloneTemplate("tpl-matching-detail");
  if (!root) return;

  setText(root, "detail-initials", initials(c.nome));
  setText(root, "detail-name", c.nome);
  setText(root, "detail-email", c.email);
  setText(root, "detail-updated", fmtDate(c.updatedAt));

  const matchTagHost = root.querySelector('[data-role="detail-match-tag"]');
  if (matchTagHost) matchTagHost.replaceChildren(buildMatchTag(m.score, m.threshold));

  const thrVal = clamp(parseInt(m.threshold || 0, 10) || 0, 0, 100);
  setText(root, "detail-thr", `${thrVal}%`);

  const cacheIcon = root.querySelector('[data-role="detail-cache-icon"]');
  if (cacheIcon) cacheIcon.className = m.fromCache ? "bi bi-hdd me-1" : "bi bi-cpu me-1";
  setText(root, "detail-cache-text", m.fromCache ? "cache" : "calculado");

  setText(root, "detail-vaga-title", v.titulo);
  setText(root, "detail-vaga-code", v.codigo);
  setText(root, "detail-req-count", reqs.length);
  setText(root, "detail-hit-count", hits.length);
  setText(root, "detail-miss-count", miss.length);

  const score = clamp(parseInt(m.score || 0, 10) || 0, 0, 100);
  setText(root, "detail-score", `${score}%`);
  const scoreBar = root.querySelector('[data-role="detail-score-bar"]');
  if (scoreBar) scoreBar.style.width = `${score}%`;

  const reqHost = root.querySelector("#reqList");
  if (reqHost) {
    reqHost.replaceChildren();
    reqs.forEach(r => {
      const row = buildReqRow(r, hitIds, missIds);
      if (row) reqHost.appendChild(row);
    });
  }

  setText(root, "detail-hitPeso", m.hitPeso);
  setText(root, "detail-totalPeso", m.totalPeso);
  const penalty = miss.length ? ("-" + Math.min(40, miss.length * 15)) : "0";
  setText(root, "detail-penalty", penalty);

  const resumoEl = root.querySelector("#detailResumoProfissional");
  if (resumoEl) resumoEl.textContent = (c.resumoProfissional != null && String(c.resumoProfissional).trim() !== "") ? String(c.resumoProfissional).trim() : "—";
  const docsList = root.querySelector("#detailDocumentosList");
  if (docsList) {
    const docs = Array.isArray(c.documentos) ? c.documentos : [];
    docsList.replaceChildren();
    if (docs.length) {
      docs.forEach(d => {
        const name = (d && (d.nome || d.fileName || d.nomeArquivo)) ? (d.nome || d.fileName || d.nomeArquivo) : "Documento";
        const link = d && (d.url || d.link);
        const p = document.createElement("p");
        p.className = "mb-1 small";
        if (link) {
          const a = document.createElement("a");
          a.href = link;
          a.target = "_blank";
          a.rel = "noopener";
          a.textContent = name;
          p.appendChild(a);
        } else p.textContent = name;
        docsList.appendChild(p);
      });
    } else docsList.textContent = "—";
  }

  const cv = root.querySelector("#cvTextArea");
  if (cv) cv.value = c.cvText || "";

  host.appendChild(root);

  const bind = (id, fn) => {
    const el = root.querySelector("#" + id);
    if (el) el.addEventListener("click", fn);
  };

  const get = (id) => root.querySelector("#" + id);

  bind("btnRecalcOne", async () => {
    clearCacheFor(c.id, v.id);
    try {
      await callRecalculateMatch(c.id, v.id);
      const updated = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`);
      const mapped = mapApiCandidatoListItem(updated);
      updateCandidateState(mapped);
      toast("Recalculado e salvo.");
      renderList();
      renderDetail(mapped, host);
    } catch (err) {
      console.error(err);
      toast("Falha ao recalcular (use salvar no detalhe se o servidor não estiver disponível).");
      const result = calcMatch(c, v);
      try {
        const updated = await persistLastMatch(c, v, result);
        renderList();
        renderDetail(updated, host);
      } catch {
        renderList();
        renderDetail(c, host);
      }
    }
  });
  bind("btnClearCacheOne", () => {
    clearCacheFor(c.id, v.id);
    toast("Cache limpo (candidato/vaga).");
    renderList();
    renderDetail(c, host);
  });
  bind("btnSaveCvText", async () => {
    const txt = (get("cvTextArea")?.value || "");
    try {
      const updated = await updateCandidatoFromState(c, { cvText: txt });
      updateCandidateState(updated);
      clearCacheFor(updated.id, v.id);
      toast("Texto do CV salvo. Recalcule para atualizar o score.");
      renderList();
      renderDetail(updated, host);
    } catch (err) {
      console.error(err);
      toast("Falha ao salvar o texto do CV.");
    }
  });
  bind("btnClearCacheVaga", () => {
    clearCacheForVaga(v.id);
    toast("Cache limpo (vaga).");
    renderList();
    renderDetail(c, host);
  });
}

function openDetailModal(c) {
  const host = $("#detailModalBody");
  if (!host) return;
  renderDetail(c, host);
  const modalEl = $("#modalMatchingDetail");
  if (modalEl && window.bootstrap) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

// ========= Cache mgmt
function clearCacheFor(candId, vagaId) {
  const key = `${candId}|${vagaId}`;
  delete state.matchCache[key];
}
function clearCacheForVaga(vagaId) {
  Object.keys(state.matchCache).forEach(k => {
    if (k.endsWith("|" + vagaId)) delete state.matchCache[k];
  });
  state.suggestionsCache = null;
  state.rejectedCache = null;
}
function clearCacheAll() {
  state.matchCache = {};
  state.suggestionsCache = null;
  state.rejectedCache = null;
}

// ========= Wire
function initLogo() {
  const logoDesktop = $("#logoDesktop");
  if (logoDesktop) logoDesktop.src = LOGO_DATA_URI;
  const logoMobile = $("#logoMobile");
  if (logoMobile) logoMobile.src = LOGO_DATA_URI;
}
function wireClock() {
  const label = $("#nowLabel");
  if (!label) return;
  const tick = () => {
    const d = new Date();
    label.textContent = d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 1000 * 15);
}
function refreshEnumDefaults() {
  VAGA_ALL = enumFirstCode("vagaFilter", "all");
  STATUS_ALL = enumFirstCode("candidatoStatusFilter", "all");
  SORT_DEFAULT = enumFirstCode("matchingSort", "score_desc");
}

function resetFiltersUI() {
  state.filters = { q: "", vagaId: VAGA_ALL, status: STATUS_ALL, sort: SORT_DEFAULT };
  const search = $("#fSearch");
  if (search) search.value = "";
  const fVaga = $("#fVaga");
  if (fVaga) fVaga.value = VAGA_ALL;
  const fStatus = $("#fStatus");
  if (fStatus) fStatus.value = STATUS_ALL;
  const fSort = $("#fSort");
  if (fSort) fSort.value = SORT_DEFAULT;
}

function wireFilters() {
  const apply = () => {
    state.filters.q = ($("#fSearch").value || "").trim();
    state.filters.vagaId = window.__vagaMatchingId || ($("#fVaga").value || VAGA_ALL);
    state.filters.status = $("#fStatus").value || STATUS_ALL;
    state.filters.sort = $("#fSort").value || SORT_DEFAULT;
    renderList();
  };

  const applyWithVaga = async () => {
    state.filters.q = ($("#fSearch").value || "").trim();
    state.filters.vagaId = window.__vagaMatchingId || ($("#fVaga").value || VAGA_ALL);
    state.filters.status = $("#fStatus").value || STATUS_ALL;
    state.filters.sort = $("#fSort").value || SORT_DEFAULT;
    const vagaId = state.filters.vagaId;
    if (vagaId && vagaId !== VAGA_ALL) {
      await ensureVagaDetails(vagaId);
      await loadRankingForVaga(vagaId);
    } else {
      state.rankingCandidates = [];
      renderList();
    }
    renderVagaList();
  };

  $("#fSearch").addEventListener("input", apply);
  $("#fVaga").addEventListener("change", applyWithVaga);
  $("#fStatus").addEventListener("change", apply);
  $("#fSort").addEventListener("change", apply);

  /* RANKING_SIZE_OPTIONS removed
  const fRankingSize = document.getElementById("fRankingSize");
  if (fRankingSize) {
    fRankingSize.disabled = true;
    fRankingSize.parentElement.style.display = 'none'; // Hide if possible
  }
  */
}

// ---------- Modal Editar Filtros de Matching (mesmos campos da criação de vaga)
const UF_LIST = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
let editMatchingModalSelectsFilled = false;

function findEnumCodeByText(enumKey, text) {
  if (!text || typeof text !== "string") return null;
  const t = text.trim();
  if (!t) return null;
  const list = getEnumOptions(enumKey);
  const opt = list.find(o => (o.text || "").trim() === t || normalizeEnumCode(o.code) === normalizeEnumCode(t));
  return opt ? opt.code : null;
}

function fillEditMatchingModalSelects() {
  if (editMatchingModalSelectsFilled) return;
  const placeholder = "Qualquer";
  function fillEnum(selectId, enumKey) {
    const sel = $("#" + selectId);
    if (!sel) return;
    sel.replaceChildren();
    sel.appendChild(buildOption("", placeholder, true));
    getEnumOptions(enumKey).forEach(opt => sel.appendChild(buildOption(opt.code, opt.text)));
  }
  fillEnum("vagaMatchingModalidade", "vagaModalidade");
  fillEnum("vagaMatchingSenioridade", "vagaSenioridade");
  fillEnum("vagaMatchingEscolaridade", "vagaEscolaridade");
  fillEnum("vagaMatchingFormacaoArea", "vagaFormacaoArea");

  const selUf = $("#vagaMatchingUF");
  if (selUf) { selUf.replaceChildren(); selUf.appendChild(buildOption("", placeholder, true)); UF_LIST.forEach(uf => selUf.appendChild(buildOption(uf, uf))); }
  const selExp = $("#vagaMatchingExp");
  if (selExp) { selExp.replaceChildren(); selExp.appendChild(buildOption("", placeholder, true));[{ c: "0", t: "Sem experiencia" }, { c: "0-1", t: "0 a 1 ano" }, { c: "1-3", t: "1 a 3 anos" }, { c: "3-5", t: "3 a 5 anos" }, { c: "5+", t: "5 ou mais anos" }].forEach(o => selExp.appendChild(buildOption(o.c, o.t))); }
  const selSexo = $("#vagaMatchingSexo");
  if (selSexo) { selSexo.replaceChildren(); selSexo.appendChild(buildOption("", placeholder, true)); selSexo.appendChild(buildOption("M", "Masculino")); selSexo.appendChild(buildOption("F", "Feminino")); selSexo.appendChild(buildOption("O", "Outro / Nao informar")); }
  const selPcd = $("#vagaMatchingPcd");
  if (selPcd) { selPcd.replaceChildren(); selPcd.appendChild(buildOption("", placeholder, true)); selPcd.appendChild(buildOption("S", "Sim (preferencia PCD)")); selPcd.appendChild(buildOption("N", "Nao")); }
  const selCnh = $("#vagaMatchingCnhCategoria");
  if (selCnh) { selCnh.replaceChildren();["A", "B", "AB", "C", "D", "E"].forEach(cat => selCnh.appendChild(buildOption(cat, cat))); }

  const reqCnh = $("#vagaMatchingRequerCnh");
  const catWrap = document.querySelector(".vagaMatchingCnhCategoriaWrap");
  if (reqCnh && catWrap) {
    reqCnh.addEventListener("change", () => { catWrap.style.display = reqCnh.checked ? "" : "none"; });
  }
  editMatchingModalSelectsFilled = true;
}

function parseMatchingFiltrosRaw(raw) {
  const out = {
    modalidade: null, senioridade: null, escolaridade: null, formacaoArea: null,
    cidade: "", uf: "", tempoExp: "", sexo: "", pcd: "", idadeMin: "", idadeMax: "",
    requerCnh: false, cnhCategoria: "", habilidades: "", observacoes: ""
  };
  if (!raw || typeof raw !== "string") return out;
  const s = raw.trim();
  if (!s) return out;
  const observacoesParts = [];
  const rest = s.split(/\s*\.\s*/).filter(Boolean);
  const labelRegex = /^(Modalidade|Senioridade|Escolaridade|Forma[cç]ao|Cidade|UF|TempoExperiencia|Sexo|PCD|IdadeMin|IdadeMax|RequerCNH|CategoriaCNH|Habilidades|Observacoes|Observações)\s*:\s*(.+)$/i;
  for (const part of rest) {
    const match = part.match(labelRegex);
    if (!match) { observacoesParts.push(part); continue; }
    const label = match[1].toLowerCase().replace(/ç/g, "c");
    const value = match[2].trim();
    if (label === "modalidade") out.modalidade = findEnumCodeByText("vagaModalidade", value) || value;
    else if (label === "senioridade") out.senioridade = findEnumCodeByText("vagaSenioridade", value) || value;
    else if (label === "escolaridade") out.escolaridade = findEnumCodeByText("vagaEscolaridade", value) || value;
    else if (label === "formacao") out.formacaoArea = findEnumCodeByText("vagaFormacaoArea", value) || value;
    else if (label === "cidade") out.cidade = value;
    else if (label === "uf") out.uf = value;
    else if (label === "tempoexperiencia") out.tempoExp = value === "Sem experiencia" ? "0" : value === "0 a 1 ano" ? "0-1" : value === "1 a 3 anos" ? "1-3" : value === "3 a 5 anos" ? "3-5" : value === "5 ou mais anos" ? "5+" : ["0", "0-1", "1-3", "3-5", "5+"].includes(value) ? value : "";
    else if (label === "sexo") out.sexo = value === "Masculino" ? "M" : value === "Feminino" ? "F" : "O";
    else if (label === "pcd") out.pcd = value === "Sim" ? "S" : "N";
    else if (label === "idademin") out.idadeMin = value;
    else if (label === "idademax") out.idadeMax = value;
    else if (label === "requercnh") out.requerCnh = value === "Sim";
    else if (label === "categoriacnh") out.cnhCategoria = value;
    else if (label === "habilidades") out.habilidades = value;
    else if (label === "observacoes") out.observacoes = value;
  }
  if (observacoesParts.length) out.observacoes = (out.observacoes ? out.observacoes + " " : "") + observacoesParts.join(". ");
  return out;
}

function setEditMatchingFormFromParsed(parsed) {
  const setVal = (id, v) => { const el = $("#" + id); if (el) el.value = (v ?? ""); };
  const setChk = (id, v) => { const el = $("#" + id); if (el) el.checked = !!v; };
  setVal("vagaMatchingModalidade", parsed.modalidade ?? "");
  setVal("vagaMatchingSenioridade", parsed.senioridade ?? "");
  setVal("vagaMatchingEscolaridade", parsed.escolaridade ?? "");
  setVal("vagaMatchingFormacaoArea", parsed.formacaoArea ?? "");
  setVal("vagaMatchingCidade", parsed.cidade ?? "");
  setVal("vagaMatchingUF", parsed.uf ?? "");
  setVal("vagaMatchingExp", parsed.tempoExp ?? "");
  setVal("vagaMatchingSexo", parsed.sexo ?? "");
  setVal("vagaMatchingPcd", parsed.pcd ?? "");
  setVal("vagaMatchingIdadeMin", parsed.idadeMin ?? "");
  setVal("vagaMatchingIdadeMax", parsed.idadeMax ?? "");
  setChk("vagaMatchingRequerCnh", parsed.requerCnh);
  setVal("vagaMatchingCnhCategoria", parsed.cnhCategoria ?? "");
  setVal("vagaMatchingHabilidades", parsed.habilidades ?? "");
  setVal("vagaMatchingObs", parsed.observacoes ?? "");
  const catWrap = document.querySelector(".vagaMatchingCnhCategoriaWrap");
  if (catWrap) catWrap.style.display = parsed.requerCnh ? "" : "none";
}

function buildMatchingFiltrosRawFromForm() {
  const getVal = (id) => { const el = $("#" + id); return el ? (el.value ?? "").trim() : ""; };
  const getChk = (id) => { const el = $("#" + id); return el ? el.checked : false; };
  const parts = [];
  const modalidade = getVal("vagaMatchingModalidade");
  const senioridade = getVal("vagaMatchingSenioridade");
  const escolaridade = getVal("vagaMatchingEscolaridade");
  const formacao = getVal("vagaMatchingFormacaoArea");
  if (modalidade) parts.push("Modalidade: " + getEnumText("vagaModalidade", modalidade, modalidade));
  if (senioridade) parts.push("Senioridade: " + getEnumText("vagaSenioridade", senioridade, senioridade));
  if (escolaridade) parts.push("Escolaridade: " + getEnumText("vagaEscolaridade", escolaridade, escolaridade));
  if (formacao) parts.push("Formacao: " + getEnumText("vagaFormacaoArea", formacao, formacao));
  const cidade = getVal("vagaMatchingCidade");
  if (cidade) parts.push("Cidade: " + cidade);
  const uf = getVal("vagaMatchingUF");
  if (uf) parts.push("UF: " + uf);
  const tempoExp = getVal("vagaMatchingExp");
  if (tempoExp) parts.push("TempoExperiencia: " + (tempoExp === "0" ? "Sem experiencia" : tempoExp === "0-1" ? "0 a 1 ano" : tempoExp === "1-3" ? "1 a 3 anos" : tempoExp === "3-5" ? "3 a 5 anos" : tempoExp === "5+" ? "5 ou mais anos" : tempoExp));
  const sexo = getVal("vagaMatchingSexo");
  if (sexo) parts.push("Sexo: " + (sexo === "M" ? "Masculino" : sexo === "F" ? "Feminino" : "Outro"));
  const pcd = getVal("vagaMatchingPcd");
  if (pcd) parts.push("PCD: " + (pcd === "S" ? "Sim" : "Nao"));
  const idadeMin = getVal("vagaMatchingIdadeMin");
  if (idadeMin) parts.push("IdadeMin: " + idadeMin);
  const idadeMax = getVal("vagaMatchingIdadeMax");
  if (idadeMax) parts.push("IdadeMax: " + idadeMax);
  const requerCnh = getChk("vagaMatchingRequerCnh");
  if (requerCnh) parts.push("RequerCNH: Sim");
  const cnhCat = getVal("vagaMatchingCnhCategoria");
  if (requerCnh && cnhCat) parts.push("CategoriaCNH: " + cnhCat);
  const habilidades = getVal("vagaMatchingHabilidades");
  if (habilidades) parts.push("Habilidades: " + habilidades);
  const obs = getVal("vagaMatchingObs");
  if (obs) parts.push("Observacoes: " + obs);
  return parts.length ? parts.join(". ") : null;
}

function wireButtons() {
  const recalc = $("#btnRecalcAll");
  if (recalc) {
    recalc.addEventListener("click", async () => {
      const list = getFiltered();
      let n = 0;
      for (const c of list) {
        const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
        if (!v) continue;
        clearCacheFor(c.id, v.id);
        const result = calcMatch(c, v);
        try {
          await persistLastMatch(c, v, result);
          n++;
        } catch (err) {
          console.error(err);
        }
      }
      toast(`Recalculado e salvo: ${n} candidato(s).`);
      renderList();
    });
  }

  const modalEditFiltros = $("#modalEditMatchingFiltros");
  const btnEdit = $("#btnEditMatchingFiltros");
  const btnSave = $("#btnSaveMatchingFiltros");
  const btnRevert = $("#btnRevertMatchingFiltros");

  if (btnEdit && modalEditFiltros) {
    btnEdit.addEventListener("click", () => {
      const vagaId = state.filters.vagaId;
      if (!vagaId || vagaId === VAGA_ALL) return;
      fillEditMatchingModalSelects();
      const v = findVaga(vagaId);
      const raw = (v && v.matchingFiltrosRaw != null) ? String(v.matchingFiltrosRaw) : "";
      const parsed = parseMatchingFiltrosRaw(raw);
      setEditMatchingFormFromParsed(parsed);
      if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEditFiltros).show();
    });
  }
  if (btnSave && modalEditFiltros) {
    btnSave.addEventListener("click", async () => {
      const vagaId = state.filters.vagaId;
      if (!vagaId || vagaId === VAGA_ALL) return;
      const value = buildMatchingFiltrosRawFromForm();
      try {
        const data = await apiFetchJson(`${VAGAS_API_URL}/${vagaId}/matching-filtros`, {
          method: "PATCH",
          body: JSON.stringify({ matchingFiltrosRaw: value || null })
        });
        if (data) state.vagaDetails[vagaId] = mapApiVagaDetail(data);
        if (state.vagas) {
          const idx = state.vagas.findIndex(x => x.id === vagaId);
          if (idx >= 0 && data) state.vagas[idx] = { ...state.vagas[idx], ...mapApiVagaListItem(data) };
        }
        if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modalEditFiltros).hide();
        toast("Filtros de matching salvos.");
        renderList();
      } catch (err) {
        console.error(err);
        toast("Falha ao salvar filtros.");
      }
    });
  }
  if (btnRevert) {
    btnRevert.addEventListener("click", async () => {
      const vagaId = state.filters.vagaId;
      if (!vagaId || vagaId === VAGA_ALL) return;
      const v = findVaga(vagaId);
      const value = (v && v.matchingFiltrosOriginaisRaw != null) ? String(v.matchingFiltrosOriginaisRaw) : "";
      try {
        const data = await apiFetchJson(`${VAGAS_API_URL}/${vagaId}/matching-filtros`, {
          method: "PATCH",
          body: JSON.stringify({ matchingFiltrosRaw: value || null })
        });
        if (data) state.vagaDetails[vagaId] = mapApiVagaDetail(data);
        if (state.vagas) {
          const idx = state.vagas.findIndex(x => x.id === vagaId);
          if (idx >= 0 && data) state.vagas[idx] = { ...state.vagas[idx], ...mapApiVagaListItem(data) };
        }
        toast("Filtros revertidos para os da criação.");
        renderList();
      } catch (err) {
        console.error(err);
        toast("Falha ao reverter filtros.");
      }
    });
  }
}

// ========= Init

(async function init() {
  initLogo();
  wireClock();

  await ensureEnumData();
  refreshEnumDefaults();
  applyEnumSelects();

  try {
    const [vagas, candidatos] = await Promise.all([fetchVagas(), fetchCandidatos()]);
    state.vagas = vagas;
    state.candidatos = candidatos;
  } catch (err) {
    console.error(err);
    toast("Falha ao carregar dados do matching.");
  }

  if (!state.vagas.length) {
    toast("Nenhuma vaga encontrada. Crie uma vaga em Vagas para testar o matching.");
  }

  await preloadVagaDetails();
  renderVagaFilter();
  renderVagaList();
  resetFiltersUI();

  const fixedVagaId = (typeof window.__vagaMatchingId !== "undefined" && window.__vagaMatchingId !== null && String(window.__vagaMatchingId).trim() !== "") ? String(window.__vagaMatchingId).trim() : null;
  if (fixedVagaId) {
    state.filters.vagaId = fixedVagaId;
    const wrap = document.getElementById("matchingVagaSelectorWrap");
    if (wrap) wrap.style.display = "none";
    const fVagaEl = document.getElementById("fVaga");
    if (fVagaEl) fVagaEl.value = fixedVagaId;
    await ensureVagaDetails(fixedVagaId);
    await loadRankingForVaga(fixedVagaId);
    const vagaHeader = $("#vagaHeader");
    const titleActions = $("#matchingPageTitleActions");
    if (vagaHeader) vagaHeader.classList.remove("d-none");
    if (titleActions) titleActions.classList.remove("d-none");
  }

  state.selectedId = state.candidatos[0]?.id || null;

  wireFilters();
  wireButtons();

  renderList();
})();

async function reproveCandidate(id, source) {
  if (!confirm("Tem certeza que deseja reprovar este candidato?")) return;
  const vagaId = state.filters.vagaId;
  if (!vagaId || vagaId === VAGA_ALL) return;
  const item = state.rankingCandidates.find(x => x.id === id);

  try {
    if (source === "talento") {
      // Convert Talento to Candidate with Reprovado
      const talento = item;
      await apiFetchJson(CANDIDATOS_API_URL, {
        method: "POST",
        body: JSON.stringify({
          talentoId: id,
          vagaId: vagaId,
          status: "Reprovado",
          nome: talento?.nome || "Talento",
          email: talento?.email || "placeholder@email.com"
        })
      });
    } else {
      // Update existing
      const cand = await apiFetchJson(`${CANDIDATOS_API_URL}/${id}`);
      if (cand) {
        cand.status = "Reprovado";
        await apiFetchJson(`${CANDIDATOS_API_URL}/${id}`, {
          method: "PUT",
          body: JSON.stringify(cand)
        });
      }
    }
    if (typeof toast === "function") toast("Candidato reprovado.");
    state.suggestionsCache = null;
    state.rejectedCache = null;
    await loadRankingForVaga(vagaId, true);
  } catch (err) {
    console.error(err);
    if (typeof toast === "function") toast("Erro ao reprovar: " + (err.message || err));
    // Rollback if needed?
    // For now simple alert
  }
}
