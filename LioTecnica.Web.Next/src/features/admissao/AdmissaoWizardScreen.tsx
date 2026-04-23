"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    User, MapPin, Phone, CreditCard, Briefcase, FileUp, CheckCircle2, Upload,
    ChevronLeft, ChevronRight, Save, Send, AlertTriangle, Loader2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { CargoAutocomplete } from "@/components/autocomplete/CargoAutocomplete";
import { CategoriaSalarialAutocomplete } from "@/components/autocomplete/CategoriaSalarialAutocomplete";
import { CentroCustoAutocomplete } from "@/components/autocomplete/CentroCustoAutocomplete";
import { EstabelecimentoAutocomplete } from "@/components/autocomplete/EstabelecimentoAutocomplete";
import { TurnoAutocomplete } from "@/components/autocomplete/TurnoAutocomplete";
import { UnidadeLotacaoAutocomplete } from "@/components/autocomplete/UnidadeLotacaoAutocomplete";
import { validatePreAdmissao, firstErrorStep } from "@/features/admissao/validation";

/** Converte string do autocomplete em número, retornando null quando não numérico. */
function toIntOrNull(v: string | null | undefined): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
}

/* ── types ── */

interface PreAdmissao {
    id: string;
    nome: string;
    cpf: string | null;
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
    email: string | null;
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
    unitId: string | null;
    centroCustoId: string | null;
    jobPositionId: string | null;
    requisitoCategoriaId: string | null;
    dataAdmissao: string | null;
    salario: number | null;
    tipoContratacao: number | null;
    cargaHorariaSemanal: number | null;
    pisPasep: string | null;
    tituloEleitorNumero: string | null;
    tituloEleitorZona: string | null;
    tituloEleitorSecao: string | null;
    reservistaNumero: string | null;
    categoriaCnh: string | null;
    validadeCnh: string | null;
    ctps: string | null;
    ctpsSerie: string | null;
    ctpsUf: string | null;
    // Campos integração TOTVS
    codCargoTotvs: number | null;
    codVinculoEmpregaticio: number | null;
    tipoFuncionario: number | null;
    categoriaSalarial: number | null;
    grauInstrucao: number | null;
    codTurno: number | null;
    centroCusto: string | null;
    unidadeLotacao: string | null;
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
    validacaoSalarioJustificativa: string | null;
    status: number;
    documentos: { id: string; tipo: number | string; lado: number | string; nomeArquivo: string; contentType: string; tamanhoBytes: number; status: number; createdAtUtc: string; presignedUrl?: string }[];
    [key: string]: unknown;
}

const STEPS = [
    { key: "pessoal", label: "Dados Pessoais", icon: User },
    { key: "endereco", label: "Endereço", icon: MapPin },
    { key: "contato", label: "Contato", icon: Phone },
    { key: "bancario", label: "Dados Bancários", icon: CreditCard },
    { key: "trabalhista", label: "Dados Trabalhistas", icon: Briefcase },
    { key: "documentos", label: "Documentos", icon: FileUp },
    { key: "revisao", label: "Revisão e Envio", icon: CheckCircle2 },
];

