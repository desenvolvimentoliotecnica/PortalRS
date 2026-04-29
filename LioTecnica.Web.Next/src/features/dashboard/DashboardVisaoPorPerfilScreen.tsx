"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  AlertCircle,
  Users,
  Briefcase,
  UserCheck,
  ClipboardList,
  Clock,
  TrendingUp,
  UserPlus,
  Building2,
  FileWarning,
} from "lucide-react";
import { useDashboardAgregado } from "./useDashboardAgregado";
import type {
  DashboardAgregadoResponse,
  DashboardDiretorSection,
  DashboardGestorSection,
  DashboardRhSection,
  PerfilAgregado,
} from "./dashboardAgregadoTypes";

const PERFIS: { id: PerfilAgregado; label: string; desc: string }[] = [
  { id: "gestor", label: "Gestor", desc: "Meu time e minhas vagas" },
  { id: "rh", label: "RH / Recrutador", desc: "Operação do funil" },
  { id: "diretor", label: "Diretor", desc: "Visão consolidada" },
];

/**
 * Dashboard real por perfil (Sessão 31).
 * Consome /api/dashboard/agregado?perfil=... e entrega 3 visões (gestor, rh, diretor).
 * Cada seção vem `null` quando o perfil não tem dados (ex.: gestor sem FuncionarioId vinculado,
 * tenant sem módulo de desempenho) — neste caso exibimos aviso dedicado em vez de 403.
 */
