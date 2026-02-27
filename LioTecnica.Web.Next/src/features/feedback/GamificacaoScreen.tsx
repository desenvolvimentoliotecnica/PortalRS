"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, RefreshCcw, Search } from "lucide-react";

const RANKING_TABS = [
    { id: "all", label: "Todos" },
    { id: "colab", label: "Colaboradores" },
    { id: "gestor", label: "Gestores" },
] as const;

type RankingTabId = (typeof RANKING_TABS)[number]["id"];

export default function GamificacaoScreen() {
    const [tab, setTab] = useState<RankingTabId>("all");

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold m-0">Ranking de Gamificação</h4>
                <div className="flex gap-2">
                    <Link className="btn-ghost" href="/app/feedback/gamificacao/historico">
                        <Clock className="size-4" />
                        <span className="ml-1">Histórico</span>
                    </Link>
                    <button className="btn-ghost" type="button" disabled>
                        <RefreshCcw className="size-4" />
                        <span className="ml-1">Atualizar</span>
                    </button>
                </div>
            </div>

            {/* Ação e valor em pontos */}
            <div className="card-soft p-3">
                <div className="fw-bold mb-2">Ação e valor em pontos</div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="text-muted-foreground text-sm space-y-1">
                        <div>Enviar feedback → +100 pontos</div>
                        <div>Receber feedback → +50 pontos</div>
                        <div>Celebração enviada → +30 pontos</div>
                    </div>
                    <div className="text-muted-foreground text-sm space-y-1">
                        <div>Responder pesquisa → +80 pontos</div>
                        <div>Reunião 1:1 finalizada → +60 pontos</div>
                        <div>Criar plano de desenvolvimento → +40 pontos</div>
                    </div>
                </div>
            </div>

            {/* Ranking completo */}
            <div className="card-soft p-3">
                <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
                    <div>
                        <div className="fw-bold">Ranking completo</div>
                        <div className="text-muted-foreground text-sm">
                            Confira a pontuação do time abaixo. Para ver seu extrato individual, basta buscar seu nome na lista.
                        </div>
                    </div>
                    <div className="text-end">
                        <div className="text-muted-foreground text-sm">Total de RenderCoin</div>
                        <div className="fw-bold">—</div>
                    </div>
                </div>

                <div className="relative mb-2">
                    <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className="form-control pl-9"
                        placeholder="Busque pelo nome"
                        disabled
                    />
                </div>

                <div className="flex gap-3 mb-3 text-sm">
                    {RANKING_TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            className={`border-0 bg-transparent ${tab === t.id ? "fw-bold text-primary" : "text-muted-foreground"
                                }`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <div className="text-muted-foreground text-center py-4">
                    Nenhum item encontrado.
                </div>
            </div>
        </section>
    );
}
