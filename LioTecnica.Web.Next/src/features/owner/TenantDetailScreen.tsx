"use client";

import { useCallback, useEffect, useState } from "react";
import {
    ArrowLeft,
    Database,
    Loader2,
    LogIn,
    Sprout,
    Trash2,
    Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm-dialog";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { ApiSwitchTenantResponseSchema } from "@/lib/schemas/api";
import { setAccessToken, setTenantId } from "@/lib/session";

import TabUsuarios from "./tenant-tabs/TabUsuarios";
import TabAcessos from "./tenant-tabs/TabAcessos";
import TabMenus from "./tenant-tabs/TabMenus";
import TabLogsTransacionais from "./tenant-tabs/TabLogsTransacionais";
import TabLogsOperacionais from "./tenant-tabs/TabLogsOperacionais";
import TabEmailTemplates from "./tenant-tabs/TabEmailTemplates";
import TabEmails from "./tenant-tabs/TabEmails";
import TabEmailConfig from "./tenant-tabs/TabEmailConfig";
import TabEntraIdConfig from "./tenant-tabs/TabEntraIdConfig";
import TabIdioma from "./tenant-tabs/TabIdioma";

/* ─── Types ─── */

interface TenantInfo {
    tenantId: string;
    name: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
    createdByOwnerId: string | null;
    createdByOwnerEmail: string | null;
}

interface MigrationStatus {
    tenantId: string;
    isUpToDate: boolean;
    pendingCount: number;
    pendingMigrationIds: string[];
    errorMessage: string | null;
}

interface TenantDetail {
    tenant: TenantInfo;
    migrationStatus: MigrationStatus | null;
}

type ApiTenantMigrationStatus = MigrationStatus;

/* ─── API ─── */

const BASE = "/app";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg = `HTTP_${res.status}`;
        try { const j = JSON.parse(text); msg = j?.error || j?.message || msg; } catch { /* plain */ }
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

/* ─── Tab definitions matching Razor Details.cshtml ─── */

const TABS = [
    { key: "geral", label: "Geral" },
    { key: "usuarios", label: "Usuários" },
    { key: "acessos", label: "Acessos" },
    { key: "menus", label: "Menus" },
    { key: "logs", label: "Logs transacionais" },
    { key: "logs-op", label: "Logs operacionais" },
    { key: "email-templates", label: "Templates de email" },
    { key: "emails", label: "Emails" },
    { key: "email-config", label: "Config email" },
    { key: "entra-id", label: "Config Entra ID" },
    { key: "idioma", label: "Idioma" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ─── Component ─── */

export default function TenantDetailScreen({ tenantId }: { tenantId: string }) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [detail, setDetail] = useState<TenantDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>("geral");

    const loadDetail = useCallback(async () => {
        setLoading(true);
        try {
            const [tenant, statuses] = await Promise.all([
                fetchJson<TenantInfo>(`/api/owner/tenants/${encodeURIComponent(tenantId)}`),
                fetchJson<ApiTenantMigrationStatus[]>(`/api/owner/tenants/migrations/status`),
            ]);

            const status =
                (Array.isArray(statuses) ? statuses : []).find(
                    (s) => String(s?.tenantId ?? "").toLowerCase() === tenantId.toLowerCase(),
                ) ?? null;

            setDetail({ tenant, migrationStatus: status });
        } catch {
            toast.error("Falha ao carregar detalhes do tenant.");
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => { void loadDetail(); }, [loadDetail]);

    /* ─── Actions ─── */

    async function handleApplyMigrations() {
        setBusy(true);
        try {
            const result = await fetchJson<{ appliedCount: number }>(
                `/api/owner/tenants/${encodeURIComponent(tenantId)}/migrations/apply`,
                { method: "POST" },
            );
            toast.success(`Migrações aplicadas (${result?.appliedCount ?? 0}).`);
            void loadDetail();
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleSeed() {
        setBusy(true);
        try {
            const result = await fetchJson<{ message?: string }>(
                `/api/owner/tenants/${encodeURIComponent(tenantId)}/seed`,
                { method: "POST" },
            );
            toast.success(result?.message || "Seed executado com sucesso.");
            void loadDetail();
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleDelete() {
        const ok = await confirmDialog({
            title: "Eliminar tenant",
            description: `Tem certeza que deseja eliminar o tenant "${tenantId}"? O tenant ficará inativo e os usuários não poderão acessá-lo.`,
            confirmText: "Eliminar",
            destructive: true,
        });
        if (!ok) return;
        setBusy(true);
        try {
            await fetchJson(`/api/owner/tenants/${encodeURIComponent(tenantId)}`, { method: "DELETE" });
            toast.success(`Tenant "${tenantId}" desativado.`);
            router.push("/Owner/Tenants");
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(false);
        }
    }

    async function handleAccessTenant() {
        setBusy(true);
        try {
            const res = await apiFetch(`/api/me/switch-tenant`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                toast.error(json?.message || "Falha ao acessar tenant.");
                return;
            }
            const parsed = ApiSwitchTenantResponseSchema.safeParse(json);
            if (!parsed.success) {
                toast.error("Resposta inválida ao acessar tenant.");
                return;
            }

            setAccessToken(parsed.data.accessToken);
            setTenantId(parsed.data.tenantId);

            window.location.href = "/app/dashboard";
        } catch {
            toast.error("Erro ao acessar tenant.");
        } finally {
            setBusy(false);
        }
    }

    /* ─── Loading ─── */
    if (loading) {
        return (
            <div className="flex items-center justify-center py-32">
                <Loader2 className="size-7 animate-spin text-lt-brand" />
            </div>
        );
    }

    if (!detail) {
        return (
            <div className="text-center py-20 text-muted-foreground">
                Não foi possível carregar os detalhes do tenant.
                <div className="mt-4">
                    <Button variant="outline" asChild>
                        <Link href="/Owner/Tenants"><ArrowLeft className="size-4 mr-1" />Voltar à lista</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const { tenant, migrationStatus } = detail;
    const showMigrateBtn = migrationStatus && !migrationStatus.isUpToDate && migrationStatus.pendingCount > 0 && !migrationStatus.errorMessage;

    return (
        <div>
            {/* ─── Header ─── */}
            <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">Detalhes do tenant</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        TenantId: <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{tenant.tenantId}</code>
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/Owner/Tenants">
                        <ArrowLeft className="size-4 mr-1.5" />
                        Voltar à lista
                    </Link>
                </Button>
            </div>

            {/* ─── Tab bar (11 tabs matching Razor) ─── */}
            <div className="overflow-x-auto mb-5">
                <div className="flex gap-0.5 border-b border-[var(--lt-border)] min-w-max">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${activeTab === tab.key
                                ? "border-lt-brand text-lt-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                                }`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ─── Tab content ─── */}
            {activeTab === "geral" ? (
                <div className="space-y-5">
                    {/* Info card */}
                    <Card className="shadow-lt">
                        <CardContent className="pt-6">
                            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-[200px_1fr]">
                                <dt className="text-sm font-semibold text-muted-foreground">TenantId</dt>
                                <dd className="font-mono font-medium">{tenant.tenantId}</dd>

                                <dt className="text-sm font-semibold text-muted-foreground">Nome</dt>
                                <dd className="font-medium">{tenant.name}</dd>

                                <dt className="text-sm font-semibold text-muted-foreground">Ativo</dt>
                                <dd>{tenant.isActive ? <StatusBadge variant="success" label="Sim" /> : <StatusBadge variant="muted" label="Não" />}</dd>

                                <dt className="text-sm font-semibold text-muted-foreground">Criado em</dt>
                                <dd className="text-sm">{new Date(tenant.createdAtUtc).toLocaleString("pt-BR")} (UTC)</dd>

                                <dt className="text-sm font-semibold text-muted-foreground">Atualizado em</dt>
                                <dd className="text-sm">{new Date(tenant.updatedAtUtc).toLocaleString("pt-BR")} (UTC)</dd>

                                <dt className="text-sm font-semibold text-muted-foreground">Criado por</dt>
                                <dd className="text-sm">{tenant.createdByOwnerEmail ?? "—"}</dd>

                                {migrationStatus && (
                                    <>
                                        <dt className="text-sm font-semibold text-muted-foreground">Schema (Migrações)</dt>
                                        <dd>
                                            {migrationStatus.errorMessage ? (
                                                <StatusBadge variant="error" label="Erro" title={migrationStatus.errorMessage} />
                                            ) : migrationStatus.isUpToDate ? (
                                                <StatusBadge variant="success" label="Ok" />
                                            ) : migrationStatus.pendingCount > 0 ? (
                                                <StatusBadge variant="warning" label={`Pendente (${migrationStatus.pendingCount})`} />
                                            ) : (
                                                <StatusBadge variant="muted" label="—" />
                                            )}
                                        </dd>
                                    </>
                                )}
                            </dl>
                        </CardContent>
                    </Card>

                    {/* Actions card */}
                    <Card className="shadow-lt">
                        <CardHeader>
                            <CardTitle className="text-base">Ações</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={handleAccessTenant}
                                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                                    disabled={busy}
                                >
                                    <LogIn className="size-4 mr-1.5" />
                                    Acessar tenant
                                </Button>

                                <Button variant="outline" onClick={() => setActiveTab("usuarios")}>
                                    <Users className="size-4 mr-1.5" />
                                    Usuários do tenant
                                </Button>

                                {showMigrateBtn && (
                                    <Button variant="outline" onClick={() => void handleApplyMigrations()} disabled={busy}>
                                        {busy ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Database className="size-4 mr-1.5" />}
                                        Aplicar migrações
                                    </Button>
                                )}

                                <Button variant="outline" onClick={() => void handleSeed()} disabled={busy}>
                                    <Sprout className="size-4 mr-1.5" />
                                    Executar seed
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Danger zone */}
                    {tenant.isActive && (
                        <Card className="border-red-200 dark:border-red-800">
                            <CardContent className="pt-6">
                                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 mb-1">
                                    Eliminar tenant
                                </h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                    O tenant ficará inativo e todos os usuários deixarão de poder acessá-lo. Os dados não são removidos.
                                </p>
                                <Button
                                    variant="destructive"
                                    onClick={() => void handleDelete()}
                                    disabled={busy}
                                >
                                    <Trash2 className="size-4 mr-1.5" />
                                    Eliminar tenant
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            ) : activeTab === "usuarios" ? (
                <TabUsuarios tenantId={tenantId} />
            ) : activeTab === "acessos" ? (
                <TabAcessos tenantId={tenantId} />
            ) : activeTab === "menus" ? (
                <TabMenus tenantId={tenantId} />
            ) : activeTab === "logs" ? (
                <TabLogsTransacionais tenantId={tenantId} />
            ) : activeTab === "logs-op" ? (
                <TabLogsOperacionais tenantId={tenantId} />
            ) : activeTab === "email-templates" ? (
                <TabEmailTemplates tenantId={tenantId} />
            ) : activeTab === "emails" ? (
                <TabEmails tenantId={tenantId} />
            ) : activeTab === "email-config" ? (
                <TabEmailConfig tenantId={tenantId} />
            ) : activeTab === "entra-id" ? (
                <TabEntraIdConfig tenantId={tenantId} />
            ) : activeTab === "idioma" ? (
                <TabIdioma tenantId={tenantId} />
            ) : null}
        </div>
    );
}

/* ─── Status Badge ─── */

function StatusBadge({ variant, label, title }: { variant: "success" | "warning" | "error" | "muted"; label: string; title?: string }) {
    const classes: Record<string, string> = {
        success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
        warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
        muted: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
    };
    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes[variant]}`}
            title={title}
        >
            {label}
        </span>
    );
}
