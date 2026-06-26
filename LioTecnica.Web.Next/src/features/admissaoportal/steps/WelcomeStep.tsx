"use client";

import {
    ArrowRight,
    Briefcase,
    Building2,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    FilePlus2,
    Home,
    Lock,
    MapPin,
    RefreshCw,
    Search,
    Shield,
    Sparkles,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BRAND_BLUE = "#0047BB";
const ACCENT_YELLOW = "#fbbf24";
const WELCOME_BG = "/admissao/welcome-bg.png";

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

const HOW_IT_WORKS = [
    {
        icon: User,
        title: "Dados Pessoais",
        desc: "Informe seus dados básicos, como nome, CPF, data de nascimento e estado civil.",
    },
    {
        icon: Home,
        title: "Dados Gerais",
        desc: "Preencha seus dados de endereço e contato para que possamos falar com você.",
    },
    {
        icon: FilePlus2,
        title: "Documentos",
        desc: "Envie os documentos solicitados em formato digital (PDF, JPG ou PNG).",
    },
    {
        icon: Building2,
        title: "Informações Bancárias",
        desc: "Informe os dados da conta bancária onde você deseja receber seu salário.",
    },
    {
        icon: Search,
        title: "Revisão",
        desc: "Revise todas as informações preenchidas antes de finalizar o processo.",
    },
    {
        icon: CheckCircle2,
        title: "Conclusão",
        desc: "Pronto! Suas informações serão enviadas para análise do nosso time de RH.",
    },
] as const;

function JobField({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
    return (
        <div className="min-w-0 py-1">
            <div className="flex items-center gap-2 text-[#0047BB]">
                <Icon className="size-4 shrink-0" />
                <p className="text-xs font-medium text-slate-500">{label}</p>
            </div>
            <p className="mt-1 pl-6 text-sm font-semibold text-slate-900">{value?.trim() || "—"}</p>
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
        <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.05)]">
            <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff]">
                    <Icon className="size-5 text-[#0047BB]" />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="mt-1 text-sm text-slate-500 leading-snug">{desc}</p>
                </div>
            </div>
        </div>
    );
}

export default function WelcomeStep({ vaga, onStart, disabled }: Props) {
    return (
        <div className="relative flex h-full w-full min-h-0 flex-col overflow-y-auto bg-white">
            {/* Background LIOTÉCNICA — ocupa metade direita da página */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 hidden md:block w-[58%] bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: `linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.95) 8%, rgba(255,255,255,0.55) 28%, rgba(255,255,255,0.15) 55%, rgba(255,255,255,0) 78%), url('${WELCOME_BG}')`,
                }}
            />

            {/* Conteúdo principal — largura total */}
            <div className="relative z-10 flex w-full flex-1 flex-col">
                <div className="grid w-full flex-1 grid-cols-1 gap-6 px-5 py-6 sm:px-8 lg:px-12 lg:py-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-8 2xl:px-16">
                    {/* Coluna esquerda */}
                    <div className="flex min-w-0 flex-col justify-center space-y-6">
                        <div className="space-y-4">
                            <h1 className="text-3xl font-extrabold leading-tight text-[#0047BB] sm:text-4xl lg:text-[2.75rem]">
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

                            <p className="max-w-3xl text-base leading-relaxed text-slate-600 sm:text-lg">
                                Estamos muito felizes em tê-lo(a) aqui! Para iniciar seu processo de admissão,
                                você precisará preencher suas informações e enviar os documentos solicitados
                                em algumas etapas simples.
                            </p>

                            <div className="flex max-w-3xl items-start gap-3 rounded-2xl border border-slate-200 bg-[#f4f7fa] px-4 py-4">
                                <Shield className="size-6 shrink-0 text-[#0047BB]" />
                                <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
                                    <span className="font-semibold text-slate-800">Seus dados estão protegidos.</span>{" "}
                                    Utilizamos criptografia e seguimos as melhores práticas de segurança para proteger suas informações.
                                </p>
                            </div>
                        </div>

                        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
                            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                                <Briefcase className="size-5 text-[#0047BB]" />
                                <h2 className="text-lg font-bold text-slate-900">Informações da vaga</h2>
                            </div>

                            <div className="grid grid-cols-1 gap-x-8 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                                <JobField icon={Briefcase} label="Cargo" value={vaga?.cargo} />
                                <JobField icon={User} label="Área" value={vaga?.area} />
                                <JobField icon={MapPin} label="Local de trabalho" value={vaga?.localTrabalho} />
                                <JobField icon={Calendar} label="Tipo de contratação" value={vaga?.tipoContratacao} />
                                <JobField icon={DollarSign} label="Salário" value={vaga?.salario} />
                                <JobField icon={Calendar} label="Data de início prevista" value={vaga?.dataInicioPrevista} />
                            </div>

                            <div className="flex items-center gap-2 bg-[#eff6ff] px-5 py-3 text-sm font-medium text-[#0047BB]">
                                <Sparkles className="size-4 shrink-0" />
                                Estamos ansiosos para contar com você no nosso time! ✨
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Como funciona */}
                    <aside className="w-full shrink-0 xl:pt-2">
                        <div className="rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-[0_2px_16px_rgba(15,23,42,0.08)] backdrop-blur-sm sm:p-6">
                            <h2 className="text-xl font-bold text-slate-900">Como funciona?</h2>
                            <p className="mt-1 text-sm text-slate-500">
                                Seu processo de admissão é dividido em 6 etapas.
                            </p>

                            <ol className="mt-6 space-y-5">
                                {HOW_IT_WORKS.map(({ icon: Icon, title, desc }, index) => (
                                    <li key={title} className="flex gap-4">
                                        <div className="flex flex-col items-center">
                                            <span
                                                className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                                                style={{ backgroundColor: BRAND_BLUE }}
                                            >
                                                {index + 1}
                                            </span>
                                            {index < HOW_IT_WORKS.length - 1 && (
                                                <span className="mt-2 min-h-[24px] w-px flex-1 bg-slate-200" />
                                            )}
                                        </div>
                                        <div className="min-w-0 pb-1">
                                            <div className="flex items-center gap-2">
                                                <Icon className="size-4 text-slate-400" />
                                                <p className="font-semibold text-slate-900">{title}</p>
                                            </div>
                                            <p className="mt-1 text-sm leading-snug text-slate-500">{desc}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Rodapé — 3 cards + CTA */}
            <div className="relative z-10 w-full shrink-0 border-t border-slate-200 bg-white">
                <div className="w-full px-5 py-6 sm:px-8 lg:px-12 2xl:px-16">
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
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

                        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end xl:pl-8">
                            <Button
                                size="lg"
                                disabled={disabled}
                                onClick={onStart}
                                className="h-14 min-w-[260px] rounded-xl bg-[#0047BB] text-base font-semibold text-white shadow-md hover:bg-[#003a99]"
                            >
                                Iniciar meu processo
                                <ArrowRight className="ml-1 size-5" />
                            </Button>
                            <p className="inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 sm:justify-end">
                                <Lock className="size-3.5" />
                                Ambiente 100% seguro
                            </p>
                        </div>
                    </div>

                    <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-slate-400">
                        <Lock className="size-3.5 shrink-0" />
                        Seus dados estão seguros conosco. Utilizamos criptografia para proteger suas informações.
                    </p>
                </div>
            </div>
        </div>
    );
}
