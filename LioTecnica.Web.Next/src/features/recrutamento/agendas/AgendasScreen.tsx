"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import interactionPlugin, { type EventResizeDoneArg } from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import { toast } from "sonner";

import styles from "./agendas.module.css";
import {
  type AgendaEventApi,
  type AgendaType,
  type CandidatoListItem,
  type VagaListItem,
} from "@/server/recrutamento/agendas.schema";

type Health = "idle" | "loading";

type EventForm = {
  id?: string;
  title: string;
  typeCode: string;
  start: string; // yyyy-mm-ddThh:mm
  end: string; // yyyy-mm-ddThh:mm
  location: string;
  status: "confirmado" | "pendente" | "cancelado";
  owner: string;
  candidateName: string;
  vagaId: string;
  notes: string;
};

type ImportedAgendaEvent = {
  title?: unknown;
  start?: unknown;
  end?: unknown;
  extendedProps?: {
    type?: unknown;
    status?: unknown;
    location?: unknown;
    owner?: unknown;
    candidate?: unknown;
    vagaTitle?: unknown;
    vagaCode?: unknown;
    notes?: unknown;
  };
};

const BASE = "/app";
const AGENDA_API_BASE = `${BASE}/Agendas/_api`;

function toLocalIsoInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

function parseLocalIsoInputValue(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function statusLabel(s: string) {
  if (s === "confirmado") return "Confirmado";
  if (s === "pendente") return "Pendente";
  if (s === "cancelado") return "Cancelado";
  return s || "—";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function mapCandidatesPayload(payload: unknown): CandidatoListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as CandidatoListItem[];
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? (items as CandidatoListItem[]) : [];
}

function mapVagasPayload(payload: unknown): VagaListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as VagaListItem[];
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? (items as VagaListItem[]) : [];
}

