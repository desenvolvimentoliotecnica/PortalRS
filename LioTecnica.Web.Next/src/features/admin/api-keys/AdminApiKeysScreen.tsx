"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Pencil, Trash2, Key, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table, TableHeader, TableHead, TableBody, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface ApiKey {
    id: string;
    name: string;
    key: string;
    isActive: boolean;
    createdAt: string;
    lastUsed: string | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

export default function AdminApiKeysScreen() {
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setKeys(await fetchJson<ApiKey[]>("/api/admin/api-keys")); }
        catch { toast.error("Falha ao carregar API keys."); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    function startCreate() { setEditId(null); setFormName(""); setShowForm(true); }
    function startEdit(k: ApiKey) { setEditId(k.id); setFormName(k.name); setShowForm(true); }

    async function handleSave() {
        if (!formName.trim()) { toast.error("Nome é obrigatório."); return; }
        setSaving(true);
        try {
            if (editId) {
                await fetchJson(`/api/admin/api-keys/${editId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName.trim() }) });
                toast.success("API Key atualizada!");
            } else {
                await fetchJson("/api/admin/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: formName.trim() }) });
                toast.success("API Key criada!");
            }
            setShowForm(false); void load();
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar."); }
        finally { setSaving(false); }
    }

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Remover a API key "${name}"?`)) return;
        try { await apiFetch(`/api/admin/api-keys/${id}`, { method: "DELETE" }); toast.success(`API key "${name}" removida.`); void load(); }
        catch { toast.error("Falha ao remover."); }
    }

    function copyToClipboard(text: string) { navigator.clipboard.writeText(text); toast.success("Chave copiada!"); }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-lg font-bold">API Keys</h4><div className="text-muted-foreground text-sm">Gerencie as chaves de API para integrações externas.</div></div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw className="size-4" /></Button>
                    <Button size="sm" onClick={startCreate}><Plus className="size-4 mr-1" />Nova key</Button>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total</div><div className="mt-1 text-2xl font-bold text-primary">{keys.length}</div></div>
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur"><div className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ativas</div><div className="mt-1 text-2xl font-bold text-emerald-600">{keys.filter(k => k.isActive).length}</div></div>
            </div>
            {showForm && (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                    <div className="font-semibold">{editId ? "Editar API Key" : "Nova API Key"}</div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Nome *</label><Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Minha integração" /></div>
                    <div className="flex gap-2"><Button onClick={() => void handleSave()} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button><Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button></div>
                </div>
            )}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
                <Table>
                    <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Chave</TableHead><TableHead className="text-center">Status</TableHead><TableHead>Criado em</TableHead><TableHead>Último uso</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {loading ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                            : keys.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma API key encontrada.</TableCell></TableRow>
                                : keys.map(k => (
                                    <TableRow key={k.id}>
                                        <TableCell className="font-medium"><div className="flex items-center gap-2"><Key className="size-4 text-primary" />{k.name}</div></TableCell>
                                        <TableCell className="text-xs font-mono">{k.key.substring(0, 12)}... <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => copyToClipboard(k.key)}><Copy className="size-3" /></Button></TableCell>
                                        <TableCell className="text-center">{k.isActive ? <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-medium">Ativa</span> : <span className="inline-flex items-center rounded-full bg-zinc-100 text-zinc-600 px-2 py-0.5 text-xs font-medium">Inativa</span>}</TableCell>
                                        <TableCell className="text-xs">{new Date(k.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                                        <TableCell className="text-xs">{k.lastUsed ? new Date(k.lastUsed).toLocaleDateString("pt-BR") : "Nunca"}</TableCell>
                                        <TableCell className="text-right"><div className="flex items-center justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => startEdit(k)}><Pencil className="size-4" /></Button><Button variant="ghost" size="sm" className="text-red-600" onClick={() => void handleDelete(k.id, k.name)}><Trash2 className="size-4" /></Button></div></TableCell>
                                    </TableRow>
                                ))}
                    </TableBody>
                </Table>
            </div>
        </section>
    );
}
