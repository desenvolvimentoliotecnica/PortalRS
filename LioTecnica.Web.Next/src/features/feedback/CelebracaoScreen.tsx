"use client";

import {
    MessageCircle,
    RefreshCcw,
    Filter,
    Send,
} from "lucide-react";

export default function CelebracaoScreen() {
    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Celebração</h4>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button className="btn-ghost" type="button" disabled>
                        <RefreshCcw className="size-4" />
                        <span className="ml-1">Atualizar</span>
                    </button>
                </div>
            </div>

            {/* Nova publicação */}
            <div className="card-soft p-3">
                <div className="fw-bold mb-2">Nova publicação</div>
                <div className="text-muted-foreground text-sm mb-2">
                    Digite @@ e o nome para marcar um colaborador.
                </div>
                <div className="relative">
                    <textarea
                        className="form-control"
                        rows={3}
                        placeholder="O que você quer celebrar? Use @@nome para marcar colegas..."
                        maxLength={4000}
                        disabled
                    />
                    <div className="flex justify-between items-center mt-2">
                        <span className="text-muted-foreground text-sm">0/4000</span>
                        <button type="button" className="btn-brand" disabled>
                            <Send className="size-4 mr-1" />
                            Publicar
                        </button>
                    </div>
                </div>
            </div>

            {/* Filtros */}
            <div className="card-soft p-3">
                <div className="fw-bold mb-2">Filtros</div>
                <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex gap-1" role="group">
                        <button type="button" className="btn-ghost active text-sm" disabled>
                            Todas
                        </button>
                        <button type="button" className="btn-ghost text-sm" disabled>
                            Enviadas
                        </button>
                        <button type="button" className="btn-ghost text-sm" disabled>
                            Recebidas
                        </button>
                    </div>

                    <div>
                        <label className="form-label small mb-1">Data de início</label>
                        <input type="date" className="form-control" disabled />
                    </div>
                    <div>
                        <label className="form-label small mb-1">Data de fim</label>
                        <input type="date" className="form-control" disabled />
                    </div>

                    <div className="flex gap-2">
                        <button type="button" className="btn-brand" disabled>
                            <Filter className="size-4 mr-1" />
                            Filtrar
                        </button>
                        <button type="button" className="btn-ghost" disabled>
                            Limpar
                        </button>
                    </div>
                </div>
            </div>

            {/* Feed */}
            <div className="card-soft p-3">
                <div className="fw-bold mb-2">Feed</div>
                <div className="text-muted-foreground text-center py-8">
                    <MessageCircle className="size-8 mx-auto mb-2 opacity-30" />
                    <div>Nenhuma publicação ainda. Seja o primeiro a celebrar!</div>
                </div>
            </div>
        </section>
    );
}
