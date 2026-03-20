"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Plus, RefreshCw, Pencil, Trash2, Shield, LayoutList, Users, ShieldCheck, ShieldOff, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

/* ── Types ── */
interface User { id: string; fullName: string; email: string; isActive: boolean; roles: string[]; }
interface Role { id: string; name: string; description: string | null; isSystem?: boolean; isActive: boolean; userCount?: number; visibilityScope?: number; vagasDataScope?: number; accessMode?: number; }
interface Menu { id: string; displayName: string; route: string | null; icon: string | null; parentId: string | null; order: number; isActive: boolean; permissionKey: string | null; openInNewTab?: boolean; }

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

type Tab = "users" | "roles" | "menus";

export default function UsuariosPerfisScreen() {
    const [tab, setTab] = useState<Tab>("users");

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: "users", label: "Usuários", icon: <Users className="size-4" /> },
        { key: "roles", label: "Perfis", icon: <Shield className="size-4" /> },
        { key: "menus", label: "Menus", icon: <LayoutList className="size-4" /> },
    ];

    return (
        <section className="space-y-4">
            <div>
                <h4 className="text-lg font-bold">Usuários e Perfis</h4>
                <div className="text-muted-foreground text-sm">Gerencie usuários, perfis de acesso e menus.</div>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
                {tabs.map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                        {t.icon}{t.label}
                    </button>
                ))}
            </div>
            {tab === "users" && <UsersTab />}
            {tab === "roles" && <RolesTab />}
            {tab === "menus" && <MenusTab />}
        </section>
    );
}

