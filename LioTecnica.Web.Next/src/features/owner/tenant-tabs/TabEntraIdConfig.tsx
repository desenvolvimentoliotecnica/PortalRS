"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const BASE = "/app";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (null as T) : res.json();
}

interface EntraIdConfig {
    isEnabled: boolean;
    entraTenantId: string;
    clientId: string;
    hasClientSecret: boolean;
    callbackPath: string;
}

export default function TabEntraIdConfig({ tenantId }: { tenantId: string }) {
    const apiBase = `/api/owner/tenants/${encodeURIComponent(tenantId)}/config/entra-id`;

    const [config, setConfig] = useState<EntraIdConfig>({
        isEnabled: false,
        entraTenantId: "",
        clientId: "",
        hasClientSecret: false,
        callbackPath: "/signin-entra",
    });
    const [clientSecret, setClientSecret] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchJson<EntraIdConfig>(`${apiBase}/config`)
            .then((d) => { if (d) setConfig(d); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [apiBase]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const payload = {
                isEnabled: config.isEnabled,
                entraTenantId: config.entraTenantId,
                clientId: config.clientId,
                clientSecret: clientSecret || null,
                callbackPath: config.callbackPath,
            };
            const result = await fetchJson<EntraIdConfig>(`${apiBase}/config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (result) setConfig(result);
            setClientSecret("");
            toast.success("Configuração Entra ID salva.");
        } catch {
            toast.error("Falha ao salvar configuração.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <Card className="shadow-lt max-w-lg">
            <CardHeader>
                <CardTitle className="text-base">Configuração Entra ID (Azure AD)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="entraEnabled"
                        className="rounded border-input"
                        checked={config.isEnabled}
                        onChange={(e) => setConfig((c) => ({ ...c, isEnabled: e.target.checked }))}
                    />
                    <label htmlFor="entraEnabled" className="text-sm font-medium">Habilitado</label>
                </div>
                <div>
                    <label className="text-sm font-medium mb-1.5 block">Tenant ID (Azure)</label>
                    <Input value={config.entraTenantId} onChange={(e) => setConfig((c) => ({ ...c, entraTenantId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <div>
                    <label className="text-sm font-medium mb-1.5 block">Client ID</label>
                    <Input value={config.clientId} onChange={(e) => setConfig((c) => ({ ...c, clientId: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
                </div>
                <div>
                    <label className="text-sm font-medium mb-1.5 block">Client Secret</label>
                    <Input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Novo segredo (deixe vazio para manter)" />
                    <p className="text-xs text-muted-foreground mt-1">
                        {config.hasClientSecret ? "✅ Segredo configurado." : "⚠️ Segredo não configurado."}
                    </p>
                </div>
                <div>
                    <label className="text-sm font-medium mb-1.5 block">Callback Path</label>
                    <Input value={config.callbackPath} onChange={(e) => setConfig((c) => ({ ...c, callbackPath: e.target.value }))} />
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                    {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                    Salvar
                </Button>
            </CardContent>
        </Card>
    );
}