export default function DashboardVisaoPorPerfilScreen() {
  const [perfil, setPerfil] = useState<PerfilAgregado>("gestor");
  const { data, loading, error, refresh } = useDashboardAgregado(perfil);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão por perfil</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            KPIs operacionais agregados direto do banco, por perfil de atuação.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <TabsPerfil active={perfil} onChange={setPerfil} />

      {error ? (
        <ErrorCard message={error} onRetry={() => void refresh()} />
      ) : loading && !data ? (
        <SkeletonGrid />
      ) : !data ? (
        <EmptyState />
      ) : (
        <SeletorSecao data={data} perfil={perfil} />
      )}
    </section>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tabs + skeletons + empty
// ──────────────────────────────────────────────────────────────────────────────

function TabsPerfil({
  active,
  onChange,
}: {
  active: PerfilAgregado;
  onChange: (p: PerfilAgregado) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Perfil do dashboard"
      className="inline-flex rounded-lg border border-border/60 bg-muted/30 p-1 text-sm"
    >
      {PERFIS.map((p) => {
        const isActive = active === p.id;
        return (
          <button
            type="button"
            key={p.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(p.id)}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              isActive
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title={p.desc}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[92px] rounded-xl border border-border/50 bg-card shadow-sm animate-pulse"
        />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
      Sem dados retornados pelo backend.
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
      <AlertCircle className="size-4 text-destructive mt-0.5 shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-medium text-destructive">Erro ao carregar dashboard</div>
        <div className="text-sm text-destructive/80 mt-0.5">{message}</div>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </div>
  );
}

function SecaoIndisponivel({ perfil }: { perfil: PerfilAgregado }) {
  const labels: Record<PerfilAgregado, string> = {
    gestor: "Você não está vinculado a um funcionário — peça ao RH para criar o vínculo para ver o painel do gestor.",
    rh: "O módulo de RH não está habilitado para este tenant ou você não tem permissão de visualizar.",
    diretor: "O módulo de avaliação não está configurado ou você não tem permissão diretor/admin.",
  };
  return (
    <div className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong className="font-semibold">Perfil indisponível: </strong>
      {labels[perfil]}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Seletor de seção
// ──────────────────────────────────────────────────────────────────────────────

function SeletorSecao({
  data,
  perfil,
}: {
  data: DashboardAgregadoResponse;
  perfil: PerfilAgregado;
}) {
  if (perfil === "gestor") {
    return data.gestor ? (
      <SecaoGestor data={data.gestor} />
    ) : (
      <SecaoIndisponivel perfil="gestor" />
    );
  }
  if (perfil === "rh") {
    return data.rh ? <SecaoRh data={data.rh} /> : <SecaoIndisponivel perfil="rh" />;
  }
  return data.diretor ? (
    <SecaoDiretor data={data.diretor} />
  ) : (
    <SecaoIndisponivel perfil="diretor" />
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Componentes de UI compartilhados
// ──────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "neutral",
  href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  hint?: string;
  tone?: "neutral" | "warning" | "success" | "danger";
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "text-slate-600 bg-slate-100",
    warning: "text-amber-700 bg-amber-100",
    success: "text-emerald-700 bg-emerald-100",
    danger: "text-red-700 bg-red-100",
  };

  const content = (
    <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4 hover:shadow-md transition">
      <div className="flex items-start justify-between gap-2">
        <div className={`rounded-lg p-2 ${toneClasses[tone]}`}>
          <Icon className="size-4" aria-hidden />
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value.toLocaleString("pt-BR")}</div>
      <div className="text-sm font-medium text-foreground mt-0.5">{label}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );

  if (!href) return content;
  return (
    <a href={href} className="block focus:outline-none focus-visible:ring-2 ring-primary rounded-xl">
      {content}
    </a>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {action}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Onda 1 — Gestor
// ──────────────────────────────────────────────────────────────────────────────

function SecaoGestor({ data }: { data: DashboardGestorSection }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Meu time" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={Users}
          label="Diretos ativos"
          value={data.diretosAtivos}
          tone="success"
          href="/app/gestao"
        />
        <KpiCard
          icon={FileWarning}
          label="Com dados incompletos"
          value={data.diretosComDadosIncompletos}
          tone={data.diretosComDadosIncompletos > 0 ? "warning" : "neutral"}
          href="/app/gestao/funcionarios"
        />
        <KpiCard
          icon={ClipboardList}
          label="Solicitações equipe"
          value={data.solicitacoesEquipePendentes}
          tone={data.solicitacoesEquipePendentes > 0 ? "warning" : "neutral"}
          href="/app/gestao/painel-solicitacoes"
        />
        <KpiCard
          icon={UserCheck}
          label="Avaliações pendentes"
          value={data.avaliacoesDiretosPendentes}
          tone={data.avaliacoesDiretosPendentes > 0 ? "warning" : "neutral"}
          href="/app/gestao/avaliacoes"
        />
        <KpiCard
          icon={Clock}
          label="Aprovações minhas"
          value={data.aprovacoesPendentesMinhas}
          tone={data.aprovacoesPendentesMinhas > 0 ? "warning" : "neutral"}
          href="/app/gestao/painel-solicitacoes"
        />
      </div>

      <SectionHeader title="Carteira de vagas" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <KpiCard
          icon={Briefcase}
          label="Abertas"
          value={data.carteiraVagasAbertas}
          href="/app/vagas?status=Aberta"
        />
        <KpiCard
          icon={AlertCircle}
          label="Paradas (SLA)"
          value={data.carteiraVagasParadas}
          tone={data.carteiraVagasParadas > 0 ? "danger" : "neutral"}
          href="/app/vagas?sla=fora"
        />
        <KpiCard
          icon={Users}
          label="Candidaturas ativas"
          value={data.carteiraCandidaturasAtivas}
          href="/app/candidaturas"
        />
        <KpiCard
          icon={TrendingUp}
          label="Etapa avançada"
          value={data.candidaturasEtapaAvancada}
          hint="Entrevista + Teste + Proposta"
          tone="success"
        />
      </div>

      {data.vagasMaisAntigas.length > 0 ? (
        <>
          <SectionHeader title="Vagas que precisam de atenção" />
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Título</th>
                  <th className="px-3 py-2 text-right">Dias aberta</th>
                  <th className="px-3 py-2 text-right">Candidaturas</th>
                  <th className="px-3 py-2 text-right">SLA</th>
                </tr>
              </thead>
              <tbody>
                {data.vagasMaisAntigas.map((v) => (
                  <tr key={v.vagaId} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{v.codigo ?? "—"}</td>
                    <td className="px-3 py-2">
                      <a href={`/app/vagas/${v.vagaId}`} className="hover:underline">
                        {v.titulo}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.diasAberta}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.candidaturas}</td>
                    <td className="px-3 py-2 text-right">
                      {v.foraDoSla ? (
                        <span className="inline-flex items-center rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                          Fora
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                          Ok
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {data.candidaturasEmDestaque.length > 0 ? (
        <>
          <SectionHeader title="Candidaturas em destaque" />
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Candidato</th>
                  <th className="px-3 py-2 text-left">Vaga</th>
                  <th className="px-3 py-2 text-left">Etapa</th>
                  <th className="px-3 py-2 text-right">Dias na etapa</th>
                </tr>
              </thead>
              <tbody>
                {data.candidaturasEmDestaque.map((c) => (
                  <tr key={c.candidaturaId} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <a href={`/app/candidatos/${c.candidatoId}`} className="hover:underline">
                        {c.candidatoNome}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      <a href={`/app/vagas/${c.vagaId}`} className="hover:underline">
                        {c.vagaTitulo ?? "—"}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                        {c.etapaMacro}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.diasNaEtapa ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Onda 2 — RH
// ──────────────────────────────────────────────────────────────────────────────

function SecaoRh({ data }: { data: DashboardRhSection }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Vagas" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={Briefcase}
          label="Abertas"
          value={data.vagasAbertas}
          href="/app/vagas?status=Aberta"
        />
        <KpiCard
          icon={AlertCircle}
          label="Fora do SLA"
          value={data.vagasForaSla}
          tone={data.vagasForaSla > 0 ? "danger" : "neutral"}
          href="/app/vagas?sla=fora"
        />
        <KpiCard
          icon={FileWarning}
          label="Rascunho"
          value={data.vagasRascunho}
          tone="warning"
          href="/app/vagas?status=Rascunho"
        />
        <KpiCard
          icon={ClipboardList}
          label="Solicitações vaga"
          value={data.solicitacoesVagaPendentes}
          tone={data.solicitacoesVagaPendentes > 0 ? "warning" : "neutral"}
          href="/app/gestao/painel-solicitacoes"
        />
        <KpiCard
          icon={UserCheck}
          label="Aprovações faixa"
          value={data.aprovacoesFaixaPendentes}
          tone={data.aprovacoesFaixaPendentes > 0 ? "warning" : "neutral"}
        />
      </div>

      <SectionHeader title="Funil" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={Users}
          label="Aplicadas"
          value={data.pipelineAplicadas}
          href="/app/candidaturas?status=Aplicado"
        />
        <KpiCard
          icon={Users}
          label="Em triagem"
          value={data.pipelineEmTriagem}
          href="/app/candidaturas?status=Triagem"
        />
        <KpiCard
          icon={Users}
          label="Entrevista"
          value={data.pipelineEntrevista}
          href="/app/candidaturas?status=Entrevista"
        />
        <KpiCard
          icon={Users}
          label="Proposta"
          value={data.pipelineProposta}
          href="/app/candidaturas?status=Proposta"
        />
        <KpiCard
          icon={UserPlus}
          label="Contratado (mês)"
          value={data.pipelineContratadoMes}
          tone="success"
          href="/app/candidaturas?status=Contratado"
        />
      </div>

      <SectionHeader title="Pré-admissões e admissões" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          icon={ClipboardList}
          label="Em andamento"
          value={data.preAdmissoesEmAndamento}
          tone="warning"
          href="/app/rh/pre-admissoes?status=Enviado"
        />
        <KpiCard
          icon={Clock}
          label="Aguardando aprovação"
          value={data.preAdmissoesAguardandoAprovacao}
          tone={data.preAdmissoesAguardandoAprovacao > 0 ? "warning" : "neutral"}
          href="/app/rh/pre-admissoes?status=Preenchido"
        />
        <KpiCard
          icon={UserCheck}
          label="Aprovadas (mês)"
          value={data.preAdmissoesAprovadasMes}
          tone="success"
        />
        <KpiCard
          icon={UserPlus}
          label="Admissões (semana)"
          value={data.admissoesSemana}
        />
        <KpiCard
          icon={UserPlus}
          label="Admissões (mês)"
          value={data.admissoesMes}
          tone="success"
        />
        <KpiCard
          icon={TrendingUp}
          label="Matches 48h"
          value={data.matchingScoresUltimas48h}
        />
      </div>

      <SectionHeader title="Saúde das automações" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-2">
        <KpiCard
          icon={AlertCircle}
          label="Notificações falhadas (7d)"
          value={data.notificacoesFalhadas7d}
          tone={data.notificacoesFalhadas7d > 0 ? "danger" : "success"}
          href="/app/admin/notificacoes"
        />
        <KpiCard
          icon={TrendingUp}
          label="Matching 48h"
          value={data.matchingScoresUltimas48h}
          tone="neutral"
          href="/app/matching"
        />
      </div>

      {data.vagasForaSlaTop.length > 0 ? (
        <>
          <SectionHeader title="Vagas fora do SLA (top)" />
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Código</th>
                  <th className="px-3 py-2 text-left">Título</th>
                  <th className="px-3 py-2 text-left">Área</th>
                  <th className="px-3 py-2 text-right">Dias aberta</th>
                  <th className="px-3 py-2 text-right">Meta SLA</th>
                </tr>
              </thead>
              <tbody>
                {data.vagasForaSlaTop.map((v) => (
                  <tr key={v.vagaId} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2 text-muted-foreground">{v.codigo ?? "—"}</td>
                    <td className="px-3 py-2">
                      <a href={`/app/vagas/${v.vagaId}`} className="hover:underline">
                        {v.titulo}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{v.area ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-red-700 font-medium">
                      {v.diasAberta}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{v.metaSlaDias}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {data.preAdmissoesRecentes.length > 0 ? (
        <>
          <SectionHeader title="Pré-admissões recentes" />
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Nome</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">% preenchido</th>
                  <th className="px-3 py-2 text-right">Atualizado</th>
                </tr>
              </thead>
              <tbody>
                {data.preAdmissoesRecentes.map((p) => (
                  <tr key={p.preAdmissaoId} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <a href={`/app/rh/pre-admissoes/${p.preAdmissaoId}`} className="hover:underline">
                        {p.nome}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center rounded bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                        {p.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {p.completionPercent != null ? `${p.completionPercent}%` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                      {formatarData(p.updatedAtUtc)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Onda 3 — Diretor
// ──────────────────────────────────────────────────────────────────────────────

function SecaoDiretor({ data }: { data: DashboardDiretorSection }) {
  return (
    <div className="space-y-3">
      <SectionHeader title="Headcount" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <KpiCard
          icon={Users}
          label="Total ativo"
          value={data.headcountTotal}
          tone="success"
          href="/app/funcionarios"
        />
        <KpiCard
          icon={FileWarning}
          label="Dados incompletos"
          value={data.headcountComDadosIncompletos}
          tone={data.headcountComDadosIncompletos > 0 ? "warning" : "neutral"}
        />
        <KpiCard
          icon={UserPlus}
          label="Admissões (mês)"
          value={data.admissoesMes}
          tone="success"
        />
        <KpiCard
          icon={Users}
          label="Desligamentos (mês)"
          value={data.desligamentosConcluidosMes}
          tone={data.desligamentosConcluidosMes > 0 ? "warning" : "neutral"}
        />
      </div>

      <SectionHeader title="Movimentação e aprovações" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          icon={Clock}
          label="Desligamentos em integração"
          value={data.desligamentosAguardandoIntegracaoMes}
          tone="warning"
        />
        <KpiCard
          icon={Briefcase}
          label="Vagas aprovadas (mês)"
          value={data.vagasAprovadasMes}
          tone="success"
        />
        <KpiCard
          icon={ClipboardList}
          label="Solicitações vaga"
          value={data.solicitacoesVagaPendentes}
          tone={data.solicitacoesVagaPendentes > 0 ? "warning" : "neutral"}
          href="/app/gestao/painel-solicitacoes"
        />
        <KpiCard
          icon={UserCheck}
          label="Alçada aprovada (mês)"
          value={data.alcadaSalarialAprovadaMes}
        />
        <KpiCard
          icon={TrendingUp}
          label="Convites avaliação"
          value={data.convitesAvaliacaoPendentes}
          tone={data.convitesAvaliacaoPendentes > 0 ? "warning" : "neutral"}
        />
      </div>

      <SectionHeader title="Ciclos de avaliação" />
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <KpiCard
          icon={ClipboardList}
          label="Abertos"
          value={data.ciclosAvaliacaoAbertos}
          tone="success"
          href="/app/avaliacoes/ciclos"
        />
        <KpiCard
          icon={Clock}
          label="Em calibragem"
          value={data.ciclosAvaliacaoEmCalibragem}
          tone="warning"
        />
        <KpiCard
          icon={TrendingUp}
          label="Convites pendentes"
          value={data.convitesAvaliacaoPendentes}
          tone={data.convitesAvaliacaoPendentes > 0 ? "warning" : "neutral"}
        />
      </div>

      {data.headcountPorArea.length > 0 ? (
        <>
          <SectionHeader title="Headcount por centro de custo" />
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Centro de Custo</th>
                  <th className="px-3 py-2 text-right">Headcount</th>
                  <th className="px-3 py-2 text-right">Vagas abertas</th>
                </tr>
              </thead>
              <tbody>
                {data.headcountPorArea.map((a, idx) => (
                  <tr key={(a.centroCustoId ?? a.areaId) ?? `sem-area-${idx}`} className="border-t border-border/40 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-muted-foreground" />
                        {a.centroCustoNome ?? a.areaNome}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.headcount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.vagasAbertas > 0 ? (
                        <span className="text-sky-700 font-medium">{a.vagasAbertas}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {data.ciclosResumo.length > 0 ? (
        <>
          <SectionHeader title="Resumo de ciclos" />
          <div className="overflow-x-auto rounded-xl border border-border/50 bg-card shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Ciclo</th>
                  <th className="px-3 py-2 text-left">Período</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Convites</th>
                  <th className="px-3 py-2 text-right">Respondidos</th>
                </tr>
              </thead>
              <tbody>
                {data.ciclosResumo.map((c) => {
                  const perc =
                    c.convitesTotal > 0
                      ? Math.round((c.convitesRespondidos * 100) / c.convitesTotal)
                      : 0;
                  return (
                    <tr key={c.cicloId} className="border-t border-border/40 hover:bg-muted/20">
                      <td className="px-3 py-2">
                        <a href={`/app/avaliacoes/ciclos/${c.cicloId}`} className="hover:underline">
                          {c.nome}
                        </a>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{c.periodo}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center rounded bg-violet-100 px-1.5 py-0.5 text-xs font-medium text-violet-700">
                          {c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.convitesTotal}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {c.convitesRespondidos} <span className="text-xs text-muted-foreground">({perc}%)</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// utils
// ──────────────────────────────────────────────────────────────────────────────

function formatarData(isoUtc: string): string {
  if (!isoUtc) return "—";
  try {
    return new Date(isoUtc).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return "—";
  }
}
