"use client";

import type { ReactNode } from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Filter,
  MoreVertical,
  Plus,
  Send,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Tone = "blue" | "green" | "purple" | "amber" | "red";

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

const kpis = [
  {
    label: "Vagas abertas",
    value: "18",
    hint: "3 publicadas hoje",
    icon: BriefcaseBusiness,
    tone: "blue" as const,
  },
  {
    label: "Novas candidaturas",
    value: "42",
    hint: "+12 em relação a ontem",
    icon: UsersRound,
    tone: "green" as const,
  },
  {
    label: "Entrevistas hoje",
    value: "7",
    hint: "Próxima às 10:00",
    icon: CalendarDays,
    tone: "purple" as const,
  },
  {
    label: "Aprovações pendentes",
    value: "5",
    hint: "Aguardando sua ação",
    icon: CheckCircle2,
    tone: "amber" as const,
  },
];

const quickActions = [
  { label: "Nova vaga", icon: Plus },
  { label: "Triar candidatos", icon: Filter },
  { label: "Agendar entrevista", icon: CalendarDays },
  { label: "Publicar vaga", icon: Send },
];

const pipeline = [
  { label: "Inscritos", value: 128, hint: "+18 hoje", tone: "blue" as const },
  { label: "Triagem", value: 64, hint: "+7 hoje", tone: "green" as const },
  { label: "Entrevista", value: 23, hint: "+5 hoje", tone: "purple" as const },
  { label: "Teste", value: 12, hint: "+2 hoje", tone: "amber" as const },
  { label: "Aprovados", value: 8, hint: "+1 hoje", tone: "green" as const },
];

const agenda = [
  { time: "10:00", name: "Ricardo Mendes", role: "Analista de Marketing Pleno", initials: "RM" },
  { time: "11:00", name: "Juliana Costa", role: "Analista de RH Sênior", initials: "JC" },
  { time: "14:00", name: "Felipe Andrade", role: "Desenvolvedor Front-end", initials: "FA" },
  { time: "15:30", name: "Mariana Oliveira", role: "Assistente Administrativo", initials: "MO" },
];

const requisicoes = [
  { code: "REQ-2478", title: "Analista de Marketing Pleno", area: "Marketing", city: "São Paulo - SP", status: "Aprovada", tone: "green" as const, when: "Hoje" },
  { code: "REQ-2477", title: "Desenvolvedor Back-end", area: "TI", city: "Remoto", status: "Em análise", tone: "amber" as const, when: "Ontem" },
  { code: "REQ-2476", title: "Analista Financeiro", area: "Financeiro", city: "São Paulo - SP", status: "Em análise", tone: "amber" as const, when: "2 dias atrás" },
  { code: "REQ-2475", title: "Assistente Administrativo", area: "Administrativo", city: "Campinas - SP", status: "Nova", tone: "blue" as const, when: "2 dias atrás" },
];

const alertas = [
  { label: "Perfis para revisão", desc: "Candidatos aguardando análise de perfil", count: 12, icon: UserRound, tone: "amber" as const },
  { label: "Aprovações pendentes", desc: "Requisições aguardando sua aprovação", count: 5, icon: CheckCircle2, tone: "purple" as const },
  { label: "Documentos pendentes", desc: "Documentos aguardando envio ou validação", count: 8, icon: FileText, tone: "blue" as const },
  { label: "Entrevistas sem feedback", desc: "Entrevistas realizadas aguardando feedback", count: 3, icon: CalendarDays, tone: "red" as const },
];

const chartPoints = [12, 34, 38, 55, 43, 66, 72, 90];
const chartLabels = ["06/mai", "13/mai", "20/mai", "27/mai", "03/jun", "10/jun"];

export default function AnalistaRhMockDashboardScreen({ displayName }: { displayName?: string | null }) {
  const firstName = displayName?.trim().split(/\s+/)[0] || "Ana";

  return (
    <section className="mx-auto max-w-[1440px] space-y-4 text-slate-800">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Bom dia, {firstName} 👋</h1>
        <p className="mt-1 text-sm font-medium text-slate-500">Aqui está um resumo do seu dia.</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((item) => (
          <KpiCard key={item.label} {...item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <Panel className="p-4">
            <PanelHeader title="Ações rápidas" />
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {quickActions.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-semibold text-blue-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </Panel>

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
            <a href="/app/candidaturas" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
              Ver pipeline completo <ChevronRight className="size-4" />
            </a>
          </Panel>
        </div>

        <Panel className="p-5">
          <PanelHeader title="Agenda de hoje" action="Ver agenda completa" />
          <div className="mt-4 space-y-4">
            {agenda.map((item, index) => (
              <div key={`${item.time}-${item.name}`} className="flex items-center gap-3">
                <div className="w-12 shrink-0 text-sm font-bold text-blue-600">{item.time}</div>
                <Avatar initials={item.initials} index={index} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-slate-900">{item.name}</div>
                  <div className="truncate text-xs font-medium text-slate-500">{item.role}</div>
                </div>
                <span className="rounded-md bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-600">Entrevista</span>
                <MoreVertical className="size-4 text-slate-300" />
              </div>
            ))}
          </div>
          <a href="/app/recrutamento/entrevistas" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-600">
            + 3 entrevistas agendadas
          </a>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(300px,0.95fr)_minmax(360px,1.05fr)_minmax(360px,1.2fr)]">
        <Panel className="p-5">
          <PanelHeader title="Volume de candidaturas" action="Últimas 6 semanas" mutedAction />
          <div className="mt-3">
            <LineChart values={chartPoints} />
            <div className="mt-1 grid grid-cols-6 text-[11px] font-medium text-slate-400">
              {chartLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 divide-x divide-slate-200 rounded-lg bg-slate-50 py-3 text-center">
            <div>
              <div className="text-xs font-medium text-slate-500">Total no período</div>
              <div className="mt-1 text-xl font-bold text-slate-900">312</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Média por semana</div>
              <div className="mt-1 text-xl font-bold text-slate-900">52</div>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Requisições recentes" action="Ver todas" />
          <div className="mt-3 divide-y divide-slate-100">
            {requisicoes.map((item) => (
              <div key={item.code} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
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
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader title="Alertas e pendências" action="Ver todas" />
          <div className="mt-3 space-y-3">
            {alertas.map(({ label, desc, count, icon: Icon, tone }) => (
              <a
                key={label}
                href="/app/gestao/painel-solicitacoes"
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
  mutedAction = false,
}: {
  title: string;
  action?: string;
  mutedAction?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action ? (
        <a
          href="#"
          className={`text-xs font-bold ${mutedAction ? "text-slate-400" : "text-blue-600"}`}
          onClick={(event) => event.preventDefault()}
        >
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
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
}) {
  return (
    <Panel className="p-5">
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
}

function Avatar({ initials, index }: { initials: string; index: number }) {
  const gradients = [
    "from-blue-200 to-amber-100 text-blue-900",
    "from-rose-200 to-orange-100 text-rose-900",
    "from-cyan-200 to-blue-100 text-cyan-900",
    "from-purple-200 to-rose-100 text-purple-900",
  ];

  return (
    <div className={`grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br text-xs font-bold shadow-inner ${gradients[index % gradients.length]}`}>
      {initials}
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

function LineChart({ values }: { values: number[] }) {
  const width = 420;
  const height = 150;
  const padding = 10;
  const max = 100;
  const min = 0;
  const stepX = (width - padding * 2) / (values.length - 1);
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
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = height - padding - (tick / 100) * (height - padding * 2);
        return (
          <g key={tick}>
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
