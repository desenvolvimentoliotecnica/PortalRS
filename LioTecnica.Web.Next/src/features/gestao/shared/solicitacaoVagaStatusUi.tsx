"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import {
    FileText,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Activity,
    Search,
    Cpu,
    RefreshCw,
    Link2Off,
    CheckCheck,
    MessageCircleWarning,
    Pause,
    Ban,
} from "lucide-react";

/** Matches `RhPortal.Api.Domain.Enums.SolicitacaoStatus` ordinals — keep in sync. */
export enum SolicitacaoVagaOrdinal {
    Rascunho = 0,
    PendenteAprovacao = 1,
    Aprovada = 2,
    Reprovada = 3,
    AjustesNecessarios = 4,
    PendenteAprovacaoRh = 5,
    Cancelada = 6,
    EmIntegracao = 7,
    Concluida = 8,
    PendenteAprovacaoAumentoHC = 10,
    PendenteTriagem = 11,
    EmTriagem = 12,
    DevolvidaTriagemGestor = 13,
    PendenteIntegracaoRm = 14,
    ErroIntegracaoRm = 15,
    AguardandoReprocessamentoRm = 16,
    EmProcessoSeletivo = 17,
    Suspensa = 18,
    EncerradaSemContratacao = 19,
    ContratacaoConcluida = 20,
}

const ENUM_NAME_BY_ORDINAL: Record<number, string> = {
    0: "Rascunho",
    1: "PendenteAprovacao",
    2: "Aprovada",
    3: "Reprovada",
    4: "AjustesNecessarios",
    5: "PendenteAprovacaoRh",
    6: "Cancelada",
    7: "EmIntegracao",
    8: "Concluida",
    10: "PendenteAprovacaoAumentoHC",
    11: "PendenteTriagem",
    12: "EmTriagem",
    13: "DevolvidaTriagemGestor",
    14: "PendenteIntegracaoRm",
    15: "ErroIntegracaoRm",
    16: "AguardandoReprocessamentoRm",
};

const ENUM_ORDINAL_BY_NAME_LOWER: Record<string, number> = Object.fromEntries(
    Object.entries(ENUM_NAME_BY_ORDINAL).map(([ord, name]) => [name.toLowerCase(), Number(ord)]),
);

/**
 * Normalize API payloads that may expose status as PascalCase enum name, lowercase, or ordinal.
 */
export function normalizeSolicitacaoStatus(raw: unknown): string {
    const key = normalizeSolicitacaoStatusOrdinal(raw);
    return ENUM_NAME_BY_ORDINAL[key] ?? "Rascunho";
}

export function normalizeSolicitacaoStatusOrdinal(raw: unknown): number {
    if (raw == null) return 0;
    if (typeof raw === "number" && Number.isFinite(raw)) {
        const z = raw as number;
        if (ENUM_NAME_BY_ORDINAL[z] != null) return z;
        return 0;
    }
    const s = String(raw).trim();
    const num = Number(s);
    if (!Number.isNaN(num) && ENUM_NAME_BY_ORDINAL[num] != null) return num;
    const byName = ENUM_ORDINAL_BY_NAME_LOWER[s.toLowerCase()];
    if (typeof byName === "number") return byName;
    return 0;
}

export type SolicitacaoVagaBadgeMeta = {
    label: string;
    className?: string;
    icon: LucideIcon;
};

/**
 * Stable label/color/icon for each `SolicitacaoStatus` (by ordinal or PascalCase enum name).
 */
