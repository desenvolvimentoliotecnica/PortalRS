"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    Plus, Target, CheckCircle2, XCircle, RefreshCw, Pencil, Trash2, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

/* ────── types ────── */

interface MetaResponse {
    id: string;
    funcionarioId: string;
    funcionarioNome: string;
    criadaPorId: string;
    criadaPorNome: string;
    titulo: string;
    descricao: string | null;
    valorMeta: number;
    valorAtual: number;
    unidade: string;
    prazo: string | null;
    status: number; // 0=Ativa, 1=Concluida, 2=Cancelada
    percentualConcluido: number;
    criadoEmUtc: string;
    atualizadoEmUtc: string;
}

interface FuncionarioOption {
    id: string;
    name: string;
}

/* ────── constants ────── */

const STATUS_LABEL: Record<number, string> = { 0: "Ativa", 1: "Concluída", 2: "Cancelada" };
const STATUS_COLOR: Record<number, string> = {
    0: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    1: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    2: "bg-muted text-muted-foreground",
};

const UNIDADE_OPTIONS = ["%", "R$", "qtd", "pts", "hrs", "km", "kg"];

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

function ProgressBar({ value, max, unidade }: { value: number; max: number; unidade: string }) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    const color = pct >= 100 ? "bg-green-500" : pct >= 60 ? "bg-blue-500" : pct >= 30 ? "bg-amber-500" : "bg-red-400";
    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{value} {unidade}</span>
                <span>{max} {unidade} ({pct.toFixed(1)}%)</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

/* ────── main component ────── */

