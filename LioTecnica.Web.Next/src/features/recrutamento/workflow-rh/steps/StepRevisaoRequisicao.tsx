"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDetail, WorkflowDetail } from "../WorkflowRHDetailScreen";

/* ─── Component ─────────────────────────────────────────── */

export default function StepRevisaoRequisicao({
  workflow,
}: {
  etapa: EtapaDetail;
  workflow: WorkflowDetail;
  onRefresh: () => void;
}) {
  const sol = workflow.dadosSolicitacao;

  if (!sol) {
    return (
      <div className="text-muted-foreground text-sm">
        Dados da solicitação não disponíveis.
      </div>
    );
  }

  const origem: "gestor" | "rm" = sol.requisicaoOrigemRm ? "rm" : "gestor";
  const origemLabel = sol.requisicaoOrigemRm ? "Importada do RM" : "Preenchido pelo Gestor";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dados da Requisição</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {origemLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {sol.rmRequisicaoCodigo && <FieldRow label="Código RM" value={sol.rmRequisicaoCodigo} origin="rm" />}
          <FieldRow label="Título" value={sol.titulo} origin={origem} />
          <FieldRow label="Justificativa" value={sol.justificativa} origin={origem} />
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Qtd. Posições" value={String(sol.qtdPosicoes)} origin={origem} />
            <FieldRow label="Urgência" value={sol.urgenciaLabel} origin={origem} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Tipo" value={sol.tipoSolicitacaoLabel} origin={origem} />
            <FieldRow label="Confidencial" value={sol.isConfidencial ? "Sim" : "Não"} origin={origem} />
          </div>
          {sol.substituidoNome && (
            <FieldRow label="Substituído" value={sol.substituidoNome} origin={origem} />
          )}
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Cargo" value={sol.jobPositionName} origin={origem} />
            <FieldRow label="Centro de Custo" value={sol.centroCustoNome ?? sol.areaName ?? null} origin={origem} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Unidade" value={sol.unitName} origin={origem} />
            <FieldRow label="Empresa" value={sol.empresaNome} origin={origem} />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Tipo Contrato" value={sol.tipoContratoLabel} origin={origem} />
            {sol.prazoDias != null && <FieldRow label="Prazo (dias)" value={String(sol.prazoDias)} origin={origem} />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Motivo Requisição" value={sol.motivoRequisicaoLabel} origin={origem} />
            <FieldRow label="CNH Obrigatória" value={sol.cnhObrigatoria ? "Sim" : "Não"} origin={origem} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Disp. Viagens" value={sol.disponibilidadeViagens ? "Sim" : "Não"} origin={origem} />
            <FieldRow label="Escala" value={sol.escalaTrabalho} origin={origem} />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Centro de Custo" value={sol.centroCustoNome} origin={origem} />
            <FieldRow label="Unidade Lotação" value={sol.unidadeLotacaoNome} origin={origem} />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Solicitante" value={sol.solicitanteNome} origin={origem} />
            <FieldRow
              label="Data da Solicitação"
              value={new Date(sol.solicitacaoCriadaEm).toLocaleDateString("pt-BR")}
              origin={origem}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Field Row ─────────────────────────────────────────── */

function FieldRow({
  label,
  value,
  origin,
}: {
  label: string;
  value: string | null | undefined;
  origin: "gestor" | "rh" | "rm";
}) {
  const badgeLabel = origin === "rm" ? "RM" : origin === "gestor" ? "Gestor" : "RH";
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Badge variant={origin === "gestor" || origin === "rm" ? "outline" : "default"} className="text-[10px] px-1 py-0 h-4">
          {badgeLabel}
        </Badge>
      </div>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}
