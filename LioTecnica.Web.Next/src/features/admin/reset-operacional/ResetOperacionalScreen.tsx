"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { env } from "@/lib/env";
import { getTenantId } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ScopeItem {
  label: string;
  description: string;
  count: number;
}

interface CountsDto {
  candidatos: number;
  talentos: number;
  candidaturas: number;
  preAdmissoes: number;
  vagasTeste: number;
  solicitacoesTeste: number;
  processoSeletivoRegistros: number;
  vagasRm: number;
  solicitacoesRm: number;
}

interface PreviewResponse {
  tenantId: string;
  allowed: boolean;
  environment: string;
  willRemove: CountsDto;
  willPreserve: CountsDto;
  removeScope: ScopeItem[];
  preserveScope: ScopeItem[];
}

interface ProgressMessage {
  stage: string;
  message: string;
  percent: number | null;
  atUtc: string;
}

const STEPS = [
  { stage: "start", label: "Iniciando" },
  { stage: "vinculos", label: "Removendo propostas e participações" },
  { stage: "candidatos", label: "Removendo candidatos" },
  { stage: "talentos", label: "Removendo talentos" },
  { stage: "sql", label: "Limpando admissões, vagas de teste e fluxo RM" },
  { stage: "done", label: "Finalizando" },
] as const;

function formatCount(count: number, alwaysShow = false): string {
  if (count === 0 && !alwaysShow) return "—";
  return count.toLocaleString("pt-BR");
}

