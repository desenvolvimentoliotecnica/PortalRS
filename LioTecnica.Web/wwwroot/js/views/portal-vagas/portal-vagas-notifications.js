// Aba: Notificacoes & Comunicacao
// ======================================
const NOTIFY_STORAGE_KEY = "liotec_portal_notify_v1";
const NOTIFY_API_BASE = "/PortalVagas/Notifications";

let __notifyHydratedOnce = false;
let __notifySaveTimer = null;
let notifyLoaded = false;
let notifyLoading = false;

function defaultNotify(){
  return {
    channels: { email:false, whatsapp:false, sms:false, push:false },
    frequency: "",
    lang: "",
    emailAddr: "",
    phone: "",
    allowContact: false,

    types: {
      newJobs: false,
      appUpdates: false,
      interview: false,
      messages: false,
      docs: false,
      reminders: false
    },

    quiet: {
      enabled: "",
      start: "",
      end: "",
      priority: ""
    },

    signature: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

let notifyCache = defaultNotify();

function loadNotify(){
  if(!STORAGE_ENABLED) return notifyCache;
  try{
    const raw = storageGet(NOTIFY_STORAGE_KEY);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || typeof obj !== "object") return null;

    obj.channels = obj.channels || {};
    obj.types = obj.types || {};
    obj.quiet = obj.quiet || {};
    return obj;
  }catch{
    return null;
  }
}

function saveNotifyToStorage(obj){
  if(!STORAGE_ENABLED){
    notifyCache = obj;
    return;
  }
  try{ storageSet(NOTIFY_STORAGE_KEY, JSON.stringify(obj)); }catch{}
}

function mapNotifyResponse(data){
  const n = defaultNotify();
  if(!data) return n;
  n.channels = {
    email: !!data.canalEmail,
    whatsapp: !!data.canalWhatsapp,
    sms: !!data.canalSms,
    push: !!data.canalPush
  };
  n.frequency = data.frequencia || "";
  n.lang = data.idioma || "";
  n.emailAddr = data.email || "";
  n.phone = data.telefone || "";
  n.allowContact = !!data.permiteContato;
  n.types = {
    newJobs: !!data.alertaNovasVagas,
    appUpdates: !!data.alertaAtualizacoes,
    interview: !!data.alertaEntrevistas,
    messages: !!data.alertaMensagens,
    docs: !!data.alertaDocumentos,
    reminders: !!data.alertaLembretes
  };
  n.quiet = {
    enabled: data.silencioAtivo || "",
    start: data.silencioInicio || "",
    end: data.silencioFim || "",
    priority: data.silencioPrioridade || ""
  };
  n.signature = data.assinatura || "";
  n.updatedAt = data.updatedAtUtc || n.updatedAt;
  return n;
}

async function ensureNotifyLoaded(){
  if(STORAGE_ENABLED || notifyLoaded || notifyLoading) return;
  notifyLoading = true;
  try{
    const res = await fetch(NOTIFY_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if(res.ok){
      notifyCache = mapNotifyResponse(data);
      __notifyHydratedOnce = false;
    }
  }catch{
    // ignore
  }finally{
    notifyLoaded = true;
    notifyLoading = false;
  }
}

async function persistNotifyPreferences(obj){
  if(STORAGE_ENABLED){
    saveNotifyToStorage(obj);
    return obj;
  }

  const body = {
    canalEmail: !!obj.channels?.email,
    canalWhatsapp: !!obj.channels?.whatsapp,
    canalSms: !!obj.channels?.sms,
    canalPush: !!obj.channels?.push,
    frequencia: obj.frequency || "",
    idioma: obj.lang || "",
    email: obj.emailAddr || "",
    telefone: obj.phone || "",
    permiteContato: !!obj.allowContact,
    alertaNovasVagas: !!obj.types?.newJobs,
    alertaAtualizacoes: !!obj.types?.appUpdates,
    alertaEntrevistas: !!obj.types?.interview,
    alertaMensagens: !!obj.types?.messages,
    alertaDocumentos: !!obj.types?.docs,
    alertaLembretes: !!obj.types?.reminders,
    silencioAtivo: obj.quiet?.enabled || "",
    silencioInicio: obj.quiet?.start || "",
    silencioFim: obj.quiet?.end || "",
    silencioPrioridade: obj.quiet?.priority || "",
    assinatura: obj.signature || ""
  };

  try{
    const res = await fetch(NOTIFY_API_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    const payload = await res.json().catch(() => ({}));
    if(res.ok){
      notifyCache = mapNotifyResponse(payload);
      return notifyCache;
    }
  }catch{
    // ignore
  }
  return null;
}

function hydrateNotify(){
  if(__notifyHydratedOnce) return;
  __notifyHydratedOnce = true;

  const n = loadNotify() || defaultNotify();
  saveNotifyToStorage(n);

  const setChk = (id, v)=>{ const el=document.getElementById(id); if(el) el.checked=!!v; };
  const setVal = (id, v)=>{ const el=document.getElementById(id); if(el) el.value=(v ?? ""); };

  setChk("ntEmail", !!n.channels.email);
  setChk("ntWhatsapp", !!n.channels.whatsapp);
  setChk("ntSms", !!n.channels.sms);
  setChk("ntPush", !!n.channels.push);

  setVal("ntFrequency", n.frequency || "");
  setVal("ntLang", n.lang || "");
  setVal("ntEmailAddr", n.emailAddr || "");
  setVal("ntPhone", n.phone || "");
  setChk("ntAllowContact", !!n.allowContact);

  setChk("ntNewJobs", !!n.types.newJobs);
  setChk("ntAppUpdates", !!n.types.appUpdates);
  setChk("ntInterview", !!n.types.interview);
  setChk("ntMessages", !!n.types.messages);
  setChk("ntDocs", !!n.types.docs);
  setChk("ntReminders", !!n.types.reminders);

  setVal("ntQuietEnabled", n.quiet.enabled || "");
  setVal("ntQuietStart", n.quiet.start || "");
  setVal("ntQuietEnd", n.quiet.end || "");
  setVal("ntPriority", n.quiet.priority || "");

  setVal("ntSignature", n.signature || "");

  updateNotifyPreview();
}

function getNotifyFromUI(){
  const chk = (id)=>!!document.getElementById(id)?.checked;
  const val = (id)=> (document.getElementById(id)?.value || "").trim();

  return {
    channels: {
      email: chk("ntEmail"),
      whatsapp: chk("ntWhatsapp"),
      sms: chk("ntSms"),
      push: chk("ntPush")
    },
    frequency: val("ntFrequency"),
    lang: val("ntLang"),
    emailAddr: val("ntEmailAddr"),
    phone: val("ntPhone"),
    allowContact: chk("ntAllowContact"),

    types: {
      newJobs: chk("ntNewJobs"),
      appUpdates: chk("ntAppUpdates"),
      interview: chk("ntInterview"),
      messages: chk("ntMessages"),
      docs: chk("ntDocs"),
      reminders: chk("ntReminders")
    },

    quiet: {
      enabled: val("ntQuietEnabled"),
      start: val("ntQuietStart"),
      end: val("ntQuietEnd"),
      priority: val("ntPriority")
    },

    signature: val("ntSignature")
  };
}

function saveNotify(){
  const existing = loadNotify() || defaultNotify();
  const ui = getNotifyFromUI();

  const merged = {
    ...existing,
    ...ui,
    updatedAt: new Date().toISOString()
  };

  saveNotifyToStorage(merged);
  if(!STORAGE_ENABLED){
    persistNotifyPreferences(merged);
  }
  updateNotifyPreview();
}

function saveNotifyDebounced(){
  clearTimeout(__notifySaveTimer);
  __notifySaveTimer = setTimeout(() => saveNotify(), 250);
}

function updateNotifyPreview(){
  const n = loadNotify() || defaultNotify();
  const el = document.getElementById("ntPreview");
  if(!el) return;

  const channels = [];
  if(n.channels.email) channels.push("E-mail");
  if(n.channels.whatsapp) channels.push("WhatsApp");
  if(n.channels.sms) channels.push("SMS");
  if(n.channels.push) channels.push("Push");

  const types = [];
  if(n.types.newJobs) types.push("Vagas");
  if(n.types.appUpdates) types.push("Status");
  if(n.types.interview) types.push(S.notifications.typeInterviews);
  if(n.types.messages) types.push(S.notifications.typeMessages);
  if(n.types.docs) types.push("Docs");
  if(n.types.reminders) types.push(S.notifications.typeReminders);

  const quiet = (n.quiet.enabled === "Sim")
    ? `Silencio: ${n.quiet.start}ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“${n.quiet.end} (${n.quiet.priority})`
    : "Sem silencio";

  el.textContent = `${channels.join(", ") || "Nenhum canal"} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ${n.frequency} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ${types.join(", ") || "Sem alertas"} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ${quiet}`;
}

async function testNotify(){
  if(!STORAGE_ENABLED && !notifyLoaded){
    await ensureNotifyLoaded();
  }
  hydrateNotify();
  const n = loadNotify() || defaultNotify();

  const channels = [];
  if(n.channels.email) channels.push("E-mail");
  if(n.channels.whatsapp) channels.push("WhatsApp");
  if(n.channels.sms) channels.push("SMS");
  if(n.channels.push) channels.push("Push");

  const quietOn = n.quiet.enabled === "Sim";

  Swal.fire({
    icon: "info",
    title: "Teste de notificacao (simulado)",
    html: `
      <div class="text-start">
        <div class="text-muted small mb-2">Canais ativos:</div>
        <div class="fw-bold mb-2">${escapeHtml(channels.join(", ") || "Nenhum")}</div>

        <div class="text-muted small mb-2">Frequencia:</div>
        <div class="fw-bold mb-2">${escapeHtml(n.frequency)}</div>

        <div class="text-muted small mb-2">Horario silencioso:</div>
        <div class="fw-bold">${escapeHtml(quietOn ? `${n.quiet.start}ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“${n.quiet.end} (${n.quiet.priority})` : "Desativado")}</div>

        <hr>

        <div class="text-muted small">Exemplo:</div>
        <div class="p-3 border rounded" style="border-radius:14px;background:#f8f9fa;">
          <div class="fw-bold">Atualizacao de candidatura</div>
          <div class="small text-muted">Sua candidatura avancou para <strong>Entrevista</strong>.</div>
          ${n.signature ? `<div class="small text-muted mt-2">${escapeHtml(n.signature)}</div>` : ""}
        </div>
      </div>
    `,
    confirmButtonText: S.notifications.ok,
    confirmButtonColor: "#004aad"
  });
}

async function seedNotify(){
  if(!STORAGE_ENABLED && !notifyLoaded){
    await ensureNotifyLoaded();
  }

  const existing = loadNotify();
  if(existing && (existing.emailAddr || existing.phone || existing.updatedAt)){
    const hasAny = (existing.emailAddr || "").trim() || (existing.phone || "").trim();
    const hasPrefs = existing && existing.channels && (existing.channels.sms || existing.channels.push);
    if(hasAny || hasPrefs){
      Swal.fire({ icon:"info", title:"Ja existe conteudo", text:"Limpe antes para inserir exemplo.", confirmButtonColor:"#004aad" });
      return;
    }
  }

  const n = defaultNotify();
  n.channels = { email:true, whatsapp:true, sms:false, push:false };
  n.frequency = "Imediato";
  n.lang = "pt-BR";
  n.emailAddr = "candidato@email.com";
  n.phone = "11 99999-9999";
  n.allowContact = true;
  n.types = { newJobs:true, appUpdates:true, interview:true, messages:true, docs:true, reminders:true };
  n.quiet = { enabled:"Sim", start:"22:00", end:"07:00", priority:"Normal" };
  n.signature = "Obrigado! ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â (Seu nome)";
  n.updatedAt = new Date().toISOString();

  if(STORAGE_ENABLED){
    saveNotifyToStorage(n);
  }else{
    notifyCache = n;
    await persistNotifyPreferences(notifyCache);
  }
  __notifyHydratedOnce = false;
  renderNotify();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetNotify(){
  Swal.fire({
    icon:"warning",
    title: S.notifications.clearTitle,
    text:"Isso apaga as preferencias desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText: S.common.clear,
    confirmButtonColor:"#004aad",
    cancelButtonText: S.common.cancel
  }).then(async r=>{
    if(!r.isConfirmed) return;
    if(STORAGE_ENABLED){
      storageRemove(NOTIFY_STORAGE_KEY);
    }else{
      notifyCache = defaultNotify();
      await persistNotifyPreferences(notifyCache);
    }
    __notifyHydratedOnce = false;
    renderNotify();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Preferencias limpas.", confirmButtonColor:"#004aad" });
  });
}

function downloadNotifySummary(){
  const n = loadNotify() || defaultNotify();

  const channels = [];
  if(n.channels.email) channels.push("E-mail");
  if(n.channels.whatsapp) channels.push("WhatsApp");
  if(n.channels.sms) channels.push("SMS");
  if(n.channels.push) channels.push("Push");

  const types = [];
  if(n.types.newJobs) types.push(S.notifications.typeNewJobs);
  if(n.types.appUpdates) types.push("Atualizacao de status");
  if(n.types.interview) types.push(S.notifications.typeInterviews);
  if(n.types.messages) types.push("Mensagens do RH");
  if(n.types.docs) types.push(S.notifications.typeDocs);
  if(n.types.reminders) types.push(S.notifications.typeReminders);

  const lines = [];
  lines.push("Liotecnica ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Resumo Notificacoes & Comunicacao (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  lines.push("Canais:");
  lines.push("- Ativos: " + (channels.join(", ") || "Nenhum"));
  lines.push("- Frequencia: " + (n.frequency || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("- Idioma: " + (n.lang || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("- E-mail: " + (n.emailAddr || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("- Telefone: " + (n.phone || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("- Autorizo contato (operacional): " + (n.allowContact ? S.notifications.allowContactYes : S.notifications.allowContactNo));
  lines.push("");

  lines.push("Tipos de alerta:");
  lines.push("- " + (types.join(", ") || "Nenhum"));
  lines.push("");

  lines.push("Horario silencioso:");
  lines.push("- Ativo: " + (n.quiet.enabled || S.notifications.quietActiveFallback));
  lines.push("- Inicio: " + (n.quiet.start || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("- Fim: " + (n.quiet.end || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("- Prioridade: " + (n.quiet.priority || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));
  lines.push("");

  lines.push("Assinatura:");
  lines.push("- " + (n.signature || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"));

  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const dl = document.createElement("a");
  dl.href = URL.createObjectURL(blob);
  dl.download = "notificacoes-comunicacao-liotecnica.txt";
  document.body.appendChild(dl);
  dl.click();
  URL.revokeObjectURL(dl.href);
  dl.remove();
}

function renderNotify(){
  if(!STORAGE_ENABLED && !notifyLoaded){
    ensureNotifyLoaded().then(() => renderNotify());
    return;
  }
  hydrateNotify();
  updateNotifyPreview();
}

if (typeof window !== "undefined") {
  window.renderNotify = renderNotify;
  window.ensureNotifyLoaded = ensureNotifyLoaded;
}

(function normalizePortalStorage(){
  const keys = [
    "liotec_portal_tests_v1",
    "liotec_portal_exp_proj_v1",
    "liotec_portal_skills_portf_v1",
    "liotec_portal_education_v1",
    "liotec_portal_lgpd_v1",
    "liotec_portal_preferences_v1",
    "liotec_portal_docs_v1",
    "liotec_portal_refs_v1",
    "liotec_portal_a11y_v1",
    "liotec_portal_agenda_v1",
    "liotec_portal_apps_history_v1",
    "liotec_portal_notify_v1"
  ];
  keys.forEach(normalizeStorageKey);
})();

document.addEventListener("DOMContentLoaded", () => {
  loadProfileAvatar();
  const nameInput = document.getElementById("profileName");
  if(nameInput){
    nameInput.addEventListener("input", () => {
      const stored = storageGet(PROFILE_AVATAR_STORAGE_KEY);
      if(!stored) setProfileAvatar("");
      syncProfileAvatarMeta();
    });
  }
});

