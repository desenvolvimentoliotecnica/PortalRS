"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Search, RefreshCw,
    LayoutDashboard, Briefcase, Users, Calendar, BarChart3,
    Shield, Settings, MessageSquare, ChevronDown, ChevronRight, Eye, Info,
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

interface EffectivePermissionsResponse {
    permissionKeys: string[];
    isWildcard: boolean;
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
        routes: ["/cadastro/", "/cargos", "/unidades", "/funcionarios", "/categorias", "/centros-custo", "/pessoas", "/colaborador/dependentes"],
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
    const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());
    const [effectiveWildcard, setEffectiveWildcard] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
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

    const loadRoleEffectivePermissions = useCallback(async (id: string) => {
        if (!id) {
            setSelectedPermissions(new Set());
            setEffectiveWildcard(false);
            return;
        }
        setLoadingAssignments(true);
        try {
            const res = await fetchJson<EffectivePermissionsResponse>(`/api/roles/${id}/effective-permissions`);
            setEffectiveWildcard(res.isWildcard);
            if (res.isWildcard) {
                setSelectedPermissions(new Set(menus.filter(m => m.permissionKey).map(m => m.permissionKey!)));
            } else {
                setSelectedPermissions(new Set(res.permissionKeys ?? []));
            }
        } catch (err) {
            console.error("Failed to load effective permissions", err);
            toast.error("Falha ao carregar permissões do perfil.");
            setSelectedPermissions(new Set());
            setEffectiveWildcard(false);
        } finally {
            setLoadingAssignments(false);
        }
    }, [menus]);

    function handleRoleChange(id: string) {
        setRoleId(id);
        void loadRoleEffectivePermissions(id);
    }

    function toggleCollapse(moduleKey: string) {
        setCollapsedModules(prev => {
            const next = new Set(prev);
            if (next.has(moduleKey)) next.delete(moduleKey);
            else next.add(moduleKey);
            return next;
        });
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
                    <div className="text-muted-foreground text-sm">
                        Visualização das permissões efetivas por perfil (definidas no código — <span className="font-medium text-foreground">RolePermissionManifest</span>). Não é possível alterar pelo portal.
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {roleId && (
                        <Button variant={showPreview ? "default" : "outline"} size="sm" onClick={() => setShowPreview(p => !p)}>
                            <Eye className="size-4 mr-1" />Preview
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex gap-3 rounded-xl border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <Info className="size-5 shrink-0 text-primary mt-0.5" aria-hidden />
                <p>
                    O botão &quot;Salvar&quot; antigo chamava uma API removida (menús por perfil no banco). Hoje o JWT e a sidebar usam o mapa fixo por tipo/nome de perfil.
                    Para mudar o que um papel pode fazer, altere o manifesto no backend e faça deploy — ou ajuste o <strong>tipo do perfil</strong> em Admin → Perfis (Roles).
                </p>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Menus</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{allPermissionKeys.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">No manifesto</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">
                        {effectiveWildcard ? "∞" : selectedPermissions.size}
                    </div>
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
                        <Button variant="outline" size="sm" onClick={() => void loadRoleEffectivePermissions(roleId)} disabled={loadingAssignments}>
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
                                                                className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? "bg-primary/5 border-primary/30" : "border-border/40 opacity-80"} cursor-default`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={checked}
                                                                    readOnly
                                                                    disabled
                                                                    className="mt-0.5 rounded border-input opacity-70"
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

                            <p className="text-center text-xs text-muted-foreground py-2">
                                Somente leitura — permissões vêm do manifesto no servidor.
                            </p>
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
                            Cruzamento manifesto × menus cadastrados — <span className="font-medium text-primary">{selectedRole?.name}</span>
                            {effectiveWildcard ? " (wildcard — todas as chaves abaixo)" : ""}:
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
