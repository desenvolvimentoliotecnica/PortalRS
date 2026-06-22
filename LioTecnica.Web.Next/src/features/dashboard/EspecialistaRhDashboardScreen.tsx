"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  RefreshCw,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

type Tone = "blue" | "green" | "purple" | "amber" | "red" | "slate";

type Kpis = {
  solicitacoesAtivas: number;
  aguardandoDistribuicao: number;
  vagasAbertas: number;
  vagasForaSla: number;
  candidatosAvancados: number;
  preAdmissoesAguardandoAprovacao: number;
};

type Funil = {
  aplicadas: number;
  triagem: number;
  entrevista: number;
  teste: number;
  proposta: number;
  contratadoMes: number;
};

type Requisicao = {
  id: string;
  titulo: string;
  status: number | string;
  centroCustoNome?: string | null;
  unitName?: string | null;
  createdAtUtc?: string | null;
  rmIdReq?: number | null;
  analistaNome?: string | null;
};

type AnalistaDistribuicao = {
  analistaUserId: string;
  nome: string;
  requisicoesEmCarteira: number;
  vagasAbertas: number;
  candidaturasAtivas: number;
  entrevistasProximas: number;
};

type AgendaEvent = {
  id: string;
  title?: string | null;
  startAtUtc?: string | null;
  endAtUtc?: string | null;
  owner?: string | null;
  candidate?: string | null;
  vagaTitle?: string | null;
  vagaCode?: string | null;
  location?: string | null;
  candidateResponseStatus?: string | null;
};

type Alerta = {
  label: string;
  description: string;
  count: number;
  tone: Tone;
};

type KpiItem = {
  label: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  href?: string;
};

type DashboardData = {
  kpis: Kpis;
  funil: Funil;
  requisicoes: Requisicao[];
  distribuicao: AnalistaDistribuicao[];
  agenda: AgendaEvent[];
  alertas: Alerta[];
  partialError: boolean;
};

const EMPTY_KPIS: Kpis = {
  solicitacoesAtivas: 0,
  aguardandoDistribuicao: 0,
  vagasAbertas: 0,
  vagasForaSla: 0,
  candidatosAvancados: 0,
  preAdmissoesAguardandoAprovacao: 0,
};

const EMPTY_FUNIL: Funil = {
  aplicadas: 0,
  triagem: 0,
  entrevista: 0,
  teste: 0,
  proposta: 0,
  contratadoMes: 0,
};

const toneClasses: Record<Tone, { soft: string; text: string; border: string; bg: string }> = {
  blue: { soft: "bg-blue-50 text-blue-600", text: "text-blue-600", border: "border-blue-100", bg: "bg-blue-50" },
  green: {
    soft: "bg-emerald-50 text-emerald-600",
    text: "text-emerald-600",
    border: "border-emerald-100",
    bg: "bg-emerald-50",
  },
  purple: { soft: "bg-violet-50 text-violet-600", text: "text-violet-600", border: "border-violet-100", bg: "bg-violet-50" },
  amber: { soft: "bg-amber-50 text-amber-600", text: "text-amber-600", border: "border-amber-100", bg: "bg-amber-50" },
  red: { soft: "bg-rose-50 text-rose-600", text: "text-rose-600", border: "border-rose-100", bg: "bg-rose-50" },
  slate: { soft: "bg-slate-100 text-slate-600", text: "text-slate-600", border: "border-slate-100", bg: "bg-slate-50" },
};

async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
}

function firstName(displayName?: string | null) {
  return displayName?.trim().split(/\s+/)[0] || "Especialista";
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "Sem horário";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Sem horário";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function relativeDate(iso?: string | null) {
  if (!iso) return "sem data";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "sem data";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  return `${days}d`;
}

function statusInfo(status: number | string): { label: string; tone: Tone } {
  const value = Number(status);
  const labels: Record<number, { label: string; tone: Tone }> = {
    11: { label: "Pendente triagem", tone: "amber" },
    12: { label: "Em triagem", tone: "blue" },
    14: { label: "Integração RM", tone: "purple" },
    15: { label: "Erro RM", tone: "red" },
    16: { label: "Reprocessar RM", tone: "amber" },
    17: { label: "Em seleção", tone: "green" },
    18: { label: "Suspensa", tone: "slate" },
    21: { label: "Em andamento", tone: "blue" },
  };
  if (Number.isFinite(value) && labels[value]) return labels[value];
  return { label: String(status), tone: "slate" };
}

