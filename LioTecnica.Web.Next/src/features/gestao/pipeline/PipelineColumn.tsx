"use client";

import type { VagaPipelineColuna } from "./types";
import { VagaCard } from "./VagaCard";

const COLUMN_HEADER_COLOR: Record<number, string> = {
    1: "border-sky-500/50 text-sky-700",
    2: "border-violet-500/50 text-violet-700",
    3: "border-amber-500/50 text-amber-700",
    4: "border-emerald-500/50 text-emerald-700",
    5: "border-teal-500/50 text-teal-700",
    6: "border-zinc-500/50 text-zinc-700",
};

interface PipelineColumnProps {
    coluna: VagaPipelineColuna;
}

export function PipelineColumn({ coluna }: PipelineColumnProps) {
    const headerClass = COLUMN_HEADER_COLOR[coluna.estagio] ?? "border-border text-foreground";

    return (
        <div className="flex h-full min-w-[260px] flex-1 flex-col rounded-xl border border-border/40 bg-card/30 p-3">
            <div className={`mb-3 flex items-center justify-between border-b pb-2 ${headerClass}`}>
                <span className="text-sm font-semibold">{coluna.nome}</span>
                <span className="rounded-full bg-card px-2 py-0.5 text-xs font-bold">{coluna.total}</span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
                {coluna.vagas.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground italic">
                        Nenhuma vaga
                    </div>
                ) : (
                    coluna.vagas.map((v) => <VagaCard key={v.id} vaga={v} />)
                )}
            </div>
        </div>
    );
}
