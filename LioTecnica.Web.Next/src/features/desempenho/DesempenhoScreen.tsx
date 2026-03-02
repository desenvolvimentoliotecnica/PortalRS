"use client";

import { useState } from "react";
import { ClipboardCheck } from "lucide-react";

export default function DesempenhoScreen() {
    return (
        <section className="space-y-4">
            <div>
                <h4 className="text-lg font-bold">Minhas Avaliações</h4>
                <div className="text-muted-foreground text-sm">Acompanhe suas avaliações de desempenho.</div>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
                <ClipboardCheck className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <div className="text-lg font-semibold text-muted-foreground">Minhas Avaliações de Desempenho</div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                    Visualize o histórico e status das suas avaliações de desempenho.
                </div>
                <div className="text-sm text-muted-foreground/50 mt-4">
                    Os dados serão carregados quando a API de avaliações estiver conectada.
                </div>
            </div>
        </section>
    );
}
