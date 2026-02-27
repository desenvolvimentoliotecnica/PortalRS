"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getBackendUrl } from "@/lib/getBackendUrl";

const BASE = getBackendUrl();

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, { credentials: "same-origin", ...init });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.status === 204 ? (null as T) : res.json();
}

const CULTURES = [
    { value: "pt-BR", label: "Português (Brasil)" },
    { value: "en-US", label: "English (US)" },
    { value: "es-ES", label: "Español" },
    { value: "fr-FR", label: "Français" },
    { value: "de-DE", label: "Deutsch" },
];

interface LocalizationConfig {
    culture: string;
    uiCulture: string;
}

export default function TabIdioma({ tenantId }: { tenantId: string }) {
    const router = useRouter();
    const apiBase = `${BASE}/Owner/Tenants/${encodeURIComponent(tenantId)}/Config/LocalizationConfig/_api`;

    const [config, setConfig] = useState<LocalizationConfig>({ culture: "pt-BR", uiCulture: "pt-BR" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchJson<LocalizationConfig>(`${apiBase}/config`)
            .then((d) => { if (d) setConfig(d); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [apiBase]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const result = await fetchJson<LocalizationConfig>(`${apiBase}/config`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            if (result) setConfig(result);
            toast.success("Configuração de idioma salva.");
            router.refresh();
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
                <CardTitle className="text-base">Configuração de Idioma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <label className="text-sm font-medium mb-1.5 block">Cultura (formato de data/número)</label>
                    <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={config.culture}
                        onChange={(e) => setConfig((c) => ({ ...c, culture: e.target.value }))}
                    >
                        {CULTURES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="text-sm font-medium mb-1.5 block">Cultura da UI (idioma da interface)</label>
                    <select
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={config.uiCulture}
                        onChange={(e) => setConfig((c) => ({ ...c, uiCulture: e.target.value }))}
                    >
                        {CULTURES.map((c) => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                    </select>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-[rgb(var(--lt-brand))] text-white hover:bg-[rgb(var(--lt-brand))]/90">
                    {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                    Salvar
                </Button>
            </CardContent>
        </Card>
    );
}
