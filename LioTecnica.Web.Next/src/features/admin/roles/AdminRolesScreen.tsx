"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Pencil, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface RoleListItem {
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    userCount: number;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminRolesScreen() {
    const [roles, setRoles] = useState<RoleListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");

    // Create/Edit form
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [formDesc, setFormDesc] = useState("");
    const [saving, setSaving] = useState(false);

    const loadRoles = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchJson<RoleListItem[]>("/api/roles");
            setRoles(list);
        } catch (err) {
            console.error("Failed to load roles", err);
            toast.error("Falha ao carregar perfis.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadRoles(); }, [loadRoles]);

    const filtered = useMemo(() => {
        let list = roles;
        if (q.trim()) {
            const lower = q.toLowerCase();
            list = list.filter(r => r.name.toLowerCase().includes(lower) || (r.description ?? "").toLowerCase().includes(lower));
        }
        if (typeFilter === "system") list = list.filter(r => r.isSystem);
        if (typeFilter === "custom") list = list.filter(r => !r.isSystem);
        return list;
    }, [roles, q, typeFilter]);

    function startEdit(role: RoleListItem) {
        setEditId(role.id);
        setFormName(role.name);
        setFormDesc(role.description ?? "");
        setShowForm(true);
    }

    function startCreate() {
        setEditId(null);
        setFormName("");
        setFormDesc("");
        setShowForm(true);
    }

    async function handleSave() {
        if (!formName.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            if (editId) {
                await fetchJson(`/api/roles/${editId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
                });
                toast.success("Perfil atualizado!");
            } else {
                await fetchJson("/api/roles", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: formName.trim(), description: formDesc.trim() || null }),
                });
                toast.success("Perfil criado!");
            }
            setShowForm(false);
            void loadRoles();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar perfil.");
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Remover o perfil "${name}"?`)) return;
        try {
            await apiFetch(`/api/roles/${id}`, { method: "DELETE" });
            toast.success(`Perfil "${name}" removido.`);
            void loadRoles();
        } catch {
            toast.error("Falha ao remover perfil.");
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Perfis e Permissões</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os perfis de acesso e suas permissões.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void loadRoles()} disabled={loading}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={startCreate}>
                        <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo perfil</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{roles.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Sistema</div>
                    <div className="mt-1 text-2xl font-bold text-sky-600">{roles.filter(r => r.isSystem).length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Customizados</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{roles.filter(r => !r.isSystem).length}</div>
                </div>
            </div>

            {showForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">{editId ? "Editar perfil" : "Criar novo perfil"}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input placeholder="Nome do perfil" value={formName} onChange={(e) => setFormName(e.target.value)} />
                        <Input placeholder="Descrição (opcional)" value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
                        <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
                    </div>
                </div>
            )}

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div className="font-semibold">Lista de perfis</div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[200px] pl-8" placeholder="buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="system">Sistema</option>
                            <option value="custom">Customizado</option>
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Perfil</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="text-right">Usuários</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum perfil encontrado.</TableCell></TableRow>
                        ) : (
                            filtered.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell className="font-medium flex items-center gap-2"><Shield className="size-4 text-primary" /> {r.name}</TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{r.description || "—"}</TableCell>
                                    <TableCell>
                                        {r.isSystem
                                            ? <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs font-medium">Sistema</span>
                                            : <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Custom</span>
                                        }
                                    </TableCell>
                                    <TableCell className="text-right">{r.userCount ?? 0}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => startEdit(r)} title="Editar">
                                                <Pencil className="size-4" />
                                            </Button>
                                            {!r.isSystem && (
                                                <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDelete(r.id, r.name)} title="Remover">
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
