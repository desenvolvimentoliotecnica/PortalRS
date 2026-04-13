"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import type { EtapaDetail, WorkflowDetail } from "../WorkflowRHDetailScreen";

interface ComplementoDados {
  faixaSalarialMin: string;
  faixaSalarialMax: string;
  beneficiosDescricao: string;
  descricaoDetalhada: string;
  requisitosAdicionais: string;
}

function parseDados(json: string | null): ComplementoDados {
  const defaults: ComplementoDados = { faixaSalarialMin: "", faixaSalarialMax: "", beneficiosDescricao: "", descricaoDetalhada: "", requisitosAdicionais: "" };
  if (!json) return defaults;
  try { return { ...defaults, ...JSON.parse(json) }; }
  catch { return defaults; }
}

export default function StepComplementoDados({
  etapa,
  workflow,
  onRefresh,
}: {
  etapa: EtapaDetail;
  workflow: WorkflowDetail;
  onRefresh: () => void;
}) {
  const [dados, setDados] = useState<ComplementoDados>(() => parseDados(etapa.dadosJson));
  const [saving, setSaving] = useState(false);
  const readOnly = etapa.status >= 2;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/api/workflow-rh/${workflow.id}/etapas/${etapa.id}/dados`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dadosJson: JSON.stringify(dados) }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      toast.success("Dados salvos");
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const update = (field: keyof ComplementoDados, value: string) =>
    setDados(prev => ({ ...prev, [field]: value }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Complemento de Dados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="faixaMin" className="text-sm font-medium block mb-1">Faixa Salarial Mínima (R$)</label>
            <Input id="faixaMin" value={dados.faixaSalarialMin} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("faixaSalarialMin", e.target.value)} disabled={readOnly} />
          </div>
          <div>
            <label htmlFor="faixaMax" className="text-sm font-medium block mb-1">Faixa Salarial Máxima (R$)</label>
            <Input id="faixaMax" value={dados.faixaSalarialMax} onChange={(e: React.ChangeEvent<HTMLInputElement>) => update("faixaSalarialMax", e.target.value)} disabled={readOnly} />
          </div>
        </div>

        <div>
          <label htmlFor="beneficios" className="text-sm font-medium block mb-1">Benefícios</label>
          <textarea id="beneficios" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={dados.beneficiosDescricao} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update("beneficiosDescricao", e.target.value)} disabled={readOnly} placeholder="VR, VT, Plano de Saúde, etc." />
        </div>

        <div>
          <label htmlFor="descricao" className="text-sm font-medium block mb-1">Descrição Detalhada da Vaga</label>
          <textarea id="descricao" rows={5} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={dados.descricaoDetalhada} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update("descricaoDetalhada", e.target.value)} disabled={readOnly} placeholder="Descreva as atividades, responsabilidades e expectativas..." />
        </div>

        <div>
          <label htmlFor="requisitos" className="text-sm font-medium block mb-1">Requisitos Adicionais</label>
          <textarea id="requisitos" rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" value={dados.requisitosAdicionais} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => update("requisitosAdicionais", e.target.value)} disabled={readOnly} placeholder="Formação, certificações, habilidades específicas..." />
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-3.5 mr-1.5" />
              {saving ? "Salvando..." : "Salvar Dados"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
