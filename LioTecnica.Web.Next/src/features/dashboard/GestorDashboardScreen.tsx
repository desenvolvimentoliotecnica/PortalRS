"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileText,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDashboardAgregado } from "./useDashboardAgregado";
import type {
  DashboardGestorAgendaTecnicaItem,
  DashboardGestorCandidaturaItem,
  DashboardGestorSection,
  DashboardGestorVagaAbertaItem,
} from "./dashboardAgregadoTypes";

type Tone = "blue" | "green" | "purple" | "amber" | "red" | "slate";

type KpiItem = {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
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
  slate: {
    soft: "bg-slate-100 text-slate-600",
    text: "text-slate-600",
    border: "border-slate-100",
    bg: "bg-slate-50",
  },
};

function formatDateTime(iso?: string | null) {
  if (!iso) return "Sem horário";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sem horário";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(iso?: string | null) {
  if (!iso) return "--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--";
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function stageLabel(value: string) {
  const labels: Record<string, string> = {
    Entrevista: "Entrevista",
    EntrevistaTecnica: "Entrevista técnica",
    Teste: "Teste",
    Proposta: "Proposta",
  };
  return labels[value] ?? value;
}

function responseLabel(value?: string | null) {
  if (!value) return "Aguardando candidato";
  const normalized = value.toLowerCase();
  if (normalized.includes("confirm")) return "Confirmado pelo candidato";
  if (normalized.includes("suger")) return "Sugeriu novo horário";
  if (normalized.includes("recus")) return "Recusado";
  return value;
}

function todayGreeting(displayName?: string | null) {
  const firstName = displayName?.trim().split(/\s+/)[0];
  return firstName ? `Bom dia, ${firstName}` : "Bom dia, gestor";
}

export default function GestorDashboardScreen({ displayName }: { displayName?: string | null }) {
  const { data, loading, error, refresh } = useDashboardAgregado("gestor");
  const gestor = data?.gestor ?? null;

  if (loading && !gestor) {
    return <SkeletonDashboard />;
  }

  return (
    <section className="mx-auto max-w-[1440px] space-y-4 text-slate-800">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">{todayGreeting(displayName)}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Aqui está um resumo das suas requisições, vagas, candidatos e entrevistas técnicas.
            {loading ? " Carregando indicadores..." : null}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      {error ? (
        <StateCard tone="red" icon={AlertCircle} title="Não foi possível carregar o dashboard" desc={error} />
      ) : null}

      {!error && !gestor ? (
        <StateCard
          tone="amber"
          icon={AlertCircle}
          title="Perfil de gestor indisponível"
          desc="Seu usuário precisa estar vinculado a um funcionário para montar a visão de equipe, vagas e agenda técnica."
        />
      ) : null}

      {gestor ? <GestorDashboardContent data={gestor} /> : null}
    </section>
  );
}

function GestorDashboardContent({ data }: { data: DashboardGestorSection }) {
  const kpis: KpiItem[] = [
    {
      label: "Requisições abertas",
      value: data.requisicoesPessoalAtivas,
      hint: "Requisições de pessoal ativas na sua carteira",
      icon: FileText,
      tone: data.requisicoesPessoalAtivas > 0 ? "amber" : "green",
      href: "/app/gestao/solicitacoes",
    },
    {
      label: "Vagas em andamento",
      value: data.posicoesRequisicoesAtivas,
      hint: "Posições solicitadas nas requisições ativas",
      icon: BriefcaseBusiness,
      tone: "blue",
      href: "/app/gestao/solicitacoes",
    },
    {
      label: "Candidatos avançados",
      value: data.candidaturasEtapaAvancada,
      hint: "Entrevista, teste ou proposta",
      icon: UserRoundCheck,
      tone: "purple",
      href: "/app/candidaturas",
    },
    {
      label: "Entrevistas próximas",
      value: data.agendaTecnicaProxima.length,
      hint: "Agenda técnica dos próximos 30 dias",
      icon: CalendarDays,
      tone: "green",
      href: "/app/agendas",
    },
    {
      label: "Fora do SLA",
      value: data.carteiraVagasParadas,
      hint: "Vagas abertas que precisam de atenção",
      icon: AlertCircle,
      tone: data.carteiraVagasParadas > 0 ? "red" : "slate",
      href: "/app/vagas?sla=fora",
    },
  ];

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Resumo da gestão" />
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <MiniStat label="Diretos ativos" value={data.diretosAtivos} icon={UsersRound} tone="green" />
              <MiniStat
                label="Dados incompletos"
                value={data.diretosComDadosIncompletos}
                icon={AlertCircle}
                tone={data.diretosComDadosIncompletos > 0 ? "amber" : "slate"}
              />
              <MiniStat
                label="Aprovações minhas"
                value={data.aprovacoesPendentesMinhas}
                icon={CheckCircle2}
                tone={data.aprovacoesPendentesMinhas > 0 ? "amber" : "slate"}
              />
              <MiniStat
                label="Avaliações pendentes"
                value={data.avaliacoesDiretosPendentes}
                icon={Clock3}
                tone={data.avaliacoesDiretosPendentes > 0 ? "amber" : "slate"}
              />
            </div>
          </Panel>
        </div>

        <Panel>
          <PanelHeader title="Agenda técnica" action="Ver agenda completa" actionHref="/app/agendas" />
          <div className="mt-4">
            <AgendaList items={data.agendaTecnicaProxima} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="Vagas que precisam de atenção" />
          <VagasList items={data.vagasMaisAntigas} />
        </Panel>

        <Panel>
          <PanelHeader title="Candidatos em destaque" />
          <CandidatosList items={data.candidaturasEmDestaque} />
        </Panel>
      </div>
    </>
  );
}

