/* agendas.js — completo e ajustado para i18n + robustez
   - Usa window.__i18n (definido na view) com fallback seguro
   - Ajusta textos fixos (toast, confirm, labels, placeholders)
   - Mantém sua API e estrutura
*/

const AGENDA_API_BASE = "/Agendas/_api";
const CANDIDATOS_API = "/api/candidatos";
const VAGAS_API = "/api/vagas";

// i18n helper
const i18n = (k, fallback) => (window.__i18n && window.__i18n[k]) ? window.__i18n[k] : (fallback ?? k);

// Locale helper (para FullCalendar + formatação)
const APP_LOCALE = (document.documentElement.lang || "pt-BR").toLowerCase().startsWith("en") ? "en" : "pt-br";
const DATE_LOCALE = APP_LOCALE === "en" ? "en-US" : "pt-BR";

const state = {
    types: [],
    events: [],
    candidatos: [],
    vagas: [],
    settings: {
        view: "timeGridWeek",
        filters: { q: "", type: "all", status: "all" }
    }
};

function ui(id) { return document.getElementById(id); }

function toast(msg) {
    const toastEl = ui("appToast");
    if (!toastEl || !window.bootstrap) return;
    const msgEl = ui("toastMsg");
    if (msgEl) msgEl.textContent = msg ?? i18n("toastMsgDefault", "—");
    window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2400 }).show();
}

async function apiFetchJson(url, opts) {
    const res = await fetch(url, {
        headers: { "Accept": "application/json", ...(opts?.headers || {}) },
        ...opts
    });

    const contentType = res.headers.get("content-type") || "";
    let bodyText = "";
    let bodyJson = null;

    try { bodyText = await res.text(); } catch { bodyText = ""; }

    if (bodyText && contentType.includes("application/json")) {
        try { bodyJson = JSON.parse(bodyText); } catch { bodyJson = null; }
    }

    if (res.status === 204) return null;

    if (!res.ok) {
        const msg =
            bodyJson?.message ||
            bodyJson?.title ||
            (bodyText ? bodyText.slice(0, 300) : "") ||
            `Erro HTTP ${res.status}`;
        throw new Error(msg);
    }

    if (contentType.includes("application/json")) {
        try { return bodyJson ?? JSON.parse(bodyText || "null"); } catch { return null; }
    }

    return bodyText || null;
}

