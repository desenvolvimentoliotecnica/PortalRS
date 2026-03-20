"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    Plus, Pencil, Trash2, ArrowUp, ArrowDown, Search, MoveRight,
    Users, GripVertical, ChevronDown, ChevronRight, Cpu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

/* ────── constants ────── */

const brlFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const RESP_LABEL: Record<number, string> = { 0: "RH", 1: "Gestor", 2: "Externo" };

const STATUS_LABEL: Record<number, string> = {
    0: "Ativo",
    1: "Aprovado",
    2: "Reprovado",
    3: "Disponível",
};
const STATUS_VARIANT: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
    0: "default",
    1: "secondary",
    2: "destructive",
    3: "outline",
};

/* ────── types ────── */

interface Fase {
    id: string;
    projetoId: string;
    nome: string;
    ordem: number;
    responsavelTipo: number;
    totalCandidatos: number;
}

interface CandidatoFase {
    id: string;
    projetoId: string;
    candidatoId: string;
    candidatoNome: string;
    candidatoEmail: string | null;
    candidatoCidade: string | null;
    candidatoUf: string | null;
    candidatoLinkedinUrl: string | null;
    candidatoTrabalhandoAtualmente: boolean | null;
    candidatoPretensaoSalarial: number | null;
    status: number;
    faseAtualId?: string | null;
    faseAtualNome?: string | null;
    observacoes: string | null;
    createdAtUtc: string;
    /** Injetado client-side após join com scores */
    score?: number | null;
}

interface ProjetoMin {
    id: string;
    vagaId: string;
    numero: number;
    descricao: string | null;
}

interface MatchingScore {
    candidatoId: string;
    score: number | null;
}

/* ────── helpers ────── */

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

function ScoreBadge({ score }: { score: number | null | undefined }) {
    if (score == null) return <span className="text-muted-foreground text-xs">—</span>;
    const color = score >= 70
        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
        : score >= 40
            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    return (
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
            <Cpu className="size-3" />
            {score}
        </span>
    );
}

/* ────── skeleton rows ────── */

