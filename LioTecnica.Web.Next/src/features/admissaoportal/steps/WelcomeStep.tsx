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
const BRAND_BLUE_HOVER = "#003a99";
const ACCENT_YELLOW = "#fbbf24";

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

export default function WelcomeStep({ vaga, onStart, disabled }: Props) {
    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-white">
            {/* Imagem de fundo — prédio industrial com fade para branco */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block w-[62%] bg-cover bg-center"
                style={{
                    backgroundImage:
                        "linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,0.92) 12%, rgba(255,255,255,0.45) 42%, rgba(255,255,255,0.08) 72%, rgba(255,255,255,0) 100%), url('https://images.unsplash.com/photo-1565008576549-57569a49371d?auto=format&fit=crop&w=1600&q=80')",
                }}
            />

            <div className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-1 flex-col xl:flex-row gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                {/* Coluna principal */}
                <div className="flex-1 min-w-0 max-w-3xl space-y-6">
                    <div className="space-y-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold leading-tight text-[#0047BB]">
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
                        </div>

                        <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                            Estamos muito felizes em tê-lo(a) aqui! Para iniciar seu processo de admissão,
                            você precisará preencher suas informações e enviar os documentos solicitados
                            em algumas etapas simples.
                        </p>

                        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-[#f4f7fa] px-4 py-4 max-w-2xl">
                            <Shield className="size-6 shrink-0 text-[#0047BB]" />
                            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                                <span className="font-semibold text-slate-800">Seus dados estão protegidos.</span>{" "}
                                Utilizamos criptografia e seguimos as melhores práticas de segurança para proteger suas informações.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)] overflow-hidden">
                        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
                            <Briefcase className="size-5 text-[#0047BB]" />
                            <h2 className="text-lg font-bold text-slate-900">Informações da vaga</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 p-5">
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
                <aside className="w-full xl:w-[380px] shrink-0">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
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
                                            <span className="mt-2 w-px flex-1 min-h-[24px] bg-slate-200" />
                                        )}
                                    </div>
                                    <div className="min-w-0 pb-1">
                                        <div className="flex items-center gap-2">
                                            <Icon className="size-4 text-slate-400" />
                                            <p className="font-semibold text-slate-900">{title}</p>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-500 leading-snug">{desc}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </aside>
            </div>

            {/* Barra inferior + CTA */}
            <div className="relative z-10 shrink-0 border-t border-slate-200 bg-white">
                <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
                            <div className="flex items-start gap-3">
                                <Clock className="size-5 shrink-0 text-[#0047BB] mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Quanto tempo leva?</p>
                                    <p className="text-sm text-slate-500">Em média de 20 a 30 minutos para preencher todas as etapas.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <FilePlus2 className="size-5 shrink-0 text-[#0047BB] mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Tenha em mãos</p>
                                    <p className="text-sm text-slate-500">Seus documentos pessoais e os dados da sua conta bancária.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <RefreshCw className="size-5 shrink-0 text-[#0047BB] mt-0.5" />
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Pode parar e voltar depois</p>
                                    <p className="text-sm text-slate-500">Seu progresso é salvo automaticamente. Você pode continuar quando quiser.</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
                            <Button
                                size="lg"
                                disabled={disabled}
                                onClick={onStart}
                                className="h-14 min-w-[260px] rounded-xl text-base font-semibold text-white shadow-md hover:opacity-95"
                                style={{ backgroundColor: BRAND_BLUE }}
                                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = BRAND_BLUE_HOVER; }}
                                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = BRAND_BLUE; }}
                            >
                                Iniciar meu processo
                                <ArrowRight className="size-5 ml-1" />
                            </Button>
                            <p className="inline-flex items-center justify-center sm:justify-end gap-1.5 text-xs text-slate-500">
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
