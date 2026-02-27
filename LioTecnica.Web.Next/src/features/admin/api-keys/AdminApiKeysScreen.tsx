"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Copy, Key, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types (from ApiKeysController) ── */
interface ApiKeyItem {
    id: string;
    name: string;
    prefix: string;
    isActive: boolean;
    createdAt: string;
    lastUsedAt: string | null;
    usageCount: number;
}

interface ApiKeyCreateResponse {
    id: string;
    name: string;
    rawKey: string;
    prefix: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.error || `HTTP ${res.status}`);
    }
    return res.json();
}

function fmtDate(iso: string | null) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
}

export default function AdminApiKeysScreen() {
    const [keys, setKeys] = useState<ApiKeyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState("");
    const [showCreate, setShowCreate] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    const loadKeys = useCallback(async () => {
        setLoading(true);
        try {
            const list = await fetchJson<ApiKeyItem[]>("/api/api-keys");
            setKeys(list);
        } catch (err) {
            console.error("Failed to load API keys", err);
            toast.error("Falha ao carregar chaves de API.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadKeys(); }, [loadKeys]);

    async function handleCreate() {
        if (!newName.trim()) { toast.error("Informe um nome para a chave."); return; }
        setCreating(true);
        try {
            const result = await fetchJson<ApiKeyCreateResponse>("/api/api-keys", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newName.trim() }),
            });
            setCreatedKey(result.rawKey);
            setNewName("");
            toast.success(`Chave "${result.name}" criada com sucesso!`);
            void loadKeys();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao criar chave.");
        } finally {
            setCreating(false);
        }
    }

    async function handleRevoke(id: string, name: string) {
        if (!confirm(`Revogar chave "${name}"? Esta ação não pode ser desfeita.`)) return;
        try {
            await apiFetch(`/api/api-keys/${id}`, { method: "DELETE" });
            toast.success(`Chave "${name}" revogada.`);
            void loadKeys();
        } catch {
            toast.error("Falha ao revogar chave.");
        }
    }

    function copyToClipboard(text: string) {
        void navigator.clipboard.writeText(text);
        toast.success("Chave copiada para a área de transferência!");
    }

    const active = keys.filter(k => k.isActive);
    const revoked = keys.filter(k => !k.isActive);

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Chaves de API</h4>
                    <div className="text-muted-foreground text-sm">
                        Cadastre chaves para acesso programático à API. Use o header <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Api-Key</code> e <code className="rounded bg-muted px-1 py-0.5 text-xs">X-Tenant-Id</code>.
                    </div>
                </div>
                <Button size="sm" onClick={() => { setShowCreate(!showCreate); setCreatedKey(null); }}>
                    <Plus className="size-4 mr-1" />Nova chave
                </Button>
            </div>

            {/* Create form */}
            {showCreate && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold flex items-center gap-2"><Key className="size-4" /> Criar nova chave de API</div>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Nome da chave (ex: Integração RM)"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && void handleCreate()}
                        />
                        <Button onClick={() => void handleCreate()} disabled={creating}>
                            {creating ? "Criando..." : "Criar"}
                        </Button>
                    </div>
                    {createdKey && (
                        <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-3 space-y-2">
                            <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                                ⚠️ Copie a chave agora — ela não será exibida novamente!
                            </div>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 rounded bg-white dark:bg-black px-3 py-2 text-sm font-mono border break-all select-all">{createdKey}</code>
                                <Button variant="outline" size="sm" onClick={() => copyToClipboard(createdKey)}>
                                    <Copy className="size-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Active keys */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <div className="font-semibold mb-2 flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-600" /> Chaves ativas ({active.length})
                </div>
                {loading ? (
                    <div className="text-center text-muted-foreground py-8">Carregando...</div>
                ) : active.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">Nenhuma chave ativa.</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Prefixo</TableHead>
                                <TableHead>Criada em</TableHead>
                                <TableHead>Último uso</TableHead>
                                <TableHead className="text-right">Usos</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {active.map((k) => (
                                <TableRow key={k.id}>
                                    <TableCell className="font-medium">{k.name}</TableCell>
                                    <TableCell><code className="text-xs">{k.prefix}…</code></TableCell>
                                    <TableCell className="text-xs">{fmtDate(k.createdAt)}</TableCell>
                                    <TableCell className="text-xs">{fmtDate(k.lastUsedAt)}</TableCell>
                                    <TableCell className="text-right">{k.usageCount}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleRevoke(k.id, k.name)}>
                                            <Trash2 className="size-4 mr-1" /> Revogar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* Revoked keys */}
            {revoked.length > 0 && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                    <div className="font-semibold mb-2 flex items-center gap-2">
                        <ShieldOff className="size-4 text-muted-foreground" /> Chaves revogadas ({revoked.length})
                    </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Prefixo</TableHead>
                                <TableHead>Criada em</TableHead>
                                <TableHead className="text-right">Usos</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {revoked.map((k) => (
                                <TableRow key={k.id} className="opacity-50">
                                    <TableCell>{k.name}</TableCell>
                                    <TableCell><code className="text-xs">{k.prefix}…</code></TableCell>
                                    <TableCell className="text-xs">{fmtDate(k.createdAt)}</TableCell>
                                    <TableCell className="text-right">{k.usageCount}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </section>
    );
}
