"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileText,
  MoreVertical,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { apiFetch } from "@/lib/api";

type Tone = "blue" | "green" | "purple" | "amber" | "red";

type KpiItem = {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
};

type PipelineItem = {
  label: string;
  value: number;
  hint: string;
  tone: Tone;
};

type AgendaItem = {
  id: string;
  time: string;
  name: string;
  role: string;
  initials: string;
};

type RequisicaoItem = {
  id: string;
  code: string;
  title: string;
  area: string;
  city: string;
  status: string;
  tone: Tone;
  when: string;
};

type AlertaItem = {
  label: string;
  desc: string;
  count: number;
  icon: LucideIcon;
  tone: Tone;
};

type DashboardKpis = {
  openVagas: number;
  cvsHoje: number;
  pendentesMatch: number;
  aprovados7Dias: number;
  vagasForaSla: number;
  solicitacoesVagaAtivas: number;
};

type DashboardSeries = {
  labels: string[];
  values: number[];
};

type FunilEtapa = {
  titulo?: string | null;
  total?: number | string | null;
};

type FunilCandidaturas = {
  etapas?: FunilEtapa[] | null;
};

type AgendaEvent = {
  id?: string;
  title?: string | null;
  startAtUtc?: string | null;
  candidate?: string | null;
  vagaTitle?: string | null;
  typeCode?: string | null;
  status?: string | null;
};

type SolicitacaoVaga = {
  id?: string;
  titulo?: string | null;
  status?: number | string | null;
  centroCustoNome?: string | null;
  unitName?: string | null;
  createdAtUtc?: string | null;
  rmIdReq?: number | string | null;
};

const EMPTY_KPIS: DashboardKpis = {
  openVagas: 0,
  cvsHoje: 0,
  pendentesMatch: 0,
  aprovados7Dias: 0,
  vagasForaSla: 0,
  solicitacoesVagaAtivas: 0,
};

const EMPTY_SERIES: DashboardSeries = {
  labels: [],
  values: [],
};

