"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface LocalizationConfig {
    defaultLanguage: string | null;
    timezone: string | null;
    dateFormat: string | null;
    currency: string | null;
    supportedLanguages: string[];
}

const EMPTY: LocalizationConfig = { defaultLanguage: "pt-BR", timezone: "America/Sao_Paulo", dateFormat: "dd/MM/yyyy", currency: "BRL", supportedLanguages: ["pt-BR", "en-US", "es-ES"] };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store", ...init });
    if (!res.ok) { const b = await res.json().catch(() => null); throw new Error((b as any)?.detail || `HTTP ${res.status}`); }
    return res.json();
}

export default function AdminLocalizationScreen() {
    const [config, setConfig] = useState<LocalizationConfig>(EMPTY);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try { setConfig(await fetchJson<LocalizationConfig>("/api/admin/localization")); }
        catch { /* may return default */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function handleSave() {
        setSaving(true);
        try {
            const saved = await fetchJson<LocalizationConfig>("/api/admin/localization", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
            setConfig(saved);
            toast.success("Configuração de localização salva!");
        } catch (err) { toast.error(err instanceof Error ? err.message : "Falha ao salvar."); }
        finally { setSaving(false); }
    }

    const upd = (key: keyof LocalizationConfig, val: string) => setConfig(prev => ({ ...prev, [key]: val }));

    if (loading) return <div className="text-center text-muted-foreground py-8">Carregando...</div>;

    return (
        <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="text-lg font-bold">Localização</h4><div className="text-muted-foreground text-sm">Configure idioma, fuso horário e formato regional.</div></div>
                <Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw className="size-4" /></Button>
            </div>
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-3">
                <div className="flex items-center gap-2 font-semibold"><Globe className="size-5 text-primary" /> Configurações Regionais</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Idioma Padrão</label>
                        <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={config.defaultLanguage ?? ""} onChange={e => upd("defaultLanguage", e.target.value)}>
                            <option value="pt-BR">Português (Brasil)</option>
                            <option value="en-US">English (US)</option>
                            <option value="es-ES">Español</option>
                        </select>
                    </div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Fuso Horário</label>
                        <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={config.timezone ?? ""} onChange={e => upd("timezone", e.target.value)}>
                            <option value="America/Sao_Paulo">America/São Paulo (UTC-3)</option>
                            <option value="America/Manaus">America/Manaus (UTC-4)</option>
                            <option value="America/Cuiaba">America/Cuiabá (UTC-4)</option>
                            <option value="America/Fortaleza">America/Fortaleza (UTC-3)</option>
                            <option value="UTC">UTC</option>
                        </select>
                    </div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Formato de Data</label><Input value={config.dateFormat ?? ""} onChange={e => upd("dateFormat", e.target.value)} placeholder="dd/MM/yyyy" /></div>
                    <div className="space-y-1"><label className="text-xs font-medium text-muted-foreground">Moeda</label>
                        <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={config.currency ?? ""} onChange={e => upd("currency", e.target.value)}>
                            <option value="BRL">BRL (R$)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                        </select>
                    </div>
                </div>
            </div>
            <div className="flex justify-end"><Button onClick={() => void handleSave()} disabled={saving} className="min-w-[150px]"><Save className="size-4 mr-1" />{saving ? "Salvando..." : "Salvar"}</Button></div>
        </section>
    );
}
