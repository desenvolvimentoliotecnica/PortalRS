"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { confirmDialog } from "@/lib/confirm-dialog";
import {
    Building2,
    Plus,
    Info,
    Trash2,
    LogIn,
    Database,
    Sprout,
    Loader2,
    Search,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { ApiSwitchTenantResponseSchema } from "@/lib/schemas/api";
import { setAccessToken, setTenantId } from "@/lib/session";

/* ─── Types ─── */

type TenantWithStatus = {
    tenantId: string;
    name: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
    isUpToDate: boolean | null;
    pendingCount: number;
    migrationError: string | null;
};

type ApiTenantListItem = {
    tenantId: string;
    name: string;
    isActive: boolean;
    createdAtUtc: string;
    updatedAtUtc: string;
};

type ApiTenantMigrationStatus = {
    tenantId: string;
    isUpToDate: boolean;
    pendingCount: number;
    pendingMigrationIds: string[];
    errorMessage: string | null;
};

/* ─── API helpers ─── */

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
        try {
            const j = JSON.parse(text);
            msg = j?.error || j?.message || msg;
        } catch { /* plain text */ }
        throw new Error(msg);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

/* ─── Badge Components ─── */

function MigrationBadge({ t }: { t: TenantWithStatus }) {
    if (t.migrationError) {
        return (
            <span
                className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400"
                title={t.migrationError}
            >
                Erro
            </span>
        );
    }
    if (t.isUpToDate === true) {
        return (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Ok
            </span>
        );
    }
    if (t.pendingCount > 0) {
        return (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                Pendente ({t.pendingCount})
            </span>
        );
    }
    return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            —
        </span>
    );
}

function ActiveBadge({ active }: { active: boolean }) {
    return active ? (
        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Sim
        </span>
    ) : (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            Não
        </span>
    );
}

/* ─── Main Component ─── */

