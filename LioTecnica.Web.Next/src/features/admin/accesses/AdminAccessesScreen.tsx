"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Search, CheckSquare, XCircle, Save, RefreshCw,
    LayoutDashboard, Briefcase, Users, Calendar, BarChart3,
    Shield, Settings, MessageSquare, ChevronDown, ChevronRight, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ADMIN_RECRUITMENT_ROUTE_PATTERNS } from "@/features/navigation/recruitmentNavigation";
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

/* ── Module grouping ── */
const MODULE_CONFIG: { key: string; label: string; icon: typeof LayoutDashboard; routes: string[]; color: string }[] = [
    {
        key: "recrutamento", label: "Recrutamento", icon: Briefcase, color: "text-blue-600",
        routes: [...ADMIN_RECRUITMENT_ROUTE_PATTERNS],
    },
    {
        key: "operacional", label: "Operacional", icon: Calendar, color: "text-amber-600",
        routes: ["/agendas", "/entradaemailpasta", "/gestao/batida-ponto", "/gestao/comissoes"],
    },
    {
        key: "gestao", label: "Gestão de Pessoas", icon: Users, color: "text-green-600",
        routes: ["/gestao/dashboard", "/gestao/humor", "/gestao/planosdesenvolvimento", "/gestao/resumoatividades"],
    },
    {
        key: "feedback", label: "Feedback", icon: MessageSquare, color: "text-purple-600",
        routes: ["/feedback", "/feedback/pesquisas", "/feedback/celebracao", "/feedback/enviar", "/feedback/feedbacks", "/feedback/gamificacao", "/feedback/meusplanos", "/feedback/reunioes1a1", "/desempenho"],
    },
    {
        key: "cadastros", label: "Cadastros", icon: LayoutDashboard, color: "text-cyan-600",
        routes: ["/cadastro/", "/cargos", "/unidades", "/funcionarios", "/categorias", "/areas", "/departamentos", "/pessoas", "/colaborador/dependentes"],
    },
    {
        key: "relatorios", label: "Relatórios", icon: BarChart3, color: "text-orange-600",
        routes: ["/relatorios"],
    },
    {
        key: "admin", label: "Admin", icon: Shield, color: "text-red-600",
        routes: ["/admin"],
    },
    {
        key: "outros", label: "Outros", icon: Settings, color: "text-gray-500",
        routes: [],
    },
];

