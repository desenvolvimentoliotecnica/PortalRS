(function () {
    "use strict";
    const API_LIST = "/Feedback/_api/oneonone";
    const API_USERS = "/Feedback/_api/users";
    const meetingsList = document.getElementById("meetingsList");
    const meetingsEmpty = document.getElementById("meetingsEmpty");
    const btnNew = document.getElementById("btnNew");
    const btnRefresh = document.getElementById("btnRefresh");
    const modalMeeting = document.getElementById("modalMeeting");
    const meetingId = document.getElementById("meetingId");
    const meetingCollaboratorId = document.getElementById("meetingCollaboratorId");
    const meetingDate = document.getElementById("meetingDate");
    const meetingSubject = document.getElementById("meetingSubject");
    const meetingNotes = document.getElementById("meetingNotes");
    const btnSaveMeeting = document.getElementById("btnSaveMeeting");

    const tenantHeader = document.querySelector('meta[name="x-tenant-id"]')?.content || "";

    async function apiGet(url) {
        const headers = { Accept: "application/json" };
        if (tenantHeader) headers["X-Tenant-Id"] = tenantHeader;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    async function apiPost(url, body) {
        const headers = { "Content-Type": "application/json", Accept: "application/json" };
        if (tenantHeader) headers["X-Tenant-Id"] = tenantHeader;
        const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
        return { ok: res.ok, status: res.status, body: await res.text() };
    }

    async function apiPut(url, body) {
        const headers = { "Content-Type": "application/json", Accept: "application/json" };
        if (tenantHeader) headers["X-Tenant-Id"] = tenantHeader;
        const res = await fetch(url, { method: "PUT", headers, body: JSON.stringify(body) });
        return { ok: res.ok, status: res.status, body: await res.text() };
    }

    async function apiDelete(url) {
        const headers = { Accept: "application/json" };
        if (tenantHeader) headers["X-Tenant-Id"] = tenantHeader;
        const res = await fetch(url, { method: "DELETE", headers });
        return { ok: res.ok, status: res.status };
    }

    function escapeHtml(s) {
        if (!s) return "";
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    function formatDateTime(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    async function loadUsers() {
        try {
            const users = await apiGet(API_USERS);
            meetingCollaboratorId.innerHTML = '<option value="">Selecione...</option>';
            (users || []).forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.id || u.userId;
                opt.textContent = u.fullName || u.name || u.email || u.userName || opt.value;
                meetingCollaboratorId.appendChild(opt);
            });
        } catch (e) {
            console.error(e);
        }
    }

    function renderMeeting(m) {
        const notes = m.notes ? escapeHtml(m.notes).replace(/\n/g, "<br>") : "";
        const subject = m.subject ? `<div class=\"small text-muted\">${escapeHtml(m.subject)}</div>` : "";
        return `<div class="border-bottom pb-2 mb-2 d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
                <div class="fw-semibold">${escapeHtml(m.managerFullName || "")} ↔ ${escapeHtml(m.collaboratorFullName || "")}</div>
                ${subject}
                <div class="small text-muted">${formatDateTime(m.meetingDate)}</div>
                ${notes ? "<div class=\"small mt-1\">" + notes + "</div>" : ""}
            </div>
            <div>
                <button type="button" class="btn btn-sm btn-ghost btn-edit" data-id="${m.id}" title="Editar">Editar</button>
                <button type="button" class="btn btn-sm btn-ghost text-danger btn-delete" data-id="${m.id}" title="Excluir">Excluir</button>
            </div>
        </div>`;
    }

    async function load() {
        if (meetingsList) meetingsList.innerHTML = "";
        if (meetingsEmpty) meetingsEmpty.classList.add("d-none");
        try {
            const data = await apiGet(API_LIST + "?page=1&pageSize=50");
            const items = data.items || [];
            items.forEach(m => {
                if (meetingsList) meetingsList.insertAdjacentHTML("beforeend", renderMeeting(m));
            });
            if (items.length === 0 && meetingsEmpty) meetingsEmpty.classList.remove("d-none");
            bindRowButtons();
        } catch (e) {
            console.error(e);
            if (meetingsList) meetingsList.innerHTML = "<div class=\"text-danger\">Erro ao carregar.</div>";
        }
    }

    function bindRowButtons() {
        meetingsList?.querySelectorAll(".btn-edit").forEach(btn => {
            btn.addEventListener("click", () => openEdit(btn.getAttribute("data-id")));
        });
        meetingsList?.querySelectorAll(".btn-delete").forEach(btn => {
            btn.addEventListener("click", () => confirmDelete(btn.getAttribute("data-id")));
        });
    }

    function openNew() {
        meetingId.value = "";
        meetingCollaboratorId.value = "";
        meetingDate.value = "";
        meetingSubject.value = "";
        meetingNotes.value = "";
        document.getElementById("modalMeetingLabel").textContent = "Nova reunião 1:1";
        const modal = new bootstrap.Modal(modalMeeting);
        modal.show();
    }

    async function openEdit(id) {
        try {
            const m = await apiGet("/Feedback/_api/oneonone/" + id);
            meetingId.value = m.id;
            meetingCollaboratorId.value = m.collaboratorId;
            meetingDate.value = m.meetingDate ? new Date(m.meetingDate).toISOString().slice(0, 16) : "";
            meetingSubject.value = m.subject || "";
            meetingNotes.value = m.notes || "";
            document.getElementById("modalMeetingLabel").textContent = "Editar reunião 1:1";
            const modal = new bootstrap.Modal(modalMeeting);
            modal.show();
        } catch (e) {
            console.error(e);
            alert("Erro ao carregar reunião.");
        }
    }

    async function saveMeeting() {
        const id = meetingId.value;
        const collaboratorId = meetingCollaboratorId.value;
        const dateVal = meetingDate.value;
        if (!collaboratorId || !dateVal) {
            alert("Preencha colaborador e data.");
            return;
        }
        const payload = {
            collaboratorId: collaboratorId,
            meetingDate: new Date(dateVal).toISOString(),
            subject: meetingSubject.value || null,
            notes: meetingNotes.value || null
        };
        try {
            if (id) {
                const resp = await apiPut("/Feedback/_api/oneonone/" + id, {
                    meetingDate: payload.meetingDate,
                    subject: payload.subject,
                    notes: payload.notes
                });
                if (!resp.ok) throw new Error(resp.body || resp.status);
            } else {
                const resp = await apiPost("/Feedback/_api/oneonone", payload);
                if (!resp.ok) throw new Error(resp.body || resp.status);
            }
            bootstrap.Modal.getInstance(modalMeeting)?.hide();
            load();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar: " + (e.message || "tente novamente."));
        }
    }

    async function confirmDelete(id) {
        if (!confirm("Excluir esta reunião?")) return;
        try {
            const resp = await apiDelete("/Feedback/_api/oneonone/" + id);
            if (!resp.ok) throw new Error("" + resp.status);
            load();
        } catch (e) {
            console.error(e);
            alert("Erro ao excluir.");
        }
    }

    if (btnNew) btnNew.addEventListener("click", openNew);
    if (btnRefresh) btnRefresh.addEventListener("click", load);
    if (btnSaveMeeting) btnSaveMeeting.addEventListener("click", saveMeeting);
    loadUsers();
    load();
})();
