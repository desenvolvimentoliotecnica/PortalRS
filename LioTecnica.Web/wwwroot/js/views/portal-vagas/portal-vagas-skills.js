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

  const prefSalaryInputs = document.querySelectorAll("#prefSalary");
  prefSalaryInputs.forEach((input) => {
    if (input.dataset.masked) return;
    input.dataset.masked = "1";
    input.addEventListener("input", () => formatCurrencyInput(input));
    input.addEventListener("blur", () => formatCurrencyInput(input));
  });

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
