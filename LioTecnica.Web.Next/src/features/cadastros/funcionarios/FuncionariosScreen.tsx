"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Eye } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getScreenCache, setScreenCache } from "@/lib/screenCache";

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



/* ---------- types ---------- */
interface FuncItem {
    id: string;
    nome: string;
    email: string;
    telefone?: string;
    status: string;
    headcount?: number;
    unidade: string;
    unidadeId?: string;
    area: string;
    areaId?: string;
    cargo: string;
    cargoId?: string;
}

interface FuncDraft {
    id?: string;
    name: string;
    email: string;
    phone: string;
    areaId: string | null;
    unidadeId: string | null;
    cargoId: string | null;
    status: string;
    headcount: string;
}

interface LookupItem { id: string; name?: string; nome?: string }

/* ---------- helpers ---------- */
async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        const msg = `HTTP ${res.status}: ${t || res.statusText}`;
        console.error(`[apiFetch] ${init?.method ?? "GET"} ${url} → ${msg}`);
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function statusBadge(s: string | null | undefined) {
    const st = (s ?? "").toLowerCase();
    if (st === "ativo" || st === "active")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>;
}

const emptyDraft: FuncDraft = { name: "", email: "", phone: "", areaId: null, unidadeId: null, cargoId: null, status: "ativo", headcount: "0" };

const PAGE_SIZES = [10, 20, 50, 100];

