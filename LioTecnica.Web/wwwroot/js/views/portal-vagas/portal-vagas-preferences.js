// Aba: Preferências de Vaga / Objetivos
// ======================================
const PREFS_STORAGE_KEY = "liotec_portal_preferences_v1";
const PREFS_API_BASE = "/PortalVagas/Preferences";

let prefsCache = defaultPreferences();
let prefsLoaded = false;
let prefsLoading = false;

function loadPreferences(){
  if(!STORAGE_ENABLED) return prefsCache;
  try{
    const raw = storageGet(PREFS_STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function defaultPreferences(){
  return {
    role: "",
    seniority: "",
    start: "",
    summary: "",

    areas: "",
    workMode: "",
    shift: "",
    contract: "",
    travel: "",
    relocation: "",

    city: "",
    maxDistance: "",
    commuteNotes: "",

    salary: "",
    salaryNegotiable: "",
    benefits: "",
    dealbreakers: "",

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

let __prefsHydratedOnce = false;

function hydratePreferences(force){
  if(!force && __prefsHydratedOnce) return;
  __prefsHydratedOnce = true;

  const p = loadPreferences() || defaultPreferences();

  const prefRoot = document.getElementById("tabPref");
  const getPrefEl = (id) => prefRoot?.querySelector(`#${CSS.escape(id)}`) || document.getElementById(id);
  const setVal = (id, val) => {
    const el = getPrefEl(id);
    if(el) el.value = val ?? "";
  };

  setVal("prefRole", p.role);
  setVal("prefSeniority", p.seniority);
  setVal("prefStart", p.start);
  setVal("prefSummary", p.summary);

  setVal("prefAreas", p.areas);
  setVal("prefWorkMode", p.workMode);
  setVal("prefShift", p.shift);
  setVal("prefContract", p.contract);
  setVal("prefTravel", p.travel);
  setVal("prefRelocation", p.relocation);

  setVal("prefCity", p.city);
  setVal("prefMaxDistance", p.maxDistance);
  setVal("prefCommuteNotes", p.commuteNotes);

  setVal("prefSalary", p.salary);
  setVal("prefSalaryNegotiable", p.salaryNegotiable);
  setVal("prefBenefits", p.benefits);
  setVal("prefDealbreakers", p.dealbreakers);

  renderPreferencesSavedHint(p.updatedAt);
}

async function ensurePreferencesLoaded(){
  if(STORAGE_ENABLED || prefsLoaded || prefsLoading) return;
  prefsLoading = true;
  try{
    const res = await fetch(PREFS_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if(res.ok){
      prefsCache = mapPreferencesResponse(data);
      __prefsHydratedOnce = false;
    }
  }catch{
    // ignore
  }finally{
    prefsLoaded = true;
    prefsLoading = false;
  }
}

function mapPreferencesResponse(data){
  const p = defaultPreferences();
  p.role = data?.cargoAlvo || "";
  p.seniority = data?.senioridade || "";
  p.start = data?.inicioDisponivel || "";
  p.summary = data?.resumo || "";

  p.areas = data?.areasInteresse || "";
  p.workMode = data?.modeloTrabalho || "";
  p.shift = data?.jornada || "";
  p.contract = data?.tipoContrato || "";
  p.travel = data?.viagens || "";
  p.relocation = data?.mudanca || "";

  p.city = data?.cidadePreferida || "";
  p.maxDistance = data?.distanciaMaxKm || "";
  p.commuteNotes = data?.obsDeslocamento || "";

  p.salary = data?.pretensaoSalarial || "";
  p.salaryNegotiable = data?.pretensaoNegociavel || "";
  p.benefits = data?.beneficiosDesejados || "";
  p.dealbreakers = data?.naoAbreMaoDe || "";
  p.updatedAt = data?.updatedAtUtc || p.updatedAt;
  return p;
}

async function persistPreferences(p){
  if(STORAGE_ENABLED){
    try{ storageSet(PREFS_STORAGE_KEY, JSON.stringify(p)); }catch{}
    return p;
  }

  const body = {
    cargoAlvo: p.role,
    senioridade: p.seniority,
    inicioDisponivel: p.start,
    resumo: p.summary,
    areasInteresse: p.areas,
    modeloTrabalho: p.workMode,
    jornada: p.shift,
    tipoContrato: p.contract,
    viagens: p.travel,
    mudanca: p.relocation,
    cidadePreferida: p.city,
    distanciaMaxKm: p.maxDistance,
    obsDeslocamento: p.commuteNotes,
    pretensaoSalarial: p.salary,
    pretensaoNegociavel: p.salaryNegotiable,
    beneficiosDesejados: p.benefits,
    naoAbreMaoDe: p.dealbreakers
  };

  try{
    const res = await fetch(PREFS_API_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if(res.ok){
      prefsCache = mapPreferencesResponse(payload);
      return prefsCache;
    }
  }catch{
    // ignore
  }
  return null;
}

function savePreferences(){
  const p = loadPreferences() || defaultPreferences();

  const prefRoot = document.getElementById("tabPref");
  const getPrefEl = (id) => prefRoot?.querySelector(`#${CSS.escape(id)}`) || document.getElementById(id);
  const val = (id) => (getPrefEl(id)?.value || "").trim();

  p.role = val("prefRole");
  p.seniority = val("prefSeniority");
  p.start = val("prefStart");
  p.summary = val("prefSummary");

  p.areas = val("prefAreas");
  p.workMode = val("prefWorkMode");
  p.shift = val("prefShift");
  p.contract = val("prefContract");
  p.travel = val("prefTravel");
  p.relocation = val("prefRelocation");

  p.city = val("prefCity");
  p.maxDistance = val("prefMaxDistance");
  p.commuteNotes = val("prefCommuteNotes");

  p.salary = val("prefSalary");
  p.salaryNegotiable = val("prefSalaryNegotiable");
  p.benefits = val("prefBenefits");
  p.dealbreakers = val("prefDealbreakers");

  p.updatedAt = new Date().toISOString();

  if(STORAGE_ENABLED){
    try{ storageSet(PREFS_STORAGE_KEY, JSON.stringify(p)); }catch{}
    renderPreferencesSavedHint(p.updatedAt);
    return;
  }

  persistPreferences(p).then(saved => {
    if(saved) renderPreferencesSavedHint(saved.updatedAt);
  });
}

let __prefsSaveTimer = null;
function savePreferencesDebounced(){
  clearTimeout(__prefsSaveTimer);
  __prefsSaveTimer = setTimeout(() => savePreferences(), 250);
}

function renderPreferencesSavedHint(updatedAtIso){
  const el = document.getElementById("prefSavedHint");
  if(!el) return;
  const txt = (updatedAtIso ? formatDateTimeBrSafe(updatedAtIso) : "—");
  el.textContent = `Salvo: ${txt}`;
}

function renderPreferences(){
  if(!STORAGE_ENABLED && !prefsLoaded){
    ensurePreferencesLoaded().then(() => renderPreferences());
    return;
  }
  hydratePreferences(true);
  const p = loadPreferences() || defaultPreferences();
  renderPreferencesSavedHint(p.updatedAt);
}

if (typeof window !== "undefined") {
  window.renderPreferences = renderPreferences;
  window.ensurePreferencesLoaded = ensurePreferencesLoaded;
}

async function seedPreferences(){
  if(!STORAGE_ENABLED && !prefsLoaded){
    await ensurePreferencesLoaded();
  }
  const p = loadPreferences() || defaultPreferences();

  // se já tiver algo preenchido, avisa (para evitar sobrescrever sem querer)
  const hasAny = Object.keys(p).some(k => ["role","areas","summary","city"].includes(k) && String(p[k]||"").trim().length > 0);
  if(hasAny){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Se quiser inserir exemplo, limpe antes.", confirmButtonColor:"#004aad" });
    return;
  }

  p.role = "Analista de Qualidade Jr";
  p.seniority = "Júnior";
  p.start = "30 dias";
  p.summary = "Busco atuar em Qualidade com foco em melhoria contínua, auditorias e indicadores, contribuindo com padronização e segurança.";

  p.areas = "Qualidade, Produção, P&D";
  p.workMode = "Presencial";
  p.shift = "Comercial";
  p.contract = "CLT";
  p.travel = "Eventual";
  p.relocation = "Depende";

  p.city = "Embu das Artes / SP";
  p.maxDistance = "25";
  p.commuteNotes = "Acesso fácil a ônibus/metrô.";

  p.salary = "3500";
  p.salaryNegotiable = "Depende";
  p.benefits = "VR, VT, plano de saúde";
  p.dealbreakers = "Ambiente respeitoso, plano de carreira";

  p.updatedAt = new Date().toISOString();

  if(STORAGE_ENABLED){
    try{ storageSet(PREFS_STORAGE_KEY, JSON.stringify(p)); }catch{}
  }else{
    await persistPreferences(p);
  }
  __prefsHydratedOnce = false;
  renderPreferences();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetPreferences(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Preferências?",
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
    }).then(r=>{
      if(!r.isConfirmed) return;
      if(STORAGE_ENABLED){
        storageRemove(PREFS_STORAGE_KEY);
        __prefsHydratedOnce = false;
        renderPreferences();
        Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
        return;
      }

      const cleared = defaultPreferences();
      persistPreferences(cleared).then(() => {
        __prefsHydratedOnce = false;
        renderPreferences();
        Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
      });
    });
}

function previewPreferences(){
  const p = loadPreferences() || defaultPreferences();

  const lines = [];
  if(p.role) lines.push(`<div><strong>Cargo alvo:</strong> ${escapeHtml(p.role)} ${p.seniority ? `(${escapeHtml(p.seniority)})` : ""}</div>`);
  if(p.areas) lines.push(`<div><strong>Áreas:</strong> ${escapeHtml(p.areas)}</div>`);
  if(p.workMode) lines.push(`<div><strong>Modelo:</strong> ${escapeHtml(p.workMode)} ${p.shift ? `• ${escapeHtml(p.shift)}` : ""}</div>`);
  if(p.contract) lines.push(`<div><strong>Contrato:</strong> ${escapeHtml(p.contract)}</div>`);
  if(p.city) lines.push(`<div><strong>Local:</strong> ${escapeHtml(p.city)} ${p.maxDistance ? `• até ${escapeHtml(p.maxDistance)} km` : ""}</div>`);
  if(p.salary) lines.push(`<div><strong>Pretensão:</strong> R$ ${escapeHtml(p.salary)} ${p.salaryNegotiable ? `• ${escapeHtml(p.salaryNegotiable)}` : ""}</div>`);
  if(p.benefits) lines.push(`<div><strong>Benefícios:</strong> ${escapeHtml(p.benefits)}</div>`);
  if(p.start) lines.push(`<div><strong>Início:</strong> ${escapeHtml(p.start)}</div>`);
  if(p.travel) lines.push(`<div><strong>Viagens:</strong> ${escapeHtml(p.travel)}</div>`);
  if(p.relocation) lines.push(`<div><strong>Mudança:</strong> ${escapeHtml(p.relocation)}</div>`);
  if(p.dealbreakers) lines.push(`<div class="mt-2"><strong>Não abro mão de:</strong> ${escapeHtml(p.dealbreakers)}</div>`);
  if(p.summary) lines.push(`<div class="mt-2 text-muted" style="white-space:pre-wrap;">${escapeHtml(p.summary)}</div>`);

  Swal.fire({
    title: "Resumo de Preferências",
    icon: "info",
    html: `<div class="text-start" style="line-height:1.55;">${lines.join("") || "<div class='text-muted'>Nada preenchido ainda.</div>"}</div>`,
    confirmButtonText: "Fechar",
    confirmButtonColor:"#004aad"
  });
}


// ======================================
