"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";
import WizardStepper from "./WizardStepper";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import type { WizardPlan } from "../wizardSteps";

interface Props {
    children: React.ReactNode;
    plan: WizardPlan;
    /** Retorne false (ou Promise<false>) para impedir avanço de etapa. */
    onNext?: () => boolean | void | Promise<boolean | void>;
    onBack?: () => void;
    nextLabel?: string;
    backLabel?: string;
    nextDisabled?: boolean;
    hideNext?: boolean;
    hideBack?: boolean;
    hideStepHeader?: boolean;
    /** Etapas com formulário longo podem rolar só a área central. */
    contentScrollable?: boolean;
    /** Classe extra no botão principal (ex.: verde no envio final). */
    nextClassName?: string;
}

export default function WizardLayout({
    children,
    plan,
    onNext,
    onBack,
    nextLabel,
    backLabel = "Voltar",
    nextDisabled,
    hideNext,
    hideBack,
    hideStepHeader,
    contentScrollable = false,
    nextClassName,
}: Props) {
    const { currentStep, completedSteps, isAutoSaving, lastSavedAt, setStep, markStepComplete } = useAdmissaoWizardStore();
    const [advancing, setAdvancing] = useState(false);
    const stepTitle = plan.stepLabel(currentStep);

    async function handleNext() {
        if (advancing) return;
        setAdvancing(true);
        try {
            if (onNext) {
                const canAdvance = await onNext();
                if (canAdvance === false) return;
            }
            markStepComplete(currentStep);
            if (currentStep < plan.totalSteps - 1) setStep(currentStep + 1);
        } finally {
            setAdvancing(false);
        }
    }

    function handleBack() {
        if (onBack) onBack();
        if (currentStep > 0) setStep(currentStep - 1);
    }

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Mobile-only stepper (hidden on lg+, sidebar takes over) */}
            <div className="lg:hidden shrink-0">
                <WizardStepper
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                    plan={plan}
                />
            </div>

            {/* Step label + auto-save indicator */}
            {!hideStepHeader && (
                <div className="flex items-center justify-between px-1 shrink-0 pb-2">
                    <h2 className="text-base sm:text-lg font-semibold truncate">
                        {stepTitle}
                    </h2>
                    {isAutoSaving && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Loader2 className="size-3 animate-spin" /> Salvando...
                        </span>
                    )}
                    {!isAutoSaving && lastSavedAt && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                            <Cloud className="size-3" /> Salvo
                        </span>
                    )}
                </div>
            )}

            {/* Content — sem scroll nas etapas de boas-vindas e documentos */}
            <div
                className={`flex-1 min-h-0 flex ${
                    contentScrollable
                        ? "overflow-y-auto overscroll-contain pr-1 -mr-1"
                        : "overflow-hidden"
                }`}
            >
                {children}
            </div>

            {/* Rodapé fixo — Voltar / Continuar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-background/95 backdrop-blur-sm border-t border-border/40 lg:left-64">
                {!hideBack && currentStep > 0 ? (
                    <Button variant="ghost" size="lg" onClick={handleBack} className="gap-1">
                        <ChevronLeft className="size-4" /> {backLabel}
                    </Button>
                ) : (
                    <div />
                )}
                {!hideNext && (
                    <Button
                        size="lg"
                        onClick={handleNext}
                        disabled={nextDisabled || advancing}
                        className={cn("gap-1 min-w-[180px] ml-auto min-h-[52px] text-base", nextClassName)}
                    >
                        {advancing ? <Loader2 className="size-5 animate-spin" /> : null}
                        {nextLabel || "Continuar"} {!advancing && <ChevronRight className="size-5" />}
                    </Button>
                )}
            </div>
        </div>
    );
}
