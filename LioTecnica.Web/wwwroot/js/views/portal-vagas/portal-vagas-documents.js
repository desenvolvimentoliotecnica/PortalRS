// Aba: Documentos & Anexos
// ======================================
const DOCS_STORAGE_KEY = "liotec_portal_docs_v1";
const DOCS_API_BASE = "/PortalVagas/Documents";
  
  let docsCache = [];
  let docsLoaded = false;
  let docsLoading = false;
  
  function normalizeDocTypeValue(value){
    const raw = (value || "").toString().trim().toLowerCase();
    if(!raw) return "";
    const noSlash = raw.replace(/[\\/\\-\\s]/g, "");
    try{
      return noSlash.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "");
    }catch{
      return noSlash;
    }
  }
  
  function toEnumDocType(value){
    const norm = normalizeDocTypeValue(value);
    if(norm === "curriculo") return "Curriculo";
    if(norm === "certificado") return "Certificado";
    if(norm === "diplomadeclaracao") return "DiplomaDeclaracao";
    if(norm === "portfolio") return "Portfolio";
    if(norm === "carteiraregistro") return "CarteiraRegistro";
    if(norm === "outros") return "Outros";
    if(norm === "documento") return "Documento";
    return "Documento";
  }
  
  function toLabelDocType(value){
    const norm = normalizeDocTypeValue(value);
    if(norm === "curriculo") return "CurrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culo";
    if(norm === "certificado") return "Certificado";
    if(norm === "diplomadeclaracao") return "Diploma/DeclaraÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o";
    if(norm === "portfolio") return "PortfÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³lio";
    if(norm === "carteiraregistro") return "Carteira/Registro";
    if(norm === "outros") return "Outros";
    if(norm === "documento") return "Documento";
    return "Outros";
  }
  
  function mapDocumentDto(d){
    return {
      id: d.id,
      type: toLabelDocType(d.tipo || d.type),
      name: d.nome || d.name || "",
      link: d.link || "",
      date: d.data || "",
      notes: d.observacoes || "",
      fileName: d.fileName || "",
      updatedAt: d.createdAtUtc || d.updatedAt || "",
      createdAt: d.createdAtUtc || d.createdAt || ""
    };
  }
  
  function mapDocumentsResponse(data){
    return (data?.items || []).map(mapDocumentDto);
  }
  
  async function ensureDocumentsLoaded(){
    if(STORAGE_ENABLED || docsLoaded || docsLoading) return;
    docsLoading = true;
    try{
      const res = await fetch(DOCS_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if(res.ok){
        docsCache = mapDocumentsResponse(data);
      }
    }catch{
      // ignore
    }finally{
      docsLoaded = true;
      docsLoading = false;
    }
  }
  
  function loadDocuments(){
    if(!STORAGE_ENABLED) return docsCache;
    try{
      const raw = storageGet(DOCS_STORAGE_KEY);
      if(!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch{
      return [];
    }
  }
  
  function saveDocuments(list){
    if(!STORAGE_ENABLED){
      docsCache = list;
      return;
    }
    try{ storageSet(DOCS_STORAGE_KEY, JSON.stringify(list)); }catch{}
  }

function openDocModal(id){
  const m = new bootstrap.Modal(document.getElementById("docEditModal"));
  const list = loadDocuments();
  const d = id ? list.find(x => x.id === id) : null;

  document.getElementById("docId").value = d?.id || "";
  document.getElementById("docType").value = d?.type || "CurrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culo";
  document.getElementById("docName").value = d?.name || "";
  document.getElementById("docLink").value = d?.link || "";
  document.getElementById("docDate").value = d?.date || "";
  document.getElementById("docNotes").value = d?.notes || "";

  // limpa file input (nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o dÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ pra setar value por seguranÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a)
  const fileInput = document.getElementById("docFile");
  if(fileInput) fileInput.value = "";

  document.getElementById("docFileName").textContent = d?.fileName || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â";
  m.show();
}

function handleDocFileChange(input){
  const label = document.getElementById("docFileName");
  if(input?.files && input.files[0]){
    const name = input.files[0].name;
    if(label) label.textContent = name;
  }else{
    if(label) label.textContent = "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â";
  }
}

  async function saveDocumentItem(){
    const list = loadDocuments();
    const id = (document.getElementById("docId").value || "").trim() || uid();
  
    const type = (document.getElementById("docType").value || "Outros").trim();
    const name = (document.getElementById("docName").value || "").trim();
  const link = (document.getElementById("docLink").value || "").trim();
  const date = (document.getElementById("docDate").value || "").trim();
  const notes = (document.getElementById("docNotes").value || "").trim();

  const fileName = (document.getElementById("docFileName").textContent || "").trim();
  const finalFileName = (fileName && fileName !== "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â") ? fileName : "";

    if(!name){
      Swal.fire({ icon:"warning", title:"Faltou o nome", text:"Informe o nome do documento.", confirmButtonColor:"#004aad" });
      return;
    }
  
    if(!STORAGE_ENABLED){
      const request = {
        tipo: toEnumDocType(type),
        nome: name,
        link: link || null,
        data: date || null,
        observacoes: notes || null,
        fileName: finalFileName || null
      };
  
      try{
        const url = list.some(x => x.id === id) ? `${DOCS_API_BASE}/${id}` : DOCS_API_BASE;
        const method = list.some(x => x.id === id) ? "PUT" : "POST";
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(request)
        });
        const data = await res.json().catch(() => ({}));
        if(!res.ok) throw new Error(data?.message || S.documents.saveFail);
  
        const payload = mapDocumentDto(data);
        const updated = loadDocuments();
        const idx = updated.findIndex(x => x.id === payload.id);
        if(idx >= 0) updated[idx] = payload;
        else updated.push(payload);
        saveDocuments(updated);
  
        bootstrap.Modal.getInstance(document.getElementById("docEditModal"))?.hide();
        renderDocuments();
        Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Documento salvo", showConfirmButton:false, timer:2000 });
      }catch(err){
        Swal.fire({ icon:"error", title: S.documents.saveFailTitle, text: String(err?.message || err || S.documents.unexpectedError), confirmButtonColor:"#004aad" });
      }
      return;
    }
  
    const payload = {
      id,
      type,
      name,
      link,
      date,
      notes,
      fileName: finalFileName,
      updatedAt: new Date().toISOString(),
      createdAt: (list.find(x=>x.id===id)?.createdAt) || new Date().toISOString()
    };
  
    const idx = list.findIndex(x => x.id === id);
    if(idx >= 0) list[idx] = payload;
    else list.push(payload);
  
    saveDocuments(list);
  
    bootstrap.Modal.getInstance(document.getElementById("docEditModal"))?.hide();
    renderDocuments();
  
    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Documento salvo", showConfirmButton:false, timer:2000 });
  }
  
  async function deleteDocumentItem(id){
    Swal.fire({
      title: S.documents.removeTitle,
      text:"Isso apaga do seu perfil (neste protÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³tipo).",
      icon:"warning",
    showCancelButton:true,
    confirmButtonText: S.common.remove,
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
    }).then(async r=>{
      if(!r.isConfirmed) return;
      if(!STORAGE_ENABLED){
        try{
          const res = await fetch(`${DOCS_API_BASE}/${id}`, { method:"DELETE", headers:{ "Accept":"application/json" }, credentials:"same-origin" });
          if(!res.ok){
            const data = await res.json().catch(() => ({}));
            throw new Error(data?.message || S.documents.removeFail);
          }
        }catch(err){
          Swal.fire({ icon:"error", title: S.documents.removeFailTitle, text: String(err?.message || err || S.documents.unexpectedError), confirmButtonColor:"#004aad" });
          return;
        }
      }
      const list = loadDocuments().filter(x => x.id !== id);
      saveDocuments(list);
      renderDocuments();
    });
  }
  
  function iconForDocType(type){
    switch(normalizeDocTypeValue(type)){
      case "curriculo": return "fa-file-alt";
      case "certificado": return "fa-certificate";
      case "diplomadeclaracao": return "fa-graduation-cap";
      case "portfolio": return "fa-briefcase";
      case "carteiraregistro": return "fa-id-card";
      default: return "fa-paperclip";
    }
  }
  
  function renderDocuments(){
    const host = document.getElementById("docsList");
    const empty = document.getElementById("docsEmpty");
    if(!host) return;
  
    if(!STORAGE_ENABLED && !docsLoaded && !docsLoading){
      ensureDocumentsLoaded().then(() => renderDocuments());
      return;
    }

  const search = (document.getElementById("docsSearch")?.value || "").trim().toLowerCase();
  const filterType = (document.getElementById("docsFilterType")?.value || "").trim();
  const sort = (document.getElementById("docsSort")?.value || "new").trim();

  let list = loadDocuments();

  if(filterType){
    list = list.filter(d => (d.type || "") === filterType);
  }

  if(search){
    list = list.filter(d =>
      (d.name || "").toLowerCase().includes(search) ||
      (d.type || "").toLowerCase().includes(search) ||
      (d.fileName || "").toLowerCase().includes(search)
    );
  }

  // ordenar
  if(sort === "new"){
    list.sort((a,b) => String(b.updatedAt||"").localeCompare(String(a.updatedAt||"")));
  }else if(sort === "old"){
    list.sort((a,b) => String(a.updatedAt||"").localeCompare(String(b.updatedAt||"")));
  }else if(sort === "name"){
    list.sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), "pt-BR"));
  }else if(sort === "type"){
    list.sort((a,b) => String(a.type||"").localeCompare(String(b.type||""), "pt-BR"));
  }

  host.innerHTML = "";

  if(list.length === 0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  list.forEach(d => {
    const ico = iconForDocType(d.type || "Outros");
    const when = d.date ? escapeHtml(d.date) : (d.updatedAt ? formatDateTimeBrSafe(d.updatedAt) : "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â");
    const linkBtn = d.link
      ? `<a class="btn btn-sm btn-outline-secondary fw-bold" href="${escapeAttr(d.link)}" target="_blank" rel="noopener">
           <i class="fas fa-link me-1"></i> Abrir
         </a>`
      : ``;

    const fileChip = d.fileName
      ? `<span class="badge rounded-pill text-bg-dark"><i class="fas fa-file me-1"></i>${escapeHtml(d.fileName)}</span>`
      : `<span class="badge rounded-pill bg-secondary"><i class="fas fa-file me-1"></i>Sem arquivo</span>`;

    host.innerHTML += `
      <div class="col-12">
        <div class="border rounded p-3" style="border-radius:14px;">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div style="min-width:0;">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <div class="fw-bold"><i class="fas ${ico} me-1"></i> ${escapeHtml(d.name)}</div>
                <span class="badge rounded-pill bg-primary">${escapeHtml(d.type || "Outros")}</span>
              </div>

              <div class="small text-muted mt-1">
                <i class="far fa-calendar-alt me-1"></i>${when}
              </div>

              <div class="d-flex flex-wrap gap-2 mt-2">
                ${fileChip}
                ${linkBtn}
              </div>

              ${d.notes ? `<div class="small text-muted mt-2" style="white-space:pre-wrap;">${escapeHtml(d.notes)}</div>` : ``}
            </div>

            <div class="d-flex gap-2 flex-shrink-0">
              <button class="btn btn-sm btn-outline-primary" type="button" onclick="openDocModal('${d.id}')">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteDocumentItem('${d.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

  async function seedDocuments(){
    const list = loadDocuments();
    if(list.length > 0){
      Swal.fire({ icon:"info", title:"JÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ existe conteÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºdo", text:"Limpe antes para inserir exemplos.", confirmButtonColor:"#004aad" });
      return;
    }

  const now = new Date().toISOString();
  const demo = [
    {
      id: uid(),
      type: "CurrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culo",
      name: "CurrÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­culo ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â versÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o 2026",
      link: "",
      date: "01/2026",
      notes: "VersÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o atualizada com experiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias e projetos recentes.",
      fileName: "curriculo_2026.pdf",
      createdAt: now,
      updatedAt: now
    },
    {
      id: uid(),
      type: "Certificado",
      name: "CertificaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o Excel AvanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ado",
      link: "https://drive.google.com/",
      date: "2024",
      notes: "Certificado SENAI ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ dashboards e tabelas dinÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢micas.",
      fileName: "",
      createdAt: now,
      updatedAt: now
    }
  ];

    if(!STORAGE_ENABLED){
      try{
        const created = [];
        for (const item of demo){
          const request = {
            tipo: toEnumDocType(item.type),
            nome: item.name,
            link: item.link || null,
            data: item.date || null,
            observacoes: item.notes || null,
            fileName: item.fileName || null
          };
          const res = await fetch(DOCS_API_BASE, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(request)
          });
          const data = await res.json().catch(() => ({}));
          if(res.ok) created.push(mapDocumentDto(data));
        }
        saveDocuments(created);
        renderDocuments();
        Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
      }catch{
        Swal.fire({ icon:"error", title: S.documents.insertExamplesFailTitle, confirmButtonColor:"#004aad" });
      }
      return;
    }
  
    saveDocuments(demo);
    renderDocuments();
    Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
  }
  
  async function resetDocuments(){
    Swal.fire({
      icon:"warning",
      title: S.documents.clearTitle,
      text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText: S.common.clear,
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
    }).then(async r=>{
      if(!r.isConfirmed) return;
      if(!STORAGE_ENABLED){
        await ensureDocumentsLoaded();
        const list = loadDocuments();
        for (const item of list){
          try{
            await fetch(`${DOCS_API_BASE}/${item.id}`, { method:"DELETE", headers:{ "Accept":"application/json" }, credentials:"same-origin" });
          }catch{
            // ignore
          }
        }
        saveDocuments([]);
      }else{
        storageRemove(DOCS_STORAGE_KEY);
      }
      renderDocuments();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
    });
  }

function downloadDocumentsSummary(){
  const list = loadDocuments();
  const lines = [];
  lines.push("LiotÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cnica ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Resumo de Documentos & Anexos (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  if(list.length === 0){
    lines.push("Nenhum documento anexado.");
  }else{
    list.forEach(d => {
      lines.push(`${d.type || "Outros"}: ${d.name} | Arquivo: ${(d.fileName||"ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â")} | Link: ${(d.link||"ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â")} | Data: ${(d.date||"ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â")}`);
    });
  }

  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resumo-documentos-liotecnica.txt";
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}

// ======================================
