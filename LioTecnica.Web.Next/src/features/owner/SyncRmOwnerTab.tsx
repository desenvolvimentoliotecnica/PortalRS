"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    CheckCircle2,
    XCircle,
    Clock,
    AlertTriangle,
    Database,
    Ghost,
    ChevronDown,
    ChevronRight,
    PlayCircle,
    Loader2,
    RefreshCw,
    Square,
    Terminal,
} from "lucide-react";
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useQueryClient } from "@tanstack/react-query";
import { TableSkeleton } from "@/components/ui/ScreenSkeleton";
import { apiFetch } from "@/lib/api";

interface TenantRow {
    tenantId: string;
    name: string;
}

/* Status enum espelha RhPortal.Api.Domain.Enums.RmSyncStatus.
 * API serializa como inteiro (short). Texto é resolvido aqui. */
type SyncStatus = 1 | 2 | 3 | 4;

const STATUS_LABEL: Record<SyncStatus, { label: string; color: string; icon: React.ElementType }> = {
    1: { label: "Em andamento", color: "bg-amber-500/15 text-amber-700", icon: Clock },
    2: { label: "Sucesso", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    3: { label: "Falha", color: "bg-red-500/15 text-red-700", icon: XCircle },
    4: { label: "Falha parcial", color: "bg-orange-500/15 text-orange-700", icon: AlertTriangle },
};

interface SyncRmRow {
    tenantId: string;
    id: string;
    entidade: string;
    operacao: string;
    status: SyncStatus;
    totalLidos: number;
    criados: number;
    atualizados: number;
    ignorados: number;
    startedAtUtc: string;
    endedAtUtc: string | null;
    erroMensagem: string | null;
    watermarkAplicadoUtc: string | null;
    watermarkNovoUtc: string | null;
}

interface AlertaRow {
    tenantId: string;
    id: string;
    tipo: string;
    entidadeNome: string;
    entidadeId: string | null;
    chaveRm: string;
    detectadoEmUtc: string;
    ciclosAusente: number;
    resolvidoEmUtc: string | null;
    acao: string | null;
}

interface RmSyncLogResponse {
    exists: boolean;
    lastModifiedUtc: string | null;
    lines: string[];
}

type StatusFiltro = "all" | "1" | "2" | "3" | "4";

type WorkerCycleResponse = {
    intervalMinutes: number;
};

export default function SyncRmOwnerTab() {
    const queryClient = useQueryClient();
    const [tenantFiltro, setTenantFiltro] = useState<string>("");
    const [entidadeFiltro, setEntidadeFiltro] = useState<string>("");
    const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>("all");
    const [alertasExpandidos, setAlertasExpandidos] = useState(false);
    const [resolvendoIds, setResolvendoIds] = useState<Set<string>>(new Set());
    const [disparandoSync, setDisparandoSync] = useState(false);
    const [cancelandoSync, setCancelandoSync] = useState(false);
    const [feedbackSync, setFeedbackSync] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
    const [logData, setLogData] = useState<RmSyncLogResponse | null>(null);
    const [logLoading, setLogLoading] = useState(false);
    const [logError, setLogError] = useState<string | null>(null);
    const terminalRef = useRef<HTMLDivElement | null>(null);
    const [intervalDraft, setIntervalDraft] = useState(5);
    const [workerCycleSaveMsg, setWorkerCycleSaveMsg] = useState<string | null>(null);
    const [workerCycleSaving, setWorkerCycleSaving] = useState(false);

    const { data: tenants = [] } = useApiQuery<TenantRow[]>(
        ["owner", "tenants"],
        "/api/owner/tenants"
    );

    /* Alertas de zumbi (Frente C) — só os abertos por padrão. */
    const alertasParams = new URLSearchParams();
    if (tenantFiltro) alertasParams.set("tenantId", tenantFiltro);
    alertasParams.set("incluirResolvidos", "false");
    alertasParams.set("limit", "200");
    const { data: alertas = [], isLoading: loadingAlertas } = useApiQuery<AlertaRow[]>(
        ["owner", "integracao", "sync-rm", "alertas", tenantFiltro],
        `/api/owner/integracao/sync-rm/alertas?${alertasParams.toString()}`
    );

    const workerCycleUrl = tenantFiltro
        ? `/api/owner/integracao/sync-rm/worker-cycle?tenantId=${encodeURIComponent(tenantFiltro)}`
        : "/api/owner/integracao/sync-rm/worker-cycle?tenantId=_";
    const {
        data: workerCycleResp,
        isLoading: workerCycleLoading,
        error: workerCycleErr,
    } = useApiQuery<WorkerCycleResponse>(
        ["owner", "integracao", "sync-rm", "worker-cycle", tenantFiltro],
        workerCycleUrl,
        { enabled: Boolean(tenantFiltro) }
    );

    useEffect(() => {
        if (workerCycleResp) setIntervalDraft(workerCycleResp.intervalMinutes);
    }, [workerCycleResp]);

    const carregarLog = useCallback(async () => {
        setLogLoading(true);
        setLogError(null);
        try {
            const res = await apiFetch("/api/owner/integracao/sync-rm/logs?tail=350", { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            setLogData((await res.json()) as RmSyncLogResponse);
        } catch (err) {
            setLogError(err instanceof Error ? err.message : "Falha ao carregar log.");
        } finally {
            setLogLoading(false);
        }
    }, []);

    useEffect(() => {
        void carregarLog();
        const id = setInterval(() => {
            void carregarLog();
        }, 3000);
        return () => clearInterval(id);
    }, [carregarLog]);

    useEffect(() => {
        const terminal = terminalRef.current;
        if (!terminal) return;
        terminal.scrollTop = terminal.scrollHeight;
    }, [logData?.lines]);

    async function disparaSyncAgora() {
        setDisparandoSync(true);
        setFeedbackSync(null);
        try {
            const res = await apiFetch("/api/owner/integracao/sync-rm/run-now", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (res.status === 202) {
                const body = (await res.json()) as { message: string; pid?: number };
                setFeedbackSync({
                    tipo: "ok",
                    msg: `${body.message} ${body.pid ? `(PID ${body.pid})` : ""} — recarregando em 15s.`,
                });
                // Refetch após delay para o worker ter tempo de gravar os primeiros runs.
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["owner", "integracao", "sync-rm"] });
                    void carregarLog();
                    setFeedbackSync(null);
                }, 15000);
            } else if (res.status === 409) {
                setFeedbackSync({ tipo: "erro", msg: "Já existe um ciclo em execução. Aguarde finalizar." });
            } else if (res.status === 503) {
                const body = (await res.json().catch(() => ({}))) as { hint?: string };
                setFeedbackSync({
                    tipo: "erro",
                    msg: `Worker não encontrado no servidor. ${body.hint ?? ""}`,
                });
            } else {
                setFeedbackSync({ tipo: "erro", msg: `Falha HTTP ${res.status}` });
            }
        } catch (err) {
            setFeedbackSync({ tipo: "erro", msg: err instanceof Error ? err.message : "Falha ao disparar sync." });
        } finally {
            setDisparandoSync(false);
        }
    }

    async function interromperSync() {
        setCancelandoSync(true);
        setFeedbackSync(null);
        try {
            const res = await apiFetch("/api/owner/integracao/sync-rm/cancel", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            if (res.status === 202) {
                const body = (await res.json().catch(() => ({}))) as { message?: string };
                setFeedbackSync({
                    tipo: "ok",
                    msg: body.message ?? "Interrupção solicitada. O worker vai parar no próximo ponto seguro.",
                });
                setTimeout(() => {
                    queryClient.invalidateQueries({ queryKey: ["owner", "integracao", "sync-rm"] });
                    void carregarLog();
                    setFeedbackSync(null);
                }, 5000);
            } else {
                setFeedbackSync({ tipo: "erro", msg: `Falha HTTP ${res.status}` });
            }
        } catch (err) {
            setFeedbackSync({ tipo: "erro", msg: err instanceof Error ? err.message : "Falha ao solicitar interrupção." });
        } finally {
            setCancelandoSync(false);
        }
    }

    async function resolverAlerta(id: string) {
        setResolvendoIds((prev) => new Set(prev).add(id));
        try {
            const res = await apiFetch(`/api/owner/integracao/sync-rm/alertas/${id}/resolver`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ acao: "Resolvido manualmente pelo Owner" }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            await queryClient.invalidateQueries({ queryKey: ["owner", "integracao", "sync-rm", "alertas"] });
        } catch (err) {
            console.error("Falha ao resolver alerta", err);
        } finally {
            setResolvendoIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    }

    async function salvarWorkerCycleMinutos() {
        if (!tenantFiltro) return;
        setWorkerCycleSaving(true);
        setWorkerCycleSaveMsg(null);
        const clamped = Math.min(1440, Math.max(1, Number(intervalDraft) || 5));
        try {
            const res = await apiFetch(
                `/api/owner/integracao/sync-rm/worker-cycle?tenantId=${encodeURIComponent(tenantFiltro)}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ intervalMinutes: clamped }),
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const body = (await res.json()) as WorkerCycleResponse;
            setIntervalDraft(body.intervalMinutes);
            setWorkerCycleSaveMsg("Salvo no banco do tenant.");
            await queryClient.invalidateQueries({
                queryKey: ["owner", "integracao", "sync-rm", "worker-cycle", tenantFiltro],
            });
            setTimeout(() => setWorkerCycleSaveMsg(null), 4000);
        } catch (err) {
            setWorkerCycleSaveMsg(err instanceof Error ? err.message : "Falha ao salvar intervalo.");
        } finally {
            setWorkerCycleSaving(false);
        }
    }

    const params = new URLSearchParams();
    if (tenantFiltro) params.set("tenantId", tenantFiltro);
    if (entidadeFiltro) params.set("entidade", entidadeFiltro);
    if (statusFiltro !== "all") params.set("status", statusFiltro);
    params.set("limit", "200");
    const qs = `?${params.toString()}`;

    const { data = [], isLoading } = useApiQuery<SyncRmRow[]>(
        ["owner", "integracao", "sync-rm", tenantFiltro, entidadeFiltro, statusFiltro],
        `/api/owner/integracao/sync-rm${qs}`
    );

    /* Lista de entidades distintas para o select. Constrói a partir do que vem na resposta;
     * se for vazia (primeira carga sem dados), oferece um set conhecido para não travar o filtro. */
    const entidades = useMemo(() => {
        const fromData = Array.from(new Set(data.map((r) => r.entidade))).sort();
        if (fromData.length > 0) return fromData;
        return [
            "VHIERARQUIA",
            "GFILIAL",
            "PSECAO",
            "PFUNCAO",
            "PCARGO",
            "UNIDADE",
            "PPESSOA",
            "PFUNC",
            "VREQDESLIGAMENTO",
            "VREQTRANSFPROMOCAO",
            "VRSVAGAS",
            "CANDIDATOS_VAGA",
        ];
    }, [data]);

    /* nowMs em state para não chamar Date.now() durante render (regra de pureza do React).
     * Atualiza a cada minuto para o "últimas 24h" continuar fiel se a tela ficar aberta. */
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNowMs(Date.now()), 60_000);
        return () => clearInterval(id);
    }, []);

    /* KPIs: contagem de runs por status nas últimas 24h. Tudo client-side em cima do limit=200. */
    const kpis = useMemo(() => {
        const cutoff = nowMs - 24 * 60 * 60 * 1000;
        const last24h = data.filter((r) => new Date(r.startedAtUtc).getTime() >= cutoff);
        return {
            ultimo: data[0] ?? null,
            falhasUltimas24h: last24h.filter((r) => r.status === 3 || r.status === 4).length,
            sucessosUltimas24h: last24h.filter((r) => r.status === 2).length,
            emAndamento: data.filter((r) => r.status === 1).length,
        };
    }, [data, nowMs]);

    return (
        <div className="space-y-4">
            {/* Botão "Sincronizar agora" + feedback. Dispara o worker como Process.Start no servidor. */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    disabled={disparandoSync}
                    onClick={disparaSyncAgora}
                    className="inline-flex items-center gap-2 rounded-md bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-3 py-1.5 text-sm font-medium transition-colors"
                >
                    {disparandoSync ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <PlayCircle className="size-4" />
                    )}
                    {disparandoSync ? "Disparando..." : "Sincronizar agora"}
                </button>
                <button
                    type="button"
                    disabled={cancelandoSync}
                    onClick={interromperSync}
                    className="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
                >
                    {cancelandoSync ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <Square className="size-4" />
                    )}
                    {cancelandoSync ? "Solicitando..." : "Interromper sync"}
                </button>
                {feedbackSync && (
                    <span
                        className={`text-xs ${
                            feedbackSync.tipo === "ok" ? "text-emerald-700" : "text-red-700"
                        }`}
                    >
                        {feedbackSync.msg}
                    </span>
                )}
                <span className="text-xs text-muted-foreground">
                    O ciclo automático usa o intervalo salvo no banco por tenant (configure nos filtros abaixo ao escolher um tenant).
                </span>
            </div>

            {/* Alertas de zumbi (Frente C) — banner no topo quando há alertas abertos. */}
            <div className="rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-100">
                        <Terminal className="size-4" />
                        <div>
                            <div className="text-sm font-semibold">Log em tempo real</div>
                            <div className="text-xs text-slate-400">
                                {logData?.exists
                                    ? `Atualizado em ${
                                          logData.lastModifiedUtc
                                              ? new Date(logData.lastModifiedUtc).toLocaleString("pt-BR", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                })
                                              : "-"
                                      }`
                                    : "Aguardando o worker criar o arquivo de log"}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => void carregarLog()}
                        disabled={logLoading}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-700 px-2.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-900 disabled:opacity-60"
                    >
                        <RefreshCw className={`size-3.5 ${logLoading ? "animate-spin" : ""}`} />
                        Atualizar
                    </button>
                </div>
                <div
                    ref={terminalRef}
                    className="h-72 overflow-auto px-4 py-3 font-mono text-[12px] leading-5 text-slate-200"
                >
                    {logError && <div className="text-red-300">Falha ao carregar log: {logError}</div>}
                    {!logError && !logData?.exists && (
                        <div className="text-slate-500">Nenhuma linha de log encontrada ainda.</div>
                    )}
                    {!logError &&
                        logData?.exists &&
                        logData.lines.map((line, index) => (
                            <div key={`${index}-${line}`} className={getLogLineClass(line)}>
                                {line || "\u00A0"}
                            </div>
                        ))}
                </div>
            </div>

            {alertas.length > 0 && (
                <div className="rounded-xl border border-orange-300/60 bg-orange-50 p-3">
                    <button
                        type="button"
                        onClick={() => setAlertasExpandidos((v) => !v)}
                        className="flex items-center gap-2 w-full text-left"
                    >
                        {alertasExpandidos ? (
                            <ChevronDown className="size-4 text-orange-700" />
                        ) : (
                            <ChevronRight className="size-4 text-orange-700" />
                        )}
                        <Ghost className="size-5 text-orange-700" />
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-orange-900">
                                {alertas.length}{" "}
                                {alertas.length === 1 ? "alerta de zumbi aberto" : "alertas de zumbi abertos"}
                            </div>
                            <div className="text-xs text-orange-800/80">
                                Vagas/funcionários no Portal que sumiram do RM por 3+ ciclos. Investigue e resolva no TOTVS — o Portal não altera status automaticamente.
                            </div>
                        </div>
                    </button>

                    {alertasExpandidos && (
                        <div className="mt-3 rounded-lg border border-orange-200 bg-white">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Tenant</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Chave RM</TableHead>
                                        <TableHead className="text-right">Ciclos ausente</TableHead>
                                        <TableHead className="text-right">Detectado em</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingAlertas && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-3">
                                                <TableSkeleton rows={3} />
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {alertas.map((a) => {
                                        const tenantName = tenants.find((t) => t.tenantId === a.tenantId)?.name;
                                        const resolvendo = resolvendoIds.has(a.id);
                                        return (
                                            <TableRow key={a.id} className="hover:bg-orange-50/50">
                                                <TableCell className="text-xs font-mono text-muted-foreground">
                                                    {tenantName ?? a.tenantId}
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-orange-200/40 text-orange-900">
                                                        <AlertTriangle className="size-3" />
                                                        {a.tipo === "VagaAusente" ? "Vaga" : a.tipo === "FuncionarioAusente" ? "Funcionário" : a.tipo}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm font-mono">{a.chaveRm}</TableCell>
                                                <TableCell className="text-right text-sm font-semibold text-orange-700">
                                                    {a.ciclosAusente}
                                                </TableCell>
                                                <TableCell className="text-right text-xs text-muted-foreground">
                                                    {new Date(a.detectadoEmUtc).toLocaleString("pt-BR", {
                                                        day: "2-digit",
                                                        month: "2-digit",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <button
                                                        type="button"
                                                        disabled={resolvendo}
                                                        onClick={() => resolverAlerta(a.id)}
                                                        className="text-xs font-medium px-2.5 py-1 rounded-md border border-orange-300 hover:bg-orange-100 disabled:opacity-50"
                                                    >
                                                        {resolvendo ? "Resolvendo..." : "Resolver"}
                                                    </button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <KpiCard
                    label="Último ciclo"
                    value={
                        kpis.ultimo
                            ? new Date(kpis.ultimo.startedAtUtc).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                              })
                            : "—"
                    }
                    sub={kpis.ultimo?.entidade ?? "sem dados"}
                />
                <KpiCard label="Sucessos (24h)" value={String(kpis.sucessosUltimas24h)} tone="success" />
                <KpiCard
                    label="Falhas (24h)"
                    value={String(kpis.falhasUltimas24h)}
                    tone={kpis.falhasUltimas24h > 0 ? "danger" : "neutral"}
                />
                <KpiCard
                    label="Em andamento"
                    value={String(kpis.emAndamento)}
                    tone={kpis.emAndamento > 0 ? "warning" : "neutral"}
                />
            </div>

            <div className="rounded-xl border border-border/50 bg-card shadow-sm p-4">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                    <select
                        value={tenantFiltro}
                        onChange={(e) => setTenantFiltro(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="">Todos os tenants</option>
                        {tenants.map((t) => (
                            <option key={t.tenantId} value={t.tenantId}>
                                {t.name} ({t.tenantId})
                            </option>
                        ))}
                    </select>

                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border/80 px-2.5 py-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Ciclo RM
                        </span>
                        {!tenantFiltro && (
                            <span className="text-xs text-muted-foreground">
                                Escolha um tenant para editar intervalo (min).
                            </span>
                        )}
                        {tenantFiltro && workerCycleLoading && (
                            <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-label="Carregando" />
                        )}
                        {tenantFiltro && !workerCycleLoading && workerCycleErr && (
                            <span className="text-xs text-destructive">
                                {(workerCycleErr as Error)?.message ?? "Erro ao carregar intervalo."}
                            </span>
                        )}
                        {tenantFiltro && !workerCycleLoading && !workerCycleErr && (
                            <>
                                <label className="sr-only" htmlFor="rm-cycle-minutes">
                                    Minutos entre ciclos
                                </label>
                                <input
                                    id="rm-cycle-minutes"
                                    type="number"
                                    min={1}
                                    max={1440}
                                    value={intervalDraft}
                                    onChange={(e) => {
                                        const n = parseInt(e.target.value, 10);
                                        setIntervalDraft(Number.isFinite(n) ? n : 5);
                                    }}
                                    className="h-7 w-[4.5rem] rounded-md border border-input bg-background px-2 text-xs tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <span className="text-xs text-muted-foreground">min</span>
                                <button
                                    type="button"
                                    disabled={workerCycleSaving}
                                    onClick={() => void salvarWorkerCycleMinutos()}
                                    className="h-7 rounded-md bg-slate-800 px-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
                                >
                                    {workerCycleSaving ? "Salvando…" : "Salvar"}
                                </button>
                                {workerCycleSaveMsg && (
                                    <span
                                        className={`text-xs ${
                                            workerCycleSaveMsg.startsWith("HTTP") || workerCycleSaveMsg.startsWith("Falha")
                                                ? "text-destructive"
                                                : "text-emerald-700"
                                        }`}
                                    >
                                        {workerCycleSaveMsg}
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    <select
                        value={entidadeFiltro}
                        onChange={(e) => setEntidadeFiltro(e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        <option value="">Todas as entidades</option>
                        {entidades.map((e) => (
                            <option key={e} value={e}>
                                {e}
                            </option>
                        ))}
                    </select>

                    <div className="flex gap-1">
                        {(
                            [
                                { key: "all", label: "Todos" },
                                { key: "1", label: "Em andamento" },
                                { key: "2", label: "Sucesso" },
                                { key: "3", label: "Falha" },
                                { key: "4", label: "Parcial" },
                            ] as { key: StatusFiltro; label: string }[]
                        ).map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setStatusFiltro(f.key)}
                                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                                    statusFiltro === f.key
                                        ? "bg-blue-600 text-white"
                                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Entidade</TableHead>
                            <TableHead>Operação</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Lidos</TableHead>
                            <TableHead className="text-right">Iniciado</TableHead>
                            <TableHead className="text-right">Finalizado</TableHead>
                            <TableHead>Mensagem</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-4">
                                    <TableSkeleton rows={5} />
                                </TableCell>
                            </TableRow>
                        )}
                        {!isLoading && data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="py-16 text-center">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <Database className="size-10 opacity-20" />
                                        <p className="text-sm font-medium">Nenhum ciclo registrado</p>
                                        <p className="text-xs opacity-70">
                                            O worker registra cada sync aqui após o próximo ciclo.
                                        </p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                        {data.map((r) => {
                            const meta = STATUS_LABEL[r.status];
                            const Icon = meta?.icon;
                            const tenantName = tenants.find((t) => t.tenantId === r.tenantId)?.name;
                            return (
                                <TableRow key={r.id} className="hover:bg-muted/40">
                                    <TableCell className="text-xs font-mono text-muted-foreground">
                                        {tenantName ?? r.tenantId}
                                    </TableCell>
                                    <TableCell className="text-sm font-mono">{r.entidade}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground capitalize">
                                        {r.operacao}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {meta && Icon && (
                                            <span
                                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}
                                            >
                                                <Icon className="size-3" /> {meta.label}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right text-xs">
                                        {r.totalLidos}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {new Date(r.startedAtUtc).toLocaleString("pt-BR", {
                                            day: "2-digit",
                                            month: "2-digit",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </TableCell>
                                    <TableCell className="text-right text-xs text-muted-foreground">
                                        {r.endedAtUtc
                                            ? new Date(r.endedAtUtc).toLocaleString("pt-BR", {
                                                  day: "2-digit",
                                                  month: "2-digit",
                                                  hour: "2-digit",
                                                  minute: "2-digit",
                                              })
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                                        {r.erroMensagem || "—"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
                <div className="mt-3 text-xs text-muted-foreground">{data.length} registros (limit 200)</div>
            </div>
        </div>
    );
}

function getLogLineClass(line: string) {
    const normalized = line.toLowerCase();
    if (normalized.includes("erro") || normalized.includes("error") || normalized.includes("unauthorized")) {
        return "text-red-300";
    }
    if (normalized.includes("conclu") || normalized.includes("sucesso") || normalized.includes("ok")) {
        return "text-emerald-300";
    }
    if (normalized.includes("iniciada") || normalized.includes("sql")) {
        return "text-cyan-200";
    }
    return "text-slate-200";
}

function KpiCard({
    label,
    value,
    sub,
    tone = "neutral",
}: {
    label: string;
    value: string;
    sub?: string;
    tone?: "neutral" | "success" | "danger" | "warning";
}) {
    const toneClass =
        tone === "success"
            ? "text-emerald-700"
            : tone === "danger"
              ? "text-red-700"
              : tone === "warning"
                ? "text-amber-700"
                : "text-foreground";
    return (
        <div className="rounded-xl border border-border/50 bg-card shadow-sm p-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
            {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
        </div>
    );
}