export default function ResetOperacionalScreen() {
  const tenantId = getTenantId() ?? "";
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [executing, setExecuting] = useState(false);
  const [progress, setProgress] = useState<ProgressMessage | null>(null);
  const [logLines, setLogLines] = useState<ProgressMessage[]>([]);
  const connRef = useRef<ReturnType<HubConnectionBuilder["build"]> | null>(null);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/tenant-operational-reset/preview");
      if (res.status === 404) {
        setPreview(null);
        return;
      }
      if (res.status === 403) {
        setPreview(null);
        toast.error("Acesso restrito ao perfil Owner.");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setPreview((await res.json()) as PreviewResponse);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar prévia.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const stepStatuses = useMemo(() => {
    const currentStage = progress?.stage ?? "";
    const currentIndex = STEPS.findIndex((s) => s.stage === currentStage);
    return STEPS.map((step, index) => {
      if (executing && progress?.stage === "done") return "done" as const;
      if (index < currentIndex) return "done" as const;
      if (index === currentIndex) return executing ? "active" as const : "pending" as const;
      return "pending" as const;
    });
  }, [executing, progress?.stage]);

  async function ensureHubConnection(): Promise<string | null> {
    const apiBase = (env.API_BASE || "").replace(/\/+$/, "");
    const hubUrl = `${apiBase}/hubs/ops-reset?tenantId=${encodeURIComponent(tenantId)}`;
    const conn = new HubConnectionBuilder()
      .withUrl(hubUrl)
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    conn.on("resetProgress", (msg: ProgressMessage) => {
      setProgress(msg);
      setLogLines((prev) => [...prev.slice(-40), msg]);
    });

    await conn.start();
    connRef.current = conn;
    return conn.connectionId ?? null;
  }

  async function stopHub() {
    const conn = connRef.current;
    connRef.current = null;
    if (conn) await conn.stop().catch(() => undefined);
  }

  async function handleExecute() {
    if (confirmText.trim().toUpperCase() !== "RESETAR") {
      toast.error('Digite "RESETAR" para confirmar.');
      return;
    }

    setConfirmOpen(false);
    setConfirmText("");
    setExecuting(true);
    setProgress(null);
    setLogLines([]);

    try {
      const connectionId = await ensureHubConnection();
      const res = await apiFetch("/api/tenant-operational-reset/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ connectionId }),
      });
      const json = (await res.json()) as { ok?: boolean; message?: string };
      if (!res.ok || !json.ok) throw new Error(json.message ?? `HTTP ${res.status}`);
      toast.success(json.message ?? "Reset operacional concluído.");
      setAcknowledged(false);
      await loadPreview();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao executar reset.");
    } finally {
      setExecuting(false);
      await stopHub();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preview?.allowed) {
    return (
      <section className="space-y-4 max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Reset operacional</h1>
        <p className="text-muted-foreground text-sm">
          Esta ferramenta está disponível apenas em ambientes de desenvolvimento e homologação.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-8 max-w-5xl">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" />
            Reset operacional
          </h1>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            Owner · Dev/HML
          </span>
        </div>
        <p className="text-muted-foreground text-sm mt-2 max-w-3xl">
          Limpa dados gerados durante testes de recrutamento e admissão — candidatos, processos
          seletivos, vagas de teste e pré-admissões.{" "}
          <strong className="text-foreground font-medium">
            Configurações, requisições RM e cadastros base não são alterados.
          </strong>
        </p>
      </div>

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
        Tenant: <span className="font-semibold">{preview.tenantId}</span> · Ambiente:{" "}
        <span className="font-semibold">{preview.environment}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-red-200/70 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-red-700">
            <Trash2 className="size-4" />
            <h2 className="font-semibold">Será apagado</h2>
          </div>
          <ul className="space-y-3">
            {preview.removeScope.map((item) => (
              <li key={item.label} className="flex gap-3 text-sm">
                <span className="mt-0.5 min-w-[2.5rem] text-right font-semibold tabular-nums text-red-700">
                  {formatCount(item.count)}
                </span>
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-muted-foreground text-xs">{item.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-emerald-200/70 bg-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <ShieldCheck className="size-4" />
            <h2 className="font-semibold">Não será alterado</h2>
          </div>
          <ul className="space-y-3">
            {preview.preserveScope.map((item) => (
              <li key={item.label} className="flex gap-3 text-sm">
                <span className="mt-0.5 min-w-[2.5rem] text-right font-semibold tabular-nums text-emerald-700">
                  {item.count > 0 ? formatCount(item.count) : "✓"}
                </span>
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-muted-foreground text-xs">{item.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {executing && (
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" />
              Reset em andamento
            </h2>
            <span className="text-sm tabular-nums text-muted-foreground">
              {progress?.percent ?? 0}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${progress?.percent ?? 0}%` }}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {STEPS.map((step, index) => (
              <div key={step.stage} className="flex items-center gap-2 text-sm">
                {stepStatuses[index] === "done" ? (
                  <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                ) : stepStatuses[index] === "active" ? (
                  <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                ) : (
                  <Circle className="size-4 text-muted-foreground/40 shrink-0" />
                )}
                <span
                  className={cn(
                    stepStatuses[index] === "active" && "font-medium",
                    stepStatuses[index] === "pending" && "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
              </div>
            ))}
          </div>
          {logLines.length > 0 && (
            <div className="rounded-lg bg-muted/40 p-3 max-h-40 overflow-y-auto font-mono text-xs space-y-1">
              {logLines.map((line, i) => (
                <div key={`${line.atUtc}-${i}`} className="text-muted-foreground">
                  [{new Date(line.atUtc).toLocaleTimeString("pt-BR")}] {line.message}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Não feche esta página até a conclusão.</p>
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="mt-1 size-4 rounded border border-input"
            checked={acknowledged}
            disabled={executing}
            onChange={(e) => setAcknowledged(e.target.checked)}
          />
          <span>Li e entendo que esta ação não pode ser desfeita.</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={executing}
            onClick={() => void loadPreview()}
          >
            <RefreshCw className="size-4 mr-2" />
            Atualizar prévia
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!acknowledged || executing}
            onClick={() => setConfirmOpen(true)}
          >
            Executar reset operacional
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar reset operacional</DialogTitle>
            <DialogDescription>
              Digite <strong>RESETAR</strong> para confirmar a operação no tenant{" "}
              <strong>{preview.tenantId}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
            Configurações, requisições RM e cadastros base não serão alterados.
          </div>

          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• {formatCount(preview.willRemove.candidatos, true)} candidato(s)</li>
            <li>• {formatCount(preview.willRemove.talentos, true)} talento(s)</li>
            <li>• {formatCount(preview.willRemove.preAdmissoes, true)} pré-admissão(ões)</li>
            <li>• {formatCount(preview.willRemove.vagasTeste, true)} vaga(s) de teste</li>
            <li>• {formatCount(preview.willRemove.solicitacoesTeste, true)} solicitação(ões) de teste</li>
          </ul>

          <div className="space-y-2">
            <Label htmlFor="confirm-reset">Confirmação</Label>
            <Input
              id="confirm-reset"
              value={confirmText}
              placeholder="Digite RESETAR"
              autoComplete="off"
              onChange={(e) => setConfirmText(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={confirmText.trim().toUpperCase() !== "RESETAR"}
              onClick={() => void handleExecute()}
            >
              Confirmar e executar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