const SEXO_OPTIONS = [
    { value: 0, label: "Não Informado" }, { value: 1, label: "Masculino" },
    { value: 2, label: "Feminino" }, { value: 3, label: "Outro" },
];
const ESTADO_CIVIL_OPTIONS = [
    { value: 0, label: "Não Informado" }, { value: 1, label: "Solteiro(a)" },
    { value: 2, label: "Casado(a)" }, { value: 3, label: "Divorciado(a)" },
    { value: 4, label: "Viúvo(a)" }, { value: 5, label: "União Estável" }, { value: 6, label: "Separado(a)" },
];
const TIPO_CONTRATACAO = [
    { value: 0, label: "CLT" }, { value: 1, label: "PJ" }, { value: 2, label: "Estágio" },
    { value: 3, label: "Temporário" }, { value: 4, label: "Aprendiz" }, { value: 5, label: "Terceirizado" },
];
const TIPO_CONTA = [
    { value: 0, label: "Conta Corrente" }, { value: 1, label: "Conta Poupança" }, { value: 2, label: "Conta Salário" },
];
const BANCOS = [
    "001-Banco do Brasil", "003-Banco da Amazônia", "004-BNB", "021-Banestes",
    "033-Santander", "041-Banrisul", "070-BRB", "077-Banco Inter",
    "104-Caixa Econômica Federal", "136-Unicred", "197-Stone", "208-BTG Pactual",
    "212-Banco Original", "237-Bradesco", "260-Nubank", "290-PagBank",
    "318-BMG", "336-C6 Bank", "341-Itaú Unibanco", "389-Mercantil",
    "394-Banco Finasa", "399-HSBC", "412-Banco Capital", "422-Safra",
    "453-Banco Rural", "633-Banco Rendimento", "707-Banco Daycoval",
    "741-Banco Ribeirão Preto", "745-Citibank", "748-Sicredi",
    "756-Sicoob", "097-CentralCred",
];
const VINCULO_EMPREGATICIO = [
    { value: 10, label: "CLT (Prazo Indeterminado)" },
    { value: 20, label: "CLT (Prazo Determinado)" },
    { value: 30, label: "Estagiário" },
    { value: 40, label: "Temporário" },
    { value: 50, label: "Diretor Sem Vínculo" },
    { value: 55, label: "Diretor Com Vínculo" },
    { value: 60, label: "Aprendiz" },
    { value: 70, label: "Autônomo" },
    { value: 80, label: "Cooperado" },
];
const TIPO_FUNCIONARIO_TOTVS = [
    { value: 1, label: "Mensalista" },
    { value: 2, label: "Horista" },
    { value: 3, label: "Diarista" },
    { value: 4, label: "Tarefeiro" },
];
const GRAU_INSTRUCAO = [
    { value: 1, label: "Analfabeto" },
    { value: 2, label: "Fundamental Incompleto" },
    { value: 3, label: "Fundamental Completo" },
    { value: 4, label: "Médio Incompleto" },
    { value: 5, label: "Médio Completo" },
    { value: 6, label: "Superior Incompleto" },
    { value: 7, label: "Superior Completo" },
    { value: 8, label: "Pós-Graduação" },
    { value: 9, label: "Mestrado" },
    { value: 10, label: "Doutorado" },
];
const CATEGORIA_SALARIAL = [
    { value: 1, label: "A" }, { value: 2, label: "B" }, { value: 3, label: "C" },
    { value: 4, label: "D" }, { value: 5, label: "E" },
];
const TIPO_DOC_ALL = [
    { value: 0, label: "RG" }, { value: 1, label: "CPF" }, { value: 2, label: "CNH" },
    { value: 5, label: "Comprovante Residência" }, { value: 14, label: "Comprovante Bancário" },
    { value: 6, label: "Certidão Nascimento/Casamento" }, { value: 9, label: "CTPS Digital" },
    { value: 3, label: "Título Eleitor" }, { value: 4, label: "Reservista" }, { value: 7, label: "PIS/PASEP" },
    { value: 15, label: "Foto 3x4" }, { value: 16, label: "Escolaridade" },
    { value: 20, label: "CNPJ" }, { value: 21, label: "Contrato Social/MEI" },
    { value: 22, label: "Conta Bancária PJ" }, { value: 23, label: "Certidões Negativas" },
    { value: 8, label: "Outro" },
];
const DOCS_CLT = new Set([0, 1, 5, 9, 3, 4, 7, 15, 6, 16, 14]);
const DOCS_PJ = new Set([20, 21, 0, 1, 22, 23]);
function getDocsPorTipo(tipo: number | null) {
    if (tipo === 1) return TIPO_DOC_ALL.filter(d => DOCS_PJ.has(d.value));
    return TIPO_DOC_ALL.filter(d => DOCS_CLT.has(d.value));
}
// Mapa string enum → number (API retorna enums como string via JsonStringEnumConverter)
const TIPO_DOC_STR_MAP: Record<string, number> = {
    RG: 0, CPF: 1, CNH: 2, TituloEleitor: 3, Reservista: 4, ComprovanteResidencia: 5,
    CertidaoNascimentoCasamento: 6, PisPasep: 7, Outro: 8, CarteiraTrabalhoCTPS: 9,
    ComprovanteBancario: 14, Foto3x4: 15, Escolaridade: 16,
    CNPJ: 20, ContratoSocialMEI: 21, ContaBancariaPJ: 22, CertidoesNegativas: 23,
};
function resolveDocTipo(raw: number | string): number {
    if (typeof raw === "number") return raw;
    return TIPO_DOC_STR_MAP[raw] ?? -1;
}
// Lado pode vir como int (0,1,2) ou string ("Unico","Frente","Verso") dependendo do endpoint
const LADO_STR_MAP: Record<string, number> = { Unico: 0, Frente: 1, Verso: 2 };
function resolveDocLado(raw: number | string): number {
    if (typeof raw === "number") return raw;
    return LADO_STR_MAP[raw] ?? 0;
}
// Tipos com frente e verso (igual ao portal do candidato)
const TIPOS_COM_VERSO = new Set([0, 2, 9]); // RG, CNH, CTPS
const TIPO_DOC = TIPO_DOC_ALL; // fallback
const UF_LIST = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

