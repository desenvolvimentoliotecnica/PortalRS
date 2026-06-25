"use client";

import React from "react";
import { Check, Upload, ClipboardList, Users, Send, PartyPopper } from "lucide-react";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import type { WizardPlan } from "../wizardSteps";

const KEY_FIELDS = [
    "nome", "cpf", "dataNascimento", "sexo", "email", "telefone",
    "cep", "logradouro", "numero", "cidade", "uf",
    "bancoCodigo", "agencia", "conta",
] as const;

const GROUP_ICONS = {
    welcome: PartyPopper,
    documents: Upload,
    dados: ClipboardList,
    dependentes: Users,
    review: Send,
} as const;

function motivationalMessage(pct: number): string {
    if (pct === 0) return "Vamos começar!";
    if (pct < 25) return "Boa sorte, você está indo bem!";
    if (pct < 50) return "Continue assim!";
    if (pct < 75) return "Mais da metade concluída!";
    if (pct < 100) return "Quase lá, falta pouco!";
    return "Processo concluído!";
}

interface Props {
    nome: string | undefined;
    isSubmitted: boolean;
    plan: WizardPlan;
}

export default function WizardSidebar({ nome, isSubmitted, plan }: Props) {
    const { currentStep, completedSteps, formData, wizardTotalSteps, setStep } = useAdmissaoWizardStore();
    const total = wizardTotalSteps || plan.totalSteps;

    const filledKeyFields = KEY_FIELDS.filter((f) => {
        const v = formData[f];
        return v != null && String(v).trim() !== "";
    }).length;
    const formBonus = currentStep >= plan.dadosStep
        ? (filledKeyFields / KEY_FIELDS.length) / total
        : 0;

    const pct = isSubmitted
        ? 100
        : Math.min(99, Math.round((Math.max(completedSteps.size, currentStep) / total + formBonus) * 100));

    const radius = 40;
    const circ = 2 * Math.PI * radius;

    const docProgress =
        currentStep >= plan.docsStartStep && currentStep < plan.dadosStep
            ? currentStep - plan.docsStartStep + 1
            : currentStep >= plan.dadosStep
              ? plan.documentSteps.length
              : 0;

    function groupIcon(item: (typeof plan.sidebarItems)[number]) {
        if (item.step === 0) return GROUP_ICONS.welcome;
        if (item.isDocumentGroup) return GROUP_ICONS.documents;
        if (item.step === plan.dadosStep) return GROUP_ICONS.dados;
        if (item.step === plan.dependentesStep) return GROUP_ICONS.dependentes;
        return GROUP_ICONS.review;
    }

    function isItemDone(item: (typeof plan.sidebarItems)[number]): boolean {
        if (isSubmitted) return true;
        if (item.isDocumentGroup) {
            const end = item.documentEndStep ?? item.step;
            return currentStep > end || completedSteps.has(end);
        }
        return completedSteps.has(item.step) || currentStep > item.step;
    }

    function isItemActive(item: (typeof plan.sidebarItems)[number]): boolean {
        if (isSubmitted) return false;
        if (item.isDocumentGroup) {
            const end = item.documentEndStep ?? item.step;
            return currentStep >= item.step && currentStep <= end;
        }
        return currentStep === item.step;
    }

    function resolveTargetStep(item: (typeof plan.sidebarItems)[number]): number {
        if (item.isDocumentGroup) {
            const end = item.documentEndStep ?? item.step;
            if (currentStep >= item.step && currentStep <= end) return currentStep;
            for (let s = item.step; s <= end; s++) {
                if (!completedSteps.has(s)) return s;
            }
            return item.step;
        }
        return item.step;
    }

    function canNavigateTo(item: (typeof plan.sidebarItems)[number]): boolean {
        if (isSubmitted) return false;
        const target = resolveTargetStep(item);
        if (target === currentStep) return false;
        if (target < currentStep) return true;
        for (let i = 0; i < target; i++) {
            if (!completedSteps.has(i)) return false;
        }
        return true;
    }

    function handleItemClick(item: (typeof plan.sidebarItems)[number]) {
        if (!canNavigateTo(item)) return;
        setStep(resolveTargetStep(item));
    }

    return (
        <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-sidebar text-sidebar-foreground p-6 gap-6 min-h-full">
            {nome && (
                <div>
                    <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest mb-0.5">Candidato</div>
                    <div className="font-semibold text-sm truncate">{nome}</div>
                </div>
            )}

            <div className="flex flex-col items-center gap-2">
                <div className="relative size-24">
                    <svg className="size-24 -rotate-90" viewBox="0 0 96 96">
                        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
                        <circle
                            cx="48" cy="48" r={radius} fill="none"
                            stroke="rgba(255,255,255,0.9)" strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circ}
                            strokeDashoffset={circ * (1 - pct / 100)}
                            className="transition-all duration-700"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-black leading-none text-white">{pct}%</span>
                        <span className="text-[9px] text-sidebar-foreground/50 uppercase tracking-wider mt-0.5">completo</span>
                    </div>
                </div>
                <p className="text-xs text-center text-sidebar-foreground/60 italic px-2">{motivationalMessage(pct)}</p>
            </div>

            <div className="h-px bg-sidebar-border" />

            <nav className="space-y-0.5 flex-1">
                {plan.sidebarItems.map((item) => {
                    const isDone = isItemDone(item);
                    const isActive = isItemActive(item);
                    const clickable = canNavigateTo(item);
                    const Icon = groupIcon(item);
                    const label = item.isDocumentGroup && plan.documentSteps.length > 0
                        ? `${item.label} · ${docProgress}/${plan.documentSteps.length}`
                        : item.label;

                    return (
                        <button
                            key={item.step}
                            type="button"
                            onClick={() => handleItemClick(item)}
                            disabled={!clickable}
                            aria-current={isActive ? "step" : undefined}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-left transition-colors ${
                                isActive
                                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                    : isDone
                                      ? "text-emerald-300"
                                      : "text-sidebar-foreground/50"
                            } ${
                                clickable
                                    ? "cursor-pointer hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                                    : "cursor-default"
                            }`}
                        >
                            <div
                                className={`flex size-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                                    isActive ? "bg-white/20 text-white"
                                    : isDone ? "bg-emerald-500 text-white"
                                    : "bg-white/10 text-sidebar-foreground/40"
                                }`}
                            >
                                {isDone ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                            </div>
                            <span className="truncate text-xs leading-snug">{label}</span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
}
