// Aba: Privacidade & Consentimentos (LGPD)
// ======================================
const LGPD_STORAGE_KEY = "liotec_portal_lgpd_v1";
const LGPD_API_BASE = "/PortalVagas/Lgpd";
const LGPD_RECEIPT_URL = "/PortalVagas/Lgpd/Receipt";

let lgpdCache = defaultLgpd();
let lgpdLoaded = false;
let lgpdLoading = false;

function loadLgpd(){
  if(!STORAGE_ENABLED) return lgpdCache;
  try{
    const raw = storageGet(LGPD_STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function defaultLgpd(){
  return {
    candidatura: false,
    contato: false,
    bancoTalentos: false,
    retentionMonths: "",
    sharing: "",
    sensivel: false,
    comunicacoes: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    revokedAt: null
  };
}

function mapSharingFromApi(value){
  if(!value) return "";
  const raw = String(value);
  if(raw == "Rh") return "rh";
  if(raw == "RhGestor") return "rh_gestor";
  if(raw == "Interno") return "interno";
  return "";
}

function mapSharingToApi(value){
  if(value == "rh") return "Rh";
  if(value == "rh_gestor") return "RhGestor";
  if(value == "interno") return "Interno";
  return null;
}

function mapLgpdResponse(data){
  const obj = defaultLgpd();
  obj.candidatura = !!(data && data.processarCandidatura);
  obj.contato = !!(data && data.permitirContato);
  obj.bancoTalentos = !!(data && data.bancoTalentos);
  obj.retentionMonths = data && data.retencaoMeses != null ? String(data.retencaoMeses) : "";
  obj.sharing = mapSharingFromApi(data && data.compartilhamento);
  obj.sensivel = !!(data && data.dadosSensiveis);
  obj.comunicacoes = !!(data && data.comunicacoes);
  obj.createdAt = (data && data.consentidoEmUtc) || obj.createdAt;
  obj.updatedAt = (data && data.updatedAtUtc) || obj.updatedAt;
  obj.revokedAt = (data && data.revogadoEmUtc) || null;
  return obj;
}

async function ensureLgpdLoaded(){
  if(STORAGE_ENABLED || lgpdLoaded || lgpdLoading) return;
  lgpdLoading = true;
  try{
    const res = await fetch(LGPD_API_BASE, {
      headers: { "Accept": "application/json" },
      credentials: "same-origin"
    });
    const data = await res.json().catch(() => ({}));
    if(res.ok){
      lgpdCache = mapLgpdResponse(data);
      __lgpdHydratedOnce = false;
    }
  }catch{
  }finally{
    lgpdLoaded = true;
    lgpdLoading = false;
  }
}

async function persistLgpd(obj){
  if(STORAGE_ENABLED){
    try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}
    return obj;
  }

  const body = {
    processarCandidatura: !!obj.candidatura,
    permitirContato: !!obj.contato,
    bancoTalentos: !!obj.bancoTalentos,
    retencaoMeses: obj.retentionMonths ? Number(obj.retentionMonths) : null,
    compartilhamento: mapSharingToApi(obj.sharing),
    dadosSensiveis: !!obj.sensivel,
    comunicacoes: !!obj.comunicacoes
  };

  try{
    const res = await fetch(LGPD_API_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if(res.ok){
      lgpdCache = mapLgpdResponse(payload);
      return lgpdCache;
    }
  }catch{
  }
  return null;
}

function saveLgpd(){
  const obj = loadLgpd() || defaultLgpd();

  obj.candidatura = !!document.getElementById("lgpdCandidatura")?.checked;
  obj.contato = !!document.getElementById("lgpdContato")?.checked;
  obj.bancoTalentos = !!document.getElementById("lgpdBancoTalentos")?.checked;
  obj.retentionMonths = (document.getElementById("lgpdRetention")?.value || "").trim();
  obj.sharing = (document.getElementById("lgpdSharing")?.value || "").trim();
  obj.sensivel = !!document.getElementById("lgpdSensivel")?.checked;
  obj.comunicacoes = !!document.getElementById("lgpdComunicacoes")?.checked;

  obj.updatedAt = new Date().toISOString();

  if(!obj.candidatura){
    obj.revokedAt = new Date().toISOString();
  }else{
    obj.revokedAt = null;
  }

  if(STORAGE_ENABLED){
    try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}
    renderLgpd();
    return;
  }

  persistLgpd(obj).then(() => {
    renderLgpd();
  });
}

let __lgpdHydratedOnce = false;

function hydrateLgpd(){
  if(__lgpdHydratedOnce) return;
  __lgpdHydratedOnce = true;

  const obj = loadLgpd() || defaultLgpd();
  if(STORAGE_ENABLED){
    try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}
  }

  const setCheck = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.checked = !!val;
  };
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if(el) el.value = val ?? "";
  };

  setCheck("lgpdCandidatura", obj.candidatura);
  setCheck("lgpdContato", obj.contato);
  setCheck("lgpdBancoTalentos", obj.bancoTalentos);
  setVal("lgpdRetention", obj.retentionMonths || "");
  setVal("lgpdSharing", obj.sharing || "");
  setCheck("lgpdSensivel", obj.sensivel);
  setCheck("lgpdComunicacoes", obj.comunicacoes);
}