export default function AgendasScreen() {
  const calRef = useRef<FullCalendar | null>(null);

  const [busy, setBusy] = useState<Health>("loading");
  const [types, setTypes] = useState<AgendaType[]>([]);
  const [events, setEvents] = useState<AgendaEventApi[]>([]);
  const [candidatos, setCandidatos] = useState<CandidatoListItem[]>([]);
  const [vagas, setVagas] = useState<VagaListItem[]>([]);

  const [viewMode, setViewMode] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");

  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [activeRange, setActiveRange] = useState<{ start: Date; end: Date } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedEvent = useMemo(
    () => (selectedId ? events.find((e) => e.id === selectedId) ?? null : null),
    [events, selectedId],
  );

  const [form, setForm] = useState<EventForm>(() => ({
    title: "",
    typeCode: "entrevista",
    start: toLocalIsoInputValue(new Date()),
    end: toLocalIsoInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    location: "",
    status: "confirmado",
    owner: "",
    candidateName: "",
    vagaId: "",
    notes: "",
  }));

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchJson<AgendaType[]>(`${AGENDA_API_BASE}/types`),
      fetchJson<unknown>(`${BASE}/api/candidatos`),
      fetchJson<unknown>(`${BASE}/api/vagas`),
    ])
      .then(([t, c, v]) => {
        if (!alive) return;
        setTypes((Array.isArray(t) ? t : []).filter((x) => x?.code).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)));
        setCandidatos(mapCandidatesPayload(c).slice().sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? "", "pt-BR")));
        setVagas(mapVagasPayload(v).slice().sort((a, b) => (a.titulo ?? "").localeCompare(b.titulo ?? "", "pt-BR")));
      })
      .catch(() => {
        toast.error("Falha ao carregar tipos/candidatos/vagas.");
      })
      .finally(() => {
        if (!alive) return;
        setBusy("idle");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function loadEventsForCurrentRange() {
    const api = calRef.current?.getApi();
    const start = api?.view?.activeStart;
    const end = api?.view?.activeEnd;
    const params = new URLSearchParams();
    if (start) params.set("start", toLocalIsoInputValue(start));
    if (end) params.set("end", toLocalIsoInputValue(end));
    const list = await fetchJson<AgendaEventApi[]>(`${AGENDA_API_BASE}/events?${params.toString()}`);
    setEvents(Array.isArray(list) ? list : []);
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return events.filter((e) => {
      const type = (e.typeCode ?? "").toLowerCase();
      const status = (e.status ?? "").toLowerCase();
      if (filterType !== "all" && type !== filterType) return false;
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (!qq) return true;
      const blob = [
        e.title,
        e.candidate,
        e.vagaTitle,
        e.vagaCode,
        e.location,
        e.owner,
        e.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(qq);
    });
  }, [events, filterStatus, filterType, q]);

  const kpis = useMemo(() => {
    const now = new Date();
    const list = filtered;
    const isSameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const startOfWeek = (d: Date) => {
      const dt = new Date(d);
      const day = dt.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      dt.setDate(dt.getDate() + diff);
      dt.setHours(0, 0, 0, 0);
      return dt;
    };
    const w0 = startOfWeek(now);
    const w1 = new Date(w0);
    w1.setDate(w1.getDate() + 7);
    let today = 0;
    let week = 0;
    let pending = 0;
    let interviews = 0;
    for (const ev of list) {
      const s = new Date(ev.startAtUtc);
      if (!Number.isNaN(s.getTime()) && isSameDay(s, now)) today++;
      if (!Number.isNaN(s.getTime()) && s >= w0 && s < w1) week++;
      if ((ev.status ?? "").toLowerCase() === "pendente") pending++;
      if ((ev.typeCode ?? "").toLowerCase() === "entrevista" && !Number.isNaN(s.getTime()) && s >= w0 && s < w1)
        interviews++;
    }
    return { today, week, pending, interviews };
  }, [filtered]);

  const sideList = useMemo(() => {
    const start = activeRange?.start;
    const end = activeRange?.end;
    const list = filtered
      .filter((ev) => {
        const s = new Date(ev.startAtUtc);
        if (Number.isNaN(s.getTime())) return false;
        if (start && s < start) return false;
        if (end && s >= end) return false;
        return true;
      })
      .sort((a, b) => (a.startAtUtc || "").localeCompare(b.startAtUtc || ""))
      .slice(0, 12);
    return list;
  }, [activeRange?.end, activeRange?.start, filtered]);

  function openCreate(start?: Date, end?: Date) {
    const s = start ?? new Date();
    const e = end ?? new Date(s.getTime() + 60 * 60 * 1000);
    setSelectedId(null);
    setForm((f) => ({
      ...f,
      id: undefined,
      title: "",
      typeCode: types[0]?.code || "entrevista",
      status: "confirmado",
      location: "",
      owner: "",
      candidateName: "",
      vagaId: "",
      notes: "",
      start: toLocalIsoInputValue(s),
      end: toLocalIsoInputValue(e),
    }));
    setCreateOpen(true);
  }

  function openEdit(id: string) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    setSelectedId(id);
    const s = parseLocalIsoInputValue(ev.startAtUtc) ?? new Date();
    const e = parseLocalIsoInputValue(ev.endAtUtc ?? "") ?? new Date(s.getTime() + 60 * 60 * 1000);
    const vagaLabel = ev.vagaCode ? `${ev.vagaTitle ?? ""} (${ev.vagaCode})` : (ev.vagaTitle ?? "");
    const vaga = vagas.find((v) => (v.codigo ? `${v.titulo ?? ""} (${v.codigo})` : (v.titulo ?? "")) === vagaLabel) ?? null;

    setForm({
      id: ev.id,
      title: ev.title ?? "",
      typeCode: (ev.typeCode ?? types[0]?.code ?? "entrevista") as string,
      start: toLocalIsoInputValue(s),
      end: toLocalIsoInputValue(e),
      location: ev.location ?? "",
      status: ((ev.status ?? "confirmado").toLowerCase() as EventForm["status"]) || "confirmado",
      owner: ev.owner ?? "",
      candidateName: ev.candidate ?? "",
      vagaId: vaga?.id ?? "",
      notes: ev.notes ?? "",
    });
    setCreateOpen(true);
  }

  function openView(id: string) {
    setSelectedId(id);
    setViewOpen(true);
  }

  async function saveForm() {
    const payload = {
      title: form.title?.trim() || "Evento",
      startAtUtc: form.start,
      endAtUtc: form.end || form.start,
      allDay: false,
      status: form.status,
      location: form.location?.trim() || "",
      owner: form.owner?.trim() || "",
      candidate: form.candidateName?.trim() || "",
      vagaTitle: vagas.find((v) => v.id === form.vagaId)?.titulo ?? "",
      vagaCode: vagas.find((v) => v.id === form.vagaId)?.codigo ?? "",
      notes: form.notes?.trim() || "",
      typeCode: form.typeCode,
    };

    if (form.id) {
      await fetchJson(`${AGENDA_API_BASE}/events/${encodeURIComponent(form.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Evento atualizado.");
    } else {
      await fetchJson(`${AGENDA_API_BASE}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast.success("Evento criado.");
    }

    await loadEventsForCurrentRange();
    setCreateOpen(false);
  }

  async function deleteEvent(id: string) {
    await fetchJson(`${AGENDA_API_BASE}/events/${encodeURIComponent(id)}`, { method: "DELETE" });
    toast.success("Evento excluído.");
    await loadEventsForCurrentRange();
    setViewOpen(false);
  }

  async function duplicatePlus7(id: string) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    const s = parseLocalIsoInputValue(ev.startAtUtc) ?? new Date();
    const e = parseLocalIsoInputValue(ev.endAtUtc ?? "") ?? new Date(s.getTime() + 60 * 60 * 1000);
    const plus7s = new Date(s);
    plus7s.setDate(plus7s.getDate() + 7);
    const plus7e = new Date(e);
    plus7e.setDate(plus7e.getDate() + 7);
    openCreate(plus7s, plus7e);
    setForm((f) => ({ ...f, title: `${ev.title ?? "Evento"} (cópia)`, typeCode: ev.typeCode ?? f.typeCode }));
    setViewOpen(false);
  }

  async function onEventMove(arg: EventDropArg | EventResizeDoneArg) {
    const id = arg.event.id;
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    const payload = {
      title: arg.event.title || ev.title || "Evento",
      startAtUtc: toLocalIsoInputValue(arg.event.start ?? new Date()),
      endAtUtc: toLocalIsoInputValue(arg.event.end ?? arg.event.start ?? new Date()),
      allDay: !!arg.event.allDay,
      status: ev.status ?? "confirmado",
      location: ev.location ?? "",
      owner: ev.owner ?? "",
      candidate: ev.candidate ?? "",
      vagaTitle: ev.vagaTitle ?? "",
      vagaCode: ev.vagaCode ?? "",
      notes: ev.notes ?? "",
      typeCode: ev.typeCode ?? types[0]?.code ?? "entrevista",
    };
    await fetchJson(`${AGENDA_API_BASE}/events/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadEventsForCurrentRange();
    toast.success("Evento atualizado.");
  }

  function exportJson() {
    const data = {
      types,
      events,
      settings: {
        view: viewMode,
        filters: { q, type: filterType, status: filterStatus },
      },
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `agenda-rh-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exportação iniciada.");
  }

  async function importJson(file: File) {
    const text = await file.text();
    let parsed: { events?: unknown } | null = null;
    try {
      parsed = JSON.parse(text) as { events?: unknown };
    } catch {
      parsed = null;
    }
    const imported = Array.isArray(parsed?.events) ? (parsed!.events as ImportedAgendaEvent[]) : null;
    if (!imported) {
      toast.error("JSON inválido (esperado: { events: [...] }).");
      return;
    }
    for (const ev of imported) {
      const p = ev?.extendedProps ?? {};
      const payload = {
        title: String(ev?.title ?? "Evento"),
        startAtUtc: String(ev?.start ?? ""),
        endAtUtc: String(ev?.end ?? ev?.start ?? ""),
        allDay: false,
        status: String(p?.status ?? "confirmado"),
        location: String(p?.location ?? ""),
        owner: String(p?.owner ?? ""),
        candidate: String(p?.candidate ?? ""),
        vagaTitle: String(p?.vagaTitle ?? ""),
        vagaCode: String(p?.vagaCode ?? ""),
        notes: String(p?.notes ?? ""),
        typeCode: String(p?.type ?? types[0]?.code ?? "entrevista"),
      };
      await fetchJson(`${AGENDA_API_BASE}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    toast.success("Agenda importada com sucesso.");
    await loadEventsForCurrentRange();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-bold">Agenda</h4>
          <div className="text-muted-foreground text-sm">Entrevistas, eventos e confirmações</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-ghost" type="button" onClick={exportJson}>
            Exportar
          </button>
          <label className="btn-ghost cursor-pointer">
            Importar
            <input
              className="hidden"
              type="file"
              accept="application/json"
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                if (!f) return;
                void importJson(f).finally(() => {
                  e.currentTarget.value = "";
                });
              }}
            />
          </label>
          <button className="btn-brand" type="button" onClick={() => openCreate()}>
            Novo evento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Hoje</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.today}</div>
          <div className="text-muted-foreground text-sm">eventos</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Semana</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.week}</div>
          <div className="text-muted-foreground text-sm">eventos</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Pendente</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.pending}</div>
          <div className="text-muted-foreground text-sm">aguardando confirmação</div>
        </div>
        <div className="card-soft p-3">
          <div className="mini-title mb-1">Entrevistas</div>
          <div className="text-2xl font-extrabold text-[rgb(var(--lt-primary))]">{kpis.interviews}</div>
          <div className="text-muted-foreground text-sm">na semana</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_320px]">
        <div className="card-soft p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-2">
              <button
                className="btn-ghost px-3 py-2"
                type="button"
                onClick={() => {
                  const api = calRef.current?.getApi();
                  api?.prev();
                  void loadEventsForCurrentRange();
                }}
              >
                ‹
              </button>
              <button
                className="btn-ghost px-3 py-2"
                type="button"
                onClick={() => {
                  const api = calRef.current?.getApi();
                  api?.today();
                  void loadEventsForCurrentRange();
                }}
              >
                Hoje
              </button>
              <button
                className="btn-ghost px-3 py-2"
                type="button"
                onClick={() => {
                  const api = calRef.current?.getApi();
                  api?.next();
                  void loadEventsForCurrentRange();
                }}
              >
                ›
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                className="form-control w-[240px]"
                placeholder="Buscar…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select className="form-select w-[180px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Todos os tipos</option>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <select
                className="form-select w-[150px]"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="confirmado">Confirmado</option>
                <option value="pendente">Pendente</option>
                <option value="cancelado">Cancelado</option>
              </select>

              <div className="flex overflow-hidden rounded-xl border border-[rgba(16,82,144,.14)] bg-white/60">
                <button
                  className={`px-3 py-2 text-sm font-semibold ${viewMode === "timeGridDay" ? "bg-white/90" : ""}`}
                  type="button"
                  onClick={() => {
                    setViewMode("timeGridDay");
                    calRef.current?.getApi().changeView("timeGridDay");
                    void loadEventsForCurrentRange();
                  }}
                >
                  Dia
                </button>
                <button
                  className={`px-3 py-2 text-sm font-semibold ${viewMode === "timeGridWeek" ? "bg-white/90" : ""}`}
                  type="button"
                  onClick={() => {
                    setViewMode("timeGridWeek");
                    calRef.current?.getApi().changeView("timeGridWeek");
                    void loadEventsForCurrentRange();
                  }}
                >
                  Semana
                </button>
              </div>
            </div>
          </div>

          <div className={styles.calendarHost}>
            <FullCalendar
              ref={(r) => {
                calRef.current = r;
              }}
              plugins={[timeGridPlugin, interactionPlugin]}
              initialView={viewMode}
              nowIndicator
              editable
              selectable
              selectMirror
              allDaySlot={false}
              height="auto"
              slotMinTime="06:30:00"
              slotMaxTime="23:00:00"
              expandRows
              headerToolbar={false}
              locale="pt-br"
              events={filtered.map((ev) => ({
                id: ev.id,
                title: ev.title ?? "Evento",
                start: ev.startAtUtc,
                end: ev.endAtUtc ?? undefined,
                backgroundColor: ev.typeColor ?? "#6c757d",
                borderColor: ev.typeColor ?? "#6c757d",
                textColor: "#fff",
              }))}
              datesSet={(arg: DatesSetArg) => {
                setActiveRange({ start: arg.start, end: arg.end });
                void loadEventsForCurrentRange();
              }}
              select={(info: DateSelectArg) => {
                openCreate(info.start, info.end);
              }}
              eventClick={(info: EventClickArg) => {
                info.jsEvent.preventDefault();
                openView(info.event.id);
              }}
              eventDrop={(arg) => {
                void onEventMove(arg).catch(() => toast.error("Falha ao atualizar evento."));
              }}
              eventResize={(arg) => {
                void onEventMove(arg).catch(() => toast.error("Falha ao atualizar evento."));
              }}
            />
          </div>

          <div className="text-muted-foreground mt-2 text-sm">
            Dica: clique e arraste no calendário para agendar rapidamente.
          </div>
        </div>

        <aside className="card-soft p-3">
          <div className="flex items-start justify-between gap-2 pb-2">
            <div>
              <p className="mini-title mb-1">Próximos</p>
              <div className="font-extrabold">Foco</div>
              <div className="text-muted-foreground text-sm">Eventos no período atual</div>
            </div>
            <span className="badge-soft">
              <span className="mono">{sideList.length}</span>
            </span>
          </div>

          <div className="space-y-2">
            {sideList.length ? (
              sideList.map((ev) => (
                <button
                  key={ev.id}
                  className="w-full rounded-xl border border-[rgba(16,82,144,.14)] bg-white/55 p-3 text-left hover:bg-white/90"
                  type="button"
                  onClick={() => openView(ev.id)}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block size-3 rounded-full border-2 border-black/10"
                      style={{ background: ev.typeColor ?? "#6c757d" }}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{ev.title ?? "Evento"}</div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(ev.startAtUtc).toLocaleString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="badge-soft text-xs">{ev.typeCode ?? "—"}</span>
                        <span className="badge-soft text-xs">{statusLabel((ev.status ?? "").toLowerCase())}</span>
                        {ev.candidate ? <span className="badge-soft text-xs">{ev.candidate}</span> : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="text-muted-foreground py-6 text-center text-sm">Sem eventos.</div>
            )}
          </div>
        </aside>
      </div>

      {/* Modal simples (sem shadcn ainda) — mantém HTML enxuto e funcional */}
      {createOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">{form.id ? "Editar evento" : "Novo evento"}</div>
                <div className="text-lg font-extrabold">{form.id ? "Atualizar" : "Agendar"}</div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setCreateOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-8">
                <label className="mini-title mb-1 block">Título</label>
                <input className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="md:col-span-4">
                <label className="mini-title mb-1 block">Tipo</label>
                <select className="form-select" value={form.typeCode} onChange={(e) => setForm({ ...form, typeCode: e.target.value })}>
                  {types.map((t) => (
                    <option key={t.code} value={t.code}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Início</label>
                <input
                  className="form-control"
                  type="datetime-local"
                  value={form.start}
                  onChange={(e) => setForm({ ...form, start: e.target.value })}
                />
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Fim</label>
                <input className="form-control" type="datetime-local" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </div>

              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Local</label>
                <input className="form-control" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="md:col-span-3">
                <label className="mini-title mb-1 block">Status</label>
                <select className="form-select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EventForm["status"] })}>
                  <option value="confirmado">Confirmado</option>
                  <option value="pendente">Pendente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className="mini-title mb-1 block">Owner</label>
                <input className="form-control" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
              </div>

              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Candidato</label>
                <select className="form-select" value={form.candidateName} onChange={(e) => setForm({ ...form, candidateName: e.target.value })}>
                  <option value="">Selecione…</option>
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.nome ?? ""}>
                      {(c.nome ?? "—") + (c.email ? ` • ${c.email}` : "")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-6">
                <label className="mini-title mb-1 block">Vaga</label>
                <select className="form-select" value={form.vagaId} onChange={(e) => setForm({ ...form, vagaId: e.target.value })}>
                  <option value="">Selecione…</option>
                  {vagas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.codigo ? `${v.titulo ?? ""} (${v.codigo})` : (v.titulo ?? "")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-12">
                <label className="mini-title mb-1 block">Notas</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => setCreateOpen(false)} disabled={busy === "loading"}>
                Cancelar
              </button>
              <button
                className="btn-brand"
                type="button"
                onClick={() => void saveForm().catch(() => toast.error("Falha ao salvar evento."))}
                disabled={busy === "loading"}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewOpen && selectedEvent ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Detalhes</div>
                <div className="text-lg font-extrabold">{selectedEvent.title ?? "Evento"}</div>
                <div className="text-muted-foreground text-sm">
                  {new Date(selectedEvent.startAtUtc).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <button className="btn-ghost px-3 py-2" type="button" onClick={() => setViewOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Candidato</div>
                <div className="font-semibold">{selectedEvent.candidate ?? "—"}</div>
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Vaga</div>
                <div className="font-semibold">{selectedEvent.vagaTitle ?? "—"}</div>
                <div className="text-muted-foreground mono text-sm">{selectedEvent.vagaCode ?? "—"}</div>
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Local</div>
                <div className="font-semibold">{selectedEvent.location ?? "—"}</div>
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Owner</div>
                <div className="font-semibold">{selectedEvent.owner ?? "—"}</div>
              </div>
              <div className="card-soft p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Notas</div>
                <div className="text-muted-foreground whitespace-pre-wrap text-sm">{selectedEvent.notes ?? "—"}</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" type="button" onClick={() => void duplicatePlus7(selectedEvent.id)}>
                Duplicar +7d
              </button>
              <button className="btn-ghost" type="button" onClick={() => openEdit(selectedEvent.id)}>
                Editar
              </button>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => {
                  if (!confirm("Excluir este evento?")) return;
                  void deleteEvent(selectedEvent.id).catch(() => toast.error("Falha ao excluir evento."));
                }}
              >
                Excluir
              </button>
              <button className="btn-brand" type="button" onClick={() => setViewOpen(false)}>
                OK
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

