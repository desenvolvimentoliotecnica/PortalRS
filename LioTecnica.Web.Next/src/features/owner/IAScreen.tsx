"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Brain,
    Filter,
    Key,
    Loader2,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = `${getBackendUrl()}/Owner/IA/_api`;

/* ─── Types ─── */

interface AiKey {
    id: string;
    provider: string;
    name: string;
    isActive: boolean;
    isDefault: boolean;
}

interface AiModel {
    id: string;
    aiProviderKeyId: string;
    modelId: string;
    displayName: string;
    isDefault: boolean;
}

interface UsageSummaryTenant {
    tenantId: string;
    totalCost: number;
    usageCount: number;
}

interface UsageSummaryUser {
    tenantId: string;
    userId?: number;
    userName?: string;
    totalCost: number;
    usageCount: number;
}

interface UsageDetail {
    createdAtUtc: string;
    tenantId: string;
    userId?: number;
    userName?: string;
    module: string;
    modelDisplayName?: string;
    cost: number;
    actionDescription?: string;
    requestMessage?: string;
}

/* ─── Helpers ─── */

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T | null> {
    const res = await fetch(url, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...((options.headers as Record<string, string>) || {}) },
        ...options,
    });
    if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
    if (res.status === 204) return null;
    return res.json() as Promise<T>;
}

/* ══════════════════════════════════════════════════════════════ */

export default function IAScreen() {
    const [activeTab, setActiveTab] = useState<"config" | "dashboard">("config");

    return (
        <div>
            <div className="flex items-end justify-between gap-4 mb-5">
                <div>
                    <h1 className="text-2xl font-extrabold tracking-tight">IA</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Configuração de chaves e modelos, relatórios e detalhes de uso por tenant e usuário.
                    </p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 mb-5 border-b border-[var(--lt-border)]">
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "config" ? "border-lt-brand text-lt-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setActiveTab("config")}
                >
                    Configuração
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === "dashboard" ? "border-lt-brand text-lt-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setActiveTab("dashboard")}
                >
                    Dashboard (relatórios e detalhes)
                </button>
            </div>

            {activeTab === "config" ? <ConfigTab /> : <DashboardTab />}
        </div>
    );
}

/* ══════════════════════════════════════════════════════════════
   CONFIG TAB — API Keys + Models
   ══════════════════════════════════════════════════════════════ */

