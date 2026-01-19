(() => {
  const apiBase = "/Admin/Logs/_api";
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
    const from = ui("logsFrom")?.value;
    const to = ui("logsTo")?.value;
    if (search) params.set("search", search);
    if (status) params.set("status", status);
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
    state.pages = data.totalPages || 1;
    ui("logsPage").textContent = data.page || 1;
    ui("logsPages").textContent = data.totalPages || 1;
    ui("logsHint").textContent = `${data.totalItems || 0} transacoes encontradas.`;

    if (!data.items?.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-muted small">Nenhuma transacao encontrada.</td></tr>`;
      return;
    }

    for (const item of data.items) {
      const tr = document.createElement("tr");
      const method = (item.method || "-").toLowerCase();
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
