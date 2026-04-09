"use client";

import React, { useState } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Loader2,
} from "lucide-react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";

/* ── types ── */

interface IntegracaoTotvsListItem {
    id: string;
    tipoIntegracao: number;
    tipoIntegracaoLabel: string;
    nome: string;
    cpf: string | null;
    descricao: string;
    approvedAtUtc: string | null;
    integracaoResultado: number | null;
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
}

interface IntegracaoDetalhesDrawerProps {
    item: IntegracaoTotvsListItem | null;
    open: boolean;
    onClose: () => void;
    onRetrySuccess: () => void;
}

const TIPO_COLORS: Record<number, string> = {
    1: "bg-blue-100 text-blue-800",
    2: "bg-purple-100 text-purple-800",
    3: "bg-red-100 text-red-800",
    4: "bg-emerald-100 text-emerald-800",
    5: "bg-cyan-100 text-cyan-800",
    6: "bg-orange-100 text-orange-800",
    7: "bg-pink-100 text-pink-800",
    8: "bg-amber-100 text-amber-800",
};

/* ── component ── */

export default function IntegracaoDetalhesDrawer({
    item,
    open,
    onClose,
    onRetrySuccess,
}: IntegracaoDetalhesDrawerProps) {
    const [retrying, setRetrying] = useState(false);
    const [retryError, setRetryError] = useState<string | null>(null);

    const handleRetry = async () => {
        if (!item) return;
        setRetrying(true);
        setRetryError(null);
        try {
            const res = await apiFetch(
                `/api/integracao-totvs/${item.tipoIntegracao}/${item.id}/retry`,
                { method: "POST" }
            );
            if (!res.ok) {
                const body = await res.text();
                throw new Error(body || `Erro HTTP ${res.status}`);
            }
            onRetrySuccess();
        } catch (e) {
            setRetryError(e instanceof Error ? e.message : "Erro ao reenviar.");
        } finally {
            setRetrying(false);
        }
    };

    if (!item) return null;

    const resultado = item.integracaoResultado;

    return (
        <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>Detalhes da Integracao</SheetTitle>
                    <SheetDescription>
                        Informacoes sobre a integracao TOTVS desta solicitacao.
                    </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 p-4 pt-2">
                    {/* Tipo badge */}
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Tipo</p>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${TIPO_COLORS[item.tipoIntegracao] ?? "bg-gray-100 text-gray-800"}`}>
                            {item.tipoIntegracaoLabel}
                        </span>
                    </div>

                    {/* Nome */}
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Nome</p>
                        <p className="text-sm font-semibold">{item.nome}</p>
                    </div>

                    {/* CPF */}
                    {item.cpf && (
                        <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1">CPF</p>
                            <p className="text-sm font-mono">{item.cpf}</p>
                        </div>
                    )}

                    {/* Descricao */}
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Descricao</p>
                        <p className="text-sm">{item.descricao}</p>
                    </div>

                    {/* Resultado */}
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Resultado</p>
                        {resultado === 1 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-500/15 text-emerald-700">
                                <CheckCircle2 className="size-3" /> Sucesso
                            </span>
                        ) : resultado === 2 ? (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-700">
                                <XCircle className="size-3" /> Falha
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-amber-500/15 text-amber-700">
                                <Clock className="size-3" /> Pendente
                            </span>
                        )}
                    </div>

                    {/* Mensagem */}
                    {item.integracaoMensagem && (
                        <div>
                            <p className="text-xs text-muted-foreground font-medium mb-1">Mensagem da Integracao</p>
                            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap break-words">
                                {item.integracaoMensagem}
                            </div>
                        </div>
                    )}

                    {/* Aprovada em */}
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Aprovada em</p>
                        <p className="text-sm">
                            {item.approvedAtUtc
                                ? new Date(item.approvedAtUtc).toLocaleString("pt-BR")
                                : "\u2014"}
                        </p>
                    </div>

                    {/* Integrada em */}
                    <div>
                        <p className="text-xs text-muted-foreground font-medium mb-1">Integrada em</p>
                        <p className="text-sm">
                            {item.integradaEmUtc
                                ? new Date(item.integradaEmUtc).toLocaleString("pt-BR")
                                : "\u2014"}
                        </p>
                    </div>

                    {/* Retry button — shown when status is Falha or Sucesso (to allow re-send) */}
                    {resultado !== null && (
                        <div className="pt-2 border-t border-border">
                            <button
                                onClick={handleRetry}
                                disabled={retrying}
                                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {retrying ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="size-4" />
                                )}
                                Reenviar
                            </button>
                            {retryError && (
                                <p className="text-xs text-red-600 mt-2">{retryError}</p>
                            )}
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
