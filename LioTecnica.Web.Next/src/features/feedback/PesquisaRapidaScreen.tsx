"use client";

import { Search } from "lucide-react";

export default function PesquisaRapidaScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div>
                <h4 className="text-lg font-bold">Pesquisa rápida</h4>
                <div className="text-muted-foreground text-sm">
                    Placeholder — implementar pesquisa rápida.
                </div>
            </div>

            <div className="card-soft p-3">
                <div className="text-muted-foreground text-center py-8">
                    <Search className="size-8 mx-auto mb-2 opacity-30" />
                    Tela mínima criada para pesquisa rápida. Ajustes pendentes.
                </div>
            </div>
        </section>
    );
}
