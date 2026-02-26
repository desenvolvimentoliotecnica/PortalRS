"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCcw } from "lucide-react";

export default function GamificacaoHistoricoScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link className="btn-ghost" href="/app/feedback/gamificacao">
                        <ArrowLeft className="size-4" />
                        <span className="ml-1">Voltar</span>
                    </Link>
                    <h4 className="text-lg font-bold m-0">Histórico de ranking</h4>
                </div>
                <button className="btn-ghost" type="button" disabled>
                    <RefreshCcw className="size-4" />
                    <span className="ml-1">Atualizar</span>
                </button>
            </div>

            {/* Grid (vazia) */}
            <div className="card-soft p-3">
                <div className="text-muted-foreground text-center py-8">
                    Nenhum histórico disponível.
                </div>
            </div>
        </section>
    );
}
