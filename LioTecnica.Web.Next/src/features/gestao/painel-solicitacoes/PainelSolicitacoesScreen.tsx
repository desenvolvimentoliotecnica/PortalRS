"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Search,
    RefreshCw,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    FileText,
    Briefcase,
    TrendingUp,
    UserMinus,
    Palmtree,
    Heart,
    Users,
    MapPin,
    GitBranch,
    Filter,
    UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

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

import AcompanhamentoModal, { type AprovacaoStep } from "@/features/gestao/shared/AcompanhamentoModal";
import { mapEtapasToSteps, type EtapaAprovacaoResponse } from "@/features/gestao/shared/etapaUtils";

/* ──────────────────────────── types ──────────────────────────── */

type TipoKey = "contratacao" | "promocao" | "desligamento" | "ferias" | "beneficio" | "dependentes" | "endereco";

interface UnifiedRow {
    id: string;
    tipo: TipoKey;
    descricao: string;
    solicitante: string;
    status: number;
    etapaLabel: string | null;
    etapaPendenteCom: string | null;
    etapaPendenteIsQueue: boolean;
    etapaPendenteCanAssume: boolean;
    createdAtUtc: string;
    detailApi: string;
}

/* ──────────────────────────── config ──────────────────────────── */

interface TipoCfg {
    label: string;
    icon: React.ElementType;
    color: string;
    bgColor: string;
    api: string;
    detailApiBase: string;
    mapRow: (r: Record<string, unknown>) => Omit<UnifiedRow, "tipo" | "detailApi">;
}

function s(r: Record<string, unknown>, key: string, fb = "—"): string {
    const v = r[key];
    return v == null ? fb : String(v);
}

// Status can arrive as number or enum-name string from the API
// Normalize everything to the generic convention:
// 0=Rascunho, 1=Pendente, 2=Aprovada, 3=Reprovada, 4=Ajustes, 5=Cancelada, 6=AguardaRH
const STATUS_NAME_MAP: Record<string, number> = {
    rascunho: 0, pendenteaprovacao: 1, aprovada: 2, reprovada: 3,
    ajustesnecessarios: 4, cancelada: 5, pendenteaprovacaorh: 6,
};
function parseStatus(raw: unknown): number {
    if (typeof raw === "number") return raw;
    if (typeof raw === "string") {
        const n = Number(raw);
        if (!isNaN(n)) return n;
        return STATUS_NAME_MAP[raw.toLowerCase()] ?? 0;
    }
    return 0;
}

// SolicitacaoVagaStatus C# enum: 0=Rascunho,1=PendenteAprovacao,2=Aprovada,3=Reprovada,
//   4=AjustesNecessarios,5=PendenteAprovacaoRh,6=Cancelada (different from generic STATUS_NAME_MAP)
const VAGA_STATUS_NAME_MAP: Record<string, number> = {
    rascunho: 0, pendenteaprovacao: 1, aprovada: 2, reprovada: 3,
    ajustesnecessarios: 4, pendenteaprovacaorh: 5, cancelada: 6,
};
function parseVagaStatus(raw: unknown): number {
    let v: number;
    if (typeof raw === "number") {
        v = raw;
    } else if (typeof raw === "string") {
        const n = Number(raw);
        v = !isNaN(n) ? n : (VAGA_STATUS_NAME_MAP[raw.toLowerCase()] ?? 0);
    } else {
        v = 0;
    }
    // Remap to generic STATUS_MAP convention (5=Cancelada, 6=AguardaRH)
    if (v === 5) return 6; // PendenteAprovacaoRh → generic 6
    if (v === 6) return 5; // Cancelada → generic 5
    return v;
}

