"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/** Resposta/alinhamento com `EntraIdConfigView` / `EntraIdConfigDto` da API. */
interface EntraIdConfigForm {
    entraTenantId: string;
    clientId: string;
    /** Vazio no load quando `hasClientSecret`; preencher só ao trocar o secret. */
    clientSecret: string;
    /** Redirect URI completa registrada no Azure AD. */
    callbackPath: string;
    /** URL base do Portal Admin (retorno pós-login). */
    frontendBaseUrl: string;
    isEnabled: boolean;
    hasClientSecret: boolean;
}

const DEFAULT_REDIRECT_URI = "https://10.0.0.80:5000/api/auth/entra/callback";
const DEFAULT_PORTAL_URL = "http://10.0.0.80:3000";

const EMPTY: EntraIdConfigForm = {
    entraTenantId: "",
    clientId: "",
    clientSecret: "",
    callbackPath: DEFAULT_REDIRECT_URI,
    frontendBaseUrl: DEFAULT_PORTAL_URL,
    isEnabled: false,
    hasClientSecret: false,
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) {
        const b = await res.json().catch(() => null);
        const detail =
            (b as { detail?: string })?.detail ||
            (b as { title?: string })?.title ||
            `HTTP ${res.status}`;
        throw new Error(detail);
    }
    return res.json();
}

function mapFromApi(raw: Record<string, unknown>): EntraIdConfigForm {
    return {
        entraTenantId: typeof raw.entraTenantId === "string" ? raw.entraTenantId : "",
        clientId: typeof raw.clientId === "string" ? raw.clientId : "",
        clientSecret: "",
        callbackPath:
            typeof raw.callbackPath === "string" && raw.callbackPath.trim()
                ? raw.callbackPath
                : DEFAULT_REDIRECT_URI,
        frontendBaseUrl:
            typeof raw.frontendBaseUrl === "string" && raw.frontendBaseUrl.trim()
                ? raw.frontendBaseUrl
                : DEFAULT_PORTAL_URL,
        isEnabled: raw.isEnabled === true,
        hasClientSecret: raw.hasClientSecret === true,
    };
}

export default function AdminEntraIdScreen() {
    const [config, setConfig] = useState<EntraIdConfigForm>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const raw = await fetchJson<Record<string, unknown>>("/api/entra-config");
            setConfig(mapFromApi(raw));
        } catch {
            setConfig(EMPTY);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    async function handleSave() {
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                isEnabled: config.isEnabled,
                entraTenantId: config.entraTenantId.trim() || null,
                clientId: config.clientId.trim() || null,
                callbackPath: config.callbackPath.trim() || null,
                frontendBaseUrl: config.frontendBaseUrl.trim() || null,
            };
            if (config.clientSecret.trim()) {
                body.clientSecret = config.clientSecret.trim();
            }

            const raw = await fetchJson<Record<string, unknown>>("/api/entra-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            setConfig(mapFromApi(raw));
            toast.success("Configuração salva no banco do tenant!");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    const upd = (key: keyof EntraIdConfigForm, val: string | boolean) =>
        setConfig((prev) => ({ ...prev, [key]: val }));

    if (loading) return <div className="text-center text-muted-foreground py-8">Carregando...</div>;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h4 className="text-lg font-bold">Microsoft Entra ID</h4>
                    <div className="text-muted-foreground text-sm">
                        Toda a configuração SSO fica salva neste tenant (banco). Use os mesmos valores
                        registrados no Azure AD.
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void load()}>
                    <RefreshCw className="size-4" />
                </Button>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="font-semibold">Configuração</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Directory (tenant) ID — Azure Entra
                        </label>
                        <Input
                            value={config.entraTenantId}
                            onChange={(e) => upd("entraTenantId", e.target.value)}
                            placeholder="00000000-0000-0000-0000-000000000000"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Application (client) ID</label>
                        <Input
                            value={config.clientId}
                            onChange={(e) => upd("clientId", e.target.value)}
                            placeholder="00000000-0000-0000-0000-000000000000"
                        />
                        <p className="text-[11px] text-muted-foreground">
                            GUID do app no Azure (Application client ID), não o nome exibido (ex.: Portal_RS_RH).
                        </p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Client secret (valor)</label>
                        <Input
                            type="password"
                            value={config.clientSecret}
                            onChange={(e) => upd("clientSecret", e.target.value)}
                            placeholder={
                                config.hasClientSecret
                                    ? "••••••••  (já configurado — deixe vazio para manter)"
                                    : "Cole o valor do secret gerado no Azure"
                            }
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Cole o <strong>valor</strong> do secret (ex.: <code>i358Q~...</code>), não o Id Secreto.
                        </p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            Redirect URI (Azure) — URL completa
                        </label>
                        <Input
                            value={config.callbackPath}
                            onChange={(e) => upd("callbackPath", e.target.value)}
                            placeholder={DEFAULT_REDIRECT_URI}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Deve ser idêntica à Redirect URI cadastrada no app Azure (Web).
                        </p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                        <label className="text-xs font-medium text-muted-foreground">
                            URL do Portal (retorno após login)
                        </label>
                        <Input
                            value={config.frontendBaseUrl}
                            onChange={(e) => upd("frontendBaseUrl", e.target.value)}
                            placeholder={DEFAULT_PORTAL_URL}
                        />
                        <p className="text-[11px] text-muted-foreground">
                            Para onde o usuário volta com o token após o SSO (ex.:{" "}
                            <code>{DEFAULT_PORTAL_URL}</code>).
                        </p>
                    </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <input
                        type="checkbox"
                        checked={config.isEnabled}
                        onChange={(e) => upd("isEnabled", e.target.checked)}
                        className="rounded border-input"
                    />
                    Habilitado
                </label>
            </div>
            <div className="flex justify-end">
                <Button onClick={() => void handleSave()} disabled={saving} className="min-w-[150px]">
                    <Save className="size-4 mr-1" />
                    {saving ? "Salvando..." : "Salvar"}
                </Button>
            </div>
        </section>
    );
}
