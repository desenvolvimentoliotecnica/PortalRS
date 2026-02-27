"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Eye } from "lucide-react";
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



/* ---------- types ---------- */
interface UnidadeItem {
    id: string;
    codigo?: string;
    nome: string;
    status?: string;
    headcount?: number;
    email?: string;
    telefone?: string;
    tipo?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    endereco?: string;
    bairro?: string;
    cnpj?: string;
    razaoSocial?: string;
    inscricaoEstadual?: string;
}

interface UnidadeDraft {
    id?: string;
    code: string;
    name: string;
    status: string;
    headcount: string;
    email: string;
    phone: string;
    tipo: string;
    city: string;
    state: string;
    zip: string;
    address: string;
    neighborhood: string;
    cnpj: string;
    companyName: string;
    stateRegistration: string;
}

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

function initials(name: string): string {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
}

const emptyDraft: UnidadeDraft = {
    code: "", name: "", status: "ativo", headcount: "0",
    email: "", phone: "", tipo: "", city: "", state: "", zip: "",
    address: "", neighborhood: "", cnpj: "", companyName: "", stateRegistration: "",
};

/* ---------- component ---------- */
export default function UnidadesScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<UnidadeItem[]>([]);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<UnidadeDraft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UnidadeItem | null>(null);
    const [detailItem, setDetailItem] = useState<UnidadeItem | null>(null);

    const syncList = useCallback(async () => {
        const payload = await fetchJson<{ items: UnidadeItem[] }>(`/api/units`);
        setRows(Array.isArray(payload?.items) ? payload.items : []);
    }, []);

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch((e) => { console.error("Unidades – load error", e); toast.error(`Falha ao carregar unidades: ${e instanceof Error ? e.message : "erro"}`); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [syncList]);

    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        return rows.filter((u) => {
            const st = (u.status ?? "").toLowerCase();
            if (statusFilter === "ativo" && st !== "ativo" && st !== "active") return false;
            if (statusFilter === "inativo" && st !== "inativo" && st !== "inactive") return false;
            if (!qq) return true;
            return [u.nome, u.codigo, u.cidade, u.email, u.tipo].filter(Boolean).join(" ").toLowerCase().includes(qq);
        });
    }, [q, rows, statusFilter]);

    /* pagination (client-side) */
    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(filtered.length, {
        initialPageSize: 20,
        resetDeps: [q, statusFilter],
    });
    const paged = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.end, slice.start]);

    /* KPIs — Razor: Unidades, Ativas, Headcount, Vagas abertas */
    const kpis = useMemo(() => {
        const total = rows.length;
        const active = rows.filter((u) => ["ativo", "active"].includes((u.status ?? "").toLowerCase())).length;
        const headcount = rows.reduce((s, u) => s + (u.headcount ?? 0), 0);
        return { total, active, headcount };
    }, [rows]);

    /* CRUD */
    function openNew() { setDraft({ ...emptyDraft }); setEditOpen(true); }

    async function openEdit(item: UnidadeItem) {
        try {
            const d = await fetchJson<Record<string, unknown>>(`/api/units/${item.id}`);
            setDraft({
                id: item.id,
                code: String(d?.code ?? d?.Code ?? d?.codigo ?? item.codigo ?? ""),
                name: String(d?.name ?? d?.Name ?? d?.nome ?? item.nome ?? ""),
                status: String(d?.status ?? d?.Status ?? item.status ?? "ativo"),
                headcount: String(d?.headcount ?? d?.Headcount ?? item.headcount ?? "0"),
                email: String(d?.email ?? d?.Email ?? item.email ?? ""),
                phone: String(d?.telefone ?? d?.Telefone ?? d?.phone ?? item.telefone ?? ""),
                tipo: String(d?.tipo ?? d?.Tipo ?? item.tipo ?? ""),
                city: String(d?.cidade ?? d?.Cidade ?? d?.city ?? item.cidade ?? ""),
                state: String(d?.uf ?? d?.UF ?? d?.state ?? item.uf ?? ""),
                zip: String(d?.cep ?? d?.CEP ?? d?.zip ?? item.cep ?? ""),
                address: String(d?.endereco ?? d?.Endereco ?? d?.address ?? item.endereco ?? ""),
                neighborhood: String(d?.bairro ?? d?.Bairro ?? item.bairro ?? ""),
                cnpj: String(d?.cnpj ?? d?.CNPJ ?? item.cnpj ?? ""),
                companyName: String(d?.razaoSocial ?? d?.RazaoSocial ?? item.razaoSocial ?? ""),
                stateRegistration: String(d?.inscricaoEstadual ?? d?.InscricaoEstadual ?? item.inscricaoEstadual ?? ""),
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
            status: draft.status.toLowerCase() === "inativo" ? "Inactive" : "Active",
            headcount: parseInt(draft.headcount, 10) || 0,
            email: draft.email.trim() || null,
            telefone: draft.phone.trim() || null,
            tipo: draft.tipo.trim() || null,
            cidade: draft.city.trim() || null,
            uf: draft.state.trim() || null,
            cep: draft.zip.trim() || null,
            endereco: draft.address.trim() || null,
            bairro: draft.neighborhood.trim() || null,
            cnpj: draft.cnpj.trim() || null,
            razaoSocial: draft.companyName.trim() || null,
            inscricaoEstadual: draft.stateRegistration.trim() || null,
        };
        try {
            if (draft.id) {
                await fetchJson(`/api/units/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Unidade atualizada.");
            } else {
                await fetchJson(`/api/units`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Unidade criada.");
            }
            setEditOpen(false);
            await syncList();
        } catch { toast.error("Falha ao salvar."); }
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
            {/* Header — Razor: title + Exportar + Atualizar + Nova unidade */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-lg font-bold">Unidades e filiais</h4>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setLoading(true); syncList().catch(() => toast.error("Falha.")).finally(() => setLoading(false)); }}>
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
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="ativo">Ativo</option>
                            <option value="inativo">Inativo</option>
                        </select>
                    </div>
                </div>

                {/* Razor columns: Unidade (initials+name+code), Status, Headcount, Contato, Tipo, Ações */}
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
                                            {initials(u.nome)}
                                        </span>
                                        <div>
                                            <div className="font-semibold">{u.nome}</div>
                                            <div className="text-muted-foreground text-xs font-mono">{u.codigo || "—"}</div>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell>{statusBadge(u.status)}</TableCell>
                                <TableCell className="font-mono font-medium">{u.headcount ?? 0}</TableCell>
                                <TableCell>
                                    <div className="text-sm">{u.email || "—"}</div>
                                    <div className="text-xs text-muted-foreground">{u.telefone || ""}</div>
                                </TableCell>
                                <TableCell>
                                    <span className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs font-medium">{u.tipo || "—"}</span>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon-xs" title="Detalhes" onClick={() => setDetailItem(u)}><Eye /></Button>
                                        <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => void openEdit(u)}><Pencil /></Button>
                                        <Button variant="ghost" size="icon-xs" className="text-destructive" title="Excluir" onClick={() => setDeleteTarget(u)}><Trash2 /></Button>
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

            {/* Edit/Create Dialog — all 15 fields from Razor */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{draft.id ? "Editar unidade" : "Nova unidade"}</DialogTitle>
                        <DialogDescription>Cadastre dados da unidade.</DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Código</label><Input value={draft.code} onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Nome *</label><Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} /></div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">Status</label>
                            <select className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={draft.status} onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}>
                                <option value="ativo">Ativo</option>
                                <option value="inativo">Inativo</option>
                            </select>
                        </div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Headcount</label><Input type="number" value={draft.headcount} onChange={(e) => setDraft((d) => ({ ...d, headcount: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label><Input placeholder="Matriz, Filial..." value={draft.tipo} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Email</label><Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Telefone</label><Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">CNPJ</label><Input value={draft.cnpj} onChange={(e) => setDraft((d) => ({ ...d, cnpj: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Razão Social</label><Input value={draft.companyName} onChange={(e) => setDraft((d) => ({ ...d, companyName: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Inscrição Estadual</label><Input value={draft.stateRegistration} onChange={(e) => setDraft((d) => ({ ...d, stateRegistration: e.target.value }))} /></div>
                        <div className="sm:col-span-2"><label className="mb-1 block text-xs font-medium text-muted-foreground">Endereço</label><Input value={draft.address} onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Bairro</label><Input value={draft.neighborhood} onChange={(e) => setDraft((d) => ({ ...d, neighborhood: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">Cidade</label><Input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">UF</label><Input value={draft.state} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))} /></div>
                        <div><label className="mb-1 block text-xs font-medium text-muted-foreground">CEP</label><Input value={draft.zip} onChange={(e) => setDraft((d) => ({ ...d, zip: e.target.value }))} /></div>
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
                        <DialogDescription>Funcionários e vagas desta unidade.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 text-sm">
                        <div><span className="font-medium">Código:</span> {detailItem?.codigo || "—"}</div>
                        <div><span className="font-medium">Status:</span> {detailItem ? statusBadge(detailItem.status) : ""}</div>
                        <div><span className="font-medium">Headcount:</span> {detailItem?.headcount ?? 0}</div>
                        <div><span className="font-medium">Tipo:</span> {detailItem?.tipo || "—"}</div>
                        <div><span className="font-medium">Contato:</span> {detailItem?.email || "—"} / {detailItem?.telefone || "—"}</div>
                        <div><span className="font-medium">Local:</span> {[detailItem?.cidade, detailItem?.uf].filter(Boolean).join(" - ") || "—"}</div>
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
                        <DialogDescription>Excluir a unidade <strong>&quot;{deleteTarget?.nome}&quot;</strong>?</DialogDescription>
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
