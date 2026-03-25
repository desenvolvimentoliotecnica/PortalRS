"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    CheckCircle2, Clock, XCircle, FileText, User, Mail, Phone,
    ArrowLeft, Building2, Briefcase, CalendarDays, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

/* ────── types ────── */

interface DocumentoResponse {
    id: string;
    tipo: number;
    nomeArquivo: string;
    contentType: string;
    tamanhoBytes: number;
    status: number;
    observacaoRh: string | null;
    createdAtUtc: string;
}

interface PreAdmissaoDetail {
    id: string;
    status: number;
    nome: string;
    cpf: string | null;
    email: string | null;
    celular: string | null;
    telefone: string | null;
    dataAdmissao: string | null;
    cargo: string | null;
    jobPositionNome: string | null;
    areaNome: string | null;
    unitNome: string | null;
    salario: number | null;
    observacaoRh: string | null;
    motivoRejeicao: string | null;
    revisadoPorNome: string | null;
    aprovadoPorNome: string | null;
    createdAtUtc: string;
    submittedAtUtc: string | null;
    approvedAtUtc: string | null;
    integracaoResultado: number | null;
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
    documentos: DocumentoResponse[];
}

/* ────── constants ────── */

const STATUS_STEPS = [
    { value: 1, label: "Preenchimento Pendente", desc: "Aguardando candidato preencher dados" },
    { value: 2, label: "Em Revisão", desc: "RH revisando os dados e documentos" },
    { value: 3, label: "Aprovada", desc: "Aguardando integração com TOTVS" },
    { value: 5, label: "Integrada", desc: "Dados enviados ao TOTVS com sucesso" },
];

const TIPO_DOC_LABEL: Record<number, string> = {
    0: "RG",
    1: "CPF",
    2: "Comprovante de Residência",
    3: "Foto",
    4: "Outros",
};

const STATUS_DOC_LABEL: Record<number, string> = {
    0: "Pendente",
    1: "Aprovado",
    2: "Rejeitado",
};

