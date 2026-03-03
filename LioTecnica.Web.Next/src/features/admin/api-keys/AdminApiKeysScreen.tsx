"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Trash2, Key, Copy, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { confirmDialog } from "@/lib/confirm-dialog";

/* ------------------------------------------------------------------ */
/*  Types – match the RHPortal.Api contracts exactly                   */
/* ------------------------------------------------------------------ */

interface ApiKeyResponse {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAtUtc: string;
    lastUsedAtUtc: string | null;
}

interface ApiKeyCreateResponse extends ApiKeyResponse {
    /** Raw key value – returned ONLY on create, never again. */
    key: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error((b as Record<string, string>)?.error || (b as Record<string, string>)?.detail || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null as T;
    return res.json();
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminApiKeysScreen() {
    const [keys, setKeys] = useState<ApiKeyResponse[]>([]);
    const [loading, setLoading] = useState(true);

    // Create form
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [formName, setFormName] = useState("");
    const [formDescription, setFormDescription] = useState("");
    const [saving, setSaving] = useState(false);

    // "Key created" dialog
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    /* ---- Load ---- */
    const load = useCallback(async () => {
        setLoading(true);
        try {
            setKeys(await fetchJson<ApiKeyResponse[]>("/api/api-keys"));
        } catch {
            toast.error("Falha ao carregar chaves de API.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    /* ---- Create ---- */
    function openCreateForm() {
        setFormName("");
        setFormDescription("");
        setShowCreateForm(true);
    }

    async function handleCreate() {
        const name = formName.trim();
        if (!name) { toast.error("Nome é obrigatório."); return; }

        setSaving(true);
        try {
            const result = await fetchJson<ApiKeyCreateResponse>("/api/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description: formDescription.trim() || null,
                }),
            });

            if (result?.key) {
                setShowCreateForm(false);
                setCreatedKey(result.key);
                void load();
            } else {
                toast.error("Chave criada, mas valor não retornado.");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao criar chave.");
        } finally {
            setSaving(false);
        }
    }

    /* ---- Revoke ---- */
    async function handleRevoke(id: string, name: string) {
        const ok = await confirmDialog({
            title: "Revogar chave?",
            description: `A chave "${name}" deixará de funcionar. Esta ação não pode ser desfeita.`,
            confirmText: "Sim, revogar",
            destructive: true,
        });
        if (!ok) return;

        try {
            await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
            toast.success("Chave revogada.");
            void load();
        } catch {
            toast.error("Falha ao revogar chave.");
        }
    }

    /* ---- Copy ---- */
    function copyToClipboard(text: string) {
        navigator.clipboard.writeText(text);
        toast.success("Chave copiada para a área de transferência.");
    }

    /* ---- Render ---- */
    return (
        <section className="space-y-4">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Chaves de API</h4>
                    <div className="text-muted-foreground text-sm">
                        Cadastre chaves para acesso programático à API. Use o header{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Api-Key</code> e{" "}
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Tenant-Id</code>.
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}>
                        <RefreshCw className="size-4" />
                    </Button>
                    <Button size="sm" onClick={openCreateForm}>
                        <Plus className="size-4 mr-1" />Nova chave
                    </Button>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 gap-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div>
                    <div className="mt-1 text-2xl font-bold text-primary">{keys.length}</div>
                </div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativas</div>
                    <div className="mt-1 text-2xl font-bold text-emerald-600">{keys.filter(k => k.isActive).length}</div>
                </div>
            </div>

            {/* Create form (inline) */}
            {showCreateForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">Nova chave de API</div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Nome <span className="text-destructive">*</span></label>
                        <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Integração RM" />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
                        <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Uso ou sistema que usará esta chave" />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => void handleCreate()} disabled={saving}>{saving ? "Criando..." : "Criar chave"}</Button>
                        <Button variant="outline" onClick={() => setShowCreateForm(false)}>Cancelar</Button>
                    </div>
                </div>
            )}

            {/* Keys table */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead>Criada em</TableHead>
                            <TableHead>Último uso</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                        ) : keys.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma chave cadastrada.</TableCell></TableRow>
                        ) : keys.map(k => (
                            <TableRow key={k.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2"><Key className="size-4 text-primary" />{k.name}</div>
                                </TableCell>
                                <TableCell className="text-muted-foreground text-sm">{k.description || "—"}</TableCell>
                                <TableCell className="text-center">
                                    {k.isActive
                                        ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativa</span>
                                        : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Revogada</span>
                                    }
                                </TableCell>
                                <TableCell className="text-xs">{formatDate(k.createdAtUtc)}</TableCell>
                                <TableCell className="text-xs">{formatDate(k.lastUsedAtUtc)}</TableCell>
                                <TableCell className="text-right">
                                    {k.isActive ? (
                                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleRevoke(k.id, k.name)}>
                                            <Trash2 className="size-4 mr-1" />Revogar
                                        </Button>
                                    ) : "—"}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* "Key created" dialog – shown once after creation */}
            <Dialog open={!!createdKey} onOpenChange={(open) => { if (!open) setCreatedKey(null); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Chave criada</DialogTitle>
                        <DialogDescription>
                            <span className="flex items-center gap-1 text-amber-600">
                                <AlertTriangle className="size-4" />
                                Copie e guarde esta chave em um lugar seguro. Ela não será exibida novamente.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex items-center gap-2">
                        <Input readOnly value={createdKey ?? ""} className="font-mono text-sm" />
                        <Button variant="outline" size="sm" onClick={() => createdKey && copyToClipboard(createdKey)}>
                            <Copy className="size-4" />
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Use no header: <code className="bg-muted px-1 py-0.5 rounded">X-Api-Key: &lt;sua-chave&gt;</code> e{" "}
                        <code className="bg-muted px-1 py-0.5 rounded">X-Tenant-Id: &lt;seu-tenant&gt;</code>
                    </p>
                    <DialogFooter>
                        <Button onClick={() => setCreatedKey(null)}>Entendi</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
