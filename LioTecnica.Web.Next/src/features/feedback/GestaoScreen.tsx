"use client";

import { ClipboardList } from "lucide-react";

export default function GestaoScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div>
                <h4 className="text-lg font-bold">Gestão</h4>
                <div className="text-muted-foreground text-sm">
                    Planos de desenvolvimento da sua equipe.
                </div>
            </div>

            {/* Lista de planos */}
            <div className="card-soft p-3">
                <div className="text-muted-foreground text-center py-8">
                    <ClipboardList className="size-8 mx-auto mb-2 opacity-30" />
                    Nenhum plano da equipe.
                </div>
            </div>
        </section>
    );
}
