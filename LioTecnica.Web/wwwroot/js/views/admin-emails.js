(() => {
  const apiBase = "/Admin/Emails/_api";
  const tbody = document.getElementById("emailsTbody");
  const searchEl = document.getElementById("emailsSearch");
  const searchTopEl = document.getElementById("emailsSearchTop");
  const scopeEl = document.getElementById("emailsScope");
  const statusEl = document.getElementById("emailsStatus");
  const prevBtn = document.getElementById("emailsPrev");
  const nextBtn = document.getElementById("emailsNext");
  const pageEl = document.getElementById("emailsPage");
  const pagesEl = document.getElementById("emailsPages");
  const hintEl = document.getElementById("emailsHint");
  const refreshBtn = document.getElementById("emailsRefresh");
  const kpiTotalEl = document.getElementById("kpiTotal");
  const kpiQueuedEl = document.getElementById("kpiQueued");
  const kpiFailedEl = document.getElementById("kpiFailed");
  const kpiSentTodayEl = document.getElementById("kpiSentToday");

  const modalEl = document.getElementById("emailDetailModal");
  const modal = modalEl ? new bootstrap.Modal(modalEl) : null;
  const detailTitleEl = document.getElementById("emailDetailTitle");
  const detailToEl = document.getElementById("emailDetailTo");
  const detailStatusEl = document.getElementById("emailDetailStatus");
  const detailAttemptsEl = document.getElementById("emailDetailAttempts");
  const detailSourceEl = document.getElementById("emailDetailSource");
  const detailBodyEl = document.getElementById("emailDetailBody");
  const detailHistoryEl = document.getElementById("emailDetailHistory");
  const retryBtn = document.getElementById("emailRetryBtn");

  let page = 1;
  let pages = 1;
  let items = [];
  let selectedId = null;

  function formatDate(value) {
    if (!value) return "-";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleString("pt-BR");
  }

  function formatDateParts(value) {
    if (!value) return { date: "-", time: "-" };
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return { date: "-", time: "-" };
    return {
      date: dt.toLocaleDateString("pt-BR"),
      time: dt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    };
  }

  function statusClass(status) {
    const key = (status || "").toLowerCase();
    if (key === "queued") return "queued";
    if (key === "inprogress") return "sending";
    if (key === "sent") return "sent";
    if (key === "failed") return "failed";
    return "queued";
  }

  function statusLabel(status) {
    const key = (status || "").toLowerCase();
    if (key === "queued") return "Em fila";
    if (key === "inprogress") return "Enviando";
    if (key === "sent") return "Enviado";
    if (key === "failed") return "Falha";
    return status || "-";
  }

  function originClass(origin) {
    const key = (origin || "").toLowerCase();
    if (key === "portal") return "origin-portal";
    if (key === "sistema") return "origin-sistema";
    if (key === "triagem") return "origin-triagem";
    if (key === "agenda") return "origin-agenda";
    return "origin-outro";
  }

  function attemptsClass(attempts, maxAttempts) {
    if (!maxAttempts) return "attempts-low";
    const ratio = attempts / maxAttempts;
    if (ratio >= 0.66) return "attempts-high";
    if (ratio >= 0.34) return "attempts-mid";
    return "attempts-low";
  }

  async function apiFetch(url, options = {}) {
    const res = await fetch(url, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.status === 204 ? null : res.json();
  }

  function applyFilters(data) {
    const term = (searchEl?.value || "").trim().toLowerCase();
    const status = (statusEl?.value || "").trim().toLowerCase();
    return data.filter(item => {
      if (status && (item.status || "").toLowerCase() !== status) return false;
      if (!term) return true;
      const hay = `${item.to} ${item.subject} ${item.ownerUserName || ""} ${item.source || ""}`.toLowerCase();
      return hay.includes(term);
    });
  }

  function renderTable(data) {
    if (!tbody) return;
    tbody.innerHTML = "";

    if (!data.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-muted small py-4">Nenhum email encontrado.</td>
        </tr>`;
      return;
    }

    data.forEach(item => {
      const status = item.status || "-";
      const attempts = item.attemptCount || 0;
      const maxAttempts = item.maxAttempts || 0;
      const origin = item.source || "outro";
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      const when = formatDateParts(item.createdAtUtc);
      tr.innerHTML = `
        <td class="fit">
          <span class="d-inline-flex align-items-center gap-1">
            <i class="bi bi-calendar3 text-muted"></i>${when.date}
            <span class="mx-1 text-muted">•</span>
            <i class="bi bi-clock text-muted"></i>${when.time}
          </span>
        </td>
        <td class="fit"><span class="email-status ${statusClass(status)}">${statusLabel(status)}</span></td>
        <td class="col-subject">${item.subject || "-"}</td>
        <td class="fit col-to">${item.to || "-"}</td>
        <td class="fit"><span class="email-chip ${attemptsClass(attempts, maxAttempts)}">${attempts}/${maxAttempts}</span></td>
        <td class="fit"><span class="email-chip ${originClass(origin)}">${origin}</span></td>
        <td class="fit">${item.ownerUserName || (item.isSystem ? "Sistema" : "-")}</td>
        <td class="fit">
          <button class="btn btn-ghost btn-sm email-action" data-id="${item.id}">
            <i class="bi bi-envelope-open me-1"></i>Detalhes
          </button>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  async function loadMessages() {
    const scope = scopeEl?.value || "mine";
    const data = await apiFetch(`${apiBase}/messages?scope=${encodeURIComponent(scope)}&page=${page}&pageSize=20`);
    items = Array.isArray(data.items) ? data.items : [];
    pages = data.totalPages || 1;
    page = Math.min(page, pages);
    pageEl.textContent = String(page);
    pagesEl.textContent = String(pages);
    hintEl.textContent = `${data.totalItems || 0} emails encontrados.`;
    renderTable(applyFilters(items));
  }

  async function loadSummary() {
    const scope = scopeEl?.value || "mine";
    const data = await apiFetch(`${apiBase}/summary?scope=${encodeURIComponent(scope)}`);
    if (!data) return;
    if (kpiTotalEl) kpiTotalEl.textContent = String(data.total ?? 0);
    if (kpiQueuedEl) kpiQueuedEl.textContent = String(data.inQueue ?? 0);
    if (kpiFailedEl) kpiFailedEl.textContent = String(data.failed ?? 0);
    if (kpiSentTodayEl) kpiSentTodayEl.textContent = String(data.sentToday ?? 0);
  }

  async function openDetail(id) {
    selectedId = id;
    const detail = await apiFetch(`${apiBase}/messages/${id}`);
    if (!detail) return;
    detailTitleEl.textContent = detail.subject || "Email";
    detailToEl.textContent = detail.to || "-";
    detailStatusEl.textContent = statusLabel(detail.status);
    detailAttemptsEl.textContent = `${detail.attemptCount}/${detail.maxAttempts}`;
    detailSourceEl.textContent = detail.source || "-";
    detailBodyEl.innerHTML = detail.bodyHtml || "<span class=\"text-muted\">Sem conteudo.</span>";

    if (Array.isArray(detail.attempts) && detail.attempts.length) {
      detailHistoryEl.innerHTML = detail.attempts
        .map(a => {
          const status = a.isSuccess ? "Sucesso" : "Falha";
          const when = formatDate(a.startedAtUtc);
          const err = a.errorMessage ? ` - ${a.errorMessage}` : "";
          return `<div>${when} | ${a.provider} | ${status}${err}</div>`;
        })
        .join("");
    } else {
      detailHistoryEl.textContent = "Sem tentativas registradas.";
    }

    if (retryBtn) retryBtn.disabled = (detail.status || "").toLowerCase() === "sent";
    modal?.show();
  }

  async function retrySelected() {
    if (!selectedId) return;
    await apiFetch(`${apiBase}/messages/${selectedId}/retry`, { method: "POST" });
    await loadMessages();
    await openDetail(selectedId);
  }

  function markSelectedRow(id) {
    tbody?.querySelectorAll("tr").forEach(row => {
      row.classList.toggle("is-selected", row.dataset.id === id);
    });
  }

  tbody?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("button[data-id]");
    if (!btn) return;
    markSelectedRow(btn.dataset.id);
    openDetail(btn.dataset.id);
  });

  tbody?.addEventListener("dblclick", (ev) => {
    const row = ev.target.closest("tr[data-id]");
    if (!row) return;
    markSelectedRow(row.dataset.id);
    openDetail(row.dataset.id);
  });

  searchEl?.addEventListener("input", () => renderTable(applyFilters(items)));
  searchTopEl?.addEventListener("input", () => {
    if (searchEl) searchEl.value = searchTopEl.value;
    renderTable(applyFilters(items));
  });
  statusEl?.addEventListener("change", () => renderTable(applyFilters(items)));
  scopeEl?.addEventListener("change", () => {
    page = 1;
    loadMessages().catch(console.error);
    loadSummary().catch(console.error);
  });
  prevBtn?.addEventListener("click", () => {
    if (page > 1) {
      page -= 1;
      loadMessages().catch(console.error);
    }
  });
  nextBtn?.addEventListener("click", () => {
    if (page < pages) {
      page += 1;
      loadMessages().catch(console.error);
    }
  });
  refreshBtn?.addEventListener("click", () => {
    loadMessages().catch(console.error);
    loadSummary().catch(console.error);
  });
  retryBtn?.addEventListener("click", () => retrySelected().catch(console.error));

  loadMessages().catch(err => {
    console.error(err);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-danger small text-center py-4">Falha ao carregar emails.</td></tr>`;
    }
  });
  loadSummary().catch(console.error);
})();
