"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  Loader2,
  MapPin,
  Sparkles,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Requisição", hint: "Escolha a origem" },
  { id: 2, label: "Dados da vaga", hint: "Conteúdo e requisitos" },
  { id: 3, label: "Publicação", hint: "Configurações do portal" },
  { id: 4, label: "Confirmação", hint: "Revisar e publicar" },
] as const;

const REQUISICOES_MOCK = [
  {
    id: "req-3042",
    code: "REQ-3042",
    titulo: "Analista de Dados",
    area: "TI",
    unidade: "São Paulo — Matriz",
    status: "Aprovada",
    gestor: "Roberto Diretor",
    vagas: 1,
  },
  {
    id: "req-2987",
    code: "REQ-2987",
    titulo: "Desenvolvedor .NET",
    area: "Engenharia",
    unidade: "Campinas",
    status: "Aprovada",
    gestor: "Carlos Gestor",
    vagas: 2,
  },
  {
    id: "req-3015",
    code: "REQ-3015",
    titulo: "Assistente Financeiro",
    area: "Financeiro",
    unidade: "São Paulo — Matriz",
    status: "Em análise",
    gestor: "Ana RH",
    vagas: 1,
  },
  {
    id: "req-2940",
    code: "REQ-2940",
    titulo: "Analista de RH",
    area: "Gente e Gestão",
    unidade: "Remoto",
    status: "Aprovada",
    gestor: "Mariana Santos",
    vagas: 1,
  },
];

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
  publicarAgora: true,
  exibirSalario: false,
  destaquePortal: false,
  dataEncerramento: "",
};

/**
 * Wizard mockado (até 4 etapas) para publicar vaga no portal a partir de uma requisição.
 * Rota oculta de validação de UX.
 */