async function fetchDashboardData(): Promise<DashboardData> {
  const results = await Promise.allSettled([
    fetchJson<Kpis>("/api/dashboard/especialista-rh/kpis"),
    fetchJson<Funil>("/api/dashboard/especialista-rh/funil"),
    fetchJson<Requisicao[]>("/api/dashboard/especialista-rh/solicitacoes-rm?onlyPendingDistribution=true&pageSize=5"),
    fetchJson<AnalistaDistribuicao[]>("/api/dashboard/especialista-rh/distribuicao-analistas"),
    fetchJson<AgendaEvent[]>("/api/dashboard/especialista-rh/agenda-events?pageSize=5"),
    fetchJson<Alerta[]>("/api/dashboard/especialista-rh/alertas"),
  ]);

  return {
    kpis: results[0].status === "fulfilled" ? results[0].value ?? EMPTY_KPIS : EMPTY_KPIS,
    funil: results[1].status === "fulfilled" ? results[1].value ?? EMPTY_FUNIL : EMPTY_FUNIL,
    requisicoes: results[2].status === "fulfilled" && Array.isArray(results[2].value) ? results[2].value : [],
    distribuicao: results[3].status === "fulfilled" && Array.isArray(results[3].value) ? results[3].value : [],
    agenda: results[4].status === "fulfilled" && Array.isArray(results[4].value) ? results[4].value : [],
    alertas: results[5].status === "fulfilled" && Array.isArray(results[5].value) ? results[5].value : [],
    partialError: results.some((r) => r.status === "rejected"),
  };
}

