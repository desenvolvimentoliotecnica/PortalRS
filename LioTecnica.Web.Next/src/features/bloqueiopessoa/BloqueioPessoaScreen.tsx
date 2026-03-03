"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Trash2, Ban, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

interface BlockedPerson {
    id: string;
    nome: string | null;
    email: string | null;
    motivo: string | null;
    origem: string | null;
    bloqueadoEm: string | null;
}

interface BlockedListResponse { items: BlockedPerson[]; totalCount: number; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

export default function BloqueioPessoaScreen() {
    const [items, setItems] = useState<BlockedPerson[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newNome, setNewNome] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newMotivo, setNewMotivo] = useState("");
    const [creating, setCreating] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
            if (q.trim()) params.set("q", q.trim());
            const resp = await fetchJson<BlockedListResponse>(`/api/bloqueio-pessoa?${params}`);
            setItems(resp.items ?? []);
            setTotal(resp.totalCount ?? 0);
        } catch { toast.error("Falha ao carregar lista de bloqueio."); }
        finally { setLoading(false); }
    }, [page, q]);

    useEffect(() => { void load(); }, [load]);

    async function handleCreate() {
        if (!newNome.trim() || !newEmail.trim()) { toast.error("Nome e email são obrigatórios."); return; }
        setCreating(true);
        try {
            await fetchJson("/api/bloqueio-pessoa", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: newNome.trim(), email: newEmail.trim(), motivo: newMotivo.trim() || null }),
            });
            toast.success("Pessoa bloqueada!");
            setNewNome(""); setNewEmail(""); setNewMotivo(""); setShowCreate(false);
            void load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao bloquear."); }
        finally { setCreating(false); }
    }

    async function handleUnblock(id: string, nome: string) {
        if (!(await confirmDialog({ title: "Desbloquear pessoa", description: `Desbloquear "${nome}"?`, confirmText: "Desbloquear" }))) return;
        try {
            await apiFetch(`/api/bloqueio-pessoa/${id}`, { method: "DELETE" });
            toast.success(`"${nome}" desbloqueado.`);
            void load();
        } catch { toast.error("Falha ao desbloquear."); }
    }

    const totalPages = Math.ceil(total / pageSize);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Bloqueio de Pessoas</h4>
                    <div className="text-muted-foreground text-sm">Gerencie a lista de pessoas bloqueadas no sistema.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
                    <Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="size-4 mr-1" />Bloquear pessoa</Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total Bloqueados</div>
                    <div className="mt-1 text-2xl font-bold text-red-600">{total}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Exibindo</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{items.length}</div>
                </div>
            </div>

            {showCreate && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">Bloquear pessoa manualmente</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input placeholder="Nome *" value={newNome} onChange={e => setNewNome(e.target.value)} />
                        <Input placeholder="Email *" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                        <Input placeholder="Motivo (opcional)" value={newMotivo} onChange={e => setNewMotivo(e.target.value)} />
                    </div>
                    <Button onClick={() => void handleCreate()} disabled={creating}>{creating ? "Bloqueando..." : "Bloquear"}</Button>
                </div>
            )}

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Lista de Bloqueio</div>
                    <div className="relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-[240px] pl-8" placeholder="nome, email..." value={q} onChange={e => { setQ(e.target.value); setPage(1); }} /></div>
                </div>
                <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Motivo</TableHead><TableHead>Origem</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : items.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma pessoa bloqueada.</TableCell></TableRow>
                                : items.map(p => (
                                    <TableRow key={p.id}>
                                        <TableCell className="font-medium"><div className="flex items-center gap-2"><UserX className="size-4 text-red-500" />{p.nome || "—"}</div></TableCell>
                                        <TableCell className="text-sm">{p.email || "—"}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.motivo || "—"}</TableCell>
                                        <TableCell><span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">{p.origem || "Manual"}</span></TableCell>
                                        <TableCell className="text-xs whitespace-nowrap">{p.bloqueadoEm ? new Date(p.bloqueadoEm).toLocaleDateString("pt-BR") : "—"}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="text-emerald-600" onClick={() => void handleUnblock(p.id, p.nome || "pessoa")} title="Desbloquear">
                                                <Ban className="size-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
                {totalPages > 1 && <div className="mt-3 flex items-center justify-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button><span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span><Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button></div>}
            </div>
        </section>
    );
}
