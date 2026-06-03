"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Ban,
    Banknote,
    Briefcase,
    CalendarDays,
    CheckCircle2,
    Clock,
    Columns3,
    Copy,
    Eye,
    FileText,
    FolderOpen,
    List,
    MapPin,
    MoreHorizontal,
    PenSquare,
    Plus,
    RefreshCw,
    Search,
    ShieldCheck,
    Target,
    Trash2,
    Users,
} from "lucide-react";

import type { VagaListItem } from "@/lib/schemas/recrutamento";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";
import { env } from "@/lib/env";
import { getAccessToken, tryGetUserIdFromJwt } from "@/lib/session";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";
import { confirmDialog } from "@/lib/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import EmptyState from "@/components/ui/EmptyState";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuSeparator,
    DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import VagaFormModal from "./VagaFormModal";
import SolicitacaoFormModal from "@/features/gestao/solicitacoes/SolicitacaoFormModal";
import NextStepBanner from "@/components/feedback/NextStepBanner";

const BASE = "/app";
const MATCHING_LAST_VAGA_KEY = "renderrh.matching.lastVagaId";
const VAGAS_FONT_135X_STYLE = `
    .vagas-font-135x {
        font-size: 1.35rem;
        line-height: 1.85rem;
    }

    .vagas-font-135x .text-\\[9px\\] {
        font-size: 12.15px !important;
        line-height: 1.05rem !important;
    }

    .vagas-font-135x .text-\\[10px\\] {
        font-size: 13.5px !important;
        line-height: 1.15rem !important;
    }

    .vagas-font-135x .text-\\[11px\\] {
        font-size: 14.85px !important;
        line-height: 1.2rem !important;
    }

    .vagas-font-135x .text-xs {
        font-size: 1.0125rem !important;
        line-height: 1.45rem !important;
    }

    .vagas-font-135x .text-sm {
        font-size: 1.18125rem !important;
        line-height: 1.55rem !important;
    }

    .vagas-font-135x .text-base {
        font-size: 1.35rem !important;
        line-height: 1.85rem !important;
    }

    .vagas-font-135x .text-lg {
        font-size: 1.51875rem !important;
        line-height: 2rem !important;
    }

    .vagas-font-135x .text-xl {
        font-size: 1.6875rem !important;
        line-height: 2.2rem !important;
    }

    .vagas-font-135x .text-2xl {
        font-size: 2.025rem !important;
        line-height: 2.5rem !important;
    }

    .vagas-font-135x input:not([type="checkbox"]),
    .vagas-font-135x select,
    .vagas-font-135x textarea,
    .vagas-font-135x button {
        font-size: 1.18125rem !important;
        line-height: 1.55rem !important;
    }

    .vagas-font-135x input:not([type="checkbox"]),
    .vagas-font-135x select,
    .vagas-font-135x button {
        min-height: 3rem;
    }

    .vagas-font-135x textarea {
        min-height: 5rem;
    }
`;

function truncateTitle(value: string | null | undefined, maxLength = 60): string {
    const text = value?.trim();
    if (!text) return "—";
    return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

type VagasPayload = unknown;

interface SolicitacaoRow {
    id: string;
    titulo: string;
    status: number | string;
    urgencia: number | string;
    tipoSolicitacao: number | string;
    centroCustoName: string | null;
    solicitanteNome?: string | null;
    qtdPosicoes: number;
    createdAtUtc: string;
    vagaId?: string | null;
    rmIdReq?: number | string | null;
}

interface SolicitacaoDetail extends SolicitacaoRow {
    justificativa?: string | null;
    aprovadorNome?: string | null;
    motivoRequisicao?: number | string | null;
    motivoRequisicaoCodigo?: string | null;
    motivoRequisicaoEfeito?: number | string | null;
    analistaRhResponsavelUserId?: string | null;
    analistaRhResponsavelNome?: string | null;
    jobPositionId?: string | null;
    jobPositionName?: string | null;
    codFuncaoRm?: string | null;
    funcaoNomeRm?: string | null;
    tipoContrato?: number | string | null;
    escalaTrabalho?: string | null;
    turnoId?: string | null;
    turnoCode?: string | null;
    turnoDescription?: string | null;
    centroCustoId?: string | null;
    centroCustoNome?: string | null;
    unidadeLotacaoId?: string | null;
    unidadeLotacaoNome?: string | null;
    faixaSalarialMin?: number | string | null;
    faixaSalarialMax?: number | string | null;
    cnhObrigatoria?: boolean;
    disponibilidadeViagens?: boolean;
    vagaId?: string | null;
    observacaoAprovador?: string | null;
    isConfidencial?: boolean;
    substituidoNome?: string | null;
    approvedAtUtc?: string | null;
    updatedAtUtc?: string | null;
}

function asRecord(v: unknown): Record<string, unknown> | null {
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function pickNumber(v: unknown, fb: number) {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fb;
}

function pickString(v: unknown, fb = "") {
    return typeof v === "string" ? v : v == null ? fb : String(v);
}

function pickBool(v: unknown) {
    return v === true || v === "true" || v === 1;
}

function clamp(n: number, min: number, max: number) {
    return Math.max(min, Math.min(max, n));
}

function pickDecimalString(v: unknown) {
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    if (typeof v === "string") {
        const trimmed = v.trim();
        return trimmed;
    }
    return "";
}

function mapSolicUrgenciaToPrioridade(value: unknown) {
    if (value === 3 || value === "3" || value === "Critica") return "critica";
    if (value === 2 || value === "2" || value === "Alta") return "alta";
    if (value === 1 || value === "1" || value === "Media") return "media";
    return "baixa";
}

function mapSolicTipoContratoToVagaTipoContratacao(value: unknown) {
    const raw = pickString(value).toLowerCase();
    if (!raw) return "";
    if (raw === "clt") return "clt";
    if (raw === "estagio") return "estagio";
    if (raw === "aprendiz") return "aprendiz";
    if (raw === "temporario") return "temporario";
    return raw;
}

function mapSolicMotivoToVagaMotivoAbertura(solic: SolicitacaoDetail) {
    const tipoSolicitacao = pickString(solic.tipoSolicitacao);
    if (tipoSolicitacao === "AumentoQuadro" || tipoSolicitacao === "2") return "aumentodequadro";

    const codigo = pickString(solic.motivoRequisicaoCodigo);
    switch (codigo) {
        case "PedidoDemissao":
        case "DesligamentoSemJustaCausa":
        case "TerminoContrato":
        case "Movimentacao":
        case "Afastamento":
            return "substituicao";
        case "NovaUnidade":
            return "novoprojeto";
        case "AtenderDemanda":
        case "ExpansaoBase":
        case "CotaAprendiz":
            return "aumentodequadro";
    }

    const motivoLegacy = pickString(solic.motivoRequisicao);
    switch (motivoLegacy) {
        case "PedidoDemissao":
        case "DesligamentoSemJustaCausa":
        case "TerminoContrato":
        case "Movimentacao":
        case "Afastamento":
        case "1":
        case "2":
        case "4":
        case "7":
        case "8":
            return "substituicao";
        case "NovaUnidade":
        case "6":
            return "novoprojeto";
        case "AtenderDemanda":
        case "ExpansaoBase":
        case "CotaAprendiz":
        case "0":
        case "3":
        case "5":
            return "aumentodequadro";
    }

    const efeito = pickString(solic.motivoRequisicaoEfeito);
    if (efeito === "Aumenta" || efeito === "1") return "aumentodequadro";
    if (efeito === "Ambos" || efeito === "Diminui" || efeito === "2" || efeito === "3") return "substituicao";

    if (tipoSolicitacao === "Substituicao" || tipoSolicitacao === "1") return "substituicao";
    return "";
}

function mapSolicitacaoToVagaPrefill(solic: SolicitacaoDetail): Record<string, unknown> {
    return {
        status: "rascunho",
        titulo: pickString(solic.titulo),
        descricaoInterna: pickString(solic.justificativa),
        quantidadeVagas: pickNumber(solic.qtdPosicoes, 1),
        prioridade: mapSolicUrgenciaToPrioridade(solic.urgencia),
        urgente: solic.urgencia === 2 || solic.urgencia === 3 || solic.urgencia === "Alta" || solic.urgencia === "Critica",
        confidencial: pickBool(solic.isConfidencial),
        cargoId: pickString(solic.jobPositionId),
        cargoName: pickString(solic.jobPositionName),
        codFuncaoRm: pickString(solic.codFuncaoRm),
        funcaoNomeRm: pickString(solic.funcaoNomeRm),
        motivoAbertura: mapSolicMotivoToVagaMotivoAbertura(solic),
        tipoContratacao: mapSolicTipoContratoToVagaTipoContratacao(solic.tipoContrato),
        centroCustoId: pickString(solic.centroCustoId),
        centroCustoDescription: pickString(solic.centroCustoNome),
        unidadeLotacaoId: pickString(solic.unidadeLotacaoId),
        unidadeLotacaoDescription: pickString(solic.unidadeLotacaoNome),
        turnoId: pickString(solic.turnoId),
        turnoCode: pickString(solic.turnoCode),
        turnoDescription: pickString(solic.turnoDescription),
        escalaTrabalhoRaw: pickString(solic.escalaTrabalho),
        salarioMinimo: pickDecimalString(solic.faixaSalarialMin),
        salarioMaximo: pickDecimalString(solic.faixaSalarialMax),
        exigeCnh: pickBool(solic.cnhObrigatoria),
        disponibilidadeViagens: pickBool(solic.disponibilidadeViagens),
        gestorRequisitante: pickString(solic.solicitanteNome),
        recrutadorResponsavelUserId: pickString(solic.analistaRhResponsavelUserId) || null,
        recrutadorResponsavel: pickString(solic.analistaRhResponsavelNome),
    };
}

function formatDate(value: string | null | undefined) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleDateString("pt-BR");
    } catch {
        return "—";
    }
}

