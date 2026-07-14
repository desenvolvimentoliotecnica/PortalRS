"use client";

import {
    ArrowRight,
    Briefcase,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    FilePlus2,
    FileText,
    Lock,
    MapPin,
    RefreshCw,
    Shield,
    Sparkles,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BRAND_BLUE = "#0047BB";
const ACCENT_YELLOW = "#fbbf24";
const APP_BASE = "/app";
const WELCOME_BG = `${APP_BASE}/admissao/welcome-bg.png`;

export interface PortalInformacoesVaga {
    cargo?: string | null;
    area?: string | null;
    localTrabalho?: string | null;
    tipoContratacao?: string | null;
    salario?: string | null;
    dataInicioPrevista?: string | null;
}

interface Props {
    vaga?: PortalInformacoesVaga | null;
    onStart: () => void;
    disabled?: boolean;
}

/** Alinhado às 4 etapas principais do wizard (dados pessoais → conclusão). */
const HOW_IT_WORKS = [
    {
        icon: User,
        title: "Dados Pessoais",
        desc: "Informe seus dados básicos, endereço, contato e informações bancárias.",
    },
    {
        icon: FilePlus2,
        title: "Documentos",
        desc: "Envie os documentos solicitados em formato digital (PDF, JPG ou PNG).",
    },
    {
        icon: CheckCircle2,
        title: "Revisão",
        desc: "Confira todas as informações preenchidas antes de finalizar.",
    },
    {
        icon: Sparkles,
        title: "Conclusão",
        desc: "Pronto! Seus dados seguem para análise do time de RH.",
    },
] as const;

function JobField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
    return (
        <div className="min-w-0 rounded-xl bg-slate-50/80 px-3 py-2.5 md:bg-transparent md:px-0 md:py-1">
            <div className="flex items-center gap-2 text-[#0047BB]">
                <Icon className="size-4 shrink-0" />
                <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
            <p className="mt-1 pl-6 text-sm font-semibold break-words text-slate-900">{value?.trim() || "—"}</p>
        </div>
    );
}

function FooterInfoCard({
    icon: Icon,
    title,
    desc,
}: {
    icon: React.ElementType;
    title: string;
    desc: string;
}) {
    return (
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-[0_2px_12px_rgba(15,23,42,0.05)] sm:p-4">
            <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff] sm:size-10">
                    <Icon className="size-4 text-[#0047BB] sm:size-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-xs leading-snug text-slate-500 sm:text-sm">{desc}</p>
                </div>
            </div>
        </div>
    );
}

function VagaCard({ vaga }: { vaga?: PortalInformacoesVaga | null }) {
    return (
        <div className="w-full max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5 sm:px-5 sm:py-4">
                <Briefcase className="size-5 text-[#0047BB]" />
                <h2 className="text-base font-bold text-slate-900 sm:text-lg">Informações da vaga</h2>
            </div>

            <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-3 sm:p-4 lg:gap-x-6 lg:gap-y-4 lg:p-5">
                <JobField icon={Briefcase} label="Cargo" value={vaga?.cargo} />
                <JobField icon={User} label="Área" value={vaga?.area} />
                <JobField icon={MapPin} label="Local de trabalho" value={vaga?.localTrabalho} />
                <JobField icon={FileText} label="Tipo de contratação" value={vaga?.tipoContratacao} />
                <JobField icon={DollarSign} label="Salário" value={vaga?.salario} />
                <JobField icon={Calendar} label="Data de início prevista" value={vaga?.dataInicioPrevista} />
            </div>

            <div className="flex items-center gap-2 bg-[#eff6ff] px-4 py-3 text-sm font-medium text-[#0047BB] sm:px-5">
                <Sparkles className="size-4 shrink-0" />
                Estamos ansiosos para contar com você no nosso time!
            </div>
        </div>
    );
}

