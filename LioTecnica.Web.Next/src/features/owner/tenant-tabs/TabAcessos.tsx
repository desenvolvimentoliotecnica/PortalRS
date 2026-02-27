"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = "/app";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (null as T) : res.json();
}

interface RoleItem { id: string; name: string; }
interface MenuItem { id: string; displayName: string; permissionKey: string; route: string; }
interface Assignment { menuId: string; permissionKey: string; }

export default function TabAcessos({ tenantId }: { tenantId: string }) {
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/Acessos/_api`;

    const [roles, setRoles] = useState<RoleItem[]>([]);
    const [menus, setMenus] = useState<MenuItem[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [selectedRole, setSelectedRole] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");

    const loadBase = useCallback(async () => {
        setLoading(true);
        try {
            const [r, m] = await Promise.all([
                fetchJson<RoleItem[]>(`${apiBase}/roles`),
                fetchJson<MenuItem[]>(`${apiBase}/menus`),
            ]);
            setRoles(r || []);
            setMenus(m || []);
        } catch { toast.error("Erro ao carregar dados."); }
        finally { setLoading(false); }
    }, [apiBase]);

    useEffect(() => { loadBase(); }, [loadBase]);

    const loadAssignments = useCallback(async (roleId: string) => {
        if (!roleId) { setAssignments([]); return; }
        try {
            const a = await fetchJson<Assignment[]>(`${apiBase}/role-menus/${roleId}`);
            setAssignments(a || []);
        } catch { setAssignments([]); }
    }, [apiBase]);

    useEffect(() => { loadAssignments(selectedRole); }, [selectedRole, loadAssignments]);

    const assignedSet = new Set(assignments.map((a) => a.permissionKey));

    const toggle = (permissionKey: string) => {
        if (assignedSet.has(permissionKey)) {
            setAssignments((prev) => prev.filter((a) => a.permissionKey !== permissionKey));
        } else {
            const menu = menus.find((m) => m.permissionKey === permissionKey);
            if (menu) setAssignments((prev) => [...prev, { menuId: menu.id, permissionKey }]);
        }
    };

    const selectAll = () => {
        const all = filtered.map((m) => ({ menuId: m.id, permissionKey: m.permissionKey }));
        const unique = new Map(all.map((a) => [a.permissionKey, a]));
        setAssignments(Array.from(unique.values()));
    };

    const deselectAll = () => {
        const filteredKeys = new Set(filtered.map((m) => m.permissionKey));
        setAssignments((prev) => prev.filter((a) => !filteredKeys.has(a.permissionKey)));
    };

    const handleSave = async () => {
        if (!selectedRole) return;
        setSaving(true);
        try {
            await fetchJson(`${apiBase}/role-menus/${selectedRole}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ selectedPermissions: Array.from(assignedSet) }),
            });
            toast.success("Acessos atualizados.");
        } catch { toast.error("Falha ao salvar."); }
        finally { setSaving(false); }
    };

    const filtered = menus.filter((m) => {
        if (search && !m.displayName.toLowerCase().includes(search.toLowerCase()) && !m.permissionKey.toLowerCase().includes(search.toLowerCase())) return false;
        if (filter === "assigned" && !assignedSet.has(m.permissionKey)) return false;
        if (filter === "unassigned" && assignedSet.has(m.permissionKey)) return false;
        return true;
    });

    if (loading) return <div className="flex justify-center py-16"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

    return (
        <div className="space-y-4">
            {/* KPIs */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="shadow-lt"><CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold text-[rgb(var(--lt-brand))]">{roles.length}</div>
                    <div className="text-xs text-muted-foreground">Perfis</div>
                </CardContent></Card>
                <Card className="shadow-lt"><CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{menus.length}</div>
                    <div className="text-xs text-muted-foreground">Menus</div>
                </CardContent></Card>
                <Card className="shadow-lt"><CardContent className="pt-4 pb-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{assignedSet.size}</div>
                    <div className="text-xs text-muted-foreground">Atribuídos</div>
                </CardContent></Card>
            </div>

            {/* Role Selector */}
            <Card className="shadow-lt">
                <CardContent className="pt-5">
                    <div className="flex flex-wrap gap-3 items-end mb-4">
                        <div className="flex-1 min-w-[200px] max-w-xs">
                            <label className="text-sm font-medium mb-1.5 block">Selecionar perfil</label>
                            <select
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                            >
                                <option value="">— Escolha um perfil —</option>
                                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                        </div>
                        {selectedRole && (
                            <>
                                <div className="relative min-w-[180px]">
                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar menus…" className="pl-8" />
                                </div>
                                <select className="h-9 rounded-md border px-2 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as "all" | "assigned" | "unassigned")}>
                                    <option value="all">Todos</option>
                                    <option value="assigned">Atribuídos</option>
                                    <option value="unassigned">Não atribuídos</option>
                                </select>
                                <Button variant="outline" size="sm" onClick={selectAll}>Marcar todos</Button>
                                <Button variant="outline" size="sm" onClick={deselectAll}>Desmarcar todos</Button>
                            </>
                        )}
                    </div>

                    {!selectedRole ? (
                        <p className="text-sm text-muted-foreground text-center py-8">Selecione um perfil acima para gerenciar acessos.</p>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b text-xs text-muted-foreground">
                                        <th className="w-10 py-2 px-2"></th>
                                        <th className="text-left py-2 px-2">Menu</th>
                                        <th className="text-left py-2 px-2">Permissão</th>
                                        <th className="text-left py-2 px-2">Rota</th>
                                    </tr></thead>
                                    <tbody>
                                        {filtered.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center py-8 text-muted-foreground text-sm">Nenhum menu encontrado.</td></tr>
                                        ) : filtered.map((m) => (
                                            <tr key={m.id} className="border-b hover:bg-muted/50 transition cursor-pointer" onClick={() => toggle(m.permissionKey)}>
                                                <td className="py-1.5 px-2 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded"
                                                        checked={assignedSet.has(m.permissionKey)}
                                                        onChange={() => toggle(m.permissionKey)}
                                                    />
                                                </td>
                                                <td className="py-1.5 px-2 font-medium">{m.displayName}</td>
                                                <td className="py-1.5 px-2 font-mono text-xs text-muted-foreground">{m.permissionKey}</td>
                                                <td className="py-1.5 px-2 text-xs text-muted-foreground">{m.route}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-4">
                                <Button onClick={handleSave} disabled={saving} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                                    {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                                    Salvar acessos
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
