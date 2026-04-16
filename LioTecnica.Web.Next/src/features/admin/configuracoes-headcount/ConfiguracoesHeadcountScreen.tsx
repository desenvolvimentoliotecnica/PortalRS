"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Users } from "lucide-react";

/* ──────────── types ──────────── */

interface ConfiguracaoHeadcountDto {
    diasProvisaoSubstituicao: number;
    diasAlertaVagaSemFill: number;
}

/* ──────────── screen ──────────── */

export default function ConfiguracoesHeadcountScreen() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [diasProvisao, setDiasProvisao] = useState(30);
    const [diasAlerta, setDiasAlerta] = useState(60);

    useEffect(() => {
        apiFetch("/api/admin/configuracoes-headcount")
            .then((res) => res.json() as Promise<ConfiguracaoHeadcountDto>)
            .then((dto) => {
                setDiasProvisao(dto.diasProvisaoSubstituicao);
                setDiasAlerta(dto.diasAlertaVagaSemFill);
            })
            .catch(() => toast.error("Erro ao carregar configurações de headcount."))
            .finally(() => setLoading(false));
    }, []);

    async function handleSave() {
        if (diasProvisao < 1 || diasAlerta < 1) {
            toast.error("Os dias devem ser maiores que zero.");
            return;
        }
        setSaving(true);
        try {
            await apiFetch("/api/admin/configuracoes-headcount", {
                method: "PUT",
                body: JSON.stringify({
                    diasProvisaoSubstituicao: diasProvisao,
                    diasAlertaVagaSemFill: diasAlerta,
                }),
            });
            toast.success("Configurações de headcount salvas.");
        } catch {
            toast.error("Erro ao salvar configurações.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="p-8 text-sm text-muted-foreground">
                Carregando configurações...
            </div>
        );
    }

    return (
        <div className="max-w-lg mx-auto p-6 space-y-8">
            <div className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                <div>
                    <h1 className="text-xl font-semibold">Configurações de Headcount</h1>
                    <p className="text-sm text-muted-foreground">
                        Parâmetros globais para gestão do quadro de vagas e controle de headcount.
                    </p>
                </div>
            </div>

            <div className="space-y-6 rounded-lg border bg-card p-6">
                {/* Dias de provisão na substituição */}
                <div className="space-y-2">
                    <Label htmlFor="diasProvisao">
                        Dias de provisão na substituição
                    </Label>
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
                        Equivalente ao "Overlap Period" do SAP SuccessFactors.
                    </p>
                </div>

                {/* Dias para alerta de vaga sem preenchimento */}
                <div className="space-y-2">
                    <Label htmlFor="diasAlerta">
                        Dias para alerta de vaga sem preenchimento
                    </Label>
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
                        recebem um alerta visual no painel de vagas para que o RH avalie
                        se deve reduzir o headcount ou manter a posição em aberto.
                    </p>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Salvando..." : "Salvar configurações"}
                </Button>
            </div>
        </div>
    );
}
