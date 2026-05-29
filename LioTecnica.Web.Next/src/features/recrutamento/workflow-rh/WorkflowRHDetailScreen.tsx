"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  CheckCircle2,
  SkipForward,
  Hand,
  XCircle,
  History,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StepperProgress, { type StepperStep } from "@/components/feedback/StepperProgress";

import StepRevisaoRequisicao from "./steps/StepRevisaoRequisicao";
import StepComplementoDados from "./steps/StepComplementoDados";
import StepDefinicaoProcesso from "./steps/StepDefinicaoProcesso";
import StepPublicacaoVaga from "./steps/StepPublicacaoVaga";
import StepGenerico from "./steps/StepGenerico";

/* ─── Types ─────────────────────────────────────────────── */

export interface WorkflowDetail {
  id: string;
  tipoWorkflow: number;
  tipoWorkflowLabel: string;
  status: number;
  statusLabel: string;
  vagaId: string | null;
  vagaTitulo: string | null;
  preAdmissaoId: string | null;
  candidatoNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  dataInicio: string | null;
  dataConclusao: string | null;
  slaPrazoDias: number | null;
  slaExcedido: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  etapas: EtapaDetail[];
  dadosSolicitacao: DadosSolicitacao | null;
}

export interface EtapaDetail {
  id: string;
  ordem: number;
  codigo: string;
  label: string;
  descricao: string | null;
  status: number;
  statusLabel: string;
  obrigatoria: boolean;
  responsavelId: string | null;
  responsavelNome: string | null;
  roleFilaId: string | null;
  roleFilaNome: string | null;
  slaPrazoDias: number | null;
  slaExcedido: boolean;
  dataInicio: string | null;
  dataConclusao: string | null;
  dadosJson: string | null;
  observacoes: string | null;
  createdAtUtc: string;
}

export interface DadosSolicitacao {
  solicitacaoId: string;
  titulo: string | null;
  justificativa: string | null;
  qtdPosicoes: number;
  urgenciaLabel: string | null;
  tipoSolicitacaoLabel: string | null;
  isConfidencial: boolean;
  substituidoNome: string | null;
  jobPositionName: string | null;
  areaName?: string | null;
  unitName: string | null;
  tipoContratoLabel: string | null;
  prazoDias: number | null;
  motivoRequisicaoLabel: string | null;
  cnhObrigatoria: boolean | null;
  disponibilidadeViagens: boolean | null;
  escalaTrabalho: string | null;
  empresaNome: string | null;
  centroCustoNome: string | null;
  unidadeLotacaoNome: string | null;
  solicitanteNome: string;
  requisicaoOrigemRm?: boolean;
  rmRequisicaoCodigo?: string | null;
  solicitacaoCriadaEm: string;
}

/* ─── Helpers ───────────────────────────────────────────── */

function mapEtapaToStepperStatus(etapa: EtapaDetail): StepperStep["status"] {
  if (etapa.slaExcedido && etapa.status === 1) return "overdue";
  switch (etapa.status) {
    case 0: return "pending";   // NaoIniciada
    case 1: return "current";   // EmAndamento
    case 2: return "done";      // Concluida
    case 3: return "skipped";   // Pulada
    case 4: return "blocked";   // Bloqueada
    default: return "pending";
  }
}

function slaInfo(etapa: EtapaDetail): StepperStep["slaInfo"] {
  if (!etapa.slaPrazoDias || !etapa.dataInicio) return undefined;
  const start = new Date(etapa.dataInicio).getTime();
  const now = Date.now();
  const elapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return { daysRemaining: etapa.slaPrazoDias - elapsed, totalDays: etapa.slaPrazoDias };
}

/* ─── Component ─────────────────────────────────────────── */

