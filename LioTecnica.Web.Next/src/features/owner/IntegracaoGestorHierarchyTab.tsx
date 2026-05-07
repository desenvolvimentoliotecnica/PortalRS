"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, PlayCircle, RefreshCw, Square, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { apiFetch } from "@/lib/api";

interface TenantRow {
    tenantId: string;
    name: string;
}

interface GestorRmSettingsForm {
    consultaUrlTemplate: string;
    httpUser: string;
    httpPassword: string;
    defaultCodColigada: number;
    delayMsBetweenRequests: number;
}

interface GestorRmSettingsResp {
    tenantId: string;
    consultaUrlTemplate: string;
    httpUser: string;
    passwordConfigured: boolean;
    defaultCodColigada: number;
    delayMsBetweenRequests: number;
}

interface GestorRmRunResp {
    runId: string;
    tenantId: string;
    status: number;
    errorMessage?: string | null;
    startedAtUtc: string;
    endedAtUtc?: string | null;
    progressCurrent: number;
    progressTotal: number;
    logLines: string[];
}

const DEFAULT_URL_HINT =
    "http://servidor:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/KNG.P.017/0/P/?parameters=CODCOLIGADA={CODCOLIGADA};CHAPA={CHAPA}";

function lineClass(line: string) {
    const n = line.toLowerCase();
    if (n.includes("fatal") || n.includes("http ") || n.includes("erro") || n.includes("fail")) return "text-red-300";
    if (n.includes("ok ") || n.includes("fim ")) return "text-emerald-300";
    if (n.includes("gestor_rm") || n.includes("parse_") || n.includes("topo")) return "text-amber-200";
    return "text-slate-200";
}

