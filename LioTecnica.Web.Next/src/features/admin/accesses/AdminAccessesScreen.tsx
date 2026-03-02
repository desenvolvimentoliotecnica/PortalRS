"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search, CheckSquare, XCircle, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types ── */
interface RoleOption {
    id: string;
    name: string;
    isSystem: boolean;
}

interface MenuOption {
    id: string;
    displayName: string;
    route: string | null;
    permissionKey: string | null;
    parentId: string | null;
    order: number;
    isActive: boolean;
}

interface RoleMenuAssignment {
    menuId: string;
    permissionKey: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || (body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminAccessesScreen() {
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [menus, setMenus] = useState<MenuOption[]>([]);
    const [roleId, setRoleId] = useState("");
    const [assignments, setAssignments] = useState<RoleMenuAssignment[]>([]);
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [saving, setSaving] = useState(false);
    const [q, setQ] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const loadBase = useCallback(async () => {
        setLoading(true);
        try {
            const [r, m] = await Promise.all([
                fetchJson<RoleOption[]>("/api/roles"),
                fetchJson<MenuOption[]>("/api/menus"),
            ]);
            setRoles(r);
            setMenus(m);
        } catch (err) {
            console.error("Failed to load accesses base data", err);
            toast.error("Falha ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadBase(); }, [loadBase]);

    const loadRoleMenus = useCallback(async (id: string) => {
        if (!id) { setAssignments([]); setSelectedPermissions(new Set()); return; }
        setLoadingAssignments(true);
        try {
            const items = await fetchJson<RoleMenuAssignment[]>(`/api/roles/${id}/menus`);
            setAssignments(items);
            setSelectedPermissions(new Set(items.map(a => a.permissionKey)));
        } catch (err) {
            console.error("Failed to load role menus", err);
            toast.error("Falha ao carregar permissões do perfil.");
        } finally {
            setLoadingAssignments(false);
        }
    }, []);

    function handleRoleChange(id: string) {
        setRoleId(id);
        void loadRoleMenus(id);
    }

    function togglePermission(permKey: string) {
        setSelectedPermissions(prev => {
            const next = new Set(prev);
            if (next.has(permKey)) next.delete(permKey);
            else next.add(permKey);
            return next;
        });
    }

    function selectAll() {
        setSelectedPermissions(new Set(menus.filter(m => m.permissionKey).map(m => m.permissionKey!)));
    }

    function clearAll() {
        setSelectedPermissions(new Set());
    }

    async function handleSave() {
        if (!roleId) { toast.error("Selecione um perfil."); return; }
        setSaving(true);
        try {
            const items = Array.from(selectedPermissions).map(perm => {
                const menu = menus.find(m => m.permissionKey === perm);
                return { menuId: menu?.id ?? "", permissionKey: perm };
            }).filter(i => i.menuId);

            await fetchJson(`/api/roles/${roleId}/menus`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items }),
            });
            toast.success("Permissões salvas com sucesso!");
            void loadRoleMenus(roleId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar permissões.");
        } finally {
            setSaving(false);
        }
    }

    const allPermissionKeys = useMemo(() =>
        menus.filter(m => m.permissionKey).map(m => m.permissionKey!),
        [menus]);

    const filteredMenus = useMemo(() => {
        let list = menus.filter(m => m.permissionKey);
        if (q.trim()) {
            const lower = q.toLowerCase();
            list = list.filter(m =>
                m.displayName.toLowerCase().includes(lower) ||
                (m.permissionKey ?? "").toLowerCase().includes(lower) ||
                (m.route ?? "").toLowerCase().includes(lower)
            );
        }
        if (statusFilter === "selected") list = list.filter(m => selectedPermissions.has(m.permissionKey!));
        if (statusFilter === "unselected") list = list.filter(m => !selectedPermissions.has(m.permissionKey!));
        return list.sort((a, b) => a.order - b.order);
    }, [menus, q, statusFilter, selectedPermissions]);

    const hasChanges = useMemo(() => {
        const original = new Set(assignments.map(a => a.permissionKey));
        if (original.size !== selectedPermissions.size) return true;
        for (const p of selectedPermissions) if (!original.has(p)) return true;
        return false;
    }, [assignments, selectedPermissions]);

    const selectedRole = roles.find(r => r.id === roleId);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Controle de Acessos</h4>
                    <div className="text-muted-foreground text-sm">Atribua menus e permissões para um perfil.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {roleId && (
                        <>
                            <Button variant="ghost" size="sm" onClick={selectAll}>
                                <CheckSquare className="size-4" /><span className="hidden sm:inline ml-1">Selecionar tudo</span>
                            </Button>
                            <Button variant="ghost" size="sm" onClick={clearAll}>
                                <XCircle className="size-4" /><span className="hidden sm:inline ml-1">Limpar</span>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Menus</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{allPermissionKeys.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Selecionados</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{selectedPermissions.size}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Perfis</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{roles.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Custom</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{roles.filter(r => !r.isSystem).length}</div>
                </div>
            </div>

            {/* Role selector */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Perfil</label>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm min-w-[250px]" value={roleId} onChange={(e) => handleRoleChange(e.target.value)}>
                            <option value="">Selecione um perfil</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}{r.isSystem ? " (Sistema)" : ""}</option>
                            ))}
                        </select>
                    </div>
                    {roleId && (
                        <Button variant="ghost" size="sm" onClick={() => void loadRoleMenus(roleId)} disabled={loadingAssignments}>
                            <RefreshCw className="size-4 mr-1" /> Recarregar
                        </Button>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="menu, perm, rota..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="selected">Selecionados</option>
                            <option value="unselected">Não selecionados</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Permission grid */}
            {!roleId ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Selecione um perfil para carregar as permissões.
                </div>
            ) : loadingAssignments ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Carregando permissões...
                </div>
            ) : (
                <>
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                        <div className="mb-3 flex items-center justify-between">
                            <div className="font-semibold">
                                Permissões de <span className="text-primary">{selectedRole?.name}</span>
                            </div>
                            {hasChanges && (
                                <span className="text-xs text-amber-600 font-medium">● Alterações não salvas</span>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {filteredMenus.map((m) => {
                                const checked = selectedPermissions.has(m.permissionKey!);
                                return (
                                    <label
                                        key={m.id}
                                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${checked ? "bg-primary/5 border-primary/30" : "border-border/40 hover:bg-muted/30"}`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => togglePermission(m.permissionKey!)}
                                            className="mt-0.5 rounded border-input"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <div className="font-medium text-sm truncate">
                                                {m.parentId && <span className="text-muted-foreground mr-1">└</span>}
                                                {m.displayName}
                                            </div>
                                            <div className="text-xs text-muted-foreground truncate">
                                                <code>{m.permissionKey}</code>
                                            </div>
                                            {m.route && (
                                                <div className="text-xs text-muted-foreground/60 truncate">{m.route}</div>
                                            )}
                                        </div>
                                    </label>
                                );
                            })}
                        </div>
                        {filteredMenus.length === 0 && (
                            <div className="text-center text-muted-foreground py-6">Nenhuma permissão encontrada.</div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={() => void handleSave()} disabled={saving || !hasChanges} className="min-w-[150px]">
                            <Save className="size-4 mr-1" />
                            {saving ? "Salvando..." : "Salvar Permissões"}
                        </Button>
                    </div>
                </>
            )}
        </section>
    );
}
