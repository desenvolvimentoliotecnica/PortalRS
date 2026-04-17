"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
    RotateCcw,
    ScrollText,
    CheckCircle2,
    XCircle,
    Circle,
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
import { getAccessToken, setAccessToken, setTenantId, tryGetTenantIdFromJwt } from "@/lib/session";

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

/** When the owner previously accessed a tenant (switch-tenant), the JWT has a real
 *  tenant claim instead of "owner". This causes 401 on /api/owner/* endpoints because
 *  OnTokenValidated checks that the JWT tenant claim matches the TenantContext (set to
 *  "owner" by TenantMiddleware). This function restores the owner JWT via switch-tenant. */
async function tryRestoreOwnerJwt(): Promise<boolean> {
    try {
        const res = await apiFetch("/api/me/switch-tenant", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tenantId: "owner" }),
        });
        if (!res.ok) return false;
        const json = await res.json().catch(() => null);
        const parsed = ApiSwitchTenantResponseSchema.safeParse(json);
        if (!parsed.success) return false;
        setAccessToken(parsed.data.accessToken);
        setTenantId(parsed.data.tenantId);
        return true;
    } catch {
        return false;
    }
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs?: number): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    }, timeoutMs);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        let msg = `HTTP_${res.status}`;
        try {
            const j = JSON.parse(text);
            msg = j?.detail || j?.title || j?.error || j?.message || msg;
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

type LogLine = { type: "info" | "running" | "ok" | "error" | "done"; text: string };
type MigrationLogState = {
    open: boolean;
    tenantId: string | null;
    lines: LogLine[];
    status: "idle" | "running" | "done" | "error";
};

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

    // Migration log modal
    const [migLog, setMigLog] = useState<MigrationLogState>({
        open: false, tenantId: null, lines: [], status: "idle",
    });
    const logBottomRef = useRef<HTMLDivElement>(null);

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

        (async () => {
            // If the JWT tenant claim is not "owner" (e.g. after switch-tenant + back navigation),
            // silently restore the owner session before loading.
            const token = getAccessToken();
            const jwtTenant = tryGetTenantIdFromJwt(token ?? "");
            if (jwtTenant && jwtTenant.toLowerCase() !== "owner") {
                const restored = await tryRestoreOwnerJwt();
                if (!restored) {
                    if (alive) {
                        toast.error("Sessão expirada. Faça login novamente.");
                        setLoading(false);
                    }
                    return;
                }
                // Reload so useAuth re-reads the new owner JWT and the sidebar
                // switches back to the owner menu items.
                window.location.replace(window.location.href);
                return;
            }

            syncList()
                .catch(() => toast.error("Falha ao carregar tenants."))
                .finally(() => {
                    if (alive) setLoading(false);
                });
        })();

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
            }, 120_000); // 2 min — provisionar banco + migrations leva mais que o default de 15s
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

    async function handleReactivate(tenantId: string) {
        setBusy(tenantId);
        try {
            await fetchJson(`/api/owner/tenants/${encodeURIComponent(tenantId)}/reactivate`, { method: "POST" });
            toast.success(`Tenant "${tenantId}" reativado.`);
            await syncList();
        } catch (err) {
            toast.error(`Erro: ${(err as Error).message}`);
        } finally {
            setBusy(null);
        }
    }

    function handleOpenMigrationLogs(tenantId: string) {
        setMigLog({ open: true, tenantId, lines: [], status: "running" });

        const addLine = (line: LogLine) =>
            setMigLog((prev) => ({ ...prev, lines: [...prev.lines, line] }));

        (async () => {
            setBusy(tenantId);
            try {
                const res = await apiFetch(
                    `/api/owner/tenants/${encodeURIComponent(tenantId)}/migrations/apply-stream`,
                    { cache: "no-store" },
                    10 * 60_000,
                );
                if (!res.ok || !res.body) {
                    addLine({ type: "error", text: `Erro HTTP ${res.status}` });
                    setMigLog((prev) => ({ ...prev, status: "error" }));
                    return;
                }

                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const chunks = buffer.split("\n\n");
                    buffer = chunks.pop() ?? "";
                    for (const chunk of chunks) {
                        const raw = chunk.replace(/^data:\s*/, "").trim();
                        if (!raw) continue;
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const ev = JSON.parse(raw) as Record<string, any>;
                            if (ev.step === "start") {
                                addLine({ type: "info", text: `${ev.total} migration(s) pendente(s). Iniciando...` });
                            } else if (ev.step === "running") {
                                addLine({ type: "running", text: `⏳ Aplicando: ${ev.name}` });
                            } else if (ev.step === "ok") {
                                addLine({ type: "ok", text: `✔ OK: ${ev.name}` });
                            } else if (ev.step === "done") {
                                addLine({ type: "done", text: ev.message ?? "Concluído." });
                                setMigLog((prev) => ({ ...prev, status: "done" }));
                                await syncList();
                            } else if (ev.step === "error") {
                                const detail = [ev.name, ev.message, ev.inner].filter(Boolean).join(" — ");
                                addLine({ type: "error", text: `✖ ERRO: ${detail}` });
                                setMigLog((prev) => ({ ...prev, status: "error" }));
                                await syncList();
                            }
                        } catch { /* linha mal formada, ignorar */ }
                    }
                }
            } catch (err) {
                addLine({ type: "error", text: `Conexão encerrada: ${(err as Error).message}` });
                setMigLog((prev) => ({ ...prev, status: "error" }));
            } finally {
                setBusy(null);
            }
        })();
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

    // Auto-scroll para o final do log conforme chegam novas linhas
    useEffect(() => {
        logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [migLog.lines]);

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
                                        <TableCell colSpan={6} className="text-center py-10">
                                            <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                                            <p className="text-muted-foreground text-sm mt-2">Carregando tenants...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filtered.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="text-center text-muted-foreground text-sm py-10"
                                        >
                                            {q ? "Nenhum tenant encontrado com esse filtro." : "Nenhum tenant cadastrado."}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filtered.map((t) => (
                                        <TableRow key={t.tenantId} className="group">
                                            <TableCell className="font-medium font-mono">
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
                                            <TableCell className="text-xs text-muted-foreground">
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

                                                    {t.isActive ? (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleAccessTenant(t.tenantId)}
                                                            disabled={busy === t.tenantId}
                                                            className="bg-emerald-600 text-white hover:bg-emerald-700"
                                                        >
                                                            <LogIn className="size-3.5" />
                                                            <span className="hidden sm:inline">Acessar</span>
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleReactivate(t.tenantId)}
                                                            disabled={busy === t.tenantId}
                                                        >
                                                            {busy === t.tenantId ? (
                                                                <Loader2 className="size-3.5 animate-spin" />
                                                            ) : (
                                                                <RotateCcw className="size-3.5" />
                                                            )}
                                                            <span className="hidden sm:inline">Reativar</span>
                                                        </Button>
                                                    )}

                                                    {t.isActive && (t.isUpToDate === false || t.migrationError) && (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleOpenMigrationLogs(t.tenantId)}
                                                                disabled={busy === t.tenantId}
                                                                className={t.migrationError ? "border-red-400 text-red-600 hover:bg-red-50 dark:hover:bg-red-950" : ""}
                                                            >
                                                                {busy === t.tenantId ? (
                                                                    <Loader2 className="size-3.5 animate-spin" />
                                                                ) : (
                                                                    <ScrollText className="size-3.5" />
                                                                )}
                                                                <span className="hidden lg:inline">
                                                                    {t.migrationError ? "Ver erro" : "Migrar"}
                                                                </span>
                                                            </Button>
                                                        )}

                                                    {t.isActive && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleDelete(t.tenantId)}
                                                            disabled={busy === t.tenantId}
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

            {/* ── Migration Log Dialog ── */}
            <Dialog
                open={migLog.open}
                onOpenChange={(open) => {
                    if (!open && migLog.status === "running") return; // impede fechar enquanto roda
                    setMigLog((prev) => ({ ...prev, open }));
                }}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Database className="size-5" />
                            Migração — <code className="text-sm font-mono">{migLog.tenantId}</code>
                        </DialogTitle>
                        <DialogDescription>
                            Acompanhe o progresso das migrações em tempo real.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Console */}
                    <div className="bg-zinc-950 rounded-lg border border-zinc-800 h-72 overflow-y-auto p-3 font-mono text-xs leading-5">
                        {migLog.lines.length === 0 && migLog.status === "running" && (
                            <span className="text-zinc-500 flex items-center gap-2">
                                <Loader2 className="size-3 animate-spin" /> Conectando...
                            </span>
                        )}
                        {migLog.lines.map((line, i) => {
                            const color =
                                line.type === "ok" ? "text-emerald-400" :
                                line.type === "error" ? "text-red-400" :
                                line.type === "done" ? "text-sky-400" :
                                line.type === "running" ? "text-amber-400" :
                                "text-zinc-400";
                            const Icon =
                                line.type === "ok" ? CheckCircle2 :
                                line.type === "error" ? XCircle :
                                line.type === "done" ? CheckCircle2 :
                                line.type === "running" ? Circle :
                                null;
                            return (
                                <div key={i} className={`flex items-start gap-1.5 ${color}`}>
                                    {Icon && <Icon className="size-3 mt-0.5 shrink-0" />}
                                    <span className="break-all">{line.text}</span>
                                </div>
                            );
                        })}
                        {migLog.status === "running" && migLog.lines.length > 0 && (
                            <span className="text-zinc-500 flex items-center gap-2 mt-1">
                                <Loader2 className="size-3 animate-spin" /> aguardando...
                            </span>
                        )}
                        <div ref={logBottomRef} />
                    </div>

                    <DialogFooter>
                        {migLog.status === "running" ? (
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                <Loader2 className="size-3 animate-spin" /> Aplicando migrações...
                            </span>
                        ) : migLog.status === "done" ? (
                            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5" /> Concluído com sucesso
                            </span>
                        ) : migLog.status === "error" ? (
                            <span className="text-xs text-red-600 font-medium flex items-center gap-1.5">
                                <XCircle className="size-3.5" /> Erro durante a migração
                            </span>
                        ) : null}
                        <Button
                            variant="outline"
                            onClick={() => setMigLog((prev) => ({ ...prev, open: false }))}
                            disabled={migLog.status === "running"}
                        >
                            Fechar
                        </Button>
                        {(migLog.status === "done" || migLog.status === "error") && migLog.tenantId && (
                            <Button
                                onClick={() => {
                                    setMigLog({ open: true, tenantId: migLog.tenantId, lines: [], status: "running" });
                                    handleOpenMigrationLogs(migLog.tenantId!);
                                }}
                            >
                                <RotateCcw className="size-3.5" /> Tentar novamente
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
