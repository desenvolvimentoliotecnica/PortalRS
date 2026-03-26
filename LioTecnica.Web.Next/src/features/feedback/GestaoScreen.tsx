"use client";

import { useState } from "react";
import GestaoDashboardScreen from "@/features/feedback/gestao/GestaoDashboardScreen";
import GestaoHumorScreen from "@/features/feedback/gestao/GestaoHumorScreen";
import GestaoResumoScreen from "@/features/feedback/gestao/GestaoResumoScreen";
import GestaoPlanosScreen from "@/features/feedback/gestao/GestaoPlanosScreen";
import MetasScreen from "@/features/feedback/MetasScreen";
import NineBoxScreen from "@/features/feedback/nine-box/NineBoxScreen";
import CiclosAvaliacaoScreen from "@/features/feedback/CiclosAvaliacaoScreen";

const TABS = [
    { id: "dashboard", label: "Dashboard" },
    { id: "humor", label: "Humor da Equipe" },
    { id: "resumo", label: "Resumo de Atividades" },
    { id: "planos", label: "Planos de Desenvolvimento" },
    { id: "metas", label: "Metas" },
    { id: "ninebox", label: "Nine-in-Box" },
    { id: "avaliacoes", label: "Avaliações" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function GestaoScreen() {
    const [tab, setTab] = useState<TabId>("dashboard");

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Gestão de Pessoas
                </div>
                <h1 className="text-2xl font-semibold tracking-tight">Gestão da Equipe</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Acompanhe o desempenho, humor, planos e metas da sua equipe.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl border border-border/40 bg-muted/30 p-1 flex-wrap">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex-1 min-w-fit rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                            tab === t.id
                                ? "bg-background text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Content */}
            {tab === "dashboard" && <GestaoDashboardScreen />}
            {tab === "humor" && <GestaoHumorScreen />}
            {tab === "resumo" && <GestaoResumoScreen />}
            {tab === "planos" && <GestaoPlanosScreen />}
            {tab === "metas" && <MetasScreen />}
            {tab === "ninebox" && <NineBoxScreen />}
            {tab === "avaliacoes" && <CiclosAvaliacaoScreen />}
        </div>
    );
}
