"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    CheckCircle2, Clock, XCircle, FileText, User, Mail, Phone,
    ArrowLeft, Building2, Briefcase, CalendarDays, RefreshCw,
    Upload, Eye, Trash2, Copy, Link, Download,
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
    presignedUrl: string;
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
    centroCustoNome: string | null;
    areaNome?: string | null;
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
    documentosSolicitados: { tipoDocumento: number; label: string; obrigatorio: boolean }[];
    accessToken: string | null;
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
    2: "CNH",
    3: "Titulo de Eleitor",
    4: "Reservista",
    5: "Comprovante de Residencia",
    6: "Certidao Nasc./Casamento",
    7: "PIS/PASEP",
    8: "Outro",
    9: "Carteira de Trabalho (CTPS)",
    10: "Declaracao de Uniao Estavel",
    11: "RG dos Filhos",
    12: "Certidao de Nascimento dos Filhos",
    13: "Carteira de Vacinacao dos Filhos",
    14: "Comprovante Bancario",
    15: "Foto 3x4",
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

    /* document solicitation */
    const [selectedDocs, setSelectedDocs] = useState<Map<number, { checked: boolean; obrigatorio: boolean }>>(new Map());
    const [savingDocs, setSavingDocs] = useState(false);

    /* link generation */
    const [linkCpf, setLinkCpf] = useState("");
    const [enviarEmailLink, setEnviarEmailLink] = useState(true);
    const [enviarWhatsappLink, setEnviarWhatsappLink] = useState(false);
    const [generatingLink, setGeneratingLink] = useState(false);
    const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
    const [linkEmailEnviado, setLinkEmailEnviado] = useState(false);

    /* manual upload */
    const [uploadTipo, setUploadTipo] = useState(0);
    const [uploading, setUploading] = useState(false);
    const fileRef = React.useRef<HTMLInputElement>(null);

    /* document validation */
    const [rejectDocId, setRejectDocId] = useState<string | null>(null);
    const [rejectObs, setRejectObs] = useState("");
    const [validatingDocId, setValidatingDocId] = useState<string | null>(null);

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

    /* Initialize selectedDocs from server data */
    useEffect(() => {
        if (data?.documentosSolicitados) {
            const map = new Map<number, { checked: boolean; obrigatorio: boolean }>();
            data.documentosSolicitados.forEach(ds => map.set(ds.tipoDocumento, { checked: true, obrigatorio: ds.obrigatorio }));
            setSelectedDocs(map);
            setLinkCpf(data.cpf ?? "");
            if (data.accessToken) {
                setGeneratedUrl(`${window.location.origin}/DocumentoAdmissao?preAdmissaoId=${data.id}`);
            }
        }
    }, [data]);

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

    async function handleSaveDocsSolicitados() {
        setSavingDocs(true);
        try {
            const documentos: { tipoDocumento: number; obrigatorio: boolean }[] = [];
            selectedDocs.forEach((val, key) => {
                if (val.checked) documentos.push({ tipoDocumento: key, obrigatorio: val.obrigatorio });
            });
            await fetchJson(`/api/pre-admissao/${id}/documentos-solicitados`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentos }),
            });
            toast.success("Documentos solicitados salvos com sucesso!");
            await load();
        } catch (e) {
            toast.error(`Falha ao salvar documentos: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setSavingDocs(false);
        }
    }

    async function handleGerarLink() {
        setGeneratingLink(true);
        try {
            const res = await fetchJson<{ publicUrl?: string; url?: string; emailEnviado?: boolean; whatsappEnviado?: boolean }>(`/api/pre-admissao/${id}/gerar-link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    cpf: linkCpf.trim(),
                    enviarEmail: enviarEmailLink,
                    enviarWhatsapp: enviarWhatsappLink,
                }),
            });
            setGeneratedUrl(res.publicUrl ?? res.url ?? null);
            setLinkEmailEnviado(!!res.emailEnviado);
            toast.success(res.emailEnviado ? "Link gerado e e-mail enviado!" : "Link gerado com sucesso!");
            await load();
        } catch (e) {
            toast.error(`Falha ao gerar link: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setGeneratingLink(false);
        }
    }

    async function handleUpload() {
        const file = fileRef.current?.files?.[0];
        if (!file) { toast.error("Selecione um arquivo."); return; }
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("tipo", String(uploadTipo));
            const res = await apiFetch(`/api/pre-admissao/${id}/documentos`, {
                method: "POST",
                body: formData,
                cache: "no-store",
            });
            if (!res.ok) {
                const text = await res.text().catch(() => "");
                throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
            }
            toast.success("Documento enviado com sucesso!");
            if (fileRef.current) fileRef.current.value = "";
            await load();
        } catch (e) {
            toast.error(`Falha no upload: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setUploading(false);
        }
    }

    async function handleValidarDoc(docId: string, status: number, observacao?: string) {
        setValidatingDocId(docId);
        try {
            await fetchJson(`/api/pre-admissao/${id}/documentos/${docId}/validar`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, observacaoRh: observacao ?? null }),
            });
            toast.success(status === 1 ? "Documento aprovado!" : "Documento rejeitado.");
            setRejectDocId(null);
            setRejectObs("");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
        } finally {
            setValidatingDocId(null);
        }
    }

    async function handleDeleteDoc(docId: string) {
        if (!confirm("Tem certeza que deseja excluir este documento?")) return;
        try {
            await fetchJson(`/api/pre-admissao/${id}/documentos/${docId}`, { method: "DELETE" });
            toast.success("Documento excluído.");
            await load();
        } catch (e) {
            toast.error(`Falha: ${e instanceof Error ? e.message : "erro"}`);
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
    const canGerarLinkCandidato = data.status === 0 || data.status === 1 || data.status === 6 || data.status === 7;
    const canSolicitarDocumentos = data.status === 0 || data.status === 1;
    const docsValidados = data.documentos.filter(d => d.status === 1).length;
    const docsTotal = data.documentos.length;

    return (
        <section className="space-y-5">
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
                    <Button variant="outline" size="sm" onClick={async () => {
                        // Baixa o payload TOTVS exato (o mesmo que o sync-service consome).
                        // Atualiza em tempo real conforme o sync callback roda (matriculaRM, resultado).
                        try {
                            const res = await apiFetch(`/api/integracao-totvs/1/${data.id}`);
                            if (!res.ok) { toast.error("Não foi possível obter o payload TOTVS"); return; }
                            const payload = await res.json();
                            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `admissao-totvs-${data.nome.replace(/\s+/g, "_")}-${data.id}.json`;
                            a.click();
                            URL.revokeObjectURL(url);
                        } catch { toast.error("Erro de conexão ao exportar"); }
                    }}>
                        <Download className="size-4 mr-1" /> Exportar JSON
                    </Button>
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
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Candidato</h2>
                    <Button variant="outline" size="sm" onClick={() => {
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `admissao-${data.nome.replace(/\s+/g, "_")}-${data.id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}>
                        <Download className="size-4 mr-1" /> Baixar
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoRow icon={<User className="size-4" />} label="Nome" value={data.nome} />
                    <InfoRow icon={<Mail className="size-4" />} label="E-mail" value={data.email} />
                    <InfoRow icon={<Phone className="size-4" />} label="Celular" value={data.celular} />
                    <InfoRow icon={<FileText className="size-4" />} label="CPF" value={data.cpf} />
                    <InfoRow icon={<Building2 className="size-4" />} label="Centro de Custo" value={data.centroCustoNome ?? data.areaNome} />
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

            {/* CARD A: Solicitar Documentos */}
            {canSolicitarDocumentos && (
                <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Solicitar Documentos</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(TIPO_DOC_LABEL).map(([key, label]) => {
                            const tipo = Number(key);
                            const entry = selectedDocs.get(tipo);
                            const checked = entry?.checked ?? false;
                            const obrigatorio = entry?.obrigatorio ?? false;
                            return (
                                <div key={tipo} className="flex items-center gap-2 rounded-lg border border-border/40 px-3 py-2">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={(e) => {
                                            const next = new Map(selectedDocs);
                                            next.set(tipo, { checked: e.target.checked, obrigatorio });
                                            setSelectedDocs(next);
                                        }}
                                        className="size-4 rounded border-gray-300 accent-primary"
                                    />
                                    <span className="text-sm flex-1 min-w-0 truncate">{label}</span>
                                    {checked && (
                                        <label className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={obrigatorio}
                                                onChange={(e) => {
                                                    const next = new Map(selectedDocs);
                                                    next.set(tipo, { checked, obrigatorio: e.target.checked });
                                                    setSelectedDocs(next);
                                                }}
                                                className="size-3 rounded"
                                            />
                                            Obrig.
                                        </label>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button size="sm" onClick={() => void handleSaveDocsSolicitados()} disabled={savingDocs}>
                            {savingDocs ? "Salvando..." : "Salvar Solicitações"}
                        </Button>
                    </div>
                </div>
            )}

            {/* CARD B: Link de Acesso do Candidato */}
            {canGerarLinkCandidato && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20 p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                        <Link className="size-4 inline-block mr-1 -mt-0.5" />
                        Link de Acesso do Candidato
                    </h2>
                    <p className="text-xs text-muted-foreground mb-4">
                        Informe o CPF, gere o link e envie ao candidato para preenchimento no Portal de Admissão.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground">CPF do Candidato</label>
                            <Input
                                value={linkCpf}
                                onChange={(e) => setLinkCpf(e.target.value)}
                                placeholder="000.000.000-00"
                                className="mt-1"
                            />
                        </div>
                        <div className="flex items-end">
                            <Button size="sm" onClick={() => void handleGerarLink()} disabled={generatingLink || !linkCpf.trim()}>
                                <Link className="size-4 mr-1" />
                                {generatingLink ? "Gerando..." : "Gerar e enviar link"}
                            </Button>
                        </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={enviarEmailLink} onChange={(e) => setEnviarEmailLink(e.target.checked)} className="size-4 rounded accent-primary" />
                            Enviar por e-mail{data.email ? ` (${data.email})` : ""}
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={enviarWhatsappLink} onChange={(e) => setEnviarWhatsappLink(e.target.checked)} className="size-4 rounded accent-primary" />
                            Enviar por WhatsApp{data.celular ? ` (${data.celular})` : ""}
                        </label>
                    </div>
                    {linkEmailEnviado && (
                        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">E-mail de acesso enviado ao candidato.</p>
                    )}
                    {generatedUrl && (
                        <div className="mt-3 flex items-center gap-2 rounded-lg bg-muted/40 px-4 py-3">
                            <code className="text-xs flex-1 min-w-0 truncate select-all">{generatedUrl}</code>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    navigator.clipboard.writeText(generatedUrl);
                                    toast.success("Link copiado!");
                                }}
                            >
                                <Copy className="size-4 mr-1" /> Copiar
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* CARD C: Upload Manual (RH) */}
            {(data.status === 1 || data.status === 2) && (
                <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                        <Upload className="size-4 inline-block mr-1 -mt-0.5" />
                        Upload Manual (RH)
                    </h2>
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground">Tipo de Documento</label>
                            <select
                                value={uploadTipo}
                                onChange={(e) => setUploadTipo(Number(e.target.value))}
                                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                            >
                                {Object.entries(TIPO_DOC_LABEL).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-medium text-muted-foreground">Arquivo</label>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="mt-1 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                            />
                        </div>
                        <Button size="sm" onClick={() => void handleUpload()} disabled={uploading}>
                            <Upload className="size-4 mr-1" />
                            {uploading ? "Enviando..." : "Enviar"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Documentos Recebidos */}
            <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Documentos Recebidos
                        {docsTotal > 0 && (
                            <span className="ml-2 inline-flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                                {docsTotal}
                            </span>
                        )}
                    </h2>
                </div>

                {/* Progress bar */}
                {docsTotal > 0 && (
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>Validados</span>
                            <span>{docsValidados}/{docsTotal}</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full rounded-full bg-green-500 transition-all"
                                style={{ width: `${docsTotal > 0 ? (docsValidados / docsTotal) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {docsTotal === 0 ? (
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
                                    {doc.status === 2 && doc.observacaoRh && (
                                        <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                                            Motivo: {doc.observacaoRh}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_DOC_COLOR[doc.status] ?? "bg-muted text-muted-foreground"}`}>
                                        {STATUS_DOC_LABEL[doc.status] ?? doc.status}
                                    </span>
                                    {doc.presignedUrl && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                            onClick={() => window.open(doc.presignedUrl, "_blank")}
                                            title="Visualizar"
                                        >
                                            <Eye className="size-4" />
                                        </Button>
                                    )}
                                    {doc.status === 0 && data.status === 2 && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                onClick={() => void handleValidarDoc(doc.id, 1)}
                                                disabled={validatingDocId === doc.id}
                                                title="Validar"
                                            >
                                                <CheckCircle2 className="size-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => { setRejectDocId(doc.id); setRejectObs(""); }}
                                                disabled={validatingDocId === doc.id}
                                                title="Rejeitar"
                                            >
                                                <XCircle className="size-4" />
                                            </Button>
                                        </>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                                        onClick={() => void handleDeleteDoc(doc.id)}
                                        title="Excluir"
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
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

            {/* Rejeitar documento dialog */}
            <Dialog open={!!rejectDocId} onOpenChange={(open) => { if (!open) { setRejectDocId(null); setRejectObs(""); } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rejeitar Documento</DialogTitle>
                        <DialogDescription>
                            Informe o motivo da rejeição deste documento. O candidato poderá reenviar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Observação *</label>
                        <textarea
                            placeholder="Ex: Documento ilegível, dados divergentes..."
                            value={rejectObs}
                            onChange={(e) => setRejectObs(e.target.value)}
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[80px] resize-y"
                            maxLength={500}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setRejectDocId(null); setRejectObs(""); }} disabled={!!validatingDocId}>Cancelar</Button>
                        <Button
                            variant="destructive"
                            onClick={() => { if (rejectDocId) void handleValidarDoc(rejectDocId, 2, rejectObs.trim()); }}
                            disabled={!!validatingDocId || !rejectObs.trim()}
                        >
                            <XCircle className="size-4 mr-2" />
                            {validatingDocId ? "Rejeitando..." : "Confirmar Rejeição"}
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
