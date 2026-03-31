"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const VARIANTS = {
  success: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/8",
    icon: <CheckCircle2 className="size-5 text-emerald-600" />,
  },
  info: {
    border: "border-l-blue-500",
    bg: "bg-blue-500/8",
    icon: <Info className="size-5 text-blue-600" />,
  },
  warning: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/8",
    icon: <AlertTriangle className="size-5 text-amber-600" />,
  },
} as const;

export type NextStepVariant = keyof typeof VARIANTS;

export interface NextStepAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export default function NextStepBanner({
  title,
  description,
  variant = "info",
  icon,
  actions,
  onDismiss,
  className,
}: {
  title: string;
  description?: string;
  variant?: NextStepVariant;
  icon?: ReactNode;
  actions?: NextStepAction[];
  onDismiss?: () => void;
  className?: string;
}) {
  const v = VARIANTS[variant];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border/40 border-l-4 p-4",
        v.border,
        v.bg,
        className,
      )}
    >
      <div className="mt-0.5 shrink-0">{icon ?? v.icon}</div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}

        {actions && actions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {actions.map((action, i) =>
              action.href ? (
                <Button key={i} size="sm" variant={i === 0 ? "default" : "outline"} asChild>
                  <Link href={action.href}>
                    {action.label}
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button key={i} size="sm" variant={i === 0 ? "default" : "outline"} onClick={action.onClick}>
                  {action.label}
                  <ArrowRight className="ml-1.5 size-3.5" />
                </Button>
              ),
            )}
          </div>
        )}
      </div>

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Fechar"
        >
          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