function formatDateTime(value: string | null | undefined) {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("pt-BR");
    } catch {
        return "—";
    }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP_${res.status}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function mapVagaItem(raw: unknown): VagaListItem {
    const r = asRecord(raw) ?? {};
    return { ...(r as unknown as VagaListItem), area: pickString(r.centroCustoName ?? r.areaName ?? r.area, "") };
}

function mapVagasPayload(payload: VagasPayload): VagaListItem[] {
    if (Array.isArray(payload)) return (payload as unknown[]).map(mapVagaItem);
    const r = asRecord(payload);
    const items = r?.items;
    if (Array.isArray(items)) return (items as unknown[]).map(mapVagaItem);
    return [];
}

function mergeDataRequisicaoFromSolicitacoes(
    vagas: VagaListItem[],
    solicitacoes: SolicitacaoRow[],
): VagaListItem[] {
    if (!solicitacoes.length) return vagas;

    const byVagaId = new Map<string, string>();
    const byRmIdReq = new Map<string, string>();
    for (const s of solicitacoes) {
        if (!s.createdAtUtc) continue;
        if (s.vagaId) byVagaId.set(s.vagaId.toLowerCase(), s.createdAtUtc);
        if (s.rmIdReq != null) byRmIdReq.set(String(s.rmIdReq), s.createdAtUtc);
    }

    return vagas.map((vaga) => {
        const raw = vaga as Record<string, unknown>;
        if (raw.dataRequisicao) return vaga;

        const dataRequisicao = byVagaId.get(vaga.id.toLowerCase())
            ?? byRmIdReq.get(vagaCodigoRm(vaga));
        return dataRequisicao
            ? ({ ...raw, dataRequisicao } as VagaListItem)
            : vaga;
    });
}

function vagaResponsavelUserId(vaga: VagaListItem): string {
    const raw = vaga as Record<string, unknown>;
    return pickString(raw.recrutadorResponsavelUserId ?? raw.RecrutadorResponsavelUserId, "").trim().toLowerCase();
}

function vagaCodigoRm(vaga: VagaListItem): string {
    const raw = vaga as Record<string, unknown>;
    return pickString(raw.idReqRmOrigem ?? raw.rmIdReq ?? vaga.codigo, "").trim();
}

function vagaDataAbertura(vaga: VagaListItem): string {
    const raw = vaga as Record<string, unknown>;
    return pickString(raw.dataAbertura ?? vaga.createdAtUtc ?? vaga.updatedAt, "");
}

function vagaDataRequisicao(vaga: VagaListItem): string {
    const raw = vaga as Record<string, unknown>;
    return pickString(raw.dataRequisicao, "");
}

function vagaSecao(vaga: VagaListItem): string {
    const raw = vaga as Record<string, unknown>;
    return pickString(raw.centroCustoNome ?? raw.centroCustoName ?? vaga.area, "").trim();
}

function vagaPosicoes(vaga: VagaListItem): number {
    return pickNumber((vaga as Record<string, unknown>).quantidadeVagas, 0);
}

function compareDateStrings(a: string, b: string): number {
    const da = a ? new Date(a).getTime() || 0 : 0;
    const db = b ? new Date(b).getTime() || 0 : 0;
    return da - db;
}

function formatOpenDays(iso: string | null | undefined) {
    if (!iso) return "—";
    const openedAt = new Date(iso).getTime();
    if (!Number.isFinite(openedAt)) return "—";

    const elapsedMs = Date.now() - openedAt;
    const days = Math.max(0, Math.floor(elapsedMs / 86_400_000));
    return days === 1 ? "1 dia" : `${days} dias`;
}

function resolvePortalVagasBaseUrl(): string {
    const configured = env.PORTAL_VAGAS_URL.trim().replace(/\/$/, "");
    if (configured) return configured;

    if (typeof window === "undefined") return "http://localhost:3050";

    const current = new URL(window.location.origin);
    if ((current.hostname === "localhost" || current.hostname === "127.0.0.1") && current.port === "3000") {
        current.port = "3050";
    }
    return current.origin;
}

function isVagaDeleteRestrictedByCandidates(message: string) {
    const m = (message || "").toLowerCase();
    return m.includes("fk_candidatos_vagas_vagaid") || (m.includes("violates restrict") && m.includes("candidatos"));
}

function mapCandidatosList(payload: unknown): Array<{ id: string; nome: string }> {
    const arr = Array.isArray(payload) ? payload
        : Array.isArray(asRecord(payload)?.items) ? (asRecord(payload)?.items as unknown[]) : [];
    return arr.map((x) => {
        const r = asRecord(x) ?? {};
        const id = pickString(r.id, "").trim();
        if (!id) return null;
        return { id, nome: pickString(r.nome, "Candidato").trim() || "Candidato" };
    }).filter(Boolean) as Array<{ id: string; nome: string }>;
}

