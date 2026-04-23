"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Search,
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    FileText,
    Loader2,
    Users,
    CalendarDays,
    TrendingUp,
    UserMinus,
    Palmtree,
    Heart,
    MapPin,
    DollarSign,
    Briefcase,
    PlayCircle,
    PauseCircle,
    ChevronDown,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import {
    AGING_BUCKETS,
    type AgingBucket,
    matchesAgingBucket,
    daysSince,
} from "@/features/shared/urgencia";
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
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

/* ─── Types ──────────────────────────────────────────────── */

type TipoKey =
    | "recrutamento"
    | "movimentacoes"
    | "desligamentos"
    | "ferias"
    | "beneficios"
    | "dependentes"
    | "enderecos"
    | "pagamento-extra";

interface TodoRow {
    id: string;
    tipo: TipoKey;
    tipoLabel: string;
    pessoaNome: string;
    status: number;
    statusLabel: string;
    statusColor: string;
    statusIcon: React.ElementType;
    createdAtUtc: string;
}

/* ─── Status helpers ─────────────────────────────────────── */

const GESTAO_STATUS_STR_TO_NUM: Record<string, number> = {
    Rascunho: 0,
    PendenteAprovacao: 1,
    Aprovada: 2,
    Reprovada: 3,
    AjustesNecessarios: 4,
    Cancelada: 5,
    PendenteAprovacaoRh: 6,
    EmIntegracao: 7,
    Concluida: 8,
};

function normalizeGestaoStatus(s: number | string): number {
    return typeof s === "number" ? s : (GESTAO_STATUS_STR_TO_NUM[s] ?? 0);
}

const GESTAO_STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho",      color: "bg-zinc-400/15 text-zinc-600",       icon: FileText },
    1: { label: "Pendente",      color: "bg-amber-500/15 text-amber-700",     icon: Clock },
    2: { label: "Aprovada",      color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada",     color: "bg-red-500/15 text-red-700",         icon: XCircle },
    4: { label: "Ajustes",       color: "bg-orange-500/15 text-orange-700",   icon: AlertTriangle },
    5: { label: "Cancelada",     color: "bg-zinc-500/15 text-zinc-500",       icon: XCircle },
    6: { label: "Aguarda Fila",  color: "bg-violet-500/15 text-violet-700",   icon: Users },
    7: { label: "Em Integração", color: "bg-blue-500/15 text-blue-700",       icon: Loader2 },
    8: { label: "Concluída",     color: "bg-teal-500/15 text-teal-700",       icon: CheckCircle2 },
};

const WF_STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Não Iniciado", color: "bg-zinc-400/15 text-zinc-500",  icon: PauseCircle },
    1: { label: "Em Andamento", color: "bg-blue-500/15 text-blue-700",  icon: PlayCircle },
    2: { label: "Concluído",    color: "bg-teal-500/15 text-teal-700",  icon: CheckCircle2 },
    3: { label: "Cancelado",    color: "bg-zinc-500/15 text-zinc-500",  icon: XCircle },
};

