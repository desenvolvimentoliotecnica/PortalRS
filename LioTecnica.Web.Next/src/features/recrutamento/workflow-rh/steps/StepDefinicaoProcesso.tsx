"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import type { EtapaDetail, WorkflowDetail } from "../WorkflowRHDetailScreen";

export default function StepDefinicaoProcesso({
  etapa,
  workflow,
}: {
  etapa: EtapaDetail;
  workflow: WorkflowDetail;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Definição do Processo Seletivo</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Configure as etapas do processo seletivo, critérios de avaliação e painel de entrevistadores
          para esta vaga.
        </p>

        {workflow.vagaId && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={`/app/gestao/processo-seletivo?vagaId=${workflow.vagaId}`} target="_blank" rel="noopener">
                <ExternalLink className="size-3.5 mr-1.5" />
                Configurar Processo Seletivo
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href={`/app/vagas/hub/${workflow.vagaId}?tab=processo`} target="_blank" rel="noopener">
                <ExternalLink className="size-3.5 mr-1.5" />
                Abrir Vaga (aba Processo)
              </a>
            </Button>
          </div>
        )}

        {etapa.observacoes && (
          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
            <p className="text-sm">{etapa.observacoes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