export function statusBadge(raw: string | number): SolicitacaoVagaBadgeMeta {
    const ord = typeof raw === "number" ? normalizeSolicitacaoStatusOrdinal(raw) : normalizeSolicitacaoStatusOrdinal(raw);
    const base = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold";
    const map: Record<number, Omit<SolicitacaoVagaBadgeMeta, "label"> & { label: string }> = {
        0: { label: "Rascunho", className: `${base} bg-zinc-400/15 text-zinc-600`, icon: FileText },
        1: { label: "Pendente aprovação", className: `${base} bg-amber-500/15 text-amber-700`, icon: Clock },
        2: { label: "Aprovada", className: `${base} bg-emerald-500/15 text-emerald-700`, icon: CheckCircle2 },
        3: { label: "Reprovada", className: `${base} bg-red-500/15 text-red-700`, icon: XCircle },
        4: { label: "Ajustes necessários", className: `${base} bg-orange-500/15 text-orange-700`, icon: AlertTriangle },
        5: { label: "Aguarda RH", className: `${base} bg-purple-500/15 text-purple-700`, icon: Clock },
        6: { label: "Cancelada", className: `${base} bg-zinc-500/15 text-zinc-500`, icon: Link2Off },
        7: { label: "Em integração", className: `${base} bg-blue-500/15 text-blue-700`, icon: Activity },
        8: { label: "Concluída", className: `${base} bg-emerald-600/15 text-emerald-800`, icon: CheckCheck },
        10: { label: "Aguarda aprovação HC", className: `${base} bg-violet-500/15 text-violet-700`, icon: Clock },
        11: { label: "Pendente triagem", className: `${base} bg-amber-500/15 text-amber-800`, icon: Search },
        12: { label: "Em triagem", className: `${base} bg-sky-500/15 text-sky-800`, icon: Cpu },
        13: { label: "Devolvida (triagem)", className: `${base} bg-orange-500/15 text-orange-800`, icon: MessageCircleWarning },
        14: { label: "Pendente RM", className: `${base} bg-indigo-500/15 text-indigo-700`, icon: Activity },
        15: { label: "Erro integração RM", className: `${base} bg-red-600/15 text-red-800`, icon: XCircle },
        16: { label: "Reprocessamento RM", className: `${base} bg-amber-600/15 text-amber-900`, icon: RefreshCw },
        17: { label: "Em processo seletivo", className: `${base} bg-teal-500/15 text-teal-800`, icon: Cpu },
        18: { label: "Suspensa", className: `${base} bg-slate-500/15 text-slate-700`, icon: Pause },
        19: { label: "Encerrada s/ contratação", className: `${base} bg-zinc-600/15 text-zinc-700`, icon: Ban },
        20: { label: "Contratação concluída", className: `${base} bg-green-700/15 text-green-900`, icon: CheckCheck },
    };
    return map[ord] ?? map[0]!;
}

export function SolicitacaoVagaStatusBadgeEl({ raw }: { raw: string | number | undefined | null }) {
    const meta = statusBadge(raw ?? 0);
    const Icon = meta.icon;
    return (
        <span className={meta.className}>
            <Icon className="size-3 shrink-0" />
            {meta.label}
        </span>
    );
}

export type SolicitacaoBacklogStatusLabel = "Aberto" | "Fechado" | "Stand-by" | "Cancelada" | "Reprovada";

export type SolicitacaoBacklogBadgeMeta = {
    label: SolicitacaoBacklogStatusLabel;
    className: string;
};

const BACKLOG_BADGE_BASE = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap";

/**
 * Simplified grid status for solicitações: Aberto, Fechado, Stand-by, Cancelada, Reprovada.
 */
export function solicitacaoBacklogStatusBadge(raw: string | number | undefined | null): SolicitacaoBacklogBadgeMeta {
    const ord = normalizeSolicitacaoStatusOrdinal(raw ?? 0);
    if (ord === 3) {
        return { label: "Reprovada", className: `${BACKLOG_BADGE_BASE} bg-red-500/15 text-red-700` };
    }
    if (ord === 6) {
        return { label: "Cancelada", className: `${BACKLOG_BADGE_BASE} bg-zinc-500/15 text-zinc-600` };
    }
    if (ord === 18) {
        return { label: "Stand-by", className: `${BACKLOG_BADGE_BASE} bg-amber-500/15 text-amber-800` };
    }
    if (ord === 8 || ord === 19 || ord === 20) {
        return { label: "Fechado", className: `${BACKLOG_BADGE_BASE} bg-emerald-600/15 text-emerald-800` };
    }
    return { label: "Aberto", className: `${BACKLOG_BADGE_BASE} bg-sky-500/15 text-sky-700` };
}

export function SolicitacaoBacklogStatusBadgeEl({ raw }: { raw: string | number | undefined | null }) {
    const meta = solicitacaoBacklogStatusBadge(raw);
    return <span className={meta.className}>{meta.label}</span>;
}

/** KPI / delay badge: solicitacao awaiting action (excluding terminal). */
export function solicitacaoPainelUnifiedStatusOrdinal(vagaOrdinal: number): number {
    switch (vagaOrdinal) {
        case 0: return 0;
        case 2:
        case 8:
            return 2;
        case 3: return 3;
        case 4: return 4;
        case 6: return 5;
        case 5: return 6;
        default:
            if ([1, 7, 10, 11, 12, 13, 14, 15, 16].includes(vagaOrdinal)) return 1;
            return 1;
    }
}

export function solicitacaoPainelShowsEtapaPlaceholder(vagaOrdinal: number): boolean {
    return [1, 4, 5, 7, 10, 11, 12, 13, 14, 15, 16].includes(vagaOrdinal);
}

export function solicitacaoPainelNeedsDelayAttention(vagaOrdinal: number): boolean {
    return vagaOrdinal === 1 || vagaOrdinal === 5 || (vagaOrdinal >= 11 && vagaOrdinal <= 16);
}