export default function MetasScreen() {
    const [metas, setMetas] = useState<MetaResponse[]>([]);
    const [funcionarios, setFuncionarios] = useState<FuncionarioOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>("");

    /* create/edit dialog */
    const [formOpen, setFormOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formFuncionarioId, setFormFuncionarioId] = useState("");
    const [formTitulo, setFormTitulo] = useState("");
    const [formDescricao, setFormDescricao] = useState("");
    const [formValorMeta, setFormValorMeta] = useState("100");
    const [formUnidade, setFormUnidade] = useState("%");
    const [formPrazo, setFormPrazo] = useState("");
    const [formSaving, setFormSaving] = useState(false);

    /* progresso dialog */
    const [progressoOpen, setProgressoOpen] = useState(false);
    const [progressoTarget, setProgressoTarget] = useState<MetaResponse | null>(null);
    const [progressoValor, setProgressoValor] = useState("");
    const [progressoSaving, setProgressoSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<MetaResponse[]>("/api/metas/minha-equipe");
            setMetas(data);
        } catch {
            toast.error("Falha ao carregar metas.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
        fetchJson<any>("/api/funcionarios?pageSize=200").then((data) => {
            const items: any[] = Array.isArray(data) ? data : (data?.items ?? []);
            setFuncionarios(items.map((f) => ({ id: f.id, name: f.name ?? f.nome ?? "" })));
        }).catch(() => { });
    }, [load]);

    const metasFiltradas = filterStatus !== ""
        ? metas.filter((m) => m.status === Number(filterStatus))
        : metas;

    function openNew() {
        setEditId(null);
        setFormFuncionarioId(funcionarios[0]?.id ?? "");
        setFormTitulo("");
        setFormDescricao("");
        setFormValorMeta("100");
        setFormUnidade("%");
        setFormPrazo("");
        setFormOpen(true);
    }

    function openEdit(m: MetaResponse) {
        setEditId(m.id);
        setFormFuncionarioId(m.funcionarioId);
        setFormTitulo(m.titulo);
        setFormDescricao(m.descricao ?? "");
        setFormValorMeta(String(m.valorMeta));
        setFormUnidade(m.unidade);
        setFormPrazo(m.prazo ?? "");
        setFormOpen(true);
    }

    function openProgresso(m: MetaResponse) {
        setProgressoTarget(m);
        setProgressoValor(String(m.valorAtual));
        setProgressoOpen(true);
    }

    async function saveForm() {
        if (!formTitulo.trim()) { toast.error("Título obrigatório."); return; }
        const valorMeta = Number(formValorMeta);
        if (valorMeta <= 0) { toast.error("Valor meta deve ser maior que zero."); return; }
        setFormSaving(true);
        try {
            if (editId) {
                await fetchJson(`/api/metas/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        titulo: formTitulo.trim(),
                        descricao: formDescricao.trim() || null,
                        valorMeta,
                        unidade: formUnidade,
                        prazo: formPrazo || null,
                    }),
                });
                toast.success("Meta atualizada!");
            } else {
                await fetchJson("/api/metas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        funcionarioId: formFuncionarioId,
                        titulo: formTitulo.trim(),
                        descricao: formDescricao.trim() || null,
                        valorMeta,
                        unidade: formUnidade,
                        prazo: formPrazo || null,
                    }),
                });
                toast.success("Meta criada!");
            }
            setFormOpen(false);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setFormSaving(false);
        }
    }

    async function saveProgresso() {
        if (!progressoTarget) return;
        const valor = Number(progressoValor);
        if (isNaN(valor) || valor < 0) { toast.error("Valor inválido."); return; }
        setProgressoSaving(true);
        try {
            await fetchJson(`/api/metas/${progressoTarget.id}/progresso`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valorAtual: valor }),
            });
            toast.success("Progresso atualizado!");
            setProgressoOpen(false);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setProgressoSaving(false);
        }
    }

    async function cancelarMeta(id: string) {
        if (!confirm("Cancelar esta meta?")) return;
        try {
            await fetchJson(`/api/metas/${id}/cancelar`, { method: "PATCH" });
            toast.success("Meta cancelada.");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    async function deleteMeta(id: string) {
        if (!confirm("Remover esta meta permanentemente?")) return;
        try {
            await fetchJson(`/api/metas/${id}`, { method: "DELETE" });
            toast.success("Meta removida.");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        }
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Desempenho
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">Metas</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Defina e acompanhe metas individuais da sua equipe.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()}>
                        <RefreshCw className="size-4 mr-1" /> Atualizar
                    </Button>
                    <Button size="sm" onClick={openNew}>
                        <Plus className="size-4 mr-1" /> Nova Meta
                    </Button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-2 items-center">
                <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                >
                    <option value="">Todos os status</option>
                    <option value="0">Ativa</option>
                    <option value="1">Concluída</option>
                    <option value="2">Cancelada</option>
                </select>
                <span className="text-sm text-muted-foreground">{metasFiltradas.length} meta{metasFiltradas.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Cards */}
            {loading ? (
                <div className="grid gap-3 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-36 w-full rounded-xl" />
                    ))}
                </div>
            ) : metasFiltradas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Target className="size-10 text-muted-foreground/40 mb-3" />
                    <p className="text-muted-foreground">Nenhuma meta encontrada.</p>
                    <Button className="mt-4" size="sm" onClick={openNew}>
                        <Plus className="size-4 mr-1" /> Criar primeira meta
                    </Button>
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2">
                    {metasFiltradas.map((m) => (
                        <div key={m.id} className="rounded-xl border border-border/40 bg-card p-4 shadow-sm space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-sm truncate">{m.titulo}</span>
                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[m.status]}`}>
                                            {STATUS_LABEL[m.status]}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-0.5">{m.funcionarioNome}</div>
                                    {m.descricao && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.descricao}</div>}
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0">
                                    {m.status === 0 && (
                                        <Button variant="outline" size="icon-xs" title="Atualizar progresso" onClick={() => openProgresso(m)}>
                                            <TrendingUp className="size-3.5" />
                                        </Button>
                                    )}
                                    <Button variant="outline" size="icon-xs" title="Editar" onClick={() => openEdit(m)} disabled={m.status !== 0}>
                                        <Pencil className="size-3.5" />
                                    </Button>
                                    {m.status === 0 && (
                                        <Button variant="outline" size="icon-xs" title="Cancelar" onClick={() => void cancelarMeta(m.id)}>
                                            <XCircle className="size-3.5 text-amber-500" />
                                        </Button>
                                    )}
                                    <Button variant="destructive" size="icon-xs" title="Remover" onClick={() => void deleteMeta(m.id)}>
                                        <Trash2 className="size-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <ProgressBar value={m.valorAtual} max={m.valorMeta} unidade={m.unidade} />
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span>Prazo: {m.prazo ? new Date(m.prazo).toLocaleDateString("pt-BR") : "—"}</span>
                                {m.status === 1 && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="size-3" /> Concluída!</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editId ? "Editar Meta" : "Nova Meta"}</DialogTitle>
                        <DialogDescription>Defina os parâmetros da meta de desempenho.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {!editId && (
                            <div>
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Funcionário *</label>
                                <select
                                    className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    value={formFuncionarioId}
                                    onChange={(e) => setFormFuncionarioId(e.target.value)}
                                >
                                    {funcionarios.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Título *</label>
                            <Input
                                placeholder="Ex: Aumentar vendas em Q2"
                                value={formTitulo}
                                onChange={(e) => setFormTitulo(e.target.value)}
                                maxLength={300}
                                className="mt-1"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</label>
                            <Input
                                placeholder="Detalhes sobre a meta..."
                                value={formDescricao}
                                onChange={(e) => setFormDescricao(e.target.value)}
                                maxLength={2000}
                                className="mt-1"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor Meta *</label>
                                <Input
                                    type="number"
                                    min="0"
                                    step="any"
                                    value={formValorMeta}
                                    onChange={(e) => setFormValorMeta(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unidade</label>
                                <select
                                    className="mt-1 block w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                                    value={formUnidade}
                                    onChange={(e) => setFormUnidade(e.target.value)}
                                >
                                    {UNIDADE_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prazo</label>
                            <Input
                                type="date"
                                value={formPrazo}
                                onChange={(e) => setFormPrazo(e.target.value)}
                                className="mt-1"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setFormOpen(false)} disabled={formSaving}>Cancelar</Button>
                        <Button onClick={() => void saveForm()} disabled={formSaving || !formTitulo.trim()}>
                            {formSaving ? "Salvando..." : editId ? "Salvar" : "Criar Meta"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Progresso Dialog */}
            <Dialog open={progressoOpen} onOpenChange={setProgressoOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Atualizar Progresso</DialogTitle>
                        <DialogDescription>
                            <strong>{progressoTarget?.titulo}</strong> — Meta: {progressoTarget?.valorMeta} {progressoTarget?.unidade}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Valor Atual ({progressoTarget?.unidade})
                        </label>
                        <Input
                            type="number"
                            min="0"
                            step="any"
                            value={progressoValor}
                            onChange={(e) => setProgressoValor(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setProgressoOpen(false)} disabled={progressoSaving}>Cancelar</Button>
                        <Button onClick={() => void saveProgresso()} disabled={progressoSaving}>
                            {progressoSaving ? "Salvando..." : "Atualizar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
