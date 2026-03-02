"use client";

import { useState } from "react";
import { BarChart3, Smile, BookOpen, ClipboardList } from "lucide-react";

type Tab = "dashboard" | "humor" | "planos" | "resumo";

export default function GestaoModuleScreen({ initialTab = "dashboard" }: { initialTab?: Tab }) {
    const [tab, setTab] = useState<Tab>(initialTab);

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "dashboard", label: "Dashboard", icon: <BarChart3 className="size-4" /> },
        { key: "humor", label: "Humor", icon: <Smile className="size-4" /> },
        { key: "planos", label: "Planos de Desenvolvimento", icon: <BookOpen className="size-4" /> },
        { key: "resumo", label: "Resumo de Atividades", icon: <ClipboardList className="size-4" /> },
    ];

    return (
        <section className="space-y-4">
            <div>
                <h4 className="text-lg font-bold">Gestão</h4>
                <div className="text-muted-foreground text-sm">Acompanhe a gestão de equipes, desempenho e desenvolvimento.</div>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit flex-wrap">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>
            {tab === "dashboard" && <DashboardTab />}
            {tab === "humor" && <HumorTab />}
            {tab === "planos" && <PlanosTab />}
            {tab === "resumo" && <ResumoTab />}
        </section>
    );
}

function DashboardTab() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Colaboradores</div>
                    <div className="mt-1 text-2xl font-bold text-primary">—</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Planos Ativos</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">—</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Humor Médio</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">—</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Atividades</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">—</div>
                </div>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
                <BarChart3 className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <div className="text-lg font-semibold text-muted-foreground">Dashboard de Gestão</div>
                <div className="text-sm text-muted-foreground/70 mt-1">Os dados do dashboard serão carregados quando a API estiver conectada.</div>
            </div>
        </div>
    );
}

function HumorTab() {
    return (
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
            <Smile className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <div className="text-lg font-semibold text-muted-foreground">Termômetro de Humor</div>
            <div className="text-sm text-muted-foreground/70 mt-1">Acompanhe o humor e bem-estar da equipe ao longo do tempo.</div>
        </div>
    );
}

function PlanosTab() {
    return (
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
            <BookOpen className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <div className="text-lg font-semibold text-muted-foreground">Planos de Desenvolvimento Individual</div>
            <div className="text-sm text-muted-foreground/70 mt-1">Crie e acompanhe PDIs para os membros da equipe.</div>
        </div>
    );
}

function ResumoTab() {
    return (
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-12 backdrop-blur text-center">
            <ClipboardList className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <div className="text-lg font-semibold text-muted-foreground">Resumo de Atividades</div>
            <div className="text-sm text-muted-foreground/70 mt-1">Visão consolidada das atividades e progresso da equipe.</div>
        </div>
    );
}