const TIPO_CFG: Record<TipoKey, TipoCfg> = {
    contratacao: {
        label: "Contratacao", icon: Briefcase, color: "text-violet-600", bgColor: "bg-violet-500/15",
        api: "/api/solicitacoes-vaga", detailApiBase: "/api/solicitacoes-vaga",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: s(r, "titulo"), solicitante: s(r, "solicitanteNome"),
            status: parseVagaStatus(r.status), etapaLabel: r.etapaPendenteLabel as string | null,
            etapaPendenteCom: r.etapaPendenteCom as string | null,
            etapaPendenteIsQueue: (r.etapaPendenteIsQueue as boolean) ?? false,
            etapaPendenteCanAssume: (r.etapaPendenteCanAssume as boolean) ?? false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
    promocao: {
        label: "Movimentacao", icon: TrendingUp, color: "text-teal-600", bgColor: "bg-teal-500/15",
        api: "/api/solicitacoes-promocao", detailApiBase: "/api/solicitacoes-promocao",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: s(r, "funcionarioNome"), solicitante: s(r, "solicitanteNome"),
            status: parseStatus(r.status), etapaLabel: r.etapaPendenteLabel as string | null,
            etapaPendenteCom: r.etapaPendenteCom as string | null,
            etapaPendenteIsQueue: (r.etapaPendenteIsQueue as boolean) ?? false,
            etapaPendenteCanAssume: (r.etapaPendenteCanAssume as boolean) ?? false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
    desligamento: {
        label: "Desligamento", icon: UserMinus, color: "text-rose-600", bgColor: "bg-rose-500/15",
        api: "/api/solicitacoes-desligamento", detailApiBase: "/api/solicitacoes-desligamento",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: s(r, "funcionarioNome"), solicitante: s(r, "solicitanteNome"),
            status: parseStatus(r.status), etapaLabel: r.etapaPendenteLabel as string | null,
            etapaPendenteCom: r.etapaPendenteCom as string | null,
            etapaPendenteIsQueue: (r.etapaPendenteIsQueue as boolean) ?? false,
            etapaPendenteCanAssume: (r.etapaPendenteCanAssume as boolean) ?? false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
    ferias: {
        label: "Ferias", icon: Palmtree, color: "text-sky-600", bgColor: "bg-sky-500/15",
        api: "/api/colaborador/solicitacoes-ferias", detailApiBase: "/api/colaborador/solicitacoes-ferias",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: `${s(r, "colaboradorNome", s(r, "solicitanteNome"))} — ${s(r, "dias")}d`,
            solicitante: s(r, "colaboradorNome", s(r, "solicitanteNome")),
            status: parseStatus(r.status), etapaLabel: r.etapaPendenteLabel as string | null ?? null,
            etapaPendenteCom: r.etapaPendenteCom as string | null ?? null,
            etapaPendenteIsQueue: (r.etapaPendenteIsQueue as boolean) ?? false,
            etapaPendenteCanAssume: (r.etapaPendenteCanAssume as boolean) ?? false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
    beneficio: {
        label: "Beneficio", icon: Heart, color: "text-pink-600", bgColor: "bg-pink-500/15",
        api: "/api/colaborador/solicitacoes-beneficio", detailApiBase: "/api/colaborador/solicitacoes-beneficio",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: `${s(r, "colaboradorNome", s(r, "solicitanteNome"))} — ${s(r, "tipoBeneficio", "")}`,
            solicitante: s(r, "colaboradorNome", s(r, "solicitanteNome")),
            status: parseStatus(r.status), etapaLabel: null, etapaPendenteCom: null,
            etapaPendenteIsQueue: false, etapaPendenteCanAssume: false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
    dependentes: {
        label: "Dependentes", icon: Users, color: "text-indigo-600", bgColor: "bg-indigo-500/15",
        api: "/api/colaborador/solicitacoes-dependente", detailApiBase: "/api/colaborador/solicitacoes-dependente",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: `${s(r, "colaboradorNome", s(r, "solicitanteNome"))} — ${s(r, "dependenteNome", s(r, "nome", ""))}`,
            solicitante: s(r, "colaboradorNome", s(r, "solicitanteNome")),
            status: parseStatus(r.status), etapaLabel: null, etapaPendenteCom: null,
            etapaPendenteIsQueue: false, etapaPendenteCanAssume: false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
    endereco: {
        label: "Endereco", icon: MapPin, color: "text-amber-600", bgColor: "bg-amber-500/15",
        api: "/api/colaborador/solicitacoes-endereco", detailApiBase: "/api/colaborador/solicitacoes-endereco",
        mapRow: (r) => ({
            id: s(r, "id"), descricao: `${s(r, "colaboradorNome", s(r, "solicitanteNome"))} — ${s(r, "cidade", "")}/${s(r, "uf", "")}`,
            solicitante: s(r, "colaboradorNome", s(r, "solicitanteNome")),
            status: parseStatus(r.status), etapaLabel: null, etapaPendenteCom: null,
            etapaPendenteIsQueue: false, etapaPendenteCanAssume: false,
            createdAtUtc: s(r, "createdAtUtc"),
        }),
    },
};

const ALL_TIPOS = Object.keys(TIPO_CFG) as TipoKey[];

/* ──────────────────────────── helpers ──────────────────────────── */

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!res.ok) return [] as T;
    if (res.status === 204) return [] as T;
    return (await res.json()) as T;
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }); }
    catch { return "—"; }
}

type StatusKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const STATUS_MAP: Record<StatusKey, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Pendente", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Reprovada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    4: { label: "Ajustes", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
    5: { label: "Cancelada", color: "bg-zinc-500/15 text-zinc-500", icon: XCircle },
    6: { label: "Aguarda RH", color: "bg-purple-500/15 text-purple-700", icon: Clock },
};

