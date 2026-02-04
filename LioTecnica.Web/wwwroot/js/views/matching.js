// ========= Logo (Data URI placeholder)
const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";
const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";
const CANDIDATOS_API_URL = window.__candidatosApiUrl || "/api/candidatos";
const MATCHING_RECALC_URL = (window.__apiBase || "") + "/api/matching/recalculate";

function enumFirstCode(key, fallback){
  const list = getEnumOptions(key);
  return list.length ? list[0].code : fallback;
}

let VAGA_ALL = enumFirstCode("vagaFilter", "all");
let STATUS_ALL = enumFirstCode("candidatoStatusFilter", "all");
let SORT_DEFAULT = enumFirstCode("matchingSort", "score_desc");
const EMPTY_TEXT = "—";
const BULLET = "-";

const state = {
  vagas: [],
  candidatos: [],
  vagaDetails: {},
  matchCache: {}, // { "<candId>|<vagaId>": {score, pass, hits[], missMandatory[], at} }
  selectedId: null,
  filters: { q:"", vagaId: VAGA_ALL, status: STATUS_ALL, sort: SORT_DEFAULT }
};

function normalizeEnumCode(value){
  return (value ?? "").toString().trim().toLowerCase();
}

function parsePeso(value){
  if(value == null) return 0;
  if(typeof value === "number" && Number.isFinite(value)) return value;
  const text = getEnumText("vagaPeso", value, "");
  const num = parseInt(text, 10);
  if(Number.isFinite(num)) return num;
  const raw = parseInt((value ?? "").toString().trim(), 10);
  return Number.isFinite(raw) ? raw : 0;
}

