"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    Search,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    FileText,
    Eye,
    Briefcase,
    Palmtree,
    Heart,
    Users,
    MapPin,
    UserCheck,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePendencias } from "@/contexts/PendenciasContext";

import NextStepBanner from "@/components/feedback/NextStepBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

/* ──────────────────────────── types ──────────────────────────── */

type StatusKey = 0 | 1 | 2 | 3 | 4;
type UrgenciaKey = 0 | 1 | 2 | 3;

interface SolicitacaoDetail {
    id: string;
    titulo: string;
    justificativa: string | null;
    qtdPosicoes: number;
    urgencia: number;
    status: number;
    solicitanteId: string;
    solicitanteNome: string | null;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    jobPositionId: string | null;
    jobPositionName: string | null;
    areaId: string | null;
    areaName: string | null;
    unitId: string | null;
    unitName: string | null;
    vagaId: string | null;
    observacaoAprovador: string | null;
    tipoSolicitacao: number;
    isConfidencial: boolean;
    substituidoNome: string | null;
    aprovador1Id: string | null;
    aprovador1Nome: string | null;
    aprovador1Status: number;
    aprovador1DataUtc: string | null;
    aprovador2Id: string | null;
    aprovador2Nome: string | null;
    aprovador2Status: number | null;
    aprovador2DataUtc: string | null;
    aprovador2Habilitado: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
    approvedAtUtc: string | null;
}

// Generic row from any API
type GenericRow = Record<string, unknown> & { id: string };

/* ──────────────────────────── helpers ──────────────────────────── */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function pick(row: GenericRow, key: string, fb = "—") {
    const v = row[key];
    if (v == null) return fb;
    return String(v);
}

const STATUS_MAP: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
};

const URGENCIA_MAP: Record<UrgenciaKey, { label: string; color: string }> = {
    0: { label: "Baixa", color: "bg-sky-500/15 text-sky-700" },
    1: { label: "Média", color: "bg-amber-500/15 text-amber-700" },
    2: { label: "Alta", color: "bg-orange-500/15 text-orange-700" },
    3: { label: "Crítica", color: "bg-red-500/15 text-red-700" },
};

function statusBadge(status: number) {
    const s = STATUS_MAP[(status ?? 0) as StatusKey] ?? STATUS_MAP[0];
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
            <Icon className="size-3" />
            {s.label}
        </span>
    );
}

function urgenciaBadge(urgencia: number) {
    const u = URGENCIA_MAP[(urgencia ?? 1) as UrgenciaKey] ?? URGENCIA_MAP[1];
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${u.color}`}>
            {u.label}
        </span>
    );
}

function FilaBadge() {
    return (
        <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold text-violet-700 shrink-0">
            FILA
        </span>
    );
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
        return "—";
    }
}

const APPROVAL_STATUS: Record<number, { label: string; color: string }> = {
    0: { label: "Pendente", color: "bg-amber-500/15 text-amber-700" },
    1: { label: "Aprovado", color: "bg-emerald-500/15 text-emerald-700" },
    2: { label: "Reprovado", color: "bg-red-500/15 text-red-700" },
};

function approvalChainBadge(status: number) {
    const s = APPROVAL_STATUS[status] ?? APPROVAL_STATUS[0];
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${s.color}`}>
            {s.label}
        </span>
    );
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-xs text-muted-foreground uppercase">{label}</div>
            <div className="text-sm mt-0.5">{value || "—"}</div>
        </div>
    );
}

/**
 * Determines if a row is in "Fila de Perfil" mode:
 * aprovador1Id is null/empty → no specific approver assigned yet, open for claiming.
 */
function isFilaRow(row: GenericRow | SolicitacaoDetail): boolean {
    const a1 = (row as Record<string, unknown>).aprovador1Id;
    return a1 === null || a1 === undefined || a1 === "";
}

/* ──────────────────────────── Tab definitions ──────────────────────────── */

type TabId = "contratacao" | "ferias" | "beneficio" | "dependentes" | "endereco";

interface TabDef {
    id: TabId;
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    api: string;
    assumirApi: string;
    columns: { key: string; label: string; render?: (row: GenericRow) => React.ReactNode }[];
}

