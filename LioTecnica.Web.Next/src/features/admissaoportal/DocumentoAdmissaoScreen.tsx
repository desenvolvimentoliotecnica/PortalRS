"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import {
    admissaoPortalFetch,
    saveAdmissaoPortalSession,
    getAdmissaoPortalSession,
    clearAdmissaoPortalSession,
    type AdmissaoPortalSession,
} from "./publicApi";
import { TIPO_DOC_LABELS } from "./constants";
import DadosPessoaisForm from "./DadosPessoaisForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    FileText, Upload, CheckCircle2, Clock, XCircle, Loader2,
    AlertCircle, LogOut, Send,
} from "lucide-react";

/* types */
interface DocSolicitado { tipo: number; label: string; obrigatorio: boolean; jaEnviado: boolean; }
interface DocEnviado { id: string; tipo: number; nomeArquivo: string; tamanhoBytes: number; status: number; observacaoRh: string | null; presignedUrl: string; }
interface DadosPessoais { [key: string]: unknown; }
interface PortalData {
    preAdmissaoId: string; nome: string; status: number;
    documentosSolicitados: DocSolicitado[];
    documentosEnviados: DocEnviado[];
    dadosPessoais: DadosPessoais;
}

const STATUS_DOC_LABEL: Record<number, string> = { 0: "Pendente", 1: "Validado", 2: "Rejeitado" };
const STATUS_DOC_COLOR: Record<number, string> = {
    0: "bg-amber-100 text-amber-800",
    1: "bg-green-100 text-green-800",
    2: "bg-red-100 text-red-800",
};

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentoAdmissaoScreen() {
    const params = useSearchParams();
    const tenantId = params.get("tenantId") ?? "";
    const preAdmissaoId = params.get("preAdmissaoId") ?? "";

    const [phase, setPhase] = useState<"login" | "main" | "submitted">("login");
    const [session, setSession] = useState<AdmissaoPortalSession | null>(null);
    const [cpfInput, setCpfInput] = useState("");
    const [logging, setLogging] = useState(false);
    const [data, setData] = useState<PortalData | null>(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

    // Check existing session
    useEffect(() => {
        if (!tenantId) return;
        const existing = getAdmissaoPortalSession(tenantId);
        if (existing && existing.preAdmissaoId === preAdmissaoId) {
            setSession(existing);
            setPhase("main");
        }
    }, [tenantId, preAdmissaoId]);

    // Load data when in main phase
    const loadData = useCallback(async () => {
        if (!session) return;
        setLoading(true);
        try {
            const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}`, session.cpf);
            if (!res.ok) { toast.error("Erro ao carregar dados."); return; }
            setData(await res.json());
        } catch { toast.error("Erro de conexao."); }
        finally { setLoading(false); }
    }, [session]);

    useEffect(() => {
        if (phase === "main" && session) void loadData();
    }, [phase, session, loadData]);

    async function handleLogin() {
        if (!cpfInput.trim() || !tenantId || !preAdmissaoId) return;
        setLogging(true);
        try {
            const headers = new Headers();
            headers.set("X-Tenant-Id", tenantId);
            headers.set("Content-Type", "application/json");
            const res = await apiFetch("/api/public/admissao-portal/login", {
                method: "POST",
                headers,
                body: JSON.stringify({ preAdmissaoId, cpf: cpfInput.trim() }),
            });
            if (!res.ok) { toast.error("CPF nao reconhecido ou acesso nao liberado."); return; }
            const body = await res.json();
            const sess: AdmissaoPortalSession = { tenantId, preAdmissaoId: body.preAdmissaoId, cpf: cpfInput.replace(/\D/g, ""), nome: body.nome };
            saveAdmissaoPortalSession(sess);
            setSession(sess);
            setPhase("main");
        } catch { toast.error("Erro ao conectar."); }
        finally { setLogging(false); }
    }

    async function handleUpload(tipo: number, file: File) {
        if (!session) return;
        setUploading(tipo);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("tipo", String(tipo));
            const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/documentos`, session.cpf, { method: "POST", body: fd });
            if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.message || "Erro no upload."); return; }
            toast.success("Documento enviado!");
            await loadData();
        } catch { toast.error("Falha no upload."); }
        finally { setUploading(null); }
    }

    async function handleSaveDados(dados: DadosPessoais) {
        if (!session) return;
        const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/dados`, session.cpf, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados),
        });
        if (!res.ok) { toast.error("Erro ao salvar dados."); return; }
        toast.success("Dados salvos!");
        await loadData();
    }

    async function handleSubmit() {
        if (!session) return;
        setSubmitting(true);
        try {
            const res = await admissaoPortalFetch(session.tenantId, `/api/public/admissao-portal/${session.preAdmissaoId}/submit`, session.cpf, { method: "POST" });
            if (!res.ok) { const b = await res.json().catch(() => ({})); toast.error(b.message || "Erro ao enviar."); return; }
            setPhase("submitted");
        } catch { toast.error("Erro ao submeter."); }
        finally { setSubmitting(false); }
    }

    function handleLogout() {
        if (tenantId) clearAdmissaoPortalSession(tenantId);
        setSession(null);
        setPhase("login");
        setCpfInput("");
    }

    if (!tenantId || !preAdmissaoId) {
        return (
            <div className="text-center py-20">
                <AlertCircle className="size-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Link invalido</p>
                <p className="text-sm text-muted-foreground mt-1">Verifique o link recebido do RH.</p>
            </div>
        );
    }

    /* LOGIN */
    if (phase === "login") {
        return (
            <div className="max-w-sm mx-auto py-20 space-y-6">
                <div className="text-center">
                    <FileText className="size-12 text-primary mx-auto mb-3" />
                    <h1 className="text-2xl font-bold">Portal de Admissao</h1>
                    <p className="text-muted-foreground text-sm mt-1">Preencha seus dados e documentos para admissao</p>
                </div>
                <div className="space-y-3">
                    <label className="text-sm font-medium">Informe seu CPF para acessar</label>
                    <Input
                        placeholder="000.000.000-00"
                        value={cpfInput}
                        onChange={e => setCpfInput(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLogin()}
                        maxLength={14}
                    />
                    <Button className="w-full" onClick={handleLogin} disabled={logging || !cpfInput.trim()}>
                        {logging ? <Loader2 className="size-4 animate-spin mr-2" /> : null}
                        Acessar
                    </Button>
                </div>
            </div>
        );
    }

    /* SUBMITTED */
    if (phase === "submitted") {
        return (
            <div className="max-w-md mx-auto py-20 text-center space-y-4">
                <CheckCircle2 className="size-16 text-green-500 mx-auto" />
                <h1 className="text-2xl font-bold">Dados Enviados!</h1>
                <p className="text-muted-foreground">Seus documentos e dados foram enviados para revisao do RH. Voce sera contatado em breve.</p>
                <Button variant="outline" onClick={handleLogout}>Voltar ao inicio</Button>
            </div>
        );
    }

    /* MAIN */
    const isSubmitted = data?.status === 2;

    return (
        <section className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Ola, {session?.nome || "Candidato"}</h1>
                    <p className="text-sm text-muted-foreground">Preencha seus dados e envie os documentos solicitados</p>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                    <LogOut className="size-4 mr-1" /> Sair
                </Button>
            </div>

            {isSubmitted && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 dark:bg-blue-900/20 dark:border-blue-800">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">Seus dados ja foram enviados e estao em revisao pelo RH.</p>
                </div>
            )}

            {loading && !data ? (
                <div className="flex justify-center py-12"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
            ) : data ? (
                <>
                    {/* Documentos Solicitados */}
                    <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Documentos Solicitados
                        </h2>
                        {data.documentosSolicitados.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Nenhum documento solicitado pelo RH ainda.</p>
                        ) : (
                            <div className="space-y-3">
                                {data.documentosSolicitados.map(ds => {
                                    const enviado = data.documentosEnviados.find(d => d.tipo === ds.tipo);
                                    const rejeitado = enviado && enviado.status === 2;
                                    return (
                                        <div key={ds.tipo} className="flex items-start gap-3 rounded-lg border border-border/40 px-4 py-3">
                                            <div className="mt-0.5">
                                                {enviado && enviado.status === 1 ? <CheckCircle2 className="size-5 text-green-500" /> :
                                                 enviado && enviado.status === 2 ? <XCircle className="size-5 text-red-500" /> :
                                                 enviado ? <Clock className="size-5 text-amber-500" /> :
                                                 <Upload className="size-5 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium">{ds.label}</span>
                                                    {ds.obrigatorio && <Badge variant="secondary" className="text-[10px]">Obrigatorio</Badge>}
                                                </div>
                                                {enviado && (
                                                    <div className="text-xs text-muted-foreground mt-0.5">
                                                        {enviado.nomeArquivo} - {formatBytes(enviado.tamanhoBytes)}
                                                        <span className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_DOC_COLOR[enviado.status] ?? ""}`}>
                                                            {STATUS_DOC_LABEL[enviado.status] ?? ""}
                                                        </span>
                                                        {enviado.presignedUrl && (
                                                            <a href={enviado.presignedUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline">Ver</a>
                                                        )}
                                                    </div>
                                                )}
                                                {rejeitado && enviado.observacaoRh && (
                                                    <div className="mt-1 text-xs text-red-600 bg-red-50 rounded px-2 py-1 dark:bg-red-900/20 dark:text-red-400">
                                                        RH: {enviado.observacaoRh}
                                                    </div>
                                                )}
                                            </div>
                                            {(!enviado || rejeitado) && !isSubmitted && (
                                                <div>
                                                    <input
                                                        ref={el => { fileRefs.current[ds.tipo] = el; }}
                                                        type="file"
                                                        accept=".pdf,.jpg,.jpeg,.png"
                                                        className="hidden"
                                                        onChange={e => {
                                                            const f = e.target.files?.[0];
                                                            if (f) handleUpload(ds.tipo, f);
                                                            e.target.value = "";
                                                        }}
                                                    />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={uploading === ds.tipo}
                                                        onClick={() => fileRefs.current[ds.tipo]?.click()}
                                                    >
                                                        {uploading === ds.tipo ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />}
                                                        <span className="ml-1">{rejeitado ? "Reenviar" : "Enviar"}</span>
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Dados Pessoais */}
                    <div className="rounded-xl border border-border/40 bg-card p-5 shadow-sm">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                            Dados Pessoais
                        </h2>
                        <DadosPessoaisForm
                            dados={data.dadosPessoais as any}
                            onSave={handleSaveDados as any}
                            disabled={isSubmitted}
                        />
                    </div>

                    {/* Submit */}
                    {!isSubmitted && (
                        <div className="flex justify-end">
                            <Button size="lg" onClick={handleSubmit} disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
                                {submitting ? <Loader2 className="size-4 animate-spin mr-2" /> : <Send className="size-4 mr-2" />}
                                Enviar para Revisao do RH
                            </Button>
                        </div>
                    )}
                </>
            ) : null}
        </section>
    );
}