const STATUS_DOC_COLOR: Record<number, string> = {
    0: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    1: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    2: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const PRE_ADMISSAO_STATUS_LABEL: Record<number, string> = {
    0: "Rascunho",
    1: "Preenchimento Pendente",
    2: "Em Revisão",
    3: "Aprovada",
    4: "Rejeitada",
    5: "Integrada",
};

const PRE_ADMISSAO_STATUS_VARIANT: Record<number, "default" | "secondary" | "destructive" | "outline"> = {
    0: "outline",
    1: "secondary",
    2: "default",
    3: "secondary",
    4: "destructive",
    5: "secondary",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await apiFetch(url, {
        ...init,
        headers: { Accept: "application/json", ...(init?.headers || {}) },
        cache: "no-store",
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    if (res.status === 204) return null as T;
    return (await res.json()) as T;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string | null | undefined) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("pt-BR");
}

/* ────── Timeline ────── */

function Timeline({ status }: { status: number }) {
    const isRejeitada = status === 4;
    return (
        <div className="flex items-start gap-0">
            {isRejeitada ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                    <XCircle className="size-5 text-red-600" />
                    <span className="text-sm font-semibold text-red-700 dark:text-red-400">Rejeitada</span>
                </div>
            ) : (
                STATUS_STEPS.map((step, idx) => {
                    const done = status >= step.value && status !== 4;
                    const current = status === step.value;
                    return (
                        <React.Fragment key={step.value}>
                            <div className="flex flex-col items-center min-w-[100px]">
                                <div className={`size-8 rounded-full flex items-center justify-center border-2 transition-colors ${done
                                    ? "bg-green-500 border-green-500 text-white"
                                    : current
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "bg-muted border-border text-muted-foreground"
                                    }`}>
                                    {done ? <CheckCircle2 className="size-4" /> : <Clock className="size-3.5" />}
                                </div>
                                <div className="mt-1.5 text-center px-1">
                                    <div className={`text-xs font-semibold ${done || current ? "text-foreground" : "text-muted-foreground"}`}>
                                        {step.label}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground hidden sm:block">{step.desc}</div>
                                </div>
                            </div>
                            {idx < STATUS_STEPS.length - 1 && (
                                <div className={`flex-1 h-0.5 mt-4 mx-1 ${status > step.value && status !== 4 ? "bg-green-500" : "bg-border"}`} />
                            )}
                        </React.Fragment>
                    );
                })
            )}
        </div>
    );
}

/* ────── main component ────── */

export default function PreAdmissaoTrackingScreen({ id }: { id: string }) {
    const router = useRouter();
    const [data, setData] = useState<PreAdmissaoDetail | null>(null);
    const [loading, setLoading] = useState(true);

    /* approve dialog */
    const [aprovarOpen, setAprovarOpen] = useState(false);
    const [observacaoAprovar, setObservacaoAprovar] = useState("");
    const [aprovarLoading, setAprovarLoading] = useState(false);

    /* reject dialog */
    const [rejeitarOpen, setRejeitarOpen] = useState(false);
    const [motivoRejeicao, setMotivoRejeicao] = useState("");
    const [rejeitarLoading, setRejeitarLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const detail = await fetchJson<PreAdmissaoDetail>(`/api/pre-admissao/${id}`);
            setData(detail);
        } catch (e) {
            toast.error(`Erro ao carregar pré-admissão: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { void load(); }, [load]);

    async function handleAprovar() {
        setAprovarLoading(true);
        try {
            await fetchJson(`/api/pre-admissao/${id}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: observacaoAprovar.trim() || null }),
            });
            toast.success("Pré-admissão aprovada!");
            setAprovarOpen(false);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setAprovarLoading(false);
        }
    }

    async function handleRejeitar() {
        if (!motivoRejeicao.trim()) return;
        setRejeitarLoading(true);
        try {
            await fetchJson(`/api/pre-admissao/${id}/reject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: motivoRejeicao.trim() }),
            });
            toast.success("Pré-admissão rejeitada.");
            setRejeitarOpen(false);
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setRejeitarLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </div>
        );
    }

    if (!data) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground">Pré-admissão não encontrada.</p>
                <Button variant="outline" className="mt-4" onClick={() => router.back()}>Voltar</Button>
            </div>
        );
    }

    const canApprove = data.status === 2;
    const canReject = data.status === 1 || data.status === 2;

    return (
        <section className="space-y-5 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div>
                    <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.back()}>
                        <ArrowLeft className="size-4 mr-1" /> Voltar
                    </Button>
                    <h1 className="text-2xl font-semibold tracking-tight">{data.nome}</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant={PRE_ADMISSAO_STATUS_VARIANT[data.status]}>
                            {PRE_ADMISSAO_STATUS_LABEL[data.status] ?? data.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">Criada em {formatDate(data.createdAtUtc)}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void load()}>
                        <RefreshCw className="size-4 mr-1" /> Atualizar
                    </Button>
                    {canApprove && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setAprovarOpen(true)}>
                            <CheckCircle2 className="size-4 mr-1" /> Aprovar
                        </Button>
                    )}
                    {canReject && (
                        <Button variant="destructive" size="sm" onClick={() => setRejeitarOpen(true)}>
                            <XCircle className="size-4 mr-1" /> Rejeitar
                        </Button>
                    )}
                </div>
            </div>

            {/* Timeline */}
            <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm overflow-x-auto">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Progresso</h2>
                <Timeline status={data.status} />
                {data.motivoRejeicao && (
                    <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 dark:bg-red-900/20 dark:border-red-800">
                        <p className="text-sm font-medium text-red-700 dark:text-red-400">Motivo da rejeição:</p>
                        <p className="text-sm text-red-600 dark:text-red-300 mt-0.5">{data.motivoRejeicao}</p>
                    </div>
                )}
                {data.integracaoMensagem && (
                    <div className={`mt-4 rounded-lg px-4 py-3 border ${data.integracaoResultado === 0
                        ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                        : "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"}`}>
                        <p className={`text-sm font-medium ${data.integracaoResultado === 0 ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                            {data.integracaoResultado === 0 ? "Integração TOTVS: Sucesso" : "Integração TOTVS: Falha"}
                        </p>
                        <p className={`text-sm mt-0.5 ${data.integracaoResultado === 0 ? "text-green-600 dark:text-green-300" : "text-amber-600 dark:text-amber-300"}`}>
                            {data.integracaoMensagem}
                        </p>
                        {data.integradaEmUtc && (
                            <p className="text-xs text-muted-foreground mt-1">Integrada em: {formatDate(data.integradaEmUtc)}</p>
                        )}
                    </div>
                )}
            </div>

            {/* Dados pessoais */}
            <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Dados do Candidato</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<User className="size-4" />} label="Nome" value={data.nome} />
                    <InfoRow icon={<Mail className="size-4" />} label="E-mail" value={data.email} />
                    <InfoRow icon={<Phone className="size-4" />} label="Celular" value={data.celular} />
                    <InfoRow icon={<FileText className="size-4" />} label="CPF" value={data.cpf} />
                    <InfoRow icon={<Building2 className="size-4" />} label="Área" value={data.areaNome} />
                    <InfoRow icon={<Briefcase className="size-4" />} label="Cargo" value={data.jobPositionNome} />
                    <InfoRow icon={<Building2 className="size-4" />} label="Unidade" value={data.unitNome} />
                    <InfoRow icon={<CalendarDays className="size-4" />} label="Data de Admissão" value={data.dataAdmissao ? formatDate(data.dataAdmissao) : null} />
                </div>
                {data.observacaoRh && (
                    <div className="mt-4 rounded-lg bg-muted/40 px-4 py-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Observação do RH</p>
                        <p className="text-sm">{data.observacaoRh}</p>
                    </div>
                )}
            </div>

            {/* Documentos */}
            <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Documentos Recebidos
                    {data.documentos.length > 0 && (
                        <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                            {data.documentos.length}
                        </span>
                    )}
                </h2>
                {data.documentos.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum documento recebido ainda.</p>
                ) : (
                    <div className="space-y-2">
                        {data.documentos.map((doc) => (
                            <div key={doc.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-4 py-3">
                                <FileText className="size-4 text-muted-foreground shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{doc.nomeArquivo}</div>
                                    <div className="text-xs text-muted-foreground">
                                        {TIPO_DOC_LABEL[doc.tipo] ?? `Tipo ${doc.tipo}`} · {formatBytes(doc.tamanhoBytes)} · {formatDate(doc.createdAtUtc)}
                                    </div>
                                </div>
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_DOC_COLOR[doc.status] ?? "bg-muted text-muted-foreground"}`}>
                                    {STATUS_DOC_LABEL[doc.status] ?? doc.status}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Aprovação dialog */}
            <Dialog open={aprovarOpen} onOpenChange={setAprovarOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Aprovar Pré-admissão</DialogTitle>
                        <DialogDescription>
                            Confirme a aprovação dos dados de <strong>{data.nome}</strong>. Após aprovação, os dados seguirão para integração com o TOTVS.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observação (opcional)</label>
                        <Input
                            placeholder="Observação para o registro..."
                            value={observacaoAprovar}
                            onChange={(e) => setObservacaoAprovar(e.target.value)}
                            className="mt-1"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAprovarOpen(false)} disabled={aprovarLoading}>Cancelar</Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => void handleAprovar()} disabled={aprovarLoading}>
                            <CheckCircle2 className="size-4 mr-2" />
                            {aprovarLoading ? "Aprovando..." : "Confirmar Aprovação"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rejeição dialog */}
            <Dialog open={rejeitarOpen} onOpenChange={setRejeitarOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rejeitar Pré-admissão</DialogTitle>
                        <DialogDescription>
                            Informe o motivo da rejeição. O candidato será notificado.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Motivo *</label>
                        <Input
                            placeholder="Ex: Documentação incompleta, dados inconsistentes..."
                            value={motivoRejeicao}
                            onChange={(e) => setMotivoRejeicao(e.target.value)}
                            className="mt-1"
                            maxLength={500}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejeitarOpen(false)} disabled={rejeitarLoading}>Cancelar</Button>
                        <Button variant="destructive" onClick={() => void handleRejeitar()} disabled={rejeitarLoading || !motivoRejeicao.trim()}>
                            <XCircle className="size-4 mr-2" />
                            {rejeitarLoading ? "Rejeitando..." : "Confirmar Rejeição"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null | undefined }) {
    return (
        <div className="flex items-start gap-2">
            <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
            <div>
                <div className="text-xs text-muted-foreground">{label}</div>
                <div className="text-sm font-medium">{value || "—"}</div>
            </div>
        </div>
    );
}