function getModuleKey(route: string | null): string {
    if (!route) return "outros";
    const r = route.toLowerCase();
    for (const mod of MODULE_CONFIG) {
        if (mod.key === "outros") continue;
        if (mod.routes.some(prefix => r.includes(prefix))) return mod.key;
    }
    return "outros";
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
    const [collapsedModules, setCollapsedModules] = useState<Set<string>>(new Set());
    const [showPreview, setShowPreview] = useState(false);

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

    // Module group toggle
    function toggleModule(moduleKey: string) {
        const moduleMenus = groupedMenus[moduleKey] ?? [];
        const allSelected = moduleMenus.every(m => selectedPermissions.has(m.permissionKey!));
        setSelectedPermissions(prev => {
            const next = new Set(prev);
            for (const m of moduleMenus) {
                if (m.permissionKey) {
                    if (allSelected) next.delete(m.permissionKey);
                    else next.add(m.permissionKey);
                }
            }
            return next;
        });
    }

    function toggleCollapse(moduleKey: string) {
        setCollapsedModules(prev => {
            const next = new Set(prev);
            if (next.has(moduleKey)) next.delete(moduleKey);
            else next.add(moduleKey);
            return next;
        });
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

    // Group menus by module
    const groupedMenus = useMemo(() => {
        const groups: Record<string, MenuOption[]> = {};
        for (const mod of MODULE_CONFIG) groups[mod.key] = [];
        for (const m of menus) {
            if (!m.permissionKey) continue;
            const key = getModuleKey(m.route);
            if (!groups[key]) groups[key] = [];
            groups[key].push(m);
        }
        // Sort within each group
        for (const key of Object.keys(groups)) {
            groups[key].sort((a, b) => a.order - b.order);
        }
        return groups;
    }, [menus]);

    // Apply search + status filter per module
    const filteredGroupedMenus = useMemo(() => {
        const result: Record<string, MenuOption[]> = {};
        for (const [key, items] of Object.entries(groupedMenus)) {
            let list = items;
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
            if (list.length > 0) result[key] = list;
        }
        return result;
    }, [groupedMenus, q, statusFilter, selectedPermissions]);

    const hasChanges = useMemo(() => {
        const original = new Set(assignments.map(a => a.permissionKey));
        if (original.size !== selectedPermissions.size) return true;
        for (const p of selectedPermissions) if (!original.has(p)) return true;
        return false;
    }, [assignments, selectedPermissions]);

    const selectedRole = roles.find(r => r.id === roleId);

    // Preview: menus the user would see
    const previewMenus = useMemo(() =>
        menus.filter(m => m.permissionKey && selectedPermissions.has(m.permissionKey))
            .sort((a, b) => a.order - b.order),
        [menus, selectedPermissions]);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Controle de Acessos</h4>
                    <div className="text-muted-foreground text-sm">Atribua menus e permissões para um perfil, organizados por módulo.</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {roleId && (
                        <>
                            <Button variant="outline" size="sm" onClick={selectAll}>
                                <CheckSquare className="mr-1 size-4" />Selecionar tudo
                            </Button>
                            <Button variant="outline" size="sm" onClick={clearAll}>
                                <XCircle className="mr-1 size-4" />Limpar
                            </Button>
                            <Button variant={showPreview ? "default" : "outline"} size="sm" onClick={() => setShowPreview(p => !p)}>
                                <Eye className="size-4 mr-1" />Preview
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
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Módulos</div>
                    <div className="mt-1 text-2xl font-bold text-amber-600">{Object.keys(filteredGroupedMenus).length}</div>
                </div>
            </div>

            {/* Role selector */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="flex flex-wrap items-end gap-3">
                    <div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm min-w-[250px]" value={roleId} onChange={(e) => handleRoleChange(e.target.value)}>
                            <option value="">Selecione um perfil</option>
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.name}{r.isSystem ? " (Sistema)" : ""}</option>
                            ))}
                        </select>
                    </div>
                    {roleId && (
                        <Button variant="outline" size="sm" onClick={() => void loadRoleMenus(roleId)} disabled={loadingAssignments}>
                            <RefreshCw className="mr-1 size-4" /> Recarregar
                        </Button>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input className="w-[240px] pl-8" placeholder="menu, perm, rota..." value={q} onChange={(e) => setQ(e.target.value)} />
                        </div>
                        <select className="h-9 rounded-md border border-input bg-background px-3 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                            <option value="all">Todos</option>
                            <option value="selected">Selecionados</option>
                            <option value="unselected">Não selecionados</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Main content area */}
            <div className={`grid gap-4 ${showPreview ? "grid-cols-1 lg:grid-cols-[1fr_280px]" : ""}`}>
                {/* Permission grid by module */}
                <div className="space-y-3">
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
                            {MODULE_CONFIG.filter(mod => filteredGroupedMenus[mod.key]).map(mod => {
                                const items = filteredGroupedMenus[mod.key];
                                const allModSelected = items.every(m => selectedPermissions.has(m.permissionKey!));
                                const someModSelected = items.some(m => selectedPermissions.has(m.permissionKey!));
                                const isCollapsed = collapsedModules.has(mod.key);
                                const Icon = mod.icon;

                                return (
                                    <div key={mod.key} className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur overflow-hidden">
                                        {/* Module Header */}
                                        <div
                                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => toggleCollapse(mod.key)}
                                        >
                                            <div className="flex items-center gap-2">
                                                {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                                                <Icon className={`size-4 ${mod.color}`} />
                                                <span className="font-semibold text-sm">{mod.label}</span>
                                                <span className="text-xs text-muted-foreground ml-1">
                                                    ({items.filter(m => selectedPermissions.has(m.permissionKey!)).length}/{items.length})
                                                </span>
                                            </div>
                                            <Button
                                                variant={allModSelected ? "default" : someModSelected ? "secondary" : "outline"}
                                                size="sm"
                                                className="text-xs"
                                                onClick={(e) => { e.stopPropagation(); toggleModule(mod.key); }}
                                            >
                                                {allModSelected ? "Desmarcar Módulo" : "Selecionar Módulo"}
                                            </Button>
                                        </div>

                                        {/* Module Items */}
                                        {!isCollapsed && (
                                            <div className="px-4 pb-4">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                    {items.map((m) => {
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
                                                                        {m.displayName}
                                                                    </div>
                                                                    <div className="text-xs text-muted-foreground truncate">
                                                                        <code>{m.permissionKey}</code>
                                                                    </div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <div className="flex justify-end">
                                <Button onClick={() => void handleSave()} disabled={saving || !hasChanges} className="min-w-[150px]">
                                    <Save className="size-4 mr-1" />
                                    {saving ? "Salvando..." : "Salvar Permissões"}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                {/* Sidebar Preview */}
                {showPreview && roleId && !loadingAssignments && (
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 backdrop-blur p-4 h-fit sticky top-4">
                        <div className="flex items-center gap-2 mb-3">
                            <Eye className="size-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">Preview da Sidebar</span>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                            Como <span className="font-medium text-primary">{selectedRole?.name}</span> verá:
                        </div>
                        <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                            {previewMenus.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-4 text-center">Nenhum menu selecionado</div>
                            ) : previewMenus.map(m => (
                                <div
                                    key={m.id}
                                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/30 transition-colors"
                                >
                                    <div className="size-1.5 rounded-full bg-primary/50" />
                                    <span className="truncate">{m.displayName}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 pt-2 border-t border-border/30 text-xs text-muted-foreground text-center">
                            {previewMenus.length} itens visíveis
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
