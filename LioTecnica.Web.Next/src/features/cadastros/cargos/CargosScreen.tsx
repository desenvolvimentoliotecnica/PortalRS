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
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";
import { apiFetch } from "@/lib/api";

const BASE = "/app";

/* ---------- types ---------- */
interface CargoItem {
    id: string;
    codigo: string;
    nome: string;
    area: string;
    areaId?: string;
    senioridade: string;
    funcionarios?: number;
    gestores?: number;
    headcount?: number;
    status: string;
    tipo?: string;
    description?: string;
}

interface CargoDraft {
    id?: string;
    code: string;
    name: string;
    areaId: string | null;
    seniority: string;
    status: string;
    tipo: string;
    description: string;
}

interface AreaLookup { id: string; name: string }

/* ---------- helpers ---------- */
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

const emptyDraft: CargoDraft = { code: "", name: "", areaId: null, seniority: "", status: "ativo", tipo: "", description: "" };

/* ---------- component ---------- */
export default function CargosScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<CargoItem[]>([]);
    const [areas, setAreas] = useState<AreaLookup[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<CargoDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<CargoItem | null>(null);
    const [detailItem, setDetailItem] = useState<CargoItem | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: CargoItem[] }>(`${BASE}/Cargos/_api`);
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
            .catch(() => toast.error("Falha ao carregar cargos."))
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList, loadAreas]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((c) => {
            const st = (c.status ?? "").toLowerCase();
            if (statusFilter === "ativo" && st !== "ativo" && st !== "active") return false;
            if (statusFilter === "inativo" && st !== "inativo" && st !== "inactive") return false;
            if (!qq) return true;
            return [c.codigo, c.nome, c.area, c.senioridade].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* pagination (client-side) */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    /* KPIs — Razor: Cargos, Ativos, Funcionários, Headcount */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((c) => ["ativo", "active"].includes((c.status ?? "").toLowerCase())).length;
        const funcionarios = rows.reduce((s, c) => s + (c.funcionarios ?? c.gestores ?? 0), 0);
        const headcount = rows.reduce((s, c) => s + (c.headcount ?? 0), 0);
        return { total, active, funcionarios, headcount };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: CargoItem) {
        try {
            const detail = await fetchJson<Record<string, unknown>>(`${BASE}/Cargos/_api/${item.id}`);
            setDraft({
                id: item.id,
                code: String(detail?.code ?? detail?.Code ?? item.codigo ?? ""),
                name: String(detail?.name ?? detail?.Name ?? item.nome ?? ""),
                areaId: String(detail?.areaId ?? detail?.AreaId ?? item.areaId ?? "") || null,
                seniority: String(detail?.seniority ?? detail?.Seniority ?? item.senioridade ?? ""),
                status: String(detail?.status ?? item.status ?? "ativo"),
                tipo: String(detail?.tipo ?? detail?.Tipo ?? item.tipo ?? ""),
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
            seniority: draft.seniority.trim() || null,
            status: draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active",
            tipo: draft.tipo.trim() || null,
            description: draft.description.trim() || null,
        };
        try {
            if (draft.id) {
                await fetchJson(`${BASE}/Cargos/_api/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Cargo atualizado.");
            } else {
                await fetchJson(`${BASE}/Cargos/_api`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Cargo criado.");
            }
            setEditOpen(false);
            await syncList();
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`${BASE}/Cargos/_api/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Cargo excluído.");
            setDeleteTarget(null);
            await syncList();
        } catch { toast.error("Falha ao excluir."); }
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Cargos</h4>
                    <div className="text-muted-foreground text-sm">Padronize cargos usados nos funcionários e vagas.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo cargo</span></Button>
                </div>
            </div>

            {/* KPIs — 4 cards */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Cargos", value: kpis.total, color: "text-primary" },
                    { label: "Ativos", value: kpis.active, color: "text-emerald-600" },
                    { label: "Funcionários", value: kpis.funcionarios, color: "text-primary" },
                    { label: "Headcount", value: kpis.headcount, color: "text-primary" },
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
                        <div className="font-semibold">Lista de cargos</div>
                        <div className="text-muted-foreground text-sm">Clique em um cargo para ver funcionários vinculados.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, codigo, area..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                {/* Razor columns: Cargo, Area, Senioridade, Funcionários, Status, Ações */}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Cargo</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Senioridade</TableHead>
                            <TableHead>Funcionários</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : filtered.length ? paged.map((c) => (
                            <TableRow key={c.id}>
                                <TableCell>
                                    <div className="font-semibold">{c.nome}</div>
                                    <div className="text-muted-foreground text-xs font-mono">{c.codigo || "—"}</div>
                                </TableCell>
                                <TableCell className="text-sm">{c.area || "—"}</TableCell>
                                <TableCell className="text-sm">{c.senioridade || "—"}</TableCell>
                                <TableCell className="font-mono text-sm">{c.funcionarios ?? c.gestores ?? 0}</TableCell>
                                <TableCell>{statusBadge(c.status)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon-xs" title="Detalhes" onClick={() => setDetailItem(c)}><Eye /></Button>
                                        <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => void openEdit(c)}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-xs" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(c)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum cargo encontrado.</TableCell></TableRow>
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

            {/* Edit/Create Dialog — Razor fields: Código, Cargo, Status, Área, Senioridade, Tipo, Descrição */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar cargo" : "Novo cargo"}</DialogTitle>
                        <DialogDescription>Cadastre dados principais do cargo.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label>
                            <Input placeholder="CAR-XXX" value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo *</label>
                            <Input placeholder="Ex.: Gerente de Produção" value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Área</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.areaId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, areaId: e.target.value || null }))}>
                                <option value="">Selecionar área</option>
                                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Senioridade</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.seniority} onChange={(e) => setDraft((d) => ({ ...d, seniority: e.target.value }))}>
                                <option value="">Selecionar senioridade</option>
                                <option value="junior">Junior</option>
                                <option value="pleno">Pleno</option>
                                <option value="senior">Senior</option>
                                <option value="especialista">Especialista</option>
                                <option value="gestor">Gestor</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
                            <Input placeholder="Operacional, Liderança, Administrativo" value={draft.tipo} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Descrição</label>
                            <Input placeholder="Resumo do escopo do cargo" value={draft.description} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />
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
                        <DialogTitle>Detalhes — {detailItem?.nome}</DialogTitle>
                        <DialogDescription>Funcionários vinculados a este cargo.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Código:</span> {detailItem?.codigo || "—"}</div>
                        <div><span className="font-medium">Área:</span> {detailItem?.area || "—"}</div>
                        <div><span className="font-medium">Senioridade:</span> {detailItem?.senioridade || "—"}</div>
                        <div><span className="font-medium">Funcionários:</span> {detailItem?.funcionarios ?? detailItem?.gestores ?? 0}</div>
                        <div><span className="font-medium">Status:</span> {detailItem ? statusBadge(detailItem.status) : ""}</div>
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
                        <DialogDescription>Excluir o cargo <strong>&quot;{deleteTarget?.nome}&quot;</strong>?</DialogDescription>
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
