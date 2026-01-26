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
  










