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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WhatsAppContactButton } from "@/components/contact/WhatsAppContactButton";
import { confirmDialog } from "@/lib/confirm-dialog";
import {
  Calendar,
  ClipboardCheck,
  MessageSquare,
  Sparkles,
  Users,
  Video,
} from "lucide-react";


import {
  type AgendaEventApi,
  type AgendaType,
  type AgendaCandidatoListItem as CandidatoListItemBase,
  type AgendaVagaListItem as VagaListItem,
} from "@/lib/schemas/recrutamento";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import {
  AgendaParticipantsField,
  type AgendaParticipant,
} from "@/features/recrutamento/agendas/AgendaParticipantsField";


type CandidatoListItem = CandidatoListItemBase & {
  celular?: string | null;
  fone?: string | null;
};

type Health = "idle" | "loading";

type MeetingFormat = "online" | "presencial" | "hibrido";

type MeetingRoomOption = {
  email: string;
  displayName: string;
  building?: string | null;
  capacity?: number | null;
  isAvailable?: boolean;
};

type EventForm = {
  id?: string;
  title: string;
  typeCode: string;
  start: string; // yyyy-mm-ddThh:mm
  end: string; // yyyy-mm-ddThh:mm
  meetingFormat: MeetingFormat;
  roomEmail: string;
  roomDisplayName: string;
  location: string;
  status: "confirmado" | "confirmado_candidato" | "reagendamento_sugerido" | "pendente" | "cancelado";
  owner: string;
  candidateName: string;
  vagaId: string;
  notes: string;
  participants: AgendaParticipant[];
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
    source?: unknown;
  };
};

type GraphCalendarEventApi = {
  id: string;
  subject: string;
  start: string;
  end: string;
  isAllDay: boolean;
  location: string | null;
  bodyPreview?: string | null;
  organizerName?: string | null;
  webLink?: string | null;
  isOnlineMeeting?: boolean;
  isCancelled?: boolean;
  source: string;
};


function mapParticipantsForApi(participants: AgendaParticipant[]) {
  return participants.map((item) => ({
    funcionarioId: item.funcionarioId,
    nome: item.nome,
    email: item.email,
  }));
}

function mapApiParticipants(
  participants: AgendaEventApi["participants"] | null | undefined,
): AgendaParticipant[] {
  return (participants ?? [])
    .map((item) => ({
      funcionarioId: String(item.funcionarioId ?? ""),
      nome: String(item.nome ?? ""),
      email: String(item.email ?? ""),
    }))
    .filter((item) => item.funcionarioId && item.nome && item.email);
}

const BASE = "/app";
const AGENDA_API_BASE = `/api/agenda`;

const PORTAL_EVENT_COLOR = "#16a34a";
const PORTAL_EVENT_BORDER = "#15803d";
const GRAPH_EVENT_COLOR = "#0078d4";
const GRAPH_EVENT_BORDER = "#005a9e";
const CANCELLED_EVENT_COLOR = "#9ca3af";
const CANCELLED_EVENT_BORDER = "#6b7280";
const CANCELLED_EVENT_TEXT = "#374151";


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


function safeDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}


function statusLabel(s: string) {
  if (s === "confirmado") return "Confirmado";
  if (s === "confirmado_candidato") return "Confirmado pelo candidato";
  if (s === "reagendamento_sugerido") return "Reagendamento sugerido";
  if (s === "pendente") return "Pendente";
  if (s === "cancelado") return "Cancelado";
  return s || "—";
}


function isCancelledStatus(status?: string | null) {
  return (status ?? "").trim().toLowerCase() === "cancelado";
}


function isCancelledGraphSubject(subject?: string | null) {
  return (subject ?? "").trim().toLowerCase().startsWith("cancelado:");
}

function isCancelledGraphEvent(ev: Pick<GraphCalendarEventApi, "subject" | "isCancelled">) {
  return Boolean(ev.isCancelled) || isCancelledGraphSubject(ev.subject);
}


function agendaTypeLabel(label?: string | null, code?: string | null) {
  const raw = String(label ?? "").trim();
  const normalizedCode = String(code ?? "").trim().toLowerCase();

  if (raw && !raw.startsWith("Seed.AgendaType")) return raw;

  const key = raw || normalizedCode;
  const labels: Record<string, string> = {
    "Seed.AgendaTypeInterview": "Entrevista",
    "Seed.AgendaTypeMeeting": "Reunião",
    "Seed.AgendaTypeOnboarding": "Onboarding",
    "Seed.AgendaTypeAssessment": "Assessment",
    "Seed.AgendaTypeFollowUp": "Follow-up",
    "Seed.AgendaTypeOther": "Outro",
    entrevista: "Entrevista",
    reuniao: "Reunião",
    onboarding: "Onboarding",
    assessment: "Assessment",
    followup: "Follow-up",
    outro: "Outro",
  };

  return labels[key] ?? raw ?? code ?? "—";
}


function agendaIcon(icon: unknown) {
  const k = String(icon ?? "")
    .trim()
    .toLowerCase();
  if (k === "bi-camera-video") return Video;
  if (k === "bi-people") return Users;
  if (k === "bi-stars") return Sparkles;
  if (k === "bi-clipboard-check") return ClipboardCheck;
  if (k === "bi-chat-dots") return MessageSquare;
  return Calendar;
}


async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(parseApiError(text) || `HTTP_${res.status}`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}


function parseApiError(text: string): string {
  if (!text?.trim()) return "";
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    const detail = typeof json.detail === "string" ? json.detail : "";
    const title = typeof json.title === "string" ? json.title : "";
    const message = typeof json.message === "string" ? json.message : "";
    return toUserFriendlyApiError(detail || message || title || text);
  } catch {
    return toUserFriendlyApiError(text);
  }
}