function ConfigTab() {
    const [keys, setKeys] = useState<AiKey[]>([]);
    const [models, setModels] = useState<AiModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyDialog, setKeyDialog] = useState(false);
    const [modelDialog, setModelDialog] = useState(false);
    const [editingKey, setEditingKey] = useState<AiKey | null>(null);
    const [editingModel, setEditingModel] = useState<AiModel | null>(null);

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [k, m] = await Promise.all([
                apiFetch<AiKey[]>(`${BASE}/keys`),
                apiFetch<AiModel[]>(`${BASE}/models`),
            ]);
            setKeys(k ?? []);
            setModels(m ?? []);
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao carregar dados.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadAll(); }, [loadAll]);

    function keysMap(): Record<string, AiKey> {
        return keys.reduce<Record<string, AiKey>>((acc, k) => { acc[k.id] = k; return acc; }, {});
    }

    async function deleteKey(id: string) {
        if (!confirm("Excluir esta chave? Modelos vinculados a ela deixarão de funcionar até você vincular a outra chave.")) return;
        try {
            await apiFetch(`${BASE}/keys/${id}`, { method: "DELETE" });
            toast.success("Chave excluída.");
            void loadAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
        }
    }

    async function deleteModel(id: string) {
        if (!confirm("Excluir este modelo?")) return;
        try {
            await apiFetch(`${BASE}/models/${id}`, { method: "DELETE" });
            toast.success("Modelo excluído.");
            void loadAll();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao excluir.");
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-lt-brand" />
            </div>
        );
    }

    const km = keysMap();

    return (
        <div className="space-y-6">
            {/* ── API Keys ── */}
            <Card className="shadow-lt">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Key className="size-4 text-lt-brand" />
                        Chaves de API
                    </CardTitle>
                    <Button size="sm" onClick={() => { setEditingKey(null); setKeyDialog(true); }}>
                        <Plus className="size-3.5 mr-1" /> Nova chave
                    </Button>
                </CardHeader>
                <CardContent>
                    {keys.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Nenhuma chave cadastrada. Clique em Nova chave para adicionar.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Provedor</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Ativo</TableHead>
                                        <TableHead>Padrão</TableHead>
                                        <TableHead className="w-[100px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {keys.map((k) => (
                                        <TableRow key={k.id}>
                                            <TableCell>{k.provider}</TableCell>
                                            <TableCell>{k.name}</TableCell>
                                            <TableCell>{k.isActive ? "Sim" : "Não"}</TableCell>
                                            <TableCell>{k.isDefault ? "Sim" : "—"}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setEditingKey(k); setKeyDialog(true); }}>
                                                    <Pencil className="size-3" />
                                                </Button>
                                                <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => void deleteKey(k.id)}>
                                                    <Trash2 className="size-3" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ── Models ── */}
            <Card className="shadow-lt">
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Brain className="size-4 text-lt-brand" />
                        Modelos
                    </CardTitle>
                    <Button
                        size="sm"
                        onClick={() => {
                            if (keys.length === 0) {
                                toast.info("Cadastre pelo menos uma chave antes de adicionar um modelo.");
                                return;
                            }
                            setEditingModel(null);
                            setModelDialog(true);
                        }}
                    >
                        <Plus className="size-3.5 mr-1" /> Novo modelo
                    </Button>
                </CardHeader>
                <CardContent>
                    {models.length === 0 ? (
                        <p className="text-muted-foreground text-sm">Nenhum modelo cadastrado. Cadastre uma chave antes e depois clique em Novo modelo.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Chave (provedor)</TableHead>
                                        <TableHead>ModelId</TableHead>
                                        <TableHead>Nome</TableHead>
                                        <TableHead>Padrão</TableHead>
                                        <TableHead className="w-[100px]" />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {models.map((m) => {
                                        const keyInfo = km[m.aiProviderKeyId];
                                        return (
                                            <TableRow key={m.id}>
                                                <TableCell>{keyInfo ? `${keyInfo.name} (${keyInfo.provider})` : m.aiProviderKeyId}</TableCell>
                                                <TableCell><code className="text-xs">{m.modelId}</code></TableCell>
                                                <TableCell>{m.displayName}</TableCell>
                                                <TableCell>{m.isDefault ? "Sim" : "—"}</TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => { setEditingModel(m); setModelDialog(true); }}>
                                                        <Pencil className="size-3" />
                                                    </Button>
                                                    <Button variant="outline" size="icon" className="h-7 w-7 text-destructive" onClick={() => void deleteModel(m.id)}>
                                                        <Trash2 className="size-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dialogs */}
            <KeyDialog open={keyDialog} onOpenChange={setKeyDialog} initial={editingKey} onSaved={loadAll} />
            <ModelDialog open={modelDialog} onOpenChange={setModelDialog} initial={editingModel} keys={keys.filter((k) => k.isActive)} onSaved={loadAll} />
        </div>
    );
}

/* ─── Key Dialog ─── */

function KeyDialog({ open, onOpenChange, initial, onSaved }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    initial: AiKey | null;
    onSaved: () => void;
}) {
    const [provider, setProvider] = useState("");
    const [name, setName] = useState("");
    const [keyValue, setKeyValue] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [isDefault, setIsDefault] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setProvider(initial?.provider ?? "");
            setName(initial?.name ?? "");
            setKeyValue("");
            setIsActive(initial?.isActive ?? true);
            setIsDefault(initial?.isDefault ?? false);
        }
    }, [open, initial]);

    async function save() {
        if (!provider) { toast.error("Selecione o provedor."); return; }
        if (!name) { toast.error("Informe o nome."); return; }
        if (!initial && !keyValue) { toast.error("Informe a chave (API Key)."); return; }
        setSaving(true);
        try {
            if (initial) {
                await apiFetch(`${BASE}/keys/${initial.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ name, isActive, isDefault, key: keyValue || null }),
                });
                toast.success("Chave atualizada.");
            } else {
                await apiFetch(`${BASE}/keys`, {
                    method: "POST",
                    body: JSON.stringify({ provider, name, key: keyValue, isDefault }),
                });
                toast.success("Chave cadastrada.");
            }
            onOpenChange(false);
            onSaved();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{initial ? "Editar chave de API" : "Nova chave de API"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Provedor</label>
                        <select
                            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={provider}
                            onChange={(e) => setProvider(e.target.value)}
                            disabled={!!initial}
                        >
                            <option value="">Selecione...</option>
                            <option value="Gemini">Gemini (Google)</option>
                            <option value="Gpt">GPT (OpenAI / Azure)</option>
                            <option value="Claude">Claude (Anthropic)</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Nome</label>
                        <Input className="mt-1" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">API Key</label>
                        <Input
                            className="mt-1 font-mono text-xs"
                            value={keyValue}
                            onChange={(e) => setKeyValue(e.target.value)}
                            placeholder={initial ? "Deixe em branco para não alterar" : "Cole a API Key"}
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
                            Ativo
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
                            Padrão
                        </label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={() => void save()} disabled={saving}>
                        {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Model Dialog ─── */

function ModelDialog({ open, onOpenChange, initial, keys, onSaved }: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    initial: AiModel | null;
    keys: AiKey[];
    onSaved: () => void;
}) {
    const [keyId, setKeyId] = useState("");
    const [modelId, setModelId] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setKeyId(initial?.aiProviderKeyId ?? "");
            setModelId(initial?.modelId ?? "");
            setDisplayName(initial?.displayName ?? "");
            setIsDefault(initial?.isDefault ?? false);
        }
    }, [open, initial]);

    async function save() {
        if (!keyId) { toast.error("Selecione uma chave."); return; }
        if (!modelId) { toast.error("Informe o ModelId."); return; }
        if (!displayName) { toast.error("Informe o nome."); return; }
        setSaving(true);
        try {
            if (initial) {
                await apiFetch(`${BASE}/models/${initial.id}`, {
                    method: "PUT",
                    body: JSON.stringify({ modelId, displayName, isDefault }),
                });
                toast.success("Modelo atualizado.");
            } else {
                await apiFetch(`${BASE}/models`, {
                    method: "POST",
                    body: JSON.stringify({ aiProviderKeyId: keyId, modelId, displayName, isDefault }),
                });
                toast.success("Modelo cadastrado.");
            }
            onOpenChange(false);
            onSaved();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    const MODEL_SUGGESTIONS = [
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gpt-4o",
        "gpt-4o-mini",
        "claude-3-5-sonnet-20241022",
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{initial ? "Editar modelo" : "Novo modelo"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Chave (provedor)</label>
                        <select
                            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={keyId}
                            onChange={(e) => setKeyId(e.target.value)}
                            disabled={!!initial}
                        >
                            <option value="">Selecione uma chave...</option>
                            {keys.map((k) => (
                                <option key={k.id} value={k.id}>{k.name} ({k.provider})</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Tipo sugerido</label>
                        <select
                            className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                            defaultValue=""
                            onChange={(e) => { if (e.target.value) setModelId(e.target.value); }}
                        >
                            <option value="">Ou digite abaixo...</option>
                            {MODEL_SUGGESTIONS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">ModelId</label>
                        <Input className="mt-1 font-mono text-xs" value={modelId} onChange={(e) => setModelId(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground">Nome para exibição</label>
                        <Input className="mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="rounded" />
                        Padrão
                    </label>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={() => void save()} disabled={saving}>
                        {saving && <Loader2 className="size-3.5 mr-1 animate-spin" />}
                        Salvar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ══════════════════════════════════════════════════════════════
   DASHBOARD TAB — Filters + Usage summaries + Detail
   ══════════════════════════════════════════════════════════════ */

function DashboardTab() {
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [filterTenant, setFilterTenant] = useState("");
    const [filterModule, setFilterModule] = useState("");

    const [byTenant, setByTenant] = useState<{ byTenant: UsageSummaryTenant[]; totalCost: number; totalUsageCount: number } | null>(null);
    const [byUser, setByUser] = useState<{ byUser: UsageSummaryUser[]; totalCost: number; totalUsageCount: number } | null>(null);
    const [detail, setDetail] = useState<{ items: UsageDetail[]; totalPages: number } | null>(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    function buildQuery(extra: Record<string, string | number> = {}): string {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", new Date(fromDate).toISOString());
        if (toDate) params.set("to", new Date(toDate).toISOString());
        if (filterTenant) params.set("tenantId", filterTenant);
        if (filterModule) params.set("module", filterModule);
        Object.entries(extra).forEach(([k, v]) => { if (v != null && v !== "") params.set(k, String(v)); });
        return params.toString();
    }

    async function loadDashboard(p = 1) {
        setLoading(true);
        setPage(p);
        const qSummary = buildQuery();
        const qDetail = buildQuery({ page: p, pageSize: 20 });
        try {
            const [t, u, d] = await Promise.all([
                apiFetch<{ byTenant: UsageSummaryTenant[]; totalCost: number; totalUsageCount: number }>(`${BASE}/usage/summary-by-tenant${qSummary ? "?" + qSummary : ""}`).catch(() => null),
                apiFetch<{ byUser: UsageSummaryUser[]; totalCost: number; totalUsageCount: number }>(`${BASE}/usage/summary-by-user${qSummary ? "?" + qSummary : ""}`).catch(() => null),
                apiFetch<{ items: UsageDetail[]; totalPages: number }>(`${BASE}/usage/detail?${qDetail}`).catch(() => null),
            ]);
            setByTenant(t);
            setByUser(u);
            setDetail(d);
        } catch {
            toast.error("Erro ao carregar dashboard.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-5">
            {/* Filters */}
            <Card className="shadow-lt">
                <CardHeader>
                    <CardTitle className="text-base">Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">De</label>
                            <Input type="datetime-local" className="mt-1 w-auto" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Até</label>
                            <Input type="datetime-local" className="mt-1 w-auto" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Tenant</label>
                            <Input className="mt-1 w-32" placeholder="Opcional" value={filterTenant} onChange={(e) => setFilterTenant(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Módulo</label>
                            <Input className="mt-1 w-32" placeholder="Opcional" value={filterModule} onChange={(e) => setFilterModule(e.target.value)} />
                        </div>
                        <Button onClick={() => void loadDashboard(1)} disabled={loading}>
                            {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Filter className="size-3.5 mr-1" />}
                            Aplicar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Summaries side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* By Tenant */}
                <Card className="shadow-lt">
                    <CardHeader><CardTitle className="text-base">Resumo por tenant</CardTitle></CardHeader>
                    <CardContent>
                        {byTenant && byTenant.byTenant.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tenant</TableHead>
                                                <TableHead>Custo</TableHead>
                                                <TableHead>Chamadas</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {byTenant.byTenant.map((t, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><code className="text-xs">{t.tenantId}</code></TableCell>
                                                    <TableCell>{Number(t.totalCost).toFixed(4)}</TableCell>
                                                    <TableCell>{t.usageCount}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    <strong>Total:</strong> custo {Number(byTenant.totalCost).toFixed(4)}, {byTenant.totalUsageCount} chamadas
                                </p>
                            </>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {byTenant ? "Nenhum uso no período." : "Selecione período e clique em Aplicar."}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* By User */}
                <Card className="shadow-lt">
                    <CardHeader><CardTitle className="text-base">Resumo por usuário</CardTitle></CardHeader>
                    <CardContent>
                        {byUser && byUser.byUser.length > 0 ? (
                            <>
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Tenant</TableHead>
                                                <TableHead>Usuário</TableHead>
                                                <TableHead>Custo</TableHead>
                                                <TableHead>Chamadas</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {byUser.byUser.map((u, i) => (
                                                <TableRow key={i}>
                                                    <TableCell><code className="text-xs">{u.tenantId}</code></TableCell>
                                                    <TableCell>{u.userName || u.userId?.toString() || "—"}</TableCell>
                                                    <TableCell>{Number(u.totalCost).toFixed(4)}</TableCell>
                                                    <TableCell>{u.usageCount}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    <strong>Total:</strong> custo {Number(byUser.totalCost).toFixed(4)}, {byUser.totalUsageCount} chamadas
                                </p>
                            </>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {byUser ? "Nenhum uso no período." : "Selecione período e clique em Aplicar."}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Detail table */}
            <Card className="shadow-lt">
                <CardHeader>
                    <CardTitle className="text-base">Detalhes por linhas (uso, usuário solicitante, mensagem enviada à IA)</CardTitle>
                </CardHeader>
                <CardContent>
                    {detail && detail.items.length > 0 ? (
                        <>
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Tenant</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Módulo</TableHead>
                                            <TableHead>Modelo</TableHead>
                                            <TableHead>Custo</TableHead>
                                            <TableHead>Descrição</TableHead>
                                            <TableHead>Mensagem à IA</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detail.items.map((d, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="whitespace-nowrap text-xs">{new Date(d.createdAtUtc).toLocaleString()}</TableCell>
                                                <TableCell><code className="text-xs">{d.tenantId}</code></TableCell>
                                                <TableCell className="text-xs">{d.userName || d.userId?.toString() || "—"}</TableCell>
                                                <TableCell className="text-xs">{d.module}</TableCell>
                                                <TableCell className="text-xs">{d.modelDisplayName || "—"}</TableCell>
                                                <TableCell className="text-xs">{Number(d.cost).toFixed(4)}</TableCell>
                                                <TableCell className="text-xs max-w-[150px] truncate" title={d.actionDescription}>{d.actionDescription || ""}</TableCell>
                                                <TableCell className="text-xs max-w-[200px] truncate" title={d.requestMessage}>{d.requestMessage || ""}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {/* Pagination */}
                            {detail.totalPages > 1 && (
                                <div className="flex gap-1 mt-3">
                                    {Array.from({ length: detail.totalPages }, (_, i) => i + 1).map((p) => (
                                        <button
                                            key={p}
                                            className={`px-2.5 py-1 text-xs rounded-md border ${p === page ? "bg-lt-brand text-white border-lt-brand" : "border-input hover:bg-accent"}`}
                                            onClick={() => void loadDashboard(p)}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            {detail ? "Nenhum detalhe no período." : "Selecione período e clique em Aplicar."}
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