const toneClasses: Record<Tone, { soft: string; text: string; border: string; bg: string }> = {
  blue: {
    soft: "bg-blue-50 text-blue-600",
    text: "text-blue-600",
    border: "border-blue-100",
    bg: "bg-blue-50",
  },
  green: {
    soft: "bg-emerald-50 text-emerald-600",
    text: "text-emerald-600",
    border: "border-emerald-100",
    bg: "bg-emerald-50",
  },
  purple: {
    soft: "bg-violet-50 text-violet-600",
    text: "text-violet-600",
    border: "border-violet-100",
    bg: "bg-violet-50",
  },
  amber: {
    soft: "bg-amber-50 text-amber-600",
    text: "text-amber-600",
    border: "border-amber-100",
    bg: "bg-amber-50",
  },
  red: {
    soft: "bg-rose-50 text-rose-600",
    text: "text-rose-600",
    border: "border-rose-100",
    bg: "bg-rose-50",
  },
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "RH";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function toNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toStringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function formatTime(iso?: string | null) {
  if (!iso) return "--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function relativeDate(iso?: string | null) {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays > 1 && diffDays < 30) return `${diffDays} dias atrás`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function normalizeKey(value: unknown) {
  return toStringValue(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function resolveSolicitacaoStatus(status: unknown): { label: string; tone: Tone } {
  const key = normalizeKey(status);
  if (key === "2" || key === "aprovada") return { label: "Aprovada", tone: "green" };
  if (key === "0" || key === "rascunho" || key === "11" || key === "pendentetriagem") {
    return { label: "Nova", tone: "blue" };
  }
  if (key === "3" || key === "reprovada" || key === "6" || key === "cancelada") {
    return { label: "Encerrada", tone: "red" };
  }
  return { label: "Em análise", tone: "amber" };
}

function mapPipeline(funil: FunilCandidaturas | null): PipelineItem[] {
  const etapas = funil?.etapas ?? [];
  const findTotal = (...needles: string[]) => {
    const found = etapas.find((etapa) => {
      const title = normalizeKey(etapa.titulo);
      return needles.some((needle) => title.includes(needle));
    });
    return toNumber(found?.total, 0);
  };

  return [
    { label: "Inscritos", value: findTotal("aplicad", "inscrit"), hint: "Total atual", tone: "blue" },
    { label: "Triagem", value: findTotal("triagem"), hint: "Total atual", tone: "green" },
    { label: "Entrevista", value: findTotal("entrevista"), hint: "Total atual", tone: "purple" },
    { label: "Teste", value: findTotal("teste"), hint: "Total atual", tone: "amber" },
    { label: "Aprovados", value: findTotal("contratad", "aprovad"), hint: "Total atual", tone: "green" },
  ];
}

function mapAgenda(events: AgendaEvent[]) {
  return events
    .filter((event) => normalizeKey(event.typeCode) === "entrevista" || normalizeKey(event.title).includes("entrevista"))
    .sort((a, b) => toStringValue(a.startAtUtc).localeCompare(toStringValue(b.startAtUtc)))
    .map((event): AgendaItem => {
      const name = toStringValue(event.candidate, toStringValue(event.title, "Candidato"));
      const role = toStringValue(event.vagaTitle, toStringValue(event.title, "Entrevista"));
      return {
        id: toStringValue(event.id, `${name}-${event.startAtUtc}`),
        time: formatTime(event.startAtUtc),
        name,
        role,
        initials: initials(name),
      };
    });
}

function mapRequisicoes(rows: SolicitacaoVaga[]) {
  return rows.slice(0, 4).map((row): RequisicaoItem => {
    const status = resolveSolicitacaoStatus(row.status);
    const rmCode = row.rmIdReq ? `REQ-${row.rmIdReq}` : "REQ";
    return {
      id: toStringValue(row.id, `${row.titulo}-${row.createdAtUtc}`),
      code: rmCode,
      title: toStringValue(row.titulo, "Requisição de vaga"),
      area: toStringValue(row.centroCustoNome, "Área não informada"),
      city: toStringValue(row.unitName, "Unidade não informada"),
      status: status.label,
      tone: status.tone,
      when: relativeDate(row.createdAtUtc),
    };
  });
}

export default function AnalistaRhMockDashboardScreen({ displayName }: { displayName?: string | null }) {
  const firstName = displayName?.trim().split(/\s+/)[0] || "Ana";
  const [kpis, setKpis] = useState<DashboardKpis>(EMPTY_KPIS);
  const [series, setSeries] = useState<DashboardSeries>(EMPTY_SERIES);
  const [funil, setFunil] = useState<FunilCandidaturas | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [requisicoes, setRequisicoes] = useState<RequisicaoItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [partialError, setPartialError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const { start, end } = todayRange();
    const agendaParams = new URLSearchParams({
      start: start.toISOString(),
      end: end.toISOString(),
      type: "entrevista",
    });

    void Promise.allSettled([
      fetchJson<DashboardKpis>("/api/dashboard/analista-rh/kpis"),
      fetchJson<DashboardSeries>("/api/dashboard/analista-rh/recebidos-series?days=42"),
      fetchJson<FunilCandidaturas>("/api/dashboard/analista-rh/funil"),
      fetchJson<AgendaEvent[]>(`/api/dashboard/analista-rh/agenda-events?${agendaParams.toString()}`),
      fetchJson<SolicitacaoVaga[]>("/api/dashboard/analista-rh/solicitacoes-vaga?pageSize=4"),
      fetchJson<SolicitacaoVaga[]>("/api/dashboard/analista-rh/solicitacoes-vaga?statuses=1&statuses=5&pageSize=100"),
    ]).then(([kpisRes, seriesRes, funilRes, agendaRes, requisicoesRes, approvalsRes]) => {
      if (cancelled) return;

      setPartialError([kpisRes, seriesRes, funilRes, agendaRes, requisicoesRes, approvalsRes].some((r) => r.status === "rejected"));
      if (kpisRes.status === "fulfilled") setKpis(kpisRes.value ?? EMPTY_KPIS);
      if (seriesRes.status === "fulfilled") setSeries(seriesRes.value ?? EMPTY_SERIES);
      if (funilRes.status === "fulfilled") setFunil(funilRes.value ?? null);
      if (agendaRes.status === "fulfilled") setAgenda(mapAgenda(Array.isArray(agendaRes.value) ? agendaRes.value : []));
      if (requisicoesRes.status === "fulfilled") setRequisicoes(mapRequisicoes(Array.isArray(requisicoesRes.value) ? requisicoesRes.value : []));
      if (approvalsRes.status === "fulfilled") setPendingApprovals(Array.isArray(approvalsRes.value) ? approvalsRes.value.length : 0);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const pipeline = useMemo(() => mapPipeline(funil), [funil]);
  const nextInterview = agenda[0]?.time && agenda[0].time !== "--:--" ? `Próxima às ${agenda[0].time}` : "Nenhuma hoje";
  const chartTotal = series.values.reduce((sum, value) => sum + value, 0);
  const chartAverage = Math.round(chartTotal / 6);
  const chartValues = series.values.length ? series.values : [0, 0, 0, 0, 0, 0];
  const chartLabels = series.labels.length ? series.labels.filter((_, index) => index % 7 === 0 || index === series.labels.length - 1).slice(-6) : ["—", "—", "—", "—", "—", "—"];

  const realKpis: KpiItem[] = [
    {
      label: "Solicitações de vaga",
      value: String(kpis.solicitacoesVagaAtivas ?? 0),
      hint: kpis.solicitacoesVagaAtivas > 0 ? "Distribuídas para você" : "Nenhuma ativa",
      icon: ClipboardList,
      tone: "amber",
      href: "/app/gestao/solicitacoes",
    },
    {
      label: "Vagas abertas",
      value: String(kpis.openVagas),
      hint: kpis.vagasForaSla > 0 ? `${kpis.vagasForaSla} fora do SLA` : "Todas dentro do SLA",
      icon: BriefcaseBusiness,
      tone: "blue",
      href: "/app/vagas",
    },
    {
      label: "Novas candidaturas",
      value: String(kpis.cvsHoje),
      hint: "Recebidas hoje",
      icon: UsersRound,
      tone: "green",
    },
    {
      label: "Entrevistas hoje",
      value: String(agenda.length),
      hint: nextInterview,
      icon: CalendarDays,
      tone: "purple",
    },
    {
      label: "Aprovações pendentes",
      value: String(pendingApprovals),
      hint: "Aguardando ação",
      icon: CheckCircle2,
      tone: "amber",
    },
  ];

  const alertas: AlertaItem[] = [
    { label: "Perfis para revisão", desc: "Candidatos sem matching calculado", count: kpis.pendentesMatch, icon: UserRound, tone: "amber" },
    { label: "Aprovações pendentes", desc: "Requisições aguardando aprovação", count: pendingApprovals, icon: CheckCircle2, tone: "purple" },
    { label: "Documentos pendentes", desc: "Sem fonte real conectada para este indicador", count: 0, icon: FileText, tone: "blue" },
    { label: "Entrevistas sem feedback", desc: "Sem fonte real conectada para este indicador", count: 0, icon: CalendarDays, tone: "red" },
  ];

  return (
    <section className="mx-auto max-w-[1440px] space-y-4 text-slate-800">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Bom dia, {firstName}</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">
          Aqui está um resumo do seu dia!
          {loading ? " Carregando indicadores..." : null}
        </p>
        {partialError ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Alguns indicadores não puderam ser carregados e foram exibidos como zero.
          </p>
        ) : null}
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {realKpis.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <Panel className="p-4">
            <PanelHeader title="Pipeline de Recrutamento" />
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {pipeline.map((item, index) => (
                <div key={item.label} className="relative">
                  <div className={`rounded-lg border ${toneClasses[item.tone].border} ${toneClasses[item.tone].bg} p-3 text-center shadow-sm`}>
                    <div className={`text-sm font-bold ${toneClasses[item.tone].text}`}>{item.label}</div>
                    <div className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{item.value}</div>
                    <div className={`mt-1 text-xs font-semibold ${toneClasses[item.tone].text}`}>{item.hint}</div>
                  </div>
                  {index < pipeline.length - 1 ? (
                    <ChevronRight className="absolute -right-5 top-1/2 hidden size-5 -translate-y-1/2 text-slate-300 md:block" />
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel className="p-5">
          <PanelHeader title="Agenda de hoje" action="Ver agenda completa" actionHref="/app/agendas" />
          <div className="mt-4 space-y-4">
            {agenda.length > 0 ? (
              agenda.slice(0, 4).map((item, index) => (
                <div key={item.id} className="flex items-center gap-3">
                  <div className="w-12 shrink-0 text-sm font-bold text-blue-600">{item.time}</div>
                  <Avatar initials={item.initials} index={index} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-slate-900">{item.name}</div>
                    <div className="truncate text-xs font-medium text-slate-500">{item.role}</div>
                  </div>
                  <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600">Entrevista</span>
                  <MoreVertical className="size-4 text-slate-300" />
                </div>
              ))
            ) : (
              <EmptyLine>Nenhuma entrevista agendada para hoje.</EmptyLine>
            )}
          </div>
          {agenda.length > 4 ? (
            <a href="/app/agendas" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
              + {agenda.length - 4} entrevistas agendadas
            </a>
          ) : null}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(360px,1.05fr)_minmax(360px,1.2fr)]">
        <Panel className="p-5">
          <PanelHeader title="Volume de candidaturas" action="Últimas 6 semanas" mutedAction />
          <div className="mt-3">
            <LineChart values={chartValues} />
            <div className="mt-1 grid grid-cols-6 text-[11px] font-medium text-slate-400">
              {chartLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 rounded-lg bg-slate-50 py-3 text-center">
            <div>
              <div className="text-xs font-medium text-slate-500">Total no período</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{chartTotal}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Média por semana</div>
              <div className="mt-1 text-xl font-bold text-slate-900">{chartAverage}</div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Requisições recentes" action="Ver todas" actionHref="/app/gestao/solicitacoes" />
          <div className="mt-3 divide-y divide-slate-100">
            {requisicoes.length > 0 ? (
              requisicoes.map((item) => (
                <Link
                  key={item.id}
                  href={`/app/gestao/solicitacoes?view=${encodeURIComponent(item.id)}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0 transition hover:bg-slate-50 rounded-lg px-1 -mx-1 cursor-pointer"
                >
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
                    <BriefcaseBusiness className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-xs font-bold text-slate-500">{item.code}</span>
                      <span className="truncate text-sm font-bold text-slate-900">{item.title}</span>
                    </div>
                    <div className="mt-0.5 text-xs font-medium text-slate-500">
                      {item.area} <span className="mx-1">•</span> {item.city}
                    </div>
                  </div>
                  <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                  <span className="w-16 text-right text-xs font-medium text-slate-500">{item.when}</span>
                </Link>
              ))
            ) : (
              <EmptyLine>Nenhuma requisição recente encontrada.</EmptyLine>
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Alertas e pendências" action="Ver todas" actionHref="/app/gestao/solicitacoes" />
          <div className="mt-3 space-y-3">
            {alertas.map(({ label, desc, count, icon: Icon, tone }) => (
              <a
                key={label}
                href="/app/gestao/solicitacoes"
                className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-slate-50"
              >
                <div className={`rounded-full p-2.5 ${toneClasses[tone].soft}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="truncate text-xs font-medium text-slate-500">{desc}</div>
                </div>
                <span className={`min-w-10 rounded-full px-3 py-1 text-center text-sm font-bold ${toneClasses[tone].soft}`}>
                  {count}
                </span>
                <ChevronRight className="size-4 text-slate-300" />
              </a>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({
  title,
  action,
  actionHref = "#",
  mutedAction = false,
}: {
  title: string;
  action?: string;
  actionHref?: string;
  mutedAction?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action ? (
        <a href={actionHref} className={`text-xs font-bold ${mutedAction ? "text-slate-400" : "text-blue-600"}`}>
          {action}
        </a>
      ) : null}
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
}) {
  const content = (
    <Panel className={`p-5 ${href ? "transition hover:border-blue-200 hover:shadow-md" : ""}`}>
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 ${toneClasses[tone].soft}`}>
          <Icon className="size-7 stroke-[1.8]" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-700">{label}</div>
          <div className="mt-1 text-3xl font-bold leading-none tabular-nums text-slate-900">{value}</div>
          <div className={`mt-1 text-xs font-bold ${toneClasses[tone].text}`}>{hint}</div>
        </div>
      </div>
    </Panel>
  );

  if (href) {
    return (
      <a href={href} className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
        {content}
      </a>
    );
  }

  return content;
}

function Avatar({ initials: text, index }: { initials: string; index: number }) {
  const gradients = [
    "from-blue-200 to-amber-100 text-blue-900",
    "from-rose-200 to-orange-100 text-rose-900",
    "from-cyan-200 to-blue-100 text-cyan-900",
    "from-purple-200 to-rose-100 text-purple-900",
  ];

  return (
    <div className={`grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold shadow-inner ${gradients[index % gradients.length]}`}>
      {text}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClasses[tone].soft}`}>
      {children}
    </span>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm font-medium text-slate-500">{children}</div>;
}

function LineChart({ values }: { values: number[] }) {
  const width = 420;
  const height = 150;
  const padding = 10;
  const max = Math.max(10, ...values);
  const min = 0;
  const stepX = values.length > 1 ? (width - padding * 2) / (values.length - 1) : 0;
  const points = values.map((value, index) => {
    const x = padding + index * stepX;
    const y = height - padding - ((value - min) / (max - min)) * (height - padding * 2);
    return { x, y };
  });
  const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const areaPath = `${path} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[150px] w-full overflow-visible" role="img" aria-label="Volume de candidaturas nas últimas seis semanas">
      <defs>
        <linearGradient id="candidateVolumeGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const tick = Math.round(max * ratio);
        const y = height - padding - ratio * (height - padding * 2);
        return (
          <g key={ratio}>
            <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
            <text x="0" y={y + 3} className="fill-slate-400 text-[10px]">
              {tick}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#candidateVolumeGradient)" />
      <path d={path} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      {points.map((point) => (
        <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="4" fill="#2563eb" stroke="#fff" strokeWidth="2" />
      ))}
    </svg>
  );
}