function TableSkeleton({ cols = 9, rows = 6 }: { cols?: number; rows?: number }) {
    return (
        <>
            {Array.from({ length: rows }).map((_, i) => (
                <TableRow key={i}>
                    {Array.from({ length: cols }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}

/* ────── component ────── */

export default function ProcessoSeletivoScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [projetos, setProjetos] = useState<ProjetoMin[]>([]);
    const [selectedProjeto, setSelectedProjeto] = useState<ProjetoMin | null>(null);
    const [fases, setFases] = useState<Fase[]>([]);
    const [candidatos, setCandidatos] = useState<CandidatoFase[]>([]);
    const [scores, setScores] = useState<MatchingScore[]>([]);
    const [loadingCandidatos, setLoadingCandidatos] = useState(false);

    /* filters */
    const [q, setQ] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [filterFaseId, setFilterFaseId] = useState<string>("");

    /* fase CRUD */
    const [expandedFase, setExpandedFase] = useState<string | null>(null);
    const [faseDialogOpen, setFaseDialogOpen] = useState(false);
    const [editFaseId, setEditFaseId] = useState<string | null>(null);
    const [faseNome, setFaseNome] = useState("");
    const [faseResp, setFaseResp] = useState(0);

    /* mover dialog */
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);
    const [movePcId, setMovePcId] = useState<string | null>(null);
    const [moveTargetFaseId, setMoveTargetFaseId] = useState<string>("");

    /* Load projetos (across recent vagas) */
    useEffect(() => {
        fetchJson<any>("/api/vagas?fields=id,titulo").then((data) => {
            const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
            Promise.all(items.slice(0, 10).map((v: any) =>
                fetchJson<ProjetoMin[]>(`/api/vagas/${v.id}/projetos`).catch(() => [] as ProjetoMin[])
            )).then((all) => setProjetos(all.flat()));
        }).catch(() => { });
    }, []);

    const loadFases = useCallback(async (projeto: ProjetoMin) => {
        setLoadingCandidatos(true);
        try {
            const [f, c, s] = await Promise.all([
                fetchJson<Fase[]>(`/api/projetos/${projeto.id}/fases`),
                fetchJson<CandidatoFase[]>(`/api/projetos/${projeto.id}/candidatos`),
                fetchJson<MatchingScore[]>(`/api/matching/scores?projetoId=${projeto.id}&vagaId=${projeto.vagaId}`)
                    .catch(() => [] as MatchingScore[]),
            ]);
            setFases(f);
            setCandidatos(c);
            setScores(s);
            if (f.length > 0) setExpandedFase(f[0].id);
        } catch {
            toast.error("Falha ao carregar dados do projeto.");
        } finally {
            setLoadingCandidatos(false);
        }
    }, []);

    /* ── deep-link: auto-select projeto from ?projetoId= or ?vagaId= ── */
    useEffect(() => {
        if (projetos.length === 0 || selectedProjeto) return;
        const projetoIdFromUrl = searchParams.get("projetoId");
        const vagaIdFromUrl = searchParams.get("vagaId");
        if (projetoIdFromUrl) {
            const p = projetos.find((x) => x.id === projetoIdFromUrl);
            if (p) setSelectedProjeto(p);
        } else if (vagaIdFromUrl) {
            const p = projetos.find((x) => x.vagaId === vagaIdFromUrl);
            if (p) setSelectedProjeto(p);
        }
    }, [projetos, searchParams, selectedProjeto]);

    useEffect(() => {
        if (selectedProjeto) void loadFases(selectedProjeto);
    }, [selectedProjeto, loadFases]);

    /* Merge candidatos + scores, order by score desc */
    const candidatosComScore = useMemo<CandidatoFase[]>(() => {
        const scoreMap = new Map(scores.map((s) => [s.candidatoId, s.score]));
        return [...candidatos]
            .map((c) => ({ ...c, score: scoreMap.get(c.candidatoId) ?? null }))
            .sort((a, b) => ((b.score ?? -1) - (a.score ?? -1)));
    }, [candidatos, scores]);

    /* Filter */
    const candidatosFiltrados = useMemo(() => {
        return candidatosComScore.filter((c) => {
            if (q && !c.candidatoNome.toLowerCase().includes(q.toLowerCase())) return false;
            if (filterStatus && c.status !== Number(filterStatus)) return false;
            if (filterFaseId === "__sem_fase__" && c.faseAtualId) return false;
            if (filterFaseId && filterFaseId !== "__sem_fase__" && c.faseAtualId !== filterFaseId) return false;
            return true;
        });
    }, [candidatosComScore, q, filterStatus, filterFaseId]);

    const candidatosDisponiveis = useMemo(
        () => candidatosComScore.filter((c) => c.status === 3),
        [candidatosComScore]
    );

    /* ── CRUD fases ── */
    async function saveFase() {
        if (!faseNome.trim() || !selectedProjeto) return;
        try {
            if (editFaseId) {
                await fetchJson(`/api/fases/${editFaseId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome: faseNome.trim(), responsavelTipo: faseResp }),
                });
                toast.success("Fase atualizada!");
            } else {
                await fetchJson(`/api/projetos/${selectedProjeto.id}/fases`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome: faseNome.trim(), responsavelTipo: faseResp }),
                });
                toast.success("Fase criada!");
            }
            setFaseDialogOpen(false);
            setEditFaseId(null);
            setFaseNome("");
            setFaseResp(0);
            await loadFases(selectedProjeto);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function deleteFase(faseId: string) {
        if (!confirm("Remover esta fase? Candidatos ficarão sem fase.")) return;
        if (!selectedProjeto) return;
        try {
            await fetchJson(`/api/fases/${faseId}`, { method: "DELETE" });
            toast.success("Fase removida.");
            await loadFases(selectedProjeto);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function moveFase(index: number, direction: -1 | 1) {
        if (!selectedProjeto) return;
        const newFases = [...fases];
        const ti = index + direction;
        if (ti < 0 || ti >= newFases.length) return;
        [newFases[index], newFases[ti]] = [newFases[ti], newFases[index]];
        setFases(newFases);
        try {
            await fetchJson(`/api/projetos/${selectedProjeto.id}/fases/reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(newFases.map((f) => f.id)),
            });
        } catch {
            toast.error("Falha ao reordenar.");
            await loadFases(selectedProjeto);
        }
    }

    async function moverCandidato() {
        if (!movePcId || !moveTargetFaseId || !selectedProjeto) return;
        try {
            await fetchJson(`/api/projeto-candidatos/${movePcId}/mover`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ faseDestinoId: moveTargetFaseId }),
            });
            toast.success("Candidato movido!");
            setMoveDialogOpen(false);
            await loadFases(selectedProjeto);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    const openEditFase = (f: Fase) => { setEditFaseId(f.id); setFaseNome(f.nome); setFaseResp(f.responsavelTipo); setFaseDialogOpen(true); };
    const openNewFase = () => { setEditFaseId(null); setFaseNome(""); setFaseResp(0); setFaseDialogOpen(true); };
    const openMove = (pcId: string) => { setMovePcId(pcId); setMoveTargetFaseId(fases[0]?.id ?? ""); setMoveDialogOpen(true); };

    /* ── Candidatos table row ── */
    function CandidatoRow({ c }: { c: CandidatoFase }) {
        return (
            <TableRow>
                <TableCell className="font-semibold whitespace-nowrap">
                    {c.candidatoLinkedinUrl ? (
                        <a href={c.candidatoLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {c.candidatoNome}
                        </a>
                    ) : c.candidatoNome}
                </TableCell>
                <TableCell className="text-sm">
                    {c.candidatoTrabalhandoAtualmente === null ? "—"
                        : c.candidatoTrabalhandoAtualmente
                            ? <span className="text-amber-600 font-medium">Sim</span>
                            : <span className="text-muted-foreground">Não</span>}
                </TableCell>
                <TableCell className="text-sm whitespace-nowrap hidden md:table-cell">
                    {c.candidatoPretensaoSalarial != null ? brlFormatter.format(c.candidatoPretensaoSalarial) : "—"}
                </TableCell>
                <TableCell><ScoreBadge score={c.score} /></TableCell>
                <TableCell>
                    <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                        {STATUS_LABEL[c.status] ?? c.status}
                    </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{c.faseAtualNome ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate hidden md:table-cell">
                    {c.observacoes || "—"}
                </TableCell>
                <TableCell className="text-right">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon-xs">
                                <ChevronDown className="size-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openMove(c.id)}>
                                <MoveRight className="size-4 mr-2" /> Mover fase
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </TableCell>
            </TableRow>
        );
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Etapa de seleção
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Processo Seletivo</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        {selectedProjeto
                            ? <>Rodada atual: <span className="font-medium text-foreground">{selectedProjeto.numero}{selectedProjeto.descricao ? ` — ${selectedProjeto.descricao}` : ""}</span> · acompanhe fases, entrevistas e movimentos do funil.</>
                            : "Acompanhe fases, entrevistas e status dos candidatos que já passaram pelas rodadas."}
                    </p>
                </div>
                {selectedProjeto && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/gestao/projetos?projetoId=${selectedProjeto.id}&vagaId=${selectedProjeto.vagaId}`)}>
                            Voltar às rodadas
                        </Button>
                    </div>
                )}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Entrada</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Candidatos da rodada</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Esta tela recebe os candidatos organizados na rodada anterior para distribuir por fase.
                    </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Execução</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Fases e entrevistas</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Crie fases, mova candidatos entre elas e acompanhe score, status e observações do processo.
                    </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Próximo passo</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Pré-admissão</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Depois da aprovação final, o candidato segue para a etapa de pré-admissão e contratação.
                    </div>
                </div>
            </div>

            {/* Projeto selector */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rodada</label>
                        <select
                            className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                            value={selectedProjeto?.id ?? ""}
                            onChange={(e) => {
                                const p = projetos.find((x) => x.id === e.target.value) ?? null;
                                setSelectedProjeto(p);
                                setExpandedFase(null);
                                setQ("");
                                setFilterStatus("");
                                setFilterFaseId("");
                            }}
                        >
                            <option value="">Selecione uma rodada...</option>
                            {projetos.map((p) => (
                                <option key={p.id} value={p.id}>
                                    Rodada {p.numero}{p.descricao ? ` — ${p.descricao}` : ""}
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedProjeto && (
                        <Button size="sm" onClick={openNewFase}>
                            <Plus className="size-4 mr-1" /> Nova Fase
                        </Button>
                    )}
                </div>
            </div>

            {selectedProjeto && (
                <Tabs defaultValue="candidatos">
                    <TabsList>
                        <TabsTrigger value="candidatos">
                            Candidatos {candidatos.length > 0 && `(${candidatos.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="disponiveis">
                            Disponíveis {candidatosDisponiveis.length > 0 && `(${candidatosDisponiveis.length})`}
                        </TabsTrigger>
                        <TabsTrigger value="fases">
                            Fases {fases.length > 0 && `(${fases.length})`}
                        </TabsTrigger>
                    </TabsList>

                    {/* ── Tab: Candidatos ── */}
                    <TabsContent value="candidatos" className="space-y-3">
                        {/* Filtros */}
                        <div className="flex flex-wrap gap-2">
                            <div className="relative flex-1 min-w-[160px]">
                                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input className="pl-8" placeholder="Buscar candidato..." value={q} onChange={(e) => setQ(e.target.value)} />
                            </div>
                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="">Todos os status</option>
                                <option value="0">Ativo</option>
                                <option value="1">Aprovado</option>
                                <option value="2">Reprovado</option>
                                <option value="3">Disponível</option>
                            </select>
                            <select
                                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                                value={filterFaseId}
                                onChange={(e) => setFilterFaseId(e.target.value)}
                            >
                                <option value="">Todas as fases</option>
                                <option value="__sem_fase__">Sem fase</option>
                                {fases.map((f) => (
                                    <option key={f.id} value={f.id}>{f.nome}</option>
                                ))}
                            </select>
                        </div>

                        {/* Tabela */}
                        <div className="overflow-x-auto rounded-xl border border-border/40">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Trabalhando?</TableHead>
                                        <TableHead className="hidden md:table-cell">Pretensão</TableHead>
                                        <TableHead><span className="flex items-center gap-1"><Cpu className="size-3" /> Score IA</span></TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Fase Atual</TableHead>
                                        <TableHead className="hidden md:table-cell">Observações</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingCandidatos ? (
                                        <TableSkeleton cols={8} rows={6} />
                                    ) : candidatosFiltrados.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                                Nenhum candidato encontrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        candidatosFiltrados.map((c) => <CandidatoRow key={c.id} c={c} />)
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* ── Tab: Disponíveis (copiados de rodadas anteriores) ── */}
                    <TabsContent value="disponiveis" className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            Candidatos copiados de rodadas anteriores que aguardam nova avaliação.
                        </p>
                        <div className="overflow-x-auto rounded-xl border border-border/40">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Trabalhando?</TableHead>
                                        <TableHead className="hidden md:table-cell">Pretensão</TableHead>
                                        <TableHead><span className="flex items-center gap-1"><Cpu className="size-3" /> Score IA</span></TableHead>
                                        <TableHead>Fase Atual</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingCandidatos ? (
                                        <TableSkeleton cols={6} rows={4} />
                                    ) : candidatosDisponiveis.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                                Nenhum candidato disponível de rodadas anteriores.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        candidatosDisponiveis.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-semibold whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-2">
                                                        {c.candidatoNome}
                                                        <Badge variant="outline" className="text-xs text-blue-600 border-blue-300">Da Rodada Anterior</Badge>
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {c.candidatoTrabalhandoAtualmente === null ? "—"
                                                        : c.candidatoTrabalhandoAtualmente
                                                            ? <span className="text-amber-600 font-medium">Sim</span>
                                                            : <span className="text-muted-foreground">Não</span>}
                                                </TableCell>
                                                <TableCell className="text-sm whitespace-nowrap hidden md:table-cell">
                                                    {c.candidatoPretensaoSalarial != null ? brlFormatter.format(c.candidatoPretensaoSalarial) : "—"}
                                                </TableCell>
                                                <TableCell><ScoreBadge score={c.score} /></TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{c.faseAtualNome ?? "—"}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="icon-xs" title="Mover para fase" onClick={() => openMove(c.id)}>
                                                        <MoveRight className="size-4 text-primary" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* ── Tab: Fases (pipeline accordion) ── */}
                    <TabsContent value="fases" className="space-y-2">
                        {loadingCandidatos ? (
                            <div className="space-y-2">
                                {Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                                ))}
                            </div>
                        ) : fases.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8">
                                Nenhuma fase criada. Clique "Nova Fase" para começar.
                            </div>
                        ) : (
                            <>
                                {fases.map((f, idx) => {
                                    const isExpanded = expandedFase === f.id;
                                    const cs = candidatosComScore.filter((c) => c.faseAtualId === f.id);
                                    return (
                                        <div key={f.id} className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur overflow-hidden">
                                            <div
                                                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition"
                                                onClick={() => setExpandedFase(isExpanded ? null : f.id)}
                                            >
                                                <GripVertical className="size-4 text-muted-foreground/50" />
                                                {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                                <span className="font-semibold flex-1">{f.nome}</span>
                                                <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-muted">{RESP_LABEL[f.responsavelTipo]}</span>
                                                <span className="text-xs text-muted-foreground">{cs.length} candidatos</span>
                                                <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="outline" size="icon-xs" disabled={idx === 0} onClick={() => void moveFase(idx, -1)}>
                                                        <ArrowUp className="size-3.5" />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" disabled={idx === fases.length - 1} onClick={() => void moveFase(idx, 1)}>
                                                        <ArrowDown className="size-3.5" />
                                                    </Button>
                                                    <Button variant="outline" size="icon-xs" onClick={() => openEditFase(f)}>
                                                        <Pencil className="size-3.5" />
                                                    </Button>
                                                    <Button variant="destructive" size="icon-xs" onClick={() => void deleteFase(f.id)}>
                                                        <Trash2 className="size-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                            {isExpanded && cs.length > 0 && (
                                                <div className="px-4 pb-4 overflow-x-auto">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>Nome</TableHead>
                                                                <TableHead>Trabalhando?</TableHead>
                                                                <TableHead className="hidden md:table-cell">Pretensão</TableHead>
                                                                <TableHead>Score IA</TableHead>
                                                                <TableHead>Status</TableHead>
                                                                <TableHead className="text-right">Ações</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {cs.map((c) => (
                                                                <TableRow key={c.id}>
                                                                    <TableCell className="font-semibold whitespace-nowrap">{c.candidatoNome}</TableCell>
                                                                    <TableCell className="text-sm">
                                                                        {c.candidatoTrabalhandoAtualmente === null ? "—"
                                                                            : c.candidatoTrabalhandoAtualmente
                                                                                ? <span className="text-amber-600 font-medium">Sim</span>
                                                                                : <span className="text-muted-foreground">Não</span>}
                                                                    </TableCell>
                                                                    <TableCell className="text-sm whitespace-nowrap hidden md:table-cell">
                                                                        {c.candidatoPretensaoSalarial != null ? brlFormatter.format(c.candidatoPretensaoSalarial) : "—"}
                                                                    </TableCell>
                                                                    <TableCell><ScoreBadge score={c.score} /></TableCell>
                                                                    <TableCell>
                                                                        <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
                                                                            {STATUS_LABEL[c.status] ?? c.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-right">
                                                                        <Button variant="outline" size="icon-xs" title="Mover para outra fase" onClick={() => openMove(c.id)}>
                                                                            <MoveRight className="size-4 text-primary" />
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Sem fase */}
                                {(() => {
                                    const noFase = candidatosComScore.filter((c) => !c.faseAtualId);
                                    if (noFase.length === 0) return null;
                                    return (
                                        <div className="card-soft rounded-xl border border-dashed border-border/40 bg-card/30 p-4 backdrop-blur">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Users className="size-4 text-muted-foreground" />
                                                <span className="text-sm font-medium text-muted-foreground">Sem fase atribuída ({noFase.length})</span>
                                            </div>
                                            {noFase.map((c) => (
                                                <div key={c.id} className="flex items-center gap-3 py-1.5 text-sm">
                                                    <span className="font-medium flex-1">{c.candidatoNome}</span>
                                                    <ScoreBadge score={c.score} />
                                                    <Button variant="outline" size="icon-xs" title="Atribuir fase" onClick={() => openMove(c.id)}>
                                                        <MoveRight className="size-4 text-primary" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {/* ── Fase Dialog ── */}
            <Dialog open={faseDialogOpen} onOpenChange={setFaseDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editFaseId ? "Editar Fase" : "Nova Fase"}</DialogTitle>
                        <DialogDescription>Configure nome e responsável da fase do processo seletivo.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome</label>
                            <Input placeholder="Ex: Triagem, Entrevista Gestor, Teste Técnico..." value={faseNome} onChange={(e) => setFaseNome(e.target.value)} maxLength={160} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsável</label>
                            <select className="mt-1 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={faseResp} onChange={(e) => setFaseResp(Number(e.target.value))}>
                                <option value={0}>RH</option>
                                <option value={1}>Gestor</option>
                                <option value={2}>Externo</option>
                            </select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFaseDialogOpen(false)}>Cancelar</Button>
                        <Button disabled={!faseNome.trim()} onClick={() => void saveFase()}>{editFaseId ? "Salvar" : "Criar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Move Dialog ── */}
            <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Mover Candidato</DialogTitle>
                        <DialogDescription>Selecione a fase de destino.</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <select className="block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={moveTargetFaseId} onChange={(e) => setMoveTargetFaseId(e.target.value)}>
                            {fases.map((f) => (
                                <option key={f.id} value={f.id}>{f.nome}</option>
                            ))}
                        </select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => void moverCandidato()}>Mover</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
