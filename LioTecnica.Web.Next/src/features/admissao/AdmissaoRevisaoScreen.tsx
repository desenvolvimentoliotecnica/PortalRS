"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    ChevronLeft, CheckCircle2, XCircle, AlertTriangle, FileText, User, MapPin,
    CreditCard, Briefcase, Phone, ShieldCheck, Loader2, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useApiQuery } from "@/hooks/useApiQuery";
import { ScreenSkeleton } from "@/components/ui/ScreenSkeleton";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

/* ── types ── */

interface PreAdmissao {
    id: string;
    nome: string;
    cpf: string | null;
    email: string | null;
    status: number;
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
    centroCusto: string | null;
    unidadeLotacao: string | null;
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
    documentos: { id: string; tipo: number; nomeArquivo: string; contentType: string; tamanhoBytes: number; status: number; observacaoRh: string | null; createdAtUtc: string }[];
}

const STATUS_MAP: Record<number, { label: string; color: string; icon: React.ElementType }> = {
    0: { label: "Rascunho", color: "bg-zinc-400/15 text-zinc-600", icon: FileText },
    1: { label: "Preenchimento", color: "bg-sky-500/15 text-sky-700", icon: FileText },
    2: { label: "Em Revisão", color: "bg-amber-500/15 text-amber-700", icon: AlertTriangle },
    3: { label: "Aprovada", color: "bg-emerald-500/15 text-emerald-700", icon: CheckCircle2 },
    4: { label: "Rejeitada", color: "bg-red-500/15 text-red-700", icon: XCircle },
    5: { label: "Integrada", color: "bg-blue-500/15 text-blue-700", icon: ShieldCheck },
};

const SEXO_L: Record<number, string> = { 0: "—", 1: "Masculino", 2: "Feminino", 3: "Outro" };
const EST_CIVIL_L: Record<number, string> = { 0: "—", 1: "Solteiro(a)", 2: "Casado(a)", 3: "Divorciado(a)", 4: "Viúvo(a)", 5: "União Estável", 6: "Separado(a)" };
const TIPO_CONT_L: Record<number, string> = { 0: "CLT", 1: "PJ", 2: "Estágio", 3: "Temporário", 4: "Aprendiz", 5: "Terceirizado" };
const TIPO_CONTA_L: Record<number, string> = { 0: "Conta Corrente", 1: "Conta Poupança", 2: "Conta Salário" };
const TIPO_DOC_L: Record<number, string> = { 0: "RG", 1: "CPF", 2: "CNH", 3: "Comprovante Residência", 4: "Comprovante Bancário", 5: "Certidão", 6: "CTPS", 7: "Título Eleitor", 8: "Reservista", 9: "Outro" };

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
    const [rejectOpen, setRejectOpen] = useState(false);
    const [rejectMotivo, setRejectMotivo] = useState("");
    const [approveObs, setApproveObs] = useState("");
    const [processing, setProcessing] = useState(false);

    async function handleApprove() {
        try {
            setProcessing(true);
            const res = await apiFetch(`/api/pre-admissao/${id}/approve`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ observacao: approveObs || null }),
            });
            if (res.ok) { toast.success("Admissão aprovada!"); router.push("/admissao"); }
            else toast.error("Erro ao aprovar — verifique se a admissão ainda está em revisão");
        } catch {
            toast.error("Erro de conexão ao aprovar");
        } finally { setProcessing(false); }
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
    const fmtBrl = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

    const validations = [
        { label: "CPF válido", ok: data.validacaoCpfOk },
        { label: "CEP preenchido", ok: data.validacaoCepOk },
        { label: "Dados bancários", ok: data.validacaoBancoOk },
        { label: "Salário na faixa", ok: data.validacaoSalarioOk },
    ];

    return (
        <section className="space-y-4 max-w-4xl mx-auto">
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

            {/* Rejection / Approval info */}
            {data.status === 4 && data.motivoRejeicao && (
                <div className="rounded-lg bg-red-500/10 border border-red-400/30 p-3 text-sm text-red-700">
                    <strong>Motivo da rejeição:</strong> {data.motivoRejeicao}
                </div>
            )}
            {data.status === 3 && (
                <div className="rounded-lg bg-emerald-500/10 border border-emerald-400/30 p-3 text-sm text-emerald-700">
                    <strong>Aprovada</strong> por {data.aprovadoPorNome || "—"} em {fmtDate(data.approvedAtUtc)}
                    {data.observacaoRh && <span> — {data.observacaoRh}</span>}
                </div>
            )}

            {/* Data sections */}
            <div className="grid gap-4">
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

                <Section title="Dados Bancários" icon={CreditCard}>
                    <Info label="Banco" value={`${data.bancoCodigo || ""} — ${data.bancoNome || ""}`} />
                    <Info label="Agência" value={`${data.agencia || ""}${data.agenciaDigito ? "-" + data.agenciaDigito : ""}`} />
                    <Info label="Conta" value={`${data.conta || ""}${data.contaDigito ? "-" + data.contaDigito : ""}`} />
                    <Info label="Tipo" value={data.tipoConta != null ? TIPO_CONTA_L[data.tipoConta] : null} />
                </Section>

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
                    <Info label="Cat. Salarial" value={data.categoriaSalarial != null ? String(data.categoriaSalarial) : null} />
                    <Info label="Grau Instrução" value={data.grauInstrucao != null ? String(data.grauInstrucao) : null} />
                    <Info label="Turno" value={data.codTurno != null ? String(data.codTurno) : null} />
                    <Info label="Centro Custo" value={data.centroCusto} />
                    <Info label="Unid. Lotação" value={data.unidadeLotacao} />
                </Section>

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

                {/* Documents */}
                {data.documentos.length > 0 && (
                    <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur space-y-2">
                        <h6 className="text-sm font-semibold flex items-center gap-2"><FileText className="size-4" /> Documentos Enviados ({data.documentos.length})</h6>
                        {data.documentos.map(d => (
                            <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/30 bg-muted/10 p-3">
                                <div>
                                    <div className="text-sm font-medium">{d.nomeArquivo}</div>
                                    <div className="text-xs text-muted-foreground">{TIPO_DOC_L[d.tipo] ?? "Outro"} • {(d.tamanhoBytes / 1024).toFixed(0)} KB • {fmtDate(d.createdAtUtc)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Action buttons — only for EmRevisao */}
            {data.status === 2 && (
                <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl border border-border/40 bg-card/60 backdrop-blur">
                    <div className="flex-1 min-w-[200px]">
                        <label className="text-xs text-muted-foreground block mb-1">Observação do RH (opcional)</label>
                        <Input value={approveObs} onChange={e => setApproveObs(e.target.value)} placeholder="Comentários adicionais…" />
                    </div>
                    <Button variant="outline" onClick={() => router.push(`/admissao/nova?id=${data.id}`)}>
                        <Pencil className="size-4" /> Editar Dados
                    </Button>
                    <Button variant="destructive" onClick={() => setRejectOpen(true)} disabled={processing}>
                        <XCircle className="size-4" /> Rejeitar
                    </Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleApprove} disabled={processing}>
                        {processing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Aprovar
                    </Button>
                </div>
            )}

            {/* Reject dialog */}
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
        </section>
    );
}

/* ── sub-components ── */

function Section({ title, icon: SIcon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
    return (
        <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-4 backdrop-blur">
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
