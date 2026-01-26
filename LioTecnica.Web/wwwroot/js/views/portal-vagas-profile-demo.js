// Profile modal demo helpers (from teste-portal-vagas003.html)
function normalizeText(value){
  if(typeof value !== "string") return value;
  let out = value;
  if(out.includes("\\u")){
    out = out.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  if(/[\u00C3\u00C2\u00E2]/.test(out)){
    try{ out = decodeURIComponent(escape(out)); }catch{}
  }
  return out;
}

function normalizeData(value){
  if(value === null || value === undefined) return value;
  if(typeof value === "string") return normalizeText(value);
  if(Array.isArray(value)) return value.map(normalizeData);
  if(typeof value === "object"){
    Object.keys(value).forEach((key) => {
      value[key] = normalizeData(value[key]);
    });
  }
  return value;
}

const STORAGE_ENABLED = false;
const memoryStorage = new Map();
const storageGet = (key) => {
  if(STORAGE_ENABLED) return localStorage.getItem(key);
  return memoryStorage.has(key) ? memoryStorage.get(key) : null;
};
const storageSet = (key, value) => {
  if(STORAGE_ENABLED){
    try{ localStorage.setItem(key, value); }catch{}
    return;
  }
  memoryStorage.set(key, value);
};
const storageRemove = (key) => {
  if(STORAGE_ENABLED){
    localStorage.removeItem(key);
    return;
  }
  memoryStorage.delete(key);
};

function normalizeStorageKey(key){
  if(!STORAGE_ENABLED) return;
  try{
    const raw = storageGet(key);
    if(!raw || (!raw.includes("\\u") && !/[\\u00C3\\u00C2\\u00E2]/.test(raw))) return;
    const parsed = JSON.parse(raw);
    const normalized = normalizeData(parsed);
    storageSet(key, JSON.stringify(normalized));
  }catch{}
}

const PROFILE_AVATAR_STORAGE_KEY = "liotec_portal_profile_avatar_v1";

function getProfileInitials(){
  const name = (document.getElementById("profileName")?.value || "").trim();
  if(!name) return "U";
  const parts = name.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] || "" : "";
  return (first + last).toUpperCase() || "U";
}

function syncProfileAvatarMeta(){
  const nameInput = document.getElementById("profileName");
  const nameLabel = document.getElementById("profileAvatarName");
  if(nameInput && nameLabel){
    const value = nameInput.value.trim();
    nameLabel.textContent = value || "";
  }
}

function setProfileAvatar(src){
  const img = document.getElementById("profileAvatarImg");
  const fallback = document.getElementById("profileAvatarFallback");
  if(!img || !fallback) return;
  syncProfileAvatarMeta();
  if(src){
    img.src = src;
    img.style.display = "block";
    fallback.style.display = "none";
  }else{
    img.removeAttribute("src");
    img.style.display = "none";
    fallback.textContent = getProfileInitials();
    fallback.style.display = "inline";
  }
}

function updateProfileAvatar(input){
  if(!STORAGE_ENABLED) return;
  const file = input?.files?.[0];
  if(!file){
    setProfileAvatar("");
    storageRemove(PROFILE_AVATAR_STORAGE_KEY);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = String(reader.result || "");
    setProfileAvatar(dataUrl);
    try{ storageSet(PROFILE_AVATAR_STORAGE_KEY, dataUrl); }catch{}
  };
  reader.readAsDataURL(file);
}

