"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SolicitacaoVagaStatusBadgeEl } from "@/features/gestao/shared/solicitacaoVagaStatusUi";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHasPermission, useIsAdminOrOwner } from "@/hooks/useAuth";
const API = "/api/solicitacoes-vaga";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        let msg = "";
        try {
            const raw = await res.text();
            if (raw.startsWith("{") && raw.includes("message"))
                msg = JSON.parse(raw).message ?? raw;
            else msg = raw;
        } catch {
            msg = res.statusText;
        }
        throw new Error(typeof msg === "string" ? msg || res.statusText : res.statusText);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

interface SolicitacaoDetail {
    id: string;
    titulo: string;
    status: number | string;
    vagaId: string | null;
    solicitanteNome: string | null;
    centroCustoNome: string | null;
    observacaoAprovador: string | null;
    etapasFluxo?: { ordem: number; label: string; aprovadorNome: string | null; roleNome: string | null; status: number; dataUtc: string | null; observacao: string | null }[];
    rmCodStatus?: number | string | null;
    rmUltimaStatusDescricaoRm?: string | null;
    rmStatusSyncUltimaMensagem?: string | null;
    rmUltimaSincronizacaoUtc?: string | null;
    rmRequisicaoCodigo?: string | null;
}

interface IndicacaoRow {
    id: string;
    candidatoId: string;
    candidatoNome: string | null;
    observacao: string | null;
    indicadoPorUserId: string | null;
    createdAtUtc: string;
}

function normStatus(s: unknown): number {
    if (typeof s === "number" && Number.isFinite(s)) return s;
    const m: Record<string, number> = {
        PendenteTriagem: 11,
        EmTriagem: 12,
        DevolvidaTriagemGestor: 13,
        EmIntegracao: 7,
        EmProcessoSeletivo: 17,
        Suspensa: 18,
        EncerradaSemContratacao: 19,
        ContratacaoConcluida: 20,
    };
    if (typeof s === "string" && m[s] != null) return m[s]!;
    return Number(s);
}

