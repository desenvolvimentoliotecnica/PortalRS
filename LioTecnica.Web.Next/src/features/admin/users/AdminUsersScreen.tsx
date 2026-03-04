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
    return res.json();
}

export default function AdminUsersScreen() {
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [units, setUnits] = useState<{ id: string; name: string; code: string }[]>([]);
    const [funcionarios, setFuncionarios] = useState<{ id: string; name: string; email: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");

    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRoleIds, setNewRoleIds] = useState<string[]>([]);
    const [newIsActive, setNewIsActive] = useState(true);
    const [newFuncionarioId, setNewFuncionarioId] = useState<string | null>(null);
    const [newUnitIds, setNewUnitIds] = useState<string[]>([]);
    const [creating, setCreating] = useState(false);

    // Edit form
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editEmail, setEditEmail] = useState("");
    const [editRoles, setEditRoles] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [u, r, unitsRes, funcRes] = await Promise.all([
                fetchJson<UserListItem[]>("/api/users"),
                fetchJson<{ id: string; name: string }[]>("/api/roles"),
                fetchJson<{ items: { id: string; name: string; code: string }[] }>("/api/units?page=1&pageSize=500").catch(() => ({ items: [] })),
                fetchJson<{ items: { id: string; name: string; email: string }[] }>("/api/funcionarios?page=1&pageSize=500").catch(() => ({ items: [] })),
            ]);
            setUsers(u);
            setRoles(r);
            setUnits(unitsRes?.items ?? []);
            setFuncionarios(funcRes?.items ?? []);
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

    async function handleCreate() {
        if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
            toast.error("Preencha nome, email e senha.");
            return;
        }
        if (newPassword.length < 8) {
            toast.error("A senha deve ter no mínimo 8 caracteres.");
            return;
        }
        setCreating(true);
        try {
            await fetchJson("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: newName.trim(),
                    email: newEmail.trim(),
                    password: newPassword,
                    isActive: newIsActive,
                    roleIds: newRoleIds,
                    unitIds: newUnitIds.length > 0 ? newUnitIds : null,
                    funcionarioId: newFuncionarioId || null,
                }),
            });
            toast.success("Usuário criado com sucesso!");
            setNewName(""); setNewEmail(""); setNewPassword(""); setNewRoleIds([]);
            setNewIsActive(true); setNewFuncionarioId(null); setNewUnitIds([]);
            setShowCreate(false);
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao criar usuário.");
        } finally {
            setCreating(false);
        }
    }

    function toggleNewRole(roleId: string) {
        setNewRoleIds((prev) =>
            prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
        );
    }

    function toggleNewUnit(unitId: string) {
        setNewUnitIds((prev) =>
            prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId],
        );
    }

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
            await apiFetch(`/api/users/${userId}`, { method: "DELETE" });
            toast.success(`Usuário "${name}" removido.`);
            void loadData();
        } catch {
            toast.error("Falha ao remover usuário.");
        }
    }

    function startEdit(u: UserListItem) {
        setEditId(u.id);
        setEditName(u.fullName);
        setEditEmail(u.email);
        setEditRoles([...(u.roles ?? [])]);
        setShowCreate(false);
    }

    function cancelEdit() {
        setEditId(null);
    }

    function toggleEditRole(role: string) {
        setEditRoles(prev =>
            prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role],
        );
    }

    async function handleSaveEdit() {
        if (!editId || !editName.trim() || !editEmail.trim()) {
            toast.error("Nome e email são obrigatórios.");
            return;
        }
        setSaving(true);
        try {
            await fetchJson(`/api/users/${editId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    fullName: editName.trim(),
                    email: editEmail.trim(),
                    roles: editRoles,
                }),
            });
            toast.success("Usuário atualizado!");
            setEditId(null);
            void loadData();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally {
            setSaving(false);
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
                    <Button variant="ghost" size="sm" onClick={() => void loadData()} disabled={loading}>
                        <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                    </Button>
                    <Button size="sm" onClick={() => setShowCreate(!showCreate)}>
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

            {showCreate && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">Criar novo usuário</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
                        <Input placeholder="Email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                        <Input placeholder="Senha (mín. 8 caracteres)" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    </div>
                    <div>
                        <div className="text-sm font-medium mb-1">Status</div>
                        <select
                            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm w-full max-w-[200px]"
                            value={newIsActive ? "true" : "false"}
                            onChange={(e) => setNewIsActive(e.target.value === "true")}
                        >
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                        </select>
                    </div>
                    {roles.length > 0 && (
                        <div>
                            <div className="text-sm font-medium mb-1">Perfis</div>
                            <div className="flex flex-wrap gap-2">
                                {roles.map((r) => (
                                    <label key={r.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newRoleIds.includes(r.id)}
                                            onChange={() => toggleNewRole(r.id)}
                                            className="rounded"
                                        />
                                        {r.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    {funcionarios.length > 0 && (
                        <div>
                            <div className="text-sm font-medium mb-1">Funcionário (opcional)</div>
                            <select
                                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm w-full max-w-md"
                                value={newFuncionarioId ?? ""}
                                onChange={(e) => setNewFuncionarioId(e.target.value || null)}
                            >
                                <option value="">— Nenhum —</option>
                                {funcionarios.map((f) => (
                                    <option key={f.id} value={f.id}>{f.name} — {f.email || ""}</option>
                                ))}
                            </select>
                            <p className="text-muted-foreground text-xs mt-1">Vincule o usuário a um funcionário existente (ex.: para perfil Gestor).</p>
                        </div>
                    )}
                    {units.length > 0 && (
                        <div>
                            <div className="text-sm font-medium mb-1">Unidades de acesso</div>
                            <p className="text-muted-foreground text-xs mb-2">Unidades às quais o usuário tem acesso. Marque as que deseja liberar.</p>
                            <div className="flex flex-wrap gap-3">
                                {units.map((unit) => (
                                    <label key={unit.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={newUnitIds.includes(unit.id)}
                                            onChange={() => toggleNewUnit(unit.id)}
                                            className="rounded"
                                        />
                                        {unit.name} {unit.code ? `(${unit.code})` : ""}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                    <Button onClick={() => void handleCreate()} disabled={creating}>
                        {creating ? "Criando..." : "Criar"}
                    </Button>
                </div>
            )}

            {editId && (
                <div className="card-soft rounded-xl border border-primary/30 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold flex items-center gap-2">
                        <Pencil className="size-4" /> Editar usuário
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <Input placeholder="Nome completo" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        <Input placeholder="Email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
                    </div>
                    <div>
                        <div className="text-sm font-medium mb-1">Perfis</div>
                        <div className="flex flex-wrap gap-2">
                            {roles.map((r) => (
                                <label key={r.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={editRoles.includes(r.name)}
                                        onChange={() => toggleEditRole(r.name)}
                                        className="rounded"
                                    />
                                    {r.name}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => void handleSaveEdit()} disabled={saving}>
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                        <Button variant="outline" onClick={cancelEdit}>Cancelar</Button>
                    </div>
                </div>
            )}

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
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="active">Ativo</option>
                            <option value="inactive">Inativo</option>
                        </select>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
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
                                            <Button variant="ghost" size="sm" onClick={() => startEdit(u)} title="Editar">
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => void handleToggleStatus(u.id, !u.isActive)} title={u.isActive ? "Desativar" : "Ativar"}>
                                                {u.isActive ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDelete(u.id, u.fullName)}>
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
        </section>
    );
}
