"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import Chart from "chart.js/auto";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Filter,
  Handshake,
  MessageCircleMore,
  MoreVertical,
  Sparkles,
  Upload,
  UserPlus,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "green" | "purple" | "amber" | "red";

const toneClasses: Record<
  Tone,
  { soft: string; text: string; border: string; bg: string; card: string; iconBg: string }
> = {
  blue: {
    soft: "bg-blue-50 text-blue-600",
    text: "text-blue-600",
    border: "border-blue-200",
    bg: "bg-blue-50",
    card: "border-blue-100 bg-gradient-to-br from-blue-50/90 via-white to-white",
    iconBg: "bg-blue-100 text-blue-600",
  },
  green: {
    soft: "bg-emerald-50 text-emerald-600",
    text: "text-emerald-600",
    border: "border-emerald-200",
    bg: "bg-emerald-50",
    card: "border-emerald-100 bg-gradient-to-br from-emerald-50/90 via-white to-white",
    iconBg: "bg-emerald-100 text-emerald-600",
  },
  purple: {
    soft: "bg-violet-50 text-violet-600",
    text: "text-violet-600",
    border: "border-violet-200",
    bg: "bg-violet-50",
    card: "border-violet-100 bg-gradient-to-br from-violet-50/90 via-white to-white",
    iconBg: "bg-violet-100 text-violet-600",
  },
  amber: {
    soft: "bg-amber-50 text-amber-600",
    text: "text-amber-600",
    border: "border-amber-200",
    bg: "bg-amber-50",
    card: "border-amber-100 bg-gradient-to-br from-amber-50/90 via-white to-white",
    iconBg: "bg-amber-100 text-amber-600",
  },
  red: {
    soft: "bg-rose-50 text-rose-600",
    text: "text-rose-600",
    border: "border-rose-200",
    bg: "bg-rose-50",
    card: "border-rose-100 bg-gradient-to-br from-rose-50/90 via-white to-white",
    iconBg: "bg-rose-100 text-rose-600",
  },
};

const KPIS = [
  { label: "Vagas abertas", value: "12", hint: "Em publicação ativa", icon: BriefcaseBusiness, tone: "blue" as Tone },
  { label: "CVs recebidos hoje", value: "8", hint: "Entrada do dia", icon: FileText, tone: "green" as Tone },
  { label: "Pendentes de matching", value: "15", hint: "Aguardando IA", icon: Sparkles, tone: "purple" as Tone },
  { label: "Aprovados (7 dias)", value: "4", hint: "Avançaram no funil", icon: CheckCircle2, tone: "green" as Tone },
  { label: "Vagas fora do SLA", value: "2", hint: "Requer atenção", icon: AlertTriangle, tone: "red" as Tone },
];

type FunnelStage = {
  label: string;
  value: number;
  bg: string;
  icon: LucideIcon;
  iconClass: string;
};

const FUNIL_STAGES: FunnelStage[] = [
  { label: "Candidatos", value: 47, bg: "#4A3AFF", icon: UsersRound, iconClass: "text-white" },
  { label: "Triagem", value: 18, bg: "#DDE3F0", icon: Filter, iconClass: "text-[#4A3AFF]" },
  { label: "Entrevista", value: 9, bg: "#27C26C", icon: MessageCircleMore, iconClass: "text-white" },
  { label: "Teste", value: 5, bg: "#FFC12F", icon: FileText, iconClass: "text-white" },
  { label: "Proposta", value: 3, bg: "#9132D1", icon: Handshake, iconClass: "text-white" },
];

const CHEVRON_TIP = 22;

const AGENDA = [
  { time: "09:00", name: "Carlos Silva", role: "Analista de Dados", initials: "CS" },
  { time: "10:30", name: "Mariana Santos", role: "Desenvolvedor .NET", initials: "MS" },
  { time: "14:00", name: "Pedro Alves", role: "Analista de RH", initials: "PA" },
  { time: "16:00", name: "Ana Costa", role: "Assistente Financeiro", initials: "AC" },
];

const REQUISICOES = [
  { code: "REQ-3042", title: "Analista de Dados", area: "TI", status: "Nova", tone: "blue" as Tone, when: "Hoje" },
  { code: "REQ-2987", title: "Desenvolvedor .NET", area: "Engenharia", status: "Em análise", tone: "amber" as Tone, when: "Ontem" },
  { code: "REQ-3015", title: "Assistente Financeiro", area: "Financeiro", status: "Aprovada", tone: "green" as Tone, when: "2 dias" },
  { code: "REQ-2940", title: "Analista de RH", area: "Gente e Gestão", status: "Em análise", tone: "amber" as Tone, when: "3 dias" },
];

