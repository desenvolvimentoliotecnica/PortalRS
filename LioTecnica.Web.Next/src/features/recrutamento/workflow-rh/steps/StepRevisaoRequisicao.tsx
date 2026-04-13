"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDetail, WorkflowDetail } from "../WorkflowRHDetailScreen";

/* ─── Component ─────────────────────────────────────────── */

export default function StepRevisaoRequisicao({
  etapa,
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dados da Requisição</CardTitle>
            <Badge variant="secondary" className="text-xs">
              Preenchido pelo Gestor
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <FieldRow label="Título" value={sol.titulo} origin="gestor" />
          <FieldRow label="Justificativa" value={sol.justificativa} origin="gestor" />
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Qtd. Posições" value={String(sol.qtdPosicoes)} origin="gestor" />
            <FieldRow label="Urgência" value={sol.urgenciaLabel} origin="gestor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Tipo" value={sol.tipoSolicitacaoLabel} origin="gestor" />
            <FieldRow label="Confidencial" value={sol.isConfidencial ? "Sim" : "Não"} origin="gestor" />
          </div>
          {sol.substituidoNome && (
            <FieldRow label="Substituído" value={sol.substituidoNome} origin="gestor" />
          )}
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Cargo" value={sol.jobPositionName} origin="gestor" />
            <FieldRow label="Área" value={sol.areaName} origin="gestor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Unidade" value={sol.unitName} origin="gestor" />
            <FieldRow label="Empresa" value={sol.empresaNome} origin="gestor" />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Tipo Contrato" value={sol.tipoContratoLabel} origin="gestor" />
            {sol.prazoDias != null && <FieldRow label="Prazo (dias)" value={String(sol.prazoDias)} origin="gestor" />}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Motivo Requisição" value={sol.motivoRequisicaoLabel} origin="gestor" />
            <FieldRow label="CNH Obrigatória" value={sol.cnhObrigatoria ? "Sim" : "Não"} origin="gestor" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Disp. Viagens" value={sol.disponibilidadeViagens ? "Sim" : "Não"} origin="gestor" />
            <FieldRow label="Escala" value={sol.escalaTrabalho} origin="gestor" />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Centro de Custo" value={sol.centroCustoNome} origin="gestor" />
            <FieldRow label="Unidade Lotação" value={sol.unidadeLotacaoNome} origin="gestor" />
          </div>
          <hr className="border-border" />
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Solicitante" value={sol.solicitanteNome} origin="gestor" />
            <FieldRow
              label="Data da Solicitação"
              value={new Date(sol.solicitacaoCriadaEm).toLocaleDateString("pt-BR")}
              origin="gestor"
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
  origin: "gestor" | "rh";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Badge variant={origin === "gestor" ? "outline" : "default"} className="text-[10px] px-1 py-0 h-4">
          {origin === "gestor" ? "Gestor" : "RH"}
        </Badge>
      </div>
      <span className="text-sm">{value ?? "—"}</span>
    </div>
  );
}