function loadProfileAvatar(){
  if(!STORAGE_ENABLED) return;
  const stored = storageGet(PROFILE_AVATAR_STORAGE_KEY) || "";
  setProfileAvatar(stored);
}
  // Testes de RH (Aba "Testes")
  // =========================
  const RH_TESTS_STORAGE_KEY = "liotec_portal_rh_tests_v1";

  const defaultRhTests = [
    { id: "disc",  name: "DISC",      icon: "fa-chart-pie",      desc: "Estilo comportamental (Dominância, Influência, Estabilidade e Conformidade).", duration: "10–12 min", status: "Não iniciado", lastDone: null, score: null },
    { id: "ocean", name: "Big Five",  icon: "fa-wave-square",    desc: "Traços de personalidade (OCEAN: Abertura, Conscienciosidade, Extroversão, Amabilidade, Neuroticismo).", duration: "12–15 min", status: "Não iniciado", lastDone: null, score: null },
    { id: "mbti",  name: "MBTI",      icon: "fa-compass",        desc: "Preferências cognitivas e de interação (16 tipos).", duration: "10–14 min", status: "Não iniciado", lastDone: null, score: null },
    { id: "sjt",   name: "SJT",       icon: "fa-people-arrows",  desc: "Situações do dia a dia e tomada de decisão no trabalho.", duration: "8–10 min", status: "Não iniciado", lastDone: null, score: null },
    { id: "logic", name: "Raciocínio",icon: "fa-brain",          desc: "Raciocínio lógico e atenção a detalhes (curto).", duration: "6–8 min", status: "Não iniciado", lastDone: null, score: null }
  ];

  function loadRhTests(){
    try{
      const raw = storageGet(RH_TESTS_STORAGE_KEY);
      if(!raw) return structuredClone(defaultRhTests);
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed) || parsed.length === 0) return structuredClone(defaultRhTests);

      const map = new Map(parsed.map(t => [t.id, t]));
      return defaultRhTests.map(d => ({ ...d, ...(map.get(d.id) || {}) }));
    }catch{
      return structuredClone(defaultRhTests);
    }
  }

  function saveRhTests(list){
    try{ storageSet(RH_TESTS_STORAGE_KEY, JSON.stringify(list)); }catch{}
  }

  function formatDateTimeBr(iso){
    if(!iso) return "—";
    const d = new Date(iso);
    if(isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  }

  function statusBadgeClass(status){
    if(status === "Concluído") return "badge-done";
    if(status === "Em andamento") return "badge-soft";
    return "badge-neutral";
  }

  function renderRhTests(){
    const host = document.getElementById("testsContainer");
    if(!host) return;

    const list = loadRhTests();
    saveRhTests(list);

    host.innerHTML = "";

    list.forEach(t => {
      const canView = t.status === "Concluído" && t.score !== null;

      const badgeCls = statusBadgeClass(t.status);
      const scoreTxt = (t.score === null) ? "—" : `${t.score}%`;
      const lastTxt = formatDateTimeBr(t.lastDone);

      host.innerHTML += `
        <div class="test-card">
          <div class="test-ico">
            <i class="fas ${t.icon}"></i>
          </div>

          <div class="flex-grow-1" style="min-width:220px;">
            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div class="fw-bold" style="font-size:1.02rem;">${t.name}</div>
              <span class="badge ${badgeCls} rounded-pill">${t.status}</span>
            </div>

            <div class="test-meta mt-1">
              <span class="me-3"><i class="far fa-clock me-1"></i>${t.duration}</span>
              <span><i class="far fa-calendar-check me-1"></i>Última vez: ${lastTxt}</span>
            </div>

            <div class="text-muted small mt-2" style="line-height:1.4;">${t.desc}</div>

            <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3">
              <div class="small">
                <span class="text-muted">Resultado:</span>
                <span class="fw-bold text-primary">${scoreTxt}</span>
              </div>

              <div class="d-flex gap-2">
                ${canView ? `<button class="btn btn-sm btn-outline-secondary fw-bold" type="button" onclick="viewTestResult('${t.id}')">
                  <i class="fas fa-eye me-1"></i> Ver resultado
                </button>` : ``}

                <button class="btn btn-sm btn-primary fw-bold" type="button" onclick="startTest('${t.id}')">
                  <i class="fas fa-play me-1"></i> ${t.status === "Concluído" ? "Refazer" : "Iniciar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    });
  }

  function updateTest(id, patch){
    const list = loadRhTests();
    const idx = list.findIndex(t => t.id === id);
    if(idx >= 0){
      list[idx] = { ...list[idx], ...patch };
      saveRhTests(list);
    }
    renderRhTests();
  }

  async function startTest(id){
    const list = loadRhTests();
    const t = list.find(x => x.id === id);
    if(!t) return;

    const steps = [
      { title: `${t.name} — Instruções`, text: "Responda com sinceridade. Não existe certo ou errado. (Simulação MVP)", icon: "info" },
      { title: `${t.name} — Iniciando`, text: "Preparando perguntas...", icon: "question" }
    ];

    for(const s of steps){
      const r = await Swal.fire({
        title: s.title,
        text: s.text,
        icon: s.icon,
        confirmButtonText: "Continuar",
        confirmButtonColor: "#004aad"
      });
      if(!r.isConfirmed) return;
    }

    updateTest(id, { status: "Em andamento" });

    let progress = 0;
    await Swal.fire({
      title: "Respondendo...",
      html: `<div class="text-muted small mb-2">Simulando perguntas do teste...</div>
             <div class="progress" style="height:10px;border-radius:999px;">
               <div id="swalProg" class="progress-bar bg-primary" style="width:0%"></div>
             </div>
             <div class="small text-muted mt-2"><span id="swalProgTxt">0%</span></div>`,
      showConfirmButton: false,
      allowOutsideClick: false,
      didOpen: () => {
        const bar = document.getElementById("swalProg");
        const txt = document.getElementById("swalProgTxt");
        const timer = setInterval(() => {
          progress += Math.floor(Math.random() * 14) + 8;
          if(progress > 100) progress = 100;
          if(bar) bar.style.width = progress + "%";
          if(txt) txt.innerText = progress + "%";
          if(progress >= 100){
            clearInterval(timer);
            setTimeout(() => Swal.close(), 250);
          }
        }, 220);
      }
    });

    const score = Math.max(55, Math.min(98, Math.floor(60 + Math.random() * 40)));
    updateTest(id, { status: "Concluído", lastDone: new Date().toISOString(), score });

    Swal.fire({
      icon: "success",
      title: `${t.name} concluído!`,
      html: `<div class="text-muted">Resultado consolidado:</div>
             <div class="display-6 fw-bold text-primary mt-1">${score}%</div>
             <div class="small text-muted mt-2">No produto final, aqui entrariam insights detalhados e recomendações.</div>`,
      confirmButtonText: "Ok",
      confirmButtonColor: "#004aad"
    });
  }

  function viewTestResult(id){
    const list = loadRhTests();
    const t = list.find(x => x.id === id);
    if(!t) return;

    const scoreTxt = (t.score === null) ? "—" : `${t.score}%`;
    const lastTxt = formatDateTimeBr(t.lastDone);

    Swal.fire({
      title: `${t.name} — Resultado`,
      icon: "info",
      html: `
        <div class="text-start">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="text-muted small">Última vez</div>
            <div class="small fw-bold">${lastTxt}</div>
          </div>
          <div class="p-3 border rounded" style="border-radius:14px;background:#f8f9fa;">
            <div class="text-muted small">Pontuação (demo)</div>
            <div class="h3 fw-bold text-primary mb-0">${scoreTxt}</div>
          </div>
          <div class="small text-muted mt-3">
            <strong>Observação:</strong> este é um protótipo. Em produção, o relatório exibiria subfatores, gráficos e histórico.
          </div>
        </div>
      `,
      confirmButtonText: "Fechar",
      confirmButtonColor: "#004aad"
    });
  }

  function resetAllTests(){
    Swal.fire({
      title: "Reiniciar testes?",
      text: "Isso apaga os resultados salvos neste navegador.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Reiniciar",
      confirmButtonColor: "#004aad",
      cancelButtonText: "Cancelar"
    }).then((r) => {
      if(!r.isConfirmed) return;
      storageRemove(RH_TESTS_STORAGE_KEY);
      renderRhTests();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Testes reiniciados.", confirmButtonColor:"#004aad" });
    });
  }

  function downloadTestsSummary(){
    const list = loadRhTests();
    const lines = [];
    lines.push("Liotécnica — Resumo de Testes (MVP)");
    lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
    lines.push("");
    list.forEach(t => {
      lines.push(`${t.name}: ${t.status} | Resultado: ${(t.score===null?'—':t.score+'%')} | Última vez: ${formatDateTimeBr(t.lastDone)}`);
    });

    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "resumo-testes-liotecnica.txt";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  }


  // =======================================
  // Corrigir "voltar de aba" ao abrir editor
  // =======================================
  // (em vez de forçar sempre a aba Perfil, preserva a última aba ativa)
  let __lastProfileTabSelector = "#tabProfile";

  document.getElementById("profileTabs")?.addEventListener("shown.bs.tab", (e) => {
    const target = e.target?.getAttribute("data-bs-target");
    if (target) __lastProfileTabSelector = target;
  });

document.getElementById("profileModal")?.addEventListener("shown.bs.modal", () => {
  try{
    const btn = document.querySelector(`#profileTabs button[data-bs-target="${__lastProfileTabSelector}"]`);
    if(btn) new bootstrap.Tab(btn).show();
  }catch{}

  if (typeof renderRhTests === "function") renderRhTests();
  if (typeof renderExperienceProjects === "function") renderExperienceProjects();
  if (typeof renderSkillsPortfolio === "function") renderSkillsPortfolio();
  if (typeof renderEducation === "function") renderEducation();
  if (typeof renderLgpd === "function") renderLgpd();
  if (typeof renderPreferences === "function") renderPreferences();
  if (typeof renderDocuments === "function") renderDocuments();
  if (typeof renderReferences === "function") renderReferences();
  if (typeof renderA11y === "function") renderA11y();
  if (typeof renderAgenda === "function") renderAgenda();
  if (typeof renderApps === "function") renderApps();
  if (typeof renderNotify === "function") renderNotify();
  if (typeof ensureTagRemoval === "function") ensureTagRemoval();

});



  // =========================
  // Aba: Experiência & Projetos (Drop-in)
  // =========================
  const EXP_PROJ_STORAGE_KEY = "liotec_portal_exp_proj_v1";
  const EXP_PROJ_API_BASE = "/PortalVagas/ExperienceProjects";
  const EXP_API_BASE = "/PortalVagas/Experiences";
  const PROJ_API_BASE = "/PortalVagas/Projects";

  let expProjCache = { experiences: [], projects: [] };
  let expProjLoaded = false;
  let expProjLoading = false;

  function loadExpProj(){
    if(!STORAGE_ENABLED) return expProjCache;
    try{
      const raw = storageGet(EXP_PROJ_STORAGE_KEY);
      if(!raw) return { experiences: [], projects: [] };
      const obj = JSON.parse(raw);
      return {
        experiences: Array.isArray(obj.experiences) ? obj.experiences : [],
        projects: Array.isArray(obj.projects) ? obj.projects : []
      };
    }catch{
      return { experiences: [], projects: [] };
    }
  }
  function saveExpProj(data){
    if(!STORAGE_ENABLED){
      expProjCache = data;
      return;
    }
    try{ storageSet(EXP_PROJ_STORAGE_KEY, JSON.stringify(data)); }catch{}
  }

  function mapExpProjResponse(data){
    return {
      experiences: (data?.experiences || []).map(e => ({
        id: e.id,
        company: e.empresa || "",
        role: e.cargo || "",
        start: e.inicio || "",
        end: e.fim || "",
        place: e.local || "",
        bullets: (e.atividades || "").split("\n").map(x => x.trim()).filter(Boolean),
        updatedAt: ""
      })),
      projects: (data?.projects || []).map(p => ({
        id: p.id,
        name: p.nome || "",
        period: p.periodo || "",
        desc: p.descricao || "",
        link: p.link || "",
        stack: (p.stack || "").split(",").map(x => x.trim()).filter(Boolean),
        highlights: (p.destaques || "").split("\n").map(x => x.trim()).filter(Boolean),
        updatedAt: ""
      }))
    };
  }

  async function ensureExpProjLoaded(){
    if(STORAGE_ENABLED || expProjLoaded || expProjLoading) return;
    expProjLoading = true;
    try{
      const res = await fetch(EXP_PROJ_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if(res.ok){
        expProjCache = mapExpProjResponse(data);
      }
    }catch{
      // ignore
    }finally{
      expProjLoaded = true;
      expProjLoading = false;
    }
  }

  async function persistExperience(exp){
    if(STORAGE_ENABLED){
      const data = loadExpProj();
      const idx = data.experiences.findIndex(x => x.id === exp.id);
      if(idx >= 0) data.experiences[idx] = exp;
      else data.experiences.push(exp);
      saveExpProj(data);
      return exp;
    }

    const body = {
      empresa: exp.company || "",
      cargo: exp.role || "",
      inicio: exp.start || "",
      fim: exp.end || "",
      local: exp.place || "",
      atividades: (exp.bullets || []).join("\n")
    };

    const isUpdate = !!exp.id && expProjCache.experiences.some(x => x.id === exp.id);
    const url = isUpdate ? `${EXP_API_BASE}/${exp.id}` : EXP_API_BASE;
    const method = isUpdate ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    if(!res.ok) return null;
    const payload = await res.json().catch(() => ({}));

    const saved = {
      id: payload.id,
      company: payload.empresa || "",
      role: payload.cargo || "",
      start: payload.inicio || "",
      end: payload.fim || "",
      place: payload.local || "",
      bullets: (payload.atividades || "").split("\n").map(x => x.trim()).filter(Boolean),
      updatedAt: ""
    };

    const idx = expProjCache.experiences.findIndex(x => x.id === saved.id);
    if(idx >= 0) expProjCache.experiences[idx] = saved;
    else expProjCache.experiences.push(saved);
    return saved;
  }

  async function removeExperience(id){
    if(STORAGE_ENABLED){
      const data = loadExpProj();
      data.experiences = data.experiences.filter(x => x.id !== id);
      saveExpProj(data);
      return true;
    }

    const res = await fetch(`${EXP_API_BASE}/${id}`, { method: "DELETE", credentials: "same-origin" });
    if(!res.ok) return false;
    expProjCache.experiences = expProjCache.experiences.filter(x => x.id !== id);
    return true;
  }

  async function persistProject(proj){
    if(STORAGE_ENABLED){
      const data = loadExpProj();
      const idx = data.projects.findIndex(x => x.id === proj.id);
      if(idx >= 0) data.projects[idx] = proj;
      else data.projects.push(proj);
      saveExpProj(data);
      return proj;
    }

    const body = {
      nome: proj.name || "",
      periodo: proj.period || "",
      descricao: proj.desc || "",
      link: proj.link || "",
      stack: (proj.stack || []).join(", "),
      destaques: (proj.highlights || []).join("\n")
    };

    const isUpdate = !!proj.id && expProjCache.projects.some(x => x.id === proj.id);
    const url = isUpdate ? `${PROJ_API_BASE}/${proj.id}` : PROJ_API_BASE;
    const method = isUpdate ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body)
    });
    if(!res.ok) return null;
    const payload = await res.json().catch(() => ({}));

    const saved = {
      id: payload.id,
      name: payload.nome || "",
      period: payload.periodo || "",
      desc: payload.descricao || "",
      link: payload.link || "",
      stack: (payload.stack || "").split(",").map(x => x.trim()).filter(Boolean),
      highlights: (payload.destaques || "").split("\n").map(x => x.trim()).filter(Boolean),
      updatedAt: ""
    };

    const idx = expProjCache.projects.findIndex(x => x.id === saved.id);
    if(idx >= 0) expProjCache.projects[idx] = saved;
    else expProjCache.projects.push(saved);
    return saved;
  }

  async function removeProject(id){
    if(STORAGE_ENABLED){
      const data = loadExpProj();
      data.projects = data.projects.filter(x => x.id !== id);
      saveExpProj(data);
      return true;
    }

    const res = await fetch(`${PROJ_API_BASE}/${id}`, { method: "DELETE", credentials: "same-origin" });
    if(!res.ok) return false;
    expProjCache.projects = expProjCache.projects.filter(x => x.id !== id);
    return true;
  }

  function uid(){
    return "id_" + Math.random().toString(16).slice(2) + "_" + Date.now().toString(16);
  }

  function openExperienceModal(expId){
    const m = new bootstrap.Modal(document.getElementById("experienceEditModal"));
    const data = loadExpProj();
    const exp = expId ? data.experiences.find(x => x.id === expId) : null;

    document.getElementById("expId").value = exp?.id || "";
    document.getElementById("expCompany").value = exp?.company || "";
    document.getElementById("expRole").value = exp?.role || "";
    document.getElementById("expStart").value = exp?.start || "";
    document.getElementById("expEnd").value = exp?.end || "";
    document.getElementById("expPlace").value = exp?.place || "";
    document.getElementById("expBullets").value = (exp?.bullets || []).join("\n");

    m.show();
  }

  async function saveExperience(){
    const id = (document.getElementById("expId").value || "").trim() || uid();

    const company = document.getElementById("expCompany").value.trim();
    const role    = document.getElementById("expRole").value.trim();

    if(!company || !role){
      Swal.fire({ icon:"warning", title:"Faltou algo", text:"Informe pelo menos Empresa e Cargo.", confirmButtonColor:"#004aad" });
      return;
    }

    const start = document.getElementById("expStart").value.trim();
    const end   = document.getElementById("expEnd").value.trim();
    const place = document.getElementById("expPlace").value.trim();
    const bullets = document.getElementById("expBullets").value
      .split("\n")
      .map(x => x.trim())
      .filter(Boolean);

    const payload = { id, company, role, start, end, place, bullets, updatedAt: new Date().toISOString() };
    const saved = await persistExperience(payload);
    if(!saved){
      Swal.fire({ icon:"error", title:"Erro ao salvar", text:"Nao foi possivel salvar a experiencia.", confirmButtonColor:"#004aad" });
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById("experienceEditModal"))?.hide();
    renderExperienceProjects();

    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Experiência salva", showConfirmButton:false, timer:2200 });
  }

  function deleteExperience(id){
    Swal.fire({
      title:"Remover experiência?",
      text:"Isso apaga do seu perfil (neste protótipo).",
      icon:"warning",
      showCancelButton:true,
      confirmButtonText:"Remover",
      confirmButtonColor:"#004aad",
      cancelButtonText:"Cancelar"
    }).then(r=>{
      if(!r.isConfirmed) return;
      Promise.resolve(removeExperience(id)).then(ok => {
        if(!ok){
          Swal.fire({ icon:"error", title:"Erro ao remover", text:"Nao foi possivel remover a experiencia.", confirmButtonColor:"#004aad" });
          return;
        }
        renderExperienceProjects();
      });
    });
  }

  function openProjectModal(projId){
    const m = new bootstrap.Modal(document.getElementById("projectEditModal"));
    const data = loadExpProj();
    const p = projId ? data.projects.find(x => x.id === projId) : null;

    document.getElementById("projId").value = p?.id || "";
    document.getElementById("projName").value = p?.name || "";
    document.getElementById("projPeriod").value = p?.period || "";
    document.getElementById("projDesc").value = p?.desc || "";
    document.getElementById("projLink").value = p?.link || "";
    document.getElementById("projStack").value = (p?.stack || []).join(", ");
    document.getElementById("projHighlights").value = (p?.highlights || []).join("\n");

    m.show();
  }

  async function saveProject(){
    const id = (document.getElementById("projId").value || "").trim() || uid();

    const name = document.getElementById("projName").value.trim();
    if(!name){
      Swal.fire({ icon:"warning", title:"Faltou o nome", text:"Informe o nome do projeto.", confirmButtonColor:"#004aad" });
      return;
    }

    const period = document.getElementById("projPeriod").value.trim();
    const desc = document.getElementById("projDesc").value.trim();
    const link = document.getElementById("projLink").value.trim();
    const stack = document.getElementById("projStack").value.split(",").map(x=>x.trim()).filter(Boolean);
    const highlights = document.getElementById("projHighlights").value.split("\n").map(x=>x.trim()).filter(Boolean);

    const payload = { id, name, period, desc, link, stack, highlights, updatedAt: new Date().toISOString() };
    const saved = await persistProject(payload);
    if(!saved){
      Swal.fire({ icon:"error", title:"Erro ao salvar", text:"Nao foi possivel salvar o projeto.", confirmButtonColor:"#004aad" });
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById("projectEditModal"))?.hide();
    renderExperienceProjects();

    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Projeto salvo", showConfirmButton:false, timer:2200 });
  }

  function deleteProject(id){
    Swal.fire({
      title:"Remover projeto?",
      text:"Isso apaga do seu perfil (neste protótipo).",
      icon:"warning",
      showCancelButton:true,
      confirmButtonText:"Remover",
      confirmButtonColor:"#004aad",
      cancelButtonText:"Cancelar"
    }).then(r=>{
      if(!r.isConfirmed) return;
      Promise.resolve(removeProject(id)).then(ok => {
        if(!ok){
          Swal.fire({ icon:"error", title:"Erro ao remover", text:"Nao foi possivel remover o projeto.", confirmButtonColor:"#004aad" });
          return;
        }
        renderExperienceProjects();
      });
    });
  }

  function renderExperienceProjects(){
    const expList = document.getElementById("expList");
    const projList = document.getElementById("projList");
    const expEmpty = document.getElementById("expEmpty");
    const projEmpty = document.getElementById("projEmpty");
    const expCount = document.getElementById("expCount");
    const projCount = document.getElementById("projCount");

    if(!expList || !projList) return;

    if(!STORAGE_ENABLED && !expProjLoaded){
      ensureExpProjLoaded().then(() => renderExperienceProjects());
      return;
    }

    const data = loadExpProj();
    expCount && (expCount.textContent = data.experiences.length);
    projCount && (projCount.textContent = data.projects.length);

    if(!STORAGE_ENABLED && !skillsPortfLoaded){
      ensureSkillsPortfolioLoaded().then(() => renderTechTags());
    }else{
      renderTechTags();
    }

    // Experiências
    expList.innerHTML = "";
    if(data.experiences.length === 0){
      expEmpty && (expEmpty.style.display = "block");
    }else{
      expEmpty && (expEmpty.style.display = "none");
      data.experiences.forEach(e => {
        const period = [e.start || "—", e.end || "—"].join(" • ");
        const bullets = (e.bullets||[]).slice(0,3).map(b=>`<li class="small text-muted mb-1">${escapeHtml(b)}</li>`).join("");
        expList.innerHTML += `
          <div class="border rounded p-3" style="border-radius:14px;">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-bold">${escapeHtml(e.role)} <span class="text-muted">•</span> ${escapeHtml(e.company)}</div>
                <div class="small text-muted mt-1">
                  <i class="far fa-calendar-alt me-1"></i>${escapeHtml(period)}
                  ${e.place ? `<span class="ms-2"><i class="fas fa-map-marker-alt me-1"></i>${escapeHtml(e.place)}</span>` : ""}
                </div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" type="button" onclick="openExperienceModal('${e.id}')">
                  <i class="fas fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteExperience('${e.id}')">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            ${bullets ? `<ul class="mt-3 mb-0 ps-3">${bullets}</ul>` : `<div class="small text-muted mt-3">Sem detalhes ainda.</div>`}
          </div>
        `;
      });
    }

    // Projetos
    projList.innerHTML = "";
    if(data.projects.length === 0){
      projEmpty && (projEmpty.style.display = "block");
    }else{
      projEmpty && (projEmpty.style.display = "none");
      data.projects.forEach(p => {
        const stacks = (p.stack||[]).slice(0,6).map(s=>`<span class="badge rounded-pill text-bg-dark me-1 mb-1">${escapeHtml(s)}</span>`).join("");
        const highlights = (p.highlights||[]).slice(0,2).map(h=>`<li class="small text-muted mb-1">${escapeHtml(h)}</li>`).join("");
        projList.innerHTML += `
          <div class="col-12">
            <div class="border rounded p-3 h-100" style="border-radius:14px;">
              <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                  <div class="fw-bold">${escapeHtml(p.name)} ${p.period ? `<span class="text-muted small">• ${escapeHtml(p.period)}</span>` : ""}</div>
                  ${p.desc ? `<div class="small text-muted mt-1">${escapeHtml(p.desc)}</div>` : ""}
                </div>
                <div class="d-flex gap-2">
                  <button class="btn btn-sm btn-outline-primary" type="button" onclick="openProjectModal('${p.id}')"><i class="fas fa-pen"></i></button>
                  <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteProject('${p.id}')"><i class="fas fa-trash"></i></button>
                </div>
              </div>

              ${stacks ? `<div class="mt-2">${stacks}</div>` : ""}

              ${highlights ? `<ul class="mt-3 mb-0 ps-3">${highlights}</ul>` : ""}

              <div class="d-flex flex-wrap gap-2 mt-3">
                ${p.link ? `<a class="btn btn-sm btn-outline-secondary fw-bold" href="${escapeAttr(p.link)}" target="_blank" rel="noopener">
                  <i class="fas fa-link me-1"></i> Abrir link
                </a>` : `<button class="btn btn-sm btn-outline-secondary fw-bold" type="button" onclick="Swal.fire('Sem link', 'Adicione um link do GitHub/Demo no projeto.', 'info')">
                  <i class="fas fa-link me-1"></i> Sem link
                </button>`}
              </div>
            </div>
          </div>
        `;
      });
    }
  }

  async function seedExperiences(){
    if(!STORAGE_ENABLED && !expProjLoaded){
      await ensureExpProjLoaded();
    }
    const data = loadExpProj();
    if(data.experiences.length > 0){
      Swal.fire({ icon:"info", title:"Ja existe conteudo", text:"Remova as experiencias atuais para inserir exemplos.", confirmButtonColor:"#004aad" });
      return;
    }
    const payloads = [{
      id: uid(),
      company: "Liotecnica",
      role: "Desenvolvedor Web",
      start: "01/2025",
      end: "Atual",
      place: "Embu das Artes - Hibrido",
      bullets: [
        "Criou modulos de candidatura e perfil do candidato (Bootstrap + JS).",
        "Otimizou performance e responsividade (mobile-first).",
        "Implementou melhorias de UX com modais e notificacoes."
      ],
      updatedAt: new Date().toISOString()
    }];
    if(STORAGE_ENABLED){
      data.experiences.push(...payloads);
      saveExpProj(data);
    }else{
      const saved = await Promise.all(payloads.map(p => persistExperience(p)));
      expProjCache.experiences = saved.filter(Boolean);
    }
    renderExperienceProjects();
  }

  async function seedProjects(){
    if(!STORAGE_ENABLED && !expProjLoaded){
      await ensureExpProjLoaded();
    }
    const data = loadExpProj();
    if(data.projects.length > 0){
      Swal.fire({ icon:"info", title:"Ja existe conteudo", text:"Remova os projetos atuais para inserir exemplos.", confirmButtonColor:"#004aad" });
      return;
    }
    const payloads = [{
      id: uid(),
      name: "Portal de Candidatos (MVP)",
      period: "2025-2026",
      desc: "Prototipo de portal para cadastro de candidatos e submissao de curriculo.",
      link: "https://github.com/seu-usuario/seu-repo",
      stack: ["HTML", "Bootstrap 5", "JavaScript", "SweetAlert2"],
      highlights: ["Fluxo de candidatura com modal", "Perfil com abas e persistencia local (localStorage)"],
      updatedAt: new Date().toISOString()
    }];
    if(STORAGE_ENABLED){
      data.projects.push(...payloads);
      saveExpProj(data);
    }else{
      const saved = await Promise.all(payloads.map(p => persistProject(p)));
      expProjCache.projects = saved.filter(Boolean);
    }
    renderExperienceProjects();
  }

  function ensureTagRemoval(){
    const tagArea = document.getElementById("tagArea");
    if(!tagArea || tagArea.dataset.bound === "true") return;
    tagArea.dataset.bound = "true";

    tagArea.querySelectorAll(".badge").forEach((badge) => {
      badge.style.cursor = "pointer";
      badge.title = "Remover tag";
    });

    tagArea.addEventListener("click", (event) => {
      const badge = event.target.closest(".badge");
      if(!badge || badge.closest("button")) return;

      const label = (badge.textContent || "").trim();
      Swal.fire({
        title: "Remover tag?",
        text: `Deseja remover \"${label}\"?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Remover",
        confirmButtonColor: "#004aad",
        cancelButtonText: "Cancelar"
      }).then(async (resp) => {
        if(!resp.isConfirmed) return;
        if(!STORAGE_ENABLED && !skillsPortfLoaded){
          await ensureSkillsPortfolioLoaded();
        }
        badge.remove();
        const nextTags = Array.from(tagArea.querySelectorAll(".badge"))
          .map(el => (el.textContent || "").trim())
          .filter(Boolean);
        skillsPortfCache.tags = nextTags;
        persistPortfolio(skillsPortfCache);
      });
    });
  }

  function renderTechTags(){
    const tagArea = document.getElementById("tagArea");
    if(!tagArea) return;

    const addButton = tagArea.querySelector("button");
    tagArea.querySelectorAll(".badge").forEach(el => el.remove());

    const data = loadSkillsPortf();
    const tags = Array.isArray(data.tags) ? data.tags : [];
    tags.forEach(tag => {
      const span = document.createElement("span");
      span.className = "badge rounded-pill text-bg-dark";
      span.textContent = tag;
      span.style.cursor = "pointer";
      span.title = "Remover tag";
      if(addButton){
        tagArea.insertBefore(span, addButton);
      }else{
        tagArea.appendChild(span);
      }
    });

    if(!addButton){
      const btn = document.createElement("button");
      btn.className = "btn btn-sm btn-outline-secondary rounded-pill";
      btn.type = "button";
      btn.innerHTML = '<i class="fas fa-plus"></i> adicionar';
      btn.addEventListener("click", addQuickTag);
      tagArea.appendChild(btn);
    }

    ensureTagRemoval();
  }

  function addQuickTag(){
    const modalEl = document.getElementById("tagEditModal");
    if(!modalEl) return;
    const input = modalEl.querySelector("#tagNameInput");
    if(input) input.value = "";
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setTimeout(() => {
      input?.focus();
    }, 150);
  }

  async function saveQuickTag(){
    const tagArea = document.getElementById("tagArea");
    const input = document.getElementById("tagNameInput");
    if(!tagArea || !input) return;
    const val = (input.value || "").trim();
    if(!val) return;

    if(!STORAGE_ENABLED && !skillsPortfLoaded){
      await ensureSkillsPortfolioLoaded();
    }

    const data = loadSkillsPortf();
    const tags = Array.isArray(data.tags) ? data.tags.slice() : [];
    if(!tags.some(t => t.toLowerCase() === val.toLowerCase())){
      tags.push(val);
      skillsPortfCache.tags = tags;
      persistPortfolio(skillsPortfCache);
    }

    renderTechTags();

    bootstrap.Modal.getInstance(document.getElementById("tagEditModal"))?.hide();
  }

  function fakeOpenLink(name){
    event?.preventDefault?.();
    Swal.fire({ icon:"info", title:name, text:"No MVP, isso pode abrir o link salvo no seu perfil.", confirmButtonColor:"#004aad" });
  }

  // Segurança simples contra HTML injection no MVP
  function escapeHtml(str){
    return String(str || "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function escapeAttr(str){
    return String(str || "").replaceAll('"', "%22");
  }
  
  
  // ======================================
// Aba: Competências & Portfólio (Drop-in)
// ======================================
const SKILLS_PORTF_STORAGE_KEY = "liotec_portal_skills_portf_v1";
const SKILLS_PORTF_API_BASE = "/PortalVagas/SkillsPortfolio";
let skillsPortfCache = { skills: [], certs: [], links: {}, prefs: {}, tags: [] };
let skillsPortfLoaded = false;
let skillsPortfLoading = false;

function loadSkillsPortf(){
  if(!STORAGE_ENABLED) return skillsPortfCache;
  try{
    const raw = storageGet(SKILLS_PORTF_STORAGE_KEY);
    if(!raw) return { skills: [], certs: [], links: {}, prefs: {}, tags: [] };
    const obj = JSON.parse(raw) || {};
    return {
      skills: Array.isArray(obj.skills) ? obj.skills : [],
      certs: Array.isArray(obj.certs) ? obj.certs : [],
      links: (obj.links && typeof obj.links === "object") ? obj.links : {},
      prefs: (obj.prefs && typeof obj.prefs === "object") ? obj.prefs : {},
      tags: Array.isArray(obj.tags) ? obj.tags : []
    };
  }catch{
    return { skills: [], certs: [], links: {}, prefs: {}, tags: [] };
  }
}
function saveSkillsPortf(data){
  if(!STORAGE_ENABLED){
    skillsPortfCache = data;
    return;
  }
  try{ storageSet(SKILLS_PORTF_STORAGE_KEY, JSON.stringify(data)); }catch{}
}

function mapSkillsPortfolioResponse(data){
  return {
    skills: Array.isArray(data?.skills) ? data.skills.map(s => ({
      id: s.id,
      type: s.tipo,
      name: s.nome,
      level: s.nivel,
      evidence: s.evidencia || ""
    })) : [],
    certs: Array.isArray(data?.certifications) ? data.certifications.map(c => ({
      id: c.id,
      name: c.nome,
      org: c.instituicao || "",
      year: c.ano || "",
      link: c.link || ""
    })) : [],
    links: {
      linkedin: data?.links?.linkedin || "",
      github: data?.links?.github || "",
      portfolio: data?.links?.portfolio || "",
      drive: data?.links?.drive || ""
    },
    prefs: {
      workModel: data?.preferences?.workModel || "",
      availability: data?.preferences?.availability || "",
      salary: data?.preferences?.salary || "",
      shift: data?.preferences?.shift || "",
      note: data?.preferences?.note || ""
    },
    tags: (data?.tags || "").split(",").map(x => x.trim()).filter(Boolean)
  };
}

function buildPortfolioRequest(data){
  return {
    workModel: data.prefs?.workModel || "",
    availability: data.prefs?.availability || "",
    salary: data.prefs?.salary || "",
    shift: data.prefs?.shift || "",
    note: data.prefs?.note || "",
    linkedin: data.links?.linkedin || "",
    github: data.links?.github || "",
    portfolio: data.links?.portfolio || "",
    drive: data.links?.drive || "",
    tags: (data.tags || []).join(", ")
  };
}

  async function ensureSkillsPortfolioLoaded(){
    if(STORAGE_ENABLED || skillsPortfLoaded || skillsPortfLoading) return;
    skillsPortfLoading = true;
    try{
      const res = await fetch(SKILLS_PORTF_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if(res.ok){
        skillsPortfCache = mapSkillsPortfolioResponse(data);
        __skillsHydratedOnce = false;
      }
    }catch{
      // ignore
    }finally{
      skillsPortfLoaded = true;
      skillsPortfLoading = false;
    }
  }

async function persistPortfolio(data){
  if(STORAGE_ENABLED){
    saveSkillsPortf(data);
    return true;
  }
  try{
    const res = await fetch(SKILLS_PORTF_API_BASE, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(buildPortfolioRequest(data))
    });
    const payload = await res.json().catch(() => ({}));
    if(res.ok){
      skillsPortfCache.links = {
        linkedin: payload?.links?.linkedin || "",
        github: payload?.links?.github || "",
        portfolio: payload?.links?.portfolio || "",
        drive: payload?.links?.drive || ""
      };
      skillsPortfCache.prefs = {
        workModel: payload?.preferences?.workModel || "",
        availability: payload?.preferences?.availability || "",
        salary: payload?.preferences?.salary || "",
        shift: payload?.preferences?.shift || "",
        note: payload?.preferences?.note || ""
      };
      skillsPortfCache.tags = (payload?.tags || "").split(",").map(x => x.trim()).filter(Boolean);
      return true;
    }
  }catch{
    return false;
  }
  return false;
}

async function persistSkill(candidateSkill){
  if(STORAGE_ENABLED){
    const data = loadSkillsPortf();
    const idx = data.skills.findIndex(x => x.id === candidateSkill.id);
    if(idx >= 0) data.skills[idx] = candidateSkill;
    else data.skills.push(candidateSkill);
    saveSkillsPortf(data);
    return candidateSkill;
  }

  const body = {
    tipo: candidateSkill.type,
    nome: candidateSkill.name,
    nivel: candidateSkill.level,
    evidencia: candidateSkill.evidence || ""
  };

  const isUpdate = !!candidateSkill.id && skillsPortfCache.skills.some(x => x.id === candidateSkill.id);
  const url = isUpdate
    ? `${SKILLS_PORTF_API_BASE}/Skills/${candidateSkill.id}`
    : `${SKILLS_PORTF_API_BASE}/Skills`;
  const method = isUpdate ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if(!res.ok) return null;

  const saved = {
    id: payload.id,
    type: payload.tipo,
    name: payload.nome,
    level: payload.nivel,
    evidence: payload.evidencia || ""
  };
  const idx = skillsPortfCache.skills.findIndex(x => x.id === saved.id);
  if(idx >= 0) skillsPortfCache.skills[idx] = saved;
  else skillsPortfCache.skills.push(saved);
  return saved;
}

async function removeSkill(id){
  if(STORAGE_ENABLED){
    const data = loadSkillsPortf();
    data.skills = data.skills.filter(x => x.id !== id);
    saveSkillsPortf(data);
    return true;
  }
  const res = await fetch(`${SKILLS_PORTF_API_BASE}/Skills/${id}`, {
    method: "DELETE",
    credentials: "same-origin"
  });
  if(!res.ok) return false;
  skillsPortfCache.skills = skillsPortfCache.skills.filter(x => x.id !== id);
  return true;
}

async function persistCertification(cert){
  if(STORAGE_ENABLED){
    const data = loadSkillsPortf();
    const idx = data.certs.findIndex(x => x.id === cert.id);
    if(idx >= 0) data.certs[idx] = cert;
    else data.certs.push(cert);
    saveSkillsPortf(data);
    return cert;
  }

  const body = {
    nome: cert.name,
    instituicao: cert.org || "",
    ano: cert.year || "",
    link: cert.link || ""
  };

  const isUpdate = !!cert.id && skillsPortfCache.certs.some(x => x.id === cert.id);
  const url = isUpdate
    ? `${SKILLS_PORTF_API_BASE}/Certifications/${cert.id}`
    : `${SKILLS_PORTF_API_BASE}/Certifications`;
  const method = isUpdate ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if(!res.ok) return null;

  const saved = {
    id: payload.id,
    name: payload.nome,
    org: payload.instituicao || "",
    year: payload.ano || "",
    link: payload.link || ""
  };
  const idx = skillsPortfCache.certs.findIndex(x => x.id === saved.id);
  if(idx >= 0) skillsPortfCache.certs[idx] = saved;
  else skillsPortfCache.certs.push(saved);
  return saved;
}

async function removeCertification(id){
  if(STORAGE_ENABLED){
    const data = loadSkillsPortf();
    data.certs = data.certs.filter(x => x.id !== id);
    saveSkillsPortf(data);
    return true;
  }
  const res = await fetch(`${SKILLS_PORTF_API_BASE}/Certifications/${id}`, {
    method: "DELETE",
    credentials: "same-origin"
  });
  if(!res.ok) return false;
  skillsPortfCache.certs = skillsPortfCache.certs.filter(x => x.id !== id);
  return true;
}

function renderSkillsPortfolio(){
  const chips = document.getElementById("skillChips");
  const skillEmpty = document.getElementById("skillEmpty");
  const certList = document.getElementById("certList");
  const certEmpty = document.getElementById("certEmpty");

  if(!chips || !certList) return;

  if(!STORAGE_ENABLED && !skillsPortfLoaded){
    ensureSkillsPortfolioLoaded().then(() => renderSkillsPortfolio());
    return;
  }

  const data = loadSkillsPortf();

  // Preenche form prefs/links se existir (sem ficar sobrescrevendo digitando)
  hydratePrefsAndLinks(data);

  // Skills chips
  chips.innerHTML = "";
  if(data.skills.length === 0){
    if(skillEmpty) skillEmpty.style.display = "block";
  }else{
    if(skillEmpty) skillEmpty.style.display = "none";

    // ordena: tipo > nível > nome
    const orderType = { "Hard": 1, "Soft": 2, "Idioma": 3 };
    const orderLevel = { "Básico": 1, "Intermediário": 2, "Avançado": 3 };

    [...data.skills]
      .sort((a,b) => {
        const t = (orderType[a.type]||9) - (orderType[b.type]||9);
        if(t !== 0) return t;
        const l = (orderLevel[b.level]||0) - (orderLevel[a.level]||0);
        if(l !== 0) return l;
        return String(a.name||"").localeCompare(String(b.name||""));
      })
      .forEach(s => {
        const cls =
          s.type === "Hard"  ? "text-bg-primary" :
          s.type === "Soft"  ? "text-bg-secondary" :
          "text-bg-dark";

        const title = `${s.type} • ${s.level}${s.evidence ? " • " + s.evidence : ""}`;

        chips.innerHTML += `
          <span class="badge rounded-pill ${cls} me-1 mb-1 skill-chip"
                style="cursor:pointer; padding:.55rem .7rem;"
                title="${escapeAttr(title)}"
                data-id="${escapeAttr(s.id)}">
            <span class="skill-label">${escapeHtml(s.name)} <span style="opacity:.85;">| ${escapeHtml(s.level)}</span></span>
            <button type="button" class="skill-remove ms-2" data-id="${escapeAttr(s.id)}"
                    aria-label="Remover"
                    style="background:transparent;border:0;color:inherit;opacity:.9;padding:0;line-height:1;">x</button>
          </span>
        `;
      });
  }

  // Certs list
  certList.innerHTML = "";
    if(data.certs.length === 0){
      if(certEmpty) certEmpty.style.display = "block";
    }else{
      if(certEmpty) certEmpty.style.display = "none";

    [...data.certs]
      .sort((a,b) => String(b.year||"").localeCompare(String(a.year||"")))
      .forEach(c => {
        const meta = [
          c.org ? c.org : null,
          c.year ? c.year : null
        ].filter(Boolean).join(" • ");

        certList.innerHTML += `
          <div class="border rounded p-3 mb-2" style="border-radius:14px;">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-bold">${escapeHtml(c.name)}</div>
                ${meta ? `<div class="small text-muted mt-1">${escapeHtml(meta)}</div>` : `<div class="small text-muted mt-1">—</div>`}
                ${c.link ? `<a class="small d-inline-block mt-2" href="${escapeAttr(c.link)}" target="_blank" rel="noopener">
                  <i class="fas fa-link me-1"></i> Abrir comprovante
                </a>` : ``}
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-sm btn-outline-primary" type="button" onclick="openCertModal('${c.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteCert('${c.id}')"><i class="fas fa-trash"></i></button>
              </div>
            </div>
          </div>
        `;
        });
    }

    renderTechTags();
  }

let __skillsHydratedOnce = false;
function hydratePrefsAndLinks(data){
  // Evita sobrescrever enquanto usuário digita
  if(__skillsHydratedOnce) return;
  __skillsHydratedOnce = true;

  // prefs
  const p = data.prefs || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if(el && (el.value === "" || el.value == null)) el.value = val || "";
  };

  setVal("prefWorkModel", p.workModel);
  setVal("prefAvailability", p.availability);
  setVal("prefSalary", p.salary);
  setVal("prefShift", p.shift);
  setVal("prefNote", p.note);

  // links
  const l = data.links || {};
  setVal("linkLinkedIn", l.linkedin);
  setVal("linkGitHub", l.github);
  setVal("linkPortfolio", l.portfolio);
  setVal("linkDrive", l.drive);
}

function saveSkillsPreferences(){
  const data = loadSkillsPortf();
  data.prefs = {
    workModel: (document.getElementById("prefWorkModel")?.value || "").trim(),
    availability: (document.getElementById("prefAvailability")?.value || "").trim(),
    salary: (document.getElementById("prefSalary")?.value || "").trim(),
    shift: (document.getElementById("prefShift")?.value || "").trim(),
    note: (document.getElementById("prefNote")?.value || "").trim()
  };
  if(STORAGE_ENABLED){
    saveSkillsPortf(data);
    return;
  }
  persistPortfolio(data);
}

  function saveSkillsLinks(){
    const data = loadSkillsPortf();
    data.links = {
      linkedin: (document.getElementById("linkLinkedIn")?.value || "").trim(),
      github: (document.getElementById("linkGitHub")?.value || "").trim(),
      portfolio: (document.getElementById("linkPortfolio")?.value || "").trim(),
      drive: (document.getElementById("linkDrive")?.value || "").trim()
    };
    if(STORAGE_ENABLED){
      saveSkillsPortf(data);
      return;
    }
    persistPortfolio(data);
  }

  function formatCurrencyInput(input) {
    const raw = (input.value || "").replace(/\D/g, "");
    if (!raw) {
      input.value = "";
      return;
    }
    const value = (Number(raw) / 100).toFixed(2);
    input.value = value.replace(".", ",");
  }

  const prefSalaryInput = document.getElementById("prefSalary");
  if (prefSalaryInput) {
    prefSalaryInput.addEventListener("input", () => formatCurrencyInput(prefSalaryInput));
    prefSalaryInput.addEventListener("blur", () => formatCurrencyInput(prefSalaryInput));
  }

function openSavedLink(which){
  const data = loadSkillsPortf();
  const l = data.links || {};
  const map = {
    LinkedIn: l.linkedin,
    GitHub: l.github,
    Portfolio: l.portfolio,
    Drive: l.drive
  };
  const url = (map[which] || "").trim();
  if(!url){
    Swal.fire({ icon:"info", title:"Sem link", text:`Você ainda não salvou o link de ${which}.`, confirmButtonColor:"#004aad" });
    return;
  }
  try{ window.open(url, "_blank", "noopener"); }catch{
    Swal.fire({ icon:"info", title:"Abrir link", text:url, confirmButtonColor:"#004aad" });
  }
}

// ----- Skills CRUD -----
function openSkillModal(skillId){
  const m = new bootstrap.Modal(document.getElementById("skillEditModal"));
  const data = loadSkillsPortf();
  const s = skillId ? data.skills.find(x => x.id === skillId) : null;

  document.getElementById("skillId").value = s?.id || "";
  document.getElementById("skillType").value = s?.type || "Hard";
  document.getElementById("skillName").value = s?.name || "";
  document.getElementById("skillLevel").value = s?.level || "Intermediário";
  document.getElementById("skillEvidence").value = s?.evidence || "";

  m.show();
}

async function saveSkill(){
  const id = (document.getElementById("skillId").value || "").trim() || uid();

  const type = (document.getElementById("skillType").value || "Hard").trim();
  const name = (document.getElementById("skillName").value || "").trim();
  const level = (document.getElementById("skillLevel").value || "Intermediário").trim();
  const evidence = (document.getElementById("skillEvidence").value || "").trim();

  if(!name){
    Swal.fire({ icon:"warning", title:"Faltou o nome", text:"Informe a competência.", confirmButtonColor:"#004aad" });
    return;
  }

  const payload = { id, type, name, level, evidence, updatedAt: new Date().toISOString() };

  const saved = await persistSkill(payload);
  if(!saved){
    Swal.fire({ icon:"error", title:"Erro ao salvar", text:"Nao foi possivel salvar a competencia.", confirmButtonColor:"#004aad" });
    return;
  }
  bootstrap.Modal.getInstance(document.getElementById("skillEditModal"))?.hide();
  renderSkillsPortfolio();
  Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Competência salva", showConfirmButton:false, timer:2000 });
}

function deleteSkill(id){
  Swal.fire({
    title:"Remover competência?",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    Promise.resolve(removeSkill(id)).then(ok => {
      if(!ok){
        Swal.fire({ icon:"error", title:"Erro ao remover", text:"Nao foi possivel remover a competencia.", confirmButtonColor:"#004aad" });
        return;
      }
      renderSkillsPortfolio();
    });
  });
}

// (opcional) atalho: clique direito no chip para remover
document.addEventListener("contextmenu", (e) => {
  const t = e.target;
  if(!(t instanceof Element)) return;
  const badge = t.closest?.("#skillChips .skill-chip");
  if(!badge) return;

  e.preventDefault();
  const id = badge.getAttribute("data-id");
  if(!id) return;

  Swal.fire({
    title:"Remover esta compet??ncia?",
    text:"Dica: clique normal para editar.",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(r.isConfirmed) deleteSkill(id);
  });
});

document.getElementById("skillChips")?.addEventListener("click", (e) => {
  const target = e.target;
  if(!(target instanceof Element)) return;
  const removeBtn = target.closest(".skill-remove");
  if(removeBtn){
    e.stopPropagation();
    const id = removeBtn.getAttribute("data-id");
    if(id) deleteSkill(id);
    return;
  }
  const chip = target.closest(".skill-chip");
  if(!chip) return;
  const id = chip.getAttribute("data-id");
  if(id) openSkillModal(id);
});

// ----- Certs CRUD -----
function openCertModal(certId){
  const m = new bootstrap.Modal(document.getElementById("certEditModal"));
  const data = loadSkillsPortf();
  const c = certId ? data.certs.find(x => x.id === certId) : null;

  document.getElementById("certId").value = c?.id || "";
  document.getElementById("certName").value = c?.name || "";
  document.getElementById("certOrg").value = c?.org || "";
  document.getElementById("certYear").value = c?.year || "";
  document.getElementById("certLink").value = c?.link || "";

  m.show();
}

async function saveCert(){
  const id = (document.getElementById("certId").value || "").trim() || uid();

  const name = (document.getElementById("certName").value || "").trim();
  const org  = (document.getElementById("certOrg").value || "").trim();
  const year = (document.getElementById("certYear").value || "").trim();
  const link = (document.getElementById("certLink").value || "").trim();

  if(!name){
    Swal.fire({ icon:"warning", title:"Faltou o nome", text:"Informe o curso/certificação.", confirmButtonColor:"#004aad" });
    return;
  }

  const payload = { id, name, org, year, link, updatedAt: new Date().toISOString() };
  const saved = await persistCertification(payload);
  if(!saved){
    Swal.fire({ icon:"error", title:"Erro ao salvar", text:"Nao foi possivel salvar o curso/certificacao.", confirmButtonColor:"#004aad" });
    return;
  }
  bootstrap.Modal.getInstance(document.getElementById("certEditModal"))?.hide();
  renderSkillsPortfolio();
  Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Curso/Certificação salva", showConfirmButton:false, timer:2000 });
}

function deleteCert(id){
  Swal.fire({
    title:"Remover item?",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    Promise.resolve(removeCertification(id)).then(ok => {
      if(!ok){
        Swal.fire({ icon:"error", title:"Erro ao remover", text:"Nao foi possivel remover o curso/certificacao.", confirmButtonColor:"#004aad" });
        return;
      }
      renderSkillsPortfolio();
    });
  });
}

// ----- Seeds / Reset -----
async function seedSkillsPortfolio(){
  const data = loadSkillsPortf();
  if(data.skills.length || data.certs.length){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplos.", confirmButtonColor:"#004aad" });
    return;
  }

  const seedSkills = [
    { id: uid(), type:"Hard",  name:"Excel", level:"Avançado", evidence:"Dashboards e relatórios", updatedAt:new Date().toISOString() },
    { id: uid(), type:"Hard",  name:"SAP", level:"Intermediário", evidence:"Rotinas de logística", updatedAt:new Date().toISOString() },
    { id: uid(), type:"Soft",  name:"Trabalho em equipe", level:"Avançado", evidence:"Projetos multidisciplinares", updatedAt:new Date().toISOString() },
    { id: uid(), type:"Idioma",name:"Inglês", level:"Intermediário", evidence:"Leitura técnica", updatedAt:new Date().toISOString() }
  ];

  const seedCerts = [
    { id: uid(), name:"NR-10", org:"SENAI", year:"2025", link:"", updatedAt:new Date().toISOString() },
    { id: uid(), name:"Excel Avançado", org:"Alura", year:"2024", link:"", updatedAt:new Date().toISOString() }
  ];

  const seedLinks = {
    linkedin: "https://linkedin.com/in/seu-perfil",
    github: "https://github.com/seu-usuario",
    portfolio: "",
    drive: ""
  };

  const seedPrefs = {
    workModel: "Híbrido",
    availability: "Até 15 dias",
    salary: "4500",
    shift: "Diurno",
    note: "Disponível para viagens ocasionais"
  };

  if(STORAGE_ENABLED){
    data.skills = seedSkills;
    data.certs = seedCerts;
    data.links = seedLinks;
    data.prefs = seedPrefs;
    saveSkillsPortf(data);
  }else{
    await Promise.all(seedSkills.map(s => persistSkill(s)));
    await Promise.all(seedCerts.map(c => persistCertification(c)));
    skillsPortfCache.links = seedLinks;
    skillsPortfCache.prefs = seedPrefs;
    await persistPortfolio(skillsPortfCache);
  }

  __skillsHydratedOnce = false;
  renderSkillsPortfolio();
  Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
}

function resetSkillsPortfolio(){
  Swal.fire({
    title:"Limpar Competências & Portfólio?",
    text:"Isso apaga os dados dessa aba.",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    if(STORAGE_ENABLED){
      storageRemove(SKILLS_PORTF_STORAGE_KEY);
      __skillsHydratedOnce = false;
      renderSkillsPortfolio();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
      return;
    }

    const skillIds = skillsPortfCache.skills.map(s => s.id);
    const certIds = skillsPortfCache.certs.map(c => c.id);

    Promise.all([
      ...skillIds.map(id => removeSkill(id)),
      ...certIds.map(id => removeCertification(id))
    ]).then(() => {
      skillsPortfCache = { skills: [], certs: [], links: {}, prefs: {}, tags: [] };
      persistPortfolio(skillsPortfCache);
      __skillsHydratedOnce = false;
      renderSkillsPortfolio();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
    });
  });
}


// ======================================
// Aba: Formação & Educação (Drop-in)
// ======================================
const EDUCATION_STORAGE_KEY = "liotec_portal_education_v1";
const EDUCATION_API_BASE = "/PortalVagas/Education";
let educationCache = { summary: {}, items: [] };
let educationLoaded = false;
let educationLoading = false;

function loadEducation(){
  if(!STORAGE_ENABLED) return educationCache;
  try{
    const raw = storageGet(EDUCATION_STORAGE_KEY);
    if(!raw) return { summary: {}, items: [] };
    const obj = JSON.parse(raw) || {};
    return {
      summary: (obj.summary && typeof obj.summary === "object") ? obj.summary : {},
      items: Array.isArray(obj.items) ? obj.items : []
    };
  }catch{
    return { summary: {}, items: [] };
  }
}
function saveEducation(data){
  if(!STORAGE_ENABLED){
    educationCache = data;
    return;
  }
  try{ storageSet(EDUCATION_STORAGE_KEY, JSON.stringify(data)); }catch{}
}

let __eduHydratedOnce = false;

async function ensureEducationLoaded(){
  if(STORAGE_ENABLED || educationLoaded || educationLoading) return;
  educationLoading = true;
  try{
    const res = await fetch(EDUCATION_API_BASE, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
    const data = await res.json().catch(() => ({}));
    if(res.ok){
      educationCache = mapEducationResponse(data);
      __eduHydratedOnce = false;
    }
  }catch{
    // ignore
  }finally{
    educationLoaded = true;
    educationLoading = false;
  }
}

function mapEducationResponse(data){
  return {
    summary: {
      level: data?.summary?.nivel || "",
      mainArea: data?.summary?.areaPrincipal || "",
      mainStatus: data?.summary?.situacao || "",
      highlights: data?.summary?.destaques || ""
    },
    items: Array.isArray(data?.items) ? data.items.map(i => ({
      id: i.id,
      course: i.curso,
      institution: i.instituicao || "",
      type: i.tipo || "",
      status: i.status || "",
      start: i.inicio || "",
      end: i.fim || "",
      notes: i.observacoes || "",
      link: i.link || "",
      updatedAt: new Date().toISOString()
    })) : []
  };
}

async function persistEducationSummary(data){
  if(STORAGE_ENABLED){
    saveEducation(data);
    return true;
  }
  try{
    const res = await fetch(`${EDUCATION_API_BASE}/Summary`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        nivel: data.summary?.level || "",
        areaPrincipal: data.summary?.mainArea || "",
        situacao: data.summary?.mainStatus || "",
        destaques: data.summary?.highlights || ""
      })
    });
    const payload = await res.json().catch(() => ({}));
    if(res.ok){
      educationCache.summary = {
        level: payload?.nivel || "",
        mainArea: payload?.areaPrincipal || "",
        mainStatus: payload?.situacao || "",
        highlights: payload?.destaques || ""
      };
      return true;
    }
  }catch{
    return false;
  }
  return false;
}

async function persistEducationItem(item){
  if(STORAGE_ENABLED){
    const data = loadEducation();
    const idx = (data.items || []).findIndex(x => x.id === item.id);
    if(idx >= 0) data.items[idx] = item;
    else data.items.push(item);
    saveEducation(data);
    return item;
  }

  const body = {
    curso: item.course,
    instituicao: item.institution || "",
    tipo: item.type || "",
    status: item.status || "",
    inicio: item.start || "",
    fim: item.end || "",
    observacoes: item.notes || "",
    link: item.link || ""
  };

  const isUpdate = !!item.id && educationCache.items.some(x => x.id === item.id);
  const url = isUpdate ? `${EDUCATION_API_BASE}/Items/${item.id}` : `${EDUCATION_API_BASE}/Items`;
  const method = isUpdate ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body)
  });
  const payload = await res.json().catch(() => ({}));
  if(!res.ok) return null;

  const saved = {
    id: payload.id,
    course: payload.curso,
    institution: payload.instituicao || "",
    type: payload.tipo || "",
    status: payload.status || "",
    start: payload.inicio || "",
    end: payload.fim || "",
    notes: payload.observacoes || "",
    link: payload.link || "",
    updatedAt: new Date().toISOString()
  };

  const idx = educationCache.items.findIndex(x => x.id === saved.id);
  if(idx >= 0) educationCache.items[idx] = saved;
  else educationCache.items.push(saved);
  return saved;
}

async function removeEducationItem(id){
  if(STORAGE_ENABLED){
    const data = loadEducation();
    data.items = (data.items || []).filter(x => x.id !== id);
    saveEducation(data);
    return true;
  }
  const res = await fetch(`${EDUCATION_API_BASE}/Items/${id}`, {
    method: "DELETE",
    credentials: "same-origin"
  });
  if(!res.ok) return false;
  educationCache.items = educationCache.items.filter(x => x.id !== id);
  return true;
}

function hydrateEducationSummary(){
  if(__eduHydratedOnce) return;
  __eduHydratedOnce = true;

  const data = loadEducation();
  const s = data.summary || {};

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if(el && (el.value === "" || el.value == null)) el.value = val || "";
  };

  setVal("eduLevel", s.level);
  setVal("eduMainArea", s.mainArea);
  setVal("eduMainStatus", s.mainStatus);
  setVal("eduHighlights", s.highlights);
}

function saveEducationSummary(){
  const data = loadEducation();
  data.summary = {
    level: (document.getElementById("eduLevel")?.value || "").trim(),
    mainArea: (document.getElementById("eduMainArea")?.value || "").trim(),
    mainStatus: (document.getElementById("eduMainStatus")?.value || "").trim(),
    highlights: (document.getElementById("eduHighlights")?.value || "").trim()
  };
  if(STORAGE_ENABLED){
    saveEducation(data);
    return;
  }
  persistEducationSummary(data);
}

function renderEducation(){
  const list = document.getElementById("eduList");
  const empty = document.getElementById("eduEmpty");
  if(!list) return;

  if(!STORAGE_ENABLED && !educationLoaded){
    ensureEducationLoaded().then(() => renderEducation());
    return;
  }

  hydrateEducationSummary();

  const data = loadEducation();
  const items = [...(data.items || [])];

  // ordena por: status (cursando primeiro), fim/prev desc, início desc, updatedAt desc
  const statusRank = { "Cursando": 1, "Concluído": 2, "A iniciar": 3, "Trancado": 4 };
  items.sort((a,b) => {
    const sr = (statusRank[a.status]||9) - (statusRank[b.status]||9);
    if(sr !== 0) return sr;
    const be = String(b.end||"").localeCompare(String(a.end||""));
    if(be !== 0) return be;
    const bs = String(b.start||"").localeCompare(String(a.start||""));
    if(bs !== 0) return bs;
    return String(b.updatedAt||"").localeCompare(String(a.updatedAt||""));
  });

  list.innerHTML = "";

  if(items.length === 0){
    if(empty) empty.style.display = "block";
    return;
  }
  if(empty) empty.style.display = "none";

  items.forEach(e => {
    const period = [e.start || "—", e.end || "—"].join(" • ");
    const meta = [
      e.institution ? e.institution : null,
      e.type ? e.type : null
    ].filter(Boolean).join(" • ");

    const statusBadge =
      e.status === "Concluído" ? "badge bg-success" :
      e.status === "Cursando" ? "badge bg-primary" :
      e.status === "Trancado" ? "badge bg-secondary" :
      "badge bg-dark";

    list.innerHTML += `
      <div class="border rounded p-3 mb-2" style="border-radius:14px;">
        <div class="d-flex justify-content-between align-items-start gap-2">
          <div style="min-width:0;">
            <div class="d-flex flex-wrap align-items-center gap-2">
              <div class="fw-bold">${escapeHtml(e.course)}</div>
              <span class="${statusBadge} rounded-pill">${escapeHtml(e.status || "—")}</span>
            </div>

            ${meta ? `<div class="small text-muted mt-1">${escapeHtml(meta)}</div>` : ``}
            <div class="small text-muted mt-1"><i class="far fa-calendar-alt me-1"></i>${escapeHtml(period)}</div>

            ${e.notes ? `<div class="small text-muted mt-2" style="white-space:pre-wrap;">${escapeHtml(e.notes)}</div>` : ``}

            <div class="d-flex flex-wrap gap-2 mt-2">
              ${e.link ? `<a class="btn btn-sm btn-outline-secondary fw-bold" href="${escapeAttr(e.link)}" target="_blank" rel="noopener">
                <i class="fas fa-link me-1"></i> Abrir link
              </a>` : ``}
            </div>
          </div>

          <div class="d-flex gap-2 flex-shrink-0">
            <button class="btn btn-sm btn-outline-primary" type="button" onclick="openEducationModal('${e.id}')">
              <i class="fas fa-pen"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" type="button" onclick="deleteEducationItem('${e.id}')">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  });
}

function openEducationModal(id){
  const m = new bootstrap.Modal(document.getElementById("eduEditModal"));
  const data = loadEducation();
  const e = id ? (data.items || []).find(x => x.id === id) : null;

  document.getElementById("eduId").value = e?.id || "";
  document.getElementById("eduCourse").value = e?.course || "";
  document.getElementById("eduInstitution").value = e?.institution || "";
  document.getElementById("eduType").value = e?.type || "Curso";
  document.getElementById("eduStatus").value = e?.status || "Concluído";
  document.getElementById("eduStart").value = e?.start || "";
  document.getElementById("eduEnd").value = e?.end || "";
  document.getElementById("eduNotes").value = e?.notes || "";
  document.getElementById("eduLink").value = e?.link || "";

  m.show();
}

async function saveEducationItem(){
  const modalEl = document.getElementById("eduEditModal");
  const cancelBtn = modalEl?.querySelector("#eduCancelBtn");
  const saveBtn = modalEl?.querySelector("#eduSaveBtn");
  if(saveBtn?.dataset.loading === "true") return;

  const setLoading = (isLoading) => {
    if(!saveBtn) return;
    if(isLoading){
      saveBtn.dataset.loading = "true";
      if(!saveBtn.dataset.label) saveBtn.dataset.label = saveBtn.innerHTML;
      saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Salvando...';
      saveBtn.disabled = true;
      if(cancelBtn) cancelBtn.disabled = true;
      return;
    }

    saveBtn.dataset.loading = "false";
    saveBtn.innerHTML = saveBtn.dataset.label || '<i class="fas fa-save me-1"></i> Salvar';
    saveBtn.disabled = false;
    if(cancelBtn) cancelBtn.disabled = false;
  };

  const id = (document.getElementById("eduId").value || "").trim() || uid();

  const course = (document.getElementById("eduCourse").value || "").trim();
  const institution = (document.getElementById("eduInstitution").value || "").trim();
  const type = (document.getElementById("eduType").value || "").trim();
  const status = (document.getElementById("eduStatus").value || "").trim();
  const start = (document.getElementById("eduStart").value || "").trim();
  const end = (document.getElementById("eduEnd").value || "").trim();
  const notes = (document.getElementById("eduNotes").value || "").trim();
  const link = (document.getElementById("eduLink").value || "").trim();

  if(!course){
    Swal.fire({ icon:"warning", title:"Faltou o curso", text:"Informe o nome do curso/formação.", confirmButtonColor:"#004aad" });
    return;
  }

  const payload = { id, course, institution, type, status, start, end, notes, link, updatedAt: new Date().toISOString() };
  setLoading(true);
  try{
    const saved = await persistEducationItem(payload);
    if(!saved){
      Swal.fire({ icon:"error", title:"Erro ao salvar", text:"Nao foi possivel salvar a formacao.", confirmButtonColor:"#004aad" });
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById("eduEditModal"))?.hide();
    renderEducation();

    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Formação salva", showConfirmButton:false, timer:2000 });
  }finally{
    setLoading(false);
  }
}

function deleteEducationItem(id){
  Swal.fire({
    title:"Remover formação?",
    text:"Isso remove do seu perfil (neste protótipo).",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    Promise.resolve(removeEducationItem(id)).then(ok => {
      if(!ok){
        Swal.fire({ icon:"error", title:"Erro ao remover", text:"Nao foi possivel remover a formacao.", confirmButtonColor:"#004aad" });
        return;
      }
      renderEducation();
    });
  });
}

async function seedEducation(){
  if(!STORAGE_ENABLED && !educationLoaded){
    await ensureEducationLoaded();
  }

  const data = loadEducation();
  if((data.items || []).length > 0){
    Swal.fire({ icon:"info", title:"J?? existe conte??do", text:"Limpe antes para inserir exemplos.", confirmButtonColor:"#004aad" });
    return;
  }

  const seedSummary = {
    level: "Superior",
    mainArea: "Log??stica",
    mainStatus: "Conclu??do",
    highlights: "TCC: Otimização de estoque ??? Projeto de melhoria contínua"
  };

  const seedItems = [
    {
      id: uid(),
      course: "Tecnólogo em Logística",
      institution: "FATEC",
      type: "Graduação",
      status: "Concluído",
      start: "2021",
      end: "2023",
      notes: "Ênfase em Supply Chain, Projeto integrador em WMS",
      link: "",
      updatedAt: new Date().toISOString()
    },
    {
      id: uid(),
      course: "Excel Avançado",
      institution: "SENAI",
      type: "Curso",
      status: "Concluído",
      start: "2024",
      end: "2024",
      notes: "Dashboards e tabelas dinâmicas",
      link: "",
      updatedAt: new Date().toISOString()
    }
  ];

  if(STORAGE_ENABLED){
    data.summary = seedSummary;
    data.items = seedItems;
    saveEducation(data);
  }else{
    educationCache.summary = seedSummary;
    await persistEducationSummary(educationCache);
    const savedItems = await Promise.all(seedItems.map(item => persistEducationItem(item)));
    educationCache.items = savedItems.filter(Boolean);
  }

  __eduHydratedOnce = false;
  renderEducation();

  Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
}

function resetEducation(){
  Swal.fire({
    title:"Limpar Formação & Educação?",
    text:"Isso apaga os dados desta aba neste navegador.",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    if(STORAGE_ENABLED){
      storageRemove(EDUCATION_STORAGE_KEY);
      __eduHydratedOnce = false;
      renderEducation();
      Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
      return;
    }

    const itemIds = (educationCache.items || []).map(i => i.id);
    Promise.all(itemIds.map(id => removeEducationItem(id))).then(() => {
      educationCache = { summary: {}, items: [] };
      persistEducationSummary(educationCache).then(() => {
        __eduHydratedOnce = false;
        renderEducation();
        Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
      });
    });
  });
}


// ======================================
// Aba: Privacidade & Consentimentos (LGPD)
// ======================================
const LGPD_STORAGE_KEY = "liotec_portal_lgpd_v1";

function loadLgpd(){
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
    // defaults "seguros"
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

  // regra: se desmarcar candidatura, entendemos como revogação "forte" no MVP
  if(!obj.candidatura){
    obj.revokedAt = new Date().toISOString();
  }else{
    obj.revokedAt = null;
  }

  try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}
  renderLgpd();
}

let __lgpdHydratedOnce = false;

function hydrateLgpd(){
  if(__lgpdHydratedOnce) return;
  __lgpdHydratedOnce = true;

  const obj = loadLgpd() || defaultLgpd();
  try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}

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
  if(!iso) return "—";
  const d = new Date(iso);
  if(isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function renderLgpd(){
  hydrateLgpd();

  const obj = loadLgpd() || defaultLgpd();
  const badge = document.getElementById("lgpdStatusBadge");
  const txt = document.getElementById("lgpdStatusText");
  const last = document.getElementById("lgpdLastUpdated");

  if(last) last.textContent = formatDateTimeBrSafe(obj.updatedAt);

  // status:
  // - "Ativo" se candidatura=true
  // - "Parcial" se candidatura=true mas bancoTalentos=false etc.
  // - "Revogado" se candidatura=false
  const active = !!obj.candidatura;
  const score =
    (obj.candidatura?1:0) +
    (obj.contato?1:0) +
    (obj.bancoTalentos?1:0) +
    (obj.sensivel?1:0) +
    (obj.comunicacoes?1:0);

  let statusLabel = "—";
  let statusClass = "badge bg-secondary";
  let statusText = "—";

  if(!active){
    statusLabel = "Revogado";
    statusClass = "badge bg-danger";
    statusText = `Você revogou os consentimentos em ${formatDateTimeBrSafe(obj.revokedAt)}.`;
  }else{
    if(score >= 4){
      statusLabel = "Ativo";
      statusClass = "badge bg-success";
      statusText = "Você concedeu consentimentos amplos para o processo e comunicações.";
    }else if(score >= 2){
      statusLabel = "Parcial";
      statusClass = "badge bg-primary";
      statusText = "Você concedeu apenas parte dos consentimentos (ajustável a qualquer momento).";
    }else{
      statusLabel = "Mínimo";
      statusClass = "badge bg-warning text-dark";
      statusText = "Apenas o mínimo para participar do processo está ativo.";
    }
  }

  if(badge){
    badge.className = statusClass + " rounded-pill";
    badge.textContent = statusLabel;
  }
  if(txt) txt.textContent = statusText;

  // regra UX: se candidatura desmarcada, desabilita os demais (MVP)
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

// Ações simuladas (MVP)
function lgpdRequestAccess(){
  Swal.fire({
    icon:"info",
    title:"Solicitação de acesso (MVP)",
    html:`<div class="text-start">
      <div class="text-muted">No produto final, isso abriria um chamado para o DPO/RH com protocolo.</div>
      <div class="mt-2"><strong>O que seria entregue:</strong> cópia dos dados, finalidades, prazos e compartilhamentos.</div>
    </div>`,
    confirmButtonColor:"#004aad"
  });
}
function lgpdRequestCorrection(){
  Swal.fire({
    icon:"info",
    title:"Solicitação de correção (MVP)",
    text:"No produto final, isso enviaria um pedido de correção de dados ao RH/DPO.",
    confirmButtonColor:"#004aad"
  });
}
function lgpdRequestDeletion(){
  Swal.fire({
    icon:"warning",
    title:"Solicitar exclusão (MVP)",
    text:"No produto final, isso abriria um processo de exclusão (respeitando obrigações legais).",
    showCancelButton:true,
    confirmButtonText:"Simular pedido",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    Swal.fire({ icon:"success", title:"Pedido registrado (simulação)", text:"Um protocolo seria gerado aqui.", confirmButtonColor:"#004aad" });
  });
}
function lgpdRevokeConsent(){
  Swal.fire({
    icon:"warning",
    title:"Revogar consentimentos?",
    text:"Isso desmarca o consentimento de candidatura e desativa os demais (neste navegador).",
    showCancelButton:true,
    confirmButtonText:"Revogar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
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
    try{ storageSet(LGPD_STORAGE_KEY, JSON.stringify(obj)); }catch{}
    __lgpdHydratedOnce = false;
    renderLgpd();
    Swal.fire({ icon:"success", title:"Consentimentos revogados", confirmButtonColor:"#004aad" });
  });
}

function resetLgpd(){
  Swal.fire({
    icon:"warning",
    title:"Revogar tudo?",
    text:"Isso remove/zera os consentimentos salvos neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Revogar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(LGPD_STORAGE_KEY);
    __lgpdHydratedOnce = false;
    renderLgpd();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Consentimentos reiniciados.", confirmButtonColor:"#004aad" });
  });
}

function exportLgpdReceipt(){
  const obj = loadLgpd() || defaultLgpd();

  const lines = [];
  lines.push("Liotécnica — Comprovante de Consentimentos (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");
  lines.push("Candidatura: " + (obj.candidatura ? "SIM" : "NÃO"));
  lines.push("Contato: " + (obj.contato ? "SIM" : "NÃO"));
  lines.push("Banco de Talentos: " + (obj.bancoTalentos ? "SIM" : "NÃO"));
  lines.push("Retenção (meses): " + (obj.retentionMonths || "—"));
  lines.push("Compartilhamento: " + (obj.sharing || "—"));
  lines.push("Dados sensíveis (PcD): " + (obj.sensivel ? "SIM" : "NÃO"));
  lines.push("Comunicações: " + (obj.comunicacoes ? "SIM" : "NÃO"));
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
}

// ======================================
// Aba: Preferências de Vaga / Objetivos
// ======================================
const PREFS_STORAGE_KEY = "liotec_portal_preferences_v1";

function loadPreferences(){
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

function hydratePreferences(){
  if(__prefsHydratedOnce) return;
  __prefsHydratedOnce = true;

  const p = loadPreferences() || defaultPreferences();
  try{ storageSet(PREFS_STORAGE_KEY, JSON.stringify(p)); }catch{}

  const setVal = (id, val) => {
    const el = document.getElementById(id);
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

function savePreferences(){
  const p = loadPreferences() || defaultPreferences();

  const val = (id) => (document.getElementById(id)?.value || "").trim();

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

  try{ storageSet(PREFS_STORAGE_KEY, JSON.stringify(p)); }catch{}
  renderPreferencesSavedHint(p.updatedAt);
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
  hydratePreferences();
  const p = loadPreferences() || defaultPreferences();
  renderPreferencesSavedHint(p.updatedAt);
}

function seedPreferences(){
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

  try{ storageSet(PREFS_STORAGE_KEY, JSON.stringify(p)); }catch{}
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
    storageRemove(PREFS_STORAGE_KEY);
    __prefsHydratedOnce = false;
    renderPreferences();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
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
// Aba: Documentos & Anexos
// ======================================
const DOCS_STORAGE_KEY = "liotec_portal_docs_v1";

function loadDocuments(){
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
  try{ storageSet(DOCS_STORAGE_KEY, JSON.stringify(list)); }catch{}
}

function openDocModal(id){
  const m = new bootstrap.Modal(document.getElementById("docEditModal"));
  const list = loadDocuments();
  const d = id ? list.find(x => x.id === id) : null;

  document.getElementById("docId").value = d?.id || "";
  document.getElementById("docType").value = d?.type || "Currículo";
  document.getElementById("docName").value = d?.name || "";
  document.getElementById("docLink").value = d?.link || "";
  document.getElementById("docDate").value = d?.date || "";
  document.getElementById("docNotes").value = d?.notes || "";

  // limpa file input (não dá pra setar value por segurança)
  const fileInput = document.getElementById("docFile");
  if(fileInput) fileInput.value = "";

  document.getElementById("docFileName").textContent = d?.fileName || "—";
  m.show();
}

function handleDocFileChange(input){
  const label = document.getElementById("docFileName");
  if(input?.files && input.files[0]){
    const name = input.files[0].name;
    if(label) label.textContent = name;
  }else{
    if(label) label.textContent = "—";
  }
}

function saveDocumentItem(){
  const list = loadDocuments();
  const id = (document.getElementById("docId").value || "").trim() || uid();

  const type = (document.getElementById("docType").value || "Outros").trim();
  const name = (document.getElementById("docName").value || "").trim();
  const link = (document.getElementById("docLink").value || "").trim();
  const date = (document.getElementById("docDate").value || "").trim();
  const notes = (document.getElementById("docNotes").value || "").trim();

  const fileName = (document.getElementById("docFileName").textContent || "").trim();
  const finalFileName = (fileName && fileName !== "—") ? fileName : "";

  if(!name){
    Swal.fire({ icon:"warning", title:"Faltou o nome", text:"Informe o nome do documento.", confirmButtonColor:"#004aad" });
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

function deleteDocumentItem(id){
  Swal.fire({
    title:"Remover documento?",
    text:"Isso apaga do seu perfil (neste protótipo).",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    const list = loadDocuments().filter(x => x.id !== id);
    saveDocuments(list);
    renderDocuments();
  });
}

function iconForDocType(type){
  switch(type){
    case "Currículo": return "fa-file-alt";
    case "Certificado": return "fa-certificate";
    case "Diploma/Declaração": return "fa-graduation-cap";
    case "Portfólio": return "fa-briefcase";
    case "Carteira/Registro": return "fa-id-card";
    default: return "fa-paperclip";
  }
}

function renderDocuments(){
  const host = document.getElementById("docsList");
  const empty = document.getElementById("docsEmpty");
  if(!host) return;

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
    const when = d.date ? escapeHtml(d.date) : (d.updatedAt ? formatDateTimeBrSafe(d.updatedAt) : "—");
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

function seedDocuments(){
  const list = loadDocuments();
  if(list.length > 0){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplos.", confirmButtonColor:"#004aad" });
    return;
  }

  const now = new Date().toISOString();
  const demo = [
    {
      id: uid(),
      type: "Currículo",
      name: "Currículo — versão 2026",
      link: "",
      date: "01/2026",
      notes: "Versão atualizada com experiências e projetos recentes.",
      fileName: "curriculo_2026.pdf",
      createdAt: now,
      updatedAt: now
    },
    {
      id: uid(),
      type: "Certificado",
      name: "Certificação Excel Avançado",
      link: "https://drive.google.com/",
      date: "2024",
      notes: "Certificado SENAI • dashboards e tabelas dinâmicas.",
      fileName: "",
      createdAt: now,
      updatedAt: now
    }
  ];

  saveDocuments(demo);
  renderDocuments();
  Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
}

function resetDocuments(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Documentos & Anexos?",
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(DOCS_STORAGE_KEY);
    renderDocuments();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
  });
}

function downloadDocumentsSummary(){
  const list = loadDocuments();
  const lines = [];
  lines.push("Liotécnica — Resumo de Documentos & Anexos (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  if(list.length === 0){
    lines.push("Nenhum documento anexado.");
  }else{
    list.forEach(d => {
      lines.push(`${d.type || "Outros"}: ${d.name} | Arquivo: ${(d.fileName||"—")} | Link: ${(d.link||"—")} | Data: ${(d.date||"—")}`);
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
// Aba: Referências Profissionais
// ======================================
const REFS_STORAGE_KEY = "liotec_portal_refs_v1";

function loadReferences(){
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

function __saveRefPayload(payload, list){
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
  }).then(r=>{
    if(!r.isConfirmed) return;
    const list = loadReferences().filter(x => x.id !== id);
    saveReferences(list);
    renderReferences();
  });
}

function renderReferences(){
  const host = document.getElementById("refsList");
  const empty = document.getElementById("refsEmpty");
  if(!host) return;

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

function seedReferences(){
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

  saveReferences(demo);
  renderReferences();
  Swal.fire({ icon:"success", title:"Exemplos inseridos!", confirmButtonColor:"#004aad" });
}

function resetReferences(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Referências?",
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(REFS_STORAGE_KEY);
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
// Aba: Acessibilidade & Inclusão
// ======================================
const A11Y_STORAGE_KEY = "liotec_portal_a11y_v1";
let __a11yHydratedOnce = false;
let __a11ySaveTimer = null;

function defaultA11y(){
  return {
    language: "",
    channel: "",
    bestTime: "",
    commNotes: "",

    needCaptions: false,
    needInterpreter: false,
    needScreenReader: false,
    needLowStim: false,
    needMobility: false,
    needExtraTime: false,
    needsDetails: "",

    pcdConsent: false,
    pcdYesNo: "",
    pcdType: "",
    pcdProof: "",
    pcdNotes: "",

    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function loadA11y(){
  try{
    const raw = storageGet(A11Y_STORAGE_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch{
    return null;
  }
}

function saveA11yToStorage(obj){
  try{ storageSet(A11Y_STORAGE_KEY, JSON.stringify(obj)); }catch{}
}

function hydrateA11y(){
  if(__a11yHydratedOnce) return;
  __a11yHydratedOnce = true;

  const a = loadA11y() || defaultA11y();
  saveA11yToStorage(a);

  const setVal = (id, val) => { const el = document.getElementById(id); if(el) el.value = val ?? ""; };
  const setChk = (id, val) => { const el = document.getElementById(id); if(el) el.checked = !!val; };

  setVal("a11yLanguage", a.language);
  setVal("a11yChannel", a.channel);
  setVal("a11yBestTime", a.bestTime);
  setVal("a11yCommNotes", a.commNotes);

  setChk("a11yNeedCaptions", a.needCaptions);
  setChk("a11yNeedInterpreter", a.needInterpreter);
  setChk("a11yNeedScreenReader", a.needScreenReader);
  setChk("a11yNeedLowStim", a.needLowStim);
  setChk("a11yNeedMobility", a.needMobility);
  setChk("a11yNeedExtraTime", a.needExtraTime);
  setVal("a11yNeedsDetails", a.needsDetails);

  setChk("a11yPcdConsent", a.pcdConsent);
  setVal("a11yPcdYesNo", a.pcdYesNo);
  setVal("a11yPcdType", a.pcdType);
  setVal("a11yPcdProof", a.pcdProof);
  setVal("a11yPcdNotes", a.pcdNotes);

  toggleA11yPcdFields(true);
  renderA11yPcdBadge(a);
}

function getA11yFromUI(){
  const val = (id) => (document.getElementById(id)?.value || "").trim();
  const chk = (id) => !!document.getElementById(id)?.checked;

  return {
    language: val("a11yLanguage"),
    channel: val("a11yChannel"),
    bestTime: val("a11yBestTime"),
    commNotes: val("a11yCommNotes"),

    needCaptions: chk("a11yNeedCaptions"),
    needInterpreter: chk("a11yNeedInterpreter"),
    needScreenReader: chk("a11yNeedScreenReader"),
    needLowStim: chk("a11yNeedLowStim"),
    needMobility: chk("a11yNeedMobility"),
    needExtraTime: chk("a11yNeedExtraTime"),
    needsDetails: val("a11yNeedsDetails"),

    pcdConsent: chk("a11yPcdConsent"),
    pcdYesNo: val("a11yPcdYesNo"),
    pcdType: val("a11yPcdType"),
    pcdProof: val("a11yPcdProof"),
    pcdNotes: val("a11yPcdNotes")
  };
}

function saveA11y(){
  const existing = loadA11y() || defaultA11y();
  const ui = getA11yFromUI();

  const merged = {
    ...existing,
    ...ui,
    updatedAt: new Date().toISOString()
  };

  // se não tem consentimento, zera campos PcD por segurança
  if(!merged.pcdConsent){
    merged.pcdYesNo = "";
    merged.pcdType = "";
    merged.pcdProof = "";
    merged.pcdNotes = "";
  }

  saveA11yToStorage(merged);
  renderA11yPcdBadge(merged);
}

function saveA11yDebounced(){
  clearTimeout(__a11ySaveTimer);
  __a11ySaveTimer = setTimeout(() => saveA11y(), 250);
}

function toggleA11yPcdFields(skipSave){
  const consent = !!document.getElementById("a11yPcdConsent")?.checked;
  const box = document.getElementById("a11yPcdFields");
  if(box) box.style.display = consent ? "block" : "none";

  if(!skipSave) saveA11y();
}

function renderA11yPcdBadge(a){
  const badge = document.getElementById("a11yPcdBadge");
  if(!badge) return;

  if(!a?.pcdConsent){
    badge.className = "badge rounded-pill bg-secondary";
    badge.textContent = "Não informado";
    return;
  }

  const yn = (a.pcdYesNo || "").trim();
  if(!yn){
    badge.className = "badge rounded-pill bg-warning text-dark";
    badge.textContent = "Consentido (sem detalhes)";
    return;
  }

  if(yn === "Sim"){
    badge.className = "badge rounded-pill bg-success";
    badge.textContent = a.pcdType ? `PcD • ${a.pcdType}` : "PcD • Sim";
  }else if(yn === "Não"){
    badge.className = "badge rounded-pill bg-primary";
    badge.textContent = "PcD • Não";
  }else{
    badge.className = "badge rounded-pill bg-secondary";
    badge.textContent = "Prefiro não dizer";
  }
}

function renderA11y(){
  hydrateA11y();
  const a = loadA11y() || defaultA11y();
  renderA11yPcdBadge(a);
}

function seedA11y(){
  const a = loadA11y() || defaultA11y();

  const hasAny = !!(a.language || a.channel || a.commNotes || a.needsDetails || a.pcdConsent);
  if(hasAny){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplo.", confirmButtonColor:"#004aad" });
    return;
  }

  a.language = "Português";
  a.channel = "WhatsApp";
  a.bestTime = "Comercial";
  a.commNotes = "Prefiro receber detalhes por escrito antes de ligações.";

  a.needCaptions = true;
  a.needInterpreter = false;
  a.needScreenReader = false;
  a.needLowStim = true;
  a.needMobility = false;
  a.needExtraTime = true;
  a.needsDetails = "Em entrevistas online, gosto de pausas entre etapas e perguntas objetivas.";

  // exemplo SEM PcD (fica só em acessibilidade geral)
  a.pcdConsent = false;
  a.updatedAt = new Date().toISOString();

  saveA11yToStorage(a);
  __a11yHydratedOnce = false;
  renderA11y();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetA11y(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Acessibilidade & Inclusão?",
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(A11Y_STORAGE_KEY);
    __a11yHydratedOnce = false;
    renderA11y();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
  });
}

function downloadA11ySummary(){
  const a = loadA11y() || defaultA11y();

  const lines = [];
  lines.push("Liotécnica — Resumo Acessibilidade & Inclusão (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  lines.push("Preferências de comunicação:");
  lines.push(`- Idioma: ${a.language || "—"}`);
  lines.push(`- Canal: ${a.channel || "—"}`);
  lines.push(`- Melhor horário: ${a.bestTime || "—"}`);
  lines.push(`- Obs.: ${a.commNotes || "—"}`);
  lines.push("");

  lines.push("Necessidades de acessibilidade:");
  const flags = [];
  if(a.needCaptions) flags.push("Legendas");
  if(a.needInterpreter) flags.push("Intérprete Libras");
  if(a.needScreenReader) flags.push("Leitor de tela");
  if(a.needLowStim) flags.push("Baixa estimulação");
  if(a.needMobility) flags.push("Acessibilidade física");
  if(a.needExtraTime) flags.push("Tempo adicional");
  lines.push("- Itens: " + (flags.length ? flags.join(", ") : "—"));
  lines.push("- Detalhes: " + (a.needsDetails || "—"));
  lines.push("");

  lines.push("PcD (opcional):");
  lines.push("- Consentimento: " + (a.pcdConsent ? "SIM" : "NÃO"));
  if(a.pcdConsent){
    lines.push("- PcD: " + (a.pcdYesNo || "—"));
    lines.push("- Tipo: " + (a.pcdType || "—"));
    lines.push("- Laudo/Comprovação: " + (a.pcdProof || "—"));
    lines.push("- Notas: " + (a.pcdNotes || "—"));
  }

  const blob = new Blob([lines.join("\n")], { type:"text/plain;charset=utf-8" });
  const dl = document.createElement("a");
  dl.href = URL.createObjectURL(blob);
  dl.download = "resumo-acessibilidade-liotecnica.txt";
  document.body.appendChild(dl);
  dl.click();
  URL.revokeObjectURL(dl.href);
  dl.remove();
}



// ======================================
// Aba: Disponibilidade & Agenda
// ======================================
const AGENDA_STORAGE_KEY = "liotec_portal_agenda_v1";
let __agendaHydratedOnce = false;
let __agendaSaveTimer = null;

function __fmtIsoOrFallback(iso){
  try{
    if(typeof formatDateTimeBrSafe === "function") return formatDateTimeBrSafe(iso);
  }catch{}
  try{
    const d = new Date(iso);
    if(isNaN(d.getTime())) return "—";
    return d.toLocaleString("pt-BR");
  }catch{ return "—"; }
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
  try{ storageSet(AGENDA_STORAGE_KEY, JSON.stringify(obj)); }catch{}
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

function saveAgendaBlock(){
  const a = loadAgenda() || defaultAgenda();
  a.blocks = Array.isArray(a.blocks) ? a.blocks : [];

  const id = (document.getElementById("agBlockId").value || "").trim() || uid();
  const type = (document.getElementById("agBlockType").value || "Outro").trim();
  const title = (document.getElementById("agBlockTitle").value || "").trim();
  const date = (document.getElementById("agBlockDate").value || "").trim();
  const hours = (document.getElementById("agBlockHours").value || "").trim();
  const notes = (document.getElementById("agBlockNotes").value || "").trim();

  if(!title || !date){
    Swal.fire({ icon:"warning", title:"Faltou algo", text:"Informe Título e Data.", confirmButtonColor:"#004aad" });
    return;
  }

  const payload = {
    id, type, title, date, hours, notes,
    updatedAt: new Date().toISOString(),
    createdAt: (a.blocks.find(x=>x.id===id)?.createdAt) || new Date().toISOString()
  };

  const idx = a.blocks.findIndex(x => x.id === id);
  if(idx >= 0) a.blocks[idx] = payload;
  else a.blocks.push(payload);

  // ordena por updatedAt desc por padrão
  a.blocks.sort((x,y)=>String(y.updatedAt||"").localeCompare(String(x.updatedAt||"")));
  a.updatedAt = new Date().toISOString();

  saveAgendaToStorage(a);

  bootstrap.Modal.getInstance(document.getElementById("agendaBlockModal"))?.hide();
  renderAgendaBlocks();

  Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Bloqueio salvo", showConfirmButton:false, timer:1900 });
}

function deleteAgendaBlock(id){
  Swal.fire({
    title:"Remover bloqueio?",
    text:"Isso apaga do seu perfil (neste protótipo).",
    icon:"warning",
    showCancelButton:true,
    confirmButtonText:"Remover",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
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
      case "Saúde": return "bg-danger";
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
                <i class="far fa-calendar-alt me-1"></i>${escapeHtml(b.date || "—")}
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
  hydrateAgenda();
  renderAgendaBlocks();
}

function seedAgenda(){
  const existing = loadAgenda();
  if(existing && (existing.startDate || existing.notes || (existing.blocks||[]).length)){
    Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplo.", confirmButtonColor:"#004aad" });
    return;
  }

  const a = defaultAgenda();
  a.interviewMode = "Online";
  a.startDate = "Imediato";
  a.notice = "A combinar";
  a.notes = "Prefiro confirmação por WhatsApp e entrevistas com 24h de antecedência.";
  a.days = { mon:true, tue:true, wed:true, thu:true, fri:true, sat:false, sun:false };
  a.times = { morning:true, afternoon:true, evening:false };
  a.preferredHours = "09:00–11:00";
  a.timezone = "America/Sao_Paulo";
  a.blocks = [
    { id: uid(), type:"Saúde", title:"Consulta médica", date:"30/01/2026", hours:"14:00–16:00", notes:"Indisponível nesse período.", createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() }
  ];
  a.updatedAt = new Date().toISOString();

  saveAgendaToStorage(a);
  __agendaHydratedOnce = false;
  renderAgenda();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetAgenda(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Disponibilidade & Agenda?",
    text:"Isso apaga os dados desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(AGENDA_STORAGE_KEY);
    __agendaHydratedOnce = false;
    renderAgenda();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Aba limpa.", confirmButtonColor:"#004aad" });
  });
}

function downloadAgendaSummary(){
  const a = loadAgenda() || defaultAgenda();

  const yesNo = (v)=> v ? "Sim" : "Não";
  const days = [
    ["Seg", a.days.mon], ["Ter", a.days.tue], ["Qua", a.days.wed],
    ["Qui", a.days.thu], ["Sex", a.days.fri], ["Sáb", a.days.sat], ["Dom", a.days.sun]
  ].filter(x=>x[1]).map(x=>x[0]).join(", ") || "—";

  const times = [
    ["Manhã", a.times.morning], ["Tarde", a.times.afternoon], ["Noite", a.times.evening]
  ].filter(x=>x[1]).map(x=>x[0]).join(", ") || "—";

  const lines = [];
  lines.push("Liotécnica — Resumo Disponibilidade & Agenda (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  lines.push("Preferências gerais:");
  lines.push(`- Entrevista: ${a.interviewMode || "—"}`);
  lines.push(`- Início disponível: ${a.startDate || "—"}`);
  lines.push(`- Aviso prévio: ${a.notice || "—"}`);
  lines.push(`- Observações: ${a.notes || "—"}`);
  lines.push("");

  lines.push("Disponibilidade:");
  lines.push(`- Dias: ${days}`);
  lines.push(`- Períodos: ${times}`);
  lines.push(`- Horário preferido: ${a.preferredHours || "—"}`);
  lines.push(`- Fuso: ${a.timezone || "—"}`);
  lines.push("");

  lines.push("Bloqueios:");
  if(!a.blocks || a.blocks.length === 0){
    lines.push("- Nenhum bloqueio cadastrado.");
  }else{
    (a.blocks||[]).forEach(b=>{
      lines.push(`- ${b.type||"Outro"}: ${b.title} | ${b.date||"—"} ${b.hours?("("+b.hours+")"):""} | ${b.notes||""}`.trim());
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
// Aba: Notificações & Comunicação
// ======================================
const NOTIFY_STORAGE_KEY = "liotec_portal_notify_v1";
let __notifyHydratedOnce = false;
let __notifySaveTimer = null;

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

function loadNotify(){
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
  try{ storageSet(NOTIFY_STORAGE_KEY, JSON.stringify(obj)); }catch{}
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
  if(n.types.interview) types.push("Entrevistas");
  if(n.types.messages) types.push("Mensagens");
  if(n.types.docs) types.push("Docs");
  if(n.types.reminders) types.push("Lembretes");

  const quiet = (n.quiet.enabled === "Sim")
    ? `Silêncio: ${n.quiet.start}–${n.quiet.end} (${n.quiet.priority})`
    : "Sem silêncio";

  el.textContent = `${channels.join(", ") || "Nenhum canal"} • ${n.frequency} • ${types.join(", ") || "Sem alertas"} • ${quiet}`;
}

function testNotify(){
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
    title: "Teste de notificação (simulado)",
    html: `
      <div class="text-start">
        <div class="text-muted small mb-2">Canais ativos:</div>
        <div class="fw-bold mb-2">${escapeHtml(channels.join(", ") || "Nenhum")}</div>

        <div class="text-muted small mb-2">Frequência:</div>
        <div class="fw-bold mb-2">${escapeHtml(n.frequency)}</div>

        <div class="text-muted small mb-2">Horário silencioso:</div>
        <div class="fw-bold">${escapeHtml(quietOn ? `${n.quiet.start}–${n.quiet.end} (${n.quiet.priority})` : "Desativado")}</div>

        <hr>

        <div class="text-muted small">Exemplo:</div>
        <div class="p-3 border rounded" style="border-radius:14px;background:#f8f9fa;">
          <div class="fw-bold">Atualização de candidatura</div>
          <div class="small text-muted">Sua candidatura avançou para <strong>Entrevista</strong>.</div>
          ${n.signature ? `<div class="small text-muted mt-2">${escapeHtml(n.signature)}</div>` : ""}
        </div>
      </div>
    `,
    confirmButtonText: "Ok",
    confirmButtonColor: "#004aad"
  });
}

function seedNotify(){
  const existing = loadNotify();
  if(existing && (existing.emailAddr || existing.phone || existing.updatedAt)){
    // só evita overwriting se já tiver algo significativo
    const hasAny = (existing.emailAddr || "").trim() || (existing.phone || "").trim();
    const hasPrefs = existing && existing.channels && (existing.channels.sms || existing.channels.push);
    if(hasAny || hasPrefs){
      Swal.fire({ icon:"info", title:"Já existe conteúdo", text:"Limpe antes para inserir exemplo.", confirmButtonColor:"#004aad" });
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
  n.signature = "Obrigado! — (Seu nome)";
  n.updatedAt = new Date().toISOString();

  saveNotifyToStorage(n);
  __notifyHydratedOnce = false;
  renderNotify();

  Swal.fire({ icon:"success", title:"Exemplo inserido!", confirmButtonColor:"#004aad" });
}

function resetNotify(){
  Swal.fire({
    icon:"warning",
    title:"Limpar Notificações?",
    text:"Isso apaga as preferências desta aba neste navegador.",
    showCancelButton:true,
    confirmButtonText:"Limpar",
    confirmButtonColor:"#004aad",
    cancelButtonText:"Cancelar"
  }).then(r=>{
    if(!r.isConfirmed) return;
    storageRemove(NOTIFY_STORAGE_KEY);
    __notifyHydratedOnce = false;
    renderNotify();
    Swal.fire({ icon:"success", title:"Pronto!", text:"Preferências limpas.", confirmButtonColor:"#004aad" });
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
  if(n.types.newJobs) types.push("Novas vagas");
  if(n.types.appUpdates) types.push("Atualização de status");
  if(n.types.interview) types.push("Entrevistas");
  if(n.types.messages) types.push("Mensagens do RH");
  if(n.types.docs) types.push("Documentos");
  if(n.types.reminders) types.push("Lembretes");

  const lines = [];
  lines.push("Liotécnica — Resumo Notificações & Comunicação (MVP)");
  lines.push("Gerado em: " + new Date().toLocaleString("pt-BR"));
  lines.push("");

  lines.push("Canais:");
  lines.push("- Ativos: " + (channels.join(", ") || "Nenhum"));
  lines.push("- Frequência: " + (n.frequency || "—"));
  lines.push("- Idioma: " + (n.lang || "—"));
  lines.push("- E-mail: " + (n.emailAddr || "—"));
  lines.push("- Telefone: " + (n.phone || "—"));
  lines.push("- Autorizo contato (operacional): " + (n.allowContact ? "Sim" : "Não"));
  lines.push("");

  lines.push("Tipos de alerta:");
  lines.push("- " + (types.join(", ") || "Nenhum"));
  lines.push("");

  lines.push("Horário silencioso:");
  lines.push("- Ativo: " + (n.quiet.enabled || "Não"));
  lines.push("- Início: " + (n.quiet.start || "—"));
  lines.push("- Fim: " + (n.quiet.end || "—"));
  lines.push("- Prioridade: " + (n.quiet.priority || "—"));
  lines.push("");

  lines.push("Assinatura:");
  lines.push("- " + (n.signature || "—"));

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
  hydrateNotify();
  updateNotifyPreview();
}

(function normalizePortalStorage(){
  const keys = [
    RH_TESTS_STORAGE_KEY,
    EXP_PROJ_STORAGE_KEY,
    SKILLS_PORTF_STORAGE_KEY,
    EDUCATION_STORAGE_KEY,
    LGPD_STORAGE_KEY,
    PREFS_STORAGE_KEY,
    DOCS_STORAGE_KEY,
    REFS_STORAGE_KEY,
    A11Y_STORAGE_KEY,
    AGENDA_STORAGE_KEY,
    APPS_HISTORY_STORAGE_KEY,
    NOTIFY_STORAGE_KEY
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