const ACOES_RAPIDAS = [
  { label: "Publicar vaga", icon: BriefcaseBusiness, href: "/app/dashboard/preview/publicar-vaga", tone: "blue" as Tone },
  { label: "Ver matching", icon: Sparkles, href: "/app/matching", tone: "purple" as Tone },
  { label: "Triagem", icon: UsersRound, href: "/app/triagem", tone: "green" as Tone },
  { label: "Nova admissão", icon: UserPlus, href: "/app/admissao", tone: "green" as Tone },
  { label: "Importar CV", icon: Upload, href: "/app/candidatos", tone: "amber" as Tone },
  { label: "Agendar entrevista", icon: CalendarDays, href: "/app/agendas", tone: "blue" as Tone },
];

const ALERTAS = [
  { label: "Pré-admissões aguardando validação", desc: "Documentos pendentes de conferência", count: 3, tone: "red" as Tone },
  { label: "Candidatos sem retorno há 48h", desc: "Follow-up recomendado", count: 5, tone: "amber" as Tone },
  { label: "Propostas pendentes de aceite", desc: "Aguardando resposta do candidato", count: 2, tone: "purple" as Tone },
  { label: "Vaga sem publicar há 3 dias", desc: "Requisição aprovada sem publicação", count: 1, tone: "red" as Tone },
];

const CHART_LABELS = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5", "Sem 6"];
const CHART_VALUES = [12, 18, 9, 22, 15, 8];

/**
 * Conceito visual da home do analista de RH (R&S).
 * Rota oculta para avaliação — dados estáticos baseados no mockup home-analista-rh-portal-rs-mockup.png.
 */
