"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Requisição", hint: "Escolha a origem" },
  { id: 2, label: "Dados da vaga", hint: "Título e condições" },
  { id: 3, label: "DNALIO", hint: "Match por IA" },
  { id: 4, label: "Conteúdo", hint: "Texto para candidatos" },
  { id: 5, label: "Publicação", hint: "Configurações do portal" },
  { id: 6, label: "Confirmação", hint: "Revisar e publicar" },
] as const;

const TOTAL_STEPS = STEPS.length;

type AnalistaRequisicaoApi = {
  id: string;
  titulo: string;
  status: number | string;
  centroCustoNome?: string | null;
  unitName?: string | null;
  createdAtUtc?: string;
  rmIdReq?: number | string | null;
};

type SolicitacaoDetailApi = {
  id: string;
  titulo: string;
  justificativa?: string | null;
  solicitanteNome?: string | null;
  centroCustoName?: string | null;
  centroCustoNome?: string | null;
  unidadeLotacaoNome?: string | null;
  qtdPosicoes?: number;
  faixaSalarialMin?: number | string | null;
  faixaSalarialMax?: number | string | null;
};

export type RequisicaoWizardItem = {
  id: string;
  code: string;
  titulo: string;
  area: string;
  unidade: string;
  status: string;
  statusLabel: string;
  gestor: string;
  publishable: boolean;
};

