"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import WizardStepper from "./WizardStepper";
import { useAdmissaoWizardStore } from "../useAdmissaoWizardStore";
import type { WizardPlan } from "../wizardSteps";

interface Props {
    children: React.ReactNode;
    plan: WizardPlan;
    onNext?: () => boolean | void | Promise<boolean | void>;
    onBack?: () => void;
    onSaveAndExit?: () => void | Promise<void>;
    nextLabel?: string;
    backLabel?: string;
    nextDisabled?: boolean;
    hideNext?: boolean;
    hideBack?: boolean;
    hideFooter?: boolean;
    showStepper?: boolean;
    isSubmitted?: boolean;
    nextClassName?: string;
    contentScrollable?: boolean;
}

export default function WizardLayout({
    children,
    plan,
    onNext,
    onBack,
    onSaveAndExit,
    nextLabel,
    backLabel = "Voltar",
    nextDisabled,
    hideNext,
    hideBack,
    hideFooter,
    showStepper = true,
    isSubmitted,
    nextClassName,
    contentScrollable = true,
}: Props) {
    const { currentStep, completedSteps, markStepComplete, setStep } = useAdmissaoWizardStore();
    const [advancing, setAdvancing] = useState(false);
    const [savingExit, setSavingExit] = useState(false);

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

    async function handleSaveAndExit() {
        if (!onSaveAndExit || savingExit) return;
        setSavingExit(true);
        try {
            await onSaveAndExit();
        } finally {
            setSavingExit(false);
        }
    }

    const showBack = !hideBack && currentStep > 1;
    const showNext = !hideNext;
    const showSaveExit = !!onSaveAndExit && currentStep >= 1 && currentStep <= 5;
    const showFooter = !hideFooter && (showBack || showNext || showSaveExit);

    return (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {showStepper && (
                <div className="shrink-0 border-b border-slate-100 bg-white px-4">
                    <WizardStepper
                        currentStep={currentStep}
                        completedSteps={completedSteps}
                        isSubmitted={isSubmitted}
                    />
                </div>
            )}

            <div
                className={`min-h-0 flex-1 ${contentScrollable ? "overflow-y-auto overscroll-contain" : "overflow-hidden flex flex-col"}`}
            >
                {children}
            </div>

            {showFooter && (
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 sm:px-8">
                    <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
                        {showBack ? (
                            <Button variant="outline" size="lg" onClick={handleBack} className="gap-1 rounded-xl">
                                <ChevronLeft className="size-4" /> {backLabel}
                            </Button>
                        ) : (
                            <div />
                        )}
                        <div className="flex items-center gap-3">
                            {showSaveExit && (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    onClick={handleSaveAndExit}
                                    disabled={savingExit}
                                    className="rounded-xl"
                                >
                                    {savingExit ? <Loader2 className="size-4 animate-spin" /> : null}
                                    Salvar e sair
                                </Button>
                            )}
                            {showNext && (
                                <Button
                                    size="lg"
                                    onClick={handleNext}
                                    disabled={nextDisabled || advancing}
                                    className={cn(
                                        "min-w-[160px] gap-1 rounded-xl bg-[#0047BB] hover:bg-[#003a99]",
                                        nextClassName,
                                    )}
                                >
                                    {advancing ? <Loader2 className="size-5 animate-spin" /> : null}
                                    {nextLabel || "Continuar"}
                                    {!advancing && <ChevronRight className="size-5" />}
                                </Button>
                            )}
                        </div>
                    </div>
                    <p className="mx-auto mt-4 flex max-w-5xl items-center justify-center gap-2 text-center text-xs text-slate-400">
                        <Lock className="size-3.5 shrink-0" />
                        Seus dados estão seguros conosco. Utilizamos criptografia para proteger suas informações.
                    </p>
                </div>
            )}
        </div>
    );
}