export default function RhContratacaoDetailScreen() {
    const params = useParams();
    const router = useRouter();
    const rawId = (params?.id as string | undefined)?.trim();
    const canTriagem = useHasPermission("rh.contratacoes.triagem") || useIsAdminOrOwner();
    const canSelecao = useHasPermission("rh.contratacoes.selecao") || useIsAdminOrOwner();

    const [d, setD] = useState<SolicitacaoDetail | null>(null);
    const [ind, setInd] = useState<IndicacaoRow[]>([]);
    const [candidatoId, setCandidatoId] = useState("");
    const [busy, setBusy] = useState(false);

    const loadAll = useCallback(async () => {
        if (!rawId) return;
        const det = await fetchJson<SolicitacaoDetail>(`${API}/${encodeURIComponent(rawId)}`);
        setD(det);
        const lst = await fetchJson<IndicacaoRow[]>(`${API}/${encodeURIComponent(rawId)}/indicacoes`).catch(() => []);
        setInd(Array.isArray(lst) ? lst : []);
    }, [rawId]);

    useEffect(() => {
        if (!rawId) return;
        void loadAll().catch((e: unknown) => {
            toast.error(e instanceof Error ? e.message : "Não foi possível abrir");
            router.push("/rh/contratacoes/triagem");
        });
    }, [rawId, loadAll, router]);

    const postAct = async (path: string, body?: Record<string, unknown>) => {
        if (!rawId) return;
        setBusy(true);
        try {
            await fetchJson(`${API}/${encodeURIComponent(rawId)}${path}`, {
                method: "POST",
                body: body ? JSON.stringify(body) : undefined,
            });
            toast.success("Atualizado");
            await loadAll();
        } catch (e: unknown) {
            toast.error(e instanceof Error ? e.message : "Falha na ação");
        } finally {
            setBusy(false);
        }
    };

    if (!rawId) return null;
    if (!d) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;

    const ord = normStatus(d.status);

    const triagemIni = ord === 11 && canTriagem;
    const triagemDevolver = (ord === 11 || ord === 12) && canTriagem;
    const triagemEnc = ord === 12 && canTriagem;
    const triagemRepr = ord === 12 && canTriagem;

    const selIni = ord === 7 && canSelecao;
    const selSusp = ord === 17 && canSelecao;
    const selRet = ord === 18 && canSelecao;
    const selTerm = (ord === 17 || ord === 18) && canSelecao;

    return (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-8">
            <div className="flex flex-wrap items-center gap-3">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
                </Button>
            </div>
            <div>
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-semibold">{d.titulo}</h1>
                    <SolicitacaoVagaStatusBadgeEl raw={d.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                    Solicitante: {d.solicitanteNome ?? "—"} · CC: {d.centroCustoNome ?? "—"}
                </p>
            </div>

            <section className="rounded-lg border bg-card p-4 text-sm">
                <div className="font-medium text-foreground">Requisição / RM</div>
                <div className="mt-2 grid gap-1 text-muted-foreground">
                    <span>Código RM: {d.rmRequisicaoCodigo ?? "—"}</span>
                    <span>CODSTATUS: {d.rmCodStatus ?? "—"} · {d.rmUltimaStatusDescricaoRm ?? "—"}</span>
                    {(d.rmStatusSyncUltimaMensagem ?? "").length > 0 && <span className="text-destructive">Sync: {d.rmStatusSyncUltimaMensagem}</span>}
                </div>
                {d.vagaId ? (
                    <Link
                        href={`/matching?vagaId=${encodeURIComponent(d.vagaId)}`}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                        Compatíveis (matching) <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                ) : (
                    <p className="mt-4 text-xs text-muted-foreground">Matching disponível quando houver vínculo com <code>VagaId</code>.</p>
                )}
            </section>

            {triagemIni || triagemDevolver || triagemEnc || triagemRepr ? (
                <section className="rounded-lg border bg-card p-4">
                    <div className="mb-3 text-sm font-medium">Triagem (aumento de quadro)</div>
                    <div className="flex flex-wrap gap-2">
                        {triagemIni && (
                            <Button size="sm" disabled={busy} onClick={() => void postAct("/triagem/iniciar")}>Iniciar triagem</Button>
                        )}
                        {triagemEnc && (
                            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void postAct("/triagem/encaminhar")}>Encaminhar aprovações</Button>
                        )}
                        {triagemDevolver && (
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                                const o = window.prompt("Observação da devolução (obrigatório)");
                                if (o?.trim()) void postAct("/triagem/devolver", { observacao: o.trim() });
                            }}>Devolver gestor</Button>
                        )}
                        {triagemRepr && (
                            <Button size="sm" variant="destructive" disabled={busy} onClick={() => {
                                const m = window.prompt("Motivo reprovação triagem");
                                if (m?.trim()) void postAct("/triagem/reprovar", { motivo: m.trim() });
                            }}>Reprovar triagem</Button>
                        )}
                    </div>
                </section>
            ) : null}

            {selIni || selSusp || selRet || selTerm ? (
                <section className="rounded-lg border bg-card p-4">
                    <div className="mb-3 text-sm font-medium">Seleção pós‑RM</div>
                    <div className="flex flex-wrap gap-2">
                        {selIni && <Button size="sm" disabled={busy} onClick={() => void postAct("/selecao/iniciar")}>Iniciar processo seletivo</Button>}
                        {selSusp && <Button size="sm" variant="outline" disabled={busy} onClick={() => void postAct("/selecao/suspender", {})}>Suspender</Button>}
                        {selRet && <Button size="sm" variant="secondary" disabled={busy} onClick={() => void postAct("/selecao/retomar")}>Retomar</Button>}
                        {selTerm && (
                            <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => {
                                    const m = window.prompt("Motivo encerramento sem contratação");
                                    if (m?.trim()) void postAct("/selecao/encerrar-sem-contratacao", { observacao: m.trim() });
                                }}>Encerrar sem contratação</Button>
                                <Button size="sm" disabled={busy} onClick={() => void postAct("/selecao/contratacao-concluida", {})}>Contratação concluída</Button>
                            </>
                        )}
                    </div>
                </section>
            ) : null}

            <section className="rounded-lg border bg-card p-4">
                <div className="mb-2 text-sm font-medium">Histórico (fluxo interno)</div>
                <ul className="space-y-2 text-xs text-muted-foreground">
                    {(d.etapasFluxo ?? []).map((e) => (
                        <li key={`${e.ordem}-${e.label}`}>
                            <span className="font-medium text-foreground">{e.label}</span>
                            {" "}
                            — {e.roleNome ?? e.aprovadorNome ?? "—"}
                            {" "}
                            {e.dataUtc ? `(${new Date(e.dataUtc).toLocaleString("pt-BR")})` : ""}
                            {e.observacao ? ` · ${e.observacao}` : ""}
                        </li>
                    ))}
                    {(d.etapasFluxo ?? []).length === 0 && <li>Sem linha de fluxo registada nesta vista.</li>}
                </ul>
            </section>

            <section className="rounded-lg border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium">Indicações internas</div>
                    {canSelecao && (
                        <div className="flex gap-2">
                            <Input placeholder="UUID candidato" className="w-56 font-mono text-xs" value={candidatoId} onChange={(e) => setCandidatoId(e.target.value)} />
                            <Button size="sm" disabled={busy || !candidatoId.trim()} onClick={async () => {
                                try {
                                    setBusy(true);
                                    await fetchJson(`${API}/${encodeURIComponent(rawId)}/indicacoes`, {
                                        method: "POST",
                                        body: JSON.stringify({ candidatoId: candidatoId.trim() }),
                                    });
                                    setCandidatoId("");
                                    toast.success("Indicação adicionada");
                                    await loadAll();
                                } catch (e: unknown) {
                                    toast.error(e instanceof Error ? e.message : "Erro");
                                } finally {
                                    setBusy(false);
                                }
                            }}>Adicionar</Button>
                        </div>
                    )}
                </div>
                <ul className="space-y-2 text-sm">
                    {ind.map((i) => (
                        <li key={i.id} className="flex flex-wrap justify-between gap-2 border-b border-border/60 py-2 last:border-0">
                            <span>{i.candidatoNome ?? i.candidatoId}</span>
                            {canSelecao && (
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={busy} onClick={() => void (async () => {
                                    setBusy(true);
                                    try {
                                        await fetchJson<null>(`${API}/${encodeURIComponent(rawId)}/indicacoes/${encodeURIComponent(i.id)}`, { method: "DELETE" });
                                        toast.success("Removido");
                                        await loadAll();
                                    } catch (e: unknown) {
                                        toast.error(e instanceof Error ? e.message : "Erro");
                                    } finally {
                                        setBusy(false);
                                    }
                                })()}>Remover</Button>
                            )}
                        </li>
                    ))}
                    {ind.length === 0 && <li className="text-muted-foreground text-xs">Sem indicações.</li>}
                </ul>
            </section>

            {(d.observacaoAprovador ?? "").trim().length > 0 ? (
                <section className="rounded-lg border bg-muted/30 p-4 text-sm">
                    <div className="font-medium">Observação / motivo registado</div>
                    <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{d.observacaoAprovador}</p>
                </section>
            ) : null}
        </div>
    );
}
