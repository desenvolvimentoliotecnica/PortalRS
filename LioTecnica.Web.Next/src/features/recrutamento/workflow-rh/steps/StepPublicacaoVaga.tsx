"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Save } from "lucide-react";
import type { EtapaDetail, WorkflowDetail } from "../WorkflowRHDetailScreen";

interface PublicacaoDados {
  publicarPortal: boolean;
  publicarLinkedin: boolean;
  publicarSite: boolean;
  publicarReferral: boolean;
  descricaoPublica: string;
}

function parseDados(json: string | null): PublicacaoDados {
  const defaults: PublicacaoDados = { publicarPortal: true, publicarLinkedin: false, publicarSite: false, publicarReferral: false, descricaoPublica: "" };
  if (!json) return defaults;
  try { return { ...defaults, ...JSON.parse(json) }; }
  catch { return defaults; }
}

function Toggle({ checked, onChange, disabled, label, description }: { checked: boolean; onChange: (v: boolean) => void; disabled: boolean; label: string; description: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-primary" : "bg-input"}`}
      >
        <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function StepPublicacaoVaga({
  etapa,
  workflow,
  onRefresh,
}: {
  etapa: EtapaDetail;
  workflow: WorkflowDetail;
  onRefresh: () => void;
}) {
  const [dados, setDados] = useState<PublicacaoDados>(() => parseDados(etapa.dadosJson));
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
      toast.success("Dados de publicação salvos");
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Publicação da Vaga</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Selecione os canais de publicação e escreva a descrição pública da vaga.
        </p>

        <div className="space-y-3">
          <Toggle checked={dados.publicarPortal} onChange={(v: boolean) => setDados(prev => ({ ...prev, publicarPortal: v }))} disabled={readOnly} label="Portal de Vagas" description="Publicar no portal interno da empresa" />
          <Toggle checked={dados.publicarLinkedin} onChange={(v: boolean) => setDados(prev => ({ ...prev, publicarLinkedin: v }))} disabled={readOnly} label="LinkedIn" description="Publicar no LinkedIn Jobs" />
          <Toggle checked={dados.publicarSite} onChange={(v: boolean) => setDados(prev => ({ ...prev, publicarSite: v }))} disabled={readOnly} label="Site Institucional" description="Publicar na seção de carreiras do site" />
          <Toggle checked={dados.publicarReferral} onChange={(v: boolean) => setDados(prev => ({ ...prev, publicarReferral: v }))} disabled={readOnly} label="Programa de Indicação" description="Permitir indicação por funcionários" />
        </div>

        <div>
          <label htmlFor="descPublica" className="text-sm font-medium block mb-1">Descrição Pública da Vaga</label>
          <textarea
            id="descPublica"
            rows={6}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={dados.descricaoPublica}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDados(prev => ({ ...prev, descricaoPublica: e.target.value }))}
            disabled={readOnly}
            placeholder="Descrição que será exibida nos canais de publicação..."
          />
        </div>

        {!readOnly && (
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="size-3.5 mr-1.5" />
              {saving ? "Salvando..." : "Salvar Publicação"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