const TABS: TabDef[] = [
    {
        id: "contratacao", label: "Contratação", icon: Briefcase,
        color: "text-violet-600", bgColor: "bg-violet-500/15",
        api: "/api/solicitacoes-vaga?status=1",
        assumirApi: "/api/solicitacoes-vaga",
        columns: [
            { key: "titulo", label: "Título" },
            { key: "solicitanteNome", label: "Solicitante" },
            { key: "areaName", label: "Área" },
            { key: "qtdPosicoes", label: "Posições" },
            { key: "urgencia", label: "Urgência", render: (r) => urgenciaBadge(Number(r.urgencia ?? 0)) },
            { key: "createdAtUtc", label: "Data", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "ferias", label: "Férias", icon: Palmtree,
        color: "text-sky-600", bgColor: "bg-sky-500/15",
        api: "/api/colaborador/solicitacoes-ferias?status=1",
        assumirApi: "/api/colaborador/solicitacoes-ferias",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "dataInicio", label: "Início", render: (r) => formatDate(pick(r, "dataInicio")) },
            { key: "dataFim", label: "Fim", render: (r) => formatDate(pick(r, "dataFim")) },
            { key: "dias", label: "Dias" },
            { key: "abonoQtd", label: "Abono", render: (r) => { const v = Number(r.abonoQtd ?? 0); return v > 0 ? `${v}d` : "—"; } },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "beneficio", label: "Benefício", icon: Heart,
        color: "text-pink-600", bgColor: "bg-pink-500/15",
        api: "/api/colaborador/solicitacoes-beneficio?status=1",
        assumirApi: "/api/colaborador/solicitacoes-beneficio",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "tipoBeneficio", label: "Tipo" },
            { key: "tipoAlteracao", label: "Alteração" },
            { key: "descricao", label: "Descrição" },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "dependentes", label: "Dependentes", icon: Users,
        color: "text-indigo-600", bgColor: "bg-indigo-500/15",
        api: "/api/colaborador/solicitacoes-dependente?status=1",
        assumirApi: "/api/colaborador/solicitacoes-dependente",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "dependenteNome", label: "Dependente", render: (r) => pick(r, "dependenteNome", pick(r, "nome", "—")) },
            { key: "parentesco", label: "Parentesco" },
            { key: "tipoSolicitacao", label: "Tipo" },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
    {
        id: "endereco", label: "Endereço", icon: MapPin,
        color: "text-amber-600", bgColor: "bg-amber-500/15",
        api: "/api/colaborador/solicitacoes-endereco?status=1",
        assumirApi: "/api/colaborador/solicitacoes-endereco",
        columns: [
            { key: "colaboradorNome", label: "Colaborador", render: (r) => pick(r, "colaboradorNome", pick(r, "solicitanteNome", "—")) },
            { key: "logradouro", label: "Logradouro" },
            { key: "cidade", label: "Cidade" },
            { key: "uf", label: "UF" },
            { key: "cep", label: "CEP" },
            { key: "createdAtUtc", label: "Data Solic.", render: (r) => formatDate(pick(r, "createdAtUtc")) },
        ],
    },
];

/* ──────────────────────────── component ──────────────────────────── */

const VALID_TAB_IDS: TabId[] = ["contratacao", "ferias", "beneficio", "dependentes", "endereco"];

