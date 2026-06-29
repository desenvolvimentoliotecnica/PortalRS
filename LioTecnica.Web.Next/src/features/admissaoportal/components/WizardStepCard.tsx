"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    children: React.ReactNode;
    className?: string;
    footer?: React.ReactNode;
    /** Centraliza o card verticalmente na área disponível (conforme mockup). */
    centerVertically?: boolean;
}

/** Card branco das etapas do wizard — layout conforme mockup. */
export default function WizardStepCard({
    icon: Icon,
    title,
    subtitle,
    children,
    className,
    footer,
    centerVertically = true,
}: Props) {
    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#f4f7fb]">
            <div
                className={cn(
                    "flex flex-1 min-h-0 flex-col overflow-y-auto px-4 py-5 sm:px-6 lg:px-8",
                    centerVertically && "justify-center",
                )}
            >
                <div
                    className={cn(
                        "mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white shadow-[0_2px_16px_rgba(15,23,42,0.06)]",
                        centerVertically && "my-auto",
                        className,
                    )}
                >
                    <div className="border-b border-slate-100 px-6 py-5 sm:px-8">
                        <div className="flex items-start gap-4">
                            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#eff6ff]">
                                <Icon className="size-6 text-[#0047BB]" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h2>
                                <p className="mt-1 text-sm text-slate-500 sm:text-base">{subtitle}</p>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-6 sm:px-8">{children}</div>

                    {footer && (
                        <div className="border-t border-slate-100 px-6 py-4 sm:px-8">{footer}</div>
                    )}
                </div>
            </div>
        </div>
    );
}