/* ---------- component ---------- */
export default function FuncionariosScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<FuncItem[]>([]);
    const [areas, setAreas] = useState<LookupItem[]>([]);
    const [unidades, setUnidades] = useState<LookupItem[]>([]);
    const [cargos, setCargos] = useState<LookupItem[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<FuncDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<FuncItem | null>(null);
    const [detailItem, setDetailItem] = useState<FuncItem | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: Record<string, unknown>[] }>(`/api/funcionarios`);
        const mapped: FuncItem[] = (Array.isArray(payload?.items) ? payload.items : []).map((i) => ({
            id: String(i.id ?? ""),
            nome: String(i.name ?? ""),
            email: String(i.email ?? ""),
            telefone: i.phone ? String(i.phone) : undefined,
            status: String(i.status ?? ""),
            headcount: typeof i.headcount === "number" ? i.headcount : 0,
            unidade: String(i.unitName ?? ""),
            unidadeId: i.unitId ? String(i.unitId) : undefined,
            area: String(i.areaName ?? ""),
            areaId: i.areaId ? String(i.areaId) : undefined,
            cargo: String(i.jobPositionName ?? ""),
            cargoId: i.jobPositionId ? String(i.jobPositionId) : undefined,
        }));
        setRows(mapped);
        setScreenCache("/funcionarios", mapped);
    }, []);

    const loadLookups = useCallback(async () => {
        try {
            const [aRaw, u, c] = await Promise.all([
                fetchJson<unknown>(`/api/areas`).catch((e) => { console.warn("lookup areas", e); return [] as unknown; }),
                fetchJson<{ items: LookupItem[] }>(`/api/units`).catch((e) => { console.warn("lookup units", e); return { items: [] as LookupItem[] }; }),
                fetchJson<{ items: LookupItem[] }>(`/api/job-positions`).catch((e) => { console.warn("lookup cargos", e); return { items: [] as LookupItem[] }; }),
            ]);
            const aItems = Array.isArray(aRaw) ? (aRaw as LookupItem[]) : Array.isArray((aRaw as Record<string, unknown>)?.items) ? ((aRaw as Record<string, unknown>).items as LookupItem[]) : [];
            setAreas(aItems);
            setUnidades(Array.isArray(u?.items) ? u.items : []);
            setCargos(Array.isArray(c?.items) ? c.items : []);
        } catch { /* optional lookups */ }
    }, []);

    useEffect(() => {
        let alive = true;
        const cached = getScreenCache<FuncItem[]>("/funcionarios");
        if (cached) {
            setRows(cached);
        } else {
            setLoading(true);
        }
        Promise.all([syncList(), loadLookups()])
            .catch((e) => { console.error("Funcionários – load error", e); toast.error(`Falha ao carregar funcionários: ${e instanceof Error ? e.message : "erro"}`); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList, loadLookups]);

    /* filter */
    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((f) => {
            const st = (f.status ?? "").toLowerCase();
            if (statusFilter === "ativo" && st !== "ativo" && st !== "active") return false;
            if (statusFilter === "inativo" && st !== "inativo" && st !== "inactive") return false;
            if (!qq) return true;
            return [f.nome, f.email, f.area, f.unidade, f.cargo].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* pagination */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    /* KPIs — Razor: Funcionários, Ativos, Headcount, Unidades */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((f) => ["ativo", "active"].includes((f.status ?? "").toLowerCase())).length;
        const headcount = rows.reduce((s, f) => s + (f.headcount ?? 0), 0);
        const uniqueUnidades = new Set(rows.map((f) => f.unidade).filter(Boolean)).size;
        return { total, active, headcount, uniqueUnidades };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: FuncItem) {
        try {
            const d = await fetchJson<Record<string, unknown>>(`/api/funcionarios/${item.id}`);
            setDraft({
                id: item.id,
                name: String(d?.name ?? d?.Name ?? d?.nome ?? item.nome ?? ""),
                email: String(d?.email ?? d?.Email ?? item.email ?? ""),
                phone: String(d?.telefone ?? d?.Telefone ?? d?.phone ?? item.telefone ?? ""),
                areaId: String(d?.areaId ?? d?.AreaId ?? item.areaId ?? "") || null,
                unidadeId: String(d?.unidadeId ?? d?.UnidadeId ?? item.unidadeId ?? "") || null,
                cargoId: String(d?.cargoId ?? d?.CargoId ?? item.cargoId ?? "") || null,
                status: String(d?.status ?? d?.Status ?? item.status ?? "ativo"),
                headcount: String(d?.headcount ?? d?.Headcount ?? item.headcount ?? "0"),
            });
            setEditOpen(true);
        } catch { toast.error("Falha ao carregar dados."); }
    }

    async function saveDraft() {
        if (!draft.name.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        const payload = {
            name: draft.name.trim(),
            email: draft.email.trim() || null,
            telefone: draft.phone.trim() || null,
            areaId: draft.areaId || null,
            unidadeId: draft.unidadeId || null,
            cargoId: draft.cargoId || null,
            status: draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active",
            headcount: parseInt(draft.headcount, 10) || 0,
        };
        try {
            if (draft.id) {
                await fetchJson(`/api/funcionarios/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Funcionário atualizado.");
            } else {
                await fetchJson(`/api/funcionarios`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Funcionário criado.");
            }
            setEditOpen(false);
            await syncList();
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`/api/funcionarios/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Funcionário excluído.");
            setDeleteTarget(null);
            await syncList();
        } catch { toast.error("Falha ao excluir."); }
    }



    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold">Funcionários</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo funcionário</span></Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Funcionários", value: kpis.total, color: "text-primary" },
                    { label: "Ativos", value: kpis.active, color: "text-emerald-600" },
                    { label: "Headcount", value: kpis.headcount, color: "text-amber-600" },
                    { label: "Unidades", value: kpis.uniqueUnidades, color: "text-primary" },
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
                    <div className="font-semibold">Lista de funcionários</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, email, area..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                {/* Razor columns: Funcionário(nome+email), Área(+cargo sub), Unidade, Headcount, Status, Ações */}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Funcionário</TableHead>
                            <TableHead>Área</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Headcount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : paged.length ? paged.map((f) => (
                            <TableRow key={f.id}>
                                <TableCell>
                                    <div className="font-semibold">{f.nome}</div>
                                    <div className="text-muted-foreground text-xs">{f.email || "—"}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="text-sm">{f.area || "—"}</div>
                                    <div className="text-muted-foreground text-xs">{f.cargo || ""}</div>
                                </TableCell>
                                <TableCell className="text-sm">{f.unidade || "—"}</TableCell>
                                <TableCell className="font-mono font-medium">{f.headcount ?? 0}</TableCell>
                                <TableCell>{statusBadge(f.status)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon-xs" title="Detalhes" onClick={() => setDetailItem(f)}><Eye /></Button>
                                        <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => void openEdit(f)}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-xs" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(f)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum funcionário encontrado.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <PaginationBar
                    page={page}
                    pageSize={pageSize}
                    totalItems={filtered.length}
                    pageSizes={PAGE_SIZES}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                />
            </div>

            {/* Edit/Create Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar funcionário" : "Novo funcionário"}</DialogTitle>
                        <DialogDescription>Cadastre dados do funcionário.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label><Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label><Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Área</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.areaId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, areaId: e.target.value || null }))}>
                                <option value="">Selecionar</option>
                                {areas.map((a) => <option key={a.id} value={a.id}>{a.name ?? a.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Unidade</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.unidadeId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, unidadeId: e.target.value || null }))}>
                                <option value="">Selecionar</option>
                                {unidades.map((u) => <option key={u.id} value={u.id}>{u.name ?? u.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Cargo</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.cargoId ?? ""} onChange={(e) => setDraft((d) => ({ ...d, cargoId: e.target.value || null }))}>
                                <option value="">Selecionar</option>
                                {cargos.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.nome}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Headcount</label><Input type="number" value={draft.headcount} onChange={(e) => setDraft((d) => ({ ...d, headcount: e.target.value }))} /></div>
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
                        <DialogDescription>Dados do funcionário.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Email:</span> {detailItem?.email || "—"}</div>
                        <div><span className="font-medium">Telefone:</span> {detailItem?.telefone || "—"}</div>
                        <div><span className="font-medium">Área:</span> {detailItem?.area || "—"}</div>
                        <div><span className="font-medium">Cargo:</span> {detailItem?.cargo || "—"}</div>
                        <div><span className="font-medium">Unidade:</span> {detailItem?.unidade || "—"}</div>
                        <div><span className="font-medium">Headcount:</span> {detailItem?.headcount ?? 0}</div>
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
                        <DialogDescription>Excluir o funcionário <strong>&quot;{deleteTarget?.nome}&quot;</strong>?</DialogDescription>
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
