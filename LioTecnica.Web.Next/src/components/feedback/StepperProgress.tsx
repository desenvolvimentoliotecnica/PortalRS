"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, SkipForward, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface StepperStep {
  label: string;
  description?: string;
  icon?: LucideIcon;
  status: "done" | "current" | "pending" | "skipped" | "overdue" | "blocked";
  slaInfo?: { daysRemaining: number; totalDays: number };
  onClick?: () => void;
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
          const isClickable = !!step.onClick;
          return (
            <div
              key={i}
              className={cn("flex gap-3", isClickable && "cursor-pointer hover:bg-muted/30 rounded-md -mx-1 px-1")}
              onClick={step.onClick}
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                    step.status === "done" && "border-emerald-500 bg-emerald-500 text-white",
                    step.status === "current" && "border-primary bg-primary text-white",
                    step.status === "pending" && "border-muted-foreground/30 bg-muted/50 text-muted-foreground/50",
                    step.status === "skipped" && "border-slate-400 bg-slate-200 text-slate-500",
                    step.status === "overdue" && "border-red-500 bg-red-500 text-white",
                    step.status === "blocked" && "border-muted-foreground/20 bg-muted/30 text-muted-foreground/30",
                  )}
                >
                  {step.status === "done" ? (
                    <CheckCircle2 className="size-4" />
                  ) : step.status === "skipped" ? (
                    <SkipForward className="size-3.5" />
                  ) : step.status === "overdue" ? (
                    <AlertTriangle className="size-3.5" />
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
                      step.status === "done" ? "bg-emerald-400" : step.status === "overdue" ? "bg-red-300" : "bg-border",
                    )}
                  />
                )}
              </div>
              <div className="pb-6 pt-0.5 flex-1">
                <span
                  className={cn(
                    "text-sm font-medium block",
                    step.status === "done" && "text-emerald-700",
                    step.status === "current" && "text-foreground font-semibold",
                    step.status === "pending" && "text-muted-foreground",
                    step.status === "skipped" && "text-slate-500 line-through",
                    step.status === "overdue" && "text-red-700 font-semibold",
                    step.status === "blocked" && "text-muted-foreground/50",
                  )}
                >
                  {step.label}
                </span>
                {step.description && (
                  <span className="text-xs text-muted-foreground block mt-0.5">{step.description}</span>
                )}
                {step.slaInfo && step.status !== "done" && step.status !== "skipped" && (
                  <span className={cn(
                    "text-xs block mt-0.5",
                    step.slaInfo.daysRemaining <= 0 ? "text-red-600 font-medium" :
                    step.slaInfo.daysRemaining <= 2 ? "text-amber-600" : "text-muted-foreground",
                  )}>
                    {step.slaInfo.daysRemaining <= 0
                      ? `SLA excedido (${Math.abs(step.slaInfo.daysRemaining)}d)`
                      : `${step.slaInfo.daysRemaining}d restantes`}
                  </span>
                )}
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
        const isClickable = !!step.onClick;
        return (
          <div key={i} className={cn("flex items-center", isClickable && "cursor-pointer")} onClick={step.onClick}>
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                  step.status === "done" && "border-emerald-500 bg-emerald-500 text-white",
                  step.status === "current" && "border-primary bg-primary text-white",
                  step.status === "pending" && "border-muted-foreground/30 bg-muted/50 text-muted-foreground/50",
                  step.status === "skipped" && "border-slate-400 bg-slate-200 text-slate-500",
                  step.status === "overdue" && "border-red-500 bg-red-500 text-white",
                  step.status === "blocked" && "border-muted-foreground/20 bg-muted/30 text-muted-foreground/30",
                )}
              >
                {step.status === "done" ? (
                  <CheckCircle2 className="size-4" />
                ) : step.status === "skipped" ? (
                  <SkipForward className="size-3.5" />
                ) : step.status === "overdue" ? (
                  <AlertTriangle className="size-3.5" />
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
                  step.status === "skipped" && "text-slate-500 line-through",
                  step.status === "overdue" && "text-red-700 font-semibold",
                  step.status === "blocked" && "text-muted-foreground/50",
                )}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-12 mx-1 mt-[-16px]",
                  step.status === "done" ? "bg-emerald-400" : step.status === "overdue" ? "bg-red-300" : "bg-border",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
