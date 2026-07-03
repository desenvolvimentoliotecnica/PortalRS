"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, RefreshCw, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SlaEtapaItem {
    etapa: string;
    label: string;
    slaDias: number;
    defaultDias: number;
    ativo: boolean;
    configuradoId?: string | null;
}

type EditState = Record<string, { slaDias: number; ativo: boolean }>;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers ?? {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json() as Promise<T>;
}

export default function SlaEtapaConfigScreen() {
    const [items, setItems] = useState<SlaEtapaItem[]>([]);
    const [edits, setEdits] = useState<EditState>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchJson<SlaEtapaItem[]>("/api/configuracoes/sla-etapas");
            setItems(data);
            const next: EditState = {};
            for (const item of data) {
                next[item.etapa] = { slaDias: item.slaDias, ativo: item.ativo };
            }
            setEdits(next);
        } catch (e) {
            toast.error(`Falha ao carregar SLA por etapa: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function save() {
        setSaving(true);
        try {
            const payload = items.map((item) => {
                const edit = edits[item.etapa] ?? { slaDias: item.slaDias, ativo: item.ativo };
                return {
                    etapa: item.etapa,
                    slaDias: edit.slaDias,
                    ativo: edit.ativo,
                };
            });

            const updated = await fetchJson<SlaEtapaItem[]>("/api/configuracoes/sla-etapas", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            setItems(updated);
            const next: EditState = {};
            for (const item of updated) {
                next[item.etapa] = { slaDias: item.slaDias, ativo: item.ativo };
            }
            setEdits(next);
            toast.success("SLA por etapa salvo.");
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    function updateEdit(etapa: string, field: "slaDias" | "ativo", value: number | boolean) {
        setEdits((prev) => ({
            ...prev,
            [etapa]: { ...prev[etapa], [field]: value },
        }));
    }

    return (
        <section className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="mb-2 inline-flex rounded-full border border-border/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Recrutamento
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight">SLA por Etapa</h1>
                    <p className="text-muted-foreground text-sm mt-0.5 max-w-2xl">
                        Defina quantos dias um candidato pode permanecer em cada etapa do funil antes de o kanban
                        sinalizar atraso (semáforo verde, amarelo e vermelho).
                    </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
                    <RefreshCw className="size-4 mr-1" /> Atualizar
                </Button>
            </div>

            <div className="rounded-xl border border-border/40 bg-card p-6 space-y-4 max-w-3xl">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="size-4 shrink-0" />
                    <span>
                        Etapas desativadas usam o padrão do sistema. Ative para aplicar o prazo personalizado do tenant.
                    </span>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-muted-foreground text-sm">Carregando…</div>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => {
                            const edit = edits[item.etapa] ?? { slaDias: item.slaDias, ativo: item.ativo };
                            return (
                                <div
                                    key={item.etapa}
                                    className="flex flex-col gap-3 rounded-lg border border-border/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div className="min-w-0 flex-1">
                                        <div className="font-medium text-sm">{item.label}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">
                                            Padrão do sistema: {item.defaultDias} dias
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs">SLA (dias)</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={365}
                                                className="w-24 h-8"
                                                disabled={!edit.ativo}
                                                value={edit.slaDias}
                                                onChange={(e) =>
                                                    updateEdit(item.etapa, "slaDias", Math.max(1, Number(e.target.value) || 1))
                                                }
                                            />
                                        </div>
                                        <label className="flex items-center gap-2 text-sm pt-5">
                                            <input
                                                type="checkbox"
                                                checked={edit.ativo}
                                                onChange={(e) => updateEdit(item.etapa, "ativo", e.target.checked)}
                                                className="h-4 w-4 rounded border-border accent-primary"
                                            />
                                            Ativo
                                        </label>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="pt-2">
                    <Button onClick={() => void save()} disabled={saving || loading}>
                        <Save className="size-4 mr-1.5" />
                        {saving ? "Salvando…" : "Salvar SLA por etapa"}
                    </Button>
                </div>
            </div>
        </section>
    );
}
