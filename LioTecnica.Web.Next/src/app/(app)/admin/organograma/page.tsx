"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AuthGuard } from "@/hooks/useAuth";
import { Network, GitBranch } from "lucide-react";
import HierarquiaTotvsTree from "@/features/admin/organograma/HierarquiaTotvsTree";

// Lazy-load the React Flow canvas to avoid SSR issues
const OrganogramaCanvas = dynamic(
    () => import("@/features/admin/organograma/OrganogramaCanvas"),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Carregando canvas...</div> }
);

type Fonte = "datasul" | "totvs";

function OrganogramaPage() {
    const [fonte, setFonte] = useState<Fonte>("totvs");

    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Network className="size-5 text-muted-foreground" />
                        Organograma
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Visualize a estrutura hierárquica da organização.
                    </p>
                </div>
                {/* Toggle entre fontes */}
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
                    <button
                        onClick={() => setFonte("totvs")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            fonte === "totvs"
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                        title="Hierarquia sincronizada do TOTVS RM (VHIERARQUIA)"
                    >
                        <GitBranch className="size-3.5" />
                        TOTVS RM
                    </button>
                    <button
                        onClick={() => setFonte("datasul")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            fonte === "datasul"
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                        title="Estrutura via lotações TOTVS Datasul"
                    >
                        <Network className="size-3.5" />
                        Datasul
                    </button>
                </div>
            </div>

            {/* Card com tree (TOTVS) ou canvas (Datasul) */}
            <div className="rounded-xl border border-border/40 bg-card overflow-hidden h-[calc(100dvh-220px)]">
                {fonte === "totvs" ? <HierarquiaTotvsTree /> : <OrganogramaCanvas />}
            </div>
        </section>
    );
}

export default function Page() {
    return (
        <AuthGuard>
            <OrganogramaPage />
        </AuthGuard>
    );
}