export default function TenantsScreen() {
    const [loading, setLoading] = useState(true);
    const [rows, setRows] = useState<TenantWithStatus[]>([]);
    const [q, setQ] = useState("");
    const [busy, setBusy] = useState<string | null>(null);

    // Create dialog
    const [createOpen, setCreateOpen] = useState(false);
    const [newTenantId, setNewTenantId] = useState("");
    const [newName, setNewName] = useState("");
    const [creating, setCreating] = useState(false);

    /* ─── Fetch list ─── */
    async function syncList() {
        const [tenants, statuses] = await Promise.all([
            fetchJson<ApiTenantListItem[]>(`/api/owner/tenants`),
            fetchJson<ApiTenantMigrationStatus[]>(`/api/owner/tenants/migrations/status`),
        ]);

        const statusByTenant = new Map<string, ApiTenantMigrationStatus>();
        (Array.isArray(statuses) ? statuses : []).forEach((s) => {
            const key = String(s?.tenantId ?? "").toLowerCase();
            if (key) statusByTenant.set(key, s);
        });

        const merged: TenantWithStatus[] = (Array.isArray(tenants) ? tenants : []).map((t) => {
            const key = String(t?.tenantId ?? "").toLowerCase();
            const st = statusByTenant.get(key) ?? null;
            return {
                tenantId: String(t?.tenantId ?? ""),
                name: String(t?.name ?? ""),
                isActive: !!t?.isActive,
                createdAtUtc: String(t?.createdAtUtc ?? ""),
                updatedAtUtc: String(t?.updatedAtUtc ?? ""),
                isUpToDate: st ? !!st.isUpToDate : null,
                pendingCount: st ? Number(st.pendingCount ?? 0) : 0,
                migrationError: st ? (st.errorMessage ?? null) : null,
            };
        });

        setRows(merged);
    }

    useEffect(() => {
        let alive = true;
        setLoading(true);
        syncList()
            .catch(() => toast.error("Falha ao carregar tenants."))
            .finally(() => {
                if (alive) setLoading(false);
            });
        return () => {
            alive = false;
        };
    }, []);

    /* ─── Filter ─── */
    const filtered = useMemo(() => {
        const qq = q.trim().toLowerCase();
        if (!qq) return rows;
        return rows.filter(
            (t) =>
                t.tenantId.toLowerCase().includes(qq) ||
                t.name.toLowerCase().includes(qq),
        );
    }, [q, rows]);

    /* ─── Actions ─── */

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!newTenantId.trim() || !newName.trim()) return;
        setCreating(true);
        try {
            await fetchJson(`/api/owner/tenants`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantId: newTenantId, name: newName }),
            });
            const createdId = newTenantId.trim();
            toast.success(`Tenant "${createdId}" criado com sucesso!`, {
                action: {
                    label: "Acessar agora",
                    onClick: () => void handleAccessTenant(createdId),
                },
            });
            setCreateOpen(false);
            setNewTenantId("");
            setNewName("");
            await syncList();
        } catch (err) {
            toast.error(`Erro ao criar tenant: ${(err as Error).message}`);
        } finally {
            setCreating(false);
        }
    }

    async function handleDelete(tenantId: string) {
        const ok = await confirmDialog({
            title: "Eliminar tenant",
            description: `Tem certeza que deseja eliminar o tenant "${tenantId}"? O tenant ficará inativo e os usuários não poderão acessá-lo.`,
            confirmText: "Eliminar",
            destructive: true,
        });
        if (!ok) return;
        setBusy(tenantId);
        try {
            await fetchJson(`/api/owner/tenants/${encodeURIComponent(tenantId)}`, { method: "DELETE" });
            toast.success(`Tenant "${tenantId}" desativado.`);
            await syncList();
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(null);
        }
    }

    async function handleApplyMigrations(tenantId: string) {
        setBusy(tenantId);
        try {
            const result = await fetchJson<{ appliedCount: number }>(
                `/api/owner/tenants/${encodeURIComponent(tenantId)}/migrations/apply`,
                { method: "POST" },
            );
            toast.success(`Migrações aplicadas (${result?.appliedCount ?? 0}).`);
            await syncList();
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(null);
        }
    }

    async function handleSeed(tenantId: string) {
        setBusy(tenantId);
        try {
            const result = await fetchJson<{ message?: string }>(
                `/api/owner/tenants/${encodeURIComponent(tenantId)}/seed`,
                { method: "POST" },
            );
            toast.success(result?.message || "Seed executado com sucesso.");
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(null);
        }
    }

    async function handleAccessTenant(tenantId: string) {
        setBusy(tenantId);
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
            setBusy(null);
        }
    }

    /* ─── Render ─── */
    return (
        <section className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
                    <p className="text-muted-foreground text-sm mt-0.5">
                        Gerencie tenants do sistema. A coluna Schema indica se o banco está em dia com as migrações.
                    </p>
                </div>
                <Button
                    onClick={() => setCreateOpen(true)}
                    className="bg-[rgb(var(--lt-brand))] hover:bg-[rgb(var(--lt-primary))] text-white"
                >
                    <Plus className="size-4" />
                    Criar tenant
                </Button>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                    placeholder="Buscar por ID ou nome..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    className="pl-9"
                />
            </div>

            {/* Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[140px]">TenantId</TableHead>
                                    <TableHead className="min-w-[160px]">Nome</TableHead>
                                    <TableHead className="min-w-[80px]">Ativo</TableHead>
                                    <TableHead className="min-w-[140px]">Schema</TableHead>
                                    <TableHead className="min-w-[130px]">Criado em</TableHead>
                                    <TableHead className="min-w-[280px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12">
                                            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                                            <p className="text-muted-foreground text-sm mt-2">Carregando tenants...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center text-muted-foreground py-12"
                                        >
                                            {q ? "Nenhum tenant encontrado com esse filtro." : "Nenhum tenant cadastrado."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((t) => (
                                        <TableRow key={t.tenantId} className="group">
                                            <TableCell className="font-mono text-sm font-medium">
                                                {t.tenantId}
                                            </TableCell>
                                            <TableCell>
                                                <Link
                                                    href={`/Owner/Tenants?id=${encodeURIComponent(t.tenantId)}`}
                                                    className="font-medium text-[rgb(var(--lt-brand))] hover:underline"
                                                >
                                                    {t.name}
                                                </Link>
                                            </TableCell>
                                            <TableCell>
                                                <ActiveBadge active={t.isActive} />
                                            </TableCell>
                                            <TableCell>
                                                <MigrationBadge t={t} />
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                                {new Date(t.createdAtUtc).toLocaleDateString("pt-BR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        asChild
                                                    >
                                                        <Link href={`/Owner/Tenants?id=${encodeURIComponent(t.tenantId)}`}>
                                                            <Info className="size-3.5" />
                                                            <span className="hidden sm:inline">Detalhes</span>
                                                        </Link>
                                                    </Button>

                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleAccessTenant(t.tenantId)}
                                                        disabled={busy === t.tenantId}
                                                        className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                    >
                                                        <LogIn className="size-3.5" />
                                                        <span className="hidden sm:inline">Acessar</span>
                                                    </Button>

                                                    {t.isUpToDate === false &&
                                                        t.pendingCount > 0 &&
                                                        !t.migrationError && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleApplyMigrations(t.tenantId)}
                                                                disabled={busy === t.tenantId}
                                                            >
                                                                {busy === t.tenantId ? (
                                                                    <Loader2 className="size-3.5 animate-spin" />
                                                                ) : (
                                                                    <Database className="size-3.5" />
                                                                )}
                                                                <span className="hidden lg:inline">Migrar</span>
                                                            </Button>
                                                        )}

                                                    {t.isActive && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleDelete(t.tenantId)}
                                                            disabled={busy === t.tenantId}
                                                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                                                        >
                                                            <Trash2 className="size-3.5" />
                                                            <span className="hidden lg:inline">Eliminar</span>
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
                {!loading && filtered.length > 0 && (
                    <CardFooter className="border-t px-6 py-3">
                        <p className="text-xs text-muted-foreground">
                            {filtered.length} tenant{filtered.length !== 1 ? "s" : ""}
                            {q && ` filtrado${filtered.length !== 1 ? "s" : ""}`}
                        </p>
                    </CardFooter>
                )}
            </Card>

            {/* ── Create Dialog ── */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building2 className="size-5" />
                            Criar tenant
                        </DialogTitle>
                        <DialogDescription>
                            Novo tenant será criado no master e o banco de dados será provisionado.
                            Um usuário admin (<code className="text-xs">admin@dev.local</code>) será
                            criado com a senha definida em <code className="text-xs">Seed:AdminPassword</code>.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreate} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="newTenantId">
                                TenantId
                            </label>
                            <Input
                                id="newTenantId"
                                value={newTenantId}
                                onChange={(e) => setNewTenantId(e.target.value)}
                                placeholder="ex: qualiit"
                                required
                                maxLength={64}
                                pattern="[a-zA-Z0-9][a-zA-Z0-9\-]{1,62}"
                                disabled={creating}
                            />
                            <p className="text-xs text-muted-foreground">
                                Letras, números e hífen (2–63 caracteres). Será armazenado em minúsculas.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="newName">
                                Nome
                            </label>
                            <Input
                                id="newName"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="ex: Qualiit"
                                required
                                maxLength={120}
                                disabled={creating}
                            />
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setCreateOpen(false)}
                                disabled={creating}
                            >
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={creating}>
                                {creating ? (
                                    <>
                                        <Loader2 className="size-4 animate-spin" />
                                        Criando...
                                    </>
                                ) : (
                                    "Criar tenant"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
