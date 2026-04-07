"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, User, MapPin, Phone, CreditCard, Briefcase, HeartPulse } from "lucide-react";

interface DadosPessoais {
    nome?: string | null; cpf?: string | null; rg?: string | null; rgOrgaoExpedidor?: string | null;
    dataNascimento?: string | null; sexo?: number | null; estadoCivil?: number | null;
    nacionalidade?: string | null; nomeMae?: string | null; nomePai?: string | null;
    cep?: string | null; logradouro?: string | null; numero?: string | null;
    complemento?: string | null; bairro?: string | null; cidade?: string | null; uf?: string | null;
    email?: string | null; telefone?: string | null; celular?: string | null;
    contatoEmergenciaNome?: string | null; contatoEmergenciaFone?: string | null;
    bancoCodigo?: string | null; bancoNome?: string | null; agencia?: string | null;
    agenciaDigito?: string | null; conta?: string | null; contaDigito?: string | null; tipoConta?: number | null;
    pisPasep?: string | null; ctps?: string | null; ctpsSerie?: string | null; ctpsUf?: string | null;
    // Saúde e docs complementares TOTVS
    grupoSanguineo?: number | null; fatorRh?: number | null; possuiDeficiencia?: string | null;
    docMilitarTipo?: number | null; docMilitarNumero?: string | null; docMilitarSerie?: string | null; docMilitarRegiao?: number | null;
    cartaoSus?: string | null; tituloEleitorCidade?: string | null; tituloEleitorUf?: string | null;
    ctpsModelo?: number | null; altura?: number | null; peso?: number | null;
}

interface Props {
    dados: DadosPessoais;
    onSave: (data: DadosPessoais) => Promise<void>;
    disabled?: boolean;
}

const SEXO_OPTIONS = [
    { value: 0, label: "Não Informado" }, { value: 1, label: "Masculino" },
    { value: 2, label: "Feminino" }, { value: 3, label: "Outro" },
];
const ESTADO_CIVIL_OPTIONS = [
    { value: 0, label: "Não Informado" }, { value: 1, label: "Solteiro(a)" },
    { value: 2, label: "Casado(a)" }, { value: 3, label: "Divorciado(a)" },
    { value: 4, label: "Viúvo(a)" }, { value: 5, label: "União Estável" }, { value: 6, label: "Separado(a)" },
];
const TIPO_CONTA_OPTIONS = [
    { value: 0, label: "Conta Corrente" }, { value: 1, label: "Conta Poupança" }, { value: 2, label: "Conta Salário" },
];

const GRUPO_SANGUINEO_OPTIONS = [
    { value: 1, label: "A" }, { value: 2, label: "B" }, { value: 3, label: "AB" }, { value: 4, label: "O" },
];
const FATOR_RH_OPTIONS = [
    { value: 1, label: "Positivo (+)" }, { value: 2, label: "Negativo (-)" },
];
const CTPS_MODELO_OPTIONS = [
    { value: 1, label: "Papel" }, { value: 3, label: "Digital" },
];
const DOC_MILITAR_TIPO_OPTIONS = [
    { value: 1, label: "Certificado de Reservista" }, { value: 2, label: "Certificado de Dispensa" }, { value: 3, label: "Certificado de Alistamento" },
];

type TabKey = "pessoais" | "endereco" | "contato" | "bancario" | "trabalhista" | "saude";

const TABS: { key: TabKey; label: string; icon: React.ElementType; fields: (keyof DadosPessoais)[] }[] = [
    { key: "pessoais", label: "Dados Pessoais", icon: User, fields: ["nome", "rg", "dataNascimento", "nacionalidade"] },
    { key: "endereco", label: "Endereço", icon: MapPin, fields: ["cep", "logradouro", "cidade", "uf"] },
    { key: "contato", label: "Contato", icon: Phone, fields: ["email", "celular"] },
    { key: "bancario", label: "Dados Bancários", icon: CreditCard, fields: ["bancoCodigo", "conta"] },
    { key: "trabalhista", label: "Dados Trabalhistas", icon: Briefcase, fields: ["pisPasep", "ctps"] },
    { key: "saude", label: "Saúde e Documentos", icon: HeartPulse, fields: ["grupoSanguineo", "cartaoSus", "altura"] },
];

function checkFilled(form: DadosPessoais, fields: (keyof DadosPessoais)[]): "ok" | "partial" | "empty" {
    const filled = fields.filter(f => form[f] != null && String(form[f]).trim() !== "").length;
    if (filled === 0) return "empty";
    if (filled >= fields.length) return "ok";
    return "partial";
}

