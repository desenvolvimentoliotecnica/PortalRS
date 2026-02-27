"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, Key, Loader2, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

const BASE = "/app";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).error || `HTTP ${res.status}`);
    }
    return res.status === 204 ? (null as T) : res.json();
}

interface UserListItem {
    id: string;
    fullName: string;
    email: string;
    isActive: boolean;
    roles: string[];
}

interface RoleItem { id: string; name: string; }
interface UnitItem { id: string; code: string; name: string; }
interface FuncItem { id: string; name: string; email: string | null; }

interface UserForm {
    email: string;
    fullName: string;
    password: string;
    isActive: boolean;
    roleIds: string[];
    unitIds: string[];
    funcionarioId: string | null;
}

const emptyForm = (): UserForm => ({
    email: "", fullName: "", password: "", isActive: true, roleIds: [], unitIds: [], funcionarioId: null,
});

export default function TabUsuarios({ tenantId }: { tenantId: string }) {
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Users/_api`;

    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [units, setUnits] = useState<UnitItem[]>([]);
    const [funcionarios, setFuncionarios] = useState<FuncItem[]>([]);
    const [search, setSearch] = useState("");

    // Dialogs
    const [editOpen, setEditOpen] = useState(false);
    const [editUser, setEditUser] = useState<UserListItem | null>(null); // null = new
    const [form, setForm] = useState<UserForm>(emptyForm());
    const [saving, setSaving] = useState(false);

    const [pwOpen, setPwOpen] = useState(false);
    const [pwUserId, setPwUserId] = useState<string | null>(null);
    const [pwValue, setPwValue] = useState("");
    const [pwConfirm, setPwConfirm] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [u, r, un, f] = await Promise.all([
                fetchJson<UserListItem[]>(`${apiBase}/list`),
                fetchJson<RoleItem[]>(`${apiBase}/roles`),
                fetchJson<UnitItem[]>(`${apiBase}/units`),
                fetchJson<FuncItem[]>(`${apiBase}/funcionarios`),
            ]);
            setUsers(u || []);
            setRoles(r || []);
            setUnits(un || []);
            setFuncionarios(f || []);
        } catch { toast.error("Erro ao carregar usuários."); }
        finally { setLoading(false); }
    }, [apiBase]);

    useEffect(() => { load(); }, [load]);

    const openNew = () => {
        setEditUser(null);
        setForm(emptyForm());
        setEditOpen(true);
    };

    const openEdit = async (user: UserListItem) => {
        try {
            const detail = await fetchJson<{
                id: string; email: string; fullName: string; isActive: boolean;
                roles: { id: string; name: string }[];
                units: { id: string }[] | null;
                funcionario: { id: string } | null;
            }>(`${apiBase}/get/${user.id}`);
            setEditUser(user);
            setForm({
                email: detail.email,
                fullName: detail.fullName,
                password: "",
                isActive: detail.isActive,
                roleIds: detail.roles?.map((r) => r.id) || [],
                unitIds: detail.units?.map((u) => u.id) || [],
                funcionarioId: detail.funcionario?.id || null,
            });
            setEditOpen(true);
        } catch { toast.error("Erro ao carregar detalhes."); }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (editUser) {
                await fetchJson(`${apiBase}/update/${editUser.id}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                toast.success("Usuário atualizado.");
            } else {
                await fetchJson(`${apiBase}/create`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                });
                toast.success("Usuário criado.");
            }
            setEditOpen(false);
            await load();
        } catch (e) { toast.error((e as Error).message || "Falha ao salvar."); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Remover este usuário?")) return;
        try {
            await fetchJson(`${apiBase}/delete/${id}`, { method: "POST" });
            toast.success("Usuário removido.");
            await load();
        } catch { toast.error("Falha ao remover."); }
    };

    const handlePassword = async () => {
        if (pwValue !== pwConfirm) { toast.error("As senhas não coincidem."); return; }
        if (pwValue.length < 8) { toast.error("Mínimo 8 caracteres."); return; }
        try {
            await fetchJson(`${apiBase}/password/${pwUserId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ newPassword: pwValue }),
            });
            toast.success("Senha alterada.");
            setPwOpen(false);
        } catch (e) { toast.error((e as Error).message || "Falha."); }
    };

    const toggleRole = (roleId: string) => {
        setForm((f) => ({
            ...f,
            roleIds: f.roleIds.includes(roleId) ? f.roleIds.filter((x) => x !== roleId) : [...f.roleIds, roleId],
        }));
    };

    const toggleUnit = (unitId: string) => {
        setForm((f) => ({
            ...f,
            unitIds: f.unitIds.includes(unitId) ? f.unitIds.filter((x) => x !== unitId) : [...f.unitIds, unitId],
        }));
    };

    const filtered = users.filter((u) =>
        !search || u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nome ou email…" className="pl-9" />
                </div>
                <Button onClick={openNew} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                    <UserPlus className="size-4 mr-1.5" />Novo usuário
                </Button>
            </div>

            <Card className="shadow-lt">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b text-xs text-muted-foreground">
                            <th className="text-left py-2 px-3">Nome</th>
                            <th className="text-left py-2 px-3">Email</th>
                            <th className="text-left py-2 px-3">Perfis</th>
                            <th className="text-center py-2 px-3">Status</th>
                            <th className="py-2 px-3"></th>
                        </tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                                    Nenhum usuário.{" "}
                                    <button className="text-[rgb(var(--lt-brand))] underline" onClick={openNew}>Criar um</button>
                                </td></tr>
                            ) : filtered.map((u) => (
                                <tr key={u.id} className="border-b hover:bg-muted/50 transition">
                                    <td className="py-2 px-3 font-medium">{u.fullName}</td>
                                    <td className="py-2 px-3 text-xs text-muted-foreground">{u.email}</td>
                                    <td className="py-2 px-3 text-xs">{u.roles?.length ? u.roles.join(", ") : "—"}</td>
                                    <td className="py-2 px-3 text-center">
                                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${u.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                                            {u.isActive ? "Ativo" : "Inativo"}
                                        </span>
                                    </td>
                                    <td className="py-2 px-3">
                                        <div className="flex gap-1 justify-end">
                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openEdit(u)}><Edit className="size-3.5 mr-1" />Editar</Button>
                                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setPwUserId(u.id); setPwValue(""); setPwConfirm(""); setPwOpen(true); }}>
                                                <Key className="size-3.5 mr-1" />Senha
                                            </Button>
                                            <Button variant="outline" size="sm" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => handleDelete(u.id)}>
                                                <Trash2 className="size-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {/* Create / Edit Dialog */}
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-base">{editUser ? `Editar: ${editUser.fullName}` : "Novo usuário"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Email *</label>
                                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} type="email" />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Nome completo *</label>
                                <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
                            </div>
                        </div>
                        {!editUser && (
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Senha *</label>
                                <Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <input type="checkbox" id="userActive" className="rounded" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                            <label htmlFor="userActive" className="text-sm font-medium">Ativo</label>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Perfis</label>
                            <div className="border rounded-lg p-2 max-h-[150px] overflow-y-auto space-y-1">
                                {roles.map((r) => (
                                    <label key={r.id} className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-1.5 py-1 cursor-pointer">
                                        <input type="checkbox" className="rounded" checked={form.roleIds.includes(r.id)} onChange={() => toggleRole(r.id)} />
                                        {r.name}
                                    </label>
                                ))}
                                {roles.length === 0 && <p className="text-xs text-muted-foreground">Nenhum perfil disponível.</p>}
                            </div>
                        </div>
                        {units.length > 0 && (
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Unidades</label>
                                <div className="border rounded-lg p-2 max-h-[150px] overflow-y-auto space-y-1">
                                    {units.map((u) => (
                                        <label key={u.id} className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded px-1.5 py-1 cursor-pointer">
                                            <input type="checkbox" className="rounded" checked={form.unitIds.includes(u.id)} onChange={() => toggleUnit(u.id)} />
                                            {u.code ? `${u.code} — ${u.name}` : u.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                        {funcionarios.length > 0 && (
                            <div>
                                <label className="text-sm font-medium mb-1.5 block">Vincular a funcionário</label>
                                <select
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={form.funcionarioId || ""}
                                    onChange={(e) => setForm((f) => ({ ...f, funcionarioId: e.target.value || null }))}
                                >
                                    <option value="">— Nenhum —</option>
                                    {funcionarios.map((f) => (
                                        <option key={f.id} value={f.id}>{f.name} {f.email ? `(${f.email})` : ""}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={saving} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                            {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : null}
                            {editUser ? "Salvar" : "Criar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Password Dialog */}
            <Dialog open={pwOpen} onOpenChange={setPwOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle className="text-base">Alterar senha</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Nova senha</label>
                            <Input type="password" value={pwValue} onChange={(e) => setPwValue(e.target.value)} placeholder="Mínimo 8 caracteres" />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1.5 block">Confirmar senha</label>
                            <Input type="password" value={pwConfirm} onChange={(e) => setPwConfirm(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPwOpen(false)}>Cancelar</Button>
                        <Button onClick={handlePassword} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">Alterar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
