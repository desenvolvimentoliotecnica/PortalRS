"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Plus, RefreshCw, Pencil, Trash2, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableHead, TableBody, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import PaginationBar from "@/components/pagination/PaginationBar";
import { useClientPagination } from "@/hooks/useClientPagination";

interface Item {
    id: string;
    code: string;
    description: string;
    manager?: string;
    notes?: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
}

interface Draft {
    id?: string;
    code: string;
    description: string;
    manager: string;
    notes: string;
    isActive: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers || {}) }, cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

const emptyDraft: Draft = { code: "", description: "", manager: "", notes: "", isActive: true };

export default function CentroCustoCadastroScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<Item[]>([]);
    const [search, setSearch] = useState("");
    const [editOpen, setEditOpen] = useState(false);
    const [draft, setDraft] = useState<Draft>({ ...emptyDraft });
    const [saving, setSaving] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);

    const { page, setPage, pageSize, setPageSize, slice } = useClientPagination(rows.length, {
        initialPageSize: 20,
        resetDeps: [search],
    });

    const syncList = useCallback(async () => {
        try {
            setLoading(true);
            const items = await fetchJson<Item[]>("/api/centros-custo");
            setRows(Array.isArray(items) ? items : []);
        } catch (err) {
            toast.error("Erro ao carregar centros de custo");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { syncList(); }, [syncList]);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((x) => x.code.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
    }, [search, rows]);

    const paginated = useMemo(() => filtered.slice(slice.start, slice.end), [filtered, slice.start, slice.end]);

    const save = async () => {
        if (!draft.code.trim() || !draft.description.trim()) {
            toast.error("Código e descrição são obrigatórios");
            return;
        }

        try {
            setSaving(true);
            const payload = { code: draft.code.trim(), description: draft.description.trim(), manager: draft.manager?.trim() || null, notes: draft.notes?.trim() || null, isActive: draft.isActive };

            if (draft.id) {
                await fetchJson(`/api/centros-custo/${draft.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Centro de Custo atualizado com sucesso");
            } else {
                await fetchJson("/api/centros-custo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
                toast.success("Centro de Custo criado com sucesso");
            }

            setEditOpen(false);
            await syncList();
        } catch (err) {
            toast.error("Erro ao salvar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 p-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Centros de Custo (TOTVS)</h1>
                <p className="text-muted-foreground mt-2">Gerencie os centros de custo para integração com TOTVS</p>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="pl-9" />
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={syncList} disabled={loading}><RefreshCw className="h-4 w-4 mr-2" />Atualizar</Button>
                    <Button size="sm" onClick={() => { setDraft({ ...emptyDraft }); setEditOpen(true); }}><Plus className="h-4 w-4 mr-2" />Novo</Button>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Responsável</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={4} className="h-32 text-center">Carregando...</TableCell></TableRow>
                        ) : paginated.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="h-32 text-center">Nenhum centro encontrado</TableCell></TableRow>
                        ) : (
                            paginated.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.code}</TableCell>
                                    <TableCell>{item.description}</TableCell>
                                    <TableCell>{item.manager || "-"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => { setDraft({ ...item, manager: item.manager || "", notes: item.notes || "" }); setEditOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {filtered.length > 0 && <PaginationBar page={page} pageSize={pageSize} totalItems={filtered.length} onPageChange={setPage} onPageSizeChange={setPageSize} />}

            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{draft.id ? "Editar" : "Novo"} Centro de Custo</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div>
                            <label className="text-sm font-medium">Código *</label>
                            <Input placeholder="CC001" value={draft.code} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, code: e.target.value })} maxLength={30} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Descrição *</label>
                            <Input placeholder="Descrição" value={draft.description} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, description: e.target.value })} maxLength={120} />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Responsável</label>
                            <Input placeholder="Nome" value={draft.manager} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, manager: e.target.value })} maxLength={120} />
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="isActive" checked={draft.isActive} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraft({ ...draft, isActive: e.target.checked })} />
                            <label htmlFor="isActive" className="text-sm font-medium cursor-pointer">Ativo</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancelar</Button>
                        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirmar Exclusão</DialogTitle>
                        <DialogDescription>Tem certeza? Esta ação não pode ser desfeita.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={async () => { if (!deleteTarget) return; try { await fetchJson(`/api/centros-custo/${deleteTarget.id}`, { method: "DELETE" }); toast.success("Removido com sucesso"); setDeleteTarget(null); await syncList(); } catch { toast.error("Erro ao remover"); } }}>Remover</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