export default function PublicarVagaWizardPreviewScreen() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const requisicao = useMemo(
    () => REQUISICOES_MOCK.find((item) => item.id === form.requisicaoId) ?? null,
    [form.requisicaoId],
  );

  function patchForm(patch: Partial<FormState>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function selectRequisicao(id: string) {
    const item = REQUISICOES_MOCK.find((row) => row.id === id);
    if (!item) return;
    patchForm({
      requisicaoId: id,
      titulo: item.titulo,
      local: item.unidade,
      resumo: `Oportunidade para ${item.titulo} na área de ${item.area}.`,
      descricao: `Buscamos profissional para atuar como ${item.titulo}, contribuindo com o time de ${item.area} em projetos estratégicos da empresa.`,
      requisitos: "Experiência na função; comunicação clara; disponibilidade para início em até 30 dias.",
      faixaSalarial: "A combinar",
    });
  }

  function canAdvance() {
    if (step === 1) return !!form.requisicaoId;
    if (step === 2) {
      return (
        form.titulo.trim().length > 2 &&
        form.resumo.trim().length > 10 &&
        form.descricao.trim().length > 20 &&
        form.requisitos.trim().length > 10
      );
    }
    if (step === 3) return form.publicarAgora || form.dataEncerramento.trim().length > 0;
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
          Selecione a requisição e publique em poucos passos.
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
                step === 1 && "overflow-y-auto overscroll-contain",
                step === 2 && "overflow-hidden",
                step > 2 && "overflow-hidden",
              )}
            >
              {step === 1 ? <StepRequisicao selectedId={form.requisicaoId} onSelect={selectRequisicao} /> : null}
              {step === 2 ? <StepDadosVaga form={form} onChange={patchForm} requisicao={requisicao} /> : null}
              {step === 3 ? <StepPublicacao form={form} onChange={patchForm} /> : null}
              {step === 4 ? <StepConfirmacao form={form} requisicao={requisicao} /> : null}
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

              {step < 4 ? (
                <Button type="button" size="sm" disabled={!canAdvance()} onClick={() => setStep((current) => Math.min(4, current + 1))}>
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
    <ol className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4">
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
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-bold text-slate-900">Selecione a requisição</h2>
        <p className="text-xs text-slate-500">Apenas requisições aprovadas podem ser publicadas.</p>
      </div>

      <div className="grid gap-2 lg:grid-cols-2">
        {REQUISICOES_MOCK.map((item) => {
          const selected = selectedId === item.id;
          const bloqueada = item.status !== "Aprovada";
          return (
            <button
              key={item.id}
              type="button"
              disabled={bloqueada}
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
                      {item.area} · {item.unidade} · {item.gestor}
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    item.status === "Aprovada" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
                  )}
                >
                  {item.status}
                </span>
              </div>
            </button>
          );
        })}
      </div>
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
  requisicao: (typeof REQUISICOES_MOCK)[number] | null;
}) {
  const filledCount = [
    form.titulo.trim().length > 2,
    form.resumo.trim().length > 10,
    form.local.trim().length > 0,
    form.descricao.trim().length > 20,
    form.requisitos.trim().length > 10,
  ].filter(Boolean).length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">Dados da vaga</h2>
          <p className="text-xs text-slate-500">Revise o que o candidato verá no portal público.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {requisicao ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
              {requisicao.code} · {requisicao.area}
            </span>
          ) : null}
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
            {filledCount}/5 campos essenciais
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(260px,32%)_minmax(0,1fr)]">
        <PortalVagaPreviewCard form={form} requisicao={requisicao} />

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
              <Field label="Faixa salarial" icon={Wallet} hint="Pode ficar oculta na etapa seguinte">
                <Input
                  className="h-9"
                  value={form.faixaSalarial}
                  onChange={(e) => onChange({ faixaSalarial: e.target.value })}
                  placeholder="A combinar"
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Conteúdo para candidatos" icon={FileText} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
              <Field
                label="Descrição da vaga"
                hint="Responsabilidades, dia a dia e o que a pessoa fará"
                className="flex min-h-[8.5rem] flex-col lg:min-h-0 lg:flex-1"
                required
              >
                <textarea
                  className="min-h-[8.5rem] flex-1 w-full resize-none rounded-lg border border-input bg-slate-50/50 px-3 py-2 text-sm leading-relaxed focus:bg-white lg:min-h-0"
                  value={form.descricao}
                  onChange={(e) => onChange({ descricao: e.target.value })}
                />
              </Field>
              <Field
                label="Requisitos e qualificações"
                hint="Formação, experiência e competências desejadas"
                className="flex min-h-[8.5rem] flex-col lg:min-h-0 lg:flex-1"
                required
              >
                <textarea
                  className="min-h-[8.5rem] flex-1 w-full resize-none rounded-lg border border-input bg-slate-50/50 px-3 py-2 text-sm leading-relaxed focus:bg-white lg:min-h-0"
                  value={form.requisitos}
                  onChange={(e) => onChange({ requisitos: e.target.value })}
                />
              </Field>
            </div>
          </FormSection>
        </div>
      </div>
    </div>
  );
}

function PortalVagaPreviewCard({
  form,
  requisicao,
}: {
  form: FormState;
  requisicao: (typeof REQUISICOES_MOCK)[number] | null;
}) {
  return (
    <aside className="flex shrink-0 flex-col rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Prévia do card no portal</p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900">
              {form.titulo.trim() || "Título da vaga"}
            </h3>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
              {form.resumo.trim() || "Resumo curto exibido no card de oportunidades."}
            </p>
          </div>
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-600">
            <BriefcaseBusiness className="size-4" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            <MapPin className="size-3" />
            {form.local.trim() || "Local"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {labelModalidade(form.modalidade)}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
            {form.tipoContrato.toUpperCase()}
          </span>
        </div>
        {form.faixaSalarial ? (
          <p className="mt-3 text-xs font-semibold text-emerald-700">{form.faixaSalarial}</p>
        ) : null}
      </div>
      {requisicao ? (
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          Origem: <span className="font-semibold text-slate-700">{requisicao.code}</span> · gestor{" "}
          {requisicao.gestor}
        </p>
      ) : null}
    </aside>
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
  requisicao: (typeof REQUISICOES_MOCK)[number] | null;
}) {
  const rows = [
    { label: "Requisição", value: requisicao ? `${requisicao.code} — ${requisicao.titulo}` : "—" },
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