/* ── Users Tab ── */
function UsersTab() {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState(""); const [newEmail, setNewEmail] = useState(""); const [newPassword, setNewPassword] = useState("");
    const [creating, setCreating] = useState(false);
    // Role assignment
    const [assignUserId, setAssignUserId] = useState<string | null>(null);
    const [userRoleIds, setUserRoleIds] = useState<Set<string>>(new Set());
    const [savingRoles, setSavingRoles] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [u, r] = await Promise.all([fetchJson<User[]>("/api/users"), fetchJson<Role[]>("/api/roles")]);
            setUsers(u); setRoles(r);
        } catch { toast.error("Falha ao carregar usuários."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const filtered = useMemo(() => { if (!q.trim()) return users; const l = q.toLowerCase(); return users.filter(u => u.fullName.toLowerCase().includes(l) || u.email.toLowerCase().includes(l)); }, [users, q]);

    async function handleCreate() {
        if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) { toast.error("Preencha todos os campos."); return; }
        setCreating(true);
        try {
            await fetchJson("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fullName: newName.trim(), email: newEmail.trim(), password: newPassword, isActive: true, roleIds: [] }),
            });
            toast.success("Usuário criado!"); setNewName(""); setNewEmail(""); setNewPassword(""); setShowCreate(false); void load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao criar."); }
        finally { setCreating(false); }
    }

    async function handleToggleStatus(id: string, active: boolean) {
        try {
            await fetchJson(`/api/users/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: active }) });
            toast.success(active ? "Ativado." : "Desativado."); void load();
        } catch { toast.error("Falha ao alterar status."); }
    }

    async function handleSetPassword(id: string) {
        const pwd = prompt("Nova senha:");
        if (!pwd) return;
        try {
            await fetchJson(`/api/users/${id}/password`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPassword: pwd }) });
            toast.success("Senha alterada!");
        } catch { toast.error("Falha ao alterar senha."); }
    }

    function openRoleAssign(user: User) {
        setAssignUserId(user.id);
        // Need to lookup role IDs from names
        const ids = new Set<string>();
        for (const roleName of (user.roles ?? [])) {
            const r = roles.find(rl => rl.name === roleName);
            if (r) ids.add(r.id);
        }
        setUserRoleIds(ids);
    }

    async function saveRoles() {
        if (!assignUserId) return;
        setSavingRoles(true);
        try {
            await fetchJson(`/api/users/${assignUserId}/roles`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roleIds: Array.from(userRoleIds) }) });
            toast.success("Perfis atualizados!"); setAssignUserId(null); void load();
        } catch { toast.error("Falha ao salvar perfis."); }
        finally { setSavingRoles(false); }
    }

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
                <Button size="sm" onClick={() => setShowCreate(!showCreate)}><Plus className="size-4 mr-1" />Novo usuário</Button>
                <div className="ml-auto relative"><Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="w-[240px] pl-8" placeholder="nome, email..." value={q} onChange={e => setQ(e.target.value)} /></div>
            </div>
            {showCreate && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">Criar novo usuário</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input placeholder="Nome completo" value={newName} onChange={e => setNewName(e.target.value)} />
                        <Input placeholder="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
                        <Input placeholder="Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                    </div>
                    <Button onClick={() => void handleCreate()} disabled={creating}>{creating ? "Criando..." : "Criar"}</Button>
                </div>
            )}
            {assignUserId && (
                <div className="card-soft rounded-xl border border-primary/30 bg-primary/5 p-4 backdrop-blur space-y-3">
                    <div className="flex items-center justify-between"><div className="font-semibold">Atribuir perfis</div><Button variant="outline" size="sm" onClick={() => setAssignUserId(null)}>✕</Button></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {roles.map(r => (
                            <label key={r.id} className={`flex items-center gap-2 rounded-lg border p-2 cursor-pointer transition-colors ${userRoleIds.has(r.id) ? "bg-primary/5 border-primary/30" : "border-border/40"}`}>
                                <input type="checkbox" checked={userRoleIds.has(r.id)} onChange={() => { const n = new Set(userRoleIds); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setUserRoleIds(n); }} className="rounded border-input" />
                                <span className="text-sm font-medium">{r.name}</span>
                            </label>
                        ))}
                    </div>
                    <Button onClick={() => void saveRoles()} disabled={savingRoles}>{savingRoles ? "Salvando..." : "Salvar Perfis"}</Button>
                </div>
            )}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader><TableRow><TableHead>Usuário</TableHead><TableHead>Email</TableHead><TableHead>Perfis</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum usuário encontrado.</TableCell></TableRow>
                                : filtered.map(u => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.fullName}</TableCell>
                                        <TableCell className="text-sm">{u.email}</TableCell>
                                        <TableCell>{u.roles?.length ? <div className="flex flex-wrap gap-1">{u.roles.map(r => <span key={r} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r}</span>)}</div> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                                        <TableCell>{u.isActive ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium"><ShieldCheck className="size-3" />Ativo</span> : <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium"><ShieldOff className="size-3" />Inativo</span>}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button variant="outline" size="sm" onClick={() => openRoleAssign(u)} title="Perfis"><Shield className="size-4" /></Button>
                                                <Button variant="outline" size="sm" onClick={() => void handleSetPassword(u.id)} title="Senha"><Key className="size-4" /></Button>
                                                <Button variant="outline" size="sm" onClick={() => void handleToggleStatus(u.id, !u.isActive)} title={u.isActive ? "Desativar" : "Ativar"}>{u.isActive ? <ShieldOff className="size-4" /> : <ShieldCheck className="size-4" />}</Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}

/* ── Roles Tab ── */
function RolesTab() {
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formName, setFormName] = useState(""); const [formDesc, setFormDesc] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setRoles(await fetchJson<Role[]>("/api/roles")); }
        catch { toast.error("Falha ao carregar perfis."); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { void load(); }, [load]);

    function startCreate() { setEditId(null); setFormName(""); setFormDesc(""); setShowForm(true); }
    function startEdit(r: Role) { setEditId(r.id); setFormName(r.name); setFormDesc(r.description ?? ""); setShowForm(true); }

    async function handleSave() {
        if (!formName.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            const payload = { name: formName.trim(), description: formDesc.trim() || null };
            const enrichedPayload = { ...payload, isActive: true, visibilityScope: 0, vagasDataScope: 0, accessMode: 0 };
            if (editId) { await fetchJson(`/api/roles/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(enrichedPayload) }); toast.success("Perfil atualizado!"); }
            else { await fetchJson("/api/roles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(enrichedPayload) }); toast.success("Perfil criado!"); }
            setShowForm(false); void load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha."); }
        finally { setSaving(false); }
    }

    async function handleDelete(id: string, name: string) {
        if (!(await confirmDialog({ title: "Remover perfil", description: `Remover "${name}"?`, confirmText: "Remover", destructive: true }))) return;
        try { await apiFetch(`/api/roles/${id}`, { method: "DELETE" }); toast.success("Removido."); void load(); }
        catch { toast.error("Falha."); }
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
                <Button size="sm" onClick={startCreate}><Plus className="size-4 mr-1" />Novo perfil</Button>
            </div>
            {showForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">{editId ? "Editar" : "Novo"} perfil</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2"><Input placeholder="Nome" value={formName} onChange={e => setFormName(e.target.value)} /><Input placeholder="Descrição" value={formDesc} onChange={e => setFormDesc(e.target.value)} /></div>
                    <div className="flex gap-2"><Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button></div>
                </div>
            )}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader><TableRow><TableHead>Perfil</TableHead><TableHead>Descrição</TableHead><TableHead>Tipo</TableHead><TableHead className="text-right">Usuários</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : roles.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum perfil.</TableCell></TableRow>
                                : roles.map(r => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-medium"><div className="flex items-center gap-2"><Shield className="size-4 text-primary" />{r.name}</div></TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{r.description || "—"}</TableCell>
                                        <TableCell>{r.isSystem ? <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-800 px-2 py-0.5 text-xs font-medium">Sistema</span> : <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Custom</span>}</TableCell>
                                        <TableCell className="text-right">{r.userCount ?? 0}</TableCell>
                                        <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="outline" size="sm" onClick={() => startEdit(r)}><Pencil className="size-4" /></Button>{!r.isSystem && <Button variant="destructive" size="sm" onClick={() => void handleDelete(r.id, r.name)}><Trash2 className="size-4" /></Button>}</div></TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}

/* ── Menus Tab ── */
function MenusTab() {
    const [menus, setMenus] = useState<Menu[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formName, setFormName] = useState(""); const [formRoute, setFormRoute] = useState(""); const [formPerm, setFormPerm] = useState("");
    const [formIcon, setFormIcon] = useState(""); const [formOrder, setFormOrder] = useState(0); const [formParent, setFormParent] = useState("");
    const [formActive, setFormActive] = useState(true); const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setMenus(await fetchJson<Menu[]>("/api/menus")); }
        catch { toast.error("Falha ao carregar menus."); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { void load(); }, [load]);

    const parents = menus.filter(m => !m.parentId);

    function startCreate() { setEditId(null); setFormName(""); setFormRoute(""); setFormPerm(""); setFormIcon(""); setFormOrder(0); setFormParent(""); setFormActive(true); setShowForm(true); }
    function startEdit(m: Menu) { setEditId(m.id); setFormName(m.displayName); setFormRoute(m.route ?? ""); setFormPerm(m.permissionKey ?? ""); setFormIcon(m.icon ?? ""); setFormOrder(m.order); setFormParent(m.parentId ?? ""); setFormActive(m.isActive); setShowForm(true); }

    async function handleSave() {
        if (!formName.trim() || !formPerm.trim()) { toast.error("Nome e permissão são obrigatórios."); return; }
        setSaving(true);
        try {
            const payload = { displayName: formName.trim(), route: formRoute.trim() || "/", icon: formIcon.trim(), order: formOrder, parentId: formParent || null, permissionKey: formPerm.trim(), isActive: formActive, openInNewTab: false };
            if (editId) { await fetchJson(`/api/menus/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); toast.success("Menu atualizado!"); }
            else { await fetchJson("/api/menus", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); toast.success("Menu criado!"); }
            setShowForm(false); void load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha."); }
        finally { setSaving(false); }
    }

    async function handleDelete(id: string, name: string) {
        if (!(await confirmDialog({ title: "Remover menu", description: `Remover "${name}"?`, confirmText: "Remover", destructive: true }))) return;
        try { await apiFetch(`/api/menus/${id}`, { method: "DELETE" }); toast.success("Removido."); void load(); }
        catch { toast.error("Falha."); }
    }

    return (
        <>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
                <Button size="sm" onClick={startCreate}><Plus className="size-4 mr-1" />Novo menu</Button>
            </div>
            {showForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">{editId ? "Editar" : "Novo"} menu</div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Input placeholder="Nome *" value={formName} onChange={e => setFormName(e.target.value)} />
                        <Input placeholder="Rota" value={formRoute} onChange={e => setFormRoute(e.target.value)} />
                        <Input placeholder="Permissão *" value={formPerm} onChange={e => setFormPerm(e.target.value)} />
                        <Input placeholder="Ícone" value={formIcon} onChange={e => setFormIcon(e.target.value)} />
                        <Input type="number" placeholder="Ordem" value={formOrder} onChange={e => setFormOrder(parseInt(e.target.value) || 0)} />
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={formParent} onChange={e => setFormParent(e.target.value)}>
                            <option value="">Nenhum pai</option>
                            {parents.map(p => <option key={p.id} value={p.id}>{p.displayName}</option>)}
                        </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="rounded border-input" /> Ativo</label>
                    <div className="flex gap-2"><Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button></div>
                </div>
            )}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader><TableRow><TableHead>Menu</TableHead><TableHead>Rota</TableHead><TableHead>Permissão</TableHead><TableHead className="text-center">Ordem</TableHead><TableHead className="text-center">Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : menus.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum menu.</TableCell></TableRow>
                                : menus.sort((a, b) => a.order - b.order).map(m => (
                                    <TableRow key={m.id} className={m.parentId ? "bg-muted/20" : ""}>
                                        <TableCell className="font-medium"><div className="flex items-center gap-2">{m.parentId && <span className="text-muted-foreground">└</span>}<LayoutList className="size-4 text-primary" />{m.displayName}</div></TableCell>
                                        <TableCell><code className="text-xs">{m.route || "—"}</code></TableCell>
                                        <TableCell><code className="text-xs">{m.permissionKey || "—"}</code></TableCell>
                                        <TableCell className="text-center">{m.order}</TableCell>
                                        <TableCell className="text-center">{m.isActive ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativo</span> : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Inativo</span>}</TableCell>
                                        <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="outline" size="sm" onClick={() => startEdit(m)}><Pencil className="size-4" /></Button><Button variant="destructive" size="sm" onClick={() => void handleDelete(m.id, m.displayName)}><Trash2 className="size-4" /></Button></div></TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );
}
