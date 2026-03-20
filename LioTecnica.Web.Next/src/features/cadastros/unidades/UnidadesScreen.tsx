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

/* ------------------------------------------------------------------ */
/*  Types – match the RHPortal.Api contracts                           */
/* ------------------------------------------------------------------ */

/** Matches UnitGridRowResponse from the API (PagedResult<UnitGridRowResponse>) */
interface UnitGridRow {
    id: string;
    name: string;
    code: string;
    status: number | string;  // API sends enum int (1=Active, 2=Inactive) or string
    headcount: number;
    email: string | null;
    phone: string | null;
    type: string | null;
    city: string | null;
    uf: string | null;
    addressLine: string | null;
    neighborhood: string | null;
    zipCode: string | null;
    responsibleName: string | null;
    notes: string | null;
}

/** Matches UnitResponse from the API (GET by id, POST, PUT) */
interface UnitDetail extends UnitGridRow {
    createdAtUtc?: string;
    updatedAtUtc?: string;
}

interface PagedResponse<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
}

interface UnidadeDraft {
    id?: string;
    code: string;
    name: string;
    status: string;
    headcount: string;
    email: string;
    phone: string;
    type: string;
    city: string;
    uf: string;
    zipCode: string;
    addressLine: string;
    neighborhood: string;
    responsibleName: string;
    notes: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const t = await res.text().catch(() => "");
        let msg = `HTTP ${res.status}: ${t || res.statusText}`;
        // Try to extract structured error
        try {
            const j = JSON.parse(t);
            if (j?.message) msg = j.message;
            else if (j?.detail) msg = j.detail;
            else if (j?.errors) {
                const parts = Object.entries(j.errors).flatMap(([k, v]) =>
                    Array.isArray(v) ? v.map((m: string) => `${k}: ${m}`) : [`${k}: ${v}`]
                );
                if (parts.length) msg = parts.join("; ");
            }
        } catch { /* not JSON */ }
        console.error(`[apiFetch] ${init?.method ?? "GET"} ${url} → ${msg}`);
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

/** Maps API status (int enum or string) to display label */
function mapStatus(s: number | string | null | undefined): "ativo" | "inativo" {
    if (typeof s === "number") return s === 1 ? "ativo" : "inativo";
    if (typeof s === "string") {
        const lower = s.toLowerCase();
        if (lower === "active" || lower === "ativo" || lower === "1") return "ativo";
    }
    return "inativo";
}

function statusBadge(s: number | string | null | undefined) {
    const st = mapStatus(s);
    if (st === "ativo")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">Inativo</span>;
}

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

const emptyDraft: UnidadeDraft = {
    code: "", name: "", status: "Active", headcount: "0",
    email: "", phone: "", type: "", city: "", uf: "", zipCode: "",
    addressLine: "", neighborhood: "", responsibleName: "", notes: "",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function UnidadesScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<UnitGridRow[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<UnidadeDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UnitGridRow | null>(null);
    const [detailItem, setDetailItem] = useState<UnitGridRow | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<PagedResponse<UnitGridRow>>("/api/units");
        const items = Array.isArray(payload?.items) ? payload.items : [];
        setRows(items);
        setScreenCache("/unidades", items);
    }, []);