function normalizeStatusKey(status: unknown): string {
  return String(status ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function resolveRequisicaoStatus(status: unknown): { label: string; publishable: boolean } {
  const key = normalizeStatusKey(status);
  if (key === "2" || key === "aprovada") {
    return { label: "Aprovada", publishable: true };
  }
  if (key === "5" || key === "pendenteaprovacaorh") {
    return { label: "Pendente aprovação RH", publishable: false };
  }
  if (key === "1" || key === "pendenteaprovacao") {
    return { label: "Pendente aprovação", publishable: false };
  }
  if (key === "0" || key === "rascunho") {
    return { label: "Rascunho", publishable: false };
  }
  if (key === "4" || key === "ajustesnecessarios") {
    return { label: "Ajustes necessários", publishable: false };
  }
  if (key === "3" || key === "reprovada") {
    return { label: "Reprovada", publishable: false };
  }
  return { label: "Em análise", publishable: false };
}

function mapApiRequisicao(row: AnalistaRequisicaoApi): RequisicaoWizardItem {
  const statusMeta = resolveRequisicaoStatus(row.status);
  const rmId = row.rmIdReq != null && String(row.rmIdReq).trim() !== "" ? String(row.rmIdReq) : "";
  return {
    id: row.id,
    code: rmId ? `REQ-${rmId}` : "REQ",
    titulo: row.titulo?.trim() || "Requisição de vaga",
    area: row.centroCustoNome?.trim() || "Área não informada",
    unidade: row.unitName?.trim() || "Unidade não informada",
    status: String(row.status ?? ""),
    statusLabel: statusMeta.label,
    gestor: "",
    publishable: statusMeta.publishable,
  };
}

function formatFaixaSalarial(min?: number | string | null, max?: number | string | null): string {
  const minText = min != null && String(min).trim() !== "" ? String(min).trim() : "";
  const maxText = max != null && String(max).trim() !== "" ? String(max).trim() : "";
  if (minText && maxText) return `R$ ${minText} — R$ ${maxText}`;
  if (minText) return `A partir de R$ ${minText}`;
  if (maxText) return `Até R$ ${maxText}`;
  return "A combinar";
}

async function fetchAnalistaRequisicoes(): Promise<AnalistaRequisicaoApi[]> {
  const res = await apiFetch("/api/dashboard/analista-rh/solicitacoes-vaga?pageSize=100", {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Falha ao carregar requisições (HTTP ${res.status})`);
  }
  const data = (await res.json()) as AnalistaRequisicaoApi[];
  return Array.isArray(data) ? data : [];
}

async function fetchSolicitacaoDetail(id: string): Promise<SolicitacaoDetailApi> {
  const res = await apiFetch(`/api/solicitacoes-vaga/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Falha ao carregar requisição (HTTP ${res.status})`);
  }
  return (await res.json()) as SolicitacaoDetailApi;
}

type DescricaoCargoLookupItem = {
  id: string;
  code: string;
  title: string;
  displayLabel: string;
  isTemplate: boolean;
};

type DescricaoCargoItemCategoria =
  | "AtividadeEspecifica"
  | "AtividadeComum"
  | "VivenciaEspecifica"
  | "CompetenciaDnalio"
  | "CompetenciaLideranca"
  | "CompetenciaFuncional"
  | "CompetenciaTecnica"
  | "RequisitoObrigatorio"
  | number;

type DescricaoCargoItemResponse = {
  id: string;
  categoria: DescricaoCargoItemCategoria;
  texto: string;
  isObrigatoria: boolean;
  nivelMinimo: string | null;
  subcategoria: string | null;
  ordem: number;
};

type DescricaoCargoDetail = {
  id: string;
  code: string;
  title: string;
  areaTemplate?: string | null;
  itens: DescricaoCargoItemResponse[];
};

type DnalioSections = {
  atividades: string[];
  competencias: string[];
  vivencias: string[];
  requisitos: string[];
};

const CATEGORIA_NUM_TO_NAME: Record<number, DescricaoCargoItemCategoria> = {
  1: "AtividadeEspecifica",
  2: "AtividadeComum",
  3: "VivenciaEspecifica",
  10: "CompetenciaDnalio",
  11: "CompetenciaLideranca",
  12: "CompetenciaFuncional",
  13: "CompetenciaTecnica",
  20: "RequisitoObrigatorio",
};

async function fetchDescricoesCargoLookup(search: string): Promise<DescricaoCargoLookupItem[]> {
  const params = new URLSearchParams();
  params.set("isTemplate", "true");
  const trimmed = search.trim();
  if (trimmed) params.set("search", trimmed);

  const res = await apiFetch(`/api/descricoes-cargo/lookup?${params.toString()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Falha ao buscar DNALIO (HTTP ${res.status})`);
  }
  const data = (await res.json()) as DescricaoCargoLookupItem[];
  return Array.isArray(data) ? data : [];
}

async function fetchDescricaoCargoDetail(id: string): Promise<DescricaoCargoDetail> {
  const res = await apiFetch(`/api/descricoes-cargo/${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Falha ao carregar descrição (HTTP ${res.status})`);
  }
  return (await res.json()) as DescricaoCargoDetail;
}

function normalizeCategoria(categoria: DescricaoCargoItemCategoria): string {
  if (typeof categoria === "number") return String(CATEGORIA_NUM_TO_NAME[categoria] ?? categoria);
  return categoria;
}

function groupDnalioSections(itens: DescricaoCargoItemResponse[]): DnalioSections {
  const sections: DnalioSections = {
    atividades: [],
    competencias: [],
    vivencias: [],
    requisitos: [],
  };

  for (const item of itens) {
    const cat = normalizeCategoria(item.categoria);
    if (cat === "AtividadeEspecifica" || cat === "AtividadeComum") sections.atividades.push(item.texto);
    else if (cat === "VivenciaEspecifica") sections.vivencias.push(item.texto);
    else if (
      cat === "CompetenciaDnalio" ||
      cat === "CompetenciaLideranca" ||
      cat === "CompetenciaFuncional" ||
      cat === "CompetenciaTecnica"
    ) {
      sections.competencias.push(item.texto);
    } else if (cat === "RequisitoObrigatorio") sections.requisitos.push(item.texto);
  }

  return sections;
}

function findSuggestedLookupId(items: DescricaoCargoLookupItem[], titulo: string): string | null {
  const normalized = titulo.trim().toLowerCase();
  if (!normalized) return null;

  const exact = items.find((item) => item.title.trim().toLowerCase() === normalized);
  if (exact) return exact.id;

  const partial = items.find((item) => {
    const title = item.title.trim().toLowerCase();
    return title.includes(normalized) || normalized.includes(title);
  });
  return partial?.id ?? null;
}

type FormState = {
  requisicaoId: string;
  titulo: string;
  resumo: string;
  descricao: string;
  requisitos: string;
  modalidade: string;
  tipoContrato: string;
  faixaSalarial: string;
  local: string;
  descricaoCargoId: string;
  descricaoCargoCode: string;
  descricaoCargoTitle: string;
  matchMinimoPercentual: number;
  publicarAgora: boolean;
  exibirSalario: boolean;
  destaquePortal: boolean;
  dataEncerramento: string;
};

const INITIAL_FORM: FormState = {
  requisicaoId: "",
  titulo: "",
  resumo: "",
  descricao: "",
  requisitos: "",
  modalidade: "hibrido",
  tipoContrato: "clt",
  faixaSalarial: "",
  local: "",
  descricaoCargoId: "",
  descricaoCargoCode: "",
  descricaoCargoTitle: "",
  matchMinimoPercentual: 70,
  publicarAgora: true,
  exibirSalario: false,
  destaquePortal: false,
  dataEncerramento: "",
};

/**
 * Wizard mockado para publicar vaga no portal a partir de uma requisição.
 * Rota oculta de validação de UX.
 */
export default function PublicarVagaWizardPreviewScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [requisicoes, setRequisicoes] = useState<RequisicaoWizardItem[]>([]);
  const [requisicoesLoading, setRequisicoesLoading] = useState(true);
  const [requisicoesError, setRequisicoesError] = useState<string | null>(null);
  const [requisicoesReloadKey, setRequisicoesReloadKey] = useState(0);
  const [selectingRequisicao, setSelectingRequisicao] = useState(false);

  const loadRequisicoes = useCallback(async () => {
    setRequisicoesLoading(true);
    setRequisicoesError(null);
    try {
      const rows = await fetchAnalistaRequisicoes();
      setRequisicoes(rows.map(mapApiRequisicao));
    } catch (err) {
      setRequisicoes([]);
      setRequisicoesError(err instanceof Error ? err.message : "Falha ao carregar requisições.");
    } finally {
      setRequisicoesLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequisicoes();
  }, [loadRequisicoes, requisicoesReloadKey]);

  const requisicao = useMemo(
    () => requisicoes.find((item) => item.id === form.requisicaoId) ?? null,
    [form.requisicaoId, requisicoes],
  );

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function selectRequisicao(id: string) {
    const item = requisicoes.find((row) => row.id === id);
    if (!item?.publishable) return;

    const area = item.area !== "Área não informada" ? item.area : "";
    setSelectingRequisicao(true);
    patchForm({
      requisicaoId: id,
      titulo: item.titulo,
      local: item.unidade !== "Unidade não informada" ? item.unidade : "",
      resumo: area
        ? `Oportunidade para ${item.titulo} na área de ${area}.`
        : `Oportunidade para ${item.titulo}.`,
      descricao: area
        ? `Buscamos profissional para atuar como ${item.titulo}, contribuindo com o time de ${area} em projetos estratégicos da empresa.`
        : `Buscamos profissional para atuar como ${item.titulo} em projetos estratégicos da empresa.`,
      requisitos: "Experiência na função; comunicação clara; disponibilidade para início em até 30 dias.",
      faixaSalarial: "A combinar",
      descricaoCargoId: "",
      descricaoCargoCode: "",
      descricaoCargoTitle: "",
    });

    try {
      const detail = await fetchSolicitacaoDetail(id);
      const detailArea =
        detail.centroCustoNome?.trim() ||
        detail.centroCustoName?.trim() ||
        area;
      const detailLocal = detail.unidadeLotacaoNome?.trim() || item.unidade;
      const justificativa = detail.justificativa?.trim();

      patchForm({
        titulo: detail.titulo?.trim() || item.titulo,
        local: detailLocal !== "Unidade não informada" ? detailLocal : "",
        resumo: justificativa
          ? justificativa.slice(0, 160)
          : detailArea
            ? `Oportunidade para ${detail.titulo} na área de ${detailArea}.`
            : `Oportunidade para ${detail.titulo}.`,
        descricao: justificativa || undefined,
        faixaSalarial: formatFaixaSalarial(detail.faixaSalarialMin, detail.faixaSalarialMax),
      });
    } catch {
      // Mantém pré-preenchimento da listagem; detalhe é enriquecimento opcional.
    } finally {
      setSelectingRequisicao(false);
    }
  }

  function selectDnalio(item: DescricaoCargoLookupItem) {
    patchForm({
      descricaoCargoId: item.id,
      descricaoCargoCode: item.code,
      descricaoCargoTitle: item.title,
    });
  }

  function clearDnalio() {
    patchForm({
      descricaoCargoId: "",
      descricaoCargoCode: "",
      descricaoCargoTitle: "",
    });
  }

  function canAdvance() {
    if (step === 1) return !!form.requisicaoId;
    if (step === 2) {
      return form.titulo.trim().length > 2 && form.resumo.trim().length > 10 && form.local.trim().length > 0;
    }
    if (step === 3) return !!form.descricaoCargoId;
    if (step === 4) {
      return form.descricao.trim().length > 20 && form.requisitos.trim().length > 10;
    }
    if (step === 5) return form.publicarAgora || form.dataEncerramento.trim().length > 0;
    return true;
  }

  async function handlePublish() {
    setPublishing(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setPublishing(false);
    setPublished(true);
  }

  return (
    <section className="mx-auto flex h-full w-[90%] min-h-0 max-w-none flex-col gap-2 overflow-hidden text-slate-800">
      <header className="shrink-0">
        <Link
          href="/app/dashboard/preview/home-analista-rh"
          className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft className="size-3.5" />
          Voltar à home preview
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Publicar vaga no portal</h1>
        <p className="text-xs font-medium text-slate-500 sm:text-sm">
          Selecione a requisição, vincule o DNALIO e publique em poucos passos.
        </p>
      </header>

      <WizardStepper currentStep={step} published={published} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
        {published ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <SuccessPanel titulo={form.titulo} requisicao={requisicao?.code ?? "—"} />
          </div>
        ) : (
          <>
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col px-4 py-3 sm:px-6 sm:py-4",
                (step === 1 || step === 3) && "overflow-y-auto overscroll-contain",
                step >= 2 && step !== 3 && "overflow-hidden",
              )}
            >
              {step === 1 ? (
                <StepRequisicao
                  items={requisicoes}
                  loading={requisicoesLoading || selectingRequisicao}
                  error={requisicoesError}
                  selectedId={form.requisicaoId}
                  onSelect={(id) => void selectRequisicao(id)}
                  onRetry={() => setRequisicoesReloadKey((key) => key + 1)}
                />
              ) : null}
              {step === 2 ? <StepDadosVaga form={form} onChange={patchForm} requisicao={requisicao} /> : null}
              {step === 3 ? (
                <StepDnalio
                  form={form}
                  requisicao={requisicao}
                  onSelect={selectDnalio}
                  onClear={clearDnalio}
                  onChange={patchForm}
                />
              ) : null}
              {step === 4 ? <StepConteudoCandidatos form={form} onChange={patchForm} requisicao={requisicao} /> : null}
              {step === 5 ? <StepPublicacao form={form} onChange={patchForm} /> : null}
              {step === 6 ? <StepConfirmacao form={form} requisicao={requisicao} /> : null}
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={step === 1 || publishing}
                onClick={() => setStep((current) => Math.max(1, current - 1))}
              >
                Voltar
              </Button>

              {step < TOTAL_STEPS ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={!canAdvance()}
                  onClick={() => setStep((current) => Math.min(TOTAL_STEPS, current + 1))}
                >
                  Continuar
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button type="button" size="sm" disabled={publishing} onClick={() => void handlePublish()}>
                  {publishing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Globe className="size-4" />
                      Publicar no portal
                    </>
                  )}
                </Button>
              )}
            </footer>
          </>
        )}
      </div>
    </section>
  );
}

function WizardStepper({ currentStep, published }: { currentStep: number; published: boolean }) {
  return (
    <ol className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {STEPS.map((item) => {
        const done = published || item.id < currentStep;
        const active = !published && item.id === currentStep;
        return (
          <li
            key={item.id}
            className={cn(
              "rounded-lg border px-2.5 py-2 transition sm:px-3",
              done && "border-emerald-200 bg-emerald-50",
              active && "border-blue-200 bg-blue-50 shadow-sm",
              !done && !active && "border-slate-200 bg-white",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                  done && "bg-emerald-600 text-white",
                  active && "bg-blue-600 text-white",
                  !done && !active && "bg-slate-100 text-slate-500",
                )}
              >
                {done ? <Check className="size-3" /> : item.id}
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-bold text-slate-900 sm:text-sm">{item.label}</div>
                <div className="hidden truncate text-[10px] text-slate-500 sm:block">{item.hint}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepRequisicao({
  items,
  loading,
  error,
  selectedId,
  onSelect,
  onRetry,
}: {
  items: RequisicaoWizardItem[];
  loading: boolean;
  error: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Selecione a requisição</h2>
        <p className="text-xs text-slate-500">
          Requisições distribuídas para você. Apenas as aprovadas podem ser publicadas.
        </p>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Não foi possível carregar suas requisições</p>
            <p className="mt-0.5">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 border-red-200 bg-white text-red-800 hover:bg-red-50"
              onClick={onRetry}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando requisições atribuídas a você...
        </div>
      ) : null}

      {!error && (!loading || items.length > 0) ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {items.map((item) => {
            const selected = selectedId === item.id;
            const bloqueada = !item.publishable;
            return (
              <button
                key={item.id}
                type="button"
                disabled={bloqueada || loading}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition",
                  selected && "border-blue-300 bg-blue-50/70 ring-1 ring-blue-200",
                  !selected && !bloqueada && "border-slate-200 hover:border-blue-200 hover:bg-slate-50",
                  bloqueada && "cursor-not-allowed border-slate-100 bg-slate-50 opacity-60",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="rounded-md bg-blue-100 p-1.5 text-blue-600">
                      <BriefcaseBusiness className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-[10px] font-bold text-slate-500">{item.code}</span>
                        <span className="truncate text-sm font-bold text-slate-900">{item.titulo}</span>
                      </div>
                      <div className="truncate text-xs text-slate-600">
                        {item.area} · {item.unidade}
                        {item.gestor ? ` · ${item.gestor}` : ""}
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      item.publishable ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                    )}
                  >
                    {item.statusLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs text-slate-500">
          Nenhuma requisição atribuída a você no momento.
        </p>
      ) : null}
    </div>
  );
}

function StepDadosVaga({
  form,
  onChange,
  requisicao,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  requisicao: RequisicaoWizardItem | null;
}) {
  const filledCount = [
    form.titulo.trim().length > 2,
    form.resumo.trim().length > 10,
    form.local.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Dados da vaga</h2>
          <p className="text-xs text-slate-500">Título, resumo e condições exibidos no portal.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {requisicao ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {requisicao.code} · {requisicao.area}
            </span>
          ) : null}
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
            {filledCount}/3 campos essenciais
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-3">
        <FormSection title="Identificação no portal" icon={BriefcaseBusiness}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Título da vaga" hint="Nome exibido no card e na página da vaga" className="sm:col-span-2" required>
              <Input className="h-9" value={form.titulo} onChange={(e) => onChange({ titulo: e.target.value })} />
            </Field>
            <Field label="Resumo" hint="Uma linha para chamar atenção no card" className="sm:col-span-2" required>
              <Input className="h-9" value={form.resumo} onChange={(e) => onChange({ resumo: e.target.value })} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Condições de trabalho" icon={MapPin}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Local" required>
              <Input className="h-9" value={form.local} onChange={(e) => onChange({ local: e.target.value })} />
            </Field>
            <Field label="Modalidade" required>
              <SelectField
                value={form.modalidade}
                onChange={(value) => onChange({ modalidade: value })}
                options={[
                  { value: "presencial", label: "Presencial" },
                  { value: "hibrido", label: "Híbrido" },
                  { value: "remoto", label: "Remoto" },
                ]}
              />
            </Field>
            <Field label="Contrato" required>
              <SelectField
                value={form.tipoContrato}
                onChange={(value) => onChange({ tipoContrato: value })}
                options={[
                  { value: "clt", label: "CLT" },
                  { value: "pj", label: "PJ" },
                  { value: "estagio", label: "Estágio" },
                  { value: "temporario", label: "Temporário" },
                ]}
              />
            </Field>
            <Field label="Faixa salarial" icon={Wallet} hint="Pode ficar oculta na etapa de publicação">
              <Input
                className="h-9"
                value={form.faixaSalarial}
                onChange={(e) => onChange({ faixaSalarial: e.target.value })}
                placeholder="A combinar"
              />
            </Field>
          </div>
        </FormSection>
      </div>
    </div>
  );
}

function StepDnalio({
  form,
  requisicao,
  onSelect,
  onClear,
  onChange,
}: {
  form: FormState;
  requisicao: RequisicaoWizardItem | null;
  onSelect: (item: DescricaoCargoLookupItem) => void;
  onClear: () => void;
  onChange: (patch: Partial<FormState>) => void;
}) {
  const [search, setSearch] = useState("");
  const [lookupItems, setLookupItems] = useState<DescricaoCargoLookupItem[]>([]);
  const [lookupLoading, setLookupLoading] = useState(true);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupReloadKey, setLookupReloadKey] = useState(0);

  const [detail, setDetail] = useState<DescricaoCargoDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadLookup = useCallback(async (term: string) => {
    setLookupLoading(true);
    setLookupError(null);
    try {
      const items = await fetchDescricoesCargoLookup(term);
      setLookupItems(items);
    } catch (err) {
      setLookupItems([]);
      setLookupError(err instanceof Error ? err.message : "Falha ao buscar descrições de cargo.");
    } finally {
      setLookupLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadLookup(search);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [search, loadLookup, lookupReloadKey]);

  useEffect(() => {
    if (!form.descricaoCargoId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }

    let alive = true;
    setDetailLoading(true);
    setDetailError(null);

    void fetchDescricaoCargoDetail(form.descricaoCargoId)
      .then((data) => {
        if (!alive) return;
        setDetail(data);
      })
      .catch((err) => {
        if (!alive) return;
        setDetail(null);
        setDetailError(err instanceof Error ? err.message : "Falha ao carregar detalhes do DNALIO.");
      })
      .finally(() => {
        if (alive) setDetailLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [form.descricaoCargoId]);

  const suggestedId = useMemo(
    () => findSuggestedLookupId(lookupItems, requisicao?.titulo ?? form.titulo),
    [lookupItems, requisicao?.titulo, form.titulo],
  );

  const selectedLookup = useMemo(
    () => lookupItems.find((item) => item.id === form.descricaoCargoId) ?? null,
    [lookupItems, form.descricaoCargoId],
  );

  const sections = useMemo(
    () => (detail?.itens?.length ? groupDnalioSections(detail.itens) : null),
    [detail],
  );

  const selectedLabel = selectedLookup
    ? `${selectedLookup.code} — ${selectedLookup.title}`
    : form.descricaoCargoCode
      ? `${form.descricaoCargoCode} — ${form.descricaoCargoTitle}`
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Descrição de Cargo (DNALIO)</h2>
          <p className="text-xs text-slate-500">
            Obrigatório para publicar e alimentar o matching por IA — mesma regra do cadastro de vagas.
          </p>
        </div>
        {requisicao ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {requisicao.code} · {requisicao.titulo}
          </span>
        ) : null}
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-xs text-blue-900">
        <p className="font-semibold">Como o match usa o DNALIO</p>
        <p className="mt-0.5 leading-relaxed text-blue-800/90">
          O sistema lê as seções estruturadas — Atividades, Competências, Vivências e Requisitos — para calcular o
          score do candidato por categoria, como na aba <strong>Matching IA</strong> do formulário de vagas.
        </p>
      </div>

      {suggestedId && !form.descricaoCargoId ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
          <span>
            Sugestão com base no título da vaga/requisição:{" "}
            <strong>
              {lookupItems.find((item) => item.id === suggestedId)?.displayLabel ?? "template compatível"}
            </strong>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 border-violet-300 bg-white text-violet-800 hover:bg-violet-100"
            onClick={() => {
              const item = lookupItems.find((row) => row.id === suggestedId);
              if (item) onSelect(item);
            }}
          >
            Usar sugestão
          </Button>
        </div>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <Input
          className="h-9 pl-9"
          placeholder="Buscar por código ou título da descrição"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={lookupLoading && lookupItems.length === 0 && !lookupError}
        />
      </div>

      {lookupError ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Não foi possível carregar os templates DNALIO</p>
            <p className="mt-0.5">{lookupError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7 border-red-200 bg-white text-red-800 hover:bg-red-50"
              onClick={() => setLookupReloadKey((key) => key + 1)}
            >
              Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}

      {lookupLoading && lookupItems.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
          <Loader2 className="size-4 animate-spin" />
          Carregando templates DNALIO...
        </div>
      ) : null}

      {!lookupError && (!lookupLoading || lookupItems.length > 0) ? (
        <div className="grid gap-2 lg:grid-cols-2">
          {lookupItems.map((item) => {
            const active = form.descricaoCargoId === item.id;
            const sugerido = suggestedId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "rounded-lg border p-3 text-left transition",
                  active && "border-blue-300 bg-blue-50/70 ring-1 ring-blue-200",
                  !active && "border-slate-200 hover:border-blue-200 hover:bg-slate-50",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold text-slate-500">{item.code}</div>
                    <div className="truncate text-sm font-bold text-slate-900">{item.title}</div>
                    <div className="truncate text-xs text-slate-600">{item.displayLabel}</div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {sugerido ? (
                      <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                        Sugerido
                      </span>
                    ) : null}
                    {active ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Vinculado
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {!lookupLoading && !lookupError && lookupItems.length === 0 ? (
        <p className="text-center text-xs text-slate-500">Nenhuma descrição encontrada para essa busca.</p>
      ) : null}

      {form.descricaoCargoId ? (
        <FormSection title="Prévia do template selecionado" icon={Sparkles}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-emerald-700">
              Vinculado: {selectedLabel ?? "Descrição selecionada"}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={onClear}>
              Limpar vínculo
            </Button>
          </div>

          {detailLoading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-slate-500">
              <Loader2 className="size-3.5 animate-spin" />
              Carregando seções do template...
            </div>
          ) : null}

          {detailError ? (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              <span>{detailError}</span>
            </div>
          ) : null}

          {sections ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["Atividades", sections.atividades],
                  ["Competências", sections.competencias],
                  ["Vivências", sections.vivencias],
                  ["Requisitos", sections.requisitos],
                ] as const
              ).map(([label, items]) => (
                <div key={label} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
                  {items.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                      {items.slice(0, 6).map((line) => (
                        <li key={line}>· {line}</li>
                      ))}
                      {items.length > 6 ? (
                        <li className="text-slate-400">+ {items.length - 6} itens</li>
                      ) : null}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Sem itens nesta categoria.</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {!detailLoading && !detailError && sections && detail?.areaTemplate ? (
            <p className="mt-2 text-[11px] text-slate-500">Área do template: {detail.areaTemplate}</p>
          ) : null}
        </FormSection>
      ) : (
        <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Selecione uma descrição de cargo para continuar — sem DNALIO a vaga não pode ser publicada no fluxo real.
        </p>
      )}

      <Field
        label="Match mínimo (IA)"
        hint="Percentual mínimo para considerar candidato compatível — padrão 70%"
        className="max-w-xs"
      >
        <div className="flex items-center gap-2">
          <Input
            className="h-9"
            type="number"
            min={0}
            max={100}
            value={form.matchMinimoPercentual}
            onChange={(e) =>
              onChange({
                matchMinimoPercentual: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
              })
            }
          />
          <span className="text-sm font-medium text-slate-500">%</span>
        </div>
      </Field>
    </div>
  );
}

function StepConteudoCandidatos({
  form,
  onChange,
  requisicao,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
  requisicao: RequisicaoWizardItem | null;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Conteúdo para candidatos</h2>
          <p className="text-xs text-slate-500">Texto completo exibido na página da vaga no portal.</p>
        </div>
        {requisicao ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            {requisicao.code} · {form.titulo || requisicao.titulo}
          </span>
        ) : null}
      </div>

      <FormSection title="Descrição e requisitos" icon={FileText} className="flex min-h-0 flex-1 flex-col">
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
          <Field
            label="Descrição da vaga"
            hint="Responsabilidades, dia a dia e o que a pessoa fará"
            className="flex min-h-[10rem] flex-col lg:min-h-0 lg:flex-1"
            required
          >
            <textarea
              className="min-h-[10rem] flex-1 w-full resize-none rounded-lg border border-input bg-slate-50/50 px-3 py-2 text-sm leading-relaxed focus:bg-white lg:min-h-0"
              value={form.descricao}
              onChange={(e) => onChange({ descricao: e.target.value })}
            />
          </Field>
          <Field
            label="Requisitos e qualificações"
            hint="Formação, experiência e competências desejadas"
            className="flex min-h-[10rem] flex-col lg:min-h-0 lg:flex-1"
            required
          >
            <textarea
              className="min-h-[10rem] flex-1 w-full resize-none rounded-lg border border-input bg-slate-50/50 px-3 py-2 text-sm leading-relaxed focus:bg-white lg:min-h-0"
              value={form.requisitos}
              onChange={(e) => onChange({ requisitos: e.target.value })}
            />
          </Field>
        </div>
      </FormSection>
    </div>
  );
}

function FormSection({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  icon: typeof BriefcaseBusiness;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <div className="grid size-7 place-items-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="size-3.5" />
        </div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      className="h-9 w-full rounded-md border border-input bg-white px-2.5 text-sm shadow-xs"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function StepPublicacao({
  form,
  onChange,
}: {
  form: FormState;
  onChange: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Configurações de publicação</h2>
        <p className="text-xs text-slate-500">Como a vaga aparecerá no portal.</p>
      </div>

      <div className="space-y-2">
        <ToggleCard
          checked={form.publicarAgora}
          onChange={(checked) => onChange({ publicarAgora: checked })}
          title="Publicar imediatamente"
          description="A vaga ficará visível para candidatos assim que você confirmar."
        />
        <ToggleCard
          checked={form.exibirSalario}
          onChange={(checked) => onChange({ exibirSalario: checked })}
          title="Exibir faixa salarial no portal"
          description="Quando desligado, o salário fica visível apenas para o RH."
        />
        <ToggleCard
          checked={form.destaquePortal}
          onChange={(checked) => onChange({ destaquePortal: checked })}
          title="Destacar na home do portal"
          description="Posiciona a vaga entre as oportunidades em evidência."
          icon={Sparkles}
        />
      </div>

      {!form.publicarAgora ? (
        <Field label="Data de encerramento das inscrições">
          <Input
            type="date"
            value={form.dataEncerramento}
            onChange={(e) => onChange({ dataEncerramento: e.target.value })}
          />
        </Field>
      ) : null}
    </div>
  );
}

function StepConfirmacao({
  form,
  requisicao,
}: {
  form: FormState;
  requisicao: RequisicaoWizardItem | null;
}) {
  const rows = [
    { label: "Requisição", value: requisicao ? `${requisicao.code} — ${requisicao.titulo}` : "—" },
    { label: "DNALIO", value: form.descricaoCargoCode ? `${form.descricaoCargoCode} — ${form.descricaoCargoTitle}` : "—" },
    { label: "Match mínimo", value: `${form.matchMinimoPercentual}%` },
    { label: "Título publicado", value: form.titulo },
    { label: "Modalidade", value: labelModalidade(form.modalidade) },
    { label: "Contrato", value: form.tipoContrato.toUpperCase() },
    { label: "Local", value: form.local || "—" },
    { label: "Salário no portal", value: form.exibirSalario ? form.faixaSalarial || "—" : "Oculto" },
    { label: "Publicação", value: form.publicarAgora ? "Imediata" : `Agendada até ${form.dataEncerramento || "—"}` },
    { label: "Destaque", value: form.destaquePortal ? "Sim" : "Não" },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Revisão final</h2>
        <p className="text-xs text-slate-500">Confira antes de publicar.</p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-bold text-slate-900">{form.titulo}</div>
        <div className="mt-0.5 line-clamp-2 text-xs text-slate-600">{form.resumo}</div>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5">
            <MapPin className="size-3" />
            {form.local}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5">{labelModalidade(form.modalidade)}</span>
          <span className="rounded-full bg-white px-2 py-0.5">{form.tipoContrato.toUpperCase()}</span>
        </div>
      </div>

      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-0.5 px-3 py-2 sm:grid-cols-[140px_1fr]">
            <dt className="text-xs font-semibold text-slate-500">{row.label}</dt>
            <dd className="text-xs font-medium text-slate-900">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SuccessPanel({ titulo, requisicao }: { titulo: string; requisicao: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="size-7" />
      </div>
      <h2 className="mt-3 text-xl font-bold text-slate-900">Vaga publicada</h2>
      <p className="mt-1 text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{titulo}</span> disponível no portal (mock · {requisicao}).
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/vagas">Quadro de vagas</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/app/dashboard/preview/home-analista-rh">Home preview</Link>
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
  compact = false,
  hint,
  required = false,
  icon: Icon,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  compact?: boolean;
  hint?: string;
  required?: boolean;
  icon?: typeof Wallet;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1.5">
        {Icon ? <Icon className="size-3.5 text-slate-400" /> : null}
        <Label className={cn("font-semibold text-slate-700", compact ? "text-xs" : "text-sm")}>
          {label}
          {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
        </Label>
      </div>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

function ToggleCard({
  checked,
  onChange,
  title,
  description,
  icon: Icon,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description: string;
  icon?: typeof Sparkles;
}) {
  const IconCmp = Icon ?? Globe;
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border p-2.5 text-left transition sm:p-3",
        checked ? "border-blue-300 bg-blue-50/60" : "border-slate-200 hover:bg-slate-50",
      )}
    >
      <div className={cn("rounded-md p-1.5", checked ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500")}>
        <IconCmp className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-slate-900 sm:text-sm">{title}</div>
        <div className="line-clamp-1 text-[10px] text-slate-500 sm:text-xs">{description}</div>
      </div>
      <span
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-full border",
          checked ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white",
        )}
      >
        {checked ? <Check className="size-2.5" /> : null}
      </span>
    </button>
  );
}

function labelModalidade(value: string) {
  if (value === "presencial") return "Presencial";
  if (value === "remoto") return "Remoto";
  return "Híbrido";
}
