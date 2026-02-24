(function () {
    "use strict";

    const API_MEETINGS = "/Feedback/_api/oneonone";
    const API_USERS = "/Feedback/_api/users";

    // DOM refs – filters
    const filterColaborador = document.getElementById("filterColaborador");
    const filterStatus = document.getElementById("filterStatus");
    const filterCategoria = document.getElementById("filterCategoria");
    const filterFrequencia = document.getElementById("filterFrequencia");

    // DOM refs – table
    const meetingsBody = document.getElementById("meetingsBody");
    const meetingsEmpty = document.getElementById("meetingsEmpty");
    const pageSizeSelect = document.getElementById("pageSizeSelect");
    const pageInfo = document.getElementById("pageInfo");
    const btnPrevPage = document.getElementById("btnPrevPage");
    const btnNextPage = document.getElementById("btnNextPage");

    // DOM refs – upcoming
    const upcomingList = document.getElementById("upcomingList");
    const upcomingEmpty = document.getElementById("upcomingEmpty");
    const upcomingMore = document.getElementById("upcomingMore");
    const btnShowMoreUpcoming = document.getElementById("btnShowMoreUpcoming");

    // DOM refs – modal
    const btnCriarReuniao = document.getElementById("btnCriarReuniao");
    const meetingId = document.getElementById("meetingId");
    const meetingCollaboratorId = document.getElementById("meetingCollaboratorId");
    const meetingDate = document.getElementById("meetingDate");
    const meetingSubject = document.getElementById("meetingSubject");
    const meetingNotes = document.getElementById("meetingNotes");
    const btnSaveMeeting = document.getElementById("btnSaveMeeting");
    const modalMeetingLabel = document.getElementById("modalMeetingLabel");
    const toastEl = document.getElementById("toastSuccess");
    const toastMsg = document.getElementById("toastMsg");

    let allMeetings = [];
    let allUsers = [];
    let currentPage = 1;
    let currentPageSize = 5;
    let sortField = "name";
    let sortAsc = true;
    let modalInstance = null;
    let upcomingLimit = 3;

    // ── Helpers ──
    function escapeHtml(s) {
        if (!s) return "";
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    function getInitials(name) {
        return (name || "").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
    }

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    function formatDateShort(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    function formatTime(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }

    function daysBetween(d1, d2) {
        return Math.round(Math.abs(d2 - d1) / (1000 * 60 * 60 * 24));
    }

    function relativeDays(iso) {
        const d = new Date(iso);
        const now = new Date();
        const days = daysBetween(d, now);
        const isToday = d.toDateString() === now.toDateString();
        if (isToday) return "Hoje";
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        if (d.toDateString() === tomorrow.toDateString()) return "Amanhã";
        if (d > now) return `em ${days} dias`;
        return `${days} dias atrás`;
    }

    // ── Status computation ──
    function getMeetingStatus(meeting) {
        const now = new Date();
        const md = new Date(meeting.meetingDate);
        if (md > now) return "agendada";
        if (meeting.notes && meeting.notes.trim().length > 0) return "finalizada";
        return "atrasada";
    }

    function statusBadge(status) {
        const map = {
            agendada: { cls: "bg-primary", icon: "bi-calendar-check", label: "Agendada" },
            atrasada: { cls: "bg-warning text-dark", icon: "bi-exclamation-triangle", label: "Atrasada" },
            finalizada: { cls: "bg-success", icon: "bi-check-circle", label: "Finalizada" },
        };
        const s = map[status] || { cls: "bg-secondary", icon: "bi-question-circle", label: status };
        return `<span class="badge ${s.cls}"><i class="bi ${s.icon} me-1"></i>${s.label}</span>`;
    }

    // ── Group meetings by collaborator ──
    function buildCollaboratorRows() {
        // Group all meetings by collaborator
        const byCollab = {};
        allMeetings.forEach(m => {
            const cid = m.collaboratorId;
            if (!byCollab[cid]) {
                byCollab[cid] = {
                    collaboratorId: cid,
                    collaboratorFullName: m.collaboratorFullName,
                    meetings: []
                };
            }
            byCollab[cid].meetings.push(m);
        });

        // Sort meetings for each collaborator by date desc
        Object.values(byCollab).forEach(c => {
            c.meetings.sort((a, b) => new Date(b.meetingDate) - new Date(a.meetingDate));
        });

        // Compute row data
        const now = new Date();
        return Object.values(byCollab).map(c => {
            const past = c.meetings.filter(m => new Date(m.meetingDate) <= now);
            const future = c.meetings.filter(m => new Date(m.meetingDate) > now);

            const lastMeeting = past.length > 0 ? past[0] : null;
            const nextMeeting = future.length > 0 ? future[future.length - 1] : null; // earliest future

            // Frequency: days since last meeting
            let freqDays = null;
            if (lastMeeting) {
                freqDays = daysBetween(new Date(lastMeeting.meetingDate), now);
            }
            const freqLabel = freqDays !== null
                ? (freqDays <= 30 ? "Boa" : "Ruim")
                : null;

            // Status of last
            const lastStatus = lastMeeting ? getMeetingStatus(lastMeeting) : null;
            // Status of next
            const nextStatus = nextMeeting ? getMeetingStatus(nextMeeting) : null;

            return {
                collaboratorId: c.collaboratorId,
                name: c.collaboratorFullName,
                lastMeeting,
                lastStatus,
                nextMeeting,
                nextStatus,
                freqDays,
                freqLabel,
                meetings: c.meetings,
            };
        });
    }

    // ── Apply filters ──
    function applyFilters(rows) {
        let filtered = rows;

        // Colaborador text filter
        const colabQ = (filterColaborador?.value || "").trim().toLowerCase();
        if (colabQ) {
            filtered = filtered.filter(r => (r.name || "").toLowerCase().includes(colabQ));
        }

        // Status filter
        const statusVal = filterStatus?.value || "";
        if (statusVal) {
            filtered = filtered.filter(r => {
                if (statusVal === "atrasada") return r.lastStatus === "atrasada";
                if (statusVal === "agendada") return r.nextStatus === "agendada";
                if (statusVal === "finalizada") return r.lastStatus === "finalizada";
                return true;
            });
        }

        // Frequência filter
        const freqVal = filterFrequencia?.value || "";
        if (freqVal) {
            filtered = filtered.filter(r => {
                if (!r.freqLabel) return false;
                return r.freqLabel.toLowerCase() === freqVal;
            });
        }

        return filtered;
    }

    // ── Sort ──
    function sortRows(rows) {
        const cmp = (a, b) => {
            let va, vb;
            switch (sortField) {
                case "name":
                    va = (a.name || "").toLowerCase();
                    vb = (b.name || "").toLowerCase();
                    break;
                case "last":
                    va = a.lastMeeting ? new Date(a.lastMeeting.meetingDate).getTime() : 0;
                    vb = b.lastMeeting ? new Date(b.lastMeeting.meetingDate).getTime() : 0;
                    break;
                case "next":
                    va = a.nextMeeting ? new Date(a.nextMeeting.meetingDate).getTime() : Infinity;
                    vb = b.nextMeeting ? new Date(b.nextMeeting.meetingDate).getTime() : Infinity;
                    break;
                case "freq":
                    va = a.freqDays ?? Infinity;
                    vb = b.freqDays ?? Infinity;
                    break;
                default:
                    return 0;
            }
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        };
        return [...rows].sort(cmp);
    }

    // ── Render table ──
    function renderTable() {
        const allRows = buildCollaboratorRows();
        const filtered = applyFilters(allRows);
        const sorted = sortRows(filtered);

        const totalPages = Math.max(1, Math.ceil(sorted.length / currentPageSize));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * currentPageSize;
        const pageRows = sorted.slice(start, start + currentPageSize);

        if (!meetingsBody) return;
        meetingsBody.innerHTML = "";

        if (sorted.length === 0) {
            if (meetingsEmpty) meetingsEmpty.classList.remove("d-none");
            if (pageInfo) pageInfo.textContent = "0 de 0";
            return;
        }
        if (meetingsEmpty) meetingsEmpty.classList.add("d-none");

        pageRows.forEach(row => {
            const tr = document.createElement("tr");

            // Name
            const tdName = document.createElement("td");
            tdName.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <div class="r1-initials">${getInitials(row.name)}</div>
                    <div>
                        <div class="fw-semibold">${escapeHtml(row.name)}</div>
                        <div class="text-muted small">Liderado</div>
                    </div>
                </div>`;
            tr.appendChild(tdName);

            // Last meeting
            const tdLast = document.createElement("td");
            if (row.lastMeeting) {
                const st = row.lastStatus;
                const dateStr = formatDateShort(row.lastMeeting.meetingDate) + " " + formatTime(row.lastMeeting.meetingDate);
                let action = "";
                if (st === "atrasada") {
                    action = `<button class="btn btn-link btn-sm p-0 ms-2 btn-finalizar" data-id="${row.lastMeeting.id}">Finalizar</button>`;
                }
                tdLast.innerHTML = `${statusBadge(st)} <span class="small ms-1">${dateStr}</span>${action}`;
            } else {
                tdLast.innerHTML = '<span class="text-muted small">Sem reunião</span>';
            }
            tr.appendChild(tdLast);

            // Next meeting
            const tdNext = document.createElement("td");
            if (row.nextMeeting) {
                const dateStr = formatDateShort(row.nextMeeting.meetingDate) + " " + formatTime(row.nextMeeting.meetingDate);
                const cat = row.nextMeeting.subject || "Sem Categoria";
                tdNext.innerHTML = `${statusBadge("agendada")} <span class="small ms-1">${dateStr}</span><br><span class="text-muted small">${escapeHtml(cat)}</span>`;
            } else {
                tdNext.innerHTML = `<span class="text-muted small">Sem agendada</span> <button class="btn btn-link btn-sm p-0 ms-1 btn-criar-para" data-collab-id="${row.collaboratorId}" data-collab-name="${escapeHtml(row.name)}">Criar reunião</button>`;
            }
            tr.appendChild(tdNext);

            // Frequency
            const tdFreq = document.createElement("td");
            if (row.freqDays !== null) {
                const cls = row.freqLabel === "Boa" ? "text-success" : "text-danger";
                tdFreq.innerHTML = `<span class="fw-bold ${cls}">${row.freqLabel}</span> <span class="text-muted small">(${row.freqDays} dias)</span>`;
            } else {
                tdFreq.innerHTML = '<span class="text-muted small">—</span>';
            }
            tr.appendChild(tdFreq);

            meetingsBody.appendChild(tr);
        });

        // Pagination
        if (pageInfo) pageInfo.textContent = `${currentPage} de ${totalPages}`;
        if (btnPrevPage) btnPrevPage.disabled = currentPage <= 1;
        if (btnNextPage) btnNextPage.disabled = currentPage >= totalPages;

        // Wire inline actions
        meetingsBody.querySelectorAll(".btn-finalizar").forEach(btn => {
            btn.addEventListener("click", () => openFinalizar(btn.dataset.id));
        });
        meetingsBody.querySelectorAll(".btn-criar-para").forEach(btn => {
            btn.addEventListener("click", () => openCreateFor(btn.dataset.collabId, btn.dataset.collabName));
        });
    }

    // ── Render upcoming ──
    function renderUpcoming() {
        const now = new Date();
        const future = allMeetings
            .filter(m => new Date(m.meetingDate) > now)
            .sort((a, b) => new Date(a.meetingDate) - new Date(b.meetingDate));

        if (!upcomingList) return;
        upcomingList.innerHTML = "";
        if (upcomingEmpty) upcomingEmpty.classList.toggle("d-none", future.length > 0);

        const show = future.slice(0, upcomingLimit);
        show.forEach(m => {
            const d = new Date(m.meetingDate);
            const dateStr = formatDateShort(m.meetingDate);
            const time = formatTime(m.meetingDate);
            const rel = relativeDays(m.meetingDate);
            const cat = m.subject || "Sem Categoria";
            upcomingList.insertAdjacentHTML("beforeend", `
                <div class="r1-upcoming-item d-flex align-items-center justify-content-between p-2 mb-2">
                    <div class="d-flex align-items-center gap-3">
                        <div class="r1-date-badge">
                            <div class="r1-date-day">${d.getDate()}</div>
                            <div class="r1-date-month">${d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</div>
                        </div>
                        <div>
                            <div class="fw-semibold">${escapeHtml(m.collaboratorFullName)}</div>
                            <div class="text-muted small">${time} • ${escapeHtml(cat)}</div>
                        </div>
                    </div>
                    <div class="text-muted small">${rel}</div>
                </div>
            `);
        });

        if (upcomingMore) upcomingMore.classList.toggle("d-none", future.length <= upcomingLimit);
    }

    // ── Load data ──
    async function loadMeetings() {
        try {
            const data = await apiGet(`${API_MEETINGS}?page=1&pageSize=200`);
            allMeetings = data.items || [];
            renderTable();
            renderUpcoming();
        } catch (e) {
            console.error("loadMeetings:", e);
            if (meetingsBody) meetingsBody.innerHTML = '<tr><td colspan="4" class="text-danger">Erro ao carregar reuniões.</td></tr>';
        }
    }

    async function loadUsers() {
        try {
            const users = await apiGet(API_USERS);
            allUsers = users || [];
            if (!meetingCollaboratorId) return;
            meetingCollaboratorId.innerHTML = '<option value="">Selecione...</option>';
            allUsers.forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.id;
                opt.textContent = (u.fullName || u.email || "").trim() || u.id;
                meetingCollaboratorId.appendChild(opt);
            });
        } catch (e) {
            console.error("loadUsers:", e);
        }
    }

    // ── Modal actions ──
    function getModal() {
        if (!modalInstance) {
            const el = document.getElementById("modalMeeting");
            if (el && typeof bootstrap !== "undefined") modalInstance = new bootstrap.Modal(el);
        }
        return modalInstance;
    }

    function openCreate() {
        if (meetingId) meetingId.value = "";
        if (meetingCollaboratorId) meetingCollaboratorId.value = "";
        if (meetingDate) meetingDate.value = "";
        if (meetingSubject) meetingSubject.value = "";
        if (meetingNotes) meetingNotes.value = "";
        if (modalMeetingLabel) modalMeetingLabel.textContent = "Criar reunião 1:1";
        getModal()?.show();
    }

    function openCreateFor(collabId, collabName) {
        openCreate();
        if (meetingCollaboratorId) meetingCollaboratorId.value = collabId;
    }

    function openFinalizar(id) {
        const m = allMeetings.find(x => x.id === id);
        if (!m) return;
        if (meetingId) meetingId.value = m.id;
        if (meetingCollaboratorId) meetingCollaboratorId.value = m.collaboratorId;
        if (meetingDate) {
            const d = new Date(m.meetingDate);
            meetingDate.value = d.toISOString().slice(0, 16);
        }
        if (meetingSubject) meetingSubject.value = m.subject || "";
        if (meetingNotes) meetingNotes.value = m.notes || "";
        if (modalMeetingLabel) modalMeetingLabel.textContent = "Finalizar reunião 1:1";
        getModal()?.show();
    }

    async function saveMeeting() {
        const id = meetingId?.value || "";
        const collabId = meetingCollaboratorId?.value || "";
        const dateVal = meetingDate?.value || "";
        const subject = meetingSubject?.value?.trim() || null;
        const notes = meetingNotes?.value?.trim() || null;

        if (!collabId || !dateVal) {
            alert("Preencha colaborador e data.");
            return;
        }

        if (btnSaveMeeting) {
            btnSaveMeeting.disabled = true;
            btnSaveMeeting.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span>Salvando...';
        }

        try {
            const payload = {
                collaboratorId: collabId,
                meetingDate: new Date(dateVal).toISOString(),
                subject,
                notes,
            };

            let url = API_MEETINGS;
            let method = "POST";
            if (id) {
                url = `${API_MEETINGS}/${id}`;
                method = "PUT";
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Falha: " + res.status);

            getModal()?.hide();
            showToast(id ? "Reunião atualizada com sucesso!" : "Reunião criada com sucesso!");
            await loadMeetings();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar reunião. Tente novamente.");
        } finally {
            if (btnSaveMeeting) {
                btnSaveMeeting.disabled = false;
                btnSaveMeeting.innerHTML = "Salvar";
            }
        }
    }

    function showToast(msg) {
        if (toastMsg) toastMsg.textContent = msg;
        if (toastEl && typeof bootstrap !== "undefined") {
            new bootstrap.Toast(toastEl, { delay: 3500 }).show();
        }
    }

    // ── Events ──
    if (btnCriarReuniao) btnCriarReuniao.addEventListener("click", openCreate);
    if (btnSaveMeeting) btnSaveMeeting.addEventListener("click", saveMeeting);

    // Filters
    let filterDebounce = null;
    function onFilterChange() {
        currentPage = 1;
        clearTimeout(filterDebounce);
        filterDebounce = setTimeout(renderTable, 200);
    }
    [filterColaborador, filterStatus, filterCategoria, filterFrequencia].forEach(el => {
        if (el) el.addEventListener(el.type === "search" || el.tagName === "INPUT" ? "input" : "change", onFilterChange);
    });

    // Pagination
    if (pageSizeSelect) pageSizeSelect.addEventListener("change", () => {
        currentPageSize = parseInt(pageSizeSelect.value) || 5;
        currentPage = 1;
        renderTable();
    });
    if (btnPrevPage) btnPrevPage.addEventListener("click", () => { if (currentPage > 1) { currentPage--; renderTable(); } });
    if (btnNextPage) btnNextPage.addEventListener("click", () => { currentPage++; renderTable(); });

    // Sort
    document.querySelectorAll(".sortable").forEach(th => {
        th.style.cursor = "pointer";
        th.addEventListener("click", () => {
            const field = th.dataset.sort;
            if (sortField === field) {
                sortAsc = !sortAsc;
            } else {
                sortField = field;
                sortAsc = true;
            }
            renderTable();
        });
    });

    // Upcoming more
    if (btnShowMoreUpcoming) btnShowMoreUpcoming.addEventListener("click", () => {
        upcomingLimit += 5;
        renderUpcoming();
    });

    // ── Init ──
    loadMeetings();
    loadUsers();
})();
