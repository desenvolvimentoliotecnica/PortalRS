// Aba: Referências Profissionais
// ======================================
const REFS_STORAGE_KEY = "liotec_portal_refs_v1";
const REFS_API_BASE = "/PortalVagas/References";

let refsCache = [];
let refsLoaded = false;
let refsLoading = false;

function mapReferenceDto(r){
  return {
    id: r.id,
    name: r.nome || "",
    relation: r.relacao || "",
    company: r.empresa || "",
    role: r.cargo || "",
    contact: r.contato || "",
    period: r.periodo || "",
    linkedin: r.linkedin || "",
    notes: r.observacoes || "",
    canContactNow: !!r.podeContatar,
    updatedAt: r.updatedAtUtc || ""
  };
}

function mapReferencesResponse(data){
  return (data?.items || []).map(mapReferenceDto);
}

async function ensureReferencesLoaded(){
  if(STORAGE_ENABLED || refsLoaded || refsLoading) return;
  refsLoading = true;
  try{
    const res = await fetch(REFS_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if(res.ok){
      refsCache = mapReferencesResponse(data);
    }
  }catch{
    // ignore
  }finally{
    refsLoaded = true;
    refsLoading = false;
  }
}

function loadReferences(){
  if(!STORAGE_ENABLED) return refsCache;
  try{
    const raw = storageGet(REFS_STORAGE_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch{
    return [];
  }
}
function saveReferences(list){
  if(!STORAGE_ENABLED){
    refsCache = list;
    return;
  }
  try{ storageSet(REFS_STORAGE_KEY, JSON.stringify(list)); }catch{}
}

function openRefModal(id){
  const m = new bootstrap.Modal(document.getElementById("refEditModal"));
  const list = loadReferences();
  const r = id ? list.find(x => x.id === id) : null;

  document.getElementById("refId").value = r?.id || "";
  document.getElementById("refName").value = r?.name || "";
  document.getElementById("refRelation").value = r?.relation || "Líder direto";
  document.getElementById("refCompany").value = r?.company || "";
  document.getElementById("refRole").value = r?.role || "";
  document.getElementById("refContact").value = r?.contact || "";
  document.getElementById("refPeriod").value = r?.period || "";
  document.getElementById("refLinkedin").value = r?.linkedin || "";
  document.getElementById("refNotes").value = r?.notes || "";
  document.getElementById("refCanContactNow").checked = !!r?.canContactNow;

  m.show();
}

function saveReferenceItem(){
  const list = loadReferences();
  const id = (document.getElementById("refId").value || "").trim() || uid();

  const name = (document.getElementById("refName").value || "").trim();
  const relation = (document.getElementById("refRelation").value || "Outro").trim();
  const company = (document.getElementById("refCompany").value || "").trim();
  const role = (document.getElementById("refRole").value || "").trim();
  const contact = (document.getElementById("refContact").value || "").trim();
  const period = (document.getElementById("refPeriod").value || "").trim();
  const linkedin = (document.getElementById("refLinkedin").value || "").trim();
  const notes = (document.getElementById("refNotes").value || "").trim();
  const canContactNow = !!document.getElementById("refCanContactNow").checked;

  if(!name){
    Swal.fire({ icon:"warning", title:"Faltou o nome", text:"Informe o nome da referência.", confirmButtonColor:"#004aad" });
    return;
  }
  if(!contact){
    Swal.fire({ icon:"warning", title:"Faltou o contato", text:"Informe pelo menos um contato (e-mail/telefone).", confirmButtonColor:"#004aad" });
    return;
  }

  if(canContactNow){
    Swal.fire({
      icon:"warning",
      title:"Confirmar contato imediato?",
      text:"Marque apenas se a pessoa autorizou ser contatada agora.",
      showCancelButton:true,
      confirmButtonText:"Confirmar",
      confirmButtonColor:"#004aad",
      cancelButtonText:"Voltar"
    }).then(r=>{
      if(!r.isConfirmed) return;
      __saveRefPayload({ id, name, relation, company, role, contact, period, linkedin, notes, canContactNow }, list);
    });
    return;
  }

  __saveRefPayload({ id, name, relation, company, role, contact, period, linkedin, notes, canContactNow }, list);
}

async function __saveRefPayload(payload, list){
  if(!STORAGE_ENABLED){
    const request = {
      nome: payload.name,
      relacao: payload.relation || null,
      empresa: payload.company || null,
      cargo: payload.role || null,
      contato: payload.contact || null,
      periodo: payload.period || null,
      linkedin: payload.linkedin || null,
      observacoes: payload.notes || null,
      podeContatar: payload.canContactNow
    };

    try{
      const exists = list.some(x => x.id === payload.id);
      const url = exists ? `${REFS_API_BASE}/${payload.id}` : REFS_API_BASE;
      const method = exists ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(request)
      });
      const data = await res.json().catch(() => ({}));
      if(!res.ok) throw new Error(data?.message || "Falha ao salvar referencia.");

      const saved = mapReferenceDto(data);
      const updated = loadReferences();
      const idx = updated.findIndex(x => x.id === saved.id);
      if(idx >= 0) updated[idx] = saved;
      else updated.push(saved);
      saveReferences(updated);

      bootstrap.Modal.getInstance(document.getElementById("refEditModal"))?.hide();
      renderReferences();
      Swal.fire({ toast:true, position:"top-end", icon:"success", title:"ReferÃªncia salva", showConfirmButton:false, timer:2000 });
    }catch(err){
      Swal.fire({ icon:"error", title:"Falha ao salvar", text: String(err?.message || err || "Erro inesperado"), confirmButtonColor:"#004aad" });
    }
    return;
  }
  payload.updatedAt = new Date().toISOString();
  payload.createdAt = (list.find(x=>x.id===payload.id)?.createdAt) || new Date().toISOString();

  const idx = list.findIndex(x => x.id === payload.id);
  if(idx >= 0) list[idx] = payload;
  else list.push(payload);

  saveReferences(list);

  bootstrap.Modal.getInstance(document.getElementById("refEditModal"))?.hide();
  renderReferences();

  Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Referência salva", showConfirmButton:false, timer:2000 });
}

function deleteReferenceItem(id){
  Swal.fire({
    title:"Remover referência?",
    text:"Isso apaga do seu perfil (neste protótipo).",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(async r=>{
    if(!r.isConfirmed) return;
    if(!STORAGE_ENABLED){
      try{
        const res = await fetch(`${REFS_API_BASE}/${id}`, { method:"DELETE", headers:{ "Accept":"application/json" }, credentials:"same-origin" });
        if(!res.ok){
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.message || "Falha ao remover referÃªncia.");
        }
      }catch(err){
        Swal.fire({ icon:"error", title:"Falha ao remover", text: String(err?.message || err || "Erro inesperado"), confirmButtonColor:"#004aad" });
        return;
      }
    }
    const list = loadReferences().filter(x => x.id !== id);
    saveReferences(list);
    renderReferences();
  });
}

function renderReferences(){
  const host = document.getElementById("refsList");
  const empty = document.getElementById("refsEmpty");
  if(!host) return;

  if(!STORAGE_ENABLED && !refsLoaded && !refsLoading){
    ensureReferencesLoaded().then(() => renderReferences());
    return;
  }

  const search = (document.getElementById("refsSearch")?.value || "").trim().toLowerCase();
  const filterRelation = (document.getElementById("refsFilterRelation")?.value || "").trim();
  const sort = (document.getElementById("refsSort")?.value || "new").trim();

  let list = loadReferences();

  if(filterRelation){
    list = list.filter(r => (r.relation || "") === filterRelation);
  }
  if(search){
    list = list.filter(r =>
      (r.name || "").toLowerCase().includes(search) ||
      (r.company || "").toLowerCase().includes(search) ||
      (r.role || "").toLowerCase().includes(search) ||
      (r.relation || "").toLowerCase().includes(search)
    );
  }

  if(sort === "new"){
    list.sort((a,b) => String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  }else if(sort === "old"){
    list.sort((a,b) => String(a.updatedAt||"").localeCompare(String(b.updatedAt||"")));
  }else if(sort === "name"){
    list.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), "pt-BR"));
  }else if(sort === "company"){
    list.sort((a,b) => String(a.company||"").localeCompare(String(b.company||""), "pt-BR"));
  }

  host.innerHTML = "";

  if(list.length === 0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(r => {
    const can = r.canContactNow
      ? `<span class="badge rounded-pill bg-success"><i class="fas fa-check me-1"></i>Pode contatar</span>`
      : `<span class="badge rounded-pill bg-secondary"><i class="fas fa-clock me-1"></i>Contatar depois</span>`;

    const meta = [
      r.company ? escapeHtml(r.company) : null,
      r.role ? escapeHtml(r.role) : null,
      r.period ? escapeHtml(r.period) : null
    ].filter(Boolean).join(" • ");

    const linkedinBtn = r.linkedin
      ? `<a class="btn btn-sm btn-outline-secondary fw-bold" href="${escapeAttr(r.linkedin)}" target="_blank" rel="noopener">
          <i class="fab fa-linkedin me-1"></i> LinkedIn
        </a>` : "";

    host.innerHTML += `
      <div class="col-12">
        <div class="border rounded p-3" style="border-radius:14px;">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div style="min-width:0;">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <div class="fw-bold"><i class="fas fa-user-tie me-1"></i> ${escapeHtml(r.name)}</div>
                <span class="badge rounded-pill bg-primary">${escapeHtml(r.relation || "Outro")}</span>
                ${can}
              </div>

              ${meta ? `<div class="small text-muted mt-1">${meta}</div>` : ""}

              <div class="small text-muted mt-2">
                <i class="fas fa-phone-alt me-1"></i>${escapeHtml(r.contact || "—")}
              </div>

              ${r.notes ? `<div class="small text-muted mt-2" style="white-space:pre-wrap;">${escapeHtml(r.notes)}</div>` : ""}

              <div class="d-flex flex-wrap gap-2 mt-3">
                ${linkedinBtn}
                <button class="btn btn-sm btn-outline-secondary fw-bold" type="button"
                        onclick="copyReferenceContact('${escapeAttr(r.contact || "")}')">
                  <i class="fas fa-copy me-1"></i> Copiar contato
                </button>
              </div>
            </div>

            <div class="d-flex gap-2 flex-shrink-0">
              <button class="btn btn-sm btn-outline-primary" type="button" onclick="openRefModal('${r.id}')">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteReferenceItem('${r.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

function copyReferenceContact(text){
  const v = String(text || "").trim();
  if(!v){
    Swal.fire({ icon:"info", title:"Sem contato", text:"Esta referência não tem contato preenchido.", confirmButtonColor:"#004aad" });
    return;
  }
  navigator.clipboard?.writeText(v).then(()=>{
    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Contato copiado", showConfirmButton:false, timer:1600 });
  }).catch(()=>{
    Swal.fire({ icon:"info", title:"Copie manualmente", text:v, confirmButtonColor:"#004aad" });
  });
}

async function seedReferences(){
  const list = loadReferences();
  if(list.length > 0){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplos.", confirmButtonColor:"#004aad" });
    return;
  }

  const now = new Date().toISOString();
  const demo = [
    {
      id: uid(),
      name: "Maria Oliveira",
      relation: "Líder direto",
      company: "Liotécnica",
      role: "Supervisora de Qualidade",
      contact: "maria.oliveira@email.com • (11) 98888-7777",
      period: "2023–2025",
      linkedin: "https://linkedin.com/in/",
      notes: "Pode comentar sobre auditorias, indicadores e melhoria contínua.",
      canContactNow: true,
      createdAt: now,
      updatedAt: now
    },
    {
      id: uid(),
      name: "Carlos Souza",
      relation: "Colega",
      company: "Projeto X",
      role: "Analista de Processos",
      contact: "carlos.souza@email.com",
      period: "2022–2023",
      linkedin: "",
      notes: "Trabalhamos juntos em padronização e documentação de processos.",
      canContactNow: false,
      createdAt: now,
      updatedAt: now
    }
  ];

  if(!STORAGE_ENABLED){
    try{
      const created = [];
      for (const item of demo){
        const request = {
          nome: item.name,
          relacao: item.relation || null,
          empresa: item.company || null,
          cargo: item.role || null,
          contato: item.contact || null,
          periodo: item.period || null,
          linkedin: item.linkedin || null,
          observacoes: item.notes || null,
          podeContatar: item.canContactNow
        };
        const res = await fetch(REFS_API_BASE, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(request)
        });
        const data = await res.json().catch(() => ({}));
        if(res.ok) created.push(mapReferenceDto(data));
      }
      saveReferences(created);
      renderReferences();
      Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
    }catch{
      Swal.fire({ icon:"error", title:"Falha ao inserir exemplos", confirmButtonColor:"#004aad" });
    }
    return;
  }

  saveReferences(demo);
  renderReferences();
  Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
}

async function resetReferences(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Referências?",
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(async r=>{
    if(!r.isConfirmed) return;
    if(!STORAGE_ENABLED){
      await ensureReferencesLoaded();
      const list = loadReferences();
      for (const item of list){
        try{
          await fetch(`${REFS_API_BASE}/${item.id}`, { method:"DELETE", headers:{ "Accept":"application/json" }, credentials:"same-origin" });
        }catch{
          // ignore
        }
      }
      saveReferences([]);
    }else{
      storageRemove(REFS_STORAGE_KEY);
    }
    renderReferences();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
  });
}

function downloadReferencesSummary(){
  const list = loadReferences();
  const lines = [];
  lines.push("Liotécnica — Resumo de Referências Profissionais (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  if(list.length === 0){
    lines.push("Nenhuma referência cadastrada.");
  }else{
    list.forEach(r=>{
      lines.push(`${r.name} (${r.relation}) | ${r.company||"—"} - ${r.role||"—"} | Contato: ${r.contact||"—"} | Pode contatar: ${r.canContactNow ? "SIM" : "NÃO"}`);
    });
  }

  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resumo-referencias-liotecnica.txt";
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// ======================================