function statusBadge(status: number) {
    const cfg = STATUS_MAP[(status ?? 0) as StatusKey] ?? STATUS_MAP[0];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.color}`}>
            <Icon className="size-3" />{cfg.label}
        </span>
    );
}

function tipoBadge(tipo: TipoKey) {
    const cfg = TIPO_CFG[tipo];
    const Icon = cfg.icon;
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.bgColor} ${cfg.color}`}>
            <Icon className="size-3" />{cfg.label}
        </span>
    );
}

/* ──────────────────────────── component ──────────────────────────── */

export default function PainelSolicitacoesScreen() {
    const [rows, setRows] = useState<UnifiedRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [filterTipo, setFilterTipo] = useState<TipoKey | "">("");
    const [filterStatus, setFilterStatus] = useState<string>("");

    const [acting, setActing] = useState(false);

    /* ── Timeline modal ── */
    const [timelineOpen, setTimelineOpen] = useState(false);
    const [timelineStatus, setTimelineStatus] = useState<number | string | null>(null);
    const [timelineSteps, setTimelineSteps] = useState<AprovacaoStep[]>([]);
    const [timelineLoading, setTimelineLoading] = useState(false);

    /* ── Fetch all ── */
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const results = await Promise.all(
                ALL_TIPOS.map(async (tipo) => {
                    const cfg = TIPO_CFG[tipo];
                    const data = await fetchJson<Record<string, unknown>[]>(cfg.api);
                    return (Array.isArray(data) ? data : []).map((r): UnifiedRow => ({
                        ...cfg.mapRow(r),
                        tipo,
                        detailApi: `${cfg.detailApiBase}/${s(r, "id")}`,
                    }));
                })
            );
            const all = results.flat().sort((a, b) =>
                new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime()
            );
            setRows(all);
        } catch { /* silent */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void fetchAll(); }, [fetchAll]);

    /* ── Open timeline ── */
    async function openTimeline(row: UnifiedRow) {
        setTimelineOpen(true);
        setTimelineLoading(true);
        setTimelineSteps([]);
        setTimelineStatus(row.status);
        try {
            const detail = await fetchJson<Record<string, unknown>>(row.detailApi);
            setTimelineStatus(detail.status as number | string ?? row.status);
            const STATUS_NUM_TO_STR: Record<number, string> = { 0: "Pendente", 1: "Aprovado", 2: "Reprovado" };

            // Normalize etapas: etapasFluxo (EtapaFluxoInfo, numeric status) or etapas (EtapaAprovacaoResponse, string status)
            const rawFluxo = detail.etapasFluxo as { ordem: number; label: string; aprovadorNome: string | null; roleNome: string | null; status: number; dataUtc: string | null; observacao: string | null }[] | undefined;
            const rawEtapas = detail.etapas as EtapaAprovacaoResponse[] | undefined;

            const etapas: EtapaAprovacaoResponse[] = rawFluxo?.length
                ? rawFluxo.map(e => ({
                    ordem: e.ordem, label: e.label, aprovadorId: null, aprovadorNome: e.aprovadorNome,
                    roleFilaId: null, roleFilaNome: e.roleNome,
                    status: STATUS_NUM_TO_STR[e.status] ?? "Pendente", dataUtc: e.dataUtc, observacao: e.observacao,
                }))
                : (rawEtapas ?? []);

            const solicitanteNome = (detail.solicitanteNome ?? detail.colaboradorNome ?? detail.funcionarioNome ?? null) as string | null;
            const steps = mapEtapasToSteps(etapas, solicitanteNome, row.createdAtUtc);
            setTimelineSteps(steps);
        } catch {
            setTimelineSteps([]);
        } finally {
            setTimelineLoading(false);
        }
    }

    /* ── Assumir consenso ── */
    async function doAssumir(row: UnifiedRow) {
        const cfg = TIPO_CFG[row.tipo];
        setActing(true);
        try {
            const res = await apiFetch(`${cfg.detailApiBase}/${row.id}/assumir`, { method: "POST" });
            if (!res.ok) {
                const body = await res.json().catch(() => ({})) as { message?: string };
                if (res.status === 409) {
                    toast.warning(body.message ?? "Já assumida por outro usuário.");
                } else {
                    toast.error(body.message ?? "Falha ao assumir.");
                }
                void fetchAll();
                return;
            }
            toast.success("Tarefa assumida! Acesse Minhas Pendências para aprovar.");
            void fetchAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao assumir.");
        } finally {
            setActing(false);
        }
    }

    /* ── Filtered rows ── */
    const filtered = useMemo(() => {
        let list = rows;
        if (filterTipo) list = list.filter(r => r.tipo === filterTipo);
        if (filterStatus) list = list.filter(r => String(r.status) === filterStatus);
        const term = q.trim().toLowerCase();
        if (term) list = list.filter(r =>
            r.descricao.toLowerCase().includes(term) ||
            r.solicitante.toLowerCase().includes(term) ||
            (r.etapaLabel ?? "").toLowerCase().includes(term) ||
            (r.etapaPendenteCom ?? "").toLowerCase().includes(term)
        );
        return list;
    }, [rows, filterTipo, filterStatus, q]);

    /* ── KPI counts ── */
    const countByStatus = useMemo(() => {
        const c = { pendente: 0, aprovada: 0, reprovada: 0, total: rows.length };
        for (const r of rows) {
            if (r.status === 1 || r.status === 6) c.pendente++;
            else if (r.status === 2) c.aprovada++;
            else if (r.status === 3) c.reprovada++;
        }
        return c;
    }, [rows]);

    /* ──────────────────────────── render ──────────────────────────── */

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Painel de Solicitacoes</h1>
                    <div className="text-muted-foreground text-sm mt-0.5">
                        Visao geral de todas as solicitacoes e seus fluxos de aprovacao
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void fetchAll()}>
                    <RefreshCw className="size-4" />
                    <span className="hidden sm:inline">Atualizar</span>
                </Button>
            </div>

            {/* KPI cards */}
            <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <span className="text-[11px] text-muted-foreground font-medium">Total</span>
                    <span className="text-sm font-bold">{loading ? "…" : countByStatus.total}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <Clock className="size-3.5 text-amber-600" />
                    <span className="text-[11px] text-muted-foreground font-medium">Pendentes</span>
                    <span className="text-sm font-bold text-amber-600">{loading ? "…" : countByStatus.pendente}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <CheckCircle2 className="size-3.5 text-emerald-600" />
                    <span className="text-[11px] text-muted-foreground font-medium">Aprovadas</span>
                    <span className="text-sm font-bold text-emerald-600">{loading ? "…" : countByStatus.aprovada}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/60 px-3 py-1.5 backdrop-blur">
                    <XCircle className="size-3.5 text-red-600" />
                    <span className="text-[11px] text-muted-foreground font-medium">Reprovadas</span>
                    <span className="text-sm font-bold text-red-600">{loading ? "…" : countByStatus.reprovada}</span>
                </div>
            </div>

            {/* Filters + table */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end gap-3">
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase">Tipo</label>
                        <select
                            className="mt-0.5 block h-9 w-[170px] rounded-md border border-input bg-background px-2 text-sm"
                            value={filterTipo}
                            onChange={(e) => setFilterTipo(e.target.value as TipoKey | "")}
                        >
                            <option value="">Todos</option>
                            {ALL_TIPOS.map(t => <option key={t} value={t}>{TIPO_CFG[t].label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase">Status</label>
                        <select
                            className="mt-0.5 block h-9 w-[150px] rounded-md border border-input bg-background px-2 text-sm"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">Todos</option>
                            <option value="0">Rascunho</option>
                            <option value="1">Pendente</option>
                            <option value="2">Aprovada</option>
                            <option value="3">Reprovada</option>
                            <option value="4">Ajustes</option>
                            <option value="5">Cancelada</option>
                            <option value="6">Aguarda RH</option>
                        </select>
                    </div>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input className="pl-8" placeholder="Buscar por descricao, solicitante, etapa..." value={q} onChange={(e) => setQ(e.target.value)} />
                    </div>
                    {(filterTipo || filterStatus || q) && (
                        <Button variant="ghost" size="sm" onClick={() => { setFilterTipo(""); setFilterStatus(""); setQ(""); }}>
                            <Filter className="size-3.5" /> Limpar
                        </Button>
                    )}
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Descricao</TableHead>
                            <TableHead>Solicitante</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Etapa Atual</TableHead>
                            <TableHead>Pendente Com</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead className="text-right">Etapas</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Carregando…</TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma solicitacao encontrada.</TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((row) => (
                                <TableRow key={`${row.tipo}-${row.id}`} className="hover:bg-muted/40">
                                    <TableCell>{tipoBadge(row.tipo)}</TableCell>
                                    <TableCell className="font-medium text-sm max-w-[250px]">
                                        <div className="truncate">{row.descricao}</div>
                                        <button
                                            className="text-[10px] font-mono text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                                            title={`ID: ${row.id} — clique para copiar`}
                                            onClick={() => void navigator.clipboard.writeText(row.id)}
                                        >
                                            {row.id}
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-sm">{row.solicitante}</TableCell>
                                    <TableCell>{statusBadge(row.status)}</TableCell>
                                    <TableCell className="text-xs">
                                        {row.etapaLabel ? (
                                            <span className="font-medium">{row.etapaLabel}</span>
                                        ) : row.status === 1 || row.status === 6 ? (
                                            <span className="text-muted-foreground italic">ver etapas</span>
                                        ) : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {row.etapaPendenteIsQueue && row.etapaPendenteCom ? (
                                            // Fila de grupo — nome do grupo conhecido
                                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-500/15 text-violet-700">
                                                <Users className="size-3" />
                                                Grupo: {row.etapaPendenteCom}
                                            </span>
                                        ) : row.etapaPendenteIsQueue ? (
                                            // Consenso sem grupo definido
                                            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-amber-500/15 text-amber-700">
                                                <Users className="size-3" />
                                                Aguardando consenso
                                            </span>
                                        ) : (
                                            row.etapaPendenteCom || "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm">{formatDate(row.createdAtUtc)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            {row.etapaPendenteCanAssume && row.etapaPendenteCom && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1 border-violet-400 text-violet-700 hover:bg-violet-50"
                                                    disabled={acting}
                                                    title={`Assumir esta tarefa do grupo "${row.etapaPendenteCom}" para você`}
                                                    onClick={() => void doAssumir(row)}
                                                >
                                                    <UserCheck className="size-3" />
                                                    <span className="hidden sm:inline">Assumir</span>
                                                </Button>
                                            )}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="gap-1"
                                                onClick={() => void openTimeline(row)}
                                            >
                                                <GitBranch className="size-3" />
                                                <span className="hidden sm:inline">Ver etapas</span>
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {!loading && filtered.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground text-right">
                        {filtered.length} de {rows.length} solicitacoes
                    </div>
                )}
            </div>

            {/* Timeline Modal */}
            <AcompanhamentoModal
                open={timelineOpen}
                loading={timelineLoading}
                steps={timelineSteps}
                solicitacaoStatus={timelineStatus}
                onClose={() => setTimelineOpen(false)}
            />
        </section>
    );
}