function KpiCard({ item }: { item: KpiItem }) {
  const content = (
    <div className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition hover:border-blue-100 hover:shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-2.5 ${toneClasses[item.tone].soft}`}>
          <item.icon className="size-5" />
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${toneClasses[item.tone].soft}`}>
          {item.value > 0 ? "Ativo" : "Ok"}
        </span>
      </div>
      <div className="mt-5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
        {item.value.toLocaleString("pt-BR")}
      </div>
      <div className="mt-1 text-sm font-bold text-slate-900">{item.label}</div>
      <div className={`mt-1 text-xs font-semibold ${toneClasses[item.tone].text}`}>{item.hint}</div>
    </div>
  );

  if (!item.href) return content;
  return (
    <Link href={item.href} className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
      {content}
    </Link>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
      {children}
    </section>
  );
}

function PanelHeader({
  title,
  action,
  actionHref,
}: {
  title: string;
  action?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      {action && actionHref ? (
        <Link href={actionHref} className="text-xs font-bold text-blue-600 hover:text-blue-700">
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function AgendaList({ items }: { items: DashboardGestorAgendaTecnicaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        icon={CalendarDays}
        title="Nenhuma entrevista técnica próxima"
        desc="Quando o RH agendar entrevistas técnicas ligadas à sua carteira, elas aparecerão aqui."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.eventoId}
          href="/app/agendas"
          className="block rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
                  Entrevista técnica
                </span>
                <span className="text-xs font-semibold text-slate-500">{responseLabel(item.candidateResponseStatus)}</span>
              </div>
              <h3 className="mt-2 text-sm font-bold text-slate-900">{item.candidate || item.titulo}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {item.vagaTitle || "Vaga não informada"}
                {item.vagaCode ? ` · ${item.vagaCode}` : ""}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Responsável: {item.owner || "não informado"}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
              <div className="text-sm font-bold text-blue-700">{formatDateTime(item.startAtUtc)}</div>
              <div className="text-xs text-slate-400">até {formatTime(item.endAtUtc)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function VagasList({ items }: { items: DashboardGestorVagaAbertaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        icon={BriefcaseBusiness}
        title="Nenhuma vaga aberta na carteira"
        desc="As vagas abertas vinculadas ao seu time ou centro de custo aparecerão aqui."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.vagaId}
          href={`/app/vagas/${item.vagaId}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">{item.titulo}</div>
            <div className="mt-1 text-xs text-slate-500">
              {item.codigo || "Sem código"} · {item.candidaturas} candidatura{item.candidaturas === 1 ? "" : "s"}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-sm font-bold ${item.foraDoSla ? "text-rose-600" : "text-slate-700"}`}>
              {item.diasAberta}d
            </div>
            <div className="text-xs text-slate-400">{item.foraDoSla ? "Fora do SLA" : "Em prazo"}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function CandidatosList({ items }: { items: DashboardGestorCandidaturaItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyBlock
        icon={UserRoundCheck}
        title="Nenhum candidato em destaque"
        desc="Candidatos em entrevista, teste ou proposta aparecerão aqui para acompanhamento."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Link
          key={item.candidaturaId}
          href={`/app/vagas/${item.vagaId}`}
          className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/30"
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">{item.candidatoNome}</div>
            <div className="mt-1 truncate text-xs text-slate-500">{item.vagaTitulo || "Vaga não informada"}</div>
          </div>
          <div className="shrink-0 text-right">
            <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">
              {stageLabel(item.etapaMacro)}
            </span>
            <div className="mt-1 text-xs text-slate-400">
              {item.diasNaEtapa == null ? "Sem data" : `${item.diasNaEtapa}d na etapa`}
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: LucideIcon; tone: Tone }) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone].border} ${toneClasses[tone].bg}`}>
      <div className="flex items-center gap-2">
        <Icon className={`size-4 ${toneClasses[tone].text}`} />
        <span className="text-xs font-semibold text-slate-500">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{value.toLocaleString("pt-BR")}</div>
    </div>
  );
}

function EmptyBlock({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <Icon className="mx-auto size-6 text-slate-400" />
      <div className="mt-3 text-sm font-bold text-slate-700">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
    </div>
  );
}

function StateCard({
  tone,
  icon: Icon,
  title,
  desc,
}: {
  tone: Tone;
  icon: LucideIcon;
  title: string;
  desc: string;
}) {
  return (
    <div className={`rounded-3xl border p-5 ${toneClasses[tone].border} ${toneClasses[tone].bg}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-2xl p-2 ${toneClasses[tone].soft}`}>
          <Icon className="size-5" />
        </div>
        <div>
          <div className="font-bold text-slate-900">{title}</div>
          <p className="mt-1 text-sm leading-5 text-slate-600">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function SkeletonDashboard() {
  return (
    <section className="mx-auto max-w-[1440px] space-y-4 text-slate-800">
      <div className="space-y-4">
        <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-white" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="h-72 animate-pulse rounded-2xl bg-white" />
          <div className="h-72 animate-pulse rounded-2xl bg-white" />
        </div>
      </div>
    </section>
  );
}
