"use client";

import { Check } from "lucide-react";
import type { WizardPlan } from "../wizardSteps";

interface Props {
    currentStep: number;
    completedSteps: Set<number>;
    plan: WizardPlan;
}

export default function WizardStepper({ currentStep, completedSteps, plan }: Props) {
    const { sidebarItems, documentSteps, docsStartStep, dadosStep } = plan;

    const docProgress =
        currentStep >= docsStartStep && currentStep < dadosStep
            ? currentStep - docsStartStep + 1
            : completedSteps.size > docsStartStep
              ? documentSteps.length
              : 0;

    return (
        <div className="flex items-center justify-between gap-1 px-2 py-2 overflow-x-auto">
            {sidebarItems.map((item) => {
                const isDocumentGroup = item.isDocumentGroup === true;
                const endStep = item.documentEndStep ?? item.step;
                const isActive = isDocumentGroup
                    ? currentStep >= item.step && currentStep <= endStep
                    : currentStep === item.step;
                const isDone = isDocumentGroup
                    ? currentStep > endStep || completedSteps.has(endStep)
                    : completedSteps.has(item.step) || currentStep > item.step;

                const label = isDocumentGroup && documentSteps.length > 0
                    ? `Docs ${docProgress}/${documentSteps.length}`
                    : item.label.split(" ")[0];

                return (
                    <div key={item.step} className="flex flex-col items-center gap-1 min-w-0 flex-1">
                        <div
                            className={`flex items-center justify-center size-7 rounded-full text-[10px] font-bold transition-all ${
                                isDone
                                    ? "bg-emerald-500 text-white"
                                    : isActive
                                      ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                      : "bg-muted text-muted-foreground"
                            }`}
                        >
                            {isDone ? <Check className="size-3.5" /> : item.step + 1}
                        </div>
                        <span
                            className={`text-[9px] text-center leading-tight truncate max-w-[56px] ${
                                isActive ? "text-primary font-semibold" : "text-muted-foreground"
                            }`}
                        >
                            {label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
