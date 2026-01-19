(() => {
  const apiBase = "/Admin/OperationalLogs/_api";
  const ui = (id) => document.getElementById(id);

  const state = {
    page: 1,
    pages: 1,
    pageSize: 50
  };

  function nowLabel() {
    const el = ui("nowLabel");
    if (el) el.textContent = new Date().toLocaleString("pt-BR");
  }

  function toQuery() {
    const params = new URLSearchParams();
    params.set("page", state.page.toString());
    params.set("pageSize", state.pageSize.toString());
    const search = ui("opLogsSearch")?.value?.trim();
    const level = ui("opLogsLevel")?.value?.trim();
    const from = ui("opLogsFrom")?.value;
    const to = ui("opLogsTo")?.value;
    if (search) params.set("search", search);
    if (level) params.set("level", level);
    if (from) params.set("from", new Date(from).toISOString());
    if (to) params.set("to", new Date(to).toISOString());
    return params.toString();
  }

  async function loadLogs() {
    const tbody = ui("logsTbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const res = await fetch(`${apiBase}/requests?${toQuery()}`);
    if (!res.ok) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted small">Erro ao carregar logs.</td></tr>`;
      return;
    }

    const data = await res.json();
    state.pages = data.totalPages || 1;
    ui("logsPage").textContent = data.page || 1;
    ui("logsPages").textContent = data.totalPages || 1;
    ui("logsHint").textContent = `${data.totalItems || 0} registros encontrados.`;

    if (!data.items?.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted small">Nenhum registro encontrado.</td></tr>`;
      return;
    }

    for (const item of data.items) {
      const tr = document.createElement("tr");
      const code = item.statusCode ?? 0;
      const level = code >= 500 ? "error" : (code >= 400 ? "warning" : "info");
      if (level === "error") {
        tr.classList.add("logs-row-error");
      }
      tr.innerHTML = `
        <td class="small fit">${new Date(item.startedAt).toLocaleString("pt-BR")}</td>
        <td class="fit"><span class="badge logs-level ${level}">${level.toUpperCase()}</span></td>
        <td class="fit"><span class="badge logs-method ${item.method.toLowerCase()}">${item.method.toUpperCase()}</span></td>
        <td class="mono text-truncate route">${item.path}</td>
        <td class="fit">${item.userName || "-"}</td>
        <td class="fit text-end mono">${item.durationMs} ms</td>
      `;
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => openDetail(item.id));
      tbody.appendChild(tr);
    }
  }

  async function openDetail(id) {
    const res = await fetch(`${apiBase}/requests/${id}`);
    if (!res.ok) return;
    const data = await res.json();

    ui("detailTxId").textContent = data.transactionId || "-";
    ui("detailRoute").textContent = `${data.method} ${data.path}`;
    ui("detailMeta").textContent = `${new Date(data.startedAt).toLocaleString("pt-BR")} | ${data.durationMs} ms | ${data.statusCode ?? "-"}`;
    ui("detailUser").textContent = data.userName
      ? `Usuario: ${data.userName} | IP: ${data.ip || "-"}`
      : `IP: ${data.ip || "-"}`;

    const exceptionsEl = ui("detailExceptions");
    exceptionsEl.innerHTML = "";
    (data.exceptions || []).forEach(ex => {
      const li = document.createElement("li");
      li.className = "small";
      li.textContent = `#${ex.order} ${ex.exceptionType} (${ex.statusCode}) - ${ex.message}`;
      exceptionsEl.appendChild(li);
    });

    const entriesEl = ui("detailEntries");
    entriesEl.innerHTML = "";
    (data.entries || []).forEach(entry => {
      const tr = document.createElement("tr");
      const level = (entry.level || "info").toLowerCase();
      tr.innerHTML = `
        <td class="fit"><span class="badge logs-level ${level}">${level.toUpperCase()}</span></td>
        <td class="small">${entry.category}</td>
        <td class="small">${entry.message}</td>
        <td class="fit small">${new Date(entry.occurredAt).toLocaleString("pt-BR")}</td>
      `;
      entriesEl.appendChild(tr);
    });

    const modal = bootstrap.Modal.getOrCreateInstance(ui("modalOperationalDetail"));
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