const VAGA_STATUS: Record<string, { label: string; cls: string }> = {
    aberta: { label: "Aberta", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    ativa: { label: "Aberta", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    rascunho: { label: "Rascunho", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    pausada: { label: "Pausada", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    fechada: { label: "Fechada", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
    encerrada: { label: "Encerrada", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
    cancelada: { label: "Cancelada", cls: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
    preenchida: { label: "Preenchida", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

const SOLIC_STATUS: Record<number, { label: string; cls: string }> = {
    0: { label: "Rascunho", cls: "bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300" },
    1: { label: "Pendente Aprovação", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    2: { label: "Aprovada", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
    3: { label: "Reprovada", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
    4: { label: "Ajustes Necessários", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
    5: { label: "Aguarda RH", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
};

const SOLIC_URGENCIA: Record<number, { label: string; cls: string }> = {
    0: { label: "Baixa", cls: "text-zinc-500" },
    1: { label: "Média", cls: "text-amber-600" },
    2: { label: "Alta", cls: "text-orange-600" },
    3: { label: "Crítica", cls: "text-red-600 font-semibold" },
};

const SOLIC_TIPO: Record<number, string> = {
    0: "Vaga Nova",
    1: "Substituição",
};

const APROVACAO_STATUS: Record<number, string> = {
    0: "Pendente",
    1: "Aprovado",
    2: "Reprovado",
};

function normalizeEnumKey(value: unknown) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "");
}

function resolveSolicStatusMeta(status: unknown) {
    const key = normalizeEnumKey(status);
    if (key === "1" || key === "pendenteaprovacao") return SOLIC_STATUS[1];
    if (key === "2" || key === "aprovada") return SOLIC_STATUS[2];
    if (key === "3" || key === "reprovada") return SOLIC_STATUS[3];
    if (key === "4" || key === "ajustesnecessarios") return SOLIC_STATUS[4];
    if (key === "5" || key === "pendenteaprovacaorh") return SOLIC_STATUS[5];
    return SOLIC_STATUS[0];
}

function resolveUrgenciaMeta(urgencia: unknown) {
    const key = normalizeEnumKey(urgencia);
    if (key === "0" || key === "baixa") return SOLIC_URGENCIA[0];
    if (key === "2" || key === "alta") return SOLIC_URGENCIA[2];
    if (key === "3" || key === "critica") return SOLIC_URGENCIA[3];
    return SOLIC_URGENCIA[1];
}

function resolveTipoLabel(tipo: unknown) {
    const key = normalizeEnumKey(tipo);
    if (key === "1" || key === "substituicao") return SOLIC_TIPO[1];
    return SOLIC_TIPO[0];
}

function resolveApprovalStatusLabel(status: unknown) {
    const key = normalizeEnumKey(status);
    if (key === "1" || key === "aprovado") return APROVACAO_STATUS[1];
    if (key === "2" || key === "reprovado") return APROVACAO_STATUS[2];
    return APROVACAO_STATUS[0];
}

function isSolicStatus(status: unknown, expected: "rascunho" | "pendenteaprovacao" | "aprovada" | "reprovada" | "ajustesnecessarios" | "pendenteaprovacaorh") {
    const key = normalizeEnumKey(status);
    if (expected === "pendenteaprovacaorh") return key === "5" || key === "pendenteaprovacaorh";
    return key === expected;
}

function VagaStatusBadge({ status }: { status: string | null | undefined }) {
    const s = (status ?? "").trim().toLowerCase();
    const meta = VAGA_STATUS[s];
    if (!meta) return <span className="text-xs text-muted-foreground">{status || "—"}</span>;
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
}

function SolicStatusBadge({ status }: { status: number | string }) {
    const meta = resolveSolicStatusMeta(status);
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>{meta.label}</span>;
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
    return (
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
            <div className="mt-1 text-sm font-medium text-foreground">{value || "—"}</div>
        </div>
    );
}

export default function VagasScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { me } = useAuth();
    const deeplinkHandled = useRef(false);

    const isGestor = useMemo(
        () => (me?.roles ?? []).some((r) => r.toLowerCase() === "gestor"),
        [me?.roles],
    );
    const isAnalistaRhRestrito = useMemo(() => {
        const roles = (me?.roles ?? []).map((r) => r.toLowerCase());
        return roles.includes("analista de rh") && !roles.includes("especialista de rh");
    }, [me?.roles]);
    const currentUserId = useMemo(() => {
        const token = getAccessToken();
        return token ? tryGetUserIdFromJwt(token)?.toLowerCase() ?? null : null;
    }, [me]);
    const showManagerSections = isGestor;

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<VagaListItem[]>([]);
    const [q, setQ] = useState("");
    const [viewMode, setViewModeRaw] = useState<"list" | "kanban">(() => {
        if (typeof window === "undefined") return "list";
        return (localStorage.getItem("renderrh.vagas.viewMode") as "list" | "kanban") || "list";
    });
    const setViewMode = (m: "list" | "kanban") => { setViewModeRaw(m); localStorage.setItem("renderrh.vagas.viewMode", m); };
    type SortCol = "codigo" | "titulo" | "secao" | "posicoes" | "createdAt" | "dataRequisicao" | "abertoHa" | "status";
    const [sortCol, setSortCol] = useState<SortCol>("createdAt");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const toggleSort = (col: SortCol) => {
        if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortCol(col); setSortDir(col === "createdAt" ? "desc" : "asc"); }
    };
    const sortIcon = (col: SortCol) => sortCol === col
        ? (sortDir === "asc" ? <ArrowUp className="inline size-3 ml-1" /> : <ArrowDown className="inline size-3 ml-1" />)
        : <ArrowUpDown className="inline size-3 ml-1 opacity-30" />;
    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoRow[]>([]);
    const [approvals, setApprovals] = useState<SolicitacaoRow[]>([]);
    const [loadingSolic, setLoadingSolic] = useState(false);
    const [loadingApprovals, setLoadingApprovals] = useState(false);
    const [solicitacaoOpen, setSolicitacaoOpen] = useState(false);
    const [solicitacaoEditId, setSolicitacaoEditId] = useState<string | null>(null);
    const [solicitacaoInitialData, setSolicitacaoInitialData] = useState<{ vagaId: string; jobPositionId: string | null; titulo: string } | null>(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [editDefaultTab, setEditDefaultTab] = useState<string | undefined>(undefined);

    const [vagaDetailOpen, setVagaDetailOpen] = useState(false);
    const [vagaDetailLoading, setVagaDetailLoading] = useState(false);
    const [vagaDetail, setVagaDetail] = useState<Record<string, unknown> | null>(null);
    const [vagaCandidateCount, setVagaCandidateCount] = useState<number | null>(null);


    const [solicDetailOpen, setSolicDetailOpen] = useState(false);
    const [solicDetailLoading, setSolicDetailLoading] = useState(false);
    const [solicDetail, setSolicDetail] = useState<SolicitacaoDetail | null>(null);
    const [approvalObs, setApprovalObs] = useState("");
    const [approvalActing, setApprovalActing] = useState(false);

    /* ── next step banner after vaga creation ── */
    const [lastCreatedVagaId, setLastCreatedVagaId] = useState<string | null>(null);

    /* ── prefill from solicitação (deep-link: ?newFromSolicitacao=ID) ── */
    const [prefillFromSolic, setPrefillFromSolic] = useState<Record<string, unknown> | null>(null);
    const fromSolicId = searchParams.get("newFromSolicitacao");
    const fromSolicHandled = useRef(false);
    useEffect(() => {
        if (!fromSolicId || fromSolicHandled.current) return;
        fromSolicHandled.current = true;
        fetchJson<SolicitacaoDetail>(`/api/solicitacoes-vaga/${encodeURIComponent(fromSolicId)}`)
            .then((solic) => {
                setPrefillFromSolic(mapSolicitacaoToVagaPrefill(solic));
                setEditId(null);
                setEditOpen(true);
            })
            .catch(() => toast.error("Falha ao carregar solicitação."));
    }, [fromSolicId]);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<VagasPayload>(`${BASE}/api/vagas`);
        let list = mapVagasPayload(payload);
        try {
            const solicitacoesRows = await fetchJson<SolicitacaoRow[]>("/api/solicitacoes-vaga");
            list = mergeDataRequisicaoFromSolicitacoes(list, Array.isArray(solicitacoesRows) ? solicitacoesRows : []);
        } catch {
            // A listagem de vagas já contém dataRequisicao nas versões atualizadas da API.
        }
        setRows(list);
        setScreenCache(`/vagas:${currentUserId ?? "anon"}`, list);
    }, [currentUserId]);

    // ── Drag-drop status change ──
    const STATUS_MAP_DND: Record<string, string> = { rascunho: "Rascunho", aberta: "Aberta", pausada: "Pausada", fechada: "Encerrada" };
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);

    async function handleDrop(vagaId: string, targetCol: string) {
        setDragOverCol(null);
        const newStatus = STATUS_MAP_DND[targetCol];
        if (!newStatus) return;
        try {
            const res = await apiFetch(`/api/vagas/${encodeURIComponent(vagaId)}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as Record<string, string>;
                throw new Error(body.message || `Erro ${res.status}`);
            }
            toast.success(`Status alterado para ${newStatus}`);
            await syncList();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao alterar status");
        }
    }

    const loadSolicitacoes = useCallback(async () => {
        if (!showManagerSections) {
            setSolicitacoes([]);
            return;
        }

        setLoadingSolic(true);
        try {
            const data = await fetchJson<SolicitacaoRow[]>("/api/solicitacoes-vaga");
            setSolicitacoes(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar solicitações.");
        } finally {
            setLoadingSolic(false);
        }
    }, [showManagerSections]);

    const loadApprovals = useCallback(async () => {
        if (!showManagerSections) {
            setApprovals([]);
            return;
        }

        setLoadingApprovals(true);
        try {
            const data = await fetchJson<SolicitacaoRow[]>("/api/solicitacoes-vaga?statuses=1&statuses=5");
            setApprovals(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar aprovações.");
        } finally {
            setLoadingApprovals(false);
        }
    }, [showManagerSections]);

    useEffect(() => {
        let alive = true;
        const cacheKey = `/vagas:${currentUserId ?? "anon"}`;
        const cached = getScreenCache<VagaListItem[]>(cacheKey);
        if (cached) {
            setRows(cached);
        } else {
            setLoading(true);
        }

        syncList()
            .catch((e) => toast.error(e instanceof Error ? e.message : "Falha ao carregar vagas."))
            .finally(() => { if (alive) setLoading(false); });

        return () => { alive = false; };
    }, [currentUserId, syncList]);

    useEffect(() => {
        void loadSolicitacoes();
        void loadApprovals();
    }, [loadSolicitacoes, loadApprovals]);

    useEffect(() => {
        if (deeplinkHandled.current) return;
        const open = searchParams.get("open");
        const vagaId = searchParams.get("vagaId");

        if ((open === "create" || open === "new") && !vagaId) {
            setEditId(null);
            setEditOpen(true);
            deeplinkHandled.current = true;
            return;
        }

        if (open === "detail" && vagaId) {
            deeplinkHandled.current = true;
            void openVagaDetail(vagaId);
        }
    }, [searchParams]);

    const rowsByResponsavel = useMemo(() => {
        if (!isAnalistaRhRestrito || !currentUserId) return rows;
        return rows.filter((v) => vagaResponsavelUserId(v) === currentUserId);
    }, [currentUserId, isAnalistaRhRestrito, rows]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        const result = rowsByResponsavel.filter((v) => {
            if (!qq) return true;
            return [vagaCodigoRm(v), v.titulo, vagaSecao(v), v.modalidade, v.cidade, v.uf]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(qq);
        });
        const dir = sortDir === "asc" ? 1 : -1;
        result.sort((a, b) => {
            switch (sortCol) {
                case "codigo":
                    return dir * vagaCodigoRm(a).localeCompare(vagaCodigoRm(b));
                case "titulo":
                    return dir * (a.titulo ?? "").localeCompare(b.titulo ?? "");
                case "secao":
                    return dir * vagaSecao(a).localeCompare(vagaSecao(b));
                case "posicoes":
                    return dir * (vagaPosicoes(a) - vagaPosicoes(b));
                case "status":
                    return dir * (a.status ?? "").localeCompare(b.status ?? "");
                case "dataRequisicao":
                    return dir * compareDateStrings(vagaDataRequisicao(a), vagaDataRequisicao(b));
                case "abertoHa":
                    return dir * compareDateStrings(vagaDataRequisicao(a), vagaDataRequisicao(b));
                case "createdAt":
                default: {
                    return dir * compareDateStrings(vagaDataAbertura(a), vagaDataAbertura(b));
                }
            }
        });
        return result;
    }, [rowsByResponsavel, q, sortCol, sortDir]);

    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice]);

    function persistMatchingContext(vagaId: string) {
        try {
            sessionStorage.setItem(MATCHING_LAST_VAGA_KEY, vagaId);
            localStorage.setItem(MATCHING_LAST_VAGA_KEY, vagaId);
        } catch {
            // ignore
        }
    }

    function openEdit(id: string) {
        router.push(`/vagas/editar?id=${encodeURIComponent(id)}`);
    }

    async function copyPortalLink(vagaId: string) {
        const tenantId = me?.tenantId;
        if (!tenantId) { toast.error("TenantId não encontrado."); return; }
        const url = new URL(resolvePortalVagasBaseUrl());
        url.searchParams.set("tenantId", tenantId);
        url.searchParams.set("vagaId", vagaId);
        try { await navigator.clipboard.writeText(url.toString()); toast.success("Link do portal copiado!"); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Falha ao copiar link."); }
    }

    function openSolicitacaoEditor(id?: string | null, fromVaga?: { vagaId: string; jobPositionId: string | null; titulo: string } | null) {
        setSolicitacaoEditId(id ?? null);
        setSolicitacaoInitialData(id ? null : (fromVaga ?? null));
        setSolicitacaoOpen(true);
    }

    function openVagaDetail(id: string) {
        router.push(`/vagas/hub?id=${encodeURIComponent(id)}`);
    }

    async function openSolicitacaoDetail(id: string) {
        setSolicDetailOpen(true);
        setSolicDetailLoading(true);
        setApprovalObs("");
        try {
            const data = await fetchJson<SolicitacaoDetail>(`/api/solicitacoes-vaga/${encodeURIComponent(id)}`);
            setSolicDetail(data);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao carregar detalhes da solicitação.");
            setSolicDetailOpen(false);
        } finally {
            setSolicDetailLoading(false);
        }
    }

    async function executeApproval(action: "approve" | "reject" | "request-changes") {
        if (!solicDetail?.id) return;
        setApprovalActing(true);
        try {
            await fetchJson(`/api/solicitacoes-vaga/${encodeURIComponent(solicDetail.id)}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs.trim() || null }),
            });
            toast.success(
                action === "approve"
                    ? "Solicitação aprovada."
                    : action === "reject"
                        ? "Solicitação reprovada."
                        : "Solicitação devolvida para ajustes.",
            );
            setSolicDetailOpen(false);
            setSolicDetail(null);
            await Promise.all([syncList(), loadSolicitacoes(), loadApprovals()]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao processar aprovação.");
        } finally {
            setApprovalActing(false);
        }
    }

    async function executeApproveRh() {
        if (!solicDetail?.id) return;
        setApprovalActing(true);
        try {
            await fetchJson(`/api/solicitacoes-vaga/${encodeURIComponent(solicDetail.id)}/approve-rh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs.trim() || null }),
            });
            toast.success("Aprovação RH registrada. Vaga gerada em rascunho.");
            setSolicDetailOpen(false);
            setSolicDetail(null);
            await Promise.all([syncList(), loadSolicitacoes(), loadApprovals()]);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao aprovar como RH.");
        } finally {
            setApprovalActing(false);
        }
    }

    async function duplicateVaga(id: string) {
        const v = rows.find((x) => x.id === id);
        const ok = await confirmDialog({
            title: "Duplicar vaga",
            description: `Duplicar "${v?.titulo ?? ""}"?`,
            confirmText: "Duplicar",
        });
        if (!ok) return;

        try {
            const d = await fetchJson<unknown>(`${BASE}/api/vagas/${encodeURIComponent(id)}`);
            const r = asRecord(d) ?? {};
            const baseCode = pickString(r.codigo, "").trim();
            const baseTitle = pickString(r.titulo, "").trim();
            r.codigo = baseCode ? `${baseCode}-COPY`.slice(0, 40) : null;
            r.titulo = baseTitle ? `${baseTitle} (Cópia)`.slice(0, 160) : "Cópia";
            await fetchJson(`${BASE}/api/vagas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(r),
            });
            toast.success("Vaga duplicada.");
            await syncList();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao duplicar.");
        }
    }

    async function deleteVaga(id: string) {
        const v = rows.find((x) => x.id === id);
        const nome = (v?.titulo ?? "").trim();

        const confirmed = await confirmDialog({
            title: "Excluir vaga",
            description: nome
                ? `Tem certeza que deseja excluir a vaga "${nome}"? Esta ação não pode ser desfeita.`
                : `Excluir vaga sem título (ID: ${id})?`,
            confirmText: "Excluir",
            destructive: true,
        });
        if (!confirmed) return;

        try {
            await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
            setRows((prev) => prev.filter((x) => x.id !== id));
            toast.success("Vaga excluída.");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (isVagaDeleteRestrictedByCandidates(msg)) {
                const payload = await fetchJson<unknown>(`${BASE}/api/candidatos?vagaId=${encodeURIComponent(id)}&pageSize=1000`).catch(() => null);
                const vinculados = mapCandidatosList(payload);
                const count = vinculados.length || "alguns";

                // Opção 1: desvincular e manter como talentos (recomendado)
                const manter = await confirmDialog({
                    title: "Candidatos vinculados",
                    description: `Existem ${count} candidato(s) vinculados a esta vaga. Deseja manter os dados como talentos na base?`,
                    confirmText: "Manter como talentos",
                    cancelText: "Excluir tudo",
                    destructive: false,
                });

                if (manter) {
                    await fetchJson(`${BASE}/api/candidatos/desvincular-da-vaga/${encodeURIComponent(id)}`, { method: "POST" });
                    await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
                    setRows((prev) => prev.filter((x) => x.id !== id));
                    toast.success("Vaga excluída. Candidatos mantidos como talentos.");
                    return;
                }

                // Opção 2: excluir tudo — pede segunda confirmação
                const confirmaExcluir = await confirmDialog({
                    title: "Excluir candidatos permanentemente",
                    description: `Isso excluirá permanentemente ${count} candidato(s) e a vaga. Esta ação não pode ser desfeita.`,
                    confirmText: "Excluir tudo",
                    destructive: true,
                });
                if (!confirmaExcluir) return;

                // Coleta falhas com razão estruturada em vez de só contar.
                // Quando o backend retorna 409 com {message}, extraímos e mostramos
                // a lista exata de candidatos que não puderam ser excluídos e o motivo
                // de cada um — evita a experiência antiga de "Falha ao excluir 4
                // candidato(s)" sem explicação. fetchJson joga Error("HTTP 409: {json}").
                const falhas: { nome: string; motivo: string }[] = [];
                for (const candidato of vinculados) {
                    try {
                        await fetchJson(`${BASE}/api/candidatos/${encodeURIComponent(candidato.id)}`, { method: "DELETE" });
                    } catch (err) {
                        const raw = err instanceof Error ? err.message : String(err);
                        const bodyStart = raw.indexOf(": ");
                        const body = bodyStart >= 0 ? raw.slice(bodyStart + 2) : raw;
                        let motivo = raw;
                        try {
                            const parsed = JSON.parse(body) as { message?: string };
                            if (parsed?.message) motivo = parsed.message;
                        } catch { /* body não é JSON */ }
                        const nome = (candidato as { nome?: string; email?: string }).nome
                            ?? (candidato as { email?: string }).email
                            ?? candidato.id;
                        falhas.push({ nome, motivo });
                    }
                }

                if (falhas.length > 0) {
                    // Toast longo + confirm dialog com a lista detalhada.
                    const detalhes = falhas.map((f) => `• ${f.nome}: ${f.motivo}`).join("\n");
                    await confirmDialog({
                        title: `${falhas.length} candidato(s) não puderam ser excluídos`,
                        description: detalhes + "\n\nA vaga não foi excluída. Resolva os vínculos e tente novamente.",
                        confirmText: "Entendi",
                        cancelText: "",
                        destructive: false,
                    });
                    return;
                }

                await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}`, { method: "DELETE" });
                setRows((prev) => prev.filter((x) => x.id !== id));
                toast.success("Vaga e candidatos excluídos.");
                return;
            }

            toast.error(msg || "Falha ao excluir vaga.");
        }
    }

    async function cancelVaga(id: string) {
        const v = rows.find((x) => x.id === id);
        const nome = (v?.titulo ?? "").trim();

        const confirmed = await confirmDialog({
            title: "Cancelar vaga",
            description: `Tem certeza que deseja cancelar${nome ? ` a vaga "${nome}"` : " esta vaga"}? Os candidatos vinculados serão mantidos na base.`,
            confirmText: "Cancelar vaga",
            cancelText: "Voltar",
            destructive: true,
        });
        if (!confirmed) return;

        try {
            await fetchJson(`${BASE}/api/vagas/${encodeURIComponent(id)}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: 8 }), // VagaStatus.Cancelada
            });
            setRows((prev) => prev.map((r) => r.id === id ? { ...(r as Record<string, unknown>), status: "Cancelada" } as typeof r : r));
            toast.success("Vaga cancelada.");
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Falha ao cancelar vaga.");
        }
    }

    const currentVagaDetail = vagaDetail;
    const currentVagaId = pickString(currentVagaDetail?.id, "");
    const currentVagaTitle = pickString(currentVagaDetail?.titulo, "Vaga");
    const currentVagaArea = pickString(currentVagaDetail?.centroCustoName ?? currentVagaDetail?.areaName ?? currentVagaDetail?.area, "—");
    const currentVagaDepartment = pickString(currentVagaDetail?.centroCustoName ?? currentVagaDetail?.departmentName ?? currentVagaDetail?.department, "—");
    const currentVagaStatus = pickString(currentVagaDetail?.status, "");
    const currentVagaVisibilidade = pickString(currentVagaDetail?.visibilidade, "");
    const visibilidadePermitePortal = ["Externa", "InternaEExterna"].includes(currentVagaVisibilidade);
    const vagaAberta = currentVagaStatus.toLowerCase() === "aberta";
    const currentVagaCodigo = pickString(currentVagaDetail?.codigo, "—");
    const currentVagaModalidade = pickString(currentVagaDetail?.modalidade, "—");
    const currentVagaSenioridade = pickString(currentVagaDetail?.senioridade, "—");
    const currentVagaCidade = pickString(currentVagaDetail?.cidade, "").trim();
    const currentVagaUf = pickString(currentVagaDetail?.uf, "").trim();
    const currentVagaLocation = [currentVagaCidade, currentVagaUf].filter(Boolean).join(" / ") || "—";
    const currentVagaMatch = clamp(pickNumber(currentVagaDetail?.threshold ?? currentVagaDetail?.matchMinimoPercentual, 0), 0, 100);
    const currentVagaQtd = pickNumber(currentVagaDetail?.quantidadeVagas, 0);
    const currentVagaResumo = pickString(currentVagaDetail?.resumoPitch ?? currentVagaDetail?.descricaoInterna, "").trim();
    const currentVagaTipoContratacao = pickString(currentVagaDetail?.tipoContratacao, "");
    const currentVagaPrioridade = pickString(currentVagaDetail?.prioridade, "");
    const currentVagaSalMin = pickString(currentVagaDetail?.salarioMinimo, "");
    const currentVagaSalMax = pickString(currentVagaDetail?.salarioMaximo, "");
    const currentVagaMoeda = pickString(currentVagaDetail?.moeda, "").toUpperCase();
    const currentVagaRecrutador = pickString(currentVagaDetail?.recrutadorResponsavel ?? currentVagaDetail?.recrutadorResponsavelNome, "");
    const currentVagaGestor = pickString(currentVagaDetail?.gestorRequisitante ?? currentVagaDetail?.gestorRequisitanteNome, "");
    const currentVagaDescPublica = pickString(currentVagaDetail?.descricaoPublica, "").trim();
    const currentVagaTags = pickString(currentVagaDetail?.tagsKeywords ?? currentVagaDetail?.tagsResponsabilidades, "").trim();
    const fmtSalary = () => {
        if (!currentVagaSalMin && !currentVagaSalMax) return "—";
        const fmt = (v: string) => { const n = parseFloat(v); return isNaN(n) ? v : n.toLocaleString("pt-BR", { minimumFractionDigits: 0 }); };
        const prefix = currentVagaMoeda && currentVagaMoeda !== "BRL" ? `${currentVagaMoeda} ` : "R$ ";
        if (currentVagaSalMin && currentVagaSalMax) return `${prefix}${fmt(currentVagaSalMin)} – ${fmt(currentVagaSalMax)}`;
        return `${prefix}${fmt(currentVagaSalMin || currentVagaSalMax)}`;
    };
    const prioridadeMeta: Record<string, { label: string; cls: string }> = {
        baixa: { label: "Baixa", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" },
        normal: { label: "Normal", cls: "text-sky-700 bg-sky-50 border-sky-200" },
        alta: { label: "Alta", cls: "text-amber-700 bg-amber-50 border-amber-200" },
        urgente: { label: "Urgente", cls: "text-red-700 bg-red-50 border-red-200" },
        critica: { label: "Crítica", cls: "text-red-800 bg-red-100 border-red-300" },
    };
    const priMeta = prioridadeMeta[currentVagaPrioridade.toLowerCase()] ?? { label: currentVagaPrioridade || "—", cls: "text-muted-foreground bg-muted/30 border-border/50" };
    const flowSteps = showManagerSections ? [
        {
            step: "1",
            title: "Solicite ou acompanhe a abertura",
            description: "Use o mesmo painel para criar solicitações, revisar pendências e enxergar quando a vaga estiver liberada.",
            icon: Plus,
        },
        {
            step: "2",
            title: "Valide aprovações",
            description: "As solicitações que ainda dependem de análise ficam visíveis ao lado, sem trocar de tela.",
            icon: ShieldCheck,
        },
        {
            step: "3",
            title: "Consulte as vagas abertas",
            description: "Assim que aprovadas, as vagas entram na lista principal para o RH tocar a seleção.",
            icon: Briefcase,
        },
    ] : [
        {
            step: "1",
            title: "Configure e publique a vaga",
            description: "Ajuste dados, requisitos e visibilidade. Na aba Publicação, ative o portal e gere o link para candidatos externos.",
            icon: PenSquare,
        },
        {
            step: "2",
            title: "Rode o matching",
            description: "Abra o matching da vaga para priorizar candidatos, aprovar, reprovar ou manter em análise.",
            icon: ShieldCheck,
        },
        {
            step: "3",
            title: "Envie para rodadas",
            description: "Os aprovados seguem para rodadas de seleção e depois para o processo seletivo estruturado.",
            icon: FolderOpen,
        },
        {
            step: "4",
            title: "Feche com admissão",
            description: "Depois da etapa seletiva, o candidato aprovado segue para pré-admissão e contratação.",
            icon: CheckCircle2,
        },
    ];

    return (
        <section className="vagas-font-135x space-y-4">
            <style>{VAGAS_FONT_135X_STYLE}</style>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">Quadro de Vagas</h1>
            </div>

            {/* Tutorial colapsado */}
            <details className="group rounded-lg border border-border/40 bg-card shadow-sm">
                <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2">
                    <svg className="size-3.5 shrink-0 transition-transform group-open:rotate-90" viewBox="0 0 16 16" fill="currentColor"><path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z"/></svg>
                    Como funciona o fluxo de vagas?
                </summary>
                <div className={`px-4 pb-3 pt-1 grid gap-2 ${showManagerSections ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
                    {flowSteps.map((step) => (
                        <div key={step.step} className="flex items-start gap-2.5 rounded-lg bg-slate-50/80 p-3">
                            <div className="rounded-lg bg-white border border-border/50 p-1.5 shrink-0 shadow-sm">
                                <step.icon className="size-3.5 text-slate-500" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[11px] font-semibold text-foreground">{step.title}</div>
                                <div className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{step.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </details>

            {/* ── next step banner ── */}
            {lastCreatedVagaId && (
                <NextStepBanner
                    variant="success"
                    title="Vaga criada!"
                    description="Configure as etapas de seleção e publique no portal para começar a receber candidatos."
                    actions={[
                        { label: "Abrir Vaga", href: `/vagas/hub?id=${encodeURIComponent(lastCreatedVagaId)}` },
                    ]}
                    onDismiss={() => setLastCreatedVagaId(null)}
                />
            )}

            {/* Main panel */}
            <div className="rounded-xl border border-border/40 bg-card shadow-sm">
                {/* Filters bar — row 1: busca e visualização */}
                <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2.5">
                    <div className="relative min-w-[180px] flex-1 max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8 h-8 text-sm" placeholder="Buscar vaga..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    <div className="flex items-center rounded-md border border-input bg-background p-0.5">
                        <button type="button" className={`inline-flex h-8 w-10 items-center justify-center rounded-sm text-xs transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("list")} title="Lista">
                            <List className="size-3" />
                        </button>
                        <button type="button" className={`inline-flex h-8 w-10 items-center justify-center rounded-sm text-xs transition-colors ${viewMode === "kanban" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setViewMode("kanban")} title="Kanban">
                            <Columns3 className="size-3" />
                        </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">{filtered.length} resultado(s)</span>
                </div>

                {viewMode === "list" ? (
                    <>
                        <div className="overflow-x-auto px-2 py-1">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-32 cursor-pointer select-none text-center" onClick={() => toggleSort("codigo")}>Código RM {sortIcon("codigo")}</TableHead>
                                        <TableHead className="min-w-[360px] cursor-pointer select-none" onClick={() => toggleSort("titulo")}>Vaga {sortIcon("titulo")}</TableHead>
                                        <TableHead className="min-w-[180px] cursor-pointer select-none" onClick={() => toggleSort("secao")}>Seção {sortIcon("secao")}</TableHead>
                                        <TableHead className="w-24 cursor-pointer select-none text-center" onClick={() => toggleSort("posicoes")}>Posições {sortIcon("posicoes")}</TableHead>
                                        <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("dataRequisicao")}>Data Requisição {sortIcon("dataRequisicao")}</TableHead>
                                        <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("createdAt")}>Data Abertura {sortIcon("createdAt")}</TableHead>
                                        <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("abertoHa")}>Aberto há {sortIcon("abertoHa")}</TableHead>
                                        <TableHead className="cursor-pointer select-none text-center" onClick={() => toggleSort("status")}>Status {sortIcon("status")}</TableHead>
                                        <TableHead className="w-12" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                {Array.from({ length: 9 }).map((__, j) => (
                                                    <TableCell key={j}>
                                                        <div className="h-4 animate-pulse rounded bg-muted" />
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))
                                    ) : paged.length === 0 ? (
                                        /* J2 — Rich empty state */
                                        <TableRow className="hover:bg-transparent">
                                            <TableCell colSpan={9} className="py-4">
                                                <EmptyState
                                                    icon={Briefcase}
                                                    title={rows.length === 0 ? "Nenhuma vaga ainda" : "Nenhuma vaga encontrada"}
                                                    description={
                                                        rows.length === 0
                                                            ? "Crie sua primeira vaga para começar a recrutar."
                                                            : "Nenhum resultado para os filtros aplicados. Tente ajustá-los."
                                                    }
                                                    actions={
                                                        rows.length === 0
                                                            ? []
                                                            : [{ label: "Limpar busca", onClick: () => setQ("") }]
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        paged.map((vaga) => {
                                            // A2 — Stale/aging visual treatment
                                            const vagaRaw = vaga as Record<string, unknown>;
                                            const rowAlertaAtivo = !!(vagaRaw.alertaVagaSemFill as boolean | undefined);
                                            const rowDiasSemFill = (vagaRaw.alertaDiasSemFill as number | undefined) ?? 0;
                                            const rowBorderCls = rowAlertaAtivo
                                                ? rowDiasSemFill > 7
                                                    ? "border-l-4 border-red-400"
                                                    : "border-l-4 border-amber-400"
                                                : "";
                                            return (
                                                <TableRow
                                                    key={vaga.id}
                                                    className={`cursor-pointer hover:bg-muted/40 ${rowBorderCls}`}
                                                    onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(vaga.id)}`)}
                                                >
                                                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                                                        {vagaCodigoRm(vaga) || "—"}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div>
                                                                <div className="text-sm font-medium flex items-center gap-2 flex-wrap">
                                                                    <span title={vaga.titulo ?? ""}>{truncateTitle(vaga.titulo)}</span>
                                                                    {/* Origem TOTVS RM (refactor 2026-04-26) */}
                                                                    {(() => {
                                                                        const origem = vagaRaw.origemTipo as number | string | undefined;
                                                                        const substNome = vagaRaw.substituindoNome as string | undefined;
                                                                        if (origem == null || origem === 0 || origem === "Manual") return null;
                                                                        const origemNum = typeof origem === "number" ? origem : ({ Manual: 0, AumentoQuadro: 1, SubstituicaoDesligamento: 2, SubstituicaoPromocao: 3, Direta: 4 } as Record<string, number>)[origem] ?? 0;
                                                                        const cfg = {
                                                                            1: { label: "Aumento de quadro", cls: "bg-blue-100 text-blue-700 border-blue-200", title: "Vaga nova (VREQAUMENTOQUADRO)" },
                                                                            2: { label: substNome ? `Subst. ${substNome}` : "Substituição (deslig.)", cls: "bg-orange-100 text-orange-700 border-orange-200", title: substNome ? `Substituindo ${substNome} (desligamento)` : "Substituição por desligamento" },
                                                                            3: { label: "Subst. (promoção)", cls: "bg-violet-100 text-violet-700 border-violet-200", title: "Substituição por promoção/transferência" },
                                                                            4: { label: "Direta", cls: "bg-slate-100 text-slate-600 border-slate-200", title: "Vaga direta no TOTVS RM (sem requisição-pai identificada)" },
                                                                        }[origemNum];
                                                                        if (!cfg) return null;
                                                                        return (
                                                                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${cfg.cls}`} title={cfg.title}>
                                                                                {cfg.label}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            {typeof vaga.hasDetail === "boolean" && vaga.hasDetail && (
                                                                <Badge variant="secondary" className="shrink-0">Detalhes</Badge>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="max-w-[220px] truncate text-xs text-muted-foreground" title={vagaSecao(vaga)}>
                                                            {vagaSecao(vaga) || "—"}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center text-sm font-mono">
                                                        {vagaPosicoes(vaga) || "—"}
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs text-muted-foreground">
                                                        {vagaDataRequisicao(vaga) ? new Date(vagaDataRequisicao(vaga)).toLocaleDateString("pt-BR") : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs text-muted-foreground">
                                                        {(() => {
                                                            const dt = vagaDataAbertura(vaga);
                                                            return dt ? new Date(dt).toLocaleDateString("pt-BR") : "—";
                                                        })()}
                                                    </TableCell>
                                                    <TableCell className="text-center text-xs text-muted-foreground">
                                                        {formatOpenDays(vagaDataRequisicao(vaga))}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                            <VagaStatusBadge status={vaga.status} />
                                                            {(() => {
                                                                const raw = vaga as Record<string, unknown>;
                                                                const rodadaNum = raw.rodadaAtivaNumero as number | null | undefined;
                                                                const rodadaCands = (raw.rodadaAtivaCandidatos as number | undefined) ?? 0;
                                                                const statusAtual = (vaga.status ?? "").toLowerCase();
                                                                if (rodadaNum == null || statusAtual === "rascunho") return null;
                                                                return (
                                                                    <>
                                                                        <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                            Publicada
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${rodadaCands} candidato(s) nesta rodada`}>
                                                                            <Users className="size-3" />{rodadaCands}
                                                                        </span>
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="outline" size="icon-sm">
                                                                    <MoreHorizontal className="size-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                <DropdownMenuItem onClick={() => void openVagaDetail(vaga.id)}>
                                                                    <Eye className="mr-2 size-4" />
                                                                    Ver detalhes
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled>
                                                                    <FolderOpen className="mr-2 size-4" />
                                                                    Rodadas
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem disabled>
                                                                    <ShieldCheck className="mr-2 size-4" />
                                                                    Matching IA
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => router.push(`/candidatos?vagaId=${encodeURIComponent(vaga.id)}`)}>
                                                                    <Users className="mr-2 size-4" />
                                                                    Candidatos
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={() => openEdit(vaga.id)}>
                                                                    <PenSquare className="mr-2 size-4" />
                                                                    Editar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => openSolicitacaoEditor(null, { vagaId: vaga.id, jobPositionId: (vaga as any).jobPositionId ?? null, titulo: vaga.titulo ?? "" })}>
                                                                    <Plus className="mr-2 size-4" />
                                                                    Nova Requisição
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => void copyPortalLink(vaga.id)}>
                                                                    <Copy className="mr-2 size-4" />
                                                                    Copiar link do portal
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={() => void duplicateVaga(vaga.id)}>
                                                                    <FileText className="mr-2 size-4" />
                                                                    Duplicar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                {(() => {
                                                                    const st = (vaga.status as string ?? "").toLowerCase();
                                                                    const semOcupacao = (vaga.headcountOcupado ?? 0) === 0;
                                                                    if (st === "rascunho" || (st === "cancelada" && semOcupacao)) {
                                                                        return (
                                                                            <DropdownMenuItem
                                                                                className="text-destructive focus:text-destructive"
                                                                                onClick={() => void deleteVaga(vaga.id)}
                                                                            >
                                                                                <Trash2 className="mr-2 size-4" />
                                                                                Excluir
                                                                            </DropdownMenuItem>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                                {!["cancelada", "encerrada", "rascunho"].includes((vaga.status as string ?? "").toLowerCase()) && (
                                                                    <DropdownMenuItem
                                                                        className="text-orange-600 focus:text-orange-600"
                                                                        onClick={() => void cancelVaga(vaga.id)}
                                                                    >
                                                                        <Ban className="mr-2 size-4" />
                                                                        Cancelar vaga
                                                                    </DropdownMenuItem>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="border-t border-border/40 px-4 py-3">
                            <PaginationBar
                                page={page}
                                pageSize={pageSize}
                                totalItems={filtered.length}
                                onPageChange={setPage}
                                onPageSizeChange={setPageSize}
                    />
                </div>
                    </>
                ) : (
                    /* ── Kanban View ── */
                    <div className="p-4 overflow-x-auto">
                        {loading ? (
                            <div className="flex gap-4">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="w-72 shrink-0 space-y-3">
                                        <div className="h-8 animate-pulse rounded-lg bg-muted" />
                                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                                        <div className="h-24 animate-pulse rounded-lg bg-muted" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex gap-4 items-start">
                                {(["rascunho", "aberta", "pausada", "fechada", "preenchida"] as const).map((col) => {
                                    const meta = VAGA_STATUS[col];
                                    const colVagas = filtered.filter((v) => {
                                        const s = (v.status ?? "").toLowerCase();
                                        if (col === "aberta") return s === "aberta" || s === "ativa";
                                        if (col === "fechada") return s === "fechada" || s === "encerrada";
                                        return s === col;
                                    });
                                    return (
                                        <div
                                            key={col}
                                            className={`w-72 shrink-0 flex flex-col rounded-xl border bg-muted/10 transition-colors ${dragOverCol === col ? "border-primary/60 bg-primary/5" : "border-border/50"}`}
                                            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
                                            onDragLeave={() => setDragOverCol(null)}
                                            onDrop={(e) => { e.preventDefault(); const vagaId = e.dataTransfer.getData("vagaId"); if (vagaId) void handleDrop(vagaId, col); }}
                                        >
                                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
                                                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                                                <span className="text-xs text-muted-foreground ml-auto">{colVagas.length}</span>
                                            </div>
                                            <div className="flex-1 space-y-2 p-2 max-h-[calc(100vh-320px)] overflow-y-auto">
                                                {colVagas.length === 0 ? (
                                                    <div className="rounded-lg border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
                                                        Nenhuma vaga
                                                    </div>
                                                ) : colVagas.map((vaga) => {
                                                    const location = [vaga.cidade, vaga.uf].filter(Boolean).join(" / ");
                                                    const threshold = clamp(pickNumber(vaga.threshold ?? vaga.matchMinimoPercentual, 0), 0, 100);
                                                    return (
                                                        <div
                                                            key={vaga.id}
                                                            draggable
                                                            onDragStart={(e) => { e.dataTransfer.setData("vagaId", vaga.id); e.dataTransfer.effectAllowed = "move"; }}
                                                            className="rounded-lg border border-border/50 bg-card p-3 shadow-sm cursor-grab hover:border-primary/40 hover:shadow-md transition-all active:cursor-grabbing"
                                                            onClick={() => router.push(`/vagas/hub?id=${encodeURIComponent(vaga.id)}`)}
                                                        >
                                                            <div className="text-sm font-medium leading-tight truncate" title={vaga.titulo ?? ""}>
                                                                {truncateTitle(vaga.titulo)}
                                                            </div>
                                                            {vaga.codigo && <div className="mt-1 text-[11px] font-mono text-muted-foreground">{vaga.codigo}</div>}
                                                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                                                                {vaga.area && <span>{vaga.area}</span>}
                                                                {vaga.modalidade && <span>{vaga.modalidade}</span>}
                                                                {location && (
                                                                    <span className="inline-flex items-center gap-0.5">
                                                                        <MapPin className="size-3" />
                                                                        {location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 flex items-center justify-between">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-[11px] text-muted-foreground">Match {threshold}%</span>
                                                                    {(() => {
                                                                        const raw = vaga as Record<string, unknown>;
                                                                        const ocupado = (raw.headcountOcupado as number | undefined) ?? 0;
                                                                        const autorizado = (raw.headcountAutorizado as number | undefined) ?? 1;
                                                                        const provisorio = (raw.headcountProvisorio as number | undefined) ?? 0;
                                                                        const pendente = (raw.headcountPendente as number | undefined) ?? 0;
                                                                        const limite = autorizado + provisorio;
                                                                        const acima = ocupado > autorizado;
                                                                        const alertaAtivo = !!(raw.alertaVagaSemFill as boolean | undefined);
                                                                        const diasSemFill = raw.alertaDiasSemFill as number | undefined;
                                                                        const alertaHCProvVencido = !!(raw.alertaHCProvVencido as boolean | undefined);
                                                                        const corTexto = acima
                                                                            ? ocupado > autorizado + 1
                                                                                ? "text-red-500"
                                                                                : "text-orange-500"
                                                                            : ocupado === autorizado
                                                                                ? "text-green-500"
                                                                                : "text-muted-foreground";
                                                                        return (
                                                                            <>
                                                                                <span className="text-[10px] text-muted-foreground/60">·</span>
                                                                                <span className={`text-[11px] tabular-nums ${corTexto}`}>
                                                                                    {ocupado}/{limite}{acima ? " ⚠" : ""}
                                                                                </span>
                                                                                {provisorio > 0 && (
                                                                                    <span className="rounded-full px-1 py-0.5 text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                                                                        +{provisorio}p
                                                                                    </span>
                                                                                )}
                                                                                {pendente > 0 && (
                                                                                    <span className="rounded-full px-1 py-0.5 text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" title="Headcount pendente de decisão RH">
                                                                                        +{pendente}p
                                                                                    </span>
                                                                                )}
                                                                                {alertaAtivo && (
                                                                                    <span className="rounded-full px-1 py-0.5 text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                                                                                        {diasSemFill}d
                                                                                    </span>
                                                                                )}
                                                                                {alertaHCProvVencido && (
                                                                                    <span className="rounded-full px-1 py-0.5 text-[9px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" title="HC Prov. Vencido">
                                                                                        HC✗
                                                                                    </span>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={(e) => e.stopPropagation()}>
                                                                            <MoreHorizontal className="size-3.5 text-muted-foreground" />
                                                                        </button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end" className="w-44">
                                                                        <DropdownMenuItem onClick={() => void openVagaDetail(vaga.id)}>
                                                                            <Eye className="mr-2 size-3.5" />Detalhes
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => { persistMatchingContext(vaga.id); router.push(`/matching?vagaId=${encodeURIComponent(vaga.id)}`); }}>
                                                                            <ShieldCheck className="mr-2 size-3.5" />Matching
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => router.push(`/candidatos?vagaId=${encodeURIComponent(vaga.id)}`)}>
                                                                            <Users className="mr-2 size-3.5" />Candidatos
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={() => openEdit(vaga.id)}>
                                                                            <PenSquare className="mr-2 size-3.5" />Editar
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => openSolicitacaoEditor(null, { vagaId: vaga.id, jobPositionId: (vaga as any).jobPositionId ?? null, titulo: vaga.titulo ?? "" })}>
                                                                            <Plus className="mr-2 size-3.5" />Nova Requisição
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={() => void copyPortalLink(vaga.id)}>
                                                                            <Copy className="mr-2 size-3.5" />Copiar link
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            </div>
                                                            {/* ── Rodada ativa (Publicada) ── */}
                                                            {(() => {
                                                                const raw = vaga as Record<string, unknown>;
                                                                const rodadaNum = raw.rodadaAtivaNumero as number | null | undefined;
                                                                const rodadaCands = (raw.rodadaAtivaCandidatos as number | undefined) ?? 0;
                                                                const statusAtual = (vaga.status ?? "").toLowerCase();
                                                                if (rodadaNum == null || statusAtual === "rascunho") return null;
                                                                return (
                                                                    <div className="mt-1.5 flex items-center gap-1.5">
                                                                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                                                            Publicada
                                                                        </span>
                                                                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title={`${rodadaCands} candidato(s) nesta rodada`}>
                                                                            <Users className="size-3" />{rodadaCands}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

            </div>

            <Dialog open={vagaDetailOpen} onOpenChange={setVagaDetailOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
                    <DialogHeader className="sr-only"><DialogTitle>{currentVagaTitle}</DialogTitle><DialogDescription>Detalhes da vaga</DialogDescription></DialogHeader>
                    {vagaDetailLoading ? (
                        <div className="space-y-3 p-6">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* ── Header ── */}
                            <div className="bg-gradient-to-r from-primary/5 via-primary/3 to-transparent px-6 pt-6 pb-4 border-b border-border/40">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-bold tracking-tight truncate">{currentVagaTitle}</h2>
                                            <VagaStatusBadge status={currentVagaStatus} />
                                        </div>
                                        <div className="mt-1.5 flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                                            {currentVagaCodigo !== "—" && <span className="font-mono text-xs bg-muted/60 px-1.5 py-0.5 rounded">{currentVagaCodigo}</span>}
                                            <span>{currentVagaArea}</span>
                                            <span className="text-border">|</span>
                                            <span>{currentVagaDepartment}</span>
                                        </div>
                                    </div>
                                    {currentVagaPrioridade && (
                                        <span className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-semibold ${priMeta.cls}`}>
                                            {priMeta.label}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="px-6 pb-6 space-y-5">
                                {/* ── Info Grid ── */}
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 text-sm pt-2">
                                    <div className="flex items-center gap-2">
                                        <Briefcase className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Modalidade</div><div className="font-medium">{currentVagaModalidade}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Target className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Senioridade</div><div className="font-medium">{currentVagaSenioridade}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Local</div><div className="font-medium">{currentVagaLocation}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Banknote className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Faixa salarial</div><div className="font-medium">{fmtSalary()}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <FileText className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Contratação</div><div className="font-medium">{currentVagaTipoContratacao || "—"}</div></div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Users className="size-4 text-muted-foreground shrink-0" />
                                        <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Vagas</div><div className="font-medium">{currentVagaQtd || "—"}</div></div>
                                    </div>
                                </div>

                                {/* ── Datas & Match ── */}
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
                                    <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> Início: {formatDate(pickString(currentVagaDetail?.dataInicio, "")) || "—"}</span>
                                    <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> Encerramento: {formatDate(pickString(currentVagaDetail?.dataEncerramento, "")) || "—"}</span>
                                    <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3.5" /> Match min: <strong className="text-foreground">{currentVagaMatch}%</strong></span>
                                    <span className="inline-flex items-center gap-1"><RefreshCw className="size-3.5" /> Atualizada: {formatDateTime(pickString(currentVagaDetail?.updatedAt, "")) || "—"}</span>
                                </div>

                                {/* ── Responsáveis ── */}
                                {(currentVagaRecrutador || currentVagaGestor) && (
                                    <div className="flex flex-wrap gap-6 text-sm">
                                        {currentVagaRecrutador && (
                                            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Recrutador</div><div className="font-medium">{currentVagaRecrutador}</div></div>
                                        )}
                                        {currentVagaGestor && (
                                            <div><div className="text-[10px] uppercase text-muted-foreground tracking-wider">Gestor requisitante</div><div className="font-medium">{currentVagaGestor}</div></div>
                                        )}
                                    </div>
                                )}

                                {/* ── Resumo ── */}
                                {currentVagaResumo && (
                                    <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Resumo</div>
                                        <div className="text-sm leading-relaxed whitespace-pre-line">{currentVagaResumo}</div>
                                    </div>
                                )}

                                {/* ── Descrição Pública ── */}
                                {currentVagaDescPublica && (
                                    <div className="rounded-lg bg-muted/30 border border-border/40 p-4">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1.5">Descrição pública</div>
                                        <div className="text-sm leading-relaxed whitespace-pre-line">{currentVagaDescPublica}</div>
                                    </div>
                                )}

                                {/* ── Tags ── */}
                                {currentVagaTags && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {currentVagaTags.split(/[;,]/).filter(Boolean).map((tag, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs font-normal">{tag.trim()}</Badge>
                                        ))}
                                    </div>
                                )}

                                {/* ── Checklist da vaga ── */}
                                {currentVagaId && (
                                    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                                        <div className="text-[10px] uppercase text-muted-foreground tracking-wider mb-2">Checklist da vaga</div>
                                        <div className="grid grid-cols-2 gap-2 text-xs">
                                            {[
                                                { label: "Dados básicos", done: !!currentVagaTitle && currentVagaTitle !== "Vaga" },
                                                { label: "Requisitos", done: Array.isArray((vagaDetail as Record<string, unknown> | null)?.requisitos) && ((vagaDetail as Record<string, unknown>).requisitos as unknown[]).length > 0 },
                                                { label: "Matching IA", done: !!pickString((vagaDetail as Record<string, unknown> | null)?.matchingFiltrosRaw, "") },
                                                { label: "Publicação", done: visibilidadePermitePortal },
                                            ].map(item => (
                                                <div key={item.label} className="flex items-center gap-1.5">
                                                    {item.done
                                                        ? <CheckCircle2 className="size-3.5 text-emerald-500" />
                                                        : <div className="size-3.5 rounded-full border-2 border-muted-foreground/30" />}
                                                    <span className={item.done ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ── Portal status callout ── */}
                                {currentVagaId && !vagaAberta && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                                        Vaga em <b>rascunho</b> — portal inativo. Mude o status para &quot;Aberta&quot; na aba <b>Dados</b> para publicar.
                                    </div>
                                )}
                                {currentVagaId && vagaAberta && !visibilidadePermitePortal && (
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400 flex items-center justify-between gap-2">
                                        <span>Portal inativo. Ative a <b>visibilidade</b> como &quot;Externa&quot; para publicar.</span>
                                        <button
                                            className="shrink-0 rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                                            onClick={() => {
                                                setVagaDetailOpen(false);
                                                setEditDefaultTab("publicacao");
                                                openEdit(currentVagaId);
                                            }}
                                        >
                                            Configurar Publicação
                                        </button>
                                    </div>
                                )}

                                {/* ── Actions ── */}
                                <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-4">
                                    {currentVagaId && (
                                        <Button size="sm" onClick={() => { setVagaDetailOpen(false); openEdit(currentVagaId); }}>
                                            <PenSquare className="mr-1.5 size-3.5" />
                                            Editar
                                        </Button>
                                    )}
                                    {currentVagaId && (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => { setVagaDetailOpen(false); persistMatchingContext(currentVagaId); router.push(`/matching?vagaId=${encodeURIComponent(currentVagaId)}`); }}>
                                                <ShieldCheck className="mr-1.5 size-3.5" />
                                                Matching
                                                {vagaCandidateCount != null && vagaCandidateCount > 0 && (
                                                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold min-w-[18px] h-[18px] px-1">{vagaCandidateCount}</span>
                                                )}
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => { setVagaDetailOpen(false); router.push(`/gestao/projetos?vagaId=${encodeURIComponent(currentVagaId)}`); }}>
                                                <FolderOpen className="mr-1.5 size-3.5" />
                                                Projetos
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => { setVagaDetailOpen(false); router.push(`/candidatos?vagaId=${encodeURIComponent(currentVagaId)}`); }}>
                                                <Users className="mr-1.5 size-3.5" />
                                                Candidatos
                                                {vagaCandidateCount != null && vagaCandidateCount > 0 && (
                                                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold min-w-[18px] h-[18px] px-1">{vagaCandidateCount}</span>
                                                )}
                                            </Button>
                                        </>
                                    )}
                                    {currentVagaId && (
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="ml-auto text-muted-foreground"
                                            disabled={!vagaAberta || !visibilidadePermitePortal}
                                            title={
                                                !vagaAberta
                                                    ? "Abra a vaga para ativar o portal"
                                                    : !visibilidadePermitePortal
                                                    ? "Configure Visibilidade → Externa para ativar o portal"
                                                    : "Copiar link do portal de candidatos"
                                            }
                                            onClick={() => void copyPortalLink(currentVagaId)}
                                        >
                                            <Copy className="mr-1.5 size-3.5" />
                                            Copiar link do portal
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={solicDetailOpen} onOpenChange={setSolicDetailOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>{solicDetail?.titulo || "Solicitação de vaga"}</DialogTitle>
                        <DialogDescription>
                            Acompanhe contexto, aprovação e eventuais ajustes da solicitação.
                        </DialogDescription>
                    </DialogHeader>

                    {solicDetailLoading ? (
                        <div className="space-y-3 py-2">
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
                            ))}
                        </div>
                    ) : solicDetail ? (
                        <div className="space-y-5">
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Status</div>
                                    <div className="mt-1"><SolicStatusBadge status={solicDetail.status} /></div>
                                </div>
                                <DetailField label="Tipo" value={resolveTipoLabel(solicDetail.tipoSolicitacao)} />
                                <DetailField label="Urgência" value={resolveUrgenciaMeta(solicDetail.urgencia).label} />
                                <DetailField label="Posições" value={solicDetail.qtdPosicoes} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailField label="Solicitante" value={solicDetail.solicitanteNome || "—"} />
                                <DetailField label="Aprovador" value={solicDetail.aprovadorNome || "—"} />
                                <DetailField label="Centro de Custo" value={solicDetail.centroCustoNome || solicDetail.centroCustoName || "—"} />
                                <DetailField label="Unidade" value={solicDetail.unidadeLotacaoNome || "—"} />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <DetailField label="Criada em" value={formatDateTime(solicDetail.createdAtUtc)} />
                                <DetailField label="Atualizada em" value={formatDateTime(solicDetail.updatedAtUtc)} />
                                <DetailField label="Aprovada em" value={formatDateTime(solicDetail.approvedAtUtc)} />
                                <DetailField label="Confidencial" value={solicDetail.isConfidencial ? "Sim" : "Não"} />
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Justificativa</div>
                                <div className="mt-2 text-sm leading-6 text-foreground">
                                    {solicDetail.justificativa?.trim() || "Sem justificativa registrada."}
                                </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <DetailField label="Substituição de" value={solicDetail.substituidoNome || "—"} />
                                <DetailField label="Vaga gerada" value={solicDetail.vagaId || "Ainda não gerada"} />
                                {((solicDetail as unknown as Record<string, unknown>).etapasFluxo as Array<{ label?: string; aprovadorNome?: string | null; status?: unknown }> | undefined)?.map((etapa, i) => (
                                    <DetailField
                                        key={i}
                                        label={etapa.label || `Etapa ${i + 1}`}
                                        value={`${etapa.aprovadorNome || "—"} · ${resolveApprovalStatusLabel(etapa.status)}`}
                                    />
                                ))}
                            </div>

                            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Observação da aprovação</div>
                                <div className="mt-2 text-sm leading-6 text-foreground">
                                    {solicDetail.observacaoAprovador?.trim() || "Nenhuma observação registrada."}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border/50 p-4">
                                <label className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground" htmlFor="approval-obs">
                                    Observação para ação
                                </label>
                                <textarea
                                    id="approval-obs"
                                    className="mt-2 min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-0 focus:border-ring"
                                    placeholder="Descreva o motivo da aprovação, reprovação ou ajustes solicitados..."
                                    value={approvalObs}
                                    onChange={(e) => setApprovalObs(e.target.value)}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {(isSolicStatus(solicDetail.status, "rascunho") || isSolicStatus(solicDetail.status, "ajustesnecessarios")) && (
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSolicDetailOpen(false);
                                            openSolicitacaoEditor(solicDetail.id);
                                        }}
                                    >
                                        <PenSquare className="mr-1 size-4" />
                                        Editar solicitação
                                    </Button>
                                )}
                                {isSolicStatus(solicDetail.status, "pendenteaprovacao") && (
                                    <>
                                        <Button disabled={approvalActing} onClick={() => void executeApproval("approve")}>
                                            <CheckCircle2 className="mr-1 size-4" />
                                            Aprovar
                                        </Button>
                                        <Button
                                            variant="outline"
                                            disabled={approvalActing}
                                            onClick={() => void executeApproval("request-changes")}
                                        >
                                            Solicitar ajustes
                                        </Button>
                                        <Button
                                            variant="destructive"
                                            disabled={approvalActing}
                                            onClick={() => void executeApproval("reject")}
                                        >
                                            Reprovar
                                        </Button>
                                    </>
                                )}
                                {isSolicStatus(solicDetail.status, "pendenteaprovacaorh") && (
                                    <Button disabled={approvalActing} onClick={() => void executeApproveRh()}>
                                        <CheckCircle2 className="mr-1 size-4" />
                                        Aprovar como RH
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <SolicitacaoFormModal
                open={solicitacaoOpen}
                editId={solicitacaoEditId}
                initialData={solicitacaoInitialData}
                onClose={() => {
                    setSolicitacaoOpen(false);
                    setSolicitacaoEditId(null);
                    setSolicitacaoInitialData(null);
                }}
                onSaved={() => {
                    setSolicitacaoOpen(false);
                    setSolicitacaoEditId(null);
                    setSolicitacaoInitialData(null);
                    void Promise.all([loadSolicitacoes(), loadApprovals()]);
                }}
            />

            <VagaFormModal
                open={editOpen}
                editId={editId}
                prefill={prefillFromSolic as any}
                defaultTab={editDefaultTab as any}
                onClose={() => {
                    setEditOpen(false);
                    setEditId(null);
                    setEditDefaultTab(undefined);
                    setPrefillFromSolic(null);
                }}
                onSaved={(savedVagaId) => {
                    const wasNew = !editId;
                    setEditOpen(false);
                    setEditId(null);
                    setEditDefaultTab(undefined);
                    void syncList();
                    if (wasNew && savedVagaId) {
                        setLastCreatedVagaId(savedVagaId);
                    }
                }}
            />
        </section>
    );
}
