// ========= Logo (Data URI placeholder)
    const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";
    const INBOX_API_URL = "/EntradaEmailPasta/_api/inbox";
    const VAGAS_API_URL = "/EntradaEmailPasta/_api/vagas";
    const CANDIDATOS_API_URL = "/EntradaEmailPasta/_api/candidatos";


    // ======= SignalR (push) para atualizar a fila sem refresh manual
    // A URL do hub e o tenant s?o injetados pelo Razor em window.__inboxHubUrl / window.__tenantId.
    let inboxHubConnection = null;
    let inboxHubRefreshTimer = null;

    function scheduleInboxRefresh(){
      if(inboxHubRefreshTimer) clearTimeout(inboxHubRefreshTimer);
      // Debounce simples para evitar varias atualizacoes em sequencia.
      inboxHubRefreshTimer = setTimeout(async () => {
        try{
          await loadInbox(true);
          renderAll();
        }catch(err){
          console.error(err);
        }
      }, 400);
    }

    async function startInboxHub(){
      if(!window.signalR || !window.__inboxHubUrl || !window.__tenantId){
        console.warn("SignalR nao disponivel ou tenant ausente.");
        return;
      }
      if(inboxHubConnection) return;

      const hubUrl = `${window.__inboxHubUrl}?tenantId=${encodeURIComponent(window.__tenantId)}`;
      console.info("InboxHub conectando...", hubUrl);
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(hubUrl)
        // Reconnect automatico para manter a fila viva mesmo com queda de rede.
        .withAutomaticReconnect([0, 2000, 5000, 10000])
        .build();

      const onAnyInboxEvent = (payload) => {
        console.info("InboxHub evento", payload);
        scheduleInboxRefresh();
      };

      // Eventos disparados pela API (InboxController / InboxFileProcessor).
      connection.on("inbox.created", onAnyInboxEvent);
      connection.on("inbox.updated", onAnyInboxEvent);
      connection.on("inbox.processed", onAnyInboxEvent);
      connection.on("inbox.failed", onAnyInboxEvent);
      connection.on("inbox.deleted", onAnyInboxEvent);

      connection.onclose(err => {
        if(err) console.warn("InboxHub desconectado", err);
      });

      try{
        await connection.start();
        inboxHubConnection = connection;
        console.info("InboxHub conectado");
      }catch(err){
        console.error("InboxHub falhou", err);
      }
    }

    const state = {
      vagas: [],
      inbox: [],
      selectedId: null,
      filters: { q:"", origem:"all", status:"all" }
    };


    let detailModal = null;

    function getDetailModal(){
      const el = document.getElementById("inboxDetailModal");
      if(!el || !window.bootstrap) return null;
      if(!detailModal){
        detailModal = new bootstrap.Modal(el);
      }
      return detailModal;
    }

    function isDetailModalOpen(){
      const el = document.getElementById("inboxDetailModal");
      return !!(el && el.classList.contains("show"));
    }

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

    function mapVagaFromApi(v){
      return { id: v.id, titulo: v.titulo || "", codigo: v.codigo || "" };
    }

    function setSelected(id){
      state.selectedId = id;
      renderList();
      renderDetail(findInbox(id));
      const modal = getDetailModal();
      if(modal){
        modal.show();
      }
    }

    function findVaga(id){ return state.vagas.find(v => v.id === id) || null; }
    function findInbox(id){ return state.inbox.find(x => x.id === id) || null; }

    function statusTag(st){
      const map = {
        novo:  { cls:"", icon:"dot" },
        processando:{ cls:"warn", icon:"arrow-repeat" },
        processado:{ cls:"ok", icon:"check2-circle" },
        falha:{ cls:"bad", icon:"exclamation-triangle" },
        descartado:{ cls:"bad", icon:"trash3" }
      };
      const label = getEnumText("inboxStatusFilter", st, st || "-");
      const it = map[st] || { cls:"", icon:"dot" };
      return `<span class="status-tag ${it.cls}"><i class="bi bi-${it.icon}"></i>${label}</span>`;
    }

    function origemPill(o){
      const map = {
        email: { icon:"envelope" },
        pasta: { icon:"folder2-open" },
        upload: { icon:"cloud-arrow-up" }
      };
      const label = getEnumText("origemFilter", o, o || "-");
      const it = map[o] || { icon:"question-circle" };
      return `<span class="pill"><i class="bi bi-${it.icon}"></i>${label}</span>`;
    }

    function attachmentPill(a){
      const icon = a.tipo === "pdf" ? "file-earmark-pdf" :
                   (a.tipo === "doc" || a.tipo === "docx" ? "file-earmark-word" : "file-earmark");
      return `<span class="chip"><i class="bi bi-${icon}"></i>${escapeHtml(a.nome)} <span class="mono muted">(${escapeHtml(a.tamanhoKB)}KB)</span></span>`;
    }

    async function loadVagas(){
      const list = await apiFetchJson(VAGAS_API_URL, { method: "GET" });
      state.vagas = Array.isArray(list) ? list.map(mapVagaFromApi) : [];
    }

    async function loadInbox(silent){
      const headers = silent ? { "X-LT-Silent": "1" } : undefined;
      const list = await apiFetchJson(INBOX_API_URL, { method: "GET", headers });
      state.inbox = Array.isArray(list) ? list : [];
      state.selectedId = state.inbox[0]?.id || null;
    }

    function buildInboxPayload(item){
      return {
        origem: item.origem,
        status: item.status,
        recebidoEm: item.recebidoEm,
        remetente: item.remetente,
        assunto: item.assunto,
        destinatario: item.destinatario,
        vagaId: item.vagaId,
        previewText: item.previewText || null,
        processamento: item.processamento ? {
          pct: item.processamento.pct || 0,
          etapa: item.processamento.etapa || null,
          log: item.processamento.log || [],
          tentativas: item.processamento.tentativas || 0,
          ultimoErro: item.processamento.ultimoErro || null
        } : null,
        anexos: (item.anexos || []).map(a => ({
          id: a.id || null,
          nome: a.nome,
          tipo: a.tipo || null,
          tamanhoKB: a.tamanhoKB || 0,
          hash: a.hash || null
        })),
        suggestedVagas: (item.suggestedVagas || []).map(s => ({
          vagaId: s.vagaId,
          titulo: s.titulo || null,
          score: s.score || 0
        }))
      };
    }

    async function saveInboxItem(item){
      const payload = buildInboxPayload(item);
      const saved = await apiFetchJson(`${INBOX_API_URL}/${item.id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      if(saved){
        state.inbox = state.inbox.map(x => x.id === saved.id ? saved : x);
      }
      return saved;
    }

    async function createInboxItem(item){
      const payload = buildInboxPayload(item);
      const saved = await apiFetchJson(INBOX_API_URL, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if(saved){
        state.inbox.unshift(saved);
      }
      return saved;
    }

    function applyFilters(list){
      const q = (state.filters.q||"").trim().toLowerCase();
      const o = state.filters.origem;
      const s = state.filters.status;

      return list.filter(x => {
        if(o !== "all" && x.origem !== o) return false;
        if(s !== "all" && x.status !== s) return false;
        if(!q) return true;

        const vaga = findVaga(x.vagaId);
        const blob = [
          x.remetente, x.assunto, x.destinatario,
          vaga?.titulo, vaga?.codigo,
          ...(x.anexos||[]).map(a => a.nome)
        ].join(" ").toLowerCase();

        return blob.includes(q);
      });
    }

    function renderAll(){
      renderKPIs();
      renderList();
      if(state.selectedId && isDetailModalOpen()){
        renderDetail(findInbox(state.selectedId));
      }
    }

    function renderKPIs(){
      const today = new Date();
      const isSameDay = (iso) => {
        const d = new Date(iso);
        return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      };

      const queue = state.inbox.filter(x => ["novo","processando"].includes(x.status)).length;
      const done = state.inbox.filter(x => x.status === "processado" && isSameDay(x.recebidoEm)).length;
      const fail = state.inbox.filter(x => x.status === "falha").length;

      $("#kpiQueue").textContent = queue;
      $("#kpiDone").textContent = done;
      $("#kpiFail").textContent = fail;
    }

    function renderList(){
      const list = applyFilters(state.inbox)
        .sort((a,b)=> new Date(b.recebidoEm||0) - new Date(a.recebidoEm||0));

      $("#queueHint").textContent = list.length ? "" : "Nenhum item encontrado com os filtros atuais.";
      $("#queueList").innerHTML = list.map(x => renderRow(x)).join("") || `<div class="text-muted small">—</div>`;

      $$(".row-item").forEach(el => {
        if(el.dataset.id === state.selectedId) el.classList.add("active");
        el.addEventListener("click", () => setSelected(el.dataset.id));
      });
    }

    function renderRow(x){
      const vaga = findVaga(x.vagaId);
      const anexo = x.anexos?.[0];
      const icon = x.origem === "email" ? "envelope" : (x.origem === "pasta" ? "folder2-open" : "cloud-arrow-up");

      const pct = clamp(parseInt(x.processamento?.pct||0,10)||0,0,100);
      const bar = (x.status === "processando")
        ? `<div class="progress mt-2"><div class="progress-bar" style="width:${pct}%"></div></div>`
        : ``;

      const sub = vaga ? `${vaga.titulo} (${vaga.codigo||"—"})` : "Vaga: não definida";

      return `
        <div class="row-item" data-id="${x.id}">
          <div class="d-flex align-items-start justify-content-between gap-2">
            <div class="d-flex align-items-center gap-2">
              <div class="avatar"><i class="bi bi-${icon}"></i></div>
              <div>
                <div class="fw-bold">${escapeHtml(x.assunto || (anexo?.nome || "—"))}</div>
                <div class="text-muted small">${escapeHtml(x.remetente || "—")} • ${escapeHtml(fmtDate(x.recebidoEm))}</div>
              </div>
            </div>
            <div class="text-end">
              ${statusTag(x.status)}
              <div class="text-muted small mt-1">${escapeHtml(sub)}</div>
            </div>
          </div>
          ${bar}
        </div>
      `;
    }

    function renderDetail(x){
      if(!x){
        $("#detailHost").innerHTML = `
          <div class="empty">
            <div class="d-flex align-items-start gap-2">
              <i class="bi bi-info-circle mt-1"></i>
              <div>
                <div class="fw-bold">Selecione um item da fila</div>
                <div class="small mt-1">Você verá metadados, anexos e ações.</div>
              </div>
            </div>
          </div>`;

        return;
      }

      const vaga = findVaga(x.vagaId);
      const pct = clamp(parseInt(x.processamento?.pct||0,10)||0,0,100);

      const attachments = (x.anexos||[]).length
        ? (x.anexos||[]).map(a => attachmentPill(a)).join(" ")
        : `<span class="text-muted small">Sem anexos</span>`;

      const log = (x.processamento?.log||[]);
      const logHtml = log.length
        ? `<ul class="mb-0 small">${log.map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
        : `<div class="text-muted small">Sem logs ainda.</div>`;

      const suggestedList = (x.suggestedVagas || []).map(s => ({
        ...s,
        isAssigned: x.vagaId && s.vagaId === x.vagaId
      }));

      const hasAssigned = !!x.vagaId;

      suggestedList.sort((a, b) => {
        if (a.isAssigned === b.isAssigned) return 0;
        return a.isAssigned ? 1 : -1; // assigned goes to end
      });

      const suggested = suggestedList.length
        ? suggestedList.map(s => {
            const stateCls = s.isAssigned ? "is-assigned" : "";
            const btnCls = s.isAssigned ? "btn-danger" : "btn-ghost";
            const btnLabel = s.isAssigned
              ? `<i class="bi bi-x-circle me-1"></i>Desvincular`
              : `<i class="bi bi-link-45deg me-1"></i>Vincular`;
            const disabled = (!s.isAssigned && hasAssigned) ? "disabled" : "";
            const disabledHint = (!s.isAssigned && hasAssigned) ? "title=\"Ja existe uma vaga vinculada\"" : "";
            return `
            <div class="suggest-item ${stateCls}" data-vaga-id="${escapeHtml(s.vagaId)}">
              <div>
                <div class="fw-semibold">${escapeHtml(s.titulo || "Vaga sugerida")}</div>
                <div class="text-muted small mono">${escapeHtml(s.vagaId)}</div>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-primary-subtle text-primary">${escapeHtml(s.score)}</span>
                <button class="btn ${btnCls} btn-sm btn-link-suggested" data-vaga-id="${escapeHtml(s.vagaId)}" type="button" ${disabled} ${disabledHint}>
                  ${btnLabel}
                </button>
              </div>
            </div>
          `;
          }).join("")
        : `<div class="text-muted small">Sem sugestoes ainda.</div>`;

      const errorBox = x.processamento?.ultimoErro
        ? `<div class="alert alert-danger mt-3 mb-0" style="border-radius:14px;">
             <div class="d-flex align-items-start gap-2">
               <i class="bi bi-exclamation-triangle mt-1"></i>
               <div>
                 <div class="fw-semibold">Erro</div>
                 <div class="small">${escapeHtml(x.processamento.ultimoErro)}</div>
               </div>
             </div>
           </div>`
        : "";

      const actions = `
        <div class="d-flex flex-wrap gap-2">
          <button class="btn btn-brand btn-sm" id="btnProcess">
            <i class="bi bi-cpu me-1"></i>${x.status === "processando" ? "Continuar" : "Processar"}
          </button>
          <button class="btn btn-ghost btn-sm" id="btnReprocess">
            <i class="bi bi-arrow-repeat me-1"></i>Reprocessar
          </button>
          <button class="btn btn-ghost btn-sm" id="btnCreateCandidate">
            <i class="bi bi-person-plus me-1"></i>Criar candidato
          </button>
          <button class="btn btn-ghost btn-sm" id="btnDiscard">
            <i class="bi bi-trash3 me-1"></i>Descartar
          </button>
        </div>
      `;

      $("#detailHost").innerHTML = `
        <div class="card-soft p-3">
          <div class="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-2">
            <div class="d-flex align-items-center gap-2">
              <div class="avatar" style="width:52px;height:52px;border-radius:16px;">
                <i class="bi bi-inbox"></i>
              </div>
              <div>
                <div class="fw-bold" style="font-size:1.05rem;">${escapeHtml(x.assunto || "—")}</div>
                <div class="text-muted small">${escapeHtml(x.remetente || "—")} • ${escapeHtml(fmtDate(x.recebidoEm))}</div>
                <div class="text-muted small">Destino: ${escapeHtml(x.destinatario || "—")}</div>
              </div>
            </div>
            <div class="text-end">
              ${statusTag(x.status)}
              <div class="text-muted small mt-1">Origem: ${origemPill(x.origem)}</div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="pill"><i class="bi bi-briefcase"></i>${escapeHtml(vaga?.titulo || "Vaga não definida")}</span>
            <span class="pill mono">${escapeHtml(vaga?.codigo || "—")}</span>
            <span class="pill"><i class="bi bi-paperclip"></i>Anexos: <strong class="ms-1">${(x.anexos||[]).length}</strong></span>
            <span class="pill"><i class="bi bi-arrow-counterclockwise"></i>Tentativas: <strong class="ms-1">${escapeHtml(x.processamento?.tentativas ?? 0)}</strong></span>
          </div>

          <div class="card-soft p-3 mb-3" style="box-shadow:none;">
            <div class="fw-bold mb-2"><i class="bi bi-stars me-1"></i>Vagas sugeridas</div>
            <div class="suggest-list">${suggested}</div>
          </div>

          <div class="row g-2">
            <div class="col-12 col-lg-6">
              <div class="fw-bold mb-2">Anexos</div>
              <div>${attachments}</div>

              <div class="mt-3">
                <div class="fw-bold">Preview (texto extraído)</div>
                <div class="text-muted small">No MVP real, vem do parser de PDF/Word.</div>
                <textarea class="form-control mt-2" rows="6" id="previewText" style="border-color:var(--lt-border);" placeholder="(vazio)">${escapeHtml(x.previewText || "")}</textarea>
                <div class="d-flex flex-wrap gap-2 mt-2">
                  <button class="btn btn-ghost btn-sm" id="btnSavePreview">
                    <i class="bi bi-save me-1"></i>Salvar preview
                  </button>
                  <button class="btn btn-ghost btn-sm" id="btnAutoAssign">
                    <i class="bi bi-diagram-3 me-1"></i>Auto-atribuir vaga (demo)
                  </button>
                </div>
              </div>

              ${errorBox}
            </div>

            <div class="col-12 col-lg-6">
              <div class="fw-bold mb-2">Processamento</div>
              <div class="card-soft p-3" style="box-shadow:none;">
                <div class="d-flex align-items-center justify-content-between">
                  <div>
                    <div class="fw-semibold">Etapa</div>
                    <div class="text-muted small" id="stepLabel">${escapeHtml(x.processamento?.etapa || "—")}</div>
                  </div>
                  <div class="fw-bold" style="font-size:1.15rem;color:var(--lt-primary);" id="pctLabel">${pct}%</div>
                </div>
                <div class="progress mt-2">
                  <div class="progress-bar" id="pctBar" style="width:${pct}%"></div>
                </div>

                <hr class="my-3" style="border-color: rgba(16,82,144,.14);">

                <div class="d-flex align-items-start gap-2">
                  <i class="bi bi-list-check mt-1"></i>
                  <div class="flex-grow-1">
                    <div class="fw-semibold">Logs</div>
                    <div class="mt-2" id="logBox">${logHtml}</div>
                  </div>
                </div>

                <hr class="my-3" style="border-color: rgba(16,82,144,.14);">

                ${actions}

                <div class="text-muted small mt-3">
                  <i class="bi bi-info-circle me-1"></i>
                  Produto real: IMAP/Watcher ? fila ? storage ? parser ? candidato (triagem).
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      $("#btnSavePreview").addEventListener("click", async () => {
        x.previewText = ($("#previewText").value || "").trim();
        await saveInboxItem(x);
        toast("Preview salvo.");
      });

      $("#btnAutoAssign").addEventListener("click", async () => {
        const v = state.vagas[0];
        if(v){
          x.vagaId = v.id;
          await saveInboxItem(x);
          toast("Vaga atribuída (demo).");
          renderAll();
        }
      });

      $("#btnProcess").addEventListener("click", () => { void runProcess(x, false); });
      $("#btnReprocess").addEventListener("click", () => { void runProcess(x, true); });

      $("#btnCreateCandidate").addEventListener("click", () => { void createCandidateFromInbox(x); });

      $("#btnDiscard").addEventListener("click", async () => {
        if(!confirm("Descartar este item?")) return;
        x.status = "descartado";
        x.processamento.etapa = "Descartado";
        x.processamento.pct = 100;
        x.processamento.log = (x.processamento.log||[]);
        x.processamento.log.push("Item descartado manualmente.");
        await saveInboxItem(x);
        toast("Item descartado.");
        renderAll();
      });
    }

    // ========= Processing simulation
    let simTimer = null;

    async function runProcess(item, force){
      if(!item) return;

      if(force){
        item.status = "novo";
        item.processamento = { pct: 0, etapa: "Aguardando", log: [], tentativas: (item.processamento?.tentativas||0), ultimoErro: null };
      }

      if(item.status === "processado"){
        toast("Já está processado. Use Reprocessar se precisar.");
        return;
      }
      if(item.status === "descartado"){
        toast("Item descartado. Não é possível processar.");
        return;
      }

      item.status = "processando";
      item.processamento = item.processamento || { pct: 0, etapa: "Aguardando", log: [], tentativas: 0, ultimoErro: null };
      item.processamento.tentativas = (item.processamento.tentativas||0) + 1;
      item.processamento.ultimoErro = null;
      item.processamento.log = item.processamento.log || [];
      item.processamento.log.push("Processamento iniciado.");

      await saveInboxItem(item);
      renderAll();

      const steps = [
        { pct: 15, etapa: "Validando anexos", log: "Anexos validados." },
        { pct: 35, etapa: "Armazenando arquivo", log: "Arquivo armazenado (demo)." },
        { pct: 60, etapa: "Extraindo texto", log: "Texto extraído (demo)." },
        { pct: 85, etapa: "Normalizando conteúdo", log: "Normalização concluída." },
        { pct: 100, etapa: "Concluído", log: "Processamento finalizado." }
      ];

      let idx = 0;
      clearInterval(simTimer);
      simTimer = setInterval(async () => {
        const s = steps[idx++];
        if(!s){
          clearInterval(simTimer);

          const fail = (item.assunto||"").toLowerCase().includes("senha") || (item.remetente||"").includes("carlos");
          if(fail && item.processamento.tentativas < 3){
            item.status = "falha";
            item.processamento.etapa = "Falha";
            item.processamento.pct = 100;
            item.processamento.ultimoErro = "Falha na extração: documento protegido / inválido (demo).";
            item.processamento.log.push("Falha detectada: arquivo protegido/ inválido.");
            await saveInboxItem(item);
            toast("Falha ao processar (demo).");
            renderAll();
            return;
          }

          item.status = "processado";
          item.processamento.etapa = "Concluído";
          item.processamento.pct = 100;

          if(!item.previewText){
            item.previewText = "Resumo (demo): experiência com excel, dashboards, comunicação e relatórios.";
          }

          await saveInboxItem(item);
          toast("Processamento concluído.");
          renderAll();
          return;
        }

        item.processamento.etapa = s.etapa;
        item.processamento.pct = s.pct;
        item.processamento.log.push(s.log);
        await saveInboxItem(item);
        renderAll();
      }, 700);
    }

    async function createCandidateFromInbox(item){
      if(!item) return;
      if(!item.vagaId){
        toast("Selecione uma vaga antes de criar o candidato.");
        return;
      }

      const firstAtt = item.anexos?.[0]?.nome || "Candidato";
      const base = firstAtt.replace(/\.(pdf|doc|docx|txt)$/i,"").replaceAll("_"," ").replaceAll("-"," ");
      const nome = base.length >= 4 ? base : "Novo Candidato";

      const fonte = item.origem === "email" ? "Email" : (item.origem === "pasta" ? "Pasta" : "Site");

      const payload = {
        nome,
        email: (item.remetente && item.remetente.includes("@")) ? item.remetente : "",
        fone: null,
        cidade: null,
        uf: null,
        fonte,
        status: "Triagem",
        vagaId: item.vagaId,
        obs: "Criado a partir da Entrada.",
        cvText: (item.previewText || "").trim() || null,
        lastMatch: null,
        documentos: null
      };

      if(!payload.email){
        toast("Informe um email valido antes de criar o candidato.");
        return;
      }

      try{
        await apiFetchJson(CANDIDATOS_API_URL, {
          method: "POST",
          body: JSON.stringify(payload)
        });

        item.status = "processado";
        item.processamento = item.processamento || { pct: 100, etapa: "Concluído", log: [], tentativas: 1, ultimoErro: null };
        item.processamento.pct = 100;
        item.processamento.etapa = "Concluído";
        item.processamento.ultimoErro = null;
        item.processamento.log = item.processamento.log || [];
        item.processamento.log.push("Candidato criado a partir da entrada.");
        await saveInboxItem(item);

        toast("Candidato criado.");
        renderAll();
      }catch(err){
        console.error(err);
        toast("Falha ao criar candidato.");
      }
    }

    async function addUploads(files){
      if(!files || !files.length) return;

      for(const f of files){
        try{
          const data = new FormData();
          data.append("file", f, f.name);
          await apiFetchJson("/EntradaEmailPasta/_api/upload", {
            method: "POST",
            body: data
          });
        }catch(err){
          console.error(err);
          toast("Falha ao enviar upload.");
        }
      }

      await loadInbox(true);
      renderAll();
    }

function exportJson(){
      const payload = { exportedAt: new Date().toISOString(), inbox: state.inbox };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "inbox_export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function importJson(){
      const inp = document.createElement("input");
      inp.type = "file";
      inp.accept = "application/json";
      inp.onchange = async () => {
        const file = inp.files && inp.files[0];
        if(!file) return;

        const reader = new FileReader();
        reader.onload = async () => {
          try{
            const data = JSON.parse(reader.result);
            if(data && Array.isArray(data.inbox)){
              for(const item of data.inbox){
                await createInboxItem(item);
              }
            }
            await loadInbox(true);
            renderAll();
            toast("Importação concluída.");
          }catch(e){
            console.error(e);
            alert("Falha ao importar JSON. Verifique o arquivo.");
          }
        };
        reader.readAsText(file);
      };
      inp.click();
    }

    function initLogo(){
      $("#logoDesktop").src = LOGO_DATA_URI;
      $("#logoMobile").src = LOGO_DATA_URI;
    }

    function wireFilters(){
      $("#fSearch").addEventListener("input", () => {
        state.filters.q = ($("#fSearch").value || "").trim();
        renderList();
      });

      $("#fOrigem").addEventListener("change", () => {
        state.filters.origem = $("#fOrigem").value || "all";
        renderList();
      });

      $("#fStatus").addEventListener("change", () => {
        state.filters.status = $("#fStatus").value || "all";
        renderList();
      });
    }


    function wireDetailActions(){
      const host = $("#detailHost");
      if(!host) return;
      host.addEventListener("click", async (ev) => {
        const btn = ev.target.closest(".btn-link-suggested");
        if(!btn) return;
        ev.preventDefault();
        const vagaId = btn.dataset.vagaId;
        if(!vagaId) return;
        const item = state.selectedId ? findInbox(state.selectedId) : null;
        if(!item) return;
        const isAssigned = item.vagaId && item.vagaId === vagaId;
        if(!isAssigned && item.vagaId){
          return;
        }
        item.vagaId = isAssigned ? null : vagaId;
        try{
          await saveInboxItem(item);
          toast(isAssigned ? "Vaga desvinculada." : "Vaga vinculada.");
          renderAll();
        }catch(err){
          console.error(err);
          toast(isAssigned ? "Falha ao desvincular vaga." : "Falha ao vincular vaga.");
        }
      });
    }

    function wireButtons(){
      $("#btnAddUpload").addEventListener("click", () => $("#filePicker").click());

      $("#filePicker").addEventListener("change", (ev) => {
        const files = ev.target.files;
        void addUploads(files);
        ev.target.value = "";
      });

      const dropzone = $("#dropzone");
      if(dropzone){
        dropzone.addEventListener("dragover", (ev) => {
          ev.preventDefault();
          dropzone.classList.add("drag");
        });
        dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag"));
        dropzone.addEventListener("drop", (ev) => {
          ev.preventDefault();
          dropzone.classList.remove("drag");
          void addUploads(ev.dataTransfer.files);
        });
      }

      $("#btnExport").addEventListener("click", exportJson);
      $("#btnImport").addEventListener("click", importJson);

      $("#btnRunSim").addEventListener("click", async () => {
        const vagaId = state.vagas[0]?.id || null;
        const sample = {
          origem: "email",
          status: "novo",
          recebidoEm: new Date().toISOString(),
          remetente: "amostra@empresa.com",
          assunto: "Curriculo enviado",
          destinatario: "rh@liotecnica.com.br",
          vagaId,
          anexos: [{ nome: "Amostra_CV.pdf", tipo: "pdf", tamanhoKB: 220, hash: "sim-"+Math.random().toString(16).slice(2,8) }],
          processamento: { pct: 0, etapa: "Aguardando", log: ["Simulação de coleta."], tentativas: 0, ultimoErro: null },
          previewText: ""
        };

        await createInboxItem(sample);
        renderAll();
      });

      $("#btnRefresh").addEventListener("click", async () => {
        try{
          await Promise.all([loadVagas(), loadInbox()]);
          renderAll();
          toast("Dados atualizados.");
        }catch(err){
          console.error(err);
          toast("Falha ao atualizar dados.");
        }
      });
    }

    // ========= Init
    (async function init(){
      initLogo();
      wireFilters();
      wireButtons();
      wireDetailActions();

      await ensureEnumData();
      applyEnumSelects();

      try{
        await Promise.all([loadVagas(), loadInbox()]);
        renderAll();
        await startInboxHub();
      }catch(err){
        console.error(err);
        toast("Falha ao carregar inbox.");
      }
    })();

