"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    DollarSign,
    Upload,
    CheckCircle2,
    XCircle,
    Clock,
    Send,
    RefreshCw,
    Search,
    Eye,
    Plus,
    FileSpreadsheet,
    Megaphone,
    AlertTriangle,
    Ban,
    X,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

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

/* ──────────────────────────── types ──────────────────────────── */

type ComissaoStatus =
    | "Rascunho"
    | "PendenteAprovacao"
    | "Aprovada"
    | "Reprovada"
    | "AjustesNecessarios"
    | "Comunicada";

interface Comissao {
    id: string;
    prestadorNome: string;
    prestadorCpf: string;
    competencia: string; // "2025-01"
    percentual: number;
    valorBase: number;
    valorBruto: number;
    status: ComissaoStatus;
    observacao: string | null;
    aprovadoPorNome: string | null;
    aprovadoEmUtc: string | null;
    mensagemComunicado: string | null;
    comunicadoEmUtc: string | null;
    createdAtUtc: string;
}

interface CsvRow {
    prestadorNome: string;
    prestadorCpf: string;
    percentual: number;
    valorBase: number;
    valorBruto: number;
    observacao: string;
}

type TabId = "importacao" | "aprovacao" | "comunicacao";

/* ──────────────────────────── helpers ──────────────────────────── */

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function fmtMoeda(v: number) {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtCompetencia(c: string) {
    if (!c) return "—";
    const [year, month] = c.split("-");
    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${months[Number(month) - 1]}/${year}`;
}

function fmtDate(d: string | null) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function parseCsv(raw: string): CsvRow[] {
    const lines = raw.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(/[;,]/).map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length < 5) continue;
        const valorBase = parseFloat(cols[3].replace(",", ".")) || 0;
        const percentual = parseFloat(cols[2].replace(",", ".")) || 0;
        rows.push({
            prestadorNome: cols[0] || "",
            prestadorCpf: cols[1] || "",
            percentual,
            valorBase,
            valorBruto: parseFloat(cols[4].replace(",", ".")) || valorBase * (1 + percentual / 100),
            observacao: cols[5] || "",
        });
    }
    return rows;
}

const STATUS_MAP: Record<ComissaoStatus, { label: string; color: string; icon: React.ElementType }> = {
    Rascunho:           { label: "Rascunho",  color: "bg-zinc-400/15 text-zinc-600",       icon: FileSpreadsheet },
    PendenteAprovacao:  { label: "Pendente",   color: "bg-amber-500/15 text-amber-700",      icon: Clock },
    Aprovada:           { label: "Aprovada",   color: "bg-emerald-500/15 text-emerald-700",  icon: CheckCircle2 },
    Reprovada:          { label: "Reprovada",  color: "bg-red-500/15 text-red-700",          icon: XCircle },
    AjustesNecessarios: { label: "Ajustes",    color: "bg-orange-500/15 text-orange-700",    icon: AlertTriangle },
    Comunicada:         { label: "Comunicada", color: "bg-sky-500/15 text-sky-700",          icon: Megaphone },
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

/* ──────────────────────── seed data ──────────────────────── */

const SEED: Comissao[] = [
    {
        id: "a1", prestadorNome: "Ana Clara Silva", prestadorCpf: "111.222.333-44",
        competencia: "2025-03", percentual: 5, valorBase: 18000, valorBruto: 18900,
        status: "PendenteAprovacao", observacao: null,
        aprovadoPorNome: null, aprovadoEmUtc: null, mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
        id: "a2", prestadorNome: "Bruno Henrique Costa", prestadorCpf: "222.333.444-55",
        competencia: "2025-03", percentual: 7, valorBase: 12000, valorBruto: 12840,
        status: "PendenteAprovacao", observacao: "Referente ao projeto Alpha.",
        aprovadoPorNome: null, aprovadoEmUtc: null, mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
        id: "a3", prestadorNome: "Carla Mendes Ferreira", prestadorCpf: "333.444.555-66",
        competencia: "2025-02", percentual: 4, valorBase: 9500, valorBruto: 9880,
        status: "Aprovada", observacao: null,
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 5 * 86400000).toISOString(),
        mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
        id: "a4", prestadorNome: "Diego Rocha Santos", prestadorCpf: "444.555.666-77",
        competencia: "2025-02", percentual: 6, valorBase: 15000, valorBruto: 15900,
        status: "Comunicada", observacao: null,
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 12 * 86400000).toISOString(),
        mensagemComunicado: "Sua comissão ref. Fev/2025 foi processada. Verifique seu comprovante.",
        comunicadoEmUtc: new Date(Date.now() - 8 * 86400000).toISOString(),
        createdAtUtc: new Date(Date.now() - 15 * 86400000).toISOString(),
    },
    {
        id: "a5", prestadorNome: "Elena Ribeiro Lima", prestadorCpf: "555.666.777-88",
        competencia: "2025-02", percentual: 5, valorBase: 21000, valorBruto: 22050,
        status: "Reprovada", observacao: "Valores divergentes com o relatório contábil.",
        aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date(Date.now() - 11 * 86400000).toISOString(),
        mensagemComunicado: null, comunicadoEmUtc: null,
        createdAtUtc: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
];

const PAGE_SIZE = 10;

/* ══════════════════════════ MAIN SCREEN ══════════════════════════ */

export default function ComissoesScreen() {
    const [items, setItems] = useState<Comissao[]>(SEED);
    const [activeTab, setActiveTab] = useState<TabId>("importacao");

    /* ── import modal ── */
    const [importOpen, setImportOpen]       = useState(false);
    const [competencia, setCompetencia]     = useState("");
    const [csvText, setCsvText]             = useState("");
    const [csvRows, setCsvRows]             = useState<CsvRow[]>([]);
    const [importLoading, setImportLoading] = useState(false);
    const fileInputRef                      = useRef<HTMLInputElement>(null);

    /* ── approval modal ── */
    const [approvalOpen, setApprovalOpen]       = useState(false);
    const [selected, setSelected]               = useState<Comissao | null>(null);
    const [obsAprovador, setObsAprovador]       = useState("");
    const [approvalLoading, setApprovalLoading] = useState(false);

    /* ── communicate modal ── */
    const [commOpen, setCommOpen]         = useState(false);
    const [commSelected, setCommSelected] = useState<Comissao | null>(null);
    const [commMsg, setCommMsg]           = useState("");
    const [commLoading, setCommLoading]   = useState(false);

    /* ── detail modal ── */
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailItem, setDetailItem] = useState<Comissao | null>(null);

    /* ── pagination ── */
    const [importPage, setImportPage]     = useState(1);
    const [approvalPage, setApprovalPage] = useState(1);
    const [commPage, setCommPage]         = useState(1);

    /* ── search ── */
    const [importSearch, setImportSearch]     = useState("");
    const [approvalSearch, setApprovalSearch] = useState("");
    const [commSearch, setCommSearch]         = useState("");

    /* ── derived lists ── */
    const importItems = useMemo(() => {
        const q = importSearch.toLowerCase();
        return items.filter((i) => !q || i.prestadorNome.toLowerCase().includes(q) || i.prestadorCpf.includes(q));
    }, [items, importSearch]);

    const pendingItems = useMemo(() => {
        const q = approvalSearch.toLowerCase();
        return items.filter(
            (i) => (i.status === "PendenteAprovacao" || i.status === "AjustesNecessarios") &&
                   (!q || i.prestadorNome.toLowerCase().includes(q)),
        );
    }, [items, approvalSearch]);

    const approvedItems = useMemo(() => {
        const q = commSearch.toLowerCase();
        return items.filter((i) => i.status === "Aprovada" && (!q || i.prestadorNome.toLowerCase().includes(q)));
    }, [items, commSearch]);

    /* ── KPIs ── */
    const kpi = useMemo(() => ({
        total:      items.length,
        pendente:   items.filter((i) => i.status === "PendenteAprovacao" || i.status === "AjustesNecessarios").length,
        aprovada:   items.filter((i) => i.status === "Aprovada").length,
        comunicada: items.filter((i) => i.status === "Comunicada").length,
    }), [items]);

    /* ──────────────── CSV ──────────────── */

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setCsvText(text);
            setCsvRows(parseCsv(text));
        };
        reader.readAsText(file, "utf-8");
    }, []);

    const handleCsvTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setCsvText(e.target.value);
        setCsvRows(parseCsv(e.target.value));
    }, []);

    function resetImportModal() {
        setCompetencia("");
        setCsvText("");
        setCsvRows([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    /* ──────────────── submit import ──────────────── */

    async function handleSubmitImport() {
        if (!competencia) { toast.error("Informe a competência."); return; }
        if (csvRows.length === 0) { toast.error("Nenhum registro válido encontrado."); return; }
        setImportLoading(true);
        try {
            // TODO: POST /api/comissoes/importar  →  { competencia, linhas: csvRows }
            await new Promise((r) => setTimeout(r, 800));
            const now = new Date().toISOString();
            const novas: Comissao[] = csvRows.map((row) => ({
                id: uid(),
                prestadorNome: row.prestadorNome,
                prestadorCpf: row.prestadorCpf,
                competencia,
                percentual: row.percentual,
                valorBase: row.valorBase,
                valorBruto: row.valorBruto,
                status: "PendenteAprovacao",
                observacao: row.observacao || null,
                aprovadoPorNome: null,
                aprovadoEmUtc: null,
                mensagemComunicado: null,
                comunicadoEmUtc: null,
                createdAtUtc: now,
            }));
            setItems((prev) => [...novas, ...prev]);
            toast.success(`${novas.length} comissão(ões) importada(s) e enviada(s) para aprovação.`);
            setImportOpen(false);
            resetImportModal();
            setActiveTab("aprovacao");
        } catch (e) {
            toast.error(`Falha na importação: ${e instanceof Error ? e.message : "erro desconhecido"}`);
        } finally {
            setImportLoading(false);
        }
    }

    /* ──────────────── approval actions ──────────────── */

    function openApproval(item: Comissao) {
        setSelected(item);
        setObsAprovador(item.observacao ?? "");
        setApprovalOpen(true);
    }

    async function handleApprovalAction(action: "aprovar" | "reprovar" | "ajustes") {
        if (!selected) return;
        setApprovalLoading(true);
        try {
            // TODO: PATCH /api/comissoes/{id}/aprovacao  →  { acao, observacao }
            await new Promise((r) => setTimeout(r, 600));
            const nextStatus: ComissaoStatus =
                action === "aprovar"  ? "Aprovada" :
                action === "reprovar" ? "Reprovada" : "AjustesNecessarios";
            setItems((prev) => prev.map((i) =>
                i.id === selected.id
                    ? { ...i, status: nextStatus, observacao: obsAprovador || null, aprovadoPorNome: "Gestor RH", aprovadoEmUtc: new Date().toISOString() }
                    : i,
            ));
            toast.success({ aprovar: "Comissão aprovada.", reprovar: "Comissão reprovada.", ajustes: "Ajustes solicitados." }[action]);
            setApprovalOpen(false);
            setSelected(null);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setApprovalLoading(false);
        }
    }

    /* ──────────────── communicate ──────────────── */

    function openCommunicate(item: Comissao) {
        setCommSelected(item);
        setCommMsg(`Prezado(a) ${item.prestadorNome}, informamos que sua comissão referente à competência ${fmtCompetencia(item.competencia)} no valor de ${fmtMoeda(item.valorBruto)} foi aprovada e será processada conforme acordado. Qualquer dúvida, entre em contato com o RH.`);
        setCommOpen(true);
    }

    async function handleCommunicate() {
        if (!commSelected) return;
        if (!commMsg.trim()) { toast.error("Digite a mensagem para o prestador."); return; }
        setCommLoading(true);
        try {
            // TODO: POST /api/comissoes/{id}/comunicar  →  { mensagem }
            await new Promise((r) => setTimeout(r, 600));
            setItems((prev) => prev.map((i) =>
                i.id === commSelected.id
                    ? { ...i, status: "Comunicada", mensagemComunicado: commMsg, comunicadoEmUtc: new Date().toISOString() }
                    : i,
            ));
            toast.success(`Comissão comunicada ao prestador ${commSelected.prestadorNome}.`);
            setCommOpen(false);
            setCommSelected(null);
            setCommMsg("");
        } catch (e) {
            toast.error(`Falha ao comunicar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setCommLoading(false);
        }
    }

    /* ──────────────── pagination ──────────────── */

    function paginate<T>(arr: T[], page: number) {
        const start = (page - 1) * PAGE_SIZE;
        return { rows: arr.slice(start, start + PAGE_SIZE), pages: Math.max(1, Math.ceil(arr.length / PAGE_SIZE)) };
    }

    /* ══════════════════════════ RENDER ══════════════════════════ */

    const TABS: { id: TabId; label: string; badge?: number }[] = [
        { id: "importacao",  label: "Importação" },
        { id: "aprovacao",   label: "Aprovação",   badge: kpi.pendente },
        { id: "comunicacao", label: "Comunicação",  badge: kpi.aprovada },
    ];

    return (
        <section className="space-y-4">

            {/* ── Page header ── */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Comissões</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Importe comissões, envie para aprovação e comunique os prestadores de serviço
                    </p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setImportOpen(true)}>
                    <Plus className="size-4" /> Nova Importação
                </Button>
            </div>

            {/* ── KPI chips ── */}
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <DollarSign className="size-3.5 text-muted-foreground" />
                    <span className="text-[11px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-bold">{kpi.total}</span>
                </div>
                {(
                    [
                        { label: "Pendentes",   value: kpi.pendente,   color: "text-amber-600",   icon: Clock },
                        { label: "Aprovadas",   value: kpi.aprovada,   color: "text-emerald-600", icon: CheckCircle2 },
                        { label: "Comunicadas", value: kpi.comunicada, color: "text-sky-600",      icon: Megaphone },
                    ] as const
                ).map(({ label, value, color, icon: Icon }) => (
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
                                active
                                    ? "border-primary text-primary"
                                    : "border-transparent text-muted-foreground hover:text-foreground"
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
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
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
                                placeholder="Buscar prestador…"
                                value={importSearch}
                                onChange={(e) => { setImportSearch(e.target.value); setImportPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Prestador</TableHead>
                                <TableHead>CPF</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">%</TableHead>
                                <TableHead className="text-right">Valor Bruto</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Importado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {paginate(importItems, importPage).rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-10 text-sm">
                                        Nenhuma comissão importada ainda.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginate(importItems, importPage).rows.map((item) => (
                                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/40">
                                        <TableCell className="font-medium">{item.prestadorNome}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{item.prestadorCpf}</TableCell>
                                        <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                        <TableCell className="text-right">{item.percentual}%</TableCell>
                                        <TableCell className="text-right font-medium">{fmtMoeda(item.valorBruto)}</TableCell>
                                        <TableCell>{statusBadge(item.status)}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{fmtDate(item.createdAtUtc)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => { setDetailItem(item); setDetailOpen(true); }}>
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

            {/* ════════════ TAB: APROVAÇÃO ════════════ */}
            {activeTab === "aprovacao" && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
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
                                placeholder="Buscar prestador…"
                                value={approvalSearch}
                                onChange={(e) => { setApprovalSearch(e.target.value); setApprovalPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Prestador</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">%</TableHead>
                                <TableHead className="text-right">Valor Bruto</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Observação</TableHead>
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
                                paginate(pendingItems, approvalPage).rows.map((item) => (
                                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openApproval(item)}>
                                        <TableCell className="font-medium">{item.prestadorNome}</TableCell>
                                        <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                        <TableCell className="text-right">{item.percentual}%</TableCell>
                                        <TableCell className="text-right font-medium">{fmtMoeda(item.valorBruto)}</TableCell>
                                        <TableCell>{statusBadge(item.status)}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs max-w-[180px] truncate">{item.observacao || "—"}</TableCell>
                                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => { setDetailItem(item); setDetailOpen(true); }}>
                                                    <Eye className="size-3.5" /> Ver
                                                </Button>
                                                <Button size="sm" className="h-7 gap-1" onClick={() => openApproval(item)}>
                                                    <CheckCircle2 className="size-3.5" /> Avaliar
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <PaginationBar page={approvalPage} pages={paginate(pendingItems, approvalPage).pages} total={pendingItems.length} onChange={setApprovalPage} />
                </div>
            )}

            {/* ════════════ TAB: COMUNICAÇÃO ════════════ */}
            {activeTab === "comunicacao" && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <div className="font-semibold flex items-center gap-2">
                                <Megaphone className="size-4 text-sky-600" /> Aprovadas — Aguardando Comunicação
                            </div>
                            <div className="text-muted-foreground text-sm">{approvedItems.length} comissão(ões) aprovada(s)</div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                className="w-[260px] pl-8"
                                placeholder="Buscar prestador…"
                                value={commSearch}
                                onChange={(e) => { setCommSearch(e.target.value); setCommPage(1); }}
                            />
                        </div>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Prestador</TableHead>
                                <TableHead>Competência</TableHead>
                                <TableHead className="text-right">Valor Bruto</TableHead>
                                <TableHead>Aprovado por</TableHead>
                                <TableHead>Aprovado em</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {approvedItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-sm">
                                        Nenhuma comissão aprovada aguardando comunicação.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginate(approvedItems, commPage).rows.map((item) => (
                                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/40">
                                        <TableCell className="font-medium">{item.prestadorNome}</TableCell>
                                        <TableCell>{fmtCompetencia(item.competencia)}</TableCell>
                                        <TableCell className="text-right font-medium">{fmtMoeda(item.valorBruto)}</TableCell>
                                        <TableCell className="text-muted-foreground">{item.aprovadoPorNome || "—"}</TableCell>
                                        <TableCell className="text-muted-foreground text-xs">{fmtDate(item.aprovadoEmUtc)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => { setDetailItem(item); setDetailOpen(true); }}>
                                                    <Eye className="size-3.5" /> Ver
                                                </Button>
                                                <Button size="sm" className="h-7 gap-1.5 bg-sky-600 hover:bg-sky-700 text-white" onClick={() => openCommunicate(item)}>
                                                    <Megaphone className="size-3.5" /> Comunicar
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                    <PaginationBar page={commPage} pages={paginate(approvedItems, commPage).pages} total={approvedItems.length} onChange={setCommPage} />
                </div>
            )}

            {/* ══════════ MODAL: IMPORTAÇÃO ══════════ */}
            <Dialog open={importOpen} onOpenChange={(o) => { if (!o) resetImportModal(); setImportOpen(o); }}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Upload className="size-5 text-primary" /> Importar Comissões
                        </DialogTitle>
                        <DialogDescription>
                            Faça o upload de um CSV ou cole os dados abaixo. As comissões serão enviadas automaticamente para aprovação.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-5 py-2">
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Competência <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                inputMode="numeric"
                                placeholder="AAAA-MM"
                                title="Competência no formato AAAA-MM"
                                pattern="\d{4}-\d{2}"
                                value={competencia}
                                onChange={(e) => setCompetencia(e.target.value)}
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-48"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Arquivo CSV</label>
                            <div
                                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-6 cursor-pointer hover:border-primary/50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <FileSpreadsheet className="size-8 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">Clique para selecionar ou arraste um arquivo .csv</span>
                                <span className="text-xs text-muted-foreground/70">Formato: Nome;CPF;Percentual;Valor Base;Valor Bruto;Observação</span>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.txt"
                                title="Selecionar arquivo CSV"
                                aria-label="Selecionar arquivo CSV"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium">Ou cole o conteúdo CSV</label>
                            <textarea
                                rows={4}
                                title="Conteúdo CSV"
                                placeholder={"Nome;CPF;Percentual;Valor Base;Valor Bruto;Observação\nJoão Silva;111.222.333-44;5;10000;10500;Projeto Beta"}
                                value={csvText}
                                onChange={handleCsvTextChange}
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring resize-y min-h-[90px]"
                            />
                        </div>

                        {csvRows.length > 0 && (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium">Prévia — {csvRows.length} registro(s)</span>
                                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => { setCsvRows([]); setCsvText(""); }}>
                                        <X className="size-3.5" /> Limpar
                                    </Button>
                                </div>
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Prestador</TableHead>
                                                <TableHead>CPF</TableHead>
                                                <TableHead className="text-right">%</TableHead>
                                                <TableHead className="text-right">Base</TableHead>
                                                <TableHead className="text-right">Bruto</TableHead>
                                                <TableHead>Obs.</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {csvRows.slice(0, 5).map((row, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="font-medium">{row.prestadorNome || <span className="text-red-500">—</span>}</TableCell>
                                                    <TableCell className="text-muted-foreground">{row.prestadorCpf}</TableCell>
                                                    <TableCell className="text-right">{row.percentual}%</TableCell>
                                                    <TableCell className="text-right">{fmtMoeda(row.valorBase)}</TableCell>
                                                    <TableCell className="text-right font-medium">{fmtMoeda(row.valorBruto)}</TableCell>
                                                    <TableCell className="text-muted-foreground text-xs">{row.observacao || "—"}</TableCell>
                                                </TableRow>
                                            ))}
                                            {csvRows.length > 5 && (
                                                <TableRow>
                                                    <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-2">
                                                        + {csvRows.length - 5} registro(s) não exibido(s)
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importLoading}>
                            Cancelar
                        </Button>
                        <Button onClick={() => void handleSubmitImport()} disabled={importLoading || csvRows.length === 0}>
                            {importLoading
                                ? <><RefreshCw className="size-4 animate-spin mr-2" />Importando…</>
                                : <><Send className="size-4 mr-2" />Enviar para Aprovação</>}
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
                    {selected && (
                        <div className="flex flex-col gap-4 py-1">
                            <DetailGrid item={selected} />
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Observação do aprovador</label>
                                <textarea
                                    rows={3}
                                    title="Observação do aprovador"
                                    placeholder="Opcional — justificativa ou instruções."
                                    value={obsAprovador}
                                    onChange={(e) => setObsAprovador(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex flex-wrap gap-2 justify-end">
                        <Button variant="outline" onClick={() => setApprovalOpen(false)} disabled={approvalLoading}>Fechar</Button>
                        <Button variant="outline" className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50" onClick={() => void handleApprovalAction("ajustes")} disabled={approvalLoading}>
                            <AlertTriangle className="size-4" /> Pedir Ajustes
                        </Button>
                        <Button variant="outline" className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50" onClick={() => void handleApprovalAction("reprovar")} disabled={approvalLoading}>
                            {approvalLoading ? <RefreshCw className="size-4 animate-spin" /> : <Ban className="size-4" />} Reprovar
                        </Button>
                        <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => void handleApprovalAction("aprovar")} disabled={approvalLoading}>
                            {approvalLoading ? <RefreshCw className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Aprovar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════ MODAL: COMUNICAR ══════════ */}
            <Dialog open={commOpen} onOpenChange={setCommOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Megaphone className="size-5 text-sky-600" /> Comunicar ao Prestador
                        </DialogTitle>
                        <DialogDescription>
                            A mensagem abaixo será registrada e enviada ao prestador de serviço.
                        </DialogDescription>
                    </DialogHeader>
                    {commSelected && (
                        <div className="flex flex-col gap-4 py-1">
                            <DetailGrid item={commSelected} />
                            <div className="flex flex-col gap-1.5">
                                <label className="text-sm font-medium">Mensagem para o prestador <span className="text-red-500">*</span></label>
                                <textarea
                                    rows={5}
                                    title="Mensagem para o prestador"
                                    placeholder="Digite a mensagem que será enviada ao prestador…"
                                    value={commMsg}
                                    onChange={(e) => setCommMsg(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setCommOpen(false)} disabled={commLoading}>Cancelar</Button>
                        <Button className="gap-1.5 bg-sky-600 hover:bg-sky-700" onClick={() => void handleCommunicate()} disabled={commLoading || !commMsg.trim()}>
                            {commLoading ? <RefreshCw className="size-4 animate-spin" /> : <Megaphone className="size-4" />} Comunicar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ══════════ MODAL: DETALHE ══════════ */}
            <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Eye className="size-5 text-muted-foreground" /> Detalhe da Comissão
                        </DialogTitle>
                    </DialogHeader>
                    {detailItem && <DetailGrid item={detailItem} full />}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailOpen(false)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

/* ══════════════════════ SUB-COMPONENTS ══════════════════════ */

function DetailGrid({ item, full = false }: { item: Comissao; full?: boolean }) {
    const fields: { label: string; value: React.ReactNode }[] = [
        { label: "Prestador",   value: item.prestadorNome },
        { label: "CPF",         value: item.prestadorCpf },
        { label: "Competência", value: fmtCompetencia(item.competencia) },
        { label: "Percentual",  value: `${item.percentual}%` },
        { label: "Valor Base",  value: fmtMoeda(item.valorBase) },
        { label: "Valor Bruto", value: <span className="font-semibold">{fmtMoeda(item.valorBruto)}</span> },
        { label: "Status",      value: statusBadge(item.status) },
    ];
    if (full) {
        fields.push(
            { label: "Observação",    value: item.observacao || "—" },
            { label: "Aprovado por",  value: item.aprovadoPorNome || "—" },
            { label: "Aprovado em",   value: fmtDate(item.aprovadoEmUtc) },
            { label: "Importado em",  value: fmtDate(item.createdAtUtc) },
            { label: "Comunicado em", value: fmtDate(item.comunicadoEmUtc) },
        );
        if (item.mensagemComunicado) {
            fields.push({ label: "Mensagem enviada", value: <span className="text-xs text-muted-foreground italic">{item.mensagemComunicado}</span> });
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
