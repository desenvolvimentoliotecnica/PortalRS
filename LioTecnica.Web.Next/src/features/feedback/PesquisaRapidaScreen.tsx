"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";

export default function PesquisaRapidaScreen() {
    return (
        <section className="space-y-4">
            <div>
                <h4 className="text-lg font-bold">Pesquisa Rápida</h4>
                <div className="text-muted-foreground text-sm">Envie pesquisas de clima e satisfação para a equipe.</div>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
                <MessageSquare className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <div className="text-lg font-semibold text-muted-foreground">Em desenvolvimento</div>
                <div className="text-sm text-muted-foreground/70 mt-1">
                    A funcionalidade de Pesquisa Rápida será implementada em breve.
                </div>
            </div>
        </section>
    );
}
