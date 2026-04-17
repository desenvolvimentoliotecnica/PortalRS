"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Settings2, Users } from "lucide-react";

/* ──────────────────────────── types ──────────────────────────── */

interface ConfiguracaoHeadcountDto {
    diasProvisaoSubstituicao: number;
    diasAlertaVagaSemFill: number;
}

/* ──────────────────────────── component ──────────────────────────── */

export default function TenantConfiguracaoScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Headcount
    const [diasProvisao, setDiasProvisao] = useState(30);
    const [diasAlerta, setDiasAlerta] = useState(60);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const headcountRes = await apiFetch("/api/admin/configuracoes-headcount").then(
                (r) => r.json() as Promise<ConfiguracaoHeadcountDto>
            );

            setDiasProvisao(headcountRes.diasProvisaoSubstituicao ?? 30);
            setDiasAlerta(headcountRes.diasAlertaVagaSemFill ?? 60);
        } catch {
            toast.error("Falha ao carregar configurações.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    async function save() {
        if (diasProvisao < 1 || diasAlerta < 1) {
            toast.error("Os dias devem ser maiores que zero.");
            return;
        }
        setSaving(true);
        try {
            const res = await apiFetch("/api/admin/configuracoes-headcount", {
                method: "PUT",
                body: JSON.stringify({
                    diasProvisaoSubstituicao: diasProvisao,
                    diasAlertaVagaSemFill: diasAlerta,
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success("Configurações salvas.");
        } catch (e) {
            toast.error(`Falha ao salvar: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                    <Settings2 className="size-5 text-muted-foreground" />
                    Configurações
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                    Parâmetros gerais do tenant: headcount.
                </p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <div className="h-6 w-6 animate-spin rounded-full border-4 border-t-transparent border-primary" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* ── Headcount ── */}
                    <div className="rounded-xl border border-border/40 bg-card p-6 space-y-6">
                        <div className="flex items-center gap-2 text-sm font-semibold">
                            <Users className="size-4 text-muted-foreground" />
                            Headcount
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="diasProvisao">Dias de provisão na substituição</Label>
                            <Input
                                id="diasProvisao"
                                type="number"
                                min={1}
                                max={365}
                                value={diasProvisao}
                                onChange={(e) => setDiasProvisao(Number(e.target.value))}
                                className="w-32"
                            />
                            <p className="text-xs text-muted-foreground">
                                Quando uma requisição de substituição é aprovada, o headcount extra
                                fica ativo por este número de dias antes de expirar automaticamente.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="diasAlerta">Dias para alerta de vaga sem preenchimento</Label>
                            <Input
                                id="diasAlerta"
                                type="number"
                                min={1}
                                max={365}
                                value={diasAlerta}
                                onChange={(e) => setDiasAlerta(Number(e.target.value))}
                                className="w-32"
                            />
                            <p className="text-xs text-muted-foreground">
                                Vagas abertas há mais que este número de dias sem candidato admitido
                                recebem um alerta visual no painel de vagas.
                            </p>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button onClick={() => void save()} disabled={saving}>
                            <Save className="size-4 mr-1.5" />
                            {saving ? "Salvando…" : "Salvar configurações"}
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