export default function IntegracaoGestorHierarchyTab() {
    const terminalRef = useRef<HTMLDivElement | null>(null);
    const [tenantSel, setTenantSel] = useState("");
    const [form, setForm] = useState<GestorRmSettingsForm>({
        consultaUrlTemplate: "",
        httpUser: "",
        httpPassword: "",
        defaultCodColigada: 1,
        delayMsBetweenRequests: 250,
    });
    const [passwordConfigured, setPasswordConfigured] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingCfg, setLoadingCfg] = useState(false);

    const [runId, setRunId] = useState<string | null>(null);
    const [runState, setRunState] = useState<GestorRmRunResp | null>(null);
    const [starting, setStarting] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    const { data: tenants = [] } = useApiQuery<TenantRow[]>(["owner", "tenants"], "/api/owner/tenants");

    const tenantsSorted = useMemo(
        () => [...tenants].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        [tenants]
    );

    const loadSettings = useCallback(async () => {
        if (!tenantSel) return;
        setLoadingCfg(true);
        try {
            const res = await apiFetch(`/api/owner/integracao/gestor-rm/settings?tenantId=${encodeURIComponent(tenantSel)}`, {
                cache: "no-store",
            });
            if (res.status === 404) {
                setForm({
                    consultaUrlTemplate: DEFAULT_URL_HINT,
                    httpUser: "",
                    httpPassword: "",
                    defaultCodColigada: 1,
                    delayMsBetweenRequests: 250,
                });
                setPasswordConfigured(false);
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = (await res.json()) as GestorRmSettingsResp;
            setForm({
                consultaUrlTemplate: data.consultaUrlTemplate || DEFAULT_URL_HINT,
                httpUser: data.httpUser || "",
                httpPassword: "",
                defaultCodColigada: data.defaultCodColigada ?? 1,
                delayMsBetweenRequests: data.delayMsBetweenRequests ?? 250,
            });
            setPasswordConfigured(Boolean(data.passwordConfigured));
        } catch {
            toast.error("Falha ao carregar configuração Gestor RM.");
        } finally {
            setLoadingCfg(false);
        }
    }, [tenantSel]);

    useEffect(() => {
        void loadSettings();
    }, [loadSettings]);

    async function salvar() {
        if (!tenantSel) {
            toast.error("Selecione um tenant.");
            return;
        }
        setSaving(true);
        try {
            const res = await apiFetch("/api/owner/integracao/gestor-rm/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tenantId: tenantSel,
                    consultaUrlTemplate: form.consultaUrlTemplate.trim(),
                    httpUser: form.httpUser.trim(),
                    httpPassword: form.httpPassword || null,
                    defaultCodColigada: Number(form.defaultCodColigada) || 1,
                    delayMsBetweenRequests: Number(form.delayMsBetweenRequests) ?? 250,
                }),
            });
            if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error((b as { message?: string }).message ?? `HTTP ${res.status}`);
            }
            const saved = (await res.json()) as GestorRmSettingsResp;
            setPasswordConfigured(Boolean(saved.passwordConfigured));
            setForm((f) => ({ ...f, httpPassword: "" }));
            toast.success("Configuração salva.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao salvar.");
        } finally {
            setSaving(false);
        }
    }

    async function iniciarExecucao() {
        if (!tenantSel) {
            toast.error("Selecione um tenant.");
            return;
        }
        setStarting(true);
        try {
            const res = await apiFetch(
                `/api/owner/integracao/gestor-rm/run?tenantId=${encodeURIComponent(tenantSel)}`,
                {
                    method: "POST",
                }
            );
            if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error((b as { message?: string }).message ?? `HTTP ${res.status}`);
            }
            const data = (await res.json()) as { runId: string };
            setRunId(data.runId);
            toast.success(`Execução iniciada (${data.runId.slice(0, 8)}…).`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao iniciar.");
        } finally {
            setStarting(false);
        }
    }

    async function cancelarExecucao() {
        if (!runId) return;
        setCancelling(true);
        try {
            const res = await apiFetch(`/api/owner/integracao/gestor-rm/run/${runId}/cancel`, { method: "POST" });
            if (!res.ok) {
                const b = await res.json().catch(() => ({}));
                throw new Error((b as { message?: string }).message ?? `HTTP ${res.status}`);
            }
            toast.message("Cancelamento solicitado.");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Falha ao cancelar.");
        } finally {
            setCancelling(false);
        }
    }

    useEffect(() => {
        if (!runId) {
            setRunState(null);
            return;
        }
        let cancelled = false;
        const poll = async () => {
            try {
                const res = await apiFetch(`/api/owner/integracao/gestor-rm/run/${runId}`, { cache: "no-store" });
                if (res.status === 404) return;
                if (!res.ok) return;
                const data = (await res.json()) as GestorRmRunResp;
                if (!cancelled) setRunState(data);
            } catch {
                /* ignore transient */
            }
        };
        void poll();
        const id = setInterval(() => void poll(), 950);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [runId]);

    useEffect(() => {
        const el = terminalRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [runState?.logLines]);

    const running = Boolean(runState && runState.status === 1);

    const statusTxt = runState
        ? runState.status === 2
            ? "Concluída"
            : runState.status === 3
              ? "Falha"
              : runState.status === 4
                ? "Cancelada"
                : "Em execução"
        : "—";

    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                    Consulta o TOTVS RM (consulta parametrizada) para cada funcionário ativo com <strong>MatriculaRm</strong>{" "}
                    (CHAPA) e grava em <strong>GestorDiretoId</strong>. Basic Auth nas credenciais abaixo. Resposta com
                    chefe textual ou sem chefe (topo) tratada pelo parser na API.
                </p>

                <div className="flex flex-wrap gap-3 items-end">
                    <div className="space-y-1 min-w-[220px]">
                        <label className="text-xs font-medium text-muted-foreground">Tenant</label>
                        <select
                            value={tenantSel}
                            onChange={(e) => {
                                setTenantSel(e.target.value);
                                setRunId(null);
                            }}
                            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                        >
                            <option value="">Selecionar…</option>
                            {tenantsSorted.map((t) => (
                                <option key={t.tenantId} value={t.tenantId}>
                                    {t.name} ({t.tenantId})
                                </option>
                            ))}
                        </select>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!tenantSel || loadingCfg}
                        onClick={() => void loadSettings()}
                    >
                        <RefreshCw className={`size-4 mr-1 ${loadingCfg ? "animate-spin" : ""}`} />
                        Recarregar
                    </Button>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                        URL da consulta (<code className="text-[11px]">{"{CODCOLIGADA}"}</code>,{" "}
                        <code className="text-[11px]">{"{CHAPA}"}</code>)
                    </label>
                    <textarea
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                        value={form.consultaUrlTemplate}
                        onChange={(e) =>
                            setForm((f) => ({
                                ...f,
                                consultaUrlTemplate: e.target.value,
                            }))
                        }
                        placeholder={DEFAULT_URL_HINT}
                    />
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Usuário HTTP</label>
                        <Input
                            autoComplete="off"
                            value={form.httpUser}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    httpUser: e.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Senha HTTP {passwordConfigured ? "(opcional alterar)" : "(obrigatória primeira vez)"}
                        </label>
                        <Input
                            type="password"
                            autoComplete="new-password"
                            value={form.httpPassword}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    httpPassword: e.target.value,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            CODCOLIGADA fallback (sem <code>CdnEmpresa</code> no funcionário)
                        </label>
                        <Input
                            type="number"
                            min={1}
                            value={form.defaultCodColigada}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    defaultCodColigada: parseInt(e.target.value, 10) || 1,
                                }))
                            }
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Espera entre chamadas (ms)
                        </label>
                        <Input
                            type="number"
                            min={0}
                            max={60000}
                            value={form.delayMsBetweenRequests}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    delayMsBetweenRequests: parseInt(e.target.value, 10) || 0,
                                }))
                            }
                        />
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={() => void salvar()} disabled={saving || !tenantSel}>
                        {saving ? (
                            <>
                                <Loader2 className="size-4 mr-2 animate-spin" /> Salvando...
                            </>
                        ) : (
                            "Salvar configuração"
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void iniciarExecucao()}
                        disabled={starting || running || !tenantSel}
                    >
                        {starting ? <Loader2 className="size-4 mr-2 animate-spin" /> : <PlayCircle className="size-4 mr-2" />}
                        Sincronizar gestores agora
                    </Button>
                    <Button type="button" variant="destructive" onClick={() => void cancelarExecucao()} disabled={!running || cancelling}>
                        {cancelling ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Square className="size-4 mr-2" />}
                        Cancelar
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
                    <div className="flex items-center gap-2 text-slate-100">
                        <Terminal className="size-4" />
                        <div>
                            <div className="text-sm font-semibold">Saída (simula CLI)</div>
                            <div className="text-xs text-slate-400">
                                {runId ? (
                                    <>
                                        Run <span className="font-mono text-slate-200">{runId}</span>
                                        {" — "}
                                        {statusTxt}
                                        {runState?.progressTotal
                                            ? ` — ${runState.progressCurrent}/${runState.progressTotal}`
                                            : ""}
                                    </>
                                ) : (
                                    "Inicie uma execução ou selecione outro tenant."
                                )}
                                {runState?.errorMessage ? ` — ERRO: ${runState.errorMessage}` : ""}
                            </div>
                        </div>
                    </div>
                </div>
                <div
                    ref={terminalRef}
                    className="h-80 overflow-auto px-4 py-3 font-mono text-[12px] leading-5"
                >
                    {!runState?.logLines?.length && (
                        <div className="text-slate-500">Sem linhas ainda.</div>
                    )}
                    {(runState?.logLines ?? []).map((line, index) => (
                        <div key={`${index}-${line.slice(-40)}`} className={lineClass(line)}>
                            {line || "\u00A0"}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