function toLocalIso(d) {
    if (!d) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalIso(s) {
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function startOfWeek(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    date.setDate(date.getDate() + diff);
    date.setHours(0, 0, 0, 0);
    return date;
}

function addDays(d, n) {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt;
}

function escapeHtml(s) {
    return String(s ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function mapApiEvent(ev) {
    // FullCalendar aceita Date/ISO string. Mantemos string ISO local (sem timezone) como você já fez.
    return {
        id: ev.id,
        title: ev.title,
        start: ev.startAtUtc,
        end: ev.endAtUtc,
        allDay: ev.allDay,
        backgroundColor: ev.typeColor || "#6c757d",
        borderColor: ev.typeColor || "#6c757d",
        textColor: "#fff",
        extendedProps: {
            type: ev.typeCode,
            status: ev.status,
            location: ev.location,
            owner: ev.owner,
            candidate: ev.candidate,
            vagaTitle: ev.vagaTitle,
            vagaCode: ev.vagaCode,
            notes: ev.notes,
            icon: ev.typeIcon || "bi-calendar"
        }
    };
}

async function loadCandidatos() {
    const list = await apiFetchJson(`${CANDIDATOS_API}`, { method: "GET" }) || [];
    const items = Array.isArray(list.items) ? list.items : (Array.isArray(list) ? list : []);
    state.candidatos = items.map(c => ({
        id: c.id,
        nome: c.nome || c.name || c.fullName || c.titulo || "",
        email: c.email || ""
    })).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
}

async function loadVagas() {
    const list = await apiFetchJson(`${VAGAS_API}`, { method: "GET" }) || [];
    const items = Array.isArray(list.items) ? list.items : (Array.isArray(list) ? list : []);
    state.vagas = items.map(v => ({
        id: v.id,
        titulo: v.titulo || v.title || "",
        codigo: v.codigo || v.code || ""
    })).sort((a, b) => (a.titulo || "").localeCompare(b.titulo || ""));
}

function renderCandidateSelect(selectedName) {
    const sel = ui("evCandidate");
    if (!sel) return;

    const opt0 = `<option value="">${escapeHtml(i18n("Candidate_Select", APP_LOCALE === "en" ? "Select a candidate" : "Selecione um candidato"))}</option>`;
    sel.innerHTML = opt0 + state.candidatos.map(c => {
        const label = `${c.nome || ""}${c.email ? ` • ${c.email}` : ""}`.trim();
        return `<option value="${escapeHtml(c.nome)}" ${c.nome === selectedName ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
}

function renderVagaSelect(selectedLabel) {
    const sel = ui("evVaga");
    if (!sel) return;

    const opt0 = `<option value="">${escapeHtml(i18n("Job_Select", APP_LOCALE === "en" ? "Select a job" : "Selecione uma vaga"))}</option>`;
    sel.innerHTML = opt0 + state.vagas.map(v => {
        const label = v.codigo ? `${v.titulo} (${v.codigo})` : v.titulo;
        const isSelected = label === selectedLabel;
        return `<option value="${escapeHtml(label)}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    }).join("");
}

function findVagaByLabel(label) {
    return state.vagas.find(v => (v.codigo ? `${v.titulo} (${v.codigo})` : v.titulo) == label) || null;
}

async function loadTypes() {
    const list = await apiFetchJson(`${AGENDA_API_BASE}/types`, { method: "GET" }) || [];
    state.types = (Array.isArray(list) ? list : [])
        .filter(t0 => t0 && t0.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function loadEvents(start, end) {
    const params = new URLSearchParams();
    if (start) params.set("start", toLocalIso(start));
    if (end) params.set("end", toLocalIso(end));

    const list = await apiFetchJson(`${AGENDA_API_BASE}/events?${params.toString()}`, { method: "GET" }) || [];
    state.events = (Array.isArray(list) ? list : []).map(mapApiEvent);
}

function getFilteredEvents() {
    const f = state.settings.filters;
    const q = (f.q || "").trim().toLowerCase();

    return state.events.filter(ev => {
        const p = ev.extendedProps || {};
        const hay = [
            ev.title,
            p.candidate,
            p.vagaTitle,
            p.vagaCode,
            p.location,
            p.owner,
            p.notes
        ].filter(Boolean).join(" ").toLowerCase();

        const okQ = !q || hay.includes(q);
        const okType = (f.type === "all") || (p.type === f.type);
        const okStatus = (f.status === "all") || (p.status === f.status);
        return okQ && okType && okStatus;
    });
}

function rebuildTypeSelects() {
    const types = (state.types || []).filter(x => x && x.code && x.label);

    const fType = ui("fType");
    const evType = ui("evType");
    if (fType) {
        fType.innerHTML = [
            `<option value="all">${escapeHtml(i18n("Status_All", APP_LOCALE === "en" ? "All" : "Todos"))}</option>`,
            ...types.map(tt => `<option value="${escapeHtml(tt.code)}">${escapeHtml(tt.label)}</option>`)
        ].join("");
    }
    if (evType) {
        evType.innerHTML = types.map(tt => `<option value="${escapeHtml(tt.code)}">${escapeHtml(tt.label)}</option>`).join("");
    }
}

function applyFiltersToUI() {
    const fSearch = ui("fSearch");
    const globalSearch = ui("globalSearch");
    const fType = ui("fType");
    const fStatus = ui("fStatus");

    if (fSearch) fSearch.value = state.settings.filters.q || "";
    if (globalSearch) globalSearch.value = state.settings.filters.q || "";
    if (fType) fType.value = state.settings.filters.type || "all";
    if (fStatus) fStatus.value = state.settings.filters.status || "all";
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isInSameWeek(date, base) {
    const w0 = startOfWeek(base);
    const w1 = addDays(w0, 7);
    return date >= w0 && date < w1;
}

function refreshKpis() {
    const now = new Date();
    const filtered = getFilteredEvents();

    let today = 0, week = 0, pending = 0, interviews = 0;
    filtered.forEach(e => {
        const s = parseLocalIso(e.start);
        const p = e.extendedProps || {};
        if (s && isSameDay(s, now)) today++;
        if (s && isInSameWeek(s, now)) week++;
        if (p.status === "pendente") pending++;
        if (p.type === "entrevista" && s && isInSameWeek(s, now)) interviews++;
    });

    const a = ui("kpiToday");
    const b = ui("kpiWeek");
    const c = ui("kpiPending");
    const d = ui("kpiInterviews");
    if (a) a.textContent = String(today);
    if (b) b.textContent = String(week);
    if (c) c.textContent = String(pending);
    if (d) d.textContent = String(interviews);
}

function fmtTimeRange(start, end) {
    if (!start) return "—";
    const s = start.toLocaleString(DATE_LOCALE, { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    if (!end) return s;
    const e = end.toLocaleTimeString(DATE_LOCALE, { hour: "2-digit", minute: "2-digit" });
    return `${s} - ${e}`;
}

function refreshSideList(calendar) {
    const filtered = getFilteredEvents();
    const range = calendar ? calendar.view : null;

    let inRange = filtered;
    if (range) {
        const start = range.activeStart;
        const end = range.activeEnd;
        inRange = filtered.filter(ev => {
            const s = parseLocalIso(ev.start);
            return s && s >= start && s < end;
        });
    }

    inRange.sort((a, b) => (a.start || "").localeCompare(b.start || ""));

    const sideCount = ui("sideCount");
    const host = ui("sideList");
    const empty = ui("sideEmpty");
    if (sideCount) sideCount.textContent = String(inRange.length);
    if (host) host.innerHTML = "";

    if (!host || !empty) return;

    if (inRange.length === 0) {
        empty.classList.remove("d-none");
        return;
    }
    empty.classList.add("d-none");

    inRange.slice(0, 12).forEach(ev => {
        const p = ev.extendedProps || {};
        const dotColor = ev.backgroundColor || "#6c757d";
        const start = parseLocalIso(ev.start);
        const end = parseLocalIso(ev.end);

        const typeLabel = (p.type || "—");
        const statusLabel = (p.status || "—");

        const li = document.createElement("li");
        li.className = "evt-item";
        li.innerHTML = `
      <span class="evt-dot" style="background:${escapeHtml(dotColor)}"></span>
      <div style="min-width:0;">
        <div class="evt-title">${escapeHtml(ev.title || i18n("Event_DefaultTitle", APP_LOCALE === "en" ? "Event" : "Evento"))}</div>
        <div class="evt-meta">${escapeHtml(fmtTimeRange(start, end))}</div>
        <div class="evt-badges">
          <span class="tag"><i class="bi ${escapeHtml(p.icon || "bi-calendar")}"></i>${escapeHtml(typeLabel)}</span>
          <span class="tag"><i class="bi bi-flag"></i>${escapeHtml(statusLabel)}</span>
          ${p.candidate ? `<span class="tag"><i class="bi bi-person"></i>${escapeHtml(p.candidate)}</span>` : ``}
        </div>
      </div>
    `;
        li.addEventListener("click", () => openViewModalById(ev.id));
        host.appendChild(li);
    });
}

function refreshCalendarTitle(calendar) {
    const calTitle = ui("calTitle");
    if (calTitle) calTitle.textContent = calendar ? calendar.view.title : "—";

    const v = calendar ? calendar.view.type : state.settings.view;
    const dayBtn = ui("btnViewDay");
    const weekBtn = ui("btnViewWeek");
    if (dayBtn) {
        dayBtn.classList.toggle("btn-brand", v === "timeGridDay");
        dayBtn.classList.toggle("btn-ghost", v !== "timeGridDay");
    }
    if (weekBtn) {
        weekBtn.classList.toggle("btn-brand", v === "timeGridWeek");
        weekBtn.classList.toggle("btn-ghost", v !== "timeGridWeek");
    }
}

function setEventModalMode(isEdit) {
    const mode = ui("eventModalMode");
    const title = ui("eventModalTitle");
    if (mode) mode.textContent = isEdit ? i18n("Modal_EditEvent_MiniTitle", APP_LOCALE === "en" ? "Edit event" : "Editar evento") : i18n("Modal_NewEvent_MiniTitle", APP_LOCALE === "en" ? "New event" : "Novo evento");
    if (title) title.textContent = isEdit ? i18n("Modal_Update_Title", APP_LOCALE === "en" ? "Update" : "Atualizar") : i18n("Modal_Schedule_Title", APP_LOCALE === "en" ? "Schedule" : "Agendar");
}

function setEventFormDefaults(startDt, endDt) {
    const evId = ui("evId"); if (evId) evId.value = "";
    const evTitle = ui("evTitle"); if (evTitle) evTitle.value = "";
    const evType = ui("evType"); if (evType) evType.value = state.types[0]?.code || "entrevista";
    const evStatus = ui("evStatus"); if (evStatus) evStatus.value = "confirmado";
    const evLocation = ui("evLocation"); if (evLocation) evLocation.value = "";
    const evOwner = ui("evOwner"); if (evOwner) evOwner.value = "";

    renderCandidateSelect("");
    renderVagaSelect("");

    const evNotes = ui("evNotes"); if (evNotes) evNotes.value = "";

    const s = startDt || new Date();
    const e = endDt || new Date(s.getTime() + 60 * 60 * 1000);
    const evStart = ui("evStart"); if (evStart) evStart.value = toLocalIso(s);
    const evEnd = ui("evEnd"); if (evEnd) evEnd.value = toLocalIso(e);
}

function fillEventFormFromStored(ev) {
    const p = ev.extendedProps || {};
    const evId = ui("evId"); if (evId) evId.value = ev.id || "";
    const evTitle = ui("evTitle"); if (evTitle) evTitle.value = ev.title || "";

    const evType = ui("evType");
    if (evType) evType.value = p.type || (state.types[0]?.code || "entrevista");

    const evStatus = ui("evStatus"); if (evStatus) evStatus.value = p.status || "confirmado";
    const evLocation = ui("evLocation"); if (evLocation) evLocation.value = p.location || "";
    const evOwner = ui("evOwner"); if (evOwner) evOwner.value = p.owner || "";

    renderCandidateSelect(p.candidate || "");
    const vagaLabel = p.vagaCode ? `${p.vagaTitle} (${p.vagaCode})` : (p.vagaTitle || "");
    renderVagaSelect(vagaLabel);

    const evNotes = ui("evNotes"); if (evNotes) evNotes.value = p.notes || "";

    const startValue = parseDateValue(ev.start) || parseDateValue(ev.startAtUtc) || parseDateValue(p.startAtUtc);
    const endValue = parseDateValue(ev.end) || parseDateValue(ev.endAtUtc) || parseDateValue(p.endAtUtc);
    const evStart = ui("evStart"); if (evStart) evStart.value = startValue ? toLocalIso(startValue) : "";
    const evEnd = ui("evEnd"); if (evEnd) evEnd.value = endValue ? toLocalIso(endValue) : "";
}

function collectEventFromForm() {
    const type = (ui("evType")?.value) || state.types[0]?.code || "entrevista";

    const id = (ui("evId")?.value) || "";
    const title = ((ui("evTitle")?.value) || "").trim() || i18n("Event_DefaultTitle", APP_LOCALE === "en" ? "Event" : "Evento");

    const start = (ui("evStart")?.value) || toLocalIso(new Date());
    let end = (ui("evEnd")?.value) || "";
    if (!end) {
        const s = parseLocalIso(start);
        end = toLocalIso(new Date((s || new Date()).getTime() + 60 * 60 * 1000));
    }

    const candidateName = ((ui("evCandidate")?.value) || "").trim();
    const vagaLabel = (ui("evVaga")?.value) || "";
    const vaga = findVagaByLabel(vagaLabel);

    return {
        id,
        title,
        start,
        end,
        type,
        status: (ui("evStatus")?.value) || "confirmado",
        location: ((ui("evLocation")?.value) || "").trim(),
        owner: ((ui("evOwner")?.value) || "").trim(),
        candidate: candidateName,
        vagaTitle: vaga?.titulo || "",
        vagaCode: vaga?.codigo || "",
        notes: ((ui("evNotes")?.value) || "").trim()
    };
}

function openCreateModal(startDt, endDt) {
    setEventModalMode(false);
    setEventFormDefaults(startDt, endDt);
    modalEvent?.show();
}

function openEditModalById(id) {
    const ev = state.events.find(x => x.id === id);
    if (!ev) return;
    setEventModalMode(true);
    fillEventFormFromStored(ev);
    modalEvent?.show();
}

function openViewModalById(id) {
    const ev = state.events.find(x => x.id === id);
    if (!ev) return;

    const p = ev.extendedProps || {};
    const viewId = ui("viewId"); if (viewId) viewId.value = ev.id || "";

    const viewTitle = ui("viewTitle"); if (viewTitle) viewTitle.textContent = ev.title || "—";

    const viewType = ui("viewType");
    if (viewType) viewType.innerHTML = `<i class="bi ${escapeHtml(p.icon || "bi-calendar")} me-1"></i>${escapeHtml(p.type || "—")}`;

    const viewStatus = ui("viewStatus");
    if (viewStatus) viewStatus.innerHTML = `<i class="bi bi-flag me-1"></i>${escapeHtml(p.status || "—")}`;

    const s = parseLocalIso(ev.start);
    const e = parseLocalIso(ev.end);
    const viewWhen = ui("viewWhen"); if (viewWhen) viewWhen.textContent = fmtTimeRange(s, e);

    const viewCandidate = ui("viewCandidate"); if (viewCandidate) viewCandidate.textContent = p.candidate || "—";
    const viewVaga = ui("viewVaga"); if (viewVaga) viewVaga.textContent = p.vagaTitle || "—";
    const viewVagaCode = ui("viewVagaCode"); if (viewVagaCode) viewVagaCode.textContent = p.vagaCode || "—";
    const viewLocation = ui("viewLocation"); if (viewLocation) viewLocation.textContent = p.location || "—";
    const viewOwner = ui("viewOwner"); if (viewOwner) viewOwner.textContent = p.owner || "—";
    const viewNotes = ui("viewNotes"); if (viewNotes) viewNotes.textContent = p.notes || "—";

    modalView?.show();
}

function eventsForCalendar() {
    return getFilteredEvents().map(ev => ({
        ...ev,
        extendedProps: { ...(ev.extendedProps || {}) }
    }));
}

function rebuildCalendar(calendar) {
    if (!calendar) return;

    calendar.batchRendering(() => {
        calendar.removeAllEvents();
        calendar.addEventSource(eventsForCalendar());
    });

    refreshCalendarTitle(calendar);
    refreshSideList(calendar);
    refreshKpis();
}

async function refreshFromApi(calendar) {
    const range = calendar?.view;
    const start = range?.activeStart || null;
    const end = range?.activeEnd || null;
    await loadEvents(start, end);
    rebuildCalendar(calendar);
}

async function createOrUpdateEvent(payload) {
    const request = {
        title: payload.title,
        startAtUtc: payload.start,
        endAtUtc: payload.end,
        allDay: false,
        status: payload.status,
        location: payload.location,
        owner: payload.owner,
        candidate: payload.candidate,
        vagaTitle: payload.vagaTitle,
        vagaCode: payload.vagaCode,
        notes: payload.notes,
        typeCode: payload.type
    };

    if (payload.id) {
        await apiFetchJson(`${AGENDA_API_BASE}/events/${payload.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request)
        });
    } else {
        await apiFetchJson(`${AGENDA_API_BASE}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request)
        });
    }
}

async function updateEventFromCalendar(fcEvent) {
    const ev = state.events.find(x => x.id === fcEvent.id);
    if (!ev) return;
    const p = ev.extendedProps || {};

    const request = {
        title: fcEvent.title || ev.title || i18n("Event_DefaultTitle", APP_LOCALE === "en" ? "Event" : "Evento"),
        startAtUtc: toLocalIso(fcEvent.start),
        endAtUtc: toLocalIso(fcEvent.end || fcEvent.start),
        allDay: !!fcEvent.allDay,
        status: p.status || "confirmado",
        location: p.location,
        owner: p.owner,
        candidate: p.candidate,
        vagaTitle: p.vagaTitle,
        vagaCode: p.vagaCode,
        notes: p.notes,
        typeCode: p.type || state.types[0]?.code || "entrevista"
    };

    await apiFetchJson(`${AGENDA_API_BASE}/events/${fcEvent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });
}

function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

async function importJsonText(text) {
    let parsed = null;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    if (!parsed || !Array.isArray(parsed.events)) {
        toast(i18n("Import_InvalidJson", APP_LOCALE === "en" ? "Invalid JSON (expected: { events: [...] })." : "JSON inválido (esperado: { events: [...] })."));
        return;
    }

    for (const ev of parsed.events) {
        const p = ev.extendedProps || {};
        const payload = {
            id: "",
            title: ev.title || i18n("Event_DefaultTitle", APP_LOCALE === "en" ? "Event" : "Evento"),
            start: ev.start,
            end: ev.end || ev.start,
            type: p.type || state.types[0]?.code || "entrevista",
            status: p.status || "confirmado",
            location: p.location || "",
            owner: p.owner || "",
            candidate: p.candidate || "",
            vagaTitle: p.vagaTitle || "",
            vagaCode: p.vagaCode || "",
            notes: p.notes || ""
        };
        await createOrUpdateEvent(payload);
    }

    toast(i18n("Import_Success", APP_LOCALE === "en" ? "Agenda imported successfully." : "Agenda importada com sucesso."));
}

let modalEvent = null;
let modalView = null;
let calendar = null;

document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (ui("toastMsg")) ui("toastMsg").textContent = i18n("toastMsgDefault", "—");

        modalEvent = new bootstrap.Modal(ui("modalEvent"));
        modalView = new bootstrap.Modal(ui("modalView"));

        await loadTypes();
        await loadCandidatos();
        await loadVagas();

        rebuildTypeSelects();
        applyFiltersToUI();

        const calEl = ui("calendar");
        calendar = new FullCalendar.Calendar(calEl, {
            locale: APP_LOCALE,   // "pt-br" ou "en"
            timeZone: "local",
            themeSystem: "bootstrap5",
            allDaySlot: false,
            initialView: state.settings.view || "timeGridWeek",
            nowIndicator: true,
            editable: true,
            selectable: true,
            selectMirror: true,
            eventResizableFromStart: true,

            slotMinTime: "06:30:00",
            slotMaxTime: "23:00:00",
            expandRows: true,
            height: "auto",
            headerToolbar: false,

            events: [],

            select: function (info) {
                openCreateModal(info.start, info.end);
                calendar.unselect();
            },

            eventClick: function (info) {
                info.jsEvent.preventDefault();
                openViewModalById(info.event.id);
            },

            eventDrop: async function (info) {
                await updateEventFromCalendar(info.event);
                await refreshFromApi(calendar);
                toast(i18n("Toast_EventMoved", APP_LOCALE === "en" ? "Event moved." : "Evento movido."));
            },

            eventResize: async function (info) {
                await updateEventFromCalendar(info.event);
                await refreshFromApi(calendar);
                toast(i18n("Toast_DurationUpdated", APP_LOCALE === "en" ? "Duration updated." : "Duração atualizada."));
            }
        });

        calendar.render();

        requestAnimationFrame(() => calendar.updateSize());
        setTimeout(() => calendar.updateSize(), 50);

        let __calResizeT = null;
        window.addEventListener("resize", () => {
            clearTimeout(__calResizeT);
            __calResizeT = setTimeout(() => calendar.updateSize(), 120);
        });

        await refreshFromApi(calendar);

        // Calendar nav
        ui("calPrev")?.addEventListener("click", async () => {
            calendar.prev();
            await refreshFromApi(calendar);
        });
        ui("calNext")?.addEventListener("click", async () => {
            calendar.next();
            await refreshFromApi(calendar);
        });
        ui("calToday")?.addEventListener("click", async () => {
            calendar.today();
            await refreshFromApi(calendar);
        });

        // View mode
        ui("btnViewDay")?.addEventListener("click", async () => {
            calendar.changeView("timeGridDay");
            state.settings.view = "timeGridDay";
            await refreshFromApi(calendar);
        });
        ui("btnViewWeek")?.addEventListener("click", async () => {
            calendar.changeView("timeGridWeek");
            state.settings.view = "timeGridWeek";
            await refreshFromApi(calendar);
        });

        // New event
        ui("btnNewEvent")?.addEventListener("click", () => openCreateModal());

        // Save event
        ui("btnSaveEvent")?.addEventListener("click", async () => {
            const ev = collectEventFromForm();
            await createOrUpdateEvent(ev);
            await refreshFromApi(calendar);
            modalEvent.hide();
            toast(i18n("Toast_EventSaved", APP_LOCALE === "en" ? "Event saved." : "Evento salvo."));
        });

        // Edit
        ui("btnEdit")?.addEventListener("click", () => {
            const id = ui("viewId")?.value;
            modalView.hide();
            if (id) openEditModalById(id);
        });

        // Delete
        ui("btnDelete")?.addEventListener("click", async () => {
            const id = ui("viewId")?.value;
            if (!id) return;
            if (!confirm(i18n("Confirm_Delete", APP_LOCALE === "en" ? "Delete this event?" : "Excluir este evento?"))) return;

            await apiFetchJson(`${AGENDA_API_BASE}/events/${id}`, { method: "DELETE" });
            await refreshFromApi(calendar);
            modalView.hide();
            toast(i18n("Toast_EventDeleted", APP_LOCALE === "en" ? "Event deleted." : "Evento excluído."));
        });

        // Duplicate +7d
        ui("btnDuplicate")?.addEventListener("click", async () => {
            const id = ui("viewId")?.value;
            const src = state.events.find(x => x.id === id);
            if (!src) return;

            const s = parseLocalIso(src.start);
            const e = parseLocalIso(src.end);
            const plus7s = s ? addDays(s, 7) : new Date();
            const plus7e = e ? addDays(e, 7) : new Date(plus7s.getTime() + 60 * 60 * 1000);

            const p = src.extendedProps || {};
            const copy = {
                id: "",
                title: (src.title || i18n("Event_DefaultTitle", APP_LOCALE === "en" ? "Event" : "Evento")) + ` (${i18n("Copy_Suffix", APP_LOCALE === "en" ? "copy" : "cópia")})`,
                start: toLocalIso(plus7s),
                end: toLocalIso(plus7e),
                type: p.type || state.types[0]?.code || "entrevista",
                status: p.status || "confirmado",
                location: p.location || "",
                owner: p.owner || "",
                candidate: p.candidate || "",
                vagaTitle: p.vagaTitle || "",
                vagaCode: p.vagaCode || "",
                notes: p.notes || ""
            };

            await createOrUpdateEvent(copy);
            await refreshFromApi(calendar);
            modalView.hide();
            toast(i18n("Toast_EventDuplicated", APP_LOCALE === "en" ? "Event duplicated (+7 days)." : "Evento duplicado (+7 dias)."));
        });

        // Filters
        function syncFiltersFromUI() {
            const fSearch = ui("fSearch");
            const globalSearch = ui("globalSearch");
            const fType = ui("fType");
            const fStatus = ui("fStatus");

            state.settings.filters.q = ((fSearch?.value) || (globalSearch?.value) || "").trim();
            state.settings.filters.type = (fType?.value) || "all";
            state.settings.filters.status = (fStatus?.value) || "all";
        }

        ui("btnApplyFilters")?.addEventListener("click", () => {
            syncFiltersFromUI();
            applyFiltersToUI();
            rebuildCalendar(calendar);
            toast(i18n("Toast_FiltersApplied", APP_LOCALE === "en" ? "Filters applied." : "Filtros aplicados."));
        });

        ui("btnClearFilters")?.addEventListener("click", () => {
            state.settings.filters = { q: "", type: "all", status: "all" };
            applyFiltersToUI();
            rebuildCalendar(calendar);
            toast(i18n("Toast_FiltersCleared", APP_LOCALE === "en" ? "Filters cleared." : "Filtros limpos."));
        });

        ui("globalSearch")?.addEventListener("input", () => {
            const fSearch = ui("fSearch");
            if (fSearch) fSearch.value = ui("globalSearch").value;
        });

        // Export
        ui("btnExportJson")?.addEventListener("click", () => {
            const data = { types: state.types, events: state.events, settings: state.settings };
            downloadJson(data, `agenda-rh-${new Date().toISOString().slice(0, 10)}.json`);
        });

        // Import
        ui("btnImportJson")?.addEventListener("click", () => ui("importFile")?.click());
        ui("importFile")?.addEventListener("change", async (e) => {
            const f = e.target.files && e.target.files[0];
            if (!f) return;
            const text = await f.text();
            await importJsonText(text);
            await refreshFromApi(calendar);
            e.target.value = "";
        });

    } catch (err) {
        console.error(err);
        toast(err?.message || i18n("Toast_GenericError", APP_LOCALE === "en" ? "Failed to load agenda." : "Falha ao carregar a agenda."));
    }
});
