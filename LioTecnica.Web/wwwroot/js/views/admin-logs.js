(() => {
  const apiBase = "/Admin/Logs/_api";
  const ui = (id) => document.getElementById(id);

  const state = {
    page: 1,
    pages: 1,
    pageSize: 50,
    items: []
  };

  function nowLabel() {
    const el = ui("nowLabel");
    if (el) el.textContent = new Date().toLocaleString("pt-BR");
  }

  function toLocalInputValue(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toQuery() {
    const params = new URLSearchParams();
    params.set("page", state.page.toString());
    params.set("pageSize", state.pageSize.toString());
    const search = ui("logsSearch")?.value?.trim();
    const status = ui("logsStatus")?.value?.trim();
    const method = ui("logsMethod")?.value?.trim();
    const from = ui("logsFrom")?.value;
    const to = ui("logsTo")?.value;
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (method) {
      if (method === "nonget") {
        params.set("methods", "POST,PUT,PATCH,DELETE");
      } else {
        params.set("methods", method);
      }
    }
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    return params.toString();
  }

  async function loadLogs() {
    const tbody = ui("logsTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const res = await fetch(`${apiBase}/transactions?${toQuery()}`);
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted small">Erro ao carregar logs.</td></tr>`;
      return;
    }

    const data = await res.json();
    state.items = data.items || [];
    state.pages = data.totalPages || 1;
    ui("logsPage").textContent = data.page || 1;
    ui("logsPages").textContent = data.totalPages || 1;
    ui("logsHint").textContent = `${data.totalItems || 0} transacoes encontradas.`;

    loadSummary(state.items);

    updateKpis(data);

    if (!data.items?.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted small">Nenhuma transacao encontrada.</td></tr>`;
      return;
    }

    for (const item of data.items) {
      const methodValue = (item.method || "").trim();
      const pathValue = (item.path || "").trim();
      if (!methodValue || !pathValue || pathValue === "/") {
        continue;
      }
      const tr = document.createElement("tr");
      const method = methodValue.toLowerCase();
      if (!item.isSuccess) {
        tr.classList.add("logs-row-error");
      }
      tr.innerHTML = `
        <td class="small fit">${new Date(item.startedAt).toLocaleString("pt-BR")}</td>
        <td class="fit"><span class="badge logs-method ${method}">${(item.method || "-").toUpperCase()}</span></td>
        <td class="mono text-truncate route">${item.path}</td>
        <td class="fit">${renderStatus(item)}</td>
        <td class="fit">${item.userName || "-"}</td>
        <td class="fit text-end mono">${item.durationMs} ms</td>
      `;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => openDetail(item.id));
      tbody.appendChild(tr);
    }
  }

  function summaryQuery() {
    const params = new URLSearchParams();
    const from = ui("logsFrom")?.value;
    const to = ui("logsTo")?.value;
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    params.set("top", "6");
    return params.toString();
  }

    async function loadSummary(items) {
    const res = await fetch(`${apiBase}/summary?${summaryQuery()}`);
    if (!res.ok) {
      renderFallbackSummary(items);
      return;
    }
    const data = await res.json();
    renderSummary(data, items);
  }

  function renderSummary(data, items) {
    const routesEl = ui("topRoutes");
    const usersEl = ui("topUsers");
    const routes = (data.topRoutes || []).map(x => renderSummaryItem(x.key, x.count)).join("");
    const users = (data.topUsers || []).map(x => renderSummaryItem(x.key, x.count)).join("");
    if (routesEl) routesEl.innerHTML = routes || "";
    if (usersEl) usersEl.innerHTML = users || "";
    if (!routes && !users) {
      renderFallbackSummary(items);
    } else {
      if (routesEl && !routesEl.innerHTML.trim()) routesEl.innerHTML = "Sem dados ainda.";
      if (usersEl && !usersEl.innerHTML.trim()) usersEl.innerHTML = "Sem dados ainda.";
    }
  }

  function renderSummaryItem(label, count) {
    return `
      <div class="summary-item">
        <span class="summary-label">${label}</span>
        <span class="summary-count">${count}</span>
      </div>
    `;
  }

  function renderFallbackSummary(items) {
    const routesEl = ui("topRoutes");
    const usersEl = ui("topUsers");
    const top = 6;
    const routeCounts = {};
    const userCounts = {};
    (items || []).forEach(item => {
      if (item.path) routeCounts[item.path] = (routeCounts[item.path] || 0) + 1;
      if (item.userName) userCounts[item.userName] = (userCounts[item.userName] || 0) + 1;
    });
    const routes = Object.entries(routeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([key, count]) => renderSummaryItem(key, count))
      .join("");
    const users = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, top)
      .map(([key, count]) => renderSummaryItem(key, count))
      .join("");
    if (routesEl) routesEl.innerHTML = routes || "Sem dados ainda.";
    if (usersEl) usersEl.innerHTML = users || "Sem dados ainda.";
  }

  function updateKpis(data) {
    const items = data.items || [];
    const total = data.totalItems || items.length || 0;
    const errors = items.filter(x => x.isSuccess === false || (x.statusCode || 0) >= 500).length;
    const avg = items.length ? Math.round(items.reduce((sum, x) => sum + (x.durationMs || 0), 0) / items.length) : 0;
    const users = new Set(items.map(x => x.userName).filter(Boolean)).size;

    const kpiTotal = ui("kpiTotal");
    const kpiErrors = ui("kpiErrors");
    const kpiAvg = ui("kpiAvg");
    const kpiUsers = ui("kpiUsers");

    if (kpiTotal) kpiTotal.textContent = total.toString();
    if (kpiErrors) kpiErrors.textContent = errors.toString();
    if (kpiAvg) kpiAvg.textContent = `${avg} ms`;
    if (kpiUsers) kpiUsers.textContent = users.toString();
  }

  function renderStatus(item) {
    const ok = item.isSuccess;
    const code = item.statusCode ?? "-";
    return `<span class="badge ${ok ? "bg-success" : "bg-danger"}">${code}</span>`;
  }

  async function openDetail(id) {
    const res = await fetch(`${apiBase}/transactions/${id}`);
    if (!res.ok) return;
    const data = await res.json();

    ui("detailTxId").textContent = data.transactionId || "-";
    ui("detailRoute").textContent = `${data.method} ${data.path}`;
    ui("detailMeta").textContent = `${new Date(data.startedAt).toLocaleString("pt-BR")} | ${data.durationMs} ms | ${data.statusCode ?? "-"}`;
    ui("detailRequest").textContent = data.userName
      ? `Usuario: ${data.userName} | IP: ${data.ip || "-"}`
      : `IP: ${data.ip || "-"}`;

    const eventsEl = ui("detailEvents");
    eventsEl.innerHTML = "";
    (data.events || []).forEach(ev => {
      const li = document.createElement("li");
      li.className = "small";
      li.textContent = `#${ev.order} ${ev.eventType} - ${ev.name}`;
      eventsEl.appendChild(li);
    });

    const changesEl = ui("detailChanges");
    changesEl.innerHTML = "";
    (data.changes || []).forEach(ch => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${ch.entityName}</td>
        <td class="mono">${ch.state}</td>
        <td class="mono text-truncate" style="max-width:220px">${ch.primaryKeyJson}</td>
        <td class="small">${ch.changedColumns || "-"}</td>
        <td class="small">${new Date(ch.occurredAt).toLocaleString("pt-BR")}</td>
      `;
      changesEl.appendChild(tr);
    });

    const modal = bootstrap.Modal.getOrCreateInstance(ui("modalAuditDetail"));
    modal.show();
  }

  function initFilters() {
    ui("btnApplyFilters")?.addEventListener("click", () => {
      state.page = 1;
      loadLogs();
    });
    ui("logsPrev")?.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;
        loadLogs();
      }
    });
    ui("logsNext")?.addEventListener("click", () => {
      if (state.page < state.pages) {
        state.page += 1;
        loadLogs();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    nowLabel();
    initFilters();
    loadLogs();
  });
})();
