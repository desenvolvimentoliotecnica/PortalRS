// ========= Logo (mesmo Data URI usado antes)
    const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";

    const CANDIDATOS_API_URL = window.__candidatosApiUrl || "/api/candidatos";
    const VAGAS_API_URL = window.__vagasApiUrl || "/api/vagas";

    function enumFirstCode(key, fallback){
      const list = getEnumOptions(key);
      return list.length ? list[0].code : fallback;
    }

    let VAGA_ALL = enumFirstCode("vagaFilter", "all");
    let SELECT_PLACEHOLDER = enumFirstCode("selectPlaceholder", "");
    let DEFAULT_CAND_FONTE = enumFirstCode("candidatoFonte", "email");
    let DEFAULT_CAND_STATUS = enumFirstCode("candidatoStatus", "novo");
    const EMPTY_TEXT = "\u2014";
    const BULLET = "\u2022";

    function toUiStatus(value){
      const text = (value ?? "").toString().trim();
      return text ? text.toLowerCase() : DEFAULT_CAND_STATUS;
    }

    function toApiStatus(value){
      const text = (value ?? DEFAULT_CAND_STATUS).toString().trim().toLowerCase();
      return text || DEFAULT_CAND_STATUS;
    }

    const state = {
      vagas: [],
      candidatos: [],
      selectedId: null,
      filters: { q:"", status:"all", vagaId:"all" },
      pendingDocs: [],
      pendingDocsCandidateId: null,
      matchRenderToken: 0
    };
    const detailLoads = new Set();
    const detailLoaded = new Set();
    const vagaDetailLoads = new Set();
    const vagaDetailLoaded = new Set();

    function formatFileSize(bytes){
      if(bytes === null || bytes === undefined) return EMPTY_TEXT;
      const value = Number(bytes);
      if(Number.isNaN(value) || value <= 0) return "0 KB";
      const kb = value / 1024;
      if(kb < 1024) return `${kb.toFixed(1)} KB`;
      const mb = kb / 1024;
      if(mb < 1024) return `${mb.toFixed(1)} MB`;
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB`;
    }

    function createPendingId(){
      const rand = Math.random().toString(16).slice(2);
      return `pending-${Date.now()}-${rand}`;
    }

    function resetPendingDocs(){
      state.pendingDocs = [];
      state.pendingDocsCandidateId = null;
    }

    function setText(root, role, value, fallback = EMPTY_TEXT){
      if(!root) return;
      const el = root.querySelector(`[data-role="${role}"]`);
      if(!el) return;
      el.textContent = (value ?? fallback);
    }

    function setTextLines(root, role, value){
      if(!root) return;
      const el = root.querySelector(`[data-role="${role}"]`);
      if(!el) return;
      const raw = (value ?? "").toString();
      const parts = raw
        .split(/\r?\n|\s*\|\s*/g)
        .map(item => item.trim())
        .filter(Boolean);
      if(!parts.length){
        el.textContent = EMPTY_TEXT;
        return;
      }
      el.replaceChildren(...parts.map(text => {
        const line = document.createElement("div");
        line.textContent = text;
        return line;
      }));
    }

    function toBadgeCode(value){
      const text = (value || "").toString().toUpperCase().replace(/[^A-Z]/g, "");
      if(!text) return "";
      if(text.length === 1) return text + text;
      return text.slice(0, 2);
    }

    function applyInitialsBadge(el, initialsText){
      if(!el) return;
      const code = toBadgeCode(initialsText);
      const oldClasses = Array.from(el.classList).filter(cls => /^badge-[A-Z]{2}$/.test(cls));
      oldClasses.forEach(cls => el.classList.remove(cls));

      if(!code){
        el.classList.remove("avatar-badge");
        return;
      }

      el.classList.add("avatar-badge", `badge-${code}`);
    }

    function buildStatusTag(status){
      const key = (status || "").toString().toLowerCase();
      const map = {
        novo: { cls:"" },
        triagem: { cls:"warn" },
        aprovado: { cls:"ok" },
        reprovado: { cls:"bad" },
        pendente: { cls:"warn" }
      };
      const it = map[key] || { cls:"" };
      const labelText = getEnumText("candidatoStatus", key, status);
      const tag = cloneTemplate("tpl-cand-status-tag");
      if(!tag) return document.createElement("span");
      tag.classList.toggle("ok", it.cls === "ok");
      tag.classList.toggle("warn", it.cls === "warn");
      tag.classList.toggle("bad", it.cls === "bad");
      const icon = tag.querySelector('[data-role="icon"]');
      if(icon) icon.className = "bi bi-dot";
      const text = tag.querySelector('[data-role="text"]');
      if(text) text.textContent = labelText || "";
      return tag;
    }

    async function apiFetchJson(url, options = {}){
      const opts = { ...options };
      const headers = { "Accept": "application/json", ...(opts.headers || {}) };
      const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
      if(opts.body && !headers["Content-Type"] && !isFormData){
        headers["Content-Type"] = "application/json";
      }
      const baseUrl = (window.__apiBaseUrl || "").replace(/\/$/, "");
      const targetUrl = (baseUrl && url.startsWith("/")) ? `${baseUrl}${url}` : url;

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(opts.method || "GET", targetUrl, true);
        xhr.withCredentials = true;
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
        if(headers["X-LT-Silent"] || headers["x-lt-silent"]){
          xhr._ltTrack = false;
        }
        xhr.timeout = 20000;
        xhr.onload = () => {
          const status = xhr.status;
          if(status >= 200 && status < 300){
            if(status === 204 || !xhr.responseText) return resolve(null);
            try{
              return resolve(JSON.parse(xhr.responseText));
            }catch(err){
              return reject(err);
            }
          }
          return reject(new Error(xhr.responseText || `Falha na API (${status}).`));
        };
        xhr.onerror = () => reject(new Error("Falha de rede."));
        xhr.ontimeout = () => reject(new Error("Timeout ao chamar API."));
        xhr.send(opts.body || null);
      });
    }

    function mapPesoToNumber(peso){
      if(typeof peso === "number") return peso;
      const text = getEnumText("vagaPeso", peso, peso);
      const match = (text ?? "").toString().match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    }

    function refreshEnumDefaults(){
      VAGA_ALL = enumFirstCode("vagaFilter", "all");
      SELECT_PLACEHOLDER = enumFirstCode("selectPlaceholder", "");
      DEFAULT_CAND_FONTE = enumFirstCode("candidatoFonte", "email");
      DEFAULT_CAND_STATUS = enumFirstCode("candidatoStatus", "novo");
    }

    function mapVagaFromList(api){
      if(!api) return null;
      return {
        id: api.id,
        codigo: api.codigo || "",
        titulo: api.titulo || "",
        threshold: api.matchMinimoPercentual ?? 0,
        requisitos: []
      };
    }

    function mapVagaFromDetail(api){
      if(!api) return null;
      const requisitos = Array.isArray(api.requisitos)
        ? api.requisitos.map(r => ({
            id: r.id,
            termo: r.nome || "",
            peso: mapPesoToNumber(r.peso),
            obrigatorio: !!r.obrigatorio,
            sinonimos: []
          }))
        : [];

      return {
        id: api.id,
        codigo: api.codigo || "",
        titulo: api.titulo || "",
        threshold: api.matchMinimoPercentual ?? 0,
        requisitos
      };
    }

    function mapLastMatchFromApi(lastMatch){
      if(!lastMatch) return null;
      return {
        score: lastMatch.score ?? null,
        pass: lastMatch.pass ?? null,
        at: lastMatch.atUtc ?? null,
        vagaId: lastMatch.vagaId ?? null
      };
    }

    function mapCandidateFromApi(api){
      if(!api) return null;
      const fonte = (api.fonte || DEFAULT_CAND_FONTE).toString().trim().toLowerCase() || DEFAULT_CAND_FONTE;
      const status = toUiStatus(api.status || DEFAULT_CAND_STATUS);

      return {
        id: api.id,
        nome: api.nome || "",
        email: api.email || "",
        fone: api.fone || "",
        cidade: api.cidade || "",
        uf: (api.uf || "").toString().toUpperCase(),
        fonte,
        status,
        vagaId: api.vagaId,
        obs: api.obs || "",
        cvText: api.cvText || "",
        createdAt: api.createdAtUtc || api.createdAt,
        updatedAt: api.updatedAtUtc || api.updatedAt,
        lastMatch: mapLastMatchFromApi(api.lastMatch),
        documentos: Array.isArray(api.documentos) ? api.documentos.map(d => ({ ...d })) : null
      };
    }

    function buildCandidatePayload(c, includeDocumentos = false){
      const documentos = includeDocumentos && Array.isArray(c.documentos) ? c.documentos : null;
      return {
        nome: (c.nome || "").trim(),
        email: (c.email || "").trim(),
        fone: (c.fone || "").trim() || null,
        cidade: (c.cidade || "").trim() || null,
        uf: (c.uf || "").trim().toUpperCase().slice(0,2) || null,
        fonte: (c.fonte || DEFAULT_CAND_FONTE).trim().toLowerCase(),
        status: toApiStatus(c.status || DEFAULT_CAND_STATUS),
        vagaId: c.vagaId,
        obs: (c.obs || "").trim() || null,
        cvText: (c.cvText || "").trim() || null,
        lastMatch: c.lastMatch ? {
          score: c.lastMatch.score ?? null,
          pass: c.lastMatch.pass ?? null,
          atUtc: c.lastMatch.at ?? null,
          vagaId: c.lastMatch.vagaId ?? null
        } : null,
        documentos: documentos ? documentos.map(d => ({
          tipo: d.tipo,
          nomeArquivo: d.nomeArquivo,
          contentType: d.contentType || null,
          descricao: d.descricao || null,
          tamanhoBytes: d.tamanhoBytes || null,
          url: d.url || null
        })) : null
      };
    }

    async function syncVagasSummary(){
      const list = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
      state.vagas = Array.isArray(list)
        ? list.map(mapVagaFromList).filter(Boolean)
        : [];
    }

    async function ensureVagaDetails(id){
      if(!id) return null;
      if(vagaDetailLoaded.has(id)) return findVaga(id);
      if(vagaDetailLoads.has(id)) return findVaga(id);

      vagaDetailLoads.add(id);
      try{
        const detail = await apiFetchJson(`${VAGAS_API_URL}/${id}`, {
          method: "GET",
          headers: { "X-LT-Silent": "1" }
        });
        const mapped = mapVagaFromDetail(detail);
        if(mapped){
          const idx = state.vagas.findIndex(v => v.id === mapped.id);
          if(idx >= 0) state.vagas[idx] = { ...state.vagas[idx], ...mapped };
          else state.vagas.push(mapped);
          vagaDetailLoaded.add(id);
          return mapped;
        }
      }catch(err){
        console.error(err);
      }finally{
        vagaDetailLoads.delete(id);
      }

      return findVaga(id);
    }

    async function syncCandidatosFromApi(){
      const list = await apiFetchJson(CANDIDATOS_API_URL, { method: "GET" });
      state.candidatos = Array.isArray(list)
        ? list.map(mapCandidateFromApi).filter(Boolean)
        : [];
      state.selectedId = state.candidatos[0]?.id || null;
    }

    function findVaga(id){
      return state.vagas.find(v => v.id === id) || null;
    }

    function findCand(id){
      return state.candidatos.find(c => c.id === id) || null;
    }

    async function ensureCandidateDetails(id){
      const current = findCand(id);
      if(!current || current.documentos !== null) return current;
      if(detailLoaded.has(id)) return current;
      if(detailLoads.has(id)) return current;

      detailLoads.add(id);
      try{
        const detail = await apiFetchJson(`${CANDIDATOS_API_URL}/${id}`, {
          method: "GET",
          headers: { "X-LT-Silent": "1" }
        });
        const mapped = mapCandidateFromApi(detail);
        if(mapped){
          if(mapped.documentos === null){
            mapped.documentos = [];
          }
          state.candidatos = state.candidatos.map(c => c.id === id ? { ...c, ...mapped } : c);
          detailLoaded.add(id);
          return mapped;
        }
      }catch(err){
        console.error(err);
      }finally{
        detailLoads.delete(id);
      }

      return findCand(id);
    }

    // ========= Matching (MVP keyword)
    function calcMatchForCand(cand){
      const v = findVaga(cand.vagaId);
      if(!v) return { score: 0, pass: false, hits: [], missMandatory: [], totalPeso: 1, hitPeso: 0 };

      const text = normalizeText(cand.cvText || "");
      const reqs = (v.requisitos || []);
      if(!text || !reqs.length){
        const thr = clamp(parseInt(v.threshold || 0,10)||0,0,100);
        return { score: 0, pass: 0 >= thr, hits: [], missMandatory: [], totalPeso: 1, hitPeso: 0 };
      }

      const totalPeso = reqs.reduce((acc, r)=> acc + clamp(parseInt(r.peso||0,10)||0,0,10), 0) || 1;
      let hitPeso = 0;
      const hits = [];
      const missMandatory = [];

      reqs.forEach(r => {
        const termo = normalizeText(r.termo || "");
        const syns = (r.sinonimos || []).map(normalizeText).filter(Boolean);
        const bag = [termo, ...syns].filter(Boolean);

        const found = bag.some(t => t && text.includes(t));
        const p = clamp(parseInt(r.peso||0,10)||0,0,10);

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

      const thr = clamp(parseInt(v.threshold || 0,10)||0,0,100);
      const pass = score >= thr;

      return { score, pass, hits, missMandatory, totalPeso, hitPeso, threshold: thr };
    }

    function buildMatchTag(score, thr){
      const s = clamp(parseInt(score||0,10)||0,0,100);
      const t = clamp(parseInt(thr||0,10)||0,0,100);
      const ok = s >= t;
      const cls = ok ? "ok" : (s >= (t*0.8) ? "warn" : "bad");
      const text = ok ? "Dentro" : "Abaixo";
      const tag = cloneTemplate("tpl-cand-status-tag");
      if(!tag) return document.createElement("span");
      tag.classList.toggle("ok", cls === "ok");
      tag.classList.toggle("warn", cls === "warn");
      tag.classList.toggle("bad", cls === "bad");
      const icon = tag.querySelector('[data-role="icon"]');
      if(icon) icon.className = "bi bi-stars";
      const label = tag.querySelector('[data-role="text"]');
      if(label) label.textContent = `${s}% ${BULLET} ${text}`;
      return tag;
    }

    // ========= KPIs
    function updateKpis(){
      const total = state.candidatos.length;
      const triagem = state.candidatos.filter(c => (c.status || "").toLowerCase() === "triagem").length;
      const aprov = state.candidatos.filter(c => (c.status || "").toLowerCase() === "aprovado").length;
      const repro = state.candidatos.filter(c => (c.status || "").toLowerCase() === "reprovado").length;

      $("#kpiTotal").textContent = total;
      $("#kpiTriagem").textContent = triagem;
      $("#kpiAprov").textContent = aprov;
      $("#kpiReprov").textContent = repro;
    }

    // ========= Filters
    function distinctVagas(){
      return state.vagas
        .map(v => {
          const title = v.titulo || EMPTY_TEXT;
          const code = v.codigo || EMPTY_TEXT;
          return { id: v.id, label: `${title} (${code})` };
        })
        .sort((a,b)=>a.label.localeCompare(b.label, "pt-BR"));
    }

    function renderVagaFilters(){
      const sel = $("#fVaga");
      const cur = sel.value || VAGA_ALL;
      sel.replaceChildren();
      getEnumOptions("vagaFilter").forEach(opt => {
        sel.appendChild(buildOption(opt.code, opt.text, opt.code === cur));
      });
      distinctVagas().forEach(v => {
        sel.appendChild(buildOption(v.id, v.label, v.id === cur));
      });
      sel.value = (cur === VAGA_ALL || state.vagas.some(v => v.id === cur)) ? cur : VAGA_ALL;

      const sel2 = $("#candVaga");
      sel2.replaceChildren();
      getEnumOptions("selectPlaceholder").forEach(opt => {
        sel2.appendChild(buildOption(opt.code, opt.text, opt.code === SELECT_PLACEHOLDER));
      });
      distinctVagas().forEach(v => {
        sel2.appendChild(buildOption(v.id, v.label, v.id === (sel2.value || "")));
      });
    }

    function getFilteredCands(){
      const q = (state.filters.q || "").trim().toLowerCase();
      const st = state.filters.status;
      const vid = state.filters.vagaId;

      return state.candidatos.filter(c => {
        const statusKey = (c.status || "").toLowerCase();
        if(st !== "all" && statusKey !== st) return false;
        if(vid !== "all" && c.vagaId !== vid) return false;

        if(!q) return true;

        const v = findVaga(c.vagaId);
        const blob = [
          c.nome, c.email, c.fone,
          v?.titulo, v?.codigo,
          c.cidade, c.uf, c.fonte, c.status
        ].join(" ").toLowerCase();

        return blob.includes(q);
      });
    }

    // ========= Rendering list
    function renderList(){
      const tbody = $("#tblCands");
      tbody.replaceChildren();

      const rows = getFilteredCands();
      if(!rows.length){
        const emptyRow = cloneTemplate("tpl-cand-empty-row");
        if(emptyRow) tbody.appendChild(emptyRow);
        return;
      }

      rows.forEach(c => {
        const v = findVaga(c.vagaId);
        const isSel = c.id === state.selectedId;

        const m = calcMatchForCand(c);
        const thr = m.threshold ?? (v ? v.threshold : 0);

        const tr = cloneTemplate("tpl-cand-row");
        if(!tr) return;
        tr.dataset.candId = c.id;
        tr.style.cursor = "default";
        if(isSel) tr.classList.add("table-active");

        const initialsText = initials(c.nome);
        setText(tr, "cand-initials", initialsText);
        applyInitialsBadge(tr.querySelector('[data-role="cand-initials"]'), initialsText);
        setText(tr, "cand-name", c.nome);
        setText(tr, "cand-email", c.email);
        setText(tr, "cand-phone", c.fone);

        const hasPhone = !!c.fone;
        toggleRole(tr, "cand-phone", hasPhone);
        toggleRole(tr, "cand-phone-sep", hasPhone);

        setText(tr, "vaga-title", v?.titulo);
        setText(tr, "vaga-code", v?.codigo);

        const statusHost = tr.querySelector('[data-role="status-host"]');
        if(statusHost){
          statusHost.replaceChildren(buildStatusTag(c.status));
        }

        const matchHost = tr.querySelector('[data-role="match-host"]');
        if(matchHost){
          matchHost.replaceChildren();
          if(v){
            matchHost.appendChild(buildMatchTag(m.score, thr));
          }else{
            const span = document.createElement("span");
            span.className = "text-muted";
            span.textContent = EMPTY_TEXT;
            matchHost.appendChild(span);
          }
        }

        tr.querySelectorAll("button[data-act]").forEach(btn => {
          btn.dataset.id = c.id;
        });

        tr.addEventListener("click", (ev) => {
          const btn = ev.target.closest("button[data-act]");
          if(btn){
            ev.preventDefault();
            ev.stopPropagation();
            const act = btn.dataset.act;
            const id = btn.dataset.id;
            if(act === "detail") openDetailModal(id);
            if(act === "edit") openCandModal("edit", id);
            if(act === "recalc") recalcMatch(id);
            if(act === "del") deleteCand(id);
            return;
          }
        });

        tbody.appendChild(tr);
      });
    }

    function updateSelectedRow(prevId, nextId){
      if(prevId && prevId !== nextId){
        const prevRow = document.querySelector(`tr[data-cand-id="${prevId}"]`);
        if(prevRow) prevRow.classList.remove("table-active");
      }
      if(nextId){
        const nextRow = document.querySelector(`tr[data-cand-id="${nextId}"]`);
        if(nextRow) nextRow.classList.add("table-active");
      }
    }

    function selectCand(id){
      const prevId = state.selectedId;
      state.selectedId = id;
      updateSelectedRow(prevId, id);
      requestRenderDetail();
    }

    async function openDetailModal(id){
      const cand = findCand(id);
      if(cand?.vagaId && !vagaDetailLoaded.has(cand.vagaId)){
        ensureVagaDetails(cand.vagaId).then(() => {
          if(state.selectedId === id){
            requestRenderDetail();
          }
        });
      }
      selectCand(id);
      const modal = bootstrap.Modal.getOrCreateInstance($("#modalCandDetalhes"));
      modal.show();
      ensureCandidateDetails(id).then(() => {
        if(state.selectedId === id){
          requestRenderDetail();
        }
      });
    }

    // ========= Detail UI
    function fillVagaSelect(select, selectedId, includePlaceholder){
      if(!select) return;
      select.replaceChildren();
      if(includePlaceholder){
        getEnumOptions("selectPlaceholder").forEach(opt => {
          const isSelected = selectedId ? opt.code === selectedId : opt.code === SELECT_PLACEHOLDER;
          select.appendChild(buildOption(opt.code, opt.text, isSelected));
        });
      }
      distinctVagas().forEach(v => {
        select.appendChild(buildOption(v.id, v.label, v.id === selectedId));
      });
    }

    function renderDocumentList(root, c, listSelector = "#docList"){
      const host = root.querySelector(listSelector);
      if(!host) return;
      host.replaceChildren();

      const docs = Array.isArray(c.documentos) ? c.documentos : null;
      if(docs === null){
        const msg = document.createElement("div");
        msg.className = "text-muted small";
        msg.textContent = "Carregando documentos...";
        host.appendChild(msg);
        return;
      }

      if(!docs.length){
        const empty = cloneTemplate("tpl-cand-doc-empty");
        if(empty) host.appendChild(empty);
        return;
      }

      docs.forEach(doc => {
        const row = cloneTemplate("tpl-cand-doc-row");
        if(!row) return;
        const typeCode = (doc.tipo || "").toString().toLowerCase();
        const typeText = getEnumText("candidatoDocumentoTipo", typeCode, doc.tipo || "");
        setText(row, "doc-type", typeText || EMPTY_TEXT);
        setText(row, "doc-name", doc.nomeArquivo || EMPTY_TEXT);
        setText(row, "doc-desc", doc.descricao || "Sem descricao");

        const hasSize = doc.tamanhoBytes !== null && doc.tamanhoBytes !== undefined;
        setText(row, "doc-size", hasSize ? formatFileSize(doc.tamanhoBytes) : EMPTY_TEXT);
        toggleRole(row, "doc-size-sep", hasSize);

        const downloadBtn = row.querySelector('[data-doc-act="download"]');
        if(downloadBtn){
          downloadBtn.disabled = !doc.url;
          downloadBtn.addEventListener("click", () => downloadDocumento(doc.url));
        }

        const deleteBtn = row.querySelector('[data-doc-act="delete"]');
        if(deleteBtn){
          deleteBtn.addEventListener("click", () => deleteDocumento(c.id, doc.id, root, listSelector));
        }

        host.appendChild(row);
      });
    }

    function renderPendingDocs(root, candidateId){
      const wrap = root.querySelector("#candDocPendingWrap");
      const host = root.querySelector("#candDocPendingList");
      if(!wrap || !host) return;

      host.replaceChildren();
      if(!state.pendingDocs.length){
        wrap.classList.add("d-none");
        return;
      }

      wrap.classList.remove("d-none");
      state.pendingDocs.forEach(doc => {
        const row = cloneTemplate("tpl-cand-doc-pending");
        if(!row) return;

        const typeCode = (doc.tipo || "").toString().toLowerCase();
        const typeText = getEnumText("candidatoDocumentoTipo", typeCode, doc.tipo || "");
        setText(row, "doc-type", typeText || EMPTY_TEXT);
        setText(row, "doc-name", doc.nomeArquivo || EMPTY_TEXT);
        setText(row, "doc-desc", doc.descricao || "Sem descricao");

        const hasSize = doc.tamanhoBytes !== null && doc.tamanhoBytes !== undefined;
        setText(row, "doc-size", hasSize ? formatFileSize(doc.tamanhoBytes) : EMPTY_TEXT);
        toggleRole(row, "doc-size-sep", hasSize);

        const statusEl = row.querySelector('[data-role="doc-status"]');
        if(statusEl){
          const failed = doc.status === "failed";
          statusEl.textContent = failed ? "Falhou" : "Pendente";
          statusEl.classList.toggle("text-danger", failed);
          statusEl.classList.toggle("text-warning", !failed);
        }

        const retryBtn = row.querySelector('[data-doc-act="retry"]');
        if(retryBtn){
          retryBtn.classList.toggle("d-none", !candidateId);
          retryBtn.disabled = !candidateId;
          retryBtn.addEventListener("click", () => uploadPendingDoc(candidateId, doc, root));
        }

        const removeBtn = row.querySelector('[data-doc-act="remove"]');
        if(removeBtn){
          removeBtn.addEventListener("click", () => {
            state.pendingDocs = state.pendingDocs.filter(p => p.tempId !== doc.tempId);
            renderPendingDocs(root, candidateId);
          });
        }

        host.appendChild(row);
      });
    }

    function queueDocumentoFromRoot(root){
      const tipo = root.querySelector("#candDocTipo")?.value || "";
      const descricaoInput = root.querySelector("#candDocDescricao");
      const descricao = (descricaoInput?.value || "").trim();
      const fileInput = root.querySelector("#candDocArquivo");
      const file = fileInput?.files?.[0];

      if(!tipo){
        toast("Selecione o tipo do documento.");
        return;
      }

      if(!file){
        toast("Selecione um arquivo para adicionar.");
        return;
      }

      state.pendingDocs.push({
        tempId: createPendingId(),
        tipo,
        descricao,
        nomeArquivo: file.name,
        tamanhoBytes: file.size,
        file,
        status: "pending"
      });
      if(!state.pendingDocsCandidateId){
        state.pendingDocsCandidateId = "draft";
      }

      if(fileInput) fileInput.value = "";
      if(descricaoInput) descricaoInput.value = "";

      renderPendingDocs(root, null);
      toast("Documento adicionado. Ele sera enviado ao salvar.");
    }

    async function uploadPendingDoc(candidateId, doc, root, silent){
      if(!candidateId || !doc?.file) return null;
      if(!state.pendingDocsCandidateId)
        state.pendingDocsCandidateId = candidateId;

      const form = new FormData();
      form.append("arquivo", doc.file, doc.nomeArquivo);
      form.append("tipo", doc.tipo);
      if(doc.descricao) form.append("descricao", doc.descricao);

      try{
        const saved = await apiFetchJson(`${CANDIDATOS_API_URL}/${candidateId}/documentos`, {
          method: "POST",
          body: form
        });

        state.pendingDocs = state.pendingDocs.filter(p => p.tempId !== doc.tempId);
        const c = findCand(candidateId);
        if(c){
          if(!Array.isArray(c.documentos)) c.documentos = [];
          c.documentos.unshift({ ...saved });
        }

        if(root && c){
          renderDocumentList(root, c, "#candDocList");
          renderPendingDocs(root, candidateId);
        }

        if(!silent) toast("Documento enviado.");
        return saved;
      }catch(err){
        doc.status = "failed";
        if(root){
          renderPendingDocs(root, candidateId);
        }
        if(!silent) toast("Falha ao enviar documento.");
        return null;
      }
    }

    async function uploadPendingDocs(candidateId, root){
      const docs = [...state.pendingDocs];
      let successCount = 0;
      let failedCount = 0;

      for(const doc of docs){
        const saved = await uploadPendingDoc(candidateId, doc, root, true);
        if(saved) successCount++;
        else failedCount++;
      }

      return { successCount, failedCount };
    }

    let detailRenderInProgress = false;
    let detailRenderQueued = false;

    function requestRenderDetail(){
      if(detailRenderInProgress){
        detailRenderQueued = true;
        return;
      }
      detailRenderInProgress = true;
      requestAnimationFrame(() => {
        try{
          renderDetailCore();
        }finally{
          detailRenderInProgress = false;
          if(detailRenderQueued){
            detailRenderQueued = false;
            requestRenderDetail();
          }
        }
      });
    }

    function renderDetailCore(){
      const host = $("#detailHost");
      host.replaceChildren();

      const c = findCand(state.selectedId);
      if(!c){
        const empty = cloneTemplate("tpl-cand-detail-empty");
        if(empty) host.appendChild(empty);
        return;
      }

      const v = findVaga(c.vagaId);
      const updated = c.updatedAt ? new Date(c.updatedAt) : null;
      const updatedTxt = updated ? updated.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : EMPTY_TEXT;

      const root = cloneTemplate("tpl-cand-detail");
      if(!root) return;

      const initialsText = initials(c.nome);
      setText(root, "detail-initials", initialsText);
      applyInitialsBadge(root.querySelector('[data-role="detail-initials"]'), initialsText);
      setText(root, "detail-name", c.nome);
      setText(root, "detail-email", c.email);
      setText(root, "detail-phone", c.fone);
      const hasPhone = !!c.fone;
      toggleRole(root, "detail-phone", hasPhone);
      toggleRole(root, "detail-phone-sep", hasPhone);

      const locParts = [c.cidade, c.uf].filter(Boolean);
      const hasLoc = locParts.length > 0;
      setText(root, "detail-location", hasLoc ? locParts.join(" - ") : EMPTY_TEXT);
      toggleRole(root, "detail-location-icon", hasLoc);
      toggleRole(root, "detail-location-sep", hasLoc);
      setText(root, "detail-source", getEnumText("candidatoFonte", c.fonte, c.fonte));

      const statusHost = root.querySelector('[data-role="detail-status-host"]');
      if(statusHost) statusHost.replaceChildren(buildStatusTag(c.status));

      setText(root, "detail-updated", updatedTxt);

      const vagaTitle = v ? (v.titulo || EMPTY_TEXT) : "Vaga nao vinculada";
      setText(root, "detail-vaga-title", vagaTitle);
      setText(root, "detail-vaga-code", v?.codigo);
      const thrVal = clamp(parseInt(v?.threshold ?? 0,10)||0,0,100);
      setText(root, "detail-vaga-thr", v ? `${thrVal}%` : EMPTY_TEXT);
      toggleRole(root, "detail-vaga-code-wrap", !!v);
      toggleRole(root, "detail-vaga-thr-wrap", !!v);

      setTextLines(root, "detail-obs", c.obs);

      const statusSel = root.querySelector("#detailStatus");
      fillSelectFromEnum(statusSel, "candidatoStatus", c.status);

      const vagaSel = root.querySelector("#detailVaga");
      fillVagaSelect(vagaSel, c.vagaId, true);

      const cvText = root.querySelector("#detailCvText");
      if(cvText) cvText.value = c.cvText || "";

      const docTipo = root.querySelector("#docTipo");
      fillSelectFromEnum(docTipo, "candidatoDocumentoTipo", getEnumOptions("candidatoDocumentoTipo")[0]?.code || "");

      renderDocumentList(root, c);

      toggleRole(root, "match-has-vaga", !!v);
      toggleRole(root, "match-no-vaga", !v);
      const matchRenderToken = ++state.matchRenderToken;
      if(v){
        requestAnimationFrame(() => {
          if(state.matchRenderToken !== matchRenderToken) return;
          const m = calcMatchForCand(c);
          const thr = m.threshold ?? (v ? v.threshold : 0);
          const pass = !!m.pass;

          const matchStatusHost = root.querySelector('[data-role="match-status-host"]');
          if(matchStatusHost){
            const tag = cloneTemplate("tpl-cand-status-tag");
            if(tag){
              tag.classList.toggle("ok", pass);
              tag.classList.toggle("bad", !pass);
              const icon = tag.querySelector('[data-role="icon"]');
              if(icon) icon.className = pass ? "bi bi-check2-circle" : "bi bi-x-circle";
              const label = tag.querySelector('[data-role="text"]');
              if(label) label.textContent = pass ? "Dentro do minimo" : "Abaixo do minimo";
              matchStatusHost.replaceChildren(tag);
            }
          }

          const score = clamp(parseInt(m.score||0,10)||0,0,100);
          const thrValue = clamp(parseInt(thr||0,10)||0,0,100);
          const progress = root.querySelector('[data-role="match-progress"]');
          if(progress) progress.style.width = `${score}%`;
          setText(root, "match-score", `${score}%`);
          setText(root, "match-thr", `${thrValue}%`);
          setText(root, "match-hits-count", (m.hits||[]).length);
          setText(root, "match-miss-count", (m.missMandatory||[]).length);

          const hits = (m.hits || []).map(r => r.termo).slice(0, 12);
          const misses = (m.missMandatory || []).map(r => r.termo).slice(0, 12);

          const missBlock = root.querySelector('[data-role="match-miss-block"]');
          if(missBlock) missBlock.classList.toggle("d-none", !misses.length);
          setText(root, "match-miss-list", misses.join(", "));
          setText(root, "match-hit-list", hits.length ? hits.join(", ") : EMPTY_TEXT);
        });
      }

      host.appendChild(root);
      bindDetailActions(c);

      if(v && !vagaDetailLoaded.has(v.id) && (!v.requisitos || v.requisitos.length === 0)){
        ensureVagaDetails(v.id).then(() => {
          if(state.selectedId === c.id){
            requestRenderDetail();
          }
        });
      }
    }

    function bindDetailActions(c){
      if(!c) return;

      $$("#detailHost [data-dact]").forEach(btn => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.dact;
          if(act === "edit") openCandModal("edit", c.id);
          if(act === "delete") deleteCand(c.id);
          if(act === "saveCv") saveCvText(c.id, false);
          if(act === "recalc") recalcMatch(c.id);
          if(act === "saveMeta") saveMeta(c.id, false);
          if(act === "uploadDoc") uploadDocumento(c.id);
          if(act === "openVaga") toast("Placeholder: aqui abriria a tela de Vagas filtrada na vaga.");
        });
      });
    }

    async function uploadDocumentoFromRoot(candId, root, selectors){
      const c = findCand(candId);
      if(!c || !root) return;

      const tipo = root.querySelector(selectors.tipoSelector)?.value || "";
      const descricaoInput = root.querySelector(selectors.descricaoSelector);
      const descricao = (descricaoInput?.value || "").trim();
      const fileInput = root.querySelector(selectors.arquivoSelector);
      const file = fileInput?.files?.[0];

      if(!tipo){
        toast("Selecione o tipo do documento.");
        return;
      }

      if(!file){
        toast("Selecione um arquivo para enviar.");
        return;
      }

      const form = new FormData();
      form.append("arquivo", file);
      form.append("tipo", tipo);
      if(descricao) form.append("descricao", descricao);

      try{
        const saved = await apiFetchJson(`${CANDIDATOS_API_URL}/${candId}/documentos`, {
          method: "POST",
          body: form
        });

        if(saved){
          if(!Array.isArray(c.documentos)) c.documentos = [];
          c.documentos.unshift({ ...saved });
          renderDocumentList(root, c, selectors.listSelector);
          toast("Documento enviado.");
        }

        if(fileInput) fileInput.value = "";
        if(descricaoInput) descricaoInput.value = "";
      }catch(err){
        console.error(err);
        toast("Falha ao enviar documento.");
      }
    }

    async function uploadDocumento(candId){
      return uploadDocumentoFromRoot(candId, $("#detailHost"), {
        tipoSelector: "#docTipo",
        descricaoSelector: "#docDescricao",
        arquivoSelector: "#docArquivo",
        listSelector: "#docList"
      });
    }

    function downloadDocumento(url){
      if(!url){
        toast("Documento sem download disponivel.");
        return;
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    async function deleteDocumento(candId, docId, root, listSelector){
      const c = findCand(candId);
      if(!c || !root) return;

      const ok = confirm("Excluir este documento?");
      if(!ok) return;

      try{
        await apiFetchJson(`${CANDIDATOS_API_URL}/${candId}/documentos/${docId}`, { method: "DELETE" });
        if(Array.isArray(c.documentos)){
          c.documentos = c.documentos.filter(d => d.id !== docId);
        }
        renderDocumentList(root, c, listSelector);
        toast("Documento excluido.");
      }catch(err){
        console.error(err);
        toast("Falha ao excluir documento.");
      }
    }

    // ========= CRUD: Candidatos
    async function openCandModal(mode, id){
      const modalEl = $("#modalCand");
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      const isEdit = mode === "edit";
      $("#modalCandTitle").textContent = isEdit ? "Editar candidato" : "Novo candidato";

      renderVagaFilters();

      const docDisabled = modalEl.querySelector("#candDocDisabled");
      const docForm = modalEl.querySelector("#candDocForm");
      const docList = modalEl.querySelector("#candDocList");
      const docTipo = modalEl.querySelector("#candDocTipo");
      const docDescricao = modalEl.querySelector("#candDocDescricao");
      const docArquivo = modalEl.querySelector("#candDocArquivo");
      const defaultDocTipo = getEnumOptions("candidatoDocumentoTipo")[0]?.code || "";

      fillSelectFromEnum(docTipo, "candidatoDocumentoTipo", defaultDocTipo);
      if(docDescricao) docDescricao.value = "";
      if(docArquivo) docArquivo.value = "";
      if(docList) docList.replaceChildren();

      if(isEdit){
        let c = findCand(id);
        if(!c) return;
        $("#candId").value = c.id;
        $("#candNome").value = c.nome || "";
        $("#candEmail").value = c.email || "";
        $("#candFone").value = c.fone || "";
        $("#candCidade").value = c.cidade || "";
        $("#candUF").value = (c.uf || "").toUpperCase().slice(0,2);
        $("#candFonte").value = c.fonte || DEFAULT_CAND_FONTE;
        $("#candStatus").value = c.status || DEFAULT_CAND_STATUS;
        $("#candVaga").value = c.vagaId || "";
        $("#candObs").value = c.obs || "";

        await ensureCandidateDetails(c.id);
        c = findCand(id) || c;

        if(docDisabled) docDisabled.classList.add("d-none");
        if(docForm) docForm.classList.remove("d-none");
        renderDocumentList(modalEl, c, "#candDocList");
        if(state.pendingDocsCandidateId !== c.id){
          resetPendingDocs();
        }
        renderPendingDocs(modalEl, c.id);
      }else{
        $("#candId").value = "";
        $("#candNome").value = "";
        $("#candEmail").value = "";
        $("#candFone").value = "";
        $("#candCidade").value = "";
        $("#candUF").value = "SP";
        $("#candFonte").value = DEFAULT_CAND_FONTE;
        $("#candStatus").value = DEFAULT_CAND_STATUS;
        $("#candVaga").value = state.vagas[0]?.id || "";
        $("#candObs").value = "";

        if(docDisabled) docDisabled.classList.remove("d-none");
        if(docForm) docForm.classList.remove("d-none");
        resetPendingDocs();
        state.pendingDocsCandidateId = "draft";
        renderPendingDocs(modalEl, null);
      }

      const tabTrigger = modalEl.querySelector('[data-bs-target="#candTabDados"]');
      if(tabTrigger){
        bootstrap.Tab.getOrCreateInstance(tabTrigger).show();
      }

      modal.show();
    }

    async function upsertCandFromModal(){
      const id = $("#candId").value || null;
      const nome = ($("#candNome").value || "").trim();
      const email = ($("#candEmail").value || "").trim();
      const fone = ($("#candFone").value || "").trim();
      const cidade = ($("#candCidade").value || "").trim();
      const uf = ($("#candUF").value || "").trim().toUpperCase().slice(0,2);
      const fonte = ($("#candFonte").value || "").trim();
      const status = ($("#candStatus").value || "").trim();
      const vagaId = ($("#candVaga").value || "").trim();
      const obs = ($("#candObs").value || "").trim();

      if(!nome){ toast("Informe o nome do candidato."); return; }
      if(!email){ toast("Informe o email do candidato."); return; }
      if(!vagaId){ toast("Selecione uma vaga."); return; }

      const current = id ? findCand(id) : null;
      const candidate = {
        id: current?.id || null,
        nome,
        email,
        fone,
        cidade,
        uf,
        fonte,
        status,
        vagaId,
        obs,
        cvText: current?.cvText || "",
        lastMatch: current?.lastMatch || null,
        documentos: current?.documentos ?? null
      };

      try{
        const payload = buildCandidatePayload(candidate);
        const url = id ? `${CANDIDATOS_API_URL}/${id}` : CANDIDATOS_API_URL;
        const method = id ? "PUT" : "POST";
        const saved = await apiFetchJson(url, { method, body: JSON.stringify(payload) });
        const mapped = mapCandidateFromApi(saved);
        if(!mapped) throw new Error("Resposta invalida da API.");

        if(id){
          state.candidatos = state.candidatos.map(c => c.id === id ? mapped : c);
          state.selectedId = mapped.id;
          toast("Candidato atualizado.");
        }else{
          state.candidatos.unshift(mapped);
          state.selectedId = mapped.id;
          toast("Candidato criado.");
        }

        updateKpis();
        renderVagaFilters();
        renderList();
        requestRenderDetail();

        if(!id && state.pendingDocs.length){
          const modalEl = $("#modalCand");
          state.pendingDocsCandidateId = mapped.id;
          const result = await uploadPendingDocs(mapped.id, modalEl);
          if(result.failedCount > 0){
            $("#modalCandTitle").textContent = "Editar candidato";
            $("#candId").value = mapped.id;
            const docDisabled = modalEl.querySelector("#candDocDisabled");
            const docForm = modalEl.querySelector("#candDocForm");
            if(docDisabled) docDisabled.classList.add("d-none");
            if(docForm) docForm.classList.remove("d-none");
            renderDocumentList(modalEl, findCand(mapped.id) || mapped, "#candDocList");
            renderPendingDocs(modalEl, mapped.id);
            const tabTrigger = modalEl.querySelector('[data-bs-target="#candTabDocs"]');
            if(tabTrigger){
              bootstrap.Tab.getOrCreateInstance(tabTrigger).show();
            }
            toast(`Candidato salvo, mas ${result.failedCount} documento(s) falharam.`);
            return;
          }
          resetPendingDocs();
        }
        if(!id && state.pendingDocs.length === 0 && state.pendingDocsCandidateId === "draft"){
          resetPendingDocs();
        }

        bootstrap.Modal.getOrCreateInstance($("#modalCand")).hide();
      }catch(err){
        console.error(err);
        toast("Falha ao salvar candidato.");
      }
    }

    async function deleteCand(id){
      const c = findCand(id);
      if(!c) return;

      const ok = confirm(`Excluir o candidato "${c.nome}"?`);
      if(!ok) return;

      try{
        await apiFetchJson(`${CANDIDATOS_API_URL}/${id}`, { method: "DELETE" });
        state.candidatos = state.candidatos.filter(x => x.id !== id);
        if(state.selectedId === id){
          state.selectedId = state.candidatos[0]?.id || null;
        }
        updateKpis();
        renderList();
        requestRenderDetail();
        toast("Candidato excluido.");
      }catch(err){
        console.error(err);
        toast("Falha ao excluir candidato.");
      }
    }

    async function saveCvText(candId, fromMobile){
      const c = findCand(candId);
      if(!c) return;

      const root = fromMobile ? $("#mobileDetailBody") : $("#detailHost");
      const ta = root.querySelector("#detailCvText");
      c.cvText = (ta?.value || "");
      c.updatedAt = new Date().toISOString();

      try{
        const payload = buildCandidatePayload(c);
        const saved = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        const mapped = mapCandidateFromApi(saved);
        if(mapped) state.candidatos = state.candidatos.map(x => x.id === mapped.id ? mapped : x);
        renderList();
        requestRenderDetail();
        toast("Texto do CV salvo.");
      }catch(err){
        console.error(err);
        toast("Falha ao salvar texto do CV.");
      }
    }

    async function saveMeta(candId, fromMobile){
      const c = findCand(candId);
      if(!c) return;

      const root = fromMobile ? $("#mobileDetailBody") : $("#detailHost");
      const st = root.querySelector("#detailStatus")?.value || c.status;
      const vid = root.querySelector("#detailVaga")?.value || c.vagaId;

      if(!vid){
        toast("Selecione uma vaga.");
        return;
      }

      c.status = st;
      c.vagaId = vid;
      c.updatedAt = new Date().toISOString();

      try{
        const payload = buildCandidatePayload(c);
        const saved = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        const mapped = mapCandidateFromApi(saved);
        if(mapped) state.candidatos = state.candidatos.map(x => x.id === mapped.id ? mapped : x);
        updateKpis();
        renderList();
        requestRenderDetail();
        toast("Status/Vaga atualizados.");
      }catch(err){
        console.error(err);
        toast("Falha ao atualizar status/vaga.");
      }
    }

    async function recalcMatch(candId){
      const c = findCand(candId);
      if(!c) return;

      const m = calcMatchForCand(c);
      c.lastMatch = { score: m.score, pass: m.pass, at: new Date().toISOString(), vagaId: c.vagaId };
      c.updatedAt = new Date().toISOString();

      try{
        const payload = buildCandidatePayload(c);
        const saved = await apiFetchJson(`${CANDIDATOS_API_URL}/${c.id}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        const mapped = mapCandidateFromApi(saved);
        if(mapped) state.candidatos = state.candidatos.map(x => x.id === mapped.id ? mapped : x);
        renderList();
        requestRenderDetail();
        toast("Match recalculado.");
      }catch(err){
        console.error(err);
        toast("Falha ao recalcular match.");
      }
    }

    // ========= Import/Export
    function exportJson(){
      const payload = { version: 1, exportedAt: new Date().toISOString(), candidatos: state.candidatos };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "candidatos_liotecnica.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Exportacao iniciada.");
    }

    // ========= UI wiring
    function wireClock(){
      const tick = () => {
        const d = new Date();
        $("#nowLabel").textContent = d.toLocaleString("pt-BR", {
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
        state.filters.vagaId = $("#fVaga").value || "all";
        renderList();
      };

      $("#fSearch").addEventListener("input", apply);
      $("#fStatus").addEventListener("change", apply);
      $("#fVaga").addEventListener("change", apply);

      $("#globalSearch").addEventListener("input", () => {
        $("#fSearch").value = $("#globalSearch").value;
        apply();
      });
    }

    function wireButtons(){
      $("#btnNewCand").addEventListener("click", () => openCandModal("new"));
      $("#btnSaveCand").addEventListener("click", upsertCandFromModal);
      $("#btnExportJson").addEventListener("click", exportJson);
      const docBtn = $("#btnCandDocUpload");
      if(docBtn){
        docBtn.addEventListener("click", async () => {
          const candId = $("#candId").value;
          if(!candId){
            queueDocumentoFromRoot($("#modalCand"));
            return;
          }
          await uploadDocumentoFromRoot(candId, $("#modalCand"), {
            tipoSelector: "#candDocTipo",
            descricaoSelector: "#candDocDescricao",
            arquivoSelector: "#candDocArquivo",
            listSelector: "#candDocList"
          });
        });
      }
    }

    function initLogo(){
      $("#logoDesktop").src = LOGO_DATA_URI;
      $("#logoMobile").src = LOGO_DATA_URI;
    }

    function consumeOpenCandidateQuery(){
      const params = new URLSearchParams(window.location.search || "");
      let openId = params.get("open");
      if(!openId){
        const match = (window.location.href || "").match(/[?&]open=([^&]+)/i);
        if(match){
          try{
            openId = decodeURIComponent(match[1]);
          }catch{
            openId = match[1];
          }
        }
      }
      if(!openId) return null;
      params.delete("open");
      const next = params.toString();
      const nextUrl = next ? `${window.location.pathname}?${next}` : window.location.pathname;
      window.history.replaceState({}, document.title, nextUrl);
      return openId;
    }

    async function tryOpenCandidateFromQuery(){
      const openId = consumeOpenCandidateQuery();
      if(!openId) return false;
      const cand = findCand(openId);
      if(!cand) return false;
      openDetailModal(openId);
      return true;
    }

    // ========= Init
    (async function init(){
      try{
        initLogo();
        wireClock();

        await ensureEnumData();
        refreshEnumDefaults();
        applyEnumSelects();

        let ready = false;
        try{
        await syncVagasSummary();
        await syncCandidatosFromApi();
          ready = true;
        }catch(err){
          console.error(err);
          toast("Falha ao carregar candidatos/vagas.");
        }

        if(ready){
          renderVagaFilters();
          updateKpis();
          renderList();
          requestRenderDetail();
        }else{
          renderVagaFilters();
          updateKpis();
          renderList();
          document.getElementById("globalLoading")?.classList.remove("active");
        }

        wireFilters();
        wireButtons();

        const opened = await tryOpenCandidateFromQuery();

        if(!opened && !state.selectedId && state.candidatos.length){
          state.selectedId = state.candidatos[0].id;
          renderList();
          requestRenderDetail();
        }
      }catch(err){
        console.error(err);
      }finally{
        if(window.LioTecnicaLoading?.end){
          setTimeout(() => window.LioTecnicaLoading.end(), 600);
        }
      }
    })();
