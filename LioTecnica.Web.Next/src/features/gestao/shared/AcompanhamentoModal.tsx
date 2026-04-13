"use client";

import React from "react";
import { Clock, CheckCircle2, XCircle, Ban, AlertTriangle, GitBranch } from "lucide-react";
import {
    Dialog,
    DialogContent,
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
    observacao?: string | null;
    /** Warning shown below the step — e.g. consenso reason like "aprovador sem conta de acesso" */
    aviso?: string | null;
}

// Cancelled status values: SolicitacaoVagaStatus.Cancelada=6, SolicitacaoStatus.Cancelada=5
const CANCELLED_STATUSES = new Set([5, 6, "cancelada", "Cancelada"]);

interface Props {
    open: boolean;
    loading?: boolean;
    steps: AprovacaoStep[];
    /** Status da solicitação pai (number ou string do enum). Se cancelada, mostra banner. */
    solicitacaoStatus?: number | string | null;
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
    if (status === 3) return <Ban className="size-5 text-zinc-400" />;
    return <Clock className="size-5 text-amber-500" />;
}

function stepColors(status: number | null) {
    if (status === 1) return { ring: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30", line: "bg-emerald-300 dark:bg-emerald-800", text: "text-emerald-700 dark:text-emerald-400" };
    if (status === 2) return { ring: "border-red-400 bg-red-50 dark:bg-red-950/30", line: "bg-red-200 dark:bg-red-800", text: "text-red-700 dark:text-red-400" };
    if (status === 3) return { ring: "border-zinc-300 bg-zinc-50 dark:bg-zinc-900/30", line: "bg-zinc-200 dark:bg-zinc-700", text: "text-zinc-500 dark:text-zinc-400" };
    return { ring: "border-amber-400 bg-amber-50 dark:bg-amber-950/30", line: "bg-amber-200 dark:bg-amber-800", text: "text-amber-700 dark:text-amber-400" };
}

function statusLabel(status: number | null) {
    if (status === 1) return "Aprovado";
    if (status === 2) return "Reprovado";
    if (status === 3) return "Cancelado";
    return "Aguardando";
}

/* ─────────────────────────── component ─────────────────────────── */

export default function AcompanhamentoModal({ open, loading, steps, solicitacaoStatus, onClose }: Props) {
    const visibleSteps = steps.filter((s) => s.habilitado);
    const isCancelled = solicitacaoStatus != null && CANCELLED_STATUSES.has(
        typeof solicitacaoStatus === "string" ? solicitacaoStatus.toLowerCase() : solicitacaoStatus
    );
    const pendingStep = isCancelled ? undefined : visibleSteps.find((s) => s.status === null);

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="sm:max-w-xl p-0 overflow-hidden gap-0">
                {/* Header */}
                <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border/50">
                    <GitBranch className="size-4 text-muted-foreground flex-shrink-0" />
                    <DialogTitle className="text-base font-semibold">Acompanhamento de Aprovação</DialogTitle>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                    </div>
                ) : visibleSteps.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">
                        Nenhuma etapa disponível.
                    </div>
                ) : (
                    <div className="px-6 py-5 space-y-4 max-h-[68vh] overflow-y-auto">
                        {/* Cancelled banner */}
                        {isCancelled && (
                            <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700 px-4 py-3">
                                <Ban className="size-4 text-red-600 shrink-0" />
                                <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                                    Solicitação Cancelada
                                </span>
                            </div>
                        )}

                        {/* Pending step banner */}
                        {pendingStep && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-4 py-3.5">
                                <div className="flex items-start gap-3">
                                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/50 border border-amber-300">
                                        <Clock className="size-4 text-amber-600" />
                                    </div>
                                    <div className="min-w-0 pt-0.5">
                                        <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 leading-tight">
                                            Aguardando: {pendingStep.label}
                                        </div>
                                        <div className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                            {pendingStep.nome ? (
                                                <span>
                                                    Colaborador: <span className="font-semibold">{pendingStep.nome}</span>
                                                    {pendingStep.aviso && (
                                                        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-200/60 dark:bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900 dark:text-amber-300">
                                                            <AlertTriangle className="size-2.5" />
                                                            Sem usuário
                                                        </span>
                                                    )}
                                                </span>
                                            ) : (
                                                <span className="italic opacity-70">Aprovador não identificado</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Step timeline */}
                        <ol>
                            {visibleSteps.map((step, idx) => {
                                const colors = stepColors(step.status);
                                const isLast = idx === visibleSteps.length - 1;
                                const date = formatDate(step.date);
                                const isCurrentPending = step === pendingStep;

                                return (
                                    <li key={idx} className="flex gap-4">
                                        {/* Left: icon + vertical connector */}
                                        <div className="flex flex-col items-center">
                                            <div className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 ${colors.ring} ${isCurrentPending ? "ring-2 ring-amber-400/40 ring-offset-2" : ""}`}>
                                                <StepIcon status={step.status} />
                                            </div>
                                            {!isLast && (
                                                <div className={`w-px flex-1 my-2 min-h-[2rem] ${colors.line}`} />
                                            )}
                                        </div>

                                        {/* Right: content */}
                                        <div className={`flex-1 min-w-0 pt-1 ${isLast ? "pb-1" : "pb-5"}`}>
                                            {/* Label row + status right-aligned */}
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-sm font-semibold leading-tight">{step.label}</span>
                                                    {isCurrentPending && (
                                                        <span className="inline-flex items-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 border border-amber-300 whitespace-nowrap">
                                                            ATUAL
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`text-xs font-medium flex-shrink-0 ${colors.text}`}>
                                                    {statusLabel(step.status)}
                                                    {date && (
                                                        <span className="ml-1.5 text-muted-foreground font-normal">· {date}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Person/queue name */}
                                            {step.nome && (
                                                <div className="mt-0.5 text-xs text-muted-foreground">{step.nome}</div>
                                            )}

                                            {/* Observation */}
                                            {step.observacao && (
                                                <div className="mt-1.5 rounded-md bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground italic border border-border/40">
                                                    &ldquo;{step.observacao}&rdquo;
                                                </div>
                                            )}

                                            {/* Consenso / warning */}
                                            {step.aviso && (
                                                <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                                                    <AlertTriangle className="size-3 flex-shrink-0 mt-0.5" />
                                                    <span>{step.aviso}</span>
                                                </div>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                        </ol>
                    </div>
                )}

                {/* Footer */}
                <div className="flex justify-end px-6 py-4 border-t border-border/50">
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
