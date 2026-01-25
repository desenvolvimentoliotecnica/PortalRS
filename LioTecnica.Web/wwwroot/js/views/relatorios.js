// ========= Logo (Data URI placeholder)
    const LOGO_DATA_URI = "data:image/webp;base64,UklGRngUAABXRUJQVlA4IGwUAAAQYwCdASpbAVsBPlEokUajoqGhIpNoyHAK7AQYJjYQmG9Dtu/6p6QZ4lQd6lPde+Jk3i3kG2EoP+QW0c0h8Oe3jW2C5zE0o9jzZ1x2fX9cZlX0d7rW8r0vQ9p3d2nJ1bqzQfQZxVwTt7mJvU8j1GqF4oJc8Qb+gq+oQyHcQyYc2b9u2fYf0Rj9x9hRZp2Y2xK0yVQ8Hj4p6w8B1K2cKk2mY9m2r8kz3a4m7xG4xg9m5VjzP3E4RjQH8fYkC4mB8g0vR3c5h1D0yE8Qzv7t7gQj0Z9yKk3cWZgVnq3l1kq6rE8oWc4z6oZk8k0b1o9m8p2m+QJ3nJm6GgA=";
    const REPORTS_API_BASE = "/Relatorios/_api";

    function enumFirstCode(key, fallback){
      const list = getEnumOptions(key);
      return list.length ? list[0].code : fallback;
    }

    let VAGA_ALL = enumFirstCode("vagaFilterSimple", "all");
    const EMPTY_TEXT = "—";

    const state = {
      reportId: "r1",
      filters: { period:"30d", vaga:"all", origem:"all", status:"all", q:"" },
      reports: [],
      vagas: [],
      currentReport: null
    };

    async function apiFetchJson(url, options = {}){
      const opts = { ...options };
      opts.headers = { "Accept": "application/json", ...(opts.headers || {}) };
      const res = await fetch(url, opts);
      if(!res.ok){
        const message = await res.text();
        throw new Error(message || `Falha na API (${res.status}).`);
      }
      if(res.status === 204) return null;
      return res.json();
    }

    function setText(root, role, value, fallback = EMPTY_TEXT){
      if(!root) return;
      const el = root.querySelector(`[data-role="${role}"]`);
      if(!el) return;
      el.textContent = (value ?? fallback);
    }

    function setIconText(el, iconClass, text){
      if(!el) return;
      el.replaceChildren();
      const icon = document.createElement("i");
      icon.className = "bi " + iconClass + " me-1";
      el.appendChild(icon);
      el.appendChild(document.createTextNode(text ?? ""));
    }

    function buildQueryParams(){
      const params = new URLSearchParams();
      if(state.filters.period) params.set("period", state.filters.period);
      if(state.filters.vaga && state.filters.vaga !== VAGA_ALL) params.set("vagaId", state.filters.vaga);
      if(state.filters.origem && state.filters.origem !== "all") params.set("origem", state.filters.origem);
      if(state.filters.status && state.filters.status !== "all") params.set("status", state.filters.status);
      if(state.filters.q) params.set("q", state.filters.q);
      return params.toString();
    }

    async function loadCatalog(){
      const data = await apiFetchJson(`${REPORTS_API_BASE}/catalog`, { method: "GET" });
      state.reports = Array.isArray(data) ? data : [];
    }

    async function loadVagas(){
      const data = await apiFetchJson(`${REPORTS_API_BASE}/vagas`, { method: "GET" });
      state.vagas = Array.isArray(data) ? data : [];
    }

    function renderReportCatalog(){
      const host = $("#reportList");
      host.replaceChildren();

      state.reports.forEach(r => {
        const tile = cloneTemplate("tpl-report-tile");
        if(!tile) return;

        tile.dataset.id = r.id;
        if(r.id === state.reportId) tile.classList.add("active");

        const icon = tile.querySelector('[data-role="tile-icon"]');
        if(icon) icon.className = "bi bi-" + r.icon;
        setText(tile, "tile-title", r.title);
        setText(tile, "tile-desc", r.desc);
        setText(tile, "tile-scope", r.scope);

        tile.addEventListener("click", () => {
          state.reportId = r.id;
          renderReportCatalog();
          void renderReport();
        });

        host.appendChild(tile);
      });
    }

    function renderVagaOptions(){
      const sel = $("#fVaga");
      const current = sel.value || VAGA_ALL;
      sel.replaceChildren();
      getEnumOptions("vagaFilterSimple").forEach(opt => {
        sel.appendChild(buildOption(opt.code, opt.text, opt.code === current));
      });
      state.vagas
        .slice()
        .sort((a,b)=> (a.titulo||"").localeCompare(b.titulo||""))
        .forEach(v => {
          sel.appendChild(buildOption(v.id, `${v.titulo} (${v.codigo||EMPTY_TEXT})`, v.id === current));
        });
      sel.value = state.filters.vaga || current || VAGA_ALL;
    }


    function renderOrigemOptions(){
      const sel = $("#fOrigem");
      if(!sel) return;
      const current = sel.value || "all";
      sel.replaceChildren();
      sel.appendChild(buildOption("all", "Origem: todas", current === "all"));
      getEnumOptions("origemFilterSimple").forEach(opt => {
        sel.appendChild(buildOption(opt.code, opt.text, opt.code === current));
      });
      sel.value = current;
    }

    // ========= Chart (canvas simples sem libs)
    function drawBarChart(labels, values){
      const canvas = $("#chart");
      const ctx = canvas.getContext("2d");

      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.scale(dpr, dpr);

      const W = rect.width, H = rect.height;
      ctx.clearRect(0,0,W,H);

      const padL = 46, padR = 16, padT = 16, padB = 42;
      const chartW = W - padL - padR;
      const chartH = H - padT - padB;

      ctx.fillStyle = "rgba(255,255,255,0.0)";
      ctx.fillRect(0,0,W,H);

      const maxV = Math.max(1, ...values);
      const n = labels.length;
      const gap = 10;
      const barW = n ? (chartW - gap*(n-1)) / n : chartW;

      ctx.strokeStyle = "rgba(16,82,144,.14)";
      ctx.lineWidth = 1;
      for(let i=0;i<=4;i++){
        const y = padT + (chartH*(i/4));
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(padL+chartW, y);
        ctx.stroke();
      }

      for(let i=0;i<n;i++){
        const v = values[i];
        const h = (v / maxV) * chartH;
        const x = padL + i*(barW+gap);
        const y = padT + (chartH - h);

        const grd = ctx.createLinearGradient(x, y, x+barW, y);
        grd.addColorStop(0, "rgba(16,82,144,.95)");
        grd.addColorStop(1, "rgba(12,58,100,.95)");
        ctx.fillStyle = grd;
        roundRect(ctx, x, y, barW, h, 10, true, false);

        ctx.fillStyle = "rgba(13,27,42,.78)";
        ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial";
        const val = String(v);
        ctx.fillText(val, x + (barW/2) - (ctx.measureText(val).width/2), y - 6);

        ctx.fillStyle = "rgba(13,27,42,.70)";
        ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial";
        const lab = labels[i];
        const lw = ctx.measureText(lab).width;
        ctx.fillText(lab, x + (barW/2) - (lw/2), padT + chartH + 26);
      }

      ctx.fillStyle = "rgba(13,27,42,.60)";
      ctx.font = "12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Helvetica, Arial";
      ctx.fillText("0", 18, padT + chartH + 4);
      const m = String(maxV);
      ctx.fillText(m, 18, padT + 12);

      ctx.strokeStyle = "rgba(16,82,144,.22)";
      ctx.beginPath();
      ctx.moveTo(padL, padT);
      ctx.lineTo(padL, padT+chartH);
      ctx.lineTo(padL+chartW, padT+chartH);
      ctx.stroke();
    }

    function roundRect(ctx, x, y, w, h, r, fill, stroke){
      r = Math.min(r, w/2, h/2);
      ctx.beginPath();
      ctx.moveTo(x+r, y);
      ctx.arcTo(x+w, y, x+w, y+h, r);
      ctx.arcTo(x+w, y+h, x, y+h, r);
      ctx.arcTo(x, y+h, x, y, r);
      ctx.arcTo(x, y, x+w, y, r);
      ctx.closePath();
      if(fill) ctx.fill();
      if(stroke) ctx.stroke();
    }

    function renderCell(td, cell){
      if(cell == null){
        td.textContent = "";
        return;
      }
      if(typeof cell === "object" && !Array.isArray(cell)){
        const span = document.createElement("span");
        if(cell.className) span.className = cell.className;
        if(cell.icon){
          const icon = document.createElement("i");
          icon.className = "bi " + cell.icon + " me-1";
          span.appendChild(icon);
        }
        span.appendChild(document.createTextNode(cell.text ?? ""));
        td.appendChild(span);
        return;
      }
      td.textContent = cell;
    }

    function setTable(headers, rows){
      const theadRow = $("#theadRow");
      const tbody = $("#tbodyRows");
      if(!theadRow || !tbody) return;

      theadRow.replaceChildren();
      (headers || []).forEach(h => {
        const th = document.createElement("th");
        th.textContent = h ?? "";
        theadRow.appendChild(th);
      });

      tbody.replaceChildren();
      (rows || []).forEach(row => {
        const tr = document.createElement("tr");
        (row || []).forEach(cell => {
          const td = document.createElement("td");
          renderCell(td, cell);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      const countEl = $("#rowCount");
      if(countEl) countEl.textContent = String((rows || []).length);
    }

    function refreshEnumDefaults(){
      VAGA_ALL = enumFirstCode("vagaFilterSimple", "all");
    }

    async function fetchReportData(){
      const query = buildQueryParams();
      const qs = query ? `?${query}` : "";

      switch(state.reportId){
        case "r1":
          return apiFetchJson(`${REPORTS_API_BASE}/entrada-origem${qs}`, { method: "GET" });
        case "r2":
          return apiFetchJson(`${REPORTS_API_BASE}/falhas-processamento${qs}`, { method: "GET" });
        case "r3":
          return apiFetchJson(`${REPORTS_API_BASE}/pipeline-status${qs}`, { method: "GET" });
        case "r4":
          return apiFetchJson(`${REPORTS_API_BASE}/funil-vaga${qs}`, { method: "GET" });
        case "r5":
          return apiFetchJson(`${REPORTS_API_BASE}/ranking-matching${qs}&take=12`, { method: "GET" });
        default:
          return { labels:[], values:[], headers:[], rows:[] };
      }
    }

    async function renderReport(){
      const r = state.reports.find(x => x.id === state.reportId);
      $("#reportTitle").textContent = r ? r.title : "•";
      $("#reportDesc").textContent = r ? r.desc : "Selecione um relatório no catálogo.";

      const data = await fetchReportData();
      state.currentReport = data;

      setIconText($("#tagScope"), "bi-sliders", r?.scope || "escopo");
      setIconText($("#tagFresh"), "bi-clock-history", "atual");

      const labels = Array.isArray(data?.labels) ? data.labels : [];
      const values = Array.isArray(data?.values) ? data.values : [];
      drawBarChart(labels, values);

      setTable(data?.headers || [], data?.rows || []);

      const p = state.filters.period;
      const pl = p==="7d"?"7 dias":p==="30d"?"30 dias":p==="90d"?"90 dias":"YTD";
      $("#resultHint").textContent = `Periodo: ${pl} • Vaga: ${state.filters.vaga === "all" ? "todas" : "filtrada"} • Origem/Status: conforme filtros.`;
    }

    function exportCurrentCsv(){
      const data = state.currentReport || { headers: [], rows: [] };
      const headers = data.headers || [];
      const rows = data.rows || [];

      const cellText = (cell) => {
        if(cell == null) return "";
        if(typeof cell === "object" && !Array.isArray(cell)) return String(cell.text ?? "").trim();
        return String(cell).trim();
      };

      const csv = [
        headers.map(h => `"${String(h).replaceAll('"','""')}"`).join(";"),
        ...rows.map(r => r.map(c => `"${cellText(c).replaceAll('"','""')}"`).join(";"))
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `relatorio_${state.reportId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function initLogo(){
      $("#logoDesktop").src = LOGO_DATA_URI;
      $("#logoMobile").src = LOGO_DATA_URI;
    }

    function wireClock(){
      const now = new Date();
      const buildEl = $("#buildId");
      if(buildEl){
        buildEl.textContent = "build: api-" + String(now.getFullYear()).slice(2) + "-" + String(now.getMonth()+1).padStart(2,"0");
      }

      const label = $("#nowLabel");
      if(!label) return;
      const tick = () => {
        const d = new Date();
        label.textContent = d.toLocaleString("pt-BR", { weekday:"short", day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" });
      };
      tick();
      setInterval(tick, 1000*15);
    }

    function wireFilters(){
      $("#fPeriod").value = state.filters.period;
      $("#fOrigem").value = state.filters.origem;
      $("#fStatus").value = state.filters.status;
      $("#fSearch").value = state.filters.q;

      $("#btnApply").addEventListener("click", () => {
        state.filters.period = $("#fPeriod").value;
        state.filters.vaga = $("#fVaga").value;
        state.filters.origem = $("#fOrigem").value;
        state.filters.status = $("#fStatus").value;
        state.filters.q = ($("#fSearch").value||"").trim();
        void renderReport();
      });

      $("#btnClear").addEventListener("click", () => {
        state.filters = { period:"30d", vaga:"all", origem:"all", status:"all", q:"" };
        $("#fPeriod").value = state.filters.period;
        $("#fVaga").value = state.filters.vaga;
        $("#fOrigem").value = state.filters.origem;
        $("#fStatus").value = state.filters.status;
        $("#fSearch").value = state.filters.q;
        void renderReport();
      });
    }

    function wireTopButtons(){
      $("#btnRun").addEventListener("click", () => { void renderReport(); });
      $("#btnExport").addEventListener("click", exportCurrentCsv);
      $("#btnRefresh").addEventListener("click", async () => {
        try{
          await Promise.all([loadCatalog(), loadVagas()]);
          renderReportCatalog();
          renderVagaOptions();
      renderOrigemOptions();
          await renderReport();
          toast("Relatorios atualizados.");
        }catch(err){
          console.error(err);
          toast("Falha ao atualizar relatorios.");
        }
      });
    }

    // ========= Init
    (async function init(){
      initLogo();
      wireClock();

      await ensureEnumData();
      refreshEnumDefaults();
      applyEnumSelects();

      try{
        await Promise.all([loadCatalog(), loadVagas()]);
      }catch(err){
        console.error(err);
        toast("Falha ao carregar relatorios.");
      }

      renderReportCatalog();
      renderVagaOptions();
      renderOrigemOptions();
      wireFilters();
      wireTopButtons();

      await renderReport();
      window.addEventListener("resize", () => { void renderReport(); });
    })();





