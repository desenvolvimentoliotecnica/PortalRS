"use client";

import { ListChecks } from "lucide-react";

export default function MeusPlanosScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div>
                <h4 className="text-lg font-bold">Meus planos de desenvolvimento</h4>
                <div className="text-muted-foreground text-sm">
                    Planos onde você é gestor ou colaborador.
                </div>
            </div>

            {/* Lista de planos */}
            <div className="card-soft p-3">
                <div className="text-muted-foreground text-center py-8">
                    <ListChecks className="size-8 mx-auto mb-2 opacity-30" />
                    Nenhum plano encontrado.
                </div>
            </div>
        </section>
    );
}
