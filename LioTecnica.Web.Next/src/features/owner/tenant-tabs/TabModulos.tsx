"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, EyeOff, Loader2, Lock, Monitor, Package } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Card } from "@/components/ui/card";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init, cache: "no-store" });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as Record<string, string>).detail || (body as Record<string, string>).title || `HTTP ${res.status}`);
    }
    return res.status === 204 ? (null as T) : res.json();
}

type EstadoTela = "ativo" | "oculto" | "bloqueado";

interface ModuleScreen {
    id: string;
    label: string;
    href: string;
    icon: string;
    permissionKey: string;
    ordem: number;
    grupoUiKey: string;
    grupoUiLabel: string;
    estado: EstadoTela;
}

interface TenantModule {
    key: string;
    name: string;
    description: string;
    isCore: boolean;
    isEnabled: boolean;
    updatedAtUtc: string | null;
    packageKey: string | null;
    telas: ModuleScreen[];
}

interface TenantPackage {
    key: string;
    name: string;
    description: string;
    isActive: boolean;
    isEnabled: boolean;
    updatedAtUtc: string | null;
}

// Telas que ganham controle individual de visibilidade no entitlement do tenant.
const FEATURED_SCREENS: { navItemId: string; label: string; description: string; icon: React.ReactNode }[] = [
    {
        navItemId: "nav-assistente-ia",
        label: "Assistente IA",
        description: "Chatbot inteligente disponível no sidebar para os usuários do tenant.",
        icon: <Bot className="size-4 text-violet-500" />,
    },
];

