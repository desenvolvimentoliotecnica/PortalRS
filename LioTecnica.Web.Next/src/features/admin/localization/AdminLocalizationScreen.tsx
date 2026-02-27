"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Save, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

/* ── Types (from LocalizationConfigController) ── */
interface LocalizationConfig {
    defaultCulture: string | null;
    supportedCultures: string[];
    timeZone: string | null;
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

export default function AdminLocalizationScreen() {
    const [config, setConfig] = useState<LocalizationConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [defaultCulture, setDefaultCulture] = useState("pt-BR");
    const [supportedCultures, setSupportedCultures] = useState("pt-BR, en-US");
    const [timeZone, setTimeZone] = useState("");

    const loadConfig = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<LocalizationConfig | null>("/api/localization-config");
            setConfig(data);
            if (data) {
                setDefaultCulture(data.defaultCulture ?? "pt-BR");
                setSupportedCultures(data.supportedCultures?.join(", ") ?? "pt-BR, en-US");
                setTimeZone(data.timeZone ?? "");
            }
        } catch (err) {
            console.error("Failed to load localization config", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadConfig(); }, [loadConfig]);

    async function handleSave() {
        setSaving(true);
        try {
            const cultures = supportedCultures.split(",").map(c => c.trim()).filter(Boolean);
            const updated = await fetchJson<LocalizationConfig>("/api/localization-config", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    defaultCulture: defaultCulture.trim(),
                    supportedCultures: cultures,
                    timeZone: timeZone.trim() || null,
                }),
            });
            setConfig(updated);
            toast.success("Configuração de localização salva com sucesso!");
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
                    <h4 className="text-lg font-bold">Localização</h4>
                    <div className="text-muted-foreground text-sm">Configure idioma padrão, culturas suportadas e fuso horário.</div>
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
                        <Globe className="size-6 text-primary" />
                        <div>
                            <div className="font-semibold">Configuração de Localização</div>
                            <div className="text-sm text-muted-foreground">
                                {config ? "Configuração existente. Edite os campos abaixo." : "Nenhuma configuração encontrada. Preencha para configurar."}
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Cultura padrão</label>
                            <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm" value={defaultCulture} onChange={(e) => setDefaultCulture(e.target.value)}>
                                <option value="pt-BR">Português (Brasil)</option>
                                <option value="en-US">English (US)</option>
                                <option value="es-ES">Español (España)</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Fuso horário</label>
                            <Input placeholder="ex: America/Sao_Paulo" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <label className="text-sm font-medium">Culturas suportadas (separadas por vírgula)</label>
                            <Input placeholder="ex: pt-BR, en-US, es-ES" value={supportedCultures} onChange={(e) => setSupportedCultures(e.target.value)} />
                        </div>
                    </div>

                    <Button onClick={() => void handleSave()} disabled={saving}>
                        <Save className="size-4 mr-1" />
                        {saving ? "Salvando..." : "Salvar configuração"}
                    </Button>
                </div>
            )}
        </section>
    );
}
