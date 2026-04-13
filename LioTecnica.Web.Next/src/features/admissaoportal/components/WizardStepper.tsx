"use client";

import { STEP_LABELS, TOTAL_STEPS } from "../useAdmissaoWizardStore";
import { Check } from "lucide-react";

interface Props {
    currentStep: number;
    completedSteps: Set<number>;
}

export default function WizardStepper({ currentStep, completedSteps }: Props) {
    return (
        <div className="flex items-center justify-between gap-1 px-2 py-3 overflow-x-auto">
            {STEP_LABELS.map((label, i) => {
                const isActive = i === currentStep;
                const isDone = completedSteps.has(i);
                return (
                    <div key={i} className="flex flex-col items-center gap-1 min-w-0 flex-1">
                        <div
                            className={`flex items-center justify-center size-8 rounded-full text-xs font-bold transition-all ${
                                isDone
                                    ? "bg-emerald-500 text-white"
                                    : isActive
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                      : "bg-muted text-muted-foreground"
                            }`}
                        >
                            {isDone ? <Check className="size-4" /> : i + 1}
                        </div>
                        <span
                            className={`text-[10px] text-center leading-tight truncate max-w-[64px] ${
                                isActive ? "text-primary font-semibold" : "text-muted-foreground"
                            }`}
                        >
                            {label}
                        </span>
                        {i < TOTAL_STEPS - 1 && (
                            <div className="hidden" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
