"use client";

import {
    Check,
    CheckCircle2,
    ClipboardList,
    ExternalLink,
    FileText,
    Headphones,
    Search,
    User,
} from "lucide-react";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import { MAIN_WIZARD_STEPS, type WizardPlan } from "../wizardSteps";

const STEP_ICONS = {
    "dados-pessoais": User,
    documentos: FileText,
    revisao: Search,
    conclusao: CheckCircle2,
} as const;

interface Props {
    nome: string | undefined;
    isSubmitted: boolean;
    plan: WizardPlan;
    onOpenHelp?: () => void;
}

export default function WizardSidebar({ nome, isSubmitted, plan, onOpenHelp }: Props) {
    const { currentStep, completedSteps, setStep } = useAdmissaoWizardStore();
    const firstName = nome?.trim().split(/\s+/)[0] || "Candidato";

    const completedCount = MAIN_WIZARD_STEPS.filter((s) =>
        isSubmitted || completedSteps.has(s.step) || currentStep > s.step,
    ).length;
    const pct = isSubmitted ? 100 : Math.round((completedCount / MAIN_WIZARD_STEPS.length) * 100);

    function isStepDone(step: number): boolean {
        return isSubmitted || completedSteps.has(step) || currentStep > step;
    }

    function isStepActive(step: number): boolean {
        if (isSubmitted && step === 4) return true;
        return currentStep === step;
    }

    function canNavigateTo(step: number): boolean {
        if (isSubmitted) return step === 4;
        if (step === 4 && !isSubmitted) return false;
        if (step <= currentStep) return step !== currentStep;
        for (let i = 1; i < step; i++) {
            if (!completedSteps.has(i) && currentStep < i) return false;
        }
        return step <= currentStep + 1 || completedSteps.has(step - 1);
    }

    function handleClick(step: number) {
        if (!canNavigateTo(step)) return;
        setStep(step);
    }

    return (
        <aside className="hidden lg:flex w-72 shrink-0 flex-col border-r border-slate-200 bg-[#f8fafc] p-6">
            <div className="mb-6">
                <p className="text-lg font-bold text-slate-900">
                    Olá, {firstName}! <span aria-hidden>👋</span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {isSubmitted
                        ? "Você concluiu todas as etapas do processo de admissão."
                        : "Estamos felizes em ter você no time! Complete todas as etapas para finalizar seu processo de admissão."}
                </p>
            </div>

            <div className="mb-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">Seu progresso</span>
                    <span className="font-bold text-[#0047BB]">{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                        className="h-full rounded-full bg-[#0047BB] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            <nav className="flex-1 space-y-1">
                {MAIN_WIZARD_STEPS.map((item) => {
                    const done = isStepDone(item.step);
                    const active = isStepActive(item.step);
                    const clickable = canNavigateTo(item.step);
                    const Icon = STEP_ICONS[item.kind];

                    return (
                        <button
                            key={item.step}
                            type="button"
                            onClick={() => handleClick(item.step)}
                            disabled={!clickable}
                            aria-current={active ? "step" : undefined}
                            className={`relative flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                                active
                                    ? "border border-[#bfdbfe] bg-[#eff6ff]"
                                    : "border border-transparent hover:bg-white"
                            } ${clickable ? "cursor-pointer" : "cursor-default opacity-60"}`}
                        >
                            {active && (
                                <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-[#0047BB]" />
                            )}
                            <div
                                className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                                    done
                                        ? "bg-emerald-500 text-white"
                                        : active
                                          ? "bg-[#0047BB] text-white"
                                          : "bg-slate-200 text-slate-500"
                                }`}
                            >
                                {done && !active ? <Check className="size-4" /> : item.step}
                            </div>
                            <div className="min-w-0 pt-0.5">
                                <div className="flex items-center gap-1.5">
                                    <Icon className="size-3.5 text-slate-400" />
                                    <p className={`text-sm font-semibold ${active ? "text-[#0047BB]" : "text-slate-800"}`}>
                                        {item.label}
                                    </p>
                                </div>
                                <p className="text-xs text-slate-500">{item.subtitle}</p>
                            </div>
                        </button>
                    );
                })}
            </nav>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#eff6ff]">
                        <Headphones className="size-5 text-[#0047BB]" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Dúvidas?</p>
                        <p className="text-xs text-slate-500">Fale com nosso time de RH</p>
                        <button
                            type="button"
                            onClick={onOpenHelp}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#0047BB] hover:underline"
                        >
                            Abrir atendimento
                            <ExternalLink className="size-3" />
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    );
}
