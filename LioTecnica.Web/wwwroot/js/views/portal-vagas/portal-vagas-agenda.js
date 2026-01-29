// TEST
// Aba: Disponibilidade & Agenda
// ======================================
const AGENDA_STORAGE_KEY = "liotec_portal_agenda_v1";
const AGENDA_API_BASE = "/PortalVagas/Agenda";
let __agendaHydratedOnce = false;
let __agendaSaveTimer = null;
let agendaCache = defaultAgenda();
let agendaLoaded = false;
let agendaLoading = false;

function __fmtIsoOrFallback(iso){
  try{
    if(typeof formatDateTimeBrSafe === "function") return formatDateTimeBrSafe(iso);
  }catch{}
  try{
    const d = new Date(iso);
    if(isNaN(d.getTime())) return "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â";
    return d.toLocaleString("pt-BR");
  }catch{ return "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"; }
}

function defaultAgenda(){
  return {
    interviewMode: "",
    startDate: "",
    notice: "",
    notes: "",

    days: { mon:false, tue:false, wed:false, thu:false, fri:false, sat:false, sun:false },
    times: { morning:false, afternoon:false, evening:false },
    preferredHours: "",
    timezone: "",

    blocks: [],

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function loadAgenda(){
  if(!STORAGE_ENABLED) return agendaCache;
  try{
    const raw = storageGet(AGENDA_STORAGE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== "object") return null;
    obj.blocks = Array.isArray(obj.blocks) ? obj.blocks : [];
    obj.days = obj.days || {};
    obj.times = obj.times || {};
    return obj;
  }catch{
    return null;
  }
}
function saveAgendaToStorage(obj){
  if(!STORAGE_ENABLED){
    agendaCache = obj;
    return;
  }
  try{ storageSet(AGENDA_STORAGE_KEY, JSON.stringify(obj)); }catch{}
}

function mapAgendaResponse(data){
  const a = defaultAgenda();
  const prefs = data?.preferences || {};
  a.interviewMode = prefs.formatoEntrevista || "";
  a.startDate = prefs.inicioDisponivel || "";
  a.notice = prefs.avisoPrevio || "";
  a.notes = prefs.observacoes || "";
  a.days = {
    mon: !!prefs.diaSeg,
    tue: !!prefs.diaTer,
    wed: !!prefs.diaQua,
    thu: !!prefs.diaQui,
    fri: !!prefs.diaSex,
    sat: !!prefs.diaSab,
    sun: !!prefs.diaDom
  };
  a.times = {
    morning: !!prefs.periodoManha,
    afternoon: !!prefs.periodoTarde,
    evening: !!prefs.periodoNoite
  };
  a.preferredHours = prefs.horarioPreferido || "";
  a.timezone = prefs.fusoHorario || "";
  a.blocks = Array.isArray(data?.blocks)
    ? data.blocks.map(b => ({
        id: b.id,
        type: b.tipo || "",
        title: b.titulo || "",
        date: b.data || "",
        hours: b.horario || "",
        notes: b.observacoes || "",
        createdAt: b.updatedAtUtc || new Date().toISOString(),
        updatedAt: b.updatedAtUtc || new Date().toISOString()
      }))
    : [];
  a.updatedAt = prefs.updatedAtUtc || a.updatedAt;
  return a;
}

async function ensureAgendaLoaded(){
  if(STORAGE_ENABLED || agendaLoaded || agendaLoading) return;
  agendaLoading = true;
  try{
    const res = await fetch(AGENDA_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if(res.ok){
      agendaCache = mapAgendaResponse(data);
      __agendaHydratedOnce = false;
    }
  }catch{
    // ignore
  }finally{
    agendaLoaded = true;
    agendaLoading = false;
  }
}

async function persistAgendaPreferences(obj){
  if(STORAGE_ENABLED){
    saveAgendaToStorage(obj);
    return obj;
  }

  const body = {
    formatoEntrevista: obj.interviewMode || "",
    inicioDisponivel: obj.startDate || "",
    avisoPrevio: obj.notice || "",
    observacoes: obj.notes || "",
    diaSeg: !!obj.days?.mon,
    diaTer: !!obj.days?.tue,
    diaQua: !!obj.days?.wed,
    diaQui: !!obj.days?.thu,
    diaSex: !!obj.days?.fri,
    diaSab: !!obj.days?.sat,
    diaDom: !!obj.days?.sun,
    periodoManha: !!obj.times?.morning,
    periodoTarde: !!obj.times?.afternoon,
    periodoNoite: !!obj.times?.evening,
    horarioPreferido: obj.preferredHours || "",
    fusoHorario: obj.timezone || ""
  };

  try{
    const res = await fetch(AGENDA_API_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if(res.ok){
      agendaCache = {
        ...agendaCache,
        interviewMode: payload.formatoEntrevista || "",
        startDate: payload.inicioDisponivel || "",
        notice: payload.avisoPrevio || "",
        notes: payload.observacoes || "",
        days: {
          mon: !!payload.diaSeg,
          tue: !!payload.diaTer,
          wed: !!payload.diaQua,
          thu: !!payload.diaQui,
          fri: !!payload.diaSex,
          sat: !!payload.diaSab,
          sun: !!payload.diaDom
        },
        times: {
          morning: !!payload.periodoManha,
          afternoon: !!payload.periodoTarde,
          evening: !!payload.periodoNoite
        },
        preferredHours: payload.horarioPreferido || "",
        timezone: payload.fusoHorario || "",
        updatedAt: payload.updatedAtUtc || new Date().toISOString()
      };
      return agendaCache;
    }
  }catch{
    // ignore
  }
  return null;
}

async function saveAgendaBlockFromSeed(block){
  const body = {
    tipo: block.type || "",
    titulo: block.title || "",
    data: block.date || "",
    horario: block.hours || "",
    observacoes: block.notes || ""
  };
  const res = await fetch(`${AGENDA_API_BASE}/Blocks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if(!res.ok) return;

  const saved = {
    id: payload.id,
    type: payload.tipo || "",
    title: payload.titulo || "",
    date: payload.data || "",
    hours: payload.horario || "",
    notes: payload.observacoes || "",
    createdAt: new Date().toISOString(),
    updatedAt: payload.updatedAtUtc || new Date().toISOString()
  };

  const idx = agendaCache.blocks.findIndex(x => x.id === saved.id);
  if(idx >= 0) agendaCache.blocks[idx] = saved;
  else agendaCache.blocks.push(saved);
}

function hydrateAgenda(){
  if(__agendaHydratedOnce) return;
  __agendaHydratedOnce = true;

  const a = loadAgenda() || defaultAgenda();
  saveAgendaToStorage(a);

  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ""; };
  const setChk = (id, val) => { const el = document.getElementById(id); if(el) el.checked = !!val; };

  setVal("agInterviewMode", a.interviewMode);
  setVal("agStartDate", a.startDate);
  setVal("agNotice", a.notice);
  setVal("agNotes", a.notes);

  setChk("agDayMon", !!a.days.mon);
  setChk("agDayTue", !!a.days.tue);
  setChk("agDayWed", !!a.days.wed);
  setChk("agDayThu", !!a.days.thu);
  setChk("agDayFri", !!a.days.fri);
  setChk("agDaySat", !!a.days.sat);
  setChk("agDaySun", !!a.days.sun);

  setChk("agTimeMorning", !!a.times.morning);
  setChk("agTimeAfternoon", !!a.times.afternoon);
  setChk("agTimeEvening", !!a.times.evening);

  setVal("agPreferredHours", a.preferredHours);
  setVal("agTimezone", a.timezone || "");

  renderAgendaBlocks();
}

function getAgendaFromUI(){
  const val = (id) => (document.getElementById(id)?.value || "").trim();
  const chk = (id) => !!document.getElementById(id)?.checked;

  return {
    interviewMode: val("agInterviewMode"),
    startDate: val("agStartDate"),
    notice: val("agNotice"),
    notes: val("agNotes"),

    days: {
      mon: chk("agDayMon"),
      tue: chk("agDayTue"),
      wed: chk("agDayWed"),
      thu: chk("agDayThu"),
      fri: chk("agDayFri"),
      sat: chk("agDaySat"),
      sun: chk("agDaySun")
    },
    times: {
      morning: chk("agTimeMorning"),
      afternoon: chk("agTimeAfternoon"),
      evening: chk("agTimeEvening")
    },
    preferredHours: val("agPreferredHours"),
    timezone: val("agTimezone")
  };
}

function saveAgenda(){
  const existing = loadAgenda() || defaultAgenda();
  const ui = getAgendaFromUI();

  const merged = {
    ...existing,
    ...ui,
    blocks: Array.isArray(existing.blocks) ? existing.blocks : [],
    updatedAt: new Date().toISOString()
  };

  saveAgendaToStorage(merged);
  if(!STORAGE_ENABLED){
    persistAgendaPreferences(merged);
  }
}

function saveAgendaDebounced(){
  clearTimeout(__agendaSaveTimer);
  __agendaSaveTimer = setTimeout(() => saveAgenda(), 250);
}

// ---------- Bloqueios ----------
function openBlockModal(id){
  const m = new bootstrap.Modal(document.getElementById("agendaBlockModal"));
  const a = loadAgenda() || defaultAgenda();
  const b = id ? (a.blocks || []).find(x => x.id === id) : null;

  document.getElementById("agBlockId").value = b?.id || "";
  document.getElementById("agBlockType").value = b?.type || "Compromisso";
  document.getElementById("agBlockTitle").value = b?.title || "";
  document.getElementById("agBlockDate").value = b?.date || "";
  document.getElementById("agBlockHours").value = b?.hours || "";
  document.getElementById("agBlockNotes").value = b?.notes || "";

  m.show();
}

async function saveAgendaBlock(){
  const a = loadAgenda() || defaultAgenda();
  a.blocks = Array.isArray(a.blocks) ? a.blocks : [];

  const id = (document.getElementById("agBlockId").value || "").trim() || uid();
  const type = (document.getElementById("agBlockType").value || "Outro").trim();
  const title = (document.getElementById("agBlockTitle").value || "").trim();
  const date = (document.getElementById("agBlockDate").value || "").trim();
  const hours = (document.getElementById("agBlockHours").value || "").trim();
  const notes = (document.getElementById("agBlockNotes").value || "").trim();

  if(!title || !date){
    Swal.fire({ icon:"warning", title:"Faltou algo", text:"Informe Titulo e Data.", confirmButtonColor:"#004aad" });
    return;
  }

  if(!STORAGE_ENABLED){
    const isUpdate = !!id && agendaCache.blocks.some(x => x.id === id);
    const url = isUpdate ? `${AGENDA_API_BASE}/Blocks/${id}` : `${AGENDA_API_BASE}/Blocks`;
    const method = isUpdate ? "PUT" : "POST";
    const body = { tipo: type, titulo: title, data: date, horario: hours, observacoes: notes };

    try{
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body)
      });
      const payload = await res.json().catch(() => ({}));
      if(!res.ok) throw new Error("request_failed");

      const saved = {
        id: payload.id,
        type: payload.tipo || "",
        title: payload.titulo || "",
        date: payload.data || "",
        hours: payload.horario || "",
        notes: payload.observacoes || "",
        createdAt: a.blocks.find(x => x.id === payload.id)?.createdAt || new Date().toISOString(),
        updatedAt: payload.updatedAtUtc || new Date().toISOString()
      };

      const idx = agendaCache.blocks.findIndex(x => x.id === saved.id);
      if(idx >= 0) agendaCache.blocks[idx] = saved;
      else agendaCache.blocks.push(saved);

      agendaCache.blocks.sort((x,y)=>String(y.updatedAt||"").localeCompare(String(x.updatedAt||"")));
      agendaCache.updatedAt = new Date().toISOString();
      saveAgendaToStorage(agendaCache);
    }catch{
      Swal.fire({ icon:"error", title: S.agenda.saveErrorTitle, text: S.agenda.saveErrorText, confirmButtonColor:"#004aad" });
      return;
    }
  }else{
    const payload = {
      id, type, title, date, hours, notes,
      updatedAt: new Date().toISOString(),
      createdAt: (a.blocks.find(x=>x.id===id)?.createdAt) || new Date().toISOString()
    };

    const idx = a.blocks.findIndex(x => x.id === id);
    if(idx >= 0) a.blocks[idx] = payload;
    else a.blocks.push(payload);

    // ordena por updatedAt desc por padrao
    a.blocks.sort((x,y)=>String(y.updatedAt||"").localeCompare(String(x.updatedAt||"")));
    a.updatedAt = new Date().toISOString();

    saveAgendaToStorage(a);
  }

  bootstrap.Modal.getInstance(document.getElementById("agendaBlockModal"))?.hide();
  renderAgendaBlocks();

  Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Bloqueio salvo", showConfirmButton:false, timer:1900 });
}

function deleteAgendaBlock(id){
  Swal.fire({
    title: S.agenda.removeTitle,
    text:"Isso apaga do seu perfil (neste prototipo).",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText: S.common.remove,
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
  }).then(r=>{
    if(!r.isConfirmed) return;
    if(!STORAGE_ENABLED){
      fetch(`${AGENDA_API_BASE}/Blocks/${id}`, { method:"DELETE", credentials:"same-origin" })
        .then(res => {
          if(!res.ok) throw new Error("delete_failed");
          agendaCache.blocks = agendaCache.blocks.filter(x => x.id !== id);
          agendaCache.updatedAt = new Date().toISOString();
          saveAgendaToStorage(agendaCache);
          renderAgendaBlocks();
        })
        .catch(() => {
          Swal.fire({ icon:"error", title: S.agenda.removeErrorTitle, text: S.agenda.removeErrorText, confirmButtonColor:"#004aad" });
        });
      return;
    }
    const a = loadAgenda() || defaultAgenda();
    a.blocks = (a.blocks||[]).filter(x=>x.id!==id);
    a.updatedAt = new Date().toISOString();
    saveAgendaToStorage(a);
    renderAgendaBlocks();
  });
}

function renderAgendaBlocks(){
  const host = document.getElementById("agBlocksList");
  const empty = document.getElementById("agBlocksEmpty");
  if(!host) return;

  const a = loadAgenda() || defaultAgenda();
  let list = Array.isArray(a.blocks) ? [...a.blocks] : [];

  const search = (document.getElementById("agBlocksSearch")?.value || "").trim().toLowerCase();
  const sort = (document.getElementById("agBlocksSort")?.value || "new").trim();
  const typeFilter = (document.getElementById("agBlocksTypeFilter")?.value || "").trim();

  if(typeFilter){
    list = list.filter(b => (b.type||"") === typeFilter);
  }

  if(search){
    list = list.filter(b =>
      (b.title||"").toLowerCase().includes(search) ||
      (b.date||"").toLowerCase().includes(search) ||
      (b.type||"").toLowerCase().includes(search) ||
      (b.hours||"").toLowerCase().includes(search)
    );
  }

  if(sort === "new"){
    list.sort((x,y)=>String(y.updatedAt||"").localeCompare(String(x.updatedAt||"")));
  }else if(sort === "old"){
    list.sort((x,y)=>String(x.updatedAt||"").localeCompare(String(y.updatedAt||"")));
  }else if(sort === "date"){
    list.sort((x,y)=>String(x.date||"").localeCompare(String(y.date||""), "pt-BR"));
  }

  host.innerHTML = "";

  if(list.length === 0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  const badgeCls = (type)=>{
    switch(type){
      case "Entrevista": return "bg-primary";
      case "Viagem": return "bg-warning text-dark";
      case "Saude": return "bg-danger";
      case "Compromisso": return "bg-secondary";
      default: return "bg-dark";
    }
  };

  list.forEach(b=>{
    host.innerHTML += `
      <div class="col-12">
        <div class="border rounded p-3" style="border-radius:14px;">
          <div class="d-flex justify-content-between align-items-start gap-2">
            <div style="min-width:0;">
              <div class="d-flex flex-wrap align-items-center gap-2">
                <div class="fw-bold"><i class="fas fa-ban me-1"></i> ${escapeHtml(b.title)}</div>
                <span class="badge rounded-pill ${badgeCls(b.type)}">${escapeHtml(b.type||"Outro")}</span>
              </div>
              <div class="small text-muted mt-1">
                <i class="far fa-calendar-alt me-1"></i>${escapeHtml(b.date || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â")}
                ${b.hours ? `<span class="ms-2"><i class="far fa-clock me-1"></i>${escapeHtml(b.hours)}</span>` : ""}
              </div>
              ${b.notes ? `<div class="small text-muted mt-2" style="white-space:pre-wrap;">${escapeHtml(b.notes)}</div>` : ""}
              <div class="small text-muted mt-2">Atualizado: ${__fmtIsoOrFallback(b.updatedAt)}</div>
            </div>

            <div class="d-flex gap-2 flex-shrink-0">
              <button class="btn btn-sm btn-outline-primary" type="button" onclick="openBlockModal('${b.id}')">
                <i class="fas fa-pen"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteAgendaBlock('${b.id}')">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  });
}

// ---------- Render / seed / reset / export ----------
function renderAgenda(){
  if(!STORAGE_ENABLED && !agendaLoaded){
    ensureAgendaLoaded().then(() => renderAgenda());
    return;
  }
  hydrateAgenda();
  renderAgendaBlocks();
}

if (typeof window !== "undefined") {
  window.renderAgenda = renderAgenda;
  window.ensureAgendaLoaded = ensureAgendaLoaded;
}

async function seedAgenda(){
  if(!STORAGE_ENABLED && !agendaLoaded){
    await ensureAgendaLoaded();
  }

  const existing = loadAgenda();
  if(existing && (existing.startDate || existing.notes || (existing.blocks||[]).length)){
    Swal.fire({ icon:"info", title:"Ja existe conteudo", text:"Limpe antes para inserir exemplo.", confirmButtonColor:"#004aad" });
    return;
  }

  const a = defaultAgenda();
  a.interviewMode = "Online";
  a.startDate = "Imediato";
  a.notice = "A combinar";
  a.notes = "Prefiro confirmacao por WhatsApp e entrevistas com 24h de antecedencia.";
  a.days = { mon:true, tue:true, wed:true, thu:true, fri:true, sat:false, sun:false };
  a.times = { morning:true, afternoon:true, evening:false };
  a.preferredHours = "09:00-11:00";
  a.timezone = "America/Sao_Paulo";
  a.blocks = [
    { id: uid(), type:"Saude", title:"Consulta medica", date:"30/01/2026", hours:"14:00-16:00", notes:"Indisponivel nesse periodo.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  ];
  a.updatedAt = new Date().toISOString();

  if(STORAGE_ENABLED){
    saveAgendaToStorage(a);
  }else{
    agendaCache = { ...a, blocks: [] };
    await persistAgendaPreferences(agendaCache);
    for (const block of [...a.blocks]){
      await saveAgendaBlockFromSeed(block);
    }
  }

  __agendaHydratedOnce = false;
  renderAgenda();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetAgenda(){
  Swal.fire({
    icon:"warning",
    title: S.agenda.clearTitle,
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText: S.common.clear,
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
  }).then(async r=>{
    if(!r.isConfirmed) return;
    if(!STORAGE_ENABLED){
      await ensureAgendaLoaded();
      for (const block of (agendaCache.blocks || [])){
        try{
          await fetch(`${AGENDA_API_BASE}/Blocks/${block.id}`, { method:"DELETE", credentials:"same-origin" });
        }catch{
          // ignore
        }
      }
      agendaCache = defaultAgenda();
      await persistAgendaPreferences(agendaCache);
      saveAgendaToStorage(agendaCache);
    }else{
      storageRemove(AGENDA_STORAGE_KEY);
    }
    __agendaHydratedOnce = false;
    renderAgenda();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
  });
}

function downloadAgendaSummary(){
  const a = loadAgenda() || defaultAgenda();

  const yesNo = (v)=> v ? "Sim" : "NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o";
  const days = [
    ["Seg", a.days.mon], ["Ter", a.days.tue], ["Qua", a.days.wed],
    ["Qui", a.days.thu], ["Sex", a.days.fri], ["SÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡b", a.days.sat], ["Dom", a.days.sun]
  ].filter(x=>x[1]).map(x=>x[0]).join(", ") || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â";

  const times = [
    ["ManhÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£", a.times.morning], ["Tarde", a.times.afternoon], ["Noite", a.times.evening]
  ].filter(x=>x[1]).map(x=>x[0]).join(", ") || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â";

  const lines = [];
  lines.push("LiotÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©cnica ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Resumo Disponibilidade & Agenda (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  lines.push("PreferÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias gerais:");
  lines.push(`- Entrevista: ${a.interviewMode || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}`);
  lines.push(`- InÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­cio disponÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­vel: ${a.startDate || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}`);
  lines.push(`- Aviso prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©vio: ${a.notice || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}`);
  lines.push(`- ObservaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes: ${a.notes || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}`);
  lines.push("");

  lines.push("Disponibilidade:");
  lines.push(`- Dias: ${days}`);
  lines.push(`- PerÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odos: ${times}`);
  lines.push(`- HorÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rio preferido: ${a.preferredHours || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}`);
  lines.push(`- Fuso: ${a.timezone || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"}`);
  lines.push("");

  lines.push("Bloqueios:");
  if(!a.blocks || a.blocks.length === 0){
    lines.push("- Nenhum bloqueio cadastrado.");
  }else{
    (a.blocks||[]).forEach(b=>{
      lines.push(`- ${b.type||"Outro"}: ${b.title} | ${b.date||"ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"} ${b.hours?("("+b.hours+")"):""} | ${b.notes||""}`.trim());
    });
  }

  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const dl = document.createElement("a");
  dl.href = URL.createObjectURL(blob);
  dl.download = "resumo-disponibilidade-liotecnica.txt";
  document.body.appendChild(dl);
  dl.click();
  URL.revokeObjectURL(dl.href);
  dl.remove();
}

// ======================================
