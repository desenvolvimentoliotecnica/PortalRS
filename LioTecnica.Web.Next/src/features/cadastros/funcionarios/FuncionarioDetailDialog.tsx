"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

interface FuncDetail {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    status: string;
    headcount: number;
    jobPositionName?: string;
    jobPositionCode?: string;
    notes?: string;
    createdAtUtc: string;
    updatedAtUtc: string;
    gestorDiretoNome?: string;
    nivelHierarquicoNome?: string;
    unidadeLotacaoDescricao?: string;
    unidadeLotacaoCode?: string;
    centroCustoDescricao?: string;
    centroCustoCode?: string;
    cdnFuncionario?: string;
    cdnEmpresa?: string;
    cdnEstab?: string;
    matriculaRm?: string;
    hierarquiaDescricao?: string;
    dataAdmissao?: string;
}

interface EntityChangeListItem {
    id: string;
    occurredAt: string;
    state: string;
    entityName: string;
    userName: string | null;
    changedColumns: string | null;
}

interface MovimentacaoItem {
    id: string;
    funcionarioId: string | null;
    chapaRm: string;
    idReqRm: string;
    tipoMovimentacao: number;
    tipoDescricao: string | null;
    dataAbertura: string;
    dataConclusao: string | null;
    codStatus: number;
    statusDescricao: string | null;
    codFuncaoOrigem: string | null;
    codFuncaoDestino: string | null;
    codSecaoOrigem: string | null;
    codSecaoDestino: string | null;
    salarioOrigem: number | null;
    salarioDestino: number | null;
    gerouSubstituicao: boolean | null;
}

interface Props {
    funcionarioId: string | null;
    onClose: () => void;
}

async function fetchJson<T>(url: string): Promise<T> {
    const res = await apiFetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
}

function statusBadge(s: string | null | undefined) {
    const st = (s ?? "").toLowerCase();
    if (st === "ativo" || st === "active")
        return <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Ativo</span>;
    return <span className="inline-flex items-center rounded-full bg-zinc-400/15 px-2.5 py-0.5 text-xs font-semibold text-zinc-600">Inativo</span>;
}

function stateLabel(state: string | null | undefined) {
    const s = (state ?? "").toLowerCase();
    if (s === "added") return "Criado";
    if (s === "modified") return "Alterado";
    if (s === "deleted") return "Removido";
    return state || "—";
}

function fmt(iso: string | undefined) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); }
    catch { return iso; }
}