export default function EspecialistaRhDashboardScreen({ displayName }: { displayName?: string | null }) {
  const [kpis, setKpis] = useState<Kpis>(EMPTY_KPIS);
  const [funil, setFunil] = useState<Funil>(EMPTY_FUNIL);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [distribuicao, setDistribuicao] = useState<AnalistaDistribuicao[]>([]);
  const [agenda, setAgenda] = useState<AgendaEvent[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [partialError, setPartialError] = useState(false);

  const applyData = useCallback((data: DashboardData) => {
    setKpis(data.kpis);
    setFunil(data.funil);
    setRequisicoes(data.requisicoes);
    setDistribuicao(data.distribuicao);
    setAgenda(data.agenda);
    setAlertas(data.alertas);
    setPartialError(data.partialError);
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    applyData(await fetchDashboardData());
  }, [applyData]);

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardData().then((data) => {
      if (!cancelled) applyData(data);
    });

    return () => {
      cancelled = true;
    };
  }, [applyData]);

  const pipeline = useMemo(
    () => [
      { label: "Aplicadas", value: funil.aplicadas, hint: "Entrada", tone: "blue" as Tone },
      { label: "Triagem", value: funil.triagem, hint: "Qualificação", tone: "purple" as Tone },
      { label: "Entrevista", value: funil.entrevista, hint: "Agenda ativa", tone: "amber" as Tone },
      { label: "Teste", value: funil.teste, hint: "Avaliação", tone: "slate" as Tone },
      { label: "Proposta", value: funil.proposta, hint: `${funil.contratadoMes} contratações no mês`, tone: "green" as Tone },
    ],
    [funil],
  );

  const kpiItems: KpiItem[] = [
    {
      label: "Solicitações ativas",
      value: kpis.solicitacoesAtivas,
      hint: "Em acompanhamento no fluxo",
      icon: FileText,
      tone: "blue",
      href: "/app/gestao/solicitacoes",
    },
    {
      label: "Sem Analista",
      value: kpis.aguardandoDistribuicao,
      hint: "Aguardando distribuição",
      icon: UsersRound,
      tone: kpis.aguardandoDistribuicao > 0 ? "amber" : "green",
      href: "/app/gestao/painel-solicitacoes",
    },
    {
      label: "Vagas abertas",
      value: kpis.vagasAbertas,
      hint: kpis.vagasForaSla > 0 ? `${kpis.vagasForaSla} fora do SLA` : "Todas em prazo",
      icon: BriefcaseBusiness,
      tone: kpis.vagasForaSla > 0 ? "red" : "blue",
      href: "/app/vagas",
    },
    {
      label: "Candidatos avançados",
      value: kpis.candidatosAvancados,
      hint: "Entrevista, teste ou proposta",
      icon: UserRoundCheck,
      tone: "purple",
      href: "/app/candidaturas",
    },
    {
      label: "Pré-admissões",
      value: kpis.preAdmissoesAguardandoAprovacao,
      hint: "Aguardando aprovação",
      icon: CheckCircle2,
      tone: "green",
    },
  ];

  return (
    <section className="mx-auto max-w-[1440px] space-y-4 text-slate-800">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">Bom dia, {firstName(displayName)}</h1>
          {loading ? (
            <p className="mt-1 text-sm font-medium text-slate-500">Carregando indicadores...</p>
          ) : null}
          {partialError ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Alguns indicadores não puderam ser carregados e foram exibidos com os últimos valores disponíveis.
            </p>
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpiItems.map((item) => (
          <KpiCard key={item.label} item={item} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.62fr)_minmax(360px,1fr)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Funil global de recrutamento" action="Ver candidaturas" actionHref="/app/candidaturas" />
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              {pipeline.map((item, index) => (
                <div key={item.label} className="relative">
                  <div className={`rounded-lg border ${toneClasses[item.tone].border} ${toneClasses[item.tone].bg} p-3 text-center shadow-sm`}>
                    <div className={`text-sm font-bold ${toneClasses[item.tone].text}`}>{item.label}</div>
                    <div className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{item.value.toLocaleString("pt-BR")}</div>
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

        <Panel>
          <PanelHeader title="Agenda próxima" action="Ver agenda completa" actionHref="/app/agendas" />
          <AgendaList items={agenda} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,1fr)_minmax(360px,1fr)_minmax(360px,1fr)]">
        <Panel>
          <PanelHeader title="Distribuição por Analista" />
          <AnalistasList items={distribuicao} />
        </Panel>

        <Panel>
          <PanelHeader title="Requisições para distribuir" action="Ver painel" actionHref="/app/gestao/painel-solicitacoes" />
          <RequisicoesList items={requisicoes} />
        </Panel>

        <Panel>
          <PanelHeader title="Alertas de supervisão" />
          <AlertasList items={alertas} />
        </Panel>
      </div>
    </section>
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
      <div className="mt-5 text-2xl font-bold tracking-tight text-slate-900 tabular-nums">{item.value.toLocaleString("pt-BR")}</div>
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

function PanelHeader({ title, action, actionHref }: { title: string; action?: string; actionHref?: string }) {
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

function AgendaList({ items }: { items: AgendaEvent[] }) {
  if (items.length === 0) {
    return <EmptyBlock icon={CalendarDays} title="Nenhum evento próximo" desc="Entrevistas e eventos globais aparecerão aqui." />;
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <Link
          key={item.id}
          href="/app/agendas"
          className="block rounded-2xl border border-slate-100 bg-slate-50/80 p-4 transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-bold text-violet-700">Agenda</span>
              <h3 className="mt-2 truncate text-sm font-bold text-slate-900">{item.candidate || item.title || "Evento sem título"}</h3>
              <p className="mt-1 truncate text-xs text-slate-500">
                {item.vagaTitle || "Vaga não informada"}
                {item.vagaCode ? ` · ${item.vagaCode}` : ""}
              </p>
              <p className="mt-1 truncate text-xs text-slate-500">
                Responsável: {item.owner || "não informado"}
                {item.location ? ` · ${item.location}` : ""}
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-right shadow-sm">
              <div className="text-sm font-bold text-blue-700">{formatDateTime(item.startAtUtc)}</div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AnalistasList({ items }: { items: AnalistaDistribuicao[] }) {
  if (items.length === 0) {
    return <EmptyBlock icon={UsersRound} title="Nenhuma Analista encontrada" desc="Usuários ativos com perfil Analista de RH aparecerão aqui." />;
  }

  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.analistaUserId} className="rounded-2xl border border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-bold text-slate-900">{item.nome}</div>
              <div className="mt-1 text-xs text-slate-500">
                {item.requisicoesEmCarteira} req. · {item.vagasAbertas} vagas · {item.entrevistasProximas} entrevistas
              </div>
            </div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">{item.candidaturasAtivas}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function RequisicoesList({ items }: { items: Requisicao[] }) {
  if (items.length === 0) {
    return <EmptyBlock icon={FileText} title="Nenhuma requisição pendente" desc="Requisições RM sem Analista aparecerão aqui." />;
  }

  return (
    <div className="mt-3 divide-y divide-slate-100">
      {items.map((item) => {
        const status = statusInfo(item.status);
        return (
          <Link key={item.id} href="/app/gestao/painel-solicitacoes" className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <BriefcaseBusiness className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-xs font-bold text-slate-500">RM {item.rmIdReq ?? "-"}</span>
                <span className="truncate text-sm font-bold text-slate-900">{item.titulo}</span>
              </div>
              <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                {item.centroCustoNome || "Centro de custo não informado"} · {item.unitName || "Unidade não informada"}
              </div>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${toneClasses[status.tone].soft}`}>{status.label}</span>
            <span className="w-12 text-right text-xs font-medium text-slate-500">{relativeDate(item.createdAtUtc)}</span>
          </Link>
        );
      })}
    </div>
  );
}

function AlertasList({ items }: { items: Alerta[] }) {
  if (items.length === 0) {
    return <EmptyBlock icon={CheckCircle2} title="Sem alertas" desc="Quando houver pendências relevantes, elas aparecerão aqui." />;
  }

  return (
    <div className="mt-3 space-y-3">
      {items.map((item) => (
        <Link key={item.label} href="/app/gestao/painel-solicitacoes" className="flex items-center gap-3 rounded-xl px-1 py-1 transition hover:bg-slate-50">
          <div className={`rounded-full p-2.5 ${toneClasses[item.tone].soft}`}>
            {item.tone === "red" ? <AlertCircle className="size-4" /> : <BarChart3 className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900">{item.label}</div>
            <div className="truncate text-xs font-medium text-slate-500">{item.description}</div>
          </div>
          <span className={`min-w-10 rounded-full px-3 py-1 text-center text-sm font-bold ${toneClasses[item.tone].soft}`}>
            {item.count.toLocaleString("pt-BR")}
          </span>
        </Link>
      ))}
    </div>
  );
}

function EmptyBlock({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 text-center">
      <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
        <Icon className="size-5" />
      </div>
      <div className="mt-3 text-sm font-bold text-slate-900">{title}</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{desc}</p>
    </div>
  );
}