function formatDateTimeBrSafe(iso){
  if(!iso) return "?";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "?";
  return d.toLocaleString("pt-BR");
}

function renderLgpd(){
  if(!STORAGE_ENABLED && !lgpdLoaded){
    if(lgpdLoading) return;
    ensureLgpdLoaded().then(() => renderLgpd());
    return;
  }

  hydrateLgpd();

  const obj = loadLgpd() || defaultLgpd();
  const badge = document.getElementById("lgpdStatusBadge");
  const txt = document.getElementById("lgpdStatusText");
  const last = document.getElementById("lgpdLastUpdated");

  if(last) last.textContent = formatDateTimeBrSafe(obj.updatedAt);

  const active = !!obj.candidatura;
  const score =
    (obj.candidatura?1:0) +
    (obj.contato?1:0) +
    (obj.bancoTalentos?1:0) +
    (obj.sensivel?1:0) +
    (obj.comunicacoes?1:0);

  let statusLabel = "?";
  let statusClass = "badge bg-secondary";
  let statusText = "?";

  if(!active){
    statusLabel = "Revogado";
    statusClass = "badge bg-danger";
    statusText = "Voce revogou os consentimentos em " + formatDateTimeBrSafe(obj.revokedAt) + ".";
  }else{
    if(score >= 4){
      statusLabel = "Ativo";
      statusClass = "badge bg-success";
      statusText = "Voce concedeu consentimentos amplos para o processo e comunicacoes.";
    }else if(score >= 2){
      statusLabel = "Parcial";
      statusClass = "badge bg-primary";
      statusText = "Voce concedeu apenas parte dos consentimentos (ajustavel a qualquer momento).";
    }else{
      statusLabel = "Minimo";
      statusClass = "badge bg-warning text-dark";
      statusText = "Apenas o minimo para participar do processo esta ativo.";
    }
  }

  if(badge){
    badge.className = statusClass + " rounded-pill";
    badge.textContent = statusLabel;
  }
  if(txt) txt.textContent = statusText;

  const lock = !obj.candidatura;

  const toggleDisable = (id, disabled) => {
    const el = document.getElementById(id);
    if(el) el.disabled = !!disabled;
  };

  toggleDisable("lgpdContato", lock);
  toggleDisable("lgpdBancoTalentos", lock);
  toggleDisable("lgpdRetention", lock || !obj.bancoTalentos);
  toggleDisable("lgpdSharing", lock);
  toggleDisable("lgpdSensivel", lock);
  toggleDisable("lgpdComunicacoes", lock);
}

