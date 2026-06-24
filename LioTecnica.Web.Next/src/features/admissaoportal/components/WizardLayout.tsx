"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Cloud } from "lucide-react";
import WizardStepper from "./WizardStepper";
import { useAdmissaoWizardStore, TOTAL_STEPS, STEP_LABELS } from "../useAdmissaoWizardStore";

interface Props {
    children: React.ReactNode;
    /** Retorne false (ou Promise<false>) para impedir avanço de etapa. */
    onNext?: () => boolean | void | Promise<boolean | void>;
    onBack?: () => void;
    nextLabel?: string;
    nextDisabled?: boolean;
    hideNext?: boolean;
    hideBack?: boolean;
    hideStepHeader?: boolean;
}

export default function WizardLayout({ children, onNext, onBack, nextLabel, nextDisabled, hideNext, hideBack, hideStepHeader }: Props) {
    const { currentStep, completedSteps, isAutoSaving, lastSavedAt, setStep, markStepComplete } = useAdmissaoWizardStore();
    const [advancing, setAdvancing] = useState(false);

    async function handleNext() {
        if (advancing) return;
        setAdvancing(true);
        try {
            if (onNext) {
                const canAdvance = await onNext();
                if (canAdvance === false) return;
            }
            markStepComplete(currentStep);
            if (currentStep < TOTAL_STEPS - 1) setStep(currentStep + 1);
        } finally {
            setAdvancing(false);
        }
    }

    function handleBack() {
        if (onBack) onBack();
        if (currentStep > 0) setStep(currentStep - 1);
    }

    return (
        <div className="space-y-4">
            {/* Mobile-only stepper (hidden on lg+, sidebar takes over) */}
            <div className="lg:hidden">
                <WizardStepper currentStep={currentStep} completedSteps={completedSteps} />
            </div>

            {/* Step label + auto-save indicator */}
            {!hideStepHeader && (
            <div className="flex items-center justify-between px-1">
                <h2 className="text-base sm:text-lg font-semibold">
                    {STEP_LABELS[currentStep]}
                </h2>
                {isAutoSaving && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Salvando...
                    </span>
                )}
                {!isAutoSaving && lastSavedAt && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Cloud className="size-3" /> Salvo
                    </span>
                )}
            </div>
            )}

            {/* Content */}
            <div className="min-h-[300px]">{children}</div>

            {/* Navigation */}
            <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-t border-border/40 lg:static lg:bg-transparent lg:backdrop-blur-none lg:pt-4 lg:px-0 lg:py-0 lg:border-t">
                {!hideBack && currentStep > 0 ? (
                    <Button variant="ghost" size="lg" onClick={handleBack} className="gap-1">
                        <ChevronLeft className="size-4" /> Voltar
                    </Button>
                ) : (
                    <div />
                )}
                {!hideNext && (
                    <Button size="lg" onClick={handleNext} disabled={nextDisabled || advancing} className="gap-1 min-w-[140px]">
                        {advancing ? <Loader2 className="size-4 animate-spin" /> : null}
                        {nextLabel || "Próximo"} {!advancing && <ChevronRight className="size-4" />}
                    </Button>
                )}
            </div>
        </div>
    );
}