function statusBadge(row: TodoRow) {
    const Icon = row.statusIcon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${row.statusColor}`}>
            <Icon className="size-3" />
            {row.statusLabel}
        </span>
    );
}

const ATIVAS = new Set(["0", "1", "4", "5", "6", "7"]);

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("pt-BR", {
            day: "2-digit", month: "2-digit", year: "numeric",
        });
    } catch { return "—"; }
}

function agingLabel(iso: string) {
    const d = daysSince(iso);
    if (d === 0) return "hoje";
    if (d === 1) return "1d";
    return `${d}d`;
}

/* ─── Source definitions ─────────────────────────────────── */

interface SourceDef {
    tipo: TipoKey;
    tipoLabel: string;
    icon: React.ElementType;
    color: string;
    api: string;
    getName: (row: Record<string, unknown>) => string;
    getStatus: (row: Record<string, unknown>) => { status: number; label: string; color: string; icon: React.ElementType };
}

function gestaoStatus(row: Record<string, unknown>) {
    const s = normalizeGestaoStatus(row.status as number | string);
    const m = GESTAO_STATUS_MAP[s] ?? GESTAO_STATUS_MAP[1];
    return { status: s, label: m.label, color: m.color, icon: m.icon };
}

const SOURCES: SourceDef[] = [
    {
        tipo: "recrutamento",
        tipoLabel: "Recrutamento",
        icon: Briefcase,
        color: "text-violet-600",
        api: "/api/workflow-rh",
        getName: (r) => String(r.candidatoNome ?? r.vagaTitulo ?? "—"),
        getStatus: (r) => {
            const s = Number(r.status ?? 0);
            const m = WF_STATUS_MAP[s] ?? WF_STATUS_MAP[0];
            return { status: s, label: m.label, color: m.color, icon: m.icon };
        },
    },
    {
        tipo: "movimentacoes",
        tipoLabel: "Movimentação",
        icon: TrendingUp,
        color: "text-teal-600",
        api: "/api/solicitacoes-promocao",
        getName: (r) => String(r.funcionarioNome ?? r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
    {
        tipo: "desligamentos",
        tipoLabel: "Desligamento",
        icon: UserMinus,
        color: "text-rose-600",
        api: "/api/solicitacoes-desligamento",
        getName: (r) => String(r.funcionarioNome ?? r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
    {
        tipo: "ferias",
        tipoLabel: "Férias",
        icon: Palmtree,
        color: "text-sky-600",
        api: "/api/colaborador/solicitacoes-ferias",
        getName: (r) => String(r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
    {
        tipo: "beneficios",
        tipoLabel: "Benefícios",
        icon: Heart,
        color: "text-pink-600",
        api: "/api/colaborador/solicitacoes-beneficio",
        getName: (r) => String(r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
    {
        tipo: "dependentes",
        tipoLabel: "Dependentes",
        icon: Users,
        color: "text-indigo-600",
        api: "/api/colaborador/solicitacoes-dependente",
        getName: (r) => String(r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
    {
        tipo: "enderecos",
        tipoLabel: "Endereço",
        icon: MapPin,
        color: "text-zinc-600",
        api: "/api/colaborador/solicitacoes-endereco",
        getName: (r) => String(r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
    {
        tipo: "pagamento-extra",
        tipoLabel: "Pagamento Extra",
        icon: DollarSign,
        color: "text-emerald-600",
        api: "/api/colaborador/solicitacoes-pagamento-extra",
        getName: (r) => String(r.funcionarioNome ?? r.solicitanteNome ?? "—"),
        getStatus: gestaoStatus,
    },
];

async function fetchSource(src: SourceDef): Promise<TodoRow[]> {
    try {
        const res = await apiFetch(src.api, { cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json() as unknown;
        if (!Array.isArray(data)) return [];
        return (data as Record<string, unknown>[]).map((row) => {
            const { status, label, color, icon } = src.getStatus(row);
            return {
                id: String(row.id ?? ""),
                tipo: src.tipo,
                tipoLabel: src.tipoLabel,
                pessoaNome: src.getName(row),
                status,
                statusLabel: label,
                statusColor: color,
                statusIcon: icon,
                createdAtUtc: String(row.createdAtUtc ?? ""),
            };
        });
    } catch {
        return [];
    }
}

/* ─── Filter option definitions ─────────────────────────── */

const STATUS_OPTIONS = [
    { value: "ativas",     label: "Ativas",                   countFn: (rows: TodoRow[]) => rows.filter(r => ATIVAS.has(String(r.status))).length },
    { value: "aprovadas",  label: "Aprovadas / Concluídas",   countFn: (rows: TodoRow[]) => rows.filter(r => r.status === 2).length },
    { value: "reprovadas", label: "Reprovadas / Canceladas",  countFn: (rows: TodoRow[]) => rows.filter(r => r.status === 3).length },
    { value: "all",        label: "Todas",                    countFn: (rows: TodoRow[]) => rows.length },
] as const;

const AGING_OPTIONS: { value: AgingBucket; label: string }[] = [
    { value: "", label: "Todos" },
    ...AGING_BUCKETS,
];

/* ─── Trigger button helper ──────────────────────────────── */

function FilterTrigger({ label }: { label: string }) {
    return (
        <DropdownMenuTrigger asChild>
            <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background px-2 text-xs transition-colors text-muted-foreground hover:text-foreground"
            >
                {label}
                <ChevronDown className="size-3 opacity-60" aria-hidden />
            </button>
        </DropdownMenuTrigger>
    );
}

/* ─── Component ──────────────────────────────────────────── */

export default function TodosScreen() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<TodoRow[]>([]);

    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("ativas");
    const [tipoFilter, setTipoFilter] = useState<TipoKey | "">("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [agingBucket, setAgingBucket] = useState<AgingBucket>("");

    useEffect(() => {
        setLoading(true);
        Promise.all(SOURCES.map(fetchSource))
            .then((results) => {
                const all = results
                    .flat()
                    .sort((a, b) =>
                        new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()
                    );
                setRows(all);
            })
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(() => {
        const term = q.trim().toLowerCase();
        return rows.filter((r) => {
            const s = String(r.status);
            if (statusFilter === "ativas"    && !ATIVAS.has(s)) return false;
            if (statusFilter === "aprovadas" && s !== "2") return false;
            if (statusFilter === "reprovadas"&& s !== "3") return false;
            if (tipoFilter && r.tipo !== tipoFilter) return false;
            if (dateFrom && r.createdAtUtc && new Date(r.createdAtUtc) < new Date(dateFrom)) return false;
            if (dateTo && r.createdAtUtc && new Date(r.createdAtUtc) > new Date(`${dateTo}T23:59:59`)) return false;
            if (!matchesAgingBucket(r.createdAtUtc, agingBucket)) return false;
            if (term && !r.pessoaNome.toLowerCase().includes(term)) return false;
            return true;
        });
    }, [rows, q, statusFilter, tipoFilter, dateFrom, dateTo, agingBucket]);

    const selectedStatusLabel = STATUS_OPTIONS.find(o => o.value === statusFilter)?.label ?? "Todas";
    const selectedStatusCount = STATUS_OPTIONS.find(o => o.value === statusFilter)?.countFn(rows) ?? rows.length;

    const selectedTipoLabel = tipoFilter
        ? (SOURCES.find(s => s.tipo === tipoFilter)?.tipoLabel ?? "Tipo")
        : "Todos os tipos";
    const selectedTipoCount = tipoFilter
        ? rows.filter(r => r.tipo === tipoFilter).length
        : rows.length;

    const selectedAgingLabel = AGING_OPTIONS.find(o => o.value === agingBucket)?.label ?? "Todos";
    const selectedAgingCount = rows.filter(r => matchesAgingBucket(r.createdAtUtc, agingBucket)).length;

    return (
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
            {/* Row 1: título + busca */}
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="font-semibold">Todas as solicitações</div>
                    <div className="text-muted-foreground text-sm">
                        {loading
                            ? "Carregando…"
                            : `${filtered.length} solicitação${filtered.length !== 1 ? "ões" : ""}`}
                    </div>
                </div>
                <div className="relative min-w-[220px]">
                    <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        className="pl-9"
                        placeholder="Buscar colaborador…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
            </div>

            {/* Row 2: dropdowns de filtro */}
            <div className="mb-3 flex flex-wrap items-center gap-2">

                {/* Status */}
                <DropdownMenu>
                    <FilterTrigger label={`${selectedStatusLabel} (${selectedStatusCount})`} />
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                        <DropdownMenuLabel>Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup value={statusFilter} onValueChange={setStatusFilter}>
                            {STATUS_OPTIONS.map((opt) => (
                                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {opt.countFn(rows)}
                                    </span>
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Tipo */}
                <DropdownMenu>
                    <FilterTrigger label={`${selectedTipoLabel} (${selectedTipoCount})`} />
                    <DropdownMenuContent align="start" className="min-w-[200px]">
                        <DropdownMenuLabel>Tipo</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                            value={tipoFilter}
                            onValueChange={(v) => setTipoFilter(v as TipoKey | "")}
                        >
                            <DropdownMenuRadioItem value="">
                                Todos os tipos
                                <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
                            </DropdownMenuRadioItem>
                            <DropdownMenuSeparator />
                            {SOURCES.map((src) => {
                                const Icon = src.icon;
                                return (
                                    <DropdownMenuRadioItem key={src.tipo} value={src.tipo}>
                                        <Icon className={`size-3.5 ${src.color}`} />
                                        {src.tipoLabel}
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            {rows.filter(r => r.tipo === src.tipo).length}
                                        </span>
                                    </DropdownMenuRadioItem>
                                );
                            })}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Aging */}
                <DropdownMenu>
                    <FilterTrigger label={`Aging: ${selectedAgingLabel} (${selectedAgingCount})`} />
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                        <DropdownMenuLabel>Aging</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                            value={agingBucket}
                            onValueChange={(v) => setAgingBucket(v as AgingBucket)}
                        >
                            {AGING_OPTIONS.map((opt) => (
                                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {rows.filter(r => matchesAgingBucket(r.createdAtUtc, opt.value)).length}
                                    </span>
                                </DropdownMenuRadioItem>
                            ))}
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Data range */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays className="size-3.5" />
                </div>
                <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
                    title="Data inicial"
                />
                <span className="text-xs text-muted-foreground">–</span>
                <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring text-muted-foreground"
                    title="Data final"
                />
                {(dateFrom || dateTo) && (
                    <button
                        type="button"
                        onClick={() => { setDateFrom(""); setDateTo(""); }}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                        Limpar
                    </button>
                )}
            </div>

            {/* Tabela */}
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Colaborador</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Criado em</TableHead>
                        <TableHead>Aging</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Carregando…
                            </TableCell>
                        </TableRow>
                    ) : filtered.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                Nenhuma solicitação encontrada.
                            </TableCell>
                        </TableRow>
                    ) : (
                        filtered.map((r) => {
                            const src = SOURCES.find(s => s.tipo === r.tipo)!;
                            const Icon = src.icon;
                            return (
                                <TableRow
                                    key={`${r.tipo}-${r.id}`}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => router.push(`/painel-rh?tab=${r.tipo}`)}
                                >
                                    <TableCell>
                                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${src.color}`}>
                                            <Icon className="size-3.5" />
                                            {r.tipoLabel}
                                        </span>
                                    </TableCell>
                                    <TableCell className="font-semibold">{r.pessoaNome}</TableCell>
                                    <TableCell>{statusBadge(r)}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDate(r.createdAtUtc)}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {r.createdAtUtc ? agingLabel(r.createdAtUtc) : "—"}
                                    </TableCell>
                                </TableRow>
                            );
                        })
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
