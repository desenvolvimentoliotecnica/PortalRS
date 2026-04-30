"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import SolicitacaoForm, { type SolicitacaoDraft } from "@/features/gestao/solicitacoes/SolicitacaoForm";
import { Button } from "@/components/ui/button";

function GestaoNovaSolicitacaoPageInner() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const copyFrom = searchParams.get("copyFrom");

    const [initialData, setInitialData] = useState<Partial<SolicitacaoDraft> | null>(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem("renderrh.solicitacao.initial");
            if (raw) {
                setInitialData(JSON.parse(raw) as Partial<SolicitacaoDraft>);
                sessionStorage.removeItem("renderrh.solicitacao.initial");
            }
        } catch {
            sessionStorage.removeItem("renderrh.solicitacao.initial");
        }
        setReady(true);
    }, []);

    function goBack() {
        router.push("/gestao/solicitacoes");
    }

    return (
        <section className="flex min-h-[70vh] flex-col gap-4">
            <header className="flex items-center gap-3 border-b border-border/60 pb-3">
                <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={goBack}>
                    <ArrowLeft className="size-4" />
                    Voltar
                </Button>
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">Nova requisição de pessoal</h1>
                    <p className="text-muted-foreground text-sm">Formulário em tela cheia (mobile)</p>
                </div>
            </header>
            {ready ? (
                <div className="flex-1 min-h-0">
                    <SolicitacaoForm
                        active
                        editId={null}
                        copySourceId={copyFrom}
                        initialData={initialData}
                        onCancel={goBack}
                        onSuccess={goBack}
                    />
                </div>
            ) : (
                <div className="text-muted-foreground text-sm">Carregando…</div>
            )}
        </section>
    );
}

export default function GestaoNovaSolicitacaoPage() {
    return (
        <Suspense fallback={<div className="text-muted-foreground text-sm p-6">Carregando…</div>}>
            <GestaoNovaSolicitacaoPageInner />
        </Suspense>
    );
}
