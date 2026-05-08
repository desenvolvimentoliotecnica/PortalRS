"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Pencil, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";
import AdminUserFormModal from "./AdminUserFormModal";

/* ── Types ── */
interface UserListItem {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    roles: string[];
    createdAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null as T;
    return res.json();
}

export default function AdminUsersScreen() {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");

    const [modalOpen, setModalOpen] = useState(false);
    const [modalEditId, setModalEditId] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [u, r] = await Promise.all([
                fetchJson<UserListItem[]>("/api/users"),
                fetchJson<{ id: string; name: string }[]>("/api/roles"),
            ]);
            setUsers(u);
            setRoles(r);
        } catch (err) {
            console.error("Failed to load users", err);
            toast.error("Falha ao carregar usuários.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadData(); }, [loadData]);

    const filtered = useMemo(() => {
        let list = users;
        if (q.trim()) {
            const lower = q.toLowerCase();
            list = list.filter(u => u.fullName.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower));
        }
        if (statusFilter === "active") list = list.filter(u => u.isActive);
        if (statusFilter === "inactive") list = list.filter(u => !u.isActive);
        if (roleFilter !== "all") list = list.filter(u => u.roles?.some(r => r.toLowerCase() === roleFilter.toLowerCase()));
        return list;
    }, [users, q, statusFilter, roleFilter]);

    const kpis = useMemo(() => [
        { label: "Usuários", value: users.length, color: "text-primary" },
        { label: "Ativos", value: users.filter(u => u.isActive).length, color: "text-emerald-600" },
        { label: "Inativos", value: users.filter(u => !u.isActive).length, color: "text-zinc-500" },
        { label: "Perfis", value: roles.length, color: "text-primary" },
    ], [users, roles]);

    async function handleToggleStatus(userId: string, activate: boolean) {
        try {
            await fetchJson(`/api/users/${userId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: activate }),
            });
            toast.success(activate ? "Usuário ativado." : "Usuário desativado.");
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao alterar status.");
        }
    }

    async function handleDelete(userId: string, name: string) {
        if (!(await confirmDialog({ title: "Remover usuário", description: `Remover o usuário "${name}"? Esta ação não pode ser desfeita.`, confirmText: "Remover", destructive: true }))) return;
        try {
            const res = await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
            if (!res.ok) {
                let detail = `HTTP ${res.status}`;
                try {
                    const ct = res.headers.get("content-type") ?? "";
                    if (ct.includes("application/json")) {
                        const body = await res.json() as { detail?: string; title?: string };
                        if (typeof body?.detail === "string" && body.detail.trim()) detail = body.detail;
                        else if (typeof body?.title === "string" && body.title.trim()) detail = body.title;
                    }
                } catch {
                    /* ignore parse errors */
                }
                throw new Error(detail);
            }
            // API retorna 204 No Content em sucesso — não chamar res.json().
            toast.success(`Usuário "${name}" removido.`);
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao remover usuário.");
        }
    }

    const uniqueRoleNames = [...new Set(users.flatMap(u => u.roles ?? []))].sort();

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Usuários</h4>
                    <div className="text-muted-foreground text-sm">Gerencie os usuários do sistema.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={() => { setModalEditId(null); setModalOpen(true); }}>
                        <Plus className="size-4" /><span className="hidden sm:inline ml-1">Novo usuário</span>
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map((k) => (
                    <div key={k.label} className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{k.label}</div>
                        <div className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</div>
                    </div>
                ))}
            </div>

            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <div className="font-semibold">Lista de usuários</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="nome, email..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                            <option value="all">Todos perfis</option>
                            {uniqueRoleNames.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuário</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Perfis</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((u) => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.fullName}</TableCell>
                                    <TableCell className="text-sm">{u.email}</TableCell>
                                    <TableCell>
                                        {u.roles?.length ? (
                                            <div className="flex flex-wrap gap-1">
                                                {u.roles.map(r => (
                                                    <span key={r} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r}</span>
                                                ))}
                                            </div>
                                        ) : <span className="text-muted-foreground text-xs">—</span>}
                                    </TableCell>
                                    <TableCell>
                                        {u.isActive ? (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium"><ShieldCheck className="size-3" /> Ativo</span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium"><ShieldOff className="size-3" /> Inativo</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setModalEditId(u.id); setModalOpen(true); }}
                                                title="Editar"
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => void handleToggleStatus(u.id, !u.isActive)} title={u.isActive ? "Desativar" : "Ativar"}>
                                                {u.isActive ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                                            </Button>
                                            <Button variant="destructive" size="sm" onClick={() => void handleDelete(u.id, u.fullName)}>
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <AdminUserFormModal
                open={modalOpen}
                editId={modalEditId}
                onClose={() => setModalOpen(false)}
                onSaved={() => { setModalOpen(false); void loadData(); }}
            />
        </section>
    );
}
