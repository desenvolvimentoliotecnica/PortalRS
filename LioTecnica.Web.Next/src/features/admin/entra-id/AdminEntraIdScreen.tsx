"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface EntraIdConfig {
    tenantId: string | null;
    clientId: string | null;
    clientSecret: string | null;
    authority: string | null;
    callbackPath: string | null;
    isEnabled: boolean;
}

const EMPTY: EntraIdConfig = { tenantId: "", clientId: "", clientSecret: "", authority: "", callbackPath: "/signin-oidc", isEnabled: false };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

export default function AdminEntraIdScreen() {
    const [config, setConfig] = useState<EntraIdConfig>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setConfig(await fetchJson<EntraIdConfig>("/api/admin/entra-id")); }
        catch { /* may not exist yet */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleSave() {
        setSaving(true);
        try {
            const saved = await fetchJson<EntraIdConfig>("/api/admin/entra-id", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
            setConfig(saved);
            toast.success("Configuração salva!");
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar."); }
        finally { setSaving(false); }
    }

    const upd = (key: keyof EntraIdConfig, val: string | boolean) => setConfig(prev => ({ ...prev, [key]: val }));

    if (loading) return <div className="text-center text-muted-foreground py-8">Carregando...</div>;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-lg font-bold">Microsoft Entra ID</h4><div className="text-muted-foreground text-sm">Configure a autenticação via Microsoft Entra ID (Azure AD).</div></div>
                <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /></Button>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="font-semibold">Configuração</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Tenant ID</label><Input value={config.tenantId ?? ""} onChange={e => upd("tenantId", e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Client ID</label><Input value={config.clientId ?? ""} onChange={e => upd("clientId", e.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Client Secret</label><Input type="password" value={config.clientSecret ?? ""} onChange={e => upd("clientSecret", e.target.value)} /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Authority</label><Input value={config.authority ?? ""} onChange={e => upd("authority", e.target.value)} placeholder="https://login.microsoftonline.com/{tenantId}" /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Callback Path</label><Input value={config.callbackPath ?? ""} onChange={e => upd("callbackPath", e.target.value)} placeholder="/signin-oidc" /></div>
                </div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={config.isEnabled} onChange={e => upd("isEnabled", e.target.checked)} className="rounded border-input" /> Habilitado</label>
            </div>
            <div className="flex justify-end"><Button onClick={() => void handleSave()} disabled={saving} className="min-w-[150px]"><Save className="size-4 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button></div>
        </section>
    );
}
