"use client";

import { Telescope } from "lucide-react";

export default function SuperPesquisaScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div>
                <h4 className="text-lg font-bold">Super pesquisa</h4>
                <div className="text-muted-foreground text-sm">
                    Placeholder — implementar super pesquisa.
                </div>
            </div>

            <div className="card-soft p-3">
                <div className="text-muted-foreground text-center py-8">
                    <Telescope className="size-8 mx-auto mb-2 opacity-30" />
                    Tela mínima criada para Super Pesquisa. Ajustes pendentes.
                </div>
            </div>
        </section>
    );
}
