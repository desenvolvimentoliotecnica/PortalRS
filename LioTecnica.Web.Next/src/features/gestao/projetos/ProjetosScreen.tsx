"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    Plus, Users, FolderOpen, Search, UserCheck, UserX, ExternalLink, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

/* ── types ── */

interface ProjetoItem {
    id: string;
    vagaId: string;
    numero: number;
    descricao: string | null;
    status: number;
    totalCandidatos: number;
    createdAtUtc: string;
}

interface CandidatoItem {
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
    faseAtualId: string | null;
    faseAtualNome: string | null;
    observacoes: string | null;
    createdAtUtc: string;
}

interface VagaMin { id: string; titulo: string; }

/* ── helpers ── */

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

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const CAND_STATUS: Record<number, { label: string; cls: string }> = {
    0: { label: "Ativo",      cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
    1: { label: "Aprovado",   cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    2: { label: "Reprovado",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    3: { label: "Disponível", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
};

function CandStatusBadge({ status }: { status: number }) {
    const meta = CAND_STATUS[status] ?? CAND_STATUS[0];
    return (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.cls}`}>
            {meta.label}
        </span>
    );
}

/* ════════════════════════ COMPONENT ════════════════════════ */

export default function ProjetosScreen() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [vagas, setVagas] = useState<VagaMin[]>([]);
    const [selectedVagaId, setSelectedVagaId] = useState<string | null>(null);
    const [projetos, setProjetos] = useState<ProjetoItem[]>([]);
    const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
    const [candidatos, setCandidatos] = useState<CandidatoItem[]>([]);
    const [disponiveis, setDisponiveis] = useState<CandidatoItem[]>([]);
    const [tab, setTab] = useState<"candidatos" | "disponiveis">("candidatos");
    const [loading, setLoading] = useState(false);
    const [q, setQ] = useState("");
    const [vagaSearch, setVagaSearch] = useState("");

    /* nova rodada */
    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [newDescricao, setNewDescricao] = useState("");
    const [modoCriacao, setModoCriacao] = useState<"banco_novo" | "copiar" | "reprovados">("banco_novo");
    const [creating, setCreating] = useState(false);

    /* load vagas */
    useEffect(() => {
        fetchJson<VagaMin[]>("/api/vagas?fields=id,titulo")
            .then((data) => {
                const items = Array.isArray(data) ? data : ((data as any)?.items ?? []);
                setVagas(items);
            })
            .catch(() => toast.error("Falha ao carregar vagas."));
    }, []);

    /* auto-select from URL */
    useEffect(() => {
        const vagaIdFromUrl = searchParams.get("vagaId");
        if (vagaIdFromUrl && !selectedVagaId && vagas.length > 0) {
            if (vagas.find((v) => v.id === vagaIdFromUrl)) setSelectedVagaId(vagaIdFromUrl);
        }
    }, [searchParams, vagas, selectedVagaId]);

    /* load projetos */
    const loadProjetos = useCallback(async (vagaId: string) => {
        setLoading(true);
        try {
            const data = await fetchJson<ProjetoItem[]>(`/api/vagas/${vagaId}/projetos`);
            setProjetos(data);
            if (data.length > 0) {
                setSelectedProjetoId(data[0].id);
            } else {
                setSelectedProjetoId(null);
                setCandidatos([]);
                setDisponiveis([]);
            }
        } catch {
            toast.error("Falha ao carregar projetos.");
        } finally {
            setLoading(false);
        }
    }, []);

    /* load candidatos */
    const loadCandidatos = useCallback(async (projetoId: string) => {
        const [c, d] = await Promise.all([
            fetchJson<CandidatoItem[]>(`/api/projetos/${projetoId}/candidatos`).catch(() => [] as CandidatoItem[]),
            fetchJson<CandidatoItem[]>(`/api/projetos/${projetoId}/disponiveis`).catch(() => [] as CandidatoItem[]),
        ]);
        setCandidatos(Array.isArray(c) ? c : []);
        setDisponiveis(Array.isArray(d) ? d : []);
    }, []);

    useEffect(() => { if (selectedVagaId) void loadProjetos(selectedVagaId); }, [selectedVagaId, loadProjetos]);
    useEffect(() => { if (selectedProjetoId) void loadCandidatos(selectedProjetoId); }, [selectedProjetoId, loadCandidatos]);

    /* criar projeto */
    async function createProjeto() {
        if (!selectedVagaId) return;
        setCreating(true);
        try {
            await fetchJson(`/api/vagas/${selectedVagaId}/projetos`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    descricao: newDescricao.trim() || null,
                    copiarCandidatosAnterior: modoCriacao === "copiar",
                    ignorarCandidatosAnterior: modoCriacao === "banco_novo",
                    reprovarApenasReprovadosAnterior: modoCriacao === "reprovados",
                }),
            });
            setNewDialogOpen(false);
            setNewDescricao("");
            setModoCriacao("banco_novo");
            toast.success("Nova rodada criada.");
            await loadProjetos(selectedVagaId);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setCreating(false);
        }
    }

    /* atualizar status candidato */
    async function updateCandidatoStatus(pc: CandidatoItem, newStatus: number) {
        try {
            await fetchJson(`/api/projetos/${pc.projetoId}/candidatos/${pc.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus, observacoes: pc.observacoes }),
            });
            toast.success(CAND_STATUS[newStatus]?.label ?? "Atualizado.");
            if (selectedProjetoId) await loadCandidatos(selectedProjetoId);
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    const selectedVaga = vagas.find((v) => v.id === selectedVagaId);
    const selectedProjeto = projetos.find((p) => p.id === selectedProjetoId);
    const currentList = tab === "candidatos" ? candidatos : disponiveis;
    const filtered = currentList.filter((c) =>
        !q || c.candidatoNome.toLowerCase().includes(q.toLowerCase())
    );

    const vagasFiltradas = useMemo(() => {
        if (!vagaSearch.trim()) return vagas;
        return vagas.filter((v) => v.titulo.toLowerCase().includes(vagaSearch.toLowerCase()));
    }, [vagas, vagaSearch]);

    /* ════════════════════ RENDER ════════════════════ */

    return (
        <section className="space-y-5">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Etapa de seleção
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Rodadas de Seleção</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedVaga
                            ? <>Vaga atual: <span className="font-medium text-foreground">{selectedVaga.titulo}</span> · agrupe aprovados e avance para o processo seletivo.</>
                            : "Agrupe candidatos aprovados por vaga e prepare cada rodada para a próxima etapa."}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {selectedVagaId && (
                        <Button variant="outline" size="sm" onClick={() => router.push(`/vagas`)}>
                            Voltar para vagas
                        </Button>
                    )}
                    {selectedProjeto && (
                        <Button size="sm" onClick={() => router.push(`/gestao/processo-seletivo?projetoId=${selectedProjeto.id}&vagaId=${selectedProjeto.vagaId}`)}>
                            Abrir processo seletivo
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Entrada</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Aprovados no matching</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Use esta tela para separar por vaga quem já foi aprovado e precisa entrar em uma rodada.
                    </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Rodada</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Organização por grupo</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Cada rodada concentra um lote de candidatos da vaga para avançar junto com RH e gestão.
                    </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
                    <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Saída</div>
                    <div className="mt-2 text-sm font-semibold text-foreground">Processo seletivo</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                        Depois da rodada, a próxima tela cuida das fases, entrevistas e movimentações do candidato.
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 items-start">
                {/* Coluna esquerda — seleção de vaga e rodadas */}
                <div className="space-y-3">
                    {/* Busca de vaga */}
                    <div className="rounded-xl border border-border/50 bg-card shadow-sm p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vaga</p>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                                className="pl-7 h-8 text-sm"
                                placeholder="Filtrar vagas..."
                                value={vagaSearch}
                                onChange={(e) => setVagaSearch(e.target.value)}
                            />
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-0.5">
                            {vagasFiltradas.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-3 text-center">Nenhuma vaga encontrada.</p>
                            ) : (
                                vagasFiltradas.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => { setSelectedVagaId(v.id); setTab("candidatos"); setQ(""); }}
                                        className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${selectedVagaId === v.id
                                            ? "bg-primary/10 text-primary font-medium"
                                            : "hover:bg-muted/60 text-foreground"}`}
                                    >
                                        {v.titulo}
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Rodadas da vaga selecionada */}
                    {selectedVagaId && (
                        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Rodadas</p>
                                <Button size="xs" variant="outline" onClick={() => setNewDialogOpen(true)}>
                                    <Plus className="size-3" /> Nova rodada
                                </Button>
                            </div>
                            {loading ? (
                                <div className="space-y-1">
                                    {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
                                </div>
                            ) : projetos.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-3 text-center">
                                    Nenhuma rodada. Clique "Nova" para criar.
                                </p>
                            ) : (
                                projetos.map((p) => (
                                    <div key={p.id} className={`rounded-lg border transition-colors ${selectedProjetoId === p.id ? "border-primary bg-primary/5" : "border-border/40 hover:border-border"}`}>
                                        <button
                                            type="button"
                                            className="w-full text-left px-3 py-2"
                                            onClick={() => setSelectedProjetoId(p.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Rodada {p.numero}</span>
                                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <Users className="size-3" /> {p.totalCandidatos}
                                                </span>
                                            </div>
                                            {p.descricao && <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.descricao}</p>}
                                        </button>
                                        <div className="px-3 pb-2">
                                            <button
                                                type="button"
                                                className="text-xs text-primary hover:underline flex items-center gap-1"
                                                onClick={() => router.push(`/gestao/processo-seletivo?projetoId=${p.id}&vagaId=${p.vagaId}`)}
                                            >
                                                <ExternalLink className="size-3" /> Processo Seletivo
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Coluna direita — candidatos do projeto selecionado */}
                {selectedProjetoId ? (
                    <div className="rounded-xl border border-border/50 bg-card shadow-sm">
                        {/* Tabs + search */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border/40">
                            <div className="flex items-center gap-1 border-b-0">
                                {(["candidatos", "disponiveis"] as const).map((t) => (
                                    <button
                                        key={t} type="button"
                                        onClick={() => setTab(t)}
                                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                                    >
                                        {t === "candidatos"
                                            ? `Candidatos (${candidatos.length})`
                                            : `Disponíveis (${disponiveis.length})`}
                                    </button>
                                ))}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    className="pl-7 h-8 text-sm w-52"
                                    placeholder="Buscar nome..."
                                    value={q}
                                    onChange={(e) => setQ(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Fase</TableHead>
                                        <TableHead>Trabalhando</TableHead>
                                        <TableHead>Pretensão</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Observações</TableHead>
                                        {tab === "candidatos" && <TableHead className="w-20 text-right">Ações</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={tab === "candidatos" ? 7 : 6} className="text-center py-10 text-muted-foreground text-sm">
                                                {tab === "candidatos" ? "Nenhum candidato nesta rodada." : "Nenhum candidato disponível de rodadas anteriores."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filtered.map((c) => (
                                            <TableRow key={c.id}>
                                                <TableCell className="font-medium text-sm">
                                                    {c.candidatoLinkedinUrl ? (
                                                        <a href={c.candidatoLinkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                            {c.candidatoNome}
                                                        </a>
                                                    ) : c.candidatoNome}
                                                </TableCell>
                                                <TableCell>
                                                    {c.faseAtualNome
                                                        ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{c.faseAtualNome}</span>
                                                        : <span className="text-xs text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {c.candidatoTrabalhandoAtualmente === null ? "—"
                                                        : c.candidatoTrabalhandoAtualmente
                                                            ? <span className="text-amber-600 font-medium">Sim</span>
                                                            : <span className="text-muted-foreground">Não</span>}
                                                </TableCell>
                                                <TableCell className="text-sm">
                                                    {c.candidatoPretensaoSalarial != null ? brl.format(c.candidatoPretensaoSalarial) : "—"}
                                                </TableCell>
                                                <TableCell><CandStatusBadge status={c.status} /></TableCell>
                                                <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                                                    {c.observacoes || "—"}
                                                </TableCell>
                                                {tab === "candidatos" && (
                                                    <TableCell className="text-right">
                                                        {c.status === 0 && (
                                                            <div className="flex items-center justify-end gap-1">
                                                                <Button variant="ghost" size="icon-sm" title="Aprovar" onClick={() => void updateCandidatoStatus(c, 1)}>
                                                                    <UserCheck className="size-4 text-emerald-600" />
                                                                </Button>
                                                                <Button variant="ghost" size="icon-sm" title="Reprovar" onClick={() => void updateCandidatoStatus(c, 2)}>
                                                                    <UserX className="size-4 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="px-4 py-2 border-t border-border/40">
                            <p className="text-xs text-muted-foreground">{filtered.length} registros</p>
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-border/50 bg-card/50 flex items-center justify-center min-h-[200px]">
                        <div className="text-center text-muted-foreground text-sm">
                            <FolderOpen className="size-8 mx-auto mb-2 opacity-30" />
                            {selectedVagaId ? "Selecione uma rodada." : "Selecione uma vaga para ver os projetos."}
                        </div>
                    </div>
                )}
            </div>

            {/* Nova rodada dialog */}
            <Dialog open={newDialogOpen} onOpenChange={(o) => { setNewDialogOpen(o); if (!o) { setNewDescricao(""); setModoCriacao("banco_novo"); } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Nova Rodada</DialogTitle>
                        <DialogDescription>
                            {selectedVaga ? `Vaga: ${selectedVaga.titulo}` : "Criando nova rodada de seleção."}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-1">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição (opcional)</label>
                            <Input
                                className="mt-1"
                                placeholder="Ex: Rodada Março 2026"
                                value={newDescricao}
                                onChange={(e) => setNewDescricao(e.target.value)}
                                maxLength={240}
                            />
                        </div>
                        {selectedVagaId && (
                            <div className="rounded-lg border border-border/40 bg-muted/10 px-3 py-2">
                                <p className="text-xs text-muted-foreground">
                                    Ajuste informações da vaga (portal) antes de criar a rodada, se necessário.
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setNewDialogOpen(false);
                                            router.push(`/vagas?open=detail&vagaId=${encodeURIComponent(selectedVagaId)}`);
                                        }}
                                    >
                                        Editar vaga (portal)
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidatos</label>

                            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <input
                                    type="radio"
                                    name="modoCriacao"
                                    value="banco_novo"
                                    checked={modoCriacao === "banco_novo"}
                                    onChange={() => setModoCriacao("banco_novo")}
                                    className="mt-0.5"
                                />
                                <div>
                                    <div className="text-sm font-medium">Criar vaga com banco novo</div>
                                    <div className="text-xs text-muted-foreground">Nova rodada sem candidatos anteriores.</div>
                                </div>
                            </label>

                            {projetos.length > 0 && (
                                <>
                                    <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="radio"
                                            name="modoCriacao"
                                            value="copiar"
                                            checked={modoCriacao === "copiar"}
                                            onChange={() => setModoCriacao("copiar")}
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <div className="text-sm font-medium">Copiar da rodada anterior</div>
                                            <div className="text-xs text-muted-foreground">Candidatos entram como "Disponível" para nova triagem.</div>
                                        </div>
                                    </label>

                                    <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                        <input
                                            type="radio"
                                            name="modoCriacao"
                                            value="reprovados"
                                            checked={modoCriacao === "reprovados"}
                                            onChange={() => setModoCriacao("reprovados")}
                                            className="mt-0.5"
                                        />
                                        <div>
                                            <div className="text-sm font-medium">Começar com reprovados anteriores</div>
                                            <div className="text-xs text-muted-foreground">Reprovados anteriores entram automaticamente como "Reprovado".</div>
                                        </div>
                                    </label>
                                </>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={() => void createProjeto()} disabled={creating}>
                            {creating ? "Criando..." : "Criar Rodada"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
