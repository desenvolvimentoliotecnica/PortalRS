"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Users, Zap } from "lucide-react";
import {
    VAGA_ORIGEM_BADGE,
    VAGA_ORIGEM_LABEL,
    type VagaPipelineItem,
} from "./types";

const SEMAFORO_DOT: Record<VagaPipelineItem["semaforo"], string> = {
    verde: "bg-emerald-500",
    amarelo: "bg-amber-500",
    vermelho: "bg-rose-500",
};

interface VagaCardProps {
    vaga: VagaPipelineItem;
}

export function VagaCard({ vaga }: VagaCardProps) {
    const subtitle = vaga.funcaoNomeRm ?? vaga.centroCustoNome ?? "—";
    const origemBadgeClass = VAGA_ORIGEM_BADGE[vaga.origem];
    const origemLabel = vaga.origem === 0 ? "Manual" : "RM";

    return (
        <Link
            href={`/recrutamento/candidaturas?vagaId=${vaga.id}`}
            className="group relative block rounded-lg border border-border/50 bg-card/60 p-3 transition-colors hover:border-border hover:bg-card"
        >
            {vaga.isZumbi && (
                <div
                    className="absolute -top-1.5 -right-1.5 flex items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white shadow"
                    title={`Vaga sumiu do RM por ${vaga.ciclosAusenteRm} ciclos consecutivos`}
                >
                    <AlertTriangle className="size-3" />
                    Zumbi
                </div>
            )}

            <div className="flex items-center gap-1.5">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${origemBadgeClass}`} title={VAGA_ORIGEM_LABEL[vaga.origem]}>
                    {origemLabel}
                </span>
                {vaga.codigo && (
                    <span className="font-mono text-[11px] text-muted-foreground">{vaga.codigo}</span>
                )}
                {vaga.urgente && (
                    <Zap className="size-3 text-rose-500" aria-label="Vaga urgente" />
                )}
            </div>

            <div className="mt-1 line-clamp-2 text-sm font-semibold leading-tight">{vaga.titulo}</div>
            <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{subtitle}</div>

            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                    <Users className="size-3" />
                    {vaga.candidatosAtivos}/{vaga.totalCandidatos}
                </span>
                <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {vaga.diasNoEstagio}d
                </span>
                <span
                    className={`inline-block size-2 rounded-full ${SEMAFORO_DOT[vaga.semaforo]}`}
                    title={`SLA: ${vaga.semaforo}`}
                />
            </div>
        </Link>
    );
}
