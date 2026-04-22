"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ChevronLeft, CheckCircle2, XCircle, AlertTriangle, FileText, User, MapPin,
    CreditCard, Briefcase, Phone, ShieldCheck, Loader2, Pencil, Download, Eye,
    Zap, Clock, WrenchIcon, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";

/* ── types ── */

interface TotvsError {
    campo: string;
    label: string;
    secao: string;
    tipoRegra: string;
    mensagem: string;
}

interface TotvsFieldsPatch {
    codCargoTotvs?: number | null;
    codVinculoEmpregaticio?: number | null;
    tipoFuncionario?: number | null;
    categoriaSalarial?: number | null;
    grauInstrucao?: number | null;
    codTurno?: number | null;
    tipoEstatistica?: number | null;
    centroCusto?: string | null;
    unidadeLotacao?: string | null;
    formaPagamento?: number | null;
    tipoAdmissaoFgts?: number | null;
    tipoLogradouroESocial?: string | null;
    municipioEnderecoIbge?: number | null;
    municipioNascimentoIbge?: number | null;
}

interface PreAdmissao {
    id: string;
    nome: string;
    cpf: string | null;
    email: string | null;
    status: number | string;
    preenchidoPor: number;
    revisadoPorNome: string | null;
    aprovadoPorNome: string | null;
    observacaoRh: string | null;
    motivoRejeicao: string | null;
    // all fields...
    rg: string | null;
    rgOrgaoExpedidor: string | null;
    rgDataExpedicao: string | null;
    dataNascimento: string | null;
    sexo: number;
    estadoCivil: number;
    nacionalidade: string | null;
    nomeMae: string | null;
    nomePai: string | null;
    naturalCidade: string | null;
    naturalUf: string | null;
    passaporte: string | null;
    rnmRne: string | null;
    validadeVisto: string | null;
    tipoVisto: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    telefone: string | null;
    celular: string | null;
    contatoEmergenciaNome: string | null;
    contatoEmergenciaFone: string | null;
    bancoCodigo: string | null;
    bancoNome: string | null;
    agencia: string | null;
    agenciaDigito: string | null;
    conta: string | null;
    contaDigito: string | null;
    tipoConta: number | null;
    estabelecimentoCodigo: string | null;
    matriculaRM: string | null;
    unitNome: string | null;
    areaNome: string | null;
    jobPositionNome: string | null;
    dataAdmissao: string | null;
    salario: number | null;
    tipoContratacao: number | null;
    cargaHorariaSemanal: number | null;
    pisPasep: string | null;
    // Campos integração TOTVS
    codCargoTotvs: number | null;
    codVinculoEmpregaticio: number | null;
    tipoFuncionario: number | null;
    categoriaSalarial: number | null;
    grauInstrucao: number | null;
    codTurno: number | null;
    tipoEstatistica: number | null;
    centroCusto: string | null;
    unidadeLotacao: string | null;
    formaPagamento: number | null;
    tipoAdmissaoFgts: number | null;
    tipoLogradouroESocial: string | null;
    municipioEnderecoIbge: number | null;
    municipioNascimentoIbge: number | null;
    tituloEleitorNumero: string | null;
    tituloEleitorZona: string | null;
    tituloEleitorSecao: string | null;
    reservistaNumero: string | null;
    categoriaCnh: string | null;
    validadeCnh: string | null;
    ctps: string | null;
    ctpsSerie: string | null;
    ctpsUf: string | null;
    // Saúde e docs complementares TOTVS
    grupoSanguineo: number | null;
    fatorRh: number | null;
    possuiDeficiencia: string | null;
    docMilitarTipo: number | null;
    docMilitarNumero: string | null;
    docMilitarSerie: string | null;
    docMilitarRegiao: number | null;
    cartaoSus: string | null;
    tituloEleitorCidade: string | null;
    tituloEleitorUf: string | null;
    ctpsModelo: number | null;
    altura: number | null;
    peso: number | null;
    validacaoCpfOk: boolean;
    validacaoCepOk: boolean;
    validacaoBancoOk: boolean;
    validacaoSalarioOk: boolean;
    validacaoSalarioJustificativa: string | null;
    createdAtUtc: string;
    submittedAtUtc: string | null;
    approvedAtUtc: string | null;
    // Integração TOTVS
    integracaoResultado: number | string | null; // 1/"Sucesso" 2/"Falha" 3/"FalhaDefinitiva"
    integracaoMensagem: string | null;
    integradaEmUtc: string | null;
    documentos: { id: string; tipo: number | string; lado: number; nomeArquivo: string; contentType: string; tamanhoBytes: number; status: number; observacaoRh: string | null; createdAtUtc: string; presignedUrl: string }[];
    documentosSolicitados: { tipoDocumento: number | string; label: string; obrigatorio: boolean }[];
}

