"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDetail, WorkflowDetail } from "../WorkflowRHDetailScreen";

export default function StepGenerico({
  etapa,
}: {
  etapa: EtapaDetail;
  workflow: WorkflowDetail;
  onRefresh: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{etapa.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {etapa.descricao && (
          <p className="text-sm text-muted-foreground">{etapa.descricao}</p>
        )}

        {etapa.observacoes && (
          <div className="rounded-md border p-3 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-1">Observações</p>
            <p className="text-sm">{etapa.observacoes}</p>
          </div>
        )}

        {etapa.responsavelNome && (
          <div className="text-sm">
            <span className="text-muted-foreground">Responsável: </span>
            <span className="font-medium">{etapa.responsavelNome}</span>
          </div>
        )}

        {etapa.dataInicio && (
          <div className="text-sm">
            <span className="text-muted-foreground">Início: </span>
            <span>{new Date(etapa.dataInicio).toLocaleDateString("pt-BR")}</span>
          </div>
        )}

        {etapa.dataConclusao && (
          <div className="text-sm">
            <span className="text-muted-foreground">Conclusão: </span>
            <span>{new Date(etapa.dataConclusao).toLocaleDateString("pt-BR")}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