export default function WorkflowRHDetailScreen({ workflowId }: { workflowId: string }) {
  const router = useRouter();
  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeEtapaId, setActiveEtapaId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchWorkflow = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/workflow-rh/${workflowId}`);
      if (!res.ok) throw new Error("Erro ao buscar workflow");
      const data: WorkflowDetail = await res.json();
      setWorkflow(data);

      // Auto-select first active/pending step
      if (!activeEtapaId) {
        const active = data.etapas.find(e => e.status === 1) ?? data.etapas.find(e => e.status === 0);
        if (active) setActiveEtapaId(active.id);
        else if (data.etapas.length > 0) setActiveEtapaId(data.etapas[0].id);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar workflow");
    } finally {
      setLoading(false);
    }
  }, [workflowId, activeEtapaId]);

  useEffect(() => {
    fetchWorkflow();
  }, [fetchWorkflow]);

  // ── Actions ────────────────────────────────────────────

  const doAction = async (action: string, body?: object) => {
    if (!activeEtapaId || !workflow) return;
    setActionLoading(true);
    try {
      const res = await apiFetch(`/api/workflow-rh/${workflow.id}/etapas/${activeEtapaId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || `Erro ao ${action}`);
      }
      toast.success(`Etapa ${action === "iniciar" ? "iniciada" : action === "concluir" ? "concluida" : action === "pular" ? "pulada" : "atualizada"}`);
      await fetchWorkflow();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erro ao atualizar etapa");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !workflow) {
    return <div className="p-4 text-center text-muted-foreground">Carregando...</div>;
  }

  if (!workflow) {
    return <div className="p-4 text-center text-muted-foreground">Workflow não encontrado.</div>;
  }

  const activeEtapa = workflow.etapas.find(e => e.id === activeEtapaId);

  const stepperSteps: StepperStep[] = workflow.etapas.map(e => ({
    label: e.label,
    description: e.statusLabel,
    status: mapEtapaToStepperStatus(e),
    slaInfo: slaInfo(e),
    onClick: () => setActiveEtapaId(e.id),
  }));

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => router.push("/app/painel-rh")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">
            {workflow.vagaTitulo ?? workflow.candidatoNome ?? "Workflow RH"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {workflow.tipoWorkflowLabel} &middot; {workflow.statusLabel}
            {workflow.responsavelNome && ` &middot; ${workflow.responsavelNome}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchWorkflow} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Main layout: sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Stepper */}
        <div className="w-64 flex-shrink-0 border-r p-4 overflow-y-auto bg-muted/20">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Etapas</h2>
          <StepperProgress steps={stepperSteps} orientation="vertical" />
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeEtapa ? (
            <div className="max-w-3xl">
              {/* Step header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold">{activeEtapa.label}</h2>
                  {activeEtapa.descricao && (
                    <p className="text-sm text-muted-foreground mt-1">{activeEtapa.descricao}</p>
                  )}
                </div>
                <Badge
                  variant={activeEtapa.slaExcedido ? "destructive" : activeEtapa.status === 2 ? "default" : "secondary"}
                >
                  {activeEtapa.statusLabel}
                </Badge>
              </div>

              {/* Step actions bar */}
              {activeEtapa.status <= 1 && (
                <div className="flex items-center gap-2 mb-6 pb-4 border-b">
                  {activeEtapa.status === 0 && (
                    <Button size="sm" onClick={() => doAction("iniciar")} disabled={actionLoading}>
                      <Play className="size-3.5 mr-1.5" />
                      Iniciar Etapa
                    </Button>
                  )}
                  {activeEtapa.status === 1 && (
                    <Button size="sm" onClick={() => doAction("concluir", {})} disabled={actionLoading}>
                      <CheckCircle2 className="size-3.5 mr-1.5" />
                      Concluir Etapa
                    </Button>
                  )}
                  {!activeEtapa.obrigatoria && activeEtapa.status <= 1 && (
                    <Button size="sm" variant="outline" onClick={() => doAction("pular", { observacoes: "Pulada pelo RH" })} disabled={actionLoading}>
                      <SkipForward className="size-3.5 mr-1.5" />
                      Pular
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => doAction("assumir")} disabled={actionLoading}>
                    <Hand className="size-3.5 mr-1.5" />
                    Assumir
                  </Button>
                </div>
              )}

              {/* Step-specific content */}
              <StepContent
                etapa={activeEtapa}
                workflow={workflow}
                onRefresh={fetchWorkflow}
              />
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-12">
              Selecione uma etapa na barra lateral.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Step Content Router ───────────────────────────────── */

function StepContent({
  etapa,
  workflow,
  onRefresh,
}: {
  etapa: EtapaDetail;
  workflow: WorkflowDetail;
  onRefresh: () => void;
}) {
  switch (etapa.codigo) {
    case "revisao-requisicao":
      return <StepRevisaoRequisicao etapa={etapa} workflow={workflow} onRefresh={onRefresh} />;
    case "complemento-dados":
      return <StepComplementoDados etapa={etapa} workflow={workflow} onRefresh={onRefresh} />;
    case "definicao-processo":
      return <StepDefinicaoProcesso etapa={etapa} workflow={workflow} onRefresh={onRefresh} />;
    case "publicacao-vaga":
      return <StepPublicacaoVaga etapa={etapa} workflow={workflow} onRefresh={onRefresh} />;
    default:
      return <StepGenerico etapa={etapa} workflow={workflow} onRefresh={onRefresh} />;
  }
}