function FuncionalidadesDestaqueSection({
    modules,
    onSetEstado,
    savingScreenId,
}: {
    modules: TenantModule[];
    onSetEstado: (screen: ModuleScreen, estado: EstadoTela) => Promise<void>;
    savingScreenId: string | null;
}) {
    // Encontra cada tela destacada nos módulos já carregados
    const allTelas = modules.flatMap((m) => m.telas);
    const entries = FEATURED_SCREENS.map((f) => ({
        ...f,
        tela: allTelas.find((t) => t.id === f.navItemId),
    })).filter((e) => e.tela !== undefined) as Array<typeof FEATURED_SCREENS[number] & { tela: ModuleScreen }>;

    if (entries.length === 0) return null;

    return (
        <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Funcionalidades com controle individual</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {entries.map(({ navItemId, label, description, icon, tela }) => {
                    const estado = tela.estado ?? "ativo";
                    const isSaving = savingScreenId === navItemId;
                    return (
                        <Card key={navItemId} className="p-3 shadow-lt">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 shrink-0">{icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                        <span className="font-medium text-sm">{label}</span>
                                        {isSaving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                                        <span className={`text-[9px] font-bold uppercase rounded px-1 py-0.5 ${
                                            estado === "ativo" ? "bg-emerald-100 text-emerald-700" :
                                            estado === "bloqueado" ? "bg-amber-100 text-amber-700" :
                                            "bg-gray-100 text-gray-500"
                                        }`}>
                                            {estado === "ativo" ? "Visível" : estado === "bloqueado" ? "Bloqueado" : "Oculto"}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground">{description}</p>
                                </div>
                                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                    <button
                                        type="button"
                                        title="Visível — aparece normalmente"
                                        disabled={isSaving}
                                        onClick={() => void onSetEstado(tela, "ativo")}
                                        className={`rounded p-1 transition-colors ${estado === "ativo" ? "bg-emerald-100 text-emerald-600" : "text-gray-300 hover:text-emerald-400"}`}
                                    >
                                        <Monitor className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        title="Oculto — não aparece no menu"
                                        disabled={isSaving}
                                        onClick={() => void onSetEstado(tela, "oculto")}
                                        className={`rounded p-1 transition-colors ${estado === "oculto" ? "bg-gray-200 text-gray-600" : "text-gray-300 hover:text-gray-500"}`}
                                    >
                                        <EyeOff className="size-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        title="Bloqueado — aparece com cadeado"
                                        disabled={isSaving}
                                        onClick={() => void onSetEstado(tela, "bloqueado")}
                                        className={`rounded p-1 transition-colors ${estado === "bloqueado" ? "bg-amber-100 text-amber-600" : "text-gray-300 hover:text-amber-400"}`}
                                    >
                                        <Lock className="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}

export default function TabModulos({ tenantId }: { tenantId: string }) {
    const modulesBase = `/api/owner/tenants/${encodeURIComponent(tenantId)}/modules`;
    const modulesDetailedUrl = `${modulesBase}/detailed`;
    const packagesBase = `/api/owner/tenants/${encodeURIComponent(tenantId)}/packages`;

    const [modules, setModules] = useState<TenantModule[]>([]);
    const [packages, setPackages] = useState<TenantPackage[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingModuleKey, setSavingModuleKey] = useState<string | null>(null);
    const [savingPackageKey, setSavingPackageKey] = useState<string | null>(null);
    const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
    const [savingScreenId, setSavingScreenId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [mods, pkgs] = await Promise.all([
                fetchJson<TenantModule[]>(modulesDetailedUrl),
                fetchJson<TenantPackage[]>(packagesBase),
            ]);
            setModules(mods || []);
            setPackages(pkgs || []);
        } catch (e) {
            toast.error((e as Error).message || "Erro ao carregar módulos.");
        } finally {
            setLoading(false);
        }
    }, [modulesDetailedUrl, packagesBase]);

    useEffect(() => { void load(); }, [load]);

    const toggleModule = async (mod: TenantModule) => {
        if (mod.isCore) return;
        const next = !mod.isEnabled;
        setSavingModuleKey(mod.key);
        try {
            // O PUT do módulo retorna TenantModuleResponse (sem telas). Mescla preservando `telas`.
            const updated = await fetchJson<Omit<TenantModule, "telas">>(`${modulesBase}/${encodeURIComponent(mod.key)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isEnabled: next }),
            });
            setModules((prev) => prev.map((m) => (m.key === mod.key ? { ...updated, telas: m.telas } : m)));
            toast.success(`Módulo "${mod.name}" ${next ? "habilitado" : "desabilitado"}.`);
        } catch (e) {
            toast.error((e as Error).message || "Falha ao atualizar módulo.");
        } finally {
            setSavingModuleKey(null);
        }
    };

    const togglePackage = async (pkg: TenantPackage) => {
        const next = !pkg.isEnabled;
        setSavingPackageKey(pkg.key);
        try {
            const updated = await fetchJson<TenantPackage>(`${packagesBase}/${encodeURIComponent(pkg.key)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isEnabled: next }),
            });
            setPackages((prev) => prev.map((p) => (p.key === pkg.key ? updated : p)));
            toast.success(`Pacote "${pkg.name}" ${next ? "contratado" : "desativado"}.`);
        } catch (e) {
            toast.error((e as Error).message || "Falha ao atualizar pacote.");
        } finally {
            setSavingPackageKey(null);
        }
    };

    const setScreenEstado = async (screen: ModuleScreen, estado: EstadoTela) => {
        if (savingScreenId === screen.id) return;
        setSavingScreenId(screen.id);
        try {
            await fetchJson<void>(`/api/owner/tenants/${encodeURIComponent(tenantId)}/screens/${encodeURIComponent(screen.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ estado }),
            });
            setModules((prev) =>
                prev.map((m) => ({
                    ...m,
                    telas: m.telas.map((t) => t.id === screen.id ? { ...t, estado } : t),
                }))
            );
        } catch (e) {
            toast.error((e as Error).message || "Falha ao atualizar tela.");
        } finally {
            setSavingScreenId(null);
        }
    };

    const toggleExpand = (moduleKey: string) => {
        setExpandedModules((prev) => {
            const next = new Set(prev);
            if (next.has(moduleKey)) next.delete(moduleKey); else next.add(moduleKey);
            return next;
        });
    };

    const grouped = useMemo(() => {
        const coreModules = modules.filter((m) => m.isCore);
        const byPackage = new Map<string, TenantModule[]>();
        const standalone: TenantModule[] = [];
        for (const m of modules) {
            if (m.isCore) continue;
            if (m.packageKey) {
                const arr = byPackage.get(m.packageKey) ?? [];
                arr.push(m);
                byPackage.set(m.packageKey, arr);
            } else {
                standalone.push(m);
            }
        }
        return { coreModules, byPackage, standalone };
    }, [modules]);

    const renderTelas = (mod: TenantModule) => {
        if (mod.telas.length === 0) {
            return (
                <div className="mt-2 rounded border border-dashed border-gray-200 bg-gray-50 p-2 text-[11px] italic text-muted-foreground">
                    Nenhuma tela publicada por este módulo.
                </div>
            );
        }
        return (
            <ul className="mt-2 space-y-1 rounded border border-gray-100 bg-gray-50 p-2">
                {mod.telas.map((t) => {
                    const isSaving = savingScreenId === t.id;
                    const estado = t.estado ?? "ativo";
                    return (
                        <li key={t.id} className="flex items-center gap-2 text-[11px]">
                            <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                    type="button"
                                    title="Ativo — visível e acessível"
                                    disabled={isSaving}
                                    onClick={() => void setScreenEstado(t, "ativo")}
                                    className={`rounded p-0.5 transition-colors ${estado === "ativo" ? "bg-emerald-100 text-emerald-600" : "text-gray-300 hover:text-emerald-400"}`}
                                >
                                    <Monitor className="size-3" />
                                </button>
                                <button
                                    type="button"
                                    title="Oculto — não aparece no menu"
                                    disabled={isSaving}
                                    onClick={() => void setScreenEstado(t, "oculto")}
                                    className={`rounded p-0.5 transition-colors ${estado === "oculto" ? "bg-gray-200 text-gray-600" : "text-gray-300 hover:text-gray-500"}`}
                                >
                                    <EyeOff className="size-3" />
                                </button>
                                <button
                                    type="button"
                                    title="Bloqueado — aparece com cadeado"
                                    disabled={isSaving}
                                    onClick={() => void setScreenEstado(t, "bloqueado")}
                                    className={`rounded p-0.5 transition-colors ${estado === "bloqueado" ? "bg-amber-100 text-amber-600" : "text-gray-300 hover:text-amber-400"}`}
                                >
                                    <Lock className="size-3" />
                                </button>
                                {isSaving && <Loader2 className="size-3 animate-spin text-muted-foreground ml-0.5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-medium ${estado === "oculto" ? "text-gray-400 line-through" : "text-slate-700"}`}>{t.label}</span>
                                    <code className="text-[10px] text-muted-foreground">{t.href}</code>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Permissão: <code>{t.permissionKey}</code> · Bucket: {t.grupoUiLabel}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ul>
        );
    };

    const renderModuleCard = (mod: TenantModule, opts: { compact?: boolean; disabled?: boolean } = {}) => {
        const saving = savingModuleKey === mod.key;
        const expanded = expandedModules.has(mod.key);
        const { compact = false, disabled = false } = opts;
        const effectiveEnabled = !disabled && mod.isEnabled;
        return (
            <div key={mod.key} className={`border rounded p-2 ${disabled ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-2">
                    {!mod.isCore && (
                        <label className="relative inline-flex items-center cursor-pointer mt-0.5">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={mod.isEnabled}
                                onChange={() => void toggleModule(mod)}
                                disabled={saving || disabled}
                            />
                            <div className={`${compact ? "w-9 h-4" : "w-10 h-5"} bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-[rgb(var(--lt-brand))] peer-disabled:opacity-50 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full ${compact ? "after:h-3 after:w-3" : "after:h-4 after:w-4"} after:transition-transform peer-checked:after:translate-x-5`} />
                        </label>
                    )}
                    {mod.isCore && <Lock className="size-4 text-muted-foreground mt-0.5" />}

                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={`font-medium ${compact ? "text-xs" : "text-sm"}`}>{mod.name}</span>
                            {saving && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                            {!mod.isCore && (
                                <span className={`text-[9px] font-bold uppercase rounded px-1 py-0.5 ${effectiveEnabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                    {effectiveEnabled ? "Ativo" : "Inativo"}
                                </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                                {mod.telas.length} tela{mod.telas.length === 1 ? "" : "s"}
                            </span>
                            <button
                                type="button"
                                onClick={() => toggleExpand(mod.key)}
                                className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lt-brand))] hover:underline"
                                aria-expanded={expanded}
                            >
                                {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                {expanded ? "Ocultar telas" : "Ver telas"}
                            </button>
                        </div>
                        <div className={`${compact ? "text-[11px]" : "text-xs"} text-muted-foreground`}>{mod.description}</div>
                        {expanded && renderTelas(mod)}
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-base font-semibold mb-1">Entitlement do tenant</h2>
                <p className="text-sm text-muted-foreground">
                    Os pacotes comerciais são a contratação macro. Cada pacote expõe um conjunto de módulos que podem ser ajustados individualmente.
                    Cada módulo entrega uma ou mais telas no sidebar do usuário — clique em <strong>Ver telas</strong> para conferir o que o cliente ganha.
                </p>
            </div>

            <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Pacotes contratados</h3>
                <div className="space-y-3">
                    {packages.map((pkg) => {
                        const pkgModules = grouped.byPackage.get(pkg.key) ?? [];
                        const savingPkg = savingPackageKey === pkg.key;
                        const masterDisabled = !pkg.isEnabled;
                        const totalTelas = pkgModules.reduce((sum, m) => sum + m.telas.length, 0);
                        return (
                            <Card key={pkg.key} className="p-4 shadow-lt">
                                <div className="flex items-start gap-3">
                                    <Package className="size-5 text-[rgb(var(--lt-brand))] mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="font-semibold text-sm">{pkg.name}</span>
                                            {savingPkg && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                                            <span className={`text-[10px] font-bold uppercase rounded px-1.5 py-0.5 ${pkg.isEnabled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                                {pkg.isEnabled ? "Contratado" : "Desativado"}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {pkgModules.length} módulo{pkgModules.length === 1 ? "" : "s"} · {totalTelas} tela{totalTelas === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mb-3">{pkg.description}</p>

                                        {pkgModules.length > 0 && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                                                {pkgModules.map((mod) => renderModuleCard(mod, { compact: true, disabled: masterDisabled }))}
                                            </div>
                                        )}
                                    </div>

                                    <label className="relative inline-flex items-center cursor-pointer mt-0.5 shrink-0">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={pkg.isEnabled}
                                            onChange={() => void togglePackage(pkg)}
                                            disabled={savingPkg}
                                        />
                                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:bg-[rgb(var(--lt-brand))] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
                                    </label>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            </section>

            {grouped.standalone.length > 0 && (
                <section>
                    <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Módulos opcionais avulsos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {grouped.standalone.map((mod) => (
                            <Card key={mod.key} className="p-3 shadow-lt">
                                {renderModuleCard(mod)}
                            </Card>
                        ))}
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Módulos core (sempre ativos)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {grouped.coreModules.map((mod) => (
                        <Card key={mod.key} className="p-3 shadow-lt opacity-90">
                            {renderModuleCard(mod)}
                        </Card>
                    ))}
                </div>
            </section>

            <FuncionalidadesDestaqueSection modules={modules} onSetEstado={setScreenEstado} savingScreenId={savingScreenId} />
        </div>
    );
}