export default function DadosPessoaisForm({ dados, onSave, disabled }: Props) {
    const [form, setForm] = useState<DadosPessoais>({ ...dados });
    const [saving, setSaving] = useState(false);
    const [buscandoCep, setBuscandoCep] = useState(false);
    const [activeTab, setActiveTab] = useState<TabKey>("pessoais");

    function set(field: keyof DadosPessoais, value: string | number | null) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setSaving(true);
        try { await onSave(form); } finally { setSaving(false); }
    }

    const selectCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm";

    return (
        <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-border/40 pb-px">
                {TABS.map(tab => {
                    const status = checkFilled(form, tab.fields);
                    const Icon = tab.icon;
                    return (
                        <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                            <span className={`size-2.5 rounded-full ${status === "ok" ? "bg-emerald-500" : status === "partial" ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
                            <Icon className="size-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab: Dados Pessoais */}
            {activeTab === "pessoais" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Field label="Nome Completo"><Input value={form.nome ?? ""} onChange={e => set("nome", e.target.value)} disabled={disabled} /></Field>
                    <Field label="CPF"><Input value={form.cpf ?? ""} disabled className="bg-muted" /></Field>
                    <Field label="RG"><Input value={form.rg ?? ""} onChange={e => set("rg", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Órgão Expedidor"><Input value={form.rgOrgaoExpedidor ?? ""} onChange={e => set("rgOrgaoExpedidor", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Data de Nascimento"><Input type="date" value={form.dataNascimento ?? ""} onChange={e => set("dataNascimento", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Sexo">
                        <select className={selectCls} value={form.sexo ?? 0} onChange={e => set("sexo", Number(e.target.value))} disabled={disabled}>
                            {SEXO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Estado Civil">
                        <select className={selectCls} value={form.estadoCivil ?? 0} onChange={e => set("estadoCivil", Number(e.target.value))} disabled={disabled}>
                            {ESTADO_CIVIL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Nacionalidade"><Input value={form.nacionalidade ?? ""} onChange={e => set("nacionalidade", e.target.value)} disabled={disabled} placeholder="Brasileira" /></Field>
                    <Field label="Nome da Mãe"><Input value={form.nomeMae ?? ""} onChange={e => set("nomeMae", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Nome do Pai"><Input value={form.nomePai ?? ""} onChange={e => set("nomePai", e.target.value)} disabled={disabled} /></Field>
                </div>
            )}

            {/* Tab: Endereço */}
            {activeTab === "endereco" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Field label="CEP">
                        <div className="flex gap-2">
                            <Input value={form.cep ?? ""} onChange={e => {
                                const raw = e.target.value.replace(/\D/g, "");
                                const formatted = raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5, 8)}` : raw;
                                set("cep", formatted);
                                if (raw.length === 8) {
                                    setBuscandoCep(true);
                                    fetch(`https://viacep.com.br/ws/${raw}/json/`)
                                        .then(r => r.json())
                                        .then((d: Record<string, string>) => {
                                            if (!d.erro) {
                                                setForm(prev => ({ ...prev, logradouro: d.logradouro || prev.logradouro, bairro: d.bairro || prev.bairro, cidade: d.localidade || prev.cidade, uf: d.uf || prev.uf, complemento: d.complemento || prev.complemento }));
                                            }
                                        }).catch(() => {}).finally(() => setBuscandoCep(false));
                                }
                            }} disabled={disabled} placeholder="00000-000" maxLength={9} />
                            {buscandoCep && <Loader2 className="size-4 animate-spin text-muted-foreground mt-2" />}
                        </div>
                    </Field>
                    <Field label="Logradouro"><Input value={form.logradouro ?? ""} onChange={e => set("logradouro", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Número"><Input value={form.numero ?? ""} onChange={e => set("numero", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Complemento"><Input value={form.complemento ?? ""} onChange={e => set("complemento", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Bairro"><Input value={form.bairro ?? ""} onChange={e => set("bairro", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Cidade"><Input value={form.cidade ?? ""} onChange={e => set("cidade", e.target.value)} disabled={disabled} /></Field>
                    <Field label="UF"><Input value={form.uf ?? ""} onChange={e => set("uf", e.target.value)} disabled={disabled} maxLength={2} /></Field>
                </div>
            )}

            {/* Tab: Contato */}
            {activeTab === "contato" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Field label="E-mail"><Input type="email" value={form.email ?? ""} onChange={e => set("email", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Telefone"><Input value={form.telefone ?? ""} onChange={e => set("telefone", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Celular"><Input value={form.celular ?? ""} onChange={e => set("celular", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Contato de Emergência"><Input value={form.contatoEmergenciaNome ?? ""} onChange={e => set("contatoEmergenciaNome", e.target.value)} disabled={disabled} placeholder="Nome" /></Field>
                    <Field label="Fone Emergência"><Input value={form.contatoEmergenciaFone ?? ""} onChange={e => set("contatoEmergenciaFone", e.target.value)} disabled={disabled} /></Field>
                </div>
            )}

            {/* Tab: Dados Bancários */}
            {activeTab === "bancario" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Field label="Banco (código)"><Input value={form.bancoCodigo ?? ""} onChange={e => set("bancoCodigo", e.target.value)} disabled={disabled} placeholder="001" /></Field>
                    <Field label="Banco (nome)"><Input value={form.bancoNome ?? ""} onChange={e => set("bancoNome", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Agência"><Input value={form.agencia ?? ""} onChange={e => set("agencia", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Dígito Ag."><Input value={form.agenciaDigito ?? ""} onChange={e => set("agenciaDigito", e.target.value)} disabled={disabled} maxLength={2} /></Field>
                    <Field label="Conta"><Input value={form.conta ?? ""} onChange={e => set("conta", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Dígito Conta"><Input value={form.contaDigito ?? ""} onChange={e => set("contaDigito", e.target.value)} disabled={disabled} maxLength={2} /></Field>
                    <Field label="Tipo Conta">
                        <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" value={form.tipoConta ?? ""} onChange={e => set("tipoConta", e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
                            <option value="">Selecione</option>
                            {TIPO_CONTA_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                </div>
            )}

            {/* Tab: Dados Trabalhistas */}
            {activeTab === "trabalhista" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Field label="PIS/PASEP"><Input value={form.pisPasep ?? ""} onChange={e => set("pisPasep", e.target.value)} disabled={disabled} /></Field>
                    <Field label="CTPS"><Input value={form.ctps ?? ""} onChange={e => set("ctps", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Série CTPS"><Input value={form.ctpsSerie ?? ""} onChange={e => set("ctpsSerie", e.target.value)} disabled={disabled} /></Field>
                    <Field label="UF CTPS"><Input value={form.ctpsUf ?? ""} onChange={e => set("ctpsUf", e.target.value)} disabled={disabled} maxLength={2} /></Field>
                </div>
            )}

            {/* Tab: Saúde e Documentos */}
            {activeTab === "saude" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <Field label="Grupo Sanguíneo">
                        <select className={selectCls} value={form.grupoSanguineo ?? ""} onChange={e => set("grupoSanguineo", e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
                            <option value="">Selecione</option>
                            {GRUPO_SANGUINEO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Fator Rh">
                        <select className={selectCls} value={form.fatorRh ?? ""} onChange={e => set("fatorRh", e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
                            <option value="">Selecione</option>
                            {FATOR_RH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Possui Deficiência">
                        <select className={selectCls} value={form.possuiDeficiencia ?? ""} onChange={e => set("possuiDeficiencia", e.target.value || null)} disabled={disabled}>
                            <option value="">Selecione</option>
                            <option value="S">Sim</option>
                            <option value="N">Não</option>
                        </select>
                    </Field>
                    <Field label="Cartão SUS"><Input value={form.cartaoSus ?? ""} onChange={e => set("cartaoSus", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Altura (cm)"><Input type="number" value={form.altura ?? ""} onChange={e => set("altura", e.target.value ? Number(e.target.value) : null)} disabled={disabled} /></Field>
                    <Field label="Peso (kg)"><Input type="number" value={form.peso ?? ""} onChange={e => set("peso", e.target.value ? Number(e.target.value) : null)} disabled={disabled} /></Field>
                    <Field label="Modelo CTPS">
                        <select className={selectCls} value={form.ctpsModelo ?? ""} onChange={e => set("ctpsModelo", e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
                            <option value="">Selecione</option>
                            {CTPS_MODELO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Tipo Doc. Militar">
                        <select className={selectCls} value={form.docMilitarTipo ?? ""} onChange={e => set("docMilitarTipo", e.target.value ? Number(e.target.value) : null)} disabled={disabled}>
                            <option value="">Selecione</option>
                            {DOC_MILITAR_TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </Field>
                    <Field label="Nº Doc. Militar"><Input value={form.docMilitarNumero ?? ""} onChange={e => set("docMilitarNumero", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Série Doc. Militar"><Input value={form.docMilitarSerie ?? ""} onChange={e => set("docMilitarSerie", e.target.value)} disabled={disabled} /></Field>
                    <Field label="Região Militar"><Input type="number" value={form.docMilitarRegiao ?? ""} onChange={e => set("docMilitarRegiao", e.target.value ? Number(e.target.value) : null)} disabled={disabled} /></Field>
                    <Field label="Cidade Título Eleitor"><Input value={form.tituloEleitorCidade ?? ""} onChange={e => set("tituloEleitorCidade", e.target.value)} disabled={disabled} /></Field>
                    <Field label="UF Título Eleitor"><Input value={form.tituloEleitorUf ?? ""} onChange={e => set("tituloEleitorUf", e.target.value)} disabled={disabled} maxLength={2} /></Field>
                </div>
            )}

            {/* Salvar */}
            {!disabled && (
                <div className="flex justify-end pt-2">
                    <Button size="lg" onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
                        Salvar Dados
                    </Button>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
            {children}
        </div>
    );
}
