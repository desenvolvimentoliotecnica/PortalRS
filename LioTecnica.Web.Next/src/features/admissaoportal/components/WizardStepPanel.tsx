"use client";

import { cn } from "@/lib/utils";

interface Props {
    children: React.ReactNode;
    className?: string;
    /** Largura máxima do card — documentos com frente/verso precisam de mais espaço */
    wide?: boolean;
}

/** Classes aplicadas aos filhos para escala ~1.5× (tipografia, inputs, ícones). */
export const WIZARD_PANEL_CONTENT_SCALE = [
    "[&_h1]:text-4xl [&_h1]:sm:text-5xl",
    "[&_h2]:text-2xl [&_h2]:sm:text-3xl",
    "[&_h3]:text-xl [&_h3]:sm:text-2xl",
    "[&_label]:text-sm",
    "[&_input]:h-14 [&_input]:text-base",
    "[&_select]:h-14 [&_select]:text-base",
    "[&_textarea]:text-base",
    "[&_.text-xs]:text-sm",
    "[&_.text-sm]:text-base",
    "[&_.text-base]:text-lg",
    "[&_.text-lg]:text-xl",
    "[&_.text-xl]:text-2xl",
    "[&_.text-2xl]:text-3xl",
    "[&_.text-3xl]:text-4xl",
    "[&_.size-4]:size-6",
    "[&_.size-5]:size-7",
    "[&_.size-6]:size-9",
    "[&_.size-7]:size-10",
    "[&_.size-8]:size-12",
    "[&_.size-10]:size-14",
    "[&_.size-14]:size-20",
    "[&_.size-16]:size-24",
    "[&_.wizard-touch-target]:min-h-[72px]",
    "[&_.wizard-touch-target-lg]:min-h-[84px]",
    "[&_.h-11]:h-14",
    "[&_.h-8]:h-12",
    "[&_.h-9]:h-14",
    "[&_.h-10]:h-14",
    "[&_.gap-3]:gap-4",
    "[&_.gap-4]:gap-6",
    "[&_.gap-5]:gap-7",
    "[&_.gap-6]:gap-9",
    "[&_.gap-8]:gap-12",
    "[&_.p-4]:p-6",
    "[&_.p-5]:p-7",
    "[&_.px-4]:px-6",
    "[&_.py-3]:py-4",
].join(" ");

/** Card centralizado (H+V) para etapas do wizard — scroll a partir do topo quando o conteúdo excede a altura disponível. */
export default function WizardStepPanel({ children, className, wide }: Props) {
    return (
        <div className="flex min-h-0 w-full items-start justify-center overflow-y-auto overscroll-contain px-4 pt-6 pb-8 sm:px-8 sm:pt-8">
            <div
                className={cn(
                    "w-full shrink-0 rounded-2xl border border-border/50 bg-card shadow-lg",
                    "px-8 py-10 sm:px-14 sm:py-14",
                    wide ? "max-w-[84rem]" : "max-w-[63rem]",
                    WIZARD_PANEL_CONTENT_SCALE,
                    className,
                )}
            >
                {children}
            </div>
        </div>
    );
}
