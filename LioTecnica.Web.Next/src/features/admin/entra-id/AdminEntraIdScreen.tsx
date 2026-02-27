"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types (from EntraIdConfigController) ── */
interface EntraIdConfig {
    tenantId: string | null;
    clientId: string | null;
    authority: string | null;
    isEnabled: boolean;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        if (res.status === 404) return null as T;
        const body = await res.json().catch(() => null);
        throw new Error((body as any)?.detail || `HTTP ${res.status}`);
    }
    return res.json();
}

export default function AdminEntraIdScreen() {
    const [config, setConfig] = useState<EntraIdConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Editable form
    const [tenantId, setTenantId] = useState("");
    const [clientId, setClientId] = useState("");
    const [authority, setAuthority] = useState("");
    const [isEnabled, setIsEnabled] = useState(false);

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<EntraIdConfig | null>("/api/entra-config");
            setConfig(data);
            if (data) {
                setTenantId(data.tenantId ?? "");
                setClientId(data.clientId ?? "");
                setAuthority(data.authority ?? "");
                setIsEnabled(data.isEnabled);
            }
        } catch (err) {
            console.error("Failed to load Entra ID config", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadConfig(); }, [loadConfig]);

    async function handleSave() {
        setSaving(true);
        try {
            const updated = await fetchJson<EntraIdConfig>("/api/entra-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: tenantId.trim() || null,
                    clientId: clientId.trim() || null,
                    authority: authority.trim() || null,
                    isEnabled,
                }),
            });
            setConfig(updated);
            toast.success("Configuração do Entra ID salva com sucesso!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar configuração.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Entra ID (Azure AD)</h4>
                    <div className="text-muted-foreground text-sm">Configure a integração com o Microsoft Entra ID para autenticação SSO.</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadConfig()} disabled={loading}>
                    <RefreshCw className="size-4" /><span className="hidden sm:inline ml-1">Atualizar</span>
                </Button>
            </div>

            {loading ? (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-8 backdrop-blur text-center text-muted-foreground">
                    Carregando configuração...
                </div>
            ) : (
                <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur space-y-4">
                    <div className="flex items-center gap-3">
                        <Shield className="size-6 text-primary" />
                        <div>
                            <div className="font-semibold">Configuração do Entra ID</div>
                            <div className="text-sm text-muted-foreground">
                                {config ? "Configuração existente. Edite os campos abaixo." : "Nenhuma configuração encontrada. Preencha para configurar."}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Tenant ID</label>
                            <Input placeholder="ex: 00000000-0000-0000-0000-000000000000" value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Client ID</label>
                            <Input placeholder="ex: 00000000-0000-0000-0000-000000000000" value={clientId} onChange={(e) => setClientId(e.target.value)} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-medium">Authority</label>
                            <Input placeholder="ex: https://login.microsoftonline.com/{tenant-id}" value={authority} onChange={(e) => setAuthority(e.target.value)} />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="size-4" />
                        <span className="text-sm font-medium">Habilitar autenticação via Entra ID</span>
                    </label>

                    <Button onClick={() => void handleSave()} disabled={saving}>
                        <Save className="size-4 mr-1" />
                        {saving ? "Salvando..." : "Salvar configuração"}
                    </Button>
                </div>
            )}
        </section>
    );
}