async function apiFetchJson(url, options = {}){
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  const hasBody = options.body !== undefined && options.body !== null;
  if(hasBody && !headers.has("Content-Type")){
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "same-origin"
  });

  if(response.status === 401){
    const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/Account/Login?returnUrl=${returnUrl}`;
    throw new Error("Unauthorized");
  }

  if(!response.ok){
    let detail = `Falha ao buscar dados: ${response.status}`;
    try{
      const data = await response.json();
      if(data?.detail) detail = data.detail;
      if(data?.title) detail = data.title;
    }catch{
      // ignore
    }
    throw new Error(detail);
  }

  if(response.status === 204) return null;
  return response.json();
}

function setText(root, role, value, fallback = EMPTY_TEXT){
  if(!root) return;
  const el = root.querySelector(`[data-role="${role}"]`);
  if(!el) return;
  el.textContent = (value ?? fallback);
}

function buildTag(iconClass, text, cls){
  const tag = cloneTemplate("tpl-matching-tag");
  if(!tag) return document.createElement("span");
  tag.classList.toggle("ok", cls === "ok");
  tag.classList.toggle("warn", cls === "warn");
  tag.classList.toggle("bad", cls === "bad");
  const icon = tag.querySelector('[data-role="icon"]');
  if(icon) icon.className = "bi " + iconClass;
  const label = tag.querySelector('[data-role="text"]');
  if(label) label.textContent = text || "";
  return tag;
}

function buildStatusTag(status){
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

function buildMatchTag(score, thr){
  const s = clamp(parseInt(score||0,10)||0,0,100);
  const t = clamp(parseInt(thr||0,10)||0,0,100);
  const ok = s >= t;
  const cls = ok ? "ok" : (s >= (t*0.8) ? "warn" : "bad");
  const text = ok ? "Dentro" : "Abaixo";
  return buildTag("bi-stars", `${s}% ${BULLET} ${text}`, cls);
}

function mapApiVagaListItem(v){
  return {
    id: v.id,
    codigo: v.codigo ?? "",
    titulo: v.titulo ?? "",
    status: normalizeEnumCode(v.status),
    threshold: Number.isFinite(+v.matchMinimoPercentual) ? +v.matchMinimoPercentual : 0,
    requisitos: []
  };
}

function mapApiVagaDetail(v){
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
    requisitos
  };
}

function mapApiCandidatoListItem(c){
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

async function fetchVagas(){
  const list = await apiFetchJson(VAGAS_API_URL);
  return Array.isArray(list) ? list.map(mapApiVagaListItem) : [];
}

async function fetchCandidatos(){
  const list = await apiFetchJson(CANDIDATOS_API_URL);
  return Array.isArray(list) ? list.map(mapApiCandidatoListItem) : [];
}

async function ensureVagaDetails(vagaId){
  if(!vagaId || vagaId === VAGA_ALL) return;
  if(state.vagaDetails[vagaId]) return;
  try{
    const data = await apiFetchJson(`${VAGAS_API_URL}/${vagaId}`);
    state.vagaDetails[vagaId] = mapApiVagaDetail(data);
  }catch(err){
    console.error("Falha ao carregar detalhes da vaga:", err);
  }
}

async function preloadVagaDetails(){
  const ids = new Set(state.candidatos.map(c => c.vagaId).filter(Boolean));
  if(!ids.size) return;
  await Promise.allSettled(Array.from(ids).map(id => ensureVagaDetails(id)));
}

function findVaga(id){
  return state.vagaDetails[id] || state.vagas.find(v => v.id === id) || null;
}

function findCand(id){
  return state.candidatos.find(c => c.id === id) || null;
}

// ========= Matching engine
function calcMatch(cand, vaga){
  if(!cand || !vaga) return { score: 0, pass:false, hits:[], missMandatory:[], totalPeso:1, hitPeso:0, threshold: 0 };

  const key = `${cand.id}|${vaga.id}`;
  const cached = state.matchCache[key];
  if(cached && cached.score != null && cached.hits && cached.missMandatory){
    return { ...cached, fromCache: true };
  }

  const text = normalizeText(cand.cvText || "");
  const reqs = (vaga.requisitos || []);
  const totalPeso = reqs.reduce((acc, r)=> acc + clamp(parsePeso(r.peso||0),0,10), 0) || 1;

  let hitPeso = 0;
  const hits = [];
  const missMandatory = [];

  reqs.forEach(r => {
    const termo = normalizeText(r.termo || "");
    const syns = (r.sinonimos || []).map(normalizeText).filter(Boolean);
    const bag = [termo, ...syns].filter(Boolean);

    const found = bag.some(t => t && text.includes(t));
    const p = clamp(parsePeso(r.peso||0),0,10);

    if(found){
      hitPeso += p;
      hits.push({ ...r });
    }else if(r.obrigatorio){
      missMandatory.push({ ...r });
    }
  });

  let score = Math.round((hitPeso / totalPeso) * 100);
  if(missMandatory.length){
    score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
  }

  const threshold = clamp(parseInt(vaga.threshold||0,10)||0,0,100);
  const pass = score >= threshold;

  const result = { score, pass, hits, missMandatory, totalPeso, hitPeso, threshold, at: new Date().toISOString() };
  state.matchCache[key] = result;

  return { ...result, fromCache: false };
}

// ========= Filters
function getFiltered(){
  const q = (state.filters.q||"").trim().toLowerCase();
  const vid = state.filters.vagaId;
  const st = state.filters.status;

  return state.candidatos.filter(c => {
    if(vid !== "all" && c.vagaId !== vid) return false;
    if(st !== "all" && normalizeEnumCode(c.status) !== normalizeEnumCode(st)) return false;

    if(!q) return true;
    const v = findVaga(c.vagaId);
    const blob = [c.nome,c.email,c.fone,c.cidade,c.uf,c.fonte,c.status,v?.titulo,v?.codigo,c.cvText].join(" ").toLowerCase();
    return blob.includes(q);
  });
}

function sortList(list){
  const s = state.filters.sort;
  const vid = state.filters.vagaId;

  if(s.startsWith("score_")){
    // se vaga for "all", usa a vaga do candidato
    const scored = list.map(c => {
      const v = vid === "all" ? findVaga(c.vagaId) : findVaga(vid);
      const m = v ? calcMatch(c, v) : { score: 0, threshold: 0, pass:false, hits:[], missMandatory:[] };
      return { c, m };
    });

    scored.sort((a,b) => {
      const diff = (a.m.score||0) - (b.m.score||0);
      return s === "score_asc" ? diff : -diff;
    });

    return scored.map(x => x.c);
  }

  if(s === "updated_desc"){
    return list.slice().sort((a,b) => (new Date(b.updatedAt||0)) - (new Date(a.updatedAt||0)));
  }
  if(s === "updated_asc"){
    return list.slice().sort((a,b) => (new Date(a.updatedAt||0)) - (new Date(b.updatedAt||0)));
  }
  if(s === "name_asc"){
    return list.slice().sort((a,b) => (a.nome||"").localeCompare((b.nome||""),"pt-BR"));
  }
  return list;
}

function distinctVagas(){
  return state.vagas
    .map(v => {
      const title = v.titulo || EMPTY_TEXT;
      const code = v.codigo || EMPTY_TEXT;
      return { id: v.id, label: `${title} (${code})` };
    })
    .sort((a,b)=>a.label.localeCompare(b.label, "pt-BR"));
}

function renderVagaFilter(){
  const sel = $("#fVaga");
  if(!sel) return;
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

// ========= Render list
function renderList(){
  const filtered = sortList(getFiltered());
  $("#listCount").textContent = filtered.length;
  $("#kpiTotal").textContent = filtered.length;

  let inside = 0, mandatoryFail = 0, sum = 0, countScored = 0;
  filtered.forEach(c => {
    const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
    if(!v) return;
    const m = calcMatch(c, v);
    countScored++;
    sum += (m.score||0);
    if(m.pass) inside++;
    if((m.missMandatory||[]).length) mandatoryFail++;
  });

  $("#kpiInside").textContent = inside;
  $("#kpiMandatoryFail").textContent = mandatoryFail;
  $("#kpiAvg").textContent = countScored ? (Math.round(sum / countScored) + "%") : "0%";

  const visibleIds = new Set(filtered.map(x => x.id));
  if(state.selectedId && !visibleIds.has(state.selectedId)){
    state.selectedId = null;
  }
  if(!state.selectedId && filtered[0]){
    state.selectedId = filtered[0].id;
  }

  const host = $("#candList");
  host.replaceChildren();
  if(!filtered.length){
    const empty = cloneTemplate("tpl-matching-empty");
    if(empty) host.appendChild(empty);
  }else{
    filtered.forEach(c => {
      const item = buildListItem(c);
      if(item) host.appendChild(item);
    });
  }

}

function buildListItem(c){
  const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
  const m = v ? calcMatch(c, v) : { score: 0, threshold: 0, pass:false, hits:[], missMandatory:[] };

  const item = cloneTemplate("tpl-matching-item");
  if(!item) return null;
  item.dataset.id = c.id;
  if(c.id === state.selectedId) item.classList.add("active");

  setText(item, "item-initials", initials(c.nome));
  setText(item, "item-name", c.nome);
  setText(item, "item-email", c.email);

  const vagaCode = item.querySelector('[data-role="item-vaga-code"]');
  if(vagaCode){
    const codeText = v ? (v.codigo || EMPTY_TEXT) : (c.vagaCodigo || "Sem vaga");
    vagaCode.textContent = codeText;
    vagaCode.classList.toggle("mono", !!codeText);
  }
  const vagaTitle = v ? v.titulo : (c.vagaTitulo || EMPTY_TEXT);
  setText(item, "item-vaga-title", vagaTitle);

  const score = clamp(parseInt(m.score||0,10)||0,0,100);
  const progress = item.querySelector('[data-role="item-progress"]');
  if(progress) progress.style.width = `${score}%`;
  setText(item, "item-score", `${score}%`);

  const tagsHost = item.querySelector('[data-role="item-tags"]');
  if(tagsHost){
    tagsHost.replaceChildren();
    tagsHost.appendChild(buildMatchTag(m.score, m.threshold));

    const missCount = (m.missMandatory||[]).length;
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

function buildReqRow(r, hitIds, missIds){
  const isHit = hitIds.has(r.id);
  const isMiss = missIds.has(r.id);
  const row = cloneTemplate("tpl-matching-req-row");
  if(!row) return null;

  if(isHit) row.classList.add("hit");
  if(isMiss) row.classList.add("miss");

  const icon = row.querySelector('[data-role="req-icon"]');
  if(icon) icon.className = "bi bi-" + (isHit ? "check2-circle" : (isMiss ? "x-circle" : "dash-circle"));

  setText(row, "req-term", r.termo);
  setText(row, "req-weight", clamp(parsePeso(r.peso||0),0,10));

  const obrigEl = row.querySelector('[data-role="req-obrig"]');
  if(obrigEl){
    obrigEl.textContent = r.obrigatorio ? "obrigatorio" : "desejavel";
    obrigEl.classList.toggle("text-danger", !!r.obrigatorio);
    obrigEl.classList.toggle("fw-semibold", !!r.obrigatorio);
  }

  const syn = (r.sinonimos || []).join(", ");
  setText(row, "req-syn", syn);
  toggleRole(row, "req-syn-wrap", !!syn);

  const tagHost = row.querySelector('[data-role="req-tag-host"]');
  if(tagHost){
    const tag = isHit ? buildTag("bi-check2", "OK", "ok") :
                (isMiss ? buildTag("bi-x-lg", "Faltando", "bad") : buildTag("bi-dash", "Nao achou", ""));
    tagHost.replaceChildren(tag);
  }

  return row;
}

function buildCandidatoPayload(c, overrides = {}){
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

async function updateCandidatoFromState(c, overrides = {}){
  const payload = buildCandidatoPayload(c, overrides);
  const data = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
  return mapApiCandidatoListItem(data);
}

function updateCandidateState(updated){
  const idx = state.candidatos.findIndex(c => c.id === updated.id);
  if(idx >= 0){
    state.candidatos[idx] = updated;
  }
}

async function persistLastMatch(c, vaga, matchResult){
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

async function callRecalculateMatch(candidatoId, vagaId){
  const qs = new URLSearchParams({ candidatoId, vagaId });
  const res = await fetch(`${MATCHING_RECALC_URL}?${qs}`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Accept": "application/json" }
  });
  if(!res.ok) throw new Error(`Recalcular falhou: ${res.status}`);
}

// ========= Detail
function renderDetail(c, host){
  if(!host) return;
  host.replaceChildren();

  if(!c){
    const empty = cloneTemplate("tpl-matching-detail-empty");
    if(empty) host.appendChild(empty);
    return;
  }

  const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
  if(!v){
    const empty = cloneTemplate("tpl-matching-detail-novaga");
    if(empty) host.appendChild(empty);
    return;
  }

  const m = calcMatch(c, v);
  const miss = (m.missMandatory||[]);
  const hits = (m.hits||[]);
  const reqs = (v.requisitos||[]);

  const hitIds = new Set(hits.map(x => x.id));
  const missIds = new Set(miss.map(x => x.id));

  const root = cloneTemplate("tpl-matching-detail");
  if(!root) return;

  setText(root, "detail-initials", initials(c.nome));
  setText(root, "detail-name", c.nome);
  setText(root, "detail-email", c.email);
  setText(root, "detail-updated", fmtDate(c.updatedAt));

  const matchTagHost = root.querySelector('[data-role="detail-match-tag"]');
  if(matchTagHost) matchTagHost.replaceChildren(buildMatchTag(m.score, m.threshold));

  const thrVal = clamp(parseInt(m.threshold||0,10)||0,0,100);
  setText(root, "detail-thr", `${thrVal}%`);

  const cacheIcon = root.querySelector('[data-role="detail-cache-icon"]');
  if(cacheIcon) cacheIcon.className = m.fromCache ? "bi bi-hdd me-1" : "bi bi-cpu me-1";
  setText(root, "detail-cache-text", m.fromCache ? "cache" : "calculado");

  setText(root, "detail-vaga-title", v.titulo);
  setText(root, "detail-vaga-code", v.codigo);
  setText(root, "detail-req-count", reqs.length);
  setText(root, "detail-hit-count", hits.length);
  setText(root, "detail-miss-count", miss.length);

  const score = clamp(parseInt(m.score||0,10)||0,0,100);
  setText(root, "detail-score", `${score}%`);
  const scoreBar = root.querySelector('[data-role="detail-score-bar"]');
  if(scoreBar) scoreBar.style.width = `${score}%`;

  const reqHost = root.querySelector("#reqList");
  if(reqHost){
    reqHost.replaceChildren();
    reqs.forEach(r => {
      const row = buildReqRow(r, hitIds, missIds);
      if(row) reqHost.appendChild(row);
    });
  }

  setText(root, "detail-hitPeso", m.hitPeso);
  setText(root, "detail-totalPeso", m.totalPeso);
  const penalty = miss.length ? ("-" + Math.min(40, miss.length*15)) : "0";
  setText(root, "detail-penalty", penalty);

  const cv = root.querySelector("#cvTextArea");
  if(cv) cv.value = c.cvText || "";

  host.appendChild(root);

  const bind = (id, fn) => {
    const el = root.querySelector("#" + id);
    if(el) el.addEventListener("click", fn);
  };

  const get = (id) => root.querySelector("#" + id);

  bind("btnRecalcOne", async () => {
    clearCacheFor(c.id, v.id);
    try{
      await callRecalculateMatch(c.id, v.id);
      const updated = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`);
      const mapped = mapApiCandidatoListItem(updated);
      updateCandidateState(mapped);
      toast("Recalculado e salvo.");
      renderList();
      renderDetail(mapped, host);
    }catch(err){
      console.error(err);
      toast("Falha ao recalcular (use salvar no detalhe se o servidor não estiver disponível).");
      const result = calcMatch(c, v);
      try{
        const updated = await persistLastMatch(c, v, result);
        renderList();
        renderDetail(updated, host);
      }catch{
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
    try{
      const updated = await updateCandidatoFromState(c, { cvText: txt });
      updateCandidateState(updated);
      clearCacheFor(updated.id, v.id);
      toast("Texto do CV salvo. Recalcule para atualizar o score.");
      renderList();
      renderDetail(updated, host);
    }catch(err){
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

function openDetailModal(c){
  const host = $("#detailModalBody");
  if(!host) return;
  renderDetail(c, host);
  const modalEl = $("#modalMatchingDetail");
  if(modalEl && window.bootstrap){
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

// ========= Cache mgmt
function clearCacheFor(candId, vagaId){
  const key = `${candId}|${vagaId}`;
  delete state.matchCache[key];
}
function clearCacheForVaga(vagaId){
  Object.keys(state.matchCache).forEach(k => {
    if(k.endsWith("|"+vagaId)) delete state.matchCache[k];
  });
}
function clearCacheAll(){
  state.matchCache = {};
}

// ========= Wire
function initLogo(){
  const logoDesktop = $("#logoDesktop");
  if(logoDesktop) logoDesktop.src = LOGO_DATA_URI;
  const logoMobile = $("#logoMobile");
  if(logoMobile) logoMobile.src = LOGO_DATA_URI;
}
function wireClock(){
  const label = $("#nowLabel");
  if(!label) return;
  const tick = () => {
    const d = new Date();
    label.textContent = d.toLocaleString("pt-BR", { weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
  };
  tick();
  setInterval(tick, 1000*15);
}
function refreshEnumDefaults(){
  VAGA_ALL = enumFirstCode("vagaFilter", "all");
  STATUS_ALL = enumFirstCode("candidatoStatusFilter", "all");
  SORT_DEFAULT = enumFirstCode("matchingSort", "score_desc");
}

function resetFiltersUI(){
  state.filters = { q:"", vagaId: VAGA_ALL, status: STATUS_ALL, sort: SORT_DEFAULT };
  const search = $("#fSearch");
  if(search) search.value = "";
  const fVaga = $("#fVaga");
  if(fVaga) fVaga.value = VAGA_ALL;
  const fStatus = $("#fStatus");
  if(fStatus) fStatus.value = STATUS_ALL;
  const fSort = $("#fSort");
  if(fSort) fSort.value = SORT_DEFAULT;
}

function wireFilters(){
  const apply = () => {
    state.filters.q = ($("#fSearch").value || "").trim();
    state.filters.vagaId = $("#fVaga").value || VAGA_ALL;
    state.filters.status = $("#fStatus").value || STATUS_ALL;
    state.filters.sort = $("#fSort").value || SORT_DEFAULT;
    renderList();
  };

  const applyWithVaga = async () => {
    state.filters.q = ($("#fSearch").value || "").trim();
    state.filters.vagaId = $("#fVaga").value || VAGA_ALL;
    state.filters.status = $("#fStatus").value || STATUS_ALL;
    state.filters.sort = $("#fSort").value || SORT_DEFAULT;
    await ensureVagaDetails(state.filters.vagaId);
    renderList();
  };

  $("#fSearch").addEventListener("input", apply);
  $("#fVaga").addEventListener("change", applyWithVaga);
  $("#fStatus").addEventListener("change", apply);
  $("#fSort").addEventListener("change", apply);
}

function wireButtons(){
  const recalc = $("#btnRecalcAll");
  if(recalc){
    recalc.addEventListener("click", async () => {
      const list = getFiltered();
      let n = 0;
      for(const c of list){
        const v = state.filters.vagaId === "all" ? findVaga(c.vagaId) : findVaga(state.filters.vagaId);
        if(!v) continue;
        clearCacheFor(c.id, v.id);
        const result = calcMatch(c, v);
        try{
          await persistLastMatch(c, v, result);
          n++;
        }catch(err){
          console.error(err);
        }
      }
      toast(`Recalculado e salvo: ${n} candidato(s).`);
      renderList();
    });
  }
}

// ========= Init
(async function init(){
  initLogo();
  wireClock();

  await ensureEnumData();
  refreshEnumDefaults();
  applyEnumSelects();

  try{
    const [vagas, candidatos] = await Promise.all([fetchVagas(), fetchCandidatos()]);
    state.vagas = vagas;
    state.candidatos = candidatos;
  }catch(err){
    console.error(err);
    toast("Falha ao carregar dados do matching.");
  }

  if(!state.vagas.length){
    toast("Nenhuma vaga encontrada. Crie na tela de Vagas.");
  }

  await preloadVagaDetails();
  renderVagaFilter();
  resetFiltersUI();

  state.selectedId = state.candidatos[0]?.id || null;

  wireFilters();
  wireButtons();

  renderList();
})();