function HowItWorksList({ compact = false }: { compact?: boolean }) {
    return (
        <ol className={compact ? "space-y-3.5" : "mt-5 space-y-4 lg:mt-6 lg:space-y-5"}>
            {HOW_IT_WORKS.map(({ icon: Icon, title, desc }, index) => (
                <li key={title} className={`flex ${compact ? "gap-3" : "gap-3 lg:gap-4"}`}>
                    <div className="flex flex-col items-center">
                        <span
                            className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${
                                compact ? "size-7 text-xs" : "size-7 text-xs lg:size-8 lg:text-sm"
                            }`}
                            style={{ backgroundColor: BRAND_BLUE }}
                        >
                            {index + 1}
                        </span>
                        {!compact && index < HOW_IT_WORKS.length - 1 && (
                            <span className="mt-2 min-h-[16px] w-px flex-1 bg-slate-200 lg:min-h-[24px]" />
                        )}
                    </div>
                    <div className="min-w-0 pb-0.5">
                        <div className="flex items-center gap-2">
                            <Icon className="size-4 shrink-0 text-slate-400" />
                            <p className="font-semibold text-slate-900">{title}</p>
                        </div>
                        <p className={`mt-1 leading-snug text-slate-500 ${compact ? "text-xs" : "text-sm"}`}>
                            {desc}
                        </p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function StartProcessButton({
    disabled,
    onStart,
    className,
}: {
    disabled?: boolean;
    onStart: () => void;
    className?: string;
}) {
    return (
        <Button
            size="lg"
            disabled={disabled}
            onClick={onStart}
            className={`h-12 rounded-xl bg-[#0047BB] text-base font-semibold text-white shadow-md hover:bg-[#003a99] sm:h-14 ${className ?? ""}`}
        >
            Iniciar meu processo
            <ArrowRight className="ml-1 size-5" />
        </Button>
    );
}

export default function WelcomeStep({ vaga, onStart, disabled }: Props) {
    return (
        <div className="relative flex h-full w-full min-h-0 flex-col overflow-y-auto overscroll-contain bg-white">
            {/* Fundo decorativo a partir de tablet/desktop pequeno */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] bg-cover bg-center bg-no-repeat md:block lg:w-[52%] xl:w-[58%]"
                style={{
                    backgroundImage: `linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.96) 10%, rgba(255,255,255,0.7) 32%, rgba(255,255,255,0.25) 58%, rgba(255,255,255,0) 82%), url('${WELCOME_BG}')`,
                }}
            />

            <div className="relative z-10 flex w-full flex-1 flex-col">
                {/* 2 colunas a partir de md (~768px): cobre tablet e desktop menor */}
                <div className="grid w-full flex-1 grid-cols-1 gap-5 px-4 py-5 sm:gap-6 sm:px-6 sm:py-6 md:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)] md:items-start md:gap-6 md:px-8 lg:gap-8 lg:px-10 lg:py-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:px-12 2xl:px-16">
                    <div className="flex min-w-0 flex-col justify-center space-y-4 sm:space-y-5 md:space-y-5 lg:space-y-6">
                        <div className="space-y-3 sm:space-y-4">
                            <h1 className="text-[1.65rem] font-extrabold leading-tight text-[#0047BB] sm:text-3xl md:text-[2rem] lg:text-4xl xl:text-[2.75rem]">
                                Bem-vindo(a) ao{" "}
                                <span className="relative inline-block">
                                    Portal de Admissão!
                                    <span
                                        aria-hidden
                                        className="absolute -bottom-1 left-0 h-1.5 w-full rounded-full"
                                        style={{ backgroundColor: ACCENT_YELLOW }}
                                    />
                                </span>
                            </h1>

                            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base lg:max-w-3xl lg:text-lg">
                                Estamos muito felizes em tê-lo(a) aqui! Para iniciar seu processo de admissão,
                                você precisará preencher suas informações e enviar os documentos solicitados
                                em algumas etapas simples.
                            </p>

                            <div className="flex max-w-2xl items-start gap-3 rounded-2xl border border-slate-200 bg-[#f4f7fa] px-3.5 py-3 lg:max-w-3xl sm:px-4 sm:py-4">
                                <Shield className="mt-0.5 size-5 shrink-0 text-[#0047BB] sm:size-6" />
                                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                                    <span className="font-semibold text-slate-800">Seus dados estão protegidos.</span>{" "}
                                    Utilizamos criptografia e seguimos as melhores práticas de segurança.
                                </p>
                            </div>
                        </div>

                        <VagaCard vaga={vaga} />

                        {/* CTA inline só no mobile estreito; em desktop menor o CTA vai no rodapé */}
                        <div className="flex flex-col gap-2 md:hidden">
                            <StartProcessButton disabled={disabled} onStart={onStart} className="w-full" />
                            <p className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500">
                                <Lock className="size-3.5" />
                                Ambiente 100% seguro
                            </p>
                        </div>
                    </div>

                    <aside className="w-full min-w-0 shrink-0 md:sticky md:top-4 md:self-start">
                        {/* Mobile estreito: colapsável */}
                        <details className="group rounded-2xl border border-slate-200 bg-white/95 shadow-[0_2px_16px_rgba(15,23,42,0.08)] backdrop-blur-sm open:pb-1 md:hidden">
                            <summary className="cursor-pointer list-none px-4 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-bold text-slate-900">Como funciona?</h2>
                                        <p className="mt-0.5 text-sm text-slate-500">
                                            Processo em {HOW_IT_WORKS.length} etapas — toque para ver.
                                        </p>
                                    </div>
                                    <span className="text-sm font-semibold text-[#0047BB] group-open:hidden">Ver</span>
                                    <span className="hidden text-sm font-semibold text-[#0047BB] group-open:inline">Ocultar</span>
                                </div>
                            </summary>
                            <div className="border-t border-slate-100 px-4 pb-4 pt-4">
                                <HowItWorksList compact />
                            </div>
                        </details>

                        {/* Tablet / desktop menor / desktop largo: painel completo na lateral */}
                        <div className="hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_2px_16px_rgba(15,23,42,0.08)] backdrop-blur-sm md:block lg:p-5 xl:p-6">
                            <h2 className="text-lg font-bold text-slate-900 lg:text-xl">Como funciona?</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Seu processo de admissão é dividido em {HOW_IT_WORKS.length} etapas.
                            </p>
                            <HowItWorksList />
                        </div>
                    </aside>
                </div>
            </div>

            <div className="relative z-10 w-full shrink-0 border-t border-slate-200 bg-white">
                <div className="w-full px-4 py-5 sm:px-6 sm:py-5 md:px-8 lg:px-10 lg:py-6 xl:px-12 2xl:px-16">
                    {/* Em desktop menor: cards + CTA na mesma faixa; evita coluna única alongada */}
                    <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-5 lg:gap-6">
                        <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-3 lg:gap-4">
                            <FooterInfoCard
                                icon={Clock}
                                title="Quanto tempo leva?"
                                desc="Em média de 20 a 30 minutos para preencher todas as etapas."
                            />
                            <FooterInfoCard
                                icon={FilePlus2}
                                title="Tenha em mãos"
                                desc="Seus documentos pessoais e os dados da sua conta bancária."
                            />
                            <FooterInfoCard
                                icon={RefreshCw}
                                title="Pode parar e voltar depois"
                                desc="Seu progresso é salvo automaticamente. Você pode continuar quando quiser."
                            />
                        </div>

                        <div className="hidden shrink-0 flex-col items-stretch justify-center gap-2 md:flex md:w-[220px] lg:w-[260px]">
                            <StartProcessButton disabled={disabled} onStart={onStart} className="w-full min-w-0" />
                            <p className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500">
                                <Lock className="size-3.5" />
                                Ambiente 100% seguro
                            </p>
                        </div>
                    </div>

                    <p className="mt-5 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
                        <Lock className="size-3.5 shrink-0" />
                        Seus dados estão seguros conosco. Utilizamos criptografia para proteger suas informações.
                    </p>
                </div>
            </div>
        </div>
    );
}