export default function AnalistaRhHomePreviewScreen() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-4 text-slate-800">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Bom dia, Ana</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Sua operação de recrutamento em um só lugar</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {KPIS.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)] xl:items-stretch">
        <div className="flex h-full min-h-0 flex-col gap-4">
          <Panel className="shrink-0 p-4">
            <PanelHeader title="Funil do processo seletivo" />
            <ProcessoSeletivoChevronFunnel stages={FUNIL_STAGES} />
          </Panel>

          <Panel className="flex min-h-0 flex-1 flex-col p-4">
            <PanelHeader title="Currículos recebidos (6 semanas)" mutedAction action="Últimas 6 semanas" />
            <div className="mt-3 flex min-h-0 flex-1 flex-col">
              <div className="relative min-h-[8rem] flex-1">
                <CurriculosChart labels={CHART_LABELS} values={CHART_VALUES} />
              </div>
              <div className="mt-3 shrink-0 grid grid-cols-2 divide-x divide-slate-200 rounded-lg bg-slate-50 py-3 text-center">
              <div>
                <div className="text-xs font-medium text-slate-500">Total no período</div>
                <div className="mt-1 text-xl font-bold text-slate-900">{CHART_VALUES.reduce((a, b) => a + b, 0)}</div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">Média por semana</div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {Math.round(CHART_VALUES.reduce((a, b) => a + b, 0) / CHART_VALUES.length)}
                </div>
              </div>
              </div>
            </div>
          </Panel>
        </div>

        <Panel className="flex h-full min-h-[28rem] flex-col p-5">
          <PanelHeader title="Agenda de hoje" action="Ver agenda completa" actionHref="/app/agendas" />
          <AgendaRuledList items={AGENDA} totalRows={8} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.9fr)_minmax(320px,1fr)]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-100 px-5 py-4">
            <PanelHeader title="Minhas requisições" action="Ver todas" actionHref="/app/gestao/solicitacoes" />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">REQ</th>
                  <th className="px-3 py-3">Vaga</th>
                  <th className="px-3 py-3">Área</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Quando</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {REQUISICOES.map((item) => (
                  <tr key={item.code} className="transition hover:bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-500">{item.code}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{item.title}</td>
                    <td className="px-3 py-3 text-slate-600">{item.area}</td>
                    <td className="px-3 py-3">
                      <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-500">{item.when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Ações rápidas" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {ACOES_RAPIDAS.map(({ label, icon: Icon, href, tone }) => (
              <Link
                key={label}
                href={href}
                className={`flex flex-col items-center gap-2 rounded-xl border ${toneClasses[tone].border} bg-white p-4 text-center transition hover:shadow-md`}
              >
                <div className={`rounded-xl p-2.5 ${toneClasses[tone].soft}`}>
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-bold text-slate-700">{label}</span>
              </Link>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Alertas e pendências" action="Ver todas" actionHref="/app/gestao/solicitacoes" />
          <div className="mt-3 space-y-3">
            {ALERTAS.map(({ label, desc, count, tone }) => (
              <div key={label} className="flex items-center gap-3 rounded-xl px-1 py-1">
                <div className={`rounded-full p-2.5 ${toneClasses[tone].soft}`}>
                  <AlertTriangle className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-slate-900">{label}</div>
                  <div className="truncate text-xs font-medium text-slate-500">{desc}</div>
                </div>
                <span className={`min-w-10 rounded-full px-3 py-1 text-center text-sm font-bold ${toneClasses[tone].soft}`}>
                  {count}
                </span>
                <ChevronRight className="size-4 text-slate-300" />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  );
}

function ProcessoSeletivoChevronFunnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="mt-4 rounded-xl bg-[#FBF8F3] px-2 py-4 sm:px-4">
      <div className="flex w-full items-stretch">
        {stages.map((stage, index) => {
          const isFirst = index === 0;
          const clipPath = isFirst
            ? `polygon(12px 0, calc(100% - ${CHEVRON_TIP}px) 0, 100% 50%, calc(100% - ${CHEVRON_TIP}px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px)`
            : `polygon(0 0, calc(100% - ${CHEVRON_TIP}px) 0, 100% 50%, calc(100% - ${CHEVRON_TIP}px) 100%, 0 100%, ${CHEVRON_TIP}px 50%)`;

          return (
            <div
              key={stage.label}
              className="relative flex min-w-0 flex-1 flex-col items-center"
              style={{ marginLeft: index > 0 ? -CHEVRON_TIP / 2 : 0, zIndex: index + 1 }}
            >
              <div
                className="grid h-[4rem] w-full place-items-center shadow-sm sm:h-[4.25rem]"
                style={{ backgroundColor: stage.bg, clipPath }}
              >
                <stage.icon className={`size-7 stroke-[1.75] sm:size-8 ${stage.iconClass}`} aria-hidden />
              </div>
              <p className="mt-3 text-center text-sm font-semibold text-slate-600">{stage.label}</p>
              <div className="relative mt-1 flex w-full items-center justify-center">
                {index > 0 ? (
                  <ChevronRight
                    className="absolute -left-2 size-4 text-slate-300 sm:-left-3"
                    aria-hidden
                  />
                ) : null}
                <p className="text-3xl font-bold tabular-nums text-slate-800">{stage.value}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaRuledList({
  items,
  totalRows,
}: {
  items: { time: string; name: string; role: string; initials: string }[];
  totalRows: number;
}) {
  return (
    <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-100" role="list" aria-label="Agenda de hoje">
      {Array.from({ length: totalRows }, (_, index) => {
        const item = items[index];
        return (
          <div
            key={item ? item.name : `empty-${index}`}
            className="flex min-h-[4.5rem] flex-1 items-center gap-3 border-b border-slate-100 px-3 last:border-b-0"
            role="listitem"
          >
            {item ? (
              <>
                <div className="w-12 shrink-0 text-sm font-bold text-blue-600">{item.time}</div>
                <Avatar initials={item.initials} index={index} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">{item.name}</div>
                  <div className="truncate text-xs font-medium text-slate-500">{item.role}</div>
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600">Entrevista</span>
                <MoreVertical className="size-4 shrink-0 text-slate-300" />
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CurriculosChart({ labels, values }: { labels: string[]; values: number[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    const ctx = canvasRef.current;
    if (!ctx) return;

    if (chartRef.current) {
      chartRef.current.data.labels = labels;
      chartRef.current.data.datasets[0]!.data = values;
      chartRef.current.update();
      return;
    }

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Currículos",
            data: values,
            borderColor: "#2563eb",
            backgroundColor: "rgba(37, 99, 235, 0.12)",
            pointBackgroundColor: "#2563eb",
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.35,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (item) => ` ${item.parsed.y} currículos`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#94a3b8", font: { size: 11, weight: 500 } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.25)" },
            ticks: { color: "#94a3b8", precision: 0, font: { size: 11 } },
          },
        },
      },
    });

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [labels, values]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!chartRef.current) return;
        const { width, height } = container.getBoundingClientRect();
        if (width > 0 && height > 0) chartRef.current.resize(width, height);
      });
    });

    ro.observe(container);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
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
        <Link href={actionHref} className={`text-xs font-bold ${mutedAction ? "text-slate-400" : "text-blue-600"}`}>
          {action}
        </Link>
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
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <div className={`rounded-2xl border shadow-[0_10px_30px_rgba(15,23,42,0.04)] ${toneClasses[tone].card} ${toneClasses[tone].border} p-5`}>
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3.5 ${toneClasses[tone].iconBg}`}>
          <Icon className="size-8 stroke-[1.8] sm:size-9" />
        </div>
        <div>
          <div className="text-sm font-bold text-slate-700">{label}</div>
          <div className="mt-1 text-3xl font-bold leading-none tabular-nums text-slate-900">{value}</div>
          <div className={`mt-1 text-xs font-bold ${toneClasses[tone].text}`}>{hint}</div>
        </div>
      </div>
    </div>
  );
}

function Avatar({ initials, index }: { initials: string; index: number }) {
  const gradients = [
    "from-blue-200 to-amber-100 text-blue-900",
    "from-rose-200 to-orange-100 text-rose-900",
    "from-cyan-200 to-blue-100 text-cyan-900",
    "from-purple-200 to-rose-100 text-purple-900",
  ];

  return (
    <div
      className={`grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold shadow-inner ${gradients[index % gradients.length]}`}
    >
      {initials}
    </div>
  );
}

function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${toneClasses[tone].soft}`}>{children}</span>;
}