export default function AprovacoesScreen({ initialTab }: { initialTab?: string }) {
    const pendencias = usePendencias();

    const resolvedInitial: TabId = VALID_TAB_IDS.includes(initialTab as TabId) ? (initialTab as TabId) : "contratacao";
    const [activeTab, setActiveTab] = useState<TabId>(resolvedInitial);
    const [q, setQ] = useState("");
    const [approvalObs, setApprovalObs] = useState("");
    const [acting, setActing] = useState(false);

    /* ── My identity (to filter nominated tasks) ── */
    const [myFuncionarioId, setMyFuncionarioId] = useState<string | null>(null);
    const [meLoaded, setMeLoaded] = useState(false);

    useEffect(() => {
        fetchJson<Record<string, unknown>>("/api/me")
            .then((d) => { if (d?.funcionarioId) setMyFuncionarioId(String(d.funcionarioId)); })
            .catch(() => {})
            .finally(() => setMeLoaded(true));
    }, []);

    /* ── Data per tab ── */
    const [dataMap, setDataMap] = useState<Record<TabId, GenericRow[]>>({
        contratacao: [], ferias: [], beneficio: [], dependentes: [], endereco: [],
    });
    const [loadingMap, setLoadingMap] = useState<Record<TabId, boolean>>({
        contratacao: true, ferias: true, beneficio: true, dependentes: true, endereco: true,
    });

    /* ── Contratação detail (real API) ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detail, setDetail] = useState<SolicitacaoDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [lastApproved, setLastApproved] = useState<{ id: string; titulo: string } | null>(null);

    /* ── Generic detail for other types ── */
    const [genericDetailOpen, setGenericDetailOpen] = useState(false);
    const [genericDetail, setGenericDetail] = useState<GenericRow | null>(null);

    /* ── Fetch all tabs ── */
    const fetchTab = useCallback(async (tab: TabDef) => {
        try {
            const data = await fetchJson<GenericRow[]>(tab.api);
            setDataMap(prev => ({ ...prev, [tab.id]: Array.isArray(data) ? data : [] }));
        } catch {
            setDataMap(prev => ({ ...prev, [tab.id]: [] }));
        } finally {
            setLoadingMap(prev => ({ ...prev, [tab.id]: false }));
        }
    }, []);

    const refreshAll = useCallback(() => {
        setLoadingMap({ contratacao: true, ferias: true, beneficio: true, dependentes: true, endereco: true });
        TABS.forEach(tab => void fetchTab(tab));
    }, [fetchTab]);

    useEffect(() => { refreshAll(); }, [refreshAll]);

    /* ── Row relevance: show only tasks assigned to me OR open fila items ── */
    const isMyRow = useCallback((row: GenericRow): boolean => {
        // Fila de perfil — unclaimed, any profile member can take it
        if (isFilaRow(row)) return true;
        // Nominated directly to me
        if (myFuncionarioId) {
            return row.aprovador1Id === myFuncionarioId || row.aprovador2Id === myFuncionarioId;
        }
        // While me data is still loading, show everything
        return !meLoaded;
    }, [myFuncionarioId, meLoaded]);

    /* ── Counts (per-tab, filtered to relevant items) ── */
    const counts = useMemo(() => {
        const c: Record<TabId, number> = { contratacao: 0, ferias: 0, beneficio: 0, dependentes: 0, endereco: 0 };
        for (const tab of TABS) {
            c[tab.id] = dataMap[tab.id].filter(isMyRow).length;
        }
        return c;
    }, [dataMap, isMyRow]);

    const totalPendente = Object.values(counts).reduce((a, b) => a + b, 0);

    /* ── Filtered list for active tab ── */
    const activeTabDef = TABS.find(t => t.id === activeTab)!;
    const filtered = useMemo(() => {
        const rows = dataMap[activeTab].filter(isMyRow);
        const term = q.trim().toLowerCase();
        if (!term) return rows;
        return rows.filter(r => {
            const blob = Object.values(r).filter(v => typeof v === "string").join(" ").toLowerCase();
            return blob.includes(term);
        });
    }, [dataMap, activeTab, q, isMyRow]);

    /* ── Contratação detail actions ── */
    async function openContratacaoDetail(row: GenericRow) {
        setDetailOpen(true);
        setDetailLoading(true);
        setApprovalObs("");
        try {
            const d = await fetchJson<SolicitacaoDetail>(`/api/solicitacoes-vaga/${row.id}`);
            setDetail(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    async function doContratacaoAction(id: string, action: "approve" | "reject" | "request-changes") {
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        setActing(true);
        try {
            await fetchJson(`/api/solicitacoes-vaga/${id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs || null }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            if (action === "approve" && detail) {
                setLastApproved({ id: detail.id, titulo: detail.titulo });
            }
            setDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setActing(false);
        }
    }

    /* ── Generic detail for non-contratacao types ── */
    function openGenericDetail(row: GenericRow) {
        setGenericDetail(row);
        setGenericDetailOpen(true);
        setApprovalObs("");
    }

    async function doGenericAction(row: GenericRow, action: "approve" | "reject" | "request-changes") {
        const tab = TABS.find(t => t.id === activeTab)!;
        const baseApi = tab.api.split("?")[0];
        const labels = { approve: "Aprovada", reject: "Reprovada", "request-changes": "Ajustes solicitados" };
        setActing(true);
        try {
            await fetchJson(`${baseApi}/${row.id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs || null }),
            });
            toast.success(`Solicitação: ${labels[action]}!`);
            setGenericDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setActing(false);
        }
    }

    /* ── Assumir (Fila de Perfil) — atomically claim the task ── */
    async function doAssumir(row: GenericRow) {
        const tab = TABS.find(t => t.id === activeTab)!;
        setActing(true);
        try {
            await fetchJson(`${tab.assumirApi}/${row.id}/assumir`, { method: "POST" });
            toast.success("Tarefa assumida! Você agora é o aprovador desta solicitação.");
            setDetailOpen(false);
            setGenericDetailOpen(false);
            pendencias.refresh();
            refreshAll();
        } catch (e) {
            const msg = e instanceof Error ? e.message : "";
            if (msg.includes("409")) {
                toast.warning("Esta tarefa já foi assumida por outro usuário. Atualizando lista...");
                refreshAll();
            } else {
                toast.error(`Falha ao assumir: ${msg || "erro"}`);
            }
        } finally {
            setActing(false);
        }
    }

    /* ──────────────────────────── render ──────────────────────────── */
    const isLoading = loadingMap[activeTab];

    return (
        <section className="space-y-4">
            {/* ── header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Minhas Pendências</h1>
                    <div className="text-muted-foreground text-sm mt-0.5">
                        Solicitações que aguardam sua aprovação
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={refreshAll}>
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">Atualizar</span>
                </Button>
            </div>

            {/* ── banner ── */}
            {lastApproved && (
                <NextStepBanner
                    variant="success"
                    title="Solicitação aprovada!"
                    description={`"${lastApproved.titulo}" foi aprovada. Crie a vaga para iniciar o recrutamento.`}
                    actions={[
                        { label: "Criar Vaga", href: `/vagas?newFromSolicitacao=${encodeURIComponent(lastApproved.id)}` },
                    ]}
                    onDismiss={() => setLastApproved(null)}
                />
            )}

            {/* ── legend ── */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
                    Direcionada a você
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full bg-violet-500" />
                    Fila de perfil — qualquer membro pode assumir
                </span>
            </div>

            {/* ── KPI cards ── */}
            <div className="flex flex-wrap gap-2">
                {/* Total */}
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <Clock className="size-3.5 text-amber-600" />
                    <span className="text-[11px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-bold text-amber-600">{totalPendente}</span>
                </div>
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const count = counts[tab.id];
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 backdrop-blur text-left transition-all ${
                                activeTab === tab.id
                                    ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                                    : "border-border/40 bg-card/60 hover:bg-muted/40"
                            }`}
                        >
                            <Icon className={`size-3.5 ${tab.color}`} />
                            <span className="text-[11px] text-muted-foreground font-medium">{tab.label}</span>
                            <span className={`text-sm font-bold ${count > 0 ? tab.color : "text-muted-foreground"}`}>
                                {loadingMap[tab.id] ? "…" : count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── Table ── */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold flex items-center gap-2">
                            {(() => {
                                const Icon = activeTabDef.icon;
                                return <><Icon className={`size-4 ${activeTabDef.color}`} />{activeTabDef.label}</>;
                            })()}
                        </div>
                        <div className="text-muted-foreground text-sm">
                            {isLoading ? "Carregando…" : `${filtered.length} pendência${filtered.length !== 1 ? "s" : ""}`}
                        </div>
                    </div>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="w-[260px] pl-8" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            {activeTabDef.columns.map(col => (
                                <TableHead key={col.key}>{col.label}</TableHead>
                            ))}
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={activeTabDef.columns.length + 1} className="text-center text-muted-foreground py-8">
                                    Carregando…
                                </TableCell>
                            </TableRow>
                        ) : filtered.length ? (
                            filtered.map((row) => {
                                const isFila = isFilaRow(row);
                                return (
                                    <TableRow
                                        key={row.id}
                                        className={`cursor-pointer hover:bg-muted/40 ${isFila ? "border-l-[3px] border-l-violet-400" : ""}`}
                                        onClick={() => activeTab === "contratacao" ? void openContratacaoDetail(row) : openGenericDetail(row)}
                                    >
                                        {activeTabDef.columns.map((col, i) => (
                                            <TableCell key={col.key} className={i === 0 ? "font-semibold" : "text-sm"}>
                                                {i === 0 ? (
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span>{col.render ? col.render(row) : pick(row, col.key)}</span>
                                                        {isFila && <FilaBadge />}
                                                    </div>
                                                ) : (
                                                    col.render ? col.render(row) : pick(row, col.key)
                                                )}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="icon-xs"
                                                    title="Ver detalhes"
                                                    onClick={() => activeTab === "contratacao" ? void openContratacaoDetail(row) : openGenericDetail(row)}
                                                >
                                                    <Eye />
                                                </Button>
                                                {isFila ? (
                                                    /* Fila de Perfil: only Assumir available */
                                                    <Button
                                                        size="sm"
                                                        disabled={acting}
                                                        className="bg-violet-600 hover:bg-violet-700 gap-1"
                                                        onClick={() => void doAssumir(row)}
                                                        title="Assumir esta tarefa como aprovador"
                                                    >
                                                        <UserCheck className="size-3" />
                                                        <span className="hidden sm:inline">Assumir</span>
                                                    </Button>
                                                ) : (
                                                    /* Nominated: Approve / Reject inline */
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700"
                                                            title="Aprovar"
                                                            onClick={() => {
                                                                setApprovalObs("");
                                                                if (activeTab === "contratacao") void doContratacaoAction(row.id, "approve");
                                                                else void doGenericAction(row, "approve");
                                                            }}
                                                        >
                                                            <CheckCircle2 className="size-3" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            title="Reprovar"
                                                            onClick={() => {
                                                                setApprovalObs("");
                                                                if (activeTab === "contratacao") void doContratacaoAction(row.id, "reject");
                                                                else void doGenericAction(row, "reject");
                                                            }}
                                                        >
                                                            <XCircle className="size-3" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={activeTabDef.columns.length + 1} className="text-center text-muted-foreground py-8">
                                    {meLoaded
                                        ? "Nenhuma pendência encontrada para você."
                                        : "Carregando seus dados…"}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* ── Contratação Detail Dialog ── */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Analisar Solicitação de Contratação</DialogTitle>
                        <DialogDescription>Revise os detalhes e tome uma ação.</DialogDescription>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="border-lt-primary h-6 w-6 animate-spin rounded-full border-4 border-t-transparent" />
                        </div>
                    ) : detail ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                <DetailField label="Título" value={
                                    <span className="flex items-center gap-1.5 font-semibold">
                                        {detail.titulo}
                                        {isFilaRow(detail) && <FilaBadge />}
                                    </span>
                                } />
                                <DetailField label="Status" value={statusBadge(detail.status)} />
                                <DetailField label="Solicitante" value={detail.solicitanteNome} />
                                <DetailField label="Área" value={detail.areaName} />
                                <DetailField label="Cargo" value={detail.jobPositionName} />
                                <DetailField label="Unidade" value={detail.unitName} />
                                <DetailField label="Posições" value={<span className="font-mono">{detail.qtdPosicoes}</span>} />
                                <DetailField label="Urgência" value={urgenciaBadge(detail.urgencia)} />
                                <DetailField label="Data criação" value={formatDate(detail.createdAtUtc)} />
                            </div>
                            {detail.justificativa && (
                                <div>
                                    <div className="text-xs text-muted-foreground uppercase">Justificativa</div>
                                    <div className="mt-1 text-sm rounded-md bg-muted/30 p-3">{detail.justificativa}</div>
                                </div>
                            )}
                            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border/30 p-3">
                                <DetailField label="Tipo" value={detail.tipoSolicitacao === 1 ? "Substituição" : "Vaga Nova"} />
                                <DetailField label="Confidencial" value={detail.isConfidencial ? "Sim" : "Não"} />
                                {detail.substituidoNome && <DetailField label="Substituído" value={detail.substituidoNome} />}
                            </div>
                            {/* Approval chain */}
                            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                <div className="text-sm font-semibold text-primary">Cadeia de Aprovação</div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium">1ª Aprovação <span className="text-muted-foreground">(obrigatória)</span></span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">{detail.aprovador1Nome || "Aguardando"}</span>
                                            {approvalChainBadge(detail.aprovador1Status)}
                                        </div>
                                    </div>
                                    {detail.aprovador2Habilitado && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">2ª Aprovação <span className="text-muted-foreground">(opcional)</span></span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm">{detail.aprovador2Nome || "Aguardando"}</span>
                                                {detail.aprovador2Status != null && approvalChainBadge(detail.aprovador2Status)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {/* Actions */}
                            {detail.status === 1 && (
                                isFilaRow(detail) ? (
                                    /* Fila de Perfil — Assumir */
                                    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
                                        <div className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                                            <FilaBadge />
                                            Fila de Perfil
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                            Esta solicitação está na fila e pode ser assumida por qualquer membro do perfil configurado.
                                            Ao assumir, você se torna o aprovador designado e poderá aprovar ou reprovar.
                                        </p>
                                        <Button
                                            size="sm"
                                            disabled={acting}
                                            className="mt-3 bg-violet-600 hover:bg-violet-700 gap-1.5"
                                            onClick={() => void doAssumir(detail as unknown as GenericRow)}
                                        >
                                            <UserCheck className="size-4" />
                                            {acting ? "Assumindo…" : "Assumir tarefa"}
                                        </Button>
                                    </div>
                                ) : (
                                    /* Nominated — normal approval */
                                    <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                                        <div className="text-sm font-semibold text-amber-700">Sua decisão</div>
                                        <textarea
                                            className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                            rows={2}
                                            placeholder="Observação (opcional)..."
                                            value={approvalObs}
                                            onChange={(e) => setApprovalObs(e.target.value)}
                                        />
                                        <div className="flex gap-2">
                                            <Button size="sm" disabled={acting} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doContratacaoAction(detail.id, "approve")}>
                                                <CheckCircle2 className="size-4" /> Aprovar
                                            </Button>
                                            <Button size="sm" variant="outline" disabled={acting} className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => void doContratacaoAction(detail.id, "request-changes")}>
                                                <AlertTriangle className="size-4" /> Pedir Ajustes
                                            </Button>
                                            <Button size="sm" variant="outline" disabled={acting} className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => void doContratacaoAction(detail.id, "reject")}>
                                                <XCircle className="size-4" /> Reprovar
                                            </Button>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            {/* ── Generic Detail Dialog ── */}
            <Dialog open={genericDetailOpen} onOpenChange={setGenericDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Analisar Solicitação de {activeTabDef.label}</DialogTitle>
                        <DialogDescription>Revise os detalhes e tome uma ação.</DialogDescription>
                    </DialogHeader>
                    {genericDetail && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-3">
                                {activeTabDef.columns.map(col => (
                                    <DetailField
                                        key={col.key}
                                        label={col.label}
                                        value={col.render ? col.render(genericDetail) : pick(genericDetail, col.key)}
                                    />
                                ))}
                                <DetailField label="Status" value={statusBadge(Number(genericDetail.status ?? 1))} />
                            </div>
                            {/* Approval chain if present */}
                            {(genericDetail.aprovador1Nome || genericDetail.aprovador1Status != null) && (
                                <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                                    <div className="text-sm font-semibold text-primary">Cadeia de Aprovação</div>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">1ª Aprovação</span>
                                            <div className="flex items-center gap-2">
                                                <span>{pick(genericDetail, "aprovador1Nome", "Aguardando")}</span>
                                                {approvalChainBadge(Number(genericDetail.aprovador1Status ?? 0))}
                                            </div>
                                        </div>
                                        {!!genericDetail.aprovador2Habilitado && (
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="font-medium">2ª Aprovação</span>
                                                <div className="flex items-center gap-2">
                                                    <span>{pick(genericDetail, "aprovador2Nome", "Aguardando")}</span>
                                                    {genericDetail.aprovador2Status != null && approvalChainBadge(Number(genericDetail.aprovador2Status))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {/* Actions */}
                            {isFilaRow(genericDetail) ? (
                                /* Fila de Perfil — Assumir */
                                <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
                                    <div className="text-sm font-semibold text-violet-700 flex items-center gap-2">
                                        <FilaBadge />
                                        Fila de Perfil
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                        Esta solicitação está na fila e pode ser assumida por qualquer membro do perfil configurado.
                                    </p>
                                    <Button
                                        size="sm"
                                        disabled={acting}
                                        className="mt-3 bg-violet-600 hover:bg-violet-700 gap-1.5"
                                        onClick={() => void doAssumir(genericDetail)}
                                    >
                                        <UserCheck className="size-4" />
                                        {acting ? "Assumindo…" : "Assumir tarefa"}
                                    </Button>
                                </div>
                            ) : (
                                /* Nominated — normal approval */
                                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                                    <div className="text-sm font-semibold text-amber-700">Sua decisão</div>
                                    <textarea
                                        className="w-full rounded-md border border-input bg-background p-2 text-sm placeholder:text-muted-foreground"
                                        rows={2}
                                        placeholder="Observação (opcional)..."
                                        value={approvalObs}
                                        onChange={(e) => setApprovalObs(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button size="sm" disabled={acting} className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void doGenericAction(genericDetail, "approve")}>
                                            <CheckCircle2 className="size-4" /> Aprovar
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={acting} className="text-orange-600 border-orange-300 hover:bg-orange-50" onClick={() => void doGenericAction(genericDetail, "request-changes")}>
                                            <AlertTriangle className="size-4" /> Pedir Ajustes
                                        </Button>
                                        <Button size="sm" variant="outline" disabled={acting} className="text-red-600 border-red-300 hover:bg-red-50" onClick={() => void doGenericAction(genericDetail, "reject")}>
                                            <XCircle className="size-4" /> Reprovar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
