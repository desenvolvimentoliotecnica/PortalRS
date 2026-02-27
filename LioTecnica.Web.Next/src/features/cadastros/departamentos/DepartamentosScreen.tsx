"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

const BASE = "/app";

interface DeptItem {
    id: string;
    codigo: string;
    nome: string;
    gestor: string;
    email: string;
    location: string;
    headcount: number;
    status: string;
    vagasOpen: number;
    vagasTotal: number;
}

interface DeptDraft {
    id?: string;
    code: string;
    name: string;
    areaId: string | null;
    managerFuncionarioId: string | null;
    status: string;
    description: string;
}

interface AreaLookup { id: string; name: string; code?: string }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
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

const emptyDraft: DeptDraft = { code: "", name: "", areaId: null, managerFuncionarioId: null, status: "ativo", description: "" };

export default function DepartamentosScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<DeptItem[]>([]);
    const [areas, setAreas] = useState<AreaLookup[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<DeptDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<DeptItem | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: DeptItem[] }>(`${BASE}/Departamentos/_api`);
        setRows(Array.isArray(payload?.items) ? payload.items : []);
    }, []);

    const loadAreas = useCallback(async () => {
        try {
            const payload = await fetchJson<{ items: AreaLookup[] }>(`${BASE}/Areas/_api`);
            setAreas(Array.isArray(payload?.items) ? payload.items : []);
        } catch { /* optional */ }
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        Promise.all([syncList(), loadAreas()])
            .catch(() => toast.error("Falha ao carregar departamentos."))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList, loadAreas]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((d) => {
            const st = (d.status ?? "").toLowerCase();
            if (statusFilter === "ativo" && st !== "ativo") return false;
            if (statusFilter === "inativo" && st !== "inativo") return false;
            if (!qq) return true;
            return [d.codigo, d.nome, d.gestor, d.email, d.location].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* pagination (client-side) */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((d) => (d.status ?? "").toLowerCase() === "ativo").length;
        const headcount = rows.reduce((s, d) => s + (d.headcount ?? 0), 0);
        const vagas = rows.reduce((s, d) => s + (d.vagasOpen ?? 0), 0);
        return { total, active, headcount, vagas };
    }, [rows]);

    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: DeptItem) {
        try {
            const detail = await fetchJson<Record<string, unknown>>(`${BASE}/Departamentos/_api/${item.id}`);
            setDraft({
                id: item.id,
                code: String(detail?.code ?? detail?.Code ?? item.codigo ?? ""),
                name: String(detail?.name ?? detail?.Name ?? item.nome ?? ""),
                areaId: String(detail?.areaId ?? detail?.AreaId ?? "") || null,
                managerFuncionarioId: String(detail?.managerFuncionarioId ?? detail?.ManagerFuncionarioId ?? "") || null,
                status: String(detail?.status ?? item.status ?? "ativo"),
                description: String(detail?.description ?? detail?.Description ?? ""),
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
            areaId: draft.areaId || null,
            managerFuncionarioId: draft.managerFuncionarioId || null,
            status: draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active",
            description: draft.description.trim() || null,
        };
        try {
            if (draft.id) {
                await fetchJson(`${BASE}/Departamentos/_api/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Departamento atualizado.");
            } else {
                await fetchJson(`${BASE}/Departamentos/_api`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Departamento criado.");
            }
            setEditOpen(false);
            await syncList();
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`${BASE}/Departamentos/_api/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Departamento excluído.");
            setDeleteTarget(null);
            await syncList();
        } catch { toast.error("Falha ao excluir."); }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Departamentos</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os departamentos da organização</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline">Novo departamento</span></Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Departamentos", value: kpis.total, color: "text-primary" },
                    { label: "Ativos", value: kpis.active, color: "text-emerald-600" },
                    { label: "Headcount", value: kpis.headcount, color: "text-amber-600" },
                    { label: "Vagas abertas", value: kpis.vagas, color: "text-primary" },
                ].map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Lista de departamentos</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="form-select h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Departamento</TableHead>
                            <TableHead>Gestor</TableHead>
                            <TableHead>Local</TableHead>
                            <TableHead>Headcount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Vagas</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : filtered.length ? paged.map((d) => (
                            <TableRow key={d.id}>
                                <TableCell>
                                    <div className="font-semibold">{d.nome}</div>
                                    <div className="text-muted-foreground text-xs font-mono">{d.codigo || "—"}</div>
                                </TableCell>
                                <TableCell className="text-sm">{d.gestor || "—"}</TableCell>
                                <TableCell className="text-sm">{d.location || "—"}</TableCell>
                                <TableCell className="font-mono text-sm">{d.headcount ?? 0}</TableCell>
                                <TableCell>{statusBadge(d.status)}</TableCell>
                                <TableCell className="font-mono text-sm">{d.vagasOpen ?? 0}/{d.vagasTotal ?? 0}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => void openEdit(d)}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-xs" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(d)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum departamento encontrado.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                <PaginationBar
                    page={page}
                    pageSize={pageSize}
                    totalItems={filtered.length}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar departamento" : "Novo departamento"}</DialogTitle>
                        <DialogDescription>Dados principais do departamento.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Código</label><Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Área</label>
                            <select className="form-select h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.areaId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, areaId: e.target.value || null }))}>
                                <option value="">Nenhuma</option>
                                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="form-select h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label><Input value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={() => void saveDraft()} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirm */}
            <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirmar exclusão</DialogTitle>
                        <DialogDescription>Excluir o departamento <strong>&quot;{deleteTarget?.nome}&quot;</strong>?</DialogDescription>
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
