"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { CreditCard, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API = "/api/colaborador/dados-bancarios";

const TIPO_CONTA_LABELS: Record<number, string> = {
    0: "Conta Corrente",
    1: "Conta Poupança",
    2: "Conta Salário",
};

interface DadosBancarios {
    id: string;
    banco: string;
    agencia: string;
    conta: string;
    tipoConta: number;
    pix: string | null;
    updatedAtUtc: string;
}

export default function DadosBancariosScreen() {
    const [dados, setDados] = useState<DadosBancarios | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [banco, setBanco] = useState("");
    const [agencia, setAgencia] = useState("");
    const [conta, setConta] = useState("");
    const [tipoConta, setTipoConta] = useState<string>("0");
    const [pix, setPix] = useState("");

    useEffect(() => {
        setLoading(true);
        apiFetch(API)
            .then((r) => r.ok ? r.json() as Promise<DadosBancarios> : null)
            .then((data) => {
                if (data) {
                    setDados(data);
                    setBanco(data.banco);
                    setAgencia(data.agencia);
                    setConta(data.conta);
                    setTipoConta(String(data.tipoConta));
                    setPix(data.pix ?? "");
                }
            })
            .catch(() => {/* 404 = sem dados, ok */})
            .finally(() => setLoading(false));
    }, []);

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!banco || !agencia || !conta) {
            toast.error("Preencha banco, agência e conta.");
            return;
        }
        setSaving(true);
        try {
            const r = await apiFetch(API, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    banco,
                    agencia,
                    conta,
                    tipoConta: Number(tipoConta),
                    pix: pix || null,
                }),
            });
            const result: DadosBancarios = await r.json();
            setDados(result);
            toast.success("Dados bancários salvos com sucesso.");
        } catch {
            toast.error("Erro ao salvar dados bancários.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                Carregando dados bancários...
            </div>
        );
    }

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <CreditCard className="size-5 text-violet-600" />
                    <CardTitle className="text-base">Dados Bancários</CardTitle>
                </div>
                <CardDescription>
                    Informe sua conta para crédito de salário e benefícios.
                    {dados && (
                        <span className="block mt-1 text-xs text-muted-foreground">
                            Última atualização: {new Date(dados.updatedAtUtc).toLocaleDateString("pt-BR")}
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSave} className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="banco">Banco *</Label>
                        <Input
                            id="banco"
                            placeholder="Ex: Banco do Brasil, Bradesco..."
                            value={banco}
                            onChange={(e) => setBanco(e.target.value)}
                            maxLength={200}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="agencia">Agência *</Label>
                            <Input
                                id="agencia"
                                placeholder="0000-0"
                                value={agencia}
                                onChange={(e) => setAgencia(e.target.value)}
                                maxLength={20}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="conta">Conta *</Label>
                            <Input
                                id="conta"
                                placeholder="00000-0"
                                value={conta}
                                onChange={(e) => setConta(e.target.value)}
                                maxLength={30}
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="tipoConta">Tipo de Conta *</Label>
                        <select
                            id="tipoConta"
                            value={tipoConta}
                            onChange={(e) => setTipoConta(e.target.value)}
                            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                            {Object.entries(TIPO_CONTA_LABELS).map(([v, label]) => (
                                <option key={v} value={v}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="pix">Chave PIX <span className="text-muted-foreground">(opcional)</span></Label>
                        <Input
                            id="pix"
                            placeholder="CPF, e-mail, telefone ou chave aleatória"
                            value={pix}
                            onChange={(e) => setPix(e.target.value)}
                            maxLength={150}
                        />
                    </div>

                    <Button type="submit" disabled={saving} className="w-full">
                        <Save className="size-4 mr-2" />
                        {saving ? "Salvando..." : "Salvar Dados Bancários"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}
