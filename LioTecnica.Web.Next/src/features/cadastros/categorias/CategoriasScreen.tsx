"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

const BASE = "/app";

/* ---------- types ---------- */
interface CategoriaItem {
    id: string;
    code?: string;
    codigo?: string;
    name?: string;
    nome?: string;
    description?: string;
    descricao?: string;
    status?: string;
    requisitosCount?: number;
    vagasCount?: number;
}

interface CategoriaDraft {
    id?: string;
    code: string;
    name: string;
    description: string;
    status: string;
}

/* ---------- helpers ---------- */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        credentials: "same-origin",
        cache: "no-store",
    });
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(t || `HTTP_${res.status}`); }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function statusBadge(s: string | null | undefined) {
    const st = (s ?? "").toLowerCase();
    if (st === "ativo" || st === "active")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function field(item: any, ...keys: string[]): string {
    for (const k of keys) { const v = item?.[k]; if (v != null && v !== "") return String(v); }
    return "";
}
function nome(item: CategoriaItem) { return field(item, "name", "nome", "Name"); }
function codigo(item: CategoriaItem) { return field(item, "code", "codigo", "Code"); }
function descricao(item: CategoriaItem) { return field(item, "description", "descricao", "Description"); }

const emptyDraft: CategoriaDraft = { code: "", name: "", description: "", status: "ativo" };

/* ---------- component ---------- */
export default function CategoriasScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<CategoriaItem[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<CategoriaDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<CategoriaItem | null>(null);
    const [detailItem, setDetailItem] = useState<CategoriaItem | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: CategoriaItem[] }>(`${BASE}/Categorias/_api`);
        setRows(Array.isArray(payload?.items) ? payload.items : []);
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch(() => toast.error("Falha ao carregar funções."))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    /* filters */
    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((c) => {
            const st = (c.status ?? "").toLowerCase();
            if (statusFilter === "ativo" && st !== "ativo" && st !== "active") return false;
            if (statusFilter === "inativo" && st !== "inativo" && st !== "inactive") return false;
            if (!qq) return true;
            return [codigo(c), nome(c), descricao(c)].join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* KPIs — matching Razor: Funções, Ativas, Requisitos, Vagas com requisitos */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((c) => ["ativo", "active"].includes((c.status ?? "").toLowerCase())).length;
        const reqs = rows.reduce((s, c) => s + (c.requisitosCount ?? 0), 0);
        const vagas = rows.reduce((s, c) => s + (c.vagasCount ?? 0), 0);
        return { total, active, reqs, vagas };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: CategoriaItem) {
        try {
            const detail = await fetchJson<Record<string, unknown>>(`${BASE}/Categorias/_api/${item.id}`);
            setDraft({
                id: item.id,
                code: String(detail?.code ?? detail?.Code ?? codigo(item)),
                name: String(detail?.name ?? detail?.Name ?? nome(item)),
                description: String(detail?.description ?? detail?.Description ?? descricao(item)),
                status: String(detail?.status ?? detail?.Status ?? item.status ?? "ativo"),
            });
            setEditOpen(true);
        } catch { toast.error("Falha ao carregar dados."); }
    }

    async function saveDraft() {
        if (!draft.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        const payload = {
            code: draft.code.trim() || null,
            name: draft.name.trim(),
            description: draft.description.trim() || null,
            status: draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active",
        };
        try {
            if (draft.id) {
                await fetchJson(`${BASE}/Categorias/_api/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Função atualizada.");
            } else {
                await fetchJson(`${BASE}/Categorias/_api`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Função criada.");
            }
            setEditOpen(false);
            await syncList();
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`${BASE}/Categorias/_api/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Função excluída.");
            setDeleteTarget(null);
            await syncList();
        } catch { toast.error("Falha ao excluir."); }
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Funções</h4>
                    <div className="text-muted-foreground text-sm">Gerencie funções (cargo/função) usadas nos requisitos das vagas. Sincronizado com o RM.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova função</span></Button>
                </div>
            </div>

            {/* KPIs — 4 cards like Razor */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Funções", value: kpis.total, color: "text-primary" },
                    { label: "Ativas", value: kpis.active, color: "text-emerald-600" },
                    { label: "Requisitos", value: kpis.reqs, color: "text-primary" },
                    { label: "Vagas com requisitos", value: kpis.vagas, color: "text-primary" },
                ].map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            {/* Table card */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Lista de funções</div>
                        <div className="text-muted-foreground text-sm">Clique em uma função para ver vagas relacionadas.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, codigo..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Função</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Requisitos</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : filtered.length ? filtered.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>
                                    <div className="font-semibold">{nome(c)}</div>
                                    <div className="text-muted-foreground text-xs font-mono">{codigo(c) || "—"}</div>
                                </TableCell>
                                <TableCell>{statusBadge(c.status)}</TableCell>
                                <TableCell className="font-mono text-sm">{c.requisitosCount ?? 0}</TableCell>
                                <TableCell className="max-w-[300px] truncate text-sm text-muted-foreground">{descricao(c) || "—"}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon-xs" title="Detalhes" onClick={() => setDetailItem(c)}><Eye /></Button>
                                        <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => void openEdit(c)}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-xs" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(c)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma função encontrada.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                <div className="mt-2 text-xs text-muted-foreground">{filtered.length} de {rows.length} funções</div>
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar função" : "Nova função"}</DialogTitle>
                        <DialogDescription>Cadastre dados principais da categoria.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
                            <Input placeholder="CAT-XXX" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Categoria *</label>
                            <Input placeholder="Ex.: Competência" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
                            <Input placeholder="Resumo do uso da categoria" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Dialog */}
            <Dialog open={!!detailItem} onOpenChange={(open) => !open && setDetailItem(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Detalhes — {detailItem ? nome(detailItem) : ""}</DialogTitle>
                        <DialogDescription>Requisitos vinculados a esta função.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Código:</span> {detailItem ? (codigo(detailItem) || "—") : ""}</div>
                        <div><span className="font-medium">Status:</span> {detailItem ? statusBadge(detailItem.status) : ""}</div>
                        <div><span className="font-medium">Requisitos:</span> {detailItem?.requisitosCount ?? 0}</div>
                        <div><span className="font-medium">Vagas:</span> {detailItem?.vagasCount ?? 0}</div>
                        <div><span className="font-medium">Descrição:</span> {detailItem ? (descricao(detailItem) || "—") : ""}</div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDetailItem(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>Excluir a função <strong>&quot;{deleteTarget ? nome(deleteTarget) : ""}&quot;</strong>?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void confirmDelete()}>Excluir</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
