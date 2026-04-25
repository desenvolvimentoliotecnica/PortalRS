"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    DollarSign,
    Upload,
    CheckCircle2,
    XCircle,
    Clock,
    RefreshCw,
    Search,
    Eye,
    Plus,
    FileSpreadsheet,
    AlertTriangle,
    Ban,
    ChevronLeft,
    ChevronRight,
    Send,
    User,
    Calendar,
    PenLine,
} from "lucide-react";

import { useIsAdminOrOwner, useIsGestor } from "@/hooks/useAuth";
import { apiFetch, apiJson } from "@/lib/api";
import { useComissoesStore, type Comissao, type ComissaoStatus } from "@/stores/comissoesStore";
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
    DialogFooter,
} from "@/components/ui/dialog";

/* ──────────────────────────── API types ──────────────────────────── */

interface ApiComissao {
    id: string;
    status: ComissaoStatus;
    solicitanteId: string;
    solicitanteNome: string | null;
    importadoPorId: string | null;
    importadoPorNome: string | null;
    importadaEmUtc: string | null;
    funcionarioId: string;
    funcionarioNome: string | null;
    tipoPagamentoExtra: number;
    valor: number;
    descricao: string;
    dataPagamento: string;
    competencia: string | null;
    observacoes: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
    approvedAtUtc: string | null;
    integracaoResultado: number | null;
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
    etapas: ApiEtapa[];
}

interface ApiEtapa {
    ordem: number;
    label: string;
    aprovadorId: string | null;
    aprovadorNome: string | null;
    roleFilaId: string | null;
    roleFilaNome: string | null;
    status: "Pendente" | "Aprovado" | "Reprovado" | "Cancelado";
    dataUtc: string | null;
    observacao: string | null;
}

interface ImportPreviewLinha {
    linha: number;
    matricula: string;
    nomePlanilha: string;
    valor: number | null;
    totalReceber: number | null;
    funcionarioId: string | null;
    funcionarioNome: string | null;
    erro: string | null;
}

interface ImportPreviewResponse {
    totalLinhas: number;
    encontrados: number;
    naoEncontrados: number;
    linhas: ImportPreviewLinha[];
}

interface ImportConfirmarResponse {
    totalLinhas: number;
    criados: number;
    falhas: number;
}

interface FuncionarioSearchItem {
    id: string;
    name: string;
}


type TabId = "importacao" | "ajuste" | "aprovacao" | "aprovadas";

/* ──────────────────────────── constants ──────────────────────────── */

const API = "/api/colaborador/solicitacoes-pagamento-extra";

const TIPO_LABELS: Record<number, string> = {
    1: "Bônus",
    2: "Comissão",
    3: "PLR",
    4: "Hora Extra",
    5: "Premiação",
    6: "Reembolso",
    7: "Outro",
};

const PAGE_SIZE = 10;

/* ──────────────────────────── helpers ──────────────────────────── */

function fmtMoeda(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCompetencia(c: string | null) {
    if (!c) return "—";
    const [year, month] = c.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[Number(month) - 1]}/${year}`;
}

function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtDateTime(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mapApiToStore(a: ApiComissao): Comissao {
    return {
        id: a.id,
        status: a.status,
        solicitanteId: a.solicitanteId,
        solicitanteNome: a.solicitanteNome,
        importadoPorId: a.importadoPorId,
        importadoPorNome: a.importadoPorNome,
        importadaEmUtc: a.importadaEmUtc,
        funcionarioId: a.funcionarioId,
        funcionarioNome: a.funcionarioNome,
        tipoPagamentoExtra: a.tipoPagamentoExtra,
        valor: a.valor,
        descricao: a.descricao,
        dataPagamento: a.dataPagamento,
        competencia: a.competencia,
        observacoes: a.observacoes,
        createdAtUtc: a.createdAtUtc,
        updatedAtUtc: a.updatedAtUtc,
        approvedAtUtc: a.approvedAtUtc,
        integracaoResultado: a.integracaoResultado,
        integracaoMensagem: a.integracaoMensagem,
        integradaEmUtc: a.integradaEmUtc,
        etapas: a.etapas ?? [],
    };
}

const STATUS_MAP: Record<ComissaoStatus, { label: string; color: string; icon: React.ElementType }> = {
    Rascunho:            { label: "Rascunho",    color: "bg-zinc-400/15 text-zinc-600",       icon: FileSpreadsheet },
    PendenteAprovacao:   { label: "Pend. Gestor", color: "bg-amber-500/15 text-amber-700",     icon: Clock },
    PendenteAprovacaoRh: { label: "Pend. RH",    color: "bg-purple-500/15 text-purple-700",   icon: Clock },
    Aprovada:            { label: "Aprovada",    color: "bg-emerald-500/15 text-emerald-700",  icon: CheckCircle2 },
    Reprovada:           { label: "Reprovada",   color: "bg-red-500/15 text-red-700",          icon: XCircle },
    AjustesNecessarios:  { label: "Ajustes",     color: "bg-orange-500/15 text-orange-700",    icon: AlertTriangle },
    Comunicada:          { label: "Comunicada",  color: "bg-sky-500/15 text-sky-700",          icon: CheckCircle2 },
};

function statusBadge(status: ComissaoStatus) {
    const s = STATUS_MAP[status] ?? STATUS_MAP.Rascunho;
    const Icon = s.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.color}`}>
            <Icon className="size-3" />
            {s.label}
        </span>
    );
}

const ETAPA_COLORS = {
    Pendente:  "bg-amber-500/15 text-amber-700",
    Aprovado:  "bg-emerald-500/15 text-emerald-700",
    Reprovado: "bg-red-500/15 text-red-700",
    Cancelado: "bg-zinc-400/15 text-zinc-600",
};