    useEffect(() => {
        let alive = true;
        const cached = getScreenCache<UnitGridRow[]>("/unidades");
        if (cached && Array.isArray(cached)) {
            setRows(cached);
        } else {
            setLoading(true);
        }
        syncList()
            .catch((e) => { console.error("Unidades – load error", e); toast.error(`Falha ao carregar unidades: ${e instanceof Error ? e.message : "erro"}`); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((u) => {
            const st = mapStatus(u.status);
            if (statusFilter === "ativo" && st !== "ativo") return false;
            if (statusFilter === "inativo" && st !== "inativo") return false;
            if (!qq) return true;
            return [u.name, u.code, u.city, u.email, u.type].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* pagination (client-side) */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    /* KPIs */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((u) => mapStatus(u.status) === "ativo").length;
        const headcount = rows.reduce((s, u) => s + (u.headcount ?? 0), 0);
        return { total, active, headcount };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: UnitGridRow) {
        try {
            const d = await fetchJson<UnitDetail>(`/api/units/${item.id}`);
            setDraft({
                id: item.id,
                code: d?.code ?? item.code ?? "",
                name: d?.name ?? item.name ?? "",
                status: typeof d?.status === "number" ? (d.status === 1 ? "Active" : "Inactive") : String(d?.status ?? "Active"),
                headcount: String(d?.headcount ?? item.headcount ?? 0),
                email: d?.email ?? item.email ?? "",
                phone: d?.phone ?? item.phone ?? "",
                type: d?.type ?? item.type ?? "",
                city: d?.city ?? item.city ?? "",
                uf: d?.uf ?? item.uf ?? "",
                zipCode: d?.zipCode ?? item.zipCode ?? "",
                addressLine: d?.addressLine ?? item.addressLine ?? "",
                neighborhood: d?.neighborhood ?? item.neighborhood ?? "",
                responsibleName: d?.responsibleName ?? item.responsibleName ?? "",
                notes: d?.notes ?? item.notes ?? "",
            });
            setEditOpen(true);
        } catch { toast.error("Falha ao carregar dados."); }
    }

    async function saveDraft() {
        if (!draft.name.trim()) { toast.error("Nome é obrigatório."); return; }
        if (!draft.code.trim()) { toast.error("Código é obrigatório."); return; }
        setSaving(true);

        const payload = {
            code: draft.code.trim(),
            name: draft.name.trim(),
            status: draft.status.toLowerCase() === "inactive" ? "Inactive" : "Active",
            headcount: parseInt(draft.headcount, 10) || 0,
            email: draft.email.trim() || null,
            phone: draft.phone.trim() || null,
            type: draft.type.trim() || null,
            city: draft.city.trim() || null,
            uf: draft.uf.trim() || null,
            zipCode: draft.zipCode.trim() || null,
            addressLine: draft.addressLine.trim() || null,
            neighborhood: draft.neighborhood.trim() || null,
            responsibleName: draft.responsibleName.trim() || null,
            notes: draft.notes.trim() || null,
        };

        try {
            if (draft.id) {
                await fetchJson(`/api/units/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Unidade atualizada.");
            } else {
                await fetchJson("/api/units", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Unidade criada.");
            }
            setEditOpen(false);
            await syncList();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            await fetchJson(`/api/units/${deleteTarget.id}`, { method: "DELETE" });
            toast.success("Unidade excluída.");
            setDeleteTarget(null);
            await syncList();
        } catch { toast.error("Falha ao excluir."); }
    }

    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold">Unidades e filiais</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={openNew}><Plus className="size-4" /><span className="hidden sm:inline ml-1">Nova unidade</span></Button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                    { label: "Unidades", value: kpis.total, color: "text-primary" },
                    { label: "Ativas", value: kpis.active, color: "text-emerald-600" },
                    { label: "Headcount", value: kpis.headcount, color: "text-primary" },
                    { label: "Vagas abertas", value: 0, color: "text-primary" },
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
                        <div className="font-semibold">Lista de unidades</div>
                        <div className="text-muted-foreground text-sm">Clique em uma unidade para ver funcionários e vagas.</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, codigo, cidade..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Headcount</TableHead>
                            <TableHead>Contato</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando…</TableCell></TableRow>
                        ) : filtered.length ? paged.map((u) => (
                            <TableRow key={u.id}>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                                            {initials(u.name)}
                                        </span>
                                        <div>
                                            <div className="font-semibold">{u.name}</div>
                                            <div className="text-muted-foreground text-xs font-mono">{u.code || "—"}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{statusBadge(u.status)}</TableCell>
                                <TableCell className="font-mono font-medium">{u.headcount ?? 0}</TableCell>
                                <TableCell>
                                    <div className="text-sm">{u.email || "—"}</div>
                                    <div className="text-xs text-muted-foreground">{u.phone || ""}</div>
                                </TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium">{u.type || "—"}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="outline" size="icon-xs" title="Detalhes" onClick={() => setDetailItem(u)}><Eye /></Button>
                                        <Button variant="outline" size="icon-xs" title="Editar" onClick={() => void openEdit(u)}><Pencil /></Button>
                                        <Button variant="destructive" size="icon-xs" title="Excluir" onClick={() => setDeleteTarget(u)}><Trash2 /></Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma unidade encontrada.</TableCell></TableRow>
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

            {/* Edit/Create Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar unidade" : "Nova unidade"}</DialogTitle>
                        <DialogDescription>Cadastre dados da unidade.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Código *</label><Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="Active">Ativo</option>
                                <option value="Inactive">Inativo</option>
                            </select>
                        </div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Headcount</label><Input type="number" value={draft.headcount} onChange={(e) => setDraft((d) => ({ ...d, headcount: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label><Input placeholder="Matriz, Filial..." value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label><Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label><Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Responsável</label><Input value={draft.responsibleName} onChange={(e) => setDraft((d) => ({ ...d, responsibleName: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Endereço</label><Input value={draft.addressLine} onChange={(e) => setDraft((d) => ({ ...d, addressLine: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Bairro</label><Input value={draft.neighborhood} onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label><Input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">UF</label><Input maxLength={2} value={draft.uf} onChange={(e) => setDraft((d) => ({ ...d, uf: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">CEP</label><Input value={draft.zipCode} onChange={(e) => setDraft((d) => ({ ...d, zipCode: e.target.value }))} /></div>
                        <div className="sm:col-span-3"><label className="mb-1 block text-xs font-medium text-muted-foreground">Observações</label><Input value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div>
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
                        <DialogTitle>Detalhes — {detailItem?.name}</DialogTitle>
                        <DialogDescription>Funcionários e vagas desta unidade.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Código:</span> {detailItem?.code || "—"}</div>
                        <div><span className="font-medium">Status:</span> {detailItem ? statusBadge(detailItem.status) : ""}</div>
                        <div><span className="font-medium">Headcount:</span> {detailItem?.headcount ?? 0}</div>
                        <div><span className="font-medium">Tipo:</span> {detailItem?.type || "—"}</div>
                        <div><span className="font-medium">Contato:</span> {detailItem?.email || "—"} / {detailItem?.phone || "—"}</div>
                        <div><span className="font-medium">Responsável:</span> {detailItem?.responsibleName || "—"}</div>
                        <div><span className="font-medium">Local:</span> {[detailItem?.city, detailItem?.uf].filter(Boolean).join(" - ") || "—"}</div>
                        <div><span className="font-medium">Endereço:</span> {detailItem?.addressLine || "—"}</div>
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
                        <DialogDescription>Excluir a unidade <strong>&quot;{deleteTarget?.name}&quot;</strong>?</DialogDescription>
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