/* ── component ── */

export default function AdmissaoWizardScreen() {
    const router = useRouter();
    const params = useSearchParams();
    const id = params.get("id");
    const [step, setStep] = useState(0);
    const [form, setForm] = useState<Partial<PreAdmissao>>({});
    const [saving, setSaving] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [loadingData, setLoadingData] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (id) {
            loadData();
        } else {
            // Pre-fill from query params (coming from Pipeline → "Iniciar Admissão")
            const cargo = params.get("cargo");
            if (cargo) {
                setForm(prev => ({ ...prev, nome: prev.nome || cargo }));
                setStep(4); // Jump to Dados Trabalhistas where cargo is relevant
            }
        }
    }, [id]);

    async function loadData() {
        setLoadingData(true);
        setLoadError(null);
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}`);
            if (res.ok) setForm(await res.json());
            else setLoadError("Não foi possível carregar os dados da admissão.");
        } catch {
            setLoadError("Erro de conexão ao carregar a admissão.");
        } finally {
            setLoadingData(false);
        }
    }

    function set(field: string, value: unknown) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function save() {
        if (!id) return;
        try {
            setSaving(true);
            const res = await apiFetch(`/api/pre-admissao/${id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            if (res.ok) { setForm(await res.json()); toast.success("Salvo!"); }
            else toast.error("Erro ao salvar");
        } catch { toast.error("Erro de conexão"); }
        finally { setSaving(false); }
    }

    async function submit() {
        if (!id) return;
        // Validação só no clique em "Finalizar" — passos intermediários permitem dados incompletos.
        const errors = validatePreAdmissao(form);
        if (errors.length > 0) {
            const firstStep = firstErrorStep(errors) ?? 0;
            setStep(firstStep);
            const first = errors[0];
            toast.error(`${first.label}: ${first.message}${errors.length > 1 ? ` (+${errors.length - 1} campo(s) com pendência)` : ""}`);
            return;
        }
        try {
            setSubmitting(true);
            await save();
            const res = await apiFetch(`/api/pre-admissao/${id}/submit`, { method: "POST" });
            if (res.ok) { toast.success("Admissão finalizada com sucesso!"); router.push("/admissao?submitted=1"); }
            else toast.error("Erro ao submeter");
        } catch { toast.error("Erro de conexão"); }
        finally { setSubmitting(false); }
    }

    async function handleCep() {
        const cep = form.cep?.replace(/\D/g, "");
        if (!cep || cep.length !== 8) return;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();
            if (data.erro) { toast.error("CEP não encontrado"); return; }
            setForm(prev => ({ ...prev, logradouro: data.logradouro, bairro: data.bairro, cidade: data.localidade, uf: data.uf }));
            toast.success("Endereço preenchido via CEP!");
        } catch (e) {
            if ((e as Error).name === "AbortError") toast.error("Busca de CEP demorou demais — preencha o endereço manualmente");
            else toast.error("Não foi possível buscar o CEP");
        }
    }

    async function handleDeleteDoc(docId: string) {
        if (!id) return;
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}/documentos/${docId}`, { method: "DELETE" });
            if (res.ok) { toast.success("Documento removido"); loadData(); }
            else toast.error("Erro ao remover documento");
        } catch {
            toast.error("Erro de conexão ao remover documento");
        }
    }

    const fmtBrl = (v: number | null) => v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

    if (loadingData) return (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm gap-2">
            <Loader2 className="size-4 animate-spin" /> Carregando admissão…
        </div>
    );

    if (loadError) return (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertTriangle className="size-8 text-destructive" />
            <p className="text-sm text-destructive">{loadError}</p>
            <Button variant="outline" size="sm" onClick={() => { if (id) loadData(); }}>Tentar novamente</Button>
            <Button variant="outline" size="sm" onClick={() => router.push("/admissao")}>Voltar para lista</Button>
        </div>
    );

    return (
        <section className="space-y-4">
            {/* header */}
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-lg font-bold">Nova Admissão</h4>
                    <div className="text-muted-foreground text-sm">{form.nome || "…"}</div>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/admissao")}>
                    <ChevronLeft className="size-4" /> Voltar
                </Button>
            </div>

            {/* card unificado: nav steps + conteúdo */}
            <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
                {/* step indicators — barra de navegação */}
                <div className="flex gap-1 overflow-x-auto px-4 py-3 border-b border-border/40 bg-muted/20">
                    {STEPS.map((s, i) => {
                        const Icon = s.icon;
                        return (
                            <button key={s.key} onClick={() => setStep(i)}
                                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${step === i ? "bg-blue-600 text-white shadow-sm" : i < step ? "bg-emerald-500/15 text-emerald-700" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                                    }`}
                            >
                                <Icon className="size-3.5" /> {s.label}
                            </button>
                        );
                    })}
                </div>

            {/* conteúdo do step */}
            <div className="p-6 min-h-[400px]">

                {/* Step 0: Dados Pessoais */}
                {step === 0 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><User className="size-4" /> Dados Pessoais</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Nome Completo *" value={form.nome} onChange={v => set("nome", v)} />
                            <Field label="CPF *" value={form.cpf} onChange={v => set("cpf", v)} placeholder="000.000.000-00" />
                            <Field label="RG" value={form.rg} onChange={v => set("rg", v)} />
                            <Field label="Órgão Expedidor" value={form.rgOrgaoExpedidor} onChange={v => set("rgOrgaoExpedidor", v)} />
                            <Field label="Data Expedição RG" value={form.rgDataExpedicao} onChange={v => set("rgDataExpedicao", v)} type="date" />
                            <Field label="Data Nascimento *" value={form.dataNascimento} onChange={v => set("dataNascimento", v)} type="date" />
                            <Select label="Sexo" value={form.sexo} options={SEXO_OPTIONS} onChange={v => set("sexo", Number(v))} />
                            <Select label="Estado Civil" value={form.estadoCivil} options={ESTADO_CIVIL_OPTIONS} onChange={v => set("estadoCivil", Number(v))} />
                            <Field label="Nacionalidade" value={form.nacionalidade} onChange={v => set("nacionalidade", v)} placeholder="Brasileira" />
                            <Field label="Nome da Mãe" value={form.nomeMae} onChange={v => set("nomeMae", v)} />
                            <Field label="Nome do Pai" value={form.nomePai} onChange={v => set("nomePai", v)} />
                            <Field label="Natural de (Cidade)" value={form.naturalCidade} onChange={v => set("naturalCidade", v)} />
                            <Select label="Natural UF" value={form.naturalUf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("naturalUf", v)} />
                        </div>
                        {form.nacionalidade && form.nacionalidade.toLowerCase() !== "brasileira" && (
                            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                                <div className="text-sm font-semibold text-amber-700 flex items-center gap-1"><AlertTriangle className="size-4" /> Dados do Estrangeiro</div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Passaporte" value={form.passaporte} onChange={v => set("passaporte", v)} />
                                    <Field label="RNM/RNE" value={form.rnmRne} onChange={v => set("rnmRne", v)} />
                                    <Field label="Validade Visto" value={form.validadeVisto} onChange={v => set("validadeVisto", v)} type="date" />
                                    <Field label="Tipo Visto" value={form.tipoVisto} onChange={v => set("tipoVisto", v)} />
                                </div>
                                {form.validadeVisto && new Date(form.validadeVisto) < new Date() && (
                                    <div className="mt-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700 flex items-center gap-2">
                                        <AlertTriangle className="size-4 flex-shrink-0" />
                                        <span><strong>Visto expirado!</strong> A validade do visto é anterior à data atual. O processo não poderá prosseguir até a renovação.</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: Endereço */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><MapPin className="size-4" /> Endereço</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">CEP</label>
                                <div className="flex gap-2">
                                    <Input value={form.cep || ""} onChange={e => set("cep", e.target.value)} placeholder="00000-000" />
                                    <Button variant="outline" size="sm" onClick={handleCep} type="button">Buscar</Button>
                                </div>
                            </div>
                            <Field label="Logradouro" value={form.logradouro} onChange={v => set("logradouro", v)} />
                            <Field label="Número" value={form.numero} onChange={v => set("numero", v)} />
                            <Field label="Complemento" value={form.complemento} onChange={v => set("complemento", v)} />
                            <Field label="Bairro" value={form.bairro} onChange={v => set("bairro", v)} />
                            <Field label="Cidade" value={form.cidade} onChange={v => set("cidade", v)} />
                            <Select label="UF" value={form.uf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("uf", v)} />
                        </div>
                    </div>
                )}

                {/* Step 2: Contato */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><Phone className="size-4" /> Contato</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="E-mail" value={form.email} onChange={v => set("email", v)} type="email" />
                            <Field label="Telefone" value={form.telefone} onChange={v => set("telefone", v)} />
                            <Field label="Celular" value={form.celular} onChange={v => set("celular", v)} />
                            <div className="col-span-2 border-t border-border/30 pt-3 mt-2">
                                <div className="text-xs text-muted-foreground uppercase mb-2">Contato de Emergência</div>
                            </div>
                            <Field label="Nome" value={form.contatoEmergenciaNome} onChange={v => set("contatoEmergenciaNome", v)} />
                            <Field label="Telefone" value={form.contatoEmergenciaFone} onChange={v => set("contatoEmergenciaFone", v)} />
                        </div>
                    </div>
                )}

                {/* Step 3: Bancário */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><CreditCard className="size-4" /> Dados Bancários</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Banco (FEBRABAN)</label>
                                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.bancoCodigo || ""} onChange={e => {
                                    const [cod, ...nome] = e.target.value.split("-");
                                    set("bancoCodigo", cod); set("bancoNome", nome.join("-"));
                                }}>
                                    <option value="">Selecione…</option>
                                    {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                                </select>
                            </div>
                            <Select label="Tipo de Conta" value={form.tipoConta} options={TIPO_CONTA} onChange={v => set("tipoConta", Number(v))} />
                            <Field label="Agência" value={form.agencia} onChange={v => set("agencia", v)} />
                            <Field label="Agência Dígito" value={form.agenciaDigito} onChange={v => set("agenciaDigito", v)} />
                            <Field label="Conta" value={form.conta} onChange={v => set("conta", v)} />
                            <Field label="Conta Dígito" value={form.contaDigito} onChange={v => set("contaDigito", v)} />
                        </div>
                    </div>
                )}

                {/* Step 4: Trabalhista */}
                {step === 4 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><Briefcase className="size-4" /> Dados Trabalhistas</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Estab. Código</label>
                                <EstabelecimentoAutocomplete
                                    value={form.estabelecimentoCodigo ?? null}
                                    onChange={(code) => set("estabelecimentoCodigo", code || null)}
                                    valueAsCode
                                />
                            </div>
                            <Field label="Data Admissão" value={form.dataAdmissao} onChange={v => set("dataAdmissao", v)} type="date" />
                            <Field label="Salário (R$)" value={form.salario != null ? String(form.salario) : ""} onChange={v => {
                                if (!v) { set("salario", null); return; }
                                const n = parseFloat(v);
                                set("salario", Number.isFinite(n) ? n : null);
                            }} type="number" />
                            {form.salario && form.validacaoSalarioOk === false && (
                                <div className="col-span-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                                    <div className="text-sm font-semibold text-amber-700 flex items-center gap-1">
                                        <AlertTriangle className="size-4" /> Salário fora da faixa salarial do cargo
                                    </div>
                                    <div className="text-xs text-amber-600">Informe uma justificativa para prosseguir:</div>
                                    <Input
                                        value={form.validacaoSalarioJustificativa || ""}
                                        onChange={e => set("validacaoSalarioJustificativa", e.target.value)}
                                        placeholder="Justificativa do salário fora da faixa…"
                                    />
                                </div>
                            )}
                            <Select label="Tipo Contratação" value={form.tipoContratacao} options={TIPO_CONTRATACAO} onChange={v => set("tipoContratacao", Number(v))} />
                            <Field label="Carga Horária Semanal" value={form.cargaHorariaSemanal != null ? String(form.cargaHorariaSemanal) : ""} onChange={v => {
                                if (!v) { set("cargaHorariaSemanal", null); return; }
                                const n = parseInt(v, 10);
                                if (!Number.isFinite(n) || n < 0) { set("cargaHorariaSemanal", null); return; }
                                // Backend é short — clamp em 32767 (limite superior de Int16).
                                set("cargaHorariaSemanal", Math.min(n, 32767));
                            }} type="number" />
                            <Field label="PIS/PASEP" value={form.pisPasep} onChange={v => set("pisPasep", v)} />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-border/30 pt-3 mt-2">
                            <div className="col-span-2 text-xs text-muted-foreground uppercase tracking-wider font-medium">Integração TOTVS</div>
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Cargo TOTVS</label>
                                <CargoAutocomplete
                                  value={form.codCargoTotvs != null ? String(form.codCargoTotvs) : ""}
                                  onChange={(code) => set("codCargoTotvs", toIntOrNull(code))}
                                />
                            </div>
                            <Select label="Vínculo Empregatício" value={form.codVinculoEmpregaticio} options={VINCULO_EMPREGATICIO} onChange={v => set("codVinculoEmpregaticio", Number(v))} />
                            <Select label="Tipo Funcionário" value={form.tipoFuncionario} options={TIPO_FUNCIONARIO_TOTVS} onChange={v => set("tipoFuncionario", Number(v))} />
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Categoria Salarial</label>
                                <CategoriaSalarialAutocomplete
                                  value={form.categoriaSalarial != null ? String(form.categoriaSalarial) : ""}
                                  onChange={(code) => set("categoriaSalarial", toIntOrNull(code))}
                                />
                            </div>
                            <Select label="Grau de Instrução" value={form.grauInstrucao} options={GRAU_INSTRUCAO} onChange={v => set("grauInstrucao", Number(v))} />
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Cód. Turno</label>
                                <TurnoAutocomplete
                                    value={form.codTurno ?? null}
                                    onChange={(code) => set("codTurno", toIntOrNull(code))}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Centro de Custo</label>
                                <CentroCustoAutocomplete
                                    value={form.centroCusto ?? null}
                                    onChange={(code) => set("centroCusto", code || null)}
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Unidade Lotação</label>
                                <UnidadeLotacaoAutocomplete
                                    value={form.unidadeLotacao ?? null}
                                    onChange={(code) => set("unidadeLotacao", code || null)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-border/30 pt-3 mt-2">
                            <Field label="Título Eleitor Nº" value={form.tituloEleitorNumero} onChange={v => set("tituloEleitorNumero", v)} />
                            <Field label="Zona" value={form.tituloEleitorZona} onChange={v => set("tituloEleitorZona", v)} />
                            <Field label="Seção" value={form.tituloEleitorSecao} onChange={v => set("tituloEleitorSecao", v)} />
                            <Field label="Reservista Nº" value={form.reservistaNumero} onChange={v => set("reservistaNumero", v)} />
                            <Field label="Cat. CNH" value={form.categoriaCnh} onChange={v => set("categoriaCnh", v)} />
                            <Field label="Validade CNH" value={form.validadeCnh} onChange={v => set("validadeCnh", v)} type="date" />
                            <Field label="CTPS" value={form.ctps} onChange={v => set("ctps", v)} />
                            <Field label="CTPS Série" value={form.ctpsSerie} onChange={v => set("ctpsSerie", v)} />
                            <Select label="CTPS UF" value={form.ctpsUf} options={UF_LIST.map(u => ({ value: u, label: u }))} onChange={v => set("ctpsUf", v)} />
                        </div>
                    </div>
                )}

                {/* Step 5: Documentos — campo individual por tipo */}
                {step === 5 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><FileUp className="size-4" /> Documentos — {form.tipoContratacao === 1 ? "PJ" : "CLT"}</h5>
                        <div className="space-y-3">
                            {getDocsPorTipo(form.tipoContratacao ?? null).map(docTipo => {
                                const hasLados = TIPOS_COM_VERSO.has(docTipo.value);

                                const uploadSlot = (lado: number, sideLabel: string) => {
                                    const enviado = form.documentos?.find(d =>
                                        resolveDocTipo(d.tipo) === docTipo.value &&
                                        (hasLados ? resolveDocLado(d.lado) === lado : true)
                                    );
                                    return (
                                        <div key={`${docTipo.value}-${lado}`} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {enviado ? (
                                                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <span className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium">{sideLabel}</div>
                                                    {enviado && (
                                                        <div className="text-xs text-muted-foreground truncate">{enviado.nomeArquivo} • {(enviado.tamanhoBytes / 1024).toFixed(0)} KB</div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="shrink-0 flex items-center gap-2">
                                                {enviado ? (
                                                    <>
                                                        {enviado.presignedUrl && (
                                                            <Button variant="outline" size="sm" onClick={() => window.open(enviado.presignedUrl, "_blank")}>
                                                                <Eye className="size-3.5 mr-1" /> Visualizar
                                                            </Button>
                                                        )}
                                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteDoc(enviado.id)}>Remover</Button>
                                                    </>
                                                ) : (
                                                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors">
                                                        <Upload className="size-3" /> Enviar
                                                        <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const fd = new FormData();
                                                            fd.append("file", file);
                                                            fd.append("tipo", String(docTipo.value));
                                                            fd.append("lado", String(lado));
                                                            try {
                                                                const res = await apiFetch(`/api/pre-admissao/${id}/documentos`, { method: "POST", body: fd });
                                                                if (!res.ok) throw new Error("Falha no upload");
                                                                toast.success(`${sideLabel} enviado!`);
                                                                await loadData();
                                                            } catch { toast.error(`Falha ao enviar ${sideLabel}`); }
                                                            e.target.value = "";
                                                        }} />
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    );
                                };

                                return (
                                    <div key={docTipo.value} className="rounded-lg border border-border/40 p-3">
                                        {hasLados ? (
                                            <div className="space-y-0 divide-y divide-border/40">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pb-2">{docTipo.label}</p>
                                                {uploadSlot(1, `${docTipo.label} — Frente`)}
                                                {uploadSlot(2, `${docTipo.label} — Costas`)}
                                            </div>
                                        ) : (
                                            uploadSlot(0, docTipo.label)
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Step 6: Revisão */}
                {step === 6 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><CheckCircle2 className="size-4" /> Revisão Final</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            <Info label="Nome" value={form.nome} />
                            <Info label="CPF" value={form.cpf} />
                            <Info label="RG" value={form.rg} />
                            <Info label="Email" value={form.email} />
                            <Info label="Celular" value={form.celular} />
                            <Info label="Nascimento" value={form.dataNascimento} />
                            <Info label="Nacionalidade" value={form.nacionalidade} />
                            <Info label="Endereço" value={[form.logradouro, form.numero].filter(Boolean).join(", ")} />
                            <Info label="Cidade/UF" value={[form.cidade, form.uf].filter(Boolean).join("/")} />
                            <Info label="Banco" value={form.bancoNome} />
                            <Info label="Agência" value={form.agencia} />
                            <Info label="Conta" value={form.conta} />
                            <Info label="Estab." value={form.estabelecimentoCodigo} />
                            <Info label="Data Admissão" value={form.dataAdmissao} />
                            <Info label="Salário" value={form.salario != null ? fmtBrl(form.salario) : null} />
                            <Info label="Tipo Contratação" value={TIPO_CONTRATACAO.find(t => t.value === form.tipoContratacao)?.label} />
                            <Info label="Cargo TOTVS" value={form.codCargoTotvs != null ? String(form.codCargoTotvs) : null} />
                            <Info label="Vínculo" value={VINCULO_EMPREGATICIO.find(v => v.value === form.codVinculoEmpregaticio)?.label} />
                            <Info label="Tipo Func." value={TIPO_FUNCIONARIO_TOTVS.find(v => v.value === form.tipoFuncionario)?.label} />
                            <Info label="Grau Instrução" value={GRAU_INSTRUCAO.find(v => v.value === form.grauInstrucao)?.label} />
                            <Info label="Centro Custo" value={form.centroCusto} />
                            <Info label="Unid. Lotação" value={form.unidadeLotacao} />
                            <Info label="Documentos" value={`${form.documentos?.length ?? 0} arquivo(s)`} />
                        </div>
                        <div className="rounded-md bg-sky-500/10 p-3 text-sm text-sky-700">
                            Revise os dados antes de finalizar. Após finalizar, a admissão será processada.
                        </div>
                    </div>
                )}
            </div>

            {/* navigation buttons — rodapé do card */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/40 bg-muted/10">
                <Button variant="outline" disabled={step === 0} onClick={() => setStep(s => s - 1)}>
                    <ChevronLeft className="size-4" /> Anterior
                </Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Salvar Rascunho
                    </Button>
                    {step < STEPS.length - 1 ? (
                        <Button className="bg-blue-600 hover:bg-blue-700" onClick={async () => { await save(); setStep(s => s + 1); }}>
                            Próximo <ChevronRight className="size-4" />
                        </Button>
                    ) : (
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submit} disabled={submitting}>
                            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Finalizar Admissão
                        </Button>
                    )}
                </div>
            </div>
            </div>{/* fim card unificado */}
        </section>
    );
}

/* ── sub-components ── */

function Field({ label, value, onChange, type = "text", placeholder }: {
    label: string; value: unknown; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
    return (
        <div>
            <label className="text-xs text-muted-foreground block mb-1">{label}</label>
            <Input type={type} value={(value as string) || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        </div>
    );
}

function Select({ label, value, options, onChange }: {
    label: string; value: unknown; options: { value: string | number; label: string }[]; onChange: (v: string) => void;
}) {
    return (
        <div>
            <label className="text-xs text-muted-foreground block mb-1">{label}</label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={String(value ?? "")} onChange={e => onChange(e.target.value)}>
                <option value="">Selecione…</option>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
        </div>
    );
}

function Info({ label, value }: { label: string; value: unknown }) {
    return (
        <div className="rounded-lg border border-border/30 bg-muted/10 p-2">
            <div className="text-[10px] text-muted-foreground uppercase">{label}</div>
            <div className="text-sm font-medium truncate">{(value as string) || "—"}</div>
        </div>
    );
}
