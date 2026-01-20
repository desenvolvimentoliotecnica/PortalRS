// ========= Logo (Data URI placeholder)
    const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";
    const VAGAS_API_URL = window.__triagemVagasApiUrl || "/Triagem/_api/vagas";
    const CANDIDATOS_API_URL = window.__triagemCandidatosApiUrl || "/Triagem/_api/candidatos";
    const CANDIDATOS_HISTORY_URL = window.__triagemCandidatosHistoryApiUrl || "/Triagem/_api/candidatos";

    function enumFirstCode(key, fallback){
      const list = getEnumOptions(key);
      return list.length ? list[0].code : fallback;
    }

    let VAGA_ALL = enumFirstCode("vagaFilter", "all");
    let DEFAULT_CAND_FONTE = enumFirstCode("candidatoFonte", "email");
    let DEFAULT_CAND_STATUS = enumFirstCode("candidatoStatus", "novo");
    const EMPTY_TEXT = "—";
    const BULLET = "•";

    function toUiStatus(value){
      const text = (value ?? "").toString().trim();
      return text ? text.toLowerCase() : DEFAULT_CAND_STATUS;
    }

    function toApiStatus(value){
      const text = (value ?? DEFAULT_CAND_STATUS).toString().trim().toLowerCase();
      return text || DEFAULT_CAND_STATUS;
    }

    function setText(root, role, value, fallback = EMPTY_TEXT){
      if(!root) return;
      const el = root.querySelector(`[data-role="${role}"]`);
      if(!el) return;
      el.textContent = (value ?? fallback);
    }

    function buildTag(iconClass, text, cls){
      const tag = cloneTemplate("tpl-tri-tag");
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

    function buildStatusTag(s){
      const map = {
        novo:      { cls:"" },
        triagem:   { cls:"warn" },
        aprovado:  { cls:"ok" },
        reprovado: { cls:"bad" },
        pendente:  { cls:"warn" }
      };
      const it = map[s] || { cls:"" };
      const labelText = getEnumText("candidatoStatus", s, s);
      return buildTag("bi-dot", labelText, it.cls);
    }

    function formatDecisionReason(code){
      if(!code) return "";
      return getEnumText("triagemDecisionReason", code, code);
    }

    const state = {
      vagas: [],
      candidatos: [],
      historyByCandidate: {},
      selectedId: null,
      filters: { q:"", vagaId:"all", sla:"all" }
    };

    async function apiFetchJson(url, options = {}){
      const opts = { ...options };
      opts.headers = { "Accept": "application/json", ...(opts.headers || {}) };
      const isFormData = typeof FormData !== "undefined" && opts.body instanceof FormData;
      if(opts.body && !opts.headers["Content-Type"] && !isFormData){
        opts.headers["Content-Type"] = "application/json";
      }

      const res = await fetch(url, opts);
      if(!res.ok){
        const message = await res.text();
        throw new Error(message || `Falha na API (${res.status}).`);
      }
      if(res.status === 204) return null;
      return res.json();
    }

    function mapPesoToNumber(peso){
      if(typeof peso === "number") return peso;
      const text = getEnumText("vagaPeso", peso, peso);
      const match = (text ?? "").toString().match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
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
            sinonimos: Array.isArray(r.sinonimos) ? r.sinonimos : []
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
        lastMatch: mapLastMatchFromApi(api.lastMatch)
      };
    }

    function buildCandidatePayload(c){
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
        documentos: null,
        statusChange: c.statusChange || null
      };
    }

    async function fetchVagaById(id){
      return apiFetchJson(`${VAGAS_API_URL}/${id}`, { method: "GET" });
    }

    async function syncVagasSummary(){
      const list = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
      state.vagas = Array.isArray(list)
        ? list.map(mapVagaFromList).filter(Boolean)
        : [];
    }

    async function syncCandidatosFromApi(){
      const list = await apiFetchJson(CANDIDATOS_API_URL, { method: "GET" });
      state.candidatos = Array.isArray(list)
        ? list.map(mapCandidateFromApi).filter(Boolean)
        : [];
      state.selectedId = state.candidatos.find(c => c.status === "triagem")?.id || state.candidatos[0]?.id || null;
    }

    async function syncVagaDetailsForCandidates(){
      const ids = new Set(state.candidatos.map(c => c.vagaId).filter(Boolean));
      const detailList = await Promise.all(Array.from(ids).map(async id => {
        try{
          return await fetchVagaById(id);
        }catch{
          return null;
        }
      }));

      detailList.filter(Boolean).forEach(detail => {
        const mapped = mapVagaFromDetail(detail);
        if(!mapped) return;
        const idx = state.vagas.findIndex(v => v.id === mapped.id);
        if(idx >= 0) state.vagas[idx] = { ...state.vagas[idx], ...mapped };
        else state.vagas.push(mapped);
      });
    }

    async function saveCandToApi(candidate){
      const payload = buildCandidatePayload(candidate);
      const saved = await apiFetchJson(`${CANDIDATOS_API_URL}/${candidate.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      const mapped = mapCandidateFromApi(saved);
      if(mapped){
        state.candidatos = state.candidatos.map(c => c.id === mapped.id ? mapped : c);
      }
      return mapped;
    }

    async function loadHistory(candId){
      if(!candId) return;
      try{
        const items = await apiFetchJson(`${CANDIDATOS_HISTORY_URL}/${candId}/status-history`, { method: "GET" });
        state.historyByCandidate[candId] = Array.isArray(items) ? items : [];
      }catch{
        state.historyByCandidate[candId] = [];
      }
    }

    function findVaga(id){
      return state.vagas.find(v => v.id === id) || null;
    }

    function findCand(id){
      return state.candidatos.find(c => c.id === id) || null;
    }

    // ========= Matching (por keyword) • mesmo padrão da tela de Candidatos
    function calcMatchForCand(cand){
      const v = findVaga(cand.vagaId);
      if(!v) return { score: 0, pass: false, hits: [], missMandatory: [], totalPeso: 1, hitPeso: 0, threshold: 0 };

      const text = normalizeText(cand.cvText || "");
      const reqs = (v.requisitos || []);
      if(!text || !reqs.length){
        const thr = clamp(parseInt(v.threshold || 0,10)||0,0,100);
        return { score: 0, pass: 0 >= thr, hits: [], missMandatory: [], totalPeso: 1, hitPeso: 0, threshold: thr };
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
      return buildTag("bi-stars", `${s}% ${BULLET} ${text}`, cls);
    }

    // ========= SLA
    function slaInfo(c){
      const now = Date.now();
      const updatedAt = c.updatedAt ? new Date(c.updatedAt).getTime() : now;
      let limitH = null;
      if(c.status === "triagem") limitH = 48;
      if(c.status === "pendente") limitH = 72;
      if(limitH == null) return { has:false, late:false, leftH: null, limitH: null };

      const ageH = (now - updatedAt) / (1000*60*60);
      const leftH = limitH - ageH;
      return { has:true, late: leftH < 0, leftH, limitH };
    }

    // ========= Board data + filters
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

    function getFilteredCands(){
      const q = (state.filters.q || "").trim().toLowerCase();
      const vid = state.filters.vagaId;
      const sla = state.filters.sla;

      return state.candidatos.filter(c => {
        if(!["triagem","pendente","aprovado","reprovado"].includes(c.status)) return false;

        if(vid !== "all" && c.vagaId !== vid) return false;

        if(sla !== "all"){
          const si = slaInfo(c);
          if(!si.has) return false;
          if(sla === "late" && !si.late) return false;
          if(sla === "ok" && si.late) return false;
        }

        if(!q) return true;
        const v = findVaga(c.vagaId);
        const blob = [c.nome, c.email, c.fone, v?.titulo, v?.codigo, c.cidade, c.uf, c.fonte].join(" ").toLowerCase();
        return blob.includes(q);
      });
    }

    function groupByStage(list){
      const g = { triagem: [], pendente: [], aprovado: [], reprovado: [] };
      list.forEach(c => g[c.status]?.push(c));
      return g;
    }

    // ========= Render board
    function renderBoard(){
      const list = getFilteredCands();
      const g = groupByStage(list);

      renderStageList("#listTriagem", g.triagem);
      renderStageList("#listPendente", g.pendente);
      renderStageList("#listAprovado", g.aprovado);
      renderStageList("#listReprovado", g.reprovado);

      $("#countTriagem").textContent = g.triagem.length;
      $("#countPendente").textContent = g.pendente.length;
      $("#countAprovado").textContent = g.aprovado.length;
      $("#countReprovado").textContent = g.reprovado.length;
    }

    function renderStageList(selector, items){
      const host = $(selector);
      if(!host) return;
      host.replaceChildren();

      if(!items.length){
        const empty = cloneTemplate("tpl-tri-empty");
        if(empty) host.appendChild(empty);
        return;
      }

      items.forEach(c => {
        const card = buildTriItem(c);
        if(card) host.appendChild(card);
      });
    }

    function buildTriItem(c){
      const v = findVaga(c.vagaId);
      const m = calcMatchForCand(c);
      const thr = m.threshold ?? (v ? v.threshold : 0);
      const si = slaInfo(c);

      const card = cloneTemplate("tpl-tri-card");
      if(!card) return null;

      card.dataset.id = c.id;
      card.draggable = true;
      if(c.id === state.selectedId) card.classList.add("active");

      setText(card, "cand-initials", initials(c.nome));
      setText(card, "cand-name", c.nome);
      setText(card, "cand-email", c.email);

      const vagaCode = card.querySelector('[data-role="vaga-code"]');
      if(vagaCode){
        vagaCode.textContent = v ? (v.codigo || EMPTY_TEXT) : "Sem vaga";
        vagaCode.classList.toggle("mono", !!v);
      }
      setText(card, "vaga-title", v ? v.titulo : EMPTY_TEXT);

      const score = clamp(parseInt(m.score||0,10)||0,0,100);
      const thrVal = clamp(parseInt(thr||0,10)||0,0,100);
      const progress = card.querySelector('[data-role="match-progress"]');
      if(progress) progress.style.width = `${score}%`;
      setText(card, "match-score", `${score}%`);
      setText(card, "match-thr", `${thrVal}%`);

      const matchStatus = card.querySelector('[data-role="match-status"]');
      if(matchStatus){
        matchStatus.textContent = m.pass ? "dentro" : "abaixo";
        matchStatus.classList.toggle("text-success", !!m.pass);
        matchStatus.classList.toggle("text-danger", !m.pass);
      }

      const tags = card.querySelector('[data-role="tri-tags"]');
      if(tags){
        tags.replaceChildren();
        if(si.has){
          if(si.late){
            tags.appendChild(buildTag("bi-alarm", "SLA atrasado", "bad"));
          }else{
            tags.appendChild(buildTag("bi-alarm", `${Math.ceil(si.leftH)}h`, "warn"));
          }
        }else{
          tags.appendChild(buildTag("bi-dash-circle", "Sem SLA", ""));
        }

        const missCount = (m.missMandatory || []).length;
        tags.appendChild(buildTag(
          missCount ? "bi-exclamation-triangle" : "bi-check2",
          missCount ? `${missCount} obrig.` : "Obrig. OK",
          missCount ? "bad" : "ok"
        ));
      }

      const btnDetails = card.querySelector('[data-act="details"]');
      if(btnDetails){
        btnDetails.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          openDetails(c.id);
        });
      }

      const btnDecision = card.querySelector('[data-act="decision"]');
      if(btnDecision){
        btnDecision.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          openDecision(c.id);
        });
      }

      card.addEventListener("dragstart", onDragStart);
      return card;
    }

    // ========= Drag & Drop
    let dragId = null;

    function onDragStart(ev){
      dragId = ev.currentTarget.dataset.id;
      ev.dataTransfer.setData("text/plain", dragId);
      ev.dataTransfer.effectAllowed = "move";
    }

    function setupDropZones(){
      const zones = [
        { id:"#dropTriagem", stage:"triagem" },
        { id:"#dropPendente", stage:"pendente" },
        { id:"#dropAprovado", stage:"aprovado" },
        { id:"#dropReprovado", stage:"reprovado" }
      ];

      zones.forEach(z => {
        const el = $(z.id);
        el.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
        });
        el.addEventListener("drop", (ev) => {
          ev.preventDefault();
          const id = ev.dataTransfer.getData("text/plain") || dragId;
          if(!id) return;
          void moveStage(id, z.stage, { reason:"Drag&Drop", note:"Movido no board.", source:"board" });
        });
      });
    }

    async function moveStage(candId, newStage, meta, patch){
      const c = findCand(candId);
      if(!c) return;

      const prev = c.status;
      if(prev === newStage) return;

      const updated = {
        ...c,
        ...patch,
        status: newStage,
        updatedAt: new Date().toISOString(),
        statusChange: {
          reason: meta?.reason || null,
          note: meta?.note || null,
          source: meta?.source || "triagem"
        }
      };

      try{
        const saved = await saveCandToApi(updated);
        if(!saved) throw new Error("Resposta invalida da API.");

        await loadHistory(saved.id);
        state.selectedId = saved.id;
        renderBoard();
        renderDetail();
        toast(`Movido: ${labelStage(prev)} -> ${labelStage(newStage)}`);
      }catch(err){
        console.error(err);
        toast("Falha ao salvar candidato.");
      }
    }

    function labelStage(s){
      const map = {
        triagem: "Em triagem",
        pendente: "Pendente",
        aprovado: "Aprovado",
        reprovado: "Reprovado",
        novo: "Novo"
      };
      return map[s] || s;
    }

    // ========= Detail panel
    function renderDetail(){
      const host = $("#triagemDetailBody");
      if(!host) return;
      host.replaceChildren();

      const c = findCand(state.selectedId);
      if(!c){
        const empty = cloneTemplate("tpl-tri-detail-empty");
        if(empty) host.appendChild(empty);
        return;
      }

      const v = findVaga(c.vagaId);
      const m = calcMatchForCand(c);
      const thr = m.threshold ?? (v ? v.threshold : 0);
      const si = slaInfo(c);

      const updated = c.updatedAt ? new Date(c.updatedAt) : null;
      const updatedTxt = updated ? updated.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" }) : EMPTY_TEXT;

      const miss = (m.missMandatory||[]).map(r=>r.termo).slice(0,12);
      const hit = (m.hits||[]).map(r=>r.termo).slice(0,12);

      const log = (state.historyByCandidate[c.id] || []).slice(0, 10);

      const slaTxt = si.has ? (si.late ? "Atrasado" : `Faltam ~${Math.ceil(si.leftH)}h`) : "Sem SLA";

      const root = cloneTemplate("tpl-tri-detail");
      if(!root) return;

      setText(root, "detail-initials", initials(c.nome));
      setText(root, "detail-name", c.nome);
      setText(root, "detail-email", c.email);
      setText(root, "detail-updated", updatedTxt);

      const statusHost = root.querySelector('[data-role="detail-status-host"]');
      if(statusHost) statusHost.replaceChildren(buildStatusTag(c.status));
      setText(root, "detail-sla", slaTxt);

      const vagaTitle = v ? (v.titulo || EMPTY_TEXT) : "Vaga nao vinculada";
      setText(root, "detail-vaga-title", vagaTitle);
      setText(root, "detail-vaga-code", v?.codigo);
      const thrVal = clamp(parseInt(thr||0,10)||0,0,100);
      setText(root, "detail-vaga-thr", v ? `${thrVal}%` : EMPTY_TEXT);
      toggleRole(root, "detail-vaga-code-wrap", !!v);
      toggleRole(root, "detail-vaga-thr-wrap", !!v);

      const matchHost = root.querySelector('[data-role="detail-match-host"]');
      if(matchHost){
        matchHost.replaceChildren();
        if(v){
          matchHost.appendChild(buildMatchTag(m.score, thr));
        }else{
          matchHost.appendChild(buildTag("bi-dash-circle", EMPTY_TEXT, ""));
        }
      }

      const score = clamp(parseInt(m.score||0,10)||0,0,100);
      const progress = root.querySelector('[data-role="detail-match-progress"]');
      if(progress) progress.style.width = `${score}%`;
      setText(root, "detail-match-score", `${score}%`);
      setText(root, "detail-match-hits", (m.hits||[]).length);
      setText(root, "detail-match-miss", (m.missMandatory||[]).length);

      const missAlert = root.querySelector('[data-role="detail-miss-alert"]');
      const hitAlert = root.querySelector('[data-role="detail-hit-alert"]');
      if(missAlert) missAlert.classList.toggle("d-none", !miss.length);
      if(hitAlert) hitAlert.classList.toggle("d-none", !!miss.length);
      setText(root, "detail-miss-list", miss.join(", "));
      setText(root, "detail-hit-list", hit.length ? hit.join(", ") : EMPTY_TEXT);

      const logHost = root.querySelector('[data-role="tri-log-list"]');
      if(logHost){
        logHost.replaceChildren();
        if(log.length){
          log.forEach(x => {
            const item = cloneTemplate("tpl-tri-log-item");
            if(!item) return;
            const title = `${labelStage(x.fromStatus)} -> ${labelStage(x.toStatus)}`;
            const reasonTxt = formatDecisionReason(x.reason) || "-";
            const noteTxt = x.note ? `${BULLET} ${x.note}` : "";
            setText(item, "log-title", title);
            setText(item, "log-note", `${reasonTxt} ${noteTxt}`.trim());
            setText(item, "log-time", new Date(x.createdAtUtc).toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }));
            logHost.appendChild(item);
          });
        }else{
          const empty = cloneTemplate("tpl-tri-log-empty");
          if(empty) logHost.appendChild(empty);
        }
      }

      host.appendChild(root);
      bindDetailActions(host, c);
    }

    function bindDetailActions(root, c){
      if(!root || !c) return;
      root.querySelectorAll("[data-dact]").forEach(btn => {
        btn.addEventListener("click", () => {
          const act = btn.dataset.dact;
          if(act === "decision") openDecision(c.id);
          if(act === "recalc") recalcMatch(c.id);
        });
      });
    }

    async function openDetails(candId){
      const c = findCand(candId);
      if(!c) return;
      state.selectedId = c.id;
      await loadHistory(c.id);
      renderBoard();
      renderDetail();
      bootstrap.Modal.getOrCreateInstance($("#modalTriagemDetails")).show();
    }

    window.__openDetails = (id) => {
      void openDetails(id);
    };

    // ========= Decision modal
    function openDecision(candId){
      const c = findCand(candId);
      if(!c) return;

      $("#decCandId").value = c.id;

      const v = findVaga(c.vagaId);
      const m = calcMatchForCand(c);
      const suggested = suggestDecision(c, v, m);

      $("#decAction").value = suggested.action;
      $("#decReason").value = suggested.reason || "";
      $("#decObs").value = "";

      $("#decisionTitle").textContent = `Decisao • ${c.nome}`;

      bootstrap.Modal.getOrCreateInstance($("#modalDecision")).show();
    }

    window.__openDecision = (id) => openDecision(id);

    function suggestDecision(c, v, m){
      const thr = m.threshold ?? (v ? v.threshold : 0);
      const miss = (m.missMandatory||[]).length;
      if(miss){
        return { action:"reprovado", reason:"missing_mandatory" };
      }
      if(m.score < thr){
        const gap = thr - m.score;
        if(gap >= 25) return { action:"reprovado", reason:"below_threshold" };
        return { action:"pendente", reason:"needs_validation" };
      }
      return { action:"aprovado", reason:"profile_fit" };
    }

    async function applyDecision(){
      const id = $("#decCandId").value;
      const action = $("#decAction").value;
      const reason = ($("#decReason").value || "").trim();
      const reasonLabel = formatDecisionReason(reason);
      const obs = ($("#decObs").value || "").trim();

      const c = findCand(id);
      if(!c) return;

      const lines = [];
      if(reason) lines.push(reasonLabel || reason);
      if(obs) lines.push(obs);
      const note = lines.join(" • ");
      const mergedObs = note ? ((c.obs || "").trim() ? `${c.obs.trim()}\n${note}` : note) : c.obs;

      await moveStage(id, action, {
        reason: reason || "Decisao",
        note: obs || "",
        source: "decision"
      }, { obs: mergedObs });

      bootstrap.Modal.getOrCreateInstance($("#modalDecision")).hide();
    }

    // ========= Recalc match
    async function recalcMatch(candId){
      const c = findCand(candId);
      if(!c) return;

      const m = calcMatchForCand(c);
      const updated = {
        ...c,
        lastMatch: { score: m.score, pass: m.pass, at: new Date().toISOString(), vagaId: c.vagaId },
        updatedAt: new Date().toISOString()
      };

      try{
        await saveCandToApi(updated);
        renderBoard();
        renderDetail();
        toast("Match recalculado.");
      }catch(err){
        console.error(err);
        toast("Falha ao recalcular match.");
      }
    }

    // ========= Auto-triage
    async function autoTriage(){
      const list = getFilteredCands();
      const tri = list.filter(c => c.status === "triagem");

      if(!tri.length){
        toast("Nenhum candidato em triagem com os filtros atuais.");
        return;
      }

      let moved = 0;

      for(const c of tri){
        const v = findVaga(c.vagaId);
        const m = calcMatchForCand(c);
        const sug = suggestDecision(c, v, m);

        if(sug.action && sug.action !== "triagem"){
          await moveStage(c.id, sug.action, { reason: "Auto-triagem", note: formatDecisionReason(sug.reason) || "", source: "auto" });
          moved++;
        }
      }

      toast(`Auto-triagem aplicada em ${moved} candidato(s).`);
    }

    // ========= Import/Export
    function exportJson(){
      const history = state.selectedId ? (state.historyByCandidate[state.selectedId] || []) : [];
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        triageLog: history
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "triagem_log_liotecnica.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Exportacao iniciada.");
    }

    function importJson(){
      toast("Importacao local desativada.");
    }

    // ========= UI wiring
    function initLogo(){
      $("#logoDesktop").src = LOGO_DATA_URI;
      $("#logoMobile").src = LOGO_DATA_URI;
    }

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
      const fSearch = $("#fSearch");
      const fVaga = $("#fVaga");
      const fSla = $("#fSla");
      if(!fSearch || !fVaga || !fSla) return;

      const apply = () => {
        state.filters.q = (fSearch.value || "").trim();
        state.filters.vagaId = fVaga.value || "all";
        state.filters.sla = fSla.value || "all";
        renderBoard();

        const visibleIds = new Set(getFilteredCands().map(c => c.id));
        if(state.selectedId && !visibleIds.has(state.selectedId)){
          state.selectedId = null;
          renderDetail();
        }
      };

      fSearch.addEventListener("input", apply);
      fVaga.addEventListener("change", apply);
      fSla.addEventListener("change", apply);
    }

    function wireButtons(){
      $("#btnApplyDecision").addEventListener("click", applyDecision);
      $("#btnAutoTriage").addEventListener("click", () => { void autoTriage(); });

      $("#btnExportJson").addEventListener("click", exportJson);
    }

    function refreshEnumDefaults(){
      VAGA_ALL = enumFirstCode("vagaFilter", "all");
      DEFAULT_CAND_FONTE = enumFirstCode("candidatoFonte", "email");
      DEFAULT_CAND_STATUS = enumFirstCode("candidatoStatus", "novo");
    }

    // ========= Init
    (async function init(){
      initLogo();
      wireClock();

      await ensureEnumData();
      refreshEnumDefaults();
      applyEnumSelects();

      try{
        await syncVagasSummary();
        await syncCandidatosFromApi();
        await syncVagaDetailsForCandidates();
      }catch(err){
        console.error(err);
        toast("Falha ao carregar candidatos/vagas.");
      }

      if(state.selectedId){
        await loadHistory(state.selectedId);
      }

      renderVagaFilter();
      renderBoard();
      renderDetail();

      setupDropZones();
      wireFilters();
      wireButtons();
    })();
