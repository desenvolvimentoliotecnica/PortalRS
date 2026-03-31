"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    User, MapPin, Phone, CreditCard, Briefcase, FileUp, CheckCircle2,
    ChevronLeft, ChevronRight, Save, Send, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

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
    areaId: string | null;
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
    validacaoSalarioJustificativa: string | null;
    status: number;
    documentos: { id: string; tipo: number; nomeArquivo: string; contentType: string; tamanhoBytes: number; status: number; createdAtUtc: string }[];
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
const TIPO_DOC = [
    { value: 0, label: "RG" }, { value: 1, label: "CPF" }, { value: 2, label: "CNH" },
    { value: 3, label: "Comprovante Residência" }, { value: 4, label: "Comprovante Bancário" },
    { value: 5, label: "Certidão Nascimento/Casamento" }, { value: 6, label: "CTPS" },
    { value: 7, label: "Título Eleitor" }, { value: 8, label: "Reservista" }, { value: 9, label: "Outro" },
];
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
    const [uploadTipo, setUploadTipo] = useState(0);
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
        try {
            setSubmitting(true);
            await save();
            const res = await apiFetch(`/api/pre-admissao/${id}/submit`, { method: "POST" });
            if (res.ok) { toast.success("Admissão enviada para revisão do RH!"); router.push("/admissao?submitted=1"); }
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

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !id) return;
        const fd = new FormData();
        fd.append("file", file);
        fd.append("tipo", String(uploadTipo));
        try {
            const res = await apiFetch(`/api/pre-admissao/${id}/documentos`, { method: "POST", body: fd });
            if (res.ok) { toast.success("Documento enviado!"); loadData(); }
            else {
                const body = await res.json().catch(() => null);
                toast.error(body?.title ?? body?.detail ?? "Erro no upload — verifique o tipo e tamanho do arquivo");
            }
        } catch {
            toast.error("Erro de conexão ao enviar o documento");
        } finally {
            e.target.value = "";
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
        <section className="space-y-4 max-w-4xl mx-auto">
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

            {/* step indicators */}
            <div className="flex gap-1 overflow-x-auto pb-1">
                {STEPS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                        <button key={s.key} onClick={() => setStep(i)}
                            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${step === i ? "bg-blue-600 text-white" : i < step ? "bg-emerald-500/15 text-emerald-700" : "bg-muted/50 text-muted-foreground"
                                }`}
                        >
                            <Icon className="size-3.5" /> {s.label}
                        </button>
                    );
                })}
            </div>

            {/* form card */}
            <div className="card-soft rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur min-h-[400px]">

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
                                    <Field label="Validade Visto *" value={form.validadeVisto} onChange={v => set("validadeVisto", v)} type="date" />
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
                            <Field label="E-mail *" value={form.email} onChange={v => set("email", v)} type="email" />
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
                            <Field label="Estab. Código" value={form.estabelecimentoCodigo} onChange={v => set("estabelecimentoCodigo", v)} placeholder="001" />
                            <Field label="Data Admissão *" value={form.dataAdmissao} onChange={v => set("dataAdmissao", v)} type="date" />
                            <Field label="Salário (R$)" value={form.salario != null ? String(form.salario) : ""} onChange={v => set("salario", v ? parseFloat(v) : null)} type="number" />
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
                            <Field label="Carga Horária Semanal" value={form.cargaHorariaSemanal != null ? String(form.cargaHorariaSemanal) : ""} onChange={v => set("cargaHorariaSemanal", v ? parseInt(v) : null)} type="number" />
                            <Field label="PIS/PASEP" value={form.pisPasep} onChange={v => set("pisPasep", v)} />
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

                {/* Step 5: Documentos */}
                {step === 5 && (
                    <div className="space-y-4">
                        <h5 className="font-semibold text-sm flex items-center gap-2"><FileUp className="size-4" /> Upload de Documentos</h5>
                        <div className="flex flex-wrap items-end gap-3">
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Tipo de Documento</label>
                                <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={uploadTipo} onChange={e => setUploadTipo(Number(e.target.value))}>
                                    {TIPO_DOC.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground block mb-1">Arquivo (PDF, JPG, PNG — máx 10MB)</label>
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleUpload} className="text-sm" />
                            </div>
                        </div>
                        {(form.documentos?.length ?? 0) > 0 && (
                            <div className="space-y-2">
                                {form.documentos!.map(d => (
                                    <div key={d.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 p-3">
                                        <div>
                                            <div className="text-sm font-medium">{d.nomeArquivo}</div>
                                            <div className="text-xs text-muted-foreground">{TIPO_DOC.find(t => t.value === d.tipo)?.label} • {(d.tamanhoBytes / 1024).toFixed(0)} KB</div>
                                        </div>
                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteDoc(d.id)}>Remover</Button>
                                    </div>
                                ))}
                            </div>
                        )}
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
                            <Info label="Documentos" value={`${form.documentos?.length ?? 0} arquivo(s)`} />
                        </div>
                        <div className="rounded-md bg-sky-500/10 p-3 text-sm text-sky-700">
                            Ao submeter, a admissão será enviada para revisão e aprovação do RH. Você não poderá editar após a submissão.
                        </div>
                    </div>
                )}
            </div>

            {/* navigation buttons */}
            <div className="flex items-center justify-between">
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
                            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Submeter para Revisão
                        </Button>
                    )}
                </div>
            </div>
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