export default function FuncionarioDetailDialog({ funcionarioId, onClose }: Props) {
    const [data, setData] = useState<FuncDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState<"dados" | "historico">("dados");
    const [history, setHistory] = useState<EntityChangeListItem[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<MovimentacaoItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => {
        if (!funcionarioId) {
            setData(null);
            setHistory([]);
            setMovimentacoes([]);
            setTab("dados");
            return;
        }

        setLoading(true);
        setData(null);
        setTab("dados");

        fetchJson<Record<string, unknown>>(`/api/funcionarios/${funcionarioId}`)
            .then((d) => {
                setData({
                    id: String(d.id ?? funcionarioId),
                    name: String(d.name ?? ""),
                    email: d.email ? String(d.email) : undefined,
                    phone: d.phone ? String(d.phone) : undefined,
                    status: String(d.status ?? ""),
                    headcount: typeof d.headcount === "number" ? d.headcount : 0,
                    jobPositionName: d.jobPositionName ? String(d.jobPositionName) : undefined,
                    jobPositionCode: d.jobPositionCode ? String(d.jobPositionCode) : undefined,
                    notes: d.notes ? String(d.notes) : undefined,
                    createdAtUtc: String(d.createdAtUtc ?? ""),
                    updatedAtUtc: String(d.updatedAtUtc ?? ""),
                    gestorDiretoNome: d.gestorDiretoNome ? String(d.gestorDiretoNome) : undefined,
                    nivelHierarquicoNome: d.nivelHierarquicoNome ? String(d.nivelHierarquicoNome) : undefined,
                    unidadeLotacaoDescricao: d.unidadeLotacaoDescricao ? String(d.unidadeLotacaoDescricao) : undefined,
                    unidadeLotacaoCode: d.unidadeLotacaoCode ? String(d.unidadeLotacaoCode) : undefined,
                    centroCustoDescricao: d.centroCustoDescricao ? String(d.centroCustoDescricao) : undefined,
                    centroCustoCode: d.centroCustoCode ? String(d.centroCustoCode) : undefined,
                    cdnFuncionario: d.cdnFuncionario ? String(d.cdnFuncionario) : undefined,
                    cdnEmpresa: d.cdnEmpresa ? String(d.cdnEmpresa) : undefined,
                    cdnEstab: d.cdnEstab ? String(d.cdnEstab) : undefined,
                    matriculaRm: d.matriculaRm ? String(d.matriculaRm) : undefined,
                    hierarquiaDescricao: d.hierarquiaDescricao ? String(d.hierarquiaDescricao) : undefined,
                    dataAdmissao: d.dataAdmissao ? String(d.dataAdmissao) : undefined,
                });
            })
            .catch(() => { toast.error("Falha ao carregar dados do funcionário."); onClose(); })
            .finally(() => setLoading(false));

        setHistoryLoading(true);
        const qs = new URLSearchParams({ entityName: "Funcionario", entityId: funcionarioId, page: "1", pageSize: "50" });
        Promise.allSettled([
            fetchJson<Record<string, unknown>>(`/api/audit/entity-changes?${qs.toString()}`),
            fetchJson<MovimentacaoItem[]>(`/api/funcionarios/${funcionarioId}/movimentacoes`),
        ]).then(([auditRes, movRes]) => {
            if (auditRes.status === "fulfilled") {
                const p = auditRes.value;
                setHistory(Array.isArray(p?.items) ? (p.items as EntityChangeListItem[]) : []);
            } else {
                setHistory([]);
            }
            if (movRes.status === "fulfilled" && Array.isArray(movRes.value)) {
                setMovimentacoes(movRes.value);
            } else {
                setMovimentacoes([]);
            }
        }).finally(() => setHistoryLoading(false));
    }, [funcionarioId, onClose]);

    return (
        <Dialog open={!!funcionarioId} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{data?.name ?? "Funcionário"}</DialogTitle>
                    <DialogDescription>Dados do colaborador. Somente leitura.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                    {(["dados", "historico"] as const).map((t) => (
                        <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={tab === t ? "default" : "outline"}
                            onClick={() => setTab(t)}
                        >
                            {t === "dados" ? "Dados" : "Histórico"}
                        </Button>
                    ))}
                </div>

                {loading ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">Carregando…</div>
                ) : tab === "dados" && data ? (
                    <div className="space-y-5">
                        {/* Banner — Dados incompletos (não aplica a RM, que é gerido externamente) */}
                        {(() => {
                            const isRm = !!data.matriculaRm;
                            if (isRm) return null;
                            const missing: string[] = [];
                            if (!data.name?.trim()) missing.push("Nome");
                            if (!data.jobPositionName) missing.push("Cargo");
                            if (!data.unidadeLotacaoDescricao) missing.push("Unidade de Lotação");
                            if (!data.nivelHierarquicoNome) missing.push("Nível do Cargo");
                            if (!data.centroCustoDescricao) missing.push("Centro de Custo");
                            return missing.length > 0 ? (
                                <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                    <div>
                                        <span className="font-semibold">Dados incompletos: </span>
                                        {missing.join(", ")}
                                    </div>
                                </div>
                            ) : null;
                        })()}

                        {/* Identificação */}
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identificação</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                <div className="col-span-2 sm:col-span-3">
                                    <dt className="text-xs font-medium text-muted-foreground">Nome</dt>
                                    <dd className="mt-0.5 text-sm font-semibold">{data.name}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">E-mail</dt>
                                    <dd className="mt-0.5 text-sm">{data.email || "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Telefone</dt>
                                    <dd className="mt-0.5 text-sm">{data.phone || "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Status</dt>
                                    <dd className="mt-0.5">{statusBadge(data.status)}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Headcount</dt>
                                    <dd className="mt-0.5 text-sm">{data.headcount}</dd>
                                </div>
                            </dl>
                        </div>

                        <hr className="border-border/40" />

                        {/* Organização Interna */}
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organização Interna</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Cargo</dt>
                                    <dd className="mt-0.5 text-sm">{data.jobPositionName ? (data.jobPositionCode ? `${data.jobPositionCode} - ${data.jobPositionName}` : data.jobPositionName) : "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Gestor Direto</dt>
                                    <dd className="mt-0.5 text-sm">{data.gestorDiretoNome || "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Nível do Cargo</dt>
                                    <dd className="mt-0.5 text-sm">{data.nivelHierarquicoNome || "—"}</dd>
                                </div>
                            </dl>
                        </div>

                        <hr className="border-border/40" />

                        {/* Integração TOTVS */}
                        <div>
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Integração TOTVS Datasul</p>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                <div className="col-span-2 sm:col-span-3">
                                    <dt className="text-xs font-medium text-muted-foreground">Unidade de Lotação</dt>
                                    <dd className="mt-0.5 text-sm">{data.unidadeLotacaoDescricao ? (data.unidadeLotacaoCode ? `${data.unidadeLotacaoCode} - ${data.unidadeLotacaoDescricao}` : data.unidadeLotacaoDescricao) : "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Matrícula</dt>
                                    <dd className="mt-0.5 font-mono text-sm">{data.cdnFuncionario || "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Empresa</dt>
                                    <dd className="mt-0.5 font-mono text-sm">{data.cdnEmpresa || "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Estabelecimento</dt>
                                    <dd className="mt-0.5 font-mono text-sm">{data.cdnEstab || "—"}</dd>
                                </div>
                                <div>
                                    <dt className="text-xs font-medium text-muted-foreground">Centro de Custo</dt>
                                    <dd className="mt-0.5 text-sm">{data.centroCustoDescricao ? (data.centroCustoCode ? `${data.centroCustoCode} - ${data.centroCustoDescricao}` : data.centroCustoDescricao) : "—"}</dd>
                                </div>
                            </dl>
                        </div>

                        {(data.notes || data.createdAtUtc) && (
                            <>
                                <hr className="border-border/40" />
                                <div>
                                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Observações e Auditoria</p>
                                    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                                        {data.notes && (
                                            <div className="col-span-2 sm:col-span-3">
                                                <dt className="text-xs font-medium text-muted-foreground">Observações</dt>
                                                <dd className="mt-0.5 text-sm whitespace-pre-line">{data.notes}</dd>
                                            </div>
                                        )}
                                        <div>
                                            <dt className="text-xs font-medium text-muted-foreground">Criado em</dt>
                                            <dd className="mt-0.5 text-sm">{fmt(data.createdAtUtc)}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs font-medium text-muted-foreground">Atualizado em</dt>
                                            <dd className="mt-0.5 text-sm">{fmt(data.updatedAtUtc)}</dd>
                                        </div>
                                    </dl>
                                </div>
                            </>
                        )}
                    </div>
                ) : null}

                {tab === "historico" ? (
                    <div className="mt-2">
                        {historyLoading ? (
                            <div className="py-6 text-center text-sm text-muted-foreground">Carregando histórico…</div>
                        ) : (() => {
                            const events = [
                                ...history.map((h) => ({ kind: "audit" as const, key: `audit-${h.id}`, occurredAt: h.occurredAt, audit: h })),
                                ...movimentacoes.map((m) => ({ kind: "mov" as const, key: `mov-${m.id}`, occurredAt: m.dataAbertura, mov: m })),
                                ...(data?.dataAdmissao ? [{ kind: "admissao" as const, key: "admissao", occurredAt: data.dataAdmissao, dataAdmissao: data.dataAdmissao }] : []),
                            ].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));

                            if (events.length === 0) {
                                return <div className="py-6 text-center text-sm text-muted-foreground">Nenhum registro encontrado.</div>;
                            }

                            return (
                                <div className="space-y-2">
                                    {events.map((e) => e.kind === "audit" ? (
                                        <div key={e.key} className="rounded-xl border border-border/40 bg-card/50 p-3 text-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="font-medium">
                                                    {fmt(e.audit.occurredAt)} — {stateLabel(e.audit.state)}
                                                    {e.audit.changedColumns ? <span className="text-muted-foreground"> ({e.audit.changedColumns})</span> : null}
                                                </div>
                                                <div className="text-xs text-muted-foreground">{e.audit.userName ? `por ${e.audit.userName}` : ""}</div>
                                            </div>
                                        </div>
                                    ) : e.kind === "admissao" ? (
                                        <div key={e.key} className="rounded-xl border border-emerald-300/50 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-sm">
                                            <div className="font-medium text-emerald-700 dark:text-emerald-300">
                                                {new Date(e.dataAdmissao + "T00:00:00").toLocaleDateString("pt-BR")} — Admissão
                                            </div>
                                        </div>
                                    ) : (
                                        <div key={e.key} className="rounded-xl border border-violet-300/50 bg-violet-50/40 dark:bg-violet-950/20 p-3 text-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="font-medium text-violet-700 dark:text-violet-300">
                                                    {fmt(e.mov.dataAbertura)} — {e.mov.tipoDescricao ?? `Movimentação ${e.mov.tipoMovimentacao}`}
                                                    {e.mov.statusDescricao ? <span className="text-muted-foreground"> · {e.mov.statusDescricao}</span> : null}
                                                </div>
                                                <div className="text-xs text-muted-foreground font-mono">#{e.mov.idReqRm}</div>
                                            </div>
                                            {(e.mov.codFuncaoOrigem || e.mov.codFuncaoDestino) && (
                                                <div className="text-xs text-muted-foreground mt-1">
                                                    Função: {e.mov.codFuncaoOrigem ?? "—"} → {e.mov.codFuncaoDestino ?? "—"}
                                                </div>
                                            )}
                                            {(e.mov.codSecaoOrigem || e.mov.codSecaoDestino) && (
                                                <div className="text-xs text-muted-foreground">
                                                    Seção: {e.mov.codSecaoOrigem ?? "—"} → {e.mov.codSecaoDestino ?? "—"}
                                                </div>
                                            )}
                                            {(e.mov.salarioOrigem != null || e.mov.salarioDestino != null) && (
                                                <div className="text-xs text-muted-foreground">
                                                    Salário: {e.mov.salarioOrigem != null ? `R$ ${e.mov.salarioOrigem.toFixed(2)}` : "—"} → {e.mov.salarioDestino != null ? `R$ ${e.mov.salarioDestino.toFixed(2)}` : "—"}
                                                </div>
                                            )}
                                            {e.mov.dataConclusao && (
                                                <div className="text-xs text-muted-foreground">Concluída em: {fmt(e.mov.dataConclusao)}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                ) : null}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Fechar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