function lgpdRequestAccess(){
  Swal.fire({
    icon:"info",
    title:"Solicitacao de acesso (MVP)",
    html:`<div class="text-start">
      <div class="text-muted">No produto final, isso abriria um chamado para o DPO/RH com protocolo.</div>
      <div class="mt-2"><strong>O que seria entregue:</strong> copia dos dados, finalidades, prazos e compartilhamentos.</div>
    </div>`,
    confirmButtonColor:"#004aad"
  });
}
function lgpdRequestCorrection(){
  Swal.fire({
    icon:"info",
    title:"Solicitacao de correcao (MVP)",
    text:"No produto final, isso enviaria um pedido de correcao de dados ao RH/DPO.",
    confirmButtonColor:"#004aad"
  });
}
function lgpdRequestDeletion(){
  Swal.fire({
    icon:"warning",
    title:"Solicitar exclusao (MVP)",
    text:"No produto final, isso abriria um processo de exclusao (respeitando obrigacoes legais).",
    showCancelButton:true,
    confirmButtonText:"Simular pedido",
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
  }).then(r=>{
    if(!r.isConfirmed) return;
    Swal.fire({ icon:"success", title:"Pedido registrado (simulacao)", text:"Um protocolo seria gerado aqui.", confirmButtonColor:"#004aad" });
  });
}
function lgpdRevokeConsent(){
  Swal.fire({
    icon:"warning",
    title:"Revogar consentimentos?",
    text:"Isso desmarca o consentimento de candidatura e desativa os demais.",
    showCancelButton:true,
    confirmButtonText:"Revogar",
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
  }).then(r=>{
    if(!r.isConfirmed) return;
    const obj = loadLgpd() || defaultLgpd();
    obj.candidatura = false;
    obj.contato = false;
    obj.bancoTalentos = false;
    obj.sensivel = false;
    obj.comunicacoes = false;
    obj.revokedAt = new Date().toISOString();
    obj.updatedAt = new Date().toISOString();
    if(STORAGE_ENABLED){
      try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}
      __lgpdHydratedOnce = false;
      renderLgpd();
      Swal.fire({ icon:"success", title:"Consentimentos revogados", confirmButtonColor:"#004aad" });
      return;
    }

    persistLgpd(obj).then(() => {
      __lgpdHydratedOnce = false;
      renderLgpd();
      Swal.fire({ icon:"success", title:"Consentimentos revogados", confirmButtonColor:"#004aad" });
    });
  });
}

function resetLgpd(){
  Swal.fire({
    icon:"warning",
    title:"Revogar tudo?",
    text:"Isso remove/zera os consentimentos salvos.",
    showCancelButton:true,
    confirmButtonText:"Revogar",
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
  }).then(r=>{
    if(!r.isConfirmed) return;
    if(STORAGE_ENABLED){
      storageRemove(LGPD_STORAGE_KEY);
      __lgpdHydratedOnce = false;
      renderLgpd();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Consentimentos reiniciados.", confirmButtonColor:"#004aad" });
      return;
    }

    const obj = defaultLgpd();
    persistLgpd(obj).then(() => {
      __lgpdHydratedOnce = false;
      renderLgpd();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Consentimentos reiniciados.", confirmButtonColor:"#004aad" });
    });
  });
}

function exportLgpdReceipt(){
  if(STORAGE_ENABLED){
    const obj = loadLgpd() || defaultLgpd();
    const lines = [];
    lines.push("Liotecnica ? Comprovante de Consentimentos (MVP)");
    lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
    lines.push("");
    lines.push("Candidatura: " + (obj.candidatura ? "SIM" : "NAO"));
    lines.push("Contato: " + (obj.contato ? "SIM" : "NAO"));
    lines.push("Banco de Talentos: " + (obj.bancoTalentos ? "SIM" : "NAO"));
    lines.push("Retencao (meses): " + (obj.retentionMonths || "?"));
    lines.push("Compartilhamento: " + (obj.sharing || "?"));
    lines.push("Dados sensiveis (PcD): " + (obj.sensivel ? "SIM" : "NAO"));
    lines.push("Comunicacoes: " + (obj.comunicacoes ? "SIM" : "NAO"));
    lines.push("");
    lines.push("Criado em: " + formatDateTimeBrSafe(obj.createdAt));
    lines.push("Atualizado em: " + formatDateTimeBrSafe(obj.updatedAt));
    lines.push("Revogado em: " + formatDateTimeBrSafe(obj.revokedAt));

    const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "comprovante-lgpd-liotecnica.txt";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
    return;
  }

  fetch(LGPD_RECEIPT_URL, { headers: { "Accept": "application/json" }, credentials: "same-origin" })
    .then(res => res.json().catch(() => ({})))
    .then(payload => {
      const html = payload && payload.html ? payload.html : "";
      if(!html) return;
      const w = window.open("", "_blank");
      if(!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
    });
}


window.renderLgpd = renderLgpd;
window.ensureLgpdLoaded = ensureLgpdLoaded;

// ======================================
