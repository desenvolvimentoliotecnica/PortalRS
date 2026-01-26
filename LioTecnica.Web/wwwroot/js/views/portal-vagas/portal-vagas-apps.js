// Aba: Histórico de Candidaturas & Etapas
// ======================================
const APPS_HISTORY_STORAGE_KEY = "liotec_portal_apps_history_v1";
let __appsHydratedOnce = false;

function defaultAppsHistory(){
  return {
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function loadAppsHistory(){
  try{
    const raw = storageGet(APPS_HISTORY_STORAGE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== "object") return null;
    obj.items = Array.isArray(obj.items) ? obj.items : [];
    return obj;
  }catch{
    return null;
  }
}
function saveAppsHistoryToStorage(obj){
  try{ storageSet(APPS_HISTORY_STORAGE_KEY, JSON.stringify(obj)); }catch{}
}

function hydrateAppsHistory(){
  if(__appsHydratedOnce) return;
  __appsHydratedOnce = true;

  const h = loadAppsHistory() || defaultAppsHistory();
  saveAppsHistoryToStorage(h);
}

function statusColor(status){
  switch(status){
    case "Aprovado": return "bg-success";
    case "Reprovado": return "bg-danger";
    case "Entrevista": return "bg-primary";
    case "Teste": return "bg-warning text-dark";
    case "Proposta": return "bg-info text-dark";
    case "Triagem": return "bg-secondary";
    case "Desistiu": return "bg-dark";
    default: return "bg-secondary";
  }
}

function statusOrder(status){
  const map = {
    "Aplicado": 1,
    "Triagem": 2,
    "Entrevista": 3,
    "Teste": 4,
    "Proposta": 5,
    "Aprovado": 6,
    "Reprovado": 7,
    "Desistiu": 8
  };
  return map[status] || 999;
}

function renderAppsHistory(){
  hydrateAppsHistory();

  const host = document.getElementById("appsList");
  const empty = document.getElementById("appsEmpty");
  if(!host) return;

  const h = loadAppsHistory() || defaultAppsHistory();
  let list = Array.isArray(h.items) ? [...h.items] : [];

  const q = (document.getElementById("appsSearch")?.value || "").trim().toLowerCase();
  const fStatus = (document.getElementById("appsStatusFilter")?.value || "").trim();
  const sort = (document.getElementById("appsSort")?.value || "new").trim();

  if(fStatus){
    list = list.filter(x => (x.status||"") === fStatus);
  }
  if(q){
    list = list.filter(x =>
      (x.title||"").toLowerCase().includes(q) ||
      (x.company||"").toLowerCase().includes(q) ||
      (x.location||"").toLowerCase().includes(q) ||
      (x.date||"").toLowerCase().includes(q)
    );
  }

  if(sort === "new"){
    list.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  }else if(sort === "old"){
    list.sort((a,b)=>String(a.updatedAt||"").localeCompare(String(b.updatedAt||"")));
  }else if(sort === "status"){
    list.sort((a,b)=>statusOrder(a.status)-statusOrder(b.status));
  }

  host.innerHTML = "";

  if(list.length === 0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(app=>{
    const stages = app.stages || {};
    const chip = (ok, label) =>
      `<span class="badge rounded-pill ${ok?'text-bg-primary':'text-bg-light'}" style="${ok?'':'border:1px solid #e5e7eb;color:#6b7280'}">${label}</span>`;

    const timelineCount = (app.timeline||[]).length;

    host.innerHTML += `
      <div class="col-12">
        <div class="border rounded p-3" style="border-radius:14px;">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div style="min-width:0;">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <div class="fw-bold" style="font-size:1.02rem;">${escapeHtml(app.title || "—")}</div>
                <span class="badge rounded-pill ${statusColor(app.status||"Aplicado")}">${escapeHtml(app.status||"Aplicado")}</span>
              </div>

              <div class="small text-muted mt-1">
                ${app.company ? `<span><i class="far fa-building me-1"></i>${escapeHtml(app.company)}</span>` : ""}
                ${app.location ? `<span class="ms-2"><i class="fas fa-map-marker-alt me-1"></i>${escapeHtml(app.location)}</span>` : ""}
                ${app.date ? `<span class="ms-2"><i class="far fa-calendar-alt me-1"></i>${escapeHtml(app.date)}</span>` : ""}
              </div>

              <div class="d-flex flex-wrap gap-2 mt-3">
                ${chip(!!stages.applied, "Aplicado")}
                ${chip(!!stages.screen, "Triagem")}
                ${chip(!!stages.interview, "Entrevista")}
                ${chip(!!stages.test, "Teste")}
                ${chip(!!stages.offer, "Proposta")}
              </div>

              ${app.notes ? `<div class="small text-muted mt-2" style="white-space:pre-wrap;">${escapeHtml(app.notes)}</div>` : ""}

              <div class="small text-muted mt-2">
                <i class="fas fa-history me-1"></i>Eventos: <strong>${timelineCount}</strong>
                <span class="ms-2">Atualizado: ${new Date(app.updatedAt||Date.now()).toLocaleString("pt-BR")}</span>
              </div>

              <div class="d-flex flex-wrap gap-2 mt-3">
                ${app.link ? `
                  <a class="btn btn-sm btn-outline-secondary fw-bold" href="${escapeAttr(app.link)}" target="_blank" rel="noopener">
                    <i class="fas fa-link me-1"></i> Abrir vaga
                  </a>
                ` : `
                  <button class="btn btn-sm btn-outline-secondary fw-bold" type="button"
                          onclick="Swal.fire('Sem link', 'Adicione o link da vaga para abrir por aqui.', 'info')">
                    <i class="fas fa-link me-1"></i> Sem link
                  </button>
                `}
              </div>
            </div>

            <div class="d-flex gap-2 flex-shrink-0">
              <button class="btn btn-sm btn-outline-primary" type="button" onclick="openAppEditModal('${app.id}')">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteApp('${app.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

// ---------- Modal editar ----------
function openAppEditModal(id){
  const m = new bootstrap.Modal(document.getElementById("appEditModal"));
  const h = loadAppsHistory() || defaultAppsHistory();
  const item = id ? (h.items||[]).find(x=>x.id===id) : null;

  document.getElementById("appId").value = item?.id || "";
  document.getElementById("appTitle").value = item?.title || "";
  document.getElementById("appCompany").value = item?.company || "";
  document.getElementById("appLocation").value = item?.location || "";
  document.getElementById("appDate").value = item?.date || "";
  document.getElementById("appStatus").value = item?.status || "Aplicado";
  document.getElementById("appLink").value = item?.link || "";
  document.getElementById("appNotes").value = item?.notes || "";

  // stages
  const st = item?.stages || {};
  document.getElementById("stApplied").checked = !!st.applied;
  document.getElementById("stScreen").checked = !!st.screen;
  document.getElementById("stInterview").checked = !!st.interview;
  document.getElementById("stTest").checked = !!st.test;
  document.getElementById("stOffer").checked = !!st.offer;

  // timeline
  window.__editingTimeline = structuredClone(item?.timeline || []);
  renderTimelineUI();

  // se é novo, sincroniza pipeline do status default
  if(!item) syncPipelineFromStatus();

  m.show();
}

function syncPipelineFromStatus(){
  const status = (document.getElementById("appStatus")?.value || "Aplicado").trim();

  const order = ["Aplicado","Triagem","Entrevista","Teste","Proposta"];
  const map = {
    "Aplicado": 0,
    "Triagem": 1,
    "Entrevista": 2,
    "Teste": 3,
    "Proposta": 4,
    "Aprovado": 4,
    "Reprovado": 2,
    "Desistiu": 1
  };
  const idx = map[status] ?? 0;

  document.getElementById("stApplied").checked = idx >= 0;
  document.getElementById("stScreen").checked = idx >= 1;
  document.getElementById("stInterview").checked = idx >= 2;
  document.getElementById("stTest").checked = idx >= 3;
  document.getElementById("stOffer").checked = idx >= 4;
}

// ---------- Timeline ----------
function renderTimelineUI(){
  const host = document.getElementById("appTimeline");
  const empty = document.getElementById("appTimelineEmpty");
  if(!host) return;

  const list = Array.isArray(window.__editingTimeline) ? window.__editingTimeline : [];
  host.innerHTML = "";

  if(list.length === 0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  // mais recente primeiro
  const ordered = [...list].sort((a,b)=>String(b.at||"").localeCompare(String(a.at||"")));

  ordered.forEach(ev=>{
    host.innerHTML += `
      <div class="border rounded p-2" style="border-radius:12px;background:#f8f9fa;">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div class="small" style="min-width:0;">
            <div class="fw-bold">${escapeHtml(ev.title || "Evento")}</div>
            <div class="text-muted">${escapeHtml(ev.atText || "")}</div>
            ${ev.note ? `<div class="text-muted mt-1" style="white-space:pre-wrap;">${escapeHtml(ev.note)}</div>` : ""}
          </div>
          <button class="btn btn-sm btn-outline-danger" type="button" onclick="removeTimelineEvent('${ev.id}')">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  });
}

function addTimelineEvent(){
  Swal.fire({
    title: "Adicionar evento",
    html: `
      <div class="text-start">
        <label class="form-label small text-muted mb-1">Título</label>
        <input id="swEvTitle" class="swal2-input" placeholder="Ex.: Entrevista agendada">
        <label class="form-label small text-muted mb-1">Quando</label>
        <input id="swEvWhen" class="swal2-input" placeholder="Ex.: 02/02/2026 10:00">
        <label class="form-label small text-muted mb-1">Nota (opcional)</label>
        <textarea id="swEvNote" class="swal2-textarea" placeholder="Detalhes..."></textarea>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "Adicionar",
    confirmButtonColor: "#004aad",
    cancelButtonText: "Cancelar",
    preConfirm: () => {
      const title = document.getElementById("swEvTitle").value.trim();
      const when = document.getElementById("swEvWhen").value.trim();
      const note = document.getElementById("swEvNote").value.trim();
      if(!title || !when){
        Swal.showValidationMessage("Informe Título e Quando.");
        return false;
      }
      return { title, when, note };
    }
  }).then(r=>{
    if(!r.isConfirmed) return;
    const nowIso = new Date().toISOString();
    const ev = {
      id: uid(),
      title: r.value.title,
      at: nowIso,
      atText: r.value.when,
      note: r.value.note
    };
    window.__editingTimeline = Array.isArray(window.__editingTimeline) ? window.__editingTimeline : [];
    window.__editingTimeline.push(ev);
    renderTimelineUI();
  });
}

function removeTimelineEvent(id){
  window.__editingTimeline = (window.__editingTimeline||[]).filter(x=>x.id!==id);
  renderTimelineUI();
}

// ---------- Save / Delete ----------
function saveApp(){
  const h = loadAppsHistory() || defaultAppsHistory();
  h.items = Array.isArray(h.items) ? h.items : [];

  const id = (document.getElementById("appId").value || "").trim() || uid();

  const title = (document.getElementById("appTitle").value || "").trim();
  const company = (document.getElementById("appCompany").value || "").trim();
  const location = (document.getElementById("appLocation").value || "").trim();
  const date = (document.getElementById("appDate").value || "").trim();
  const status = (document.getElementById("appStatus").value || "Aplicado").trim();
  const link = (document.getElementById("appLink").value || "").trim();
  const notes = (document.getElementById("appNotes").value || "").trim();

  if(!title){
    Swal.fire({ icon:"warning", title:"Faltou a vaga", text:"Informe o nome da vaga.", confirmButtonColor:"#004aad" });
    return;
  }

  const stages = {
    applied: !!document.getElementById("stApplied").checked,
    screen: !!document.getElementById("stScreen").checked,
    interview: !!document.getElementById("stInterview").checked,
    test: !!document.getElementById("stTest").checked,
    offer: !!document.getElementById("stOffer").checked
  };

  const existing = h.items.find(x=>x.id===id);
  const payload = {
    id, title, company, location, date, status, link, notes,
    stages,
    timeline: Array.isArray(window.__editingTimeline) ? window.__editingTimeline : [],
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const idx = h.items.findIndex(x=>x.id===id);
  if(idx >= 0) h.items[idx] = payload;
  else h.items.push(payload);

  // recent first
  h.items.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  h.updatedAt = new Date().toISOString();

  saveAppsHistoryToStorage(h);
  bootstrap.Modal.getInstance(document.getElementById("appEditModal"))?.hide();
  renderAppsHistory();

  Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Candidatura salva", showConfirmButton:false, timer:1900 });
}

function deleteApp(id){
  Swal.fire({
    title:"Remover candidatura?",
    text:"Isso apaga do seu histórico (neste protótipo).",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    const h = loadAppsHistory() || defaultAppsHistory();
    h.items = (h.items||[]).filter(x=>x.id!==id);
    h.updatedAt = new Date().toISOString();
    saveAppsHistoryToStorage(h);
    renderAppsHistory();
  });
}

// ---------- Import / seed / reset / export ----------
function importFromMyApps(){
  // tenta importar seu array global `myApps` (do MVP original)
  if(typeof myApps === "undefined" || !Array.isArray(myApps) || myApps.length === 0){
    Swal.fire({ icon:"info", title:"Nada para importar", text:"Não encontrei o array myApps no seu script.", confirmButtonColor:"#004aad" });
    return;
  }

  const h = loadAppsHistory() || defaultAppsHistory();
  h.items = Array.isArray(h.items) ? h.items : [];

  let added = 0;

  myApps.forEach(a=>{
    const title = a.title || "Vaga";
    const statusText = a.status || "Aplicado";

    // mapeamento simples do status antigo
    const statusMap = {
      "Entrevista Agendada": "Entrevista",
      "Não Selecionado": "Reprovado",
      "Selecionado": "Aprovado"
    };
    const status = statusMap[statusText] || statusText;

    // evita duplicar por title+date
    const exists = h.items.some(x => (x.title||"")===title && (x.date||"")=== (a.date||""));
    if(exists) return;

    h.items.push({
      id: uid(),
      title,
      company: "—",
      location: "—",
      date: a.date || "",
      status,
      link: "",
      notes: "",
      stages: {
        applied: true,
        screen: ["Triagem","Entrevista","Teste","Proposta","Aprovado","Reprovado"].includes(status),
        interview: ["Entrevista","Teste","Proposta","Aprovado","Reprovado"].includes(status),
        test: ["Teste","Proposta","Aprovado"].includes(status),
        offer: ["Proposta","Aprovado"].includes(status)
      },
      timeline: [
        { id: uid(), title: "Importado do histórico", at: new Date().toISOString(), atText: "Importação automática", note: `Status: ${statusText}` }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    added++;
  });

  h.items.sort((a,b)=>String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  h.updatedAt = new Date().toISOString();
  saveAppsHistoryToStorage(h);
  renderAppsHistory();

  Swal.fire({ icon:"success", title:"Importação concluída!", text:`Itens adicionados: ${added}`, confirmButtonColor:"#004aad" });
}

function seedAppsHistory(){
  const h = loadAppsHistory();
  if(h && Array.isArray(h.items) && h.items.length > 0){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplo.", confirmButtonColor:"#004aad" });
    return;
  }

  const data = defaultAppsHistory();
  data.items = [
    {
      id: uid(),
      title: "Analista de Qualidade Jr",
      company: "Liotécnica",
      location: "Embu das Artes",
      date: "15/01/2026",
      status: "Entrevista",
      link: "",
      notes: "Entrevista marcada para 02/02 às 10:00.",
      stages: { applied:true, screen:true, interview:true, test:false, offer:false },
      timeline: [
        { id: uid(), title: "Candidatura enviada", at: new Date().toISOString(), atText: "15/01/2026", note: "" },
        { id: uid(), title: "Entrevista agendada", at: new Date().toISOString(), atText: "02/02/2026 10:00", note: "Online" }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      title: "Assistente Administrativo",
      company: "Empresa X",
      location: "Presencial",
      date: "20/12/2025",
      status: "Reprovado",
      link: "",
      notes: "Feedback: perfil não aderente no momento.",
      stages: { applied:true, screen:true, interview:true, test:false, offer:false },
      timeline: [
        { id: uid(), title: "Candidatura enviada", at: new Date().toISOString(), atText: "20/12/2025", note: "" },
        { id: uid(), title: "Não selecionado", at: new Date().toISOString(), atText: "05/01/2026", note: "" }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  data.updatedAt = new Date().toISOString();

  saveAppsHistoryToStorage(data);
  __appsHydratedOnce = false;
  renderAppsHistory();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetAppsHistory(){
  Swal.fire({
    icon:"warning",
    title:"Limpar histórico?",
    text:"Isso apaga as candidaturas salvas neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(APPS_HISTORY_STORAGE_KEY);
    __appsHydratedOnce = false;
    renderAppsHistory();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Histórico limpo.", confirmButtonColor:"#004aad" });
  });
}

function downloadAppsSummary(){
  const h = loadAppsHistory() || defaultAppsHistory();
  const list = Array.isArray(h.items) ? h.items : [];

  const lines = [];
  lines.push("Liotécnica — Resumo Histórico de Candidaturas (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  if(list.length === 0){
    lines.push("Nenhuma candidatura cadastrada.");
  }else{
    list.forEach(a=>{
      lines.push(`- ${a.title} | ${a.company||"—"} | ${a.location||"—"} | ${a.date||"—"} | Status: ${a.status||"—"}`);
    });
  }

  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const dl = document.createElement("a");
  dl.href = URL.createObjectURL(blob);
  dl.download = "historico-candidaturas-liotecnica.txt";
  document.body.appendChild(dl);
  dl.click();
  URL.revokeObjectURL(dl.href);
  dl.remove();
}

function renderApps(){
  renderAppsHistory();
}


// ======================================
