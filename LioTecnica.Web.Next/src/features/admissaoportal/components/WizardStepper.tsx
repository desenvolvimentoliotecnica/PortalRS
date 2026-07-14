"use client";

import { Check } from "lucide-react";
import { MAIN_WIZARD_STEPS } from "../wizardSteps";

interface Props {
    currentStep: number;
    completedSteps: Set<number>;
    isSubmitted?: boolean;
}

export default function WizardStepper({ currentStep, completedSteps, isSubmitted }: Props) {
    return (
        <div className="flex items-center justify-between gap-1 px-2 py-4 overflow-x-auto">
            {MAIN_WIZARD_STEPS.map((item, index) => {
                const done = isSubmitted || completedSteps.has(item.step) || currentStep > item.step;
                const active = !isSubmitted && currentStep === item.step;
                const isLast = index === MAIN_WIZARD_STEPS.length - 1;

                return (
                    <div key={item.step} className="flex min-w-0 flex-1 items-center">
                        <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                            <div
                                className={`flex size-8 items-center justify-center rounded-full text-xs font-bold transition-all ${
                                    done
                                        ? "bg-emerald-500 text-white"
                                        : active
                                          ? "bg-[#0047BB] text-white ring-4 ring-[#0047BB]/20"
                                          : "bg-slate-200 text-slate-500"
                                }`}
                            >
                                {done && !active ? <Check className="size-4" /> : item.step}
                            </div>
                            <span
                                className={`max-w-[4.75rem] truncate text-center text-[10px] leading-tight sm:max-w-none sm:whitespace-normal sm:text-xs ${
                                    active ? "font-semibold text-[#0047BB]" : done ? "text-emerald-600" : "text-slate-500"
                                }`}
                            >
                                {item.label}
                            </span>
                        </div>
                        {!isLast && (
                            <div
                                className={`mx-1 mb-5 h-0.5 min-w-[12px] flex-1 ${
                                    done ? "bg-emerald-400" : "bg-slate-200"
                                }`}
                            />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
