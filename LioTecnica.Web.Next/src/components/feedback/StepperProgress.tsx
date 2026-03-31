"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface StepperStep {
  label: string;
  icon?: LucideIcon;
  status: "done" | "current" | "pending";
}

export default function StepperProgress({
  steps,
  orientation = "horizontal",
  className,
}: {
  steps: StepperStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  if (orientation === "vertical") {
    return (
      <div className={cn("space-y-0", className)}>
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                    step.status === "done" && "border-emerald-500 bg-emerald-500 text-white",
                    step.status === "current" && "border-primary bg-primary text-white",
                    step.status === "pending" && "border-muted-foreground/30 bg-muted/50 text-muted-foreground/50",
                  )}
                >
                  {step.status === "done" ? (
                    <CheckCircle2 className="size-4" />
                  ) : Icon ? (
                    <Icon className="size-3.5" />
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[24px]",
                      step.status === "done" ? "bg-emerald-400" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="pb-6 pt-0.5">
                <span
                  className={cn(
                    "text-sm font-medium",
                    step.status === "done" && "text-emerald-700",
                    step.status === "current" && "text-foreground font-semibold",
                    step.status === "pending" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal layout
  return (
    <div className={cn("flex items-center gap-0", className)}>
      {steps.map((step, i) => {
        const Icon = step.icon;
        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                  step.status === "done" && "border-emerald-500 bg-emerald-500 text-white",
                  step.status === "current" && "border-primary bg-primary text-white",
                  step.status === "pending" && "border-muted-foreground/30 bg-muted/50 text-muted-foreground/50",
                )}
              >
                {step.status === "done" ? (
                  <CheckCircle2 className="size-4" />
                ) : Icon ? (
                  <Icon className="size-3.5" />
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center max-w-[72px] leading-tight",
                  step.status === "done" && "text-emerald-700",
                  step.status === "current" && "text-foreground font-semibold",
                  step.status === "pending" && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-12 mx-1 mt-[-16px]",
                  step.status === "done" ? "bg-emerald-400" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
