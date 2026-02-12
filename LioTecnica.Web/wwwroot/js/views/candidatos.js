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
      filters: { q: "", statuses: [], vagaIds: [] },
      pagination: { page: 1, pageSize: 20, totalCount: 0 },
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
        talentoId: api.talentoId || null,
        obs: api.obs || "",
        cvText: api.cvText || "",
        applicationRecruiterUserId: api.applicationRecruiterUserId || null,
        applicationRecruiterUserName: api.applicationRecruiterUserName || null,
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
        applicationRecruiterUserId: (c.applicationRecruiterUserId || "").trim() || null,
        applicationRecruiterUserName: (c.applicationRecruiterUserName || "").trim() || null,
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
      const qs = new URLSearchParams();
      if ((state.filters.q || "").trim()) qs.set("q", state.filters.q.trim());
      state.filters.statuses.forEach(s => qs.append("statuses", s));
      state.filters.vagaIds.forEach(id => qs.append("vagaIds", id));
      qs.set("page", String(state.pagination.page));
      qs.set("pageSize", String(state.pagination.pageSize));
      const url = CANDIDATOS_API_URL + (qs.toString() ? "?" + qs.toString() : "");
      const data = await apiFetchJson(url, { method: "GET" });
      const items = data?.items ?? data;
      state.candidatos = Array.isArray(items)
        ? items.map(mapCandidateFromApi).filter(Boolean)
        : [];
      state.pagination.totalCount = data?.totalCount ?? state.candidatos.length;
      state.pagination.page = data?.page ?? state.pagination.page;
      state.pagination.pageSize = data?.pageSize ?? state.pagination.pageSize;
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
      const total = state.pagination.totalCount;
      const pendente = state.candidatos.filter(c => (c.status || "").toLowerCase() === "pendente").length;
      const triagem = state.candidatos.filter(c => (c.status || "").toLowerCase() === "triagem").length;
      const aprov = state.candidatos.filter(c => (c.status || "").toLowerCase() === "aprovado").length;
      const repro = state.candidatos.filter(c => (c.status || "").toLowerCase() === "reprovado").length;

      $("#kpiTotal").textContent = total;
      const kpiPend = $("#kpiPendente");
      if(kpiPend) kpiPend.textContent = pendente;
      $("#kpiTriagem").textContent = triagem;
      $("#kpiAprov").textContent = aprov;
      $("#kpiReprov").textContent = repro;
    }

    // ========= Filters (dropdown Status + dropdown Vaga com autocomplete)
    function distinctVagas(){
      return state.vagas
        .map(v => {
          const title = v.titulo || EMPTY_TEXT;
          const code = v.codigo || EMPTY_TEXT;
          return { id: v.id, label: `${title} (${code})` };
        })
        .sort((a,b)=>a.label.localeCompare(b.label, "pt-BR"));
    }

    function getStatusDropdownLabel(){
      const statuses = collectFilterStatuses();
      if(!statuses.length) return "Todos";
      const opts = getEnumOptions("candidatoStatus");
      const labels = statuses.map(code => {
        const opt = opts.find(o => (o.code || "").toString().toLowerCase() === (code || "").toString().toLowerCase());
        return opt ? (opt.text || code) : code;
      });
      return labels.join(", ");
    }

    function renderStatusDropdown(){
      const dropdown = $("#fStatusDropdown");
      const labelEl = $("#fStatusLabel");
      if(!dropdown || !labelEl) return;

      dropdown.replaceChildren();
      const opts = getEnumOptions("candidatoStatus").filter(o => (o.code || "").toString().trim());
      const selected = new Set(state.filters.statuses);

      opts.forEach(opt => {
        const code = (opt.code || "").toString();
        const label = document.createElement("label");
        label.className = "dropdown-item d-flex align-items-center gap-2 py-2 mb-0 cursor-pointer";
        label.style.cursor = "pointer";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.className = "form-check-input flex-shrink-0";
        input.value = code;
        input.checked = selected.has(code);
        input.dataset.filterStatus = "1";
        label.appendChild(input);
        label.appendChild(document.createTextNode(opt.text || opt.code || ""));
        dropdown.appendChild(label);
      });

      labelEl.textContent = getStatusDropdownLabel();
      dropdown.style.display = "none";
    }

    function wireStatusDropdown(){
      const wrap = document.querySelector(".status-dropdown-wrap");
      const trigger = $("#fStatusTrigger");
      const dropdown = $("#fStatusDropdown");
      if(!wrap || !trigger || !dropdown) return;

      const toggleDropdown = () => {
        const isShown = dropdown.classList.contains("show");
        dropdown.classList.toggle("show", !isShown);
        dropdown.style.display = isShown ? "none" : "block";
      };

      const hideDropdown = () => {
        dropdown.classList.remove("show");
        dropdown.style.display = "none";
      };

      const onCheckboxChange = () => {
        state.filters.statuses = collectFilterStatuses();
        $("#fStatusLabel").textContent = getStatusDropdownLabel();
        state.pagination.page = 1;
        const apply = () => {
          syncCandidatosFromApi().then(() => {
            updateKpis();
            renderList();
            renderPagination();
            requestRenderDetail();
          }).catch(err => {
            console.error(err);
            toast("Falha ao aplicar filtros.");
          });
        };
        apply();
      };

      trigger.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown();
      });

      dropdown.addEventListener("click", (e) => {
        e.stopPropagation();
        if(e.target.type === "checkbox" || e.target.closest("label")){
          setTimeout(onCheckboxChange, 0);
        }
      });

      document.addEventListener("click", (e) => {
        if(!wrap.contains(e.target)) hideDropdown();
      });
    }

    function renderVagaFilterDropdown(){
      const dropdown = $("#fVagaDropdown");
      const searchEl = $("#fVagaSearch");
      const hiddenEl = $("#fVaga");
      if(!dropdown || !searchEl || !hiddenEl) return;

      dropdown.replaceChildren();
      const vagas = distinctVagas();
      const selectedId = (state.filters.vagaIds && state.filters.vagaIds[0]) || "";

      if(!vagas.length){
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dropdown-item";
        item.dataset.value = "";
        item.textContent = "Nenhuma Vaga";
        dropdown.appendChild(item);
        searchEl.placeholder = "Nenhuma vaga";
        searchEl.value = "";
        hiddenEl.value = "";
        return;
      }

      const allItem = document.createElement("button");
      allItem.type = "button";
      allItem.className = "dropdown-item";
      allItem.dataset.value = "";
      allItem.dataset.label = "Todas";
      allItem.textContent = "Todas";
      dropdown.appendChild(allItem);

      vagas.forEach(v => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dropdown-item text-truncate";
        item.dataset.value = v.id;
        item.dataset.label = v.label;
        item.textContent = v.label;
        dropdown.appendChild(item);
      });

      const selectedLabel = selectedId ? (vagas.find(v => v.id === selectedId)?.label || "Todas") : "Todas";
      searchEl.placeholder = "Buscar vaga...";
      searchEl.value = selectedLabel;
      hiddenEl.value = selectedId;
    }

    function wireVagaFilterAutocomplete(){
      const wrap = document.querySelector(".vaga-autocomplete-wrap");
      const searchEl = $("#fVagaSearch");
      const dropdown = $("#fVagaDropdown");
      const hiddenEl = $("#fVaga");
      if(!wrap || !searchEl || !dropdown || !hiddenEl) return;

      const showDropdown = () => {
        dropdown.classList.add("show");
        const items = dropdown.querySelectorAll(".dropdown-item");
        const q = (searchEl.value || "").trim().toLowerCase();
        items.forEach(btn => {
          const label = (btn.dataset.label || btn.textContent || "").toLowerCase();
          const match = !q || label.includes(q);
          btn.classList.toggle("d-none", !match);
        });
      };

      const hideDropdown = () => {
        dropdown.classList.remove("show");
      };

      const selectValue = (value, label) => {
        hiddenEl.value = value || "";
        searchEl.value = label || (value ? "" : "Todas");
        if(!state.vagas.length) searchEl.value = "Nenhuma Vaga";
        hideDropdown();
        const ev = new Event("change", { bubbles: true });
        hiddenEl.dispatchEvent(ev);
      };

      searchEl.addEventListener("focus", showDropdown);
      searchEl.addEventListener("click", (e) => { e.stopPropagation(); showDropdown(); });
      searchEl.addEventListener("input", () => {
        showDropdown();
      });
      searchEl.addEventListener("keydown", (e) => {
        if(e.key === "Escape"){ hideDropdown(); searchEl.blur(); }
      });

      dropdown.addEventListener("click", (e) => {
        const btn = e.target.closest(".dropdown-item");
        if(!btn) return;
        e.preventDefault();
        selectValue(btn.dataset.value || "", btn.dataset.label || btn.textContent || "");
      });

      document.addEventListener("click", (e) => {
        if(!wrap.contains(e.target)) hideDropdown();
      });
    }

    function fillModalVagaAutocomplete(selectedId){
      const dropdown = $("#candVagaDropdown");
      const searchEl = $("#candVagaSearch");
      const hiddenEl = $("#candVaga");
      if(!dropdown || !searchEl || !hiddenEl) return;

      dropdown.replaceChildren();
      const vagas = distinctVagas();

      if(!vagas.length){
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dropdown-item";
        item.dataset.value = "";
        item.dataset.label = "Nenhuma Vaga";
        item.textContent = "Nenhuma Vaga";
        dropdown.appendChild(item);
        searchEl.placeholder = "Nenhuma Vaga";
        searchEl.value = "";
        hiddenEl.value = "";
        return;
      }

      const phOpts = getEnumOptions("selectPlaceholder");
      const hasPlaceholder = phOpts.length && (SELECT_PLACEHOLDER || "").toString();
      if(hasPlaceholder){
        const opt = phOpts.find(o => (o.code || "").toString() === (SELECT_PLACEHOLDER || ""));
        if(opt){
          const item = document.createElement("button");
          item.type = "button";
          item.className = "dropdown-item";
          item.dataset.value = "";
          item.dataset.label = opt.text || "";
          item.textContent = opt.text || "";
          dropdown.appendChild(item);
        }
      }

      vagas.forEach(v => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "dropdown-item text-truncate";
        item.dataset.value = v.id;
        item.dataset.label = v.label;
        item.textContent = v.label;
        dropdown.appendChild(item);
      });

      const selectedLabel = selectedId ? (vagas.find(v => v.id === selectedId)?.label || "") : (hasPlaceholder ? (phOpts.find(o => (o.code || "").toString() === (SELECT_PLACEHOLDER || ""))?.text || "") : "");
      searchEl.placeholder = "Buscar vaga...";
      searchEl.value = selectedLabel || (vagas.length ? "" : "Nenhuma Vaga");
      hiddenEl.value = selectedId || "";
    }

    function wireModalVagaAutocomplete(){
      const wrap = document.querySelector(".vaga-autocomplete-modal");
      const searchEl = $("#candVagaSearch");
      const dropdown = $("#candVagaDropdown");
      const hiddenEl = $("#candVaga");
      if(!wrap || !searchEl || !dropdown || !hiddenEl) return;

      const showDropdown = () => {
        dropdown.classList.add("show");
        const items = dropdown.querySelectorAll(".dropdown-item");
        const q = (searchEl.value || "").trim().toLowerCase();
        items.forEach(btn => {
          const label = (btn.dataset.label || btn.textContent || "").toLowerCase();
          const match = !q || label.includes(q);
          btn.classList.toggle("d-none", !match);
        });
      };

      const hideDropdown = () => dropdown.classList.remove("show");

      const selectValue = (value, label) => {
        hiddenEl.value = value || "";
        searchEl.value = (label || "").trim();
        if(!state.vagas.length) searchEl.value = "Nenhuma Vaga";
        hideDropdown();
      };

      searchEl.addEventListener("focus", showDropdown);
      searchEl.addEventListener("click", (e) => { e.stopPropagation(); showDropdown(); });
      searchEl.addEventListener("input", showDropdown);
      searchEl.addEventListener("keydown", (e) => { if(e.key === "Escape"){ hideDropdown(); searchEl.blur(); } });

      dropdown.addEventListener("click", (e) => {
        const btn = e.target.closest(".dropdown-item");
        if(!btn) return;
        e.preventDefault();
        selectValue(btn.dataset.value || "", btn.dataset.label || btn.textContent || "");
      });

      document.addEventListener("click", (e) => {
        if(!wrap.contains(e.target)) hideDropdown();
      });
    }

    function renderVagaFilters(){
      renderStatusDropdown();
      renderVagaFilterDropdown();
      wireVagaFilterAutocomplete();

      fillModalVagaAutocomplete($("#candVaga")?.value || "");
      wireModalVagaAutocomplete();
    }

    function collectFilterStatuses(){
      const dropdown = $("#fStatusDropdown");
      if(!dropdown) return [];
      return Array.from(dropdown.querySelectorAll('input[data-filter-status="1"]:checked'))
        .map(inp => inp.value)
        .filter(Boolean);
    }

    function collectFilterVagaIds(){
      const hidden = $("#fVaga");
      if(!hidden || !hidden.value) return [];
      return [hidden.value];
    }

    function getFilteredCands(){
      return state.candidatos;
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
            if(act === "bloqueio") sendToBloqueio(id);
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

      setText(root, "detail-recruiter", (c.applicationRecruiterUserName || "").trim() || EMPTY_TEXT);

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
          if(act === "uploadCvExtrair") uploadCvEExtrair(c.id);
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

    let _suggestedDataPayload = null;

    async function uploadCvEExtrair(candId){
      const root = $("#detailHost");
      const fileInput = root?.querySelector("#cvPdfArquivo");
      const file = fileInput?.files?.[0];
      if(!file){
        toast("Selecione um arquivo PDF.");
        return;
      }
      const ext = (file.name || "").toLowerCase().slice(-4);
      if(ext !== ".pdf"){
        toast("Apenas arquivos PDF são aceitos.");
        return;
      }
      const enviarParaGpt = root?.querySelector("#cvEnviarParaGpt")?.checked !== false;
      const form = new FormData();
      form.append("arquivo", file);
      form.append("enviarParaGpt", enviarParaGpt ? "true" : "false");
      try{
        const resp = await apiFetchJson(`${CANDIDATOS_API_URL}/${candId}/documentos/curriculo-extrair`, {
          method: "POST",
          body: form
        });
        if(!resp){
          toast("Currículo enviado.");
        } else {
          const c = findCand(candId);
          if(c && resp.documento){
            if(!Array.isArray(c.documentos)) c.documentos = [];
            c.documentos.unshift(resp.documento);
            renderDocumentList(root, c, "#docList");
          }
          if(resp.suggestedData){
            _suggestedDataPayload = resp.suggestedData;
            $("#suggestedCandidatoId").value = candId;
            $("#suggestedTalentoId").value = c?.talentoId || "";
            const el = document.getElementById("suggestedCvText");
            if(el) el.value = resp.cvText || "";
            const s = resp.suggestedData;
            $("#suggestedNome").value = s.nome || "";
            $("#suggestedEmail").value = s.email || "";
            $("#suggestedFone").value = s.fone || "";
            $("#suggestedCidade").value = s.cidade || "";
            $("#suggestedUf").value = (s.uf || "").toUpperCase().slice(0,2);
            $("#suggestedResumo").value = s.resumoProfissional || "";
            const btnTalento = $("#btnApplyCandidatoETalento");
            if(btnTalento){
              if(c?.talentoId) btnTalento.classList.remove("d-none"); else btnTalento.classList.add("d-none");
            }
            bootstrap.Modal.getOrCreateInstance($("#modalCvSuggested")).show();
          } else {
            toast("Currículo enviado." + (enviarParaGpt ? " Nenhum dado extraído pela IA." : ""));
          }
        }
        if(fileInput) fileInput.value = "";
      }catch(err){
        console.error(err);
        toast("Falha ao enviar currículo.");
      }
    }

    function buildTalentoUpdateFromSuggested(s){
      if(!s) return null;
      return {
        nome: s.nome || "",
        email: s.email || "",
        fone: s.fone || null,
        cidade: s.cidade || null,
        uf: (s.uf || "").toUpperCase().slice(0,2) || null,
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

    async function applySuggestedToCandidato(alsoTalento){
      const candId = $("#suggestedCandidatoId").value;
      const talentoId = $("#suggestedTalentoId").value;
      if(!candId){ toast("Candidato não definido."); return; }
      const nome = ($("#suggestedNome").value || "").trim();
      const email = ($("#suggestedEmail").value || "").trim();
      if(!nome || !email){ toast("Preencha nome e email."); return; }
      const cvTextEl = document.getElementById("suggestedCvText");
      const cvText = (cvTextEl?.value || "").trim() || null;
      const c = findCand(candId);
      const payload = {
        nome,
        email,
        fone: ($("#suggestedFone").value || "").trim() || null,
        cidade: ($("#suggestedCidade").value || "").trim() || null,
        uf: ($("#suggestedUf").value || "").trim().toUpperCase().slice(0,2) || null,
        fonte: c?.fonte || "email",
        status: c?.status || "novo",
        vagaId: c?.vagaId || "",
        obs: c?.obs || null,
        cvText,
        lastMatch: c?.lastMatch || null,
        documentos: null,
        applicationRecruiterUserId: c?.applicationRecruiterUserId || null,
        applicationRecruiterUserName: c?.applicationRecruiterUserName || null,
        talentoId: c?.talentoId || null
      };
      try{
        await apiFetchJson(`${CANDIDATOS_API_URL}/${candId}`, { method: "PUT", body: JSON.stringify(payload) });
        if(alsoTalento && talentoId){
          const s = _suggestedDataPayload;
          const talentoPayload = buildTalentoUpdateFromSuggested({
            ...s,
            nome: ($("#suggestedNome").value || "").trim(),
            email: ($("#suggestedEmail").value || "").trim(),
            fone: ($("#suggestedFone").value || "").trim() || null,
            cidade: ($("#suggestedCidade").value || "").trim() || null,
            uf: ($("#suggestedUf").value || "").trim().toUpperCase().slice(0,2) || null,
            resumoProfissional: ($("#suggestedResumo").value || "").trim() || null
          });
          if(talentoPayload){
            const baseUrl = (window.__apiBaseUrl || "").replace(/\/$/, "");
            await apiFetchJson(`${baseUrl}/Talentos/_api/${talentoId}`, { method: "PUT", body: JSON.stringify(talentoPayload) });
          }
        }
        bootstrap.Modal.getOrCreateInstance($("#modalCvSuggested")).hide();
        toast(alsoTalento && talentoId ? "Dados aplicados no candidato e no talento." : "Dados aplicados no candidato.");
        ensureCandidateDetails(candId).then(() => requestRenderDetail());
      }catch(err){
        console.error(err);
        toast("Falha ao aplicar dados.");
      }
    }

    function wireCvSuggestedModal(){
      $("#btnApplyCandidato")?.addEventListener("click", () => applySuggestedToCandidato(false));
      $("#btnApplyCandidatoETalento")?.addEventListener("click", () => applySuggestedToCandidato(true));
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
        fillModalVagaAutocomplete(c.vagaId || "");
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
        fillModalVagaAutocomplete(state.vagas.length ? (state.vagas[0]?.id || "") : "");
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
      if(state.vagas.length > 0 && !vagaId){ toast("Selecione uma vaga."); return; }

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
          state.pagination.page = 1;
          await syncCandidatosFromApi();
          state.selectedId = mapped.id;
          toast("Candidato criado.");
        }

        updateKpis();
        renderVagaFilters();
        renderList();
        renderPagination();
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

    const BLOQUEIO_PESSOA_API = "/api/bloqueio-pessoa";

    async function sendToBloqueio(id){
      const c = findCand(id);
      if(!c) return;
      const ok = confirm(`Enviar "${c.nome}" para Bloqueio de pessoa (blacklist)?`);
      if(!ok) return;
      try{
        await apiFetchJson(`${BLOQUEIO_PESSOA_API}/from-candidato/${id}`, { method: "POST" });
        toast("Pessoa enviada para Bloqueio de pessoa.");
      }catch(err){
        console.error(err);
        toast(err?.message || "Falha ao enviar para Bloqueio de pessoa.");
      }
    }

    async function deleteCand(id){
      const c = findCand(id);
      if(!c) return;

      const ok = confirm(`Excluir o candidato "${c.nome}"?`);
      if(!ok) return;

      try{
        await apiFetchJson(`${CANDIDATOS_API_URL}/${id}`, { method: "DELETE" });
        await syncCandidatosFromApi();
        state.selectedId = state.candidatos[0]?.id || null;
        updateKpis();
        renderList();
        renderPagination();
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

      if(state.vagas.length > 0 && !vid){
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
      const el = $("#nowLabel");
      if (!el.length) return;
      const tick = () => {
        const d = new Date();
        el.text(d.toLocaleString("pt-BR", {
          weekday: "short", day: "2-digit", month: "2-digit",
          hour: "2-digit", minute: "2-digit"
        }));
      };
      tick();
      setInterval(tick, 1000 * 15);
    }

    function renderPagination(){
      const wrap = $("#paginationWrap");
      if(!wrap) return;
      wrap.replaceChildren();

      const total = state.pagination.totalCount;
      const page = state.pagination.page;
      const pageSize = state.pagination.pageSize;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const to = Math.min(page * pageSize, total);

      const info = document.createElement("div");
      info.className = "small text-muted";
      info.textContent = total === 0 ? "Nenhum candidato" : `Mostrando ${from} a ${to} de ${total}`;
      wrap.appendChild(info);

      const nav = document.createElement("nav");
      nav.className = "d-flex align-items-center gap-1";
      const prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "btn btn-ghost btn-sm";
      prevBtn.innerHTML = "<i class=\"bi bi-chevron-left\"></i>";
      prevBtn.disabled = page <= 1;
      prevBtn.title = "Página anterior";
      prevBtn.addEventListener("click", () => goToPage(page - 1));
      nav.appendChild(prevBtn);

      const pageLabel = document.createElement("span");
      pageLabel.className = "small px-2";
      pageLabel.textContent = `Página ${page} de ${totalPages}`;
      nav.appendChild(pageLabel);

      const nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "btn btn-ghost btn-sm";
      nextBtn.innerHTML = "<i class=\"bi bi-chevron-right\"></i>";
      nextBtn.disabled = page >= totalPages;
      nextBtn.title = "Próxima página";
      nextBtn.addEventListener("click", () => goToPage(page + 1));
      nav.appendChild(nextBtn);

      wrap.appendChild(nav);
    }

    async function goToPage(p){
      if(p < 1) return;
      const totalPages = Math.max(1, Math.ceil(state.pagination.totalCount / state.pagination.pageSize));
      if(p > totalPages) return;
      state.pagination.page = p;
      await syncCandidatosFromApi();
      updateKpis();
      renderList();
      renderPagination();
      requestRenderDetail();
    }

    function wireFilters(){
      const apply = async () => {
        state.filters.q = ($("#fSearch").value || "").trim();
        state.filters.statuses = collectFilterStatuses();
        state.filters.vagaIds = collectFilterVagaIds();
        state.pagination.page = 1;
        try {
          await syncCandidatosFromApi();
          updateKpis();
          renderList();
          renderPagination();
          requestRenderDetail();
        } catch (err) {
          console.error(err);
          toast("Falha ao aplicar filtros.");
        }
      };

      $("#fSearch").addEventListener("input", () => {
        const t = ($("#fSearch").value || "").trim();
        state.filters.q = t;
        state.pagination.page = 1;
        debounceApply(apply);
      });
      $("#fSearch").addEventListener("change", () => { state.filters.q = ($("#fSearch").value || "").trim(); apply(); });

      let debounceTimer = null;
      function debounceApply(fn){
        if(debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => { debounceTimer = null; fn(); }, 400);
      }

      const fVagaEl = $("#fVaga");
      if(fVagaEl) fVagaEl.addEventListener("change", () => {
        state.filters.vagaIds = collectFilterVagaIds();
        state.pagination.page = 1;
        apply();
      });

      $("#globalSearch").addEventListener("input", () => {
        $("#fSearch").value = $("#globalSearch").value;
        state.filters.q = ($("#fSearch").value || "").trim();
        state.pagination.page = 1;
        debounceApply(apply);
      });
    }

    function wireButtons(){
      $("#btnNewCand").addEventListener("click", () => openCandModal("new"));
      $("#btnSaveCand").addEventListener("click", upsertCandFromModal);
      $("#btnExportJson").addEventListener("click", exportJson);
      wireCvSuggestedModal();
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
          renderPagination();
          requestRenderDetail();
        }else{
          renderVagaFilters();
          updateKpis();
          renderList();
          renderPagination();
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
