(function () {
  "use strict";

  const CANDIDATOS_API = window.__candidatosApiUrl || "/api/candidatos";
  const VAGAS_API = window.__vagasApiUrl || "/api/vagas";
  const EMPTY = "—";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function setText(el, value, fallback) {
    if (!el) return;
    el.textContent = (value != null && value !== "") ? String(value) : (fallback != null ? fallback : EMPTY);
  }

  function parsePeso(value) {
    if (value == null) return 0;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const text = (typeof getEnumText === "function" ? getEnumText("vagaPeso", value, "") : "") || "";
    const num = parseInt(text, 10);
    if (Number.isFinite(num)) return num;
    const raw = parseInt((value ?? "").toString().trim(), 10);
    return Number.isFinite(raw) ? raw : 0;
  }

  function normalizeText(s) {
    return (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9#+\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function calcMatch(cand, vaga) {
    if (!cand || !vaga) return { score: 0, pass: false, hits: [], missMandatory: [], totalPeso: 1, hitPeso: 0, threshold: 0 };
    const text = normalizeText(cand.cvText || "");
    const reqs = (vaga.requisitos || []);
    const totalPeso = reqs.reduce((acc, r) => acc + Math.max(0, Math.min(10, parsePeso(r.peso || 0))), 0) || 1;
    let hitPeso = 0;
    const hits = [];
    const missMandatory = [];
    reqs.forEach(r => {
      const termo = normalizeText(r.termo || r.nome || "");
      const syns = (r.sinonimos || []).map(s => normalizeText(String(s))).filter(Boolean);
      const bag = [termo, ...syns].filter(Boolean);
      const found = bag.some(t => t && text.includes(t));
      const p = Math.max(0, Math.min(10, parsePeso(r.peso || 0)));
      if (found) {
        hitPeso += p;
        hits.push(r);
      } else if (r.obrigatorio) {
        missMandatory.push(r);
      }
    });
    let score = Math.round((hitPeso / totalPeso) * 100);
    if (missMandatory.length) score = Math.max(0, score - Math.min(40, missMandatory.length * 15));
    const threshold = Math.max(0, Math.min(100, parseInt(vaga.threshold || vaga.matchMinimoPercentual || 0, 10) || 0));
    return { score, pass: score >= threshold, hits, missMandatory, totalPeso, hitPeso, threshold };
  }

  async function fetchJson(url) {
    const res = await fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } });
    if (res.status === 401) {
      window.location.href = "/Account/Login?returnUrl=" + encodeURIComponent(window.location.pathname + window.location.search);
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error("Falha ao carregar: " + res.status);
    return res.json();
  }

  function renderHeader(c) {
    const initialsEl = $("#detailInitials");
    const nameEl = $("#detailName");
    const emailEl = $("#detailEmail");
    const updatedEl = $("#detailUpdated");
    const statusHost = $("#detailStatusHost");
    const vagaWrap = $("#detailVagaWrap");
    const vagaTitle = $("#detailVagaTitle");
    const thrWrap = $("#detailThrWrap");
    const thrEl = $("#detailThr");
    const recruiterEl = $("#detailRecruiter");

    const initialsText = typeof initials === "function" ? initials(c.nome) : (c.nome || "").substring(0, 2).toUpperCase() || EMPTY;
    if (initialsEl) initialsEl.textContent = initialsText;
    setText(nameEl, c.nome);
    if (emailEl) {
      emailEl.textContent = c.email || EMPTY;
      emailEl.href = "mailto:" + (c.email || "");
    }
    const updatedTxt = typeof fmtDate === "function" ? fmtDate(c.updatedAtUtc || c.updatedAt) : (c.updatedAtUtc || c.updatedAt || EMPTY);
    setText(updatedEl, updatedTxt);

    if (statusHost) {
      const statusText = typeof getEnumText === "function" ? getEnumText("candidatoStatus", c.status, c.status || "") : (c.status || EMPTY);
      statusHost.innerHTML = "";
      const badge = document.createElement("span");
      badge.className = "badge rounded-pill bg-warning text-dark";
      badge.textContent = statusText;
      statusHost.appendChild(badge);
    }

    setText(recruiterEl, (c.applicationRecruiterUserName || "").trim());
  }

  function renderVagaInfo(vaga) {
    const vagaWrap = $("#detailVagaWrap");
    const vagaTitle = $("#detailVagaTitle");
    const thrWrap = $("#detailThrWrap");
    const thrEl = $("#detailThr");
    if (!vaga) {
      if (vagaWrap) vagaWrap.style.display = "none";
      if (thrWrap) thrWrap.style.display = "none";
      return;
    }
    if (vagaWrap) vagaWrap.style.display = "";
    if (vagaTitle) vagaTitle.textContent = vaga.titulo || vaga.codigo || EMPTY;
    if (thrWrap) thrWrap.style.display = "";
    const thrVal = Math.max(0, Math.min(100, parseInt(vaga.threshold || vaga.matchMinimoPercentual || 0, 10) || 0));
    setText(thrEl, thrVal + "%");
  }

  function renderResumo(c) {
    setText($("#detailResumo"), (c.resumoProfissional || "").trim() || null);
    setText($("#detailObs"), (c.obs || "").trim() || null);
  }

  function renderCv(c) {
    const ta = $("#detailCvText");
    if (ta) ta.value = c.cvText || "";
  }

  function renderDocs(c) {
    const host = $("#detailDocList");
    if (!host) return;
    host.replaceChildren();
    const docs = Array.isArray(c.documentos) ? c.documentos : [];
    if (docs.length === 0) {
      const p = document.createElement("p");
      p.className = "text-muted small";
      p.textContent = "Nenhum documento anexado.";
      host.appendChild(p);
      return;
    }
    docs.forEach(d => {
      const name = (d.nome || d.fileName || d.nomeArquivo) || "Documento";
      const link = d.url || d.link;
      const p = document.createElement("p");
      p.className = "mb-1 small";
      if (link) {
        const a = document.createElement("a");
        a.href = link;
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = name;
        p.appendChild(a);
      } else p.textContent = name;
      host.appendChild(p);
    });
  }

  function renderMatch(cand, vaga) {
    const content = $("#matchContent");
    const noVaga = $("#matchNoVaga");
    if (!vaga) {
      if (content) content.classList.add("d-none");
      if (noVaga) noVaga.classList.remove("d-none");
      return;
    }
    if (content) content.classList.remove("d-none");
    if (noVaga) noVaga.classList.add("d-none");

    const m = calcMatch(cand, vaga);
    const score = Math.max(0, Math.min(100, m.score));
    setText($("#matchScore"), score + "%");
    const progressBar = $("#matchProgress");
    if (progressBar) progressBar.style.width = score + "%";
    setText($("#matchThr"), m.threshold + "%");
    setText($("#matchHitsCount"), m.hits.length);
    setText($("#matchMissCount"), m.missMandatory.length);

    const reqList = $("#matchReqList");
    if (reqList) {
      reqList.replaceChildren();
      const reqs = vaga.requisitos || [];
      const hitIds = new Set((m.hits || []).map(x => x.id));
      const missIds = new Set((m.missMandatory || []).map(x => x.id));
      reqs.forEach(r => {
        const isHit = hitIds.has(r.id);
        const isMiss = missIds.has(r.id);
        const div = document.createElement("div");
        div.className = "card-soft p-2 " + (isHit ? "border-success" : isMiss ? "border-danger" : "");
        div.style.boxShadow = "none";
        const icon = isHit ? "bi-check2-circle text-success" : (isMiss ? "bi-x-circle text-danger" : "bi-dash-circle text-muted");
        const termo = r.termo || r.nome || "";
        const peso = parsePeso(r.peso);
        div.innerHTML = "<div class=\"d-flex align-items-center justify-content-between\"><span><i class=\"bi " + icon + " me-1\"></i>" + escapeHtml(termo) + " <span class=\"text-muted small\">Peso: " + peso + "</span> " + (r.obrigatorio ? "<span class=\"text-danger small\">obrigatório</span>" : "") + "</span></div>";
        reqList.appendChild(div);
      });
    }
  }

  function escapeHtml(str) {
    return (str ?? "").toString()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mapVagaRequisitos(v) {
    if (!v || !Array.isArray(v.requisitos)) return v;
    const mapped = { ...v };
    mapped.requisitos = v.requisitos.map(r => ({
      id: r.id,
      termo: r.nome || r.termo || "",
      peso: r.peso,
      obrigatorio: !!r.obrigatorio,
      sinonimos: r.sinonimos || []
    }));
    return mapped;
  }

  async function init() {
    const id = window.__candidatoDetalhesId;
    const vagaId = window.__candidatoDetalhesVagaId;
    if (!id) {
      if (typeof toast === "function") toast("ID do candidato não informado.");
      return;
    }

    const overlay = document.getElementById("globalLoading");
    if (overlay) overlay.classList.add("active");
    try {
      const candidato = await fetchJson(CANDIDATOS_API + "/" + encodeURIComponent(id));
      let vaga = null;
      if (vagaId) {
        try {
          const vagaRaw = await fetchJson(VAGAS_API + "/" + encodeURIComponent(vagaId));
          vaga = mapVagaRequisitos(vagaRaw);
        } catch (e) {
          console.warn("Vaga não encontrada:", e);
        }
      }

      renderHeader(candidato);
      renderVagaInfo(vaga);
      renderResumo(candidato);
      renderCv(candidato);
      renderDocs(candidato);
      renderMatch(candidato, vaga);
    } catch (err) {
      console.error(err);
      if (typeof toast === "function") toast("Falha ao carregar detalhes do candidato.");
    } finally {
      if (overlay) overlay.classList.remove("active");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
