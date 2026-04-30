"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import SolicitacaoForm from "@/features/gestao/solicitacoes/SolicitacaoForm";
import { Button } from "@/components/ui/button";

function GestaoEditarSolicitacaoPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get("id");
    const resubmitAfterSave = searchParams.get("resubmit") === "1";

    function goBack() {
        router.push("/gestao/solicitacoes");
    }

    if (!editId) {
        return (
            <div className="text-muted-foreground text-sm py-8">Parâmetro <code className="font-mono">id</code> é obrigatório.</div>
        );
    }

    return (
        <section className="flex min-h-[70vh] flex-col gap-4">
            <header className="flex items-center gap-3 border-b border-border/60 pb-3">
                <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={goBack}>
                    <ArrowLeft className="size-4" />
                    Voltar
                </Button>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Editar requisição</h1>
                    <p className="text-muted-foreground text-xs font-mono mt-0.5">{editId}</p>
                </div>
            </header>
            <div className="flex-1 min-h-0">
                <SolicitacaoForm
                    active
                    editId={editId}
                    resubmitAfterSave={resubmitAfterSave}
                    onCancel={goBack}
                    onSuccess={goBack}
                />
            </div>
        </section>
    );
}

export default function GestaoEditarSolicitacaoPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground text-sm p-6">Carregando…</div>}>
            <GestaoEditarSolicitacaoPageInner />
        </Suspense>
    );
}
