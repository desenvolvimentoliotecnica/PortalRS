(function () {
    if (window.PortalVagasJobs) return;
    const S = window.PortalVagasStrings;
    const heroGradients = [
    "linear-gradient(135deg, #1e3a8a, #0ea5e9)",
    "linear-gradient(135deg, #0f766e, #22c55e)",
    "linear-gradient(135deg, #7c3aed, #ec4899)",
    "linear-gradient(135deg, #d97706, #f97316)",
    "linear-gradient(135deg, #1d4ed8, #38bdf8)",
    "linear-gradient(135deg, #4f46e5, #6366f1)"
  ];

  const sectionImageMap = [
    { match: "industrial", title: "Industrial & ProduÃƒÂ§ÃƒÂ£o", image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1600" },
    { match: "qualidade", title: "Qualidade & P&D", image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=1600" },
    { match: "logistica", title: "LogÃƒÂ­stica & Supply", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1600" },
    { match: "rh", title: "Administrativo & RH", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600" },
    { match: "administrativo", title: "Administrativo & RH", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600" },
    { match: "comercial", title: "Vendas & Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=1600" },
    { match: "marketing", title: "Vendas & Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=1600" }
  ];

  function parseTags(raw) {
    if (!raw) return [];
    return raw
      .split(/[,;|]/g)
      .map(tag => tag.trim())
      .filter(Boolean);
  }

  function buildTags(job) {
    const tags = [
      ...parseTags(job.tagsKeywordsRaw),
      ...parseTags(job.tagsStackRaw),
      ...parseTags(job.tagsResponsabilidadesRaw)
    ];
    return Array.from(new Set(tags));
  }

  function formatLocation(job) {
    const city = (job.cidade || "").trim();
    const uf = (job.uf || "").trim();
    if (city && uf) return `${city}, ${uf}`;
    if (city) return city;
    if (uf) return uf;
    return job.modalidade || S.jobs.notInformed;
  }

  function normalizeEnum(value) {
    return value || S.jobs.notInformed;
  }

  function formatMoney(min, max) {
    const f = (n) => Number(n || 0).toLocaleString("pt-BR");
    return `R$ ${f(min)} - ${f(max)}`;
  }

  function normalizeKey(value) {
    return (value || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function getSectionInfo(area) {
    const key = normalizeKey(area);
    const match = sectionImageMap.find(x => key.includes(x.match));
    if (match) return match;
    return {
      title: area || S.jobs.sectionFallbackTitle,
      image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=1600"
    };
  }

  function buildJobCard(job, index) {
    const tags = buildTags(job);
    const company = job.tenantName || S.jobs.companyFallback;
    const location = formatLocation(job);
    const mode = normalizeEnum(job.modalidade);
    const type = normalizeEnum(job.tipoContratacao);
    const level = normalizeEnum(job.senioridade);
    const area = job.area || S.jobs.areaFallback;
    const salaryMin = job.salarioMinimo || 0;
    const salaryMax = job.salarioMaximo || 0;
    const createdAt = job.createdAtUtc ? new Date(job.createdAtUtc) : new Date();
    const dateIso = createdAt.toISOString().slice(0, 10);

    const col = document.createElement("div");
    col.className = "col job-item";
    col.dataset.id = job.id;
    col.dataset.title = job.titulo || S.jobs.titleFallback;
    col.dataset.company = company;
    col.dataset.location = location;
    col.dataset.mode = mode;
    col.dataset.type = type;
    col.dataset.level = level;
    col.dataset.area = area;
    col.dataset.tags = tags.join(", ");
    col.dataset.salaryMin = String(salaryMin);
    col.dataset.salaryMax = String(salaryMax);
    col.dataset.date = dateIso;

    const badgeHtml = [mode, type, level]
      .filter(Boolean)
      .map(item => `<span class="badge rounded-pill">${item}</span>`)
      .join("");

    const tagHtml = tags.slice(0, 6)
      .map(tag => `<span class="badge text-bg-light border">${tag}</span>`)
      .join("");

    const salaryLine = salaryMax ? `${S.jobs.salaryLabel}: ${formatMoney(salaryMin, salaryMax)}` : `${S.jobs.salaryLabel}: ${S.jobs.salaryToBeArranged}`;
    const hero = heroGradients[index % heroGradients.length];

    col.innerHTML = `
      <article class="card job-card h-100">
        <div class="job-hero" style="background-image:${hero};">
          <h3 class="job-title-on-hero">${col.dataset.title}</h3>
          <div class="job-badge-row">
            ${badgeHtml}
          </div>
        </div>
        <div class="card-body">
          <div class="text-secondary mb-2">${company}</div>
          <div class="job-meta text-secondary small mb-3">
            <span>${location}</span><span class="dot" aria-hidden="true"></span>
            <span>${area}</span>
          </div>
          <div class="d-flex flex-wrap gap-2 mb-2">
            ${tagHtml || `<span class="badge text-bg-light border">${S.jobs.tagFallback}</span>`}
          </div>
          <div class="text-secondary small">${salaryLine}</div>
          <a class="stretched-link job-link" href="#${col.dataset.id}"
             aria-label="Ver detalhes da vaga ${col.dataset.title}"></a>
        </div>
      </article>`;

    return col;
  }

  function buildSection(info, jobs, startIndex) {
    const section = document.createElement("section");
    section.className = "job-section";

    const header = document.createElement("div");
    header.className = "job-section-hero mb-4";
    header.style.backgroundImage = `url('${info.image}')`;
    header.innerHTML = `
      <div class="job-section-title">
        <span>${info.title}</span>
      </div>
      <span class="job-section-count">${jobs.length} ${S.jobs.vacanciesLabel}</span>
    `;

    const gridEl = document.createElement("div");
    gridEl.className = "row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xxl-4 g-4";

    jobs.forEach((job, idx) => {
      gridEl.appendChild(buildJobCard(job, startIndex + idx));
    });

    section.appendChild(header);
    section.appendChild(gridEl);
    return section;
  }

  function renderResults(resultsCountEl, emptyStateEl, totalItems) {
    if (resultsCountEl) resultsCountEl.textContent = String(totalItems);
    if (emptyStateEl) emptyStateEl.classList.toggle("d-none", totalItems !== 0);
  }

  function buildSummary(item) {
    const title = item.dataset.title;
    const company = item.dataset.company;
    const tags = (item.dataset.tags || "").split(",").map(x => x.trim()).filter(Boolean);
    if (!tags.length) return `${title} em ${company}.`;
    return `${title} em ${company}, com foco em ${tags.slice(0, 3).join(", ")}.`;
  }

  window.PortalVagasJobs = {
    formatMoney,
    buildTags,
    getSectionInfo,
    buildJobCard,
    buildSection,
    renderResults,
    buildSummary
  };
})();