function etapaBadge(etapa: ApiEtapa) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ETAPA_COLORS[etapa.status]}`}>
            {etapa.label}
        </span>
    );
}

/* ══════════════════════════ MAIN SCREEN ══════════════════════════ */

export default function ComissoesScreen() {
    const isAdminOrOwner = useIsAdminOrOwner();
    const isGestor = useIsGestor();
    const canApprove = isAdminOrOwner || isGestor;

    const items = useComissoesStore((s) => s.items);
    const setItems = useComissoesStore((s) => s.setItems);
    const updateItem = useComissoesStore((s) => s.updateItem);

    const [activeTab, setActiveTab] = useState<TabId>("importacao");
    const [loadingList, setLoadingList] = useState(false);

    /* ── pagination ── */
    const [importPage, setImportPage]     = useState(1);
    const [approvalPage, setApprovalPage] = useState(1);
    const [adjustPage, setAdjustPage]     = useState(1);
    const [approvedPage, setApprovedPage] = useState(1);

    /* ── search ── */
    const [importSearch, setImportSearch]     = useState("");
    const [adjustSearch, setAdjustSearch]     = useState("");
    const [approvalSearch, setApprovalSearch] = useState("");
    const [approvedSearch, setApprovedSearch] = useState("");

    /* ── import modal ── */
    const [importOpen, setImportOpen]       = useState(false);
    const [importStep, setImportStep]       = useState<1 | 2 | 3>(1);
    const [importPreview, setImportPreview] = useState<ImportPreviewResponse | null>(null);
    const [importLoading, setImportLoading] = useState(false);
    const [descricao, setDescricao]         = useState("");
    const [tipo, setTipo]                   = useState<number>(2);
    const [dataPagamento, setDataPagamento] = useState("");
    const [competencia, setCompetencia]     = useState("");
    const [observacoes, setObservacoes]     = useState("");
    const fileInputRef                      = useRef<HTMLInputElement>(null);

    /* ── approval modal ── */
    const [approvalOpen, setApprovalOpen]         = useState(false);
    const [approvalItem, setApprovalItem]         = useState<Comissao | null>(null);
    const [approvalDetail, setApprovalDetail]     = useState<ApiComissao | null>(null);
    const [approvalObs, setApprovalObs]           = useState("");
    const [approvalLoading, setApprovalLoading]   = useState(false);
    const [approvalFetching, setApprovalFetching] = useState(false);

    /* ── adjust modal ── */
    const [adjustOpen, setAdjustOpen]     = useState(false);
    const [adjustItem, setAdjustItem]     = useState<Comissao | null>(null);
    const [adjustValor, setAdjustValor]   = useState(0);
    const [adjustDesc, setAdjustDesc]     = useState("");
    const [adjustObs, setAdjustObs]       = useState("");
    const [adjustLoading, setAdjustLoading] = useState(false);

    /* ── manual entry modal ── */
    const [manualOpen, setManualOpen]             = useState(false);
    const [manualLoading, setManualLoading]       = useState(false);
    const [manualFuncSearch, setManualFuncSearch] = useState("");
    const [manualFuncResults, setManualFuncResults] = useState<FuncionarioSearchItem[]>([]);
    const [manualFuncSelected, setManualFuncSelected] = useState<FuncionarioSearchItem | null>(null);
    const [manualFuncSearching, setManualFuncSearching] = useState(false);
    const [manualTipo, setManualTipo]             = useState<number>(2);
    const [manualValor, setManualValor]           = useState("");
    const [manualDesc, setManualDesc]             = useState("");
    const [manualDataPagamento, setManualDataPagamento] = useState("");
    const [manualCompetencia, setManualCompetencia] = useState("");
    const [manualObs, setManualObs]               = useState("");
    const manualFuncSearchTimer                   = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── detail modal ── */
    const [detailOpen, setDetailOpen]       = useState(false);
    const [detailItem, setDetailItem]       = useState<ApiComissao | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    /* ──────────────── initial load ──────────────── */

    const syncList = useCallback(async () => {
        setLoadingList(true);
        try {
            const data = await apiJson<ApiComissao[]>(API);
            setItems(Array.isArray(data) ? data.map(mapApiToStore) : []);
        } catch (e) {
            toast.error(`Falha ao carregar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoadingList(false);
        }
    }, [setItems]);

    useEffect(() => { void syncList(); }, [syncList]);

    /* ── derived lists ── */
    const importItems = useMemo(() => {
        const q = importSearch.toLowerCase();
        return items.filter((i) => !q || (i.funcionarioNome ?? "").toLowerCase().includes(q) || i.descricao.toLowerCase().includes(q));
    }, [items, importSearch]);

    const adjustItems = useMemo(() => {
        const q = adjustSearch.toLowerCase();
        return items.filter((i) => i.status === "AjustesNecessarios" && (!q || (i.funcionarioNome ?? "").toLowerCase().includes(q)));
    }, [items, adjustSearch]);

    const pendingItems = useMemo(() => {
        const q = approvalSearch.toLowerCase();
        return items.filter(
            (i) => (i.status === "PendenteAprovacao" || i.status === "PendenteAprovacaoRh") &&
                   (!q || (i.funcionarioNome ?? "").toLowerCase().includes(q)),
        );
    }, [items, approvalSearch]);

    const approvedItems = useMemo(() => {
        const q = approvedSearch.toLowerCase();
        return items.filter((i) => (i.status === "Aprovada" || i.status === "Comunicada") && (!q || (i.funcionarioNome ?? "").toLowerCase().includes(q)));
    }, [items, approvedSearch]);

    /* ── KPIs ── */
    const kpi = useMemo(() => ({
        total:    items.length,
        ajuste:   items.filter((i) => i.status === "AjustesNecessarios").length,
        pendente: items.filter((i) => i.status === "PendenteAprovacao" || i.status === "PendenteAprovacaoRh").length,
        aprovada: items.filter((i) => i.status === "Aprovada" || i.status === "Comunicada").length,
    }), [items]);

    /* ──────────────── import modal ──────────────── */

    function resetImportModal() {
        setImportStep(1);
        setImportPreview(null);
        setDescricao("");
        setTipo(2);
        setDataPagamento("");
        setCompetencia("");
        setObservacoes("");
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportLoading(true);
        try {
            const form = new FormData();
            form.append("file", file);
            const res = await apiFetch(`${API}/importar/preview`, { method: "POST", body: form });
            if (!res.ok) {
                const err = await res.json().catch(() => ({})) as { message?: string };
                throw new Error(err.message ?? `Erro ${res.status}`);
            }
            const data = await res.json() as ImportPreviewResponse;
            setImportPreview(data);
            setImportStep(2);
        } catch (e) {
            toast.error(`Falha no upload: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setImportLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleConfirmImport() {
        if (!importPreview) return;
        if (!descricao.trim()) { toast.error("Informe a descrição."); return; }
        if (!dataPagamento) { toast.error("Informe a data de pagamento."); return; }

        const validLines = importPreview.linhas.filter((l) => l.funcionarioId && !l.erro);
        if (validLines.length === 0) { toast.error("Nenhuma linha válida para importar."); return; }

        setImportLoading(true);
        try {
            const body = {
                tipoPagamentoExtra: tipo,
                descricao: descricao.trim(),
                dataPagamento,
                competencia: competencia.trim() || undefined,
                observacoes: observacoes.trim() || undefined,
                linhas: validLines.map((l) => ({ funcionarioId: l.funcionarioId!, valor: l.totalReceber ?? l.valor ?? 0 })),
            };
            const result = await apiJson<ImportConfirmarResponse>(`${API}/importar/confirmar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            toast.success(`${result.criados} comissão(ões) enviada(s) para aprovação.${result.falhas > 0 ? ` ${result.falhas} falha(s).` : ""}`);
            setImportOpen(false);
            resetImportModal();
            await syncList();
            setActiveTab("aprovacao");
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setImportLoading(false);
        }
    }

    /* ──────────────── approval ──────────────── */

    async function openApproval(item: Comissao) {
        setApprovalItem(item);
        setApprovalObs("");
        setApprovalDetail(null);
        setApprovalOpen(true);
        setApprovalFetching(true);
        try {
            const d = await apiJson<ApiComissao>(`${API}/${item.id}`);
            setApprovalDetail(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
        } finally {
            setApprovalFetching(false);
        }
    }

    async function handleApprovalAction(action: "approve" | "reject" | "request-changes") {
        if (!approvalItem) return;
        setApprovalLoading(true);
        try {
            const updated = await apiJson<ApiComissao>(`${API}/${approvalItem.id}/${action}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approvalObs || null }),
            });
            updateItem(approvalItem.id, mapApiToStore(updated));
            const labels = { approve: "aprovada", reject: "reprovada", "request-changes": "ajustes solicitados" };
            toast.success(`Comissão ${labels[action]}!`);
            setApprovalOpen(false);
            setApprovalItem(null);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setApprovalLoading(false);
        }
    }

    /* ──────────────── adjust ──────────────── */

    function openAdjust(item: Comissao) {
        setAdjustItem(item);
        setAdjustValor(item.valor);
        setAdjustDesc(item.descricao);
        setAdjustObs(item.observacoes ?? "");
        setAdjustOpen(true);
    }

    async function handleSubmitAjuste() {
        if (!adjustItem) return;
        if (adjustValor <= 0) { toast.error("Informe o valor."); return; }
        if (!adjustDesc.trim()) { toast.error("Informe a descrição."); return; }
        setAdjustLoading(true);
        try {
            await apiJson<ApiComissao>(`${API}/${adjustItem.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: adjustItem.funcionarioId,
                    tipoPagamentoExtra: adjustItem.tipoPagamentoExtra,
                    valor: adjustValor,
                    descricao: adjustDesc.trim(),
                    dataPagamento: adjustItem.dataPagamento,
                    competencia: adjustItem.competencia,
                    observacoes: adjustObs.trim() || null,
                }),
            });
            const submitRes = await apiFetch(`${API}/${adjustItem.id}/submit`, { method: "POST" });
            if (!submitRes.ok) throw new Error(`API_ERROR_${submitRes.status}`);
            updateItem(adjustItem.id, { valor: adjustValor, descricao: adjustDesc.trim(), observacoes: adjustObs.trim() || null, status: "PendenteAprovacao" });
            toast.success("Comissão ajustada e reenviada para aprovação.");
            setAdjustOpen(false);
            setAdjustItem(null);
            setActiveTab("aprovacao");
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setAdjustLoading(false);
        }
    }

    /* ──────────────── manual entry ──────────────── */

    function resetManualModal() {
        setManualFuncSearch("");
        setManualFuncResults([]);
        setManualFuncSelected(null);
        setManualTipo(2);
        setManualValor("");
        setManualDesc("");
        setManualDataPagamento("");
        setManualCompetencia("");
        setManualObs("");
    }

    function handleManualFuncSearchChange(q: string) {
        setManualFuncSearch(q);
        setManualFuncSelected(null);
        if (manualFuncSearchTimer.current) clearTimeout(manualFuncSearchTimer.current);
        if (!q.trim()) { setManualFuncResults([]); return; }
        manualFuncSearchTimer.current = setTimeout(async () => {
            setManualFuncSearching(true);
            try {
                const data = await apiJson<{ items: FuncionarioSearchItem[] }>(`/api/funcionarios?Search=${encodeURIComponent(q)}&PageSize=10`);
                setManualFuncResults(data.items ?? []);
            } catch {
                setManualFuncResults([]);
            } finally {
                setManualFuncSearching(false);
            }
        }, 300);
    }

    async function handleManualSubmit() {
        if (!manualFuncSelected) { toast.error("Selecione um funcionário."); return; }
        if (!manualDesc.trim()) { toast.error("Informe a descrição."); return; }
        const valor = parseFloat(manualValor);
        if (!valor || valor <= 0) { toast.error("Informe um valor válido."); return; }
        if (!manualDataPagamento) { toast.error("Informe a data de pagamento."); return; }

        setManualLoading(true);
        try {
            const created = await apiJson<ApiComissao>(API, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    funcionarioId: manualFuncSelected.id,
                    tipoPagamentoExtra: manualTipo,
                    valor,
                    descricao: manualDesc.trim(),
                    dataPagamento: manualDataPagamento,
                    competencia: manualCompetencia.trim() || undefined,
                    observacoes: manualObs.trim() || undefined,
                }),
            });
            const submitRes = await apiFetch(`${API}/${created.id}/submit`, { method: "POST" });
            if (!submitRes.ok) throw new Error(`API_ERROR_${submitRes.status}`);
            toast.success("Entrada criada e enviada para aprovação.");
            setManualOpen(false);
            resetManualModal();
            await syncList();
            setActiveTab("aprovacao");
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setManualLoading(false);
        }
    }

    /* ──────────────── detail ──────────────── */

    async function openDetail(item: Comissao) {
        setDetailItem(null);
        setDetailOpen(true);
        setDetailLoading(true);
        try {
            const d = await apiJson<ApiComissao>(`${API}/${item.id}`);
            setDetailItem(d);
        } catch {
            toast.error("Falha ao carregar detalhes.");
            setDetailOpen(false);
        } finally {
            setDetailLoading(false);
        }
    }

    /* ──────────────── pagination ──────────────── */

    function paginate<T>(arr: T[], page: number) {
        const start = (page - 1) * PAGE_SIZE;
        return { rows: arr.slice(start, start + PAGE_SIZE), pages: Math.max(1, Math.ceil(arr.length / PAGE_SIZE)) };
    }

    /* ══════════════════════════ RENDER ══════════════════════════ */

    const TABS: { id: TabId; label: string; badge?: number }[] = [
        { id: "importacao", label: "Importação" },
        { id: "ajuste",     label: "Ajuste",    badge: kpi.ajuste },
        { id: "aprovacao",  label: "Aprovação", badge: kpi.pendente },
        { id: "aprovadas",  label: "Aprovadas", badge: kpi.aprovada },
    ];

    return (
        <section className="space-y-4">

            {/* ── Page header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Pagamento Extra</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Importe planilhas, gerencie aprovações e acompanhe a integração com TOTVS
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void syncList()} disabled={loadingList}>
                        <RefreshCw className={`size-4 ${loadingList ? "animate-spin" : ""}`} />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManualOpen(true)}>
                        <PenLine className="size-4" /> Entrada Manual
                    </Button>
                    <Button size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                        <Plus className="size-4" /> Nova Importação
                    </Button>
                </div>
            </div>

            {/* ── KPI chips ── */}
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-bold">{kpi.total}</span>
                </div>
                {([
                    { label: "Ajustes",   value: kpi.ajuste,   color: "text-orange-600",  icon: AlertTriangle },
                    { label: "Pendentes", value: kpi.pendente, color: "text-amber-600",   icon: Clock },
                    { label: "Aprovadas", value: kpi.aprovada, color: "text-emerald-600", icon: CheckCircle2 },
                ] as const).map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                        <Icon className={`size-3.5 ${color}`} />
                        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
                        <span className={`text-sm font-bold ${value > 0 ? color : "text-muted-foreground"}`}>{value}</span>
                    </div>
                ))}
            </div>

            {/* ── Tab bar ── */}
            <div className="flex gap-1 border-b border-border/40">
                {TABS.map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-[1px] transition-colors ${
                                active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                            {tab.badge != null && tab.badge > 0 && (
                                <span className="rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ════════════ TAB: IMPORTAÇÃO ════════════ */}
            {activeTab === "importacao" && (
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="font-semibold flex items-center gap-2">
                                <Upload className="size-4 text-muted-foreground" /> Histórico de Importações
                            </div>
                            <div className="text-muted-foreground text-sm">{importItems.length} registro(s)</div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[260px] pl-8"
                                placeholder="Buscar funcionário…"
                                value={importSearch}
                                onChange={(e) => { setImportSearch(e.target.value); setImportPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Funcionário</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Importado por</TableHead>
                                <TableHead>Importado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginate(importItems, importPage).rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-sm">
                                        {loadingList ? "Carregando…" : "Nenhuma comissão importada ainda."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginate(importItems, importPage).rows.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/40">
                                        <TableCell className="font-medium">{item.funcionarioNome ?? "—"}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{TIPO_LABELS[item.tipoPagamentoExtra] ?? item.tipoPagamentoExtra}</TableCell>
                                        <TableCell className="max-w-[160px] truncate text-sm">{item.descricao}</TableCell>
                                        <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                        <TableCell className="text-right font-medium">{fmtMoeda(item.valor)}</TableCell>
                                        <TableCell>{statusBadge(item.status)}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{item.importadoPorNome ?? item.solicitanteNome ?? "—"}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{fmtDateTime(item.importadaEmUtc ?? item.createdAtUtc)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => void openDetail(item)}>
                                                <Eye className="size-3.5" /> Ver
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <PaginationBar page={importPage} pages={paginate(importItems, importPage).pages} total={importItems.length} onChange={setImportPage} />
                </div>
            )}

            {/* ════════════ TAB: AJUSTE ════════════ */}
            {activeTab === "ajuste" && (
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="font-semibold flex items-center gap-2">
                                <AlertTriangle className="size-4 text-orange-500" /> Comissões com Ajuste Solicitado
                            </div>
                            <div className="text-muted-foreground text-sm">{adjustItems.length} comissão(ões)</div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[260px] pl-8"
                                placeholder="Buscar funcionário…"
                                value={adjustSearch}
                                onChange={(e) => { setAdjustSearch(e.target.value); setAdjustPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Funcionário</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Obs. do aprovador</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {adjustItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                                        Nenhuma comissão aguardando ajuste.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginate(adjustItems, adjustPage).rows.map((item) => {
                                    const rejEtapa = [...item.etapas].reverse().find((e) => e.status === "Reprovado");
                                    return (
                                        <TableRow key={item.id} className="hover:bg-muted/40">
                                            <TableCell className="font-medium">{item.funcionarioNome ?? "—"}</TableCell>
                                            <TableCell className="max-w-[160px] truncate text-sm">{item.descricao}</TableCell>
                                            <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                            <TableCell className="text-right font-medium">{fmtMoeda(item.valor)}</TableCell>
                                            <TableCell className="text-muted-foreground text-xs max-w-[220px] truncate">
                                                {rejEtapa
                                                    ? <span title={rejEtapa.observacao ?? ""}>{rejEtapa.aprovadorNome ?? rejEtapa.roleFilaNome ?? "—"}: {rejEtapa.observacao ?? "sem observação"}</span>
                                                    : (item.observacoes ?? "—")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" className="h-7 gap-1 bg-orange-600 hover:bg-orange-700 text-white" onClick={() => openAdjust(item)}>
                                                    <AlertTriangle className="size-3.5" /> Ajustar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    <PaginationBar page={adjustPage} pages={paginate(adjustItems, adjustPage).pages} total={adjustItems.length} onChange={setAdjustPage} />
                </div>
            )}

            {/* ════════════ TAB: APROVAÇÃO ════════════ */}
            {activeTab === "aprovacao" && (
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-600" /> Aguardando Aprovação
                            </div>
                            <div className="text-muted-foreground text-sm">{pendingItems.length} solicitação(ões)</div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[260px] pl-8"
                                placeholder="Buscar funcionário…"
                                value={approvalSearch}
                                onChange={(e) => { setApprovalSearch(e.target.value); setApprovalPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Funcionário</TableHead>
                                <TableHead>Descrição</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Etapa atual</TableHead>
                                <TableHead>Importado por</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {pendingItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10 text-sm">
                                        Nenhuma comissão pendente de aprovação.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginate(pendingItems, approvalPage).rows.map((item) => {
                                    const pendingEtapa = item.etapas.find((e) => e.status === "Pendente");
                                    return (
                                        <TableRow key={item.id} className="hover:bg-muted/40">
                                            <TableCell className="font-medium">{item.funcionarioNome ?? "—"}</TableCell>
                                            <TableCell className="max-w-[140px] truncate text-sm">{item.descricao}</TableCell>
                                            <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                            <TableCell className="text-right font-medium">{fmtMoeda(item.valor)}</TableCell>
                                            <TableCell>
                                                {pendingEtapa ? etapaBadge(pendingEtapa) : statusBadge(item.status)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{item.importadoPorNome ?? item.solicitanteNome ?? "—"}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => void openDetail(item)}>
                                                        <Eye className="size-3.5" /> Ver
                                                    </Button>
                                                    {canApprove && (
                                                        <Button size="sm" className="h-7 gap-1" onClick={() => void openApproval(item)}>
                                                            <CheckCircle2 className="size-3.5" /> Avaliar
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    <PaginationBar page={approvalPage} pages={paginate(pendingItems, approvalPage).pages} total={pendingItems.length} onChange={setApprovalPage} />
                </div>
            )}

            {/* ════════════ TAB: APROVADAS ════════════ */}
            {activeTab === "aprovadas" && (
                <div className="rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="size-4 text-emerald-600" /> Aprovadas / Integradas
                            </div>
                            <div className="text-muted-foreground text-sm">{approvedItems.length} comissão(ões)</div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[260px] pl-8"
                                placeholder="Buscar funcionário…"
                                value={approvedSearch}
                                onChange={(e) => { setApprovedSearch(e.target.value); setApprovedPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Funcionário</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">Valor</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Integração TOTVS</TableHead>
                                <TableHead>Integrado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {approvedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                                        Nenhuma comissão aprovada.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginate(approvedItems, approvedPage).rows.map((item) => (
                                    <TableRow key={item.id} className="hover:bg-muted/40">
                                        <TableCell className="font-medium">{item.funcionarioNome ?? "—"}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{TIPO_LABELS[item.tipoPagamentoExtra] ?? item.tipoPagamentoExtra}</TableCell>
                                        <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                        <TableCell className="text-right font-medium">{fmtMoeda(item.valor)}</TableCell>
                                        <TableCell>{statusBadge(item.status)}</TableCell>
                                        <TableCell>
                                            {item.integracaoResultado === null
                                                ? <span className="text-xs text-muted-foreground">Pendente</span>
                                                : item.integracaoResultado === 1
                                                    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-medium"><CheckCircle2 className="size-3" /> Sucesso</span>
                                                    : <span className="inline-flex items-center gap-1 text-xs text-red-700 font-medium"><XCircle className="size-3" /> {item.integracaoMensagem ?? "Falha"}</span>
                                            }
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{fmtDateTime(item.integradaEmUtc)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => void openDetail(item)}>
                                                <Eye className="size-3.5" /> Ver
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <PaginationBar page={approvedPage} pages={paginate(approvedItems, approvedPage).pages} total={approvedItems.length} onChange={setApprovedPage} />
                </div>
            )}

            {/* ══════════ MODAL: ENTRADA MANUAL ══════════ */}
            <Dialog open={manualOpen} onOpenChange={(o) => { if (!o) resetManualModal(); setManualOpen(o); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PenLine className="size-5 text-primary" /> Nova Entrada Manual
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os dados para criar uma solicitação de pagamento extra.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-4 py-1">
                        {/* Funcionário search */}
                        <div className="flex flex-col gap-1.5 col-span-2 relative">
                            <label className="text-sm font-medium">Funcionário <span className="text-red-500">*</span></label>
                            {manualFuncSelected ? (
                                <div className="flex items-center gap-2 h-9 rounded-md border border-input bg-muted/40 px-3 text-sm">
                                    <User className="size-3.5 text-muted-foreground shrink-0" />
                                    <span className="flex-1 truncate">{manualFuncSelected.name}</span>
                                    <button
                                        type="button"
                                        title="Limpar seleção"
                                        onClick={() => { setManualFuncSelected(null); setManualFuncSearch(""); setManualFuncResults([]); }}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <XCircle className="size-4" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                        <Input
                                            className="pl-8"
                                            placeholder="Digite o nome ou matrícula…"
                                            value={manualFuncSearch}
                                            onChange={(e) => handleManualFuncSearchChange(e.target.value)}
                                        />
                                        {manualFuncSearching && (
                                            <RefreshCw className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                                        )}
                                    </div>
                                    {manualFuncResults.length > 0 && (
                                        <ul className="absolute top-[calc(100%-2px)] left-0 right-0 z-50 rounded-md border border-border bg-popover shadow-md max-h-48 overflow-y-auto">
                                            {manualFuncResults.map((f) => (
                                                <li key={f.id}>
                                                    <button
                                                        type="button"
                                                        className="w-full px-3 py-2 text-sm text-left hover:bg-muted flex items-center gap-2"
                                                        onClick={() => { setManualFuncSelected(f); setManualFuncSearch(f.name); setManualFuncResults([]); }}
                                                    >
                                                        <User className="size-3.5 text-muted-foreground shrink-0" />
                                                        {f.name}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Tipo */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Tipo</label>
                            <select
                                title="Tipo de pagamento extra"
                                value={manualTipo}
                                onChange={(e) => setManualTipo(Number(e.target.value))}
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                                {Object.entries(TIPO_LABELS).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
                            </select>
                        </div>

                        {/* Valor */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Valor (R$) <span className="text-red-500">*</span></label>
                            <Input
                                type="number"
                                min={0}
                                step={0.01}
                                placeholder="0,00"
                                value={manualValor}
                                onChange={(e) => setManualValor(e.target.value)}
                            />
                        </div>

                        {/* Descrição */}
                        <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-sm font-medium">Descrição <span className="text-red-500">*</span></label>
                            <Input
                                placeholder="Ex: Bônus de performance Q1/2026"
                                value={manualDesc}
                                onChange={(e) => setManualDesc(e.target.value)}
                            />
                        </div>

                        {/* Data de pagamento */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Data de Pagamento <span className="text-red-500">*</span></label>
                            <Input
                                type="date"
                                value={manualDataPagamento}
                                onChange={(e) => setManualDataPagamento(e.target.value)}
                            />
                        </div>

                        {/* Competência */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Competência</label>
                            <Input
                                placeholder="Ex: 2026-04"
                                pattern="\d{4}-\d{2}"
                                value={manualCompetencia}
                                onChange={(e) => setManualCompetencia(e.target.value)}
                            />
                        </div>

                        {/* Observações */}
                        <div className="flex flex-col gap-1.5 col-span-2">
                            <label className="text-sm font-medium">Observações</label>
                            <textarea
                                rows={2}
                                title="Observações"
                                placeholder="Opcional"
                                value={manualObs}
                                onChange={(e) => setManualObs(e.target.value)}
                                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setManualOpen(false)} disabled={manualLoading}>Cancelar</Button>
                        <Button onClick={() => void handleManualSubmit()} disabled={manualLoading}>
                            {manualLoading
                                ? <><RefreshCw className="size-4 animate-spin mr-2" />Enviando…</>
                                : <><Send className="size-4 mr-2" />Enviar para Aprovação</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════ MODAL: IMPORTAÇÃO ══════════ */}
            <Dialog open={importOpen} onOpenChange={(o) => { if (!o) resetImportModal(); setImportOpen(o); }}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="size-5 text-primary" /> Nova Importação de Pagamento Extra
                        </DialogTitle>
                        <DialogDescription>
                            {importStep === 1 && "Selecione uma planilha .xlsx com os dados dos colaboradores."}
                            {importStep === 2 && "Verifique as linhas reconhecidas. Corrija erros na planilha original se necessário."}
                            {importStep === 3 && "Preencha os dados comuns e confirme a importação."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Step indicators */}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {(["Upload", "Preview", "Confirmar"] as const).map((label, i) => (
                            <React.Fragment key={label}>
                                <span className={`font-medium ${importStep === i + 1 ? "text-primary" : ""}`}>{i + 1}. {label}</span>
                                {i < 2 && <span className="mx-1">›</span>}
                            </React.Fragment>
                        ))}
                    </div>

                    {/* Step 1: Upload */}
                    {importStep === 1 && (
                        <div className="flex flex-col items-center justify-center gap-4 py-8 border-2 border-dashed border-border rounded-lg">
                            <FileSpreadsheet className="size-12 text-muted-foreground" />
                            <div className="text-center">
                                <p className="font-medium">Selecione o arquivo .xlsx</p>
                                <p className="text-sm text-muted-foreground mt-1">O sistema identifica colaboradores pela matrícula ou CPF</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx"
                                title="Selecionar planilha .xlsx"
                                aria-label="Selecionar planilha .xlsx"
                                className="hidden"
                                onChange={(e) => void handleFileUpload(e)}
                            />
                            <Button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importLoading}
                                className="gap-1.5"
                            >
                                {importLoading
                                    ? <><RefreshCw className="size-4 animate-spin" /> Processando…</>
                                    : <><Upload className="size-4" /> Selecionar arquivo</>}
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {importStep === 2 && importPreview && (
                        <div className="flex flex-col gap-3">
                            <div className="flex gap-4 text-sm">
                                <span className="text-emerald-700 font-medium">{importPreview.encontrados} encontrado(s)</span>
                                {importPreview.naoEncontrados > 0 && (
                                    <span className="text-red-700 font-medium">{importPreview.naoEncontrados} não encontrado(s)</span>
                                )}
                            </div>
                            <div className="max-h-[320px] overflow-y-auto rounded-lg border border-border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-12">Linha</TableHead>
                                            <TableHead>Matrícula</TableHead>
                                            <TableHead>Nome (planilha)</TableHead>
                                            <TableHead>Funcionário encontrado</TableHead>
                                            <TableHead className="text-right">Valor</TableHead>
                                            <TableHead>Situação</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {importPreview.linhas.map((l) => (
                                            <TableRow key={l.linha} className={l.erro ? "bg-red-50/50" : ""}>
                                                <TableCell className="text-muted-foreground text-xs">{l.linha}</TableCell>
                                                <TableCell className="text-xs">{l.matricula}</TableCell>
                                                <TableCell className="text-xs">{l.nomePlanilha}</TableCell>
                                                <TableCell className="text-xs font-medium">{l.funcionarioNome ?? "—"}</TableCell>
                                                <TableCell className="text-right text-xs">
                                                    {l.totalReceber != null ? fmtMoeda(l.totalReceber) : l.valor != null ? fmtMoeda(l.valor) : "—"}
                                                </TableCell>
                                                <TableCell>
                                                    {l.erro
                                                        ? <span className="inline-flex items-center gap-1 text-xs text-red-700"><XCircle className="size-3" /> {l.erro}</span>
                                                        : <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><CheckCircle2 className="size-3" /> OK</span>
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Common fields */}
                    {importStep === 3 && (
                        <div className="grid grid-cols-2 gap-4 py-1">
                            <div className="flex flex-col gap-1.5 col-span-2">
                                <label className="text-sm font-medium">Descrição <span className="text-red-500">*</span></label>
                                <Input
                                    placeholder="Ex: Comissão referente ao mês de Abril/2026"
                                    value={descricao}
                                    onChange={(e) => setDescricao(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Tipo</label>
                                <select
                                    title="Tipo de pagamento extra"
                                    value={tipo}
                                    onChange={(e) => setTipo(Number(e.target.value))}
                                    className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Competência</label>
                                <Input
                                    placeholder="Ex: 2026-04"
                                    pattern="\d{4}-\d{2}"
                                    value={competencia}
                                    onChange={(e) => setCompetencia(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Data de Pagamento <span className="text-red-500">*</span></label>
                                <Input
                                    type="date"
                                    value={dataPagamento}
                                    onChange={(e) => setDataPagamento(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1.5 col-span-2">
                                <label className="text-sm font-medium">Observações</label>
                                <textarea
                                    rows={2}
                                    title="Observações"
                                    placeholder="Opcional"
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                    className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importLoading}>
                            Cancelar
                        </Button>
                        {importStep === 2 && (
                            <>
                                <Button variant="outline" onClick={() => setImportStep(1)}>Voltar</Button>
                                <Button onClick={() => setImportStep(3)} disabled={(importPreview?.encontrados ?? 0) === 0}>
                                    Prosseguir ({importPreview?.encontrados ?? 0} válidos)
                                </Button>
                            </>
                        )}
                        {importStep === 3 && (
                            <>
                                <Button variant="outline" onClick={() => setImportStep(2)}>Voltar</Button>
                                <Button onClick={() => void handleConfirmImport()} disabled={importLoading}>
                                    {importLoading
                                        ? <><RefreshCw className="size-4 animate-spin mr-2" />Importando…</>
                                        : <><Send className="size-4 mr-2" />Confirmar Importação</>}
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════ MODAL: AJUSTE ══════════ */}
            <Dialog open={adjustOpen} onOpenChange={(o) => { if (!o) setAdjustItem(null); setAdjustOpen(o); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="size-5 text-orange-500" /> Ajustar Comissão
                        </DialogTitle>
                        <DialogDescription>Corrija os dados e reencaminhe para aprovação.</DialogDescription>
                    </DialogHeader>
                    {adjustItem && (
                        <div className="flex flex-col gap-4 py-1">
                            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                                <div className="font-medium">{adjustItem.funcionarioNome ?? "—"}</div>
                                <div className="text-muted-foreground text-xs mt-0.5">{fmtCompetencia(adjustItem.competencia)}</div>
                                {adjustItem.etapas.filter((e) => e.status === "Reprovado").map((e, i) => (
                                    <div key={i} className="mt-2 text-xs text-orange-700 bg-orange-50 rounded px-2 py-1">
                                        <span className="font-medium">{e.aprovadorNome ?? e.roleFilaNome ?? "Aprovador"}:</span> {e.observacao ?? "sem observação"}
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                                    <Input value={adjustDesc} onChange={(e) => setAdjustDesc(e.target.value)} className="h-8 text-sm" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Valor (R$)</label>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={adjustValor || ""}
                                        onChange={(e) => setAdjustValor(parseFloat(e.target.value) || 0)}
                                        className="h-8 text-sm"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-muted-foreground">Observações</label>
                                    <Input value={adjustObs} onChange={(e) => setAdjustObs(e.target.value)} className="h-8 text-sm" placeholder="Opcional" />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAdjustOpen(false)} disabled={adjustLoading}>Cancelar</Button>
                        <Button onClick={() => void handleSubmitAjuste()} disabled={adjustLoading} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {adjustLoading
                                ? <><RefreshCw className="size-4 animate-spin mr-2" />Enviando…</>
                                : <><Send className="size-4 mr-2" />Reenviar para Aprovação</>}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════ MODAL: APROVAÇÃO ══════════ */}
            <Dialog open={approvalOpen} onOpenChange={setApprovalOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="size-5 text-emerald-600" /> Avaliar Comissão
                        </DialogTitle>
                    </DialogHeader>
                    {approvalFetching ? (
                        <div className="flex justify-center py-8"><RefreshCw className="size-6 animate-spin text-muted-foreground" /></div>
                    ) : approvalDetail ? (
                        <div className="flex flex-col gap-4 py-1">
                            <ComissaoDetailGrid item={approvalDetail} />
                            {approvalDetail.etapas.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fluxo de aprovação</p>
                                    <div className="flex flex-col gap-1.5">
                                        {approvalDetail.etapas.map((e) => (
                                            <div key={e.ordem} className="flex items-start gap-2 text-sm">
                                                <span className="mt-0.5 shrink-0">{etapaBadge(e)}</span>
                                                <div className="flex-1 min-w-0">
                                                    {(e.aprovadorNome ?? e.roleFilaNome) && (
                                                        <span className="text-xs text-muted-foreground">{e.aprovadorNome ?? e.roleFilaNome}</span>
                                                    )}
                                                    {e.observacao && <p className="text-xs text-red-700 mt-0.5">{e.observacao}</p>}
                                                    {e.dataUtc && <p className="text-[11px] text-muted-foreground">{fmtDateTime(e.dataUtc)}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Observação</label>
                                <textarea
                                    rows={3}
                                    title="Observação do aprovador"
                                    placeholder="Opcional — justificativa ou instruções."
                                    value={approvalObs}
                                    onChange={(e) => setApprovalObs(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            </div>
                        </div>
                    ) : null}
                    <DialogFooter className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" onClick={() => setApprovalOpen(false)} disabled={approvalLoading}>Fechar</Button>
                        <Button variant="outline" className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => void handleApprovalAction("request-changes")} disabled={approvalLoading || approvalFetching}>
                            <AlertTriangle className="size-4" /> Pedir Ajustes
                        </Button>
                        <Button variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => void handleApprovalAction("reject")} disabled={approvalLoading || approvalFetching}>
                            {approvalLoading ? <RefreshCw className="size-4 animate-spin" /> : <Ban className="size-4" />} Reprovar
                        </Button>
                        <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => void handleApprovalAction("approve")} disabled={approvalLoading || approvalFetching}>
                            {approvalLoading ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Aprovar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════ MODAL: DETALHE ══════════ */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="size-5 text-muted-foreground" /> Detalhe
                        </DialogTitle>
                    </DialogHeader>
                    {detailLoading ? (
                        <div className="flex justify-center py-8"><RefreshCw className="size-6 animate-spin text-muted-foreground" /></div>
                    ) : detailItem ? (
                        <div className="flex flex-col gap-4">
                            <ComissaoDetailGrid item={detailItem} full />
                            {detailItem.etapas.length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Fluxo de aprovação</p>
                                    <div className="flex flex-col gap-1.5">
                                        {detailItem.etapas.map((e) => (
                                            <div key={e.ordem} className="flex items-start gap-2 text-sm">
                                                <span className="mt-0.5 shrink-0">{etapaBadge(e)}</span>
                                                <div className="flex-1 min-w-0">
                                                    {(e.aprovadorNome ?? e.roleFilaNome) && (
                                                        <span className="text-xs text-muted-foreground">{e.aprovadorNome ?? e.roleFilaNome}</span>
                                                    )}
                                                    {e.observacao && <p className="text-xs text-red-700 mt-0.5">{e.observacao}</p>}
                                                    {e.dataUtc && <p className="text-[11px] text-muted-foreground">{fmtDateTime(e.dataUtc)}</p>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

/* ══════════════════════ SUB-COMPONENTS ══════════════════════ */

function ComissaoDetailGrid({ item, full = false }: { item: ApiComissao; full?: boolean }) {
    const fields: { label: string; value: React.ReactNode }[] = [
        { label: "Funcionário", value: item.funcionarioNome ?? "—" },
        { label: "Tipo",        value: TIPO_LABELS[item.tipoPagamentoExtra] ?? item.tipoPagamentoExtra },
        { label: "Descrição",   value: item.descricao },
        { label: "Competência", value: fmtCompetencia(item.competencia) },
        { label: "Pgto em",     value: fmtDate(item.dataPagamento) },
        { label: "Valor",       value: <span className="font-semibold">{fmtMoeda(item.valor)}</span> },
        { label: "Status",      value: statusBadge(item.status) },
    ];
    if (full) {
        fields.push(
            { label: "Importado por", value: (
                <span className="flex items-center gap-1">
                    <User className="size-3 text-muted-foreground" />
                    {item.importadoPorNome ?? item.solicitanteNome ?? "—"}
                </span>
            )},
            { label: "Importado em", value: (
                <span className="flex items-center gap-1">
                    <Calendar className="size-3 text-muted-foreground" />
                    {fmtDateTime(item.importadaEmUtc ?? item.createdAtUtc)}
                </span>
            )},
            { label: "Aprovado em", value: fmtDateTime(item.approvedAtUtc) },
        );
        if (item.observacoes) {
            fields.push({ label: "Observações", value: <span className="text-xs text-muted-foreground">{item.observacoes}</span> });
        }
        if (item.integracaoResultado !== null || item.integradaEmUtc) {
            fields.push(
                { label: "TOTVS", value: item.integracaoResultado === 1
                    ? <span className="text-xs text-emerald-700 font-medium">Sucesso</span>
                    : <span className="text-xs text-red-700">{item.integracaoMensagem ?? "Falha"}</span>
                },
                { label: "Integrado em", value: fmtDateTime(item.integradaEmUtc) },
            );
        }
    }
    return (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-1">
            {fields.map(({ label, value }) => (
                <div key={label}>
                    <dt className="text-xs text-muted-foreground uppercase tracking-wide">{label}</dt>
                    <dd className="text-sm mt-0.5">{value}</dd>
                </div>
            ))}
        </dl>
    );
}

function PaginationBar({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (p: number) => void }) {
    if (pages <= 1) return null;
    return (
        <div className="flex items-center justify-between pt-3">
            <span className="text-xs text-muted-foreground">{total} registro(s)</span>
            <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Página {page} de {pages}</span>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => onChange(page - 1)}>
                    <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === pages} onClick={() => onChange(page + 1)}>
                    <ChevronRight className="size-4" />
                </Button>
            </div>
        </div>
    );
}
