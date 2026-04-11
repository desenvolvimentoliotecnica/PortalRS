"use client";

import React from "react";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ─────────────────────────── types ─────────────────────────── */

export interface AprovacaoStep {
    label: string;
    nome: string | null;
    /** null = aguardando, 1 = aprovado, 2 = reprovado */
    status: number | null;
    habilitado: boolean;
    date?: string | null;
}

interface Props {
    open: boolean;
    loading?: boolean;
    steps: AprovacaoStep[];
    onClose: () => void;
}

/* ─────────────────────────── helpers ─────────────────────────── */

function formatDate(iso: string | null | undefined) {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    } catch {
        return null;
    }
}

function StepIcon({ status }: { status: number | null }) {
    if (status === 1) return <CheckCircle2 className="size-5 text-emerald-600" />;
    if (status === 2) return <XCircle className="size-5 text-red-600" />;
    return <Clock className="size-5 text-amber-500" />;
}

function stepColors(status: number | null) {
    if (status === 1) return { ring: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30", line: "bg-emerald-200 dark:bg-emerald-800", text: "text-emerald-700 dark:text-emerald-400" };
    if (status === 2) return { ring: "border-red-400 bg-red-50 dark:bg-red-950/30", line: "bg-red-200 dark:bg-red-800", text: "text-red-700 dark:text-red-400" };
    return { ring: "border-amber-400 bg-amber-50 dark:bg-amber-950/30", line: "bg-amber-200 dark:bg-amber-800", text: "text-amber-700 dark:text-amber-400" };
}

function statusLabel(status: number | null) {
    if (status === 1) return "Aprovado";
    if (status === 2) return "Reprovado";
    return "Aguardando";
}

/* ─────────────────────────── component ─────────────────────────── */

export default function AcompanhamentoModal({ open, loading, steps, onClose }: Props) {
    const visibleSteps = steps.filter((s) => s.habilitado);

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle>Acompanhamento de Aprovação</DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-10">
                        <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : visibleSteps.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        Nenhuma etapa disponível.
                    </div>
                ) : (
                    <ol className="relative mt-2 space-y-0">
                        {visibleSteps.map((step, idx) => {
                            const colors = stepColors(step.status);
                            const isLast = idx === visibleSteps.length - 1;
                            const date = formatDate(step.date);

                            return (
                                <li key={idx} className="flex gap-3">
                                    {/* Left column: icon + vertical line */}
                                    <div className="flex flex-col items-center">
                                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${colors.ring}`}>
                                            <StepIcon status={step.status} />
                                        </div>
                                        {!isLast && (
                                            <div className={`w-0.5 flex-1 my-1 min-h-[1.5rem] ${colors.line}`} />
                                        )}
                                    </div>

                                    {/* Right column: content */}
                                    <div className={`pb-4 ${isLast ? "pb-2" : ""}`}>
                                        <div className="text-sm font-semibold leading-tight">{step.label}</div>
                                        {step.nome && (
                                            <div className="mt-0.5 text-xs text-muted-foreground">{step.nome}</div>
                                        )}
                                        <div className={`mt-0.5 text-xs font-medium ${colors.text}`}>
                                            {statusLabel(step.status)}
                                            {date && (
                                                <span className="ml-1.5 text-muted-foreground font-normal">· {date}</span>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            );
                        })}
                    </ol>
                )}

                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
