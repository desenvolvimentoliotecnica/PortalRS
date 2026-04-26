"use client";

import { useState } from "react";
import { UserMinus, GitBranch } from "lucide-react";
import DesligamentosScreen from "@/features/gestao/desligamentos/DesligamentosScreen";
import DesligamentosTotvsList from "@/features/gestao/desligamentos/DesligamentosTotvsList";

type Fonte = "datasul" | "totvs";

export default function Page() {
    const [fonte, setFonte] = useState<Fonte>("totvs");

    return (
        <section className="space-y-6">
            {/* Header com toggle */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <UserMinus className="size-5 text-muted-foreground" />
                        Desligamentos
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {fonte === "totvs"
                            ? "Pipeline de desligamentos sincronizados do TOTVS RM (VREQDESLIGAMENTO)."
                            : "Solicitações de desligamento internas (Datasul)."}
                    </p>
                </div>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shrink-0">
                    <button
                        onClick={() => setFonte("totvs")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                            fonte === "totvs"
                                ? "bg-blue-600 text-white"
                                : "text-slate-600 hover:text-slate-900"
                        }`}
                        title="Desligamentos sincronizados do TOTVS RM"
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
                        title="Solicitações internas (Datasul)"
                    >
                        <UserMinus className="size-3.5" />
                        Datasul
                    </button>
                </div>
            </div>

            {fonte === "totvs" ? <DesligamentosTotvsList /> : <DesligamentosScreen />}
        </section>
    );
}