function toUserFriendlyApiError(raw: string): string {
  const text = raw.trim();
  if (!text) return "Não foi possível concluir a operação. Tente novamente.";

  const technicalPatterns: Array<{ pattern: RegExp; message: string }> = [
    {
      pattern: /element of type 'Object'.*type 'String'/i,
      message: "Não foi possível carregar as salas do Microsoft 365. Verifique a integração Outlook com o suporte de TI.",
    },
    {
      pattern: /element of type 'String'.*type 'Object'/i,
      message: "Não foi possível carregar as salas do Microsoft 365. Verifique a integração Outlook com o suporte de TI.",
    },
    { pattern: /^HTTP_\d+$/i, message: "Serviço temporariamente indisponível. Tente novamente em instantes." },
    { pattern: /Microsoft Graph retornou/i, message: "Integração com Outlook indisponível no momento. Tente novamente ou escolha Online." },
    { pattern: /Place\.Read\.All/i, message: "Permissão de salas não configurada no Microsoft 365. Solicite Place.Read.All ao suporte de TI." },
  ];

  for (const { pattern, message } of technicalPatterns) {
    if (pattern.test(text)) return message;
  }

  if (/^(System\.|Microsoft\.|JsonException|InvalidOperationException|NullReferenceException)/i.test(text))
    return "Ocorreu um erro inesperado. Tente novamente ou contate o suporte.";

  return text;
}


function meetingFormatLabel(format: MeetingFormat | string | null | undefined): string {
  if (format === "presencial") return "Presencial";
  if (format === "hibrido") return "Híbrido (Teams + sala)";
  return "Online (Teams)";
}

function inferMeetingFormat(ev: {
  meetingFormat?: string | null;
  onlineMeetingJoinUrl?: string | null;
  roomEmail?: string | null;
  location?: string | null;
}): MeetingFormat {
  const stored = String(ev.meetingFormat ?? "").trim().toLowerCase();
  if (stored === "online" || stored === "presencial" || stored === "hibrido") return stored;
  if (ev.onlineMeetingJoinUrl && ev.roomEmail) return "hibrido";
  if (ev.onlineMeetingJoinUrl || /online|teams/i.test(ev.location ?? "")) return "online";
  if (ev.roomEmail) return "presencial";
  return "online";
}

function needsMeetingRoom(format: MeetingFormat): boolean {
  return format === "presencial" || format === "hibrido";
}

function validateEventForm(form: EventForm, roomsError: string | null): string | null {
  if (!form.title?.trim()) return "Informe um título para o evento.";
  if (!form.typeCode?.trim()) return "Selecione o tipo do evento.";
  if (!form.start?.trim()) return "Informe a data e hora de início.";
  if (!form.end?.trim()) return "Informe a data e hora de fim.";
  const start = parseLocalIsoInputValue(form.start);
  const end = parseLocalIsoInputValue(form.end);
  if (!start || !end) return "Datas inválidas. Verifique início e fim.";
  if (end.getTime() <= start.getTime()) return "O horário de fim deve ser posterior ao início.";

  if (needsMeetingRoom(form.meetingFormat)) {
    if (roomsError) return "Salas indisponíveis no momento. Escolha Online ou tente novamente mais tarde.";
    if (!form.roomEmail?.trim()) return "Selecione uma sala de reunião.";
  }

  return null;
}


function mapCandidatesPayload(payload: unknown): CandidatoListItem[] {
  if (!payload) return [];
  const raw = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown }).items)
      ? (payload as { items: unknown[] }).items
      : [];
  const result: CandidatoListItem[] = [];
  for (const item of raw) {
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id : typeof record.Id === "string" ? record.Id : "";
    if (!id) continue;
    const nome = typeof record.nome === "string"
      ? record.nome
      : typeof record.Nome === "string"
        ? record.Nome
        : typeof record.nomeCompleto === "string"
          ? record.nomeCompleto
          : null;
    const email = typeof record.email === "string" ? record.email : typeof record.Email === "string" ? record.Email : null;
    const celular = typeof record.celular === "string" ? record.celular : typeof record.Celular === "string" ? record.Celular : null;
    const fone = typeof record.fone === "string"
      ? record.fone
      : typeof record.Fone === "string"
        ? record.Fone
        : typeof record.telefone === "string"
          ? record.telefone
          : null;
    result.push({ id, nome, email, celular, fone });
  }
  return result;
}


function mapVagasPayload(payload: unknown): VagaListItem[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as VagaListItem[];
  const items = (payload as { items?: unknown }).items;
  return Array.isArray(items) ? (items as VagaListItem[]) : [];
}