const STATUS_MAP: Record<number | string, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Preenchimento", color: "bg-sky-500/15 text-sky-700", icon: FileText },
    2: { label: "Em Revisão", color: "bg-amber-500/15 text-amber-700", icon: AlertTriangle },
    3: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    4: { label: "Rejeitada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    5: { label: "Integrada", color: "bg-blue-500/15 text-blue-700", icon: ShieldCheck },
    8: { label: "Em Integração", color: "bg-violet-500/15 text-violet-700", icon: Loader2 },
    // String fallbacks — API pode serializar enum como string
    Rascunho:         { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    Enviado:          { label: "Preenchimento", color: "bg-sky-500/15 text-sky-700", icon: FileText },
    PreenchimentoPendente: { label: "Preenchimento", color: "bg-sky-500/15 text-sky-700", icon: FileText },
    Preenchido:       { label: "Em Revisão", color: "bg-amber-500/15 text-amber-700", icon: AlertTriangle },
    PreenchidoParcial:{ label: "Em Revisão", color: "bg-amber-500/15 text-amber-700", icon: AlertTriangle },
    Acessado:         { label: "Em Revisão", color: "bg-amber-500/15 text-amber-700", icon: AlertTriangle },
    Aprovada:         { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    Rejeitada:        { label: "Rejeitada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    Integrada:        { label: "Integrada", color: "bg-blue-500/15 text-blue-700", icon: ShieldCheck },
    EmIntegracao:     { label: "Em Integração", color: "bg-violet-500/15 text-violet-700", icon: Loader2 },
};

/* ── status helpers (suportam number e string) ── */
function st(v: number | string, ...matches: (number | string)[]): boolean {
    return matches.includes(v);
}
// Status "editável pelo RH" — mostra barra de ações com Editar/Preencher
function isEditavel(s: number | string) {
    return st(s, 0, 1, 2, "Rascunho", "Enviado", "PreenchimentoPendente",
               "Preenchido", "PreenchidoParcial", "Acessado");
}
// Status que permite aprovar/rejeitar (documentos recebidos)
function isEmRevisao(s: number | string) {
    return st(s, 2, "Preenchido", "PreenchidoParcial", "Acessado");
}
// Status que permite cancelar (qualquer não-terminal)
function isCancelavel(s: number | string) {
    return st(s, 0, 1, 2, 6, 7, "Rascunho", "Enviado", "Preenchido", "PreenchidoParcial", "Acessado");
}
// Status aprovada aguardando efetivação pelo RH
function isAprovada(s: number | string) {
    return st(s, 3, "Aprovada");
}
// Status em integração — enviado ao TOTVS, aguardando confirmação
function isEmIntegracao(s: number | string) {
    return st(s, 8, "EmIntegracao");
}
// Status rejeitada
function isRejeitada(s: number | string) {
    return st(s, 4, "Rejeitada");
}

const SEXO_L: Record<number, string> = { 0: "—", 1: "Masculino", 2: "Feminino", 3: "Outro" };
const EST_CIVIL_L: Record<number, string> = { 0: "—", 1: "Solteiro(a)", 2: "Casado(a)", 3: "Divorciado(a)", 4: "Viúvo(a)", 5: "União Estável", 6: "Separado(a)" };
const TIPO_CONT_L: Record<number, string> = { 0: "CLT", 1: "PJ", 2: "Estágio", 3: "Temporário", 4: "Aprendiz", 5: "Terceirizado" };
const TIPO_CONTA_L: Record<number, string> = { 0: "Conta Corrente", 1: "Conta Poupança", 2: "Conta Salário" };
const TIPO_DOC_L: Record<number, string> = { 0: "RG", 1: "CPF", 2: "CNH", 3: "Comprovante Residência", 4: "Comprovante Bancário", 5: "Certidão", 6: "CTPS", 7: "Título Eleitor", 8: "Reservista", 9: "Outro" };

/* ── helpers ── */

function numOrNull(v: string): number | null {
    const n = parseInt(v, 10);
    return isNaN(n) ? null : n;
}

function strOrNull(v: string): string | null {
    return v.trim() || null;
}

/* ── component ── */

export default function AdmissaoRevisaoScreen() {
    const router = useRouter();
    const params = useSearchParams();
    const id = params.get("id");
    const { data, isLoading, isError, refetch } = useApiQuery<PreAdmissao>(
        ["pre-admissao", id],
        `/api/pre-admissao/${id}`,
        { enabled: !!id }
    );

    // ── state ──
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectMotivo, setRejectMotivo] = useState("");
    const [approveObs, setApproveObs] = useState("");
    const [processing, setProcessing] = useState(false);
    const [expandedHistories, setExpandedHistories] = useState<Set<string>>(new Set());

    // TOTVS validation errors from failed approve
    const [totvsErrors, setTotvsErrors] = useState<TotvsError[]>([]);

    // "Preencher manualmente" dialog
    const [fillOpen, setFillOpen] = useState(false);
    const [fillData, setFillData] = useState<TotvsFieldsPatch>({});
    const [fillSaving, setFillSaving] = useState(false);

    // "Forçar envio" dialog
    const [forcarOpen, setForcarOpen] = useState(false);
    const [forcarSaving, setForcarSaving] = useState(false);

    // "Efetivar" action
    const [efetivarSaving, setEfetivarSaving] = useState(false);

    // "Cancelar/Excluir" dialog
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelMotivo, setCancelMotivo] = useState("");
    const [deleteOpen, setDeleteOpen] = useState(false);

    // ── actions ──

    async function handleApprove() {
        try {
            setProcessing(true);
            setTotvsErrors([]);
            const res = await apiFetch(`/api/pre-admissao/${id}/approve`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approveObs || null }),
            });
            if (res.ok) {
                toast.success("Admissão aprovada! Clique em Efetivar para enviar ao TOTVS.");
                await refetch();
                return;
            }
            if (res.status === 422) {
                const body = await res.json();
                if (body?.type === "totvs_validation" && Array.isArray(body.errors)) {
                    setTotvsErrors(body.errors as TotvsError[]);
                    toast.warning("Há campos TOTVS obrigatórios pendentes. Preencha-os antes de enviar.");
                    return;
                }
            }
            toast.error("Erro ao aprovar — verifique se a admissão ainda está em revisão");
        } catch {
            toast.error("Erro de conexão ao aprovar");
        } finally {
            setProcessing(false);
        }
    }

    async function handleReject() {
        if (!rejectMotivo.trim()) return;
        try {
            setProcessing(true);
            const res = await apiFetch(`/api/pre-admissao/${id}/reject`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: rejectMotivo }),
            });
            if (res.ok) { toast.success("Admissão rejeitada"); router.push("/admissao"); }
            else toast.error("Erro ao rejeitar");
        } catch {
            toast.error("Erro de conexão ao rejeitar");
        } finally { setProcessing(false); setRejectOpen(false); }
    }

    async function handleCancel() {
        if (!cancelMotivo.trim()) return;
        try {
            setProcessing(true);
            const res = await apiFetch(`/api/pre-admissao/${id}/reject`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivo: cancelMotivo }),
            });
            if (res.ok) { toast.success("Admissão cancelada"); router.push("/admissao"); }
            else toast.error("Erro ao cancelar");
        } catch {
            toast.error("Erro de conexão ao cancelar");
        } finally { setProcessing(false); setCancelOpen(false); }
    }

    async function handleDelete() {
        try {
            setProcessing(true);
            const res = await apiFetch(`/api/pre-admissao/${id}`, { method: "DELETE" });
            if (res.ok) { toast.success("Admissão excluída"); router.push("/admissao"); }
            else {
                const body = await res.json().catch(() => ({}));
                toast.error(body?.message ?? "Erro ao excluir");
            }
        } catch {
            toast.error("Erro de conexão ao excluir");
        } finally { setProcessing(false); setDeleteOpen(false); }
    }

    function openFillDialog() {
        if (!data) return;
        setFillData({
            codCargoTotvs: data.codCargoTotvs,
            codVinculoEmpregaticio: data.codVinculoEmpregaticio,
            tipoFuncionario: data.tipoFuncionario,
            categoriaSalarial: data.categoriaSalarial,
            grauInstrucao: data.grauInstrucao,
            codTurno: data.codTurno,
            tipoEstatistica: data.tipoEstatistica,
            centroCusto: data.centroCusto,
            unidadeLotacao: data.unidadeLotacao,
            formaPagamento: data.formaPagamento,
            tipoAdmissaoFgts: data.tipoAdmissaoFgts,
            tipoLogradouroESocial: data.tipoLogradouroESocial,
            municipioEnderecoIbge: data.municipioEnderecoIbge,
            municipioNascimentoIbge: data.municipioNascimentoIbge,
        });
        setFillOpen(true);
    }

    async function saveFields(): Promise<boolean> {
        if (!data) return false;
        setFillSaving(true);
        try {
            const body = {
                // spread all current data fields that UpdateRequest expects
                nome: data.nome,
                cpf: data.cpf,
                rg: data.rg,
                rgOrgaoExpedidor: data.rgOrgaoExpedidor,
                rgDataExpedicao: data.rgDataExpedicao,
                dataNascimento: data.dataNascimento,
                sexo: data.sexo,
                estadoCivil: data.estadoCivil,
                nacionalidade: data.nacionalidade,
                nomeMae: data.nomeMae,
                nomePai: data.nomePai,
                naturalCidade: data.naturalCidade,
                naturalUf: data.naturalUf,
                passaporte: data.passaporte,
                rnmRne: data.rnmRne,
                validadeVisto: data.validadeVisto,
                tipoVisto: data.tipoVisto,
                cep: data.cep,
                logradouro: data.logradouro,
                numero: data.numero,
                complemento: data.complemento,
                bairro: data.bairro,
                cidade: data.cidade,
                uf: data.uf,
                email: data.email,
                telefone: data.telefone,
                celular: data.celular,
                contatoEmergenciaNome: data.contatoEmergenciaNome,
                contatoEmergenciaFone: data.contatoEmergenciaFone,
                bancoCodigo: data.bancoCodigo,
                agencia: data.agencia,
                agenciaDigito: data.agenciaDigito,
                conta: data.conta,
                contaDigito: data.contaDigito,
                tipoConta: data.tipoConta,
                estabelecimentoCodigo: data.estabelecimentoCodigo,
                matriculaRM: data.matriculaRM,
                dataAdmissao: data.dataAdmissao,
                salario: data.salario,
                tipoContratacao: data.tipoContratacao,
                cargaHorariaSemanal: data.cargaHorariaSemanal,
                pisPasep: data.pisPasep,
                tituloEleitorNumero: data.tituloEleitorNumero,
                tituloEleitorZona: data.tituloEleitorZona,
                tituloEleitorSecao: data.tituloEleitorSecao,
                tituloEleitorCidade: data.tituloEleitorCidade,
                tituloEleitorUf: data.tituloEleitorUf,
                reservistaNumero: data.reservistaNumero,
                categoriaCnh: data.categoriaCnh,
                validadeCnh: data.validadeCnh,
                ctps: data.ctps,
                ctpsSerie: data.ctpsSerie,
                ctpsUf: data.ctpsUf,
                ctpsModelo: data.ctpsModelo,
                grupoSanguineo: data.grupoSanguineo,
                fatorRh: data.fatorRh,
                possuiDeficiencia: data.possuiDeficiencia,
                docMilitarTipo: data.docMilitarTipo,
                docMilitarNumero: data.docMilitarNumero,
                docMilitarSerie: data.docMilitarSerie,
                docMilitarRegiao: data.docMilitarRegiao,
                cartaoSus: data.cartaoSus,
                altura: data.altura,
                peso: data.peso,
                // TOTVS fields — override with fillData
                ...fillData,
            };
            const res = await apiFetch(`/api/pre-admissao/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                await refetch();
                return true;
            }
            toast.error("Erro ao salvar os campos. Tente novamente.");
            return false;
        } catch {
            toast.error("Erro de conexão ao salvar");
            return false;
        } finally {
            setFillSaving(false);
        }
    }

    async function handleSaveOnly() {
        const ok = await saveFields();
        if (ok) {
            setFillOpen(false);
            setTotvsErrors([]);
            toast.success("Campos salvos com sucesso!");
        }
    }

    async function handleSaveAndApprove() {
        const ok = await saveFields();
        if (ok) {
            setFillOpen(false);
            await handleApprove();
        }
    }

    async function handleEfetivar() {
        try {
            setEfetivarSaving(true);
            const res = await apiFetch(`/api/pre-admissao/${id}/efetivar`, { method: "POST" });
            if (res.ok) {
                toast.success("Admissão efetivada — aguardando confirmação do TOTVS.");
                await refetch();
                return;
            }
            const body = await res.json().catch(() => ({}));
            toast.error(body?.message ?? "Erro ao efetivar a admissão.");
        } catch {
            toast.error("Erro de conexão ao efetivar");
        } finally {
            setEfetivarSaving(false);
        }
    }

    async function handleForcarEnvio() {
        try {
            setForcarSaving(true);
            // TipoIntegracao.Admissao = 1
            const res = await apiFetch(`/api/integracao-totvs/1/${id}/efetivar-manual`, {
                method: "POST",
            });
            if (res.ok) {
                toast.success("Envio forçado com sucesso! Admissão marcada como integrada.");
                setForcarOpen(false);
                await refetch();
                return;
            }
            if (res.status === 409) {
                toast.info("Esta admissão já foi integrada ao TOTVS.");
                setForcarOpen(false);
                return;
            }
            toast.error("Erro ao forçar o envio. Tente novamente.");
        } catch {
            toast.error("Erro de conexão ao forçar envio");
        } finally {
            setForcarSaving(false);
        }
    }

    if (isLoading) return <ScreenSkeleton />;
    if (isError || !data) return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm text-destructive">{isError ? "Não foi possível carregar os dados da admissão." : "Admissão não encontrada."}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/admissao")}>Voltar para lista</Button>
        </div>
    );

    const s = STATUS_MAP[data.status] ?? STATUS_MAP[0];
    const Icon = s.icon;
    const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
    const fmtDateTime = (d: string | null) => d ? new Date(d).toLocaleString("pt-BR") : "—";
    const fmtBrl = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

    const validations = [
        { label: "CPF válido", ok: data.validacaoCpfOk },
        { label: "CEP preenchido", ok: data.validacaoCepOk },
        { label: "Dados bancários", ok: data.validacaoBancoOk },
        { label: "Salário na faixa", ok: data.validacaoSalarioOk },
    ];

    // Arquivos — agrupados por tipo, ordenados por data desc
    const toggleHistory = (k: string) =>
        setExpandedHistories(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
    const byDate = (a: typeof data.documentos[0], b: typeof data.documentos[0]) =>
        new Date(b.createdAtUtc).getTime() - new Date(a.createdAtUtc).getTime();
    const docsByTipo = new Map<string, typeof data.documentos>();
    for (const d of data.documentos) {
        const k = String(d.tipo);
        if (!docsByTipo.has(k)) docsByTipo.set(k, []);
        docsByTipo.get(k)!.push(d);
    }
    const solicitadosKeys = new Set(data.documentosSolicitados.map(s => String(s.tipoDocumento)));
    const solEnviados = data.documentosSolicitados.filter(s => docsByTipo.has(String(s.tipoDocumento)));
    const solFaltando = data.documentosSolicitados.filter(s => !docsByTipo.has(String(s.tipoDocumento)));
    const extras = data.documentos.filter(d => !solicitadosKeys.has(String(d.tipo)));

    // Separa os arquivos de um grupo por lado (0=Unico, 1=Frente, 2=Verso)
    const splitByLado = (arquivos: typeof data.documentos) => ({
        frentes: arquivos.filter(d => d.lado === 1).sort(byDate),
        versos:  arquivos.filter(d => d.lado === 2).sort(byDate),
        unicos:  arquivos.filter(d => d.lado === 0 || d.lado == null).sort(byDate),
    });

    // TOTVS errors grouped by secao
    const totvsErrorsBySecao = totvsErrors.reduce<Record<string, TotvsError[]>>((acc, e) => {
        const s = e.secao || "Geral";
        if (!acc[s]) acc[s] = [];
        acc[s].push(e);
        return acc;
    }, {});

    // Integration status banner for EmIntegracao / Integrada
    const integracaoLabel = (() => {
        if (!isEmIntegracao(data.status) && !st(data.status, 5, "Integrada")) return null;
        if (data.integracaoResultado === 1 || data.integracaoResultado === "Sucesso")
            return { type: "success", msg: `Integrada com sucesso em ${fmtDateTime(data.integradaEmUtc)}` };
        if (data.integracaoResultado === 2 || data.integracaoResultado === "Falha")
            return { type: "error", msg: `Falha na integração: ${data.integracaoMensagem || "sem detalhes"}` };
        if (data.integracaoResultado === 3 || data.integracaoResultado === "FalhaDefinitiva")
            return { type: "error", msg: `Falha definitiva: ${data.integracaoMensagem || "sem detalhes"}` };
        if (isEmIntegracao(data.status)) return { type: "pending", msg: "Admissão enviada ao TOTVS — aguardando confirmação da integração." };
        return null;
    })();

    const canForcarEnvio = isEmIntegracao(data.status)
        && data.integracaoResultado !== 1
        && data.integracaoResultado !== "Sucesso";

    return (
        <section className="space-y-4">
            {/* header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-lg font-bold">Revisão de Admissão</h4>
                    <div className="text-muted-foreground text-sm">{data.nome} {data.cpf ? `— ${data.cpf}` : ""}</div>
                </div>
                <div className="flex gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ${s.color}`}>
                        <Icon className="size-3.5" /> {s.label}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => {
                        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `admissao-${data.nome.replace(/\s+/g, "_")}-${data.id}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                    }}>
                        <Download className="size-4" /> Exportar JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push("/admissao")}>
                        <ChevronLeft className="size-4" /> Voltar
                    </Button>
                </div>
            </div>

            {/* Validations bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {validations.map(v => (
                    <div key={v.label} className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm font-medium ${v.ok ? "border-emerald-300 bg-emerald-500/10 text-emerald-700" : "border-red-300 bg-red-500/10 text-red-700"}`}>
                        {v.ok ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
                        {v.label}
                    </div>
                ))}
            </div>
            {!data.validacaoSalarioOk && data.validacaoSalarioJustificativa && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-400/30 p-3 text-sm text-amber-700">
                    <strong>Justificativa salário:</strong> {data.validacaoSalarioJustificativa}
                </div>
            )}

            {/* TOTVS validation error panel */}
            {totvsErrors.length > 0 && (
                <div className="rounded-lg border border-orange-300 bg-orange-50/60 dark:border-orange-700 dark:bg-orange-900/15 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="size-4 text-orange-600 shrink-0" />
                        <p className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                            Campos TOTVS pendentes — a admissão não pode ser enviada até que sejam preenchidos
                        </p>
                    </div>
                    <div className="space-y-2 pl-6">
                        {Object.entries(totvsErrorsBySecao).map(([secao, erros]) => (
                            <div key={secao}>
                                <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-1">{secao}</p>
                                <ul className="space-y-0.5">
                                    {erros.map(e => (
                                        <li key={e.campo} className="text-sm text-orange-800 dark:text-orange-300 flex items-start gap-1.5">
                                            <span className="mt-0.5 shrink-0">•</span>
                                            <span><strong>{e.label}</strong> — {e.mensagem}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                    <div className="pl-6">
                        <Button size="sm" variant="outline" className="border-orange-400 text-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30" onClick={openFillDialog}>
                            <WrenchIcon className="size-3.5" /> Preencher Campos Faltantes
                        </Button>
                    </div>
                </div>
            )}

            {/* Rejection / Approval info */}
            {isRejeitada(data.status) && data.motivoRejeicao && (
                <div className="rounded-lg bg-red-500/10 border border-red-400/30 p-3 text-sm text-red-700">
                    <strong>Motivo da rejeição:</strong> {data.motivoRejeicao}
                </div>
            )}
            {isAprovada(data.status) && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 p-3 text-sm text-emerald-700">
                    <strong>Aprovada</strong> por {data.aprovadoPorNome || "—"} em {fmtDate(data.approvedAtUtc)}
                    {data.observacaoRh && <span> — {data.observacaoRh}</span>}
                </div>
            )}

            {/* Integration status banner */}
            {integracaoLabel && (
                <div className={`rounded-lg border p-3 text-sm flex items-center gap-2 ${
                    integracaoLabel.type === "success"
                        ? "bg-blue-500/10 border-blue-400/30 text-blue-700"
                        : integracaoLabel.type === "error"
                            ? "bg-red-500/10 border-red-400/30 text-red-700"
                            : "bg-amber-500/10 border-amber-400/30 text-amber-700"
                }`}>
                    {integracaoLabel.type === "success" && <ShieldCheck className="size-4 shrink-0" />}
                    {integracaoLabel.type === "error" && <XCircle className="size-4 shrink-0" />}
                    {integracaoLabel.type === "pending" && <Clock className="size-4 shrink-0 animate-pulse" />}
                    <span>{integracaoLabel.msg}</span>
                </div>
            )}

            {/* Data sections — divididas em abas */}
            <Tabs defaultValue="pessoal" className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
                <TabsList className="w-full justify-start rounded-none border-b border-border/40 bg-muted/20 px-2 h-auto py-1.5 gap-1">
                    <TabsTrigger value="pessoal" className="gap-1.5 text-xs"><User className="size-3.5" /> Pessoal</TabsTrigger>
                    <TabsTrigger value="endereco" className="gap-1.5 text-xs"><MapPin className="size-3.5" /> Endereço & Contato</TabsTrigger>
                    <TabsTrigger value="bancario" className="gap-1.5 text-xs"><CreditCard className="size-3.5" /> Bancário</TabsTrigger>
                    <TabsTrigger value="trabalhista" className="gap-1.5 text-xs"><Briefcase className="size-3.5" /> Trabalhista</TabsTrigger>
                    <TabsTrigger value="documentos" className="gap-1.5 text-xs"><FileText className="size-3.5" /> Documentação</TabsTrigger>
                    <TabsTrigger value="arquivos" className="gap-1.5 text-xs"><FileText className="size-3.5" /> Arquivos Enviados{docsByTipo.size > 0 && <span className="ml-1 text-[10px] bg-primary/15 text-primary rounded-full px-1.5">{docsByTipo.size}</span>}</TabsTrigger>
                </TabsList>

                {/* Aba: Pessoal */}
                <TabsContent value="pessoal" className="p-4 space-y-4 mt-0">
                    <Section title="Dados Pessoais" icon={User}>
                        <Info label="Nome" value={data.nome} />
                        <Info label="CPF" value={data.cpf} />
                        <Info label="RG" value={data.rg} />
                        <Info label="Órgão Exp." value={data.rgOrgaoExpedidor} />
                        <Info label="Data Exp. RG" value={data.rgDataExpedicao} />
                        <Info label="Nascimento" value={data.dataNascimento} />
                        <Info label="Sexo" value={SEXO_L[data.sexo]} />
                        <Info label="Est. Civil" value={EST_CIVIL_L[data.estadoCivil]} />
                        <Info label="Nacionalidade" value={data.nacionalidade} />
                        <Info label="Nome Mãe" value={data.nomeMae} />
                        <Info label="Nome Pai" value={data.nomePai} />
                        <Info label="Natural de" value={[data.naturalCidade, data.naturalUf].filter(Boolean).join("/")} />
                    </Section>
                    {data.nacionalidade && data.nacionalidade.toLowerCase() !== "brasileira" && (
                        <Section title="Estrangeiro" icon={AlertTriangle}>
                            <Info label="Passaporte" value={data.passaporte} />
                            <Info label="RNM/RNE" value={data.rnmRne} />
                            <Info label="Validade Visto" value={data.validadeVisto} />
                            <Info label="Tipo Visto" value={data.tipoVisto} />
                        </Section>
                    )}
                </TabsContent>

                {/* Aba: Endereço & Contato */}
                <TabsContent value="endereco" className="p-4 space-y-4 mt-0">
                    <Section title="Endereço" icon={MapPin}>
                        <Info label="CEP" value={data.cep} />
                        <Info label="Logradouro" value={data.logradouro} />
                        <Info label="Número" value={data.numero} />
                        <Info label="Complemento" value={data.complemento} />
                        <Info label="Bairro" value={data.bairro} />
                        <Info label="Cidade" value={data.cidade} />
                        <Info label="UF" value={data.uf} />
                    </Section>
                    <Section title="Contato" icon={Phone}>
                        <Info label="Email" value={data.email} />
                        <Info label="Telefone" value={data.telefone} />
                        <Info label="Celular" value={data.celular} />
                        <Info label="Emerg. Nome" value={data.contatoEmergenciaNome} />
                        <Info label="Emerg. Fone" value={data.contatoEmergenciaFone} />
                    </Section>
                </TabsContent>

                {/* Aba: Bancário */}
                <TabsContent value="bancario" className="p-4 mt-0">
                    <Section title="Dados Bancários" icon={CreditCard}>
                        <Info label="Banco" value={`${data.bancoCodigo || ""} — ${data.bancoNome || ""}`} />
                        <Info label="Agência" value={`${data.agencia || ""}${data.agenciaDigito ? "-" + data.agenciaDigito : ""}`} />
                        <Info label="Conta" value={`${data.conta || ""}${data.contaDigito ? "-" + data.contaDigito : ""}`} />
                        <Info label="Tipo" value={data.tipoConta != null ? TIPO_CONTA_L[data.tipoConta] : null} />
                    </Section>
                </TabsContent>

                {/* Aba: Trabalhista */}
                <TabsContent value="trabalhista" className="p-4 mt-0">
                    <Section title="Dados Trabalhistas" icon={Briefcase}>
                        <Info label="Estab." value={data.estabelecimentoCodigo} />
                        <Info label="Matrícula RM" value={data.matriculaRM} />
                        <Info label="Unidade" value={data.unitNome} />
                        <Info label="Área" value={data.areaNome} />
                        <Info label="Cargo" value={data.jobPositionNome} />
                        <Info label="Data Admissão" value={data.dataAdmissao} />
                        <Info label="Salário" value={fmtBrl(data.salario)} />
                        <Info label="Contratação" value={data.tipoContratacao != null ? TIPO_CONT_L[data.tipoContratacao] : null} />
                        <Info label="Carga Hor." value={data.cargaHorariaSemanal != null ? `${data.cargaHorariaSemanal}h/sem` : null} />
                        <Info label="PIS/PASEP" value={data.pisPasep} />
                        <Info label="Cargo TOTVS" value={data.codCargoTotvs != null ? String(data.codCargoTotvs) : null} />
                        <Info label="Vínculo" value={data.codVinculoEmpregaticio != null ? String(data.codVinculoEmpregaticio) : null} />
                        <Info label="Tipo Func." value={data.tipoFuncionario != null ? String(data.tipoFuncionario) : null} />
                        <Info label="Tipo Estatística" value={data.tipoEstatistica != null ? String(data.tipoEstatistica) : null} />
                        <Info label="Cat. Salarial" value={data.categoriaSalarial != null ? String(data.categoriaSalarial) : null} />
                        <Info label="Grau Instrução" value={data.grauInstrucao != null ? String(data.grauInstrucao) : null} />
                        <Info label="Turno" value={data.codTurno != null ? String(data.codTurno) : null} />
                        <Info label="Centro Custo" value={data.centroCusto} />
                        <Info label="Unid. Lotação" value={data.unidadeLotacao} />
                        <Info label="Forma Pgto." value={data.formaPagamento != null ? String(data.formaPagamento) : null} />
                        <Info label="Tipo Adm. FGTS" value={data.tipoAdmissaoFgts != null ? String(data.tipoAdmissaoFgts) : null} />
                        <Info label="Tipo Logradouro" value={data.tipoLogradouroESocial} />
                        <Info label="Munic. End. IBGE" value={data.municipioEnderecoIbge != null ? String(data.municipioEnderecoIbge) : null} />
                        <Info label="Munic. Nasc. IBGE" value={data.municipioNascimentoIbge != null ? String(data.municipioNascimentoIbge) : null} />
                    </Section>
                </TabsContent>

                {/* Aba: Documentação Complementar */}
                <TabsContent value="documentos" className="p-4 mt-0">
                    <Section title="Documentação Complementar" icon={FileText}>
                        <Info label="Título Eleitor" value={data.tituloEleitorNumero} />
                        <Info label="Zona/Seção" value={[data.tituloEleitorZona, data.tituloEleitorSecao].filter(Boolean).join("/")} />
                        <Info label="Cidade/UF Título" value={[data.tituloEleitorCidade, data.tituloEleitorUf].filter(Boolean).join("/")} />
                        <Info label="Reservista" value={data.reservistaNumero} />
                        <Info label="CNH Cat." value={data.categoriaCnh} />
                        <Info label="Val. CNH" value={data.validadeCnh} />
                        <Info label="CTPS" value={[data.ctps, data.ctpsSerie].filter(Boolean).join(" Série ")} />
                        <Info label="CTPS UF" value={data.ctpsUf} />
                        <Info label="Modelo CTPS" value={data.ctpsModelo != null ? (data.ctpsModelo === 1 ? "Papel" : "Digital") : null} />
                        <Info label="Grupo Sanguíneo" value={data.grupoSanguineo != null ? ["", "A", "B", "AB", "O"][data.grupoSanguineo] ?? String(data.grupoSanguineo) : null} />
                        <Info label="Fator Rh" value={data.fatorRh != null ? (data.fatorRh === 1 ? "Positivo (+)" : "Negativo (-)") : null} />
                        <Info label="Deficiência" value={data.possuiDeficiencia === "S" ? "Sim" : data.possuiDeficiencia === "N" ? "Não" : null} />
                        <Info label="Cartão SUS" value={data.cartaoSus} />
                        <Info label="Altura" value={data.altura != null ? `${data.altura} cm` : null} />
                        <Info label="Peso" value={data.peso != null ? `${data.peso} kg` : null} />
                        <Info label="Doc. Militar" value={data.docMilitarNumero ? `${data.docMilitarNumero} Série ${data.docMilitarSerie ?? ""}` : null} />
                    </Section>
                </TabsContent>

                {/* Aba: Arquivos Enviados */}
                <TabsContent value="arquivos" className="p-4 mt-0 space-y-5">
                    {/* ── Seção: Enviados ── */}
                    {(solEnviados.length > 0 || (data.documentosSolicitados.length === 0 && data.documentos.length > 0)) && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="size-3.5 text-emerald-600" />
                                Enviados ({solEnviados.length || docsByTipo.size})
                            </p>
                            {solEnviados.map(sol => {
                                const k = String(sol.tipoDocumento);
                                const { frentes, versos, unicos } = splitByLado(docsByTipo.get(k) ?? []);
                                const hasSides = frentes.length > 0 || versos.length > 0;

                                const FileRow = ({ latest, older, histKey, sideLabel }: {
                                    latest: typeof data.documentos[0];
                                    older: typeof data.documentos[0][];
                                    histKey: string;
                                    sideLabel?: string;
                                }) => {
                                    const expanded = expandedHistories.has(histKey);
                                    return (
                                        <div className="divide-y divide-emerald-100 dark:divide-emerald-900/40">
                                            <div className="flex items-center justify-between px-3 py-2 gap-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {sideLabel && (
                                                                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                                                                    {sideLabel}
                                                                </span>
                                                            )}
                                                            <span className="text-sm truncate">{latest.nomeArquivo}</span>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {(latest.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(latest.createdAtUtc)}
                                                            {older.length > 0 && (
                                                                <button onClick={() => toggleHistory(histKey)}
                                                                    className="ml-2 underline underline-offset-2 hover:text-foreground transition-colors">
                                                                    {expanded ? "ocultar histórico" : `ver ${older.length} anterior${older.length > 1 ? "es" : ""}`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {latest.presignedUrl && <DocActions d={latest} />}
                                            </div>
                                            {expanded && older.map(d => (
                                                <div key={d.id} className="flex items-center justify-between px-3 py-2 gap-2 bg-muted/20">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <FileText className="size-3.5 text-muted-foreground/50 shrink-0" />
                                                        <div className="min-w-0">
                                                            <div className="text-xs text-muted-foreground truncate">{d.nomeArquivo}</div>
                                                            <div className="text-xs text-muted-foreground/70">{(d.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(d.createdAtUtc)}</div>
                                                        </div>
                                                    </div>
                                                    {d.presignedUrl && <DocActions d={d} />}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                };

                                return (
                                    <div key={k} className="rounded-lg border border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-900/10 overflow-hidden">
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-200/60 dark:border-emerald-800/60">
                                            <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                                            <span className="text-sm font-medium">{sol.label}</span>
                                            {hasSides && (
                                                <span className="ml-auto text-xs text-muted-foreground">
                                                    {frentes.length > 0 && versos.length > 0 ? "Frente + Verso" : frentes.length > 0 ? "Frente" : "Verso"}
                                                </span>
                                            )}
                                        </div>
                                        {frentes.length > 0 && (
                                            <FileRow latest={frentes[0]} older={frentes.slice(1)} histKey={`${k}-f`} sideLabel="Frente" />
                                        )}
                                        {versos.length > 0 && (
                                            <div className={frentes.length > 0 ? "border-t border-emerald-200/60 dark:border-emerald-800/60" : ""}>
                                                <FileRow latest={versos[0]} older={versos.slice(1)} histKey={`${k}-v`} sideLabel="Verso" />
                                            </div>
                                        )}
                                        {!hasSides && unicos.length > 0 && (
                                            <FileRow latest={unicos[0]} older={unicos.slice(1)} histKey={k} />
                                        )}
                                    </div>
                                );
                            })}
                            {/* sem solicitados — exibe o mais recente de cada tipo */}
                            {data.documentosSolicitados.length === 0 && Array.from(docsByTipo.entries()).map(([k, arquivos]) => {
                                const { frentes, versos, unicos } = splitByLado(arquivos);
                                const hasSides = frentes.length > 0 || versos.length > 0;
                                const label = TIPO_DOC_L[Number(k)] ?? `Tipo ${k}`;
                                const renderSideRow = (latest: typeof data.documentos[0], older: typeof data.documentos[0][], histKey: string, sideLabel?: string) => {
                                    const exp = expandedHistories.has(histKey);
                                    return (
                                        <div key={histKey} className="flex items-center justify-between px-3 py-2 gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileText className="size-3.5 text-muted-foreground shrink-0" />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {sideLabel && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground shrink-0">{sideLabel}</span>}
                                                        <span className="text-sm truncate">{latest.nomeArquivo}</span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {(latest.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(latest.createdAtUtc)}
                                                        {older.length > 0 && <button onClick={() => toggleHistory(histKey)} className="ml-2 underline underline-offset-2 hover:text-foreground transition-colors">{exp ? "ocultar" : `+${older.length} anterior${older.length > 1 ? "es" : ""}`}</button>}
                                                    </div>
                                                </div>
                                            </div>
                                            {latest.presignedUrl && <DocActions d={latest} />}
                                        </div>
                                    );
                                };
                                return (
                                    <div key={k} className="rounded-lg border border-border/30 bg-muted/10 overflow-hidden">
                                        <div className="px-3 py-1.5 border-b border-border/20 bg-muted/20">
                                            <span className="text-xs font-semibold text-muted-foreground">{label}</span>
                                        </div>
                                        {hasSides ? (
                                            <>
                                                {frentes.length > 0 && renderSideRow(frentes[0], frentes.slice(1), `${k}-f`, "Frente")}
                                                {versos.length > 0 && <div className="border-t border-border/20">{renderSideRow(versos[0], versos.slice(1), `${k}-v`, "Verso")}</div>}
                                            </>
                                        ) : (
                                            unicos.length > 0 && renderSideRow(unicos[0], unicos.slice(1), k)
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ── Seção: Não enviados ── */}
                    {solFaltando.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                <XCircle className="size-3.5 text-red-500" />
                                Não enviados ({solFaltando.length})
                            </p>
                            {solFaltando.map(sol => (
                                <div key={String(sol.tipoDocumento)} className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${sol.obrigatorio ? "border-red-200 bg-red-50/40 dark:border-red-800 dark:bg-red-900/10" : "border-amber-200 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-900/10"}`}>
                                    <XCircle className={`size-4 shrink-0 ${sol.obrigatorio ? "text-red-500" : "text-amber-500"}`} />
                                    <span className="text-sm font-medium flex-1">{sol.label}</span>
                                    <span className={`text-xs font-medium ${sol.obrigatorio ? "text-red-600" : "text-amber-600"}`}>{sol.obrigatorio ? "Obrigatório" : "Opcional"}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Seção: Extras (fora do solicitado) ── */}
                    {extras.length > 0 && (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outros arquivos enviados</p>
                            {extras.map(d => (
                                <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 p-3 gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <FileText className="size-4 text-muted-foreground shrink-0" />
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium truncate">{d.nomeArquivo}</div>
                                            <div className="text-xs text-muted-foreground">{TIPO_DOC_L[Number(d.tipo)] ?? String(d.tipo)} • {(d.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(d.createdAtUtc)}</div>
                                        </div>
                                    </div>
                                    {d.presignedUrl && <DocActions d={d} />}
                                </div>
                            ))}
                        </div>
                    )}

                    {data.documentos.length === 0 && data.documentosSolicitados.length === 0 && (
                        <div className="text-center py-8 text-sm text-muted-foreground">Nenhum arquivo enviado.</div>
                    )}
                </TabsContent>
            </Tabs>

            {/* ── Action bar: statuses editáveis ── */}
            {isEditavel(data.status) && (
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border/40 bg-card shadow-sm">
                    {/* Observação só faz sentido para aprovação */}
                    {isEmRevisao(data.status) && (
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs text-muted-foreground block mb-1">Observação do RH (opcional)</label>
                            <Input value={approveObs} onChange={e => setApproveObs(e.target.value)} placeholder="Comentários adicionais…" />
                        </div>
                    )}
                    <Button variant="outline" onClick={openFillDialog}>
                        <WrenchIcon className="size-4" /> Preencher Manualmente
                    </Button>
                    <Button variant="outline" onClick={() => router.push(`/admissao/nova?id=${data.id}`)}>
                        <Pencil className="size-4" /> Editar Dados
                    </Button>
                    {/* Rejeitar e Enviar ao TOTVS apenas para EmRevisão */}
                    {isEmRevisao(data.status) && (
                        <>
                            <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={processing}>
                                <XCircle className="size-4" /> Rejeitar
                            </Button>
                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={processing}>
                                {processing ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Aprovar
                            </Button>
                        </>
                    )}
                    {/* Cancelar para statuses não-revisão (Rascunho/Enviado) */}
                    {isCancelavel(data.status) && !isEmRevisao(data.status) && (
                        <Button variant="destructive" onClick={() => setCancelOpen(true)} disabled={processing}>
                            <XCircle className="size-4" /> Cancelar
                        </Button>
                    )}
                    {/* Excluir permanentemente */}
                    <Button variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => setDeleteOpen(true)} disabled={processing}>
                        <Trash2 className="size-4" /> Excluir
                    </Button>
                </div>
            )}

            {/* ── Action bar: Aprovada — RH deve efetivar para enviar ao TOTVS ── */}
            {isAprovada(data.status) && (
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border/40 bg-card shadow-sm">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Admissão aprovada</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Clique em &ldquo;Efetivar&rdquo; para enviar ao TOTVS e aguardar a confirmação da integração.
                        </p>
                    </div>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={handleEfetivar}
                        disabled={efetivarSaving}
                    >
                        {efetivarSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                        Efetivar
                    </Button>
                </div>
            )}

            {/* ── Action bar: EmIntegracao — aguardando TOTVS / Forçar Envio ── */}
            {canForcarEnvio && (
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border/40 bg-card shadow-sm">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Ações de integração TOTVS</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            A admissão está aprovada e aguardando o worker TOTVS. Use &ldquo;Forçar Envio&rdquo; apenas se o worker estiver com problema.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        className="border-orange-400 text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        onClick={() => setForcarOpen(true)}
                    >
                        <Zap className="size-4" /> Forçar Envio ao TOTVS
                    </Button>
                </div>
            )}

            {/* ── Reject dialog ── */}
            <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Rejeitar Admissão</DialogTitle>
                        <DialogDescription>Informe o motivo da rejeição.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input value={rejectMotivo} onChange={e => setRejectMotivo(e.target.value)} placeholder="Motivo da rejeição…" />
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setRejectOpen(false)}>Cancelar</Button>
                            <Button className="bg-red-600 hover:bg-red-700" onClick={handleReject} disabled={!rejectMotivo.trim() || processing}>
                                {processing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Confirmar Rejeição
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Cancel dialog ── */}
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Cancelar Admissão</DialogTitle>
                        <DialogDescription>Informe o motivo do cancelamento.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Input value={cancelMotivo} onChange={e => setCancelMotivo(e.target.value)} placeholder="Motivo do cancelamento…" />
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" onClick={() => setCancelOpen(false)}>Voltar</Button>
                            <Button className="bg-red-600 hover:bg-red-700" onClick={handleCancel} disabled={!cancelMotivo.trim() || processing}>
                                {processing ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />} Confirmar Cancelamento
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Delete dialog ── */}
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-red-600">Excluir Admissão</DialogTitle>
                        <DialogDescription>Esta ação é irreversível. O registro e todos os documentos serão excluídos permanentemente.</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={processing}>
                            {processing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Excluir permanentemente
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Preencher manualmente dialog ── */}
            <Dialog open={fillOpen} onOpenChange={v => { if (!fillSaving) setFillOpen(v); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <WrenchIcon className="size-4" /> Preencher Campos TOTVS Manualmente
                        </DialogTitle>
                        <DialogDescription>
                            Preencha os campos obrigatórios para integração com o TOTVS. Campos em branco não serão alterados se já tiverem valor.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                        <FillField label="Cargo TOTVS (código)" value={fillData.codCargoTotvs != null ? String(fillData.codCargoTotvs) : ""}
                            onChange={v => setFillData(p => ({ ...p, codCargoTotvs: numOrNull(v) }))} type="number" />
                        <FillField label="Vínculo Empregatício (código)" value={fillData.codVinculoEmpregaticio != null ? String(fillData.codVinculoEmpregaticio) : ""}
                            onChange={v => setFillData(p => ({ ...p, codVinculoEmpregaticio: numOrNull(v) }))} type="number" />
                        <FillField label="Tipo de Funcionário" value={fillData.tipoFuncionario != null ? String(fillData.tipoFuncionario) : ""}
                            onChange={v => setFillData(p => ({ ...p, tipoFuncionario: numOrNull(v) }))} type="number" />
                        <FillField label="Categoria Salarial" value={fillData.categoriaSalarial != null ? String(fillData.categoriaSalarial) : ""}
                            onChange={v => setFillData(p => ({ ...p, categoriaSalarial: numOrNull(v) }))} type="number" />
                        <FillField label="Grau de Instrução" value={fillData.grauInstrucao != null ? String(fillData.grauInstrucao) : ""}
                            onChange={v => setFillData(p => ({ ...p, grauInstrucao: numOrNull(v) }))} type="number" />
                        <FillField label="Turno (código)" value={fillData.codTurno != null ? String(fillData.codTurno) : ""}
                            onChange={v => setFillData(p => ({ ...p, codTurno: numOrNull(v) }))} type="number" />
                        <FillField label="Tipo Estatística" value={fillData.tipoEstatistica != null ? String(fillData.tipoEstatistica) : ""}
                            onChange={v => setFillData(p => ({ ...p, tipoEstatistica: numOrNull(v) }))} type="number" />
                        <FillField label="Forma de Pagamento" value={fillData.formaPagamento != null ? String(fillData.formaPagamento) : ""}
                            onChange={v => setFillData(p => ({ ...p, formaPagamento: numOrNull(v) }))} type="number" />
                        <FillField label="Tipo Admissão FGTS" value={fillData.tipoAdmissaoFgts != null ? String(fillData.tipoAdmissaoFgts) : ""}
                            onChange={v => setFillData(p => ({ ...p, tipoAdmissaoFgts: numOrNull(v) }))} type="number" />
                        <FillField label="Centro de Custo" value={fillData.centroCusto ?? ""}
                            onChange={v => setFillData(p => ({ ...p, centroCusto: strOrNull(v) }))} />
                        <FillField label="Unidade de Lotação" value={fillData.unidadeLotacao ?? ""}
                            onChange={v => setFillData(p => ({ ...p, unidadeLotacao: strOrNull(v) }))} />
                        <FillField label="Tipo Logradouro eSocial" value={fillData.tipoLogradouroESocial ?? ""}
                            onChange={v => setFillData(p => ({ ...p, tipoLogradouroESocial: strOrNull(v) }))} />
                        <FillField label="Município Endereço IBGE" value={fillData.municipioEnderecoIbge != null ? String(fillData.municipioEnderecoIbge) : ""}
                            onChange={v => setFillData(p => ({ ...p, municipioEnderecoIbge: numOrNull(v) }))} type="number" />
                        <FillField label="Município Nascimento IBGE" value={fillData.municipioNascimentoIbge != null ? String(fillData.municipioNascimentoIbge) : ""}
                            onChange={v => setFillData(p => ({ ...p, municipioNascimentoIbge: numOrNull(v) }))} type="number" />
                    </div>

                    <DialogFooter className="gap-2 flex-wrap">
                        <Button variant="outline" onClick={() => setFillOpen(false)} disabled={fillSaving}>
                            Cancelar
                        </Button>
                        <Button variant="outline" onClick={handleSaveOnly} disabled={fillSaving}>
                            {fillSaving ? <Loader2 className="size-4 animate-spin" /> : null}
                            Salvar sem enviar
                        </Button>
                        {isEmRevisao(data.status) && (
                            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveAndApprove} disabled={fillSaving}>
                                {fillSaving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                                Salvar e Enviar ao TOTVS
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Forçar envio dialog ── */}
            <Dialog open={forcarOpen} onOpenChange={v => { if (!forcarSaving) setForcarOpen(v); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-700">
                            <Zap className="size-4" /> Forçar Envio ao TOTVS
                        </DialogTitle>
                        <DialogDescription className="space-y-2 pt-1">
                            <span className="block">
                                Esta ação marca a admissão como <strong>integrada com sucesso</strong> sem aguardar a resposta do worker TOTVS.
                            </span>
                            <span className="block text-destructive font-medium">
                                ⚠ Todos os efeitos colaterais (criação de funcionário, fechamento de vaga) serão executados imediatamente e esta ação <strong>não pode ser desfeita</strong>.
                            </span>
                            <span className="block">
                                Use apenas se o worker TOTVS estiver com problema e você tiver confirmado manualmente que o cadastro foi feito no Progress.
                            </span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForcarOpen(false)} disabled={forcarSaving}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-orange-600 hover:bg-orange-700"
                            onClick={handleForcarEnvio}
                            disabled={forcarSaving}
                        >
                            {forcarSaving ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                            Confirmar Forçar Envio
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

/* ── sub-components ── */

type DocumentoItem = PreAdmissao["documentos"][number];

function DocActions({ d }: { d: DocumentoItem }) {
    return (
        <div className="flex gap-1.5 shrink-0">
            <a href={d.presignedUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background px-2 py-1 text-xs font-medium hover:bg-muted transition-colors">
                <Eye className="size-3.5" /> Visualizar
            </a>
            <a href={d.presignedUrl} download={d.nomeArquivo}
                className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background px-2 py-1 text-xs font-medium hover:bg-muted transition-colors">
                <Download className="size-3.5" /> Baixar
            </a>
        </div>
    );
}

function Section({ title, icon: SIcon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-border/40 bg-muted/5 p-4">
            <h6 className="text-sm font-semibold flex items-center gap-2 mb-3"><SIcon className="size-4" /> {title}</h6>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{children}</div>
        </div>
    );
}

function Info({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="rounded-lg border border-border/20 bg-muted/5 p-2">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className="text-sm font-medium truncate">{(value as string) || "—"}</div>
        </div>
    );
}

function FillField({ label, value, onChange, type = "text" }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: "text" | "number";
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs">{label}</Label>
            <Input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder="—"
                className="h-8 text-sm"
            />
        </div>
    );
}
