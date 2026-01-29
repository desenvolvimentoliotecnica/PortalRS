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
      Swal.fire({ icon:"error", title: S.experience.saveErrorTitle, text: S.experience.saveErrorText, confirmButtonColor:"#004aad" });
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById("experienceEditModal"))?.hide();
    renderExperienceProjects();

    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"ExperiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia salva", showConfirmButton:false, timer:2200 });
  }

  function deleteExperience(id){
    Swal.fire({
      title: S.experience.removeTitle,
      text:"Isso apaga do seu perfil (neste protÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³tipo).",
      icon:"warning",
      showCancelButton:true,
      confirmButtonText: S.common.remove,
      confirmButtonColor:"#004aad",
      cancelButtonText: S.common.cancel
    }).then(r=>{
      if(!r.isConfirmed) return;
      Promise.resolve(removeExperience(id)).then(ok => {
        if(!ok){
          Swal.fire({ icon:"error", title: S.experience.removeErrorTitle, text: S.experience.removeErrorText, confirmButtonColor:"#004aad" });
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
      Swal.fire({ icon:"error", title: S.experience.saveErrorTitle, text: S.experience.projectSaveErrorText, confirmButtonColor:"#004aad" });
      return;
    }
    bootstrap.Modal.getInstance(document.getElementById("projectEditModal"))?.hide();
    renderExperienceProjects();

    Swal.fire({ toast:true, position:"top-end", icon:"success", title:"Projeto salvo", showConfirmButton:false, timer:2200 });
  }

  function deleteProject(id){
    Swal.fire({
      title: S.experience.projectRemoveTitle,
      text:"Isso apaga do seu perfil (neste protÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³tipo).",
      icon:"warning",
      showCancelButton:true,
      confirmButtonText: S.common.remove,
      confirmButtonColor:"#004aad",
      cancelButtonText: S.common.cancel
    }).then(r=>{
      if(!r.isConfirmed) return;
      Promise.resolve(removeProject(id)).then(ok => {
        if(!ok){
          Swal.fire({ icon:"error", title: S.experience.removeErrorTitle, text: S.experience.projectRemoveErrorText, confirmButtonColor:"#004aad" });
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

    // ExperiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias
    expList.innerHTML = "";
    if(data.experiences.length === 0){
      expEmpty && (expEmpty.style.display = "block");
    }else{
      expEmpty && (expEmpty.style.display = "none");
      data.experiences.forEach(e => {
        const period = [e.start || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â", e.end || "ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â"].join(" ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ");
        const bullets = (e.bullets||[]).slice(0,3).map(b=>`<li class="small text-muted mb-1">${escapeHtml(b)}</li>`).join("");
        expList.innerHTML += `
          <div class="border rounded p-3" style="border-radius:14px;">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <div class="fw-bold">${escapeHtml(e.role)} <span class="text-muted">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢</span> ${escapeHtml(e.company)}</div>
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
                  <div class="fw-bold">${escapeHtml(p.name)} ${p.period ? `<span class="text-muted small">ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ${escapeHtml(p.period)}</span>` : ""}</div>
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
      badge.title = S.experience.tagRemoveLabel;
    });

    tagArea.addEventListener("click", (event) => {
      const badge = event.target.closest(".badge");
      if(!badge || badge.closest("button")) return;

      const label = (badge.textContent || "").trim();
      Swal.fire({
        title: S.experience.tagRemoveTitle,
        text: `Deseja remover \"${label}\"?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: S.common.remove,
        confirmButtonColor: "#004aad",
        cancelButtonText: S.common.cancel
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
      span.title = S.experience.tagRemoveLabel;
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

  // SeguranÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a simples contra HTML injection no MVP
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