function fmtTimeRange(start: Date | null, end: Date | null, allDay = false) {
  if (!start) return "—";
  if (allDay) {
    const day = start.toLocaleDateString("pt-BR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `${day} · Dia inteiro`;
  }
  const s = start.toLocaleString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (!end) return s;
  const e = end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${s} - ${e}`;
}


export default function AgendasScreen() {
  const calRef = useRef<FullCalendar | null>(null);
  const { me } = useAuth();
  const defaultOwner = me?.displayName?.trim() || me?.email?.trim() || "";

  const fieldLabel = "mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground";
  const selectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const fieldHint = "mt-1 text-xs text-muted-foreground";


  const [busy, setBusy] = useState<Health>("loading");
  const [savingEvent, setSavingEvent] = useState(false);
  const [types, setTypes] = useState<AgendaType[]>([]);
  const [events, setEvents] = useState<AgendaEventApi[]>([]);
  const [graphEvents, setGraphEvents] = useState<GraphCalendarEventApi[]>([]);
  const [candidatos, setCandidatos] = useState<CandidatoListItem[]>([]);
  const [vagas, setVagas] = useState<VagaListItem[]>([]);


  const [viewMode, setViewMode] = useState<"timeGridWeek" | "timeGridDay">("timeGridWeek");
  const [viewTitle, setViewTitle] = useState<string>("—");


  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");


  const [activeRange, setActiveRange] = useState<{ start: Date; end: Date } | null>(null);


  const [createOpen, setCreateOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [graphViewOpen, setGraphViewOpen] = useState(false);
  const [createdJoinUrlDialog, setCreatedJoinUrlDialog] = useState<{ title: string; url: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedGraphEventId, setSelectedGraphEventId] = useState<string | null>(null);


  const selectedEvent = useMemo(
    () => (selectedId ? events.find((e) => e.id === selectedId) ?? null : null),
    [events, selectedId],
  );

  const selectedGraphEvent = useMemo(
    () => (selectedGraphEventId ? graphEvents.find((e) => e.id === selectedGraphEventId) ?? null : null),
    [graphEvents, selectedGraphEventId],
  );


  const selectedEventType = useMemo(() => {
    const code = String(selectedEvent?.typeCode ?? "")
      .trim()
      .toLowerCase();
    const byCode = code ? types.find((t) => String(t.code ?? "").trim().toLowerCase() === code) : null;
    const label = agendaTypeLabel(selectedEvent?.typeLabel || byCode?.label, selectedEvent?.typeCode);
    const icon = selectedEvent?.typeIcon ?? byCode?.icon ?? "bi-calendar";
    const Icon = agendaIcon(icon);
    return { label, Icon };
  }, [selectedEvent?.typeCode, selectedEvent?.typeIcon, selectedEvent?.typeLabel, types]);


  const [form, setForm] = useState<EventForm>(() => ({
    title: "",
    typeCode: "entrevista",
    start: toLocalIsoInputValue(new Date()),
    end: toLocalIsoInputValue(new Date(Date.now() + 60 * 60 * 1000)),
    meetingFormat: "online",
    roomEmail: "",
    roomDisplayName: "",
    location: "",
    status: "confirmado",
    owner: "",
    candidateName: "",
    vagaId: "",
    notes: "",
    participants: [],
  }));

  const [meetingRooms, setMeetingRooms] = useState<MeetingRoomOption[]>([]);
  const [meetingRoomsLoading, setMeetingRoomsLoading] = useState(false);
  const [meetingRoomsError, setMeetingRoomsError] = useState<string | null>(null);
  const [roomAvailabilityLoading, setRoomAvailabilityLoading] = useState(false);

  const availableMeetingRooms = useMemo(
    () => meetingRooms.filter((room) => room.isAvailable === true),
    [meetingRooms],
  );

  const meetingRoomsAvailabilityKnown = useMemo(
    () => meetingRooms.some((room) => room.isAvailable !== undefined),
    [meetingRooms],
  );


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


  useEffect(() => {
    if (!createOpen) return;
    let alive = true;
    setMeetingRoomsLoading(true);
    setMeetingRoomsError(null);
    setMeetingRooms([]);

    fetchJson<MeetingRoomOption[]>(`${AGENDA_API_BASE}/meeting-rooms`)
      .then((data) => {
        if (!alive) return;
        setMeetingRooms(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setMeetingRooms([]);
        setMeetingRoomsError(
          err instanceof Error
            ? toUserFriendlyApiError(err.message)
            : "Não foi possível carregar salas do Microsoft 365.",
        );
      })
      .finally(() => {
        if (alive) setMeetingRoomsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [createOpen]);


  useEffect(() => {
    if (!createOpen || !needsMeetingRoom(form.meetingFormat)) return;
    if (meetingRoomsError || meetingRooms.length === 0) return;

    const start = parseLocalIsoInputValue(form.start);
    const end = parseLocalIsoInputValue(form.end);
    if (!start || !end || end.getTime() <= start.getTime()) return;

    const timer = window.setTimeout(() => {
      setRoomAvailabilityLoading(true);
      fetchJson<MeetingRoomOption[]>(`${AGENDA_API_BASE}/meeting-rooms/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startAtUtc: form.start,
          endAtUtc: form.end,
          owner: form.owner?.trim() || defaultOwner || null,
        }),
      })
        .then((data) => {
          setMeetingRooms(Array.isArray(data) ? data : []);
        })
        .catch((err: unknown) => {
          setMeetingRooms([]);
          setMeetingRoomsError(
            err instanceof Error
              ? toUserFriendlyApiError(err.message)
              : "Não foi possível consultar disponibilidade das salas.",
          );
        })
        .finally(() => setRoomAvailabilityLoading(false));
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    createOpen,
    defaultOwner,
    form.end,
    form.meetingFormat,
    form.owner,
    form.start,
    meetingRoomsError,
  ]);


  useEffect(() => {
    if (!createOpen || !needsMeetingRoom(form.meetingFormat)) return;
    if (!meetingRoomsAvailabilityKnown || roomAvailabilityLoading) return;
    if (!form.roomEmail) return;
    if (availableMeetingRooms.some((room) => room.email === form.roomEmail)) return;
    setForm((current) => ({ ...current, roomEmail: "", roomDisplayName: "" }));
  }, [
    availableMeetingRooms,
    createOpen,
    form.meetingFormat,
    form.roomEmail,
    meetingRoomsAvailabilityKnown,
    roomAvailabilityLoading,
  ]);


  async function loadEventsForCurrentRange() {
    const api = calRef.current?.getApi();
    const start = api?.view?.activeStart;
    const end = api?.view?.activeEnd;
    const params = new URLSearchParams();
    if (start) params.set("start", toLocalIsoInputValue(start));
    if (end) params.set("end", toLocalIsoInputValue(end));
    const query = params.toString();
    const [list, graphList] = await Promise.all([
      fetchJson<AgendaEventApi[]>(`${AGENDA_API_BASE}/events?${query}`),
      fetchJson<GraphCalendarEventApi[]>(`${AGENDA_API_BASE}/graph-events?${query}`).catch(() => []),
    ]);
    setEvents(Array.isArray(list) ? list : []);
    setGraphEvents(Array.isArray(graphList) ? graphList : []);
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


  const filteredGraphEvents = useMemo(() => {
    if (filterType !== "all" || filterStatus !== "all") return [];
    const qq = q.trim().toLowerCase();
    return graphEvents.filter((ev) => {
      if (!qq) return true;
      const blob = [ev.subject, ev.location].filter(Boolean).join(" ").toLowerCase();
      return blob.includes(qq);
    });
  }, [filterStatus, filterType, graphEvents, q]);


  const calendarEvents = useMemo(
    () => [
      ...filtered.map((ev) => {
        const cancelled = isCancelledStatus(ev.status);
        return {
          id: ev.id,
          title: ev.title ?? "Evento",
          start: ev.startAtUtc,
          end: ev.endAtUtc ?? undefined,
          backgroundColor: cancelled ? CANCELLED_EVENT_COLOR : PORTAL_EVENT_COLOR,
          borderColor: cancelled ? CANCELLED_EVENT_BORDER : PORTAL_EVENT_BORDER,
          textColor: cancelled ? CANCELLED_EVENT_TEXT : "#fff",
          editable: !cancelled,
          extendedProps: { source: "portal", cancelled },
        };
      }),
      ...filteredGraphEvents.map((ev) => {
        const cancelled = isCancelledGraphEvent(ev);
        return {
          id: ev.id,
          title: ev.subject || "Evento Outlook",
          start: ev.start,
          end: ev.end,
          backgroundColor: cancelled ? CANCELLED_EVENT_COLOR : GRAPH_EVENT_COLOR,
          borderColor: cancelled ? CANCELLED_EVENT_BORDER : GRAPH_EVENT_BORDER,
          textColor: cancelled ? CANCELLED_EVENT_TEXT : "#fff",
          editable: false,
          extendedProps: { source: "microsoft-graph", location: ev.location, cancelled },
        };
      }),
    ],
    [filtered, filteredGraphEvents],
  );


  const kpis = useMemo(() => {
    const now = new Date();
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

    for (const ev of events) {
      if (isCancelledStatus(ev.status)) continue;
      const s = new Date(ev.startAtUtc);
      if (!Number.isNaN(s.getTime()) && isSameDay(s, now)) today++;
      if (!Number.isNaN(s.getTime()) && s >= w0 && s < w1) week++;
      if ((ev.status ?? "").toLowerCase() === "pendente") pending++;
      if ((ev.typeCode ?? "").toLowerCase() === "entrevista" && !Number.isNaN(s.getTime()) && s >= w0 && s < w1)
        interviews++;
    }

    for (const ev of graphEvents) {
      if (isCancelledGraphEvent(ev)) continue;
      const s = new Date(ev.start);
      if (!Number.isNaN(s.getTime()) && isSameDay(s, now)) today++;
      if (!Number.isNaN(s.getTime()) && s >= w0 && s < w1) week++;
    }

    return { today, week, pending, interviews };
  }, [events, graphEvents]);


  const sideList = useMemo(() => {
    const start = activeRange?.start;
    const end = activeRange?.end;
    const portalItems = filtered
      .filter((ev) => !isCancelledStatus(ev.status) && !isCancelledGraphSubject(ev.title))
      .filter((ev) => {
        const s = new Date(ev.startAtUtc);
        if (Number.isNaN(s.getTime())) return false;
        if (start && s < start) return false;
        if (end && s >= end) return false;
        return true;
      })
      .map((ev) => ({
        kind: "portal" as const,
        id: ev.id,
        title: ev.title ?? "Evento",
        startAt: ev.startAtUtc,
        typeColor: PORTAL_EVENT_COLOR,
        typeCode: ev.typeCode,
        typeIcon: ev.typeIcon,
        typeLabel: ev.typeLabel,
        status: ev.status,
        candidate: ev.candidate,
      }));

    const graphItems = filteredGraphEvents
      .filter((ev) => !isCancelledGraphEvent(ev))
      .filter((ev) => {
        const s = new Date(ev.start);
        if (Number.isNaN(s.getTime())) return false;
        if (start && s < start) return false;
        if (end && s >= end) return false;
        return true;
      })
      .map((ev) => ({
        kind: "graph" as const,
        id: ev.id,
        title: ev.subject || "Evento Outlook",
        startAt: ev.start,
        typeColor: GRAPH_EVENT_COLOR,
        typeCode: null,
        typeIcon: null,
        typeLabel: null,
        status: null,
        candidate: null,
      }));

    return [...portalItems, ...graphItems]
      .sort((a, b) => (a.startAt || "").localeCompare(b.startAt || ""))
      .slice(0, 12);
  }, [activeRange?.end, activeRange?.start, filtered, filteredGraphEvents]);


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
      meetingFormat: "online",
      roomEmail: "",
      roomDisplayName: "",
      location: "",
      owner: defaultOwner,
      candidateName: "",
      vagaId: "",
      notes: "",
      participants: [],
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
      meetingFormat: inferMeetingFormat(ev),
      roomEmail: ev.roomEmail ?? "",
      roomDisplayName: ev.roomDisplayName ?? "",
      location: ev.location ?? "",
      status: ((ev.status ?? "confirmado").toLowerCase() as EventForm["status"]) || "confirmado",
      owner: ev.owner ?? "",
      candidateName: ev.candidate ?? "",
      vagaId: vaga?.id ?? "",
      notes: ev.notes ?? "",
      participants: mapApiParticipants(ev.participants),
    });
    setCreateOpen(true);
  }


  function openView(id: string) {
    setGraphViewOpen(false);
    setSelectedGraphEventId(null);
    setSelectedId(id);
    setViewOpen(true);
  }

  function openGraphView(id: string) {
    setViewOpen(false);
    setSelectedId(null);
    setSelectedGraphEventId(id);
    setGraphViewOpen(true);
  }


  async function saveForm() {
    const validationError = validateEventForm(form, meetingRoomsError);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const selectedRoom = availableMeetingRooms.find((room) => room.email === form.roomEmail);
    if (needsMeetingRoom(form.meetingFormat) && !selectedRoom) {
      toast.error("Selecione uma sala disponível para este horário.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      startAtUtc: form.start,
      endAtUtc: form.end,
      allDay: false,
      status: form.status,
      meetingFormat: form.meetingFormat,
      roomEmail: needsMeetingRoom(form.meetingFormat) ? form.roomEmail.trim() : null,
      roomDisplayName: needsMeetingRoom(form.meetingFormat)
        ? (form.roomDisplayName.trim() || selectedRoom?.displayName || null)
        : null,
      location: null,
      owner: form.owner?.trim() || defaultOwner,
      candidate: form.candidateName?.trim() || "",
      vagaTitle: vagas.find((v) => v.id === form.vagaId)?.titulo ?? "",
      vagaCode: vagas.find((v) => v.id === form.vagaId)?.codigo ?? "",
      notes: form.notes?.trim() || "",
      typeCode: form.typeCode,
      participants: mapParticipantsForApi(form.participants),
    };

    setSavingEvent(true);
    try {
      if (form.id) {
        await fetchJson(`${AGENDA_API_BASE}/events/${encodeURIComponent(form.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Evento atualizado.");
      } else {
        const created = await fetchJson<AgendaEventApi>(`${AGENDA_API_BASE}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const joinUrl = created?.onlineMeetingJoinUrl?.trim();
        if (joinUrl) {
          setCreatedJoinUrlDialog({ title: form.title.trim() || "Evento", url: joinUrl });
          toast.success("Evento criado e sincronizado com o Outlook.");
        } else {
          toast.success("Evento criado e sincronizado com o Outlook.");
        }
      }
      await loadEventsForCurrentRange();
      setCreateOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao salvar evento.";
      toast.error(message);
    } finally {
      setSavingEvent(false);
    }
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
    const s = safeDate(ev.startAtUtc) ?? new Date();
    const e = safeDate(ev.endAtUtc ?? "") ?? new Date(s.getTime() + 60 * 60 * 1000);
    const plus7s = new Date(s);
    plus7s.setDate(plus7s.getDate() + 7);
    const plus7e = new Date(e);
    plus7e.setDate(plus7e.getDate() + 7);


    const payload = {
      title: `${ev.title ?? "Evento"} (cópia)`,
      startAtUtc: toLocalIsoInputValue(plus7s),
      endAtUtc: toLocalIsoInputValue(plus7e),
      allDay: false,
      status: String(ev.status ?? "confirmado").toLowerCase(),
      meetingFormat: inferMeetingFormat(ev),
      roomEmail: ev.roomEmail ?? null,
      roomDisplayName: ev.roomDisplayName ?? null,
      location: ev.location ?? "",
      owner: ev.owner ?? "",
      candidate: ev.candidate ?? "",
      vagaTitle: ev.vagaTitle ?? "",
      vagaCode: ev.vagaCode ?? "",
      notes: ev.notes ?? "",
      typeCode: ev.typeCode ?? types[0]?.code ?? "entrevista",
      participants: mapParticipantsForApi(mapApiParticipants(ev.participants)),
    };
    await fetchJson(`${AGENDA_API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadEventsForCurrentRange();
    setViewOpen(false);
    toast.success("Evento duplicado (+7 dias).");
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
      meetingFormat: inferMeetingFormat(ev),
      roomEmail: ev.roomEmail ?? null,
      roomDisplayName: ev.roomDisplayName ?? null,
      location: ev.location ?? "",
      owner: ev.owner ?? "",
      candidate: ev.candidate ?? "",
      vagaTitle: ev.vagaTitle ?? "",
      vagaCode: ev.vagaCode ?? "",
      notes: ev.notes ?? "",
      typeCode: ev.typeCode ?? types[0]?.code ?? "entrevista",
      participants: mapParticipantsForApi(mapApiParticipants(ev.participants)),
    };
    await fetchJson(`${AGENDA_API_BASE}/events/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadEventsForCurrentRange();
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
        meetingFormat: "online",
        roomEmail: null,
        roomDisplayName: null,
        location: String(p?.location ?? ""),
        owner: String(p?.owner ?? ""),
        candidate: String(p?.candidate ?? ""),
        vagaTitle: String(p?.vagaTitle ?? ""),
        vagaCode: String(p?.vagaCode ?? ""),
        notes: String(p?.notes ?? ""),
        typeCode: String(p?.type ?? types[0]?.code ?? "entrevista"),
        participants: [],
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
          <Button variant="outline" size="sm" onClick={exportJson}>
            Exportar
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
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
          </Button>
          <Button size="sm" onClick={() => openCreate()}>
            Novo evento
          </Button>
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const api = calRef.current?.getApi();
                  api?.prev();
                  void loadEventsForCurrentRange();
                }}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const api = calRef.current?.getApi();
                  api?.today();
                  void loadEventsForCurrentRange();
                }}
              >
                Hoje
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const api = calRef.current?.getApi();
                  api?.next();
                  void loadEventsForCurrentRange();
                }}
              >
                ›
              </Button>
            </div>


            <div className="text-[1.05rem] font-bold">{viewTitle || "—"}</div>


            <div className="flex items-center gap-2">
              <Input
                className="w-[240px]"
                placeholder="Buscar…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select className="h-9 rounded-md border border-input bg-background px-3 text-sm w-[180px]" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="all">Todos os tipos</option>
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {agendaTypeLabel(t.label, t.code)}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm w-[150px]"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="confirmado">Confirmado</option>
                <option value="confirmado_candidato">Confirmado pelo candidato</option>
                <option value="reagendamento_sugerido">Reagendamento sugerido</option>
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


          {/* calendarHost inline — substitui agendas.module.css */}
          <div className="min-w-0 overflow-x-auto">
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
              events={calendarEvents}
              datesSet={(arg: DatesSetArg) => {
                setActiveRange({ start: arg.start, end: arg.end });
                setViewTitle(String(arg.view?.title ?? "—"));
                void loadEventsForCurrentRange();
              }}
              select={(info: DateSelectArg) => {
                openCreate(info.start, info.end);
              }}
              eventClick={(info: EventClickArg) => {
                info.jsEvent.preventDefault();
                if (info.event.extendedProps?.source === "microsoft-graph") {
                  openGraphView(info.event.id);
                  return;
                }
                openView(info.event.id);
              }}
              eventDrop={(arg) => {
                void onEventMove(arg)
                  .then(() => toast.success("Evento movido."))
                  .catch(() => toast.error("Falha ao atualizar evento."));
              }}
              eventResize={(arg) => {
                void onEventMove(arg)
                  .then(() => toast.success("Duração atualizada."))
                  .catch(() => toast.error("Falha ao atualizar evento."));
              }}
            />
          </div>


          <div className="text-muted-foreground mt-2 text-sm">
            Dica: clique e arraste no calendário para agendar rapidamente.
            <span className="ml-2 inline-flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block size-2 rounded-full bg-[#16a34a]" />
                Portal
              </span>
              {filteredGraphEvents.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block size-2 rounded-full bg-[#0078d4]" />
                  Outlook ({filteredGraphEvents.length})
                </span>
              )}
            </span>
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
                  onClick={() => (ev.kind === "graph" ? openGraphView(ev.id) : openView(ev.id))}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className="mt-1 inline-block size-3 rounded-full border-2 border-black/10"
                      style={{ background: ev.typeColor }}
                    />
                    <div className="min-w-0">
                      <div className="truncate font-extrabold">{ev.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(ev.startAt).toLocaleString("pt-BR", {
                          weekday: "short",
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {ev.kind === "graph" ? (
                          <span className="badge-soft text-xs inline-flex items-center gap-1 text-[#0078d4]">
                            <Calendar className="size-3.5" />
                            Outlook
                          </span>
                        ) : (
                          <>
                            <span className="badge-soft text-xs inline-flex items-center gap-1">
                              {(() => {
                                const Icon = agendaIcon(ev.typeIcon ?? "bi-calendar");
                                return <Icon className="size-3.5" />;
                              })()}
                              {agendaTypeLabel(types.find((t) => t.code === ev.typeCode)?.label ?? ev.typeLabel, ev.typeCode)}
                            </span>
                            <span className="badge-soft text-xs">{statusLabel((ev.status ?? "").toLowerCase())}</span>
                            {ev.candidate ? <span className="badge-soft text-xs">{ev.candidate}</span> : null}
                          </>
                        )}
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


      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[min(90vh,820px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
            <DialogTitle>{form.id ? "Editar evento" : "Agendar"}</DialogTitle>
            <DialogDescription>
              {form.id
                ? "Atualize os dados do compromisso. Alterações serão refletidas no portal e no Outlook do responsável."
                : "Preencha os dados do compromisso. O evento será criado no portal e sincronizado com o Outlook do responsável."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-xs leading-relaxed text-emerald-950">
              Campos com <span className="font-semibold text-destructive">*</span> são obrigatórios.
              Eventos do portal aparecem em verde no calendário e são sincronizados com o Outlook.
            </div>

            <div className="mt-5 space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Informações básicas</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="min-w-0 sm:col-span-2">
                    <label className={fieldLabel}>
                      Título <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Ex.: Entrevista RH — Maria Silva"
                      required
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={fieldLabel}>
                      Tipo <span className="text-destructive">*</span>
                    </label>
                    <select
                      className={selectClass}
                      value={form.typeCode}
                      onChange={(e) => setForm({ ...form, typeCode: e.target.value })}
                    >
                      {types.map((t) => (
                        <option key={t.code} value={t.code}>
                          {agendaTypeLabel(t.label, t.code)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Data e horário</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className={fieldLabel}>
                      Início <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={form.start}
                      onChange={(e) => setForm({ ...form, start: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className={fieldLabel}>
                      Fim <span className="text-destructive">*</span>
                    </label>
                    <Input
                      type="datetime-local"
                      value={form.end}
                      onChange={(e) => setForm({ ...form, end: e.target.value })}
                    />
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Modalidade e local</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0 sm:col-span-2">
                    <label className={fieldLabel}>Formato</label>
                    <select
                      className={selectClass}
                      value={form.meetingFormat}
                      onChange={(e) => {
                        const meetingFormat = e.target.value as MeetingFormat;
                        setForm((current) => ({
                          ...current,
                          meetingFormat,
                          roomEmail: meetingFormat === "online" ? "" : current.roomEmail,
                          roomDisplayName: meetingFormat === "online" ? "" : current.roomDisplayName,
                        }));
                      }}
                    >
                      <option value="online">Online (Teams)</option>
                      <option value="presencial">Presencial (sala)</option>
                      <option value="hibrido">Híbrido (Teams + sala)</option>
                    </select>
                    <p className={fieldHint}>
                      {form.meetingFormat === "online"
                        ? "Será gerado link do Teams no Outlook ao salvar."
                        : form.meetingFormat === "hibrido"
                          ? "Reserva a sala física e gera link do Teams para participantes remotos."
                          : "Reserva a sala no calendário corporativo do Outlook."}
                    </p>
                  </div>

                  {needsMeetingRoom(form.meetingFormat) ? (
                    <div className="min-w-0 sm:col-span-2">
                      <label className={fieldLabel}>
                        Sala <span className="text-destructive">*</span>
                      </label>
                      <select
                        className={selectClass}
                        value={form.roomEmail}
                        disabled={
                          meetingRoomsLoading ||
                          roomAvailabilityLoading ||
                          !!meetingRoomsError ||
                          (meetingRoomsAvailabilityKnown
                            ? availableMeetingRooms.length === 0
                            : meetingRooms.length === 0)
                        }
                        onChange={(e) => {
                          const room = availableMeetingRooms.find((item) => item.email === e.target.value);
                          setForm((current) => ({
                            ...current,
                            roomEmail: e.target.value,
                            roomDisplayName: room?.displayName ?? "",
                          }));
                        }}
                      >
                        <option value="">
                          {meetingRoomsLoading
                            ? "Carregando salas…"
                            : roomAvailabilityLoading
                              ? "Verificando disponibilidade…"
                              : "Selecione…"}
                        </option>
                        {availableMeetingRooms.map((room) => (
                          <option key={room.email} value={room.email}>
                            {room.displayName}
                            {room.capacity ? ` · ${room.capacity} pessoas` : ""}
                            {room.building ? ` · ${room.building}` : ""}
                          </option>
                        ))}
                      </select>
                      {meetingRoomsError ? (
                        <p className="mt-1 text-xs text-destructive">{meetingRoomsError}</p>
                      ) : null}
                      {!meetingRoomsError
                      && !meetingRoomsLoading
                      && !roomAvailabilityLoading
                      && meetingRoomsAvailabilityKnown
                      && availableMeetingRooms.length === 0 ? (
                        <p className="mt-1 text-xs text-destructive">
                          Nenhuma sala disponível neste horário. Ajuste início/fim ou escolha Online.
                        </p>
                      ) : null}
                      {!meetingRoomsError && !meetingRoomsLoading && meetingRooms.length === 0 ? (
                        <p className="mt-1 text-xs text-destructive">
                          Nenhuma sala encontrada no Microsoft 365. Verifique permissões Place.Read.All.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    <label className={fieldLabel}>Status</label>
                    <select
                      className={selectClass}
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as EventForm["status"] })}
                    >
                      <option value="confirmado">Confirmado</option>
                      <option value="confirmado_candidato">Confirmado pelo candidato</option>
                      <option value="reagendamento_sugerido">Reagendamento sugerido</option>
                      <option value="pendente">Pendente</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={fieldLabel}>Responsável</label>
                    <Input
                      value={form.owner}
                      onChange={(e) => setForm({ ...form, owner: e.target.value })}
                      placeholder={defaultOwner || "Nome ou e-mail corporativo"}
                    />
                    <p className={fieldHint}>Calendário Outlook desta pessoa.</p>
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Participantes</h3>
                <AgendaParticipantsField
                  value={form.participants}
                  onChange={(participants) => setForm({ ...form, participants })}
                  disabled={savingEvent}
                />
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Recrutamento</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className={fieldLabel}>Candidato</label>
                    <select
                      className={selectClass}
                      value={form.candidateName}
                      onChange={(e) => setForm({ ...form, candidateName: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      {candidatos.map((c) => (
                        <option key={c.id} value={c.nome ?? ""}>
                          {(c.nome ?? "—") + (c.email ? ` • ${c.email}` : "")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className={fieldLabel}>Vaga</label>
                    <select
                      className={selectClass}
                      value={form.vagaId}
                      onChange={(e) => setForm({ ...form, vagaId: e.target.value })}
                    >
                      <option value="">Selecione…</option>
                      {vagas.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.codigo ? `${v.titulo ?? ""} (${v.codigo})` : (v.titulo ?? "")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              <section className="space-y-3 border-t border-border/60 pt-5">
                <h3 className="text-sm font-semibold text-foreground">Observações</h3>
                <div>
                  <label className={fieldLabel}>Notas</label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Informações adicionais sobre o compromisso…"
                    className="resize-y"
                  />
                </div>
              </section>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={savingEvent}>
              Cancelar
            </Button>
            <Button onClick={() => void saveForm()} disabled={savingEvent || busy === "loading"}>
              {savingEvent ? "Salvando…" : form.id ? "Salvar alterações" : "Criar evento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {graphViewOpen && selectedGraphEvent ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-3xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Detalhes · Outlook</div>
                <div className="text-lg font-extrabold">{selectedGraphEvent.subject || "Evento"}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="badge-soft inline-flex items-center gap-1 text-[#0078d4]">
                    <Calendar className="size-4" />
                    Microsoft Graph
                  </span>
                  {selectedGraphEvent.isOnlineMeeting ? (
                    <span className="badge-soft inline-flex items-center gap-1">
                      <Video className="size-4" />
                      Reunião online
                    </span>
                  ) : null}
                  {selectedGraphEvent.isAllDay ? (
                    <span className="badge-soft">Dia inteiro</span>
                  ) : null}
                </div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {fmtTimeRange(
                    safeDate(selectedGraphEvent.start),
                    safeDate(selectedGraphEvent.end),
                    selectedGraphEvent.isAllDay,
                  )}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setGraphViewOpen(false)}>
                Fechar
              </Button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Organizador</div>
                <div className="font-semibold">{selectedGraphEvent.organizerName?.trim() || "—"}</div>
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Local</div>
                <div className="font-semibold">{selectedGraphEvent.location?.trim() || "—"}</div>
              </div>
              {selectedGraphEvent.bodyPreview?.trim() ? (
                <div className="card-soft p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                  <div className="mini-title mb-1">Descrição</div>
                  <div className="text-muted-foreground whitespace-pre-wrap text-sm">
                    {selectedGraphEvent.bodyPreview.trim()}
                  </div>
                </div>
              ) : null}
              <div className="card-soft border-[#0078d4]/20 bg-[#0078d4]/5 p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Origem</div>
                <div className="text-muted-foreground text-sm">
                  Evento sincronizado do calendário Outlook. Alterações devem ser feitas no Outlook ou Teams.
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {selectedGraphEvent.webLink ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={selectedGraphEvent.webLink} target="_blank" rel="noopener noreferrer">
                    Abrir no Outlook
                  </a>
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setGraphViewOpen(false)}>
                OK
              </Button>
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
                <div className="mt-1 flex flex-wrap gap-2">
                  <span className="badge-soft">
                    <selectedEventType.Icon className="size-4" />
                    {selectedEventType.label}
                  </span>
                  <span className="badge-soft">{statusLabel(String(selectedEvent.status ?? "").toLowerCase())}</span>
                </div>
                <div className="text-muted-foreground mt-1 text-sm">
                  {fmtTimeRange(safeDate(selectedEvent.startAtUtc), safeDate(selectedEvent.endAtUtc))}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setViewOpen(false)}>
                Fechar
              </Button>
            </div>


            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Candidato</div>
                <div className="font-semibold">{selectedEvent.candidate ?? "—"}</div>
                {selectedEvent.candidatoId ? (
                  <div className="mt-2">
                    <WhatsAppContactButton
                      size="xs"
                      celular={candidatos.find((c) => c.id === selectedEvent.candidatoId)?.celular}
                      fone={candidatos.find((c) => c.id === selectedEvent.candidatoId)?.fone}
                    />
                  </div>
                ) : null}
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Vaga</div>
                <div className="font-semibold">{selectedEvent.vagaTitle ?? "—"}</div>
                <div className="text-muted-foreground mono text-sm">{selectedEvent.vagaCode ?? "—"}</div>
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Modalidade</div>
                <div className="font-semibold">{meetingFormatLabel(inferMeetingFormat(selectedEvent))}</div>
              </div>
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Local</div>
                <div className="font-semibold">{selectedEvent.location ?? "—"}</div>
                {selectedEvent.roomDisplayName ? (
                  <div className="text-muted-foreground mt-1 text-xs">Sala: {selectedEvent.roomDisplayName}</div>
                ) : null}
              </div>
              {selectedEvent.onlineMeetingJoinUrl?.trim() ? (
                <div className="card-soft border-emerald-200 bg-emerald-50 p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                  <div className="mini-title mb-1 flex items-center gap-1">
                    <Video className="size-4" />
                    Link de ingresso Teams
                  </div>
                  <a
                    href={selectedEvent.onlineMeetingJoinUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-all text-sm font-medium text-emerald-800 underline"
                  >
                    {selectedEvent.onlineMeetingJoinUrl.trim()}
                  </a>
                </div>
              ) : null}
              <div className="card-soft p-3" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Owner</div>
                <div className="font-semibold">{selectedEvent.owner ?? "—"}</div>
              </div>
              {(selectedEvent.participants?.length ?? 0) > 0 ? (
                <div className="card-soft p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                  <div className="mini-title mb-1">Participantes</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selectedEvent.participants!.map((participant) => (
                      <span key={participant.funcionarioId} className="badge-soft text-xs">
                        {participant.nome}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="card-soft p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                <div className="mini-title mb-1">Notas</div>
                <div className="text-muted-foreground whitespace-pre-wrap text-sm">{selectedEvent.notes ?? "—"}</div>
              </div>
              {selectedEvent.candidateResponseStatus ? (
                <div className="card-soft border-amber-200 bg-amber-50 p-3 md:col-span-2" style={{ boxShadow: "none" }}>
                  <div className="mini-title mb-1">Resposta do candidato</div>
                  <div className="font-semibold">{statusLabel(String(selectedEvent.candidateResponseStatus).toLowerCase())}</div>
                  {selectedEvent.candidateRespondedAtUtc ? (
                    <div className="text-muted-foreground mt-1 text-sm">
                      Respondido em {fmtTimeRange(safeDate(selectedEvent.candidateRespondedAtUtc), null)}
                    </div>
                  ) : null}
                  {selectedEvent.candidateSuggestedStartAtUtc ? (
                    <div className="mt-2 text-sm">
                      <span className="font-medium">Horário sugerido: </span>
                      {fmtTimeRange(safeDate(selectedEvent.candidateSuggestedStartAtUtc), safeDate(selectedEvent.candidateSuggestedEndAtUtc))}
                    </div>
                  ) : null}
                  {selectedEvent.candidateResponseMessage ? (
                    <div className="text-muted-foreground mt-2 whitespace-pre-wrap text-sm">{selectedEvent.candidateResponseMessage}</div>
                  ) : null}
                </div>
              ) : null}
            </div>


            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {selectedEvent.onlineMeetingJoinUrl?.trim() ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(selectedEvent.onlineMeetingJoinUrl!.trim())
                        .then(() => toast.success("Link copiado."))
                        .catch(() => toast.error("Não foi possível copiar o link."));
                    }}
                  >
                    Copiar link Teams
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedEvent.onlineMeetingJoinUrl.trim()} target="_blank" rel="noopener noreferrer">
                      Entrar na reunião
                    </a>
                  </Button>
                </>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => void duplicatePlus7(selectedEvent.id)}>
                Duplicar +7d
              </Button>
              <Button variant="outline" size="sm" onClick={() => openEdit(selectedEvent.id)}>
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!(await confirmDialog({ title: "Excluir evento", description: "Excluir este evento?", confirmText: "Excluir", destructive: true }))) return;
                  void deleteEvent(selectedEvent.id).catch(() => toast.error("Falha ao excluir evento."));
                }}
              >
                Excluir
              </Button>
              <Button size="sm" onClick={() => setViewOpen(false)}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {createdJoinUrlDialog ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="card-soft w-full max-w-lg p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="mini-title mb-1">Evento criado</div>
                <div className="text-lg font-extrabold">{createdJoinUrlDialog.title}</div>
                <div className="text-muted-foreground mt-1 text-sm">
                  Reunião online sincronizada com o Outlook. Use o link abaixo para ingressar.
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setCreatedJoinUrlDialog(null)}>
                Fechar
              </Button>
            </div>

            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="mini-title mb-1 flex items-center gap-1">
                <Video className="size-4" />
                Link de ingresso Teams
              </div>
              <a
                href={createdJoinUrlDialog.url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-medium text-emerald-800 underline"
              >
                {createdJoinUrlDialog.url}
              </a>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(createdJoinUrlDialog.url)
                    .then(() => toast.success("Link copiado."))
                    .catch(() => toast.error("Não foi possível copiar o link."));
                }}
              >
                Copiar link
              </Button>
              <Button size="sm" asChild>
                <a href={createdJoinUrlDialog.url} target="_blank" rel="noopener noreferrer">
                  Entrar na reunião
                </a>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
